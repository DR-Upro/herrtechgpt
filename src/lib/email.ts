import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderEmail } from './email-template'
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

/**
 * Benachrichtigt einen User darüber, dass er seinen Community-Status verloren
 * hat und sein Abo am Periodenende ausläuft. Enthält Link zum Re-Abschluss
 * zu den neuen (Alumni/Basic-)Preisen.
 */
export async function notifyCommunityDowngrade({
  userId,
  periodEnd,
}: {
  userId: string
  periodEnd: string
}): Promise<void> {
  const resend = getResend()
  if (!resend) {
    console.log('[email] RESEND_API_KEY nicht gesetzt — Skip community-downgrade mail')
    return
  }

  const admin = createAdminClient()
  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  const email = authUser?.user?.email
  if (!email) {
    console.warn('[email] community-downgrade: keine Email für user', userId)
    return
  }

  const endDate = new Date(periodEnd).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const tpl = await loadTemplate('community_downgrade', admin)
  const vars = { endDate }

  const html = renderEmail({
    heading: applyVariables(tpl.data.heading ?? '', vars),
    intro: applyVariables(tpl.data.intro ?? '', vars),
    cta: {
      label: applyVariables(tpl.data.cta_label ?? 'Neuen Plan wählen', vars),
      href: `${PRODUCTION_URL}/dashboard/pricing`,
    },
    footerNote: applyVariables(tpl.data.footer_note ?? '', vars),
  })

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: email,
      subject: applyVariables(tpl.subject, vars),
      html,
    })
  } catch (err) {
    console.error('[email] community-downgrade send failed:', err)
  }
}

// Sendet eine Benachrichtigung an alle Admins über ein neues Support-Ticket.
// Läuft still durch, wenn keine Config vorhanden ist.
export async function notifyAdminsNewTicket({
  conversationId,
  userEmail,
}: {
  conversationId: string
  userEmail: string
}): Promise<void> {
  const resend = getResend()
  if (!resend) {
    console.log('[email] RESEND_API_KEY nicht gesetzt — Skip admin notification')
    return
  }

  const admin = createAdminClient()
  const { data: adminProfiles } = await admin.from('profiles').select('id').eq('role', 'admin')
  if (!adminProfiles || adminProfiles.length === 0) return

  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const adminIds = new Set(adminProfiles.map((p) => p.id))
  const adminEmails = users
    .filter((u) => adminIds.has(u.id) && u.email)
    .map((u) => u.email!)

  if (adminEmails.length === 0) return

  const ticketUrl = `${PRODUCTION_URL}/admin/tickets/${conversationId}`

  const tpl = await loadTemplate('admin_new_ticket', admin)
  const vars = { userEmail: escapeHtml(userEmail) }
  const subjectVars = { userEmail }

  const html = renderEmail({
    heading: applyVariables(tpl.data.heading ?? '', vars),
    intro: applyVariables(tpl.data.intro ?? '', vars),
    cta: { label: applyVariables(tpl.data.cta_label ?? 'Ticket öffnen', vars), href: ticketUrl },
    preheader: `Neues Support-Ticket von ${userEmail}`,
  })

  try {
    await resend.emails.send({
      from: fromAddress(),
      to: adminEmails,
      subject: applyVariables(tpl.subject, subjectVars),
      html,
    })
  } catch (err) {
    console.error('[email] Resend Fehler:', err)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
