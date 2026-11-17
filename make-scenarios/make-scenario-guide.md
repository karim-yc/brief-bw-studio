# Guide Make.com — Flux Email → Brief B&W

## Vue d'ensemble du scénario

```
[1] Gmail: Watch Emails (nouveau mail)
      ↓
[2] Filter: exclure tes propres mails / auto-replies
      ↓
[3] HTTP: Claude API (extraction + questions)
      ↓
[4] JSON: Parse réponse Claude
      ↓
[5a] Si complet = false → [6] Gmail: Create a Draft (questions)
[5b] Si complet = true  → [7] Gmail: Create a Draft (confirmation) + [8] HTTP: Webhook brief
```

---

## Étape par étape

### Module 1 — Gmail: Watch Emails
- **Folder** : INBOX  
- **Criteria** : All emails (ou filtrer par label "Brief" si tu veux trier)
- **Maximum number of results** : 1

### Module 2 — Filter (Routeur ou condition)
Condition : `From email` **does not contain** `@bnwburger.com`  
(évite de boucler sur tes propres mails)

### Module 3 — HTTP: Make a request
- **URL** : `https://api.anthropic.com/v1/messages`
- **Method** : POST
- **Headers** :
  ```
  x-api-key: {{ta_clé_anthropic}}
  anthropic-version: 2023-06-01
  content-type: application/json
  ```
- **Body type** : Raw (JSON)
- **Body** (voir `prompt-claude.md` pour le prompt complet) :
  ```json
  {
    "model": "claude-sonnet-4-5",
    "max_tokens": 1024,
    "system": "Tu es l'assistant du Studio Créatif B&W...",
    "messages": [{
      "role": "user",
      "content": "..."
    }]
  }
  ```
  Injecte dans le content :
  - `{{1.from.email}}` → email expéditeur
  - `{{1.subject}}` → sujet
  - `{{1.text}}` → corps du mail (texte brut, pas HTML)

### Module 4 — JSON: Parse JSON
- **JSON String** : `{{3.content[].text}}` (la réponse texte de Claude)
- Crée la structure avec les champs :  
  `extraction`, `complet`, `questions[]`, `resume_demande`

### Module 5 — Router (Routeur)
Deux branches selon `{{4.complet}}` :

---

### Branche A — Brief incomplet (questions à poser)
**Condition** : `{{4.complet}}` = `false`

#### Module 6 — Gmail: Create a Draft
- **To** : `{{1.from.email}}`
- **Subject** : `Re: {{1.subject}}`
- **Content** (HTML) :
  ```html
  Bonjour {{4.extraction.demandeur}},<br><br>
  Merci pour ta demande — j'ai bien tout noté 👍<br><br>
  <em>{{4.resume_demande}}</em><br><br>
  Pour pouvoir lancer la création, j'ai besoin de quelques précisions :<br><br>
  {{questions_formatees}}<br><br>
  Tu peux répondre directement à ce mail.<br><br>
  À très vite,<br>
  <strong>Studio Créatif B&W</strong>
  ```
  
  > **Pour `{{questions_formatees}}`** : utilise un module **Text aggregator** avant ce module pour transformer `questions[]` en liste numérotée HTML (`<ol><li>...</li></ol>`).

- **Thread ID** : `{{1.threadId}}` ← important pour garder le fil de conversation

---

### Branche B — Brief complet
**Condition** : `{{4.complet}}` = `true`

#### Module 7 — Gmail: Create a Draft (confirmation)
- Même principe que Module 6, avec le template de confirmation (voir `email-template.md`)
- **Thread ID** : `{{1.threadId}}`

#### Module 8 — HTTP: Webhook (injecter dans le dashboard)
- **URL** : ton webhook Make existant (le même que le formulaire)
- **Method** : POST
- **Body** :
  ```json
  {
    "marque": "{{4.extraction.marque}}",
    "departement": "{{4.extraction.departement}}",
    "ref": "{{4.extraction.demandeur}}",
    "typeDemande": "{{4.extraction.typeDemande}}",
    "contexte": "{{4.extraction.contexte}}",
    "supportsSelected": {{4.extraction.supports}},
    "dateLancement": "{{4.extraction.dateLancement}}",
    "dateValidation": "{{4.extraction.dateValidation}}",
    "priorite": "{{4.extraction.priorite}}",
    "source": "email"
  }
  ```
  > Le champ `"source": "email"` permet de distinguer les briefs mail des briefs formulaire dans le dashboard.

---

## Gestion des réponses (itérations)

Quand le demandeur répond à ton mail de relance, le scénario se redéclenche.  
Pour que Claude accumule le contexte, dans **Module 3**, inclure **tout le fil** :

```
{{1.text}}

--- ÉCHANGE PRÉCÉDENT ---
{{1.thread.messages[].text}}
```

Make peut accéder au thread complet via le **Thread ID** du premier mail.

---

## Paramètres du scénario Make

| Paramètre | Valeur recommandée |
|---|---|
| Scheduling | Every 15 minutes |
| Max results par run | 5 |
| Error handling | Ignore + notification Slack/mail |

---

## Checklist avant activation

- [ ] Clé API Anthropic ajoutée dans les variables Make (`ANTHROPIC_API_KEY`)
- [ ] Gmail connecté avec les bons scopes (read + compose + drafts)
- [ ] Webhook URL copié depuis le scénario Make existant
- [ ] Testé avec un mail de test envoyé depuis une boîte externe
- [ ] Filtre anti-boucle vérifié (`@bnwburger.com` exclu)
- [ ] Label Gmail "Brief" créé (optionnel mais recommandé)
