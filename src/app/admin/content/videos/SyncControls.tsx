'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

interface SyncResult {
  ok: boolean
  new_videos_found?: number
  videos_submitted?: number
  videos_completed?: number
  obsolete_flagged?: string[]
  notes?: string[]
  error?: string
}

export function SyncControls({ lastRunAt }: { lastRunAt: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<SyncResult | null>(null)
  const [running, setRunning] = useState(false)

  const handleTrigger = () => {
    setResult(null)
    setRunning(true)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/wistia-sync', { method: 'POST' })
        const data: SyncResult = await res.json()
        setResult(data)
        if (data.ok) {
          router.refresh()
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unbekannter Fehler'
        setResult({ ok: false, error: message })
      } finally {
        setRunning(false)
      }
    })
  }

  const isWorking = running || pending

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-medium text-foreground">Manueller Sync</div>
          <div className="text-xs text-muted mt-0.5">
            {lastRunAt
              ? `Letzter Lauf: ${new Date(lastRunAt).toLocaleString('de-DE')}`
              : 'Noch kein Sync gelaufen.'}
          </div>
        </div>
        <button
          type="button"
          onClick={handleTrigger}
          disabled={isWorking}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={16} className={isWorking ? 'animate-spin' : ''} />
          {isWorking ? 'Läuft...' : 'Sync jetzt starten'}
        </button>
      </div>

      {result && (
        <div
          className={`mt-4 p-3 rounded-lg border text-sm ${
            result.ok
              ? 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-200'
              : 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2 font-medium mb-1">
            {result.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {result.ok ? 'Sync abgeschlossen' : 'Sync fehlgeschlagen'}
          </div>
          {result.ok ? (
            <div className="text-xs space-y-0.5">
              <div>Neue Videos gefunden: {result.new_videos_found ?? 0}</div>
              <div>Zu AssemblyAI eingereicht: {result.videos_submitted ?? 0}</div>
              <div>Transkripte abgeschlossen: {result.videos_completed ?? 0}</div>
              {result.obsolete_flagged && result.obsolete_flagged.length > 0 && (
                <div>Als veraltet markiert: {result.obsolete_flagged.length}</div>
              )}
              {result.notes && result.notes.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs opacity-70 hover:opacity-100">
                    Notes ({result.notes.length})
                  </summary>
                  <pre className="mt-1 text-[11px] whitespace-pre-wrap font-mono opacity-80">
                    {result.notes.join('\n')}
                  </pre>
                </details>
              )}
            </div>
          ) : (
            <div className="text-xs">{result.error ?? 'Unbekannter Fehler'}</div>
          )}
        </div>
      )}
    </div>
  )
}
