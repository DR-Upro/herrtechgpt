"use client";

import { ExternalLink, Heart, MessageCircle, Eye, Clock } from "lucide-react";
import type { ViralVideo } from "@/lib/viral-scout/types";
import { REGION_META } from "@/lib/viral-scout/types";

const formatNumber = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

const platformLabel = (p: string) => {
  if (p === "reels") return "Instagram Reels";
  if (p === "shorts") return "YouTube Shorts";
  return "TikTok";
};

const formatAge = (iso: string): string => {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms) || ms < 0) return "—";
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return "heute";
  if (days === 1) return "gestern";
  if (days < 30) return `vor ${days} Tagen`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `vor ${weeks} Wochen`;
  const months = Math.round(days / 30);
  return `vor ${months} Mon.`;
};

export function CreatorCard({ video }: { video: ViralVideo }) {
  const regionMeta = REGION_META[video.region];
  return (
    <div className="card-static p-5 hover:bg-card-hover hover:border-primary/60 transition-all">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground leading-tight truncate">
            {video.creator}
          </h3>
          <p className="text-xs text-muted mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>{video.creatorHandle}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span>{regionMeta.emoji}</span>
              {regionMeta.label}
            </span>
            <span>·</span>
            <span className="text-primary font-medium">
              {platformLabel(video.platform)}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
            Match
          </div>
          <div className="text-xl font-bold text-primary leading-none mt-0.5">
            {video.matchScore}
          </div>
        </div>
      </div>

      <p className="text-sm text-foreground/90 mb-4 leading-relaxed line-clamp-2">
        {video.caption}
      </p>

      <div className="flex items-center gap-4 text-xs text-muted mb-4 flex-wrap">
        <span className="flex items-center gap-1.5 text-foreground/90 font-medium">
          <Eye className="w-3.5 h-3.5 text-primary" />
          {formatNumber(video.views)}
        </span>
        <span className="flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5" />
          {formatNumber(video.likes)}
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5" />
          {formatNumber(video.comments)}
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <Clock className="w-3.5 h-3.5" />
          {formatAge(video.publishedAt)}
        </span>
      </div>

      <div className="space-y-3 border-t border-border-light pt-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1">
            Hook
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {video.hook}
          </p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1">
            Nachbau-Idee
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {video.remixIdea}
          </p>
        </div>
      </div>

      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
      >
        Video öffnen
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
