/**
 * BW Studio — Notification email nouveaux briefs
 * ════════════════════════════════════════════════
 * Instructions :
 *  1. Ouvre script.google.com
 *  2. Nouveau projet → colle ce code
 *  3. Modifie DESTINATAIRE ci-dessous
 *  4. Déployer > Nouveau déploiement > Application Web
 *     - Exécuter en tant que : Moi
 *     - Personnes ayant accès : Tout le monde (anonyme)
 *  5. Copie l'URL de déploiement
 *  6. Colle-la dans notify-trigger.sql à la place de APPS_SCRIPT_WEBHOOK_URL
 *  7. Exécute notify-trigger.sql dans le SQL Editor Supabase
 */

const DESTINATAIRES = 'studio@bnwburger.com,karim.yc@bnwburger.com';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const prioriteLabel = {
      urgent: '🔴 URGENT',
      prioritaire: '🟠 Prioritaire',
      normal: '🟢 Normal'
    }[data.priorite] || data.priorite || '—';

    const dateStr = data.submittedAt
      ? new Date(data.submittedAt).toLocaleString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      : new Date().toLocaleString('fr-FR');

    const sujet = `[BW Studio] Nouveau brief — ${data.briefId || 'ID inconnu'}`;

    const corps = [
      '📋 Nouveau brief soumis sur BW Studio',
      '',
      `ID          : ${data.briefId || '—'}`,
      `Marque      : ${data.marque || '—'}`,
      `Département : ${data.departement || '—'}`,
      `Demandeur   : ${data.demandeur || '—'}`,
      `Priorité    : ${prioriteLabel}`,
      `Soumis le   : ${dateStr}`,
      '',
      '👉 Dashboard : https://karim-yc.github.io/brief-bw-studio/dashboard.html',
    ].join('\n');

    GmailApp.sendEmail(DESTINATAIRES, sujet, corps);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error('[BW notif] Erreur :', err);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Test manuel depuis Apps Script : Exécuter > testNotif */
function testNotif() {
  doPost({
    postData: {
      contents: JSON.stringify({
        briefId: 'BW-TEST-001',
        marque: 'Black & White Burger',
        departement: 'Marketing',
        demandeur: 'Test',
        priorite: 'normal',
        submittedAt: new Date().toISOString()
      })
    }
  });
}
