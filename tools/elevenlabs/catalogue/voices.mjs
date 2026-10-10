// Fiches de voix de Privatix (source unique : docs/audio/AUDIO_BIBLE.md § 4 et manifest.json en
// dérivent via build-manifest.mjs).
//
// `design` est le prompt de Voice Design (POST /v1/text-to-voice/design, modèle eleven_ttv_v3),
// écrit en anglais (meilleure adhérence) ; `preview` est le texte de l'aperçu, en français, 100 à
// 1000 caractères, tiré du canon (docs/LORE.md). `fiche` est la fiche lisible du directeur de
// doublage. `post` : traitement ffmpeg appliqué à toutes les répliques de la voix (voir generate.mjs).
//
// État au 2026-10-09 (décisions du porteur du projet) : 4 voix arrêtées (`saved.voiceId`) : Léon,
// Yasmina et l'Invité d'honneur (voix conçues, sauvegardées) et Lurcke (voix de bibliothèque « Nico »).
// Les autres voix ne sont pas encore conçues (workspace à 3/3 voix : leur création attend une montée
// d'offre ou un choix de voix de bibliothèque).
// Marcel, Josiane et Béné : voix Gemini TTS arrêtées le 2026-10-10 (`geminiVoiceId`, backend gemini).
// Diction validée : eleven_v3, graphie normale (« Mons »), aucune substitution phonétique ni IPA.
//
// Règle d'or : aucune voix n'imite une personne réelle. Aucun clonage, aucune référence audio.
// L'Invité d'honneur (caricature autorisée d'Elio Di Rupo, LORE § 1.4) est une voix de PERSONNAGE :
// le prompt ne contient ni son nom ni « sounds like » ; on ne reproduit ni sa voix, ni son accent.

/** Accent commun aux cheminots : belge francophone de la région de Mons, léger, jamais caricatural. */
const BE =
  'Native Belgian French speaker from the Mons area (Hainaut, Wallonia), light natural regional accent, never caricatural';

export const VOICES = [
  // ─── Héros ────────────────────────────────────────────────────────────────
  {
    id: 'leon',
    // Validée par le porteur du projet (2026-10-09), sauvegardée dans le workspace ElevenLabs sous le
    // nom « voix1 » : à renommer « Privatix — Léon » dès que l'API est disponible.
    saved: { voiceId: 'Ql8Hq7echfwTF90Fec6K', workspaceName: 'voix1' },
    name: 'Léon (héros)',
    key: true,
    fiche: {
      age: '35 ans',
      timbre: 'baryton clair, un peu voilé par les nuits',
      accent: 'belge wallon léger (Mons)',
      debit: 'lent, phrases courtes',
      emotion: 'ironie sèche, fatigue tenue, jamais de tirade',
      direction:
        'Le héros parle peu. Les efforts sont courts et nets, pas de cri de film d’action : un cheminot qui force sur un tire-fond.',
    },
    design: `Male, 35 years old. ${BE}. Warm light baritone, slightly husky from years of night shifts. Speaks in short, dry, understated sentences with deadpan irony; tired but steady and kind. Close-miked studio recording, clean, no reverb.`,
    preview:
      'Mons, quatre heures quarante-sept, quai deux. Le train de sept heures douze est supprimé. Motif : optimisation. Bon. Je prends la clé de mon grand-père, je finis mon café, et on va leur demander, poliment, ce que ça donne, concrètement, sur le terrain.',
    post: { loudnorm: -18 },
  },
  {
    id: 'lea',
    name: 'Léa (héroïne)',
    key: true,
    fiche: {
      age: '33 ans',
      timbre: 'mezzo grave, légèrement rauque',
      accent: 'belge wallon léger (Mons)',
      debit: 'lent, phrases courtes',
      emotion: 'ironie sèche, fatigue tenue',
      direction: 'Même texte que Léon, même retenue. Les efforts sont brefs, sur l’expiration.',
    },
    design: `Female, 33 years old. ${BE}. Low mezzo voice with a slight rasp, calm and grounded. Short, dry, understated sentences with deadpan irony; tired but warm and determined. Close-miked studio recording, clean, no reverb.`,
    preview:
      'Mons, quatre heures quarante-sept, quai deux. Le train de sept heures douze est supprimé. Motif : optimisation. Bon. Je prends la clé de mon grand-père, je finis mon café, et on va leur demander, poliment, ce que ça donne, concrètement, sur le terrain.',
    post: { loudnorm: -18 },
  },
  // ─── PNJ du Centre Opérationnel (OCC) ─────────────────────────────────────
  {
    id: 'marcel',
    // Voix Gemini TTS arrêtée le 2026-10-10 (variante 2 de l'essai docs/audio/samples/gemini/).
    geminiVoiceId: 'voice_jwjfxi0g20l6',
    name: 'Marcel « Pépé Rail » Lhoir',
    key: true,
    fiche: {
      age: '72 ans',
      timbre: 'grave, rocailleux, chaud',
      accent: 'wallon un peu plus marqué que les autres (génération 1970)',
      debit: 'posé, raconte, laisse traîner la fin des phrases',
      emotion: 'bourru, tendre en secret',
      direction:
        'Mentor qui a tout vu. « De mon temps… » est dit avec un sourire, pas avec amertume. Une seule fois par scène.',
    },
    design: `Elderly man, 72 years old, retired train driver. ${BE}, slightly stronger regional colour than younger characters. Deep, gravelly, warm voice; gruff but tender. Unhurried storytelling pace, lets sentence endings trail off with a smile. Studio recording, clean.`,
    preview:
      'De mon temps, le retard, on l’appelait l’aventure. Maintenant, ils l’appellent un KPI. Ça va, fieu ? T’as eu une aventure courte. Allez, une tasse et on y retourne. Tant qu’ils reprogramment, on existe.',
    post: { loudnorm: -18 },
  },
  {
    id: 'fatou',
    name: 'Fatou Ndiaye',
    key: true,
    fiche: {
      age: '44 ans',
      timbre: 'médium doux, rond',
      accent: 'belge francophone neutre, très léger',
      debit: 'mesuré, précis, souriant',
      emotion: 'douce et scientifique ; terrifiante de calme quand on saute la pause légale',
      direction:
        'La conscience de l’OCC. Chaque chiffre est dit avec soin. L’humour est dans la précision, jamais dans la voix. Aucun cliché d’origine.',
    },
    design: `Woman, 44 years old, occupational health and safety advisor. Native Belgian French speaker, very light accent. Soft, round, warm mid-range voice; measured, precise and gently amused delivery, like a caring nurse reading statistics. Studio recording, clean.`,
    preview:
      'Ton Burnout de fin de Shift était à quatre-vingt-sept. Je l’ai noté. En rouge. Avec un cœur, pour adoucir. Arrêt de travail de zéro jour. Bienvenue. Hydrate-toi. Au café, de préférence.',
    post: { loudnorm: -18 },
  },
  {
    id: 'kevin',
    name: 'Kevin « Kéké » Lambot',
    key: false,
    fiche: {
      age: '31 ans',
      timbre: 'ténor léger, un peu nasal',
      accent: 'wallon léger',
      debit: 'rapide, s’emballe sur la technique',
      emotion: 'gentil comme un pain, fier de ses rapports',
      direction:
        'Le bricoleur au grand cœur. « C’est pas nous, c’est l’autre boîte » est un réflexe, pas une excuse.',
    },
    design: `Young man, 31 years old, overhead-line technician. ${BE}. Light, slightly nasal tenor; friendly and eager, speaks fast when excited about tools and technical details, endearingly earnest. Studio recording, clean.`,
    preview:
      'Ta clé, je la touche pas : c’est la DPD. Mais elle grince. Comme moi. Tombé sur les voies ? C’est pas nous, c’est l’autre boîte. Enfin… là, c’est un peu toi. Tu lui as coupé le courant ? Proprement ? Je note ça dans un rapport.',
    post: { loudnorm: -18 },
  },
  {
    id: 'bene',
    // Voix Gemini TTS arrêtée le 2026-10-10 (variante 1 de l'essai docs/audio/samples/gemini/).
    geminiVoiceId: 'voice_k4b4wmmwy1d8',
    name: 'Bénédicte « Béné » Wautier',
    key: false,
    fiche: {
      age: '56 ans',
      timbre: 'médium sec, net',
      accent: 'belge wallon léger',
      debit: 'régulier, comme un tampon',
      emotion: 'pince-sans-rire absolu, ne s’énerve jamais',
      direction:
        'La guichetière qui a survécu à quatre réformes tarifaires. Chaque blague est livrée à plat.',
    },
    design: `Woman, 56 years old, veteran ticket-office clerk. ${BE}. Dry, crisp mid-range voice; perfectly deadpan, even and rhythmic delivery like a rubber stamp, a hint of tired amusement she never shows. Studio recording, clean.`,
    preview:
      'Le Règlement, page trois cent douze : un consultant n’a pas de titre de transport. Je dis ça, je dis rien. J’ai archivé ta victoire. Classement : rare. Sous-classement : à renouveler. Numéro suivant !',
    post: { loudnorm: -18 },
  },
  {
    id: 'yasmina',
    // Validée (2026-10-09), sauvegardée sous le nom « femme » : à renommer « Privatix — Yasmina ».
    saved: { voiceId: 'ROy6nWoXjRMqzkdFdAkB', workspaceName: 'femme' },
    name: 'Yasmina Benali (régulation, radio)',
    key: true,
    fiche: {
      age: '38 ans',
      timbre: 'alto posé, articulé',
      accent: 'belge francophone neutre',
      debit: 'calme olympien, pas une syllabe de trop',
      emotion: 'stratège, tendresse cachée sous le code',
      direction:
        'C’est LA voix de la radio en run. Ne hausse jamais le ton (« Si je crie, des trains se percutent »). Enregistrer propre ; le filtre radio est ajouté en post.',
    },
    design: `Woman, 38 years old, railway traffic controller. Native Belgian French speaker, light neutral accent. Calm, low alto voice, crisp articulation, unflappable radio-operator composure; dry humour hidden under procedure. Studio recording, clean, close mic.`,
    preview:
      'Roulement de nuit. Moins de monde, plus de cadres. Je te mets le biome un en orange. Incident voyageur sur ta ligne. Toi. Je te mets en voie d’attente, le temps de te recoller. Quand je dis départ, tout le monde part.',
    post: { loudnorm: -18 },
  },
  {
    id: 'josiane',
    // Voix Gemini TTS arrêtée le 2026-10-10 (variante 2 de l'essai docs/audio/samples/gemini/).
    geminiVoiceId: 'voice_fekejacozsb7',
    name: 'Josiane Delhaye',
    key: false,
    fiche: {
      age: '58 ans',
      timbre: 'médium chaud, voix qui porte',
      accent: 'wallon léger',
      debit: 'franc, sans détour',
      emotion: 'maternelle et inflexible',
      direction:
        'A expulsé un sanglier d’un train « avec politesse ». Autorité douce, chaleur sous la fermeté.',
    },
    design: `Woman, 58 years old, train conductor with 28 years of service. ${BE}. Warm, projecting mid-range voice; motherly but firm and unflinching, straightforward, quick to tease. Studio recording, clean.`,
    preview:
      'Le consultant, tu lui as demandé son titre de transport ? Non ? Ben voilà. Tu ne m’appelles jamais, à la radio. Ça, c’est pas dans le règlement, mais c’est dans le cœur. Mon sanglier de deux mille neuf était plus coriace. Mais bravo, hein.',
    post: { loudnorm: -18 },
  },
  {
    id: 'rudy',
    name: 'Rudy Courtois (chef de quai, annonces)',
    key: true,
    fiche: {
      age: '46 ans',
      timbre: 'baryton projeté, voix d’annonceur',
      accent: 'belge wallon léger',
      debit: 'théâtral, ménage ses effets',
      emotion: 'ponctuel jusqu’à l’obsession, ému en vert',
      direction:
        '« Attention, attention… » avant chaque phrase importante. Sa voix est aussi, en lore, la voix synthétique de la gare (achetée en 2014) : la voix « gare » en dérive.',
    },
    design: `Man, 46 years old, railway platform chief and station announcer. ${BE}. Projected, theatrical baritone with announcer diction; pompous in a lovable way, savours dramatic pauses, punctual to the point of obsession. Studio recording, clean.`,
    preview:
      'Attention, attention… le Sondage propose jeudi. Le traiteur ne peut pas jeudi. On est tranquilles. Shift tenu, à l’heure, voie un. Je l’ai affiché. En vert. J’ai pleuré un peu. En vert aussi.',
    post: { loudnorm: -18 },
  },
  {
    id: 'gare',
    name: 'Voix de la gare (annonces synthétiques Privatix)',
    key: true,
    fiche: {
      age: 'sans âge (synthèse de la voix de Rudy, version « Expérience Quai »)',
      timbre: 'baryton lisse, trop poli',
      accent: 'neutre, aseptisé',
      debit: 'régulier, souriant, inhumain par sa constance',
      emotion: 'aucune ; sourire commercial',
      direction:
        'Annonces de gare : toujours claires quand elles portent une information de jeu, souvent coupées ou absurdes en fond. Traitement « haut-parleur de quai » en post (filtre + écho de hall).',
    },
    design: `Man, mid 40s, corporate railway station public-address voice. Native French speaker, neutral polished accent. Smooth, overly polite baritone with a fixed commercial smile, perfectly even pacing, slightly uncanny in its constancy. Clean studio recording.`,
    preview:
      'Mesdames et messieurs, le train de sept heures douze à destination de… est supprimé. Motif : optimisation. Privatix Rail Solutions vous remercie de votre compréhension. Votre quai, votre expérience. Le stationnement sur le quai est facturé à la minute.',
    post: { loudnorm: -20, pa: true },
  },
  {
    id: 'jeanmi',
    name: 'Jean-Michel « Jean-Mi » Dufrasne',
    key: false,
    fiche: {
      age: '42 ans',
      timbre: 'médium légèrement voilé',
      accent: 'wallon léger',
      debit: 'affable, un peu trop rapide quand il ment',
      emotion: 'drôle, serviable, épuisé ; culpabilité sous la surface',
      direction:
        'La taupe traitée avec compassion. Jamais un méchant : un homme fatigué qui veut ses jeudis.',
    },
    design: `Man, 42 years old, assistant station master and café barista. ${BE}. Friendly, slightly veiled mid-range voice; helpful and funny but exhausted, talks a little too fast when uneasy. Studio recording, clean.`,
    preview:
      'Franchement, faut être réaliste… tu crois vraiment qu’on va gagner ? Bon. Double expresso quand même. Encore les consultants ? Ils savaient où t’attendre, hein. Bizarre. T’as gagné. Moi, j’ai juste servi le café. Mais je l’ai servi ici.',
    post: { loudnorm: -18 },
  },
  {
    id: 'fantome',
    name: 'Le Fantôme du Wagon-Bar',
    key: false,
    fiche: {
      age: 'indéfinissable (serveur de 1996)',
      timbre: 'ténor velouté, un peu lointain',
      accent: 'belge, diction de grand service',
      debit: 'lent, élégant, vouvoie tout le monde',
      emotion: 'mélancolique et courtois',
      direction:
        'Légère réverbération de wagon en post. Il ne dit jamais s’il est vraiment un fantôme.',
    },
    design: `Elderly man of indeterminate age, old-fashioned dining-car waiter. Belgian French speaker with formal, elegant diction. Velvety, slightly distant tenor; melancholic, courteous and gently witty, addresses everyone formally. Studio recording, clean.`,
    preview:
      'Et pour monsieur-dame, ce sera ? Votre grand-père prenait un café noir et un croque sans fromage. Il disait que le fromage, c’était pour les jours de grève. Ce soir, la maison offre. Et la maison, ce soir, c’est vous.',
    post: { loudnorm: -19, room: 'wagon' },
  },
  {
    id: 'raymonde',
    name: 'Raymonde (la Friterie)',
    key: false,
    fiche: {
      age: '61 ans',
      timbre: 'alto chaleureux, gouailleur',
      accent: 'wallon franc (le plus marqué du casting, sans caricature)',
      debit: 'rapide, cash',
      emotion: 'chaleureuse, mémoire d’éléphant',
      direction: '« Chéri » à chaque client. La seule à avoir droit à « dikkenek ».',
    },
    design: `Woman, 61 years old, owner of a mobile chip shop. ${BE}, with a frank, colourful regional tone. Warm, husky alto, quick and cheeky delivery, motherly street-vendor charm. Studio recording, clean.`,
    preview:
      'Les costumes mangent trois frites et demandent un justificatif. Le justificatif, c’est la frite, chéri. Te revoilà ? T’as une mine de bus de substitution. Tiens, une fricadelle, c’est pour la maison.',
    post: { loudnorm: -18 },
  },
  // ─── Boss et ennemis majeurs ─────────────────────────────────────────────
  {
    id: 'auditeur',
    name: 'L’Auditeur des Quais (boss 1)',
    key: true,
    fiche: {
      age: '52 ans',
      timbre: 'ténor sec, légèrement nasal',
      accent: 'français « de bureau », neutre',
      debit: 'métronomique, chaque syllabe au chronomètre',
      emotion: 'zèle froid ; panique en phase 3',
      direction:
        'Il ne regarde jamais l’heure qu’il est, seulement l’heure qu’il devrait être. Phase 3 : le métronome déraille. Défaite : la première phrase humaine.',
    },
    design: `Man, 52 years old, obsessive corporate performance auditor. Native French speaker, neutral office accent. Dry, slightly nasal tenor, clipped metronomic delivery as if timing every syllable with a stopwatch; cold zeal that can crack into panic. Studio recording, clean.`,
    preview:
      'Vous avez mis quatre minutes douze pour arriver jusqu’ici. Je le note. Le standard est de quarante-sept secondes. Le standard est un objectif. L’objectif est un standard. Soupir non conforme. Audit bienveillant : début.',
    post: { loudnorm: -18 },
  },
  {
    id: 'fluidifieur',
    name: 'Le Fluidifieur (élite majeur, biome 2)',
    key: false,
    fiche: {
      age: '34 ans',
      timbre: 'médium clair, souriant',
      accent: 'français neutre, franglais de start-up',
      debit: 'rapide, enjoué, glisse sur les mots',
      emotion: 'enthousiasme RH ; ne déteste personne, il fluidifie',
      direction:
        'Le sourire s’entend. Les mots anglais sont prononcés « à l’anglaise de séminaire ».',
    },
    design: `Man, 34 years old, upbeat HR reorganisation consultant. Native French speaker, neutral accent, peppers speech with corporate English buzzwords. Bright, smiling mid-range voice, fast and slippery delivery, relentlessly positive. Studio recording, clean.`,
    preview:
      'Ah ! Vous êtes en C ? Non non, vous êtes en S. Depuis ce matin. Ce n’est pas un changement, c’est une opportunité de changement. Mutation d’office ! C’est pour votre carrière ! L’organigramme, c’est moi.',
    post: { loudnorm: -18 },
  },
  {
    id: 'invite',
    // Validée (2026-10-09), sauvegardée dans le workspace.
    saved: { voiceId: 'BHaCuTcypMPA9jhksYPX', workspaceName: 'Invité d’honneur' },
    name: 'L’Invité d’honneur (boss 2, caricature autorisée)',
    key: true,
    fiche: {
      age: 'septuagénaire',
      timbre: 'voix de PERSONNAGE : orateur de cérémonie, médium chaleureux, sonore',
      accent:
        'belge francophone standard ; ne PAS reproduire l’accent ni la voix de la personne réelle',
      debit: 'ample, solennel, ménage les effets d’estrade',
      emotion: 'bonhomie protocolaire, sincère quand il dit « Mons mérite mieux ! »',
      direction:
        'Satire bon enfant de la POSTURE (discours, rubans, inaugurations), jamais de la voix, de l’âge ou de l’accent. Toutes les répliques sont fictives, étiquetées « réplique fictive ». Aucun clonage, aucune référence audio. Sortie digne à la défaite.',
    },
    design:
      'Man in his seventies, a fictional ceremonial guest of honour at a ribbon-cutting. Standard Belgian French speaker. Warm, resonant, sonorous mid-range voice of a seasoned public speaker; grand, courteous, slightly pompous podium delivery with long rhetorical pauses, good-natured and dignified. Original character voice, not based on any real person. Studio recording, clean.',
    preview:
      'Mesdames, messieurs, chers amis… et vous, au fond, en gilet orange. Nous sommes ici pour inaugurer l’avenir. Et l’avenir, je le dis souvent, ça s’inaugure. Je serai bref. Permettez-moi une parenthèse. Elle durera le temps qu’il faudra.',
    fictive: true,
    post: { loudnorm: -18, room: 'podium' },
  },
  {
    id: 'discosaure',
    name: 'Le Discosaure (mini-boss, biome 3)',
    key: false,
    fiche: {
      age: 'dinosaure de l’afterwork',
      timbre: 'basse ronde, grasse',
      accent: 'animateur de soirée d’entreprise',
      debit: 'scandé, sur le tempo',
      emotion: 'euphorie de séminaire, puis désarroi quand la musique s’arrête',
      direction:
        'Voix humaine passée en post dans un léger pitch −3 demi-tons + chorus (micro de DJ).',
    },
    design: `Man, 50 years old, corporate afterwork party host. Native French speaker. Big, round, greasy bass voice, rhythmic hype-man delivery locked to a beat, cheesy seventies disco energy. Studio recording, clean.`,
    preview:
      'On a toujours fait comme ça. Et ça a toujours marché. Pour nous. Restructurez avec moi ! Un, deux, un, deux ! Tout le monde sur la piste, la réorganisation, c’est maintenant ! … La musique… s’est arrêtée ?',
    post: { loudnorm: -18, pitch: -3 },
  },
  {
    id: 'lurcke',
    // Aperçu de Voice Design validé (bxoUpaJveyHUDkK06idZ) mais non sauvegardable (3/3 voix) : le
    // porteur du projet a retenu à la place la voix de BIBLIOTHÈQUE « Nico » (professionnelle,
    // français parisien, ton souriant et rassurant de pub), qui n'occupe pas d'emplacement.
    saved: {
      voiceId: 'MAZdzkb78f8SA7DNBT41',
      workspaceName: 'Nico (bibliothèque ElevenLabs, fr-parisien)',
      library: true,
    },
    name: 'Jean-Cul Lurcke (boss final)',
    key: true,
    fiche: {
      age: '41 ans',
      timbre: 'baryton léger de keynote, trop placé',
      accent: 'français parisien (voix de bibliothèque « Nico »), franglais de direction',
      debit: 'rapide, ne laisse jamais de silence (il en a peur)',
      emotion: 'assurance de conférence, nervosité dessous ; se brise au coup final',
      direction:
        'N’a jamais pris le train. Parle tout le temps. Le « … Concrètement ? » final est la seule vraie pause de sa vie : laisser le silence exister.',
    },
    design: `Man, 41 years old, corporate transformation director giving a keynote. Native French speaker, neutral accent, lots of corporate English jargon. Polished, over-projected light baritone; fast, confident salesman delivery that never leaves a silence, with nervous energy underneath that can crack. Studio recording, clean.`,
    preview:
      'Ah. L’équipe terrain. Entrez. Un café ? La machine fait quarante-sept recettes. Personne ne sait l’allumer. Arrêter ? On ne fait que libérer le marché. Je lance la présentation. Quatre cent douze slides. Il n’y a pas de pause prévue.',
    post: { loudnorm: -18 },
  },
  {
    id: 'hubert',
    name: 'Hubert Rentabilis (PDG, visio, jamais combattu)',
    key: false,
    fiche: {
      age: '60 ans',
      timbre: 'basse feutrée',
      accent: 'neutre, très posé',
      debit: 'lent, chaque mot pèse',
      emotion: 'calme absolu ; il évalue',
      direction:
        'Caméra éteinte : traitement « visio » en post (bande passante réduite, légère compression).',
    },
    design: `Man, 60 years old, chief executive heard only through a video call. Native French speaker, neutral accent. Low, soft, velvety bass voice, very slow and calm, every word weighed; quietly menacing politeness of someone who has never waited for a train. Studio recording, clean.`,
    preview:
      'Jean-Cul, on vous entend mal. On vous voit mal. On vous évalue bien. Proposez-leur une phase pilote. Les gens adorent les pilotes. Nous allons créer une commission. Elle réfléchira à pourquoi vous échouez.',
    post: { loudnorm: -19, visio: true },
  },
  // ─── Trailer ─────────────────────────────────────────────────────────────
  {
    id: 'narration',
    name: 'Voix off du trailer (option B, à valider)',
    key: false,
    fiche: {
      age: '—',
      timbre: 'reprend la voix de Yasmina (radio), diégétique',
      accent: 'belge francophone neutre',
      debit: 'calme, trois phrases',
      emotion: 'complicité',
      direction:
        'Proposition : pas de voix off « bande-annonce » ; trois phrases de Yasmina à la radio, comme si elle briefait le joueur. Utilise la voix `yasmina`.',
    },
    alias: 'yasmina',
  },
];
