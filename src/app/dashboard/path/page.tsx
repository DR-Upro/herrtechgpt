import { createClient } from '@/lib/supabase/server'
import { agents as allAgents } from '@/lib/agents'
import Link from 'next/link'
import { redirect } from 'next/navigation'

interface LearningPath {
  greeting?: string
  focus_summary?: string
  videos?: Array<{
    id: string
    /** Modul-Slug für direkten Classroom-Link (neu seit W10) — kann bei
        alten Lernpfaden noch fehlen, dann fallback auf Search-Query. */
    slug?: string
    title: string
    why: string
  }>
  agents?: Array<{ id: string; why: string }>
  milestones?: { '30'?: string[]; '60'?: string[]; '90'?: string[] }
}

/** Erzeugt den Direkt-Link zur Lektion. Fällt auf Suche zurück wenn der
    alte Lernpfad noch keinen slug hat (Pre-W10 generiert). */
function videoHref(v: { id: string; slug?: string; title: string }): string {
  if (v.slug) return `/dashboard/classroom/${v.slug}?video=${encodeURIComponent(v.id)}`
  return `/dashboard/classroom?q=${encodeURIComponent(v.title)}`
}

export default async function LearningPathPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('learning_path, learning_path_generated_at, primary_goal, experience_level')
    .eq('id', user.id)
    .single()

  const path = (profile?.learning_path as LearningPath) ?? {}
  const hasPath = path.videos && path.videos.length > 0

  if (!hasPath) {
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-background">
        <div className="max-w-2xl mx-auto w-full px-6 py-12 text-center">
          <div className="text-5xl mb-5">🎯</div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Noch kein Lernpfad</h1>
          <p className="text-sm text-muted mb-6">
            Mach das Onboarding-Quiz und erhalte in 15 Sekunden einen individuellen Lernpfad mit den für dich wichtigsten Videos und einem 30/60/90-Tage-Plan.
          </p>
          <Link
            href="/dashboard/onboarding"
            className="inline-block px-6 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Quiz starten →
          </Link>
        </div>
      </div>
    )
  }

  const recommendedAgents = (path.agents ?? []).map((a) => {
    const full = allAgents.find((x) => x.id === a.id)
    return { ...a, agent: full }
  }).filter((a) => a.agent)

  const generatedDate = profile?.learning_path_generated_at
    ? new Date(profile.learning_path_generated_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto w-full px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🎯</span>
            <h1 className="text-2xl font-bold text-foreground">Dein Lernpfad</h1>
          </div>
          {path.greeting && (
            <p className="text-sm text-foreground leading-relaxed">{path.greeting}</p>
          )}
          {path.focus_summary && (
            <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Dein Fokus</p>
              <p className="text-sm text-foreground font-medium">{path.focus_summary}</p>
            </div>
          )}
        </div>

        {/* Videos */}
        {path.videos && path.videos.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
              🎬 Deine nächsten {path.videos.length} Videos
            </h2>
            <div className="space-y-2">
              {path.videos.map((v, i) => (
                <Link
                  key={v.id}
                  href={videoHref(v)}
                  className="flex gap-4 p-4 rounded-xl border border-border bg-surface hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary">{v.title}</p>
                    <p className="text-xs text-muted leading-relaxed">{v.why}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Agents */}
        {recommendedAgents.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
              🤖 Start mit diesen Assistenten
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendedAgents.map(({ agent, why }) => (
                <Link
                  key={agent!.id}
                  href={`/dashboard/ai-workspace?agent=${agent!.id}`}
                  className="group flex gap-3 p-4 rounded-xl border border-border bg-surface hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center text-xl shrink-0">
                    {agent!.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground mb-0.5">{agent!.name}</p>
                    <p className="text-xs text-muted leading-snug">{why}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Milestones */}
        {path.milestones && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
              📅 Dein 30/60/90-Tage-Plan
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {([30, 60, 90] as const).map((days) => {
                const items = path.milestones?.[String(days) as '30' | '60' | '90'] ?? []
                if (items.length === 0) return null
                return (
                  <div
                    key={days}
                    className="p-4 rounded-xl border border-border bg-surface"
                  >
                    <p className="text-xs font-bold text-primary mb-3">{days} Tage</p>
                    <ul className="space-y-2">
                      {items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-foreground">
                          <span className="text-primary shrink-0">•</span>
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Regenerate */}
        <div className="flex items-center justify-between pt-6 border-t border-border text-xs text-muted">
          {generatedDate && <p>Erstellt am {generatedDate}</p>}
          <Link
            href="/dashboard/onboarding"
            className="text-primary hover:underline"
          >
            Pfad neu erstellen
          </Link>
        </div>
      </div>
    </div>
  )
}
