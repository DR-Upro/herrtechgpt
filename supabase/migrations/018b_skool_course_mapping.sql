-- Mapping zwischen Skool-Community-Courses und unseren course_modules.
-- Erlaubt dem n8n-Sync-Workflow, neue Skool-Lektionen dem richtigen DB-Modul zuzuordnen.

ALTER TABLE public.course_modules
  ADD COLUMN IF NOT EXISTS skool_course_id TEXT,
  ADD COLUMN IF NOT EXISTS skool_course_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_modules_skool_course_id
  ON public.course_modules(skool_course_id)
  WHERE skool_course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_modules_skool_course_slug
  ON public.course_modules(skool_course_slug)
  WHERE skool_course_slug IS NOT NULL;

-- Seed: 19 Skool-Courses auf bestehende course_modules mappen
-- (skool_course_id = course.id, skool_course_slug = course.name aus Skool-API)

UPDATE public.course_modules SET skool_course_id = 'cb86d2da8b6d47a680056c0c397c96b5', skool_course_slug = '1123cd01' WHERE slug = 'einfach-starten';
UPDATE public.course_modules SET skool_course_id = '19efd5e3637847c28058922419653eba', skool_course_slug = 'dc0bc69b' WHERE slug = 'ki-marketing-course';
UPDATE public.course_modules SET skool_course_id = '53d04d2786034f81b2c24304361c66eb', skool_course_slug = '962c4f29' WHERE slug = 'ki-content-erstellung';
UPDATE public.course_modules SET skool_course_id = '80f86b9cc9a64418a1950dea2dc90b91', skool_course_slug = '84c5a541' WHERE slug = 'seedance';
UPDATE public.course_modules SET skool_course_id = 'f80c9b098afd4a5fa2a05102c70b5368', skool_course_slug = '01fcc8f2' WHERE slug = 'claude';
UPDATE public.course_modules SET skool_course_id = 'bdb3886a2b854e3aae773817cd6b8df1', skool_course_slug = '02a3668d' WHERE slug = 'ki-vertrieb';
UPDATE public.course_modules SET skool_course_id = '78b2f64dd5fc49adb9df451ef14e16fc', skool_course_slug = 'c2e845a5' WHERE slug = 'ki-telefonie';
UPDATE public.course_modules SET skool_course_id = '0b2e6e7a36224fcca74ee5adebabe049', skool_course_slug = '0b0c4037' WHERE slug = 'rechtliche-grenzen';
UPDATE public.course_modules SET skool_course_id = '5a9c02a3289f43dba14e9bbf6415941c', skool_course_slug = 'da461db9' WHERE slug = 'viraler-content';
UPDATE public.course_modules SET skool_course_id = '4b615dfd964845718c7348037f599a57', skool_course_slug = 'ca1a5b8d' WHERE slug = 'veo3';
UPDATE public.course_modules SET skool_course_id = '232c92ee2ec84034be18741bbccea5ae', skool_course_slug = '0b31d952' WHERE slug = 'sora-2';
UPDATE public.course_modules SET skool_course_id = 'ec4206d8b1e44ec3b23a46749a2a6a64', skool_course_slug = 'f22ee9b4' WHERE slug = 'ki-agenten';
UPDATE public.course_modules SET skool_course_id = 'a92c334bd48d485f87e2bb76d5c810b0', skool_course_slug = '54492995' WHERE slug = 'prompt-legende';
UPDATE public.course_modules SET skool_course_id = 'b45d4d1c70a7429ab1a678a48a9d967d', skool_course_slug = 'c24d3b76' WHERE slug = 'ki-seo';
UPDATE public.course_modules SET skool_course_id = '211294913a9e4724b145a8ce4f8d60da', skool_course_slug = 'a95a90e8' WHERE slug = 'ki-toolboard';
UPDATE public.course_modules SET skool_course_id = 'd6966fa9b7a24e74996adbfb81adf177', skool_course_slug = 'd1b0f724' WHERE slug = 'ki-musik';
UPDATE public.course_modules SET skool_course_id = '46f7dee94b0443908d1db29bfabaa77f', skool_course_slug = '8d41a343' WHERE slug = 'passives-einkommen';
UPDATE public.course_modules SET skool_course_id = '33b7e34538e8402f82690634cfeb0451', skool_course_slug = 'c74b3491' WHERE slug = 'community';
UPDATE public.course_modules SET skool_course_id = '18624a3842fa4e8d90c85ff6e5f9aa62', skool_course_slug = 'bbe69708' WHERE slug = 'live-calls';
