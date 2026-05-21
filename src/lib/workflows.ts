export interface WorkflowStep {
  phase: string
  title: string
  description: string
  prompt?: string
  tip?: string
  warning?: string
}

export interface WorkflowDefinition {
  id: string
  name: string
  emoji: string
  description: string
  duration: string
  difficulty: 'Einfach' | 'Mittel' | 'Fortgeschritten'
  techStack: string[]
  steps: WorkflowStep[]
}

export const workflows: WorkflowDefinition[] = [
  {
    id: 'carousel',
    name: 'Karussell-Generator',
    emoji: '🎠',
    description: 'Text rein — fertige Instagram-Slides raus. Mit deinen CI-Farben, 1080×1080px, ZIP-Download.',
    duration: '1 Minute',
    difficulty: 'Einfach',
    techStack: ['KI', 'Instant Download'],
    steps: [],
  },
  {
    id: 'video-editor',
    name: 'KI Video Editor',
    emoji: '🎬',
    description: 'Rohes MP4 rein — fertig bearbeitetes Video raus. Claude transkribiert, analysiert Szenen und Remotion rendert das fertige Video.',
    duration: '2–3 Tage',
    difficulty: 'Fortgeschritten',
    techStack: ['Claude Code', 'OpenAI Whisper', 'Remotion', 'Next.js', 'ffmpeg'],
    steps: [
      {
        phase: 'Phase 0',
        title: 'Voraussetzungen installieren',
        description: 'Installiere Node.js v18+, Claude Code, ffmpeg und Git. Besorge dir API Keys für OpenAI (Whisper) und Anthropic (Claude).',
        tip: 'OpenAI Whisper kostet ~$0.006/min, Claude API ~$0.003/1K Token',
        prompt: `npm install -g @anthropic-ai/claude-code`,
      },
      {
        phase: 'Phase 1',
        title: 'Projekt initialisieren',
        description: 'Erstelle den Projektordner, starte Claude Code und gib den folgenden Prompt ein. Claude Code richtet die komplette Projektstruktur ein.',
        prompt: `Ich möchte eine lokale Web-App bauen, die Videos automatisch mit KI bearbeitet.

Der Stack: Node.js, Next.js, OpenAI Whisper für Transkription, Anthropic Claude API für Szenen-Analyse, Remotion für Video-Rendering und ffmpeg für Audio-Extraktion.

Bitte:
1. Erstelle die komplette Projektstruktur mit package.json
2. Installiere alle notwendigen Dependencies
3. Erstelle eine .env.local Datei mit Platzhaltern für OPENAI_API_KEY und ANTHROPIC_API_KEY
4. Erstelle eine README.md mit Setup-Anleitung

Die App soll lokal laufen (localhost:3000). Keine Cloud-Services nötig.`,
        warning: 'Nach diesem Schritt: In die .env.local deine echten API Keys eintragen!',
      },
      {
        phase: 'Phase 2',
        title: 'Transkription mit Whisper',
        description: 'Baue den Transkriptions-Layer. Claude Code erstellt die ffmpeg Audio-Extraktion und den Whisper API Endpoint.',
        prompt: `Baue jetzt den Transkriptions-Layer.

Erstelle:
1. lib/transcribe.js — eine Funktion die:
   - Mit ffmpeg den Audio-Track aus einer MP4-Datei extrahiert
   - Den Audio an OpenAI Whisper (whisper-1 Modell) schickt
   - Die Response mit Timestamps zurückgibt (verbose_json Format)
   - Das Ergebnis als JSON speichert

2. pages/api/transcribe.js — ein API-Endpoint der:
   - Eine hochgeladene MP4-Datei empfängt
   - Die transcribe() Funktion aufruft
   - Das Transkript als Response zurückgibt

Das Whisper-Output soll so aussehen:
{ text: '...', segments: [{ start: 0.0, end: 1.4, text: '...' }] }`,
        tip: 'Bonus: Erweitere die App mit URL-Input (YouTube, Instagram Reels, TikTok). Nutze yt-dlp zum Herunterladen.',
      },
      {
        phase: 'Phase 3',
        title: 'Claude Analyse-Pipeline',
        description: 'Baue die Szenen-Analyse mit Claude. Claude entscheidet, welche Szenen Illustrationen brauchen und beschreibt diese für Remotion.',
        prompt: `Baue die Claude Analyse-Pipeline.

Erstelle lib/analyze.js mit einer Funktion die:
1. Das Whisper-Transkript (mit Timestamps) als Input nimmt
2. Claude claude-sonnet-4-6 per Anthropic API aufruft
3. Folgenden System-Prompt verwendet:
   'Du bist ein Video-Editor. Analysiere das Transkript und entscheide für jede Szene:
   - Welcher Zeitbereich gehört zusammen?
   - Welche Szenen brauchen eine visuelle Illustration?
   - Beschreibe jede Illustration konkret für Remotion.
   Gib das Ergebnis als JSON-Array zurück.'
4. Den Output als JSON mit dieser Struktur zurückgibt:
[
  {
    "id": 1,
    "timestamp_start": 0,
    "timestamp_end": 3.5,
    "type": "illustration",
    "text_overlay": "Deine Klinik verliert 15.000€/Monat",
    "illustration_prompt": "Modern clinic, red warning icons, money flying away",
    "style": "flat design, dark background, red accent"
  }
]

Auch: pages/api/analyze.js als API-Endpoint dafür erstellen.`,
      },
      {
        phase: 'Phase 4',
        title: 'Remotion Setup',
        description: 'Richte Remotion ein und baue die Video-Komponenten: Animierte Untertitel, Illustrations-Slides und die finale VideoComposition.',
        prompt: `Richte jetzt Remotion ein und baue die Video-Komponenten.

Erstelle:
1. remotion/Root.tsx — Remotion Root-Komponente
2. remotion/components/SubtitleOverlay.tsx — Animierte Untertitel
3. remotion/components/IllustrationSlide.tsx — Szenen mit Text-Overlay
4. remotion/components/VideoComposition.tsx — Kombiniert alles

IllustrationSlide soll: dunkler Hintergrund, Text groß und bold, Einblend-Animation, Farben: Schwarz/Dunkel + Weiß/Rot als Akzent.

Auch: Ein Test-Script erstellen das Remotion mit einem Beispiel-JSON startet.`,
        tip: 'Remotion Preview starten: npx remotion studio → Browser öffnet sich auf localhost:3000',
      },
      {
        phase: 'Phase 5',
        title: 'Web-UI bauen',
        description: 'Baue die komplette Next.js UI mit Upload-Seite, Refinement-Grid für Illustrationen und Download-Seite.',
        prompt: `Baue jetzt die komplette Web-UI in Next.js.

3 Seiten:

Seite 1 — pages/index.js (Upload):
- Drag & Drop für MP4
- Button 'Automatisch bearbeiten'
- Optionales Textfeld 'Eigene Anweisungen'
- Progress-Anzeige
- Design: Dunkel, modern, minimalistisch

Seite 2 — pages/refine.js (Refinement):
- Grid mit allen generierten Illustrationen
- Timestamp, Text-Overlay, Vorschau je Illustration
- 'Neu generieren' Button pro Illustration
- Timeline-Ansicht unten
- 'Video rendern' Button oben rechts

Seite 3 — pages/render.js (Download):
- Render-Fortschrittsbalken
- Preview des fertigen Videos
- Download-Button

Design: Schwarz als Hauptfarbe, Gold als Akzent (#C9A04A), moderne Schrift.`,
      },
      {
        phase: 'Phase 6',
        title: 'Alles verbinden & testen',
        description: 'Verbinde alle Komponenten zu einem durchgehenden Workflow mit Progress-Updates via Server-Sent Events.',
        prompt: `Verbinde jetzt alles zu einem durchgehenden Workflow.

Erstelle lib/pipeline.js mit runVideoPipeline(inputPath, userInstructions):
1. extractAudio(inputPath)
2. transcribeWithWhisper(audioPath)
3. analyzeWithClaude(transcript, userInstructions)
4. generateRemotionTimeline(analysis)
5. renderWithRemotion(timeline, inputPath)
6. Jeden Schritt mit Timestamp und Fortschritt loggen

Verbinde API-Endpoints mit Pipeline, Fortschritt via Server-Sent Events in der UI.

Teste den Flow mit einem kurzen Test-Video (10–30 Sekunden).`,
        tip: 'Screenshot-Trick: Wenn ein Fehler auftritt, mach einen Screenshot und ziehe ihn direkt in das Claude Code Chat-Fenster — das löst 90% aller Probleme sofort.',
      },
    ],
  },
]

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return workflows.find((w) => w.id === id)
}
