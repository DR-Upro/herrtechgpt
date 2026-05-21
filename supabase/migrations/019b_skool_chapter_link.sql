-- Speichert Skool-Chapter-Referenz auf Lesson-Ebene, damit Orphan-Lessons
-- (angelegt bevor ihr Kapitel in der DB war) nachträglich automatisch verknüpft werden können.

ALTER TABLE public.module_videos
  ADD COLUMN IF NOT EXISTS skool_chapter_id TEXT;

CREATE INDEX IF NOT EXISTS idx_videos_skool_chapter
  ON public.module_videos(skool_chapter_id)
  WHERE skool_chapter_id IS NOT NULL;

-- RPC: Linkt alle Orphan-Lessons (chapter_id=NULL, aber skool_chapter_id gesetzt)
-- mit dem passenden module_chapters-Eintrag. Gibt Anzahl der verlinkten Rows zurück.
CREATE OR REPLACE FUNCTION public.link_orphan_lessons()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE public.module_videos mv
  SET chapter_id = mc.id
  FROM public.module_chapters mc
  WHERE mv.chapter_id IS NULL
    AND mv.skool_chapter_id IS NOT NULL
    AND mv.skool_chapter_id = mc.skool_chapter_id
    AND mv.module_id = mc.module_id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_orphan_lessons() TO service_role, authenticated;
