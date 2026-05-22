-- Viral-Scout-Cache: hält Apify-Scrape-Ergebnisse und Claude-Niche-Profile
-- pro Creator-Handle für 24h, damit Wiederholungs-Scouts gratis sind.

CREATE TABLE IF NOT EXISTS public.viral_scout_cache (
  cache_key text PRIMARY KEY,            -- z.B. "profile:tiktok:@drupro" oder "niche:instagram:@xy"
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_viral_scout_cache_expires
  ON public.viral_scout_cache (expires_at);

ALTER TABLE public.viral_scout_cache ENABLE ROW LEVEL SECURITY;

-- Nur Service-Role schreibt/liest. Frontend ruft die API-Route auf, nicht direkt.
DROP POLICY IF EXISTS "service_role full access" ON public.viral_scout_cache;
CREATE POLICY "service_role full access"
  ON public.viral_scout_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Viral-Scout-Jobs: pro Lauf wird ein Job angelegt, damit der User die Historie
-- seiner Scouts sehen kann (in /admin/scouts oder im User-Dashboard).
CREATE TABLE IF NOT EXISTS public.viral_scout_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'instagram')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'error')),
  niche_summary text,
  result jsonb,
  error_message text,
  credits_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_viral_scout_jobs_user_created
  ON public.viral_scout_jobs (user_id, created_at DESC);

ALTER TABLE public.viral_scout_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own scouts" ON public.viral_scout_jobs;
CREATE POLICY "users see own scouts"
  ON public.viral_scout_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_role manages scouts" ON public.viral_scout_jobs;
CREATE POLICY "service_role manages scouts"
  ON public.viral_scout_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
