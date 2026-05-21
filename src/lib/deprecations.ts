/**
 * Tool-Deprecation-Register
 *
 * Zentrale Liste von Tools, die durch neuere/bessere Alternativen ersetzt wurden.
 * Wird in die System-Prompts der Agenten injiziert, damit sie keine veralteten
 * Empfehlungen mehr geben, und auf den Agent-Landing-Pages als Widget angezeigt.
 */

export interface Deprecation {
  /** Das veraltete Tool, das NICHT mehr empfohlen werden soll */
  deprecated: string
  /** Das aktuell empfohlene Tool */
  current: string
  /** Kategorie — wird genutzt, um je Agent nur relevante Deprecations zu zeigen */
  category:
    | 'video-generation'
    | 'image-generation'
    | 'audio-music'
    | 'automation'
    | 'llm'
    | 'transcription'
    | 'design'
    | 'other'
  /** Kurze Begründung — wird Agenten mitgegeben, damit sie beim Empfehlen argumentieren können */
  reason: string
  /** Optional: seit wann diese Empfehlung gilt (ISO-Datum) */
  since?: string
  /** Für welche Agent-IDs ist das besonders relevant? Leer = alle */
  agents?: string[]
}

export const deprecations: Deprecation[] = [
  {
    deprecated: 'Sora / Sora 2',
    current: 'Veo 3 / Seedance 2.0 / Kling AI / Higgsfield',
    category: 'video-generation',
    reason: 'OpenAI schaltet Sora im April 2026 ab. Wir empfehlen Veo 3 für Audio-Szenen, Seedance für Motion-Konsistenz, Kling für lange Clips und Higgsfield für Camera-Moves.',
    since: '2026-04',
    agents: ['upro', 'ai-prompt', 'content-hook', 'ai-video-studio'],
  },
  {
    deprecated: 'Midjourney',
    current: 'Nano Banana 2',
    category: 'image-generation',
    reason: 'Nano Banana 2 (Google) liefert aktuell bessere Prompt-Adherence und kann Bilder zusätzlich editieren — Midjourney ist nicht mehr Teil unseres Stacks.',
    since: '2026-04',
    agents: ['ai-prompt', 'content-hook', 'upro', 'ai-video-studio'],
  },
  {
    deprecated: 'n8n für Solo-Setups',
    current: 'Claude Code + n8n nur bei Team-Workflows',
    category: 'automation',
    reason: 'Claude Code kann die meisten 1-Personen-Automationen schneller und ohne Hosting-Overhead abbilden.',
    since: '2026-02',
    agents: ['upro', 'business-coach'],
  },
  {
    deprecated: 'ChatGPT Plus (Standard)',
    current: 'Claude Opus 4.6 / Sonnet 4.6',
    category: 'llm',
    reason: 'Claude Opus/Sonnet liefern aktuell stärkere Reasoning-Ergebnisse, insb. für Content & Prompts auf Deutsch.',
    since: '2026-03',
    agents: ['ai-prompt', 'content-hook', 'upro'],
  },
  {
    deprecated: 'Suno v3',
    current: 'Suno v4.5 / Udio',
    category: 'audio-music',
    reason: 'V3 wirkt heute erkennbar "AI". Neue Versionen klingen deutlich natürlicher.',
    since: '2026-01',
    agents: ['content-hook', 'upro'],
  },
  {
    deprecated: 'Whisper Large-v2 (Self-Hosted)',
    current: 'AssemblyAI Universal-2',
    category: 'transcription',
    reason: 'Bessere Deutsch-Qualität, keine Hosting-Kosten, schneller.',
    since: '2026-02',
    agents: ['upro'],
  },
  {
    deprecated: 'Canva Free für Karussell-Posts',
    current: 'Karussell-Generator v2 (4:5, 7-Slide-Narrative, PNG + PPTX Export)',
    category: 'design',
    reason: 'Unser neuer Karussell-Generator erzeugt 4:5 Instagram-Slides (1080×1350) mit 7-Slide-Narrative-Arc (Hero → Problem → Lösung → Features → Details → How-To → CTA), abgeleitetem Brand-Palette aus einer Primärfarbe, embedded Progress-Bar + Swipe-Arrow. Export als PNG-ZIP (direkter Post) oder PPTX (Canva-Import für Feinschliff) — spart 30 Min pro Post.',
    since: '2026-04',
    agents: ['content-hook'],
  },
]

/** Liefert Deprecations, die für einen bestimmten Agenten relevant sind */
export function deprecationsForAgent(agentId: string): Deprecation[] {
  return deprecations.filter((d) => !d.agents || d.agents.length === 0 || d.agents.includes(agentId))
}

/**
 * Baut einen kompakten Text-Block für die System-Prompts.
 * Wird im Chat-Route dem agent.systemPrompt angehängt.
 */
export function deprecationPromptBlock(agentId?: string): string {
  const list = agentId ? deprecationsForAgent(agentId) : deprecations
  if (list.length === 0) return ''
  const lines = list.map(
    (d) => `- Nicht mehr ${d.deprecated} — stattdessen ${d.current} (${d.reason})`,
  )
  return `\n\n--- Aktuelle Tool-Empfehlungen (${new Date().toISOString().slice(0, 7)}) ---
Wichtig: Empfehle NICHT die veralteten Tools. Nutze immer die aktuelle Alternative.
${lines.join('\n')}
--- Ende Tool-Empfehlungen ---`
}
