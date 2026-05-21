'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Coins, Loader2, CheckCircle2, ArrowLeft, ShieldCheck } from 'lucide-react'
import type { CreditPack } from '@/lib/types'

type PriceBand = 'basic' | 'community'

interface Props {
  packs: CreditPack[]
  priceBand: PriceBand
  isCommunity: boolean
  currentBalance: number
  hasSubscription: boolean
  checkoutStatus: string | null
  /** Master-Switch — versteckt Hinweis auf Starter-Plan in NoSubs-Welt. */
  subscriptionsEnabled: boolean
  /** Admin-only Self-Service-Block für Test-Credits. */
  isAdmin?: boolean
  userId?: string
}

function formatEuro(cents: number): string {
  const euro = cents / 100
  return euro % 1 === 0 ? `${euro}` : euro.toFixed(2).replace('.', ',')
}

export default function CreditsClient({
  packs,
  priceBand,
  isCommunity,
  currentBalance,
  hasSubscription,
  checkoutStatus,
  subscriptionsEnabled,
  isAdmin = false,
  userId,
}: Props) {
  const [loadingPack, setLoadingPack] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Admin-only Self-Service Test-Credits
  const [adminBalance, setAdminBalance] = useState<number>(currentBalance)
  const [adminAmount, setAdminAmount] = useState('100')
  const [adminBusy, setAdminBusy] = useState(false)
  const [adminMsg, setAdminMsg] = useState<string | null>(null)

  async function adjustCredits(action: 'add' | 'set', amount: number) {
    if (!isAdmin || !userId) return
    setAdminBusy(true)
    setAdminMsg(null)
    try {
      const res = await fetch('/api/admin/users/credits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, amount, note: 'Self-Service via Mitgliedschaft & Credits' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAdminMsg(data.error ?? 'Fehler beim Anpassen')
      } else {
        setAdminBalance(data.total)
        const sign = data.delta > 0 ? '+' : ''
        setAdminMsg(`OK — ${sign}${data.delta} Credits (neu: ${data.total})`)
      }
    } catch (e) {
      setAdminMsg(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setAdminBusy(false)
    }
  }

  async function startCheckout(packId: string) {
    setLoadingPack(packId)
    setError(null)
    try {
      const res = await fetch('/api/checkout/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })
      const text = await res.text()
      let data: { url?: string; error?: string } = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        throw new Error(`Server-Fehler (${res.status}). Nochmal probieren.`)
      }
      if (!res.ok || !data.url) throw new Error(data.error || 'Checkout nicht möglich')
      window.location.href = data.url as string
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLoadingPack(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href="/dashboard/account/billing"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-4"
      >
        <ArrowLeft size={14} /> Zurück zur Abrechnung
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Credits nachkaufen</h1>
        <p className="text-sm text-muted">
          Monatliche Credits verbraucht? Hier kannst du zusätzliche Credits buchen —
          sie rollieren unbegrenzt und bleiben erhalten bis du sie nutzt.
        </p>
      </div>

      {checkoutStatus === 'success' && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30 mb-6">
          <CheckCircle2 className="text-green-600 shrink-0" size={20} />
          <div>
            <div className="font-semibold text-foreground">Kauf erfolgreich!</div>
            <div className="text-sm text-muted">
              Deine Credits werden in wenigen Sekunden gutgeschrieben. Lade die Seite
              dann nochmal.
            </div>
          </div>
        </div>
      )}

      {/* Aktueller Stand */}
      <div className="rounded-2xl border border-border bg-surface p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Coins size={20} className="text-primary" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Aktueller Stand</div>
            <div className="text-2xl font-bold text-foreground">
              {currentBalance.toLocaleString('de-DE')}{' '}
              <span className="text-sm font-normal text-muted">Credits</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hinweis auf Starter-Plan nur in der Legacy-Subs-Welt — in der
          NoSubs-Welt ist der "Plan"-Begriff nicht mehr relevant. */}
      {subscriptionsEnabled && !hasSubscription && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 mb-6 text-sm">
          <strong className="text-foreground">Hinweis:</strong>{' '}
          <span className="text-muted">
            Du kannst Credits auch ohne Abo kaufen, aber um UPRO AI Lab + KI Toolbox zu
            nutzen brauchst du mindestens den <Link href="/dashboard/pricing" className="text-primary hover:underline">Starter-Plan</Link>.
          </span>
        </div>
      )}

      {/* Pack-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {packs.map((pack, idx) => {
          const basicCents = pack.price_basic_cents
          const communityCents = pack.price_community_cents
          const displayCents = priceBand === 'community' ? communityCents : basicCents
          const pricePerCredit = pack.credits > 0 ? displayCents / pack.credits : 0
          const showStrike = priceBand === 'community' && basicCents > communityCents
          const featured = idx === 1 // mittleres Pack

          return (
            <div
              key={pack.id}
              className={`rounded-2xl p-5 flex flex-col ${
                featured
                  ? 'border-2 border-primary bg-surface'
                  : 'border border-border bg-surface'
              }`}
            >
              <div className="mb-3">
                <div className="text-xl font-bold text-foreground">
                  {pack.credits.toLocaleString('de-DE')}
                  <span className="text-sm font-normal text-muted ml-1">Credits</span>
                </div>
                <div className="text-xs text-muted mt-0.5">
                  rolliert unbegrenzt
                </div>
              </div>

              <div className="mb-5">
                {showStrike && (
                  <div className="text-xs text-muted line-through">
                    {formatEuro(basicCents)} €
                  </div>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">
                    {formatEuro(displayCents)}
                  </span>
                  <span className="text-sm text-muted">€</span>
                </div>
                <div className="text-xs text-muted mt-0.5">
                  ≈ {pricePerCredit.toFixed(1)} ct / Credit
                </div>
              </div>

              <button
                onClick={() => startCheckout(pack.id)}
                disabled={loadingPack === pack.id}
                className={`w-full px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2 mt-auto ${
                  featured
                    ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
                    : 'border border-border text-foreground hover:border-primary hover:text-primary'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loadingPack === pack.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Lade…
                  </>
                ) : (
                  'Kaufen'
                )}
              </button>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-600 mb-6">
          {error}
        </div>
      )}

      {/* Admin: Test-Credits — Self-Service nur für echte Admins */}
      {isAdmin && (
        <div className="rounded-2xl border border-primary/30 bg-surface p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" />
            Admin: Test-Credits
          </h2>
          <p className="text-xs text-muted mb-4">
            Nur für dich als Admin sichtbar. Weise dir Credits zu (oder zieh sie ab),
            um die Toolbox zu testen — wird in <code className="text-[10px]">credit_transactions</code> als{' '}
            <code className="text-[10px]">admin_adjust</code> geloggt.
          </p>

          <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-secondary rounded-xl mb-4">
            <Coins size={16} className="text-primary" />
            <div className="flex-1 text-sm text-foreground">
              <span className="font-semibold">{adminBalance.toLocaleString('de-DE')} Credits</span>
              <span className="text-xs text-muted ml-2">(purchased_balance wird verändert)</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {[100, 500, 1000, 5000].map((n) => (
              <button
                key={n}
                onClick={() => adjustCredits('add', n)}
                disabled={adminBusy}
                className="text-xs px-3 py-1.5 border border-primary/40 text-primary rounded-md hover:bg-primary/10 disabled:opacity-30"
              >
                +{n}
              </button>
            ))}
            <button
              onClick={() => adjustCredits('set', 0)}
              disabled={adminBusy}
              className="text-xs px-3 py-1.5 border border-border text-muted rounded-md hover:bg-surface-secondary disabled:opacity-30"
            >
              Auf 0 setzen
            </button>
          </div>

          <div className="flex items-stretch gap-2 mb-2">
            <input
              type="number"
              value={adminAmount}
              onChange={(e) => setAdminAmount(e.target.value)}
              placeholder="z.B. 250 oder -50"
              className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={() => {
                const n = Number(adminAmount)
                if (Number.isFinite(n) && n !== 0) adjustCredits('add', n)
              }}
              disabled={adminBusy || !Number.isFinite(Number(adminAmount))}
              className="text-xs px-3 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-30"
            >
              Addieren
            </button>
            <button
              onClick={() => {
                const n = Number(adminAmount)
                if (Number.isFinite(n) && n >= 0) adjustCredits('set', n)
              }}
              disabled={adminBusy || !Number.isFinite(Number(adminAmount)) || Number(adminAmount) < 0}
              className="text-xs px-3 py-2 border border-border text-foreground rounded-md hover:bg-surface-secondary disabled:opacity-30"
            >
              Setzen
            </button>
          </div>
          {adminMsg && <p className="text-xs text-muted">{adminBusy ? 'Läuft…' : adminMsg}</p>}
        </div>
      )}

      {/* Community-Hinweis nur in Legacy-Subs-Welt (Community-Preise vs Basic-Preise).
          In NoSubs-Welt ist Credit-Pack-Kauf für basic-User eh blockiert (CommunityRequiredView),
          alumni + premium sehen die richtigen Preise schon. */}
      {subscriptionsEnabled && !isCommunity && (
        <div className="text-center text-xs text-muted">
          <Link href="/dashboard/upgrade" className="text-primary hover:underline">
            Community-Mitglied werden
          </Link>{' '}
          und alle Pakete dauerhaft günstiger bekommen.
        </div>
      )}
    </div>
  )
}
