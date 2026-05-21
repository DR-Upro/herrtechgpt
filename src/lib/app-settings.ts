/**
 * App-Settings — Typsicherer Zugriff auf globale Plattform-Konfiguration.
 *
 * Single source of truth: Tabelle `app_settings` (key/value-jsonb).
 * Defaults sind hier als Fallback definiert — falls Setting in DB fehlt
 * oder Lesefehler auftritt, wird der Default zurückgegeben (kein Crash).
 *
 * Lesen erfolgt mit service_role-Client (Admin), weil Settings in
 * Server-Components/API-Routes gebraucht werden, die nicht zwingend
 * authentifizierte User haben.
 *
 * Verwendung:
 *   import { getAppSettings } from '@/lib/app-settings'
 *   const settings = await getAppSettings()
 *   if (!settings.subscriptionsEnabled) { ... }
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ─── Typen ─────────────────────────────────────────────────────────

export interface AppSettings {
  /** Sind Abo-Pläne (S/M/L) im Frontend buchbar? */
  subscriptionsEnabled: boolean
  /** Credits/Monat für Community-Mitglieder (Fallback wenn subs aus). */
  communityMonthlyCredits: number
  /** Test-Credits beim Kauf des kleinen Pakets (Funnel-Einstieg). */
  starterTestCredits: number
  /** URL der Community (heute Skool) — wird auf allen "Community beitreten"-CTAs verlinkt. */
  communityUrl: string
}

export const APP_SETTINGS_DEFAULTS: AppSettings = {
  subscriptionsEnabled: false,
  communityMonthlyCredits: 200,
  starterTestCredits: 0,
  communityUrl: 'https://www.skool.com/dein-community-slug',
}

// Mapping: TS-Camel → DB-Snake-Key
export const SETTING_KEYS = {
  subscriptionsEnabled: 'subscriptions_enabled',
  communityMonthlyCredits: 'community_monthly_credits',
  starterTestCredits: 'starter_test_credits',
  communityUrl: 'community_url',
} as const satisfies Record<keyof AppSettings, string>

// Reverse-Lookup für API-Validierung
export const SETTING_KEYS_DB_TO_CAMEL: Record<string, keyof AppSettings> = Object.fromEntries(
  Object.entries(SETTING_KEYS).map(([camel, db]) => [db, camel as keyof AppSettings])
)

// ─── Lesen ─────────────────────────────────────────────────────────

/**
 * Lädt alle App-Settings aus der DB. Werte werden mit Defaults gemerged —
 * fehlende Keys oder Lesefehler führen NIE zu undefined, sondern zum Default.
 *
 * Spezialfall communityUrl: Quelle ist NICHT mehr app_settings, sondern
 * tier_upsell_copy.cta_url WHERE tier='premium' — der "Zur Community"-CTA
 * den der Admin im Upsell-Tab pflegt. So gibt es nur EINEN Ort an dem die
 * Skool-/Community-URL editiert wird (Jacobs W12-Wunsch).
 * Fallback-Reihenfolge: tier_upsell_copy.premium.cta_url → app_settings →
 * Code-Default.
 */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const admin = createAdminClient()
    const [{ data, error }, { data: upsell }] = await Promise.all([
      admin.from('app_settings').select('key, value'),
      admin
        .from('tier_upsell_copy')
        .select('cta_url')
        .eq('tier', 'premium')
        .maybeSingle(),
    ])

    if (error || !data) {
      console.error('[app-settings] Lesefehler — verwende Defaults:', error)
      return { ...APP_SETTINGS_DEFAULTS }
    }

    const result: AppSettings = { ...APP_SETTINGS_DEFAULTS }
    for (const row of data) {
      const camelKey = SETTING_KEYS_DB_TO_CAMEL[row.key]
      if (!camelKey) continue // Unbekannter Key — ignorieren

      const value = row.value
      // Typ-Coercion mit Validierung. JSONB kann alles sein, wir wollen
      // sicher den richtigen Typ haben. Bei Mismatch → Default behalten.
      if (camelKey === 'subscriptionsEnabled' && typeof value === 'boolean') {
        result.subscriptionsEnabled = value
      } else if (camelKey === 'communityMonthlyCredits' && typeof value === 'number') {
        result.communityMonthlyCredits = Math.max(0, Math.floor(value))
      } else if (camelKey === 'starterTestCredits' && typeof value === 'number') {
        result.starterTestCredits = Math.max(0, Math.floor(value))
      } else if (camelKey === 'communityUrl' && typeof value === 'string') {
        // app_settings.community_url als Fallback. Wird gleich von der
        // tier_upsell_copy-Quelle überschrieben falls vorhanden.
        if (value.trim().length > 0) result.communityUrl = value.trim()
      }
    }

    // tier_upsell_copy.premium.cta_url als finale Quelle für communityUrl
    // — überschreibt app_settings + Default. So pflegt der Admin nur an
    // einer Stelle (/admin/groups → Upsell-Texte → Community-Card → CTA-URL).
    const upsellUrl = upsell?.cta_url
    if (typeof upsellUrl === 'string' && upsellUrl.trim().length > 0) {
      result.communityUrl = upsellUrl.trim()
    }

    return result
  } catch (err) {
    console.error('[app-settings] Unerwarteter Fehler — verwende Defaults:', err)
    return { ...APP_SETTINGS_DEFAULTS }
  }
}

/**
 * Lädt einen einzelnen Setting-Wert. Convenience-Wrapper.
 */
export async function getAppSetting<K extends keyof AppSettings>(
  key: K
): Promise<AppSettings[K]> {
  const all = await getAppSettings()
  return all[key]
}

// ─── Schreiben ─────────────────────────────────────────────────────

/**
 * Schreibt ein einzelnes Setting. Validiert Key + Typ. Aufrufer muss
 * Admin-Berechtigung selbst prüfen (RLS schützt zusätzlich).
 */
export async function setAppSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
  userId?: string
): Promise<void> {
  const admin = createAdminClient()
  const dbKey = SETTING_KEYS[key]

  const { error } = await admin
    .from('app_settings')
    .upsert(
      {
        key: dbKey,
        value: value as unknown as object, // jsonb akzeptiert alles
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )

  if (error) {
    throw new Error(`Setting '${dbKey}' konnte nicht gespeichert werden: ${error.message}`)
  }
}
