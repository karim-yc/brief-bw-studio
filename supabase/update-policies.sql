-- ════════════════════════════════════════════════════════════
--  Politiques RLS manquantes — public.briefs
--  À exécuter dans Supabase SQL Editor
--  supabase.com → project zpapoywzilwubjglhsmu → SQL Editor
-- ════════════════════════════════════════════════════════════

-- 1. UPDATE public (permet de changer le statut depuis le dashboard)
CREATE POLICY "public_update"
  ON public.briefs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 2. DELETE public (permet de supprimer depuis le SQL Editor ou un script)
CREATE POLICY "public_delete"
  ON public.briefs
  FOR DELETE
  USING (true);
