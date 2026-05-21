'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { listedAgents as agents } from '@/lib/agents'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Loader2, MessageSquare, Send } from 'lucide-react'

export default function AiWorkspacePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const autoStarted = useRef(false)

  const startChat = useCallback(async (agentId: string, initMessage?: string) => {
    setLoading(agentId)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Create conversation
      const { data: conv } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          agent_id: agentId,
          title: initMessage ? initMessage.substring(0, 50) : 'Neue Unterhaltung',
        })
        .select('id')
        .single()

      if (conv) {
        const url = initMessage
          ? `/dashboard/ai-workspace/${conv.id}?init=${encodeURIComponent(initMessage)}`
          : `/dashboard/ai-workspace/${conv.id}`
        router.push(url)
      }
    } catch (e) {
      console.error('Chat start error:', e)
    } finally {
      setLoading(null)
    }
  }, [router])

  // Auto-start chat when sidebar links with ?agent=<id>
  useEffect(() => {
    const agentId = searchParams.get('agent')
    if (!agentId || autoStarted.current) return
    const exists = agents.find((a) => a.id === agentId)
    if (!exists) return
    autoStarted.current = true
    startChat(agentId)
  }, [searchParams, startChat])

  // Smart routing: determine best agent from user input
  const handleSmartStart = () => {
    if (!inputText.trim()) return
    // Default to upro agent, could be enhanced with AI routing
    startChat('upro', inputText)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 sm:px-6 py-6 sm:py-10">
      {/* Centered Welcome + Smart Input */}
      <div className="w-full max-w-3xl text-center mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          UPRO AI Lab
        </h1>
        <p className="text-muted text-sm sm:text-base mb-6">
          Sag mir was du brauchst — ich leite dich zum passenden Agenten.
        </p>

        {/* Smart Input */}
        <div className="card-static p-4 flex items-center gap-3 text-left">
          <MessageSquare size={20} className="text-muted shrink-0" />
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSmartStart()}
            placeholder="z.B. Ich brauche einen Instagram-Hook für mein Produkt..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
          />
          <button
            onClick={handleSmartStart}
            disabled={!inputText.trim() || !!loading}
            className="btn-primary px-3 py-2 disabled:opacity-40"
          >
            {loading === 'upro' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="w-full max-w-4xl">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4 text-center">
        Oder wähle einen Spezialisten
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => startChat(agent.id)}
            disabled={!!loading}
            className="card group flex flex-col p-5 text-left disabled:opacity-70"
          >
            <span className="text-3xl mb-3">{agent.emoji}</span>
            <h3 className="text-base font-semibold text-foreground mb-1">{agent.name}</h3>
            <p className="text-sm text-muted mb-4 flex-1 line-clamp-2">{agent.description}</p>
            <div className="flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
              {loading === agent.id ? (
                <><Loader2 size={14} className="animate-spin" /> Starte...</>
              ) : (
                <>Chat starten <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /></>
              )}
            </div>
          </button>
        ))}
      </div>
      </div>
    </div>
  )
}
