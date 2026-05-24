import { streamText, generateText, UIMessage } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import { getAgent } from '@/lib/agents'
import { deprecationPromptBlock } from '@/lib/deprecations'
import { buildToolsBlock } from '@/lib/prompts/tools-block'

// 300s erlaubt lange Antworten (Blueprints, Skripte) ohne Vercel-Timeout.
// Vercel-Hobby-Plan-Cap ist 300s, Pro wäre 800s.
export const maxDuration = 300

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Subscription-Gate: ohne aktives Abo kein Chat.
  // (Admins bypassen via role-check für Support/Tests.)
  const [{ data: roleRow }, { data: sub }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle(),
  ])

  if (roleRow?.role !== 'admin' && !sub) {
    return new Response(
      JSON.stringify({ error: 'Kein aktives Abo. Bitte Plan abschließen.' }),
      { status: 402, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.json()

  // AI SDK v6 TextStreamChatTransport sends: { messages, ...body }
  // where body fields come from the transport config
  const agentId = body.agentId
  const conversationId = body.conversationId
  const rawMessages: UIMessage[] = body.messages ?? []

  const generalAgent = {
    id: 'general',
    systemPrompt: 'Du bist UPRO AI Lab — ein hilfreicher KI-Assistent für Creator und Online-Unternehmer im deutschsprachigen Raum. Du hilfst bei allen Themen rund um Online Business, KI-Tools, Content, Marketing und persönliches Wachstum. Antworte direkt, praxisnah und auf Deutsch.',
  }

  const agent = agentId === 'general' ? generalAgent : getAgent(agentId)
  if (!agent) {
    return new Response('Agent not found', { status: 404 })
  }

  // Convert UIMessage format to simple role/content for streamText
  const messages = rawMessages.map((msg) => {
    let content = ''
    const msgAny = msg as unknown as { content?: string; parts?: Array<{ type: string; text?: string }> }
    if (typeof msgAny.content === 'string' && msgAny.content) {
      content = msgAny.content
    } else if (Array.isArray(msgAny.parts)) {
      content = msgAny.parts
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text!)
        .join('')
    }
    return {
      role: msg.role as 'user' | 'assistant',
      content,
    }
  }).filter((msg) => msg.content.length > 0)

  if (messages.length === 0) {
    return new Response('No messages', { status: 400 })
  }

  // Human-Mode Check: wenn die Conversation im human-mode ist (Support-Chat mit Admin),
  // nur die User-Message speichern und Status auf 'new' setzen — KI-Call \u00fcberspringen.
  if (conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('mode')
      .eq('id', conversationId)
      .single()

    if (conv?.mode === 'human') {
      const lastUserMessage = messages[messages.length - 1]
      if (lastUserMessage?.role === 'user') {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: lastUserMessage.content,
        })
      }

      // Bei der ersten Nachricht: Titel aus User-Text ableiten
      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)

      const updates: Record<string, string> = {
        status: 'new',
        updated_at: new Date().toISOString(),
      }
      if (msgCount && msgCount <= 1 && lastUserMessage?.content) {
        const trimmed = lastUserMessage.content.trim().replace(/\s+/g, ' ')
        updates.title = trimmed.length > 40 ? trimmed.slice(0, 37) + '…' : trimmed
      }

      await supabase
        .from('conversations')
        .update(updates)
        .eq('id', conversationId)

      // Leerer Stream zur\u00fcck — kein KI-Text
      return new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
  }

  // Load user profile for context injection
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Build system prompt with profile context
  let profileContext = ''
  if (profile) {
    const parts = []
    if (profile.background) parts.push(`Hintergrund: ${profile.background}`)
    if (profile.market) parts.push(`Markt: ${profile.market}`)
    if (profile.target_audience)
      parts.push(`Zielgruppe: ${profile.target_audience}`)
    if (profile.offer) parts.push(`Angebot: ${profile.offer}`)
    if (profile.platforms?.length)
      parts.push(`Aktive Plattformen: ${profile.platforms.join(', ')}`)

    if (parts.length > 0) {
      profileContext = `\n\n--- Nutzerprofil ---\n${parts.join('\n')}\n--- Ende Nutzerprofil ---\n\nBerücksichtige dieses Nutzerprofil in all deinen Antworten. Passe deine Empfehlungen, Texte und Ratschläge an den Hintergrund, Markt, die Zielgruppe und das Angebot des Nutzers an.`
    }
  }

  // RAG: Search community knowledge base for relevant content
  const lastQuery = messages[messages.length - 1]?.content ?? ''
  let knowledgeContext = ''
  if (lastQuery.length > 10) {
    try {
      // Extract keywords from the query (remove short words)
      const searchTerms = lastQuery
        .replace(/[^\w\säöüÄÖÜß]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 8)
        .join(' | ')

      if (searchTerms) {
        // Build query — filter by agent if it has categorised knowledge
        let query = supabase
          .from('knowledge_base')
          .select('chunk_text, video_name')
          .eq('is_active', true)
          .textSearch('chunk_text', searchTerms)

        // Agent-spezifischer Filter: source enthält agent-id (z.B. 'wistia,content-hook')
        if (agentId && agentId !== 'general') {
          query = query.ilike('source', `%${agentId}%`)
        }

        const { data: agentChunks } = await query.limit(4)

        // Fallback: wenn kein Agent-spezifisches Ergebnis → allgemeine Suche
        let knowledgeChunks = agentChunks
        if ((!knowledgeChunks || knowledgeChunks.length === 0) && agentId && agentId !== 'general') {
          const { data: fallbackChunks } = await supabase
            .from('knowledge_base')
            .select('chunk_text, video_name')
            .eq('is_active', true)
            .textSearch('chunk_text', searchTerms)
            .limit(4)
          knowledgeChunks = fallbackChunks
        }

        if (knowledgeChunks && knowledgeChunks.length > 0) {
          const context = knowledgeChunks
            .map((row) => `[Quelle: ${row.video_name}]\n${row.chunk_text}`)
            .join('\n\n---\n\n')

          knowledgeContext = `\n\n--- Relevantes Community-Wissen ---\n${context}\n--- Ende Community-Wissen ---\n\nDieses Wissen stammt aus unseren Community-Kursen. Beziehe es in deine Antwort mit ein, wenn es relevant ist. Zitiere die Quelle wenn passend.`
        }
      }
    } catch {
      // Knowledge search is optional — chat works without it
    }
  }

  const deprecationContext = deprecationPromptBlock(agentId)

  // UPRO AI Lab Tech-Stack: injiziere erlaubte Tools pro Agent (via core_tools Tabelle)
  const toolsContext = await buildToolsBlock(supabase, agentId)

  const fullSystemPrompt =
    agent.systemPrompt + profileContext + knowledgeContext + toolsContext + deprecationContext

  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const lastUserMessage = messages[messages.length - 1]

  // User-Message SOFORT persistieren (nicht erst in onFinish) — sonst gibt es
  // ein Race-Window in dem der Client pollt bevor onFinish gelaufen ist und
  // die Liste gelbst wird.
  if (conversationId && lastUserMessage?.role === 'user') {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: lastUserMessage.content,
    })
  }

  const result = streamText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    system: fullSystemPrompt,
    messages,
    // 16k Output-Tokens: deckt komplette Blueprints, mehrteilige Skripte
    // und lange Strukturen ab, ohne dass der User "weiter" sagen muss.
    maxOutputTokens: 16000,
    onFinish: async ({ text }) => {
      // User wurde bereits oben gespeichert — hier nur noch Assistant.
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: text,
      })

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)

      // Auto-generate title after first exchange
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)

      if (count && count <= 2) {
        // Erster Austausch → Titel generieren (oder auf Fallback zur\u00fcckfallen)
        let newTitle: string | null = null
        try {
          const { text: title } = await generateText({
            model: anthropic('claude-sonnet-4-5-20250929'),
            system:
              'Generiere einen sehr kurzen Titel (3-5 Wörter, auf Deutsch) für diese Unterhaltung basierend auf der ersten Nachricht des Nutzers. Antworte nur mit dem Titel, ohne Anführungszeichen, ohne Satzzeichen am Ende.',
            prompt: lastUserMessage.content,
          })
          newTitle = title.trim().replace(/["'.!?]+$/, '')
        } catch {
          // Fallback: erste ~40 Zeichen der User-Message
          const trimmed = lastUserMessage.content.trim().replace(/\s+/g, ' ')
          newTitle = trimmed.length > 40 ? trimmed.slice(0, 37) + '…' : trimmed
        }
        if (newTitle) {
          await supabase
            .from('conversations')
            .update({ title: newTitle })
            .eq('id', conversationId)
        }
      }
    },
  })

  return result.toTextStreamResponse()
}
