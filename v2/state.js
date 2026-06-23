/* ════════════════════════════════════════════════════════════
   STATE.JS — Gestion centralisée de l'état du formulaire
   ════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'bw_brief_v2_draft';
const HISTORY_KEY = 'bw_brief_v2_history';

const State = {

  /* ── Données brutes du formulaire ─────────────────────────── */
  data: {
    dept: '', ref: '', restaurant: '', deptAutrePrecision: '',
    typeDemande: '', description: '',
    genreCampagne: '', phasePackaging: '', typeVitrophanie: '',
    // Champs dynamiques étape 3 — remplis par clé selon config
    accroche: '', nomProduit: '', prix: '', texteExact: '', mentions: '', shooting: '', drive: '',
    texteExactPack: '', logoVersion: '', formatPack: '', matierePack: '', fournisseur: '', gabaritDispo: '', declinaisonsPack: '', driveP: '',
    adresse: '', mesures: '', photosDevanture: '', planVectoriel: '', contraintesPose: '', matiereVitro: '', driveV: '',
    descriptionDetaillee: '', driveA: '',
    // Étape 4
    supportsSelected: [],
    formats: {},     // { supportId: "1080x1080" }
    supportLivrables: {}, // { supportId: 'png' | 'pdf-print' | ... }
    livrable: '',
    volumes: {},      // { supportId: nombre }
    dateLancement: '', dateValidation: '', dateRetourSimul: '',
    priorite: '', raisonUrgence: '',
    reserves: '',      // Infos à confirmer / réserves (champ libre)
    globalConfirmed: false, // Confirmation globale avant soumission
    packagingProducts: [], // [{ nom, format, qte }] — tableau structuré packaging
    // Meta
    briefId: '',
    submittedAt: ''
  },

  openSections: { 1: true, 2: false, 3: false, 4: false, 5: false },

  /* ── Génération ID brief ──────────────────────────────────── */
  genBriefId() {
    // Format : BW-YYYYMMDD-HHMMSS-XXXX — totalement unique, lisible, traçable
    const now  = new Date();
    const pad  = n => String(n).padStart(2,'0');
    const date = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const rand = String(Math.floor(1000 + Math.random() * 9000));
    return `BW-${date}-${time}-${rand}`;
  },

  /* ── Sauvegarde locale (debounced depuis app.js) ───────────── */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      console.warn('Sauvegarde impossible', e);
      return false;
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      Object.assign(this.data, parsed);
      return true;
    } catch (e) {
      return false;
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  },

  saveToHistory() {
    try {
      const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      hist.unshift({ ...this.data, briefId: this.data.briefId || this.genBriefId(), submittedAt: new Date().toISOString() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, 100)));
      return true;
    } catch (e) {
      return false;
    }
  },

  getHistory() {
    try {
      const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      // Tri explicite plus récent → plus ancien, indépendant de l'ordre de stockage
      return hist.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    } catch (e) { return []; }
  },

  deleteFromHistory(briefId) {
    try {
      const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      const filtered = hist.filter(b => b.briefId !== briefId);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
      return true;
    } catch (e) { return false; }
  },

  clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
      localStorage.removeItem('bw_brief_v2_statuses');
      return true;
    } catch (e) { return false; }
  },

  getBriefStatus(briefId) {
    try {
      const statuses = JSON.parse(localStorage.getItem('bw_brief_v2_statuses') || '{}');
      return statuses[briefId] || 'soumis';
    } catch (e) { return 'soumis'; }
  },

  setBriefStatus(briefId, status) {
    try {
      const statuses = JSON.parse(localStorage.getItem('bw_brief_v2_statuses') || '{}');
      statuses[briefId] = status;
      localStorage.setItem('bw_brief_v2_statuses', JSON.stringify(statuses));
    } catch (e) {}
  },

  /* ── Récupère les champs actifs de l'étape 3 selon le type ─── */
  getChampsEtape3() {
    const type = this.data.typeDemande;
    if (!type || !CONFIG.champsEtape3[type]) return [];
    return CONFIG.champsEtape3[type].filter(f => !f.showIf || f.showIf(this.data));
  },

  getChampsEtape1() {
    return CONFIG.champsEtape1.filter(f => !f.showIf || f.showIf(this.data));
  },

  /* ── Calcul de complétude d'un champ ───────────────────────── */
  isFieldFilled(field) {
    if (field.type === 'packtable') {
      return this.data.packagingProducts.some(p => p.nom && p.nom.trim());
    }
    const val = this.data[field.id];
    if (field.type === 'pills') return !!val;
    if (Array.isArray(val)) return val.length > 0;
    return val !== undefined && val !== null && String(val).trim() !== '';
  },

  /* ── Calcul du statut d'une liste de champs ────────────────── */
  computeFieldsStatus(fields) {
    const blocking = [];
    const recommended = [];
    const complete = [];

    fields.forEach(f => {
      const filled = this.isFieldFilled(f);
      if (f.gravity === 'blocking') {
        if (!filled) blocking.push({ field: f, reason: 'manquant' });
        else complete.push(f);
      } else if (f.gravity === 'recommended') {
        if (!filled) recommended.push({ field: f, reason: 'manquant' });
        else complete.push(f);
      } else {
        if (filled) complete.push(f);
      }
    });

    return { blocking, recommended, complete };
  },

  /* ── Statut global par section ─────────────────────────────── */
  getSectionStatus(sectionKey) {
    let fields = [];
    switch (sectionKey) {
      case 'qui': fields = this.getChampsEtape1(); break;
      case 'quoi':
        fields = CONFIG.champsEtape2.slice();
        // typeDemande est aussi requis
        if (!this.data.typeDemande) return { status: 'empty', blocking: 1, total: fields.length + 1 };
        // Pour Campagne Marketing, "au moins un support" fait partie de cette section
        if (this.data.typeDemande === 'campagne') fields = fields.concat(this.getSupportsFields());
        break;
      case 'infos':
        // Pas de type sélectionné → section non applicable, statut neutre (vide, pas complet)
        if (!this.data.typeDemande) return { status: 'empty', blocking: 0, total: 0, filled: 0 };
        fields = this.getChampsEtape3();
        break;
      case 'supports': fields = this.getDeadlinesFields(); break;
      default: return { status: 'empty', blocking: 0, total: 0 };
    }
    if (!fields.length) return { status: 'complete', blocking: 0, total: 0 };

    const { blocking, recommended, complete } = this.computeFieldsStatus(fields);
    const total = fields.length;
    const filledCount = complete.length;

    let status = 'empty';
    if (blocking.length > 0) status = filledCount > 0 ? 'partial' : 'empty';
    else if (filledCount === total) status = 'complete';
    else if (filledCount > 0) status = 'partial';

    return { status, blocking: blocking.length, recommended: recommended.length, total, filled: filledCount };
  },

  /* ── Contrainte "au moins un support" — appartient désormais à la
     section 2 (Que faut-il créer), uniquement pour Campagne Marketing ── */
  getSupportsFields() {
    return [{
      id: '__supports', label: 'Au moins un support sélectionné', type: 'virtual', gravity: 'blocking',
      virtualCheck: () => this.data.supportsSelected.length > 0
    }];
  },

  /* ── Champs deadlines + priorité — section 4 uniquement ── */
  getDeadlinesFields() {
    const fields = [...CONFIG.champsEtape4Deadlines];
    fields.push({
      id: 'priorite', label: 'Niveau de priorité', type: 'pills', gravity: 'blocking'
    });
    if (this.data.priorite === 'urgent') {
      fields.push({
        id: 'raisonUrgence', label: 'Raison de l\'urgence', type: 'text', gravity: 'blocking'
      });
    }
    return fields;
  },

  isFieldFilledOverride(field) {
    if (field.type === 'virtual') return field.virtualCheck();
    return this.isFieldFilled(field);
  },

  /* ── Agrégation globale tous champs confondus (pour sidebar) ── */
  getAllIssues() {
    const allFields = [
      ...this.getChampsEtape1(),
      ...(this.data.typeDemande ? [] : [{ id: '__type', label: 'Type de demande', gravity: 'blocking', type: 'virtual', virtualCheck: () => !!this.data.typeDemande }]),
      ...CONFIG.champsEtape2,
      ...(this.data.typeDemande === 'campagne' ? this.getSupportsFields() : []),
      ...this.getChampsEtape3(),
      ...this.getDeadlinesFields()
    ];

    const blocking = [];
    const recommended = [];
    const complete = [];

    allFields.forEach(f => {
      const filled = f.type === 'virtual' ? f.virtualCheck() : this.isFieldFilled(f);
      if (f.gravity === 'blocking') {
        if (!filled) blocking.push({ field: f, reason: 'manquant' });
        else complete.push(f);
      } else if (f.gravity === 'recommended') {
        if (!filled) recommended.push({ field: f, reason: 'manquant' });
        else complete.push(f);
      } else if (filled) {
        complete.push(f);
      }
    });

    return { blocking, recommended, complete, total: allFields.length };
  },

  isReadyToSubmit() {
    return this.getAllIssues().blocking.length === 0 && !!this.data.globalConfirmed;
  },

  getOverallProgress() {
    const sections = ['qui', 'quoi', 'infos', 'supports'];
    let filled = 0;
    sections.forEach(s => {
      const st = this.getSectionStatus(s);
      if (st.status === 'complete') filled += 1;
      else if (st.status === 'partial') filled += 0.5;
    });
    return { filled, total: sections.length + 1 }; // +1 pour récap
  }
};
