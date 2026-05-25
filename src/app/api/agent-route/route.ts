// Intent-Routing fuer das Smart-Input-Feld auf /dashboard/ai-workspace.
// Ein User schreibt z.B. "ich brauche hooks" — Claude Haiku klassifiziert
// das zum passenden Agenten ('content-hook' fuer Reach Machine).
//
// Schnell und billig: Haiku 4.5, 1-2s Latenz, ~0.1 Cent pro Call.
// Bei jedem Fehler Fallback auf 'upro' (Default-Agent) damit der Chat
// trotzdem startet.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 15

const ROUTABLE_AGENTS = [
  { id: 'content-hook',         name: 'Reach Machine',    topic: 'Hooks, virale Skripte, Reel-/TikTok-/Shorts-/LinkedIn-Formate, Content fuer Reichweite' },
  { id: 'funnel-monetization',  name: 'Sales Engine',     topic: 'Funnels, DM-Automation, E-Mail-Sequenzen, Verkauf, Monetarisierung, Conversion' },
  { id: 'upro',                 name: 'Automation Lab',   topic: 'n8n-Workflows, Claude-API-Chains, KI-Agents, Backend-Automation, technische Workflows' },
  { id: 'ai-prompt',            name: 'AI Power User',    topic: 'Prompting, Claude Skills, KI-Workflows fuer Persoenliche Produktivitaet, ChatGPT-Tricks' },
  { id: 'ai-video-studio',      name: 'AI Video Studio',  topic: 'KI-Video mit Veo 3, Seedance, Kling, Higgsfield, HeyGen, Avatar-Videos, Prompt-zu-Video' },
  { id: 'business-coach',       name: 'Scale Coach',      topic: 'Business-Strategie, Positionierung, 90-Tage-Plan, Skalierung, Coaching, Brand-Aufbau' },
] as const

const DEFAULT_AGENT = 'upro'
const VALID_IDS = new Set(ROUTABLE_AGENTS.map((a) => a.id))

const SYSTEM_PROMPT = `Du bist ein Intent-Router fuer das UPRO AI Lab.

Der User schreibt einen kurzen Satz ueber das was er gerade braucht.
Deine Aufgabe: gib EXAKT eine Agent-ID aus der Liste zurueck, die am besten passt.

Agenten:
${ROUTABLE_AGENTS.map((a) => `- ${a.id} (${a.name}): ${a.topic}`).join('\n')}

Regeln:
- Antworte mit NUR der Agent-ID, sonst nichts. Keine Erklaerung, keine Anfuehrungszeichen.
- Wenn der Input mehrere Themen anspricht, waehle den Schwerpunkt.
- Wenn der Input keinem klar zugeordnet werden kann, antworte ${DEFAULT_AGENT}.
- Beispiele:
  "ich brauche hooks fuer mein produkt" -> content-hook
  "wie baue ich einen funnel" -> funnel-monetization
  "n8n workflow fuer leads" -> upro
  "claude skill fuer recherche" -> ai-prompt
  "video mit veo 3 erstellen" -> ai-video-studio
  "wie positioniere ich meine brand" -> business-coach`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text } = (await req.json()) as { text?: string }
  if (!text || !text.trim()) {
    return NextResponse.json({ agentId: DEFAULT_AGENT })
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.slice(0, 500) }],
    })

    const raw = response.content[0]
    const idCandidate =
      raw?.type === 'text' ? raw.text.trim().toLowerCase().replace(/[^a-z\-]/g, '') : ''

    const agentId = VALID_IDS.has(idCandidate as never) ? idCandidate : DEFAULT_AGENT
    return NextResponse.json({ agentId })
  } catch (err) {
    console.error('[agent-route] classification failed:', err)
    return NextResponse.json({ agentId: DEFAULT_AGENT })
  }
}
