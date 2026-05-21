'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { Send, Loader2, Bot, Shield, Info, User, CheckCircle2, ArrowRightLeft, Mail } from 'lucide-react'
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
  conversationId: string
  title: string
  initialMode: Mode
  initialStatus: Status
  initialMessages: Message[]
  user: {
    id: string
    email: string
    tier: 'basic' | 'alumni' | 'premium'
    role: 'user' | 'admin'
    createdAt: string
    market: string
    lastSignIn: string | null
  }
}

const TIER_LABELS: Record<Props['user']['tier'], { label: string; cls: string }> = {
  premium: { label: 'Community', cls: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' },
  alumni:  { label: 'Alumni',    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  basic:   { label: 'Basic',     cls: 'bg-surface-secondary text-muted' },
}

export function TicketDetailClient({
  conversationId,
  initialMode,
  initialStatus,
  initialMessages,
  user,
}: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [status, setStatus] = useState<Status>(initialStatus)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState<'resolve' | 'mode' | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const refetch = useCallback(async () => {
    const supabase = createClient()
    const [{ data: msgs }, { data: conv }] = await Promise.all([
      supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
      supabase
        .from('conversations')
        .select('mode, status')
        .eq('id', conversationId)
        .single(),
    ])
    if (msgs) setMessages(msgs as Message[])
    if (conv) {
      setMode(conv.mode as Mode)
      setStatus(conv.status as Status)
    }
  }, [conversationId])

  useEffect(() => {
    const interval = setInterval(refetch, 10000)
    return () => clearInterval(interval)
  }, [refetch])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const sendReply = async () => {
    const text = reply.trim()
    if (!text || sending) return
    setSending(true)
    const res = await fetch(`/api/admin/tickets/${conversationId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
    setSending(false)
    if (res.ok) {
      setReply('')
      await refetch()
      router.refresh()
    }
  }

  const markResolved = async () => {
    setUpdating('resolve')
    await fetch(`/api/admin/tickets/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', mode: 'ai' }),
    })
    setUpdating(null)
    await refetch()
    router.refresh()
  }

  const toggleMode = async () => {
    const nextMode: Mode = mode === 'human' ? 'ai' : 'human'
    setUpdating('mode')
    await fetch(`/api/admin/tickets/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: nextMode }),
    })
    setUpdating(null)
    await refetch()
    router.refresh()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendReply()
    }
  }

  const tierMeta = TIER_LABELS[user.tier]
  const formatDate = (iso: string | null) => iso
    ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      {/* Chat */}
      <div className="flex flex-col card-static overflow-hidden">
        {/* Status-Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-secondary flex-wrap">
          <StatusBadge status={status} />
          <ModeBadge mode={mode} />
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {status !== 'resolved' && (
              <button
                onClick={markResolved}
                disabled={updating !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900 rounded-full hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors disabled:opacity-50"
              >
                {updating === 'resolve' ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                Als erledigt markieren
              </button>
            )}
            <button
              onClick={toggleMode}
              disabled={updating !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted border border-border rounded-full hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              {updating === 'mode' ? <Loader2 size={11} className="animate-spin" /> : <ArrowRightLeft size={11} />}
              {mode === 'human' ? 'KI übernehmen' : 'Selbst übernehmen'}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 min-h-[400px] max-h-[65vh] overflow-y-auto px-4 py-5 bg-background">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-muted py-8">Noch keine Nachrichten.</div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => <Bubble key={msg.id} msg={msg} userEmail={user.email} />)}
            </div>
          )}
        </div>

        {/* Reply-Input */}
        <div className="border-t border-border px-4 py-3 bg-surface">
          <div className="flex gap-2 items-end">
            <div className="flex-1 flex gap-2 items-end bg-surface border border-border rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-primary transition-shadow">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={status === 'resolved' ? 'Ticket ist erledigt — neue Antwort öffnet es wieder' : 'Antwort an den User… (Enter zum Senden, Shift+Enter für neue Zeile)'}
                rows={2}
                className="flex-1 text-sm resize-none max-h-40 overflow-y-auto bg-transparent focus:outline-none placeholder:text-muted/60"
              />
            </div>
            <button
              onClick={sendReply}
              disabled={!reply.trim() || sending}
              className="p-3 bg-primary hover:bg-primary-hover disabled:bg-border disabled:text-white/50 text-white rounded-xl transition-colors"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar: User-Info */}
      <div className="space-y-4">
        <div className="card-static p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Nutzer</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Mail size={14} className="text-muted mt-0.5 shrink-0" />
              <span className="text-foreground break-all">{user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Tier:</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tierMeta.cls}`}>
                {tierMeta.label}
              </span>
            </div>
            {user.role === 'admin' && (
              <div className="text-xs text-primary font-medium">Ist Admin</div>
            )}
            <div className="text-xs text-muted">Registriert: {formatDate(user.createdAt)}</div>
            <div className="text-xs text-muted">Letzter Login: {formatDate(user.lastSignIn)}</div>
            {user.market && (
              <div className="text-xs text-muted border-t border-border pt-2 mt-2">
                <div className="font-medium text-foreground mb-0.5">Markt:</div>
                <div className="line-clamp-3">{user.market}</div>
              </div>
            )}
          </div>
          <Link
            href={`/admin/users/${user.id}`}
            className="block text-xs text-primary hover:text-primary-hover mt-4 font-medium"
          >
            Zum Nutzer-Profil →
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const map = {
    new:      { label: 'Neu',         cls: 'bg-primary/10 text-primary' },
    answered: { label: 'Beantwortet', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' },
    resolved: { label: 'Erledigt',    cls: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' },
  } as const
  const m = map[status]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${m.cls}`}>{m.label}</span>
}

function ModeBadge({ mode }: { mode: Mode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
      mode === 'human'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
        : 'bg-surface-secondary text-muted'
    }`}>
      {mode === 'human' ? <><User size={10}/>Human</> : <><Bot size={10}/>KI</>}
    </span>
  )
}

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

function Bubble({ msg, userEmail }: { msg: Message; userEmail: string }) {
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
      <div className="flex gap-2 items-start">
        <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 text-[11px] font-semibold">
          {userEmail.slice(0, 2).toUpperCase()}
        </div>
        <div className="max-w-[75%]">
          <div className="text-[11px] font-semibold text-muted mb-1">Nutzer</div>
          <div className="inline-block bg-primary text-white px-4 py-2.5 rounded-2xl rounded-tl-sm">
            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
          </div>
        </div>
      </div>
    )
  }

  if (msg.role === 'admin') {
    return (
      <div className="flex justify-end gap-2 items-start">
        <div className="max-w-[75%] flex flex-col items-end">
          <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1">Du (Support-Team)</div>
          <div className="inline-block bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-foreground px-4 py-2.5 rounded-2xl rounded-tr-sm">
            <MarkdownContent content={msg.content} />
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Shield size={14} />
        </div>
      </div>
    )
  }

  // assistant (KI) — fliessender Text wie im Chat-Interface
  return (
    <div className="flex gap-2">
      <div className="w-8 h-8 rounded-full bg-surface-secondary text-muted flex items-center justify-center shrink-0">
        <Bot size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-muted mb-1">UPRO AI Lab KI</div>
        <MarkdownContent content={msg.content} />
      </div>
    </div>
  )
}
