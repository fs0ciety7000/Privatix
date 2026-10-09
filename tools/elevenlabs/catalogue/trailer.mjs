// Trailer « Le Shift » (60 s) : éléments à régénérer avec ElevenLabs (le reste vient des SFX du jeu,
// déjà au catalogue). Référence : SCRIPT.md du trailer § 5 (courbe d'intensité, ponctuations, silence)
// et tools/trailer/audio.mjs (bande-son synthétique actuelle, même chronologie).

/**
 * Musique de 60 s en plan de composition (Eleven Music v2 : `composition_plan.chunks`, 3 à 120 s par
 * morceau). Le silence de 40,4 à 41,4 s n'est PAS demandé au modèle (morceau trop court) : la section
 * boss se termine en « abrupt stop » à 41,4 s et le monteur coupe 40,4–41,4 (comme audio.mjs).
 */
export const TRAILER_MUSIC = {
  id: 'trailer.musique-60s',
  title: 'Trailer « Le Shift » — musique 60 s',
  seconds: 60,
  plan: [
    {
      at: '0:00–0:08',
      duration_ms: 8000,
      text: '[Prise de poste]',
      positive_styles: [
        'cozy lo-fi jazz',
        'Rhodes electric piano',
        'filtered office radio melody',
        '74 BPM',
        'F major 7th chords',
        'warm, quiet',
      ],
      negative_styles: ['drums', 'vocals'],
    },
    {
      at: '0:08–0:20',
      duration_ms: 12000,
      text: '[Premier train supprimé] {railway whistle at start}',
      positive_styles: [
        'D minor',
        '100 BPM',
        'deep drone',
        'pulsing synth bass',
        'kick drum enters at 4 seconds',
        'hi-hats enter at 8 seconds',
        'building tension toward a drop',
      ],
      negative_styles: ['vocals'],
    },
    {
      at: '0:20–0:34',
      duration_ms: 14000,
      text: '[Le drop]',
      positive_styles: [
        'D minor',
        '104 BPM',
        'full energetic combat groove',
        'marching snare',
        'neon synth arpeggio',
        'brass riff',
        'last 4 seconds four-on-the-floor disco kick at 110 BPM',
      ],
      negative_styles: ['vocals'],
    },
    {
      at: '0:34–0:41.4',
      duration_ms: 7400,
      text: '[Boss final] {abrupt stop at the end}',
      positive_styles: [
        'E-flat phrygian',
        '112 to 120 BPM accelerating',
        'heavy low brass on downbeats',
        'timpani',
        'climax',
        'ends with an abrupt hard stop',
      ],
      negative_styles: ['vocals', 'fade out'],
    },
    {
      at: '0:41.4–0:45',
      duration_ms: 3600,
      text: '[Après le coup]',
      positive_styles: ['low D drone only', 'reverb tail', 'calm after impact'],
      negative_styles: ['drums', 'vocals', 'melody'],
    },
    {
      at: '0:45–0:55',
      duration_ms: 10000,
      text: '[Fin de service]',
      positive_styles: [
        'slow Rhodes electric piano',
        '60 BPM',
        'F major 7 resolving to D major at 4 seconds',
        'tender, relieved',
      ],
      negative_styles: ['drums', 'vocals'],
    },
    {
      at: '0:55–1:00',
      duration_ms: 5000,
      text: '[Carte de fin] {short brass fanfare at 2 seconds}',
      positive_styles: [
        'D major',
        'short warm municipal brass band fanfare',
        'held final chord',
        'clean ending',
      ],
      negative_styles: ['vocals', 'long fade'],
    },
  ],
};

/** Effets propres au trailer (ceux qui n'existent pas dans le jeu). Les autres : SFX du catalogue. */
export const TRAILER_SFX = [
  [
    'trailer.larsen',
    '0:25.6',
    'Larsen de micro (intro de l’Invité d’honneur)',
    'Short microphone feedback squeal on a ceremony PA system, quickly controlled, not painful',
    1.2,
    3,
  ],
  [
    'trailer.impact-final',
    '0:41.4',
    'Impact final, le son le plus fort du film (après 1 s de silence)',
    'Massive cinematic impact: heavy iron wrench hit on steel with a deep sub boom and a long metallic reverb tail',
    3,
    4,
  ],
  [
    'trailer.riser',
    '0:17.6',
    'Montée vers le drop',
    'Short tension riser, rising filtered noise and synth swell, ends abruptly',
    2.4,
    2,
  ],
  [
    'trailer.subdrop',
    '0:20.0',
    'Sub drop sous le drop de Patrimoine',
    'Deep cinematic sub bass drop, clean',
    1.5,
    2,
  ],
  [
    'trailer.neon',
    '0:55.0',
    'Néon PRIVATIX qui s’allume (3 coupures)',
    'Neon sign flickering on with three electric buzzes then a steady hum',
    1.2,
    3,
  ],
  [
    'trailer.boule-cassee',
    '0:33.6',
    'Boule à facettes cassée, la salle s’éteint',
    'Mirror ball shattering softly followed by a power-down whoom and darkness',
    1.5,
    3,
  ],
];

/** Effets du jeu à régénérer en priorité pour le trailer (§ 5.2 du script). */
export const TRAILER_GAME_SFX = [
  'whistle',
  'slam',
  'perfectDash',
  'lastKill',
  'loot4',
  'ribbonSnip',
  'discoShimmer',
  'bossPhase',
  'preavis',
  'chime',
  'fanfare',
  'coffeeSip',
  'hitBoss',
  'crit',
];
