-- Migration 2026-11-25 : colonne commentaires d'équipe
-- Idempotent (safe à relancer)
ALTER TABLE briefs ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;
