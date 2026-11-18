/**
 * BW Studio — WhatsApp Webhook Receiver
 * Cloudflare Worker (gratuit, toujours actif)
 *
 * SETUP le jour de la présentation (10 min) :
 * 1. Va sur workers.cloudflare.com → créer un compte gratuit
 * 2. Nouveau Worker → colle ce code
 * 3. Settings → Variables → ajoute :
 *    - VERIFY_TOKEN   : un mot secret de ton choix (ex: "bwstudio2024")
 *    - GH_TOKEN       : un GitHub PAT avec permission "contents:write"
 *    - GH_REPO        : "karim-yc/brief-bw-studio"
 * 4. Déploie → note l'URL du Worker (ex: https://bw-whatsapp.username.workers.dev)
 * 5. Dans Meta Developer → App → WhatsApp → Configuration du webhook :
 *    - URL : ton URL Worker + /webhook
 *    - Token de vérification : la valeur de VERIFY_TOKEN
 *    - Abonne-toi à : messages
 * 6. Ajoute dans GitHub Secrets :
 *    - WHATSAPP_TOKEN    : ton token d'accès système Meta
 *    - WHATSAPP_PHONE_ID : l'ID de ton numéro (dans Meta Developer)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Vérification du webhook (GET — Meta vérifie ton endpoint)
    if (request.method === 'GET' && url.pathname === '/webhook') {
      const mode      = url.searchParams.get('hub.mode');
      const token     = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === env.VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }
      return new Response('Forbidden', { status: 403 });
    }

    // Réception des messages (POST — Meta envoie les messages entrants)
    if (request.method === 'POST' && url.pathname === '/webhook') {
      const body = await request.json().catch(() => null);
      if (!body) return new Response('Bad Request', { status: 400 });

      const messages = extractMessages(body);
      if (messages.length > 0) {
        await appendToGitHub(messages, env);
      }

      return new Response('OK', { status: 200 });
    }

    return new Response('BW Studio WhatsApp Webhook', { status: 200 });
  }
};

function extractMessages(body) {
  const result = [];
  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const msg of value.messages || []) {
          if (msg.type !== 'text') continue;
          const contact = (value.contacts || []).find(c => c.wa_id === msg.from) || {};
          result.push({
            id:          msg.id,
            from:        msg.from,
            fromName:    contact.profile?.name || msg.from,
            text:        msg.text?.body || '',
            timestamp:   new Date(parseInt(msg.timestamp) * 1000).toISOString(),
            isRead:      false,
            phoneId:     value.metadata?.phone_number_id || '',
          });
        }
      }
    }
  } catch (e) {}
  return result;
}

async function appendToGitHub(newMessages, env) {
  const apiBase = `https://api.github.com/repos/${env.GH_REPO}/contents/api/whatsapp-messages.json`;
  const headers = {
    'Authorization': `Bearer ${env.GH_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Lire le fichier actuel
  const getResp = await fetch(apiBase, { headers });
  const getJson = await getResp.json();
  let existing = { ok: true, count: 0, source: 'whatsapp-cloud-api', messages: [] };
  let sha = null;

  if (getResp.ok) {
    try {
      existing = JSON.parse(atob(getJson.content.replace(/\n/g, '')));
      sha = getJson.sha;
    } catch (e) {}
  }

  // Dédupliquer par id
  const existingIds = new Set((existing.messages || []).map(m => m.id));
  const toAdd = newMessages.filter(m => !existingIds.has(m.id));
  if (toAdd.length === 0) return;

  existing.messages = [...toAdd, ...(existing.messages || [])].slice(0, 50);
  existing.count    = existing.messages.length;
  existing.updatedAt = new Date().toISOString();
  existing.ok       = true;

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(existing, null, 2))));

  const putBody = {
    message: `auto: new whatsapp message(s) [skip ci]`,
    content,
    ...(sha ? { sha } : {}),
  };

  await fetch(apiBase, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody),
  });
}
