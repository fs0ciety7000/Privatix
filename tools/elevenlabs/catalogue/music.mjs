// Bande originale (OST) : 14 morceaux. Génération : POST /v1/music (Eleven Music), prompt en anglais
// (recommandé par la doc), `force_instrumental: true`, longueur en ms.
//
// Thèmes de combat à couches : on génère d'abord le MIX COMPLET (toutes couches, intensité 1) à tempo
// et tonalité fixés, puis on le découpe avec POST /v1/music/stem-separation (archive ZIP de stems).
// Les stems obtenus sont rangés dans les 4 couches du jeu (S1 basse/nappe, S2 grosse caisse et
// caisse claire, S3 charleston et percussions, S4 lead/arpège), comme `MusicDirector` le fait déjà
// avec ses seuils d'intensité 0,02 / 0,3 / 0,55 / 0,75 (src/audio/music.ts).
//
// Champs : id, title, use, seconds, bpm, key, instruments (FR), curve (FR), loop, layers (couches de
// jeu), prompt (EN), sample (lot d'écoute : extrait de 20 s).

const NO = 'Instrumental only, no vocals, no lyrics, no spoken word.';
const LOOPABLE = 'Steady tempo throughout, clean loopable ending that returns to the opening bar.';

export const MUSIC = [
  {
    id: 'ost.01-prise-de-poste',
    title: 'Prise de poste (thème titre)',
    use: 'Écran titre, menu principal',
    seconds: 95,
    bpm: 92,
    key: 'ré mineur → ré majeur',
    instruments:
      'Piano électrique (Rhodes), harmonie municipale (cornets, bugles, tuba), caisse claire brossée, nappe de synthé néon, carillon de gare 3 notes en motif',
    curve:
      'Rhodes seul et carillon (0–20 s), entrée de la fanfare en sourdine (20–50 s), tutti chaleureux en ré majeur (50–80 s), retour au Rhodes (80–95 s)',
    loop: 'non (intro) ; mesures 9–40 bouclables',
    prompt: `Warm cinematic indie game title theme, 92 BPM, D minor resolving to D major. Opens with a mellow Rhodes electric piano and a three-note railway station chime motif, then a Belgian municipal brass band (cornets, flugelhorns, tuba) enters softly with brushed snare, building to a warm, proud, slightly melancholic full brass statement, under a subtle neon synth pad. Feels like a night shift at a small train station, tender and resilient, gentle humour. ${NO}`,
  },
  {
    id: 'ost.02-occ-jour',
    title: 'OCC — Service de jour',
    use: 'Hub (Centre Opérationnel), roulements Matin et Après-midi',
    seconds: 120,
    bpm: 74,
    key: 'Fa maj7 – Mi m7 – Ré m7 – Do maj7 (grille du jeu)',
    instruments:
      'Rhodes avec trémolo, contrebasse, batterie aux balais, vibraphone, petite radio filtrée qui joue une mélodie en arrière-plan',
    curve: 'Plate et chaleureuse (intensité 2/10), respirations toutes les 8 mesures',
    loop: 'oui',
    sample: true,
    prompt: `Cozy lo-fi jazz loop for a railway operations break room, 74 BPM, chord progression Fmaj7 - Em7 - Dm7 - Cmaj7. Rhodes electric piano with gentle tremolo, upright bass, brushed drums, soft vibraphone, and a faint melody from a tiny filtered office radio in the background. Warm, unhurried, friendly, the smell of old coffee. ${NO} ${LOOPABLE}`,
  },
  {
    id: 'ost.03-occ-nuit',
    title: 'OCC — Service de nuit',
    use: 'Hub, roulement Nuit',
    seconds: 120,
    bpm: 66,
    key: 'même grille, voicings plus ouverts',
    instruments:
      'Rhodes plus clairsemé, trompette avec sourdine harmon, contrebasse, bourdonnement de néon, cafetière lointaine',
    curve: 'Intensité 1/10, très aéré',
    loop: 'oui',
    prompt: `Late-night lo-fi jazz loop, 66 BPM, chord progression Fmaj7 - Em7 - Dm7 - Cmaj7 with open voicings. Sparse Rhodes, muted harmon trumpet playing a lonely melody, upright bass, very soft brushes, faint neon hum texture. Sleepy, intimate, 3 a.m. night shift in a small control room. ${NO} ${LOOPABLE}`,
  },
  {
    id: 'ost.04-quais-exploration',
    title: 'Quais & Voies — Exploration',
    use: 'Biome 1, salles sans ennemis, Salle des pauses',
    seconds: 120,
    bpm: 100,
    key: 'ré mineur (bourdon de ré)',
    instruments:
      'Bourdon grave, guitare baryton en trémolo, percussions de rail lointaines, nappe de néon, piano préparé',
    curve: 'Intensité 3/10, tension sourde',
    loop: 'oui',
    prompt: `Dark ambient exploration loop for a deserted train platform at night, 100 BPM pulse, D minor drone. Low sawtooth drone, tremolo baritone guitar, distant metallic rail percussion, buzzing neon texture, sparse prepared piano notes, foggy and suspenseful but not scary. ${NO} ${LOOPABLE}`,
  },
  {
    id: 'ost.05-quais-combat',
    title: 'Quais & Voies — Combat (4 couches)',
    use: 'Biome 1, combat ; couches pilotées par combatIntensity()',
    seconds: 96,
    bpm: 100,
    key: 'ré mineur (Ré m – Si♭ – Fa – Do, grille du jeu)',
    instruments:
      'S1 basse synthé + contrebasse ; S2 grosse caisse et caisse claire de fanfare ; S3 charleston, percussions de rail et de clé ; S4 arpège synthé néon + cuivres en riff',
    curve: 'Pilotée par le jeu : S1 dès 0,02, S2 à 0,3, S3 à 0,55, S4 à 0,75',
    loop: 'oui (40 mesures exactes)',
    layers: [
      'S1 basse',
      'S2 grosse caisse / caisse claire',
      'S3 charleston / percussions métal',
      'S4 arpège / cuivres',
    ],
    sample: true,
    prompt: `Driving action game combat music, 100 BPM, D minor, chord loop Dm - Bb - F - C. Pulsing synth bass doubled by upright bass, punchy kick and marching snare like a brass band drummer, tight hi-hats and metallic railway percussion (rails, wrench hits), bright neon synth arpeggio and a short brass riff on top. Energetic, rhythmic, gritty, satirical but serious, clear separated instruments for stem separation. ${NO} ${LOOPABLE}`,
  },
  {
    id: 'ost.06-passerelle',
    title: 'La Passerelle — Le vent tourne (exploration + 4 couches)',
    use: 'Biome 2 (aube, vide, vent) ; exploration = S1 seul',
    seconds: 96,
    bpm: 88,
    key: 'la mineur (dorien)',
    instruments:
      'S1 nappe de cordes aériennes et vent ; S2 timbales et toms feutrés ; S3 ostinato de cordes en pizzicato et cloches tubulaires ; S4 cor et trompette',
    curve:
      'Le biome le plus silencieux : S1 presque seul en exploration, montée par couches en combat',
    loop: 'oui',
    layers: ['S1 nappe / vent', 'S2 timbales / toms', 'S3 ostinato / cloches', 'S4 cuivres'],
    prompt: `Airy cinematic action music for a vast glass footbridge at dawn, 88 BPM, A dorian. Wide high string pads with wind texture, soft timpani and felt toms, pizzicato string ostinato with tubular bells, and a noble French horn and trumpet melody on top. Cold, beautiful, vertiginous, hopeful. Clear separated instruments for stem separation. ${NO} ${LOOPABLE}`,
  },
  {
    id: 'ost.07-hall-bag',
    title: 'Hall & BAG — Terminus BAG (4 couches)',
    use: 'Biome 3 ; la musique d’ascenseur se déforme à chaque vague',
    seconds: 96,
    bpm: 104,
    key: 'mi mineur',
    instruments:
      'S1 bossa d’ascenseur (Rhodes, flûte, guitare nylon) ; S2 batterie électronique ; S3 basse synthé saturée ; S4 lead synthwave agressif',
    curve: 'Couche S1 seule = ascenseur poli ; S4 = l’ascenseur a craqué',
    loop: 'oui',
    layers: ['S1 bossa ascenseur', 'S2 batterie électro', 'S3 basse saturée', 'S4 lead synthwave'],
    prompt: `Corporate elevator bossa nova that mutates into aggressive synthwave, 104 BPM, E minor. Polite Rhodes, flute and nylon guitar bossa groove, layered with an electronic drum machine, a distorted synth bass and an aggressive retro synthwave lead. Satirical open-space office menace. Clear separated instruments for stem separation. ${NO} ${LOOPABLE}`,
  },
  {
    id: 'ost.08-boss-auditeur',
    title: 'Boss — L’Auditeur des Quais',
    use: 'Boss 1, 3 phases (+4 BPM par phase en jeu)',
    seconds: 90,
    bpm: 112,
    key: 'mi♭ phrygien (le mode du boss du jeu)',
    instruments:
      'Chronomètre comme métronome, cuivres graves sur le premier temps, timbales, cordes en staccato, basse synthé, alarme de quai',
    curve:
      'Phase 1 rigide ; phase 2 rames (accents de cuivres) ; phase 3 tout s’emballe (le tic-tac déraille)',
    loop: 'oui (une boucle par phase, même grille)',
    layers: ['S1 basse / tic-tac', 'S2 percussions', 'S3 cordes staccato', 'S4 cuivres graves'],
    prompt: `Tense boss battle music, 112 BPM, E-flat phrygian. A ticking stopwatch as the metronome, heavy low brass hits on every downbeat, timpani, staccato strings, pulsing synth bass, and an occasional railway platform alarm tone. Rigid, bureaucratic, obsessive, menacing in a satirical way. Clear separated instruments for stem separation. ${NO} ${LOOPABLE}`,
  },
  {
    id: 'ost.09-boss-invite',
    title: 'Boss — Duel oratoire (L’Invité d’honneur)',
    use: 'Boss 2, phases « Le Discours inaugural », « La Première Pierre », « Le Ruban »',
    seconds: 90,
    bpm: 96,
    key: 'si♭ majeur pompeux → si♭ mineur au Ruban',
    instruments:
      'Harmonie municipale de cérémonie, orgue de salle des fêtes, applaudissements rythmiques, caisse claire de défilé, glockenspiel',
    curve:
      'Marche protocolaire (P1), timbales des premières pierres (P2), accélération en mineur, ciseaux = coups de cymbale (P3)',
    loop: 'oui',
    layers: [
      'S1 orgue / basse',
      'S2 caisse de défilé',
      'S3 applaudissements / glockenspiel',
      'S4 cuivres',
    ],
    note: 'Satire bon enfant de la cérémonie : aucune musique politique, aucun hymne réel (ni national, ni de parti), aucune citation mélodique reconnaissable.',
    prompt: `Pompous comedic ceremony boss battle music, 96 BPM, B-flat major turning to B-flat minor. A small-town municipal brass band playing a grand inauguration march, village hall organ, rhythmic polite applause, parade snare drum and glockenspiel, swelling into an urgent, playful duel. Good-natured satire of a ribbon-cutting ceremony, original melody, no national or political anthem. Clear separated instruments for stem separation. ${NO} ${LOOPABLE}`,
  },
  {
    id: 'ost.10-boss-discosaure',
    title: 'Boss — Discosaure (Afterwork)',
    use: 'Mini-boss du biome 3 ; les piétinements tombent sur la grosse caisse',
    seconds: 90,
    bpm: 120,
    key: 'la mineur',
    instruments:
      'Four-on-the-floor, basse disco en octaves, cordes disco, clavinet, cloche à vache, filtre passe-bas en phase 2 « Boule en surchauffe »',
    curve:
      'Disco de séminaire (P1), filtre et montée en surchauffe (P2) ; coupure nette quand la boule casse',
    loop: 'oui',
    layers: [
      'S1 basse octaves',
      'S2 four-on-the-floor',
      'S3 cordes / clavinet',
      'S4 cloche / lead',
    ],
    prompt: `Cheesy corporate afterwork disco boss music, 120 BPM, A minor. Four-on-the-floor kick, octave disco bass, lush disco strings, funky clavinet, cowbell, seventies dance floor energy that feels slightly absurd and menacing, with filter sweeps building tension. Every quarter note kick must be strong and clear. Clear separated instruments for stem separation. ${NO} ${LOOPABLE}`,
  },
  {
    id: 'ost.11-boss-lurcke',
    title: 'Boss final — Jean-Cul Lurcke « Méga-Deck 2032 »',
    use: 'Boss final, 3 phases ; silence total au coup final (géré par le jeu)',
    seconds: 120,
    bpm: 116,
    key: 'do mineur',
    instruments:
      'P1 musique de keynote « start-up » (ukulélé, claps, glockenspiel) qui se corrompt ; P2 visio (musique d’attente, glitchs, bourdon) ; P3 photocopieuse industrielle (rythme mécanique, chœur sans paroles, orchestre)',
    curve: 'Montée continue jusqu’au silence final',
    loop: 'oui (une boucle par phase)',
    layers: [
      'S1 bourdon / basse',
      'S2 rythme mécanique',
      'S3 keynote / attente',
      'S4 orchestre / chœur',
    ],
    prompt: `Epic satirical final boss music, 116 BPM, C minor. Starts as an upbeat corporate startup keynote jingle (ukulele, hand claps, glockenspiel) that gets corrupted by glitchy video-call hold music and deep drones, then becomes a relentless industrial orchestral piece driven by the mechanical rhythm of a giant photocopier, with a wordless choir. Absurd, grand and threatening. Clear separated instruments for stem separation. ${NO}`,
  },
  {
    id: 'ost.12-departs-victoire',
    title: 'Écran des départs — Shift tenu',
    use: 'Résultats, victoire (stinger 6 s puis boucle)',
    seconds: 40,
    bpm: 84,
    key: 'ré majeur',
    instruments: 'Fanfare brève, Rhodes, carillon de gare 3 notes, contrebasse',
    curve: 'Stinger triomphal puis boucle tranquille',
    loop: 'boucle après 6 s',
    prompt: `Short warm victory theme for a results screen, 84 BPM, D major. A proud short brass band fanfare and three-note station chime, then settles into a calm Rhodes and upright bass loop. Relief, pride, coffee after a long shift. ${NO}`,
  },
  {
    id: 'ost.13-departs-supprime',
    title: 'Écran des départs — Supprimé',
    use: 'Résultats, défaite (tendre, jamais moqueur)',
    seconds: 20,
    bpm: 70,
    key: 'ré mineur',
    instruments: 'Cuivres en sourdine, carillon légèrement désaccordé, Rhodes',
    curve: 'Descente douce, finit sur une note tenue d’espoir',
    loop: 'non',
    prompt: `Short gentle defeat theme for a results screen, 70 BPM, D minor. Muted brass, a slightly detuned three-note station chime and soft Rhodes, tender and wry rather than tragic, ending on a hopeful held chord. ${NO}`,
  },
  {
    id: 'ost.14-le-7h12',
    title: 'Le 7h12 (générique)',
    use: 'Générique de fin, épilogue quai 2',
    seconds: 180,
    bpm: 80,
    key: 'ré majeur',
    instruments:
      'Piano, harmonie municipale, cordes, chœur fredonné sans paroles (bouches fermées), reprise du thème titre et du carillon',
    curve: 'Piano seul → harmonie → tutti → piano seul ; finit sur le carillon',
    loop: 'non',
    vocals: 'chœur fredonné, sans paroles',
    prompt: `Heartfelt end credits theme, 80 BPM, D major. Solo piano reprising a warm brass-band melody, joined by a Belgian municipal brass band, strings and a wordless humming choir, growing into a moving tutti, then back to solo piano ending on a three-note railway station chime. Solidarity, dawn on platform 2, the 7:12 train arriving on time. No lyrics, humming only.`,
  },
];

/** Extraits d'écoute de 20 s (lot `--samples`) : mêmes prompts, durée 20 s. */
export const MUSIC_SAMPLE_SECONDS = 20;
