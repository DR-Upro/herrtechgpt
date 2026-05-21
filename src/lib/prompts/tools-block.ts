import type { SupabaseClient } from '@supabase/supabase-js'
import type { CoreTool } from '@/lib/types'

/**
 * Baut den System-Prompt-Block, der dem Assistenten den UPRO AI Lab Tech-Stack mitgibt.
 *
 * Wird zur Laufzeit in jeden Chat-Request injiziert. So muss der System-Prompt
 * der Assistenten nicht angefasst werden, wenn Tools hinzugefügt/entfernt werden.
 *
 * Ablauf:
 * 1. Hol alle aktiven Tools, die zum agentId gehören (via relevant_agents[])
 * 2. Gruppiere nach tier (primary/secondary/fallback)
 * 3. Formatiere als Markdown-Block mit strikten Verhaltensregeln
 *
 * Wenn keine Tools konfiguriert sind → leerer String (kein Constraint).
 */
export async function buildToolsBlock(
  supabase: SupabaseClient,
  agentId: string
): Promise<string> {
  if (!agentId || agentId === 'general') {
    // General-Agent bleibt unbeschränkt — hier wollen wir keinen Tool-Constraint
    return ''
  }

  const { data: tools, error } = await supabase
    .from('core_tools')
    .select('*')
    .eq('active', true)
    .contains('relevant_agents', [agentId])
    .order('sort_order', { ascending: true })

  if (error || !tools || tools.length === 0) {
    return ''
  }

  return formatToolsBlock(tools as CoreTool[])
}

function formatToolsBlock(tools: CoreTool[]): string {
  const primary = tools.filter((t) => t.tier === 'primary')
  const secondary = tools.filter((t) => t.tier === 'secondary')
  const fallback = tools.filter((t) => t.tier === 'fallback')

  const sections: string[] = []

  if (primary.length > 0) {
    sections.push('### PRIMARY (immer zuerst empfehlen)')
    sections.push(primary.map(formatTool).join('\n'))
  }

  if (secondary.length > 0) {
    sections.push('### SECONDARY (nur wenn primary nicht passt)')
    sections.push(secondary.map(formatTool).join('\n'))
  }

  if (fallback.length > 0) {
    sections.push('### FALLBACK (nur nennen wenn User explizit danach fragt)')
    sections.push(fallback.map(formatTool).join('\n'))
  }

  // Sammle alle "alternatives_handled" für die Regel, wie mit Fremd-Tools umgegangen wird
  const knownAlternatives = Array.from(
    new Set(tools.flatMap((t) => t.alternatives_handled ?? []))
  )

  const altHandling =
    knownAlternatives.length > 0
      ? `\n\nBekannte Alternativen, die User erwähnen könnten (NICHT empfehlen, nur behandeln): ${knownAlternatives.join(', ')}.`
      : ''

  return `

--- DEIN WERKZEUGKASTEN (UPRO AI Lab Tech-Stack) ---

Du empfiehlst **ausschließlich** Tools aus dieser Liste. Diese Liste wird zentral
von UPRO AI Lab gepflegt — wir nutzen und testen jedes Tool selbst.

${sections.join('\n\n')}

### REGELN (zwingend)
1. Standardmäßig empfiehlst du **NUR** Tools aus der obigen Liste.
2. Wenn der User explizit nach einem anderen Tool fragt (z.B. "Was hältst du von Make?"):
   - Beantworte kurz sachlich
   - Erkläre dann, warum wir bei UPRO AI Lab mit unserer Alternative aus der Liste arbeiten
   - Keine Herabsetzung anderer Tools — nur: "Unser Stack ist bewusst schlank."
3. **NIE** mehr als 3 Tools in einer einzigen Empfehlung. Konzentration schlägt Auswahl.
4. **NIE** unaufgefordert Tools außerhalb dieser Liste vorschlagen.
5. Wenn ein Thema gar nicht mit unserem Stack lösbar ist, sag das ehrlich:
   "Dafür haben wir im UPRO AI Lab-Stack aktuell nichts — hier wäre [externes Tool] üblich,
   aber dazu haben wir keine eigene Empfehlung."
6. Zitiere bei jeder Tool-Empfehlung kurz das "Warum" aus der obigen Liste — so wirkt die
   Empfehlung fundiert und nicht wie eine zufällige Auswahl.${altHandling}

--- Ende Werkzeugkasten ---
`
}

function formatTool(t: CoreTool): string {
  const icon = t.icon ? `${t.icon} ` : ''
  const why = t.why_we_use_it ? ` — *${t.why_we_use_it}*` : ''
  return `- ${icon}**${t.name}** (${t.what_for})${why}`
}
