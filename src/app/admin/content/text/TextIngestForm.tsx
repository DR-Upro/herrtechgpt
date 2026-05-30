'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardPaste,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  X,
} from 'lucide-react'

type Lang = 'de' | 'en' | 'es' | 'fr'
const LANG_OPTIONS: Array<{ value: Lang; label: string }> = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'Englisch' },
  { value: 'es', label: 'Spanisch' },
  { value: 'fr', label: 'Französisch' },
]

interface ItemResult {
  title: string
  ok: boolean
  chunks?: number
  agents?: string[]
  translated_from?: string
  error?: string
}

interface IngestResponse {
  ok: boolean
  total?: number
  success?: number
  results?: ItemResult[]
  error?: string
}

type Mode = 'paste' | 'files'

interface FileEntry {
  title: string
  text: string
  size: number
}

function stripExtension(name: string): string {
  return name.replace(/\.[^./]+$/, '').trim() || 'Ohne Titel'
}

export function TextIngestForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<Mode>('paste')
  const [language, setLanguage] = useState<Lang>('de')
  const [results, setResults] = useState<ItemResult[] | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Paste-Mode
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')

  // Files-Mode
  const [files, setFiles] = useState<FileEntry[]>([])

  const isWorking = pending

  const handleFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const entries: FileEntry[] = []
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList.item(i)
      if (!f) continue
      const text = await f.text()
      entries.push({
        title: stripExtension(f.name),
        text,
        size: f.size,
      })
    }
    setFiles((prev) => [...prev, ...entries])
    e.target.value = ''
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = () => {
    setResults(null)
    setGlobalError(null)
    const items =
      mode === 'paste'
        ? [{ title: pasteTitle.trim() || 'Ohne Titel', text: pasteText, language }]
        : files.map((f) => ({ title: f.title, text: f.text, language }))

    const nonEmpty = items.filter((it) => it.text.trim().length > 0)
    if (nonEmpty.length === 0) {
      setGlobalError(
        mode === 'paste' ? 'Bitte Text einfügen.' : 'Bitte mindestens eine Datei wählen.',
      )
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/knowledge/text-ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: nonEmpty }),
        })
        const data: IngestResponse = await res.json()
        if (!res.ok) {
          setGlobalError(data.error ?? 'Einkippen fehlgeschlagen')
          return
        }
        setResults(data.results ?? [])
        // Erfolg → Felder leeren, Seite neu laden für aktuelle Liste
        if ((data.success ?? 0) > 0) {
          setPasteTitle('')
          setPasteText('')
          setFiles([])
          router.refresh()
        }
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      }
    })
  }

  const okCount = results?.filter((r) => r.ok).length ?? 0
  const failCount = results?.filter((r) => !r.ok).length ?? 0

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-6">
      {/* Mode-Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setMode('paste')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            mode === 'paste'
              ? 'bg-primary text-white'
              : 'bg-surface-secondary text-muted hover:text-foreground'
          }`}
        >
          <ClipboardPaste size={14} />
          Text einfügen
        </button>
        <button
          type="button"
          onClick={() => setMode('files')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            mode === 'files'
              ? 'bg-primary text-white'
              : 'bg-surface-secondary text-muted hover:text-foreground'
          }`}
        >
          <Upload size={14} />
          Dateien hochladen
        </button>
      </div>

      {/* Paste-Mode */}
      {mode === 'paste' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Titel</label>
            <input
              type="text"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder="z. B. „Newsletter-Hooks aus dem Academy-Kapitel 3"
              className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Text</label>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Inhalt hier einfügen — kann auch Markdown sein."
              rows={10}
              className="w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
            <div className="text-xs text-muted mt-1">
              {pasteText.length.toLocaleString('de-DE')} Zeichen
            </div>
          </div>
        </div>
      )}

      {/* Files-Mode */}
      {mode === 'files' && (
        <div className="space-y-3">
          <label className="block cursor-pointer">
            <input
              type="file"
              accept=".md,.txt,.markdown"
              multiple
              onChange={handleFilesChosen}
              className="hidden"
            />
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <Upload size={20} className="mx-auto text-muted mb-2" />
              <div className="text-sm font-medium text-foreground">
                Dateien wählen (.md, .txt)
              </div>
              <div className="text-xs text-muted mt-0.5">
                Mehrere Dateien gleichzeitig möglich. Dateiname wird als Titel genommen.
              </div>
            </div>
          </label>

          {files.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted">
                {files.length} {files.length === 1 ? 'Datei' : 'Dateien'} bereit
              </div>
              {files.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-surface-secondary border border-border rounded-lg px-3 py-2"
                >
                  <FileText size={14} className="text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{f.title}</div>
                    <div className="text-xs text-muted">
                      {f.text.length.toLocaleString('de-DE')} Zeichen
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    disabled={isWorking}
                    className="text-muted hover:text-foreground disabled:opacity-50"
                    aria-label="Entfernen"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sprache + Knopf */}
      <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border">
        <label className="text-xs text-muted">
          Sprache des Inhalts:
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Lang)}
            disabled={isWorking}
            className="ml-2 text-sm bg-surface-secondary border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          >
            {LANG_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isWorking}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isWorking ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Wird verarbeitet …
            </>
          ) : (
            <>
              <Upload size={16} />
              In Wissensbasis einkippen
            </>
          )}
        </button>
      </div>

      {/* Global-Fehler */}
      {globalError && (
        <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-900 text-sm dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-200">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle size={14} />
            {globalError}
          </div>
        </div>
      )}

      {/* Ergebnisse */}
      {results && results.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2 text-sm">
            <CheckCircle2 size={14} className="text-green-600 dark:text-green-400" />
            <span className="font-medium text-foreground">
              {okCount} erfolgreich
            </span>
            {failCount > 0 && (
              <>
                <span className="text-muted">·</span>
                <AlertCircle size={14} className="text-red-600 dark:text-red-400" />
                <span className="font-medium text-foreground">{failCount} fehlgeschlagen</span>
              </>
            )}
          </div>
          <div className="space-y-1.5">
            {results.map((r, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border text-xs ${
                  r.ok
                    ? 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-200'
                    : 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-200'
                }`}
              >
                <div className="font-medium">{r.title}</div>
                {r.ok ? (
                  <div className="opacity-80 mt-0.5">
                    {r.chunks} Schnipsel
                    {r.translated_from && ` · aus ${r.translated_from} übersetzt`}
                    {r.agents && r.agents.length > 0 && ` · Agenten: ${r.agents.join(', ')}`}
                  </div>
                ) : (
                  <div className="opacity-80 mt-0.5 font-mono">{r.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
