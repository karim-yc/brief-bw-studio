-- ════════════════════════════════════════════════════════
--  BW Studio — Migration : archivage des briefs
--  Coller dans : Supabase → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════

-- 1. Colonnes d'archivage
ALTER TABLE public.briefs
  ADD COLUMN IF NOT EXISTS archived    BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Index pour filtrer rapidement les briefs non archivés
CREATE INDEX IF NOT EXISTS briefs_archived_idx ON public.briefs (archived);

-- 3. Policy DELETE (si pas encore appliquée via update-policies.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'briefs' AND policyname = 'public_delete'
  ) THEN
    EXECUTE 'CREATE POLICY "public_delete" ON public.briefs FOR DELETE USING (true)';
  END IF;
END$$;

-- 4. Policy UPDATE (si pas encore appliquée)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'briefs' AND policyname = 'public_update'
  ) THEN
    EXECUTE 'CREATE POLICY "public_update" ON public.briefs FOR UPDATE USING (true) WITH CHECK (true)';
  END IF;
END$$;
