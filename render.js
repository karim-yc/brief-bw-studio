/* ════════════════════════════════════════════════════════════
   RENDER.JS — Génération du HTML à partir de l'état
   ════════════════════════════════════════════════════════════ */

const Icons = {
  campagne: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 10v4h3l5 4V6L7 10H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M16 9a3 3 0 0 1 0 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M18.5 6.5a7 7 0 0 1 0 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  packaging: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8l8-4 8 4-8 4-8-4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M4 8v8l8 4 8-4V8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 12v8" stroke="currentColor" stroke-width="1.5"/></svg>',
  vitrophanie: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M4 12h16M12 5v14" stroke="currentColor" stroke-width="1.5"/></svg>',
  autre: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M12 16v.01M12 8a2.2 2.2 0 0 1 2.2 2.2c0 1.5-2.2 1.8-2.2 3.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  affiche: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 8h8M8 12h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 16l2.5-3 2 2.5L15 13l3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M6 8h12M6 11h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevron: '<svg viewBox="0 0 20 20" fill="none"><path d="M5 7.5l5 5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  trash: '<svg viewBox="0 0 16 16" fill="none"><path d="M3 5h10M6.5 5V3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V5M4.5 5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const Render = {

  /* ════════════════════════════════════════════════════════════
     FIELD RENDERER — un champ générique selon son type
     ════════════════════════════════════════════════════════════ */
  /* ── Tooltip "i" d'aide contextuelle ───────────────────── */
  tooltip(text) {
    const safe = text.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    return `<span class="tt" data-tt="${safe}"><button type="button" class="tt-icon" aria-label="Aide : ${safe}" aria-expanded="false">i</button><span class="tt-bubble" role="tooltip">${text}</span></span>`;
  },

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
      const minL = f.minLength || 0;
      const minNote = minL ? `<div class="field-minlength" id="minl-${f.id}"><span class="minl-cur">0</span>/${minL} caractères minimum</div>` : '';
      // Rich text editor pour le champ description (contexte du projet)
      if (f.id === 'description') {
        const safeVal = this.esc(val);
        const htmlVal = val ? val.replace(/\n/g, '<br>') : '';
        inputHtml = `
          <div class="rte-wrap" id="rte-wrap-${f.id}">
            <div class="rte-toolbar">
              <button type="button" class="rte-btn" data-cmd="bold" title="Gras (Ctrl+B)"><b>B</b></button>
              <button type="button" class="rte-btn" data-cmd="italic" title="Italique (Ctrl+I)"><i>I</i></button>
              <button type="button" class="rte-btn" data-cmd="insertUnorderedList" title="Liste à puces">≡</button>
              <span class="rte-sep"></span>
              <button type="button" class="rte-btn" data-cmd="removeFormat" title="Effacer la mise en forme">✕</button>
            </div>
            <div class="rte-editor" id="rte-${f.id}" contenteditable="true" data-placeholder="${f.placeholder || ''}" data-field-rte="${f.id}">${htmlVal}</div>
            <textarea data-field="${f.id}" data-min-length="${minL}" style="display:none">${safeVal}</textarea>
          </div>${minNote}`;
      } else {
        inputHtml = `<textarea data-field="${f.id}" placeholder="${f.placeholder || ''}" data-min-length="${minL}">${this.esc(val)}</textarea>${minNote}`;
      }
    } else if (f.type === 'attachments') {
      const files = (typeof State !== 'undefined' && State.files) ? State.files : [];
      const listHtml = files.length ? files.map((file, i) =>
        `<div class="att-item" data-idx="${i}">
          <span class="att-icon">${/image/.test(file.type) ? '🖼' : '📄'}</span>
          <span class="att-name">${this.esc(file.name)}</span>
          <span class="att-size">${(file.size / 1024).toFixed(0)} Ko</span>
          <button type="button" class="att-remove" data-att-idx="${i}" title="Supprimer">×</button>
        </div>`).join('') : '';
      inputHtml = `
        <div class="att-dropzone" id="att-dropzone">
          <input type="file" id="att-input" multiple accept="image/*,.pdf,.doc,.docx,.pptx,.xlsx,.zip" style="display:none">
          <span class="att-icon-add">＋</span>
          <span class="att-label">Glisser des fichiers ici ou <u>parcourir</u></span>
          <span class="att-hint">Max 3 fichiers · 5 Mo chacun</span>
        </div>
        <div class="att-list" id="att-list">${listHtml}</div>`;
    } else if (f.type === 'select') {
      const opts = (CONFIG[f.options] || []).map(o =>
        `<option value="${this.esc(o)}" ${val === o ? 'selected' : ''}>${this.esc(o)}</option>`
      ).join('');
      inputHtml = `<select id="field-${f.id}" data-field="${f.id}"><option value="" disabled ${!val ? 'selected' : ''}>Choisir…</option>${opts}</select>`;
    } else if (f.type === 'pills') {
      let pillOpts = Array.isArray(f.options) ? f.options : (CONFIG[f.options] || []);
      if (f.options === 'marques') {
        try { const c = JSON.parse(localStorage.getItem('bw_custom_marques')||'[]'); if(c.length) pillOpts=[...pillOpts,...c]; } catch(e){}
      }
      inputHtml = `<div class="pill-group" data-field-group="${f.id}">` +
        pillOpts.map(o => `<button type="button" class="pill ${val === o.id ? 'active' : ''}" data-field="${f.id}" data-value="${o.id}">${o.label}</button>`).join('') +
        `</div>`;
    } else if (f.type === 'pills-text') {
      const opts = Array.isArray(f.options) ? f.options : (CONFIG[f.options] || []);
      const predefined = opts.filter(o => o !== 'Autre');
      const isAutre = val === 'Autre' || (val !== '' && !predefined.includes(val));
      const textVal = (isAutre && val !== 'Autre') ? val : '';
      inputHtml = `<div class="pill-group" data-field-group="${f.id}">` +
        predefined.map(o =>
          `<button type="button" class="pill ${val === o ? 'active' : ''}" data-field="${f.id}" data-value="${this.esc(o)}">${this.esc(o)}</button>`
        ).join('') +
        `<button type="button" class="pill ${isAutre ? 'active' : ''}" data-field="${f.id}" data-value="Autre">Autre</button>` +
        `</div>` +
        `<input type="text" data-field="${f.id}" placeholder="Précisez la matière / support…" value="${this.esc(textVal)}"${isAutre ? '' : ' style="display:none"'}>`;
    } else if (f.type === 'date') {
      inputHtml = `<input type="date" id="field-${f.id}" data-field="${f.id}" value="${this.esc(val)}">`;
    } else {
      inputHtml = `<input type="text" id="field-${f.id}" data-field="${f.id}" placeholder="${f.placeholder || ''}" value="${this.esc(val)}">`;
    }

    const helpHtmlInline = f.help ? `<div class="field-help">${f.help}</div>` : '';
    return `
      <div class="${cls.join(' ')}" data-field-wrap="${f.id}">
        <div class="field-label-row">
          <label class="field-label" for="field-${f.id}">${f.label}${f.gravity === 'blocking' ? '<span class="req">*</span>' : ''}${f.tooltip ? this.tooltip(f.tooltip) : ''}</label>
        </div>
        ${helpHtmlInline}
        ${inputHtml}
      </div>`;
  },

  packTable() {
    const products = State.data.packagingProducts;
    const rows = products.map((p, i) => {
      const isLast = i === products.length - 1;
      return `
      <div class="pack-row pack-row-products">
        <input type="text" class="pack-field-nom" data-pack-field="nom" data-pack-index="${i}" placeholder="Ex : Boîte burger individuelle" value="${this.esc(p.nom)}">
        <input type="text" class="pack-field-format" data-pack-field="format" data-pack-index="${i}" placeholder="Format" value="${this.esc(p.format)}">
        <input type="number" min="1" class="pack-field-qte" data-pack-field="qte" data-pack-index="${i}" placeholder="Qté / variante" value="${this.esc(p.qte)}">
        <div class="pack-row-actions">
          ${isLast ? `<button type="button" class="pack-add-inline" data-add-pack-row title="Ajouter un produit">${Icons.plus}</button>` : ''}
          ${products.length > 1 ? `<button type="button" class="pack-del" data-pack-del="${i}" title="Supprimer">${Icons.trash}</button>` : ''}
        </div>
      </div>`;
    }).join('');

    return `
      <div class="pack-table">
        <div class="pack-row pack-row-products pack-row-head">
          <span>Nom du produit</span><span>Format</span><span>Qté / variante</span><span></span>
        </div>
        ${rows}
      </div>`;
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
            ${this.field(fields.find(f => f.id === 'marque'))}
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
      <button type="button" role="radio" aria-checked="${type === t.id ? 'true' : 'false'}" class="select-card ${type === t.id ? 'active' : ''}" data-type-select="${t.id}">
        ${Icons[t.icon]}
        <span class="select-card-label">${t.label}</span>
        ${t.sub ? `<span class="select-card-sub">${t.sub}</span>` : ''}
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
              <div class="card-grid" role="radiogroup" aria-label="Type de demande">${cards}</div>
            </div>
            <div class="cond-block ${type ? 'visible' : 'hidden'}">
              ${subContent}
              ${CONFIG.champsEtape2.map(f => this.field(f)).join('')}
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
        <label class="field-label">Format, déclinaisons et livrable par support${this.tooltip('Déclinaisons = nombre de variantes graphiques (≠ quantité d\'impression). Livrable = format final attendu : PNG, PDF print, PDF web, BAT, source…')}</label>
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
              <label class="field-label">Priorité<span class="req">*</span>${this.tooltip('Normal = délai raisonnable · Prioritaire = à traiter avant d\'autres · Urgent = délai très court, à justifier')}</label>
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
    const globalConfirmed = !!State.data.globalConfirmed;

    return `
      <div class="card" data-section="5">
        <div class="card-head ${open ? 'open' : ''}" data-toggle="5">
          <div class="card-num">5</div>
          <div class="card-title">Récapitulatif</div>
          <div class="card-chevron">${Icons.chevron}</div>
        </div>
        <div class="card-body ${open ? 'open' : ''}" id="card-body-5">
          <div class="card-body-inner">
            <div class="recap-doc">
${Recap.toHtml(r)}
            </div>
            <div class="reserves-wrap">
              <label class="field-label" for="field-reserves">Informations à confirmer / réserves <span class="field-label-optional">(facultatif)</span>${this.tooltip('Informations encore incertaines : prix à confirmer, date provisoire, texte non validé, gabarit en attente, mesure à vérifier…')}</label>
              <p class="field-hint">Prix encore à confirmer, date provisoire, texte non validé, gabarit en attente, mesure à vérifier…</p>
              <textarea id="field-reserves" data-field="reserves" placeholder="Indiquez ici toute information encore incertaine ou à valider avant l'exécution." rows="3">${Render.esc(State.data.reserves || '')}</textarea>
            </div>
            <label class="global-confirm-label ${globalConfirmed ? 'is-confirmed' : ''}">
              <input type="checkbox" id="chk-global-confirm" ${globalConfirmed ? 'checked' : ''}>
              <span>Je certifie que ces informations sont complètes et prêtes à exécuter par le studio graphique.</span>
            </label>
          </div>
        </div>
      </div>`;
  },

  /* ════════════════════════════════════════════════════════════
     RENDU COMPLET DES SECTIONS (mode accordéon — conservé)
     ════════════════════════════════════════════════════════════ */
  allSections() {
    return this.section1() + this.section2() + this.section3() + this.section4() + this.section5();
  },

  /* ════════════════════════════════════════════════════════════
     WIZARD — Rendu étape par étape
     ════════════════════════════════════════════════════════════ */

  wizardProgress(step) {
    const steps = [
      { n: 1, label: 'L\'essentiel',  sub: 'Qui fait la demande ?' },
      { n: 2, label: 'Le contexte',   sub: 'Détails du projet' },
      { n: 3, label: 'Deadline',      sub: 'Planning et priorité' },
      { n: 4, label: 'Récap',         sub: 'Vérification et envoi' }
    ];
    const items = steps.map(s => {
      const cls = step === s.n ? 'active' : (step > s.n ? 'done' : '');
      const numContent = step > s.n ? Icons.check : s.n;
      return `<div class="wz-step-wrap"><div class="wz-step ${cls}">
        <div class="wz-step-num">${numContent}</div>
        <div class="wz-step-info">
          <div class="wz-step-name">${s.label}</div>
          <div class="wz-step-sub">${s.sub}</div>
        </div>
      </div></div>`;
    }).join('');
    return `<div class="wizard-progress"><div class="wizard-steps">${items}</div></div>`;
  },

  wizardNav(step) {
    const isFirst = step === 1;
    const isLast = step === 4;
    const nextLabels = { 1: 'Suivant : Le contexte →', 2: 'Suivant : Deadline →', 3: 'Suivant : Récap →' };
    const left = `<div class="wizard-nav-left">
      ${isFirst
        ? `<button class="btn-wz-draft" id="wz-cancel"><svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M13 2.5L3 12.5M3 7.5V12.5H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Enregistrer le brouillon</button>`
        : `<button class="btn-wz-prev" id="wz-prev" aria-label="Étape précédente">← Précédent</button>`}
    </div>`;
    const right = isLast ? '' : `<button class="btn-wz-next" id="wz-next">${nextLabels[step] || 'Continuer →'}</button>`;
    const saveIndicator = `<div class="wz-save-indicator" id="wz-save-indicator" aria-live="polite" aria-atomic="true"><svg viewBox="0 0 16 16" fill="none" width="12" height="12"><path d="M3.5 8.5l2.5 2.5L12.5 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Brouillon sauvegardé</div>`;
    return `<div class="wizard-nav">${left}${saveIndicator}${right}</div>`;
  },

  wizardStep1() {
    const fields = State.getChampsEtape1();
    const type = State.data.typeDemande;
    const marque = State.data.marque || '';

    const allTypes = [
      ...CONFIG.typesDemande,
      { id: 'affiche', icon: 'affiche', label: 'Affiche / Flyer',    sub: 'Support print ou digital à diffuser.' },
      { id: 'menu',    icon: 'menu',    label: 'Menu board',         sub: 'Carte, ardoise ou panneau menu.' }
    ];
    const typeCards = allTypes.map(t => `
      <button type="button" class="type-card ${type === t.id ? 'active' : ''}" data-type-select="${t.id}">
        <div class="type-card-icon">${Icons[t.icon] || Icons.autre}</div>
        <div class="type-card-title">${t.label}</div>
        ${t.sub ? `<div class="type-card-desc">${t.sub}</div>` : ''}
        <div class="type-card-check">${Icons.check}</div>
      </button>`).join('');

    let subContent = '';
    if (type === 'campagne') {
      subContent = `<div class="field"><label class="field-label">Genre de campagne</label>
        <div class="pill-group">${CONFIG.genresCampagne.map(g =>
          `<button type="button" class="pill ${State.data.genreCampagne === g.id ? 'active' : ''}" data-field="genreCampagne" data-value="${g.id}">${g.label}</button>`
        ).join('')}</div></div>`;
    } else if (type === 'packaging') {
      subContent = `<div class="field"><label class="field-label">Phase de production</label>
        <div class="pill-group">${CONFIG.phasesPackaging.map(p =>
          `<button type="button" class="pill ${State.data.phasePackaging === p.id ? 'active' : ''}" data-field="phasePackaging" data-value="${p.id}">${p.label}</button>`
        ).join('')}</div></div>`;
    } else if (type === 'vitrophanie') {
      subContent = `<div class="field"><label class="field-label">Type de vitrophanie</label>
        <div class="pill-group">${CONFIG.typesVitrophanie.map(v =>
          `<button type="button" class="pill ${State.data.typeVitrophanie === v.id ? 'active' : ''}" data-field="typeVitrophanie" data-value="${v.id}">${v.label}</button>`
        ).join('')}</div></div>`;
    }

    const fDept  = fields.find(f => f.id === 'dept');
    const fRef   = fields.find(f => f.id === 'ref');
    const fResto = fields.find(f => f.id === 'restaurant');
    const fAlt   = fields.find(f => f.id === 'deptAutrePrecision');

    const marqueList = (window.getAppMarques ? window.getAppMarques() : CONFIG.marques);
    const checkSvg = `<span class="marque-check"><svg viewBox="0 0 12 12" fill="none" width="10" height="10"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    const marqueHtml = `
      <div class="field" data-field-wrap="marque">
        <div class="field-label-row">
          <label class="field-label">Marque concernée<span class="req">*</span></label>
        </div>
        <div class="marque-pill-group">
          ${marqueList.map(m => `<button type="button" class="marque-pill ${marque === m.id ? 'active' : ''}" data-field="marque" data-value="${m.id}">${this.esc(m.label)}${checkSvg}</button>`).join('')}
        </div>
        <div class="marque-nom-wrap" id="marque-nom-wrap" style="${marque === 'autre' ? '' : 'display:none'}">
          <input type="text" class="marque-nom-input" id="marque-nom-input" data-field="marqueNom"
            placeholder="Nom de la marque…" autocomplete="off" required
            value="${this.esc(State.data.marqueNom || '')}">
        </div>
      </div>`;

    return `
      <div class="wz-step1-layout">
        <div class="wz-step1-col wz-card">
          <div class="wz-card-label">ÉTAPE 1 SUR 4</div>
          <div class="wz-card-title" style="font-size:22px;font-weight:700;color:var(--text);margin:6px 0 4px">Qui fait la demande ?</div>
          <div class="wz-card-sub" style="margin-bottom:24px">Identification du demandeur et de la marque concernée.</div>
          ${marqueHtml}
          <div class="field-row" style="margin-top:4px">
            ${this.field(fDept)}
            ${this.field(fRef)}
          </div>
          ${fResto ? this.field(fResto) : ''}
          ${fAlt   ? this.field(fAlt)   : ''}
        </div>
        <div class="wz-step1-col wz-card">
          <div class="wz-step1-type-header">
            <svg viewBox="0 0 20 20" fill="none" class="wz-step1-type-icon"><path d="M9 5H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-5M13 3l4 4-6 6H7v-4l6-6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            <div>
              <div class="wz-step1-type-title">Type de demande</div>
              <div class="wz-card-sub">Choisissez la catégorie qui correspond le mieux à votre besoin.</div>
            </div>
          </div>
          <div class="type-card-grid">${typeCards}</div>
          ${type ? `<div style="margin-top:16px">${subContent}</div>` : ''}
        </div>
      </div>`;
  },

  wizardStep2() {
    const type = State.data.typeDemande;
    const specificFields = type
      ? (CONFIG.champsEtape3[type] || []).filter(f => !f.showIf || f.showIf(State.data))
      : [];

    const specificHtml = specificFields.length ? `
      <div class="wz-card">
        <div class="wz-card-header">
          <div class="wz-card-label">Informations spécifiques</div>
          <div class="wz-card-title">Détails de la demande</div>
          <div class="wz-card-sub">Informations propres au type « ${CONFIG.typesDemande.find(t => t.id === type)?.label || type} » sélectionné.</div>
        </div>
        ${specificFields.map(f => this.field(f)).join('')}
      </div>` : '';

    return `
      <div class="wz-card">
        <div class="wz-card-header">
          <div class="wz-card-label">Étape 2 sur 4</div>
          <div class="wz-card-title">Le contexte du projet</div>
          <div class="wz-card-sub">Décrivez votre besoin avec le maximum de détails pour que le studio puisse commencer sans questions supplémentaires.</div>
        </div>
        ${CONFIG.champsEtape2.map(f => this.field(f)).join('')}
      </div>
      ${specificHtml}`;
  },

  wizardStep3() {
    const priorityPills = CONFIG.prioritesNiveau.map(p =>
      `<button type="button" class="pill ${p.id === 'urgent' ? 'urgent' : ''} ${State.data.priorite === p.id ? 'active' : ''}" data-field="priorite" data-value="${p.id}">${p.label}</button>`
    ).join('');

    const urgenceField = this.field({
      id: 'raisonUrgence', label: 'Pourquoi cette demande est-elle urgente ?',
      type: 'text', gravity: 'blocking',
      placeholder: 'Ex : Lancement avancé par la direction, campagne presse imminente…'
    });

    const supportsHtml = State.data.typeDemande === 'campagne' ? `
      <div class="wz-card">
        <div class="wz-card-header">
          <div class="wz-card-label">Supports</div>
          <div class="wz-card-title">Ce qu'il faut produire</div>
        </div>
        ${this.supportsBlock()}
      </div>` : '';

    return `
      <div class="wz-card">
        <div class="wz-card-header">
          <div class="wz-card-label">Étape 3 sur 4</div>
          <div class="wz-card-title">Calendrier & priorité</div>
          <div class="wz-card-sub">Indiquez vos contraintes de temps pour que le studio puisse planifier la production.</div>
        </div>
        <div class="field-row">
          ${this.field(CONFIG.champsEtape4Deadlines[0])}
          ${this.field(CONFIG.champsEtape4Deadlines[1])}
        </div>
        ${this.field(CONFIG.champsEtape4Deadlines[2])}
        <div class="field" style="margin-top:4px">
          <label class="field-label">Priorité<span class="req">*</span>${this.tooltip('Normal = délai raisonnable · Prioritaire = à traiter avant d\'autres · Urgent = délai très court, à justifier')}</label>
          <div class="pill-group">${priorityPills}</div>
        </div>
        <div class="cond-block ${State.data.priorite === 'urgent' ? 'visible' : 'hidden'}">
          ${urgenceField}
        </div>
      </div>
      ${supportsHtml}`;
  },

  wizardStep4() {
    const r = Recap.build();
    const globalConfirmed = !!State.data.globalConfirmed;
    const ready = State.isReadyToSubmit();

    return `
      <div class="wz-card">
        <div class="wz-card-header">
          <div class="wz-card-label">Étape 4 sur 4 — Récapitulatif</div>
          <div class="wz-card-title">Vérification finale</div>
          <div class="wz-card-sub">Relisez votre brief avant de l'envoyer au studio.</div>
        </div>
        <div class="recap-doc">${Recap.toHtml(r)}</div>
      </div>
      <div class="wz-card">
        <div class="reserves-wrap">
          <label class="field-label" for="field-reserves-wz">Informations à confirmer / réserves <span class="field-label-optional">(facultatif)</span>${this.tooltip('Informations encore incertaines : prix à confirmer, date provisoire, texte non validé, gabarit en attente, mesure à vérifier…')}</label>
          <p class="field-hint">Prix encore à confirmer, date provisoire, texte non validé, gabarit en attente, mesure à vérifier…</p>
          <textarea id="field-reserves-wz" data-field="reserves" placeholder="Indiquez ici toute information encore incertaine ou à valider avant l'exécution." rows="3">${this.esc(State.data.reserves || '')}</textarea>
        </div>
        <label class="global-confirm-label ${globalConfirmed ? 'is-confirmed' : ''}" style="margin-top:20px">
          <input type="checkbox" id="chk-global-confirm" ${globalConfirmed ? 'checked' : ''}>
          <span>Je confirme que les informations obligatoires fournies sont correctes et exploitables par le studio graphique.</span>
        </label>
      </div>
      <div class="wz-submit-block">
        <button class="btn-wz-submit${ready && globalConfirmed ? ' ready' : ''}" id="btn-wz-submit"${ready && globalConfirmed ? '' : ' disabled'}>
          Soumettre le brief
        </button>
        <p class="wz-submit-note" id="wz-submit-note">${
          !ready ? 'Complétez les champs requis pour soumettre' :
          !globalConfirmed ? 'Cochez la case de confirmation pour soumettre' :
          'Brief prêt à envoyer ✓'
        }</p>
      </div>`;
  },

  aiAssistBar() {
    return `
      <div class="ai-bar" id="ai-bar" data-open="false">
        <div class="ai-bar-left">
          <div class="ai-bar-icon">
            <svg viewBox="0 0 20 20" fill="none" width="20" height="20"><path d="M10 2l1.5 4.5H16l-3.7 2.7 1.4 4.3L10 11l-3.7 2.5 1.4-4.3L4 6.5h4.5L10 2z" fill="currentColor"/></svg>
          </div>
          <div class="ai-bar-meta">
            <div class="ai-bar-label">Remplissage IA</div>
            <div class="ai-bar-sub">Décrivez votre besoin, l'IA remplit le formulaire.</div>
          </div>
          <button class="ai-bar-toggle" id="ai-bar-toggle" onclick="toggleAiBar()" aria-expanded="false" aria-controls="ai-bar-body" aria-label="Assistance IA">
            Déplier <i class="ti ti-chevron-down ai-bar-toggle-chevron"></i>
          </button>
        </div>
        <div class="ai-bar-body" id="ai-bar-body">
          <input type="text" class="ai-bar-input" id="ai-prompt" placeholder="Ex : Post Instagram lancement B&W Smash Burger, 12,90€, mi-juin, urgent…" autocomplete="off">
          <button class="ai-bar-btn" id="ai-fill-btn" title="Remplir le formulaire avec l'IA">
            <span class="ai-bar-btn-text">✦ Remplir avec l'IA</span>
          </button>
        </div>
      </div>`;
  },

  renderWizardStep(step) {
    const aiBar = step === 1 ? this.aiAssistBar() : '';
    switch (step) {
      case 1: return aiBar + this.wizardStep1();
      case 2: return this.wizardStep2();
      case 3: return this.wizardStep3();
      case 4: return this.wizardStep4();
      default: return aiBar + this.wizardStep1();
    }
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
            ${issues.blocking.map(i => `<div class="sb-issue-item blocking-item" data-goto-field="${i.field.id}">${i.field.label}</div>`).join('')}
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
      else if (issues.blocking.length === 0) { note.textContent = 'Cochez la confirmation en section 5 pour soumettre'; note.classList.add('is-blocking'); }
      else { note.textContent = `${issues.blocking.length} champ${issues.blocking.length > 1 ? 's' : ''} bloquant${issues.blocking.length > 1 ? 's' : ''} à compléter`; note.classList.add('is-blocking'); }
    }
    const mobileIssues = document.getElementById('mobile-submit-issues');
    if (mobileIssues) {
      mobileIssues.textContent = ready ? '' : `${issues.blocking.length} bloquant${issues.blocking.length > 1 ? 's' : ''} restant${issues.blocking.length > 1 ? 's' : ''}`;
    }
  }
};
