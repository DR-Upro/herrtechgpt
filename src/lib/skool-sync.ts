/**
 * Skool ↔ UPRO AI Lab World Sync — Shared Logic
 *
 * Wird genutzt von:
 *   - /api/webhooks/stripe    → Kauf-Ereignisse verarbeiten
 *   - /api/cron/skool-expiry  → Ablauf-Check
 *   - /api/admin/community/*  → Einladungen, manuelle Aktionen
 *   - /invite/skool/[token]   → Claim-Flow
 *
 * Konzept siehe docs/SKOOL_SYNC.md
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import type Stripe from 'stripe'
import { getStripe } from './stripe'
import { getAppSettings } from './app-settings'
import { grantMonthlyCredits } from './monetization'

// Feature-Flag für sicheren Rollout. Default aus, damit Live-Stripe nichts
// ungewolltes triggert, bis Jacob scharf schaltet.
export function isSkoolSyncEnabled(): boolean {
  return process.env.SKOOL_SYNC_ENABLED === 'true'
}

// Default 30 Tage Magic-Link-Gültigkeit (aus Plan)
const INVITE_TOKEN_DAYS = 30

/**
 * Schutz gegen unbeabsichtigte Admin-Mutationen via Community-Operationen.
 *
 * Admin-Profile dürfen NIE durch Skool-/Community-Sync, Bulk-Delete, Cron
 * oder PATCH/DELETE-Routen verändert werden — weder access_tier noch
 * subscriptions. community_members-Einträge selbst sind erlaubt (Admin kann
 * trotzdem aus der Liste raus), nur ihre profile_id-Seite bleibt tabu.
 *
 * Aufrufer sind verantwortlich, das Result früh zu prüfen und betroffene
 * Operationen zu skippen.
 */
export async function isAdminProfile(
  admin: SupabaseClient,
  profileId: string | null | undefined
): Promise<boolean> {
  if (!profileId) return false
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', profileId)
    .maybeSingle()
  return data?.role === 'admin'
}

export interface SkoolProduct {
  stripe_product_id: string
  label: string
  access_days: number
  active: boolean
}

/**
 * Lädt alle aktiven Skool-Products aus DB. Cachen lohnt sich im Cron / Webhook
 * nicht (pro Request 1× abfragen ist ok).
 */
export async function loadSkoolProducts(
  admin: SupabaseClient
): Promise<SkoolProduct[]> {
  const { data, error } = await admin
    .from('skool_stripe_products')
    .select('stripe_product_id, label, access_days, active')
    .eq('active', true)

  if (error) throw new Error(`loadSkoolProducts: ${error.message}`)
  return (data ?? []) as SkoolProduct[]
}

/**
 * Prüft ob eine Product-ID in der aktiven Whitelist steht.
 */
export async function isSkoolProductId(
  admin: SupabaseClient,
  productId: string
): Promise<SkoolProduct | null> {
  const { data } = await admin
    .from('skool_stripe_products')
    .select('stripe_product_id, label, access_days, active')
    .eq('stripe_product_id', productId)
    .eq('active', true)
    .maybeSingle()

  return (data as SkoolProduct | null) ?? null
}

/**
 * Holt die Product-IDs eines Checkout-Session (über Line-Items).
 * Stripe liefert Line-Items nicht mit dem Webhook-Payload — müssen nachgeladen
 * werden.
 */
export async function getCheckoutProductIds(
  sessionId: string
): Promise<string[]> {
  const stripe = getStripe()
  const items = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 20,
    expand: ['data.price.product'],
  })

  const ids: string[] = []
  for (const item of items.data) {
    const product = item.price?.product
    if (!product) continue
    if (typeof product === 'string') {
      ids.push(product)
    } else if (!product.deleted) {
      ids.push(product.id)
    }
  }
  return ids
}

/**
 * Upsert eines Skool-Kaufs in community_members.
 *
 * - Neuer Customer → Insert mit skool_status='active', expires=now+access_days
 * - Bestehender Customer (Renewal) → expires = max(current, now) + access_days
 *   purchase_count++, letzter Kauf aktualisiert
 * - Wenn profile_id verknüpft → Plan S automatisch reaktivieren (via ensureSkoolPlanS)
 */
export async function recordSkoolPurchase(
  admin: SupabaseClient,
  params: {
    stripeCustomerId: string
    email: string
    name?: string | null
    productId: string
    priceId?: string | null
    paymentIntentId?: string | null
    accessDays: number
    purchasedAt: Date
  }
): Promise<{ communityMemberId: string; wasRenewal: boolean }> {
  const {
    stripeCustomerId,
    email,
    name,
    productId,
    priceId,
    paymentIntentId,
    accessDays,
    purchasedAt,
  } = params

  // Existierenden Member suchen
  const { data: existing } = await admin
    .from('community_members')
    .select('id, skool_access_expires_at, purchase_count, profile_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle()

  const baseDate =
    existing?.skool_access_expires_at &&
    new Date(existing.skool_access_expires_at) > purchasedAt
      ? new Date(existing.skool_access_expires_at)
      : purchasedAt

  const newExpiry = new Date(baseDate.getTime() + accessDays * 24 * 60 * 60 * 1000)

  const payload = {
    stripe_customer_id: stripeCustomerId,
    email: email.toLowerCase(),
    name: name ?? null,
    skool_status: 'active' as const,
    skool_access_started_at: existing?.skool_access_expires_at
      ? undefined // nicht überschreiben bei Renewal
      : purchasedAt.toISOString(),
    skool_access_expires_at: newExpiry.toISOString(),
    last_purchase_at: purchasedAt.toISOString(),
    last_stripe_product_id: productId,
    last_stripe_price_id: priceId ?? null,
    last_stripe_payment_intent: paymentIntentId ?? null,
    purchase_count: (existing?.purchase_count ?? 0) + 1,
  }

  if (existing) {
    const { error } = await admin
      .from('community_members')
      .update(payload)
      .eq('id', existing.id)
    if (error) throw new Error(`recordSkoolPurchase update: ${error.message}`)

    // Wenn bereits claimed → Plan S reaktivieren/verlängern
    if (existing.profile_id) {
      await ensureSkoolPlanS(admin, {
        profileId: existing.profile_id,
        periodEnd: newExpiry,
      })
    }

    return { communityMemberId: existing.id, wasRenewal: true }
  }

  const { data: created, error } = await admin
    .from('community_members')
    .insert({
      ...payload,
      skool_access_started_at: purchasedAt.toISOString(),
    })
    .select('id')
    .single()
  if (error || !created) {
    throw new Error(`recordSkoolPurchase insert: ${error?.message ?? 'unknown'}`)
  }

  // Auto-Link: falls schon ein auth.user mit dieser Email existiert,
  // direkt verknüpfen (z.B. Admin oder Self-Signup-User, der jetzt KMC kauft).
  // Best-effort — Webhook soll nicht failen, wenn der Lookup hakt.
  try {
    await autoLinkProfileIfExists(admin, {
      id: created.id,
      email: email.toLowerCase(),
      name: name ?? null,
      skool_status: 'active',
      skool_access_expires_at: newExpiry.toISOString(),
      profile_id: null,
    })
  } catch {
    // ignore
  }

  return { communityMemberId: created.id, wasRenewal: false }
}

/**
 * Aktiviert Plan S (oder hält ihn frisch) für einen geclaimten User.
 * - Wenn User bereits eigenes paid-Abo hat → nichts tun (user zahlt selbst)
 * - Wenn admin_granted-Abo existiert → nichts tun (Admin hat das bewusst gesetzt)
 * - Wenn skool_community-Abo existiert → current_period_end hochsetzen
 * - Sonst neue Subscription anlegen mit plan_source='skool_community'
 *
 * ACHTUNG: Wir legen keinen Stripe-Subscription an. Plan S via Skool ist gratis,
 * hat also kein Stripe-Abo. Das ist by design.
 */
export async function ensureSkoolPlanS(
  admin: SupabaseClient,
  params: { profileId: string; periodEnd: Date }
): Promise<void> {
  const { profileId, periodEnd } = params

  // Admin-Schutz: Admin-Profile niemals durch Skool-Sync verändern.
  if (await isAdminProfile(admin, profileId)) return

  // ─── NEU (Phase 3): Master-Switch-Branch ───────────────────────
  // Wenn Abo-System aus ist, legen wir KEINE Plan-S-Sub mehr an.
  // Stattdessen: tier=premium + Initial-Credits + Cron handhabt Refreshes.
  const settings = await getAppSettings()
  if (!settings.subscriptionsEnabled) {
    await ensureCommunityMembershipNoSub(admin, profileId, settings.communityMonthlyCredits)
    return
  }

  // ─── Legacy-Pfad (Subs aktiv): Plan-S-Subscription anlegen ─────

  // Schon aktive Sub?
  const { data: active } = await admin
    .from('subscriptions')
    .select('id, plan_id, plan_source, current_period_end, status')
    .eq('user_id', profileId)
    .in('status', ['active', 'trialing', 'past_due'])
    .maybeSingle()

  if (active) {
    if (active.plan_source === 'paid' || active.plan_source === 'admin_granted') {
      // User zahlt selbst oder Admin hat bewusst gesetzt — nicht überschreiben
      return
    }
    if (active.plan_source === 'skool_community') {
      // Verlängern, falls neuer Endpunkt später ist
      if (
        !active.current_period_end ||
        new Date(active.current_period_end) < periodEnd
      ) {
        await admin
          .from('subscriptions')
          .update({
            current_period_end: periodEnd.toISOString(),
            status: 'active',
          })
          .eq('id', active.id)
      }
      return
    }
  }

  // Neue Plan-S-Subscription anlegen
  await admin.from('subscriptions').insert({
    user_id: profileId,
    plan_id: 'plan_s',
    status: 'active',
    price_band: 'community',
    billing_cycle: 'yearly',
    plan_source: 'skool_community',
    current_period_start: new Date().toISOString(),
    current_period_end: periodEnd.toISOString(),
  })

  // access_tier auf premium setzen (falls noch nicht)
  await admin
    .from('profiles')
    .update({ access_tier: 'premium' })
    .eq('id', profileId)
    .neq('access_tier', 'premium')
}

/**
 * NEU (Phase 3): Community-Mitgliedschaft ohne Plan-S-Subscription.
 *
 * Wird statt der Plan-S-Sub angelegt, wenn `subscriptions_enabled=false`.
 * - Setzt tier=premium auf dem Profil
 * - Wenn das Mitglied noch nie Credits bekommen hat (last_credit_grant_at
 *   IS NULL): direkter Initial-Grant + last_credit_grant_at=now()
 * - Sonst: nichts. Cron /api/cron/community-credit-grant erneuert
 *   monatlich nach Kalendermonat-Logik.
 *
 * Idempotent: Mehrfach-Aufrufe bei demselben profileId machen nichts kaputt
 * (kein doppelter Initial-Grant dank last_credit_grant_at-Check).
 */
async function ensureCommunityMembershipNoSub(
  admin: SupabaseClient,
  profileId: string,
  monthlyCredits: number
): Promise<void> {
  // Tier auf premium setzen (idempotent durch .neq).
  await admin
    .from('profiles')
    .update({ access_tier: 'premium' })
    .eq('id', profileId)
    .neq('access_tier', 'premium')

  // community_member-Eintrag finden (für last_credit_grant_at-Tracking).
  const { data: member } = await admin
    .from('community_members')
    .select('id, last_credit_grant_at')
    .eq('profile_id', profileId)
    .maybeSingle()

  // Wenn (noch) kein community_members-Eintrag verknüpft → Cron handhabt
  // das später, sobald der Claim/Sync den Eintrag anlegt. Kein Crash.
  if (!member) return

  // Schon mal Credits bekommen → fertig, Cron erneuert monatlich.
  if (member.last_credit_grant_at) return

  // Initial-Grant: Reset-Datum 1 Monat in der Zukunft (matched cron-Logik).
  const resetAt = new Date()
  resetAt.setMonth(resetAt.getMonth() + 1)

  const grantResult = await grantMonthlyCredits({
    userId: profileId,
    amount: monthlyCredits,
    resetAt,
    reason: 'monthly_grant',
  })

  if (!grantResult.ok) {
    console.error(
      '[skool-sync] Initial-Credit-Grant fehlgeschlagen für',
      profileId,
      grantResult.error
    )
    return
  }

  // Stempeln: nächster Cron-Lauf weiß, dass schon Credits da sind.
  await admin
    .from('community_members')
    .update({ last_credit_grant_at: new Date().toISOString() })
    .eq('id', member.id)
}

/**
 * Refund-Case: Mitglied wollte raus, hat Geld zurück.
 *  - Wenn nicht claimed (nie registriert) → community_members-Eintrag löschen
 *  - Wenn claimed → status='cancelled' (NICHT alumni!),
 *    Plan S beenden, access_tier='basic' (Gast/Upgrade-Pfad,
 *    KEIN lebenslanger Classroom-Zugang).
 *
 * Wichtig: alumni ist für saubere 12-Monats-Abläufe reserviert.
 * Refund ist semantisch was anderes — der User hat aktiv abgelehnt.
 */
export async function cancelSkoolMembership(
  admin: SupabaseClient,
  communityMemberId: string
): Promise<{ deleted: boolean; cancelled: boolean }> {
  const { data: member } = await admin
    .from('community_members')
    .select('id, profile_id, skool_status')
    .eq('id', communityMemberId)
    .maybeSingle()

  if (!member) return { deleted: false, cancelled: false }

  // Nicht claimed → komplett raus
  if (!member.profile_id) {
    await admin.from('community_members').delete().eq('id', member.id)
    return { deleted: true, cancelled: false }
  }

  // Claimed → cancelled markieren
  if (member.skool_status !== 'cancelled') {
    await admin
      .from('community_members')
      .update({ skool_status: 'cancelled' })
      .eq('id', member.id)
  }

  // Admin-Schutz: profiles + subscriptions des Admins NIE anfassen.
  // (community_members oben darf trotzdem cancelled werden.)
  if (await isAdminProfile(admin, member.profile_id)) {
    return { deleted: false, cancelled: true }
  }

  // Skool-Community-Sub beenden (falls aktiv)
  const { data: skoolSub } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', member.profile_id)
    .eq('plan_source', 'skool_community')
    .in('status', ['active', 'trialing', 'past_due'])
    .maybeSingle()

  if (skoolSub) {
    await admin
      .from('subscriptions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', skoolSub.id)
  }

  // access_tier auf 'basic' zurücksetzen (nicht alumni!) —
  // nur wenn aktuell premium und keine andere aktive paid Sub vorhanden
  const { data: otherActive } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', member.profile_id)
    .in('status', ['active', 'trialing', 'past_due'])
    .limit(1)
    .maybeSingle()

  if (!otherActive) {
    await admin
      .from('profiles')
      .update({ access_tier: 'basic' })
      .eq('id', member.profile_id)
      .eq('access_tier', 'premium')
  }

  // Auto-Fillup-Anzeige stoppen: monthly_balance bleibt (User darf noch
  // verbrauchen), aber reset_at = null entfernt die "erneuert sich am X"-
  // Anzeige im Frontend. Auch der Cron-Job /api/cron/community-credit-grant
  // springt diesen User dank skool_status='cancelled' nicht mehr an.
  await admin
    .from('credit_wallets')
    .update({ reset_at: null })
    .eq('user_id', member.profile_id)

  return { deleted: false, cancelled: true }
}

/**
 * Beendet Skool-Zugang (Alumni-Werden, NACH 12-Monats-Ablauf).
 * - community_members.skool_status = 'alumni'
 * - Wenn profile_id vorhanden und Plan S aus Skool → beenden
 * - access_tier von 'premium' auf 'alumni' zurücksetzen
 * - Auto-Fillup stoppt SOFORT (Cron skippt durch skool_status-Filter)
 * - monthly_balance + purchased_balance BLEIBEN — User darf restliche
 *   Credits in der Toolbox verbrauchen (Jacob: "credits bleiben erhalten
 *   kann sie noch verbrauchen kann also noch in die ki toolbox").
 * - reset_at wird auf null gesetzt → Frontend zeigt keine fake Erneuerung
 */
export async function expireSkoolMembership(
  admin: SupabaseClient,
  communityMemberId: string
): Promise<void> {
  const { data: member } = await admin
    .from('community_members')
    .select('id, profile_id, skool_status')
    .eq('id', communityMemberId)
    .maybeSingle()

  if (!member) return
  if (member.skool_status !== 'active') return // schon alumni/cancelled

  await admin
    .from('community_members')
    .update({ skool_status: 'alumni' })
    .eq('id', member.id)

  if (!member.profile_id) return

  // Admin-Schutz: profiles + subscriptions des Admins NIE anfassen.
  if (await isAdminProfile(admin, member.profile_id)) return

  // Skool-Community-Sub beenden
  const { data: skoolSub } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', member.profile_id)
    .eq('plan_source', 'skool_community')
    .in('status', ['active', 'trialing', 'past_due'])
    .maybeSingle()

  if (skoolSub) {
    await admin
      .from('subscriptions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', skoolSub.id)
  }

  // access_tier nur zurücksetzen, wenn keine andere aktive Sub da ist
  const { data: otherActive } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', member.profile_id)
    .in('status', ['active', 'trialing', 'past_due'])
    .limit(1)
    .maybeSingle()

  if (!otherActive) {
    await admin
      .from('profiles')
      .update({ access_tier: 'alumni' })
      .eq('id', member.profile_id)
      .eq('access_tier', 'premium')
  }

  // Auto-Fillup-Anzeige stoppen (analog cancelSkoolMembership):
  // monthly_balance bleibt zum Verbrauchen, aber reset_at = null entfernt
  // die "erneuert sich am X"-Anzeige im Wallet-UI.
  await admin
    .from('credit_wallets')
    .update({ reset_at: null })
    .eq('user_id', member.profile_id)
}

/**
 * Erzeugt einen neuen Einladungs-Token (32 bytes url-safe base64)
 * und speichert ihn mit 30-Tage-Ablauf.
 */
export async function generateInvitationToken(
  admin: SupabaseClient,
  communityMemberId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_DAYS * 24 * 60 * 60 * 1000)

  const { error } = await admin
    .from('community_members')
    .update({
      invitation_token: token,
      invitation_token_expires: expiresAt.toISOString(),
    })
    .eq('id', communityMemberId)
  if (error) throw new Error(`generateInvitationToken: ${error.message}`)

  return { token, expiresAt }
}

/**
 * Markiert eine Einladung als versendet (Zähler + Zeitstempel).
 */
export async function markInvitationSent(
  admin: SupabaseClient,
  communityMemberId: string
): Promise<void> {
  // Erst aktuellen Zähler lesen (kein atomic increment in supabase-js v2 ohne RPC)
  const { data: current } = await admin
    .from('community_members')
    .select('invitation_sent_count, invited_at')
    .eq('id', communityMemberId)
    .single()

  const now = new Date().toISOString()
  await admin
    .from('community_members')
    .update({
      invitation_sent_count: (current?.invitation_sent_count ?? 0) + 1,
      last_invited_at: now,
      invited_at: current?.invited_at ?? now,
    })
    .eq('id', communityMemberId)
}

/**
 * Holt einen Community-Member per Token (für Claim-Flow).
 * Prüft Ablauf, gibt null zurück wenn invalide.
 */
export async function getCommunityMemberByToken(
  admin: SupabaseClient,
  token: string
): Promise<{
  id: string
  email: string
  name: string | null
  skool_access_expires_at: string | null
  profile_id: string | null
  claimed_at: string | null
} | null> {
  const { data } = await admin
    .from('community_members')
    .select(
      'id, email, name, skool_access_expires_at, profile_id, claimed_at, invitation_token_expires'
    )
    .eq('invitation_token', token)
    .maybeSingle()

  if (!data) return null
  if (!data.invitation_token_expires) return null
  if (new Date(data.invitation_token_expires) < new Date()) return null

  return data
}

/**
 * Auto-Link: prüft ob für die Email schon ein auth.user existiert
 * (z.B. Admin / Self-Signup) und verknüpft dann community_member damit
 * direkt — ohne dass der User die Einladung claimen muss.
 *
 * - profiles.role wird NICHT angefasst (Admin bleibt Admin)
 * - profiles.full_name wird nur gesetzt, wenn aktuell NULL
 * - access_tier:
 *   * skool_status='active' + Zugang gültig → ensureSkoolPlanS (premium,
 *     paid-Subs werden nicht überschrieben)
 *   * skool_status='alumni' → access_tier='alumni' (nur wenn aktuell basic)
 *   * skool_status='cancelled' → kein Tier-Upgrade
 *
 * Optional: cachedUserMap für Bulk-Aufrufe (vermeidet N × listUsers).
 */
export async function autoLinkProfileIfExists(
  admin: SupabaseClient,
  member: {
    id: string
    email: string
    name?: string | null
    skool_status: 'active' | 'alumni' | 'cancelled'
    skool_access_expires_at: string | null
    profile_id: string | null
  },
  cachedUserMap?: Map<string, string>
): Promise<{ linked: boolean; profileId?: string }> {
  if (member.profile_id) return { linked: false }

  const email = member.email.toLowerCase()

  // User-ID per Email auflösen — entweder aus Cache oder live nachschlagen
  let userId: string | undefined
  if (cachedUserMap) {
    userId = cachedUserMap.get(email)
  } else {
    const { data: page } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const found = page?.users?.find((u) => u.email?.toLowerCase() === email)
    userId = found?.id
  }

  if (!userId) return { linked: false }

  // community_member verknüpfen (Auto-Claim)
  await admin
    .from('community_members')
    .update({
      profile_id: userId,
      claimed_at: new Date().toISOString(),
      invitation_token: null,
      invitation_token_expires: null,
    })
    .eq('id', member.id)

  // Admin-Schutz: profiles-Mutationen (full_name, access_tier, Plan S)
  // für Admin-Profile überspringen — Verknüpfung selbst ist OK.
  if (await isAdminProfile(admin, userId)) {
    return { linked: true, profileId: userId }
  }

  // Name nur befüllen wenn leer
  if (member.name) {
    await admin
      .from('profiles')
      .update({ full_name: member.name })
      .eq('id', userId)
      .is('full_name', null)
  }

  // Tier hochsetzen — paid Subs / admin_granted bleiben unangetastet
  if (
    member.skool_status === 'active' &&
    member.skool_access_expires_at &&
    new Date(member.skool_access_expires_at) > new Date()
  ) {
    await ensureSkoolPlanS(admin, {
      profileId: userId,
      periodEnd: new Date(member.skool_access_expires_at),
    })
  } else if (member.skool_status === 'alumni') {
    await admin
      .from('profiles')
      .update({ access_tier: 'alumni' })
      .eq('id', userId)
      .eq('access_tier', 'basic')
  }

  return { linked: true, profileId: userId }
}

/**
 * Auto-Link nach Login: prüft ob ein unclaimed community_member mit der Email
 * des frisch eingeloggten Users existiert und claimt ihn (Plan S / alumni).
 *
 * Wird aus /auth/callback nach jedem Login aufgerufen, deckt zwei Cases ab:
 *  1. Neu-Registrierung nach Skool-Kauf (Webhook hat community_member angelegt,
 *     User registriert sich danach selbst → automatisch verknüpft)
 *  2. Bestehender User, der erst später Skool kauft (nächster Login claimt)
 *
 * Idempotent: wenn kein unclaimed member mit der Email existiert → no-op.
 */
export async function linkUserToCommunityMember(
  admin: SupabaseClient,
  params: { userId: string; email: string }
): Promise<{ linked: boolean }> {
  const email = params.email.toLowerCase()

  const { data: member } = await admin
    .from('community_members')
    .select('id, email, name, skool_status, skool_access_expires_at, profile_id')
    .eq('email', email)
    .is('profile_id', null)
    .maybeSingle()

  if (!member) return { linked: false }

  const result = await autoLinkProfileIfExists(
    admin,
    {
      id: member.id,
      email: member.email,
      name: member.name,
      skool_status: member.skool_status as 'active' | 'alumni' | 'cancelled',
      skool_access_expires_at: member.skool_access_expires_at,
      profile_id: member.profile_id,
    },
    new Map([[email, params.userId]])
  )

  return { linked: result.linked }
}

/**
 * Backfill: alle community_members ohne profile_id durchgehen und mit
 * existierenden auth.users verknüpfen. Nutzt einen Email-Map-Cache —
 * 1× listUsers vorab statt N×.
 *
 * profiles.role bleibt unangetastet (Admin bleibt Admin).
 */
export async function autoLinkAllUnclaimed(
  admin: SupabaseClient
): Promise<{ scanned: number; linked: number; errors: string[] }> {
  const errors: string[] = []
  let userMap: Map<string, string>
  try {
    userMap = await buildAuthUserEmailMap(admin)
  } catch (err) {
    errors.push(`auth-users laden: ${err instanceof Error ? err.message : String(err)}`)
    return { scanned: 0, linked: 0, errors }
  }

  type Row = {
    id: string
    email: string
    name: string | null
    skool_status: 'active' | 'alumni' | 'cancelled'
    skool_access_expires_at: string | null
    profile_id: string | null
  }

  const all: Row[] = []
  const PAGE = 1000
  let offset = 0
  while (offset < 50000) {
    const { data } = await admin
      .from('community_members')
      .select('id, email, name, skool_status, skool_access_expires_at, profile_id')
      .is('profile_id', null)
      .range(offset, offset + PAGE - 1)
    if (!data || data.length === 0) break
    all.push(...(data as Row[]))
    if (data.length < PAGE) break
    offset += PAGE
  }

  let linked = 0
  for (const m of all) {
    try {
      const res = await autoLinkProfileIfExists(admin, m, userMap)
      if (res.linked) linked += 1
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }
  return { scanned: all.length, linked, errors }
}

/**
 * Dedupe: gruppiert community_members nach lower(email) und löscht
 * Duplikate. Stripe-Source gewinnt, sonst jüngster created_at, claimed
 * vor unclaimed.
 */
export async function dedupeCommunityMembers(
  admin: SupabaseClient
): Promise<{ duplicate_groups: number; deleted: number; errors: string[] }> {
  type Member = {
    id: string
    email: string
    source: 'stripe' | 'manual' | 'csv' | 'skool' | null
    profile_id: string | null
    claimed_at: string | null
    created_at: string
    skool_status: 'active' | 'alumni' | 'cancelled'
  }

  const SOURCE_PRIO: Record<string, number> = {
    stripe: 4,
    skool: 3,
    manual: 2,
    csv: 1,
  }

  function pickKeeper(rows: Member[]): Member {
    const sorted = [...rows].sort((a, b) => {
      const ac = a.profile_id ? 1 : 0
      const bc = b.profile_id ? 1 : 0
      if (ac !== bc) return bc - ac
      const ap = SOURCE_PRIO[a.source ?? ''] ?? 0
      const bp = SOURCE_PRIO[b.source ?? ''] ?? 0
      if (ap !== bp) return bp - ap
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return sorted[0]
  }

  const all: Member[] = []
  const PAGE = 1000
  let offset = 0
  while (offset < 50000) {
    const { data } = await admin
      .from('community_members')
      .select(
        'id, email, source, profile_id, claimed_at, created_at, skool_status'
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (!data || data.length === 0) break
    all.push(...(data as Member[]))
    if (data.length < PAGE) break
    offset += PAGE
  }

  const groups = new Map<string, Member[]>()
  for (const m of all) {
    const key = m.email.toLowerCase()
    const arr = groups.get(key) ?? []
    arr.push(m)
    groups.set(key, arr)
  }

  const toDelete: string[] = []
  let groupsWithDuplicates = 0
  for (const [, rows] of groups) {
    if (rows.length <= 1) continue
    groupsWithDuplicates += 1
    const keeper = pickKeeper(rows)
    for (const row of rows) {
      if (row.id !== keeper.id) toDelete.push(row.id)
    }
  }

  let deleted = 0
  const errors: string[] = []
  const BATCH = 100
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH)
    const { error: delErr, count } = await admin
      .from('community_members')
      .delete({ count: 'exact' })
      .in('id', batch)
    if (delErr) errors.push(delErr.message)
    else deleted += count ?? batch.length
  }

  return { duplicate_groups: groupsWithDuplicates, deleted, errors }
}

/**
 * Hilfsfunktion: Map<emailLower, userId> aus auth.users bauen.
 * Für Bulk-Aufrufe gedacht — listUsers liefert max 1000 pro Page.
 */
export async function buildAuthUserEmailMap(
  admin: SupabaseClient
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let page = 1
  while (page < 50) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000, page })
    const users = data?.users ?? []
    for (const u of users) {
      if (u.email) map.set(u.email.toLowerCase(), u.id)
    }
    if (users.length < 1000) break
    page += 1
  }
  return map
}

/**
 * Claim-Flow: verknüpft community_member mit frisch angelegtem / bestehendem profile.
 *  - skool_status='active' + Zugang noch gültig → Plan S aktivieren (premium)
 *  - skool_status='alumni' → access_tier='alumni' (lebenslanger Classroom-Zugang,
 *    kein Plan S, kein Premium)
 *  - skool_status='cancelled' → kein Tier-Upgrade (basic bleibt)
 */
export async function claimCommunityMember(
  admin: SupabaseClient,
  params: { communityMemberId: string; profileId: string }
): Promise<void> {
  const { communityMemberId, profileId } = params

  const { data: member } = await admin
    .from('community_members')
    .select('id, skool_access_expires_at, skool_status')
    .eq('id', communityMemberId)
    .single()
  if (!member) throw new Error('Community-Member nicht gefunden')

  await admin
    .from('community_members')
    .update({
      profile_id: profileId,
      claimed_at: new Date().toISOString(),
      invitation_token: null,
      invitation_token_expires: null,
    })
    .eq('id', communityMemberId)

  // Admin-Schutz: profiles-Mutationen für Admins überspringen.
  if (await isAdminProfile(admin, profileId)) return

  if (
    member.skool_status === 'active' &&
    member.skool_access_expires_at &&
    new Date(member.skool_access_expires_at) > new Date()
  ) {
    // Aktiver Club-Member → Plan S, Premium
    await ensureSkoolPlanS(admin, {
      profileId,
      periodEnd: new Date(member.skool_access_expires_at),
    })
  } else if (member.skool_status === 'alumni') {
    // Alumni → nur Classroom-Zugang. access_tier='alumni' setzen,
    // wenn aktuell basic (also nicht premium oder schon alumni).
    await admin
      .from('profiles')
      .update({ access_tier: 'alumni' })
      .eq('id', profileId)
      .eq('access_tier', 'basic')
  }
  // cancelled → bleibt basic, kein Upgrade
}

/**
 * Voll-Sync: durchsucht Stripe nach Skool-Käufen über drei Quellen
 * (Checkout-Sessions, Subscriptions, Paid Invoices), aggregiert pro
 * Customer und upsertet community_members. Anschließend expireSkoolMembership
 * für alle abgelaufenen.
 *
 * Pagination-Limits sind großzügig (~50 Pages = 5000 Items pro Quelle).
 * Sessions-Phase ist teurer (1 Extra-Call pro Session für line items),
 * daher dort niedriger gecappt.
 *
 * Wird von Admin-UI „Sync"-Button und vom Initial-Import-Script aufgerufen.
 */
export async function syncSkoolMembersFromStripe(
  admin: SupabaseClient,
  opts: { days?: number; includeInactive?: boolean } = {}
): Promise<{
  scanned: number
  matched: number
  upserted: number
  expired: number
  by_phase: {
    sessions: { scanned: number; matched: number; capped: boolean }
    subscriptions: { scanned: number; matched: number; capped: boolean }
    invoices: { scanned: number; matched: number; capped: boolean }
  }
  refunds: { detected: number; cleaned_up: number }
  errors: Array<{ session?: string; member?: string; error: string }>
}> {
  const days = opts.days ?? 90
  const since = Math.floor(Date.now() / 1000) - days * 86400
  const stripe = getStripe()

  // Pagination-Caps pro Phase. Mit expand inline werden alle Quellen billig.
  // Dedupe + Auto-Link laufen getrennt (eigene API-Endpoints) → halten den
  // Sync-Endpoint unter 5 Min Vercel-Timeout.
  const SESSIONS_MAX_PAGES = 100 // 10.000 Sessions max
  const SUBS_MAX_PAGES = 100 // 10.000 Subscriptions max
  const INVOICES_MAX_PAGES = 100 // 10.000 Invoices max
  const REFUNDS_MAX_PAGES = 50 // 5.000 Refunds max

  // Whitelist laden — beim manuellen Sync auch deaktivierte berücksichtigen,
  // damit Bestand nicht verloren geht
  const { data: products } = await admin
    .from('skool_stripe_products')
    .select('stripe_product_id, label, access_days, active')
  const productMap = new Map<string, SkoolProduct>(
    (products ?? [])
      .filter((p) => opts.includeInactive ?? true ? true : p.active)
      .map((p) => [p.stripe_product_id, p as SkoolProduct])
  )

  if (productMap.size === 0) {
    return {
      scanned: 0,
      matched: 0,
      upserted: 0,
      expired: 0,
      by_phase: {
        sessions: { scanned: 0, matched: 0, capped: false },
        subscriptions: { scanned: 0, matched: 0, capped: false },
        invoices: { scanned: 0, matched: 0, capped: false },
      },
      refunds: { detected: 0, cleaned_up: 0 },
      errors: [{ error: 'Keine Skool-Products in der Whitelist' }],
    }
  }

  const errors: Array<{ session?: string; member?: string; error: string }> = []
  let upserted = 0

  // Pro-Phase Tracking
  let sessionsScanned = 0
  let sessionsMatched = 0
  let sessionsCapped = false
  let subsScanned = 0
  let subsMatched = 0
  let subsCapped = false
  let invScanned = 0
  let invMatched = 0
  let invCapped = false

  // ─── 4 Stripe-Phasen PARALLEL via Promise.all ────────────────────────────
  // Vorher sequentiell: Refunds → Sessions → Subs → Invoices = ~120s+
  // Jetzt parallel: max(jeweils ~30s) = ~30s.
  // Pro Phase lokaler State + Hits-Array, Merge in shared state nach Promise.all.

  // Per Customer aggregieren — pro Customer nur einmal upserten (jüngster Kauf gewinnt)
  type Hit = {
    sessionId: string
    paymentIntentId: string | null
    email: string
    name: string | null
    customerId: string
    productId: string
    priceId: string | null
    accessDays: number
    purchasedAt: Date
  }
  const perCustomer = new Map<string, Hit[]>()
  const refundsByCustomer = new Map<string, { date: Date; amount: number }>()

  type PhaseOut = {
    hits: Hit[]
    scanned: number
    matched: number
    capped: boolean
    phaseErrors: Array<{ session?: string; error: string }>
  }

  const [refundsR, sessionsR, subsR, invoicesR] = await Promise.all([
    // ─── Refunds ───────────────────────────────────────────────────
    (async (): Promise<{
      map: typeof refundsByCustomer
      phaseErrors: Array<{ error: string }>
    }> => {
      const map = new Map<string, { date: Date; amount: number }>()
      const phaseErrors: Array<{ error: string }> = []
      let after: string | undefined = undefined
      let pages = 0
      while (pages < REFUNDS_MAX_PAGES) {
        try {
          const list = await stripe.refunds.list({
            limit: 100,
            starting_after: after,
            created: { gte: since },
            expand: ['data.payment_intent'],
          })
          pages += 1
          for (const r of list.data) {
            const pi = r.payment_intent
            let customerId: string | null = null
            if (pi && typeof pi !== 'string') {
              customerId =
                typeof pi.customer === 'string'
                  ? pi.customer
                  : pi.customer?.id ?? null
            }
            if (!customerId) continue
            const refundDate = new Date((r.created ?? Date.now() / 1000) * 1000)
            const existing = map.get(customerId)
            if (!existing || existing.date < refundDate) {
              map.set(customerId, { date: refundDate, amount: r.amount })
            }
          }
          if (!list.has_more) break
          after = list.data[list.data.length - 1]?.id
        } catch (err) {
          phaseErrors.push({
            error: `refunds.list: ${err instanceof Error ? err.message : String(err)}`,
          })
          break
        }
      }
      return { map, phaseErrors }
    })(),

    // ─── Sessions ──────────────────────────────────────────────────
    (async (): Promise<PhaseOut> => {
      const out: PhaseOut = { hits: [], scanned: 0, matched: 0, capped: false, phaseErrors: [] }
      let after: string | undefined = undefined
      let pages = 0
      while (pages < SESSIONS_MAX_PAGES) {
        const list = await stripe.checkout.sessions.list({
          limit: 100,
          starting_after: after,
          created: { gte: since },
          expand: ['data.line_items.data.price'],
        })
        pages += 1
        for (const s of list.data) {
          out.scanned += 1
          if (s.status !== 'complete') continue
          if (s.mode !== 'payment') continue
          try {
            let hit: SkoolProduct | null = null
            let priceId: string | null = null
            const items = s.line_items?.data ?? []
            for (const item of items) {
              const productRef = item.price?.product
              const pid =
                typeof productRef === 'string'
                  ? productRef
                  : productRef && !('deleted' in productRef && productRef.deleted)
                  ? productRef.id
                  : null
              if (pid && productMap.has(pid)) {
                hit = productMap.get(pid)!
                priceId = item.price?.id ?? null
                break
              }
            }
            if (!hit) continue
            const customerId =
              typeof s.customer === 'string' ? s.customer : s.customer?.id ?? null
            const email = s.customer_details?.email ?? s.customer_email ?? null
            if (!customerId || !email) continue
            const paymentIntentId =
              typeof s.payment_intent === 'string'
                ? s.payment_intent
                : s.payment_intent?.id ?? null
            out.matched += 1
            out.hits.push({
              sessionId: s.id,
              paymentIntentId,
              email,
              name: s.customer_details?.name ?? null,
              customerId,
              productId: hit.stripe_product_id,
              priceId,
              accessDays: hit.access_days,
              purchasedAt: new Date((s.created ?? Date.now() / 1000) * 1000),
            })
          } catch (err) {
            out.phaseErrors.push({
              session: s.id,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }
        if (!list.has_more) break
        after = list.data[list.data.length - 1].id
        if (pages >= SESSIONS_MAX_PAGES) {
          out.capped = list.has_more
          break
        }
      }
      return out
    })(),

    // ─── Subscriptions ─────────────────────────────────────────────
    (async (): Promise<PhaseOut> => {
      const out: PhaseOut = { hits: [], scanned: 0, matched: 0, capped: false, phaseErrors: [] }
      let after: string | undefined = undefined
      let pages = 0
      while (pages < SUBS_MAX_PAGES) {
        const list = await stripe.subscriptions.list({
          limit: 100,
          starting_after: after,
          status: 'all',
          expand: ['data.customer'],
        })
        pages += 1
        for (const sub of list.data) {
          out.scanned += 1
          try {
            let hit: SkoolProduct | null = null
            let priceId: string | null = null
            for (const item of sub.items.data) {
              const productRef = item.price?.product
              const pid =
                typeof productRef === 'string'
                  ? productRef
                  : productRef && 'id' in productRef && !('deleted' in productRef && productRef.deleted)
                  ? productRef.id
                  : null
              if (pid && productMap.has(pid)) {
                hit = productMap.get(pid)!
                priceId = item.price?.id ?? null
                break
              }
            }
            if (!hit) continue
            const cust = sub.customer
            const customerId = typeof cust === 'string' ? cust : cust?.id ?? null
            if (!customerId) continue
            let email: string | null = null
            let name: string | null = null
            if (cust && typeof cust !== 'string' && !('deleted' in cust && cust.deleted)) {
              email = cust.email ?? null
              name = cust.name ?? null
            }
            if (!email) {
              try {
                const full = await stripe.customers.retrieve(customerId)
                if (!('deleted' in full) || !full.deleted) {
                  email = (full as Stripe.Customer).email ?? null
                  name = (full as Stripe.Customer).name ?? null
                }
              } catch {
                // ignore
              }
            }
            if (!email) continue
            const purchasedAt = new Date((sub.start_date ?? sub.created) * 1000)
            out.matched += 1
            out.hits.push({
              sessionId: sub.id,
              paymentIntentId: null,
              email,
              name,
              customerId,
              productId: hit.stripe_product_id,
              priceId,
              accessDays: hit.access_days,
              purchasedAt,
            })
          } catch (err) {
            out.phaseErrors.push({
              session: sub.id,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }
        if (!list.has_more) break
        after = list.data[list.data.length - 1].id
        if (pages >= SUBS_MAX_PAGES) {
          out.capped = list.has_more
          break
        }
      }
      return out
    })(),

    // ─── Paid Invoices ─────────────────────────────────────────────
    (async (): Promise<PhaseOut> => {
      const out: PhaseOut = { hits: [], scanned: 0, matched: 0, capped: false, phaseErrors: [] }
      let after: string | undefined = undefined
      let pages = 0
      while (pages < INVOICES_MAX_PAGES) {
        const list = await stripe.invoices.list({
          limit: 100,
          starting_after: after,
          status: 'paid',
          created: { gte: since },
        })
        pages += 1
        for (const inv of list.data) {
          out.scanned += 1
          try {
            let hit: SkoolProduct | null = null
            let priceId: string | null = null
            const lines = inv.lines?.data ?? []
            for (const ln of lines) {
              const lnRaw = ln as unknown as {
                pricing?: {
                  price_details?: { product?: string | null; price?: string | null } | null
                } | null
                price?: {
                  id?: string | null
                  product?: string | { id: string; deleted?: boolean } | null
                } | null
                parent?: {
                  subscription_item_details?: { price?: string | null } | null
                  invoice_item_details?: { price?: string | null; product?: string | null } | null
                } | null
              }
              let pid: string | null = null
              let pri: string | null = null
              const pd = lnRaw.pricing?.price_details
              if (pd?.product) {
                pid = pd.product
                pri = pd.price ?? null
              }
              if (!pid && lnRaw.price) {
                const productRef = lnRaw.price.product
                pid =
                  typeof productRef === 'string'
                    ? productRef
                    : productRef && 'id' in productRef && !productRef.deleted
                    ? productRef.id
                    : null
                pri = lnRaw.price.id ?? null
              }
              if (!pid) {
                const iid = lnRaw.parent?.invoice_item_details
                if (iid?.product) {
                  pid = iid.product
                  pri = iid.price ?? null
                }
              }
              if (pid && productMap.has(pid)) {
                hit = productMap.get(pid)!
                priceId = pri
                break
              }
            }
            if (!hit) continue
            const customerId =
              typeof inv.customer === 'string'
                ? inv.customer
                : inv.customer?.id ?? null
            const email = inv.customer_email ?? null
            if (!customerId || !email) continue
            const piRaw = (inv as unknown as { payment_intent?: string | { id: string } | null })
              .payment_intent
            const paymentIntentId =
              typeof piRaw === 'string' ? piRaw : piRaw && 'id' in piRaw ? piRaw.id : null
            const paidAtUnix =
              (inv.status_transitions && inv.status_transitions.paid_at) ||
              inv.created ||
              Math.floor(Date.now() / 1000)
            const purchasedAt = new Date(paidAtUnix * 1000)
            out.matched += 1
            out.hits.push({
              sessionId: inv.id ?? `inv_${Date.now()}`,
              paymentIntentId,
              email,
              name: inv.customer_name ?? null,
              customerId,
              productId: hit.stripe_product_id,
              priceId,
              accessDays: hit.access_days,
              purchasedAt,
            })
          } catch (err) {
            out.phaseErrors.push({
              session: inv.id ?? 'unknown_invoice',
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }
        if (!list.has_more) break
        after = list.data[list.data.length - 1].id ?? undefined
        if (pages >= INVOICES_MAX_PAGES) {
          out.capped = list.has_more
          break
        }
      }
      return out
    })(),
  ])

  // Merge results in shared state
  for (const [k, v] of refundsR.map) refundsByCustomer.set(k, v)
  for (const e of refundsR.phaseErrors) errors.push(e)

  sessionsScanned = sessionsR.scanned
  sessionsMatched = sessionsR.matched
  sessionsCapped = sessionsR.capped
  for (const e of sessionsR.phaseErrors) errors.push(e)

  subsScanned = subsR.scanned
  subsMatched = subsR.matched
  subsCapped = subsR.capped
  for (const e of subsR.phaseErrors) errors.push(e)

  invScanned = invoicesR.scanned
  invMatched = invoicesR.matched
  invCapped = invoicesR.capped
  for (const e of invoicesR.phaseErrors) errors.push(e)

  // Hits in perCustomer mergen (perCustomer ist oben vor Promise.all deklariert)
  for (const hit of [...sessionsR.hits, ...subsR.hits, ...invoicesR.hits]) {
    const arr = perCustomer.get(hit.customerId) ?? []
    arr.push(hit)
    perCustomer.set(hit.customerId, arr)
  }

  // ─── Bulk-Persistenz: alle Customer-Daten in einem Schwung ──────────────
  // Vorher: pro Customer 2 DB-Calls (read + write) → bei 1500 Customers ~75s.
  // Jetzt: 1× bulk read, 1× pro 100er-Batch upsert + getrennt Plan-S-Updates.
  if (perCustomer.size > 0) {
    const customerIds = [...perCustomer.keys()]

    // Existing Members in einem Call laden
    const existingMap = new Map<
      string,
      {
        id: string
        profile_id: string | null
        skool_access_expires_at: string | null
        purchase_count: number
        source: string | null
      }
    >()
    // Supabase .in() mag Listen bis ~1000 — falls mehr, in Batches abrufen
    const READ_BATCH = 500
    for (let i = 0; i < customerIds.length; i += READ_BATCH) {
      const batch = customerIds.slice(i, i + READ_BATCH)
      const { data: rows } = await admin
        .from('community_members')
        .select('id, stripe_customer_id, profile_id, skool_access_expires_at, purchase_count, source')
        .in('stripe_customer_id', batch)
      for (const row of rows ?? []) {
        existingMap.set(row.stripe_customer_id, row)
      }
    }

    // Payloads bauen (pro Customer jüngsten Kauf bestimmt expires)
    const payloads: Array<Record<string, unknown>> = []
    const planSReactivations: Array<{ profileId: string; periodEnd: Date }> = []
    // Refund-Cases werden separat behandelt (cancel oder delete statt upsert)
    const refundCancelMemberIds: string[] = []

    for (const [customerId, hits] of perCustomer) {
      hits.sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime())
      const latest = hits[0]
      const oldest = hits[hits.length - 1]
      const newExpires = new Date(
        latest.purchasedAt.getTime() + latest.accessDays * 86400 * 1000
      )

      const refund = refundsByCustomer.get(customerId)
      const refunded = refund && refund.date > latest.purchasedAt
      const existing = existingMap.get(customerId)

      if (refunded) {
        // Refund-Case: NICHT als alumni speichern. User wollte raus.
        if (existing) {
          // In DB → cancel/delete (cancelSkoolMembership entscheidet je
          // nach claimed/nicht-claimed)
          refundCancelMemberIds.push(existing.id)
        }
        // Nicht in DB → gar nicht erst anlegen
        continue
      }

      // Normaler Fall: kein Refund, oder Refund VOR jüngstem Kauf
      // (= User hat refund bekommen, dann später wieder neu gekauft)
      const finalExpires =
        existing?.skool_access_expires_at &&
        new Date(existing.skool_access_expires_at) > newExpires
          ? new Date(existing.skool_access_expires_at)
          : newExpires
      // alumni nur durch saubere 12-Monats-Abläufe; in der Aggregation
      // zählt status='active', wenn finalExpires noch in der Zukunft liegt,
      // sonst 'alumni' (das ist dann ein echter, sauberer Ablauf).
      const status: 'active' | 'alumni' = finalExpires > new Date() ? 'active' : 'alumni'

      payloads.push({
        stripe_customer_id: customerId,
        email: latest.email.toLowerCase(),
        name: latest.name,
        skool_status: status,
        skool_access_started_at: oldest.purchasedAt.toISOString(),
        skool_access_expires_at: finalExpires.toISOString(),
        last_purchase_at: latest.purchasedAt.toISOString(),
        last_stripe_product_id: latest.productId,
        last_stripe_price_id: latest.priceId,
        last_stripe_payment_intent: latest.paymentIntentId,
        purchase_count: hits.length,
      })

      if (existing?.profile_id && status === 'active') {
        planSReactivations.push({
          profileId: existing.profile_id,
          periodEnd: finalExpires,
        })
      }
    }

    // Pre-Dedupe nach Email: ein User kann mehrere Stripe-Customer-IDs haben
    // (z.B. neue Karte → neuer Customer). Damit hätten wir mehrere Payloads
    // mit gleicher Email aber verschiedenen Customer-IDs → würde den UNIQUE-
    // Index auf lower(email) sprengen. Pro Email nur den jüngsten Kauf
    // behalten (last_purchase_at).
    const dedupedByEmail = new Map<string, (typeof payloads)[number]>()
    for (const p of payloads) {
      const email = (p.email as string).toLowerCase()
      const existing = dedupedByEmail.get(email)
      if (!existing) {
        dedupedByEmail.set(email, p)
      } else {
        const a = new Date(p.last_purchase_at as string).getTime()
        const b = new Date(existing.last_purchase_at as string).getTime()
        if (a > b) dedupedByEmail.set(email, p)
      }
    }
    const dedupedPayloads = [...dedupedByEmail.values()]

    // Email-Konflikt-Vorab-Check: gibt's existing community_members mit
    // dieser Email (ggf. anderer Customer-ID)? Dann UPDATE statt INSERT.
    const emailToExistingId = new Map<string, { id: string; profile_id: string | null }>()
    {
      const allEmails = dedupedPayloads.map((p) => (p.email as string).toLowerCase())
      const READ = 500
      for (let i = 0; i < allEmails.length; i += READ) {
        const batch = allEmails.slice(i, i + READ)
        const { data: rows } = await admin
          .from('community_members')
          .select('id, email, stripe_customer_id, profile_id')
          .in('email', batch)
        for (const r of rows ?? []) {
          emailToExistingId.set((r.email as string).toLowerCase(), {
            id: r.id as string,
            profile_id: (r.profile_id as string | null) ?? null,
          })
        }
      }
    }

    // Aufteilen: payloads die per stripe_customer_id existieren → normaler upsert.
    // Payloads ohne customer-match aber mit email-match → UPDATE per id (alten
    // Eintrag mit neuer customer_id refreshen). Komplett neue → insert via upsert.
    const upsertable: typeof payloads = []
    const emailUpdates: Array<{ id: string; payload: (typeof payloads)[number] }> = []
    for (const p of dedupedPayloads) {
      const cid = p.stripe_customer_id as string
      if (existingMap.has(cid)) {
        upsertable.push(p)
        continue
      }
      const byEmail = emailToExistingId.get((p.email as string).toLowerCase())
      if (byEmail) {
        emailUpdates.push({ id: byEmail.id, payload: p })
        continue
      }
      upsertable.push(p)
    }

    // Bulk-Upsert für non-conflicts (auf stripe_customer_id)
    const UPSERT_BATCH = 100
    for (let i = 0; i < upsertable.length; i += UPSERT_BATCH) {
      const batch = upsertable.slice(i, i + UPSERT_BATCH)
      const { error: upErr } = await admin
        .from('community_members')
        .upsert(batch, { onConflict: 'stripe_customer_id' })
      if (upErr) {
        errors.push({ error: `Bulk-Upsert: ${upErr.message}` })
      } else {
        upserted += batch.length
      }
    }

    // Email-Konflikte: per id updaten — in 50er-Batches PARALLEL
    // (sequentiell wäre bei 1000 Konflikten ~50s extra)
    const PARALLEL_UPDATE = 50
    for (let i = 0; i < emailUpdates.length; i += PARALLEL_UPDATE) {
      const slice = emailUpdates.slice(i, i + PARALLEL_UPDATE)
      const results = await Promise.all(
        slice.map(async ({ id, payload }) => {
          const { error: updErr } = await admin
            .from('community_members')
            .update(payload)
            .eq('id', id)
          return { error: updErr, email: payload.email as string }
        })
      )
      for (const r of results) {
        if (r.error) {
          errors.push({
            member: r.email,
            error: `Email-Update: ${r.error.message}`,
          })
        } else {
          upserted += 1
        }
      }
    }

    // Plan-S Reaktivierungen — parallel in 20er-Chunks (sonst Bottleneck)
    const PLAN_PARALLEL = 20
    for (let i = 0; i < planSReactivations.length; i += PLAN_PARALLEL) {
      const slice = planSReactivations.slice(i, i + PLAN_PARALLEL)
      await Promise.all(
        slice.map(async (r) => {
          try {
            await ensureSkoolPlanS(admin, r)
          } catch (err) {
            errors.push({
              member: r.profileId,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        })
      )
    }

    // Refund-Cases — parallel in 10er-Chunks (cancelSkoolMembership macht
    // intern 4-5 DB-Calls, daher kleinerer Batch)
    const CANCEL_PARALLEL = 10
    for (let i = 0; i < refundCancelMemberIds.length; i += CANCEL_PARALLEL) {
      const slice = refundCancelMemberIds.slice(i, i + CANCEL_PARALLEL)
      await Promise.all(
        slice.map(async (memberId) => {
          try {
            await cancelSkoolMembership(admin, memberId)
          } catch (err) {
            errors.push({
              member: memberId,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        })
      )
    }

    // Auto-Link wird am Ende des Syncs als Bulk-Operation ausgeführt
    // (siehe weiter unten — autoLinkAllUnclaimed deckt frisch upsertete
    // sowie Bestand ohne profile_id ab).
  }

  // ─── Refund-Cleanup: existing members mit Refund, die NICHT in perCustomer sind ──
  // Fängt alte Refund-Fälle, die zuvor fälschlich als alumni markiert wurden,
  // und Customers ohne neuen Kauf in der Lookback-Periode.
  const refundCustomerIds = [...refundsByCustomer.keys()].filter(
    (id) => !perCustomer.has(id)
  )
  let refundCleanedCount = 0
  if (refundCustomerIds.length > 0) {
    const READ_BATCH = 500
    const toCancelOrDelete: string[] = []
    for (let i = 0; i < refundCustomerIds.length; i += READ_BATCH) {
      const batch = refundCustomerIds.slice(i, i + READ_BATCH)
      const { data: rows } = await admin
        .from('community_members')
        .select('id, stripe_customer_id, last_purchase_at, skool_status')
        .in('stripe_customer_id', batch)
      for (const row of rows ?? []) {
        if (row.skool_status === 'cancelled') continue
        const refund = refundsByCustomer.get(row.stripe_customer_id as string)
        if (!refund) continue
        const lastPurchase = row.last_purchase_at
          ? new Date(row.last_purchase_at)
          : new Date(0)
        if (refund.date <= lastPurchase) continue
        toCancelOrDelete.push(row.id)
      }
    }
    // Parallel in 10er-Chunks
    const CLEAN_PARALLEL = 10
    for (let i = 0; i < toCancelOrDelete.length; i += CLEAN_PARALLEL) {
      const slice = toCancelOrDelete.slice(i, i + CLEAN_PARALLEL)
      const results = await Promise.all(
        slice.map(async (memberId) => {
          try {
            await cancelSkoolMembership(admin, memberId)
            return { ok: true as const, memberId }
          } catch (err) {
            return {
              ok: false as const,
              memberId,
              error: err instanceof Error ? err.message : String(err),
            }
          }
        })
      )
      for (const r of results) {
        if (r.ok) refundCleanedCount += 1
        else errors.push({ member: r.memberId, error: r.error })
      }
    }
  }

  // Cleanup: alle abgelaufenen aktiven auf alumni setzen
  // (NUR der saubere 12-Monats-Ablauf — Refund-Cases sind oben raus)
  const nowIso = new Date().toISOString()
  const { data: toExpire } = await admin
    .from('community_members')
    .select('id')
    .eq('skool_status', 'active')
    .lt('skool_access_expires_at', nowIso)

  let expiredCount = 0
  const toExpireList = toExpire ?? []
  const EXPIRE_PARALLEL = 10
  for (let i = 0; i < toExpireList.length; i += EXPIRE_PARALLEL) {
    const slice = toExpireList.slice(i, i + EXPIRE_PARALLEL)
    const results = await Promise.all(
      slice.map(async (m) => {
        try {
          await expireSkoolMembership(admin, m.id)
          return { ok: true as const }
        } catch (err) {
          return {
            ok: false as const,
            memberId: m.id as string,
            error: err instanceof Error ? err.message : String(err),
          }
        }
      })
    )
    for (const r of results) {
      if (r.ok) expiredCount += 1
      else errors.push({ member: r.memberId, error: r.error })
    }
  }

  // Dedupe + Auto-Link laufen jetzt im Frontend als separate API-Calls
  // nach dem Sync — verhindert Vercel-Timeout bei vielen Mitgliedern.

  return {
    scanned: sessionsScanned + subsScanned + invScanned,
    matched: sessionsMatched + subsMatched + invMatched,
    upserted,
    expired: expiredCount,
    by_phase: {
      sessions: { scanned: sessionsScanned, matched: sessionsMatched, capped: sessionsCapped },
      subscriptions: { scanned: subsScanned, matched: subsMatched, capped: subsCapped },
      invoices: { scanned: invScanned, matched: invMatched, capped: invCapped },
    },
    refunds: {
      detected: refundsByCustomer.size,
      cleaned_up: refundCleanedCount,
    },
    errors,
  }
}

/**
 * Checkout-Session auswerten: prüft ob Skool-Produkt, wenn ja → recordSkoolPurchase.
 * Rückgabe: true = Skool-Kauf verarbeitet, false = nicht unser Fall.
 *
 * Wird vom Stripe-Webhook aufgerufen. Der Webhook delegiert an diese Funktion
 * VOR der bestehenden Top-up/Abo-Logik.
 */
export async function tryHandleSkoolCheckout(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<boolean> {
  if (!isSkoolSyncEnabled()) return false
  if (session.mode !== 'payment') return false

  const productIds = await getCheckoutProductIds(session.id)
  if (productIds.length === 0) return false

  let matchedProduct: SkoolProduct | null = null
  for (const pid of productIds) {
    matchedProduct = await isSkoolProductId(admin, pid)
    if (matchedProduct) break
  }
  if (!matchedProduct) return false

  // Customer-Daten aus Session extrahieren
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? null

  if (!customerId) {
    console.warn(
      `[skool-sync] Checkout ${session.id} hat keinen Customer — kann nicht zugeordnet werden`
    )
    return true // als verarbeitet markieren, sonst retry-Loop
  }

  const email =
    session.customer_details?.email ??
    session.customer_email ??
    null

  if (!email) {
    console.warn(`[skool-sync] Checkout ${session.id} hat keine E-Mail`)
    return true
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null

  // Idempotenz: bereits verarbeitete PaymentIntents überspringen
  if (paymentIntentId) {
    const { data: existingMember } = await admin
      .from('community_members')
      .select('id')
      .eq('last_stripe_payment_intent', paymentIntentId)
      .maybeSingle()
    if (existingMember) return true
  }

  const priceId = session.line_items?.data?.[0]?.price?.id ?? null

  await recordSkoolPurchase(admin, {
    stripeCustomerId: customerId,
    email,
    name: session.customer_details?.name ?? null,
    productId: matchedProduct.stripe_product_id,
    priceId,
    paymentIntentId,
    accessDays: matchedProduct.access_days,
    purchasedAt: new Date((session.created ?? Date.now() / 1000) * 1000),
  })

  return true
}
