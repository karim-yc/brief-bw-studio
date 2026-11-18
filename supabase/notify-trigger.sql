-- ════════════════════════════════════════════════════════════
--  Trigger notification email — nouveaux briefs
--  Prérequis : exécuter update-policies.sql en premier
--
--  Étapes :
--  1. Crée le Google Apps Script (voir apps-script-notif.js)
--  2. Remplace APPS_SCRIPT_WEBHOOK_URL ci-dessous par l'URL
--     obtenue après "Déployer > Nouveau déploiement" dans Apps Script
--  3. Exécute ce fichier dans Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- Activer l'extension pg_net (HTTP depuis PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Fonction appelée à chaque INSERT sur public.briefs
CREATE OR REPLACE FUNCTION public.notify_brief_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payload text;
  _webhook text := 'https://script.google.com/macros/s/AKfycbxdmDrKFqB6k_ZL3IL1AzSMUJ3PgkSjAx7buacI0SWPMPW_AEDFeFaK7zJR00ocezN9/exec';
BEGIN
  IF _webhook = 'APPS_SCRIPT_WEBHOOK_URL' THEN
    RETURN NEW; -- webhook non configuré, on skip silencieusement
  END IF;

  _payload := json_build_object(
    'briefId',     NEW.brief_id,
    'marque',      NEW.marque,
    'departement', NEW.departement,
    'demandeur',   NEW.demandeur,
    'priorite',    NEW.priorite,
    'submittedAt', NEW.submitted_at
  )::text;

  PERFORM extensions.http_post(
    _webhook,
    _payload,
    'application/json'
  );

  RETURN NEW;
END;
$$;

-- Trigger AFTER INSERT
DROP TRIGGER IF EXISTS trg_notify_brief_insert ON public.briefs;
CREATE TRIGGER trg_notify_brief_insert
  AFTER INSERT ON public.briefs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_brief_insert();
