import { runActor } from "./apify";
import type { SourceProfile } from "../types";

type ApifyIgItem = {
  username?: string;
  fullName?: string;
  biography?: string;
  followersCount?: number;
  postsCount?: number;
  latestPosts?: Array<{ caption?: string }>;
};

export async function scrapeInstagramProfile(
  handle: string,
): Promise<SourceProfile> {
  const items = await runActor<ApifyIgItem>(
    "apify/instagram-profile-scraper",
    {
      usernames: [handle],
      resultsLimit: 40,
    },
    { timeoutSecs: 120 },
  );

  const item = items[0];
  if (!item) {
    throw new Error(`Instagram profile @${handle} not found`);
  }

  const captions =
    item.latestPosts
      ?.map((p) => p.caption?.trim())
      .filter((c): c is string => !!c && c.length > 0)
      .slice(0, 40) ?? [];

  return {
    platform: "instagram",
    handle,
    url: `https://instagram.com/${handle}`,
    displayName: item.fullName ?? null,
    bio: item.biography ?? null,
    followerCount: item.followersCount ?? null,
    postCount: item.postsCount ?? null,
    recentCaptions: captions,
  };
}
