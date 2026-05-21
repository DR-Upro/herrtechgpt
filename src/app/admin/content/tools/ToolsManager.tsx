'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CoreTool, CoreToolCategory, CoreToolTier } from '@/lib/types'

interface AgentOption {
  id: string
  name: string
  emoji: string
}

interface Props {
  initialTools: CoreTool[]
  agentOptions: AgentOption[]
}

const CATEGORIES: { value: CoreToolCategory; label: string }[] = [
  { value: 'ki-chat', label: 'KI-Chat' },
  { value: 'automation', label: 'Automation' },
  { value: 'video', label: 'Video-Generation' },
  { value: 'video-edit', label: 'Video-Schnitt' },
  { value: 'video-avatar', label: 'Video-Avatare' },
  { value: 'image', label: 'Bildgenerierung' },
  { value: 'coding', label: 'Coding' },
  { value: 'knowledge', label: 'Knowledge / Notes' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Sonstiges' },
]

const TIERS: { value: CoreToolTier; label: string; description: string }[] = [
  { value: 'primary', label: 'Primary', description: 'Wird zuerst empfohlen' },
  { value: 'secondary', label: 'Secondary', description: 'Nur wenn primary nicht passt' },
  { value: 'fallback', label: 'Fallback', description: 'Nur wenn User explizit fragt' },
]

function emptyTool(): CoreTool {
  return {
    id: '',
    name: '',
    category: 'other',
    tier: 'primary',
    what_for: '',
    why_we_use_it: '',
    alternatives_handled: [],
    relevant_agents: [],
    url: '',
    icon: '',
    active: true,
    sort_order: 0,
    created_at: '',
    updated_at: '',
  }
}

export default function ToolsManager({ initialTools, agentOptions }: Props) {
  const router = useRouter()
  const [tools, setTools] = useState<CoreTool[]>(initialTools)
  const [editing, setEditing] = useState<CoreTool | null>(null)
  const [isNew, setIsNew] = useState(false)

  function handleAdd() {
    setEditing(emptyTool())
    setIsNew(true)
  }

  function handleEdit(tool: CoreTool) {
    setEditing({ ...tool })
    setIsNew(false)
  }

  async function handleSave(tool: CoreTool) {
    const res = await fetch('/api/admin/tools', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tool),
    })

    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? 'Fehler beim Speichern')
      return
    }

    const saved = (await res.json()) as CoreTool
    setTools((prev) => {
      const exists = prev.some((t) => t.id === saved.id)
      if (exists) return prev.map((t) => (t.id === saved.id ? saved : t))
      return [...prev, saved].sort((a, b) => a.sort_order - b.sort_order)
    })
    setEditing(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm(`Tool "${id}" wirklich löschen?`)) return

    const res = await fetch(`/api/admin/tools?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })

    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? 'Fehler beim Löschen')
      return
    }

    setTools((prev) => prev.filter((t) => t.id !== id))
    setEditing(null)
    router.refresh()
  }

  async function handleToggleActive(tool: CoreTool) {
    await handleSave({ ...tool, active: !tool.active })
  }

  const groupedByTier: Record<CoreToolTier, CoreTool[]> = {
    primary: tools.filter((t) => t.tier === 'primary'),
    secondary: tools.filter((t) => t.tier === 'secondary'),
    fallback: tools.filter((t) => t.tier === 'fallback'),
  }

  return (
    <div className="space-y-6">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
        >
          + Neues Tool
        </button>
      </div>

      {/* Tool groups */}
      {TIERS.map((tier) => {
        const list = groupedByTier[tier.value]
        if (list.length === 0) return null

        return (
          <div key={tier.value}>
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-lg font-semibold text-foreground">{tier.label}</h2>
              <p className="text-xs text-muted">{tier.description}</p>
            </div>

            <div className="space-y-2">
              {list.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  agentOptions={agentOptions}
                  onEdit={() => handleEdit(tool)}
                  onToggleActive={() => handleToggleActive(tool)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {tools.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <p className="text-muted">Noch keine Tools angelegt.</p>
          <button
            onClick={handleAdd}
            className="mt-4 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
          >
            Erstes Tool anlegen
          </button>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <ToolEditModal
          tool={editing}
          isNew={isNew}
          agentOptions={agentOptions}
          onSave={handleSave}
          onDelete={isNew ? undefined : () => handleDelete(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ToolCard({
  tool,
  agentOptions,
  onEdit,
  onToggleActive,
}: {
  tool: CoreTool
  agentOptions: AgentOption[]
  onEdit: () => void
  onToggleActive: () => void
}) {
  const agentBadges = tool.relevant_agents
    .map((id) => agentOptions.find((a) => a.id === id))
    .filter((a): a is AgentOption => !!a)

  return (
    <div
      className={`bg-surface border border-border rounded-xl p-4 flex items-start gap-4 ${
        !tool.active ? 'opacity-50' : ''
      }`}
    >
      <span className="text-2xl shrink-0 mt-0.5">{tool.icon ?? '🔧'}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-foreground">{tool.name}</h3>
          <code className="text-xs bg-surface-secondary text-muted px-1.5 py-0.5 rounded">
            {tool.id}
          </code>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {tool.category}
          </span>
          {!tool.active && (
            <span className="text-xs bg-surface-secondary text-muted px-2 py-0.5 rounded-full">
              Deaktiviert
            </span>
          )}
        </div>

        <p className="text-sm text-foreground mt-1">{tool.what_for}</p>
        {tool.why_we_use_it && (
          <p className="text-xs text-muted mt-1 italic">&ldquo;{tool.why_we_use_it}&rdquo;</p>
        )}

        {agentBadges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {agentBadges.map((a) => (
              <span
                key={a.id}
                className="text-xs bg-surface-secondary px-2 py-0.5 rounded-full text-muted"
                title={a.name}
              >
                {a.emoji} {a.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={tool.active}
          onClick={onToggleActive}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            tool.active ? 'bg-primary' : 'bg-border'
          }`}
          title={tool.active ? 'Aktiv' : 'Deaktiviert'}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              tool.active ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-surface-secondary transition-colors text-foreground"
        >
          Bearbeiten
        </button>
      </div>
    </div>
  )
}

function ToolEditModal({
  tool,
  isNew,
  agentOptions,
  onSave,
  onDelete,
  onClose,
}: {
  tool: CoreTool
  isNew: boolean
  agentOptions: AgentOption[]
  onSave: (tool: CoreTool) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState<CoreTool>(tool)
  const [alternativesText, setAlternativesText] = useState(
    (tool.alternatives_handled ?? []).join(', ')
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const alternatives = alternativesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    await onSave({
      ...form,
      alternatives_handled: alternatives,
    })
    setSaving(false)
  }

  function toggleAgent(agentId: string) {
    setForm((f) => {
      const exists = f.relevant_agents.includes(agentId)
      return {
        ...f,
        relevant_agents: exists
          ? f.relevant_agents.filter((a) => a !== agentId)
          : [...f.relevant_agents, agentId],
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {isNew ? 'Neues Tool anlegen' : `${form.name} bearbeiten`}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-foreground p-1 rounded"
              aria-label="Schließen"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* ID + Name + Icon */}
          <div className="grid grid-cols-[100px_80px_1fr] gap-3">
            <Field label="ID (slug)">
              <input
                type="text"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                required
                disabled={!isNew}
                placeholder="claude"
                className="w-full bg-surface-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground font-mono disabled:opacity-60"
              />
            </Field>
            <Field label="Icon">
              <input
                type="text"
                value={form.icon ?? ''}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                maxLength={2}
                placeholder="🤖"
                className="w-full text-center text-xl bg-surface-secondary border border-border rounded-lg px-2 py-2"
              />
            </Field>
            <Field label="Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Claude"
                className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </Field>
          </div>

          {/* Category + Tier */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategorie">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as CoreToolCategory })}
                className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tier">
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value as CoreToolTier })}
                className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                {TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} — {t.description}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* What for */}
          <Field label="Wofür? (kurz, 1 Zeile)">
            <input
              type="text"
              value={form.what_for}
              onChange={(e) => setForm({ ...form, what_for: e.target.value })}
              required
              placeholder="Chat, Code, Agents, Reasoning"
              className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            />
          </Field>

          {/* Why we use it */}
          <Field label="Warum nutzen WIR es? (Begründung für den Assistenten)">
            <textarea
              value={form.why_we_use_it ?? ''}
              onChange={(e) => setForm({ ...form, why_we_use_it: e.target.value })}
              rows={2}
              placeholder="Beste Coding-Skills, stärkstes Reasoning, nativer Skills-Support."
              className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-y"
            />
          </Field>

          {/* Alternatives */}
          <Field label="Alternativen, die User fragen könnten (komma-getrennt)">
            <input
              type="text"
              value={alternativesText}
              onChange={(e) => setAlternativesText(e.target.value)}
              placeholder="ChatGPT, Gemini, Mistral"
              className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            />
            <p className="text-xs text-muted mt-1">
              Wenn ein User nach einem dieser Tools fragt, lenkt der Assistent höflich auf das UPRO AI Lab-Tool zurück.
            </p>
          </Field>

          {/* URL + Sort */}
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <Field label="URL">
              <input
                type="url"
                value={form.url ?? ''}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://claude.ai"
                className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </Field>
            <Field label="Sortierung">
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </Field>
          </div>

          {/* Relevant agents */}
          <Field label="Sichtbar für welche Assistenten?">
            <div className="grid grid-cols-2 gap-2">
              {agentOptions.map((a) => {
                const checked = form.relevant_agents.includes(a.id)
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                      checked
                        ? 'bg-primary/10 border-primary/30 text-foreground'
                        : 'bg-surface-secondary border-border text-muted hover:text-foreground'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAgent(a.id)}
                      className="w-4 h-4"
                    />
                    <span>{a.emoji}</span>
                    <span className="text-sm truncate">{a.name}</span>
                  </label>
                )
              })}
            </div>
          </Field>

          {/* Active */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              role="switch"
              aria-checked={form.active}
              onClick={() => setForm({ ...form, active: !form.active })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                form.active ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  form.active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm text-foreground">{form.active ? 'Aktiv' : 'Deaktiviert'}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Löschen
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-muted border border-border rounded-lg hover:bg-surface-secondary transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted mb-1.5">{label}</span>
      {children}
    </label>
  )
}
