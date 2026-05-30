import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export const maxDuration = 300

// Konfiguration
const CHUNK_WORDS = 500
const MAX_NEW_PER_RUN = 3 // max. 3 neue Videos pro Sync (Token-Budget)
const SKIP_PATTERNS = [
  'Skool_Intro', 'Masterclass_Intro', 'SkoolVideo',
  'street_interview', 'A_nerd', 'I never pay',
  'Referenz', 'Empfehlung', 'KIMarketingClub',
]

interface WistiaVideo {
  id: number
  name: string
  duration?: number
  assets?: Array<{ type: string; contentType: string; url: string }>
}

function shouldSkip(name: string): boolean {
  return SKIP_PATTERNS.some((p) => name.toLowerCase().includes(p.toLowerCase()))
}

// Schneidet aus Claudes Antwort den reinen JSON-Block raus — egal ob Markdown-
// Codezäune oder erklärender Text drum herum stehen. Verhindert "Unexpected
// non-whitespace character"-Fehler bei JSON.parse.
function extractJsonObject(text: string): string {
  const stripped = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const first = stripped.indexOf('{')
  const last = stripped.lastIndexOf('}')
  if (first === -1 || last === -1 || last < first) return stripped
  return stripped.slice(first, last + 1)
}

// ── Service-Role Supabase Client (Cron-Kontext, kein User) ────────────────────
function serviceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// ── Wistia API ────────────────────────────────────────────────────────────────
async function fetchAllWistiaVideos(): Promise<WistiaVideo[]> {
  const videos: WistiaVideo[] = []
  let page = 1
  while (true) {
    const r = await fetch(
      `https://api.wistia.com/v1/medias.json?api_password=${process.env.WISTIA_API_KEY}&per_page=100&page=${page}`,
    )
    const batch: WistiaVideo[] = await r.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    videos.push(...batch)
    if (batch.length < 100) break
    page += 1
    if (page > 10) break // Safety
  }
  return videos
}

async function fetchWistiaVideoUrl(videoId: number): Promise<string | null> {
  const r = await fetch(
    `https://api.wistia.com/v1/medias/${videoId}.json?api_password=${process.env.WISTIA_API_KEY}`,
  )
  const data = await r.json()
  const assets = data.assets ?? []
  const preferred = ['Mp4VideoFile', 'IphoneVideoFile', 'MdMp4VideoFile', 'OriginalFile']
  for (const pref of preferred) {
    const a = assets.find((x: { type: string; contentType: string }) => x.type === pref && x.contentType === 'video/mp4')
    if (a) return a.url
  }
  const fallback = assets.find((x: { contentType: string }) => x.contentType === 'video/mp4')
  return fallback?.url ?? null
}

// ── AssemblyAI ────────────────────────────────────────────────────────────────
/**
 * @param language ISO-Code wie 'de' / 'en' / 'es' / 'fr' / ..., oder 'auto'
 *                 für automatische Erkennung durch AssemblyAI.
 */
async function submitTranscription(audioUrl: string, language: string): Promise<string> {
  const body: Record<string, unknown> = {
    audio_url: audioUrl,
    speech_models: ['universal-2'],
    punctuate: true,
    format_text: true,
  }
  if (language === 'auto') {
    body.language_detection = true
  } else {
    body.language_code = language
  }
  const r = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': process.env.ASSEMBLYAI_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!data.id) throw new Error(`AssemblyAI submission failed: ${JSON.stringify(data)}`)
  return data.id
}

async function getTranscriptStatus(transcriptId: string) {
  const r = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
    headers: { 'Authorization': process.env.ASSEMBLYAI_API_KEY! },
  })
  return r.json()
}

// ── Chunking ──────────────────────────────────────────────────────────────────
interface Chunk {
  video_id: string
  video_name: string
  chunk_text: string
  chunk_index: number
  duration_minutes: number | null
  is_active: boolean
  source: string
}

function chunkText(text: string, videoId: string, videoName: string, durationMin: number | null): Chunk[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: Chunk[] = []
  for (let i = 0; i < words.length; i += CHUNK_WORDS) {
    chunks.push({
      video_id: videoId,
      video_name: videoName,
      chunk_text: words.slice(i, i + CHUNK_WORDS).join(' '),
      chunk_index: Math.floor(i / CHUNK_WORDS),
      duration_minutes: durationMin,
      is_active: true,
      source: 'wistia',
    })
  }
  return chunks
}

// ── Kategorisierung via Claude ────────────────────────────────────────────────
async function categorizeVideo(videoName: string, previewText: string): Promise<string[]> {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    messages: [{
      role: 'user',
      content: `Ordne dieses Video den passenden Agenten zu.

TITEL: ${videoName}
INHALT: ${previewText.slice(0, 800)}

Verfügbare Agenten:
- content-hook: Hooks, viraler Content, Social Media, Storytelling
- funnel-monetization: Sales, Funnels, Leadgenerierung, E-Mail, LinkedIn
- personal-growth: Mindset, Produktivität, persönliche Entwicklung
- ai-prompt: Prompting, ChatGPT, KI-Workflows
- upro: KI-Tools, Automatisierung, n8n, Make, Tech-Setup
- business-coach: Business-Strategie, Wachstum, Positionierung

Antworte NUR mit valid JSON:
{"agents": ["agent-id", "agent-id"]}

Regel: Sei großzügig, aber nur sinnvolle Agenten.`,
    }],
  })
  try {
    const parsed = JSON.parse(extractJsonObject(text))
    return Array.isArray(parsed.agents) ? parsed.agents : []
  } catch {
    return []
  }
}

// ── Übersetzung nicht-deutscher Schnipsel ins Deutsche ───────────────────────
async function translateChunksToGerman(chunks: Chunk[], sourceLang: string): Promise<Chunk[] | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const translated: Chunk[] = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    try {
      const { text } = await generateText({
        model: anthropic('claude-sonnet-4-5-20250929'),
        messages: [{
          role: 'user',
          content:
            `Übersetze den folgenden Text aus dem ${sourceLang.toUpperCase()} ins Deutsche. ` +
            `Behalte den Sinn präzise. Lass Eigennamen, Produktbezeichnungen und Marken ` +
            `unverändert. Klinge natürlich und flüssig auf Deutsch. ` +
            `Antworte AUSSCHLIESSLICH mit dem übersetzten Text — keine Vorbemerkung, ` +
            `keine Anführungszeichen, keine Erklärung.\n\n---\n\n${chunk.chunk_text}`,
        }],
      })
      const germanText = text.trim()
      if (!germanText) return null
      translated.push({ ...chunk, chunk_text: germanText })
    } catch {
      return null
    }
  }
  return translated
}

// ── Haupt-Handler: führt beide Phasen aus ─────────────────────────────────────
export async function GET(req: NextRequest) {
  // Auth: entweder Vercel Cron Secret, oder manueller Admin-Trigger (?secret=...)
  const authHeader = req.headers.get('authorization')
  const secret = req.nextUrl.searchParams.get('secret')
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
  const isManual = secret && secret === process.env.CRON_SECRET
  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Quellsprache aus der URL (?lang=de|en|es|fr|auto, default de)
  const lang = (req.nextUrl.searchParams.get('lang') || 'de').toLowerCase().trim()

  const supabase = serviceClient()
  const notes: string[] = []
  let newVideosFound = 0
  let videosSubmitted = 0
  let videosCompleted = 0

  // ── Phase 1: Completed Transkriptionen abholen ────────────────────────────
  const { data: pending } = await supabase
    .from('pending_transcripts')
    .select('*')
    .in('status', ['queued', 'processing'])

  for (const p of pending ?? []) {
    try {
      const status = await getTranscriptStatus(p.transcript_id)
      if (status.status === 'completed') {
        let chunks = chunkText(status.text ?? '', p.video_id, p.video_name, p.duration_minutes)
        if (chunks.length > 0) {
          // Falls AssemblyAI was anderes als Deutsch transkribiert hat → Schnipsel
          // über Claude ins Deutsche übersetzen, damit die deutschen Agenten weiter
          // auf Deutsch arbeiten.
          const detected: string = (status.language_code ?? 'de').toLowerCase()
          if (detected !== 'de') {
            const translated = await translateChunksToGerman(chunks, detected)
            if (!translated) {
              notes.push(`✗ ${p.video_name} → Übersetzung aus ${detected.toUpperCase()} fehlgeschlagen`)
              continue
            }
            chunks = translated
            notes.push(`🌐 ${p.video_name} → ${chunks.length} Schnipsel aus ${detected.toUpperCase()} ins Deutsche übersetzt`)
          }
          await supabase.from('knowledge_base').insert(chunks)
          // Kategorisieren (auf Basis des fertigen — ggf. übersetzten — Texts)
          const agents = await categorizeVideo(p.video_name, chunks[0].chunk_text)
          if (agents.length > 0) {
            await supabase
              .from('knowledge_base')
              .update({ relevant_agents: agents })
              .eq('video_id', p.video_id)
          }
          videosCompleted += 1
          notes.push(`✓ ${p.video_name} → ${chunks.length} chunks, agents: [${agents.join(', ')}]`)
        }
        await supabase
          .from('pending_transcripts')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('video_id', p.video_id)
      } else if (status.status === 'error') {
        await supabase
          .from('pending_transcripts')
          .update({ status: 'error', error_message: status.error ?? 'unknown' })
          .eq('video_id', p.video_id)
        notes.push(`✗ ${p.video_name} → error: ${status.error}`)
      } else {
        // Still queued/processing
        if (p.status !== status.status) {
          await supabase
            .from('pending_transcripts')
            .update({ status: status.status })
            .eq('video_id', p.video_id)
        }
      }
    } catch (e) {
      notes.push(`✗ ${p.video_name} → status check failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  // ── Phase 2: Neue Wistia-Videos erkennen & einreichen ─────────────────────
  let allVideos: WistiaVideo[] = []
  try {
    allVideos = await fetchAllWistiaVideos()
  } catch (e) {
    notes.push(`Wistia API error: ${e instanceof Error ? e.message : e}`)
  }

  // Welche video_ids sind schon in knowledge_base oder pending?
  const { data: existingKB } = await supabase
    .from('knowledge_base')
    .select('video_id')
    .limit(2000)
  const { data: existingPending } = await supabase
    .from('pending_transcripts')
    .select('video_id')
  const seen = new Set([
    ...(existingKB ?? []).map((r) => r.video_id),
    ...(existingPending ?? []).map((r) => r.video_id),
  ])

  const newVideos = allVideos.filter((v) => {
    if (shouldSkip(v.name)) return false
    if (seen.has(String(v.id))) return false
    const dur = (v.duration ?? 0) / 60
    if (dur < 1) return false
    return true
  })

  newVideosFound = newVideos.length
  const toSubmit = newVideos.slice(0, MAX_NEW_PER_RUN)

  for (const v of toSubmit) {
    try {
      const url = await fetchWistiaVideoUrl(v.id)
      if (!url) {
        notes.push(`✗ ${v.name} → no URL`)
        continue
      }
      const transcriptId = await submitTranscription(url, lang)
      await supabase.from('pending_transcripts').insert({
        video_id: String(v.id),
        video_name: v.name,
        duration_minutes: (v.duration ?? 0) / 60,
        transcript_id: transcriptId,
        status: 'queued',
      })
      videosSubmitted += 1
      notes.push(`↑ ${v.name} → submitted (${transcriptId})`)
    } catch (e) {
      notes.push(`✗ ${v.name} → submission failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  // ── Phase 3: Obsolete-Detection (nur wenn neue Videos fertig wurden) ──────
  const obsoleteFlagged: string[] = []
  if (videosCompleted > 0) {
    // Hole die neu hinzugefügten Videos + alle existierenden Titel für Abgleich
    const { data: recent } = await supabase
      .from('knowledge_base')
      .select('video_id, video_name, chunk_text')
      .eq('is_active', true)
      .eq('chunk_index', 0)
      .order('created_at', { ascending: false })
      .limit(50)

    const newIds = new Set(
      (await supabase.from('pending_transcripts').select('video_id').eq('status', 'completed').gte('completed_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())).data?.map((r) => r.video_id) ?? [],
    )
    const newlyAdded = (recent ?? []).filter((v) => newIds.has(v.video_id))
    const existingOlder = (recent ?? []).filter((v) => !newIds.has(v.video_id))

    if (newlyAdded.length > 0 && existingOlder.length > 0) {
      try {
        const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
        const { text } = await generateText({
          model: anthropic('claude-sonnet-4-5-20250929'),
          messages: [{
            role: 'user',
            content: `Du bist ein Content-Kurator. Neue Videos wurden hinzugefügt. Prüfe, ob sie ältere Videos inhaltlich überholen.

NEUE VIDEOS:
${newlyAdded.map((v) => `- [${v.video_id}] ${v.video_name}: ${v.chunk_text.slice(0, 300)}`).join('\n')}

BESTEHENDE ÄLTERE VIDEOS:
${existingOlder.slice(0, 30).map((v) => `- [${v.video_id}] ${v.video_name}: ${v.chunk_text.slice(0, 200)}`).join('\n')}

Gibt es ältere Videos, die durch die neuen klar überholt sind (z.B. gleiches Tool mit veralteter Version, oder derselbe Workflow nun besser)?

Antworte NUR mit valid JSON:
{"obsolete_ids": ["videoId1", "videoId2"], "reasons": {"videoId1": "kurzer Grund"}}

Nur Videos listen, die wirklich eindeutig überholt sind. Bei Zweifel weglassen.`,
          }],
        })
        const parsed = JSON.parse(extractJsonObject(text))
        const ids: string[] = Array.isArray(parsed.obsolete_ids) ? parsed.obsolete_ids : []
        for (const id of ids) {
          // Nur flaggen (is_active false), nicht löschen
          await supabase
            .from('knowledge_base')
            .update({ is_active: false })
            .eq('video_id', id)
          obsoleteFlagged.push(id)
          notes.push(`⚠ flagged obsolete: ${id} — ${parsed.reasons?.[id] ?? ''}`)
        }
      } catch (e) {
        notes.push(`Obsolete detection failed: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  // ── Sync log eintragen ────────────────────────────────────────────────────
  await supabase.from('sync_log').insert({
    new_videos_found: newVideosFound,
    videos_submitted: videosSubmitted,
    videos_completed: videosCompleted,
    obsolete_flagged: obsoleteFlagged,
    notes: notes.join('\n'),
  })

  return NextResponse.json({
    ok: true,
    new_videos_found: newVideosFound,
    videos_submitted: videosSubmitted,
    videos_completed: videosCompleted,
    obsolete_flagged: obsoleteFlagged,
    notes,
  })
}
