import { createAdminClient } from '@/lib/supabase/admin'
import { FilePlus, FileText, Database, Tags } from 'lucide-react'
import { TextIngestForm } from './TextIngestForm'

export const dynamic = 'force-dynamic'

type KbRow = {
  video_id: string
  video_name: string
  chunk_index: number
  is_active: boolean
  source: string | null
  relevant_agents: string[] | null
  created_at: string
}

interface SourceSummary {
  video_id: string
  video_name: string
  chunks: number
  active_chunks: number
  agents: string[]
  created_at: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AdminTextIngestPage() {
  const supabase = createAdminClient()

  const { data: textRowsRaw } = await supabase
    .from('knowledge_base')
    .select('video_id, video_name, chunk_index, is_active, source, relevant_agents, created_at')
    .eq('source', 'text')
    .order('created_at', { ascending: false })
    .limit(2000)

  const textRows = (textRowsRaw ?? []) as KbRow[]

  const grouped = new Map<string, SourceSummary>()
  for (const row of textRows) {
    const existing = grouped.get(row.video_id)
    if (!existing) {
      grouped.set(row.video_id, {
        video_id: row.video_id,
        video_name: row.video_name,
        chunks: 1,
        active_chunks: row.is_active ? 1 : 0,
        agents: row.relevant_agents ?? [],
        created_at: row.created_at,
      })
    } else {
      existing.chunks += 1
      if (row.is_active) existing.active_chunks += 1
      // Agenten aus dem ersten Schnipsel reichen — sind pro video_id identisch
    }
  }

  const sources = Array.from(grouped.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )

  const totalChunks = textRows.length
  const activeChunks = textRows.filter((r) => r.is_active).length

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Wissen einkippen</h1>
        <p className="text-sm text-muted">
          Eigene Texte oder Markdown-Dateien direkt in die Wissensbasis schieben — ohne
          den Umweg über Videos. Die Inhalte werden zerlegt, bei Bedarf ins Deutsche
          übersetzt und automatisch den passenden Agenten zugeordnet.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Eingekippte Quellen" value={sources.length} Icon={FileText} />
        <StatCard label="Schnipsel gesamt" value={totalChunks} Icon={Database} />
        <StatCard label="Aktive Schnipsel" value={activeChunks} Icon={Tags} />
      </div>

      <TextIngestForm />

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Bisher eingekippt ({sources.length})
        </h2>
        {sources.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-sm text-muted text-center">
            Noch nichts eingekippt. Füge oben Text ein oder lade eine Datei hoch.
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted">Titel</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Schnipsel</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Agenten</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Eingekippt</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.video_id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                    <td className="px-4 py-3 text-foreground">{s.video_name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {s.active_chunks}
                      {s.active_chunks !== s.chunks && (
                        <span className="text-xs opacity-60"> / {s.chunks}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.agents.length === 0 ? (
                        <span className="text-xs text-muted">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s.agents.map((a) => (
                            <span
                              key={a}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(s.created_at)}</td>
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
}: {
  label: string
  value: number
  Icon: typeof FilePlus
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted">{label}</span>
        <Icon size={14} className="text-primary" />
      </div>
      <div className="text-2xl font-bold text-primary">{value}</div>
    </div>
  )
}
