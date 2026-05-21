'use client'

import { useState, useTransition } from 'react'

interface Video {
  video_id: string
  video_name: string
  duration_minutes: number
  is_active: boolean
  chunk_count: number
  agents: string[]
}

interface EditState {
  videoId: string
  agents: string[]
}

const AGENT_LABELS: Record<string, { label: string; color: string }> = {
  'content-hook':        { label: 'Content & Hook',    color: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
  'funnel-monetization': { label: 'Funnel & Sales',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' },
  'personal-growth':     { label: 'Personal Growth',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400' },
  'ai-prompt':           { label: 'KI-Prompt',         color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  'upro':           { label: 'UPRO AI Lab',         color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400' },
  'business-coach':      { label: 'Business Coach',    color: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' },
}

const ALL_AGENTS = Object.keys(AGENT_LABELS)

async function toggleVideo(videoId: string, active: boolean) {
  await fetch('/api/admin/knowledge', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: videoId, is_active: active }),
  })
}

async function saveAgents(videoId: string, agents: string[]) {
  await fetch('/api/admin/knowledge', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: videoId, agents }),
  })
}

export function KnowledgeTable({ videos }: { videos: Video[] }) {
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(videos.map((v) => [v.video_id, v.is_active]))
  )
  const [agentStates, setAgentStates] = useState<Record<string, string[]>>(
    Object.fromEntries(videos.map((v) => [v.video_id, v.agents]))
  )
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [editing, setEditing] = useState<EditState | null>(null)

  const filtered = videos.filter((v) => {
    const matchSearch = v.video_name.toLowerCase().includes(search.toLowerCase())
    const matchAgent  = agentFilter === 'all' || v.agents.includes(agentFilter)
    return matchSearch && matchAgent
  })

  const handleToggle = (videoId: string) => {
    const newVal = !states[videoId]
    setStates((prev) => ({ ...prev, [videoId]: newVal }))
    startTransition(async () => { await toggleVideo(videoId, newVal) })
  }

  const handleEditAgents = (video: Video) => {
    setEditing({ videoId: video.video_id, agents: [...agentStates[video.video_id]] })
  }

  const handleToggleEditAgent = (agentId: string) => {
    if (!editing) return
    setEditing((prev) => {
      if (!prev) return prev
      const has = prev.agents.includes(agentId)
      return {
        ...prev,
        agents: has ? prev.agents.filter((a) => a !== agentId) : [...prev.agents, agentId],
      }
    })
  }

  const handleSaveAgents = () => {
    if (!editing) return
    const { videoId, agents } = editing
    setAgentStates((prev) => ({ ...prev, [videoId]: agents }))
    setEditing(null)
    startTransition(async () => { await saveAgents(videoId, agents) })
  }

  const handleToggleAll = (active: boolean) => {
    const newStates = { ...states }
    filtered.forEach((v) => { newStates[v.video_id] = active })
    setStates(newStates)
    startTransition(async () => {
      await Promise.all(filtered.map((v) => toggleVideo(v.video_id, active)))
    })
  }

  return (
    <div className="space-y-4">
      {/* Agent Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setAgentFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            agentFilter === 'all'
              ? 'bg-primary text-white border-primary'
              : 'bg-surface border-border text-muted hover:text-foreground'
          }`}
        >
          Alle ({videos.length})
        </button>
        {ALL_AGENTS.map((id) => {
          const count = videos.filter((v) => v.agents.includes(id)).length
          const { label, color } = AGENT_LABELS[id]
          return (
            <button
              key={id}
              onClick={() => setAgentFilter(id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                agentFilter === id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface border-border text-muted hover:text-foreground'
              }`}
            >
              {label} ({count})
            </button>
          )
        })}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <input
            type="text"
            placeholder="Videos suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm bg-surface-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={() => handleToggleAll(true)}
            className="text-xs px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
          >
            Alle aktivieren
          </button>
          <button
            onClick={() => handleToggleAll(false)}
            className="text-xs px-3 py-2 rounded-lg bg-surface-secondary text-muted hover:bg-border transition-colors whitespace-nowrap"
          >
            Alle deaktivieren
          </button>
        </div>

        {/* Table */}
        <div className="divide-y divide-border">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted text-sm">
              {videos.length === 0 ? 'Noch keine Videos transkribiert.' : 'Keine Videos gefunden.'}
            </div>
          )}
          {filtered.map((video) => {
            const active = states[video.video_id] ?? video.is_active
            const agents = agentStates[video.video_id] ?? video.agents
            const isEditing = editing?.videoId === video.video_id

            return (
              <div
                key={video.video_id}
                className={`px-4 py-3 transition-colors ${active ? '' : 'opacity-50'}`}
              >
                <div className="flex items-center gap-4">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(video.video_id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none ${
                      active ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${
                      active ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>

                  {/* Video info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{video.video_name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted">
                        {Math.round(video.duration_minutes)} min · {video.chunk_count} Abschnitte
                      </span>
                      {agents.map((a) => {
                        const info = AGENT_LABELS[a]
                        if (!info) return null
                        return (
                          <span key={a} className={`text-xs px-1.5 py-0.5 rounded-full ${info.color}`}>
                            {info.label}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    active
                      ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                      : 'bg-surface-secondary text-muted'
                  }`}>
                    {active ? 'Aktiv' : 'Deaktiviert'}
                  </span>

                  {/* Edit button */}
                  <button
                    onClick={() => isEditing ? setEditing(null) : handleEditAgents(video)}
                    className="shrink-0 text-xs px-2 py-1 rounded-lg bg-surface-secondary text-muted hover:text-foreground hover:bg-border transition-colors"
                    title="Agenten bearbeiten"
                  >
                    {isEditing ? '✕' : '✎'}
                  </button>
                </div>

                {/* Inline agent editor */}
                {isEditing && editing && (
                  <div className="mt-3 ml-13 pl-1">
                    <p className="text-xs text-muted mb-2">Agenten zuweisen:</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {ALL_AGENTS.map((agentId) => {
                        const { label, color } = AGENT_LABELS[agentId]
                        const selected = editing.agents.includes(agentId)
                        return (
                          <button
                            key={agentId}
                            onClick={() => handleToggleEditAgent(agentId)}
                            className={`text-xs px-2.5 py-1 rounded-full border-2 transition-all ${
                              selected
                                ? `${color} border-current opacity-100`
                                : 'bg-surface-secondary text-muted border-transparent opacity-60 hover:opacity-100'
                            }`}
                          >
                            {selected ? '✓ ' : ''}{label}
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveAgents}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                      >
                        Speichern
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-surface-secondary text-muted hover:bg-border transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
