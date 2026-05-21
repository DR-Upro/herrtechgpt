/**
 * Parse a freeform CI description into the v2 schema:
 * { primaryColor: "#hex", fontPairingId: "modern" | ... }
 *
 * The rest of the palette is derived client-side via deriveBrandPalette().
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'

const PAIRING_IDS = ['editorial', 'modern', 'warm', 'technical', 'bold', 'classic', 'rounded'] as const

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { description } = await req.json()
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    messages: [{
      role: 'user',
      content: `Du bist ein Branding-Experte. Analysiere diese CI-Beschreibung und wähle eine Primärfarbe + passendes Font-Pairing für ein Instagram-Karussell-Tool.

CI-BESCHREIBUNG:
"""
${description}
"""

REGELN:
- primaryColor: Die markanteste/auffälligste Markenfarbe als Hex (z.B. #C9A04A). Ignoriere Hintergrund-Weißtöne, Grau-Töne — wir brauchen die ECHTE Marken-Akzentfarbe.
- fontPairingId: Wähle das passendste Pairing aus:
    "editorial"   — Playfair Display + DM Sans (Serifen-Magazin-Look)
    "modern"      — Plus Jakarta Sans (clean, geometrisch, tech)
    "warm"        — Lora + Nunito Sans (einladend, soft, human)
    "technical"   — Space Grotesk (Developer-vibe, Mono-Flair)
    "bold"        — Fraunces + Outfit (expressive, maximale Präsenz)
    "classic"     — Libre Baskerville + Work Sans (zeitlos, seriös)
    "rounded"     — Bricolage Grotesque (playful, kreativ)

Gib NUR valides JSON zurück:
{ "primaryColor": "#hex", "fontPairingId": "modern" }`,
    }],
  })

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned) as { primaryColor?: string; fontPairingId?: string }
    // Validate pairing id
    const pairingId = PAIRING_IDS.includes(parsed.fontPairingId as typeof PAIRING_IDS[number])
      ? parsed.fontPairingId
      : 'modern'
    return NextResponse.json({
      primaryColor: parsed.primaryColor ?? '#C9A04A',
      fontPairingId: pairingId,
    })
  } catch {
    return NextResponse.json({
      primaryColor: '#C9A04A',
      fontPairingId: 'modern',
    })
  }
}
