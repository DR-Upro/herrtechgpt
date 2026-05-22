import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic } from "./client";
import { safeTruncate, stripLoneSurrogates } from "../text";
import type { SourceProfile, NicheProfile } from "../types";

const NicheSchema = z.object({
  niche: z
    .string()
    .describe(
      "Sehr spezifisches Nischen-Label in 4-8 Wörtern, z.B. 'KI-Video-Tools für deutschsprachige Solopreneure'. Kein generisches 'Tech' oder 'AI'.",
    ),
  positioning: z
    .string()
    .describe(
      "Was macht diesen Creator EINZIGARTIG? Zwei Sätze: die konkrete Angle/Persona, mit der er sich von anderen in der Nische unterscheidet.",
    ),
  themes: z
    .array(z.string())
    .describe(
      "5-8 ganz konkrete Content-Themen die wirklich aus den Captions hervorgehen. Keine Meta-Labels ('Automation'), sondern was der Creator tatsächlich zeigt ('Veo 3 Prompt-Breakdowns', 'ChatGPT-Agenten im n8n-Workflow').",
    ),
  signature_tools: z
    .array(z.string())
    .describe(
      "Konkrete Produkte / Tools / Plattformen, die in den Captions wiederholt auftauchen, z.B. ['Claude', 'n8n', 'Veo 3', 'ElevenLabs']. Leer wenn nichts eindeutig dominiert.",
    ),
  keywords: z
    .array(z.string())
    .describe(
      "14-18 globale Suchbegriffe für virale Kurzvideos in der gleichen Nische. Mix: Englisch (6-8), Deutsch/Französisch/Italienisch/Spanisch/Portugiesisch (3-4), Hindi/Indonesisch/Japanisch/Thai (2-3), Arabisch/Swahili (1-2). Gute Keywords beschreiben das THEMA konkret ('AI avatar generator', 'veo 3 prompt tutorial'), nicht generisch ('AI', 'tools'). Keine Hashtags (ohne #).",
    ),
  hashtags: z
    .array(z.string())
    .describe(
      "10-14 TikTok-Hashtags ohne '#'. Mix aus Mega-Tags (>10M Posts: aitools, chatgpt) und spezifisch (veo3, aiinfluencer, claudecode). Alles lowercase, keine Spaces.",
    ),
  style: z
    .string()
    .describe(
      "Visueller + editorischer Stil in zwei Sätzen: Framing (face-to-camera / screen-recording / cinematic), Schnitt-Tempo, typische Text-on-Screen, Hook-Pattern.",
    ),
  audience: z
    .string()
    .describe(
      "Zielgruppe in zwei Sätzen: Demografie + psychografischer Pain-Point (warum sie diesem Creator folgen, was sie vom Inhalt wollen).",
    ),
  languages: z
    .array(z.string())
    .describe("ISO 639-1 Codes der Sprachen, die der Creator nutzt."),
  summary: z
    .string()
    .describe(
      "Ein dichter Satz (max 25 Wörter) der die Positionierung des Creators für einen Marketing-Strategen auf den Punkt bringt.",
    ),
});

const SYSTEM_PROMPT = `Du bist Senior-Nischen-Analyst für Creator-Marketing. Deine Analyse ist die Grundlage für eine Video-Empfehlungs-Engine — je präziser du die Nische einkreist, desto besser werden die Treffer.

Regeln:
- KEINE generischen Labels. "Tech" ist null wert, "KI-Tools für deutschsprachige Solopreneure" ist gold.
- Zitiere konkret was im Profil vorkommt. Wenn der Creator Veo 3 / Claude Code / n8n in jedem zweiten Post zeigt, müssen die in 'signature_tools' stehen.
- 'keywords' sind MULTILINGUAL und GLOBAL — sie füttern eine Suche nach viralen Kurzvideos auf TikTok / Instagram / YouTube Shorts weltweit. Denke breit: wenn die Nische "AI automation" ist, sind auch Hindi ("AI ऑटोमेशन"), Portugiesisch ("automação com IA") und Spanisch ("automatización IA") relevant — virale Hits kommen von überall.
- 'hashtags' greifen die gleiche Nische ab, aber über TikTok's Hashtag-Discovery statt Keyword-Suche.
- 'positioning' ist das WICHTIGSTE Feld für die spätere Match-Scoring. Beschreibe die Winkelung ehrlich und konkret.

Sprachen als ISO 639-1. Alles als strukturiertes JSON.`;

export async function extractNiche(
  source: SourceProfile,
): Promise<NicheProfile> {
  const client = getAnthropic();

  // Use up to 40 captions (was 20) for richer context.
  const captions = source.recentCaptions.slice(0, 40);

  const userContent = stripLoneSurrogates(
    [
      `Plattform: ${source.platform}`,
      `Handle: @${source.handle}`,
      source.displayName ? `Name: ${source.displayName}` : null,
      `Follower: ${source.followerCount ?? "unbekannt"}`,
      source.postCount ? `Posts gesamt: ${source.postCount}` : null,
      "",
      `Bio:`,
      source.bio ?? "(keine Bio)",
      "",
      `Letzte ${captions.length} Captions:`,
      ...captions.map((c, i) => `[${i + 1}] ${safeTruncate(c, 400)}`),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const response = await client.messages.parse({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
    output_config: { format: zodOutputFormat(NicheSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("Niche extraction failed to produce structured output");
  }

  return {
    niche: parsed.niche,
    positioning: parsed.positioning,
    themes: parsed.themes,
    signatureTools: parsed.signature_tools,
    keywords: parsed.keywords,
    hashtags: parsed.hashtags,
    style: parsed.style,
    audience: parsed.audience,
    languages: parsed.languages,
    summary: parsed.summary,
  };
}
