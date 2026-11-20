-- ════════════════════════════════════════════════════════════
-- REALTIME : Activer postgres_changes pour la table `briefs`
-- Projet : zpapoywzilwubjglhsmu
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ════════════════════════════════════════════════════════════
-- Sans cette commande, les canaux Realtime reçoivent SUBSCRIBED
-- mais aucun événement INSERT/UPDATE n'est livré côté client.

ALTER PUBLICATION supabase_realtime ADD TABLE public.briefs;
