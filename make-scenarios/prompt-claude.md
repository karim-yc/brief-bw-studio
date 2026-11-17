# Prompt Claude — Extraction brief depuis email

## Utilisation dans Make
Module : **HTTP > Make a request** (ou module Claude si dispo)  
Méthode : POST  
URL : `https://api.anthropic.com/v1/messages`  
Header : `x-api-key: {{ta_clé_api}}`, `anthropic-version: 2023-06-01`, `content-type: application/json`

---

## Prompt système (system)

```
Tu es l'assistant du Studio Créatif B&W. Tu analyses des emails de demande créative et tu extrais les informations pour remplir un brief structuré. Tu réponds UNIQUEMENT en JSON valide, sans aucun texte autour.
```

---

## Prompt utilisateur (user) — à injecter dans Make

Remplace `{{email_expediteur}}`, `{{email_sujet}}`, `{{email_corps}}` par les variables Make correspondantes.

```
Analyse cet email de demande créative et retourne un JSON structuré.

--- EMAIL REÇU ---
De : {{email_expediteur}}
Sujet : {{email_sujet}}
Corps :
{{email_corps}}
--- FIN EMAIL ---

Champs disponibles dans le brief :
- marque : une des valeurs exactes → "Black & White Anspach" | "Black & White Carré de Soie" | "Black & White Châtelet" | "Black & White Docs" | "Black & White Lyon" | "Black & White Marseille" | "Black & White Bordeaux" | "Black & White Strasbourg" | "Black & White Albi" | "Autre"
- departement : une des valeurs exactes → "Marketing" | "IT" | "Finances" | "Achats" | "Travaux" | "Direction" | "Restaurant / Franchisé" | "Autre"
- demandeur : prénom et nom de la personne qui demande (extrait de la signature ou de l'adresse email)
- typeDemande : une des valeurs exactes → "campagne" | "packaging" | "vitrophanie" | "autre"
- contexte : description libre de la demande (ce que tu comprends du mail)
- supports : tableau des supports demandés parmi → "post" | "story" | "affiche" | "menuboard" | "borne" | "plv" | "newsletter" | "banniere" | "video" | "autre-support"
- dateLancement : date de lancement souhaitée au format YYYY-MM-DD (null si non précisée)
- dateValidation : date de validation des maquettes au format YYYY-MM-DD (null si non précisée)
- priorite : "normal" | "prioritaire" | "urgent"

Règles :
1. Remplis uniquement les champs que tu peux déduire avec certitude du mail.
2. Mets null pour les champs absents ou ambigus.
3. Dans "questions", liste UNIQUEMENT les champs bloquants manquants avec une question claire et concise en français, sur le ton professionnel et chaleureux d'une équipe créative.
4. Les champs bloquants obligatoires sont : marque, departement, demandeur, typeDemande, dateLancement.
5. Si la priorité n'est pas précisée, mets "normal".
6. Dans "resume_demande", fais un résumé en 1 phrase de ce qui est demandé.

Retourne ce JSON et rien d'autre :
{
  "extraction": {
    "marque": null,
    "departement": null,
    "demandeur": null,
    "typeDemande": null,
    "contexte": null,
    "supports": [],
    "dateLancement": null,
    "dateValidation": null,
    "priorite": "normal"
  },
  "complet": false,
  "questions": [],
  "resume_demande": ""
}

Le champ "complet" est true uniquement si marque, departement, demandeur, typeDemande ET dateLancement sont tous renseignés.
```

---

## Body JSON Make (HTTP module)

```json
{
  "model": "claude-sonnet-4-5",
  "max_tokens": 1024,
  "system": "Tu es l'assistant du Studio Créatif B&W. Tu analyses des emails de demande créative et tu extrais les informations pour remplir un brief structuré. Tu réponds UNIQUEMENT en JSON valide, sans aucun texte autour.",
  "messages": [
    {
      "role": "user",
      "content": "..."
    }
  ]
}
```

(Le contenu du message user = le prompt ci-dessus avec les variables Make injectées)

---

## Exemple de réponse Claude (brief incomplet)

```json
{
  "extraction": {
    "marque": "Black & White Lyon",
    "departement": "Marketing",
    "demandeur": "Sophie Martin",
    "typeDemande": "campagne",
    "contexte": "Post Instagram pour le lancement du nouveau menu été. Visuel produit avec prix.",
    "supports": ["post", "story"],
    "dateLancement": null,
    "dateValidation": null,
    "priorite": "normal"
  },
  "complet": false,
  "questions": [
    "Pour quelle date souhaitez-vous lancer la campagne ?",
    "Avez-vous une date limite pour valider les maquettes ?"
  ],
  "resume_demande": "Campagne Instagram (post + story) pour le lancement du menu été Black & White Lyon."
}
```

## Exemple de réponse Claude (brief complet)

```json
{
  "extraction": {
    "marque": "Black & White Lyon",
    "departement": "Marketing",
    "demandeur": "Sophie Martin",
    "typeDemande": "campagne",
    "contexte": "Post Instagram pour le lancement du nouveau menu été. Visuel produit avec prix.",
    "supports": ["post", "story"],
    "dateLancement": "2026-06-20",
    "dateValidation": "2026-06-18",
    "priorite": "prioritaire"
  },
  "complet": true,
  "questions": [],
  "resume_demande": "Campagne Instagram (post + story) pour le lancement du menu été Black & White Lyon, lancement le 20 juin."
}
```
