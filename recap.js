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

    // ── Réserves libres (champ libre facultatif) ─────────────────
    const reserves = d.reserves || '';

    // ── Fichiers / liens Drive (tous les champs drive*) ───────────
    const driveLinks = [];
    ['drive', 'driveP', 'driveV', 'driveA'].forEach(key => {
      if (d[key] && d[key].trim()) driveLinks.push(d[key].trim());
    });

    // ── Bloquants / recommandés lisibles ──────────────────────────
    const blockingList = issues.blocking.map(i => i.field.label);
    const recommendedList = issues.recommended.map(i => i.field.label);

    return {
      briefId: d.briefId || '(généré à la soumission)',
      submittedAt: d.submittedAt || null,

      marque: (() => {
        if (d.marque === 'autre') return d.marqueNom || 'Autre marque';
        const m = CONFIG.marques.find(x => x.id === d.marque);
        return m ? m.label : (d.marque || '');
      })(),

      demandeur: d.ref || '—',
      departement: d.dept || '—',
      restaurant: d.restaurant || '',
      emailRestaurant: d.emailRestaurant || '',

      typeDemande: typeInfo ? typeInfo.label : '—',
      typeDemandeId: d.typeDemande || '',
      genreCampagne: genreInfo ? genreInfo.label : '',
      phasePackaging: phaseInfo ? phaseInfo.label : '',
      typeVitrophanie: vtypeInfo ? vtypeInfo.label : '',

      contexte: d.description || '—',

      supports,
      totalVolume,
      packagingProducts,

      reserves,
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

    const driveLines = r.driveLinks.length
      ? r.driveLinks.map(l => `· ${l}`).join('<br>')
      : 'Aucun lien fourni';

    const block = (title, body, color) => `<div class="recap-block"><div class="recap-block-title" style="color:${color || 'var(--text)'}">${title}</div><div class="recap-block-body">${body}</div></div>`;

    let html = `<div class="recap-block recap-block-header">
      <div class="recap-brief-id">BRIEF ${r.briefId}</div>
      <div class="recap-submitter">Soumis par ${r.demandeur} — ${r.departement}${r.restaurant ? ' · ' + r.restaurant : ''}</div>
      ${r.marque ? '<div class="recap-marque" style="font-size:11px;color:var(--text-tertiary);margin-top:2px">Marque : ' + r.marque + '</div>' : ''}
    </div>`;

    if (r.restaurant) html += block('Restaurant concerné', r.restaurant);
    html += block('Contexte', r.contexte);
    html += block('Type de demande',
      `${r.typeDemande}${r.genreCampagne ? ' — ' + r.genreCampagne : ''}${r.phasePackaging ? ' — ' + r.phasePackaging : ''}${r.typeVitrophanie ? ' — ' + r.typeVitrophanie : ''}<br>Priorité : ${r.priorite}${r.raisonUrgence ? ' — ' + r.raisonUrgence : ''}`);

    if (showSupportsSection) {
      html += block('Supports à produire',
        supportsLines + (r.totalVolume ? `<div style="margin-top:6px;font-weight:600">Total : ${r.totalVolume} déclinaisons visuelles</div>` : ''));
    }
    if (packagingLines) {
      html += block('Produits packaging', packagingLines);
    }

    if (r.reserves) html += block('Infos à confirmer / réserves', r.reserves.replace(/\n/g, '<br>'), 'var(--warning)');
    html += block('Fichiers / liens', driveLines);
    html += block('Deadlines',
      `Lancement : ${r.dateLancement}<br>Validation infos : ${r.dateValidation}${r.dateRetourSimul ? '<br>Retour simulation : ' + r.dateRetourSimul : ''}`);
    html += block(`Points bloquants (${r.blocking.length}) <span style="font-size:10px;font-weight:400;color:var(--text-tertiary)">— empêchent la soumission</span>`,
      r.blocking.length ? r.blocking.map(b => '· ' + b).join('<br>') : 'Aucun ✓', 'var(--danger)');
    html += block(`Recommandés non fournis (${r.recommended.length}) <span style="font-size:10px;font-weight:400;color:var(--text-tertiary)">— utiles mais non bloquants</span>`,
      r.recommended.length ? r.recommended.map(b => '· ' + b).join('<br>') : 'Aucun ✓', 'var(--warning)');

    return html;
  },

  /* ── Rendu texte brut pour le mail ─────────────────────────────── */
  toPlainText(r) {
    const lines = [];
    lines.push(`BRIEF ${r.briefId}`);
    lines.push(`Soumis par : ${r.demandeur} — ${r.departement}${r.restaurant ? ' · ' + r.restaurant : ''}`);
    if (r.marque) lines.push(`Marque : ${r.marque}`);
    lines.push('');
    if (r.restaurant) { lines.push('RESTAURANT CONCERNÉ'); lines.push(r.restaurant); lines.push(''); }
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
    if (r.reserves) {
      lines.push('INFOS À CONFIRMER / RÉSERVES');
      lines.push(r.reserves);
      lines.push('');
    }
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
  },

  /* ── Rendu HTML autonome pour le mail studio (notification interne) ─
     Les clients mail (Gmail, Outlook) ignorent les <style> externes
     et les variables CSS — tout doit être en styles inline, sans
     dépendre de variables --accent etc. */
  toMailHtml(r) {
    const c = {
      text: '#1d1d1f', secondary: '#5a5a5f', tertiary: '#a3a3a6',
      bg: '#f5f5f5', surface: '#fff', border: '#e8e8ea',
      accent: '#1d1d1f', accentText: '#fff',
      yellow: '#DFFF00', yellowText: '#1d1d1f',
      warning: '#b8650a', danger: '#d63a2f',
    };

    const priorityBadge = r.priorite === 'urgent'
      ? `<span style="display:inline-block;background:${c.danger};color:#fff;font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-left:8px">URGENT</span>`
      : r.priorite === 'prioritaire' ? `<span style="display:inline-block;background:#e8e8ea;color:#5a5a5f;font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-left:8px">PRIORITAIRE</span>` : '';

    const block = (title, body, titleColor) => `
      <tr><td style="padding:14px 20px;border-bottom:1px solid ${c.border}">
        <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:${titleColor || c.tertiary};margin-bottom:5px">${title}</div>
        <div style="font-size:13.5px;line-height:1.7;color:${c.secondary}">${body}</div>
      </td></tr>`;

    const pill = txt => `<span style="display:inline-block;background:#f0f0f2;color:#5a5a5f;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;margin-right:4px">${txt}</span>`;

    const supportsLines = r.supports.length
      ? r.supports.map(s => `• ${s.label} — ${s.format || 'format non précisé'} · ${s.volume || '0'} ${s.volumeLabel.toLowerCase()}${s.livrable ? ' · ' + s.livrable : ''}`).join('<br>')
      : 'Aucun support sélectionné';
    const packagingLines = r.packagingProducts.length
      ? r.packagingProducts.map(p => `• ${p.nom}${p.format ? ' — ' + p.format : ''}${p.qte ? ' × ' + p.qte : ''}`).join('<br>')
      : '';
    const driveLines = r.driveLinks.length
      ? r.driveLinks.map(l => `<a href="${l}" style="color:#1d1d1f;word-break:break-all">${l}</a>`).join('<br>')
      : 'Aucun lien fourni';
    const showSupports = r.typeDemandeId === 'campagne';

    const typeLabel = `${r.typeDemande}${r.genreCampagne ? ' — ' + r.genreCampagne : ''}${r.phasePackaging ? ' — ' + r.phasePackaging : ''}${r.typeVitrophanie ? ' — ' + r.typeVitrophanie : ''}`;

    let rows = '';
    rows += `<tr><td style="padding:14px 20px;border-bottom:1px solid ${c.border};background:#fafafa">
      <table cellpadding="0" cellspacing="0" style="width:100%"><tr>
        <td><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:${c.tertiary};margin-bottom:3px">Type de demande</div>
        <div style="font-size:14px;font-weight:700;color:${c.text}">${typeLabel}${priorityBadge}</div>
        ${r.raisonUrgence ? '<div style="font-size:12px;color:' + c.danger + ';margin-top:3px">' + r.raisonUrgence + '</div>' : ''}</td>
        <td style="text-align:right;vertical-align:top;padding-left:12px">
          <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.6px;color:${c.tertiary};margin-bottom:3px">Lancement</div>
          <div style="font-size:13px;font-weight:600;color:${c.text}">${r.dateLancement}</div>
          <div style="font-size:10.5px;color:${c.tertiary};margin-top:4px">Validation : ${r.dateValidation}</div>
        </td>
      </tr></table>
    </td></tr>`;

    if (r.restaurant) rows += block('Restaurant concerné', r.restaurant + (r.emailRestaurant ? ` &nbsp;·&nbsp; <a href="mailto:${r.emailRestaurant}" style="color:#1d1d1f">${r.emailRestaurant}</a>` : ''));
    rows += block('Contexte du brief', r.contexte.replace(/\n/g, '<br>'));
    if (showSupports) rows += block('Supports à produire', supportsLines + (r.totalVolume ? `<br><strong style="color:${c.text}">Total : ${r.totalVolume} déclinaisons</strong>` : ''));
    if (packagingLines) rows += block('Produits packaging', packagingLines);
    if (r.reserves) rows += block('⚠ Infos à confirmer / réserves', r.reserves.replace(/\n/g, '<br>'), c.warning);
    rows += block('Fichiers / liens Drive', driveLines);
    if (r.blocking.length) rows += block(`Bloquants (${r.blocking.length}) — à résoudre avant production`, r.blocking.map(b => '• ' + b).join('<br>'), c.danger);
    if (r.recommended.length) rows += block(`Recommandés manquants (${r.recommended.length})`, r.recommended.map(b => '• ' + b).join('<br>'), c.warning);

    const footerNote = r.emailRestaurant
      ? `Une confirmation a été envoyée à <strong>${r.emailRestaurant}</strong>.`
      : 'Aucun e-mail de confirmation envoyé (adresse non renseignée).';

    return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:24px;background:${c.bg};font-family:-apple-system,Arial,sans-serif">
<table role="presentation" style="max-width:600px;margin:0 auto" cellpadding="0" cellspacing="0">

  <!-- HEADER -->
  <tr><td style="background:${c.accent};border-radius:12px 12px 0 0;padding:0">
    <table cellpadding="0" cellspacing="0" style="width:100%"><tr>
      <td style="padding:20px 24px 16px">
        <div style="display:inline-block;background:${c.yellow};color:${c.yellowText};font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:4px;margin-bottom:10px">Brief Studio</div>
        <div style="font-family:Arial Black,Arial,sans-serif;color:#fff;font-size:20px;letter-spacing:-0.3px;line-height:1.2">Nouveau brief reçu</div>
        <div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:6px;text-transform:uppercase;letter-spacing:0.5px">${r.briefId}</div>
      </td>
      <td style="padding:20px 24px 16px;text-align:right;vertical-align:top">
        ${r.marque ? '<div style="display:inline-block;background:rgba(255,255,255,0.12);color:#fff;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px">' + r.marque + '</div>' : ''}
        <div style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:8px">${r.demandeur}</div>
        <div style="color:rgba(255,255,255,0.4);font-size:11px">${r.departement}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:${c.surface};border:1px solid ${c.border};border-top:none;border-radius:0 0 12px 12px;overflow:hidden">
    <table cellpadding="0" cellspacing="0" style="width:100%">
      ${rows}
      <tr><td style="padding:12px 20px;background:#f8f8f8">
        <div style="font-size:11px;color:${c.tertiary};line-height:1.6">${footerNote}<br>Reçu via Brief Studio — Black &amp; White Burger</div>
      </td></tr>
    </table>
  </td></tr>

</table>
</body></html>`;
  },

  /* ── Confirmation email pour le soumetteur (restaurant) ───────────
     Email court envoyé à emailRestaurant pour confirmer la réception. */
  toConfirmHtml(r) {
    const c = {
      text: '#1d1d1f', secondary: '#5a5a5f', tertiary: '#a3a3a6',
      border: '#e8e8ea', accent: '#1d1d1f',
      yellow: '#DFFF00', yellowText: '#1d1d1f',
    };

    const typeLabel = `${r.typeDemande}${r.genreCampagne ? ' — ' + r.genreCampagne : ''}${r.phasePackaging ? ' — ' + r.phasePackaging : ''}${r.typeVitrophanie ? ' — ' + r.typeVitrophanie : ''}`;

    return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,Arial,sans-serif">
<table role="presentation" style="max-width:520px;margin:0 auto" cellpadding="0" cellspacing="0">

  <!-- HEADER -->
  <tr><td style="background:${c.accent};border-radius:12px 12px 0 0;padding:24px 28px 20px">
    <div style="display:inline-block;background:${c.yellow};color:${c.yellowText};font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:4px;margin-bottom:12px">Brief Studio</div>
    <div style="font-family:Arial Black,Arial,sans-serif;color:#fff;font-size:18px;line-height:1.3">Votre brief a bien été reçu</div>
    <div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:6px;text-transform:uppercase;letter-spacing:0.5px">${r.briefId}</div>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#fff;border:1px solid ${c.border};border-top:none;border-radius:0 0 12px 12px;padding:24px 28px">

    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:${c.secondary}">
      Bonjour${r.restaurant ? ' <strong style="color:' + c.text + '">' + r.restaurant + '</strong>' : ''},
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:${c.secondary}">
      Nous avons bien reçu votre brief créatif. L'équipe studio va en prendre connaissance et reviendra vers vous prochainement.
    </p>

    <!-- Récap rapide -->
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#f8f8f8;border-radius:8px;margin-bottom:20px">
      <tr><td style="padding:14px 18px;border-bottom:1px solid ${c.border}">
        <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.6px;color:${c.tertiary};margin-bottom:3px">Référence du brief</div>
        <div style="font-size:14px;font-weight:700;color:${c.text}">${r.briefId}</div>
      </td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid ${c.border}">
        <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.6px;color:${c.tertiary};margin-bottom:3px">Type de demande</div>
        <div style="font-size:13.5px;color:${c.text}">${typeLabel}</div>
      </td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid ${c.border}">
        <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.6px;color:${c.tertiary};margin-bottom:3px">Date de lancement souhaitée</div>
        <div style="font-size:13.5px;color:${c.text}">${r.dateLancement}</div>
      </td></tr>
      <tr><td style="padding:14px 18px">
        <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:0.6px;color:${c.tertiary};margin-bottom:3px">Priorité</div>
        <div style="font-size:13.5px;color:${c.text}">${r.priorite}${r.raisonUrgence ? ' — ' + r.raisonUrgence : ''}</div>
      </td></tr>
    </table>

    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${c.tertiary}">
      Pour toute question, contactez le studio créatif à <a href="mailto:studio@bnwburger.com" style="color:${c.text};font-weight:600">studio@bnwburger.com</a>
    </p>
    <p style="margin:0;font-size:12px;color:${c.tertiary}">Black &amp; White Burger — Studio Créatif</p>
  </td></tr>

</table>
</body></html>`;
  }
};
