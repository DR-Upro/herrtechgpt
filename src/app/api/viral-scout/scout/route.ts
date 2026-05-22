import { NextRequest } from "next/server";
import { MOCK_RESULT } from "@/lib/viral-scout/mock/data";
import {
  parseHandle,
  REGIONS,
  type Platform,
  type Region,
  type ScoutResult,
  type ViralVideo,
  type NicheProfile,
  type SourceProfile,
} from "@/lib/viral-scout/types";
import { hasLiveKeys, readEnv } from "@/lib/viral-scout/env";
import { scrapeInstagramProfile } from "@/lib/viral-scout/scrapers/instagram";
import {
  scrapeTikTokProfile,
  searchTikTok,
  searchTikTokHashtags,
  type RawViralVideo,
} from "@/lib/viral-scout/scrapers/tiktok";
import { searchInstagramReels } from "@/lib/viral-scout/scrapers/instagram-reels";
import { searchYouTubeShorts } from "@/lib/viral-scout/scrapers/youtube";
import { extractNiche } from "@/lib/viral-scout/claude/niche";
import { rankVideos } from "@/lib/viral-scout/claude/rank";
import {
  getCachedProfile,
  putProfile,
  getCachedNiche,
  putNiche,
} from "@/lib/viral-scout/cache/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Loose gating + match-dominant sort. Philosophie: Filter lassen Content
// REIN, Sortierung drückt Off-Topic nach UNTEN.
const MIN_VIEWS = 25_000;           // viral-enough floor
const MIN_MATCH_SCORE = 45;         // low bar, sort does the prioritization
const MAX_AGE_DAYS = 120;           // 4 months cap (tier-gated below)
const VIRALITY_TIERS = [
  { minViews: 2_000_000, maxAgeDays: 120 },
  { minViews: 1_000_000, maxAgeDays: 90 },
  { minViews:   500_000, maxAgeDays: 75 },
  { minViews:   200_000, maxAgeDays: 60 },
  { minViews:    75_000, maxAgeDays: 45 },
  { minViews:    25_000, maxAgeDays: 21 }, // recent-ish for smaller viral
];

const TOTAL_VIDEOS_SHOWN = 80;
const PER_REGION_SEARCH_BUDGET = 80;
const GLOBAL_SEARCH_BUDGET = 300;
const HASHTAG_SEARCH_BUDGET = 180;
const IG_REELS_BUDGET = 120;

// Combined ranking score: match dominates (60%), reach is secondary (30%),
// engagement rate is a tiebreaker (10%). All three on a 0-100 scale so the
// weights actually mean what they say.
function combinedScore(v: ViralVideo): number {
  // Virality on log scale: 10k → 40, 100k → 60, 1M → 80, 10M → 100.
  const virality = Math.min(
    100,
    40 + 20 * Math.log10(Math.max(v.views / 10_000, 1)),
  );
  // Engagement rate capped at 10% (anything beyond is likely a weird skew).
  const engagementRate = v.likes / Math.max(v.views, 1);
  const engagement = Math.min(100, engagementRate * 1000);
  return v.matchScore * 0.6 + virality * 0.3 + engagement * 0.1;
}

export type ScoutEvent =
  | { type: "source"; source: SourceProfile; cached: boolean }
  | { type: "niche"; niche: NicheProfile; cached: boolean }
  | { type: "phase"; message: string }
  | { type: "scraped"; rawCount: number; qualifiedCount: number }
  | {
      type: "result";
      videos: Record<Region, ViralVideo[]>;
      feed: ViralVideo[];
      generatedAt: string;
      mock: boolean;
    }
  | { type: "error"; message: string };

export async function POST(request: NextRequest) {
  const { input } = (await request.json()) as { input?: string };
  const parsed = input ? parseHandle(input) : null;
  if (!parsed) {
    return Response.json(
      { error: "Bitte Instagram- oder TikTok-Handle/Link eingeben." },
      { status: 400 },
    );
  }

  const env = readEnv();
  const useMock = !hasLiveKeys(env);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };
      safeEnqueue(enc.encode(`: ${"-".repeat(2048)}\n\n`));
      const emit = (event: ScoutEvent) => {
        safeEnqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const heartbeat = setInterval(() => {
        safeEnqueue(enc.encode(`: ping ${Date.now()}\n\n`));
      }, 15_000);

      try {
        if (useMock) {
          const mock = mockFallback(parsed);
          emit({ type: "source", source: mock.source, cached: false });
          emit({ type: "niche", niche: mock.niche, cached: false });
          const flatFeed = buildFlatFeed(mock.videos);
          emit({
            type: "result",
            videos: mock.videos,
            feed: flatFeed,
            generatedAt: mock.generatedAt,
            mock: true,
          });
        } else {
          await runScout(parsed.platform, parsed.handle, emit);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[scout] pipeline failed:", err);
        emit({ type: "error", message });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by client disconnect */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}

async function runScout(
  platform: Platform,
  handle: string,
  emit: (e: ScoutEvent) => void,
): Promise<void> {
  emit({ type: "phase", message: "Lade Profil…" });

  let source = await getCachedProfile(platform, handle);
  const sourceCached = source !== null;
  if (!source) {
    source =
      platform === "instagram"
        ? await scrapeInstagramProfile(handle)
        : await scrapeTikTokProfile(handle);
    await putProfile(platform, handle, source);
  }
  emit({ type: "source", source, cached: sourceCached });

  emit({ type: "phase", message: "Analysiere Nische…" });
  let niche = await getCachedNiche(platform, handle);
  const nicheCached = niche !== null;
  if (!niche) {
    niche = await extractNiche(source);
    await putNiche(platform, handle, niche);
  }
  emit({ type: "niche", niche, cached: nicheCached });

  emit({ type: "phase", message: "Scanne virale Videos weltweit…" });

  const regional = niche.regionalKeywords;
  const regionalResults = regional
    ? await Promise.all(
        REGIONS.map(async (r) => {
          const kws = regional[r] ?? [];
          if (kws.length === 0)
            return { region: r, videos: [] as RawViralVideo[] };
          try {
            const videos = await searchTikTok(kws, PER_REGION_SEARCH_BUDGET, {
              maxKeywords: kws.length,
              ageDays: MAX_AGE_DAYS,
            });
            return { region: r, videos };
          } catch (err) {
            console.warn(`[scout] regional search ${r} failed:`, err);
            return { region: r, videos: [] as RawViralVideo[] };
          }
        }),
      )
    : [];

  const [globalVideos, hashtagVideos, reelsVideos, shortsVideos] =
    await Promise.all([
      searchTikTok(niche.keywords, GLOBAL_SEARCH_BUDGET, {
        maxKeywords: 10,
        ageDays: MAX_AGE_DAYS,
      }).catch((err) => {
        console.warn("[scout] global search failed:", err);
        return [] as RawViralVideo[];
      }),
      searchTikTokHashtags(niche.hashtags ?? [], HASHTAG_SEARCH_BUDGET, {
        maxHashtags: 10,
        ageDays: MAX_AGE_DAYS,
      }).catch((err) => {
        console.warn("[scout] hashtag search failed:", err);
        return [] as RawViralVideo[];
      }),
      searchInstagramReels(niche.hashtags ?? [], IG_REELS_BUDGET, {
        maxHashtags: 8,
      }).catch((err) => {
        console.warn("[scout] instagram reels search failed:", err);
        return [] as RawViralVideo[];
      }),
      searchYouTubeShorts(niche.keywords, {
        maxKeywords: 4,
        ageDays: MAX_AGE_DAYS,
      }).catch((err) => {
        console.warn("[scout] youtube shorts search failed:", err);
        return [] as RawViralVideo[];
      }),
    ]);

  // Virality-tier gate: at least one of these must hold.
  const now = Date.now();
  const meetsVirality = (v: RawViralVideo): boolean => {
    const ts = Date.parse(v.publishedAt);
    if (Number.isNaN(ts)) return false;
    const ageDays = (now - ts) / (24 * 60 * 60 * 1000);
    if (ageDays < 0) return false;
    for (const tier of VIRALITY_TIERS) {
      if (v.views >= tier.minViews && ageDays <= tier.maxAgeDays) return true;
    }
    return false;
  };

  const dedup = new Map<string, RawViralVideo>();
  const searchHints = new Map<string, Region | "global">();
  const accept = (v: RawViralVideo, hint: Region | "global") => {
    if (dedup.has(v.id)) return;
    if (v.views < MIN_VIEWS) return;
    if (!meetsVirality(v)) return;
    dedup.set(v.id, v);
    searchHints.set(v.id, hint);
  };
  for (const { region, videos } of regionalResults) {
    for (const v of videos) accept(v, region);
  }
  for (const v of globalVideos) accept(v, "global");
  for (const v of hashtagVideos) accept(v, "global");
  for (const v of reelsVideos) accept(v, "global");
  for (const v of shortsVideos) accept(v, "global");

  const qualified = Array.from(dedup.values());
  const rawTotal =
    regionalResults.reduce((s, r) => s + r.videos.length, 0) +
    globalVideos.length +
    hashtagVideos.length +
    reelsVideos.length +
    shortsVideos.length;
  const sourceBreakdown = {
    regional: regionalResults.reduce((s, r) => s + r.videos.length, 0),
    global: globalVideos.length,
    hashtag: hashtagVideos.length,
    reels: reelsVideos.length,
    shorts: shortsVideos.length,
  };
  console.log(
    `[scout] sources: regional=${sourceBreakdown.regional} global=${sourceBreakdown.global} hashtag=${sourceBreakdown.hashtag} reels=${sourceBreakdown.reels} shorts=${sourceBreakdown.shorts} → raw=${rawTotal} → qualified=${qualified.length}`,
  );
  emit({
    type: "scraped",
    rawCount: rawTotal,
    qualifiedCount: qualified.length,
  });

  emit({ type: "phase", message: "Ranke Treffer mit Claude…" });
  const rankings = await rankVideos(niche, qualified);
  const rankById = new Map(rankings.map((r) => [r.id, r]));

  // Log match-score distribution so we see WHERE the funnel bleeds.
  const scoreDist = {
    "90+": 0,
    "80-89": 0,
    "70-79": 0,
    "60-69": 0,
    "50-59": 0,
    "40-49": 0,
    "<40": 0,
  };
  for (const r of rankings) {
    if (r.matchScore >= 90) scoreDist["90+"]++;
    else if (r.matchScore >= 80) scoreDist["80-89"]++;
    else if (r.matchScore >= 70) scoreDist["70-79"]++;
    else if (r.matchScore >= 60) scoreDist["60-69"]++;
    else if (r.matchScore >= 50) scoreDist["50-59"]++;
    else if (r.matchScore >= 40) scoreDist["40-49"]++;
    else scoreDist["<40"]++;
  }
  console.log(
    `[scout] match distribution: ${Object.entries(scoreDist)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ")}  (cutoff >=${MIN_MATCH_SCORE})`,
  );

  // Build the flat feed: every video that passes the match-score gate,
  // annotated with its resolved region for the card badge.
  const scored: ViralVideo[] = [];
  for (const v of qualified) {
    const rank = rankById.get(v.id);
    if (!rank) continue;
    if (rank.matchScore < MIN_MATCH_SCORE) continue;
    const region = resolveRegion(v, searchHints.get(v.id));
    scored.push({
      id: v.id,
      platform: v.sourcePlatform,
      creator: v.creator,
      creatorHandle: v.creatorHandle,
      region,
      country: v.country,
      language: v.language,
      url: v.url,
      thumbnailUrl: null,
      caption: v.caption,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      publishedAt: v.publishedAt,
      matchScore: rank.matchScore,
      hook: rank.hook,
      remixIdea: rank.remixIdea,
    });
  }

  // Sort by combined match-dominant score. This way an on-niche 300k-view
  // video beats a semi-relevant 5M-view one, which matches user intent.
  scored.sort((a, b) => {
    const diff = combinedScore(b) - combinedScore(a);
    if (diff !== 0) return diff;
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  });

  const feed = scored.slice(0, TOTAL_VIDEOS_SHOWN);

  // Keep region buckets populated for legacy UI / analytics — top-per-region
  // extracted from the same sorted pool.
  const byRegion: Record<Region, ViralVideo[]> = {
    africa: [],
    asia: [],
    europe: [],
    "north-america": [],
    "south-america": [],
  };
  for (const v of scored) byRegion[v.region].push(v);

  emit({
    type: "result",
    videos: byRegion,
    feed,
    generatedAt: new Date().toISOString(),
    mock: false,
  });
}

function regionByLanguage(language: string): Region {
  if (["ar", "sw", "ha", "yo", "am"].includes(language)) return "africa";
  if (
    [
      "hi", "id", "th", "ja", "ko", "zh", "vi", "tl", "ur",
      "bn", "ta", "my", "km", "lo", "ms", "fa",
    ].includes(language)
  ) {
    return "asia";
  }
  if (["pt"].includes(language)) return "south-america";
  if (
    [
      "de", "fr", "it", "nl", "pl", "sv", "no", "da", "fi",
      "el", "cs", "hu", "ro", "uk", "ru", "bg", "sk", "tr",
    ].includes(language)
  ) {
    return "europe";
  }
  return "north-america";
}

const HINT_LANG_WHITELIST: Record<Region, Set<string>> = {
  africa: new Set(["ar", "sw", "ha", "yo", "am", "fr"]),
  asia: new Set([
    "hi", "id", "th", "ja", "ko", "zh", "vi", "tl", "ur",
    "bn", "ta", "my", "km", "lo", "ms", "fa",
  ]),
  europe: new Set([
    "de", "fr", "it", "nl", "pl", "sv", "no", "da", "fi",
    "el", "cs", "hu", "ro", "uk", "ru", "bg", "sk", "tr",
  ]),
  "north-america": new Set(["es"]),
  "south-america": new Set(["pt", "es"]),
};

function resolveRegion(
  video: RawViralVideo,
  hint: Region | "global" | undefined,
): Region {
  if (
    hint &&
    hint !== "global" &&
    HINT_LANG_WHITELIST[hint].has(video.language)
  ) {
    return hint;
  }
  return regionByLanguage(video.language);
}

// Mock-mode helper: flatten the region-keyed mock into a sorted feed
// so the UI doesn't need to branch.
function buildFlatFeed(
  bucketed: Record<Region, ViralVideo[]>,
): ViralVideo[] {
  const all: ViralVideo[] = [];
  for (const r of REGIONS) all.push(...bucketed[r]);
  all.sort(
    (a, b) =>
      combinedScore(b) - combinedScore(a) ||
      Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
  return all.slice(0, TOTAL_VIDEOS_SHOWN);
}

function mockFallback(parsed: {
  platform: Platform;
  handle: string;
}): ScoutResult {
  return {
    ...MOCK_RESULT,
    source: {
      ...MOCK_RESULT.source,
      platform: parsed.platform,
      handle: parsed.handle,
      url:
        parsed.platform === "tiktok"
          ? `https://tiktok.com/@${parsed.handle}`
          : `https://instagram.com/${parsed.handle}`,
    },
    generatedAt: new Date().toISOString(),
  };
}
