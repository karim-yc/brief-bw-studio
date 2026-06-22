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

    window.scrollTo(0, 0);
  }

  /* ════════════════════════════════════════════════════════════
     HISTORIQUE — drawer fonctionnel
     ════════════════════════════════════════════════════════════ */
  const STATUS_LABELS = {
    soumis: 'Soumis', encours: 'En cours', simulation: 'Simulation envoyée',
    valide: 'Validé', livre: 'Livré'
  };

  function initHistoryDrawer() {
    document.getElementById('btn-history').addEventListener('click', openHistoryDrawer);
    document.getElementById('dr-close').addEventListener('click', closeHistoryDrawer);
    document.getElementById('dr-overlay').addEventListener('click', closeHistoryDrawer);
    document.getElementById('brief-detail-close').addEventListener('click', closeBriefDetail);
    document.getElementById('brief-detail-overlay').addEventListener('click', e => {
      if (e.target.id === 'brief-detail-overlay') closeBriefDetail();
    });
    document.getElementById('dr-clear-all').addEventListener('click', () => {
      const hist = State.getHistory();
      if (!hist.length) return;
      if (confirm(`Vider tout l'historique (${hist.length} brief${hist.length > 1 ? 's' : ''}) ? Cette action est irréversible.`)) {
        State.clearHistory();
        renderHistoryList();
        document.getElementById('hist-count').textContent = '0';
      }
    });

    // Fermeture au clavier — Échap ferme la couche la plus haute (modale d'abord, puis drawer)
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const modalOpen = document.getElementById('brief-detail-overlay').classList.contains('open');
      const drawerOpen = document.getElementById('drawer').classList.contains('open');
      if (modalOpen) closeBriefDetail();
      else if (drawerOpen) closeHistoryDrawer();
    });
  }

  function openHistoryDrawer() {
    renderHistoryList();
    document.getElementById('dr-overlay').classList.add('open');
    document.getElementById('drawer').classList.add('open');
    lockScroll();
  }

  function closeHistoryDrawer() {
    document.getElementById('dr-overlay').classList.remove('open');
    document.getElementById('drawer').classList.remove('open');
    unlockScroll();
  }

  // Compteur de verrous scroll : la modale peut s'ouvrir par-dessus le drawer,
  // il ne faut débloquer le scroll que quand TOUTES les couches sont fermées.
  let scrollLockCount = 0;
  function lockScroll() {
    scrollLockCount++;
    document.body.style.overflow = 'hidden';
  }
  function unlockScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) document.body.style.overflow = '';
  }

  function renderHistoryList() {
    const hist = State.getHistory();
    const body = document.getElementById('dr-body');
    const footer = document.getElementById('dr-footer');

    if (!hist.length) {
      body.innerHTML = `
        <div class="dr-empty">
          <svg viewBox="0 0 24 24" fill="none"><path d="M10 5v5l3.5 2M17 10a7 7 0 1 1-2.05-4.95" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Aucun brief soumis pour l'instant.<br>L'historique apparaîtra ici après votre première soumission.
        </div>`;
      footer.hidden = true;
      return;
    }
    footer.hidden = false;

    body.innerHTML = hist.map(b => {
      const typeInfo = CONFIG.typesDemande.find(t => t.id === b.typeDemande);
      const typeLabel = typeInfo ? typeInfo.label : (b.typeDemande || 'Demande');
      const typeClass = 'type-' + (b.typeDemande || 'autre');
      const status = State.getBriefStatus(b.briefId);
      const date = b.submittedAt ? new Date(b.submittedAt).toLocaleDateString('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      return `
        <div class="hist-item" data-open-brief="${b.briefId}">
          <div class="hist-item-head">
            <span class="hist-id">${b.briefId}</span>
            <span class="hist-badge ${typeClass}">${typeLabel}</span>
            <button class="hist-del-btn" data-del-brief="${b.briefId}" title="Supprimer ce brief" aria-label="Supprimer">${Icons.trash}</button>
          </div>
          <div class="hist-title">${b.ref || 'Sans nom'} — ${b.dept || '—'}</div>
          <div class="hist-desc">${(b.description || '').slice(0, 70) || 'Sans description'}</div>
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
        if (confirm(`Supprimer définitivement le brief ${id} ?`)) {
          State.deleteFromHistory(id);
          renderHistoryList();
          document.getElementById('hist-count').textContent = State.getHistory().length;
        }
      });
    });

    body.querySelectorAll('[data-open-brief]').forEach(el => {
      el.addEventListener('click', () => openBriefDetail(el.dataset.openBrief));
    });
  }

  function openBriefDetail(briefId) {
    const hist = State.getHistory();
    const brief = hist.find(b => b.briefId === briefId);
    if (!brief) return;

    // Construit le récap à partir des données archivées de CE brief précis
    // (pas State.data courant, qui peut être un autre brouillon en cours)
    const savedData = State.data;
    State.data = { ...savedData, ...brief };
    const r = Recap.build();
    State.data = savedData; // restaure le brouillon en cours sans l'écraser

    document.getElementById('brief-detail-title').textContent = `Brief ${r.briefId}`;
    document.getElementById('brief-detail-sub').textContent = `${r.demandeur} — ${r.departement} · ${new Date(brief.submittedAt).toLocaleDateString('fr-BE')}`;
    document.getElementById('brief-detail-content').innerHTML = Recap.toHtml(r);
    document.getElementById('brief-detail-overlay').classList.add('open');
    lockScroll();
  }

  function closeBriefDetail() {
    document.getElementById('brief-detail-overlay').classList.remove('open');
    unlockScroll();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
