/* ════════════════════════════════════════════════════════════
   GCAL-SYNC.JS — Synchronisation automatique Google Calendar
   Appelé après chaque soumission de brief (formulaire + rapide)
   ════════════════════════════════════════════════════════════ */

const GCalSync = (() => {

  const TOKEN_KEY  = 'bw_gcal_token';
  const SYNCED_KEY = 'bw_gcal_synced';
  const GC_TAG     = 'bw-studio-brief';

  function getToken() {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      const t = JSON.parse(raw);
      if (t.exp && Date.now() > t.exp - 60000) {
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return t;
    } catch { return null; }
  }

  function loadSynced() {
    try { return JSON.parse(localStorage.getItem(SYNCED_KEY) || '{}'); } catch { return {}; }
  }

  function saveSynced(m) {
    try { localStorage.setItem(SYNCED_KEY, JSON.stringify(m)); } catch {}
  }

  async function gcPost(token, path, body) {
    const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`GCal API ${res.status}`);
    return res.json();
  }

  function makeGCalEvent(briefData, kind, kindLabel, dateStr, prio) {
    const colorId = prio === 'urgent' ? '11' : prio === 'prioritaire' ? '6' : '9';
    const uid = `${briefData.briefId || 'brief'}-${kind}`;
    return {
      summary: `[BW] ${briefData.ref || 'Brief'} — ${kindLabel}`,
      description: `Brief Studio Créatif\nType : ${briefData.typeDemande || '—'}\nMarque : ${briefData.marque || '—'}\nDemandeur : ${briefData.ref || '—'}\nPriorité : ${prio || 'normal'}\nID : ${briefData.briefId || '—'}\n\n[${GC_TAG}:${uid}]`,
      start: { date: dateStr },
      end:   { date: dateStr },
      colorId,
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }] }
    };
  }

  function toDateStr(val) {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d)) return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  /* Point d'entrée principal — appelé après sendWebhook() */
  async function syncBrief(briefData) {
    const token = getToken();
    if (!token) return; // Pas connecté → silencieux

    const prio = briefData.priorite || briefData.prioriteNiveau || 'normal';
    const dates = [
      { key: 'dateLancement',   kind: 'lancement',  label: 'Lancement' },
      { key: 'dateValidation',  kind: 'validation', label: 'Infos validées' },
      { key: 'dateRetourSimul', kind: 'retour',      label: 'Aperçu visuel' }
    ];

    const synced = loadSynced();
    let created = 0;

    for (const { key, kind, label } of dates) {
      const dateStr = toDateStr(briefData[key]);
      if (!dateStr) continue;
      const uid = `${briefData.briefId || 'brief'}-${kind}`;
      if (synced[uid]) continue; // déjà synchronisé
      try {
        const ev = makeGCalEvent(briefData, kind, label, dateStr, prio);
        const result = await gcPost(token, '/calendars/primary/events', ev);
        if (result.id) {
          synced[uid] = result.id;
          created++;
        }
      } catch (err) {
        console.warn('[GCalSync] Échec création événement:', kind, err.message);
      }
    }

    saveSynced(synced);
    return created;
  }

  return { syncBrief };

})();
