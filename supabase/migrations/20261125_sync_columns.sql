-- Migration 2026-11-25 : colonnes de synchronisation équipe
-- Colle ce SQL dans Supabase > SQL Editor > Run
-- Idempotent (safe à relancer plusieurs fois)

ALTER TABLE briefs ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS checklist_state JSONB DEFAULT '{}'::jsonb;
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS statut_history JSONB DEFAULT '[]'::jsonb;
