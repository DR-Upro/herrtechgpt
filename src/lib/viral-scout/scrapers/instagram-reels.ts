import { runActor } from "./apify";
import { safeTruncate } from "../text";
import type { RawViralVideo } from "./tiktok";

type IgPost = {
  id?: string;
  shortCode?: string;
  type?: string; // "Video" | "Sidecar" | "Image"
  url?: string;
  caption?: string;
  timestamp?: string;
  videoViewCount?: number;
  videoPlayCount?: number;
  likesCount?: number;
  commentsCount?: number;
  ownerUsername?: string;
  ownerFullName?: string;
  locationName?: string;
  productType?: string; // "clips" = Reel
};

function mapIgPosts(posts: IgPost[]): RawViralVideo[] {
  return posts
    .filter((p) => {
      const isReel =
        p.productType === "clips" || p.type === "Video" || !!p.videoViewCount;
      return !!p.shortCode && !!p.ownerUsername && isReel;
    })
    .map((p) => {
      const views = p.videoPlayCount ?? p.videoViewCount ?? 0;
      return {
        id: `ig-${p.shortCode!}`,
        sourcePlatform: "reels" as const,
        creator: p.ownerFullName ?? p.ownerUsername!,
        creatorHandle: `@${p.ownerUsername!}`,
        country: "??", // IG rarely exposes country; let language classifier decide
        language: "??",
        url: `https://www.instagram.com/reel/${p.shortCode!}/`,
        caption: safeTruncate(p.caption ?? "", 500),
        views,
        likes: p.likesCount ?? 0,
        comments: p.commentsCount ?? 0,
        publishedAt: p.timestamp ?? new Date().toISOString(),
      };
    });
}

export async function searchInstagramReels(
  hashtags: string[],
  maxItems = 60,
  { maxHashtags = 6 }: { maxHashtags?: number } = {},
): Promise<RawViralVideo[]> {
  if (hashtags.length === 0) return [];

  const used = hashtags
    .slice(0, maxHashtags)
    .map((h) => h.replace(/^#/, "").trim())
    .filter(Boolean);
  if (used.length === 0) return [];

  const items = await runActor<IgPost>(
    "apify/instagram-scraper",
    {
      search: used[0],
      searchType: "hashtag",
      directUrls: used.map((h) => `https://www.instagram.com/explore/tags/${h}/`),
      resultsType: "posts",
      resultsLimit: Math.ceil(maxItems / used.length),
      addParentData: false,
    },
    { timeoutSecs: 240 },
  );

  return mapIgPosts(items);
}
