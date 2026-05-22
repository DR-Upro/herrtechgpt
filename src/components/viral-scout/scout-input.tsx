"use client";

import { Search, Loader2, Sparkles } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

export function ScoutInput({ value, onChange, onSubmit, loading }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!loading) onSubmit();
      }}
      className="w-full max-w-2xl flex items-center gap-2 rounded-[var(--radius-xl)] border border-border bg-surface p-2 focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--ht-primary-light)]"
    >
      <Search className="w-4 h-4 ml-2 text-muted shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="instagram.com/herr_tech  oder  tiktok.com/@herr_tech"
        className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-light"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="btn-primary"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Scannt…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Scout starten
          </>
        )}
      </button>
    </form>
  );
}
