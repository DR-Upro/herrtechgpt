"use client";

import { useState } from "react";
import { Radar, Flame } from "lucide-react";
import { ScoutInput } from "@/components/viral-scout/scout-input";
import { CreatorCard } from "@/components/viral-scout/creator-card";
import { InsightBox } from "@/components/viral-scout/insight-box";
import { readScoutStream } from "@/lib/viral-scout/stream";
import type { NicheProfile, SourceProfile, ViralVideo } from "@/lib/viral-scout/types";

type ResultState = {
  source: SourceProfile | null;
  niche: NicheProfile | null;
  feed: ViralVideo[] | null;
  mock: boolean;
  cachedProfile: boolean;
  cachedNiche: boolean;
};

const EMPTY_RESULT: ResultState = {
  source: null,
  niche: null,
  feed: null,
  mock: false,
  cachedProfile: false,
  cachedNiche: false,
};

export default function ViralScoutWorkflow() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [scrapeStats, setScrapeStats] = useState<{
    raw: number;
    qualified: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState>(EMPTY_RESULT);

  async function runScout() {
    setLoading(true);
    setError(null);
    setPhase("Starte Scout…");
    setScrapeStats(null);
    setResult(EMPTY_RESULT);

    try {
      const res = await fetch("/api/viral-scout/scout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      });

      if (!res.ok) {
        const msg = await res
          .json()
          .then((j: { error?: string }) => j.error)
          .catch(() => "Unbekannter Fehler");
        setError(msg ?? "Fehler");
        setLoading(false);
        setPhase(null);
        return;
      }

      if (!res.body) {
        setError("Keine Antwort vom Server.");
        setLoading(false);
        return;
      }

      for await (const event of readScoutStream(res.body)) {
        switch (event.type) {
          case "phase":
            setPhase(event.message);
            break;
          case "source":
            setResult((r) => ({
              ...r,
              source: event.source,
              cachedProfile: event.cached,
            }));
            break;
          case "niche":
            setResult((r) => ({
              ...r,
              niche: event.niche,
              cachedNiche: event.cached,
            }));
            break;
          case "scraped":
            setScrapeStats({
              raw: event.rawCount,
              qualified: event.qualifiedCount,
            });
            break;
          case "result":
            setResult((r) => ({
              ...r,
              feed: event.feed,
              mock: event.mock,
            }));
            setPhase(null);
            break;
          case "error":
            setError(event.message);
            break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
      setPhase(null);
    }
  }

  const hitCount = result.feed?.length ?? 0;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 sm:px-8 py-12 max-w-5xl mx-auto w-full">
      <header className="w-full text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-light text-primary text-xs font-semibold uppercase tracking-wider mb-5">
          <Radar className="w-3.5 h-3.5" />
          Viral Scout
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-3 text-foreground">
          KI-Viralität,{" "}
          <span className="text-primary">weltweit entdeckt.</span>
        </h1>
        <p className="text-base text-muted max-w-xl mx-auto">
          Klebe einen Instagram- oder TikTok-Account rein. Der Scout analysiert
          Nische & Positioning und zieht die viralsten Videos weltweit —
          sortiert nach Views, ohne Region-Grenze, inklusive Nachbau-Idee.
        </p>
      </header>

      <div className="w-full flex flex-col items-center gap-4 mb-8">
        <ScoutInput
          value={input}
          onChange={setInput}
          onSubmit={runScout}
          loading={loading}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        {loading && phase && (
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
            {phase}
            {(result.cachedProfile || result.cachedNiche) && (
              <span className="text-xs text-primary/80">· Cache-Hit</span>
            )}
          </div>
        )}
        {scrapeStats && !result.feed && (
          <div className="text-xs text-muted font-mono">
            {scrapeStats.qualified} von {scrapeStats.raw} Videos passen
            den Virality-Filter (Views ≥ 25k, tier-gated by age)
          </div>
        )}
      </div>

      {result.niche && result.source && (
        <div className="w-full flex flex-col gap-6">
          <InsightBox
            niche={result.niche}
            source={result.source}
            mock={result.mock}
          />

          {result.feed && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Viralste Treffer
                </h2>
                <span className="text-xs text-muted">
                  — {hitCount} Videos · Match × Viralität × Engagement
                </span>
              </div>
              {hitCount === 0 ? (
                <p className="text-sm text-muted">
                  Keine viralen Treffer für diese Nische gefunden. Minimum:
                  ≥ 25k Views (tier-gated by age), Match ≥ 45. Versuche
                  einen Handle mit breiterer Nische.
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {result.feed.map((v) => (
                    <CreatorCard key={v.id} video={v} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {result.mock && (
        <div className="mt-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium">
          MOCK MODE — keine API-Keys gesetzt, Dummy-Daten
        </div>
      )}
    </main>
  );
}
