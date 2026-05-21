import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccessTier } from './access'
import { getAppSettings } from './app-settings'

export type FeatureKey = 'classroom' | 'chat' | 'toolbox' | 'learning_path'
export type FeatureState = 'open' | 'coming_soon' | 'community' | 'paid'

export const FEATURES: FeatureKey[] = ['classroom', 'chat', 'toolbox', 'learning_path']
export const STATES: FeatureState[] = ['open', 'coming_soon', 'community', 'paid']
export const TIERS: AccessTier[] = ['basic', 'alumni', 'premium']

export const FEATURE_LABELS: Record<FeatureKey, { label: string; emoji: string }> = {
  classroom:     { label: 'Classroom', emoji: '🎓' },
  chat:          { label: 'UPRO AI Lab', emoji: '🤖' },
  toolbox:       { label: 'KI Toolbox', emoji: '🔧' },
  learning_path: { label: 'Lernpfad', emoji: '🎯' },
}

export const STATE_META: Record<FeatureState, { label: string; hint: string; badge: string }> = {
  open:        { label: 'Freigeschaltet',  hint: 'Voller Zugriff, keine Paywall',          badge: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' },
  coming_soon: { label: 'Coming Soon',     hint: 'Sichtbar, noch nicht nutzbar',           badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  community:   { label: 'Community-only',  hint: 'Nur für KI Marketing Club Mitglieder',   badge: 'bg-primary/10 text-primary' },
  paid:        { label: 'Abo-Zugriff',     hint: 'Seite sichtbar, Aktionen brauchen Abo',  badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' },
}

export const TIER_META: Record<AccessTier, { label: string; hint: string; dot: string }> = {
  basic:   { label: 'Basic (Free)',       hint: 'Neue User ohne Mitgliedschaft',  dot: 'bg-muted' },
  alumni:  { label: 'Alumni',             hint: 'Ehemalige Mitglieder',           dot: 'bg-amber-500' },
  premium: { label: 'Community (Premium)',hint: 'Aktive KI Marketing Club Mitglieder', dot: 'bg-green-500' },
}

export interface UpsellCopy {
  tier: AccessTier
  heading: string
  intro: string
  benefits: string[]
  cta_label: string
  cta_coming_soon: boolean
  cta_url: string | null
}

export type PermissionMatrix = Record<AccessTier, Record<FeatureKey, FeatureState>>

// ─── Defaults im Abo-Modell (Legacy / wenn subscriptions_enabled=true) ───
const DEFAULT_MATRIX_LEGACY: PermissionMatrix = {
  basic:   { classroom: 'community',   chat: 'paid', toolbox: 'paid', learning_path: 'open' },
  alumni:  { classroom: 'open',        chat: 'paid', toolbox: 'paid', learning_path: 'open' },
  premium: { classroom: 'open',        chat: 'paid', toolbox: 'paid', learning_path: 'open' },
}

// ─── Defaults im Community-only Modell (subscriptions_enabled=false) ───
// Jacob (W11): Lernpfad ist standardmäßig nur für premium, basic+alumni
// sehen die Kachel nicht. Admin kann das via Gruppen & Rechte überschreiben.
const DEFAULT_MATRIX_NOSUBS: PermissionMatrix = {
  basic:   { classroom: 'community',   chat: 'community', toolbox: 'community', learning_path: 'community' },
  alumni:  { classroom: 'community',   chat: 'community', toolbox: 'open',      learning_path: 'community' },
  premium: { classroom: 'open',        chat: 'open',      toolbox: 'open',      learning_path: 'open' },
}

// Backwards-compat Alias (alter Name, falls woanders importiert).
const DEFAULT_MATRIX = DEFAULT_MATRIX_LEGACY

const DEFAULT_UPSELL: Record<AccessTier, UpsellCopy> = {
  basic: {
    tier: 'basic',
    heading: 'Alles freischalten — im KI Marketing Club',
    intro: 'Werde Teil der Community.',
    benefits: [],
    cta_label: 'Jetzt beitreten',
    cta_coming_soon: true,
    cta_url: 'https://www.skool.com/dein-community-slug',
  },
  alumni: {
    tier: 'alumni',
    heading: 'Komm zurück in den KI Marketing Club',
    intro: 'Reaktiviere deine Mitgliedschaft.',
    benefits: [],
    cta_label: 'Mitgliedschaft reaktivieren',
    cta_coming_soon: true,
    cta_url: 'https://www.skool.com/dein-community-slug',
  },
  premium: {
    tier: 'premium',
    heading: 'KI Marketing Club',
    intro: 'Du hast vollen Zugriff.',
    benefits: [],
    cta_label: 'Zur Community',
    cta_coming_soon: false,
    cta_url: 'https://www.skool.com/dein-community-slug',
  },
}

export async function getPermissionMatrix(supabase: SupabaseClient): Promise<PermissionMatrix> {
  // Defaults wählen je nach Modus, dann DB-Overrides aus feature_permissions
  // drauflegen. So kann Admin via "Gruppen & Rechte" einzelne Felder
  // anpassen — funktioniert in beiden Modi.
  const settings = await getAppSettings()
  const defaults = settings.subscriptionsEnabled
    ? DEFAULT_MATRIX_LEGACY
    : DEFAULT_MATRIX_NOSUBS

  const matrix: PermissionMatrix = JSON.parse(JSON.stringify(defaults))
  const { data } = await supabase.from('feature_permissions').select('tier, feature, state')
  for (const row of data ?? []) {
    const t = row.tier as AccessTier
    const f = row.feature as FeatureKey
    const s = row.state as FeatureState
    // In NoSubs-Welt ist 'paid' kein gültiger State — der Begriff "Abo"
    // existiert nicht mehr. Solche Legacy-DB-Werte ignorieren wir, der
    // NoSubs-Default greift dann (basic.toolbox=community,
    // alumni.toolbox=open, premium.toolbox=open). Bei Re-Aktivierung
    // (subs back on) leben die DB-Werte wieder weiter.
    if (!settings.subscriptionsEnabled && s === 'paid') continue
    if (matrix[t] && FEATURES.includes(f)) matrix[t][f] = s
  }
  return matrix
}

export async function getFeatureState(
  supabase: SupabaseClient,
  tier: AccessTier,
  feature: FeatureKey,
): Promise<FeatureState> {
  const settings = await getAppSettings()
  const defaults = settings.subscriptionsEnabled
    ? DEFAULT_MATRIX_LEGACY
    : DEFAULT_MATRIX_NOSUBS

  const { data } = await supabase
    .from('feature_permissions')
    .select('state')
    .eq('tier', tier)
    .eq('feature', feature)
    .maybeSingle()
  const dbState = data?.state as FeatureState | undefined
  // 'paid' in NoSubs-Welt → ignorieren (siehe getPermissionMatrix-Comment)
  if (!settings.subscriptionsEnabled && dbState === 'paid') {
    return defaults[tier][feature]
  }
  return dbState ?? defaults[tier][feature]
}

export async function getAllUpsellCopy(supabase: SupabaseClient): Promise<Record<AccessTier, UpsellCopy>> {
  const copies: Record<AccessTier, UpsellCopy> = JSON.parse(JSON.stringify(DEFAULT_UPSELL))
  const { data } = await supabase.from('tier_upsell_copy').select('*')
  for (const row of data ?? []) {
    const t = row.tier as AccessTier
    if (!copies[t]) continue
    copies[t] = {
      tier: t,
      heading: row.heading ?? copies[t].heading,
      intro: row.intro ?? copies[t].intro,
      benefits: Array.isArray(row.benefits) ? row.benefits : copies[t].benefits,
      cta_label: row.cta_label ?? copies[t].cta_label,
      cta_coming_soon: row.cta_coming_soon ?? copies[t].cta_coming_soon,
      cta_url: row.cta_url ?? copies[t].cta_url,
    }
  }
  return copies
}

export async function getUpsellCopy(supabase: SupabaseClient, tier: AccessTier): Promise<UpsellCopy> {
  const { data } = await supabase.from('tier_upsell_copy').select('*').eq('tier', tier).maybeSingle()
  if (!data) return DEFAULT_UPSELL[tier]
  return {
    tier,
    heading: data.heading ?? DEFAULT_UPSELL[tier].heading,
    intro: data.intro ?? DEFAULT_UPSELL[tier].intro,
    benefits: Array.isArray(data.benefits) ? data.benefits : [],
    cta_label: data.cta_label ?? 'Jetzt beitreten',
    cta_coming_soon: data.cta_coming_soon ?? true,
    cta_url: data.cta_url ?? null,
  }
}

// Admin bypass: echte Admins können immer alles
export function canAccessFeature(state: FeatureState, isAdmin: boolean): boolean {
  if (isAdmin) return true
  // 'paid' = Abo-Zugriff → Seite sichtbar, UI-Gate übernimmt die Aktions-Sperre
  return state === 'open' || state === 'coming_soon' || state === 'paid'
}

// Middleware-Gate: blockiert nur community (Tier-basiert). 'paid' wird NICHT
// blockiert — User kommt rein, sieht UI, die einzelnen Send/Generate-Buttons
// sind per Subscription-Gate im Client+Backend gesperrt.
export function requiresUpgrade(state: FeatureState): boolean {
  return state === 'community'
}
