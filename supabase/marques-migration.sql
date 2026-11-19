-- ════════════════════════════════════════════════════════════
-- MIGRATION : table `marques` + table `admins`
-- À exécuter dans le SQL Editor de Supabase
-- Effet : crée les tables, insère les marques de base,
--         configure RLS (lecture publique, écriture admin uniquement)
-- ════════════════════════════════════════════════════════════

-- 1. Table des marques (source de vérité partagée)
CREATE TABLE IF NOT EXISTS public.marques (
  id          TEXT      PRIMARY KEY,          -- slug stable (bnw, marquise, pokawa, autre)
  label       TEXT      NOT NULL,             -- nom affiché (modifiable)
  color       TEXT      NOT NULL DEFAULT '#6366f1',
  is_active   BOOLEAN   NOT NULL DEFAULT true, -- false = masquée des nouveaux briefs
  is_base     BOOLEAN   NOT NULL DEFAULT false, -- true = marque native (pas supprimable)
  sort_order  INTEGER   NOT NULL DEFAULT 99,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER marques_updated_at
  BEFORE UPDATE ON public.marques
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Données de base (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO public.marques (id, label, color, is_active, is_base, sort_order) VALUES
  ('bnw',      'Black & White Burger', '#1a1a1a', true, true, 1),
  ('marquise', 'Maison Marquise',      '#c8a96e', true, true, 2),
  ('pokawa',   'Pokawa',               '#00b96b', true, true, 3),
  ('autre',    'Autre marque',         '#6b7280', true, true, 99)
ON CONFLICT (id) DO NOTHING;

-- 3. Table des admins (lie un user Supabase Auth à un rôle admin)
CREATE TABLE IF NOT EXISTS public.admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. RLS — activer sur les deux tables
ALTER TABLE public.marques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins  ENABLE ROW LEVEL SECURITY;

-- 5. Politiques marques
-- Lecture : tout le monde (y compris anon)
CREATE POLICY "marques_select_public"
  ON public.marques FOR SELECT
  TO anon, authenticated
  USING (true);

-- Écriture : uniquement les admins authentifiés
CREATE POLICY "marques_insert_admin"
  ON public.marques FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  ));

CREATE POLICY "marques_update_admin"
  ON public.marques FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  ));

CREATE POLICY "marques_delete_admin"
  ON public.marques FOR DELETE
  TO authenticated
  USING (
    NOT is_base AND EXISTS (
      SELECT 1 FROM public.admins WHERE user_id = auth.uid()
    )
  );

-- 6. Politiques admins
-- Lecture : uniquement les admins eux-mêmes
CREATE POLICY "admins_select_self"
  ON public.admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Pas de politique INSERT/UPDATE/DELETE sur admins :
-- les admins sont gérés directement via le dashboard Supabase.

-- ════════════════════════════════════════════════════════════
-- APRÈS EXÉCUTION :
-- 1. Allez dans Authentication > Users, créez un compte admin
--    (ex: admin@bnwburger.com + mot de passe sécurisé)
-- 2. Copiez l'UUID de cet utilisateur
-- 3. Exécutez dans le SQL Editor :
--    INSERT INTO public.admins (user_id) VALUES ('<UUID>');
-- ════════════════════════════════════════════════════════════
