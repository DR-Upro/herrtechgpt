/**
 * Wird auf /dashboard/pricing gerendert, wenn der Master-Switch
 * `subscriptions_enabled` in app_settings auf false steht.
 *
 * Statt Plan S/M/L zeigen wir zwei klare Wege:
 *  1. Community beitreten → alle Eigenschaften (GPT, Classroom, Live Calls,
 *     monatliche Credits)
 *  2. Credit-Pakete kaufen → für Toolbox, ohne Community-Mitgliedschaft
 */

import Link from 'next/link'
import { Sparkles, Coins, ExternalLink, Users } from 'lucide-react'

interface Props {
  /** Skool-URL der Community (kommt aus zentralem Config). */
  communityUrl: string
}

export default function PricingDisabledView({ communityUrl }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-20">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles size={16} />
            Neues Modell
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Zwei Wege rein.
            <br />
            <span className="text-primary">Beide einfach.</span>
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Aktuell gibt&apos;s keine Abo-Pläne. Du wirst entweder Teil der Community
            und bekommst alles freigeschaltet, oder kaufst gezielt Credits für die
            KI-Toolbox.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Community-Card */}
          <div className="relative bg-surface border-2 border-primary/40 rounded-2xl p-8 flex flex-col">
            <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              Empfohlen
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="text-primary" size={24} />
              </div>
              <h2 className="text-xl font-bold text-foreground">KI Marketing Club</h2>
            </div>

            <p className="text-muted mb-6">
              Vollzugriff auf alles: UPRO AI Lab, Classroom, Live Calls und monatliche
              Credits für die KI-Toolbox.
            </p>

            <ul className="space-y-2 mb-8 flex-1">
              {[
                'UPRO AI Lab (alle 6 Agenten)',
                'Classroom & alle Lern-Module',
                'Live Calls & Community',
                'Monatliche Credits für die Toolbox',
                'Persönlicher Lernpfad',
              ].map((feat) => (
                <li key={feat} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            <a
              href={communityUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary-hover transition-colors"
            >
              Zur Community
              <ExternalLink size={16} />
            </a>
          </div>

          {/* Credit-Packs-Card */}
          <div className="bg-surface border border-border rounded-2xl p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Coins className="text-amber-500" size={24} />
              </div>
              <h2 className="text-xl font-bold text-foreground">Credit-Pakete</h2>
            </div>

            <p className="text-muted mb-6">
              Nur für die Toolbox. Einmalkauf, kein Abo. Credits verfallen nicht.
            </p>

            <ul className="space-y-2 mb-8 flex-1">
              <li className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-amber-500 mt-0.5">✓</span>
                <span>Carousel-Generator, Video-Editor, Video-Creator</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-amber-500 mt-0.5">✓</span>
                <span>Verschiedene Paketgrößen verfügbar</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-amber-500 mt-0.5">✓</span>
                <span>Kein Abo, einmal zahlen, dauerhaft nutzen</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted">
                <span className="text-muted mt-0.5">—</span>
                <span>Kein Zugriff auf UPRO AI Lab &amp; Classroom</span>
              </li>
            </ul>

            <Link
              href="/dashboard/credits"
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl border-2 border-border bg-background text-foreground font-semibold hover:border-primary hover:bg-primary/5 transition-colors"
            >
              Credits kaufen
            </Link>
          </div>
        </div>

        {/* Hinweis für Bestandskunden */}
        <div className="text-center text-sm text-muted">
          Du hattest mal ein Abo? Es läuft normal weiter — schau in deinen{' '}
          <Link
            href="/dashboard/account/billing"
            className="text-primary hover:underline"
          >
            Account-Einstellungen
          </Link>
          .
        </div>
      </div>
    </div>
  )
}
