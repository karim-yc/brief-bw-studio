/**
 * BW Brief Studio — Script de notification email
 * Google Apps Script Web App
 *
 * SETUP :
 * 1. Va sur script.google.com → ouvre le projet existant (ou crée-en un nouveau)
 * 2. Remplace l'intégralité du code par ce fichier
 * 3. Déployer → Nouvelle version → Type : Application Web
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde
 * 4. Copie l'URL de déploiement → colle dans app.js (NOTIF_URL)
 *
 * Ce script envoie deux emails à chaque nouveau brief :
 *   1. Notification complète → studio@bnwburger.com
 *   2. Confirmation de réception → emailRestaurant (si renseigné)
 */

var STUDIO_EMAIL = 'studio@bnwburger.com';

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || '{}');
    sendNotifications(payload);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, status: 'BW Notification Script actif' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendNotifications(p) {
  var briefId     = p.briefId     || '—';
  var demandeur   = p.demandeur   || '—';
  var departement = p.departement || '—';
  var marque      = p.marque      || '';
  var priorite    = p.priorite    || '—';
  var mailHtml    = p.mailHtml    || '';
  var emailResto  = p.emailRestaurant || '';
  var confirmHtml = p.confirmHtml || '';

  var urgentTag = (priorite === 'urgent') ? ' [URGENT]' : '';
  var marqueTag = marque ? ' — ' + marque : '';

  // ── 1. Email studio (notification interne) ───────────────────────
  var studioSubject = 'Nouveau brief' + urgentTag + marqueTag + ' — ' + briefId;

  if (mailHtml) {
    GmailApp.sendEmail(STUDIO_EMAIL, studioSubject, buildPlainText(p), {
      htmlBody: mailHtml,
      name:     'Brief Studio'
    });
  } else {
    // Fallback texte brut (ancien format sans mailHtml)
    GmailApp.sendEmail(STUDIO_EMAIL, studioSubject, buildPlainText(p), {
      name: 'Brief Studio'
    });
  }

  // ── 2. Email confirmation restaurant (si adresse fournie) ─────────
  if (emailResto && confirmHtml) {
    var confirmSubject = 'Votre brief a bien été reçu — ' + briefId;
    GmailApp.sendEmail(emailResto, confirmSubject, buildConfirmPlain(p), {
      htmlBody: confirmHtml,
      name:     'BW Studio Créatif',
      replyTo:  STUDIO_EMAIL
    });
  }
}

function buildPlainText(p) {
  return [
    'BRIEF : ' + (p.briefId || '—'),
    'Soumis par : ' + (p.demandeur || '—') + ' — ' + (p.departement || '—'),
    p.marque ? 'Marque : ' + p.marque : '',
    'Priorité : ' + (p.priorite || '—'),
    'Reçu le : ' + (p.submittedAt || new Date().toISOString()),
    '',
    'Ouvrir le dashboard : https://karim-yc.github.io/brief-bw-studio/dashboard.html'
  ].filter(Boolean).join('\n');
}

function buildConfirmPlain(p) {
  return [
    'Bonjour,',
    '',
    'Nous avons bien reçu votre brief créatif (réf. ' + (p.briefId || '—') + ').',
    'L\'équipe studio va en prendre connaissance et reviendra vers vous prochainement.',
    '',
    'Pour toute question : ' + STUDIO_EMAIL,
    '',
    'Black & White Burger — Studio Créatif'
  ].join('\n');
}
