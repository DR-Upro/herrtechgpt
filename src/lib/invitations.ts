import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { renderInviteEmail, renderNewsletterInviteEmail, renderSkoolInviteEmail } from './email-template'
import { applyVariables } from './email-templates/registry'
import { loadTemplate } from './email-templates/load'
import { PRODUCTION_URL } from './urls'

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'UPRO AI Lab <onboarding@resend.dev>'
}

// Erzeugt einen Magic-Login-Link via Supabase und versendet ihn per Resend.
// Nutzt token_hash statt action_link: wir bauen die Callback-URL selbst und
// verifizieren in /auth/callback via verifyOtp serverseitig. So wird die Session
// direkt als Cookie gesetzt und der User ist nach Klick sofort eingeloggt
// (statt wie beim default-Flow auf der Login-Seite zu landen, weil Supabase
// Tokens im URL-Fragment liefert, das der Server nicht sieht).
export async function sendInvitationEmail(
  admin: SupabaseClient,
  email: string,
  opts?: { firstName?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const hashedToken = data?.properties?.hashed_token
  if (error || !hashedToken) {
    return { ok: false, error: error?.message ?? 'Link-Erstellung fehlgeschlagen' }
  }

  const params = new URLSearchParams({
    token_hash: hashedToken,
    type: 'magiclink',
    next: '/dashboard',
  })
  const loginLink = `${PRODUCTION_URL}/auth/callback?${params.toString()}`

  const resend = getResend()
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY nicht konfiguriert' }
  }

  const tpl = await loadTemplate('admin_invite', admin)
  const html = renderInviteEmail({ loginLink, firstName: opts?.firstName, content: tpl.data })

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: email,
      subject: applyVariables(tpl.subject, { loginLink, firstName: opts?.firstName ?? '' }),
      html,
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Versand fehlgeschlagen' }
  }

  return { ok: true }
}

// Launch-Mail für Newsletter-Signups: gleiches Magic-Link-Prinzip,
// aber spezielles Template + Redirect auf /dashboard/welcome.
export async function sendNewsletterInviteEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const hashedToken = data?.properties?.hashed_token
  if (error || !hashedToken) {
    return { ok: false, error: error?.message ?? 'Link-Erstellung fehlgeschlagen' }
  }

  const params = new URLSearchParams({
    token_hash: hashedToken,
    type: 'magiclink',
    next: '/welcome',
  })
  const loginLink = `${PRODUCTION_URL}/auth/callback?${params.toString()}`

  const resend = getResend()
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY nicht konfiguriert' }
  }

  const tpl = await loadTemplate('newsletter_invite', admin)
  const html = renderNewsletterInviteEmail({ loginLink, content: tpl.data })

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: email,
      subject: applyVariables(tpl.subject, { loginLink }),
      html,
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Versand fehlgeschlagen' }
  }

  return { ok: true }
}

// Skool-Community-Einladung: eigener Claim-Link (kein Magic-Login),
// User muss ein Passwort setzen. Link ist 30 Tage gültig (DB-getrackt).
// mode: 'active' (Standard, voller Premium-Zugang) | 'alumni' (nur Classroom).
export async function sendSkoolInviteEmail(
  email: string,
  params: {
    token: string
    firstName?: string | null
    creditsPerMonth?: number | null
    mode?: 'active' | 'alumni'
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const claimLink = `${PRODUCTION_URL}/invite/skool/${encodeURIComponent(params.token)}`

  const resend = getResend()
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY nicht konfiguriert' }
  }

  const mode = params.mode ?? 'active'
  const tplKey = mode === 'alumni' ? 'skool_alumni' : 'skool_active'
  const tpl = await loadTemplate(tplKey)

  const html = renderSkoolInviteEmail({
    claimLink,
    firstName: params.firstName,
    creditsPerMonth: params.creditsPerMonth,
    mode,
    content: tpl.data,
  })

  const subject = applyVariables(tpl.subject, {
    claimLink,
    firstName: params.firstName ?? '',
    creditsPerMonth: params.creditsPerMonth ?? 200,
  })

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: email,
      subject,
      html,
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Versand fehlgeschlagen' }
  }

  return { ok: true }
}

// Erhöht Invitation-Zähler + Zeitstempel. Fehler werden geschluckt.
export async function recordInvitationSent(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: profile } = await admin
    .from('profiles')
    .select('invitation_sent_count')
    .eq('id', userId)
    .single()
  const current = profile?.invitation_sent_count ?? 0
  await admin
    .from('profiles')
    .update({
      invitation_sent_count: current + 1,
      invitation_last_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
}
