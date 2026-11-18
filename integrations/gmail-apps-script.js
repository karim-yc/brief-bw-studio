/**
 * BW Studio — Gmail Integration
 * Google Apps Script Web App
 *
 * SETUP (5 min) :
 * 1. Va sur script.google.com → Nouveau projet
 * 2. Colle ce code, remplace INTERNAL_DOMAINS par tes domaines internes
 * 3. Déployer → Nouvelle déploiement → Type : Application Web
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Moi uniquement (ou toute personne avec le lien)
 * 4. Autorise les permissions Gmail demandées
 * 5. Copie l'URL de déploiement → colle dans dashboard.html (GMAIL_SCRIPT_URL)
 *
 * Pour mettre à jour : re-déployer avec "Nouvelle version"
 */

// Domaines internes à exclure (tu ne veux pas voir tes propres emails dans le feed)
const INTERNAL_DOMAINS = ['bnwburger.com'];

// Nombre de jours à scanner
const DAYS_BACK = 14;

// Nombre max de threads retournés
const MAX_THREADS = 20;

function doGet(e) {
  try {
    const data = fetchRecentThreads();
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function fetchRecentThreads() {
  const after = new Date();
  after.setDate(after.getDate() - DAYS_BACK);
  const afterStr = Utilities.formatDate(after, 'UTC', 'yyyy/MM/dd');

  const query = `in:inbox category:primary after:${afterStr} -is:nouserlabels`;
  const threads = GmailApp.search(query, 0, MAX_THREADS);

  const result = [];

  for (const thread of threads) {
    const messages = thread.getMessages();
    if (!messages.length) continue;

    const lastMsg = messages[messages.length - 1];
    const firstMsg = messages[0];

    const fromRaw = lastMsg.getFrom();
    // Exclure les emails internes
    const fromDomain = (fromRaw.match(/@([^>]+)>?$/) || [])[1] || '';
    if (INTERNAL_DOMAINS.some(d => fromDomain.includes(d))) continue;

    // Extraire nom et email de l'expéditeur
    const fromMatch = fromRaw.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
    const fromName  = (fromMatch ? fromMatch[1] : fromRaw).trim();
    const fromEmail = (fromMatch ? fromMatch[2] : fromRaw).trim() || fromRaw;

    const isUnread = thread.isUnread();
    const labels   = thread.getLabels().map(l => l.getName());
    const subject  = firstMsg.getSubject() || '(sans objet)';
    const snippet  = thread.getLastMessageDate() && lastMsg.getPlainBody()
      ? lastMsg.getPlainBody().replace(/\s+/g, ' ').trim().slice(0, 120)
      : '';

    result.push({
      threadId:    thread.getId(),
      subject:     subject,
      fromName:    fromName,
      fromEmail:   fromEmail,
      date:        lastMsg.getDate().toISOString(),
      snippet:     snippet,
      messageCount: messages.length,
      isUnread:    isUnread,
      hasAttachment: lastMsg.getAttachments().length > 0,
      labels:      labels,
      url:         `https://mail.google.com/mail/#inbox/${thread.getId()}`,
    });
  }

  // Trier : non-lus en premier, puis par date desc
  result.sort((a, b) => {
    if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;
    return new Date(b.date) - new Date(a.date);
  });

  return {
    ok:        true,
    count:     result.length,
    updatedAt: new Date().toISOString(),
    source:    'gmail-apps-script',
    threads:   result,
  };
}
