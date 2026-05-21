-- Video Creator: User-Stats-Zähler
-- Ersetzt das alte Prisma-basierte User-Tabellen-Increment im Video-Creator-Worker.
-- Eine Zeile pro User, via SECURITY DEFINER RPC atomar erhöhbar.

CREATE TABLE IF NOT EXISTS public.video_creator_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  projects_created INTEGER NOT NULL DEFAULT 0,
  images_generated INTEGER NOT NULL DEFAULT 0,
  videos_generated INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.video_creator_stats ENABLE ROW LEVEL SECURITY;

-- User sieht nur seine eigene Zeile
DROP POLICY IF EXISTS "Users read own stats" ON public.video_creator_stats;
CREATE POLICY "Users read own stats"
  ON public.video_creator_stats FOR SELECT
  USING (auth.uid() = user_id);

-- Admins sehen alle
DROP POLICY IF EXISTS "Admins read all stats" ON public.video_creator_stats;
CREATE POLICY "Admins read all stats"
  ON public.video_creator_stats FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Schreiben nur via RPC (unten). Service-Role umgeht RLS sowieso — das ist die Route,
-- die der Worker nutzt. Direkte Writes via anon/authenticated sind damit blockiert.

-- Atomic Increment via RPC. SECURITY DEFINER, damit der Worker-Service-Role-Call
-- (oder später auch authenticated User direkt) nicht an RLS vorbeibrechen muss.
CREATE OR REPLACE FUNCTION public.video_creator_increment_stat(
  p_user_id UUID,
  p_field TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_field NOT IN ('projects_created', 'images_generated', 'videos_generated') THEN
    RAISE EXCEPTION 'Ungültiges Feld: %', p_field;
  END IF;

  INSERT INTO public.video_creator_stats (user_id, projects_created, images_generated, videos_generated)
  VALUES (
    p_user_id,
    CASE WHEN p_field = 'projects_created' THEN 1 ELSE 0 END,
    CASE WHEN p_field = 'images_generated' THEN 1 ELSE 0 END,
    CASE WHEN p_field = 'videos_generated' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    projects_created = public.video_creator_stats.projects_created
      + CASE WHEN p_field = 'projects_created' THEN 1 ELSE 0 END,
    images_generated = public.video_creator_stats.images_generated
      + CASE WHEN p_field = 'images_generated' THEN 1 ELSE 0 END,
    videos_generated = public.video_creator_stats.videos_generated
      + CASE WHEN p_field = 'videos_generated' THEN 1 ELSE 0 END,
    updated_at = NOW();
END;
$$;

-- Nur Service-Role darf RPC aufrufen (der Worker auf Hetzner).
REVOKE ALL ON FUNCTION public.video_creator_increment_stat(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.video_creator_increment_stat(UUID, TEXT) TO service_role;
