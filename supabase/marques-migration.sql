-- ════════════════════════════════════════════════════════════
-- MIGRATION : table `marques` + table `admins`
-- Projet : zpapoywzilwubjglhsmu
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ════════════════════════════════════════════════════════════

-- ── 1. Table marques ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marques (
  id          TEXT         PRIMARY KEY,
  label       TEXT         NOT NULL,
  color       TEXT         NOT NULL DEFAULT '#6366f1',
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  is_base     BOOLEAN      NOT NULL DEFAULT false,
  sort_order  INTEGER      NOT NULL DEFAULT 99,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS marques_updated_at ON public.marques;
CREATE TRIGGER marques_updated_at
  BEFORE UPDATE ON public.marques
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. Données initiales ─────────────────────────────────────
-- "autre" est une option de saisie ponctuelle dans le formulaire,
-- pas une marque réelle — elle n'est PAS dans cette table.
INSERT INTO public.marques (id, label, color, is_active, is_base, sort_order) VALUES
  ('bnw',      'Black & White Burger', '#1a1a1a', true, true, 1),
  ('marquise', 'Maison Marquise',      '#c8a96e', true, true, 2),
  ('pokawa',   'Pokawa',               '#00b96b', true, true, 3)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Table admins ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admins (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── 4. Row Level Security ────────────────────────────────────
ALTER TABLE public.marques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins  ENABLE ROW LEVEL SECURITY;

-- marques : lecture publique
DROP POLICY IF EXISTS "marques_select_public" ON public.marques;
CREATE POLICY "marques_select_public"
  ON public.marques FOR SELECT
  TO anon, authenticated
  USING (true);

-- marques : INSERT réservé aux admins
DROP POLICY IF EXISTS "marques_insert_admin" ON public.marques;
CREATE POLICY "marques_insert_admin"
  ON public.marques FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  ));

-- marques : UPDATE réservé aux admins
DROP POLICY IF EXISTS "marques_update_admin" ON public.marques;
CREATE POLICY "marques_update_admin"
  ON public.marques FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  ));

-- Pas de politique DELETE : la suppression n'est pas exposée.
-- La désactivation se fait via UPDATE is_active = false.

-- admins : chaque admin voit sa propre ligne seulement
DROP POLICY IF EXISTS "admins_select_self" ON public.admins;
CREATE POLICY "admins_select_self"
  ON public.admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════
-- APRÈS EXÉCUTION — procédure admin (voir README ci-dessous)
-- ════════════════════════════════════════════════════════════
