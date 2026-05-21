import { createClient } from '@/lib/supabase/server'
import { agents } from '@/lib/agents'
import type { CoreTool } from '@/lib/types'
import ToolsManager from './ToolsManager'

export const dynamic = 'force-dynamic'

export default async function AdminToolsPage() {
  const supabase = await createClient()
  const { data: tools } = await supabase
    .from('core_tools')
    .select('*')
    .order('sort_order', { ascending: true })

  const agentOptions = agents.map((a) => ({
    id: a.id,
    name: a.name,
    emoji: a.emoji,
  }))

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">UPRO AI Lab Tech-Stack</h1>
        <p className="text-muted max-w-2xl">
          Zentrale Liste aller Tools, die die Assistenten empfehlen dürfen. Diese Liste
          wird bei jedem Chat in den System-Prompt injiziert — Änderungen wirken sofort,
          ohne Deploy.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 bg-primary/5 text-primary text-xs rounded-lg px-3 py-2 border border-primary/20">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Assistenten empfehlen nur noch Tools von hier. Andere Tools werden höflich auf Alternativen aus dieser Liste umgeleitet.
        </div>
      </div>

      <ToolsManager
        initialTools={(tools as CoreTool[]) ?? []}
        agentOptions={agentOptions}
      />
    </div>
  )
}
