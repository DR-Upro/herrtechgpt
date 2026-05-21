/**
 * Helper für SubscriptionGateState-Konstruktion auf Server-Seite.
 *
 * Zentralisiert die Logik damit alle Tool-/Chat-Pages konsistent verhalten:
 *   - hasActiveSubscription mit NoSubs-Override (premium/alumni dürfen)
 *   - subscriptionsEnabled aus app_settings
 *   - nextCreditRefreshAt aus community_members (für premium-User)
 *
 * Wird von /dashboard/ki-toolbox/* und /dashboard/ai-workspace/* genutzt.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/app-settings'
import { getMonetizationState } from '@/lib/monetization'
import type { AccessTier, EffectiveAccess } from '@/lib/access'
import type { SubscriptionGateState } from '@/components/subscription-gate'
import type { Plan, CreditPack } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

interface BuildArgs {
  supabase: SupabaseClient
  userId: string
  access: EffectiveAccess
  plans: Plan[]
  packs: CreditPack[]
}

/**
 * Lädt alle dynamischen Daten und liefert einen vollständigen
 * SubscriptionGateState für die Client-Komponente.
 *
 * Reihenfolge der Queries ist parallelisiert wo möglich.
 */
export async function buildGateState({
  supabase,
  userId,
  access,
  plans,
  packs,
}: BuildArgs): Promise<SubscriptionGateState> {
  const [monetization, settings] = await Promise.all([
    getMonetizationState(supabase, userId, access.tier),
    getAppSettings(),
  ])

  // In NoSubs-Welt sind ALLE User die hier ankommen "berechtigt zur Aktion"
  // — der Page-Layer hat basic-User ohne Toolbox-Zugriff schon via
  // CommunityRequiredView abgefangen. Wer hier landet (Admin-Override,
  // alumni mit gekauften Credits, premium) darf alles versuchen, was er
  // an Credits hat. chargeCredits() auf der Server-Seite entscheidet
  // letztlich ob die Aktion durchgeht.
  //
  // WICHTIG: nicht nur premium/alumni durchlassen — sonst hängt ein
  // basic-User mit gekauften Credits am Client-side-Gate (sieht "kostet
  // 0 Credits"-Modal), obwohl er via Server eigentlich generieren könnte.
  const noSubsAllowed = !settings.subscriptionsEnabled

  const hasActiveSubscription =
    access.isAdmin || monetization.hasActiveSubscription || noSubsAllowed

  // Nächster Credit-Refresh — für premium-Mitglieder der Anzeigewert im
  // CreditTopupModal. Wir laden last_credit_grant_at über den Admin-Client
  // (community_members ist RLS-protected).
  let nextCreditRefreshAt: string | null = null
  if (access.tier === 'premium') {
    try {
      const admin = createAdminClient()
      const { data: member } = await admin
        .from('community_members')
        .select('last_credit_grant_at')
        .eq('profile_id', userId)
        .maybeSingle()
      if (member?.last_credit_grant_at) {
        const last = new Date(member.last_credit_grant_at)
        const next = new Date(last)
        next.setMonth(next.getMonth() + 1)
        nextCreditRefreshAt = next.toISOString()
      }
    } catch {
      // silent — Anzeige im Modal fällt dann auf Default
    }
  }

  return {
    hasActiveSubscription,
    currentPlanId: monetization.planId,
    currentPlanTier: monetization.planTier,
    currentCycle: monetization.subscription?.billing_cycle ?? null,
    currentPeriodEnd: monetization.subscription?.current_period_end ?? null,
    scheduledPlanId: monetization.subscription?.scheduled_plan_id ?? null,
    scheduledCycle:
      (monetization.subscription?.scheduled_billing_cycle as
        | 'monthly'
        | 'yearly'
        | null) ?? null,
    scheduledChangeAt: monetization.subscription?.scheduled_change_at ?? null,
    priceBand: monetization.priceBand,
    isCommunity: access.tier === 'premium',
    credits: monetization.totalCredits,
    plans,
    packs,
    subscriptionsEnabled: settings.subscriptionsEnabled,
    nextCreditRefreshAt,
  }
}

// Re-export für convenience
export type { AccessTier }
