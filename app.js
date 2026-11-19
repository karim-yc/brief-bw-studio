/* ════════════════════════════════════════════════════════════
   APP.JS — Orchestration, événements, cycle de vie
   ════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let saveTimer = null;
  let _submitBypass = false;
  let currentStep = 1;

  /* ── Rendu wizard ───────────────────────────────────────────── */
  function renderWizard() {
    const progressEl = document.getElementById('wizard-progress');
    const sectionsRoot = document.getElementById('sections-root');
    const navEl = document.getElementById('wizard-nav');
    const appMain = document.getElementById('app-main');

    if (progressEl) progressEl.innerHTML = Render.wizardProgress(currentStep);
    if (sectionsRoot) sectionsRoot.innerHTML = Render.renderWizardStep(currentStep);
    if (navEl) navEl.innerHTML = Render.wizardNav(currentStep);
    if (appMain) appMain.dataset.wizardStep = currentStep;

    Render.sidebar();
    bindFieldEvents();
    bindAttachmentEvents();

    // Date min = aujourd'hui
    const _today = new Date().toISOString().slice(0, 10);
    document.querySelectorAll('input[type="date"]').forEach(el => { el.min = _today; });

    // Wire wizard navigation buttons
    const prevBtn = document.getElementById('wz-prev');
    const nextBtn = document.getElementById('wz-next');
    if (prevBtn) prevBtn.addEventListener('click', prevStep);
    if (nextBtn) nextBtn.addEventListener('click', nextStep);

    // Wire AI fill button
    const aiFillBtn = document.getElementById('ai-fill-btn');
    if (aiFillBtn) aiFillBtn.addEventListener('click', claudeAIFill);

    // Wire inline submit button (step 4)
    const wzSubmit = document.getElementById('btn-wz-submit');
    if (wzSubmit) wzSubmit.addEventListener('click', submitBrief);
  }

  /* ── Rendu complet ──────────────────────────────────────────── */
  function renderAll() {
    renderWizard();
    updateAIChecklist();
  }

  /* ── Re-render léger (juste sidebar, pas tout le DOM) ─────────
     Utilisé pour les inputs texte afin de ne pas perdre le focus */
  function renderSidebarOnly() {
    Render.sidebar();
    // Mettre à jour le bouton inline submit si on est à l'étape 4
    if (currentStep === 4) {
      const wzSubmit = document.getElementById('btn-wz-submit');
      const wzNote = document.getElementById('wz-submit-note');
      if (wzSubmit) {
        const ready = State.isReadyToSubmit();
        const confirmed = !!State.data.globalConfirmed;
        wzSubmit.disabled = !(ready && confirmed);
        wzSubmit.classList.toggle('ready', ready && confirmed);
        if (wzNote) {
          wzNote.textContent = !ready ? 'Complétez les champs requis pour soumettre' :
            !confirmed ? 'Cochez la case de confirmation pour soumettre' :
            'Brief prêt à envoyer ✓';
        }
      }
    }
  }

  /* ── Navigation wizard ───────────────────────────────────────── */
  function goToStep(n) {
    if (n < 1 || n > 4) return;
    currentStep = n;
    renderWizard();
    // Scroll to top of main content
    const mainCol = document.getElementById('main-col');
    if (mainCol) mainCol.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* Champs bloquants par étape wizard */
  // Seuls marque + typeDemande génèrent un avertissement doux à la navigation
  // (pas de blocage réel — navigation libre, A+B)
  const BLOCKING_FIELDS_BY_STEP = {
    1: ['marque', 'typeDemande'],
  };

  function validateStep(step) {
    const fields = BLOCKING_FIELDS_BY_STEP[step];
    if (!fields) return true;
    const missing = fields.filter(id => !State.isFieldFilled({ id, gravity: 'blocking' }));
    if (!missing.length) return true;

    // Shake + highlight les champs manquants
    missing.forEach(id => {
      const wrap = document.querySelector(`[data-field-wrap="${id}"]`);
      if (wrap) {
        wrap.classList.add('field-error-shake');
        wrap.addEventListener('animationend', () => wrap.classList.remove('field-error-shake'), { once: true });
      }
    });
    showToast('Complétez les champs en rouge avant de continuer');
    return false;
  }

  function nextStep() {
    // Navigation libre — pas de blocage inter-étapes
    // Un avertissement doux si des champs recommandés sont vides
    const fields = BLOCKING_FIELDS_BY_STEP[currentStep] || [];
    const missing = fields.filter(id => !State.isFieldFilled({ id, gravity: 'blocking' }));
    if (missing.length) {
      missing.forEach(id => {
        const wrap = document.querySelector(`[data-field-wrap="${id}"]`);
        if (wrap) {
          wrap.classList.add('field-error-shake');
          wrap.addEventListener('animationend', () => wrap.classList.remove('field-error-shake'), { once: true });
        }
      });
      showToast('Certains champs sont incomplets — vous pouvez continuer ou les compléter plus tard', 'warning');
    }
    goToStep(currentStep + 1);
  }
  function prevStep() { goToStep(currentStep - 1); }

  function determineStartStep() {
    if (!State.data.marque || !State.data.dept || !State.data.typeDemande) return 1;
    if (!State.data.description) return 2;
    if (!State.data.dateLancement) return 3;
    return 4;
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

    // Pépite 4 — assistant IA préventif : hint doux au blur si contexte court
    root.addEventListener('blur', e => {
      const el = e.target;
      if (el.dataset.field !== 'description') return;
      const words = (el.value || '').trim().split(/\s+/).filter(Boolean).length;
      if (words > 0 && words < 15) {
        let hint = document.getElementById('ia-hint');
        if (!hint) {
          hint = document.createElement('p');
          hint.id = 'ia-hint';
          hint.className = 'ia-hint';
          el.parentNode.appendChild(hint);
        }
        hint.textContent = 'Votre contexte est court. Avez-vous précisé le lieu de diffusion et la cible ?';
      } else {
        const hint = document.getElementById('ia-hint');
        if (hint) hint.remove();
      }
    }, true);

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

    // Retirer l'état pristine au premier contact (les erreurs ne s'affichent qu'après interaction)
    const appMain = document.getElementById('app-main');
    if (appMain) appMain.classList.remove('form-pristine');

    // Compteur de caractères pour textarea avec data-min-length
    if (e.target.tagName === 'TEXTAREA' && e.target.dataset.minLength) {
      const minL = parseInt(e.target.dataset.minLength, 10);
      const cur  = (e.target.value || '').trim().length;
      const counter = document.getElementById('minl-' + id);
      if (counter) {
        counter.querySelector('.minl-cur').textContent = cur;
        counter.className = 'field-minlength' + (cur >= minL ? ' ok' : '');
      }
    }

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
     PIÈCES JOINTES — gestion fichiers (formulaire complet)
     ════════════════════════════════════════════════════════════ */
  if (!State.files) State.files = [];

  function bindAttachmentEvents() {
    const input = document.getElementById('att-input');
    const zone  = document.getElementById('att-dropzone');
    if (!input || !zone) return;

    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => handleFiles(Array.from(input.files)));
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      handleFiles(Array.from(e.dataTransfer.files));
    });
  }

  function handleFiles(newFiles) {
    const MAX = 3, MAX_SIZE = 5 * 1024 * 1024;
    newFiles.forEach(f => {
      if (State.files.length >= MAX) { showToast(`Maximum ${MAX} fichiers autorisés.`); return; }
      if (f.size > MAX_SIZE) { showToast(`${f.name} dépasse 5 Mo.`); return; }
      if (State.files.some(x => x.name === f.name && x.size === f.size)) return;
      State.files.push({ name: f.name, type: f.type, size: f.size, _file: f });
    });
    renderAll();
  }

  function removeAttachment(idx) {
    State.files.splice(idx, 1);
    renderAll();
  }

  async function readFilesAsBase64(items) {
    return Promise.all((items || []).map(item =>
      new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res({ name: item.name, type: item.type, size: item.size, data: reader.result.split(',')[1] });
        reader.onerror = rej;
        reader.readAsDataURL(item._file);
      })
    ));
  }

  /* ════════════════════════════════════════════════════════════
     PIÈCES JOINTES — formulaire rapide
     ════════════════════════════════════════════════════════════ */
  if (!State.rapideFiles) State.rapideFiles = [];

  function bindRapideAttachmentEvents() {
    const input = document.getElementById('r-att-input');
    if (!input) return;
    input.addEventListener('change', () => handleRapideFiles(Array.from(input.files)));
  }

  function handleRapideFiles(newFiles) {
    const MAX = 3, MAX_SIZE = 5 * 1024 * 1024;
    newFiles.forEach(f => {
      if (State.rapideFiles.length >= MAX) { showToast(`Maximum ${MAX} fichiers autorisés.`); return; }
      if (f.size > MAX_SIZE) { showToast(`${f.name} dépasse 5 Mo.`); return; }
      if (State.rapideFiles.some(x => x.name === f.name && x.size === f.size)) return;
      State.rapideFiles.push({ name: f.name, type: f.type, size: f.size, _file: f });
    });
    renderRapideFileList();
  }

  function removeRapideFile(idx) {
    State.rapideFiles.splice(idx, 1);
    renderRapideFileList();
  }

  function renderRapideFileList() {
    const list = document.getElementById('r-att-list');
    if (!list) return;
    list.innerHTML = State.rapideFiles.map((f, i) =>
      `<div class="att-item">
        <span class="att-icon">${/image/.test(f.type) ? '🖼' : '📄'}</span>
        <span class="att-name">${f.name}</span>
        <span class="att-size">${(f.size / 1024).toFixed(0)} Ko</span>
        <button type="button" class="att-remove" data-r-att-idx="${i}" title="Supprimer">×</button>
      </div>`
    ).join('');
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
        if (field === 'marque') State.data.marqueNom = '';
      } else {
        State.data[field] = value;
        if (field === 'marque' && value !== 'autre') State.data.marqueNom = '';
      }
      scheduleSave();
      renderAll();
      // Focus l'input nom si "autre marque" vient d'être sélectionné
      if (field === 'marque' && State.data.marque === 'autre') {
        setTimeout(() => {
          const nomInput = document.getElementById('marque-nom-input');
          if (nomInput) nomInput.focus();
        }, 30);
      }
      return;
    }

    // Toggle support multi-select
    const supportEl = e.target.closest('[data-support-toggle]');
    if (supportEl) {
      const sid = supportEl.dataset.supportToggle;
      const idx = State.data.supportsSelected.indexOf(sid);
      if (idx >= 0) {
        State.data.supportsSelected.splice(idx, 1);
        const alertEl2 = document.getElementById('supports-alert');
        if (alertEl2) alertEl2.classList.toggle('visible', State.data.supportsSelected.length > 3);
        delete State.data.formats[sid];
        delete State.data.volumes[sid];
      } else {
        State.data.supportsSelected.push(sid);
        // Alerte non-bloquante si > 3 supports sélectionnés
        const alertEl = document.getElementById('supports-alert');
        if (alertEl) alertEl.classList.toggle('visible', State.data.supportsSelected.length > 3);
      }
      scheduleSave();
      renderAll();
      return;
    }

    // Navigation depuis sidebar → aller à l'étape wizard correspondante
    const gotoSection = e.target.closest('[data-goto-section]');
    if (gotoSection) {
      const n = parseInt(gotoSection.dataset.gotoSection, 10);
      // Mapping sections → étapes wizard : 1→1, 2→1, 3→2, 4→3, 5→4
      const stepMap = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4 };
      goToStep(stepMap[n] || 1);
      return;
    }

    // Navigation vers champ bloquant depuis sidebar
    const gotoField = e.target.closest('[data-goto-field]');
    if (gotoField) {
      const fieldId = gotoField.dataset.gotoField;
      scrollToField(fieldId);
      return;
    }

    // Suppression pièce jointe (formulaire complet)
    const attRemove = e.target.closest('.att-remove[data-att-idx]');
    if (attRemove) {
      removeAttachment(parseInt(attRemove.dataset.attIdx, 10));
      return;
    }

    // Suppression pièce jointe (formulaire rapide)
    const rAttRemove = e.target.closest('.att-remove[data-r-att-idx]');
    if (rAttRemove) {
      removeRapideFile(parseInt(rAttRemove.dataset.rAttIdx, 10));
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
    // Mapper le champ vers l'étape wizard
    let sectionGuess = guessSection(fieldId);
    if (!sectionGuess) {
      if (fieldId === '__supports') sectionGuess = 4;
      else if (fieldId === 'priorite' || fieldId === 'raisonUrgence' || fieldId.startsWith('date')) sectionGuess = 4;
      else if (fieldId === '__type') sectionGuess = 2;
      else sectionGuess = 1;
    }
    // Mapping section → étape wizard
    const stepMap = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4 };
    const targetStep = stepMap[sectionGuess] || 1;
    if (currentStep !== targetStep) {
      goToStep(targetStep);
    }

    setTimeout(() => {
      const target = document.querySelector(`[data-field-wrap="${fieldId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('highlight');
        setTimeout(() => target.classList.remove('highlight'), 1500);
      }
    }, 120);
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
    [document.getElementById('sb-save-state'), document.getElementById('wz-save-indicator')]
      .filter(Boolean)
      .forEach(el => {
        el.classList.add('show');
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(() => el.classList.remove('show'), 2500);
      });
  }

  /* ════════════════════════════════════════════════════════════
     SOUMISSION
     ════════════════════════════════════════════════════════════ */
  async function submitBrief() {
    if (!State.isReadyToSubmit()) {
      showToast('Complétez les champs bloquants avant de soumettre');
      return;
    }

    // Pépite 4 — assistant préventif : description trop courte
    if (!_submitBypass) {
      const descLen = (State.data.description || '').trim().length;
      if (descLen < 60) {
        showContextWarning(descLen);
        return;
      }
    }
    _submitBypass = false;

    State.data.briefId = State.data.briefId || State.genBriefId();
    State.data.submittedAt = new Date().toISOString();

    const submitBtns = [
      document.getElementById('btn-submit'),
      document.getElementById('btn-submit-mobile')
    ];
    const originalLabels = submitBtns.map(b => b ? b.textContent : '');
    submitBtns.forEach(b => { if (b) { b.disabled = true; b.textContent = 'Envoi en cours…'; } });
    showToast('Envoi en cours…');

    try {
      await sendWebhook(State.data);
      State.saveToHistory();
      const gcCreated = await GCalSync.syncBrief(State.data);
      State.files = [];
      const gcMsg = gcCreated ? ` · ${gcCreated} date${gcCreated > 1 ? 's' : ''} → Google Calendar` : '';
      showToast(`Brief ${State.data.briefId} soumis avec succès ✓${gcMsg}`);
      localStorage.removeItem(STORAGE_KEY);
      setTimeout(() => location.reload(), 2200);
    } catch (err) {
      console.error('[BW Submit] Échec envoi:', err.message);
      submitBtns.forEach((b, i) => {
        if (b) { b.disabled = false; b.textContent = originalLabels[i]; }
      });
      showToast('Échec d\'envoi — brouillon conservé. Vérifiez votre connexion et réessayez.');
    }
  }

  async function sendWebhook(data, extraFiles) {
    const recap = Recap.build();
    const allFiles = [...(State.files || []), ...(State.rapideFiles || []), ...(extraFiles || [])];
    const fichiers = allFiles.length ? await readFilesAsBase64(allFiles) : [];

    const mailSubject = `Nouveau brief B&W — ${recap.briefId} — ${recap.typeDemande}${recap.raisonUrgence ? ' [URGENT]' : ' — ' + recap.priorite}`;

    // ── Supabase (source principale) ─────────────────────────────
    if (typeof sbClient !== 'undefined' && sbClient) {
      console.log('[BW Supabase] Envoi brief →', recap.briefId);

      const row = {
        brief_id:     recap.briefId,
        submitted_at: recap.submittedAt || new Date().toISOString(),
        statut:       'soumis',
        marque:       recap.marque || '',
        departement:  recap.departement || '',
        demandeur:    recap.demandeur || '',
        priorite:     recap.priorite || '',
        data: {
          ...recap,
          fichiers,
          mailSubject,
          mailBody: Recap.toPlainText(recap),
          mailHtml: Recap.toMailHtml(recap),
        }
      };

      const { error } = await sbClient.from('briefs').insert(row);

      if (error) {
        console.error('[BW Supabase] Erreur insert:', error.message, error.details);
        throw new Error(`Supabase refus : ${error.message}`);
      }

      console.log('[BW Supabase] ✓ Brief inséré —', recap.briefId);

      // Monday.com via Make.com webhook (fire & forget)
      const MAKE_URL = 'https://hook.eu1.make.com/v3nyc7z5x81gk5609ayay78rwuu75krk';
      fetch(MAKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recap })
      }).then(() => console.log('[BW Make] ✓ Monday.com déclenché'))
        .catch(err => console.warn('[BW Make] Monday.com non joint:', err.message));

      // Notification email directe (pg_net non fiable sur plan gratuit)
      const NOTIF_URL = 'https://script.google.com/macros/s/AKfycbxdmDrKFqB6k_ZL3IL1AzSMUJ3PgkSjAx7buacI0SWPMPW_AEDFeFaK7zJR00ocezN9/exec';
      fetch(NOTIF_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          briefId:     recap.briefId,
          marque:      recap.marque || '',
          departement: recap.departement || '',
          demandeur:   recap.demandeur || '',
          priorite:    recap.priorite || '',
          submittedAt: recap.submittedAt || new Date().toISOString()
        })
      }).then(() => console.log('[BW Notif] ✓ Email déclenché'))
        .catch(err => console.warn('[BW Notif] Email non envoyé:', err.message));

      return;
    }

    // ── Fallback Make.com (si Supabase non configuré) ────────────
    const WEBHOOK_URL = 'https://hook.eu1.make.com/v3nyc7z5x81gk5609ayay78rwuu75krk';
    const payload = { ...data, recap, fichiers, mailSubject, mailBody: Recap.toPlainText(recap), mailHtml: Recap.toMailHtml(recap) };
    console.warn('[BW] Supabase non configuré — fallback Make.com');

    let response;
    try {
      response = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (networkErr) {
      throw new Error('Réseau inaccessible — Make non joint');
    }
    if (!response.ok) throw new Error(`Make a refusé le webhook (HTTP ${response.status})`);
    console.log('[BW Webhook] ✓ Reçu par Make');
  }

  function showContextWarning(len) {
    const existing = document.getElementById('ctx-warn');
    if (existing) existing.remove();
    const warn = document.createElement('div');
    warn.id = 'ctx-warn';
    warn.className = 'context-warning';
    warn.innerHTML = `
      <div class="ctx-warn-inner">
        <svg class="ctx-warn-icon" viewBox="0 0 20 20" fill="none"><path d="M10 2.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zm0 4.5v4m0 2.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <div class="ctx-warn-body">
          <strong>Description courte (${len} car.)</strong>
          <span>Avez-vous précisé le lieu de diffusion, la cible et l'objectif ?</span>
        </div>
        <div class="ctx-warn-actions">
          <button class="ctx-warn-btn-complete" id="ctx-warn-complete">Compléter d'abord</button>
          <button class="ctx-warn-btn-submit" id="ctx-warn-submit">Soumettre quand même</button>
        </div>
      </div>`;
    const sb = document.getElementById('btn-submit');
    sb.parentNode.insertBefore(warn, sb);
    document.getElementById('ctx-warn-complete').addEventListener('click', () => {
      warn.remove();
      const descField = document.querySelector('[data-field="description"]');
      if (descField) { descField.focus(); descField.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
    document.getElementById('ctx-warn-submit').addEventListener('click', () => {
      warn.remove();
      _submitBypass = true;
      submitBrief();
    });
  }

  function showToast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (type ? ' toast-' + type : '');
    setTimeout(() => t.classList.remove('show'), 3500);
  }

  /* ════════════════════════════════════════════════════════════
     MODE RAPIDE
     ════════════════════════════════════════════════════════════ */
  let rapideSupports = new Set();

  function initRapideMode() {
    const deptSel = document.getElementById('r-dept');
    deptSel.innerHTML = '<option value="" disabled selected>Choisir…</option>' +
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
    const rDescEditor = document.getElementById('r-desc-editor');
    if (rDescEditor) rDescEditor.addEventListener('input', updateRapideSubmit);

    document.getElementById('r-submit').addEventListener('click', submitRapide);
    document.getElementById('r-to-full').addEventListener('click', switchToFullFromRapide);

    bindRapideAttachmentEvents();
    updateRapideSubmit();
  }

  function updateRapideSubmit() {
    const dept = document.getElementById('r-dept').value;
    const ref = document.getElementById('r-ref').value.trim();
    const descEditor = document.getElementById('r-desc-editor');
    const desc = descEditor ? (descEditor.innerText || '').trim() : document.getElementById('r-desc').value.trim();
    const launch = document.getElementById('r-launch').value;
    const prio = document.getElementById('r-priorite').dataset.value;
    const ok = dept && ref && desc && launch && prio && rapideSupports.size > 0;
    const btn = document.getElementById('r-submit');
    btn.disabled = !ok;
    btn.classList.toggle('ready', ok);
  }

  async function submitRapide() {
    const dept = document.getElementById('r-dept').value;
    const ref = document.getElementById('r-ref').value.trim();
    const descEditor = document.getElementById('r-desc-editor');
    const desc = descEditor ? (descEditor.innerText || '').trim() : document.getElementById('r-desc').value.trim();
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

    const rBtn = document.getElementById('r-submit');
    const rBtnLabel = rBtn ? rBtn.textContent : '';
    if (rBtn) { rBtn.disabled = true; rBtn.textContent = 'Envoi en cours…'; }
    showToast('Envoi en cours…');

    try {
      await sendWebhook(State.data);
      State.saveToHistory();
      const gcCreatedR = await GCalSync.syncBrief(State.data);
      State.rapideFiles = [];
      const gcMsgR = gcCreatedR ? ` · ${gcCreatedR} date${gcCreatedR > 1 ? 's' : ''} → Google Calendar` : '';
      showToast(`Brief ${State.data.briefId} soumis avec succès ✓${gcMsgR}`);
      localStorage.removeItem(STORAGE_KEY);
      setTimeout(() => location.reload(), 2200);
    } catch (err) {
      console.error('[BW Submit Rapide] Échec envoi:', err.message);
      if (rBtn) { rBtn.disabled = false; rBtn.textContent = rBtnLabel; }
      showToast('Échec d\'envoi — brouillon conservé. Vérifiez votre connexion et réessayez.');
    }
  }

  function switchToFullFromRapide() {
    State.data.dept = document.getElementById('r-dept').value;
    State.data.ref = document.getElementById('r-ref').value.trim();
    const _rdesc = document.getElementById('r-desc-editor');
    State.data.description = _rdesc ? (_rdesc.innerText||'').trim() : document.getElementById('r-desc').value.trim();
    State.data.dateLancement = document.getElementById('r-launch').value;
    State.data.priorite = document.getElementById('r-priorite').dataset.value || '';
    State.data.typeDemande = 'campagne';
    State.data.supportsSelected = [...rapideSupports];
    scheduleSave();
    switchMode('form');
    currentStep = 3; // Aller directement aux deadlines (déjà remplies)
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
  /* ════════════════════════════════════════════════════════════
     RICH TEXT EDITOR — toolbar + sync contenteditable → textarea
     ════════════════════════════════════════════════════════════ */
  function initRTE() {
    // Toolbar clicks (gras, italique, liste, effacer)
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.rte-btn[data-cmd]');
      if (!btn) return;
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      const wrap = btn.closest('.rte-wrap, .rapide-rte-wrap');
      const editor = wrap ? wrap.querySelector('[contenteditable]') : null;
      if (editor) editor.focus();
      document.execCommand(cmd, false, null);
      if (editor) syncRTE(editor);
    });

    // Sync contenteditable → hidden textarea on input
    document.addEventListener('input', function (e) {
      const editor = e.target.closest('[data-field-rte], [data-sync-to]');
      if (!editor || !editor.isContentEditable) return;
      syncRTE(editor);
    });

    // Blur on RTE editor → forward to hidden textarea for hint IA
    document.addEventListener('blur', function (e) {
      const editor = e.target.closest('[data-field-rte]');
      if (!editor) return;
      const fid = editor.dataset.fieldRte;
      const ta = document.querySelector(`textarea[data-field="${fid}"]`);
      if (ta) ta.dispatchEvent(new Event('blur', { bubbles: true }));
    }, true);

    // Update active state of toolbar buttons on selection change
    document.addEventListener('selectionchange', function () {
      const sel = window.getSelection();
      if (!sel || !sel.anchorNode) return;
      const editor = sel.anchorNode.parentElement && sel.anchorNode.parentElement.closest('[data-field-rte], [data-sync-to]');
      if (!editor) return;
      const wrap = editor.closest('.rte-wrap, .rapide-rte-wrap');
      if (!wrap) return;
      wrap.querySelectorAll('.rte-btn[data-cmd]').forEach(btn => {
        try { btn.classList.toggle('active', document.queryCommandState(btn.dataset.cmd)); } catch(err) {}
      });
    });
  }

  function syncRTE(editor) {
    // Sync to hidden textarea
    const syncId = editor.dataset.syncTo;
    const fieldId = editor.dataset.fieldRte;
    if (syncId) {
      const ta = document.getElementById(syncId);
      if (ta) ta.value = editor.innerText || '';
    }
    if (fieldId) {
      const ta = document.querySelector(`textarea[data-field="${fieldId}"]`);
      if (ta) {
        ta.value = editor.innerText || '';
        // Fire input event so existing app.js listener picks it up
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }
    // For rapide r-desc: fire input on the hidden textarea
    if (syncId) {
      const ta = document.getElementById(syncId);
      if (ta) ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /* ════════════════════════════════════════════════════════════
     AI BAR TOGGLE (mobile)
     ════════════════════════════════════════════════════════════ */
  window.toggleAiBar = function() {
    const bar = document.getElementById('ai-bar');
    const toggleBtn = document.getElementById('ai-bar-toggle');
    if (!bar) return;
    const open = bar.getAttribute('data-open') === 'true';
    bar.setAttribute('data-open', open ? 'false' : 'true');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      toggleBtn.innerHTML = open
        ? 'Déplier <i class="ti ti-chevron-down ai-bar-toggle-chevron"></i>'
        : 'Replier <i class="ti ti-chevron-up ai-bar-toggle-chevron"></i>';
    }
  };

  /* ════════════════════════════════════════════════════════════
     CLAUDE AI FILL
     ════════════════════════════════════════════════════════════ */
  async function claudeAIFill() {
    const btn = document.getElementById('ai-fill-btn');
    const input = document.getElementById('ai-prompt');
    if (!input || !btn) return;

    const prompt = input.value.trim();
    if (!prompt) {
      input.focus();
      input.classList.add('field-error-shake');
      input.addEventListener('animationend', () => input.classList.remove('field-error-shake'), { once: true });
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="ai-bar-btn-text ai-bar-loading"><span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span></span>';

    try {
      const res = await fetch('https://hook.eu1.make.com/5emqjw5lq3wmc9s2yvwhowipl73ek6d1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) throw new Error('Erreur réseau ' + res.status);

      let raw = await res.text();
      // Extraire le JSON si Claude a ajouté du texte autour
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Réponse invalide');
      const data = JSON.parse(match[0]);

      // Mapper les champs vers State.data
      const mapping = {
        marque: (() => { try { return ['bnw','marquise','pokawa','autre',...JSON.parse(localStorage.getItem('bw_custom_marques')||'[]').map(m=>m.id)]; } catch(e) { return ['bnw','marquise','pokawa','autre']; } })(),
        typeDemande: ['campagne','packaging','vitrophanie','autre'],
        description: null,
        accroche: null,
        nomProduit: null,
        prix: null,
        mentions: null,
        dateLancement: null,
        priorite: ['normal','prioritaire','urgent'],
      };

      let filled = 0;
      Object.keys(mapping).forEach(key => {
        const val = data[key];
        if (!val || typeof val !== 'string' || !val.trim()) return;
        const allowed = mapping[key];
        if (allowed && !allowed.includes(val)) return;
        State.data[key] = val.trim();
        filled++;
      });

      // Supports (tableau)
      if (Array.isArray(data.supports) && data.supports.length) {
        const validIds = CONFIG.supports.map(s => s.id);
        State.data.supportsSelected = data.supports.filter(s => validIds.includes(s));
        if (State.data.supportsSelected.length) filled++;
      }

      scheduleSave();
      renderAll();

      if (filled > 0) {
        showToast(`✨ ${filled} champ${filled > 1 ? 's' : ''} pré-rempli${filled > 1 ? 's' : ''} — vérifiez et complétez`, 'success');
        showAIChecklist();
      } else {
        showToast("Aucun champ reconnu — essayez d'être plus précis", 'warning');
      }
    } catch (e) {
      console.warn('[AI Fill]', e);
      showToast("Impossible de contacter l'IA — réessayez dans un instant", 'warning');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="ai-bar-btn-text">✨ Remplir</span>';
    }
  }

  // true quand le checklist a été affiché au moins une fois (et pas fermé manuellement)
  let aiChecklistActive = false;

  function showAIChecklist() {
    const { blocking } = State.getAllIssues();
    if (!blocking.length) return;
    aiChecklistActive = true;
    updateAIChecklist();
  }

  function updateAIChecklist() {
    if (!aiChecklistActive) return;

    const aiBar = document.getElementById('ai-bar');
    if (!aiBar) return; // pas sur step 1

    const { blocking } = State.getAllIssues();
    if (!blocking.length) {
      aiChecklistActive = false;
      const old = document.getElementById('ai-checklist');
      if (old) old.remove();
      return;
    }

    // Injecter ou mettre à jour
    let el = document.getElementById('ai-checklist');
    const chips = blocking.map(({ field }) =>
      `<button type="button" class="ai-cl-chip" data-goto-field="${field.id}">${field.label || field.id} →</button>`
    ).join('');

    if (!el) {
      el = document.createElement('div');
      el.id = 'ai-checklist';
      el.className = 'ai-checklist';
      el.innerHTML = `
        <span class="ai-cl-label">Champs à compléter&nbsp;:</span>
        <div class="ai-cl-chips">${chips}</div>
        <button type="button" class="ai-cl-close" id="ai-cl-close" title="Fermer">×</button>`;
      aiBar.insertAdjacentElement('afterend', el);
      document.getElementById('ai-cl-close').addEventListener('click', () => {
        aiChecklistActive = false;
        el.remove();
      });
    } else {
      const c = el.querySelector('.ai-cl-chips');
      if (c) c.innerHTML = chips;
    }
  }

  function init() {
    // Duplication depuis le dashboard (Pépite 3)
    if (new URLSearchParams(location.search).get('dupe') === '1') {
      try {
        const raw = localStorage.getItem('bw_dupe_brief');
        if (raw) {
          const src = JSON.parse(raw);
          localStorage.removeItem('bw_dupe_brief');
          State.data = {
            dept:         src.departement || src.dept || '',
            ref:          src.demandeur   || src.ref  || '',
            description:  src.contexte    || src.description || '',
            priorite:     src.priorite    || '',
            typeDemande:  src.typeDemande || '',
            marque:       src.marque      || '',
            dateLancement:    src.dateLancement    || '',
            dateValidation:   src.dateValidation   || '',
            dateRetourSimul:  src.dateRetourSimul  || '',
          };
          State.data.globalConfirmed = false;
          scheduleSave();
          State.openSections = { 1: true, 2: true, 3: true, 4: true, 5: false };
          renderAll();
          showToast('Brief dupliqué — modifiez et soumettez ✓');
          history.replaceState(null, '', location.pathname);
          return;
        }
      } catch(e) {}
    }

    const restored = State.load();
    if (restored && (State.data.dept || State.data.typeDemande)) {
      document.getElementById('restore-banner').hidden = false;
      currentStep = determineStartStep();
    }

    const hist = State.getHistory();
    const histCountEl = document.getElementById('hist-count');
    if (histCountEl) histCountEl.textContent = hist.length;

    renderAll();
    initRTE();
    initRapideMode();

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });

    // btn-submit (sidebar) — toujours dans le DOM
    const sbSubmit = document.getElementById('btn-submit');
    if (sbSubmit) sbSubmit.addEventListener('click', submitBrief);
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
      window.open(`https://mail.google.com/mail/?view=cm&su=${subject}&body=${body}`, '_blank');
    });

    initHistoryDrawer();

    // Mettre à jour le badge compteur avec le total distant (GitHub JSON)
    // sans ouvrir le drawer — fetch silencieux en arrière-plan
    loadMergedHistory().then(merged => {
      const badge = document.getElementById('hist-count');
      if (badge && merged.length > 0) badge.textContent = merged.length;
    }).catch(() => {});

    // Hamburger mobile
    const hamburger   = document.getElementById('btn-hamburger');
    const sidebar     = document.getElementById('sidebar');
    const overlay     = document.getElementById('sidebar-overlay');
    const closeBtn    = document.getElementById('sidebar-close-btn');
    if (hamburger && sidebar && overlay) {
      function openSidebar() {
        sidebar.classList.add('is-open');
        overlay.classList.add('is-open');
        hamburger.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
        // Focus on first nav link
        const firstLink = sidebar.querySelector('a, button:not(#sidebar-close-btn)');
        if (firstLink) setTimeout(() => firstLink.focus(), 50);
      }
      function closeSidebar() {
        sidebar.classList.remove('is-open');
        overlay.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        hamburger.focus();
      }
      hamburger.addEventListener('click', () => {
        sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar();
      });
      overlay.addEventListener('click', closeSidebar);
      if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
      // Escape key
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && sidebar.classList.contains('is-open')) closeSidebar();
      });
      // Close on nav link click
      sidebar.querySelectorAll('a[href]').forEach(a => a.addEventListener('click', closeSidebar));
    }

    // Date min = aujourd'hui sur tous les champs date
    const today = new Date().toISOString().slice(0, 10);
    document.querySelectorAll('input[type="date"]').forEach(el => { el.min = today; });

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
        } else {
          const isHtml = text.trim().startsWith('<');
          console.warn('[BW Hist] Make API → réponse non-JSON:', JSON.stringify(text.trim().slice(0,80)), '| isHtml:', isHtml);
          sheetStatus = isHtml ? 'html' : 'network'; // 'html' bloque CSV, 'network' laisse passer
        }
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
      const dupBtn = `<button class="hist-dup-btn" data-dup-brief="${b.briefId}" title="Dupliquer ce brief" aria-label="Dupliquer"><svg viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.2" stroke="currentColor" stroke-width="1.4"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>`;
      return `
        <div class="hist-item" data-open-brief="${b.briefId}">
          <div class="hist-item-head">
            <span class="hist-id">${b.briefId}</span>
            <span class="hist-badge ${d.typeClass}">${d.typeLabel}</span>
            ${sourceTag}
            ${dupBtn}
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

    body.querySelectorAll('[data-dup-brief]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        duplicateBrief(el.dataset.dupBrief);
      });
    });

    body.querySelectorAll('[data-open-brief]').forEach(el => {
      el.addEventListener('click', () => openBriefDetail(el.dataset.openBrief));
    });
  }

  function duplicateBrief(briefId) {
    const brief = _mergedHistory.find(b => b.briefId === briefId)
                  || State.getHistory().find(b => b.briefId === briefId);
    if (!brief) return;
    if (brief._source === 'local' || brief._source === 'both') {
      const copy = { ...brief };
      delete copy.briefId;
      delete copy.submittedAt;
      delete copy.globalConfirmed;
      delete copy._source;
      State.data = copy;
    } else {
      State.data = {
        dept: brief.departement || '',
        ref: brief.demandeur || '',
        description: brief.contexte || '',
        priorite: brief.priorite || '',
        typeDemande: brief.typeDemande || '',
        marque: brief.marque || ''
      };
    }
    State.data.globalConfirmed = false;
    scheduleSave();
    closeHistoryDrawer();
    State.openSections = { 1: true, 2: true, 3: true, 4: true, 5: false };
    renderAll();
    showToast('Brief dupliqué — modifiez et soumettez ✓');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  document.addEventListener('DOMContentLoaded', () => {
    try { init(); }
    catch(e) { console.error('INIT ERROR:', e.message, e.stack); }
  });

})();
