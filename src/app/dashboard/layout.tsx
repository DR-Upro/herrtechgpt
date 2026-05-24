import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AppShell } from '@/components/app-shell'
import { computeEffectiveAccess, VIEW_AS_COOKIE } from '@/lib/access'
import { getPermissionMatrix } from '@/lib/permissions'
import { getAppSettings } from '@/lib/app-settings'
import { getAuthedUser, getProfileCached } from '@/lib/server-cache'

// Layout darf nicht statisch gecached werden — sonst sehen User nach
// Berechtigungs-/Settings-Änderungen den alten Stand bis Hard-Reload.
// Permissions, Settings, Tools sind alle dynamisch und sollen sofort
// durchschlagen wenn Admin sie ändert.
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthedUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const [profile, { data: conversations }, { data: archivedConversations }, cookieStore, matrix, { count: helpUnreadCount }, settings] = await Promise.all([
    getProfileCached(),
    supabase
      .from('conversations')
      .select('id, user_id, agent_id, title, created_at, updated_at, user_has_unread, archived')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase
      .from('conversations')
      .select('id, user_id, agent_id, title, created_at, updated_at, user_has_unread, archived')
      .eq('user_id', user.id)
      .eq('archived', true)
      .order('updated_at', { ascending: false })
      .limit(50),
    cookies(),
    getPermissionMatrix(supabase),
    supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('agent_id', 'help')
      .eq('user_has_unread', true),
    getAppSettings(),
  ])

  const viewAsRaw = cookieStore.get(VIEW_AS_COOKIE)?.value
  const access = computeEffectiveAccess(profile, viewAsRaw)
  const states = matrix[access.tier]

  // Neue Tickets zählen — nur für echte Admins (nicht impersonating)
  let newTicketCount = 0
  if (access.realIsAdmin) {
    const { count } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', 'help')
      .eq('status', 'new')
      .eq('mode', 'human')
    newTicketCount = count ?? 0
  }

  const userEmail = user.email ?? ''
  const userName =
    (user.user_metadata?.full_name as string) ??
    (user.user_metadata?.name as string) ??
    userEmail.split('@')[0]

  return (
    <AppShell
      conversations={conversations ?? []}
      archivedConversations={archivedConversations ?? []}
      userEmail={userEmail}
      userName={userName}
      isAdmin={access.isAdmin}
      realIsAdmin={access.realIsAdmin}
      accessTier={access.tier}
      viewAs={access.viewAs}
      states={states}
      newTicketCount={newTicketCount}
      helpUnreadCount={helpUnreadCount ?? 0}
      subscriptionsEnabled={settings.subscriptionsEnabled}
    >
      {children}
    </AppShell>
  )
}
