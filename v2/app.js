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
        updateCardStatus(4);
      });
    });

    // Confirm toggle (Validé / À confirmer)
    root.querySelectorAll('[data-confirm-toggle]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.confirmToggle;
        State.data.confirmations[id] = !State.data.confirmations[id];
        scheduleSave();
        renderAll();
      });
    });
  }

  function onFieldInput(e) {
    const id = e.target.dataset.field;
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
    const sectionGuess = guessSection(fieldId) || (fieldId === '__supports' || fieldId === 'priorite' || fieldId === 'raisonUrgence' || fieldId.startsWith('date') ? 4 : (fieldId === '__type' ? 2 : 1));
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
    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(err => console.warn('Webhook non joignable', err));
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  /* ════════════════════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════════════════════ */
  function init() {
    const restored = State.load();
    if (restored && (State.data.dept || State.data.typeDemande)) {
      document.getElementById('restore-banner').hidden = false;
    }

    const hist = State.getHistory();
    document.getElementById('hist-count').textContent = hist.length;

    renderAll();

    document.getElementById('btn-submit').addEventListener('click', submitBrief);
    document.getElementById('btn-submit-mobile').addEventListener('click', submitBrief);

    document.getElementById('banner-close').addEventListener('click', () => {
      document.getElementById('restore-banner').hidden = true;
    });

    document.getElementById('btn-pdf').addEventListener('click', () => window.print());

    document.getElementById('btn-copy').addEventListener('click', () => {
      navigator.clipboard?.writeText(location.href);
      showToast('Lien copié');
    });

    document.getElementById('btn-mail').addEventListener('click', () => {
      const subject = encodeURIComponent(`Brief créatif — ${State.data.briefId || 'nouveau'}`);
      window.location.href = `mailto:?subject=${subject}`;
    });

    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', init);

})();
