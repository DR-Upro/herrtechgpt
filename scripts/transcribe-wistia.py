"""
Wistia → AssemblyAI → Supabase Knowledge Base Pipeline
Transkribiert alle Wistia-Videos und speichert sie als durchsuchbare Wissensbasis.

Verwendung:
  python3 scripts/transcribe-wistia.py

Optionen:
  --test              Nur 1 Video testen
  --all               Alle Videos verarbeiten
  --id 12345          Nur ein bestimmtes Video
  --language en       Quellsprache des Videos (Default: de).
                      Bei != de werden die Schnipsel über Claude ins Deutsche
                      übersetzt, bevor sie in der Werkbank landen — die
                      deutschen Agenten arbeiten so weiterhin auf Deutsch.
"""

import requests
import json
import time
import sys
import re
import os
from typing import Optional

# ─── Konfiguration (aus .env.local) ───────────────────────────────────────────
def _load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())

_load_env()

WISTIA_KEY    = os.environ.get("WISTIA_API_KEY", "")
ASSEMBLY_KEY  = os.environ.get("ASSEMBLYAI_API_KEY", "")
SUPABASE_URL  = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")  # für Übersetzung nicht-deutscher Videos

CHUNK_WORDS    = 500   # Wörter pro Chunk
LANGUAGE       = "de"  # Default — per --language en|... überschreibbar
TRANSLATE_MODEL = "claude-sonnet-4-5-20250929"

# Nur wirklich irrelevante Videos überspringen
# Live Calls werden INKLUDIERT — sie sind die aktuellsten Quellen!
SKIP_PATTERNS = [
    "Skool_Intro",
    "Masterclass_Intro",
    "SkoolVideo",
    "street_interview",
    "A_nerd",
    "I never pay",
    "Referenz",
    "Empfehlung",
    "KIMarketingClub",   # Marketing-Testimonials
]

# ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

def should_skip(name: str) -> bool:
    """Überspringt veraltete/irrelevante Videos."""
    for pattern in SKIP_PATTERNS:
        if pattern.lower() in name.lower():
            return True
    return False


def get_all_videos() -> list:
    """Holt alle Videos aus Wistia."""
    videos = []
    page = 1
    while True:
        r = requests.get(
            "https://api.wistia.com/v1/medias.json",
            params={"api_password": WISTIA_KEY, "per_page": 100, "page": page}
        )
        batch = r.json()
        if not batch:
            break
        videos.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return videos


def get_video_url(video_id: str) -> Optional[str]:
    """Holt die beste MP4-URL für ein Video."""
    r = requests.get(
        f"https://api.wistia.com/v1/medias/{video_id}.json",
        params={"api_password": WISTIA_KEY}
    )
    data = r.json()
    assets = data.get("assets", [])

    # Bevorzuge mittlere Qualität (kleiner = schneller für Transkription)
    preferred = ["Mp4VideoFile", "IphoneVideoFile", "MdMp4VideoFile", "OriginalFile"]
    for pref in preferred:
        for a in assets:
            if a.get("type") == pref and a.get("contentType") == "video/mp4":
                return a["url"]
    # Fallback: erstes MP4
    for a in assets:
        if a.get("contentType") == "video/mp4":
            return a["url"]
    return None


def submit_to_assemblyai(audio_url: str) -> str:
    """Sendet Video-URL an AssemblyAI zur Transkription."""
    r = requests.post(
        "https://api.assemblyai.com/v2/transcript",
        headers={"Authorization": ASSEMBLY_KEY},
        json={
            "audio_url": audio_url,
            "speech_models": ["universal-2"],
            "language_code": LANGUAGE,
            "punctuate": True,
            "format_text": True,
        }
    )
    return r.json()["id"]


def wait_for_transcript(transcript_id: str, video_name: str) -> Optional[str]:
    """Wartet bis die Transkription fertig ist."""
    print(f"    ⏳ Warte auf Transkription...", end="", flush=True)
    while True:
        r = requests.get(
            f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
            headers={"Authorization": ASSEMBLY_KEY}
        )
        data = r.json()
        status = data.get("status")

        if status == "completed":
            print(" ✅")
            return data.get("text", "")
        elif status == "error":
            print(f" ❌ Fehler: {data.get('error')}")
            return None
        elif status in ["queued", "processing"]:
            print(".", end="", flush=True)
            time.sleep(8)
        else:
            print(f" ? Status: {status}")
            time.sleep(5)


def chunk_text(text: str, video_name: str, video_id: str, duration_min: float) -> list:
    """Teilt den Text in Chunks auf (~500 Wörter)."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), CHUNK_WORDS):
        chunk = " ".join(words[i:i + CHUNK_WORDS])
        chunks.append({
            "video_id": str(video_id),
            "video_name": video_name,
            "chunk_text": chunk,
            "chunk_index": i // CHUNK_WORDS,
            "duration_minutes": round(duration_min, 1),
            "is_active": True,
            "source": "wistia"
        })
    return chunks


def translate_chunks_to_german(chunks: list, source_lang: str) -> Optional[list]:
    """
    Übersetzt das chunk_text-Feld jedes Schnipsels via Claude ins Deutsche.
    Eigennamen/Produktnamen bleiben unverändert. Gibt None bei Fehler zurück.
    """
    if not ANTHROPIC_KEY:
        print("    ❌ ANTHROPIC_API_KEY fehlt — Übersetzung nicht möglich")
        return None

    translated = []
    for idx, chunk in enumerate(chunks, start=1):
        prompt = (
            f"Übersetze den folgenden Text aus dem {source_lang.upper()} ins Deutsche. "
            "Behalte den Sinn präzise. Lass Eigennamen, Produktbezeichnungen und "
            "Marken unverändert. Klinge natürlich und flüssig auf Deutsch (kein "
            "wörtliches Wort-für-Wort). Antworte AUSSCHLIESSLICH mit dem übersetzten "
            "Text — keine Vorbemerkung, keine Anführungszeichen, keine Erklärung.\n\n"
            f"---\n\n{chunk['chunk_text']}"
        )
        try:
            r = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": TRANSLATE_MODEL,
                    "max_tokens": 4000,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=300,
            )
            r.raise_for_status()
            data = r.json()
            german_text = data["content"][0]["text"].strip()
            if not german_text:
                print(f"    ❌ Schnipsel {idx}/{len(chunks)}: leere Übersetzung")
                return None
            new_chunk = dict(chunk)
            new_chunk["chunk_text"] = german_text
            translated.append(new_chunk)
            print(f"    🌐 Schnipsel {idx}/{len(chunks)} ins Deutsche übersetzt")
        except Exception as e:
            print(f"    ❌ Übersetzung Schnipsel {idx} fehlgeschlagen: {e}")
            return None

    return translated


def save_to_supabase(chunks: list) -> bool:
    """Speichert Chunks in der Supabase knowledge_base Tabelle."""
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/knowledge_base",
        headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "apikey": SUPABASE_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        },
        json=chunks
    )
    return r.status_code in [200, 201]


def already_processed(video_id: str) -> bool:
    """Prüft ob das Video bereits in der Datenbank ist."""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/knowledge_base",
        headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "apikey": SUPABASE_KEY,
        },
        params={"video_id": f"eq.{video_id}", "select": "id", "limit": 1}
    )
    return len(r.json()) > 0


# ─── Hauptprogramm ────────────────────────────────────────────────────────────

def process_video(video: dict) -> bool:
    """Verarbeitet ein einzelnes Video komplett."""
    vid_id   = str(video["id"])
    vid_name = video["name"]
    duration = video.get("duration", 0) / 60  # Sekunden → Minuten

    print(f"\n📹 {vid_name} ({round(duration, 1)} min)")

    # Sehr kurze Videos überspringen (< 1 Minute)
    if duration < 1:
        print("    ⏭️  Übersprungen (zu kurz)")
        return True

    # Bereits verarbeitet?
    if already_processed(vid_id):
        print("    ✅ Bereits in Datenbank")
        return True

    # Video-URL holen
    url = get_video_url(vid_id)
    if not url:
        print("    ❌ Keine Video-URL gefunden")
        return False

    # An AssemblyAI senden
    print(f"    📤 Sende an AssemblyAI...")
    transcript_id = submit_to_assemblyai(url)

    # Warten bis fertig
    text = wait_for_transcript(transcript_id, vid_name)
    if not text:
        return False

    print(f"    📝 {len(text.split())} Wörter transkribiert")

    # In Chunks aufteilen
    chunks = chunk_text(text, vid_name, vid_id, duration)

    # Nicht-deutsche Videos: jeden Schnipsel über Claude ins Deutsche übersetzen,
    # damit die deutschen Agenten weiterhin auf Deutsch arbeiten.
    if LANGUAGE != "de":
        print(f"    🌐 Übersetze {len(chunks)} Schnipsel von {LANGUAGE.upper()} ins Deutsche...")
        chunks = translate_chunks_to_german(chunks, LANGUAGE)
        if chunks is None:
            return False

    print(f"    💾 Speichere {len(chunks)} Chunks in Supabase...")
    if save_to_supabase(chunks):
        print(f"    ✅ Gespeichert!")
        return True
    else:
        print(f"    ❌ Fehler beim Speichern")
        return False


def main():
    global LANGUAGE

    # --language <code> extrahieren (darf irgendwo in der Befehlszeile stehen)
    args = list(sys.argv[1:])
    if "--language" in args:
        i = args.index("--language")
        if i + 1 < len(args):
            LANGUAGE = args[i + 1].lower().strip()
            del args[i:i + 2]
        else:
            print("❌ --language braucht einen Sprachcode (z.B. en, de)")
            return

    mode = "--test"
    target_id = None

    if args:
        mode = args[0]
        if mode == "--id" and len(args) > 1:
            target_id = args[1]

    print("🚀 Wistia → AssemblyAI → Supabase Pipeline")
    if LANGUAGE != "de":
        print(f"   🌐 Quellsprache: {LANGUAGE.upper()} → Übersetzung nach Deutsch aktiv")
    else:
        print(f"   Sprache: Deutsch")
    print("=" * 50)

    # Alle Videos laden
    print("📋 Lade Video-Liste von Wistia...")
    all_videos = get_all_videos()
    print(f"   {len(all_videos)} Videos gefunden")

    # Filtern
    if target_id:
        videos = [v for v in all_videos if str(v["id"]) == target_id]
    elif mode == "--test":
        # Test: erstes nicht-übersprungenes Video
        videos = [v for v in all_videos if not should_skip(v["name"])][:1]
    elif mode == "--all":
        videos = [v for v in all_videos if not should_skip(v["name"])]
    else:
        print("Verwendung: python3 transcribe-wistia.py [--test | --all | --id VIDEO_ID]")
        return

    # Filter-Statistik
    skipped = [v for v in all_videos if should_skip(v["name"])]
    total_min = sum(v.get("duration", 0) for v in videos) / 60
    print(f"   {len(videos)} Videos werden verarbeitet ({round(total_min, 1)}h)")
    print(f"   {len(skipped)} Videos übersprungen (Live Calls, veraltete Inhalte)")

    # Verarbeiten
    success = 0
    failed  = 0
    for video in videos:
        ok = process_video(video)
        if ok:
            success += 1
        else:
            failed += 1

    # Zusammenfassung
    print("\n" + "=" * 50)
    print(f"✅ Erfolgreich: {success}")
    print(f"❌ Fehlgeschlagen: {failed}")
    print(f"\n🎉 Fertig! Die Wissensbasis ist jetzt in Supabase gespeichert.")


if __name__ == "__main__":
    main()
