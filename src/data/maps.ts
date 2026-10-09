import type { Condition, MapDefinition, MapId } from '@/data/types';

/**
 * Cartes placeholder de l'Acte I (ASCII). Légende des terrains : `TERRAIN_CHARS` dans `src/data/types.ts`.
 * Tout autre caractère est un marqueur déclaré dans `markers` (sa case prend le terrain `floor`).
 * Points d'arrivée imposés par `src/data/story.ts` : `gare-mons/depart`, `occ/entree`,
 * `gare-couloir-technique/sonne` (après le Consultant Junior).
 */

/** Les trois collègues de « Trois tasses, trois collègues » sont recrutés. */
const TROIS_RECRUTES = {
  'josiane-recrutee': true,
  'rudy-recrute': true,
  'bene-recrutee': true,
} as const;

const AUDIT_A_ANNONCER: Condition = { flags: { ...TROIS_RECRUTES, 'audit-annonce': false } };

export const MAPS = {
  /**
   * Gare de Mons (60 × 36). Quais 4 → 1 de haut en bas, séparés par les voies ; la passerelle (x 29-31)
   * enjambe les voies, escalators `^` à chaque quai. Hall en bas : bureau du sous-chef à gauche,
   * guichet de Béné, Borne Rebelle, sortie vers la ville (fermée en Acte I).
   */
  'gare-mons': {
    id: 'gare-mons',
    name: 'Gare de Mons — Quais et hall',
    theme: 'sncb',
    floor: 'hall',
    rows: [
      '############################################################',
      '#___________________________#:::#__________________________#',
      '#___________________________^:::^_______P__________________#',
      '#___________________________#:::#__________________________#',
      '#===========================#:::#==========================#',
      '#===========================#:::#==========================#',
      '#___________________________#:::#__________________________#',
      '#___________________________^:::^_________________k________#',
      '#___________________________#:::E__________________________#',
      '#===========================#:::#==========================#',
      '#===========================#:R:#==========================#',
      '#_________________D_________#:::#__________________________#',
      '#___________M_________J_d___^:::^__________________________#',
      '#___________________________#:::#__________________________#',
      '#===========================#:::#==========================#',
      '#===========================#:::#==========================#',
      '#_______A___________________#:::#___________b______________#',
      '#___________________________^:::^__________________________#',
      '#___________________________#####__________________________#',
      '##############################T#####,,,#########,,,#########',
      '#;;I;;;;;;;;;#,,###########,,,c,,,,,,,,,,,H,,,,,,,,,,,,,Z,,#',
      '#;;;;;;;;;;;;#,,###########,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#;;;;;;K;;;;;#,,&&G&&N&&&&&,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#;;;;;;;;;;;;#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#;;;;;;;;;;;;;C,,,,,,1,,,,,,,,,,,,,,,,,,,,,,,y,,,,,,,,,,,,,#',
      '#;;;;;;;;;;;;#,,,,,,,2,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#;;;;;;;;;;;;#,,,,,,,3,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '##############,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,qQ',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,VB,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,,x,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '##############################S#############################',
    ],
    markers: {
      k: {
        kind: 'encounter',
        encounter: 'manager-kpi-quai',
        character: 'manager-kpi',
        label: 'Manager KPI en ronde',
        visibleWhen: { flags: { 'quete-trois-tasses': true } },
      },
      y: {
        kind: 'encounter',
        encounter: 'consultants-hall',
        character: 'consultant',
        label: 'Consultant et Stagiaire',
        visibleWhen: { flags: { 'consultant-vaincu': true } },
      },
      x: {
        kind: 'encounter',
        encounter: 'patrouille-bornes',
        character: 'borne',
        label: 'Bornes en patrouille',
        visibleWhen: { flags: { 'borne-vaincue': true } },
      },
      // Points d'arrivée
      d: { kind: 'spawn', id: 'depart', facing: 'right' },
      c: { kind: 'spawn', id: 'couloir', facing: 'down' },
      q: { kind: 'spawn', id: 'pauses', facing: 'left' },
      // Portails
      T: { kind: 'portal', to: 'gare-couloir-technique', spawn: 'porte' },
      Q: { kind: 'portal', to: 'gare-salle-pauses', spawn: 'porte' },
      // Quai 2
      J: {
        kind: 'npc',
        character: 'josiane',
        facing: 'right',
        visibleWhen: { flags: { 'josiane-recrutee': false } },
        interactions: [
          { when: { flags: { 'thermos-retrouve': true } }, dialogue: 'josiane-recrutement' },
          { when: { flags: { 'quete-trois-tasses': true } }, dialogue: 'josiane-thermos' },
          { when: { flags: { 'dossier-trouve': false } }, dialogue: 'josiane-imprimante' },
          { dialogue: 'josiane-quai' },
        ],
      },
      D: {
        kind: 'prop',
        id: 'ecran-quai-2',
        label: 'Écran des départs',
        blocking: true,
        interactions: [{ dialogue: 'ecran-departs' }],
      },
      M: {
        kind: 'npc',
        character: 'manager-kpi',
        facing: 'right',
        visibleWhen: { flags: { 'audit-annonce': true, 'audit-vaincu': false } },
        interactions: [{ dialogue: 'audit' }],
      },
      // Passerelle et escalators
      R: {
        kind: 'npc',
        character: 'rudy',
        facing: 'down',
        visibleWhen: { flags: { 'rudy-recrute': false } },
        interactions: [
          { when: { flags: { 'sifflet-recupere': true } }, dialogue: 'rudy-recrutement' },
          { when: { flags: { 'quete-trois-tasses': true } }, dialogue: 'rudy-sifflet' },
          { when: { flags: { 'borne-vaincue': false } }, dialogue: 'rudy-borne' },
          { dialogue: 'rudy-passerelle' },
        ],
      },
      E: {
        kind: 'prop',
        id: 'escalator-b',
        label: 'Escalator B (en panne)',
        blocking: true,
        interactions: [
          {
            when: { flags: { 'quete-trois-tasses': true, 'sifflet-recupere': false } },
            dialogue: 'escalator-sifflet',
          },
          { dialogue: 'escalator' },
        ],
      },
      P: {
        kind: 'prop',
        id: 'pigeon-4412',
        label: 'Matricule 4412',
        blocking: true,
        interactions: [{ dialogue: 'pigeon' }],
      },
      // Quai 1
      A: {
        kind: 'prop',
        id: 'note-service-1',
        label: 'Note de service',
        blocking: true,
        interactions: [{ dialogue: 'note-service-1' }],
      },
      b: {
        kind: 'prop',
        id: 'banc-marcel',
        label: 'Banc',
        blocking: true,
        interactions: [{ dialogue: 'banc-marcel' }],
      },
      // Bureau du sous-chef
      I: {
        kind: 'prop',
        id: 'imprimante',
        label: 'Imprimante',
        blocking: true,
        interactions: [
          { when: { flags: { 'dossier-trouve': false } }, dialogue: 'imprimante' },
          { dialogue: 'imprimante-vide' },
        ],
      },
      K: {
        kind: 'prop',
        id: 'bureau-sous-chef',
        label: 'Bureau du sous-chef',
        blocking: true,
        interactions: [{ dialogue: 'bureau-sous-chef' }],
      },
      C: {
        kind: 'npc',
        character: 'consultant',
        facing: 'left',
        visibleWhen: {
          flags: { 'dossier-trouve': true, 'borne-vaincue': true, 'consultant-vaincu': false },
        },
        interactions: [{ dialogue: 'consultant' }],
      },
      // Guichet de Béné et sa file
      N: {
        kind: 'npc',
        character: 'bene',
        facing: 'down',
        visibleWhen: { flags: { 'bene-recrutee': false } },
        interactions: [
          {
            when: {
              flags: {
                'voyageur-1-renseigne': true,
                'voyageur-2-renseigne': true,
                'voyageur-3-renseigne': true,
              },
            },
            dialogue: 'bene-recrutement',
          },
          { when: { flags: { 'quete-trois-tasses': true } }, dialogue: 'bene-file' },
          { dialogue: 'bene-guichet' },
        ],
      },
      G: {
        kind: 'prop',
        id: 'guichet-2',
        label: 'Guichet',
        blocking: true,
        interactions: [
          { when: { flags: { 'bene-recrutee': true } }, dialogue: 'guichet-ferme' },
          { dialogue: 'guichet-2' },
        ],
      },
      '1': {
        kind: 'npc',
        character: 'voyageur',
        facing: 'up',
        visibleWhen: { flags: { 'voyageur-1-renseigne': false } },
        interactions: [
          { when: { flags: { 'voyageur-1-renseigne': true } }, dialogue: 'voyageur-merci' },
          { when: { flags: { 'quete-trois-tasses': true } }, dialogue: 'voyageur-1' },
          { dialogue: 'voyageur-file' },
        ],
      },
      '2': {
        kind: 'npc',
        character: 'voyageur',
        facing: 'up',
        visibleWhen: { flags: { 'voyageur-2-renseigne': false } },
        interactions: [
          { when: { flags: { 'voyageur-2-renseigne': true } }, dialogue: 'voyageur-merci' },
          { when: { flags: { 'quete-trois-tasses': true } }, dialogue: 'voyageur-2' },
          { dialogue: 'voyageur-file' },
        ],
      },
      '3': {
        kind: 'npc',
        character: 'voyageur',
        facing: 'up',
        visibleWhen: { flags: { 'voyageur-3-renseigne': false } },
        interactions: [
          { when: { flags: { 'voyageur-3-renseigne': true } }, dialogue: 'voyageur-merci' },
          { when: { flags: { 'quete-trois-tasses': true } }, dialogue: 'voyageur-3' },
          { dialogue: 'voyageur-file' },
        ],
      },
      // Hall
      H: {
        kind: 'prop',
        id: 'ecran-hall',
        label: 'Écran des départs',
        blocking: true,
        interactions: [{ dialogue: 'ecran-departs' }],
      },
      Z: {
        kind: 'prop',
        id: 'neon-mons-2030',
        label: 'Néon publicitaire',
        blocking: true,
        interactions: [{ dialogue: 'neon' }],
      },
      B: {
        kind: 'prop',
        id: 'borne-rebelle',
        label: 'Borne Automatique',
        blocking: true,
        interactions: [
          { when: { flags: { 'borne-vaincue': false } }, dialogue: 'borne' },
          { dialogue: 'borne-hs' },
        ],
      },
      V: {
        kind: 'npc',
        character: 'voyageur',
        facing: 'right',
        visibleWhen: { flags: { 'borne-vaincue': false } },
        interactions: [{ dialogue: 'voyageur-borne' }],
      },
      S: {
        kind: 'prop',
        id: 'sortie-ville',
        label: 'Sortie vers la ville',
        blocking: true,
        interactions: [{ dialogue: 'sortie-ville' }],
      },
    },
    onEnter: [{ when: { flags: { 'intro-vue': false } }, dialogue: 'intro' }],
  },

  /** Salle des pauses (20 × 14) : tableau des roulements, frigo, micro-ondes sacré, capsules, ragots. */
  'gare-salle-pauses': {
    id: 'gare-salle-pauses',
    name: 'Salle des pauses',
    theme: 'sncb',
    floor: 'floor',
    rows: [
      '####################',
      '#.....T............#',
      '#................F.#',
      '#..................#',
      '#..................#',
      '#................M.#',
      '#.......&X&........#',
      'Gs......&&&........#',
      '#..................#',
      '#................C.#',
      '#..................#',
      '#..................#',
      '#..K..........A....#',
      '####################',
    ],
    markers: {
      s: { kind: 'spawn', id: 'porte', facing: 'right' },
      G: { kind: 'portal', to: 'gare-mons', spawn: 'pauses' },
      T: {
        kind: 'prop',
        id: 'tableau-roulements',
        label: 'Tableau des roulements',
        blocking: true,
        interactions: [{ dialogue: 'tableau-roulements' }],
      },
      F: {
        kind: 'prop',
        id: 'frigo',
        label: 'Frigo collectif',
        blocking: true,
        interactions: [{ dialogue: 'frigo' }],
      },
      M: {
        kind: 'prop',
        id: 'micro-ondes',
        label: 'Micro-ondes sacré',
        blocking: true,
        interactions: [{ dialogue: 'micro-ondes' }],
      },
      C: {
        kind: 'prop',
        id: 'capsules-premium',
        label: 'Capsules premium',
        blocking: true,
        interactions: [{ dialogue: 'capsules' }],
      },
      X: {
        kind: 'prop',
        id: 'table-commune',
        label: 'Table commune',
        blocking: true,
        interactions: [
          { when: { flags: { 'audit-vaincu': true } }, dialogue: 'ragots-4' },
          { when: { flags: TROIS_RECRUTES }, dialogue: 'ragots-3' },
          { when: { flags: { 'consultant-vaincu': true } }, dialogue: 'ragots-2' },
          { dialogue: 'ragots-1' },
        ],
      },
      K: {
        kind: 'prop',
        id: 'casiers',
        label: 'Casiers',
        blocking: true,
        interactions: [{ dialogue: 'casiers' }],
      },
      A: {
        kind: 'prop',
        id: 'tablier-wagon-bar',
        label: 'Tablier',
        blocking: true,
        interactions: [{ dialogue: 'tablier' }],
      },
    },
  },

  /**
   * Couloir technique (30 × 12) : couloir de service, porte « Réservé au personnel », puis le réduit
   * du distributeur « HORS SERVICE » (entrée de l'OCC).
   */
  'gare-couloir-technique': {
    id: 'gare-couloir-technique',
    name: 'Couloir technique',
    theme: 'sncb',
    floor: 'floor',
    rows: [
      '##############################',
      '##############################',
      '###################..........#',
      '############N######..........#',
      '#.................R..........#',
      'Gg.........................oD#',
      '#.........P..............sM..#',
      '#.................#..........#',
      '#####E#############.......w..#',
      '###################..........#',
      '##############################',
      '##############################',
    ],
    markers: {
      w: {
        kind: 'encounter',
        encounter: 'post-its-couloir',
        character: 'post-it',
        label: 'Post-it Vivants',
        visibleWhen: { flags: { 'occ-decouverte': true } },
      },
      g: { kind: 'spawn', id: 'porte', facing: 'right' },
      s: { kind: 'spawn', id: 'sonne', facing: 'right' },
      o: { kind: 'spawn', id: 'occ', facing: 'left' },
      G: { kind: 'portal', to: 'gare-mons', spawn: 'couloir' },
      R: {
        kind: 'prop',
        id: 'porte-personnel',
        label: 'Porte « Réservé au personnel »',
        blocking: true,
        interactions: [{ dialogue: 'porte-personnel' }],
      },
      N: {
        kind: 'prop',
        id: 'note-service-6',
        label: 'Note de service',
        blocking: true,
        interactions: [{ dialogue: 'note-service-6' }],
      },
      E: {
        kind: 'prop',
        id: 'panneau-electrique',
        label: 'Panneau électrique',
        blocking: true,
        interactions: [{ dialogue: 'panneau-electrique' }],
      },
      P: {
        kind: 'prop',
        id: 'post-it-vivant',
        label: 'Post-it Vivant',
        blocking: true,
        visibleWhen: { flags: { 'quete-trois-tasses': true, 'thermos-retrouve': false } },
        interactions: [
          { when: { flags: { 'thermos-retrouve': false } }, dialogue: 'post-it' },
          { dialogue: 'post-it-froisse' },
        ],
      },
      M: {
        kind: 'npc',
        character: 'marcel',
        facing: 'left',
        visibleWhen: { flags: { 'consultant-vaincu': true, 'occ-decouverte': false } },
        interactions: [{ dialogue: 'marcel-couloir' }],
      },
      D: {
        kind: 'prop',
        id: 'distributeur-hs',
        label: 'Distributeur « HORS SERVICE »',
        blocking: true,
        interactions: [
          { when: { flags: { 'code-occ-connu': true } }, dialogue: 'distributeur-code' },
          { dialogue: 'distributeur-hs' },
        ],
      },
    },
    onEnter: [
      {
        when: { flags: { 'consultant-vaincu': true, 'occ-decouverte': false } },
        dialogue: 'marcel-couloir',
      },
    ],
  },

  /**
   * OCC — Operation Coffee Center (24 × 16) : ancienne lampisterie sous la passerelle.
   * La Vieille Dame sur son autel de traverses, canapé, lit de camp, liège, plaque des commandements,
   * comptoir de Béné ; les collègues recrutés y prennent leur pause.
   */
  occ: {
    id: 'occ',
    name: 'OCC — Operation Coffee Center',
    theme: 'occ',
    floor: 'occ-floor',
    rows: [
      '%%%%%%P%%O%%%%%W%%T%%%%%',
      '%++++++++++++++++++++++%',
      '%++++++++++++++++++++++%',
      '%++++++++++&V&+++++++++%',
      '%+++++++++J+++F++++++++%',
      '%+++Q++++++++++++R+++++%',
      '%++++++++++++++++++++++%',
      '%++++++++++++++++++++++%',
      '%+++++++M++++++++++++N&%',
      '%+++++++++++++++++++++K%',
      '%+C+++++++++++++++++++&%',
      '%++++++++++++++++++++++%',
      '%++++++++++++++++++++++%',
      '%+L++++++++++++++++++++%',
      '%+++++++++++e++++++++++%',
      '%%%%%%%%%%%%X%%%%%%%%%%%',
    ],
    markers: {
      e: { kind: 'spawn', id: 'entree', facing: 'up' },
      X: { kind: 'portal', to: 'gare-couloir-technique', spawn: 'occ' },
      V: {
        kind: 'prop',
        id: 'vieille-dame',
        label: 'La Vieille Dame',
        blocking: true,
        interactions: [{ dialogue: 'vieille-dame' }],
      },
      C: {
        kind: 'prop',
        id: 'canape',
        label: 'Canapé',
        blocking: true,
        interactions: [{ dialogue: 'canape' }],
      },
      L: {
        kind: 'prop',
        id: 'lit-de-camp',
        label: 'Lit de camp',
        blocking: true,
        interactions: [{ dialogue: 'lit-de-camp' }],
      },
      T: {
        kind: 'prop',
        id: 'tableau-liege',
        label: 'Tableau de liège',
        blocking: true,
        interactions: [{ dialogue: 'tableau-liege' }],
      },
      P: {
        kind: 'prop',
        id: 'plaque-commandements',
        label: 'Les 7 commandements',
        blocking: true,
        interactions: [{ dialogue: 'commandements' }],
      },
      O: {
        kind: 'prop',
        id: 'boite-jurons',
        label: 'Boîte à jurons',
        blocking: true,
        interactions: [{ dialogue: 'boite-jurons' }],
      },
      W: {
        kind: 'prop',
        id: 'photo-wagon-bar',
        label: 'Photo du wagon-bar',
        blocking: true,
        interactions: [{ dialogue: 'photo-wagon-bar' }],
      },
      K: {
        kind: 'prop',
        id: 'comptoir-bene',
        label: 'Comptoir',
        blocking: true,
        interactions: [
          { when: { flags: { 'bene-recrutee': true } }, dialogue: 'comptoir-bene' },
          { dialogue: 'comptoir-vide' },
        ],
      },
      M: {
        kind: 'npc',
        character: 'marcel',
        facing: 'down',
        interactions: [
          { when: AUDIT_A_ANNONCER, dialogue: 'audit-annonce' },
          { when: { flags: { 'audit-vaincu': true } }, dialogue: 'marcel-fin' },
          { when: { flags: { 'audit-annonce': true } }, dialogue: 'marcel-audit-rappel' },
          { dialogue: 'marcel-occ' },
        ],
      },
      J: {
        kind: 'npc',
        character: 'jean-mi',
        facing: 'down',
        interactions: [{ dialogue: 'jean-mi' }],
      },
      F: {
        kind: 'npc',
        character: 'fatou',
        facing: 'down',
        interactions: [{ dialogue: 'fatou' }],
      },
      Q: {
        kind: 'npc',
        character: 'josiane',
        facing: 'down',
        visibleWhen: { flags: { 'josiane-recrutee': true } },
        interactions: [{ dialogue: 'josiane-occ' }],
      },
      R: {
        kind: 'npc',
        character: 'rudy',
        facing: 'down',
        visibleWhen: { flags: { 'rudy-recrute': true } },
        interactions: [{ dialogue: 'rudy-occ' }],
      },
      N: {
        kind: 'npc',
        character: 'bene',
        facing: 'left',
        visibleWhen: { flags: { 'bene-recrutee': true } },
        interactions: [{ dialogue: 'bene-occ' }],
      },
    },
    onEnter: [
      { when: { flags: { 'tasse-releve-vue': false } }, dialogue: 'occ-bienvenue' },
      { when: AUDIT_A_ANNONCER, dialogue: 'audit-annonce' },
    ],
  },
} satisfies Record<MapId, MapDefinition>;
