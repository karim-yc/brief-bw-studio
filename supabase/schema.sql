-- ════════════════════════════════════════════════════════
--  BW Studio — Supabase schema
--  Coller dans : Supabase → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.briefs (
  id           BIGSERIAL    PRIMARY KEY,
  brief_id     TEXT         UNIQUE NOT NULL,
  submitted_at TIMESTAMPTZ,
  statut       TEXT         DEFAULT 'soumis',
  marque       TEXT,
  departement  TEXT,
  demandeur    TEXT,
  priorite     TEXT,
  data         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- Index pour tris et filtres rapides
CREATE INDEX IF NOT EXISTS briefs_submitted_at_idx ON public.briefs (submitted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS briefs_statut_idx       ON public.briefs (statut);
CREATE INDEX IF NOT EXISTS briefs_marque_idx       ON public.briefs (marque);
CREATE INDEX IF NOT EXISTS briefs_data_gin_idx     ON public.briefs USING GIN (data);

-- Row Level Security (obligatoire sur Supabase)
ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;

-- Dashboard : lecture publique
CREATE POLICY "public_read" ON public.briefs
  FOR SELECT USING (true);

-- Formulaire : insertion publique
CREATE POLICY "public_insert" ON public.briefs
  FOR INSERT WITH CHECK (true);
