-- ════════════════════════════════════════════════════════════
-- MIGRATION : Table privée monday_tasks
-- Projet : zpapoywzilwubjglhsmu
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ════════════════════════════════════════════════════════════
-- But : remplacer api/monday-tasks.json (public) par une table
-- accessible uniquement aux utilisateurs authentifiés (RLS).

-- 1. Créer la table
CREATE TABLE IF NOT EXISTS public.monday_tasks (
  id          INTEGER PRIMARY KEY DEFAULT 1,
  data        JSONB   NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Activer RLS
ALTER TABLE public.monday_tasks ENABLE ROW LEVEL SECURITY;

-- 3. Policy : lecture réservée aux administrateurs (table admins)
CREATE POLICY "admin_read_monday" ON public.monday_tasks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()
  ));

-- 4. Policy : écriture réservée au service_role (GitHub Action)
CREATE POLICY "service_write_monday" ON public.monday_tasks
  FOR ALL USING (auth.role() = 'service_role');

-- 5. Ligne initiale (id=1 fixe — on fait toujours un upsert sur id=1)
INSERT INTO public.monday_tasks (id, data, updated_at)
VALUES (
  1,
  '{"ok":false,"count":0,"tasks":[],"source":"pending-setup","updatedAt":null}',
  NOW()
)
ON CONFLICT (id) DO NOTHING;
