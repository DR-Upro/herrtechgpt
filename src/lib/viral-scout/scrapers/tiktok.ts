import { runActor } from "./apify";
import { safeTruncate } from "../text";
import type { SourceProfile } from "../types";

type TikTokItem = {
  id?: string;
  webVideoUrl?: string;
  text?: string;
  createTimeISO?: string;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  authorMeta?: {
    name?: string;
    nickName?: string;
    region?: string;
    fans?: number;
    signature?: string;
  };
  locationMeta?: { countryCode?: string };
  videoMeta?: { duration?: number };
  textLanguage?: string;
};

export type RawViralVideo = {
  id: string;
  sourcePlatform: "tiktok" | "reels" | "shorts";
  creator: string;
  creatorHandle: string;
  country: string;
  language: string;
  url: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
};

function mapTikTokItems(items: TikTokItem[]): RawViralVideo[] {
  return items
    .filter((i) => i.id && i.text && i.authorMeta?.name)
    .map((i) => ({
      id: `tt-${i.id!}`,
      sourcePlatform: "tiktok" as const,
      creator: i.authorMeta?.nickName ?? i.authorMeta!.name!,
      creatorHandle: `@${i.authorMeta!.name!}`,
      country:
        i.locationMeta?.countryCode?.toUpperCase() ??
        i.authorMeta?.region?.toUpperCase() ??
        "??",
      language: (i.textLanguage ?? "en").toLowerCase(),
      url:
        i.webVideoUrl ??
        `https://tiktok.com/@${i.authorMeta!.name!}/video/${i.id!}`,
      caption: safeTruncate(i.text!, 500),
      views: i.playCount ?? 0,
      likes: i.diggCount ?? 0,
      comments: i.commentCount ?? 0,
      publishedAt: i.createTimeISO ?? new Date().toISOString(),
    }));
}

export async function scrapeTikTokProfile(
  handle: string,
): Promise<SourceProfile> {
  const items = await runActor<TikTokItem>(
    "clockworks/tiktok-scraper",
    {
      profiles: [handle],
      resultsPerPage: 40,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    },
    { timeoutSecs: 120 },
  );

  if (items.length === 0) {
    throw new Error(`TikTok profile @${handle} not found`);
  }

  const author = items[0].authorMeta;
  const captions = items
    .map((i) => i.text?.trim())
    .filter((t): t is string => !!t)
    .slice(0, 40);

  return {
    platform: "tiktok",
    handle,
    url: `https://tiktok.com/@${handle}`,
    displayName: author?.nickName ?? null,
    bio: author?.signature ?? null,
    followerCount: author?.fans ?? null,
    postCount: null,
    recentCaptions: captions,
  };
}

export async function searchTikTok(
  keywords: string[],
  maxItems = 40,
  { maxKeywords = 8, ageDays = 28 }: { maxKeywords?: number; ageDays?: number } = {},
): Promise<RawViralVideo[]> {
  if (keywords.length === 0) return [];

  const since = new Date();
  since.setDate(since.getDate() - ageDays);
  const usedKeywords = keywords.slice(0, maxKeywords);

  const items = await runActor<TikTokItem>(
    "clockworks/tiktok-scraper",
    {
      searchQueries: usedKeywords,
      resultsPerPage: Math.max(10, Math.ceil(maxItems / usedKeywords.length)),
      maxItems,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      oldestPostDate: since.toISOString().split("T")[0],
    },
    { timeoutSecs: 240 },
  );

  return mapTikTokItems(items);
}

export async function searchTikTokHashtags(
  hashtags: string[],
  maxItems = 60,
  { maxHashtags = 8, ageDays = 28 }: { maxHashtags?: number; ageDays?: number } = {},
): Promise<RawViralVideo[]> {
  if (hashtags.length === 0) return [];

  const since = new Date();
  since.setDate(since.getDate() - ageDays);
  const used = hashtags
    .slice(0, maxHashtags)
    .map((h) => h.replace(/^#/, "").trim())
    .filter(Boolean);

  if (used.length === 0) return [];

  const items = await runActor<TikTokItem>(
    "clockworks/tiktok-scraper",
    {
      hashtags: used,
      resultsPerPage: Math.max(10, Math.ceil(maxItems / used.length)),
      maxItems,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      oldestPostDate: since.toISOString().split("T")[0],
    },
    { timeoutSecs: 240 },
  );

  return mapTikTokItems(items);
}
