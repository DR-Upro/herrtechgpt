import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic } from "./client";
import { safeTruncate, stripLoneSurrogates } from "../text";
import type { NicheProfile } from "../types";
import type { RawViralVideo } from "../scrapers/tiktok";

const RankSchema = z.object({
  rankings: z.array(
    z.object({
      id: z.string(),
      match_score: z
        .number()
        .int()
        .min(0)
        .max(100)
        .describe(
          "0-100 Score: 90+ perfekter Fit, 70-89 starker Match, <70 schwach",
        ),
      hook: z
        .string()
        .describe(
          "Die Hook-Technik der ersten 3 Sekunden, auf Deutsch, max 15 Wörter",
        ),
      remix_idea: z
        .string()
        .describe(
          "Konkrete deutsche Nachbau-Idee für den Ziel-Creator, 1-2 Sätze",
        ),
    }),
  ),
});

const SYSTEM_PROMPT = `Du rankst virale Kurzvideos gegen das Nischen-Profil eines Ziel-Creators auf Nachbau-Potenzial.

match_score (0-100) Skala — sei GEEICHT, nicht streng-restriktiv. Das Ziel ist: Videos die der User inspirieren könnten sollen oben landen, auch wenn sie nur benachbart zur Nische sind.
- 90-100: perfekter Fit. Gleiches Thema + gleiche Tool-Welt. Wie 1:1 vom Ziel-Creator selbst.
- 75-89: starker Match. Gleiche Themen-Familie, Zielgruppe passt, anderes Tool erlaubt.
- 60-74: benachbarte Nische. Gleicher Vibe/Content-Pattern, Thema leicht daneben — trotzdem Nachbau-wert.
- 45-59: interessanter Seitenblick. Allgemeiner Tech/AI/Creator-Content, könnte als Hook-Inspiration dienen auch wenn das Thema abweicht.
- 30-44: entfernte Relevanz. Nur durch die Brille der allgemeinen Viralität interessant.
- 0-29: irrelevant. Anderes Publikum, anderes Thema.

Sei präzise aber nicht knauserig: ein virales AI-Demo-Video einer ganz anderen Sub-Nische ist immer noch ~50 — es hat Nachbau-Patterns die übertragbar sind. Nur wenn es komplett off-topic ist (Kochrezept, Reise-Vlog) → unter 30.

Signature-Tools-Match: wenn das Video das gleiche Tool zeigt wie der Ziel-Creator nutzt → +5-10 Punkte. Wenn ein ganz anderes Tool → unverändert (nicht abziehen — andere Tools sind für Inspiration trotzdem wertvoll).

Für jedes Video lieferst du:
- match_score (nach obiger Skala)
- hook: die Hook-Technik der ersten 3 Sekunden, auf Deutsch, max 15 Wörter, konkret (nicht "spannender Einstieg")
- remix_idea: konkrete deutsche Nachbau-Idee in 1-2 Sätzen, die den Hook übernimmt aber explizit das Thema/Tool des Ziel-Creators nutzt

Hook und remix_idea immer auf Deutsch. Gib exakt ein Ranking pro Video-ID zurück.`;

export type RankResult = {
  id: string;
  matchScore: number;
  hook: string;
  remixIdea: string;
};

// Claude's structured-output JSON can run ~150-200 tokens per video
// (id + score + German hook + remix idea + JSON scaffolding). Batching
// at 30 videos keeps each call well under max_tokens so a single
// oversized run can't truncate the whole ranking.
const RANK_BATCH_SIZE = 30;
const RANK_MAX_TOKENS = 16000;

function buildNicheBlock(niche: NicheProfile): string {
  return stripLoneSurrogates(
    [
      `Nische: ${niche.niche}`,
      niche.positioning ? `Positioning: ${niche.positioning}` : null,
      `Themen: ${niche.themes.join(", ")}`,
      niche.signatureTools && niche.signatureTools.length > 0
        ? `Signature-Tools: ${niche.signatureTools.join(", ")}`
        : null,
      `Stil: ${niche.style}`,
      `Zielgruppe: ${niche.audience}`,
      `Sprachen: ${niche.languages.join(", ")}`,
      `Zusammenfassung: ${niche.summary}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function buildVideoBlock(videos: RawViralVideo[]): string {
  return videos
    .map(
      (v) => `
ID: ${v.id}
Creator: ${v.creator} (${v.creatorHandle})
Sprache: ${v.language}
Views: ${v.views.toLocaleString("de-DE")}  Likes: ${v.likes.toLocaleString("de-DE")}
Caption: ${safeTruncate(v.caption, 300)}
---`,
    )
    .join("\n");
}

async function rankBatch(
  niche: NicheProfile,
  batch: RawViralVideo[],
): Promise<RankResult[]> {
  const client = getAnthropic();
  const response = await client.messages.parse({
    model: "claude-sonnet-4-6",
    max_tokens: RANK_MAX_TOKENS,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Ziel-Creator Nische:
${buildNicheBlock(niche)}

Zu rankende Videos (${batch.length}):
${buildVideoBlock(batch)}`,
      },
    ],
    output_config: { format: zodOutputFormat(RankSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("Ranking returned no structured output");
  }

  return parsed.rankings.map((r) => ({
    id: r.id,
    matchScore: r.match_score,
    hook: r.hook,
    remixIdea: r.remix_idea,
  }));
}

export async function rankVideos(
  niche: NicheProfile,
  videos: RawViralVideo[],
): Promise<RankResult[]> {
  if (videos.length === 0) return [];

  const batches: RawViralVideo[][] = [];
  for (let i = 0; i < videos.length; i += RANK_BATCH_SIZE) {
    batches.push(videos.slice(i, i + RANK_BATCH_SIZE));
  }

  const settled = await Promise.allSettled(
    batches.map((batch) => rankBatch(niche, batch)),
  );

  const results: RankResult[] = [];
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else {
      console.warn(
        `[rank] batch ${i + 1}/${batches.length} failed (${batches[i].length} videos):`,
        outcome.reason instanceof Error
          ? outcome.reason.message
          : outcome.reason,
      );
    }
  }
  return results;
}
