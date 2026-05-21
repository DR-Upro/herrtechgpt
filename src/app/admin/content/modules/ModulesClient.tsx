'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Edit, Trash2, Eye, EyeOff, GripVertical, BookOpen, Loader2, AlertTriangle } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Module {
  id: string
  title: string
  slug: string
  description: string
  emoji: string
  sort_order: number
  is_published: boolean
  videoCount: number
  draftCount: number
  missingWistiaCount: number
}

export function ModulesClient({ initialModules }: { initialModules: Module[] }) {
  const router = useRouter()
  const [modules, setModules] = useState(initialModules)
  const [editing, setEditing] = useState<Module | null>(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setModules(initialModules), [initialModules])
  useEffect(() => setMounted(true), [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = modules.findIndex(m => m.id === active.id)
    const newIndex = modules.findIndex(m => m.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(modules, oldIndex, newIndex).map((m, i) => ({ ...m, sort_order: i + 1 }))
    setModules(next)
    await fetch('/api/admin/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'course_modules',
        items: next.map(m => ({ id: m.id, sort_order: m.sort_order })),
      }),
    })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
    router.refresh()
  }

  const handleSave = async (module: Partial<Module>) => {
    setLoading('save')
    const isNew = !module.id
    const res = await fetch('/api/admin/modules', {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(module),
    })
    setLoading(null)
    if (res.ok) {
      router.refresh()
      setEditing(null)
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setLoading(id)
    await fetch(`/api/admin/modules?id=${id}`, { method: 'DELETE' })
    setLoading(null)
    setConfirmDelete(null)
    setModules(modules.filter(m => m.id !== id))
    router.refresh()
  }

  const handleTogglePublish = async (m: Module) => {
    setLoading(m.id)
    await fetch('/api/admin/modules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, is_published: !m.is_published }),
    })
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Module verwalten</h1>
          <p className="text-sm text-muted mt-1">
            {modules.length} Module · Ziehen zum Sortieren
            {savedFlash && <span className="ml-2 text-primary">· Gespeichert ✓</span>}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="btn-primary"
        >
          <Plus size={16} />
          Neues Modul
        </button>
      </div>

      {/* Empty state — needs migration */}
      {modules.length === 0 && (
        <div className="card-static p-8 text-center">
          <BookOpen size={40} className="text-muted mx-auto mb-3" />
          <h2 className="font-semibold text-foreground mb-2">Noch keine Module</h2>
          <p className="text-sm text-muted mb-4">
            Falls die Datenbank-Migration noch nicht ausgeführt wurde:<br />
            <a
              href="https://supabase.com/dashboard/project/kgolrqjkghhwdgoeyppt/sql/new"
              target="_blank"
              className="text-primary hover:underline"
            >
              Supabase SQL Editor öffnen
            </a> und <code className="bg-surface-secondary px-1 rounded">supabase/migrations/007_course_modules.sql</code> ausführen.
          </p>
        </div>
      )}

      {/* Module list. DndContext only renders after mount — dnd-kit's random IDs mismatch between SSR and hydration. */}
      <div suppressHydrationWarning>
        {mounted && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {modules.map((m) => (
                  <SortableModuleRow
                    key={m.id}
                    module={m}
                    onEdit={() => setEditing(m)}
                    onTogglePublish={() => handleTogglePublish(m)}
                    onDelete={() => handleDelete(m.id)}
                    confirmingDelete={confirmDelete === m.id}
                    setConfirmingDelete={(c) => setConfirmDelete(c ? m.id : null)}
                    loading={loading === m.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Edit / Create Modal */}
      {(editing || creating) && (
        <ModuleEditModal
          module={editing}
          onSave={handleSave}
          onClose={() => { setEditing(null); setCreating(false) }}
          saving={loading === 'save'}
        />
      )}
    </div>
  )
}

function SortableModuleRow({
  module,
  onEdit,
  onTogglePublish,
  onDelete,
  confirmingDelete,
  setConfirmingDelete,
  loading,
}: {
  module: Module
  onEdit: () => void
  onTogglePublish: () => void
  onDelete: () => void
  confirmingDelete: boolean
  setConfirmingDelete: (c: boolean) => void
  loading: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: module.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card-static p-4 flex items-center gap-3 bg-background ${isDragging ? 'z-10 shadow-lg' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted hover:text-foreground touch-none cursor-grab active:cursor-grabbing p-0.5"
        aria-label="Verschieben"
      >
        <GripVertical size={16} />
      </button>
      <span className="text-2xl shrink-0">{module.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-muted font-mono">{module.sort_order}</span>
          <h3 className="font-semibold text-foreground truncate">{module.title}</h3>
          {!module.is_published && (
            <span className="text-xs px-1.5 py-0.5 bg-muted/10 text-muted rounded">Entwurf</span>
          )}
        </div>
        <p className="text-xs text-muted truncate">{module.description}</p>
        <p className="text-xs text-muted mt-0.5 inline-flex items-center flex-wrap gap-1.5">
          <span>{module.videoCount} Videos</span>
          {module.draftCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#C9A04A]/15 text-[#B08A3A] font-medium">
              {module.draftCount} {module.draftCount === 1 ? 'Entwurf' : 'Entwürfe'}
            </span>
          )}
          {module.missingWistiaCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-medium" title="Lektionen mit Skool-nativem Video — müssen manuell zu Wistia hochgeladen werden">
              <AlertTriangle size={10} />
              {module.missingWistiaCount} Skool→Wistia
            </span>
          )}
          <span className="ml-0.5">· /{module.slug}</span>
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onTogglePublish}
          title={module.is_published ? 'Verstecken' : 'Veröffentlichen'}
          className="p-2 text-muted hover:text-foreground hover:bg-surface-hover rounded-[var(--radius-md)] transition-colors"
        >
          {module.is_published ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        <Link
          href={`/admin/content/modules/${module.id}`}
          className="p-2 text-muted hover:text-foreground hover:bg-surface-hover rounded-[var(--radius-md)] transition-colors"
          title="Videos verwalten"
        >
          <BookOpen size={16} />
        </Link>
        <button
          onClick={onEdit}
          className="p-2 text-muted hover:text-foreground hover:bg-surface-hover rounded-[var(--radius-md)] transition-colors"
          title="Bearbeiten"
        >
          <Edit size={16} />
        </button>
        {confirmingDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={onDelete}
              disabled={loading}
              className="text-xs bg-danger text-white px-2 py-1 rounded-[var(--radius-md)]"
            >
              {loading ? '...' : 'Bestätigen'}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="text-xs text-muted px-2 py-1"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="p-2 text-danger hover:bg-danger/10 rounded-[var(--radius-md)] transition-colors"
            title="Löschen"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

function ModuleEditModal({
  module,
  onSave,
  onClose,
  saving,
}: {
  module: Module | null
  onSave: (m: Partial<Module>) => void
  onClose: () => void
  saving: boolean
}) {
  const [title, setTitle] = useState(module?.title ?? '')
  const [slug, setSlug] = useState(module?.slug ?? '')
  const [emoji, setEmoji] = useState(module?.emoji ?? '📚')
  const [description, setDescription] = useState(module?.description ?? '')
  const [sortOrder, setSortOrder] = useState(module?.sort_order ?? 999)
  const [isPublished, setIsPublished] = useState(module?.is_published ?? true)

  const handleSubmit = () => {
    if (!title.trim()) return
    onSave({
      ...(module ? { id: module.id } : {}),
      title: title.trim(),
      slug: slug.trim() || undefined,
      emoji,
      description,
      sort_order: sortOrder,
      is_published: isPublished,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="card-static p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {module ? 'Modul bearbeiten' : 'Neues Modul'}
        </h2>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-20">
              <label className="block text-xs font-medium text-muted mb-1.5">Emoji</label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-[var(--radius-md)] bg-background text-2xl text-center"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted mb-1.5">Titel</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-[var(--radius-md)] bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Slug (URL)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto-generated"
              className="w-full px-3 py-2 border border-border rounded-[var(--radius-md)] bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-[var(--radius-md)] bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted mb-1.5">Reihenfolge</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 999)}
                className="w-full px-3 py-2 border border-border rounded-[var(--radius-md)] bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted mb-1.5">Status</label>
              <button
                onClick={() => setIsPublished(!isPublished)}
                className={`w-full px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                  isPublished ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-surface-secondary text-muted'
                }`}
              >
                {isPublished ? '✓ Veröffentlicht' : '○ Entwurf'}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-border">
            <button onClick={onClose} className="btn-ghost border border-border flex-1 justify-center">
              Abbrechen
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !title.trim()}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Speichere...</> : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
