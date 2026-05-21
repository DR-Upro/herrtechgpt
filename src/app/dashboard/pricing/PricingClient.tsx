'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Sparkles, Loader2, AlertTriangle, Clock } from 'lucide-react'
import type { Plan } from '@/lib/types'
import type { AccessTier } from '@/lib/access'

type PriceBand = 'basic' | 'community'
type Cycle = 'monthly' | 'yearly'

interface Props {
  plans: Plan[]
  defaultPriceBand: PriceBand
  isCommunity: boolean
  accessTier: AccessTier
  currentPlanId: string | null
  currentCycle: Cycle | null
  currentPeriodEnd: string | null
  subscriptionActive: boolean
  scheduledPlanId: string | null
  scheduledCycle: Cycle | null
  scheduledChangeAt: string | null
}

function formatEuro(cents: number | null | undefined): string {
  if (cents == null) return '—'
  const euro = cents / 100
  return euro % 1 === 0 ? `${euro}` : euro.toFixed(2).replace('.', ',')
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function centsFor(plan: Plan, cycle: Cycle, band: PriceBand): number | null {
  if (cycle === 'yearly') {
    return band === 'community' ? plan.price_yearly_community_cents : plan.price_yearly_basic_cents
  }
  return band === 'community' ? plan.price_community_cents : plan.price_basic_cents
}

export default function PricingClient({
  plans,
  defaultPriceBand,
  isCommunity,
  accessTier,
  currentPlanId,
  currentCycle,
  currentPeriodEnd,
  subscriptionActive,
  scheduledPlanId,
  scheduledCycle,
  scheduledChangeAt,
}: Props) {
  const router = useRouter()
  const [cycle, setCycle] = useState<Cycle>(currentCycle ?? 'monthly')
  const [priceBand, setPriceBand] = useState<PriceBand>(defaultPriceBand)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{
    planId: string
    action: 'upgrade' | 'downgrade'
    newCents: number | null
    currentCents: number | null
  } | null>(null)
  const [successInfo, setSuccessInfo] = useState<string | null>(null)

  const currentPlan = currentPlanId ? plans.find((p) => p.id === currentPlanId) ?? null : null
  const currentCentsRaw = currentPlan && currentCycle
    ? centsFor(currentPlan, currentCycle, priceBand)
    : null

  async function startCheckout(planId: string) {
    setLoadingPlan(planId)
    setError(null)
    try {
      const res = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, cycle }),
      })
      const text = await res.text()
      let data: { url?: string; error?: string } = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        throw new Error(
          `Server hat keine gültige Antwort geschickt (Status ${res.status}). Nochmal probieren.`
        )
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Checkout konnte nicht gestartet werden')
      }
      window.location.href = data.url as string
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLoadingPlan(null)
    }
  }

  async function changePlan(planId: string) {
    setLoadingPlan(planId)
    setError(null)
    setSuccessInfo(null)
    try {
      const res = await fetch('/api/subscriptions/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, cycle }),
      })
      const text = await res.text()
      let data: {
        ok?: boolean
        action?: string
        effectiveAt?: string
        url?: string
        error?: string
      } = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        throw new Error(`Server-Fehler (${res.status}). Nochmal probieren.`)
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Plan-Wechsel fehlgeschlagen')
      }
      // Upgrade läuft jetzt über Stripe Customer Portal — User sieht Proration,
      // hinterlegte Karte, "Confirm"/"Cancel". Bei Cancel oder Fehler bleibt
      // alter Plan aktiv.
      if (data.action === 'upgrade_portal' && data.url) {
        window.location.href = data.url
        return
      }
      if (data.action === 'downgrade_scheduled') {
        setSuccessInfo(
          `Downgrade für ${formatDate(data.effectiveAt ?? null)} geplant. Bis dahin behältst du deinen aktuellen Plan.`
        )
      } else if (data.action === 'scheduled_change_released') {
        setSuccessInfo('Geplanter Wechsel wurde aufgehoben.')
      }
      setConfirming(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingPlan(null)
    }
  }

  function handleSelectPlan(plan: Plan) {
    setError(null)
    setSuccessInfo(null)
    const newCents = centsFor(plan, cycle, priceBand)

    if (!subscriptionActive) {
      startCheckout(plan.id)
      return
    }

    // Aktives Abo → Change-Flow. Confirm-Dialog mit passender Message.
    const action: 'upgrade' | 'downgrade' =
      newCents != null && currentCentsRaw != null && newCents > currentCentsRaw
        ? 'upgrade'
        : 'downgrade'
    setConfirming({ planId: plan.id, action, newCents, currentCents: currentCentsRaw })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
          Wähle deinen Plan
        </h1>
        <p className="text-muted max-w-2xl mx-auto">
          Voller Zugriff auf UPRO AI Lab + KI Toolbox. Credits für jede Aktion,
          monatlich oder jährlich — jederzeit kündbar.
        </p>
      </div>

      {isCommunity && (
        <div className="max-w-2xl mx-auto mb-6 flex items-center gap-2 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5">
          <Sparkles size={18} className="text-primary shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">KI Marketing Club Mitglied:</span>{' '}
            Du zahlst die günstigeren Community-Preise. Plan S ist für dich kostenlos
            enthalten.
          </p>
        </div>
      )}

      {/* Geplanter Wechsel */}
      {scheduledPlanId && scheduledChangeAt && (
        <div className="max-w-2xl mx-auto mb-6 flex items-start gap-2 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">Geplanter Wechsel:</span> Ab{' '}
            {formatDate(scheduledChangeAt)} wechselst du zu{' '}
            <strong>
              {plans.find((p) => p.id === scheduledPlanId)?.name ?? scheduledPlanId}
            </strong>
            {scheduledCycle ? ` (${scheduledCycle === 'yearly' ? 'jährlich' : 'monatlich'})` : ''}.
            Um den Wechsel zu stornieren, wähle deinen aktuellen Plan erneut.
          </p>
        </div>
      )}

      {/* Toggles */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-secondary border border-border">
          <button
            onClick={() => setCycle('monthly')}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              cycle === 'monthly'
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            Monatlich
          </button>
          <button
            onClick={() => setCycle('yearly')}
            className={`relative px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              cycle === 'yearly'
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            Jährlich
            <span className="absolute -top-2 -right-2 text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
              1 Monat gratis
            </span>
          </button>
        </div>

        {isCommunity && (
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-secondary border border-border">
            <button
              onClick={() => setPriceBand('basic')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                priceBand === 'basic'
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
              title="Als ob du kein Community-Mitglied wärst (zum Vergleich)"
            >
              Basic-Preise
            </button>
            <button
              onClick={() => setPriceBand('community')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                priceBand === 'community'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              Community-Preise
            </button>
          </div>
        )}
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        {plans.map((plan, idx) => {
          const isCurrent = currentPlanId === plan.id && currentCycle === cycle
          const basicCents =
            cycle === 'yearly' ? plan.price_yearly_basic_cents : plan.price_basic_cents
          const communityCents =
            cycle === 'yearly'
              ? plan.price_yearly_community_cents
              : plan.price_community_cents
          const displayCents = priceBand === 'community' ? communityCents : basicCents
          const showStrikethrough =
            priceBand === 'community' &&
            basicCents != null &&
            communityCents != null &&
            basicCents > communityCents
          const yearlyMissing = cycle === 'yearly' && displayCents == null
          const isFree = displayCents === 0
          const featured = idx === 1

          // Button-Label bei aktivem Abo abhängig von Upgrade/Downgrade
          let changeLabel = 'Auswählen'
          if (subscriptionActive && !isCurrent && currentCentsRaw != null && displayCents != null) {
            if (displayCents > currentCentsRaw) {
              changeLabel = 'Upgraden'
            } else if (displayCents < currentCentsRaw) {
              changeLabel = `Zum ${formatDate(currentPeriodEnd)} wechseln`
            } else {
              // Gleicher Preis, aber anderer Cycle oder Plan (selten)
              changeLabel = cycle !== currentCycle ? 'Abrechnungsrhythmus wechseln' : 'Wechseln'
            }
          }

          const isScheduledTarget =
            scheduledPlanId === plan.id && scheduledCycle === cycle

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 flex flex-col ${
                featured
                  ? 'border-2 border-primary bg-surface shadow-lg'
                  : 'border border-border bg-surface'
              }`}
            >
              {featured && !isScheduledTarget && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Beliebteste Wahl
                </div>
              )}
              {isScheduledTarget && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Ab {formatDate(scheduledChangeAt)}
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary font-bold">
                    {plan.tier}
                  </span>
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                </div>
                {plan.description && (
                  <p className="text-sm text-muted leading-relaxed">{plan.description}</p>
                )}
              </div>

              <div className="mb-5">
                {yearlyMissing ? (
                  <div className="text-sm text-muted italic">Jährlich nicht verfügbar</div>
                ) : isFree ? (
                  <div>
                    <div className="text-3xl font-bold text-primary">Kostenlos</div>
                    <div className="text-xs text-muted">
                      als Community-Mitglied inklusive
                    </div>
                  </div>
                ) : (
                  <div>
                    {showStrikethrough && (
                      <div className="text-sm text-muted line-through">
                        {formatEuro(basicCents)} € {cycle === 'yearly' ? '/ Jahr' : '/ Monat'}
                      </div>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">
                        {formatEuro(displayCents)}
                      </span>
                      <span className="text-sm text-muted">€</span>
                      <span className="text-sm text-muted ml-1">
                        / {cycle === 'yearly' ? 'Jahr' : 'Monat'}
                      </span>
                    </div>
                    {cycle === 'yearly' && (
                      <div className="text-xs text-muted mt-0.5">
                        Entspricht {formatEuro(Math.round((displayCents ?? 0) / 12))} € / Monat
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-5 pb-5 border-b border-border">
                <div className="text-xs uppercase tracking-wider text-muted mb-1">Credits</div>
                <div className="text-xl font-semibold text-foreground">
                  {plan.credits_per_month.toLocaleString('de-DE')}{' '}
                  <span className="text-sm font-normal text-muted">/ Monat</span>
                </div>
              </div>

              {plan.features.length > 0 && (
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f: string) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <Check size={16} className="text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}

              {isCurrent ? (
                <div className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl border border-border text-muted text-center">
                  ✓ Aktueller Plan
                </div>
              ) : yearlyMissing ? (
                <button
                  disabled
                  className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl bg-muted/20 text-muted cursor-not-allowed"
                >
                  Nicht verfügbar
                </button>
              ) : (
                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={loadingPlan === plan.id}
                  className={`w-full px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                    featured
                      ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
                      : 'border border-border text-foreground hover:border-primary hover:text-primary'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Lade…
                    </>
                  ) : subscriptionActive ? (
                    changeLabel
                  ) : isFree ? (
                    'Aktivieren'
                  ) : (
                    'Auswählen'
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="max-w-xl mx-auto mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-600">
          {error}
        </div>
      )}
      {successInfo && (
        <div className="max-w-xl mx-auto mb-6 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-sm text-green-700 dark:text-green-400">
          {successInfo}
        </div>
      )}

      {/* Community-Upsell */}
      {!isCommunity && (
        <div className="max-w-3xl mx-auto rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={18} className="text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Noch günstiger mit KI Marketing Club
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            Community-Mitglieder sparen bis zu 30 % — und mehr
          </h2>
          <p className="text-sm text-muted mb-4 leading-relaxed">
            Als KI Marketing Club Mitglied bekommst du Plan S kostenlos, alle anderen
            Abos deutlich günstiger, plus:
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {[
              'Live-Calls mit UPRO AI Lab',
              'Alle Lernmaterialien freigeschaltet',
              'Community-Zugang (Fragen & Feedback)',
              'Frühzeitiger Zugriff auf neue Features',
            ].map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                <Check size={14} className="text-primary shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/upgrade"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold rounded-xl text-sm transition-colors"
          >
            KI Marketing Club entdecken →
          </Link>
          <div className="text-xs text-muted mt-3">
            {accessTier === 'alumni'
              ? 'Als Alumni hast du lebenslangen Classroom-Zugang — mit Club-Mitgliedschaft wieder alle Tools + Live-Calls.'
              : 'Ideal wenn du nicht nur Tools, sondern auch das komplette Know-how + persönlichen Austausch willst.'}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto text-center text-xs text-muted space-y-1">
        <p>
          Alle Preise inkl. USt. Abos laufen monatlich oder jährlich und können jederzeit
          zum Periodenende gekündigt werden.
        </p>
        <p>
          Credits im Monatsabo verfallen am Reset-Tag. Gekaufte Zusatz-Credits sind 12
          Monate gültig.
        </p>
      </div>

      {/* Confirmation Modal für Plan-Change */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle
                className={
                  confirming.action === 'upgrade' ? 'text-primary shrink-0' : 'text-amber-500 shrink-0'
                }
                size={24}
              />
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {confirming.action === 'upgrade'
                    ? 'Plan upgraden?'
                    : 'Plan-Wechsel planen?'}
                </h3>
                <p className="text-sm text-muted mt-2 leading-relaxed">
                  {confirming.action === 'upgrade' ? (
                    <>
                      Du wirst zu <strong>Stripe</strong> weitergeleitet. Dort siehst du
                      den genauen Betrag, der heute fällig wird (Rest des aktuellen Zeitraums
                      wird angerechnet), und deine hinterlegte Zahlungsmethode. Du kannst dort
                      bestätigen oder abbrechen — bei Abbruch bleibt dein aktueller Plan
                      aktiv.
                    </>
                  ) : (
                    <>
                      Dein aktueller Plan läuft bis{' '}
                      <strong>{formatDate(currentPeriodEnd)}</strong>. Ab dann wird
                      automatisch auf den neuen, günstigeren Plan gewechselt. Bis dahin
                      behältst du alle aktuellen Credits und Features.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirming(null)}
                className="px-4 py-2 border border-border text-foreground rounded-xl text-sm hover:border-primary transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => changePlan(confirming.planId)}
                disabled={loadingPlan === confirming.planId}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
              >
                {loadingPlan === confirming.planId && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                {confirming.action === 'upgrade' ? 'Weiter zu Stripe' : 'Wechsel planen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
