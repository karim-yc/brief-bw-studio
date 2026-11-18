// ════════════════════════════════════════════════
//  Supabase config — BW Studio
//  Remplacer les deux valeurs ci-dessous après
//  avoir créé le projet sur supabase.com
// ════════════════════════════════════════════════
//
//  Supabase → Project Settings → API
//    · Project URL   → SUPABASE_URL
//    · anon public   → SUPABASE_ANON_KEY
//
//  La clé anon est SAFE dans le frontend :
//  elle est limitée par les politiques RLS.
// ════════════════════════════════════════════════

const SUPABASE_URL      = 'https://zpapoywzilwubjglhsmu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PhHq5kbGxyntZ8JlSumImA_pqzR8tKL';

// Client Supabase (disponible après chargement de supabase-js CDN)
// eslint-disable-next-line no-undef
const sbClient = (() => {
  if (typeof window.supabase === 'undefined') return null;
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
