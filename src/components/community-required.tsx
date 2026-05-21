/**
 * CommunityRequiredView — wird gerendert, wenn ein User auf ein Feature
 * zugreifen will, das community-only ist (state='community' in der
 * Permission-Matrix) und er nicht premium-tier ist.
 *
 * Ersetzt in der Community-only-Welt das alte VideoCreatorGate /
 * "Plan wählen"-Pattern. Statt Plan-Wahl kommt eine klare CTA zur
 * Skool-Community.
 *
 * Wird auch verwendet vom CommunityRequiredModal (Client-Component für
 * Inline-Aktionen wie Send-Button).
 */

import Link from 'next/link'
import { ChevronLeft, Users, Sparkles, ArrowRight, ExternalLink } from 'lucide-react'

interface Props {
  /** Tool/Feature-Name für Headline ("KI Video Creator", "Karussell-Generator", ...) */
  featureLabel: string
  /** Optionaler Pfad/Label fürs "← Zurück"-Link. Default: KI Toolbox. */
  backHref?: string
  backLabel?: string
  /** Liste mit Mehrwerten die im Community-Paket enthalten sind. */
  benefits?: string[]
  /** Skool-URL aus app_settings.community_url. */
  communityUrl: string
}

const DEFAULT_BENEFITS = [
  'UPRO AI Lab — alle 6 KI-Coaches',
  'Classroom — alle Lern-Module',
  'KI Toolbox — Carousel, Video-Editor, Video-Creator',
  'Monatliche Credits + Live Calls',
]

export default function CommunityRequiredView({
  featureLabel,
  backHref = '/dashboard/ki-toolbox',
  backLabel = 'KI Toolbox',
  benefits = DEFAULT_BENEFITS,
  communityUrl,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={backHref}
          className="text-muted hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ChevronLeft size={20} />
          <span className="text-sm">{backLabel}</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 to-primary/10 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <Users size={22} className="text-primary" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              Nur für Community-Mitglieder
            </div>
            <h2 className="text-lg font-bold text-foreground">
              {featureLabel} — Teil des KI Marketing Clubs
            </h2>
          </div>
        </div>

        <p className="text-sm text-muted leading-relaxed mb-5">
          Werde Mitglied im KI Marketing Club und schalte alles auf einen Schlag frei —
          ohne weitere Abos, ohne Tool-Dschungel.
        </p>

        <ul className="space-y-2 mb-6">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-foreground">
              <Sparkles size={14} className="text-primary shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href={communityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold rounded-xl text-sm transition-colors"
          >
            Community beitreten
            <ExternalLink size={14} />
          </a>
          <Link
            href={backHref}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-border text-foreground hover:border-primary hover:text-primary font-medium rounded-xl text-sm transition-colors"
          >
            <ArrowRight size={14} className="rotate-180" />
            Zurück
          </Link>
        </div>
      </div>
    </div>
  )
}
