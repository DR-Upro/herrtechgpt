import { createAdminClient } from '@/lib/supabase/admin'
import { Film, Clock, CheckCircle2, AlertCircle, Loader2, Database } from 'lucide-react'
import { SyncControls } from './SyncControls'

export const dynamic = 'force-dynamic'

type PendingRow = {
  id: string
  video_id: string
  video_name: string
  duration_minutes: number | null
  status: 'queued' | 'processing' | 'completed' | 'error'
  error_message: string | null
  submitted_at: string
  completed_at: string | null
}

type SyncLogRow = {
  id: string
  run_at: string
  new_videos_found: number
  videos_submitted: number
  videos_completed: number
  obsolete_flagged: string[] | null
  notes: string | null
}

const STATUS_META: Record<
  PendingRow['status'],
  { label: string; classes: string; Icon: typeof Loader2 }
> = {
  queued: {
    label: 'Wartet',
    classes:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300',
    Icon: Clock,
  },
  processing: {
    label: 'Läuft',
    classes:
      'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300',
    Icon: Loader2,
  },
  completed: {
    label: 'Fertig',
    classes:
      'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300',
    Icon: CheckCircle2,
  },
  error: {
    label: 'Fehler',
    classes: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300',
    Icon: AlertCircle,
  },
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(min: number | null): string {
  if (!min) return '—'
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return `${h}h ${rest}m`
}

export default async function AdminVideosPage() {
  const supabase = createAdminClient()

  const [
    { data: pendingData },
    { data: syncLogData },
    { data: knowledgeData },
  ] = await Promise.all([
    supabase
      .from('pending_transcripts')
      .select('id, video_id, video_name, duration_minutes, status, error_message, submitted_at, completed_at')
      .order('submitted_at', { ascending: false }),
    supabase
      .from('sync_log')
      .select('id, run_at, new_videos_found, videos_submitted, videos_completed, obsolete_flagged, notes')
      .order('run_at', { ascending: false })
      .limit(10),
    supabase
      .from('knowledge_base')
      .select('video_id, is_active'),
  ])

  const pending = (pendingData ?? []) as PendingRow[]
  const syncLog = (syncLogData ?? []) as SyncLogRow[]
  const knowledge = knowledgeData ?? []

  const counts = {
    queued: pending.filter((p) => p.status === 'queued').length,
    processing: pending.filter((p) => p.status === 'processing').length,
    completed: pending.filter((p) => p.status === 'completed').length,
    error: pending.filter((p) => p.status === 'error').length,
  }

  const uniqueVideos = new Set(knowledge.map((k) => k.video_id)).size
  const activeChunks = knowledge.filter((k) => k.is_active).length
  const lastRunAt = syncLog[0]?.run_at ?? null

  const activeQueue = pending.filter(
    (p) => p.status === 'queued' || p.status === 'processing'
  )
  const recentErrors = pending.filter((p) => p.status === 'error').slice(0, 5)

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Video-Sync</h1>
        <p className="text-sm text-muted">
          Wistia-Sync-Status, AssemblyAI-Transkriptionen und Wissensbasis-Pipeline.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="In Warteschlange" value={counts.queued} Icon={Clock} tone="yellow" />
        <StatCard label="In Bearbeitung" value={counts.processing} Icon={Loader2} tone="blue" />
        <StatCard label="Abgeschlossen" value={counts.completed} Icon={CheckCircle2} tone="green" />
        <StatCard label="Fehler" value={counts.error} Icon={AlertCircle} tone="red" />
        <StatCard label="Videos in KB" value={uniqueVideos} Icon={Film} tone="primary" />
        <StatCard label="Aktive Chunks" value={activeChunks} Icon={Database} tone="primary" />
      </div>

      <SyncControls lastRunAt={lastRunAt} />

      {/* Active Queue */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Aktuelle Queue ({activeQueue.length})
        </h2>
        {activeQueue.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-sm text-muted text-center">
            Keine offenen Transkriptionen. Der nächste Cron-Lauf prüft auf neue Videos.
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted">Video</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Dauer</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Eingereicht</th>
                </tr>
              </thead>
              <tbody>
                {activeQueue.map((p) => (
                  <PendingRowItem key={p.id} row={p} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Fehlgeschlagene Transkriptionen ({recentErrors.length})
          </h2>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted">Video</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Fehler</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Eingereicht</th>
                </tr>
              </thead>
              <tbody>
                {recentErrors.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground">{p.video_name}</td>
                    <td className="px-4 py-3 text-xs text-red-700 dark:text-red-300 font-mono">
                      {p.error_message ?? 'Unbekannt'}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(p.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Sync Log */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Letzte Sync-Läufe
        </h2>
        {syncLog.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-sm text-muted text-center">
            Noch keine Sync-Läufe protokolliert. Starte den ersten manuell oder warte auf den Cron (täglich 06:00 UTC).
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted">Zeitpunkt</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Neu</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Eingereicht</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Fertig</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Veraltet</th>
                </tr>
              </thead>
              <tbody>
                {syncLog.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                    <td className="px-4 py-3 text-foreground">{formatDate(log.run_at)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{log.new_videos_found}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{log.videos_submitted}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{log.videos_completed}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {log.obsolete_flagged?.length ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  Icon,
  tone,
}: {
  label: string
  value: number
  Icon: typeof Film
  tone: 'yellow' | 'blue' | 'green' | 'red' | 'primary'
}) {
  const toneClasses: Record<typeof tone, string> = {
    yellow: 'text-yellow-700 dark:text-yellow-300',
    blue: 'text-blue-700 dark:text-blue-300',
    green: 'text-green-700 dark:text-green-300',
    red: 'text-red-700 dark:text-red-300',
    primary: 'text-primary',
  }
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted">{label}</span>
        <Icon size={14} className={toneClasses[tone]} />
      </div>
      <div className={`text-2xl font-bold ${toneClasses[tone]}`}>{value}</div>
    </div>
  )
}

function PendingRowItem({ row }: { row: PendingRow }) {
  const meta = STATUS_META[row.status]
  const Icon = meta.Icon
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-hover">
      <td className="px-4 py-3 text-foreground">{row.video_name}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${meta.classes}`}
        >
          <Icon size={12} className={row.status === 'processing' ? 'animate-spin' : ''} />
          {meta.label}
        </span>
      </td>
      <td className="px-4 py-3 text-muted tabular-nums">{formatDuration(row.duration_minutes)}</td>
      <td className="px-4 py-3 text-muted">{formatDate(row.submitted_at)}</td>
    </tr>
  )
}
