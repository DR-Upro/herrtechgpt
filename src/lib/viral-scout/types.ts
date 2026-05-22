export type Platform = "instagram" | "tiktok";

export const REGIONS = [
  "africa",
  "asia",
  "europe",
  "north-america",
  "south-america",
] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_META: Record<
  Region,
  { label: string; emoji: string; color: string }
> = {
  africa: { label: "Afrika", emoji: "🌍", color: "#ff6a3d" },
  asia: { label: "Asien", emoji: "🌏", color: "#00d4ff" },
  europe: { label: "Europa", emoji: "🌍", color: "#a78bfa" },
  "north-america": { label: "Nordamerika", emoji: "🌎", color: "#34d399" },
  "south-america": { label: "Südamerika", emoji: "🌎", color: "#f59e0b" },
};

export type SourceProfile = {
  platform: Platform;
  handle: string;
  url: string;
  displayName: string | null;
  bio: string | null;
  followerCount: number | null;
  postCount: number | null;
  recentCaptions: string[];
};

export type NicheProfile = {
  niche: string;
  positioning?: string;
  themes: string[];
  signatureTools?: string[];
  keywords: string[];
  hashtags?: string[];
  regionalKeywords?: Record<Region, string[]>;
  style: string;
  audience: string;
  languages: string[];
  summary: string;
};

export type DiscoveryPlatform = "tiktok" | "reels" | "shorts";

export type ViralVideo = {
  id: string;
  platform: DiscoveryPlatform;
  creator: string;
  creatorHandle: string;
  region: Region;
  country: string;
  language: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  matchScore: number;
  hook: string;
  remixIdea: string;
};

export type ScoutResult = {
  source: SourceProfile;
  niche: NicheProfile;
  videos: Record<Region, ViralVideo[]>;
  generatedAt: string;
  mock: boolean;
};

export function parseHandle(input: string): {
  platform: Platform;
  handle: string;
} | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tiktokMatch = trimmed.match(
    /(?:tiktok\.com\/@?)([A-Za-z0-9_.-]+)|^@?([A-Za-z0-9_.-]+)$/,
  );
  if (trimmed.includes("tiktok.com")) {
    const m = trimmed.match(/tiktok\.com\/@?([A-Za-z0-9_.-]+)/);
    if (m) return { platform: "tiktok", handle: m[1] };
  }
  if (trimmed.includes("instagram.com")) {
    const m = trimmed.match(/instagram\.com\/([A-Za-z0-9_.-]+)/);
    if (m) return { platform: "instagram", handle: m[1] };
  }
  if (tiktokMatch) {
    const raw = (tiktokMatch[1] ?? tiktokMatch[2] ?? "").replace(/^@/, "");
    if (raw) return { platform: "instagram", handle: raw };
  }
  return null;
}
