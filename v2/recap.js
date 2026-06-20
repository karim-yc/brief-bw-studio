/* ════════════════════════════════════════════════════════════
   RECAP.JS — SOURCE DE VÉRITÉ UNIQUE
   Génère un objet structuré complet du brief.
   Tous les canaux (carte récap interface, PDF, mail, lien copié)
   doivent consommer EXACTEMENT cet objet, sans dupliquer la logique.
   ════════════════════════════════════════════════════════════ */

const Recap = {

  /* Construit l'objet récap complet à partir de State.data */
  build() {
    const d = State.data;
    // Sécurité : briefs archivés plus anciens peuvent manquer certains champs
    d.supportsSelected = d.supportsSelected || [];
    d.formats = d.formats || {};
    d.volumes = d.volumes || {};
    d.supportLivrables = d.supportLivrables || {};
    d.confirmations = d.confirmations || {};
    d.packagingProducts = d.packagingProducts || [];
    const issues = State.getAllIssues();

    const typeInfo = CONFIG.typesDemande.find(t => t.id === d.typeDemande);
    const genreInfo = d.genreCampagne ? CONFIG.genresCampagne.find(g => g.id === d.genreCampagne) : null;
    const phaseInfo = d.phasePackaging ? CONFIG.phasesPackaging.find(p => p.id === d.phasePackaging) : null;
    const vtypeInfo = d.typeVitrophanie ? CONFIG.typesVitrophanie.find(v => v.id === d.typeVitrophanie) : null;
    // Les supports/déclinaisons/livrables n'existent que pour Campagne Marketing.
    // Packaging a son propre tableau de produits structuré (packagingProducts).

    // ── Supports détaillés (format, déclinaisons, livrable) — Campagne uniquement ──
    const supports = d.supportsSelected.map(sid => {
      const sup = CONFIG.supports.find(s => s.id === sid);
      const livrableId = d.supportLivrables?.[sid];
      const livrableInfo = livrableId ? CONFIG.livrables.find(l => l.id === livrableId) : null;
      return {
        id: sid,
        label: sup ? sup.label : sid,
        format: d.formats[sid] || (sup ? sup.defaultFormat : ''),
        volume: d.volumes[sid] || '',
        volumeLabel: 'Déclinaisons',
        livrable: livrableInfo ? livrableInfo.label : ''
      };
    });
    const totalVolume = Object.values(d.volumes).reduce((a, b) => a + (parseInt(b) || 0), 0);

    // ── Produits packaging (tableau structuré) ───────────────────
    const packagingProducts = (d.packagingProducts || []).filter(p => p.nom && p.nom.trim());

    // ── Champs validés / à confirmer / manquants ─────────────────
    const validated = [];
    const toConfirm = [];
    // Champs déjà affichés ailleurs dans le récap (demandeur, contexte, type, priorité)
    // → exclus de la liste "Infos validées" pour éviter la redondance
    const alreadyShownElsewhere = ['dept', 'ref', 'restaurant', 'deptAutrePrecision', 'description', 'priorite', 'raisonUrgence'];
    issues.complete.forEach(f => {
      if (f.type === 'virtual') return;
      if (alreadyShownElsewhere.includes(f.id)) return;
      const val = d[f.id];
      if (val === undefined || val === '' || (Array.isArray(val) && !val.length)) return;
      const entry = { label: f.label, value: this.formatFieldValue(f, val) };
      validated.push(entry);
    });
    issues.blocking.concat(issues.recommended).forEach(i => {
      if (i.reason === 'a_confirmer') {
        toConfirm.push({ label: i.field.label, value: this.formatFieldValue(i.field, d[i.field.id]) });
      }
    });

    // ── Fichiers / liens Drive (tous les champs drive*) ───────────
    const driveLinks = [];
    ['drive', 'driveP', 'driveV', 'driveA'].forEach(key => {
      if (d[key] && d[key].trim()) driveLinks.push(d[key].trim());
    });

    // ── Bloquants / recommandés lisibles ──────────────────────────
    const blockingList = issues.blocking.map(i => i.field.label + (i.reason === 'a_confirmer' ? ' (à confirmer)' : ''));
    const recommendedList = issues.recommended.map(i => i.field.label + (i.reason === 'a_confirmer' ? ' (à confirmer)' : ''));

    return {
      briefId: d.briefId || '(généré à la soumission)',
      submittedAt: d.submittedAt || null,

      demandeur: d.ref || '—',
      departement: d.dept || '—',
      restaurant: d.restaurant || '',

      typeDemande: typeInfo ? typeInfo.label : '—',
      typeDemandeId: d.typeDemande || '',
      genreCampagne: genreInfo ? genreInfo.label : '',
      phasePackaging: phaseInfo ? phaseInfo.label : '',
      typeVitrophanie: vtypeInfo ? vtypeInfo.label : '',

      contexte: d.description || '—',

      supports,
      totalVolume,
      packagingProducts,

      validated,
      toConfirm,
      driveLinks,

      dateLancement: d.dateLancement || '—',
      dateValidation: d.dateValidation || '—',
      dateRetourSimul: d.dateRetourSimul || '',

      priorite: d.priorite || '—',
      raisonUrgence: d.priorite === 'urgent' ? (d.raisonUrgence || 'raison non précisée') : '',

      blocking: blockingList,
      recommended: recommendedList,
      isReadyToSubmit: issues.blocking.length === 0
    };
  },

  formatFieldValue(field, val) {
    if (field.type === 'pills' && field.options) {
      const opt = field.options.find(o => o.id === val);
      return opt ? opt.label : val;
    }
    return val;
  },

  /* ── Rendu HTML pour la carte récap dans l'interface ──────────── */
  toHtml(r) {
    // "Supports à produire" n'a de sens que pour Campagne Marketing.
    // Pour Packaging/Vitrophanie/Autre, cette section est masquée plutôt
    // que d'afficher un "Aucun support sélectionné" trompeur et hors sujet.
    const showSupportsSection = r.typeDemandeId === 'campagne';
    const supportsLines = r.supports.length
      ? '<ul style="margin-left:18px">' + r.supports.map(s =>
          `<li>${s.label} — ${s.format || 'format non précisé'} · ${s.volume || '0'} ${s.volumeLabel.toLowerCase()}${s.livrable ? ' · ' + s.livrable : ''}</li>`
        ).join('') + '</ul>'
      : 'Aucun support sélectionné';

    const packagingLines = r.packagingProducts.length
      ? '<ul style="margin-left:18px">' + r.packagingProducts.map(p =>
          `<li>${p.nom}${p.format ? ' — ' + p.format : ''}${p.qte ? ' × ' + p.qte : ''}</li>`
        ).join('') + '</ul>'
      : '';

    const validatedLines = r.validated.length
      ? r.validated.map(v => `· ${v.label} : ${v.value}`).join('<br>')
      : 'Aucune';

    const toConfirmLines = r.toConfirm.length
      ? r.toConfirm.map(v => `· ${v.label} : ${v.value}`).join('<br>')
      : 'Aucune';

    const driveLines = r.driveLinks.length
      ? r.driveLinks.map(l => `· ${l}`).join('<br>')
      : 'Aucun lien fourni';

    return `
<strong style="color:var(--text)">BRIEF ${r.briefId}</strong><br>
Soumis par : ${r.demandeur} — ${r.departement}${r.restaurant ? ' · ' + r.restaurant : ''}<br><br>

<strong style="color:var(--text)">CONTEXTE</strong><br>
${r.contexte}<br><br>

<strong style="color:var(--text)">TYPE DE DEMANDE</strong><br>
${r.typeDemande}${r.genreCampagne ? ' — ' + r.genreCampagne : ''}${r.phasePackaging ? ' — ' + r.phasePackaging : ''}${r.typeVitrophanie ? ' — ' + r.typeVitrophanie : ''}<br>
Priorité : ${r.priorite}${r.raisonUrgence ? ' — ' + r.raisonUrgence : ''}<br><br>

${showSupportsSection ? `<strong style="color:var(--text)">SUPPORTS À PRODUIRE</strong><br>
${supportsLines}
${r.totalVolume ? 'Total : ' + r.totalVolume + ' déclinaisons visuelles<br>' : ''}
<br>` : ''}
${packagingLines ? '<strong style="color:var(--text)">PRODUITS PACKAGING</strong><br>' + packagingLines + '<br><br>' : ''}

<strong style="color:var(--success)">INFOS VALIDÉES</strong><br>
${validatedLines}<br><br>

<strong style="color:var(--warning)">INFOS À CONFIRMER</strong> <span style="font-size:10.5px;font-weight:400;color:var(--text-tertiary)">— fournies mais pas encore validées</span><br>
${toConfirmLines}<br><br>

<strong style="color:var(--text)">FICHIERS / LIENS</strong><br>
${driveLines}<br><br>

<strong style="color:var(--text)">DEADLINES</strong><br>
Lancement : ${r.dateLancement} · Validation infos : ${r.dateValidation}${r.dateRetourSimul ? ' · Retour simulation : ' + r.dateRetourSimul : ''}<br><br>

<strong style="color:var(--danger)">POINTS BLOQUANTS (${r.blocking.length})</strong> <span style="font-size:10.5px;font-weight:400;color:var(--text-tertiary)">— empêchent la soumission</span><br>
${r.blocking.length ? r.blocking.map(b => '· ' + b).join('<br>') : 'Aucun ✓'}<br><br>

<strong style="color:var(--warning)">RECOMMANDÉS NON FOURNIS (${r.recommended.length})</strong> <span style="font-size:10.5px;font-weight:400;color:var(--text-tertiary)">— utiles mais non bloquants</span><br>
${r.recommended.length ? r.recommended.map(b => '· ' + b).join('<br>') : 'Aucun ✓'}`;
  },

  /* ── Rendu texte brut pour le mail ─────────────────────────────── */
  toPlainText(r) {
    const lines = [];
    lines.push(`BRIEF ${r.briefId}`);
    lines.push(`Soumis par : ${r.demandeur} — ${r.departement}${r.restaurant ? ' · ' + r.restaurant : ''}`);
    lines.push('');
    lines.push('CONTEXTE');
    lines.push(r.contexte);
    lines.push('');
    lines.push('TYPE DE DEMANDE');
    lines.push(`${r.typeDemande}${r.genreCampagne ? ' — ' + r.genreCampagne : ''}${r.phasePackaging ? ' — ' + r.phasePackaging : ''}${r.typeVitrophanie ? ' — ' + r.typeVitrophanie : ''}`);
    lines.push(`Priorité : ${r.priorite}${r.raisonUrgence ? ' — ' + r.raisonUrgence : ''}`);
    // "Supports à produire" uniquement pertinent pour Campagne Marketing
    if (r.typeDemandeId === 'campagne') {
      lines.push('');
      lines.push('SUPPORTS À PRODUIRE');
      if (r.supports.length) {
        r.supports.forEach(s => lines.push(`- ${s.label} — ${s.format || 'format non précisé'} · ${s.volume || '0'} ${s.volumeLabel.toLowerCase()}${s.livrable ? ' · ' + s.livrable : ''}`));
        if (r.totalVolume) lines.push(`Total : ${r.totalVolume} déclinaisons visuelles`);
      } else {
        lines.push('Aucun support sélectionné');
      }
    }
    if (r.packagingProducts.length) {
      lines.push('');
      lines.push('PRODUITS PACKAGING');
      r.packagingProducts.forEach(p => lines.push(`- ${p.nom}${p.format ? ' — ' + p.format : ''}${p.qte ? ' × ' + p.qte : ''}`));
    }
    lines.push('');
    lines.push('INFOS VALIDÉES');
    lines.push(r.validated.length ? r.validated.map(v => `- ${v.label} : ${v.value}`).join('\n') : 'Aucune');
    lines.push('');
    lines.push('INFOS À CONFIRMER (fournies mais pas encore validées)');
    lines.push(r.toConfirm.length ? r.toConfirm.map(v => `- ${v.label} : ${v.value}`).join('\n') : 'Aucune');
    lines.push('');
    lines.push('FICHIERS / LIENS');
    lines.push(r.driveLinks.length ? r.driveLinks.map(l => `- ${l}`).join('\n') : 'Aucun lien fourni');
    lines.push('');
    lines.push('DEADLINES');
    lines.push(`Lancement : ${r.dateLancement} · Validation infos : ${r.dateValidation}${r.dateRetourSimul ? ' · Retour simulation : ' + r.dateRetourSimul : ''}`);
    lines.push('');
    lines.push(`POINTS BLOQUANTS — empêchent la soumission (${r.blocking.length})`);
    lines.push(r.blocking.length ? r.blocking.map(b => `- ${b}`).join('\n') : 'Aucun');
    lines.push('');
    lines.push(`RECOMMANDÉS NON FOURNIS — utiles mais non bloquants (${r.recommended.length})`);
    lines.push(r.recommended.length ? r.recommended.map(b => `- ${b}`).join('\n') : 'Aucun');
    return lines.join('\n');
  }
};
