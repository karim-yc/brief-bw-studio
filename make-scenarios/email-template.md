# Templates email — flux brief par mail

## Mail de relance (questions manquantes)

**Sujet :** Re: {{email_sujet_original}}

```
Bonjour {{prenom_demandeur}},

Merci pour ta demande — j'ai bien tout noté 👍

{{resume_demande}}

Pour pouvoir lancer la création, j'ai besoin de quelques précisions :

{{liste_questions_numerotees}}

Tu peux répondre directement à ce mail.

À très vite,
Studio Créatif B&W
```

---

**Exemple rendu :**

> Bonjour Sophie,
>
> Merci pour ta demande — j'ai bien tout noté 👍
>
> Campagne Instagram (post + story) pour le lancement du menu été Black & White Lyon.
>
> Pour pouvoir lancer la création, j'ai besoin de quelques précisions :
>
> 1. Pour quelle date souhaitez-vous lancer la campagne ?
> 2. Avez-vous une date limite pour valider les maquettes ?
>
> Tu peux répondre directement à ce mail.
>
> À très vite,  
> Studio Créatif B&W

---

## Mail de confirmation (brief complet, prêt à traiter)

**Sujet :** ✅ Brief reçu — {{resume_demande}}

```
Bonjour {{prenom_demandeur}},

Ton brief a bien été enregistré et transmis à l'équipe créative.

📋 Récapitulatif :
• Marque : {{marque}}
• Type : {{typeDemande}}
• Supports : {{supports}}
• Date de lancement : {{dateLancement}}
• Priorité : {{priorite}}

Tu recevras les maquettes pour le {{dateValidation}}.

Pour toute modification, réponds à ce mail.

L'équipe Studio Créatif B&W
```

---

## Variables Make à utiliser

| Variable Make | Source |
|---|---|
| `{{email_sujet_original}}` | Trigger Gmail — Subject |
| `{{prenom_demandeur}}` | Réponse Claude — `extraction.demandeur` (prendre le prénom) |
| `{{resume_demande}}` | Réponse Claude — `resume_demande` |
| `{{liste_questions_numerotees}}` | Réponse Claude — `questions[]` formatées en liste numérotée |
| `{{marque}}` | Réponse Claude — `extraction.marque` |
| `{{typeDemande}}` | Réponse Claude — `extraction.typeDemande` |
| `{{supports}}` | Réponse Claude — `extraction.supports[]` joinés par `, ` |
| `{{dateLancement}}` | Réponse Claude — `extraction.dateLancement` |
| `{{dateValidation}}` | Réponse Claude — `extraction.dateValidation` |
| `{{priorite}}` | Réponse Claude — `extraction.priorite` |
