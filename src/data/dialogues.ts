import type { DialogueDef } from '@/data/types';

/**
 * Dialogues de l'Acte I (jalon M1, pause du Matin). Répliques canon : `docs/STORY_AND_LORE.md` § 6
 * (D1, D2, D3, D6, D7), reprises telles quelles sauf coupe en deux bulles ou accord épicène.
 * Règles : au plus 3 lignes d'environ 62 caractères par nœud ; jetons {prenom}, {objectif}, {heure},
 * {pause}, {fatigue}, {moral}, {tickets}. Combats simulés (M1) : le nœud qui suit un `battle` est l'après-combat.
 */
export const DIALOGUES = {
  // =========================================================================
  // Gare de Mons — fil principal
  // =========================================================================

  /** D1 — onEnter de la gare (nouvelle partie). */
  intro: {
    start: 'annonce1',
    nodes: {
      annonce1: {
        speaker: 'annonce',
        text: 'Ding-dong. Mesdames et messieurs, le train de 7h12 à destination de… est supprimé. Nous vous prions de nous excuser pour…',
        next: 'annonce2',
      },
      annonce2: { speaker: 'annonce', text: '… (grésillement)', next: 'heros1' },
      heros1: {
        speaker: 'heros',
        text: '… (troisième café, et toujours pas réveillé.)',
        next: 'rudy1',
      },
      rudy1: {
        speaker: 'rudy',
        text: 'Attention, attention… {prenom} ! T’as vu l’écran ? Le 7h12. Pas retardé. Supprimé.',
        choices: [
          { label: '« Raison de circulation ? »', next: 'rudy2' },
          { label: '« Grève ? »', next: 'rudy2' },
          { label: '… (soupir de fin de pause)', next: 'rudy2' },
        ],
      },
      rudy2: {
        speaker: 'rudy',
        text: 'Non. Il y a écrit « Optimisation ». Vingt ans de quai, j’ai jamais vu ce motif-là. Ça sent le frein qui chauffe.',
        next: 'josiane1',
      },
      josiane1: {
        speaker: 'josiane',
        text: '(Arrivant avec un thermos.) Le 7h12, c’est celui de ta grand-mère, non ? Le mardi, le marché ?',
        next: 'heros2',
      },
      heros2: {
        speaker: 'heros',
        text: 'Quarante ans qu’elle le prend. Elle dit bonjour au conducteur. Il lui répond.',
        next: 'josiane2',
      },
      josiane2: {
        speaker: 'josiane',
        text: 'Ça, c’est pas dans le règlement, mais c’est dans le cœur. Va voir au bureau du sous-chef.',
        next: 'josiane3',
      },
      josiane3: {
        speaker: 'josiane',
        text: 'L’imprimante crache des trucs bizarres depuis que les costumes sont venus.',
        next: 'rudy3',
      },
      rudy3: {
        speaker: 'rudy',
        text: 'Attention, attention… et prends ta clé. Il y a une borne qui mord, dans le hall.',
        next: 'tuto',
      },
      tuto: {
        speaker: 'systeme',
        text: 'Flèches ou ZQSD : se déplacer. E : parler, examiner. L’écran des départs affiche ton objectif.',
        effects: [{ kind: 'flag', flag: 'intro-vue' }],
      },
    },
  },

  /** Écrans des départs (quai 2 et hall) : journal de quêtes. */
  'ecran-departs': {
    start: 'ecran',
    nodes: {
      ecran: {
        speaker: 'systeme',
        text: 'IC 4211 — {objectif} — RETARD +∞',
        next: 'horloge',
      },
      horloge: {
        speaker: 'systeme',
        text: 'Il est {heure}. Pause en cours : {pause}. Ligne du bas : « 7h12 — SUPPRIMÉ — Optimisation ».',
      },
    },
  },

  /** Borne Automatique Rebelle (hall) : premier combat. */
  borne: {
    start: 'decor',
    nodes: {
      decor: {
        speaker: 'systeme',
        text: 'Borne automatique. Fond d’écran bleu. La fente à pièces crache des étincelles.',
        next: 'borne1',
      },
      borne1: {
        speaker: 'systeme',
        text: '« Veuillez insérer un moyen de paiement que je n’accepte pas. »',
        choices: [
          { label: 'Rends sa pièce au monsieur.', next: 'combat' },
          { label: '(Sortir la clé de tirefond)', next: 'combat' },
        ],
      },
      combat: {
        speaker: 'systeme',
        text: '« Votre transaction a été optimisée. Elle n’existe plus. » La borne passe à l’attaque !',
        effects: [{ kind: 'battle', encounter: 'borne-rebelle' }],
        next: 'apres',
      },
      apres: {
        speaker: 'systeme',
        text: 'La borne affiche « Mise à jour en cours » et rend 2 € au voyageur. Plus 40 centimes de 1998.',
        effects: [{ kind: 'flag', flag: 'borne-vaincue' }],
        next: 'voyageur',
      },
      voyageur: {
        speaker: 'voyageur',
        text: 'Merci ! Je vais aller au guichet, finalement. Il paraît qu’il en reste un.',
      },
    },
  },
  'borne-hs': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: '« Mise à jour en cours. Durée estimée : 6 à 18 mois. » La borne boude.',
      },
    },
  },
  'voyageur-borne': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'voyageur',
        text: 'Elle a mangé ma pièce de 2 €. Puis elle m’a demandé si j’étais satisfait. Je n’ose plus bouger.',
      },
    },
  },

  /** Bureau du sous-chef : l'imprimante et le dossier PHR-2030. */
  imprimante: {
    start: 'impression',
    nodes: {
      impression: {
        speaker: 'systeme',
        text: 'L’imprimante ronronne, toussote, et crache trois feuilles encore chaudes. En-tête : « Plan Horizon Rentabilité 2030 ».',
        next: 'slide1',
      },
      slide1: {
        speaker: 'systeme',
        text: 'Slide 12 : « Fermeture des guichets. Suppression des accompagnateurs. Expérience voyageur : 100 % autonome. »',
        next: 'slide2',
      },
      slide2: {
        speaker: 'systeme',
        text: 'Slide 31 : « Salle des pauses : capsules premium à 3,90 € en remplacement du café gratuit. »',
        next: 'slide3',
      },
      slide3: {
        speaker: 'systeme',
        text: 'Slide 58 : « Phase 3 : Cession ». En bas : Privatix Rail Solutions. « Le rail, en mieux. Pour vous. Pour nous surtout. »',
        next: 'heros',
      },
      heros: {
        speaker: 'heros',
        text: '(Le 7h12, c’était pas une erreur. C’était un plan.)',
        effects: [{ kind: 'flag', flag: 'dossier-trouve' }],
        next: 'pas',
      },
      pas: {
        speaker: 'systeme',
        text: 'Des pas pressés résonnent dans le hall. Quelqu’un cherche son impression.',
      },
    },
  },
  'imprimante-vide': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: '« Bourrage papier. » L’imprimante a dit tout ce qu’elle savait.',
      },
    },
  },
  'bureau-sous-chef': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Le bureau de Jean-Mi, le sous-chef. Un post-it : « En réunion (café) ». Une tasse : « Meilleur barista du roulement ».',
        next: 'brochure',
      },
      brochure: {
        speaker: 'systeme',
        text: 'Une brochure de Privatix, pliée en quatre, dépasse d’un tiroir. Tu la laisses où elle est.',
      },
    },
  },

  /** D6 — Consultant Junior devant le bureau du sous-chef, puis le héros finit sonné. */
  consultant: {
    start: 'c1',
    nodes: {
      c1: {
        speaker: 'consultant',
        text: 'Bonjour ! Vous êtes… une ressource terrain ? Génial. Je fais un benchmark de votre valeur ajoutée.',
        next: 'h1',
      },
      h1: { speaker: 'heros', text: 'Ma quoi ?', next: 'c2' },
      c2: {
        speaker: 'consultant',
        text: 'Votre value proposition. Au Japon, un agent gère douze quais avec une tablette. Vous, vous avez… un gilet orange et un thermos.',
        next: 'c3',
      },
      c3: {
        speaker: 'consultant',
        text: 'Et ces slides sont à moi. Vous n’avez pas le niveau d’habilitation pour les comprendre.',
        next: 'b1',
      },
      b1: { speaker: 'bene', text: 'Numéro suivant !', next: 'c4' },
      c4: { speaker: 'consultant', text: 'Je ne suis pas dans la file, madame.', next: 'b2' },
      b2: {
        speaker: 'bene',
        text: 'Tout le monde est dans la file. La file est éternelle.',
        next: 'c5',
      },
      c5: {
        speaker: 'consultant',
        text: 'Bon. On va devoir challenger votre poste. Je lance une slide de transition !',
        effects: [{ kind: 'battle', encounter: 'consultant-junior' }],
        next: 'c6',
      },
      c6: {
        speaker: 'consultant',
        text: 'Je… je vais faire un point avec mon manager… pour aligner les parties prenantes…',
        effects: [{ kind: 'flag', flag: 'consultant-vaincu' }],
        choices: [
          {
            label: '« Prends le train, ça te fera un retour terrain. »',
            next: 'c7',
            effects: [{ kind: 'moral', delta: 1 }],
          },
          { label: '« Laisse le PowerPoint et va-t’en. »', next: 'c7' },
        ],
      },
      c7: {
        speaker: 'consultant',
        text: '(Il fait volte-face, tablette levée.) Une dernière slide ! Un camembert. En pleine tempe.',
        next: 'sonne',
      },
      sonne: {
        speaker: 'systeme',
        text: 'Tout tourne. Des parts de marché dansent devant tes yeux… Noir.',
        effects: [{ kind: 'teleport', map: 'gare-couloir-technique', spawn: 'sonne' }],
      },
    },
  },

  // =========================================================================
  // Couloir technique — D2 (première moitié) et distributeur
  // =========================================================================

  'marcel-couloir': {
    start: 'm1',
    nodes: {
      m1: {
        speaker: 'marcel',
        text: 'Tu tiens debout ? Le gamin en costume t’a pas raté. Il t’a frappé avec quoi ?',
        next: 'h1',
      },
      h1: { speaker: 'heros', text: 'Un graphique en camembert.', next: 'm2' },
      m2: {
        speaker: 'marcel',
        text: 'Les pires. De mon temps, on se battait avec des horaires papier. Ça faisait mal, mais honnêtement.',
        next: 'm3',
      },
      m3: {
        speaker: 'marcel',
        text: 'Marcel. Conducteur. Retraité depuis 2011, officiellement. Officieusement, je suis toujours là.',
        next: 'm4',
      },
      m4: {
        speaker: 'marcel',
        text: 'Regarde bien, je le fais qu’une fois. Sept expresso. Un lungo. Deux sucres.',
        effects: [{ kind: 'flag', flag: 'code-occ-connu' }],
        next: 'd1',
      },
      d1: {
        speaker: 'distributeur',
        text: 'Boisson indisponible pour raison de circulation.',
        next: 'mur',
      },
      mur: {
        speaker: 'systeme',
        text: 'Le mur pivote dans un grincement. Lumières rouges, vertes, blanches.',
        effects: [
          { kind: 'flag', flag: 'occ-decouverte' },
          { kind: 'teleport', map: 'occ', spawn: 'entree' },
        ],
      },
    },
  },
  'distributeur-hs': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'distributeur',
        text: 'HORS SERVICE',
        next: 'decor',
      },
      decor: {
        speaker: 'systeme',
        text: 'Écrit au marqueur. Les boutons Expresso, Lungo et Sucre + sont usés jusqu’au métal. Bizarre, pour une machine en panne.',
      },
    },
  },
  'distributeur-code': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Le distributeur « HORS SERVICE ». Sept expresso, un lungo, deux sucres : tu connais la chanson.',
        choices: [
          { label: 'Composer le code', effects: [{ kind: 'keypad' }] },
          { label: 'Pas maintenant' },
        ],
      },
    },
  },
  'porte-personnel': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: '« Réservé au personnel — Accès interdit même au personnel. » Tu es du personnel. Tu passes quand même.',
      },
    },
  },
  'note-service-6': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'NOTE DE SERVICE — Tout local absent des plans est considéré comme inexistant. Il est donc interdit d’y entrer.',
        next: 'suite',
      },
      suite: {
        speaker: 'systeme',
        text: 'Puisqu’on ne peut pas y entrer. Toute personne surprise dans un local inexistant sera notée absente.',
      },
    },
  },
  'panneau-electrique': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Panneau électrique. Étiquette : « Ne pas toucher. Si ça saute, c’est pas nous, c’est l’autre boîte. »',
      },
    },
  },

  /** Quête de Josiane : le Post-it Vivant qui a volé son thermos. */
  'post-it': {
    start: 'decor',
    nodes: {
      decor: {
        speaker: 'systeme',
        text: 'Un carré jaune à petites pattes, une flèche dessinée au marqueur. Il serre un thermos fleuri gravé « Josiane ».',
        next: 'postit',
      },
      postit: {
        speaker: 'systeme',
        text: '« À FAIRE (un jour). » « Moi aussi j’ai été une priorité, en 2019. »',
        choices: [
          { label: '« Rends ce thermos. »', next: 'combat' },
          { label: '(Sortir la clé de tirefond)', next: 'combat' },
        ],
      },
      combat: {
        speaker: 'systeme',
        text: 'Le Post-it se décolle du mur et passe à l’attaque !',
        effects: [{ kind: 'battle', encounter: 'post-it-vivant' }],
        next: 'apres',
      },
      apres: {
        speaker: 'systeme',
        text: 'Le Post-it se froisse et glisse sous une porte. Il sera traité plus tard. Peut-être.',
        effects: [{ kind: 'flag', flag: 'thermos-retrouve' }],
        next: 'heros',
      },
      heros: {
        speaker: 'heros',
        text: '(Le thermos de Josiane. Encore tiède. À ramener au quai 2.)',
      },
    },
  },
  'post-it-froisse': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Le Post-it froissé marmonne « à relancer ». Personne ne le relancera.',
      },
    },
  },

  // =========================================================================
  // OCC — D2 (seconde moitié), D3 et la quête « Trois tasses, trois collègues »
  // =========================================================================

  'occ-bienvenue': {
    start: 'm1',
    nodes: {
      m1: {
        speaker: 'marcel',
        text: 'Bienvenue à l’OCC. Operation Coffee Center. La dernière salle des pauses qu’ils ont pas trouvée.',
        choices: [
          { label: '« C’est… une secte ? »', next: 'm2' },
          { label: '« C’est un café clandestin ? »', next: 'm2' },
          { label: '« Il y a des croissants ? »', next: 'm2' },
        ],
      },
      m2: {
        speaker: 'marcel',
        text: 'C’est une gare dans la gare. Ici on boit, on parle, et on laisse personne sur le quai.',
        next: 'm3',
      },
      m3: {
        speaker: 'marcel',
        text: '(Désignant la cafetière fumante.) Elle, c’est la Vieille Dame. Bois. Et grimace pas.',
        next: 'h1',
      },
      h1: { speaker: 'heros', text: '(Tu bois.) …', next: 'm4' },
      m4: {
        speaker: 'marcel',
        text: 'Pas une grimace. Jean-Mi, inscris : Stagiaire de la Cafetière.',
        next: 'j1',
      },
      j1: {
        speaker: 'jean-mi',
        text: 'Tout le monde grimace la première fois, normalement. Mais bon. Bienvenue, collègue.',
        next: 'f1',
      },
      f1: {
        speaker: 'fatou',
        text: 'Avant toute chose : depuis quand tu n’as pas fait ta pause légale ?',
        choices: [
          { label: '« Hier ? »', next: 'f2' },
          { label: '« C’est quoi, une pause légale ? »', next: 'f2' },
          { label: '« Je fais du 3x8, je ne sais plus quel jour on est. »', next: 'f2' },
        ],
      },
      f2: {
        speaker: 'fatou',
        text: 'C’est bien ce que je pensais. Viens. Ici, la machine à café, c’est la vie.',
        next: 'f3',
      },
      f3: {
        speaker: 'fatou',
        text: 'Je note ta progression, je soigne tes bleus, et tu as droit à un café gratuit par pause. Un seul. Le deuxième, c’est de l’automédication.',
        next: 'm5',
      },
      m5: {
        speaker: 'marcel',
        text: 'Et à chaque changement d’équipe, on fait la Tasse de Relève. L’équipe qui sort sert ceux qui entrent. Debout. En silence.',
        next: 'j2',
      },
      j2: {
        speaker: 'jean-mi',
        text: 'Ristretto pour cogner, lungo pour tenir, cappuccino pour encaisser, chocolat pour les jours sans. Franchement, faut être réaliste : le déca, on n’en a pas.',
        next: 'j3',
      },
      j3: {
        speaker: 'jean-mi',
        text: 'Alors, pour la Tasse de Relève du {pause} ? Le buff tient jusqu’à la fin de la pause.',
        choices: [
          {
            label: 'Ristretto : Fatigue −10, Caféiné en combat',
            next: 'm6',
            effects: [{ kind: 'drink', drink: 'ristretto' }],
          },
          {
            label: 'Lungo : PV max +10 %, Fatigue plus lente',
            next: 'm6',
            effects: [{ kind: 'drink', drink: 'lungo' }],
          },
          {
            label: 'Cappuccino : Défense +10 %, résiste au Sommeil',
            next: 'm6',
            effects: [{ kind: 'drink', drink: 'cappuccino' }],
          },
          {
            label: 'Chocolat chaud : petit soin à chaque tour',
            next: 'm6',
            effects: [{ kind: 'drink', drink: 'chocolat' }],
          },
        ],
      },
      m6: {
        speaker: 'marcel',
        text: '(Tendant la tasse.) Rien à signaler…',
        choices: [
          { label: '« … sauf tout. »', next: 'm7' },
          { label: '« … à part qu’on supprime mon train. »', next: 'm7' },
        ],
      },
      m7: {
        speaker: 'marcel',
        text: 'Bien reçu. On prend la voie.',
        effects: [{ kind: 'flag', flag: 'tasse-releve-vue' }],
        next: 'q1',
      },
      q1: {
        speaker: 'marcel',
        text: 'Bon. Ton PHR-2030, là. Tout seul, on arrête pas un train. Même pas un omnibus.',
        next: 'q2',
      },
      q2: {
        speaker: 'marcel',
        text: 'Trois tasses, trois collègues : Josiane sur le quai 2, Rudy sur la passerelle, Béné au guichet du hall.',
        next: 'q3',
      },
      q3: {
        speaker: 'marcel',
        text: 'Chacun a un souci. Règle-le, ils viendront. Ici, on recrute pas avec un entretien : on recrute avec un coup de main.',
        effects: [{ kind: 'flag', flag: 'quete-trois-tasses' }],
        next: 'f4',
      },
      f4: {
        speaker: 'fatou',
        text: 'Et repasse ici quand tu tires la langue. Vieille Dame, canapé, lit de camp : sers-toi. C’est un ordre de la prévention.',
      },
    },
  },

  /** La Vieille Dame : sauvegarde + soin, café gratuit. */
  'vieille-dame': {
    start: 'menu',
    nodes: {
      menu: {
        speaker: 'systeme',
        text: 'La Vieille Dame siffle doucement. Inox cabossé, jamais détartrée. Fatigue de l’équipe : {fatigue}.',
        choices: [
          {
            label: 'Sauvegarder et se soigner',
            next: 'sauve',
            effects: [{ kind: 'save' }, { kind: 'heal' }],
          },
          { label: 'Café gratuit (1 fois par pause)', effects: [{ kind: 'rest', rest: 'coffee' }] },
          { label: 'Rien, merci' },
        ],
      },
      sauve: {
        speaker: 'fatou',
        text: 'C’est noté au registre. PV et PE au maximum. Hydratez-vous. Au café, de préférence.',
      },
    },
  },
  canape: {
    start: 'menu',
    nodes: {
      menu: {
        speaker: 'systeme',
        text: 'Un canapé de première classe, velours râpé. Il a connu des siestes historiques.',
        choices: [
          {
            label: 'Faire une sieste (Fatigue −40, horloge +2 h)',
            effects: [{ kind: 'rest', rest: 'nap' }],
          },
          { label: 'Pas maintenant' },
        ],
      },
    },
  },
  'lit-de-camp': {
    start: 'menu',
    nodes: {
      menu: {
        speaker: 'systeme',
        text: 'Le lit de camp. Commandement n° 4 : on ne réveille pas un 3x8 qui dort.',
        choices: [
          {
            label: 'Dormir (Fatigue à 0, l’horloge saute à la relève)',
            effects: [{ kind: 'rest', rest: 'sleep' }],
          },
          { label: 'Pas maintenant' },
        ],
      },
    },
  },
  'tableau-liege': {
    start: 'moral',
    nodes: {
      moral: {
        speaker: 'systeme',
        text: 'Tableau de liège. Moral de l’OCC : {moral}/100. Plus il est haut, plus on tient ensemble.',
        next: 'mission',
      },
      mission: {
        speaker: 'systeme',
        text: 'Mission en cours : {objectif}. Caisse commune : {tickets} Tickets.',
        next: 'roulements',
      },
      roulements: {
        speaker: 'systeme',
        text: 'Les roulements s’échangent ici, punaisés à la main. Jamais par mail.',
      },
    },
  },
  commandements: {
    start: 'titre',
    nodes: {
      titre: {
        speaker: 'systeme',
        text: 'Une plaque de quai récupérée, gravée : les 7 commandements de l’OCC.',
        next: 'c1',
      },
      c1: {
        speaker: 'systeme',
        text: '1. Tu ne laisseras jamais la cafetière vide. 2. Tu ne parleras pas de l’OCC en réunion. 3. Tu ne boiras point de déca.',
        next: 'c2',
      },
      c2: {
        speaker: 'systeme',
        text: '4. Tu respecteras la pause de ton collègue comme la tienne. 5. Tu ne diras pas « optimisation » sans mettre un Ticket dans la boîte à jurons.',
        next: 'c3',
      },
      c3: {
        speaker: 'systeme',
        text: '6. Tu laisseras ta tasse propre et ton ego au vestiaire. 7. Tu ne laisseras aucun collègue sur le quai.',
      },
    },
  },
  'boite-jurons': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'La boîte à jurons « Optimisation ». Elle déborde. Le mot est très utilisé, ces temps-ci.',
      },
    },
  },
  'photo-wagon-bar': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Photo encadrée : le wagon-bar, 1994. Un serveur élégant sourit. Derrière le comptoir, quelqu’un qui ressemble à ton grand-père.',
      },
    },
  },
  'comptoir-vide': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Un comptoir en formica. Pancarte : « Guichetière recherchée. Patience exigée, sourire facultatif. »',
      },
    },
  },
  'comptoir-bene': {
    start: 'bene',
    nodes: {
      bene: {
        speaker: 'bene',
        text: 'Numéro suivant ! Ici, ce sera ma boutique : de l’équipement contre des Tickets. Pour l’instant, inventaire.',
        next: 'info',
      },
      info: {
        speaker: 'systeme',
        text: 'La boutique de Béné ouvrira au prochain jalon. Tickets en poche : {tickets}.',
      },
    },
  },

  /** Marcel à l'OCC. */
  'marcel-occ': {
    start: 'm1',
    nodes: {
      m1: {
        speaker: 'marcel',
        text: 'Trois tasses, trois collègues : Josiane au quai 2, Rudy sur la passerelle, Béné au guichet du hall.',
        next: 'm2',
      },
      m2: {
        speaker: 'marcel',
        text: 'Et si t’es perdu·e, l’écran des départs te le dit. De mon temps, le retard, on l’appelait l’aventure.',
      },
    },
  },
  'audit-annonce': {
    start: 'm1',
    nodes: {
      m1: {
        speaker: 'marcel',
        text: 'Josiane, Rudy, Béné. Ça faisait longtemps que la Vieille Dame avait pas servi autant de tasses.',
        next: 'm2',
      },
      m2: {
        speaker: 'marcel',
        text: 'Mais regarde ce que Jean-Mi a imprimé. Un mail interne. Il imprime tout, ce garçon.',
        next: 'mail',
      },
      mail: {
        speaker: 'systeme',
        text: 'MAIL INTERNE — Objet : visite d’audit bienveillante. Un Manager KPI chronométrera les agents du quai 2. Merci de sourire.',
        next: 'rudy',
      },
      rudy: {
        speaker: 'rudy',
        text: 'Attention, attention… Il va chronométrer mes départs ? Ils sont à l’heure, mes départs !',
        next: 'josiane',
      },
      josiane: {
        speaker: 'josiane',
        text: 'Il va surtout chronométrer les gens. On y va ensemble, {prenom}.',
        next: 'm3',
      },
      m3: {
        speaker: 'marcel',
        text: 'Quai 2. Montre-lui ce qui rentre pas dans ses colonnes. Et prends un café avant : ses réunions endorment.',
        effects: [{ kind: 'flag', flag: 'audit-annonce' }],
      },
    },
  },
  'marcel-audit-rappel': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'marcel',
        text: 'Le Manager KPI t’attend sur le quai 2. Passe par la Vieille Dame d’abord : on va pas à une réunion à jeun.',
      },
    },
  },
  'marcel-fin': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'marcel',
        text: 'On est en résistance, maintenant. Officiellement. Enfin, officieusement. Tu m’as compris.',
      },
    },
  },
  'jean-mi': {
    start: 'j1',
    nodes: {
      j1: {
        speaker: 'jean-mi',
        text: 'Franchement, faut être réaliste : la Vieille Dame, elle tiendra pas éternellement. Moi non plus.',
        next: 'j2',
      },
      j2: {
        speaker: 'jean-mi',
        text: 'Des fois je rêve d’un horaire de bureau. Un badge qui bipe vert. Rêver, c’est gratuit. Pour l’instant.',
      },
    },
  },
  fatou: {
    start: 'f1',
    nodes: {
      f1: {
        speaker: 'fatou',
        text: 'Hydratez-vous. Au café, de préférence. Ta Fatigue est à {fatigue}.',
        next: 'f2',
      },
      f2: {
        speaker: 'fatou',
        text: 'Le canapé et le lit de camp sont là pour ça. La pause, c’est pas un luxe : c’est un équipement de sécurité.',
      },
    },
  },
  'josiane-occ': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'josiane',
        text: 'Ici, je pose mon thermos sans le surveiller. C’est ça, une vraie gare.',
      },
    },
  },
  'rudy-occ': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'rudy',
        text: 'Attention, attention… Sous la passerelle, tout ce temps. Moi qui croyais tout voir d’en haut.',
      },
    },
  },
  'bene-occ': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'bene',
        text: 'Ici, il n’y a pas de file. Ça me déstabilise un peu. Je vais m’y faire.',
      },
    },
  },

  // =========================================================================
  // Trois tasses, trois collègues
  // =========================================================================

  'josiane-imprimante': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'josiane',
        text: 'Le bureau du sous-chef, c’est dans le hall, à gauche. Jean-Mi y est jamais. L’imprimante, si.',
      },
    },
  },
  'josiane-quai': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'josiane',
        text: 'Mon thermos et moi, on fait le quai 2 depuis 28 ans. Lui, il a jamais demandé de mutation.',
      },
    },
  },
  'josiane-thermos': {
    start: 'j1',
    nodes: {
      j1: {
        speaker: 'josiane',
        text: '{prenom}… On m’a volé mon thermos. Posé deux minutes sur le banc, et pfft.',
        choices: [
          { label: '« Qui ferait ça ? »', next: 'j3' },
          { label: '« Un thermos, ça se remplace. »', next: 'j2' },
        ],
      },
      j2: {
        speaker: 'josiane',
        text: 'Pas celui-là. Il a fait trois grèves, deux Doudous et un sanglier.',
        next: 'j3',
      },
      j3: {
        speaker: 'josiane',
        text: 'J’ai vu un carré jaune à pattes filer vers le couloir technique. Ramène-le-moi, et on parlera de ton OCC.',
      },
    },
  },
  'josiane-recrutement': {
    start: 'h1',
    nodes: {
      h1: {
        speaker: 'heros',
        text: '(Tu tends le thermos.) Il était tenu par un Post-it. Il voulait devenir une priorité.',
        next: 'j1',
      },
      j1: {
        speaker: 'josiane',
        text: 'Mon thermos ! Encore tiède, en plus. Ce petit a du métier.',
        next: 'j2',
      },
      j2: {
        speaker: 'josiane',
        text: 'L’OCC, Marcel m’en parle depuis vingt ans. J’ai toujours dit non : j’avais mon thermos.',
        next: 'j3',
      },
      j3: {
        speaker: 'josiane',
        text: 'Mais s’ils veulent vendre jusqu’à notre café… Je viens. Personne ne reste sur le quai.',
        effects: [
          { kind: 'flag', flag: 'josiane-recrutee' },
          { kind: 'moral', delta: 5 },
        ],
        next: 'fin',
      },
      fin: {
        speaker: 'systeme',
        text: 'Josiane rejoint l’OCC ! Moral de l’équipe : {moral}.',
      },
    },
  },

  'rudy-borne': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'rudy',
        text: 'Attention, attention… La borne du hall a encore mordu un voyageur. Prends ta clé, vise l’écran bleu.',
      },
    },
  },
  'rudy-passerelle': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'rudy',
        text: 'Attention, attention… D’ici, je vois tout : les retards, les pigeons, les costumes. Surtout les costumes.',
      },
    },
  },
  'rudy-sifflet': {
    start: 'r1',
    nodes: {
      r1: {
        speaker: 'rudy',
        text: 'Attention, attention… catastrophe. Mon sifflet est tombé dans l’escalator B, côté quai 3.',
        next: 'r2',
      },
      r2: {
        speaker: 'rudy',
        text: 'Un chef de quai sans sifflet, c’est un train sans freins. Ou une réunion sans fin.',
        choices: [
          { label: '« J’y vais. »', next: 'r3' },
          { label: '« Tu peux pas siffler avec les doigts ? »', next: 'r4' },
        ],
      },
      r3: {
        speaker: 'rudy',
        text: 'Il marche un jour sur trois, cet escalator. Aujourd’hui, c’est pas le bon jour. Ramène-moi mon sifflet.',
      },
      r4: {
        speaker: 'rudy',
        text: 'Avec les doigts ? Je suis chef de quai, pas berger. L’escalator B, côté quai 3. S’il te plaît.',
      },
    },
  },
  escalator: {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Escalator B. « Plan sobriété : les escalators fonctionnent un jour sur trois. » Aujourd’hui : non.',
      },
    },
  },
  'escalator-sifflet': {
    start: 'e1',
    nodes: {
      e1: {
        speaker: 'systeme',
        text: 'Escalator B, à l’arrêt. Entre deux marches, un éclat de chrome : le sifflet de Rudy.',
        choices: [
          { label: 'Glisser la clé de tirefond et faire levier', next: 'e2' },
          { label: 'Attendre qu’il redémarre', next: 'e4' },
        ],
      },
      e2: {
        speaker: 'systeme',
        text: 'Clang. La marche cède, le sifflet saute. Un cabinet aurait mis trois semaines et un appel d’offres.',
        effects: [{ kind: 'flag', flag: 'sifflet-recupere' }],
        next: 'e3',
      },
      e3: {
        speaker: 'heros',
        text: '(Gravé sur le sifflet : « Départ à l’heure, toujours ». À ramener à Rudy, sur la passerelle.)',
      },
      e4: {
        speaker: 'systeme',
        text: 'Tu attends dix minutes. L’escalator aussi. D’après le roulement, il redémarre après-demain.',
        effects: [{ kind: 'time', minutes: 10 }],
      },
    },
  },
  'rudy-recrutement': {
    start: 'h1',
    nodes: {
      h1: {
        speaker: 'heros',
        text: 'Ton sifflet. L’escalator a résisté. Pas longtemps.',
        next: 'r1',
      },
      r1: {
        speaker: 'rudy',
        text: 'Mon sifflet ! (Tuuuut.) Voilà. Le monde est de nouveau à l’heure.',
        next: 'r2',
      },
      r2: {
        speaker: 'rudy',
        text: 'Une salle des pauses secrète sous MA passerelle, et j’étais pas au courant ? Moi qui vois tout ?',
        next: 'r3',
      },
      r3: {
        speaker: 'rudy',
        text: 'Compte sur moi. Quand je siffle, les portes se ferment. Même celles des salles de réunion.',
        effects: [
          { kind: 'flag', flag: 'rudy-recrute' },
          { kind: 'moral', delta: 5 },
        ],
        next: 'fin',
      },
      fin: {
        speaker: 'systeme',
        text: 'Rudy rejoint l’OCC ! Moral de l’équipe : {moral}.',
      },
    },
  },

  'bene-guichet': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'bene',
        text: 'Numéro suivant ! … Ah, c’est toi. Dernier guichet ouvert de la gare. Quatre réformes tarifaires. Toujours là.',
      },
    },
  },
  'bene-file': {
    start: 'b1',
    nodes: {
      b1: {
        speaker: 'bene',
        text: 'Toi, tu viens de la part de Marcel. Ça se voit : t’as l’air d’avoir bu du vrai café.',
        next: 'b2',
      },
      b2: {
        speaker: 'bene',
        text: 'Je veux bien t’écouter. Mais d’abord, la file. Trois voyageurs. Renseigne-les, et on parle.',
        choices: [
          { label: '« Elle est pas éternelle, ta file ? »', next: 'b3' },
          { label: '« Je m’en occupe. »' },
        ],
      },
      b3: {
        speaker: 'bene',
        text: 'Si. Mais on peut la raccourcir. C’est la seule chose qu’on raccourcit ici sans plan social.',
      },
    },
  },
  'bene-recrutement': {
    start: 'b1',
    nodes: {
      b1: {
        speaker: 'bene',
        text: 'La file est vide. Ça m’arrive une fois par réforme. Tu as le sens du public, {prenom}.',
        next: 'b2',
      },
      b2: {
        speaker: 'bene',
        text: 'Ils veulent remplacer mon guichet par un écran tactile et une plante en plastique. Ton OCC, j’en suis.',
        next: 'b3',
      },
      b3: {
        speaker: 'bene',
        text: 'Je ferme. Pancarte : « Partie en pause. Légale. »',
        effects: [
          { kind: 'flag', flag: 'bene-recrutee' },
          { kind: 'moral', delta: 5 },
        ],
        next: 'fin',
      },
      fin: {
        speaker: 'systeme',
        text: 'Béné rejoint l’OCC ! Moral de l’équipe : {moral}.',
      },
    },
  },
  'guichet-2': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Guichet 2. Fermé depuis la réforme de 2009. Une plante en plastique y fait l’intérim.',
      },
    },
  },
  'guichet-ferme': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Sur le guichet 1, une pancarte : « Partie en pause. Légale. Numéro suivant à mon retour. — Béné »',
      },
    },
  },
  'voyageur-file': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'voyageur',
        text: 'J’attends mon tour. La dame du guichet dit que la file est éternelle. Je commence à la croire.',
      },
    },
  },
  'voyageur-merci': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'voyageur',
        text: 'Merci encore. Un humain m’a renseigné. Ma sœur ne va jamais me croire.',
      },
    },
  },
  'voyageur-1': {
    start: 'question',
    nodes: {
      question: {
        speaker: 'voyageur',
        text: 'Pardon : le train pour Bruxelles, c’est quel quai ? L’écran dit « quai : à confirmer ».',
        choices: [
          { label: '« Quai 3, par la passerelle. »', next: 'merci' },
          { label: '« Le quai est en cours de validation. »', next: 'perdu' },
          { label: '… (soupir de fin de pause)', next: 'soupir' },
        ],
      },
      perdu: {
        speaker: 'voyageur',
        text: 'Vous parlez comme l’écran. Je repose ma question, alors.',
        next: 'question',
      },
      soupir: {
        speaker: 'voyageur',
        text: 'Je comprends. Moi aussi, je suis debout depuis 4h. Mais… le quai ?',
        next: 'question',
      },
      merci: {
        speaker: 'voyageur',
        text: 'Quai 3 ! Une réponse avec un chiffre dedans. Merci, vraiment.',
        effects: [{ kind: 'flag', flag: 'voyageur-1-renseigne' }],
      },
    },
  },
  'voyageur-2': {
    start: 'question',
    nodes: {
      question: {
        speaker: 'voyageur',
        text: 'Mon billet est « valable 2 heures ». Mon train a 3 heures de retard. Je dois racheter un billet ?',
        choices: [
          { label: '« Non : le retard est pour nous. Gardez-le. »', next: 'merci' },
          { label: '« On ne dit plus retard, on dit avance différée. »', next: 'perdu' },
        ],
      },
      perdu: {
        speaker: 'voyageur',
        text: 'Une avance… différée ? Vous allez bien ? Je reformule : je paie deux fois ou pas ?',
        next: 'question',
      },
      merci: {
        speaker: 'voyageur',
        text: 'Ah ! Enfin une bonne nouvelle ce matin. Je le garde précieusement, ce billet.',
        effects: [{ kind: 'flag', flag: 'voyageur-2-renseigne' }],
      },
    },
  },
  'voyageur-3': {
    start: 'question',
    nodes: {
      question: {
        speaker: 'voyageur',
        text: 'Je veux réserver une place pour mon vélo. L’application me dit d’aller au guichet. Le guichet me dit d’attendre.',
        choices: [
          { label: '« Donnez, je vous fais ça à la main. »', next: 'merci' },
          { label: '« Vous avez essayé de redémarrer la gare ? »', next: 'perdu' },
        ],
      },
      perdu: {
        speaker: 'voyageur',
        text: 'Redémarrer la gare ? Je n’ai pas le temps, mon train part dans… on ne sait pas. Alors, ce vélo ?',
        next: 'question',
      },
      merci: {
        speaker: 'voyageur',
        text: 'À la main ? Sur du papier ? Mon vélo et moi, on vous remercie.',
        effects: [{ kind: 'flag', flag: 'voyageur-3-renseigne' }],
      },
    },
  },

  // =========================================================================
  // D7 — L'audit des quais (mini-boss de fin d'Acte I)
  // =========================================================================

  audit: {
    start: 'k1',
    nodes: {
      k1: {
        speaker: 'manager-kpi',
        text: '(Chronomètre en main.) Agent {prenom}. Vous avez mis 47 secondes pour renseigner une dame âgée. Le standard est de 12.',
        next: 'h1',
      },
      h1: {
        speaker: 'heros',
        text: 'Elle cherchait le quai de son petit-fils. Il était sur le mauvais.',
        next: 'k2',
      },
      k2: {
        speaker: 'manager-kpi',
        text: 'Votre ressenti est intéressant. Il n’est dans aucune colonne.',
        next: 'j1',
      },
      j1: {
        speaker: 'josiane',
        text: 'Il y a une colonne pour « a évité qu’une dame de 80 ans prenne le train pour Lille » ?',
        next: 'k3',
      },
      k3: {
        speaker: 'manager-kpi',
        text: 'Pas encore. Je vais créer un indicateur. (Il ouvre son tableau de bord.) Réunion d’alignement. Maintenant. Deux heures. Personne ne sort.',
        effects: [{ kind: 'battle', encounter: 'audit-manager-kpi' }],
        next: 'k4',
      },
      k4: {
        speaker: 'manager-kpi',
        text: 'Impossible… mes indicateurs étaient verts…',
        choices: [
          { label: '« Ils étaient verts parce que tu comptais pas les gens. »', next: 'radio' },
          { label: '… (soupir de fin de pause)', next: 'radio' },
        ],
      },
      radio: {
        speaker: 'marcel',
        text: '(À la radio.) Bien joué. À partir de maintenant, c’est officiel : on est en résistance.',
        effects: [
          { kind: 'flag', flag: 'audit-vaincu' },
          { kind: 'moral', delta: 5 },
        ],
        next: 'quai',
      },
      quai: {
        speaker: 'systeme',
        text: 'Le Manager KPI part « consolider ses données ». Sur le quai 2, quelqu’un applaudit. Puis tout le quai.',
        next: 'fin',
      },
      fin: {
        speaker: 'systeme',
        text: 'FIN DE L’ACTE I — « Le 7h12 n’est pas venu ». Les rebelles entrent officiellement en résistance…',
        effects: [{ kind: 'nextAct' }],
        next: 'suite',
      },
      suite: {
        speaker: 'systeme',
        text: 'Relève de 14h00 : la pause de l’Après-midi commence. La suite au prochain jalon.',
      },
    },
  },

  // =========================================================================
  // Salle des pauses et décor de la gare
  // =========================================================================

  'tableau-roulements': {
    start: 't1',
    nodes: {
      t1: {
        speaker: 'systeme',
        text: 'Tableau des roulements. Des flèches partout, et une épingle sur aujourd’hui.',
        next: 't2',
      },
      t2: {
        speaker: 'systeme',
        text: 'Il est {heure}. Pause en cours : {pause}. Fatigue de l’équipe : {fatigue}.',
        next: 't3',
      },
      t3: {
        speaker: 'systeme',
        text: 'Au feutre, dans la marge : « Mon samedi est en cours de validation depuis mars. »',
      },
    },
  },
  frigo: {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Frigo collectif. Étiquette : « Ce yaourt appartient à Rudy. Je sais compter. — Rudy »',
        next: 'fond',
      },
      fond: {
        speaker: 'systeme',
        text: 'Au fond, une soupe sans nom date de l’ancienne gare. Personne n’ose la déclarer.',
      },
    },
  },
  'micro-ondes': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Le micro-ondes sacré. Il a survécu à trois déménagements et à une soupe au chicon.',
        next: 'note',
      },
      note: {
        speaker: 'systeme',
        text: 'Note de service scotchée : « Accès sur réservation, par créneaux de 47 secondes, via l’application (bientôt disponible). »',
      },
    },
  },
  capsules: {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Distributeur à capsules premium. 3,90 € la tasse. Écran : « Votre pause, en mieux. »',
        choices: [
          { label: 'Payer 3,90 €', next: 'payer' },
          { label: 'Non merci, j’ai des principes' },
        ],
      },
      payer: {
        speaker: 'systeme',
        text: '« Paiement sans contact uniquement. » Le sans contact est hors service. La pause aussi, du coup.',
      },
    },
  },
  'ragots-1': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Sur la table, un gobelet tiède et un ragot : des costumes ont mesuré le micro-ondes. Pour voir s’il est « scalable ».',
      },
    },
  },
  'ragots-2': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Ragot du jour, griffonné sur une serviette : un agent du quai 2 a mis un consultant en réunion permanente.',
      },
    },
  },
  'ragots-3': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Ragot du jour : Josiane, Rudy et Béné prennent leur pause en même temps. Personne ne sait où. Tout le monde sourit.',
      },
    },
  },
  'ragots-4': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Ragot du jour : un Manager KPI se serait endormi dans sa propre réunion. Personne ne l’a réveillé. Commandement n° 4.',
      },
    },
  },
  casiers: {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Les casiers. Sur celui de Josiane : « Mon thermos a plus d’ancienneté que vos stratégies. »',
      },
    },
  },
  tablier: {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Un tablier plié avec soin. Brodé : « Wagon-bar — Service à la place ». Qui l’a laissé ici ?',
      },
    },
  },
  'note-service-1': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'NOTE DE SERVICE — Les retards inférieurs à 14 minutes seront désormais qualifiés d’« avances différées ».',
      },
    },
  },
  'banc-marcel': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Un banc. Gravé au canif : « Réservé à Marcel. Il attend un train qui n’existe plus. »',
      },
    },
  },
  pigeon: {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Un pigeon bagué : Matricule 4412. Il te dévisage comme un contrôleur. Il n’a pas de titre de transport.',
      },
    },
  },
  neon: {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Néon publicitaire : « Mons 2030 : une gare, zéro guichet, 100 % digitale ». Le « 100 % » clignote.',
      },
    },
  },
  'sortie-ville': {
    start: 'texte',
    nodes: {
      texte: {
        speaker: 'systeme',
        text: 'Sortie vers la ville. Dehors, une drache de fin du monde. Ton service, lui, est en gare.',
        next: 'info',
      },
      info: {
        speaker: 'systeme',
        text: 'La ville (Passage du Centre, Grand-Place) ouvre à l’Acte II, au prochain jalon.',
      },
    },
  },

  // =========================================================================
  // Système
  // =========================================================================

  /** Mise à pied (GDD § 5.8) : le moteur applique les pénalités ; ce dialogue n'en applique aucune. */
  'mise-a-pied': {
    start: 'avis',
    nodes: {
      avis: {
        speaker: 'systeme',
        text: 'MISE À PIED. Motif officiel : « manque d’alignement avec les objectifs stratégiques ».',
        next: 'chariot',
      },
      chariot: {
        speaker: 'systeme',
        text: 'Des collègues t’ont ramené·e sur un chariot à bagages. Le chariot, lui, va bien.',
        next: 'retenue',
      },
      retenue: {
        speaker: 'systeme',
        text: 'Retenue sur les Tickets, moral un peu cabossé. Mais personne ne reste sur le quai.',
        next: 'bilan',
      },
      bilan: {
        speaker: 'systeme',
        text: 'Fatigue : {fatigue}. Moral : {moral}. Tickets : {tickets}. Il est {heure}.',
      },
    },
  },
} satisfies Record<string, DialogueDef>;

export type DialogueId = keyof typeof DIALOGUES;
