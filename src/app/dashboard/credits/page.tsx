import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computeEffectiveAccess, VIEW_AS_COOKIE } from '@/lib/access'
import { getActivePacks, getMonetizationState, priceBandForAccessTier } from '@/lib/monetization'
import { getFeatureState } from '@/lib/permissions'
import { getAppSettings } from '@/lib/app-settings'
import type { CreditPack } from '@/lib/types'
import CommunityRequiredView from '@/components/community-required'
import CreditsClient from './CreditsClient'

export const dynamic = 'force-dynamic'

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const { checkout } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/dashboard/credits')

  const [{ data: profile }, packs, cookieStore, settings] = await Promise.all([
    supabase.from('profiles').select('role, access_tier').eq('id', user.id).single(),
    getActivePacks(supabase),
    cookies(),
    getAppSettings(),
  ])
  const access = computeEffectiveAccess(profile, cookieStore.get(VIEW_AS_COOKIE)?.value)

  // Credit-Kauf folgt der Toolbox-Permission. Wer Toolbox nicht nutzen darf
  // (basic in NoSubs-Welt), darf auch keine Credits kaufen — Credits wären
  // nutzlos. Alumni + premium dürfen nachkaufen.
  // Konfigurierbar pro Tier in "Gruppen & Rechte" (feature_permissions.toolbox).
  const toolboxState = await getFeatureState(supabase, access.tier, 'toolbox')
  if (!access.isAdmin && toolboxState === 'community') {
    return (
      <CommunityRequiredView
        featureLabel="Credit-Pakete"
        backHref="/dashboard"
        backLabel="Dashboard"
        communityUrl={settings.communityUrl}
        benefits={[
          'Monatliche Credits für die Toolbox automatisch',
          'Voller Zugriff auf UPRO AI Lab',
          'Classroom mit allen Lern-Modulen',
          'Live Calls + Community',
        ]}
      />
    )
  }

  const state = await getMonetizationState(supabase, user.id, access.tier)
  const priceBand = priceBandForAccessTier(access.tier)

  return (
    <CreditsClient
      packs={packs as CreditPack[]}
      priceBand={priceBand}
      isCommunity={access.tier === 'premium'}
      currentBalance={state.totalCredits}
      hasSubscription={state.hasActiveSubscription}
      checkoutStatus={checkout ?? null}
      subscriptionsEnabled={settings.subscriptionsEnabled}
      isAdmin={profile?.role === 'admin'}
      userId={user.id}
    />
  )
}
