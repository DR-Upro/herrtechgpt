'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/lib/theme-context'

/**
 * Öffnet den Video-Creator auf dem Worker (vc.lab.upro-capital.com) via SSO.
 * Holt die aktuelle Supabase-Session und hängt zusätzlich Theme + Back-URL
 * ans URL-Fragment — der Worker nimmt sie ab, setzt seine Cookies, und
 * die Worker-UI erscheint im selben Theme und mit funktionierendem
 * „Zurück zur Plattform"-Button.
 */
export default function SSORedirect({ workerUrl }: { workerUrl: string }) {
  const [error, setError] = useState<string | null>(null)
  const { theme } = useTheme()

  useEffect(() => {
    ;(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        const session = data.session
        if (!session?.access_token) {
          throw new Error('Keine aktive Session')
        }
        // Back-URL = aktueller Origin (Staging oder Live), damit der User
        // exakt zu dem Deployment zurückkommt, aus dem er gekommen ist.
        const back = `${window.location.origin}/dashboard/ki-toolbox`
        const hash = new URLSearchParams({
          at: session.access_token,
          rt: session.refresh_token ?? '',
          theme: theme,
          back,
        }).toString()
        window.location.replace(`${workerUrl.replace(/\/$/, '')}/sso?next=/projects#${hash}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [workerUrl, theme])

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/ki-toolbox"
          className="text-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">KI Video Creator</h1>
      </div>

      {!error && (
        <div className="card-static p-8 text-center">
          <Loader2 size={32} className="animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted">Öffne Video Creator…</p>
        </div>
      )}

      {error && (
        <div className="card-static p-6 border-red-200 dark:border-red-900/40">
          <div className="flex gap-3">
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Video Creator konnte nicht geöffnet werden
              </h3>
              <p className="text-sm text-muted mb-3">{error}</p>
              <Link
                href="/dashboard/ki-toolbox"
                className="btn-ghost border border-border"
              >
                Zur Toolbox
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
