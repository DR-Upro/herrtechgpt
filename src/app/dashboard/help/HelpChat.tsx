'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { Send, Loader2, Users, Bot, Shield, CheckCircle2, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Role = 'user' | 'assistant' | 'admin' | 'system'
type Mode = 'ai' | 'human'
type Status = 'new' | 'answered' | 'resolved'

interface Message {
  id: string
  role: Role
  content: string
  created_at: string
}

interface Props {
  userId: string
  userInitials: string
}

export function HelpChat({ userId, userInitials }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlChatId = searchParams.get('chat')

  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [mode, setMode] = useState<Mode>('ai')
  const [status, setStatus] = useState<Status>('new')
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [switching, setSwitching] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ─── Laden der aktiven Conversation (reagiert auf URL-\u00c4nderungen) ──────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      let activeId = urlChatId

      // Falls keine aktive Konversation in URL → neueste User-Konversation nehmen
      if (!activeId) {
        const { data: latest } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', userId)
          .eq('agent_id', 'help')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latest?.id) {
          activeId = latest.id
        } else {
          // Keine Konversation vorhanden → neue erstellen
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({ user_id: userId, agent_id: 'help', title: 'Hilfe & Support' })
            .select('id')
            .single()
          activeId = newConv?.id ?? null
        }
      }

      if (cancelled || !activeId) return

      const [{ data: msgs }, { data: conv }] = await Promise.all([
        supabase
          .from('messages')
          .select('id, role, content, created_at')
          .eq('conversation_id', activeId)
          .order('created_at', { ascending: true }),
        supabase
          .from('conversations')
          .select('mode, status')
          .eq('id', activeId)
          .single(),
      ])

      if (cancelled) return
      setConversationId(activeId)
      setMessages((msgs as Message[]) ?? [])
      setMode((conv?.mode as Mode) ?? 'ai')
      setStatus((conv?.status as Status) ?? 'new')
      setLoading(false)

      // Als gelesen markieren (Unread-Flag in DB abr\u00e4umen + Layout refreshen)
      void supabase
        .from('conversations')
        .update({ user_has_unread: false })
        .eq('id', activeId)
        .eq('user_has_unread', true)
        .then(({ error }) => {
          if (!error) router.refresh()
        })
    }
    load()
    return () => { cancelled = true }
  }, [urlChatId, userId, router])

  // ─── Polling f\u00fcr Admin-Antworten (nur wenn Human-Mode / wartend) ──────────
  const pollMessages = useCallback(async () => {
    if (!conversationId) return
    const supabase = createClient()
    const [{ data: msgs }, { data: conv }] = await Promise.all([
      supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
      supabase
        .from('conversations')
        .select('mode, status, user_has_unread')
        .eq('id', conversationId)
        .single(),
    ])
    // Falls w\u00e4hrend offener Ansicht ein neuer Admin-Reply landet
    // (user_has_unread=true) \u2192 direkt als gelesen markieren
    if (conv?.user_has_unread) {
      await supabase
        .from('conversations')
        .update({ user_has_unread: false })
        .eq('id', conversationId)
      router.refresh()
    }
    if (msgs) {
      setMessages((prev) => {
        const dbMsgs = msgs as Message[]
        const pending = prev.filter((m) => {
          if (!m.id.startsWith('temp-') && !m.id.startsWith('ai-')) return false
          return !dbMsgs.some(
            (d) => d.role === m.role && d.content.trim() === m.content.trim()
          )
        })
        return [...dbMsgs, ...pending].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
    }
    if (conv) {
      setMode(conv.mode as Mode)
      setStatus(conv.status as Status)
    }
  }, [conversationId])

  useEffect(() => {
    if (mode !== 'human' && status === 'resolved') return
    if (mode !== 'human' && status !== 'new') return
    const interval = setInterval(pollMessages, 10000)
    return () => clearInterval(interval)
  }, [mode, status, pollMessages])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const requestAdmin = async () => {
    if (!conversationId) return
    setSwitching(true)
    const res = await fetch('/api/help/request-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    })
    setSwitching(false)
    if (res.ok) {
      await pollMessages()
      router.refresh()
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending || !conversationId) return
    setSending(true)

    const isFirstMessage = messages.length === 0

    const optimisticUserId = 'temp-' + Date.now()
    const optimistic: Message = {
      id: optimisticUserId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    const currentMessages = [...messages, optimistic]
    setMessages(currentMessages)
    setInput('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'help',
          conversationId,
          messages: currentMessages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ id: m.id, role: m.role, parts: [{ type: 'text', text: m.content }] })),
        }),
      })

      if (mode === 'ai' && res.ok && res.body) {
        const aiId = 'ai-' + Date.now()
        setMessages((m) => [...m, { id: aiId, role: 'assistant', content: '', created_at: new Date().toISOString() }])
        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        // Typewriter-Effekt: Stream f\u00fcllt Buffer in voller Geschwindigkeit,
        // Reveal-Loop zeigt Zeichen sanft mit ~120 chars/sec an (holt auf bei gro\u00dfen Chunks).
        let targetText = ''
        let displayedText = ''
        let streamDone = false

        const revealInterval = setInterval(() => {
          const ahead = targetText.length - displayedText.length
          if (ahead > 0) {
            // Adaptive Schrittweite: mehr ahead = schneller catchup
            const step = Math.min(Math.max(2, Math.floor(ahead / 25)), 10)
            displayedText = targetText.slice(0, displayedText.length + step)
            setMessages((m) => m.map((msg) => msg.id === aiId ? { ...msg, content: displayedText } : msg))
          }
        }, 16)

        ;(async () => {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            targetText += decoder.decode(value, { stream: true })
          }
          streamDone = true
        })().catch(() => { streamDone = true })

        // Warten bis Stream durch UND reveal aufgeholt hat
        while (!streamDone || displayedText.length < targetText.length) {
          await new Promise((r) => setTimeout(r, 32))
        }
        clearInterval(revealInterval)
        // Final sync
        setMessages((m) => m.map((msg) => msg.id === aiId ? { ...msg, content: targetText } : msg))
      }
      // Delay polling to give onFinish time to save message + generate title
      setTimeout(() => pollMessages(), 500)
      // Nach erster Nachricht: Title wurde generiert \u2192 Sidebar refreshen (Layout re-render)
      if (isFirstMessage) {
        setTimeout(() => router.refresh(), 1500)
      }
    } catch {
      await pollMessages()
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isHuman = mode === 'human'
  const isResolved = status === 'resolved'

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted text-sm gap-2">
        <Loader2 size={18} className="animate-spin" />
        Lade Chat…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Banner: Human-Mode aktiv */}
      {isHuman && !isResolved && (
        <div className="shrink-0 bg-primary/5 border-b border-primary/20 px-4 py-2.5 flex items-center gap-3">
          <Users size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Du schreibst gerade mit dem Support-Team</p>
            <p className="text-[11px] text-muted">Antwortzeit meist innerhalb von 24h — die KI ist in diesem Chat aus.</p>
          </div>
        </div>
      )}

      {isResolved && (
        <div className="shrink-0 bg-green-500/10 border-b border-green-500/30 px-4 py-2.5 flex items-center gap-3">
          <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Dieser Fall ist als gelöst markiert</p>
            <p className="text-[11px] text-muted">Schreib einfach eine neue Nachricht wenn du weitere Hilfe brauchst.</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8 bg-background">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">💬</div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Hilfe & Kontakt</h2>
            <p className="text-sm text-muted max-w-md">
              Frag mich alles — bei Bedarf kannst du direkt mit unserem Team sprechen.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} userInitials={userInitials} />
            ))}
          </div>
        )}
      </div>

      {/* CTA: Mit Team sprechen */}
      {!isHuman && !isResolved && (
        <div className="shrink-0 px-4 py-2 border-t border-border bg-surface/50">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              Keine passende Antwort? Schreib direkt mit unserem Team.
            </p>
            <button
              onClick={requestAdmin}
              disabled={switching}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-full hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {switching ? <Loader2 size={12} className="animate-spin" /> : <Users size={12} />}
              Mit dem Team sprechen
            </button>
          </div>
        </div>
      )}

      {isResolved && (
        <div className="shrink-0 px-4 py-2 border-t border-border bg-surface/50">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <p className="text-xs text-muted">Doch noch nicht gelöst?</p>
            <button
              onClick={requestAdmin}
              disabled={switching}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-full hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {switching ? <Loader2 size={12} className="animate-spin" /> : <Users size={12} />}
              Nochmal Team kontaktieren
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-border bg-surface">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 items-end bg-surface border border-border rounded-2xl px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-shadow">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isHuman ? 'Nachricht an das Team…' : 'Frag mich etwas…'}
              rows={1}
              className="flex-1 py-2 text-sm resize-none max-h-32 overflow-y-auto bg-transparent focus:outline-none placeholder:text-muted/60"
              style={{ minHeight: '36px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 128) + 'px'
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="p-2 bg-primary hover:bg-primary-hover disabled:bg-border disabled:text-white/50 text-white rounded-lg transition-colors"
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Message-Bubbles mit Markdown ────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed text-foreground">
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
          code: ({ children }) => {
            const isBlock = String(children).includes('\n')
            return isBlock
              ? <code className="font-mono text-xs">{children}</code>
              : <code className="bg-surface-secondary rounded px-1.5 py-0.5 font-mono text-xs">{children}</code>
          },
          hr: () => <hr className="border-border my-4" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function MessageBubble({ msg, userInitials }: { msg: Message; userInitials: string }) {
  if (msg.role === 'system') {
    return (
      <div className="flex items-center justify-center py-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-secondary text-[11px] text-muted">
          <Info size={11} />
          <span>— {msg.content} —</span>
        </div>
      </div>
    )
  }

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-primary text-white text-sm leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    )
  }

  if (msg.role === 'admin') {
    return (
      <div className="flex gap-2">
        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Shield size={14} />
        </div>
        <div className="max-w-[75%]">
          <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1 ml-1">Support-Team</div>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-foreground px-4 py-2.5 rounded-2xl rounded-tl-sm">
            <MarkdownContent content={msg.content} />
          </div>
        </div>
      </div>
    )
  }

  // assistant (KI) — styled wie UPRO AI Lab: kein Box, flie\u00dfender Text
  return (
    <div className="flex justify-start">
      <div className="w-full py-1">
        {msg.content ? (
          <MarkdownContent content={msg.content} />
        ) : (
          <div className="flex gap-1 py-2" aria-label="Schreibt">
            <span className="w-1.5 h-1.5 rounded-full bg-muted/60 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-muted/60 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-muted/60 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  )
}
