'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Quiz-Konfiguration ────────────────────────────────────────────────────────

const QUIZ_QUESTIONS = [
  {
    key: 'experience_level' as const,
    title: 'Wie erfahren bist du mit KI-Tools?',
    options: [
      { value: 'einsteiger', label: 'Einsteiger', hint: 'Ich habe ChatGPT schon mal ausprobiert, aber nutze KI noch nicht regelmäßig.' },
      { value: 'fortgeschritten', label: 'Fortgeschritten', hint: 'Ich nutze KI regelmäßig, will aber mehr rausholen.' },
      { value: 'profi', label: 'Profi', hint: 'Ich baue komplexe Workflows und Automationen.' },
    ],
  },
  {
    key: 'primary_goal' as const,
    title: 'Was willst du in den nächsten 90 Tagen erreichen?',
    options: [
      { value: 'content', label: 'Mehr & besseren Content', hint: 'Reichweite, Hooks, viral Posts' },
      { value: 'umsatz', label: 'Umsatz steigern', hint: 'Funnels, Sales, Monetarisierung' },
      { value: 'automatisierung', label: 'Zeit sparen durch Automation', hint: 'Workflows, n8n, Make, Tools' },
      { value: 'prompting', label: 'Besser prompten', hint: 'Bessere Ergebnisse aus KI-Tools holen' },
      { value: 'strategie', label: 'Klare Strategie entwickeln', hint: 'Positionierung, Skalierung, Business-Plan' },
    ],
  },
  {
    key: 'weekly_time' as const,
    title: 'Wie viel Zeit kannst du pro Woche investieren?',
    options: [
      { value: '1-2h', label: '1–2 Stunden', hint: 'Lean — nur das Wichtigste' },
      { value: '3-5h', label: '3–5 Stunden', hint: 'Solider Fortschritt' },
      { value: '5h+', label: 'Mehr als 5 Stunden', hint: 'All-in Modus' },
    ],
  },
  {
    key: 'biggest_challenge' as const,
    title: 'Was ist gerade deine größte Hürde?',
    options: [
      { value: 'zu_viel', label: 'Zu viel Input', hint: 'Ich weiß nicht, wo ich anfangen soll.' },
      { value: 'umsetzung', label: 'Umsetzung', hint: 'Ich weiß viel, setze aber zu wenig um.' },
      { value: 'tools', label: 'Tool-Auswahl', hint: 'Ich blicke bei den Tools nicht durch.' },
      { value: 'resultate', label: 'Resultate', hint: 'Ich arbeite viel, aber sehe wenig Ergebnis.' },
    ],
  },
]

// ── Steps ────────────────────────────────────────────────────────────────────

type Step =
  | { type: 'welcome' }
  | { type: 'profile-1' }
  | { type: 'profile-2' }
  | { type: 'quiz'; index: number }
  | { type: 'generating' }
  | { type: 'done' }

const PROFILE_STEP_1 = {
  title: 'Wer bist du?',
  subtitle: 'Erzähl mir kurz von dir — dein Hintergrund macht meine Antworten 10x besser.',
  fields: [
    {
      key: 'background',
      label: 'Über dich',
      placeholder: 'z.B. Creator & Online-Unternehmer seit 3 Jahren, Schwerpunkt KI & Produktivität.',
      rows: 3,
    },
    {
      key: 'market',
      label: 'Deine Nische & Business',
      placeholder: 'z.B. Online-Kurse und Coaching rund um KI & Business. Hauptplattformen: Instagram und YouTube.',
      rows: 3,
    },
  ],
}

const PROFILE_STEP_2 = {
  title: 'Dein Angebot',
  subtitle: 'Noch zwei kurze Fragen zu deinem Business.',
  fields: [
    {
      key: 'target_audience',
      label: 'Deine Zielgruppe',
      placeholder: 'z.B. Ambitionierte Unternehmer & Creator, 25–45 Jahre.',
      rows: 3,
    },
    {
      key: 'offer',
      label: 'Deine Angebote',
      placeholder: 'z.B. KI-Masterkurs (997€), Membership-Community (49€/Monat).',
      rows: 3,
    },
  ],
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>({ type: 'welcome' })
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({ background: '', market: '', target_audience: '', offer: '' })
  const [quiz, setQuiz] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const markDone = () => localStorage.setItem('upro_ai_lab_onboarding_done', 'true')

  const handleSkip = () => {
    markDone()
    router.push('/dashboard')
  }

  const saveProfile = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('profiles')
      .update({
        background: profile.background,
        market: profile.market,
        target_audience: profile.target_audience,
        offer: profile.offer,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
  }

  const handleQuizAnswer = async (value: string) => {
    if (step.type !== 'quiz') return
    const current = QUIZ_QUESTIONS[step.index]
    const updated = { ...quiz, [current.key]: value }
    setQuiz(updated)

    if (step.index < QUIZ_QUESTIONS.length - 1) {
      setStep({ type: 'quiz', index: step.index + 1 })
      return
    }

    // Letzte Frage → Lernpfad generieren
    setStep({ type: 'generating' })
    setError(null)
    try {
      const res = await fetch('/api/onboarding/path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updated, background: profile.background, market: profile.market }),
      })
      if (!res.ok) throw new Error('Fehler beim Generieren')
      markDone()
      setStep({ type: 'done' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
      setStep({ type: 'quiz', index: QUIZ_QUESTIONS.length - 1 })
    }
  }

  const handleProfileNext = async () => {
    setSaving(true)
    await saveProfile()
    setSaving(false)
    setStep({ type: 'quiz', index: 0 })
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  const totalSteps = 2 /* profile */ + QUIZ_QUESTIONS.length
  const progress =
    step.type === 'welcome' ? 0 :
    step.type === 'profile-1' ? 1 :
    step.type === 'profile-2' ? 2 :
    step.type === 'quiz' ? 2 + step.index + 1 :
    step.type === 'generating' ? totalSteps :
    totalSteps

  return (
    <div className="flex items-center justify-center min-h-full bg-background p-6">
      <div className="w-full max-w-xl">
        {/* Progress bar */}
        {step.type !== 'welcome' && step.type !== 'done' && (
          <div className="flex items-center gap-1.5 mb-8">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  i < progress ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
          </div>
        )}

        <div className="bg-surface rounded-2xl border border-border p-8 shadow-sm">
          {step.type === 'welcome' && (
            <div className="text-center">
              <div className="text-5xl mb-6">👋</div>
              <h1 className="text-2xl font-bold text-foreground mb-3">Willkommen in der UPRO AI Lab World</h1>
              <p className="text-muted text-sm leading-relaxed mb-8 max-w-sm mx-auto">
                In 3 Minuten bauen wir deinen persönlichen Lernpfad — damit du sofort weißt, was du wann machen sollst, statt dich im Content zu verlieren.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setStep({ type: 'profile-1' })}
                  className="w-full px-6 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  Los geht&apos;s →
                </button>
                <button
                  onClick={handleSkip}
                  className="text-sm text-muted hover:text-foreground transition-colors py-2"
                >
                  Jetzt überspringen
                </button>
              </div>
            </div>
          )}

          {(step.type === 'profile-1' || step.type === 'profile-2') && (
            <ProfileForm
              step={step.type === 'profile-1' ? PROFILE_STEP_1 : PROFILE_STEP_2}
              values={profile}
              onChange={(k, v) => setProfile((p) => ({ ...p, [k]: v }))}
              onBack={step.type === 'profile-2' ? () => setStep({ type: 'profile-1' }) : undefined}
              onNext={step.type === 'profile-1' ? () => setStep({ type: 'profile-2' }) : handleProfileNext}
              saving={saving}
              ctaLabel={step.type === 'profile-1' ? 'Weiter →' : 'Weiter zum Quiz →'}
            />
          )}

          {step.type === 'quiz' && (
            <QuizStep
              question={QUIZ_QUESTIONS[step.index]}
              current={quiz[QUIZ_QUESTIONS[step.index].key]}
              stepNumber={step.index + 1}
              total={QUIZ_QUESTIONS.length}
              onAnswer={handleQuizAnswer}
              onBack={() => {
                if (step.index > 0) setStep({ type: 'quiz', index: step.index - 1 })
                else setStep({ type: 'profile-2' })
              }}
              error={error}
            />
          )}

          {step.type === 'generating' && (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-5 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <h2 className="text-xl font-bold text-foreground mb-2">Dein Lernpfad wird erstellt…</h2>
              <p className="text-sm text-muted">
                Ich analysiere 80+ Videos und wähle die passendsten für dich aus. Dauert ca. 15 Sekunden.
              </p>
            </div>
          )}

          {step.type === 'done' && (
            <div className="text-center">
              <div className="text-5xl mb-5">🎯</div>
              <h2 className="text-xl font-bold text-foreground mb-2">Dein Lernpfad ist bereit!</h2>
              <p className="text-sm text-muted mb-6 leading-relaxed">
                Ich habe die 5–7 wichtigsten Videos für dich ausgewählt, passende Assistenten empfohlen und einen 30/60/90-Tage-Plan erstellt.
              </p>
              <button
                onClick={() => router.push('/dashboard/path')}
                className="w-full px-6 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Lernpfad ansehen →
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm text-muted hover:text-foreground transition-colors py-3 mt-2"
              >
                Direkt zu den Assistenten
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-Components ────────────────────────────────────────────────────────────

function ProfileForm({
  step,
  values,
  onChange,
  onBack,
  onNext,
  saving,
  ctaLabel,
}: {
  step: typeof PROFILE_STEP_1
  values: Record<string, string>
  onChange: (k: string, v: string) => void
  onBack?: () => void
  onNext: () => void
  saving: boolean
  ctaLabel: string
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">{step.title}</h2>
      <p className="text-muted text-sm mb-6">{step.subtitle}</p>

      <div className="space-y-5">
        {step.fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-foreground mb-2">{field.label}</label>
            <textarea
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={field.rows}
              className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm resize-none bg-background text-foreground placeholder:text-muted"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-8">
        {onBack ? (
          <button onClick={onBack} className="text-sm text-muted hover:text-foreground transition-colors">
            ← Zurück
          </button>
        ) : <span />}
        <button
          onClick={onNext}
          disabled={saving}
          className="px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {saving ? 'Speichere...' : ctaLabel}
        </button>
      </div>
    </div>
  )
}

function QuizStep({
  question,
  current,
  stepNumber,
  total,
  onAnswer,
  onBack,
  error,
}: {
  question: typeof QUIZ_QUESTIONS[number]
  current?: string
  stepNumber: number
  total: number
  onAnswer: (v: string) => void
  onBack: () => void
  error: string | null
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
        Frage {stepNumber} / {total}
      </p>
      <h2 className="text-xl font-bold text-foreground mb-6">{question.title}</h2>

      <div className="space-y-2">
        {question.options.map((opt) => {
          const isActive = current === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => onAnswer(opt.value)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                isActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-surface-secondary/40'
              }`}
            >
              <p className="font-semibold text-sm text-foreground mb-0.5">{opt.label}</p>
              <p className="text-xs text-muted">{opt.hint}</p>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="text-sm text-red-500 mt-4">{error} — bitte nochmal versuchen.</p>
      )}

      <div className="flex items-center justify-between mt-8">
        <button onClick={onBack} className="text-sm text-muted hover:text-foreground transition-colors">
          ← Zurück
        </button>
      </div>
    </div>
  )
}
