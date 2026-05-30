import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

const CHUNK_WORDS = 500

export interface Chunk {
  video_id: string
  video_name: string
  chunk_text: string
  chunk_index: number
  duration_minutes: number | null
  is_active: boolean
  source: string
}

// Schneidet aus Claudes Antwort den reinen JSON-Block raus — egal ob Markdown-
// Codezäune oder erklärender Text drum herum stehen.
export function extractJsonObject(text: string): string {
  const stripped = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const first = stripped.indexOf('{')
  const last = stripped.lastIndexOf('}')
  if (first === -1 || last === -1 || last < first) return stripped
  return stripped.slice(first, last + 1)
}

export function chunkText(
  text: string,
  videoId: string,
  videoName: string,
  durationMin: number | null,
  source: string = 'wistia',
): Chunk[] {
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
      source,
    })
  }
  return chunks
}

export async function categorize(title: string, previewText: string): Promise<string[]> {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    messages: [{
      role: 'user',
      content: `Ordne diesen Inhalt den passenden Agenten zu.

TITEL: ${title}
INHALT: ${previewText.slice(0, 800)}

Verfügbare Agenten:
- claude-insider: ALLES zu Claude, Claude Cowork, Claude Code, Claude Desktop, Anthropic-Modelle (Sonnet/Opus/Haiku), Claude Skills, Hooks, MCP, Subagents, Artefakte, Anthropic-spezifisches Prompt-Engineering
- content-hook: Hooks, viraler Content, Social Media, Storytelling
- funnel-monetization: Sales, Funnels, Leadgenerierung, E-Mail, LinkedIn
- personal-growth: Mindset, Produktivität, persönliche Entwicklung
- ai-prompt: Prompting allgemein (ChatGPT, Gemini, Mistral), Prompt-Engineering-Grundlagen, KI-Workflows tool-übergreifend — NICHT Claude-spezifisch (das macht claude-insider)
- upro: KI-Tools allgemein, Automatisierung, n8n, Make, Tech-Setup
- business-coach: Business-Strategie, Wachstum, Positionierung

Antworte NUR mit valid JSON:
{"agents": ["agent-id", "agent-id"]}

Regeln:
- Sei großzügig, aber nur sinnvolle Agenten.
- Wenn der Inhalt explizit Anthropic-Produkte erwähnt (Claude, Cowork, Claude Code, Skills, MCP, Artefakte), füge IMMER claude-insider hinzu.`,
    }],
  })
  try {
    const parsed = JSON.parse(extractJsonObject(text))
    return Array.isArray(parsed.agents) ? parsed.agents : []
  } catch {
    return []
  }
}

// Verarbeitet items mit kontrollierter Parallelität — N Worker, die sich
// die Arbeit teilen. Verhindert Vercel-Function-Timeouts bei langen Listen.
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const myIdx = cursor++
      if (myIdx >= items.length) return
      results[myIdx] = await fn(items[myIdx], myIdx)
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}

const TRANSLATE_CONCURRENCY = 8

export async function translateChunksToGerman(
  chunks: Chunk[],
  sourceLang: string,
): Promise<Chunk[] | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    return await mapWithLimit(chunks, TRANSLATE_CONCURRENCY, async (chunk) => {
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
      if (!germanText) throw new Error('Leere Übersetzung')
      return { ...chunk, chunk_text: germanText }
    })
  } catch {
    return null
  }
}

// Markdown-Syntax aus rohem MD entfernen, damit der Stempel-Schritt sauberen
// Klartext sieht (Codezäune, Überschriften-#, Listen-Marker, Bold/Italic, Links).
export function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Eindeutige ID für eingekippten Text — Zeitstempel + Zufalls-Anhang + Slug.
export function makeTextSourceId(title: string): string {
  const umlautMap: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }
  const slug = title
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => umlautMap[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const ts = Math.floor(Date.now() / 1000)
  const rand = Math.random().toString(36).slice(2, 8)
  return `text-${ts}-${rand}-${slug || 'untitled'}`
}
