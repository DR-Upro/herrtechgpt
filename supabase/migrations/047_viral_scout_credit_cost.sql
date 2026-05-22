-- Viral-Scout als billable Feature registrieren.
-- Ein Scout-Lauf kostet uns extern ~$3-4 (Apify TikTok-Search + Anthropic Niche+Rank).
-- Default-Preis: 30 Credits/Aktion — Doc kann das im Admin-UI sofort anpassen.

INSERT INTO public.feature_credit_costs (feature, label, credits_per_unit, unit, category, description)
VALUES
  ('viral_scout', 'Viral Scout', 30, 'action', 'toolbox',
   'Nischen-Analyse + viraler Reel-Discovery (TikTok + Instagram Reels + YouTube Shorts)')
ON CONFLICT (feature) DO NOTHING;
