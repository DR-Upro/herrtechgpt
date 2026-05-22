import { Sparkles } from "lucide-react";
import type { NicheProfile, SourceProfile } from "@/lib/viral-scout/types";

type Props = {
  niche: NicheProfile;
  source: SourceProfile;
  mock: boolean;
};

export function InsightBox({ niche, source, mock }: Props) {
  return (
    <div className="card-static p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-[var(--radius-md)] bg-primary-light flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">
          {mock ? "Mock Insight" : "Nischen-Analyse"}
        </h2>
        {mock && (
          <span className="ml-auto text-[10px] uppercase tracking-wider bg-warning/15 text-warning font-semibold px-2 py-0.5 rounded-full">
            Mock
          </span>
        )}
      </div>

      <p className="text-sm text-foreground/90 leading-relaxed mb-4">
        {mock ? (
          <>
            Das sind Mock-Daten zur UI-Verifikation. Sobald APIs angebunden
            sind, stehen hier die echten Ergebnisse für{" "}
            <span className="text-primary font-medium">
              {source.platform}/{source.handle}
            </span>
            .
          </>
        ) : (
          niche.summary
        )}
      </p>

      {niche.positioning && !mock && (
        <div className="mb-5 pb-4 border-b border-border-light">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
            Positioning
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed italic">
            {niche.positioning}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
            Nische
          </div>
          <div className="text-foreground font-medium">{niche.niche}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
            Sprachen
          </div>
          <div className="text-foreground font-medium">
            {niche.languages.join(" · ")}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
            Themen
          </div>
          <div className="flex flex-wrap gap-1.5">
            {niche.themes.map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-full bg-primary-light text-primary text-xs font-medium"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        {niche.signatureTools && niche.signatureTools.length > 0 && (
          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
              Signature-Tools
            </div>
            <div className="flex flex-wrap gap-1.5">
              {niche.signatureTools.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-md bg-surface-hover text-foreground/90 text-xs font-mono"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
