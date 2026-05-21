-- Trackt Skool-natives Video pro Lesson — nur dann brauchen wir den Wistia-Upload-Hinweis.
-- Lessons die generell kein Video haben (nur Description) bekommen keinen Hinweis.

ALTER TABLE public.module_videos
  ADD COLUMN IF NOT EXISTS skool_video_id TEXT;

CREATE INDEX IF NOT EXISTS idx_videos_skool_native
  ON public.module_videos(skool_video_id)
  WHERE skool_video_id IS NOT NULL;
