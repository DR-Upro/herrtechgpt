'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Plan, PlanTier } from '@/lib/types'

interface Props {
  initialPlans: Plan[]
}

const TIERS: PlanTier[] = ['S', 'M', 'L']

function centsToEuro(cents: number | null | undefined): string {
  if (cents == null) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}

function euroToCents(input: string): number | null {
  if (!input || !input.trim()) return null
  const normalized = input.replace(',', '.').trim()
  const num = parseFloat(normalized)
  if (isNaN(num)) return null
  return Math.round(num * 100)
}

function emptyPlan(tier: PlanTier): Plan {
  return {
    id: `plan_${tier.toLowerCase()}`,
    tier,
    name: tier === 'S' ? 'Starter' : tier === 'M' ? 'Professional' : 'Power',
    description: '',
    price_basic_cents: 0,
    price_community_cents: 0,
    price_yearly_basic_cents: null,
    price_yearly_community_cents: null,
    credits_per_month: 0,
    stripe_product_id: null,
    stripe_price_basic_monthly: null,
    stripe_price_community_monthly: null,
    stripe_price_basic_yearly: null,
    stripe_price_community_yearly: null,
    features: [],
    sort_order: TIERS.indexOf(tier) + 1,
    active: true,
    created_at: '',
    updated_at: '',
  }
}

export default function PlansManager({ initialPlans }: Props) {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Yearly prices as strings during edit (so empty = null)
  const [yBasic, setYBasic] = useState('')
  const [yCommunity, setYCommunity] = useState('')

  function startEdit(plan: Plan) {
    setEditing({ ...plan })
    setYBasic(centsToEuro(plan.price_yearly_basic_cents))
    setYCommunity(centsToEuro(plan.price_yearly_community_cents))
    setError(null)
  }

  function startNew(tier: PlanTier) {
    const p = emptyPlan(tier)
    setEditing(p)
    setYBasic('')
    setYCommunity('')
    setError(null)
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    setError(null)

    const payload = {
      ...editing,
      price_yearly_basic_cents: euroToCents(yBasic),
      price_yearly_community_cents: euroToCents(yCommunity),
    }

    const res = await fetch('/api/admin/plans', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)

    if (!res.ok) {
      const err = await res.json()
      setError(err.error || 'Speichern fehlgeschlagen')
      return
    }

    const updated: Plan = await res.json()
    setPlans((prev) => {
      const exists = prev.find((p) => p.id === updated.id)
      if (exists) return prev.map((p) => (p.id === updated.id ? updated : p))
      return [...prev, updated].sort((a, b) => a.sort_order - b.sort_order)
    })
    setEditing(null)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm(`Plan "${id}" wirklich löschen? Bestehende Abos werden NICHT beendet.`)) return
    const res = await fetch(`/api/admin/plans?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error || 'Löschen fehlgeschlagen')
      return
    }
    setPlans((prev) => prev.filter((p) => p.id !== id))
    router.refresh()
  }

  const existingTiers = new Set(plans.map((p) => p.tier))
  const missingTiers = TIERS.filter((t) => !existingTiers.has(t))

  return (
    <div className="space-y-6">
      {/* Plan-Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold">
                    {plan.tier}
                  </span>
                  <h3 className="font-semibold text-foreground">{plan.name}</h3>
                </div>
                {plan.description && (
                  <p className="text-sm text-muted mt-2">{plan.description}</p>
                )}
              </div>
              {!plan.active && (
                <span className="text-[10px] uppercase tracking-wide text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
                  inaktiv
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <Field label="Basic / Monat" value={`${centsToEuro(plan.price_basic_cents)} €`} />
              <Field
                label="Community / Monat"
                value={
                  plan.price_community_cents === 0
                    ? 'inklusive'
                    : `${centsToEuro(plan.price_community_cents)} €`
                }
              />
              <Field
                label="Basic / Jahr"
                value={plan.price_yearly_basic_cents ? `${centsToEuro(plan.price_yearly_basic_cents)} €` : '—'}
              />
              <Field
                label="Community / Jahr"
                value={
                  plan.price_yearly_community_cents != null
                    ? plan.price_yearly_community_cents === 0
                      ? 'inklusive'
                      : `${centsToEuro(plan.price_yearly_community_cents)} €`
                    : '—'
                }
              />
              <Field label="Credits / Monat" value={plan.credits_per_month.toLocaleString('de-DE')} />
              <Field
                label="Stripe verknüpft"
                value={
                  plan.stripe_price_basic_monthly && plan.stripe_price_community_monthly
                    ? 'Ja ✓'
                    : 'Fehlt ⚠'
                }
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => startEdit(plan)}
                className="flex-1 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
              >
                Bearbeiten
              </button>
              <button
                onClick={() => remove(plan.id)}
                className="text-sm px-3 py-2 rounded-lg border border-border text-muted hover:text-red-500 hover:border-red-500/40 transition-colors"
                title="Löschen"
              >
                Löschen
              </button>
            </div>
          </div>
        ))}

        {missingTiers.map((tier) => (
          <button
            key={tier}
            onClick={() => startNew(tier)}
            className="bg-surface/50 border-2 border-dashed border-border rounded-xl p-5 text-muted hover:text-foreground hover:border-primary transition-colors"
          >
            <div className="text-4xl font-bold mb-2">{tier}</div>
            <div className="text-sm">Plan {tier} anlegen</div>
          </button>
        ))}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">
                Plan {editing.tier} {plans.find((p) => p.id === editing.id) ? 'bearbeiten' : 'anlegen'}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <Row>
                <Input
                  label="Name (z.B. Starter)"
                  value={editing.name}
                  onChange={(v) => setEditing({ ...editing, name: v })}
                />
                <Input
                  label="Sort-Order"
                  type="number"
                  value={String(editing.sort_order)}
                  onChange={(v) => setEditing({ ...editing, sort_order: parseInt(v) || 0 })}
                />
              </Row>

              <Textarea
                label="Beschreibung (Pricing-Seite)"
                value={editing.description ?? ''}
                onChange={(v) => setEditing({ ...editing, description: v })}
              />

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Monatspreis</h3>
                <Row>
                  <EuroInput
                    label="Basic / Monat (€)"
                    cents={editing.price_basic_cents}
                    onChange={(c) => setEditing({ ...editing, price_basic_cents: c ?? 0 })}
                  />
                  <EuroInput
                    label="Community / Monat (€)"
                    cents={editing.price_community_cents}
                    onChange={(c) => setEditing({ ...editing, price_community_cents: c ?? 0 })}
                    hint="0 = inklusive im KI Marketing Club"
                  />
                </Row>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Jahrespreis <span className="font-normal text-muted">(optional — leer = kein Jahresabo)</span>
                </h3>
                <Row>
                  <EuroInputRaw label="Basic / Jahr (€)" value={yBasic} onChange={setYBasic} />
                  <EuroInputRaw label="Community / Jahr (€)" value={yCommunity} onChange={setYCommunity} />
                </Row>
                <p className="text-xs text-muted mt-2">
                  Empfehlung: 11× Monatspreis (= 1 Monat geschenkt)
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Credits</h3>
                <Input
                  label="Credits pro Monat"
                  type="number"
                  value={String(editing.credits_per_month)}
                  onChange={(v) => setEditing({ ...editing, credits_per_month: parseInt(v) || 0 })}
                />
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Stripe-Verknüpfung</h3>
                <p className="text-xs text-muted mb-3">
                  In Stripe 1 Product pro Plan anlegen (z.B. &quot;UPRO AI Lab World {editing.tier}&quot;)
                  und pro Preisvariante einen Price (<code>price_xxx</code>). IDs hier eintragen —
                  ohne funktioniert der Checkout nicht.
                </p>
                <Input
                  label="Stripe Product-ID (prod_xxx)"
                  value={editing.stripe_product_id ?? ''}
                  onChange={(v) => setEditing({ ...editing, stripe_product_id: v || null })}
                />
                <div className="h-3" />
                <Row>
                  <Input
                    label="Price Basic — monatlich"
                    value={editing.stripe_price_basic_monthly ?? ''}
                    onChange={(v) => setEditing({ ...editing, stripe_price_basic_monthly: v || null })}
                  />
                  <Input
                    label="Price Community — monatlich"
                    value={editing.stripe_price_community_monthly ?? ''}
                    onChange={(v) => setEditing({ ...editing, stripe_price_community_monthly: v || null })}
                  />
                </Row>
                <Row>
                  <Input
                    label="Price Basic — jährlich"
                    value={editing.stripe_price_basic_yearly ?? ''}
                    onChange={(v) => setEditing({ ...editing, stripe_price_basic_yearly: v || null })}
                  />
                  <Input
                    label="Price Community — jährlich"
                    value={editing.stripe_price_community_yearly ?? ''}
                    onChange={(v) => setEditing({ ...editing, stripe_price_community_yearly: v || null })}
                  />
                </Row>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Feature-Liste (Pricing-Seite)
                </h3>
                <Textarea
                  label="Ein Feature pro Zeile"
                  value={editing.features.join('\n')}
                  onChange={(v) =>
                    setEditing({
                      ...editing,
                      features: v.split('\n').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  rows={5}
                />
              </div>

              <div className="border-t border-border pt-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                <label htmlFor="active" className="text-sm text-foreground">
                  Aktiv (wird auf Pricing-Seite gezeigt)
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-background border-t border-border px-6 py-4 flex gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? 'Speichere...' : 'Speichern'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Field helpers ─────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  )
}

function Textarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
      />
    </label>
  )
}

function EuroInput({
  label,
  cents,
  onChange,
  hint,
}: {
  label: string
  cents: number | null
  onChange: (c: number | null) => void
  hint?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={centsToEuro(cents)}
        onChange={(e) => onChange(euroToCents(e.target.value))}
        className="px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {hint && <span className="text-[10px] text-muted">{hint}</span>}
    </label>
  )
}

function EuroInputRaw({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        placeholder="leer lassen = kein Jahresabo"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  )
}
