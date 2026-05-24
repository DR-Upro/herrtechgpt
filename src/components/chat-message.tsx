'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  agentId?: string
  agentName?: string
}

// Typewriter-Effekt f\u00fcr Assistant-Text.
// Erste Render-Instanz: snap auf Content (History).
// Nachfolgende Content-Updates (Streaming): holt gleichm\u00e4\u00dfig auf (~120 chars/sec).
function useTypewriter(content: string): string {
  const [displayed, setDisplayed] = useState(content)
  const mountedRef = useRef(false)
  const targetRef = useRef(content)

  useEffect(() => {
    targetRef.current = content
    if (!mountedRef.current) {
      mountedRef.current = true
      setDisplayed(content)
      return
    }
    // Content k\u00fcrzer als Displayed (z.B. neue Nachricht) \u2192 reset
    if (content.length < displayed.length) {
      setDisplayed(content)
      return
    }
    if (displayed.length >= content.length) return

    const interval = setInterval(() => {
      setDisplayed((prev) => {
        const target = targetRef.current
        if (prev.length >= target.length) {
          clearInterval(interval)
          return target
        }
        const ahead = target.length - prev.length
        const step = Math.min(Math.max(2, Math.floor(ahead / 25)), 10)
        return target.slice(0, prev.length + step)
      })
    }, 16)
    return () => clearInterval(interval)
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  return displayed
}

function CopyableCodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    const text = extractText(children)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [children])

  return (
    <div className="relative group/code my-2">
      <pre className="bg-surface-secondary border border-border rounded-lg p-3 pr-10 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
        {children}
      </pre>
      <button
        onClick={handleCopy}
        title={copied ? 'Kopiert!' : 'Kopieren'}
        className={`absolute top-2 right-2 p-1.5 rounded-md border transition-all text-xs ${
          copied
            ? 'bg-green-50 border-green-200 text-green-600 dark:bg-green-950/30'
            : 'bg-surface border-border text-muted hover:text-foreground hover:bg-surface-hover'
        }`}
      >
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  )
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node && typeof node === 'object' && 'props' in (node as any)) {
    return extractText((node as any).props.children)
  }
  return ''
}

export function ChatMessage({ role, content, agentId, agentName }: ChatMessageProps) {
  const isUser = role === 'user'
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  // Typewriter nur f\u00fcr Assistant-Text (User-Input snappt direkt)
  const assistantContent = useTypewriter(content)

  const handleSave = async () => {
    if (saved || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, agentId, agentName }),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const handleCopyAll = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDownloadMd = () => {
    const slug = (agentName ?? 'antwort')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'antwort'
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
    const filename = `${slug}_${stamp}.md`
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-primary text-white text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    )
  }

  // Assistant message — no box, clean text like ChatGPT
  return (
    <div className="flex justify-start group">
      <div className="relative w-full">
        <div className="text-sm leading-relaxed text-foreground py-1">
          <ReactMarkdown
            remarkPlugins={[remarkBreaks, remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              h1: ({ children }) => <h1 className="font-bold text-base mb-2 mt-4 first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="font-semibold mb-2 mt-3 first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
              pre: ({ children }) => <CopyableCodeBlock>{children}</CopyableCodeBlock>,
              code: ({ children }) => {
                const isBlock = String(children).includes('\n')
                return isBlock
                  ? <code className="font-mono text-xs">{children}</code>
                  : <code className="bg-surface-secondary rounded px-1.5 py-0.5 font-mono text-xs">{children}</code>
              },
              hr: () => <hr className="border-border my-4" />,
            }}
          >
            {assistantContent}
          </ReactMarkdown>
        </div>

        {/* Action-Footer: Copy ganze Antwort + .md-Download + Save */}
        <div className="mt-1 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={handleCopyAll}
            title={copied ? 'Kopiert!' : 'Ganze Antwort kopieren'}
            className={`p-1.5 rounded-full border shadow-sm text-xs transition-all ${
              copied
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-600'
                : 'bg-surface border-border text-muted hover:text-primary hover:border-primary/30'
            }`}
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          <button
            onClick={handleDownloadMd}
            title="Als .md-Datei herunterladen"
            className="p-1.5 rounded-full border shadow-sm text-xs bg-surface border-border text-muted hover:text-primary hover:border-primary/30 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            title={saved ? 'Gespeichert!' : 'In Bibliothek speichern'}
            className={`p-1.5 rounded-full border shadow-sm text-xs transition-all ${
              saved
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-600'
                : 'bg-surface border-border text-muted hover:text-primary hover:border-primary/30'
            }`}
          >
            {saved ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
