/* ════════════════════════════════════════════════════════════
   CONFIG.JS — Source de vérité unique
   Toute la logique métier du brief est définie ici.
   Pour ajouter/modifier un champ ou une règle : modifier ce fichier.
   ════════════════════════════════════════════════════════════ */

const CONFIG = {

  /* ── Départements ──────────────────────────────────────────── */
  marques: [
    { id: 'bnw',      label: 'Black & White Burger' },
    { id: 'marquise', label: 'Maison Marquise'       },
    { id: 'autre',    label: 'Autre'                 },
  ],

  departements: [
    'Marketing', 'IT', 'Finances', 'Achats',
    'Travaux', 'Direction', 'Restaurant / Franchisé', 'Autre'
  ],

  /* ── Types de demande (étape 2) ───────────────────────────────
     Chaque type pilote l'affichage de l'étape 3 (infos indispensables) */
  typesDemande: [
    {
      id: 'campagne',
      label: 'Campagne Marketing',
      sub:   'Promouvoir un produit, une offre, une ouverture ou un événement.',
      icon: 'campagne'
    },
    {
      id: 'packaging',
      label: 'Packaging',
      sub:   'Créer ou modifier un emballage, une boîte ou un support produit.',
      icon: 'packaging'
    },
    {
      id: 'vitrophanie',
      label: 'Vitrophanie / Travaux',
      sub:   'Habiller une vitrine, une façade, un mur ou un restaurant.',
      icon: 'vitrophanie'
    },
    {
      id: 'autre',
      label: 'Autre demande',
      sub:   'Toute autre demande créative.',
      icon: 'autre'
    }
  ],

  /* ── Genres de campagne (sous-type Marketing) ─────────────── */
  genresCampagne: [
    { id: 'produit', label: 'Produit avec prix' },
    { id: 'image', label: 'Image & Brand' },
    { id: 'promo', label: 'Promo & Offre' }
  ],

  /* ── Phases packaging ──────────────────────────────────────── */
  phasesPackaging: [
    { id: 'simulation', label: 'Simulation initiale' },
    { id: 'retour', label: 'Retour simulation' },
    { id: 'patron', label: 'Adaptation patron' }
  ],

  /* ── Types vitrophanie ─────────────────────────────────────── */
  typesVitrophanie: [
    { id: 'camouflage', label: 'Camouflage ouverture' },
    { id: 'permanente', label: 'Vitrine permanente' }
  ],

  /* ── Supports à produire (étape 4) ────────────────────────── */
  supports: [
    { id: 'post', label: 'Post carré', defaultFormat: '1080×1080' },
    { id: 'story', label: 'Story / Reel 9:16', defaultFormat: '1080×1920' },
    { id: 'affiche', label: 'Affiche / Flyer', defaultFormat: 'A5' },
    { id: 'menuboard', label: 'Menu board', defaultFormat: 'Écran borne' },
    { id: 'borne', label: 'Borne digitale', defaultFormat: 'Écran borne' },
    { id: 'plv', label: 'PLV print', defaultFormat: 'A3' },
    { id: 'newsletter', label: 'Newsletter', defaultFormat: '600px web' },
    { id: 'banniere', label: 'Bannière web', defaultFormat: '1200×628' },
    { id: 'video', label: 'Vidéo / Reel', defaultFormat: '1080×1920' },
    { id: 'autre-support', label: 'Autre support', defaultFormat: '' }
  ],

  livrables: [
    { id: 'png', label: 'PNG' },
    { id: 'pdf-print', label: 'PDF print' },
    { id: 'pdf-web', label: 'PDF web' },
    { id: 'source', label: 'Fichier source' },
    { id: 'bat', label: 'BAT' },
    { id: 'export-ecran', label: 'Export écran' }
  ],

  prioritesNiveau: [
    { id: 'normal', label: 'Normal' },
    { id: 'prioritaire', label: 'Prioritaire' },
    { id: 'urgent', label: 'Urgent' }
  ],

  /* ════════════════════════════════════════════════════════════
     CHAMPS PAR SECTION
     gravity: 'blocking' | 'recommended' | 'optional'
     → affiche le toggle Validé/À confirmer
     showIf: fonction(formData) => bool —条件 d'affichage
     ════════════════════════════════════════════════════════════ */

  // ── ÉTAPE 1 — Qui demande ──────────────────────────────────
  champsEtape1: [
    { id: 'marque', label: 'Marque concernée', type: 'pills', gravity: 'blocking', options: 'marques' },
    { id: 'dept', label: 'Département', type: 'select', gravity: 'blocking', options: 'departements' },
    { id: 'ref', label: 'Prénom et nom', type: 'text', gravity: 'blocking', placeholder: 'Ex : Sophie Martin' },
    {
      id: 'restaurant', label: 'Restaurant concerné', type: 'text', gravity: 'blocking',
      placeholder: 'Ex : B&W Châtelet, Bruxelles',
      showIf: d => d.dept === 'Restaurant / Franchisé'
    },
    {
      id: 'deptAutrePrecision', label: 'Précisez le département', type: 'text', gravity: 'optional',
      placeholder: 'Ex : Ressources Humaines',
      showIf: d => d.dept === 'Autre'
    }
  ],

  // ── ÉTAPE 2 — Que faut-il créer ────────────────────────────
  champsEtape2: [
    { id: 'description', label: 'Contexte du projet', type: 'textarea', gravity: 'blocking',
      help: 'Expliquez l\'objectif de la demande : que faut-il créer, pour qui, où ce sera diffusé, et quel est le but ?',
      minLength: 100,
      placeholder: 'Ex : Campagne lancement du B&W Smash Burger sur Instagram, du 1er au 30 juin. Objectif : notoriété et drive-to-store en restaurant.' }
  ],

  // ── ÉTAPE 3 — Infos indispensables, PAR TYPE ───────────────
  champsEtape3: {

    campagne: [
      { id: 'accroche', label: 'Accroche / claim', type: 'text', gravity: 'recommended',
        placeholder: 'Ex : "Le smash qui change tout"' },
      { id: 'nomProduit', label: 'Nom du produit', type: 'text', gravity: 'blocking',
        placeholder: 'Ex : B&W Smash Burger',
        showIf: d => d.genreCampagne !== 'image' },
      { id: 'prix', label: 'Prix exact', type: 'text', gravity: 'blocking',
        placeholder: 'Ex : 12,90 €',
        showIf: d => d.genreCampagne === 'produit' || d.genreCampagne === 'promo' },
      { id: 'texteExact', label: 'Texte exact validé', type: 'textarea', gravity: 'blocking',
        placeholder: 'Texte final à reproduire sur le visuel, mot pour mot.',
        showIf: d => d.genreCampagne === 'produit' || d.genreCampagne === 'promo' },
      { id: 'mentions', label: 'Mentions légales', type: 'text', gravity: 'blocking', tooltip: 'Conditions obligatoires à afficher : dates, limites, disponibilité, prix, exclusions, restaurant concerné…',
        placeholder: 'Ex : *Offre valable jusqu\'au 30/06/2026. Voir conditions en restaurant.',
        showIf: d => d.genreCampagne === 'promo' },
      { id: 'shooting', label: 'Shooting nécessaire', type: 'pills', gravity: 'recommended',
        options: [
          { id: 'dispo', label: 'Déjà disponible' },
          { id: 'produit', label: 'Shooting produit' },
          { id: 'lifestyle', label: 'Shooting lifestyle' },
          { id: 'planifier', label: 'À planifier' }
        ],
        showIf: d => d.genreCampagne === 'image' },
      { id: 'drive', label: 'Lien Drive / fichiers', type: 'text', gravity: 'recommended',
        placeholder: 'https://drive.google.com/...' }
    ],

    packaging: [
      { id: 'texteExactPack', label: 'Texte exact packaging', type: 'textarea', gravity: 'blocking',
        placeholder: 'Texte final validé à reproduire sur le packaging.' },
      { id: 'logoVersion', label: 'Version du logo à utiliser', type: 'text', gravity: 'blocking',
        placeholder: 'Ex : Logo noir sur fond blanc, version 2026' },
      { id: 'formatPack', label: 'Format / dimensions', type: 'text', gravity: 'blocking',
        placeholder: 'Ex : 12 × 12 × 6 cm',
        showIf: d => d.phasePackaging !== 'retour' },
      { id: 'matierePack', label: 'Matière / support', type: 'text', gravity: 'recommended',
        placeholder: 'Ex : Carton kraft 350g',
        showIf: d => d.phasePackaging === 'patron' },
      { id: 'fournisseur', label: 'Fournisseur', type: 'text', gravity: 'optional',
        placeholder: 'Ex : Imprimerie Dupont' },
      { id: 'gabaritDispo', label: 'Gabarit ou BAT disponible', type: 'pills', gravity: 'blocking', tooltip: 'Fichier technique fournisseur ou modèle validé nécessaire pour produire au bon format.',
        options: [
          { id: 'oui', label: 'Oui, disponible' },
          { id: 'non', label: 'Non, à fournir' }
        ],
        showIf: d => d.phasePackaging === 'patron' },
      { id: 'declinaisonsPack', label: 'Produits à réaliser', type: 'packtable', gravity: 'blocking' },
      { id: 'driveP', label: 'Lien Drive / fichiers', type: 'text', gravity: 'recommended',
        placeholder: 'https://drive.google.com/...' }
    ],

    vitrophanie: [
      { id: 'adresse', label: 'Adresse du restaurant', type: 'text', gravity: 'blocking',
        placeholder: 'Ex : Rue de la Montagne 6, 1000 Bruxelles' },
      { id: 'mesures', label: 'Mesures exactes', type: 'text', gravity: 'blocking',
        placeholder: 'Ex : Largeur 3,20 m × Hauteur 2,40 m' },
      { id: 'photosDevanture', label: 'Photos de la devanture disponibles', type: 'pills', gravity: 'blocking',
        options: [
          { id: 'oui', label: 'Oui, disponibles' },
          { id: 'non', label: 'Non, à prendre' }
        ] },
      { id: 'planVectoriel', label: 'Plan vectoriel disponible', type: 'pills', gravity: 'recommended', tooltip: 'Plan propre exploitable en PDF, AI, EPS ou fichier vectoriel avec les mesures correctes.',
        options: [
          { id: 'oui', label: 'Oui, disponible' },
          { id: 'non', label: 'Non, à fournir' }
        ],
        showIf: d => d.typeVitrophanie === 'permanente' },
      { id: 'contraintesPose', label: 'Contraintes de pose', type: 'text', gravity: 'optional',
        placeholder: 'Ex : Accès uniquement le matin avant 9h' },
      { id: 'matiereVitro', label: 'Matière / support', type: 'text', gravity: 'recommended',
        placeholder: 'Ex : Vinyle micro-perforé',
        showIf: d => d.typeVitrophanie === 'permanente' },
      { id: 'driveV', label: 'Lien Drive / fichiers', type: 'text', gravity: 'recommended',
        placeholder: 'https://drive.google.com/...' }
    ],

    autre: [
      { id: 'descriptionDetaillee', label: 'Description détaillée', type: 'textarea', gravity: 'blocking',
        placeholder: 'Décrivez précisément le besoin.' },
      { id: 'driveA', label: 'Lien Drive / fichiers / références', type: 'text', gravity: 'recommended',
        placeholder: 'https://drive.google.com/...' }
    ]
  },

  /* ── ÉTAPE 4 — Deadlines & priorité ──────────────────────────
     Toujours la même, indépendamment du type */
  champsEtape4Deadlines: [
    { id: 'dateLancement', label: 'Date prévue de diffusion / pose', type: 'date', gravity: 'blocking', tooltip: 'Date à laquelle le visuel doit être prêt pour être diffusé, affiché ou posé.' },
    { id: 'dateValidation', label: 'Date limite pour fournir les infos validées', type: 'date', gravity: 'blocking', tooltip: 'Date limite à laquelle tous les textes, prix, visuels et mentions doivent être validés et transmis au studio.' },
    { id: 'dateRetourSimul', label: 'Date souhaitée pour le premier aperçu visuel', type: 'date', gravity: 'recommended', tooltip: 'Date à laquelle vous souhaitez voir une première proposition graphique. Ce n\'est pas la version finale.' }
  ],

  /* ── Labels des badges de statut ────────────────────────────── */
  statusLabels: {
    empty: 'Vide',
    partial: 'Partiel',
    complete: 'Complet',
    blocking: 'Bloquant'
  },

  /* ── Sections (pour sidebar + navigation) ───────────────────── */
  sections: [
    { id: 1, key: 'qui', title: 'Qui demande ?' },
    { id: 2, key: 'quoi', title: 'Que faut-il créer ?' },
    { id: 3, key: 'infos', title: 'Infos indispensables' },
    { id: 4, key: 'supports', title: 'Deadlines & priorité' },
    { id: 5, key: 'recap', title: 'Récapitulatif' }
  ]
};
