/* ════════════════════════════════════════════════════════════
   APP.JS — Orchestration, événements, cycle de vie
   ════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let saveTimer = null;

  /* ── Rendu complet ──────────────────────────────────────────── */
  function renderAll() {
    document.getElementById('sections-root').innerHTML = Render.allSections();
    Render.sidebar();
    bindFieldEvents();
  }

  /* ── Re-render léger (juste sidebar, pas tout le DOM) ─────────
     Utilisé pour les inputs texte afin de ne pas perdre le focus */
  function renderSidebarOnly() {
    Render.sidebar();
  }

  /* ════════════════════════════════════════════════════════════
     ÉVÉNEMENTS — délégation sur sections-root
     ════════════════════════════════════════════════════════════ */
  function bindFieldEvents() {
    const root = document.getElementById('sections-root');

    // Inputs texte / textarea / date / select — saisie live
    root.querySelectorAll('input[data-field], textarea[data-field], select[data-field]').forEach(el => {
      el.addEventListener('input', onFieldInput);
      el.addEventListener('change', onFieldInput);
    });

    // Formats / volumes (supports étape 4)
    root.querySelectorAll('input[data-format-field]').forEach(el => {
      el.addEventListener('input', e => {
        State.data.formats[e.target.dataset.formatField] = e.target.value;
        scheduleSave();
        renderSidebarOnly();
      });
    });
    root.querySelectorAll('input[data-volume-field]').forEach(el => {
      el.addEventListener('input', e => {
        State.data.volumes[e.target.dataset.volumeField] = e.target.value;
        scheduleSave();
        renderSidebarOnly();
        updateCardStatus(2);
        updateVolumeTotal();
      });
    });
    root.querySelectorAll('select[data-support-livrable-field]').forEach(el => {
      el.addEventListener('change', e => {
        if (!State.data.supportLivrables) State.data.supportLivrables = {};
        State.data.supportLivrables[e.target.dataset.supportLivrableField] = e.target.value;
        scheduleSave();
        renderSidebarOnly();
      });
    });

    // Packaging table — inputs (nom / format / qté)
    root.querySelectorAll('[data-pack-field]').forEach(el => {
      el.addEventListener('input', () => {
        const idx = parseInt(el.dataset.packIndex, 10);
        const key = el.dataset.packField;
        if (State.data.packagingProducts[idx]) {
          State.data.packagingProducts[idx][key] = el.value;
          scheduleSave();
          updateCardStatus(3);
          renderSidebarOnly();
        }
      });
    });

    // Packaging table — suppression ligne
    root.querySelectorAll('[data-pack-del]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.packDel, 10);
        State.data.packagingProducts.splice(idx, 1);
        scheduleSave();
        renderAll();
      });
    });

    // Packaging table — ajout ligne
    root.querySelectorAll('[data-add-pack-row]').forEach(el => {
      el.addEventListener('click', () => {
        State.data.packagingProducts.push({ nom: '', format: '', qte: '' });
        scheduleSave();
        renderAll();
      });
    });

    // Champ reserves (textarea section 5)
    const reservesEl = root.querySelector('[data-field="reserves"]');
    if (reservesEl) {
      reservesEl.addEventListener('input', () => {
        State.data.reserves = reservesEl.value;
        scheduleSave();
        renderSidebarOnly();
      });
    }

    // Checkbox confirmation globale (section 5)
    const chkGlobal = root.querySelector('#chk-global-confirm');
    if (chkGlobal) {
      chkGlobal.addEventListener('change', () => {
        State.data.globalConfirmed = chkGlobal.checked;
        scheduleSave();
        renderSidebarOnly();
        // Met à jour la classe visuelle sur le label
        const lbl = root.querySelector('.global-confirm-label');
        if (lbl) lbl.classList.toggle('is-confirmed', chkGlobal.checked);
      });
    }
  }

  function onFieldInput(e) {
    const id = e.target.dataset.field;
    if (id === 'reserves') return; // géré par son propre listener dans bindFieldEvents
    State.data[id] = e.target.value;
    scheduleSave();

    // Si le champ impacte l'affichage conditionnel → re-render complet
    const reactiveFields = ['dept', 'typeDemande', 'genreCampagne', 'phasePackaging', 'typeVitrophanie', 'priorite'];
    if (reactiveFields.includes(id)) {
      renderAll();
    } else {
      // Sinon juste mettre à jour le statut de la carte concernée + sidebar
      const sectionMap = { ref: 1, restaurant: 1, deptAutrePrecision: 1, description: 2 };
      updateCardStatus(sectionMap[id] || guessSection(id));
      renderSidebarOnly();
    }
  }

  function guessSection(fieldId) {
    if (CONFIG.champsEtape3.campagne.some(f => f.id === fieldId)) return 3;
    if (CONFIG.champsEtape3.packaging.some(f => f.id === fieldId)) return 3;
    if (CONFIG.champsEtape3.vitrophanie.some(f => f.id === fieldId)) return 3;
    if (CONFIG.champsEtape3.autre.some(f => f.id === fieldId)) return 3;
    if (CONFIG.champsEtape4Deadlines.some(f => f.id === fieldId)) return 4;
    return null;
  }

  function updateVolumeTotal() {
    const total = Object.values(State.data.volumes).reduce((a, b) => a + (parseInt(b) || 0), 0);
    // Le bloc supports vit maintenant dans la section 2 (Que faut-il créer),
    // uniquement pour Campagne Marketing — plus de notion "packaging physique" ici.
    const hint = document.querySelector('#card-body-2 .field-hint');
    if (hint) {
      hint.textContent = `Total déclinaisons visuelles : ${total}`;
    }
  }

  function updateCardStatus(sectionNum) {
    if (!sectionNum) return;
    const keys = { 1: 'qui', 2: 'quoi', 3: 'infos', 4: 'supports' };
    const key = keys[sectionNum];
    if (!key) return;
    const st = State.getSectionStatus(key);
    const badge = document.querySelector(`[data-section="${sectionNum}"] .card-status`);
    if (badge) {
      badge.className = `card-status ${st.status}`;
      badge.textContent = CONFIG.statusLabels[st.status];
    }
  }

  /* ════════════════════════════════════════════════════════════
     CLICS — délégation globale (cartes, pills, toggle sections)
     ════════════════════════════════════════════════════════════ */
  document.addEventListener('click', function (e) {

    // Toggle ouverture/fermeture carte
    const toggleEl = e.target.closest('[data-toggle]');
    if (toggleEl) {
      const n = toggleEl.dataset.toggle;
      State.openSections[n] = !State.openSections[n];
      const head = document.querySelector(`[data-toggle="${n}"]`);
      const body = document.getElementById(`card-body-${n}`);
      head.classList.toggle('open');
      body.classList.toggle('open');
      return;
    }

    // Sélection type de demande (cartes étape 2)
    const typeCard = e.target.closest('[data-type-select]');
    if (typeCard) {
      State.data.typeDemande = typeCard.dataset.typeSelect;
      if (State.data.typeDemande === 'packaging' && State.data.packagingProducts.length === 0) {
        State.data.packagingProducts.push({ nom: '', format: '', qte: '' });
      }
      scheduleSave();
      renderAll();
      State.openSections[3] = true;
      return;
    }

    // Pills génériques (genre, phase, type vitrophanie, priorité, livrable, shooting, etc.)
    const pillEl = e.target.closest('[data-field][data-value]');
    if (pillEl) {
      const field = pillEl.dataset.field;
      const value = pillEl.dataset.value;
      // Toggle off si déjà actif (sauf priorité qui doit rester choisie)
      if (State.data[field] === value) {
        State.data[field] = '';
      } else {
        State.data[field] = value;
      }
      scheduleSave();
      renderAll();
      return;
    }

    // Toggle support multi-select
    const supportEl = e.target.closest('[data-support-toggle]');
    if (supportEl) {
      const sid = supportEl.dataset.supportToggle;
      const idx = State.data.supportsSelected.indexOf(sid);
      if (idx >= 0) {
        State.data.supportsSelected.splice(idx, 1);
        delete State.data.formats[sid];
        delete State.data.volumes[sid];
      } else {
        State.data.supportsSelected.push(sid);
      }
      scheduleSave();
      renderAll();
      return;
    }

    // Navigation depuis sidebar → ouvrir section
    const gotoSection = e.target.closest('[data-goto-section]');
    if (gotoSection) {
      const n = gotoSection.dataset.gotoSection;
      State.openSections[n] = true;
      renderAll();
      setTimeout(() => {
        const card = document.querySelector(`[data-section="${n}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
      return;
    }

    // Navigation vers champ bloquant depuis sidebar
    const gotoField = e.target.closest('[data-goto-field]');
    if (gotoField) {
      const fieldId = gotoField.dataset.gotoField;
      scrollToField(fieldId);
      return;
    }

    // Packaging — ajout ligne (si implémenté plus tard)
    const addRow = e.target.closest('[data-add-row]');
    if (addRow) {
      // réservé extension future
      return;
    }
  });

  function scrollToField(fieldId) {
    // S'assurer que la bonne section est ouverte
    let sectionGuess = guessSection(fieldId);
    if (!sectionGuess) {
      if (fieldId === '__supports') sectionGuess = 2; // supports vivent en section 2 désormais
      else if (fieldId === 'priorite' || fieldId === 'raisonUrgence' || fieldId.startsWith('date')) sectionGuess = 4;
      else if (fieldId === '__type') sectionGuess = 2;
      else sectionGuess = 1;
    }
    State.openSections[sectionGuess] = true;
    renderAll();

    setTimeout(() => {
      let target = document.querySelector(`[data-field-wrap="${fieldId}"]`);
      if (!target) target = document.querySelector(`[data-section="${sectionGuess}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('highlight');
        setTimeout(() => target.classList.remove('highlight'), 1500);
      }
    }, 80);
  }

  /* ════════════════════════════════════════════════════════════
     SAUVEGARDE DEBOUNCED
     ════════════════════════════════════════════════════════════ */
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      State.save();
      showSaveState();
    }, 600);
  }

  function showSaveState() {
    const el = document.getElementById('sb-save-state');
    if (!el) return;
    el.classList.add('show');
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  /* ════════════════════════════════════════════════════════════
     SOUMISSION
     ════════════════════════════════════════════════════════════ */
  function submitBrief() {
    if (!State.isReadyToSubmit()) {
      showToast('Complétez les champs bloquants avant de soumettre');
      return;
    }
    State.data.briefId = State.data.briefId || State.genBriefId();
    State.data.submittedAt = new Date().toISOString();
    State.saveToHistory();
    sendWebhook(State.data);
    showToast(`Brief ${State.data.briefId} soumis avec succès`);
    localStorage.removeItem(STORAGE_KEY);
    setTimeout(() => location.reload(), 1600);
  }

  function sendWebhook(data) {
    const WEBHOOK_URL = 'https://hook.eu1.make.com/un4wy721ere5mxdujxor3ovihzrlbl1v';
    // Source de vérité unique : on envoie les données brutes ET le récap
    // structuré + le texte du mail déjà formaté, pour que Make n'ait
    // qu'à transmettre tel quel sans reconstruire sa propre logique.
    const recap = Recap.build();
    const payload = {
      ...data,
      recap,
      mailSubject: `Nouveau brief B&W — ${recap.briefId} — ${recap.typeDemande}${recap.raisonUrgence ? ' [URGENT]' : ' — ' + recap.priorite}`,
      mailBody: Recap.toPlainText(recap),
      mailHtml: Recap.toMailHtml(recap)
    };
    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => console.warn('Webhook non joignable', err));
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  /* ════════════════════════════════════════════════════════════
     MODE RAPIDE
     ════════════════════════════════════════════════════════════ */
  let rapideSupports = new Set();

  function initRapideMode() {
    const deptSel = document.getElementById('r-dept');
    deptSel.innerHTML = '<option value="">— Sélectionner —</option>' +
      CONFIG.departements.map(d => `<option value="${d}">${d}</option>`).join('');

    const supportsEl = document.getElementById('r-supports');
    const commonSupports = ['post', 'story', 'affiche', 'menuboard', 'newsletter', 'autre-support'];
    supportsEl.innerHTML = commonSupports.map(sid => {
      const sup = CONFIG.supports.find(s => s.id === sid);
      return `<button type="button" class="support-card" data-r-support="${sid}">
        <span class="chk-dot"></span>${sup.label}
      </button>`;
    }).join('');

    const prioEl = document.getElementById('r-priorite');
    prioEl.innerHTML = CONFIG.prioritesNiveau.map(p =>
      `<button type="button" class="pill ${p.id === 'urgent' ? 'urgent' : ''}" data-r-priorite="${p.id}">${p.label}</button>`
    ).join('');

    // Bind events
    supportsEl.querySelectorAll('[data-r-support]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.rSupport;
        if (rapideSupports.has(sid)) { rapideSupports.delete(sid); btn.classList.remove('active'); btn.querySelector('.chk-dot').innerHTML = ''; }
        else { rapideSupports.add(sid); btn.classList.add('active'); btn.querySelector('.chk-dot').innerHTML = Icons.check; }
        updateRapideSubmit();
      });
    });

    prioEl.querySelectorAll('[data-r-priorite]').forEach(btn => {
      btn.addEventListener('click', () => {
        prioEl.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('r-priorite').dataset.value = btn.dataset.rPriorite;
        updateRapideSubmit();
      });
    });

    ['r-dept', 'r-ref', 'r-desc', 'r-launch'].forEach(id => {
      document.getElementById(id).addEventListener('input', updateRapideSubmit);
    });

    document.getElementById('r-submit').addEventListener('click', submitRapide);
    document.getElementById('r-to-full').addEventListener('click', switchToFullFromRapide);
  }

  function updateRapideSubmit() {
    const dept = document.getElementById('r-dept').value;
    const ref = document.getElementById('r-ref').value.trim();
    const desc = document.getElementById('r-desc').value.trim();
    const launch = document.getElementById('r-launch').value;
    const prio = document.getElementById('r-priorite').dataset.value;
    const ok = dept && ref && desc && launch && prio && rapideSupports.size > 0;
    const btn = document.getElementById('r-submit');
    btn.disabled = !ok;
    btn.classList.toggle('ready', ok);
  }

  function submitRapide() {
    const dept = document.getElementById('r-dept').value;
    const ref = document.getElementById('r-ref').value.trim();
    const desc = document.getElementById('r-desc').value.trim();
    const launch = document.getElementById('r-launch').value;
    const prio = document.getElementById('r-priorite').dataset.value;

    if (!dept || !ref || !desc || !launch || !prio || !rapideSupports.size) {
      showToast('Complétez tous les champs du brief rapide');
      return;
    }

    State.data.dept = dept;
    State.data.ref = ref;
    State.data.description = desc;
    State.data.dateLancement = launch;
    State.data.priorite = prio;
    State.data.typeDemande = 'campagne';
    State.data.supportsSelected = [...rapideSupports];
    State.data.briefId = State.genBriefId();
    State.data.submittedAt = new Date().toISOString();

    State.saveToHistory();
    sendWebhook(State.data);
    showToast(`Brief ${State.data.briefId} soumis avec succès`);
    localStorage.removeItem(STORAGE_KEY);
    setTimeout(() => location.reload(), 1600);
  }

  function switchToFullFromRapide() {
    State.data.dept = document.getElementById('r-dept').value;
    State.data.ref = document.getElementById('r-ref').value.trim();
    State.data.description = document.getElementById('r-desc').value.trim();
    State.data.dateLancement = document.getElementById('r-launch').value;
    State.data.priorite = document.getElementById('r-priorite').dataset.value || '';
    State.data.typeDemande = 'campagne';
    State.data.supportsSelected = [...rapideSupports];
    scheduleSave();
    switchMode('form');
    State.openSections = { 1: true, 2: true, 3: true, 4: true, 5: false };
    renderAll();
  }

  function switchMode(mode) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    document.querySelector('.layout').hidden = mode !== 'form';
    document.getElementById('rapide-wrap').hidden = mode !== 'rapide';
    document.getElementById('mobile-submit').style.display = mode === 'form' ? '' : 'none';
  }

  /* ════════════════════════════════════════════════════════════
     AUTO-OUVERTURE DES SECTIONS NON VIDES AU CHARGEMENT
     Évite qu'un brouillon restauré affiche des sections fermées
     qui contiennent pourtant déjà des données saisies.
     ════════════════════════════════════════════════════════════ */
  function autoOpenFilledSections() {
    const keys = { 1: 'qui', 2: 'quoi', 3: 'infos', 4: 'supports' };
    Object.entries(keys).forEach(([num, key]) => {
      const st = State.getSectionStatus(key);
      if (st.status === 'partial' || st.status === 'complete') {
        State.openSections[num] = true;
      }
    });
    // Section 2 doit aussi s'ouvrir si un type de demande est déjà choisi,
    // même si la description est vide (sinon les cartes sélectionnées restent invisibles)
    if (State.data.typeDemande) {
      State.openSections[2] = true;
      State.openSections[3] = true;
    }
  }

  /* ════════════════════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════════════════════ */
  function init() {
    const restored = State.load();
    if (restored && (State.data.dept || State.data.typeDemande)) {
      document.getElementById('restore-banner').hidden = false;
      autoOpenFilledSections();
    }

    const hist = State.getHistory();
    document.getElementById('hist-count').textContent = hist.length;

    renderAll();
    initRapideMode();

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });

    document.getElementById('btn-submit').addEventListener('click', submitBrief);
    document.getElementById('btn-submit-mobile').addEventListener('click', submitBrief);

    document.getElementById('banner-close').addEventListener('click', () => {
      document.getElementById('restore-banner').hidden = true;
    });

    document.getElementById('btn-pdf').addEventListener('click', () => {
      // S'assurer que la section Récap est ouverte avant impression
      State.openSections[5] = true;
      renderAll();
      setTimeout(() => window.print(), 150);
    });

    document.getElementById('btn-copy').addEventListener('click', () => {
      const r = Recap.build();
      const text = Recap.toPlainText(r);
      navigator.clipboard?.writeText(text);
      showToast('Récapitulatif copié dans le presse-papier');
    });

    document.getElementById('btn-mail').addEventListener('click', () => {
      const r = Recap.build();
      const subject = encodeURIComponent(`Brief ${r.briefId} — ${r.typeDemande}${r.raisonUrgence ? ' [URGENT]' : ''}`);
      const body = encodeURIComponent(Recap.toPlainText(r));
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    });

    initHistoryDrawer();

    // Mettre à jour le badge compteur avec le total distant (GitHub JSON)
    // sans ouvrir le drawer — fetch silencieux en arrière-plan
    loadMergedHistory().then(merged => {
      const badge = document.getElementById('hist-count');
      if (badge && merged.length > 0) badge.textContent = merged.length;
    }).catch(() => {});

    window.scrollTo(0, 0);
  }

  /* ════════════════════════════════════════════════════════════
     HISTORIQUE — drawer avec sync GitHub JSON
     ════════════════════════════════════════════════════════════ */
  const SHEET_ID_V2 = '1bBp5Cgmjdq-EPWrYQ_Pp40GJs-ss82I-4anLpT83yDw';
  const GITHUB_API_V2    = 'https://raw.githubusercontent.com/karim-yc/brief-bw-studio/main/api/briefs.json'; // Source primaire — JSON statique GitHub (CORS natif)
  const MAKE_API_V2      = 'https://hook.eu1.make.com/j6fe7afcbfirw60oarvn3tndmqoah54b';
  const APPS_SCRIPT_V2   = ''; // Fallback Apps Script
  const STATUS_LABELS = {
    soumis: 'Soumis', encours: 'En cours', simulation: 'Simulation envoyée',
    valide: 'Validé', livre: 'Livré'
  };

  // Liste fusionnée Sheet + local — source de vérité pour le drawer
  let _mergedHistory = [];
  let _lastSheetStatus = null; // 'ok'|'empty'|'html'|'network'

  // ── Parsing CSV Sheet ────────────────────────────────────────
  function parseHistoryCSVLine(line) {
    const res = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; }
      else if (line[i] === ',' && !inQ) { res.push(cur); cur = ''; }
      else cur += line[i];
    }
    res.push(cur);
    return res;
  }

  function parseSheetHistory(csv) {
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = parseHistoryCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim());
    return lines.slice(1).map(line => {
      const vals = parseHistoryCSVLine(line);
      const obj = { _source: 'sheet' };
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/^"|"$/g, '').trim(); });
      return obj;
    }).filter(b => b.briefId);
  }

  // ── Chargement Sheet + merge avec local ──────────────────────
  async function loadMergedHistory() {
    const local = State.getHistory().map(b => ({ ...b, _source: 'local' }));
    let sheet = [], sheetStatus = 'network';

    const cb = `?nocache=${Date.now()}`;

    // 1. GitHub JSON statique — source primaire (CORS natif, 0 dépendance externe)
    console.log('[BW Hist] ===== loadMergedHistory — GitHub JSON source 1 =====');
    try {
      const r = await fetch(GITHUB_API_V2 + '?t=' + Date.now());
      if (r.ok) {
        const text = await r.text();
        if (text.trim().length > 10 && !text.trim().startsWith('<')) {
          const d = JSON.parse(text);
          const raw = d.briefs || (Array.isArray(d) ? d : []);
          if (raw.length > 0) {
            sheet = raw.filter(b => b.briefId).map(b => ({...b, _source:'sheet'}));
            sheetStatus = 'ok';
            console.log('[BW Hist] GitHub OK —', sheet.length, 'briefs');
          }
        }
      }
    } catch(e) { console.warn('[BW Hist] GitHub erreur:', e.message); }

    // 2. Make API — fallback
    if (sheet.length === 0) {
    console.log('[BW Hist] → Make API (fallback):', MAKE_API_V2);
    try {
      const resp = await fetch(MAKE_API_V2, {method:'POST',headers:{'Content-Type':'text/plain'},body:'get_briefs'});
      console.log('[BW Hist] Make API status:', resp.status);
      if (resp.ok) {
        const text = await resp.text();
        if (!text.trim().startsWith('<') && text.trim().length > 10) {
          // Make retourne le JSON Sheets API : {values: [[headers], [row1], ...]}
          try {
            const apiData = JSON.parse(text);
            // Make peut sérialiser les tableaux imbriqués comme des objets {0:...,1:...}
            function toArr(v) {
              if (Array.isArray(v)) return v;
              if (v && typeof v === 'object') {
                const ks = Object.keys(v).filter(k=>!isNaN(k)).sort((a,b)=>+a-+b);
                if (ks.length) return ks.map(k=>v[k]);
              }
              return null;
            }
            console.log('[BW Hist] Make réponse clés top-level:', Object.keys(apiData).slice(0,6).join(','));
            const rawRows = apiData.values !== undefined ? apiData.values : apiData;
            const rows = toArr(rawRows);
            if (rows && rows.length >= 2) {
              const headers = toArr(rows[0]) || [];
              console.log('[BW Hist] Headers:', headers.slice(0,5).join(','));
              sheet = rows.slice(1).map(row => {
                const rowArr = toArr(row) || [];
                const obj = { _source: 'sheet' };
                headers.forEach((h, i) => { obj[h] = (rowArr[i] !== undefined ? String(rowArr[i]) : '').trim(); });
                return obj;
              }).filter(b => b.briefId);
              sheetStatus = sheet.length > 0 ? 'ok' : 'empty';
              console.log('[BW Hist] Make API OK —', sheet.length, 'briefs, IDs:', sheet.map(r=>r.briefId));
            } else {
              console.warn('[BW Hist] rows vide ou invalide:', JSON.stringify(rawRows).slice(0,150));
            }
          } catch(parseErr) { console.error('[BW Hist] Parse erreur:', parseErr.message, text.slice(0,200)); }
        } else { console.warn('[BW Hist] Make API → réponse HTML ou vide'); sheetStatus = 'html'; }
      }
    } catch(e) { console.warn('[BW Hist] Make API error:', e.message); }

    // 2. Fallback CSV si Make API n'a rien retourné
    if (sheet.length === 0 && sheetStatus !== 'html') {
      const csvUrls = [
        `https://docs.google.com/spreadsheets/d/${SHEET_ID_V2}/pub?gid=0&single=true&output=csv${cb}`,
        `https://docs.google.com/spreadsheets/d/${SHEET_ID_V2}/export?format=csv&sheet=Historique${cb}`,
        `https://docs.google.com/spreadsheets/d/${SHEET_ID_V2}/gviz/tq?tqx=out:csv&sheet=Historique${cb}`,
      ];
      for (const url of csvUrls) {
        console.log('[BW Hist] → CSV fallback:', url.split('?')[0]);
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const text = await r.text();
          if (text.trim().startsWith('<')) { sheetStatus = 'html'; continue; }
          sheet = parseSheetHistory(text);
          if (sheet.length > 0) { sheetStatus = 'ok'; break; }
        } catch(e) { console.warn('[BW Hist] CSV error:', e.message); }
      }
    }
    } // fin if (sheet.length === 0) — bloc Make+CSV fallback

    _lastSheetStatus = sheetStatus;
    console.log('[BW Hist] Statut final:', sheetStatus, '| Sheet:', sheet.length, '| Local:', local.length);

    // Merge : local prioritaire (plus de données), Sheet complète les manquants
    const localIds = new Set(local.map(b => b.briefId));
    const merged = [
      ...local,
      ...sheet.filter(b => !localIds.has(b.briefId))
    ];
    // Trier par date décroissante
    merged.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    _mergedHistory = merged;
    return merged;
  }

  // ── Normalisation affichage (unifie local + sheet) ───────────
  function briefDisplayData(b) {
    if (b._source === 'sheet') {
      // Type : convertir label lisible en typeId pour la classe CSS
      const typeMap = {
        'Campagne Marketing': 'campagne', 'Packaging': 'packaging',
        'Vitrophanie / Travaux': 'vitrophanie', 'Autre demande': 'autre'
      };
      return {
        typeLabel: b.typeDemande || 'Demande',
        typeClass: 'type-' + (typeMap[b.typeDemande] || 'autre'),
        who: b.demandeur || '—',
        dept: b.departement || '—',
        desc: (b.contexte || '').slice(0, 70),
        priorite: b.priorite
      };
    }
    const typeInfo = CONFIG.typesDemande.find(t => t.id === b.typeDemande);
    return {
      typeLabel: typeInfo ? typeInfo.label : (b.typeDemande || 'Demande'),
      typeClass: 'type-' + (b.typeDemande || 'autre'),
      who: b.ref || '—',
      dept: b.dept || '—',
      desc: (b.description || '').slice(0, 70),
      priorite: b.priorite
    };
  }

  function initHistoryDrawer() {
    document.getElementById('btn-history').addEventListener('click', openHistoryDrawer);
    document.getElementById('dr-close').addEventListener('click', closeHistoryDrawer);
    document.getElementById('dr-overlay').addEventListener('click', closeHistoryDrawer);
    document.getElementById('brief-detail-close').addEventListener('click', closeBriefDetail);
    document.getElementById('brief-detail-pdf').addEventListener('click', printBriefV2);
    document.getElementById('brief-detail-overlay').addEventListener('click', e => {
      if (e.target.id === 'brief-detail-overlay') closeBriefDetail();
    });
    document.getElementById('dr-clear-all').addEventListener('click', () => {
      const localCount = State.getHistory().length;
      if (!localCount) return;
      if (confirm(`Vider l'historique local (${localCount} brief${localCount > 1 ? 's' : ''}) ? Les briefs dans le dashboard restent accessibles.`)) {
        State.clearHistory();
        renderHistoryList();
        document.getElementById('hist-count').textContent = '0';
      }
    });

    // Fermeture au clavier — Échap ferme la couche la plus haute
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const modalOpen = document.getElementById('brief-detail-overlay').classList.contains('open');
      const drawerOpen = document.getElementById('drawer').classList.contains('open');
      if (modalOpen) closeBriefDetail();
      else if (drawerOpen) closeHistoryDrawer();
    });
  }

  function openHistoryDrawer() {
    renderHistoryList();  // affiche l'état local immédiatement
    document.getElementById('dr-overlay').classList.add('open');
    document.getElementById('drawer').classList.add('open');
    lockScroll();
    // Puis charge le Sheet en arrière-plan
    loadMergedHistory().then(merged => {
      if (document.getElementById('drawer').classList.contains('open')) {
        renderHistoryList(merged);
        // Mettre à jour le compteur avec le total fusionné
        document.getElementById('hist-count').textContent = merged.length || State.getHistory().length;
      }
    });
  }

  function closeHistoryDrawer() {
    document.getElementById('dr-overlay').classList.remove('open');
    document.getElementById('drawer').classList.remove('open');
    unlockScroll();
  }

  let scrollLockCount = 0;
  function lockScroll() { scrollLockCount++; document.body.style.overflow = 'hidden'; }
  function unlockScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) document.body.style.overflow = '';
  }

  function renderHistoryList(merged) {
    // Si pas encore de merged, afficher local + spinner
    const hist = merged || State.getHistory().map(b => ({ ...b, _source: 'local' }));
    const isLoading = !merged;

    const body = document.getElementById('dr-body');
    const footer = document.getElementById('dr-footer');
    const syncStatus = document.getElementById('dr-sync-status');

    if (syncStatus) {
      if (isLoading) {
        syncStatus.textContent = "Chargement de l'historique…";
      } else if (!_lastSheetStatus || _lastSheetStatus === 'ok' || _lastSheetStatus === 'empty') {
        syncStatus.textContent = hist.length
          ? `${hist.length} brief${hist.length > 1 ? 's' : ''} · synchronisé via GitHub JSON`
          : "Aucun brief disponible";
      } else if (_lastSheetStatus === 'html') {
        syncStatus.textContent = '⚠ Source distante inaccessible — affichage local uniquement';
      } else {
        syncStatus.textContent = '⚠ Source distante inaccessible — vérifier la connexion';
      }
    }

    if (!hist.length && !isLoading) {
      body.innerHTML = `
        <div class="dr-empty">
          <svg viewBox="0 0 24 24" fill="none"><path d="M10 5v5l3.5 2M17 10a7 7 0 1 1-2.05-4.95" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Aucun brief soumis pour l'instant.<br>L'historique apparaîtra ici après votre première soumission.
        </div>`;
      footer.hidden = true;
      return;
    }
    footer.hidden = false;

    body.innerHTML = (isLoading ? '<div class="dr-loading">Chargement de l\'historique\u2026</div>' : '') + hist.map(b => {
      const d = briefDisplayData(b);
      const status = State.getBriefStatus(b.briefId);
      const date = b.submittedAt ? new Date(b.submittedAt).toLocaleDateString('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      const sourceTag = b._source === 'sheet'
        ? '<span class="hist-source-tag">Sheet</span>'
        : `<button class="hist-del-btn" data-del-brief="${b.briefId}" title="Supprimer ce brief local" aria-label="Supprimer">${Icons.trash}</button>`;
      return `
        <div class="hist-item" data-open-brief="${b.briefId}">
          <div class="hist-item-head">
            <span class="hist-id">${b.briefId}</span>
            <span class="hist-badge ${d.typeClass}">${d.typeLabel}</span>
            ${sourceTag}
          </div>
          <div class="hist-title">${d.who} — ${d.dept}</div>
          <div class="hist-desc">${d.desc || 'Sans description'}</div>
          <div class="hist-meta">
            <span class="hist-date">${date}</span>
            <span class="hist-status">${STATUS_LABELS[status] || status}</span>
          </div>
        </div>`;
    }).join('');

    body.querySelectorAll('[data-del-brief]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const id = el.dataset.delBrief;
        if (confirm(`Supprimer le brief ${id} de l'historique local ?
Il restera accessible dans le dashboard.`)) {
          State.deleteFromHistory(id);
          loadMergedHistory().then(m => renderHistoryList(m));
          document.getElementById('hist-count').textContent = State.getHistory().length;
        }
      });
    });

    body.querySelectorAll('[data-open-brief]').forEach(el => {
      el.addEventListener('click', () => openBriefDetail(el.dataset.openBrief));
    });
  }

  let _currentDetailBrief = null; // stocke {brief, r} pour le PDF

  function openBriefDetail(briefId) {
    // Chercher dans le merged (Sheet + local), pas seulement local
    const brief = _mergedHistory.find(b => b.briefId === briefId)
                  || State.getHistory().find(b => b.briefId === briefId);
    if (!brief) return;

    let contentHtml, r = null;

    if (brief._source === 'local' || brief._source === 'both') {
      // Brief local complet → Recap.build() comme avant
      const savedData = State.data;
      State.data = { ...savedData, ...brief };
      r = Recap.build();
      State.data = savedData;
      contentHtml = Recap.toHtml(r);
    } else {
      // Brief Sheet uniquement → affichage basé sur les colonnes Sheet
      r = null;
      const fmtD = s => { if(!s||s==='—')return'—'; try{const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}catch(e){return s}};
      const row = (label, val) => val && val !== '—' && val !== ''
        ? `<div class="recap-block"><div class="recap-block-title">${label}</div><div>${val}</div></div>` : '';
      contentHtml = `<div class="recap-doc">
        ${row('Demandeur', `${brief.demandeur || '—'} — ${brief.departement || '—'}`)}
        ${row('Type', brief.typeDemande)}
        ${row('Priorité', brief.priorite ? brief.priorite.charAt(0).toUpperCase() + brief.priorite.slice(1) : '—')}
        ${brief.raisonUrgence ? row('Raison urgence', brief.raisonUrgence) : ''}
        ${row('Contexte', brief.contexte)}
        ${brief.genreCampagne ? row('Genre', brief.genreCampagne) : ''}
        ${brief.supports ? row('Supports', brief.supports) : ''}
        ${brief.packagingProduits ? row('Produits packaging', brief.packagingProduits) : ''}
        ${brief.restaurant ? row('Restaurant / adresse', brief.restaurant) : ''}
        ${brief.dateLancement && brief.dateLancement !== '—' ? row('Date de lancement', fmtD(brief.dateLancement)) : ''}
        ${brief.dateValidation && brief.dateValidation !== '—' ? row('Validation infos', fmtD(brief.dateValidation)) : ''}
        ${brief.dateRetourSimul && brief.dateRetourSimul !== '—' ? row('Retour simulation', fmtD(brief.dateRetourSimul)) : ''}
        ${brief.reserves ? row('Réserves', brief.reserves) : ''}
        ${row('Statut', brief.statut || '—')}
      </div>`;
    }

    _currentDetailBrief = { brief, r };

    document.getElementById('brief-detail-title').textContent = `Brief ${brief.briefId}`;
    const who = brief._source === 'local' ? brief.ref : brief.demandeur;
    const dept = brief._source === 'local' ? brief.dept : brief.departement;
    const dateStr = brief.submittedAt ? new Date(brief.submittedAt).toLocaleDateString('fr-BE') : '—';
    document.getElementById('brief-detail-sub').textContent = `${who || '—'} — ${dept || '—'} · ${dateStr}`;
    document.getElementById('brief-detail-content').innerHTML = contentHtml;
    document.getElementById('brief-detail-overlay').classList.add('open');
    lockScroll();
  }

  function closeBriefDetail() {
    document.getElementById('brief-detail-overlay').classList.remove('open');
    _currentDetailBrief = null;
    unlockScroll();
  }

  function printBriefV2() {
    if (!_currentDetailBrief) return;
    const { brief, r } = _currentDetailBrief;

    const fmtD = s => { if(!s||s==='—')return'—'; try{const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}catch(e){return s}};
    const row = (label, val) => val && val!=='—' ? `<div class="bp-section"><div class="bp-label">${label}</div><div class="bp-val">${val}</div></div>` : '';

    const prioBadge = r.priorite==='urgent'      ? '<span class="bp-badge urgent">⚑ Urgent</span>'
                    : r.priorite==='prioritaire'  ? '<span class="bp-badge prio">↑ Prioritaire</span>'
                    : '<span class="bp-badge">Normal</span>';

    let sections = '';
    sections += row('Demandeur', `${r.demandeur||'—'} — ${r.departement||'—'}`);

    if (r.contexte) sections += `<div class="bp-section"><div class="bp-label">Contexte</div><div class="bp-val">${r.contexte.replace(/\n/g,'<br>')}</div></div>`;
    if (r.genreCampagne) sections += row('Genre de campagne', r.genreCampagne);

    // Contextuel selon type
    const supports = (r.supports||[]).map(s=>s.label||s).join(', ');
    if (r.typeDemande==='campagne' && supports)
      sections += `<div class="bp-section"><div class="bp-label">Supports à produire</div><div class="bp-val">${supports}${r.totalVolume&&r.totalVolume>0?'<br><strong>'+r.totalVolume+' déclinaisons visuelles</strong>':''}</div></div>`;
    if (r.typeDemande==='packaging' && r.packagingProducts?.length)
      sections += row('Produits packaging', r.packagingProducts.map(p=>p.nom).filter(Boolean).join(', '));
    if (r.typeDemande==='vitrophanie' && r.restaurant)
      sections += row('Restaurant / adresse', r.restaurant);

    // Deadlines
    const hasD = [r.dateLancement, r.dateValidation, r.dateRetourSimul].some(d=>d&&d!=='—');
    if (hasD) sections += `<div class="bp-section"><div class="bp-label">Deadlines</div><div class="bp-val">
      ${r.dateLancement&&r.dateLancement!=='—'?'Lancement : <strong>'+fmtD(r.dateLancement)+'</strong><br>':''}
      ${r.dateValidation&&r.dateValidation!=='—'?'Validation infos : '+fmtD(r.dateValidation)+'<br>':''}
      ${r.dateRetourSimul&&r.dateRetourSimul!=='—'?'Retour simulation : '+fmtD(r.dateRetourSimul):''}
    </div></div>`;

    if (r.reserves) sections += `<div class="bp-section"><div class="bp-label">Infos à confirmer / réserves</div><div class="bp-val bp-reserves">${r.reserves.replace(/\n/g,'<br>')}</div></div>`;
    if (r.blocking?.length) sections += row('Points manquants', r.blocking.map(b=>b.label||b.field?.label||b).join(', '));

    if (brief.submittedAt) {
      const d = new Date(brief.submittedAt);
      sections += `<div class="bp-section"><div class="bp-label">Soumis le</div><div class="bp-val muted">${d.toLocaleDateString('fr-BE',{day:'2-digit',month:'long',year:'numeric'})} à ${d.toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'})}</div></div>`;
    }

    const html = `<div class="bp-page">
      <div class="bp-header">
        <div class="bp-brand">Black &amp; White Burger · Studio Graphique</div>
        <div class="bp-id">${r.briefId||'—'}</div>
        <div class="bp-type">${r.typeDemande==='campagne'?'Campagne Marketing':r.typeDemande==='packaging'?'Packaging':r.typeDemande==='vitrophanie'?'Vitrophanie / Travaux':'Autre demande'}</div>
        <div class="bp-badges">${prioBadge}</div>
      </div>
      ${sections}
      <div class="bp-footer">
        <span>Généré le ${new Date().toLocaleDateString('fr-BE',{day:'2-digit',month:'long',year:'numeric'})}</span>
        <span>${brief.briefId||''}</span>
      </div>
    </div>`;

    document.getElementById('brief-print-area-v2').innerHTML = html;
    document.body.classList.add('print-brief');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-brief');
      document.getElementById('brief-print-area-v2').innerHTML = '';
    }, 2000);
  }

  // ── Tooltips — tap mobile + flip automatique ────────────────
  function positionTooltip(tt_el) {
    const bubble = tt_el.querySelector('.tt-bubble');
    if (!bubble) return;
    tt_el.classList.remove('tt-above');
    bubble.classList.remove('tt-right');
    // Mesurer temporairement pour détecter le débordement
    bubble.style.cssText = 'visibility:hidden;opacity:0;display:block';
    const r = bubble.getBoundingClientRect();
    bubble.style.cssText = '';
    // Flip vertical : pas assez de place en bas → passer au-dessus
    if (r.bottom > window.innerHeight - 12) tt_el.classList.add('tt-above');
    // Flip horizontal : déborde à droite → ancrer à droite
    if (r.right > window.innerWidth - 12) bubble.classList.add('tt-right');
  }

  document.addEventListener('click', e => {
    const icon = e.target.closest('.tt-icon');
    if (icon) {
      e.stopPropagation();
      const tt_el = icon.closest('.tt');
      const isOpen = tt_el.classList.contains('tt-open');
      document.querySelectorAll('.tt.tt-open').forEach(t => {
        t.classList.remove('tt-open', 'tt-above');
        const b = t.querySelector('.tt-bubble');
        if (b) b.classList.remove('tt-right');
      });
      if (!isOpen) {
        positionTooltip(tt_el);
        tt_el.classList.add('tt-open');
      }
    } else if (!e.target.closest('.tt')) {
      document.querySelectorAll('.tt.tt-open').forEach(t => {
        t.classList.remove('tt-open', 'tt-above');
        const b = t.querySelector('.tt-bubble');
        if (b) b.classList.remove('tt-right');
      });
    }
  });

  document.addEventListener('DOMContentLoaded', init);

})();
