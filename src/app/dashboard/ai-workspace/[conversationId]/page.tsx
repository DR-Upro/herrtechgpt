import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAgent } from '@/lib/agents'
import { ChatInterface } from '@/components/chat-interface'
import { computeEffectiveAccess, VIEW_AS_COOKIE } from '@/lib/access'
import { getActivePacks, getActivePlans } from '@/lib/monetization'
import { buildGateState } from '@/lib/gate-state'
import type { Plan, CreditPack } from '@/lib/types'
import type { AgentDefinition } from '@/lib/agents'

const generalAgent: AgentDefinition = {
  id: 'general',
  name: 'Allgemeiner Chat',
  description: 'Stell jede Frage rund um KI, Content & Business',
  emoji: '💬',
  color: 'bg-primary',
  textColor: 'text-primary',
  mode: 'free-chat',
  placeholder: 'Stell deine Frage...',
  systemPrompt: 'Du bist ein hilfreicher AI-Assistent für Content Creator und Unternehmer im deutschsprachigen Raum. Antworte professionell, praxisnah und auf Deutsch.',
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>
  searchParams: Promise<{ init?: string }>
}) {
  const { conversationId } = await params
  const { init } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch conversation
  const { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!conversation) {
    redirect('/dashboard/ai-workspace')
  }

  const agentId = conversation.agent_id ?? 'general'
  const agent = agentId === 'general' ? generalAgent : (getAgent(agentId) ?? generalAgent)

  // Load messages
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  const initialMessages = (messages ?? []).map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }))

  // Subscription-Gate-State: für Paywall-Banner + Send-Button-Gating
  const [{ data: profile }, plans, packs, cookieStore] = await Promise.all([
    supabase.from('profiles').select('role, access_tier').eq('id', user.id).single(),
    getActivePlans(supabase),
    getActivePacks(supabase),
    cookies(),
  ])
  const access = computeEffectiveAccess(profile, cookieStore.get(VIEW_AS_COOKIE)?.value)

  const gateState = await buildGateState({
    supabase,
    userId: user.id,
    access,
    plans: plans as Plan[],
    packs: packs as CreditPack[],
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-4 sm:px-6 py-3 sm:py-4 flex items-center shrink-0 bg-surface">
        <div className="flex items-center gap-3">
          <span className="text-lg">{agent.emoji}</span>
          <div>
            <h1 className="font-semibold text-foreground text-sm sm:text-base">{agent.name}</h1>
            <p className="text-xs text-muted hidden sm:block">{agent.description}</p>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatInterface
          agent={agent}
          conversationId={conversationId}
          initialMessages={initialMessages}
          autoSend={init}
          gateState={gateState}
        />
      </div>
    </div>
  )
}
