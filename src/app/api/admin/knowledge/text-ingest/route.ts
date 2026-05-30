import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  chunkText,
  categorize,
  translateChunksToGerman,
  stripMarkdown,
  makeTextSourceId,
} from '@/lib/knowledge-pipeline'

export const maxDuration = 300

type Lang = 'de' | 'en' | 'es' | 'fr'
const VALID_LANGS: Lang[] = ['de', 'en', 'es', 'fr']

interface IngestItem {
  title?: string
  text?: string
  language?: string
}

interface ItemResult {
  title: string
  ok: boolean
  chunks?: number
  agents?: string[]
  translated_from?: string
  error?: string
}

export async function POST(req: Request) {
  // Admin-Auth (gleiches Pattern wie wistia-sync-Trigger)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let items: IngestItem[]
  try {
    const body = (await req.json()) as { items?: IngestItem[] }
    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'items[] erwartet (mindestens ein Eintrag)' }, { status: 400 })
    }
    if (body.items.length > 50) {
      return NextResponse.json({ error: 'Maximal 50 Einträge pro Aufruf' }, { status: 400 })
    }
    items = body.items
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const admin = createAdminClient()
  const results: ItemResult[] = []

  for (const item of items) {
    const title = (item.title ?? '').trim() || 'Ohne Titel'
    const rawText = (item.text ?? '').trim()
    const langRaw = (item.language ?? 'de').toLowerCase().trim()
    const language: Lang = VALID_LANGS.includes(langRaw as Lang) ? (langRaw as Lang) : 'de'

    if (!rawText) {
      results.push({ title, ok: false, error: 'Leerer Text' })
      continue
    }
    if (rawText.length > 200_000) {
      results.push({ title, ok: false, error: 'Text zu groß (max. 200.000 Zeichen)' })
      continue
    }

    try {
      const cleaned = stripMarkdown(rawText)
      const videoId = makeTextSourceId(title)
      let chunks = chunkText(cleaned, videoId, title, null, 'text')

      if (chunks.length === 0) {
        results.push({ title, ok: false, error: 'Nach Bereinigung kein Text übrig' })
        continue
      }

      let translatedFrom: string | undefined
      if (language !== 'de') {
        const translated = await translateChunksToGerman(chunks, language)
        if (!translated) {
          results.push({
            title,
            ok: false,
            error: `Übersetzung aus ${language.toUpperCase()} fehlgeschlagen`,
          })
          continue
        }
        chunks = translated
        translatedFrom = language.toUpperCase()
      }

      const { error: insertErr } = await admin.from('knowledge_base').insert(chunks)
      if (insertErr) {
        results.push({ title, ok: false, error: `DB-Insert: ${insertErr.message}` })
        continue
      }

      const agents = await categorize(title, chunks[0].chunk_text)
      if (agents.length > 0) {
        await admin
          .from('knowledge_base')
          .update({ relevant_agents: agents })
          .eq('video_id', videoId)
      }

      results.push({
        title,
        ok: true,
        chunks: chunks.length,
        agents,
        translated_from: translatedFrom,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannt'
      results.push({ title, ok: false, error: msg })
    }
  }

  const okCount = results.filter((r) => r.ok).length
  return NextResponse.json({ ok: true, total: results.length, success: okCount, results })
}
