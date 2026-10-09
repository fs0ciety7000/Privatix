// Répliques à enregistrer (VF). Source : jeu (src/sim/hub/stations.ts NPC_LINES, src/sim/biomes.ts,
// src/sim/enemies/*), lore (docs/LORE.md § 4, § 7, § 8) ou nouvelles (écrites pour l'audio, même ton).
//
// Champs : voice, ctx (contexte de jeu / déclencheur), text (texte envoyé au TTS, balises d'émotion
// eleven_v3 entre crochets, nombres écrits en lettres), emo (direction d'émotion), src ('jeu' | 'lore'
// | 'nouveau'), sample (lot d'écoute), fictive (réplique fictive de l'Invité d'honneur), radio
// (traitement radio en post), takes (prises, 2 par défaut).
//
// Règles de ton (LORE § 1.4) : bark en run ≤ 8 mots ; tic au plus une fois par scène ; vaincus, pas
// morts ; aucune citation réelle ; aucun parti, slogan ou cliché d'accent.

const L = (voice, ctx, text, emo, extra = {}) => ({
  voice,
  ctx,
  text,
  emo,
  src: 'nouveau',
  ...extra,
});
const J = (voice, ctx, text, emo, extra = {}) => L(voice, ctx, text, emo, { src: 'jeu', ...extra });
const O = (voice, ctx, text, emo, extra = {}) =>
  L(voice, ctx, text, emo, { src: 'lore', ...extra });

// ─── Héros (mêmes textes pour Léon et Léa) ──────────────────────────────────
const HERO = [
  [
    'effort.coup1',
    '[short effort grunt] Hm !',
    'effort bref, expiration (coup 1, Serrage)',
    { takes: 4 },
  ],
  [
    'effort.coup2',
    '[effort grunt] Hah !',
    'effort bref, un peu plus appuyé (coup 2, Desserrage)',
    { takes: 4 },
  ],
  [
    'effort.coup3',
    '[strained grunt] Hnnh… HA !',
    'effort lourd, on force sur le tire-fond (coup 3)',
    { takes: 4, sample: true },
  ],
  ['effort.dash', '[quick exhale] Hup !', 'souffle court (dash « Retard »)', { takes: 3 }],
  [
    'effort.sifflet',
    '[deep breath] Tout le monde… dehors !',
    'inspiration puis voix projetée (Coup de sifflet)',
    { takes: 2 },
  ],
  [
    'effort.preavis',
    '[shouting] Préavis déposé !',
    'cri de rassemblement, pas de rage (Préavis de grève)',
    { takes: 2 },
  ],
  ['douleur.legere', '[pained grunt] Ah…', 'douleur brève (dégâts légers)', { takes: 4 }],
  [
    'douleur.lourde',
    '[pained gasp] Aïe… ça, c’était pas au planning.',
    'douleur + ironie (gros coup)',
    { takes: 2 },
  ],
  ['ko', '[exhausted sigh] … Fin de service.', 'tombe, épuisé, pas tragique (mort)', { takes: 2 }],
  ['cafe', '[sips] [satisfied exhale] Ah. Voilà.', 'gorgée et soulagement (Gobelet)', { takes: 3 }],
  [
    'soupir',
    '[long sigh] …',
    'soupir de fin de pause (réplique canonique)',
    { takes: 3, src: 'lore' },
  ],
  ['bark.debut', 'Bon. On y va.', 'sobre, prise de poste (entrée en run)', {}],
  ['bark.salle', 'Salle tenue.', 'satisfaction retenue (salle nettoyée)', {}],
  ['bark.energie', '[tired] Faut que je boive un café.', 'Énergie < 30 %', {}],
  ['bark.burnout', '[through gritted teeth] Je suis en pause, là.', 'Burnout palier 3', {}],
  ['bark.petage', '[shouting] Ça suffit !', 'Pétage de plombs (une seule fois)', {}],
  ['bark.loot', 'Ça, c’est du patrimoine.', 'loot Patrimoine au sol, émerveillement discret', {}],
  ['bark.dashparfait', '[dry] Retard indépendant de ma volonté.', 'premier dash parfait', {}],
  [
    'bark.consultant',
    'Votre titre de transport, s’il vous plaît.',
    'pince-sans-rire (Consultant)',
    {},
  ],
  [
    'boss.signature',
    'On vient arrêter la signature.',
    'calme, déterminé (intro Lurcke)',
    { src: 'lore' },
  ],
  [
    'boss.article47',
    'Article quarante-sept, alinéa trois : préavis de sept jours.',
    'lu au règlement, triomphe sec (Fluidifieur)',
    { src: 'jeu' },
  ],
  [
    'boss.preuve',
    'Ceci a été présenté au comité. Ceci n’a jamais été montré au terrain.',
    'Preuve activée, fermeté (Lurcke phase 2)',
    { src: 'lore' },
  ],
  [
    'boss.question',
    '[quietly] Mais concrètement… sur le terrain, ça donne quoi ?',
    'LA question finale : calme, presque doux, silence autour',
    { src: 'jeu', takes: 4, sample: true },
  ],
];

const HERO_LINES = ['leon', 'lea'].flatMap((voice) =>
  HERO.map(([id, text, emo, x]) => ({
    voice,
    id: `${voice}.${id}`,
    ctx: emo.split('(')[1]?.replace(')', '') ?? id,
    text,
    emo,
    src: 'nouveau',
    ...x,
    // Lot d'écoute : 2 répliques par voix clé (le coup 3 et la question finale).
    sample: Boolean(x.sample),
  })),
);

// ─── PNJ du Centre Opérationnel ─────────────────────────────────────────────
const NPC = [
  // Marcel
  J(
    'marcel',
    'OCC, générique',
    'De mon temps, le retard, on l’appelait l’aventure. [chuckles] Maintenant, ils l’appellent un KPI.',
    'bourru, amusé',
    { sample: true },
  ),
  J(
    'marcel',
    'OCC, générique (Tableau)',
    'Le Tableau des revendications, fieu. Chaque PS, c’est un acquis.',
    'fier, didactique',
  ),
  J(
    'marcel',
    'OCC, après une mort',
    'Ça va, fieu ? T’as eu une aventure courte. [warmly] Allez, une tasse et on y retourne.',
    'tendresse bourrue',
    { sample: true },
  ),
  J(
    'marcel',
    'OCC, après une victoire',
    'Ils ont reprogrammé ? Bien. Tant qu’ils reprogramment, on existe.',
    'satisfaction grave',
  ),
  O(
    'marcel',
    'OCC, mort par un Consultant (runCount ≤ 3)',
    'Battu par un gamin en baskets blanches ? De mon temps, ils avaient au moins des chaussures.',
    'taquin',
  ),
  O(
    'marcel',
    'OCC, jauge de signature pleine',
    'Il a signé ? … Non. Regarde l’écran : reprogrammé. Le Sondage est de notre côté, fieu. Pour l’instant.',
    'soulagement teinté d’inquiétude',
  ),
  O(
    'marcel',
    'Radio, défaite de l’Invité d’honneur',
    'De mon temps, on inaugurait les gares. Pas leur vente.',
    'grave, radio',
    { radio: true },
  ),
  O(
    'marcel',
    'OCC, serment (relation 3)',
    '[softly] Tant que je respire, la porte s’ouvre.',
    'serment, ému, retenu',
  ),
  L(
    'marcel',
    'Radio, Avantage D’antan proposé',
    'De mon temps, on frappait d’abord. Tiens.',
    'bark radio',
    { radio: true },
  ),
  L(
    'marcel',
    'OCC, accueil au retour (remplissage)',
    'Assieds-toi deux minutes. Le Sondage attendra. Il attend toujours.',
    'bienveillant',
  ),
  // Fatou
  J('fatou', 'OCC, générique', 'Hydrate-toi. Au café, de préférence.', 'douce, souriante'),
  J(
    'fatou',
    'OCC, générique (statistiques)',
    'Ton Burnout de fin de Shift était à quatre-vingt-sept. Je l’ai noté. En rouge. Avec un cœur, pour adoucir.',
    'précise, tendre',
    { sample: true },
  ),
  J(
    'fatou',
    'OCC, après une mort',
    'Arrêt de travail de zéro jour. Bienvenue. Tu avais deux Gobelets pleins, je précise.',
    'calme reproche',
    { sample: true },
  ),
  J(
    'fatou',
    'OCC, après une victoire',
    'Quatorze heures de service sans pause réglementaire. Bravo. Je fais un signalement.',
    'fierté administrative',
  ),
  O(
    'fatou',
    'Radio, premier Pétage de plombs',
    '[calmly] Ton Burnout est à cent. Respire. Frappe. Mais respire. On en parle à l’OCC.',
    'calme absolu dans le chaos',
    { radio: true },
  ),
  O(
    'fatou',
    'OCC, mort en Pétage de plombs',
    'Tu as pété un plomb et tu en as perdu huit d’Énergie max. Le corps note tout, même quand le roulement oublie.',
    'sérieux bienveillant',
  ),
  O('fatou', 'OCC, serment (relation 3)', 'Personne ne tombe sans que je le sache.', 'serment'),
  L(
    'fatou',
    'Radio, Avantage Prévention proposé',
    'Un bouclier. Ce n’est pas négociable.',
    'bark radio',
    { radio: true },
  ),
  L(
    'fatou',
    'Radio, Énergie basse',
    'Ton Énergie baisse. Un Gobelet. Maintenant.',
    'ferme, douce',
    { radio: true },
  ),
  // Yasmina (radio)
  J(
    'yasmina',
    'OCC, générique (roulement)',
    'Roulement de nuit. Moins de monde, plus de cadres. Je te mets le biome un en orange.',
    'stratège posée',
  ),
  J(
    'yasmina',
    'OCC, après une mort',
    'Incident voyageur sur ta ligne. Toi. Je te mets en voie d’attente, le temps de te recoller.',
    'humour sec',
  ),
  J(
    'yasmina',
    'OCC, après une victoire',
    'L’Auditeur est en voie d’attente. Définitive, j’espère.',
    'satisfaction contenue',
  ),
  O(
    'yasmina',
    'Radio, premier dash parfait',
    'Retard indépendant de ta volonté. Quinze minutes. Joli. Je l’inscris au registre des excuses.',
    'complice, radio',
    { radio: true, sample: true },
  ),
  L(
    'yasmina',
    'Radio, début de Shift',
    'Départ autorisé. Voie libre jusqu’au quai trois.',
    'procédure, radio',
    { radio: true, sample: true },
  ),
  L(
    'yasmina',
    'Radio, entrée biome 2',
    'Passerelle. Vent de face. Ne regarde pas en bas.',
    'radio',
    { radio: true },
  ),
  L(
    'yasmina',
    'Radio, entrée biome 3',
    'Hall et BAG. À partir d’ici, plus de réseau. Sauf moi.',
    'radio',
    { radio: true },
  ),
  L(
    'yasmina',
    'Radio, salle de boss en approche',
    'Signal fermé devant. Le boss t’attend. Je reste en ligne.',
    'radio, tension',
    { radio: true },
  ),
  L(
    'yasmina',
    'Radio, Préavis disponible',
    'Mobilisation à cent. Tu peux déposer ton préavis.',
    'radio',
    { radio: true },
  ),
  L(
    'yasmina',
    'Radio, Gobelets épuisés',
    'Plus de Gobelets. Je te trouve une salle café.',
    'radio',
    { radio: true },
  ),
  L(
    'yasmina',
    'Radio, Shift tenu',
    'Shift tenu. Je te mets tout le réseau en vert.',
    'radio, chaleur',
    { radio: true, src: 'lore' },
  ),
  O('yasmina', 'OCC, serment (relation 3)', 'Quand je dis départ, tout le monde part.', 'serment'),
  // Kevin
  J(
    'kevin',
    'OCC, générique',
    'Ta clé, je la touche pas : c’est la DPD. Mais elle grince. Comme moi.',
    'gentil',
  ),
  J(
    'kevin',
    'OCC, générique (tic)',
    'C’est pas nous, c’est l’autre boîte.',
    'réflexe, haussement d’épaules',
  ),
  J(
    'kevin',
    'OCC, après une mort',
    'Tombé sur les voies ? C’est pas nous, c’est l’autre boîte. [beat] Enfin… là, c’est un peu toi.',
    'embarras sympathique',
  ),
  J(
    'kevin',
    'OCC, après une victoire',
    'Tu lui as coupé le courant ? Proprement ? [excited] Je note ça dans un rapport.',
    'fierté',
  ),
  O('kevin', 'OCC, serment (relation 3)', 'Ce soir, il y a plus d’autre boîte.', 'serment, ému'),
  L(
    'kevin',
    'Radio, Avantage Caténaire proposé',
    'Quinze mille volts, livrés. C’est nous, cette fois.',
    'bark radio',
    { radio: true },
  ),
  // Béné
  J(
    'bene',
    'OCC, générique',
    'Le Règlement, page trois cent douze : un consultant n’a pas de titre de transport. Je dis ça, je dis rien.',
    'pince-sans-rire',
  ),
  J('bene', 'OCC, générique (tic)', 'Numéro suivant !', 'tampon'),
  J(
    'bene',
    'OCC, après une mort (Borne)',
    'Elle t’a imprimé, la borne ? On ne négocie pas avec ces machines-là. Numéro suivant !',
    'sec',
  ),
  J(
    'bene',
    'OCC, après une victoire',
    'J’ai archivé ta victoire. Classement : rare. Sous-classement : à renouveler.',
    'administratif',
  ),
  O('bene', 'OCC, serment (relation 3)', 'Tant que j’ai un tampon, il y a un guichet.', 'serment'),
  L(
    'bene',
    'Radio, Avantage Guichet proposé',
    'File d’attente ouverte. Ils patienteront.',
    'bark radio',
    { radio: true },
  ),
  // Josiane
  J(
    'josiane',
    'OCC, service (Vestiaire)',
    'Ta dotation, je la range. Ce qui est réformé, je le réforme. Proprement.',
    'ferme',
  ),
  J(
    'josiane',
    'OCC, générique (mannequin)',
    'Le mannequin, là. Tape dedans, il ne porte pas plainte.',
    'maternelle, taquine',
  ),
  J(
    'josiane',
    'OCC, après une mort',
    'Tu ne m’appelles jamais, à la radio. Ça, c’est pas dans le règlement, mais c’est dans le cœur.',
    'reproche tendre',
  ),
  J(
    'josiane',
    'OCC, après une victoire',
    'Mon sanglier de deux mille neuf était plus coriace. Mais bravo, hein.',
    'fierté pudique',
  ),
  O('josiane', 'Radio, intro de Lurcke', 'Ces quatorze-là, ils ont un nom.', 'sèche, radio', {
    radio: true,
  }),
  O(
    'josiane',
    'OCC, serment (relation 3)',
    'Je contrôle les billets. Ce soir, je contrôle un contrat.',
    'serment',
  ),
  L(
    'josiane',
    'Radio, Avantage Contrôle des titres proposé',
    'Titre non valable. Renvoie-leur.',
    'bark radio',
    { radio: true },
  ),
  // Rudy
  J(
    'rudy',
    'OCC, générique (tic)',
    'Attention, attention… le Sondage propose jeudi. Le traiteur ne peut pas jeudi. On est tranquilles.',
    'théâtral',
    { sample: true },
  ),
  J(
    'rudy',
    'OCC, générique',
    'Un coup de sifflet bien placé, ça vaut tous les diaporamas.',
    'fier',
  ),
  J(
    'rudy',
    'OCC, après une mort (rame)',
    'Attention, attention… on ne traverse pas les voies. Même pour frapper un consultant. [beat] Surtout pour frapper un consultant.',
    'solennel puis complice',
  ),
  J(
    'rudy',
    'OCC, après une victoire',
    'Shift tenu, à l’heure, voie un. Je l’ai affiché. En vert. [voice cracks] J’ai pleuré un peu. En vert aussi.',
    'ému, théâtral',
    { sample: true },
  ),
  O(
    'rudy',
    'Radio, intro du Fluidifieur',
    'Attention, attention… il a le classeur. Méfie-toi du classeur.',
    'radio, alarme',
    { radio: true },
  ),
  O(
    'rudy',
    'Radio, intro de l’Invité d’honneur',
    'Attention, attention… il a quarante pages. Prévois des Gobelets.',
    'radio',
    { radio: true },
  ),
  O(
    'rudy',
    'Écran des départs, retard cumulé ≥ 3 h',
    'Attention, attention… retard cumulé : trois heures douze. Nous vous prions de nous excuser pour la gêne occasionnée.',
    'annonce',
  ),
  O(
    'rudy',
    'OCC, serment (relation 3)',
    'La prochaine fois que ma voix annonce un train, il viendra.',
    'serment',
  ),
  L(
    'rudy',
    'Épilogue, quai 2, 7 h 12 (sa vraie voix)',
    '[deep breath] Attention, attention… le train de sept heures douze entre en gare, voie deux. [beat] Il est à l’heure.',
    'émotion retenue, la plus belle annonce de sa vie',
  ),
  L(
    'rudy',
    'Radio, Avantage Coup de sifflet proposé',
    'Fermeture des portes ! Attention au départ !',
    'bark radio',
    { radio: true },
  ),
  // Jean-Mi
  O(
    'jeanmi',
    'OCC, générique (Shift ≥ 6, avant révélation)',
    'Franchement, faut être réaliste… tu crois vraiment qu’on va gagner ? [sighs] Bon. Double expresso quand même.',
    'affable, las',
  ),
  O(
    'jeanmi',
    'OCC, après une mort (avant révélation)',
    'Encore les consultants ? Ils savaient où t’attendre, hein. [nervously] Bizarre.',
    'gêné',
  ),
  O(
    'jeanmi',
    'OCC, après une victoire (racheté)',
    'T’as gagné. Moi, j’ai juste servi le café. Mais je l’ai servi ici. C’est déjà ça.',
    'sincère',
  ),
  O('jeanmi', 'OCC, serment (relation 3)', 'Faut être réaliste : je reste.', 'serment, soulagé'),
  // Fantôme et Raymonde (lot 2)
  O(
    'fantome',
    'Wagon-Bar, générique',
    'Votre grand-père prenait un café noir et un croque sans fromage. Il disait que le fromage, c’était pour les jours de grève.',
    'mélancolique',
  ),
  O(
    'fantome',
    'Wagon-Bar, après une mort',
    'Et pour monsieur-dame, ce sera ? Un remontant ? La maison n’existe plus, donc c’est gratuit.',
    'courtois',
  ),
  O(
    'fantome',
    'Wagon-Bar, après une victoire',
    'Ce soir, la maison offre. Et la maison, ce soir, c’est vous.',
    'ému',
  ),
  O(
    'raymonde',
    'Friterie, générique',
    'Les costumes mangent trois frites et demandent un justificatif. Le justificatif, c’est la frite, chéri.',
    'gouailleuse',
  ),
  O(
    'raymonde',
    'Friterie, après une mort',
    'Te revoilà ? T’as une mine de bus de substitution. Tiens, une fricadelle, c’est pour la maison.',
    'chaleureuse',
  ),
  O('raymonde', 'Friterie, tic', 'Avec ou sans vérité, la sauce, chéri ?', 'malicieuse'),
];

// ─── Annonces de gare (voix « gare », traitement haut-parleur) ─────────────
const GARE = [
  L(
    'gare',
    'Quai, fond sonore (coupée, canonique)',
    'Le train de sept heures douze à destination de…',
    'annonce coupée net',
    { src: 'lore', sample: true },
  ),
  L(
    'gare',
    'Prologue, écran des départs',
    'Mesdames et messieurs, le train de sept heures douze est supprimé. Motif : optimisation.',
    'sourire commercial',
    { sample: true },
  ),
  L(
    'gare',
    'Quai, fond sonore',
    'Votre quai, votre expérience. Le stationnement est facturé à la minute.',
    'publicité',
  ),
  L(
    'gare',
    'Quai, fond sonore',
    'Privatix Rail Solutions vous remercie de votre compréhension. Et de votre patience. Surtout de votre patience.',
    'publicité',
  ),
  L(
    'gare',
    'Quai, fond sonore',
    'En raison d’une optimisation, le quai deux est temporairement remplacé par le quai deux.',
    'absurde',
  ),
  L(
    'gare',
    'Quai, fond sonore',
    'Les voyageurs sont priés de ne pas utiliser le banc du quai deux. Il est réservé.',
    'absurde',
  ),
  L(
    'gare',
    'Passerelle, fond sonore',
    'La passerelle est fermée pour cérémonie. Merci de patienter dans le vent.',
    'publicité',
  ),
  L(
    'gare',
    'Passerelle, fond sonore',
    'L’escalator numéro trois est en service. Aujourd’hui.',
    'absurde',
  ),
  L(
    'gare',
    'Hall, fond sonore',
    'Bienvenue au Corner Expérience Voyageur. Un conseiller virtuel va vous répondre dans… quarante-sept minutes.',
    'publicité',
  ),
  L(
    'gare',
    'Hall, fond sonore',
    'Le guichet est fermé. Pour toute réclamation, merci de remplir le Sondage.',
    'publicité',
  ),
  L(
    'gare',
    'Retour à l’OCC, Sondage',
    'Le Sondage vous informe que la signature est reportée. Une nouvelle date vous sera proposée à la fin de votre service.',
    'administratif',
  ),
  L(
    'gare',
    'Écran des départs, défaite',
    'Shift trente-sept : supprimé. Cause : Consultant Junior.',
    'neutre, cruel par neutralité',
    { src: 'lore' },
  ),
  L('gare', 'Écran des départs, victoire', 'Shift tenu. À l’heure.', 'surprise involontaire'),
  L(
    'gare',
    'Furet putride, collier (jeu)',
    'Tri en cours. Veuillez patienter.',
    'voix de collier synthétique',
    { src: 'jeu' },
  ),
  L('gare', 'Furet putride, défaite (jeu)', 'Tri… suspendu…', 'collier qui s’éteint', {
    src: 'jeu',
  }),
];

// ─── Boss ────────────────────────────────────────────────────────────────────
const BOSS = [
  // Auditeur
  J(
    'auditeur',
    'Intro',
    '[clicks tongue] Vous avez mis quatre minutes douze pour arriver jusqu’ici. Je le note.',
    'zèle froid',
    { sample: true },
  ),
  O(
    'auditeur',
    'Intro (suite)',
    'Le standard est de quarante-sept secondes. Le standard est un objectif. L’objectif est un standard.',
    'métronomique',
  ),
  O(
    'auditeur',
    'Intro (fin, après le soupir du héros)',
    'Soupir non conforme. Audit bienveillant : début.',
    'sec',
  ),
  O('auditeur', 'Phase 1', 'Restez dans le cercle, c’est pour la mesure.', 'courtois glacial'),
  O('auditeur', 'Phase 1', 'Ce bouclier est un indicateur de confiance.', 'satisfait'),
  O(
    'auditeur',
    'Phase 2 (rame, télégraphe parlé)',
    'Voie trois, passage dans trois… deux… un.',
    'compte à rebours net',
    { sample: true },
  ),
  O('auditeur', 'Phase 2', 'Ce train ne s’arrête pas. Il est rentable.', 'fier'),
  O('auditeur', 'Phase 3', '[panicking] Tout est en retard ! Même moi !', 'panique'),
  O('auditeur', 'Phase 3', '[shouting] Accélérez ! Le chrono ! LE CHRONO !', 'panique, cri'),
  J(
    'auditeur',
    'Défaite',
    '[long pause] … Le train de sept heures douze… il existe encore ?',
    'la première phrase humaine, doux',
  ),
  O(
    'auditeur',
    'Victoire sur le joueur',
    'Shift interrompu. Taux de réussite : zéro. C’est un chiffre très propre.',
    'satisfaction',
  ),
  L('auditeur', 'Bark, dégâts reçus', 'Écart constaté !', 'outré'),
  L('auditeur', 'Bark, tampon', 'Contrôle !', 'sec'),
  // Fluidifieur
  J(
    'fluidifieur',
    'Intro',
    'Ah ! Vous êtes en C ? Non non, vous êtes en S. Depuis ce matin.',
    'enjoué',
  ),
  O(
    'fluidifieur',
    'Intro (suite)',
    'Ce n’est pas un changement, c’est une opportunité de changement.',
    'souriant',
  ),
  O('fluidifieur', 'Phase 1', 'Votre samedi est « en cours de validation ».', 'léger'),
  O('fluidifieur', 'Phase 1', 'Je vous mets sur une dalle plus… aérée.', 'perfide souriant'),
  J('fluidifieur', 'Phase 2', 'Mutation d’office ! C’est pour votre carrière !', 'triomphe'),
  J(
    'fluidifieur',
    'Phase 2',
    'L’organigramme, c’est moi. Et vous, vous êtes une case.',
    'arrogant',
  ),
  J('fluidifieur', 'Changement de roulement', 'Changement de roulement !', 'annonce joyeuse'),
  J('fluidifieur', 'Article 47 lu par le héros', '[shocked] Il y a un alinéa trois ?!', 'stupeur'),
  J('fluidifieur', 'Défaite', '… Sept jours ? Personne ne lit jamais l’alinéa trois.', 'abattu'),
  O(
    'fluidifieur',
    'Défaite (sortie)',
    'Bon. Je préviens l’Invité d’honneur qu’il y a un… imprévu.',
    'résigné',
  ),
  O(
    'fluidifieur',
    'Victoire sur le joueur',
    'Voilà. Vous êtes en repos. Un repos non prévu, mais le planning s’adaptera.',
    'satisfait',
  ),
  // Invité d'honneur (toutes fictives)
  J(
    'invite',
    'Intro',
    '[taps microphone] Mesdames, messieurs, chers amis… et vous, au fond, en gilet orange.',
    'orateur chaleureux',
    { fictive: true, sample: true },
  ),
  O(
    'invite',
    'Intro (suite)',
    'Nous sommes ici pour inaugurer l’avenir. Et l’avenir, je le dis souvent, ça s’inaugure.',
    'emphase',
    { fictive: true },
  ),
  O(
    'invite',
    'Intro (après le soupir du héros)',
    'Je vois que l’émotion vous gagne. Page deux.',
    'bonhomie',
    { fictive: true },
  ),
  J(
    'invite',
    'Phase 1 « Le Discours inaugural »',
    'Je serai bref.',
    'promesse (qu’il ne tiendra pas)',
    { fictive: true, sample: true },
  ),
  J(
    'invite',
    'Phase 1',
    'Permettez-moi une parenthèse. Elle durera le temps qu’il faudra.',
    'ample',
    { fictive: true },
  ),
  J('invite', 'Onde de discours (télégraphe parlé)', 'Et j’ajouterai…', 'relance oratoire', {
    fictive: true,
    takes: 4,
  }),
  O(
    'invite',
    'Phase 2 « La Première Pierre »',
    'Cette pierre est la première d’une longue série.',
    'solennel',
    { fictive: true },
  ),
  O('invite', 'Phase 2', 'Les travaux commenceront… bientôt. C’est un engagement.', 'solennel', {
    fictive: true,
  }),
  O(
    'invite',
    'Phase 3 « Le Ruban »',
    'Un ruban, c’est une promesse. Celle-là, je la coupe.',
    'ferme',
    { fictive: true },
  ),
  O('invite', 'Phase 3', 'Mons mérite mieux !', 'sincère, élan', { fictive: true }),
  J(
    'invite',
    'Rappel au Règlement',
    'Une concertation ? Excellente idée. Je note… je note.',
    'pris de court, aimable',
    { fictive: true },
  ),
  J(
    'invite',
    'Défaite (lecture de la plaque)',
    '[long pause] … On m’avait parlé d’une inauguration.',
    'surpris, digne',
    { fictive: true },
  ),
  J('invite', 'Défaite', 'Je n’inaugure pas une vente à la découpe.', 'digne, ferme', {
    fictive: true,
  }),
  O(
    'invite',
    'Défaite (sortie)',
    'Il doit bien y avoir, quelque part dans cette ville, quelque chose qui ouvre.',
    'nostalgie, sortie digne',
    { fictive: true },
  ),
  O(
    'invite',
    'Victoire sur le joueur',
    'Je déclare ce Shift… clos. Applaudissez, applaudissez. Et rendez-vous à la prochaine inauguration.',
    'protocolaire',
    { fictive: true },
  ),
  O(
    'invite',
    'Défaites suivantes (2e)',
    'Encore vous ? Je n’avais prévu qu’un seul ruban.',
    'surpris',
    { fictive: true },
  ),
  O('invite', 'Défaites suivantes (3e)', 'J’ai raccourci le discours. Trente-neuf pages.', 'fier', {
    fictive: true,
  }),
  O(
    'invite',
    'Défaites suivantes (4e)',
    'Vous savez, à Mons, on inaugure même les reports.',
    'malicieux',
    { fictive: true },
  ),
  L('invite', 'Bark, la claque applaudit', 'Merci, merci… gardez-en pour la fin.', 'bonhomie', {
    fictive: true,
  }),
  L('invite', 'Bark, coup des ciseaux', 'Je coupe !', 'élan', { fictive: true }),
  // Discosaure
  J(
    'discosaure',
    'Intro (salle gardée)',
    'On a toujours fait comme ça. Et ça a toujours marché. Pour nous.',
    'animateur gras',
  ),
  J('discosaure', 'Phase 2', 'Restructurez avec moi ! Un, deux, un, deux !', 'scandé sur le tempo'),
  J('discosaure', 'Défaite', '… La musique… s’est arrêtée ?', 'désarroi'),
  L('discosaure', 'Bark, piétinement', 'Sur le temps !', 'scandé'),
  // Lurcke
  O(
    'lurcke',
    'Intro (premier combat)',
    'Ah. L’équipe terrain. Entrez. Un café ? La machine fait quarante-sept recettes. Personne ne sait l’allumer.',
    'keynote',
    { sample: true },
  ),
  O(
    'lurcke',
    'Intro (suite)',
    'Arrêter ? On ne fait que libérer le marché. Et pour un sept heures douze qui transporte quatorze personnes ? Quatorze ! Ce n’est même pas un chiffre significatif.',
    'condescendant',
  ),
  O(
    'lurcke',
    'Intro (fin)',
    'Pas dans le tableur. Je lance la présentation. Quatre cent douze slides. Il n’y a pas de pause prévue.',
    'assuré',
  ),
  O('lurcke', 'Réplique à Fatou', 'C’est agile.', 'sûr de lui'),
  L(
    'lurcke',
    'Bark, le héros entre dans le bureau (réplique de référence validée)',
    '[smiling] Léon, Léon, Léon… Je ne libéralise pas un réseau avec un incident voyageur en cours, ça fait mauvais genre dans le reporting. [chuckles] Posez cette clé, on va faire un petit atelier.',
    'souriant, rassurant de pub, condescendant',
    { validated: true },
  ),
  O('lurcke', 'Intro alternative 1', 'Encore vous ? J’ai pourtant envoyé un Sondage.', 'agacé'),
  O('lurcke', 'Intro alternative 2', 'Cette fois, j’ai prévu une pause. Pour moi.', 'fier'),
  O(
    'lurcke',
    'Intro alternative 3',
    'J’ai benchmarké votre clé. Au Japon, ils utilisent des tablettes.',
    'pédant',
  ),
  O(
    'lurcke',
    'Intro alternative 4 (après 5 victoires)',
    '[hoarse] Je n’ai plus de slides. J’ai fait les quatre cent douze. Il ne reste que moi.',
    'voix cassée',
  ),
  O(
    'lurcke',
    'Phase 1 « Méga-Deck 2032 »',
    'Slide un sur quatre cent douze. Restez concentrés, c’est la plus courte.',
    'keynote',
  ),
  O('lurcke', 'Phase 1', 'Benchmark international ! Au Japon, ça marche !', 'enthousiaste'),
  J('lurcke', 'Phase 1 (copie)', 'Je vous mets en copie. Et vous. Et vous.', 'satisfait', {
    sample: true,
  }),
  O(
    'lurcke',
    'Phase 1',
    'Slide trois cents : le réseau, en lots. C’est plus lisible, non ?',
    'vendeur',
  ),
  J(
    'lurcke',
    'Phase 2 « Conseil en visio »',
    'Mesdames et messieurs du Conseil, vous m’entendez ? [beat] … Vous êtes en mute.',
    'gêne',
  ),
  O(
    'lurcke',
    'Phase 2',
    'Article premier : le personnel est un actif variable. Article deux : l’article premier n’est pas négociable !',
    'emballé',
  ),
  O(
    'lurcke',
    'Preuve activée',
    '[stunned] Slide quarante-sept : ce n’est pas la mienne…',
    'étourdi',
  ),
  O(
    'lurcke',
    'Phase 3 « L’Optimiseur Absolu »',
    'Si je ne peux pas vous convaincre, je vais vous dupliquer.',
    'menace',
  ),
  O('lurcke', 'Phase 3', 'Recto. Verso. Recto. Verso. Sans pause.', 'mécanique'),
  O(
    'lurcke',
    'Phase 3',
    '[shouting] Le seul train rentable, c’est celui qui ne part pas !',
    'délire',
  ),
  J(
    'lurcke',
    'Coup final',
    '[long silence] … Concrètement ? Concrètement… [long pause] je n’ai pas de slide pour ça.',
    'effondrement, laisser le silence',
  ),
  J(
    'lurcke',
    'Défaite (fin mitigée)',
    'Bon. Soyons adultes. Une phase pilote. Une seule ligne.',
    'négocie, à genoux',
  ),
  O('lurcke', 'Défaite (vraie fin)', '[quietly] Mon oreillette… n’a plus de réseau.', 'perdu'),
  O(
    'lurcke',
    'Victoire sur le joueur',
    'Le planning est validé. Le diaporama est validé. Même le traiteur est validé !',
    'triomphe',
  ),
  O(
    'lurcke',
    'Victoire sur le joueur (stylo levé)',
    '… Ah. On me signale un conflit d’agenda. On reprogramme.',
    'déconfit',
  ),
  O(
    'lurcke',
    'Jauge de signature pleine',
    'Félicitations, le marché est ouvert. Votre poste aussi. Votre badge vous sera envoyé par Sondage.',
    'cynique jovial',
  ),
  // Hubert (visio)
  O(
    'hubert',
    'Phase 2 de Lurcke',
    'Jean-Cul, on vous entend mal. On vous voit mal. On vous évalue bien.',
    'calme menaçant',
  ),
  O('hubert', 'Reprogrammation 1', '… Bon. On reprogramme. Envoyez un Sondage.', 'las'),
  O(
    'hubert',
    'Reprogrammation 2',
    'Jean-Cul, je vous rappelle que votre prime est indexée sur ce contrat. Pas sur votre dignité.',
    'froid',
  ),
  O(
    'hubert',
    'Reprogrammation 3',
    'Proposez-leur une phase pilote. Les gens adorent les pilotes.',
    'détaché',
  ),
  O(
    'hubert',
    'Reprogrammation 4',
    'Nous allons créer une commission. Elle réfléchira à pourquoi vous échouez.',
    'glacial',
  ),
  O('hubert', 'Reprogrammation 5', 'Je commence à trouver ce dossier… peu scalable.', 'menace'),
  O('hubert', 'Reprogrammation 6', 'La prochaine date est définitive.', 'sentence'),
  O('hubert', 'Vraie fin', 'Bon. Signez sans lui.', 'tranchant'),
  O(
    'hubert',
    'Vraie fin (déconnexion)',
    '… On en reparlera au prochain plan stratégique.',
    'retraite polie',
  ),
];

// ─── Trailer : voix off proposée (option B, diégétique, voix de Yasmina) ────
const TRAILER = [
  L(
    'yasmina',
    'Trailer 0:01 (sous C1, option B)',
    'OCC à tous les agents. Six heures. Le rail est à vendre.',
    'radio, posé',
    { radio: true, trailer: true },
  ),
  L(
    'yasmina',
    'Trailer 0:09 (sous C2, option B)',
    'Ils ont un plan. [beat] On a un café.',
    'radio, complice',
    { radio: true, trailer: true },
  ),
  L(
    'yasmina',
    'Trailer 0:49 (sous C6, option B)',
    'Shift tenu. [softly] Un train, ça se fait à plusieurs.',
    'radio, tendresse',
    { radio: true, trailer: true },
  ),
];

/** Numérote les répliques par voix et contexte : `voix.famille.nn`. */
function number(lines) {
  const count = new Map();
  return lines.map((l) => {
    if (l.id) return l;
    const fam = l.trailer
      ? 'trailer'
      : l.ctx.toLowerCase().startsWith('radio')
        ? 'radio'
        : l.ctx.toLowerCase().startsWith('occ') ||
            l.ctx.toLowerCase().startsWith('wagon') ||
            l.ctx.toLowerCase().startsWith('friterie')
          ? 'hub'
          : l.voice === 'gare'
            ? 'annonce'
            : 'boss';
    const k = `${l.voice}.${fam}`;
    const n = (count.get(k) ?? 0) + 1;
    count.set(k, n);
    return { ...l, id: `${k}.${String(n).padStart(2, '0')}` };
  });
}

export const LINES = number([...HERO_LINES, ...NPC, ...GARE, ...BOSS, ...TRAILER]);
