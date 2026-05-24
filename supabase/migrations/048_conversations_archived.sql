-- Conversation-Archiv: Zwischenzustand zwischen aktivem Chat und Loeschung.
-- Archivierte Chats verschwinden aus der Default-Sidebar-Liste, bleiben aber
-- per "Archiv"-Toggle abrufbar und lassen sich jederzeit wiederherstellen.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Partial-Index: typischer Query in der Sidebar ist
-- WHERE user_id = ? AND archived = false ORDER BY updated_at DESC.
-- Mit Partial-Index sparen wir Platz und Lesezeit fuer den heissen Pfad.
CREATE INDEX IF NOT EXISTS idx_conversations_active
  ON public.conversations (user_id, updated_at DESC)
  WHERE archived = false;

-- Sekundaerer Index fuer die Archiv-Liste.
CREATE INDEX IF NOT EXISTS idx_conversations_archived
  ON public.conversations (user_id, updated_at DESC)
  WHERE archived = true;
