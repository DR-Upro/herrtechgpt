/**
 * Manuelles Hinzufügen eines Community-Members.
 *
 * Für Community-Mitglieder, die nicht über Stripe gekauft haben:
 *  - Admins (Doc)
 *  - Free-Mitglieder
 *  - Personen die der Admin manuell in die Community gepackt hat
 *
 * source='manual' → Sync-Job lässt diese Einträge in Ruhe.
 *
 * POST /api/admin/community/manual-add
 *   { email, name?, skool_access_expires_at?, skool_status? }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { autoLinkProfileIfExists } from '@/lib/skool-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return null
  return user
}

export async function POST(req: Request) {
  const adminUser = await requireAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = (await req.json().catch(() => null)) as {
    email?: string
    name?: string
    skool_status?: 'active' | 'alumni' | 'cancelled'
    skool_access_expires_at?: string
  } | null

  const email = body?.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Gültige E-Mail-Adresse benötigt' }, { status: 400 })
  }

  const status = body?.skool_status ?? 'active'
  if (!['active', 'alumni', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  // Default: 1 Jahr Zugang ab heute
  const defaultExpiry = new Date(Date.now() + 365 * 86400 * 1000).toISOString()
  const expiresAt = body?.skool_access_expires_at || defaultExpiry

  const admin = createAdminClient()

  // Prüfen ob schon ein Eintrag mit dieser Email existiert
  const { data: existing } = await admin
    .from('community_members')
    .select('id, source')
    .ilike('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      {
        error: `Mitglied mit dieser E-Mail existiert bereits (Quelle: ${existing.source}). Wenn du das Zugangs-Ende ändern willst: bitte direkt im Eintrag anpassen.`,
      },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()
  const { data: created, error } = await admin
    .from('community_members')
    .insert({
      stripe_customer_id: null,
      email,
      name: body?.name?.trim() || null,
      skool_status: status,
      skool_access_started_at: now,
      skool_access_expires_at: expiresAt,
      source: 'manual',
      purchase_count: 0,
    })
    .select('id, email')
    .single()

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? 'Anlegen fehlgeschlagen' },
      { status: 500 }
    )
  }

  // Auto-Link: falls schon ein auth.user mit dieser Email existiert,
  // direkt verknüpfen (claimed_at + access_tier setzen, role bleibt).
  let autoLinked = false
  try {
    const res = await autoLinkProfileIfExists(admin, {
      id: created.id,
      email,
      name: body?.name?.trim() || null,
      skool_status: status,
      skool_access_expires_at: expiresAt,
      profile_id: null,
    })
    autoLinked = res.linked
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, member: created, auto_linked: autoLinked })
}
