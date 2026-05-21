import Link from 'next/link'
import { cookies } from 'next/headers'
import { Lock, Check, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { computeEffectiveAccess, VIEW_AS_COOKIE } from '@/lib/access'
import { getUpsellCopy } from '@/lib/permissions'

type Feature = 'chat' | 'classroom' | 'toolbox' | 'default'

const FEATURE_COPY: Record<Feature, { title: string; lead: string; items: { emoji: string; text: string }[] }> = {
  chat: {
    title: 'UPRO AI Lab — nur für Community-Mitglieder',
    lead: 'Die 6 spezialisierten KI-Agenten mit dem gesamten Wissen aus allen Lernvideos sind exklusiv für Mitglieder des KI Marketing Club.',
    items: [
      { emoji: '🎯', text: 'Content & Hook Agent' },
      { emoji: '🤖', text: 'Funnel & Monetarisierung' },
      { emoji: '🔧', text: 'KI-Prompt-Agent' },
      { emoji: '🧠', text: 'Business-Coaching' },
      { emoji: '💛', text: 'Personal Growth Coach' },
      { emoji: '🚀', text: 'Standard "UPRO AI Lab" Agent' },
    ],
  },
  classroom: {
    title: 'Classroom — für Community-Mitglieder & Alumni',
    lead: 'Der Classroom mit allen Lernvideos ist für aktive Mitglieder und ehemalige Alumni freigeschaltet.',
    items: [
      { emoji: '🎥', text: 'Alle Lernvideos' },
      { emoji: '🧩', text: 'Kategorisiert & durchsuchbar' },
      { emoji: '📈', text: 'KI, Content, Funnels' },
      { emoji: '♾️', text: 'Alumni: lebenslanger Zugriff' },
    ],
  },
  toolbox: {
    title: 'KI Toolbox — Coming Soon',
    lead: 'Die KI Toolbox wird demnächst verfügbar sein — als Pay-per-Use-Tools für alle Nutzer.',
    items: [
      { emoji: '🎠', text: 'Karussell-Generator' },
      { emoji: '🎬', text: 'KI Video Editor' },
      { emoji: '✨', text: 'KI Video Creator' },
    ],
  },
  default: {
    title: 'Exklusiver Bereich',
    lead: 'Dieser Bereich ist für deine Gruppe aktuell gesperrt.',
    items: [],
  },
}

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>
}) {
  const { feature } = await searchParams
  const key = (feature === 'chat' || feature === 'classroom' || feature === 'toolbox' ? feature : 'default') as Feature
  const featureCopy = FEATURE_COPY[key]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let upsell = await getUpsellCopy(supabase, 'basic')
  if (user) {
    const [{ data: profile }, cookieStore] = await Promise.all([
      supabase.from('profiles').select('role, access_tier').eq('id', user.id).single(),
      cookies(),
    ])
    const viewAsRaw = cookieStore.get(VIEW_AS_COOKIE)?.value
    const access = computeEffectiveAccess(profile, viewAsRaw)
    upsell = await getUpsellCopy(supabase, access.tier)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-5">
          <Lock size={28} className="text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          {featureCopy.title}
        </h1>
        <p className="text-sm text-muted leading-relaxed max-w-md mx-auto">
          {featureCopy.lead}
        </p>
      </div>

      {featureCopy.items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {featureCopy.items.map((item) => (
            <div
              key={item.text}
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface"
            >
              <span className="text-lg">{item.emoji}</span>
              <span className="text-sm text-foreground font-medium">{item.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* KI Marketing Club CTA — Copy kommt aus DB, pro Tier unterschiedlich */}
      <div className="card-static p-6 sm:p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            KI Marketing Club
          </span>
          {upsell.cta_coming_soon && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              <Clock size={10} /> Coming Soon
            </span>
          )}
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          {upsell.heading}
        </h2>
        <p className="text-sm text-muted mb-5 leading-relaxed">
          {upsell.intro}
        </p>

        {upsell.benefits.length > 0 && (
          <ul className="space-y-2.5 mb-6">
            {upsell.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5 text-sm text-foreground">
                <Check size={16} className="text-primary shrink-0 mt-0.5" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {upsell.cta_coming_soon || !upsell.cta_url ? (
            <button
              disabled
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary/40 text-white font-semibold rounded-xl text-sm cursor-not-allowed"
            >
              {upsell.cta_label}
            </button>
          ) : (
            <a
              href={upsell.cta_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl text-sm transition-colors"
            >
              {upsell.cta_label}
            </a>
          )}
          {upsell.cta_coming_soon && (
            <span className="text-xs text-muted">
              Anmeldung startet bald — wir informieren dich.
            </span>
          )}
        </div>
      </div>

      <div className="text-center mt-8">
        <Link
          href="/dashboard"
          className="text-sm text-muted hover:text-foreground transition-colors py-2"
        >
          ← Zurück zum Dashboard
        </Link>
      </div>
    </div>
  )
}
