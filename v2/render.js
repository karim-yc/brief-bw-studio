/* ════════════════════════════════════════════════════════════
   RENDER.JS — Génération du HTML à partir de l'état
   ════════════════════════════════════════════════════════════ */

const Icons = {
  campagne: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 10v4h3l5 4V6L7 10H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M16 9a3 3 0 0 1 0 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M18.5 6.5a7 7 0 0 1 0 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  packaging: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8l8-4 8 4-8 4-8-4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M4 8v8l8 4 8-4V8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 12v8" stroke="currentColor" stroke-width="1.5"/></svg>',
  vitrophanie: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M4 12h16M12 5v14" stroke="currentColor" stroke-width="1.5"/></svg>',
  autre: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M12 16v.01M12 8a2.2 2.2 0 0 1 2.2 2.2c0 1.5-2.2 1.8-2.2 3.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevron: '<svg viewBox="0 0 20 20" fill="none"><path d="M5 7.5l5 5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  trash: '<svg viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6.5 5V3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V5M4.5 5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const Render = {

  /* ════════════════════════════════════════════════════════════
     FIELD RENDERER — un champ générique selon son type
     ════════════════════════════════════════════════════════════ */
  field(f) {
    const val = State.data[f.id] ?? '';
    const isBlocking = f.gravity === 'blocking' && !State.isFieldFilled(f);
    const isRecommended = f.gravity === 'recommended' && !State.isFieldFilled(f);
    const cls = ['field'];
    if (isBlocking) cls.push('is-blocking');
    else if (isRecommended) cls.push('is-recommended');

    if (f.type === 'packtable') {
      return `
        <div class="${cls.join(' ')}" data-field-wrap="${f.id}">
          <label class="field-label">${f.label}${f.gravity === 'blocking' ? '<span class="req">*</span>' : ''}</label>
          ${this.packTable()}
        </div>`;
    }

    let inputHtml = '';
    if (f.type === 'textarea') {
      inputHtml = `<textarea data-field="${f.id}" placeholder="${f.placeholder || ''}">${this.esc(val)}</textarea>`;
    } else if (f.type === 'select') {
      const opts = (CONFIG[f.options] || []).map(o =>
        `<option value="${this.esc(o)}" ${val === o ? 'selected' : ''}>${this.esc(o)}</option>`
      ).join('');
      inputHtml = `<select data-field="${f.id}"><option value="">— Sélectionner —</option>${opts}</select>`;
    } else if (f.type === 'pills') {
      inputHtml = `<div class="pill-group" data-field-group="${f.id}">` +
        f.options.map(o => `<button type="button" class="pill ${val === o.id ? 'active' : ''}" data-field="${f.id}" data-value="${o.id}">${o.label}</button>`).join('') +
        `</div>`;
    } else if (f.type === 'date') {
      inputHtml = `<input type="date" data-field="${f.id}" value="${this.esc(val)}">`;
    } else {
      inputHtml = `<input type="text" data-field="${f.id}" placeholder="${f.placeholder || ''}" value="${this.esc(val)}">`;
    }

    const confirmToggle = f.confirmable && State.isFieldFilled(f) ? this.confirmToggle(f.id) : '';

    return `
      <div class="${cls.join(' ')}" data-field-wrap="${f.id}">
        <div class="field-label-row">
          <label class="field-label">${f.label}${f.gravity === 'blocking' ? '<span class="req">*</span>' : ''}</label>
          ${confirmToggle}
        </div>
        ${inputHtml}
      </div>`;
  },

  packTable() {
    const products = State.data.packagingProducts;
    const rows = products.map((p, i) => {
      const isLast = i === products.length - 1;
      return `
      <div class="pack-row">
        <input type="text" data-pack-field="nom" data-pack-index="${i}" placeholder="Ex : Boîte burger individuelle" value="${this.esc(p.nom)}">
        <input type="text" data-pack-field="format" data-pack-index="${i}" placeholder="Format" value="${this.esc(p.format)}">
        <input type="number" min="1" data-pack-field="qte" data-pack-index="${i}" placeholder="Qté" value="${this.esc(p.qte)}">
        <div class="pack-row-actions">
          ${isLast ? `<button type="button" class="pack-add-inline" data-add-pack-row title="Ajouter un produit">${Icons.plus}</button>` : ''}
          <button type="button" class="pack-del" data-pack-del="${i}" title="Supprimer">${Icons.trash}</button>
        </div>
      </div>`;
    }).join('');

    return `
      <div class="pack-table">
        <div class="pack-row pack-row-head">
          <span>Nom du produit</span><span>Format</span><span>Qté</span><span></span>
        </div>
        ${rows}
      </div>`;
  },

  confirmToggle(fieldId) {
    const confirmed = !!State.data.confirmations[fieldId];
    return `<button type="button" class="confirm-toggle ${confirmed ? 'confirmed' : 'unconfirmed'}" data-confirm-toggle="${fieldId}">
      ${confirmed ? Icons.check : ''} ${confirmed ? 'Validé' : 'À confirmer'}
    </button>`;
  },

  esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  statusBadge(status) {
    const label = CONFIG.statusLabels[status] || status;
    return `<span class="card-status ${status}">${label}</span>`;
  },

  /* ════════════════════════════════════════════════════════════
     SECTION 1 — QUI DEMANDE
     ════════════════════════════════════════════════════════════ */
  section1() {
    const st = State.getSectionStatus('qui');
    const open = State.openSections[1];
    const fields = State.getChampsEtape1();

    return `
      <div class="card" data-section="1">
        <div class="card-head ${open ? 'open' : ''}" data-toggle="1">
          <div class="card-num">1</div>
          <div class="card-title">Qui demande ?</div>
          ${this.statusBadge(st.status)}
          <div class="card-chevron">${Icons.chevron}</div>
        </div>
        <div class="card-body ${open ? 'open' : ''}" id="card-body-1">
          <div class="card-body-inner">
            <div class="field-row">
              ${this.field(fields.find(f => f.id === 'dept'))}
              ${this.field(fields.find(f => f.id === 'ref'))}
            </div>
            ${fields.filter(f => f.id === 'restaurant' || f.id === 'deptAutrePrecision').map(f => this.field(f)).join('')}
          </div>
        </div>
      </div>`;
  },

  /* ════════════════════════════════════════════════════════════
     SECTION 2 — QUE FAUT-IL CRÉER
     ════════════════════════════════════════════════════════════ */
  section2() {
    const st = State.getSectionStatus('quoi');
    const open = State.openSections[2];
    const type = State.data.typeDemande;

    const cards = CONFIG.typesDemande.map(t => `
      <button type="button" class="select-card ${type === t.id ? 'active' : ''}" data-type-select="${t.id}">
        ${Icons[t.icon]}
        <span class="select-card-label">${t.label}</span>
      </button>`).join('');

    let subContent = '';
    if (type === 'campagne') {
      subContent = `
        <div class="field">
          <label class="field-label">Genre de campagne</label>
          <div class="pill-group">
            ${CONFIG.genresCampagne.map(g => `<button type="button" class="pill ${State.data.genreCampagne === g.id ? 'active' : ''}" data-field="genreCampagne" data-value="${g.id}">${g.label}</button>`).join('')}
          </div>
        </div>`;
    } else if (type === 'packaging') {
      subContent = `
        <div class="field">
          <label class="field-label">Phase de production</label>
          <div class="pill-group">
            ${CONFIG.phasesPackaging.map(p => `<button type="button" class="pill ${State.data.phasePackaging === p.id ? 'active' : ''}" data-field="phasePackaging" data-value="${p.id}">${p.label}</button>`).join('')}
          </div>
        </div>`;
    } else if (type === 'vitrophanie') {
      subContent = `
        <div class="field">
          <label class="field-label">Type de vitrophanie</label>
          <div class="pill-group">
            ${CONFIG.typesVitrophanie.map(v => `<button type="button" class="pill ${State.data.typeVitrophanie === v.id ? 'active' : ''}" data-field="typeVitrophanie" data-value="${v.id}">${v.label}</button>`).join('')}
          </div>
        </div>`;
    }

    // "Ce qu'il faut produire" — uniquement pertinent pour Campagne Marketing.
    // Packaging et Vitrophanie ont leurs propres champs dédiés en section 3,
    // pas de notion de "supports marketing" à sélectionner.
    const supportsBlock = type === 'campagne' ? this.supportsBlock() : '';

    return `
      <div class="card" data-section="2">
        <div class="card-head ${open ? 'open' : ''}" data-toggle="2">
          <div class="card-num">2</div>
          <div class="card-title">Que faut-il créer ?</div>
          ${this.statusBadge(st.status)}
          <div class="card-chevron">${Icons.chevron}</div>
        </div>
        <div class="card-body ${open ? 'open' : ''}" id="card-body-2">
          <div class="card-body-inner">
            <div class="field">
              <label class="field-label">Type de demande<span class="req">*</span></label>
              <div class="card-grid">${cards}</div>
            </div>
            <div class="cond-block ${type ? 'visible' : 'hidden'}">
              ${subContent}
              ${this.field(CONFIG.champsEtape2[0])}
            </div>
            <div class="cond-block ${type === 'campagne' ? 'visible' : 'hidden'}">
              ${supportsBlock}
            </div>
          </div>
        </div>
      </div>`;
  },

  /* ── Bloc "Ce qu'il faut produire" — supports/formats/déclinaisons/livrables.
     Visible uniquement pour Campagne Marketing, intégré à la section 2. ── */
  supportsBlock() {
    const selected = State.data.supportsSelected;

    const supportCards = CONFIG.supports.map(s => `
      <button type="button" class="support-card ${selected.includes(s.id) ? 'active' : ''}" data-support-toggle="${s.id}">
        <span class="chk-dot">${selected.includes(s.id) ? Icons.check : ''}</span>
        ${s.label}
      </button>`).join('');

    const formatRows = selected.map(sid => {
      const sup = CONFIG.supports.find(s => s.id === sid);
      const fmt = State.data.formats[sid] || sup.defaultFormat;
      const vol = State.data.volumes[sid] || '';
      const liv = State.data.supportLivrables?.[sid] || '';
      return `
        <div class="pack-row pack-row-supports">
          <span style="font-size:13px">${sup.label}</span>
          <input type="text" data-format-field="${sid}" placeholder="Format" value="${this.esc(fmt)}">
          <input type="number" min="1" data-volume-field="${sid}" placeholder="Nb" value="${this.esc(vol)}" title="Nombre de déclinaisons visuelles">
          <select data-support-livrable-field="${sid}">
            <option value="">Livrable</option>
            ${CONFIG.livrables.map(l => `<option value="${l.id}" ${liv === l.id ? 'selected' : ''}>${l.label}</option>`).join('')}
          </select>
        </div>`;
    }).join('');

    const totalVol = Object.values(State.data.volumes).reduce((a, b) => a + (parseInt(b) || 0), 0);

    return `
      <div class="field" style="margin-top:4px">
        <label class="field-label">Supports à produire<span class="req">*</span></label>
        <div class="support-grid">${supportCards}</div>
      </div>
      ${selected.length ? `
      <div class="field" style="margin-top:18px">
        <label class="field-label">Format, déclinaisons et livrable par support</label>
        <div class="pack-table">
          <div class="pack-row pack-row-head pack-row-supports">
            <span>Support</span><span>Format</span><span>Déclis</span><span>Livrable</span>
          </div>
          ${formatRows}
        </div>
        <p class="field-hint">Total déclinaisons visuelles : ${totalVol || 0}</p>
      </div>` : ''}`;
  },

  /* ════════════════════════════════════════════════════════════
     SECTION 3 — INFOS INDISPENSABLES (adaptatif par type)
     ════════════════════════════════════════════════════════════ */
  section3() {
    const st = State.getSectionStatus('infos');
    const open = State.openSections[3];
    const type = State.data.typeDemande;
    const fields = State.getChampsEtape3();

    let body;
    if (!type) {
      body = `<p style="color:var(--text-tertiary);font-size:13px">Sélectionnez d\'abord un type de demande à l\'étape 2.</p>`;
    } else if (type === 'packaging') {
      body = this.packagingFields(fields);
    } else {
      body = fields.map(f => this.field(f)).join('');
    }

    return `
      <div class="card" data-section="3">
        <div class="card-head ${open ? 'open' : ''}" data-toggle="3">
          <div class="card-num">3</div>
          <div class="card-title">Infos indispensables</div>
          ${this.statusBadge(st.status)}
          <div class="card-chevron">${Icons.chevron}</div>
        </div>
        <div class="card-body ${open ? 'open' : ''}" id="card-body-3">
          <div class="card-body-inner">${body}</div>
        </div>
      </div>`;
  },

  packagingFields(fields) {
    // field() gère désormais nativement le type 'packtable'
    return fields.map(f => this.field(f)).join('');
  },

  /* ════════════════════════════════════════════════════════════
     SECTION 4 — DEADLINES & PRIORITÉ
     Ne contient plus que ce qui concerne le calendrier de production.
     Les supports à produire ont été déplacés en section 2 (Que faut-il créer).
     ════════════════════════════════════════════════════════════ */
  section4() {
    const st = State.getSectionStatus('supports');
    const open = State.openSections[4];

    const priorityPills = CONFIG.prioritesNiveau.map(p =>
      `<button type="button" class="pill ${p.id === 'urgent' ? 'urgent' : ''} ${State.data.priorite === p.id ? 'active' : ''}" data-field="priorite" data-value="${p.id}">${p.label}</button>`
    ).join('');

    return `
      <div class="card" data-section="4">
        <div class="card-head ${open ? 'open' : ''}" data-toggle="4">
          <div class="card-num">4</div>
          <div class="card-title">Deadlines &amp; priorité</div>
          ${this.statusBadge(st.status)}
          <div class="card-chevron">${Icons.chevron}</div>
        </div>
        <div class="card-body ${open ? 'open' : ''}" id="card-body-4">
          <div class="card-body-inner">
            <div class="field-row">
              ${this.field(CONFIG.champsEtape4Deadlines[0])}
              ${this.field(CONFIG.champsEtape4Deadlines[1])}
            </div>
            ${this.field(CONFIG.champsEtape4Deadlines[2])}
            <div class="field" style="margin-top:4px">
              <label class="field-label">Priorité<span class="req">*</span></label>
              <div class="pill-group">${priorityPills}</div>
            </div>
            <div class="cond-block ${State.data.priorite === 'urgent' ? 'visible' : 'hidden'}">
              ${this.field({ id: 'raisonUrgence', label: 'Pourquoi cette demande est-elle urgente ?', type: 'text', gravity: 'blocking', placeholder: 'Ex : Lancement avancé par la direction, campagne presse imminente...' })}
            </div>
          </div>
        </div>
      </div>`;
  },

  /* ════════════════════════════════════════════════════════════
     SECTION 5 — RÉCAPITULATIF
     ════════════════════════════════════════════════════════════ */
  section5() {
    const open = State.openSections[5];
    const r = Recap.build();

    return `
      <div class="card" data-section="5">
        <div class="card-head ${open ? 'open' : ''}" data-toggle="5">
          <div class="card-num">5</div>
          <div class="card-title">Récapitulatif</div>
          <div class="card-chevron">${Icons.chevron}</div>
        </div>
        <div class="card-body ${open ? 'open' : ''}" id="card-body-5">
          <div class="card-body-inner">
            <div style="font-size:12.5px;line-height:1.8;color:var(--text-secondary);background:var(--bg-soft);border-radius:12px;padding:20px">
${Recap.toHtml(r)}
            </div>
          </div>
        </div>
      </div>`;
  },

  /* ════════════════════════════════════════════════════════════
     RENDU COMPLET DES SECTIONS
     ════════════════════════════════════════════════════════════ */
  allSections() {
    return this.section1() + this.section2() + this.section3() + this.section4() + this.section5();
  },

  /* ════════════════════════════════════════════════════════════
     SIDEBAR
     ════════════════════════════════════════════════════════════ */
  sidebar() {
    this.renderProgress();
    this.renderSectionList();
    this.renderIssues();
    this.renderSubmitButton();
  },

  renderProgress() {
    const { filled, total } = State.getOverallProgress();
    const dotsEl = document.getElementById('sb-dots');
    const textEl = document.getElementById('sb-progress-text');
    const fillEl = document.getElementById('sb-fill');

    let dots = '';
    for (let i = 0; i < total; i++) {
      const f = filled - i;
      let cls = 'sb-dot';
      if (f >= 1) cls += ' filled';
      else if (f >= 0.5) cls += ' partial';
      dots += `<div class="${cls}"></div>`;
    }
    dotsEl.innerHTML = dots;
    textEl.textContent = `${Math.round(filled)} / ${total} sections`;
    fillEl.style.width = `${(filled / total) * 100}%`;
  },

  renderSectionList() {
    const el = document.getElementById('sb-sections');
    const keys = ['qui', 'quoi', 'infos', 'supports'];
    const titles = ['Qui demande', 'Quoi créer', 'Infos indispensables', 'Deadlines & priorité'];

    el.innerHTML = keys.map((k, i) => {
      const st = State.getSectionStatus(k);
      let iconCls = 'empty', iconContent = '';
      if (st.status === 'complete') { iconCls = 'complete'; iconContent = Icons.check; }
      else if (st.status === 'partial') { iconCls = 'partial'; }

      return `
        <li class="sb-section-item ${st.status === 'complete' ? 'is-complete' : ''}" data-goto-section="${i + 1}">
          <span class="sb-status-icon ${iconCls}">${iconContent}</span>
          <span class="sb-section-name">${titles[i]}</span>
          ${st.total ? `<span class="sb-section-count">${st.filled}/${st.total}</span>` : ''}
        </li>`;
    }).join('') + `
        <li class="sb-section-item" data-goto-section="5">
          <span class="sb-status-icon empty"></span>
          <span class="sb-section-name">Récapitulatif</span>
        </li>`;
  },

  renderIssues() {
    const issues = State.getAllIssues();

    const blockingEl = document.getElementById('sb-blocking');
    if (issues.blocking.length) {
      blockingEl.innerHTML = `
        <div class="sb-issue-group">
          <div class="sb-issue-head blocking">Bloquant — ${issues.blocking.length}</div>
          <div class="sb-issue-list">
            ${issues.blocking.map(i => `<div class="sb-issue-item blocking-item" data-goto-field="${i.field.id}">${i.field.label}${i.reason === 'a_confirmer' ? ' (à confirmer)' : ''}</div>`).join('')}
          </div>
        </div>`;
    } else {
      blockingEl.innerHTML = '';
    }

    const recoEl = document.getElementById('sb-recommended');
    if (issues.recommended.length) {
      recoEl.innerHTML = `
        <div class="sb-issue-group">
          <div class="sb-issue-head recommended">Recommandé — ${issues.recommended.length}</div>
          <div class="sb-issue-list">
            ${issues.recommended.map(i => `<div class="sb-issue-item recommended-item" data-goto-field="${i.field.id}">${i.field.label}</div>`).join('')}
          </div>
        </div>`;
    } else {
      recoEl.innerHTML = '';
    }

    const completeEl = document.getElementById('sb-complete');
    if (issues.complete.length) {
      completeEl.innerHTML = `<div class="sb-issue-head complete">Complet — ${issues.complete.length}</div>`;
    } else {
      completeEl.innerHTML = '';
    }
  },

  renderSubmitButton() {
    const ready = State.isReadyToSubmit();
    const issues = State.getAllIssues();
    [document.getElementById('btn-submit'), document.getElementById('btn-submit-mobile')].forEach(btn => {
      if (!btn) return;
      btn.disabled = !ready;
      btn.classList.toggle('ready', ready);
    });
    const note = document.getElementById('sb-submit-note');
    if (note) {
      if (ready) { note.textContent = 'Toutes les infos requises sont prêtes'; note.classList.remove('is-blocking'); }
      else { note.textContent = `${issues.blocking.length} champ${issues.blocking.length > 1 ? 's' : ''} bloquant${issues.blocking.length > 1 ? 's' : ''} à compléter`; note.classList.add('is-blocking'); }
    }
    const mobileIssues = document.getElementById('mobile-submit-issues');
    if (mobileIssues) {
      mobileIssues.textContent = ready ? '' : `${issues.blocking.length} bloquant${issues.blocking.length > 1 ? 's' : ''} restant${issues.blocking.length > 1 ? 's' : ''}`;
    }
  }
};
