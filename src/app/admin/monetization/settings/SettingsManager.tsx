'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AppSettings } from '@/lib/app-settings'

interface Props {
  initial: AppSettings
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function SettingsManager({ initial }: Props) {
  const router = useRouter()
  const [settings, setSettings] = useState<AppSettings>(initial)
  const [saveStates, setSaveStates] = useState<Record<keyof AppSettings, SaveState>>({
    subscriptionsEnabled: 'idle',
    communityMonthlyCredits: 'idle',
    starterTestCredits: 'idle',
    communityUrl: 'idle',
  })
  const [errors, setErrors] = useState<Record<keyof AppSettings, string | null>>({
    subscriptionsEnabled: null,
    communityMonthlyCredits: null,
    starterTestCredits: null,
    communityUrl: null,
  })

  async function save<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSaveStates((s) => ({ ...s, [key]: 'saving' }))
    setErrors((e) => ({ ...e, [key]: null }))

    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Speichern fehlgeschlagen' }))
      setSaveStates((s) => ({ ...s, [key]: 'error' }))
      setErrors((e) => ({ ...e, [key]: err.error || 'Speichern fehlgeschlagen' }))
      return
    }

    const fresh: AppSettings = await res.json()
    setSettings(fresh)
    setSaveStates((s) => ({ ...s, [key]: 'saved' }))
    router.refresh()

    // Reset "saved" indicator nach 2s
    setTimeout(() => {
      setSaveStates((s) => (s[key] === 'saved' ? { ...s, [key]: 'idle' } : s))
    }, 2000)
  }

  const subsOff = !settings.subscriptionsEnabled

  return (
    <div className="space-y-6">
      {/* ─── Master-Switch ──────────────────────────────────── */}
      <Section
        title="Abo-System"
        description="Wenn aktiv, sind Plan S/M/L auf der Pricing-Seite und im Account-Bereich buchbar. Wenn aus, zeigt die Plattform nur Community-Beitritt + Credit-Pakete."
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <label className="font-medium text-foreground">
              Plan S / M / L im Frontend anzeigen?
            </label>
            <p className="text-sm text-muted mt-1">
              {settings.subscriptionsEnabled ? (
                <>
                  <strong className="text-emerald-600 dark:text-emerald-400">AN</strong> —
                  User können Abos buchen. Credit-Mengen kommen aus den Plan-Definitionen
                  unter &bdquo;Abo-Pläne&ldquo;.
                </>
              ) : (
                <>
                  <strong className="text-amber-600 dark:text-amber-400">AUS</strong> —
                  Pricing-Seite zeigt nur Credit-Pakete. Community-Mitglieder bekommen
                  monatlich die unten konfigurierten Credits.
                </>
              )}
            </p>
          </div>
          <Toggle
            checked={settings.subscriptionsEnabled}
            onChange={(v) => save('subscriptionsEnabled', v)}
            disabled={saveStates.subscriptionsEnabled === 'saving'}
          />
        </div>
        <SaveStatus state={saveStates.subscriptionsEnabled} error={errors.subscriptionsEnabled} />
      </Section>

      {/* ─── Fallback-Werte (greifen wenn Switch=off) ───────── */}
      <Section
        title="Fallback-Werte"
        description="Diese Werte greifen, wenn das Abo-System ausgeschaltet ist. Wenn es eingeschaltet ist, kommen Credit-Mengen aus den Plan-Definitionen — die Werte hier werden dann ignoriert."
        muted={!subsOff}
      >
        <NumberField
          label="Community-Credits pro Monat"
          hint="Bekommen Skool-Mitglieder automatisch beim Login (greift nur wenn Abo-System aus). Empfehlung: gleicher Wert wie aktueller Plan S (200)."
          value={settings.communityMonthlyCredits}
          onSave={(v) => save('communityMonthlyCredits', v)}
          state={saveStates.communityMonthlyCredits}
          error={errors.communityMonthlyCredits}
          disabled={!subsOff}
        />

        <NumberField
          label="Test-Credits beim kleinen Paket"
          hint="Werden gutgeschrieben, wenn ein Nicht-Community-User das kleine Funnel-Paket kauft. 0 = keine Test-Credits, User muss Credit-Pack kaufen."
          value={settings.starterTestCredits}
          onSave={(v) => save('starterTestCredits', v)}
          state={saveStates.starterTestCredits}
          error={errors.starterTestCredits}
          disabled={!subsOff}
        />
      </Section>

      {/* ─── Community-URL ──────────────────────────────────── */}
      <Section
        title="Community-Link"
        description="Wo alle 'Community beitreten'-Buttons hinführen — Pricing-Seite, Tool-Gates, Billing-Seite, Dashboard-Cards. Gilt unabhängig vom Master-Switch."
      >
        <TextField
          label="Community-URL"
          hint="Vollständige URL inkl. https://. Beispiel: https://www.skool.com/dein-community-slug"
          value={settings.communityUrl}
          onSave={(v) => save('communityUrl', v)}
          state={saveStates.communityUrl}
          error={errors.communityUrl}
        />
      </Section>

      {/* ─── Hinweis-Box ────────────────────────────────────── */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-foreground">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <span className="text-base">💡</span>
          So hängt alles zusammen
        </h3>
        <ul className="space-y-1.5 text-muted list-disc pl-5">
          <li>
            <strong className="text-foreground">Master-Switch AN:</strong> Plan-Definitionen
            unter &bdquo;Abo-Pläne&ldquo; sind aktiv. Credits kommen aus dort.
          </li>
          <li>
            <strong className="text-foreground">Master-Switch AUS:</strong> Pricing-Seite zeigt
            keine Abos. Community-Mitglieder bekommen monatlich den hier eingestellten
            Wert. Plan-Daten werden nicht geladen.
          </li>
          <li>
            Code für das Abo-System bleibt erhalten — du kannst jederzeit zurück.
          </li>
          <li>
            Bestehende Abos werden NICHT automatisch beendet, wenn du den Switch ausschaltest.
            Sie laufen bis zum nächsten Stripe-Cycle weiter (oder bis manuell gekündigt).
          </li>
        </ul>
      </div>
    </div>
  )
}

// ─── Sub-Components ────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
  muted = false,
}: {
  title: string
  description: string
  children: React.ReactNode
  muted?: boolean
}) {
  return (
    <div
      className={`bg-surface border border-border rounded-xl p-6 transition-opacity ${
        muted ? 'opacity-60' : ''
      }`}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted mt-1 max-w-2xl">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-border'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function NumberField({
  label,
  hint,
  value,
  onSave,
  state,
  error,
  disabled,
}: {
  label: string
  hint?: string
  value: number
  onSave: (v: number) => void
  state: SaveState
  error: string | null
  disabled?: boolean
}) {
  const [draft, setDraft] = useState<string>(String(value))
  const [dirty, setDirty] = useState(false)

  // Sync from prop when value changes externally (z.B. nach erfolgreichem Save)
  useEffect(() => {
    if (!dirty) setDraft(String(value))
  }, [value, dirty])

  function commit() {
    const num = parseInt(draft, 10)
    if (isNaN(num) || num < 0) {
      setDraft(String(value))
      setDirty(false)
      return
    }
    if (num === value) {
      setDirty(false)
      return
    }
    onSave(num)
    setDirty(false)
  }

  return (
    <div className={disabled ? 'pointer-events-none' : ''}>
      <label className="block">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setDirty(true)
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            disabled={disabled}
            className="w-32 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          />
          <span className="text-xs text-muted">Credits</span>
          <SaveStatus state={state} error={error} inline />
        </div>
        {hint && <p className="text-xs text-muted mt-1.5 max-w-xl">{hint}</p>}
      </label>
    </div>
  )
}

function TextField({
  label,
  hint,
  value,
  onSave,
  state,
  error,
}: {
  label: string
  hint?: string
  value: string
  onSave: (v: string) => void
  state: SaveState
  error: string | null
}) {
  const [draft, setDraft] = useState<string>(value)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setDraft(value)
  }, [value, dirty])

  function commit() {
    const trimmed = draft.trim()
    if (!trimmed) {
      // Leerer String — zurück auf alten Wert (Pflichtfeld)
      setDraft(value)
      setDirty(false)
      return
    }
    if (trimmed === value) {
      setDirty(false)
      return
    }
    onSave(trimmed)
    setDirty(false)
  }

  return (
    <div>
      <label className="block">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="url"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setDirty(true)
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            placeholder="https://www.skool.com/dein-community-slug"
            className="flex-1 max-w-xl px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
          />
          <SaveStatus state={state} error={error} inline />
        </div>
        {hint && <p className="text-xs text-muted mt-1.5 max-w-xl">{hint}</p>}
      </label>
    </div>
  )
}

function SaveStatus({
  state,
  error,
  inline = false,
}: {
  state: SaveState
  error: string | null
  inline?: boolean
}) {
  if (state === 'idle') return null

  const baseClass = inline ? 'text-xs' : 'text-sm mt-2'

  if (state === 'saving') {
    return <span className={`${baseClass} text-muted`}>Speichere…</span>
  }
  if (state === 'saved') {
    return <span className={`${baseClass} text-emerald-600 dark:text-emerald-400`}>Gespeichert ✓</span>
  }
  if (state === 'error') {
    return (
      <span className={`${baseClass} text-red-600 dark:text-red-400`}>
        Fehler: {error ?? 'unbekannt'}
      </span>
    )
  }
  return null
}
