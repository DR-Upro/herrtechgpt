import { safeTruncate } from "../text";
import type { RawViralVideo } from "./tiktok";

// YouTube Data API v3 — we use plain fetch, no SDK.
// search.list: 100 units per call
// videos.list: ~2 units per call
// Free tier: 10,000 units/day (~30 scouts with 3 search-keywords each)

const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YT_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

const MAX_SHORT_SECONDS = 90;

function iso8601DurationToSeconds(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

type SearchItem = {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    channelId: string;
    publishedAt: string;
    defaultAudioLanguage?: string;
    defaultLanguage?: string;
  };
};

type VideoItem = {
  id: string;
  snippet: SearchItem["snippet"];
  contentDetails: { duration: string };
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
};

async function searchOnce(
  query: string,
  ageDays: number,
  apiKey: string,
): Promise<string[]> {
  const publishedAfter = new Date(
    Date.now() - ageDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const url = new URL(YT_SEARCH_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoDuration", "short");
  url.searchParams.set("order", "viewCount");
  url.searchParams.set("maxResults", "25");
  url.searchParams.set("publishedAfter", publishedAfter);
  url.searchParams.set("q", query);

  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`YouTube search failed ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { items?: SearchItem[] };
  return (data.items ?? []).map((i) => i.id.videoId).filter(Boolean);
}

async function fetchVideoDetails(
  ids: string[],
  apiKey: string,
): Promise<VideoItem[]> {
  if (ids.length === 0) return [];
  // videos.list accepts up to 50 IDs per call.
  const url = new URL(YT_VIDEOS_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet,contentDetails,statistics");
  url.searchParams.set("id", ids.slice(0, 50).join(","));

  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`YouTube videos failed ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { items?: VideoItem[] };
  return data.items ?? [];
}

function mapVideos(items: VideoItem[]): RawViralVideo[] {
  return items
    .filter((v) => {
      const secs = iso8601DurationToSeconds(v.contentDetails.duration);
      return secs > 0 && secs <= MAX_SHORT_SECONDS;
    })
    .map((v) => ({
      id: `yt-${v.id}`,
      sourcePlatform: "shorts" as const,
      creator: v.snippet.channelTitle,
      creatorHandle: v.snippet.channelTitle,
      country: "??",
      language: (
        v.snippet.defaultAudioLanguage ??
        v.snippet.defaultLanguage ??
        "??"
      )
        .toLowerCase()
        .split("-")[0],
      url: `https://www.youtube.com/shorts/${v.id}`,
      caption: safeTruncate(
        [v.snippet.title, v.snippet.description].filter(Boolean).join(" — "),
        500,
      ),
      views: Number(v.statistics.viewCount ?? 0),
      likes: Number(v.statistics.likeCount ?? 0),
      comments: Number(v.statistics.commentCount ?? 0),
      publishedAt: v.snippet.publishedAt,
    }));
}

export async function searchYouTubeShorts(
  keywords: string[],
  { maxKeywords = 3, ageDays = 28 }: { maxKeywords?: number; ageDays?: number } = {},
): Promise<RawViralVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return []; // graceful no-op when key missing

  const used = keywords.slice(0, maxKeywords).filter((k) => k.trim());
  if (used.length === 0) return [];

  try {
    const idBatches = await Promise.all(
      used.map((q) =>
        searchOnce(q, ageDays, apiKey).catch((err) => {
          console.warn(`[scout] YT search "${q}" failed:`, err);
          return [] as string[];
        }),
      ),
    );
    const allIds = Array.from(new Set(idBatches.flat()));
    const details = await fetchVideoDetails(allIds, apiKey);
    return mapVideos(details);
  } catch (err) {
    console.warn("[scout] YT Shorts pipeline failed:", err);
    return [];
  }
}
