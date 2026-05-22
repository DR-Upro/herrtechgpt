"use client";

import { REGION_META, REGIONS, type Region } from "@/lib/viral-scout/types";

type Props = {
  active: Region;
  counts: Record<Region, number>;
  onSelect: (r: Region) => void;
};

export function RegionTabs({ active, counts, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full">
      {REGIONS.map((r) => {
        const meta = REGION_META[r];
        const isActive = active === r;
        const count = counts[r] ?? 0;
        return (
          <button
            key={r}
            onClick={() => onSelect(r)}
            className={`flex items-center justify-between px-4 py-3 rounded-[var(--radius-xl)] border bg-surface text-sm font-medium transition-all ${
              isActive
                ? "border-primary text-foreground shadow-[0_0_0_3px_var(--ht-primary-light)]"
                : "border-border text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{meta.emoji}</span>
              {meta.label}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                isActive
                  ? "bg-primary text-white"
                  : "bg-surface-secondary text-muted"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
