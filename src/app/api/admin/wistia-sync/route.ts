import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300

interface CronResponse {
  ok: boolean
  new_videos_found?: number
  videos_submitted?: number
  videos_completed?: number
  obsolete_flagged?: string[]
  notes?: string[]
  error?: string
}

export async function POST(req: Request) {
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

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  // Quellsprache aus dem UI ({ lang: 'de'|'en'|'es'|'fr'|'auto' }, default 'de')
  let lang = 'de'
  try {
    const body = (await req.json()) as { lang?: string }
    if (body?.lang && typeof body.lang === 'string') lang = body.lang.toLowerCase().trim()
  } catch {
    // Body optional — leerer Aufruf bedeutet Default 'de'
  }

  const origin = new URL(req.url).origin
  const cronUrl = `${origin}/api/cron/wistia-sync?secret=${encodeURIComponent(cronSecret)}&lang=${encodeURIComponent(lang)}`

  try {
    const res = await fetch(cronUrl, { method: 'GET', cache: 'no-store' })
    const data: CronResponse = await res.json()
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: data.error ?? 'sync failed' }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
