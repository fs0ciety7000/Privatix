/**
 * Bibliothèque des effets sonores, tous synthétisés à l'exécution (aucun fichier audio, aucun artiste,
 * aucune voix enregistrée). Chaque entrée décrit son bus, sa limite de voix simultanées, l'écart minimal
 * entre deux déclenchements et une fonction de rendu qui planifie ses nœuds sur `out`.
 *
 * Pourquoi procédural à l'exécution plutôt que pré-rendu en OGG : zéro octet téléchargé (le jeu vise
 * le mobile), aucune étape de build ni d'encodeur, des variations à chaque coup (hauteur, timbre) qui
 * évitent l'effet « mitraillette » d'un même fichier rejoué, et le même code sert au rendu hors ligne
 * des tests d'écoute (`OfflineAudioContext`). Le coût CPU reste faible : quelques oscillateurs et
 * bouffées de bruit par son, plafonnés par le pool de voix.
 */
import { lowpass, metal, mtof, noise, tone } from './synth';

export type BusId = 'sfx' | 'ui';

export interface RenderArgs {
  readonly ctx: BaseAudioContext;
  readonly out: AudioNode;
  readonly t: number;
  /** Aléatoire de variation (0..1), injecté pour un rendu hors ligne reproductible. */
  readonly r: () => number;
  /** Intensité libre (0..1) : échelle d'une explosion, combo, etc. */
  readonly amount: number;
}

export interface SfxDef {
  readonly bus: BusId;
  /** Voix simultanées maximales de ce son (au-delà, la plus ancienne est coupée). */
  readonly max: number;
  /** Écart minimal entre deux déclenchements (ms) : en deçà, le second est ignoré. */
  readonly gapMs: number;
  /** Son répétitif (pas, coups, tickets…) : bridé davantage par « réduire les sons répétitifs ». */
  readonly repetitive?: boolean;
  /** Placé dans l'espace (panoramique, distance). Faux pour l'UI, les annonces et les fanfares. */
  readonly spatial?: boolean;
  /** Planifie le son, renvoie sa durée (s). */
  readonly render: (a: RenderArgs) => number;
}

/** Facteur de variation autour de 1 (±amt). */
function vary(r: () => number, amt: number): number {
  return 1 + (r() - 0.5) * 2 * amt;
}

// ─── Briques partagées ────────────────────────────────────────────────────────

/** Souffle du balayage (« smear ») : bruit passe-bande qui glisse. */
function whoosh(a: RenderArgs, from: number, to: number, dur: number, gain: number): number {
  return noise(a.ctx, a.out, a.t, {
    filter: 'bandpass',
    freq: from * vary(a.r, 0.08),
    to: to * vary(a.r, 0.08),
    q: 1.4,
    gain,
    attack: dur * 0.35,
    decay: dur * 0.65,
  });
}

/** Coup sourd (corps, sol) : sinus qui chute + bruit grave. */
function thud(a: RenderArgs, f0: number, gain: number, decay: number, t = a.t): number {
  tone(a.ctx, a.out, t, f0, { to: f0 * 0.45, gain, attack: 0.002, decay });
  noise(a.ctx, a.out, t, { filter: 'lowpass', freq: 700, gain: gain * 0.6, decay: decay * 0.6 });
  return decay;
}

/** Cloche douce (sinus + partiels harmoniques) : carillon, récompenses. */
function bell(a: RenderArgs, f: number, t: number, gain: number, decay: number): number {
  tone(a.ctx, a.out, t, f, { gain, attack: 0.004, decay });
  tone(a.ctx, a.out, t, f * 2, { gain: gain * 0.35, attack: 0.003, decay: decay * 0.5 });
  tone(a.ctx, a.out, t, f * 3.01, { gain: gain * 0.12, attack: 0.002, decay: decay * 0.3 });
  return decay;
}

/** Bruissement de papier : quelques micro-bouffées aiguës espacées au hasard. */
function paper(a: RenderArgs, count: number, gain: number, t = a.t): number {
  let at = t;
  for (let i = 0; i < count; i += 1) {
    noise(a.ctx, a.out, at, {
      filter: 'bandpass',
      freq: 2600 * vary(a.r, 0.3),
      q: 0.9,
      gain: gain * vary(a.r, 0.3),
      decay: 0.03 + a.r() * 0.03,
    });
    at += 0.018 + a.r() * 0.03;
  }
  return at - t + 0.06;
}

/** Arpège de notes (cloches), renvoie la durée totale. */
function arpeggio(
  a: RenderArgs,
  notes: readonly number[],
  step: number,
  gain: number,
  decay: number,
): number {
  notes.forEach((n, i) => bell(a, mtof(n), a.t + i * step, gain, decay));
  return (notes.length - 1) * step + decay;
}

/** Sifflet à bille (chef de gare) : sinus modulé en amplitude par le roulement de la bille. */
function peaWhistle(a: RenderArgs, t: number, hold: number, gain: number): number {
  const { ctx } = a;
  const soft = lowpass(ctx, a.out, 3400);
  const osc = ctx.createOscillator();
  const f = 2150 * vary(a.r, 0.02);
  osc.frequency.setValueAtTime(f * 0.94, t);
  osc.frequency.exponentialRampToValueAtTime(f, t + 0.06);
  const env = ctx.createGain();
  const am = ctx.createGain();
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.value = 31;
  depth.gain.value = 0.45;
  am.gain.value = 0.55;
  lfo.connect(depth).connect(am.gain);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(gain, t + 0.03);
  env.gain.setValueAtTime(gain, t + 0.03 + hold);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + hold + 0.12);
  osc.connect(am).connect(env).connect(soft);
  const end = t + 0.03 + hold + 0.14;
  osc.start(t);
  lfo.start(t);
  osc.stop(end);
  lfo.stop(end);
  noise(ctx, soft, t, {
    filter: 'bandpass',
    freq: f,
    q: 5,
    gain: gain * 0.5,
    attack: 0.02,
    hold,
    decay: 0.1,
  });
  return end - a.t;
}

/** Clameur de foule : voix de bruit filtrées sur des formants, amplitude ondulante. */
function clamor(a: RenderArgs, t: number, dur: number, gain: number): number {
  const { ctx } = a;
  const bus = lowpass(ctx, a.out, 2200);
  const formants = [420, 560, 700, 850, 980, 1150, 640, 760];
  for (const f of formants) {
    // Bruit filtré étroit = « voix » sans voix enregistrée.
    noise(ctx, bus, t + a.r() * 0.15, {
      filter: 'bandpass',
      freq: f * vary(a.r, 0.1),
      q: 7,
      gain: gain * vary(a.r, 0.3),
      attack: dur * 0.35,
      hold: dur * 0.25,
      decay: dur * 0.4,
    });
  }
  // Grave de foule (piétinement).
  noise(ctx, bus, t, {
    filter: 'lowpass',
    freq: 260,
    gain: gain * 1.4,
    attack: dur * 0.3,
    hold: dur * 0.3,
    decay: dur * 0.4,
  });
  return dur + 0.2;
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

const RARITY_STAMPS: readonly ((a: RenderArgs) => number)[] = [
  // Réformé : un « tac » de tampon sobre.
  (a) => {
    thud(a, 260, 0.18, 0.08);
    return tone(a.ctx, a.out, a.t, 880, { type: 'triangle', gain: 0.06, decay: 0.12 });
  },
  // Réglementaire : deux notes nettes.
  (a) => arpeggio(a, [76, 81], 0.07, 0.1, 0.35),
  // Homologué : triade qui scintille.
  (a) => {
    noise(a.ctx, a.out, a.t, {
      filter: 'highpass',
      freq: 5000,
      gain: 0.03,
      attack: 0.05,
      decay: 0.4,
    });
    return arpeggio(a, [72, 76, 79, 84], 0.06, 0.1, 0.6);
  },
  // Hors-série : arpège plus long + chatoiement.
  (a) => {
    tone(a.ctx, a.out, a.t, mtof(60), { type: 'triangle', gain: 0.08, attack: 0.05, decay: 1 });
    noise(a.ctx, a.out, a.t + 0.1, {
      filter: 'highpass',
      freq: 4500,
      gain: 0.04,
      attack: 0.15,
      decay: 0.8,
    });
    return arpeggio(a, [72, 76, 79, 83, 86, 91], 0.055, 0.1, 0.8);
  },
  // Patrimoine : nappe d'accord qui gonfle, cloche grave, pluie d'étincelles.
  (a) => {
    const pad = lowpass(a.ctx, a.out, 1800);
    for (const n of [48, 55, 60, 64, 67]) {
      tone(a.ctx, pad, a.t, mtof(n), {
        type: 'sawtooth',
        gain: 0.035,
        attack: 0.35,
        hold: 0.5,
        decay: 1.4,
        detune: (a.r() - 0.5) * 14,
      });
    }
    bell(a, mtof(60), a.t, 0.16, 2.2);
    noise(a.ctx, a.out, a.t + 0.2, {
      filter: 'highpass',
      freq: 5500,
      gain: 0.035,
      attack: 0.3,
      hold: 0.4,
      decay: 1.2,
    });
    arpeggio({ ...a, t: a.t + 0.25 }, [84, 88, 91, 96, 91, 96, 100], 0.07, 0.07, 0.9);
    return 2.6;
  },
];

export const SFX = {
  // ── Clé à tire-fond : 3 coups distincts + coup en dash ─────────────────────
  swing1: {
    bus: 'sfx',
    max: 3,
    gapMs: 40,
    repetitive: true,
    render: (a) => {
      metal(a.ctx, a.out, a.t + 0.02, 1240 * vary(a.r, 0.04), 0.025, 0.08);
      return whoosh(a, 700, 2600, 0.15, 0.32);
    },
  },
  swing2: {
    bus: 'sfx',
    max: 3,
    gapMs: 40,
    repetitive: true,
    render: (a) => {
      metal(a.ctx, a.out, a.t + 0.03, 1050 * vary(a.r, 0.04), 0.025, 0.08);
      return whoosh(a, 2400, 800, 0.18, 0.34);
    },
  },
  swing3: {
    bus: 'sfx',
    max: 2,
    gapMs: 60,
    render: (a) => {
      tone(a.ctx, a.out, a.t, 140, { to: 70, gain: 0.12, attack: 0.04, decay: 0.2 });
      return whoosh(a, 300, 1700, 0.3, 0.42);
    },
  },
  swingDash: {
    bus: 'sfx',
    max: 2,
    gapMs: 60,
    render: (a) => {
      whoosh(a, 500, 3000, 0.22, 0.3);
      return metal(a.ctx, a.out, a.t + 0.05, 980, 0.03, 0.1);
    },
  },
  /** Coup 3 qui frappe le sol (impact métallique lourd). */
  slam: {
    bus: 'sfx',
    max: 2,
    gapMs: 80,
    render: (a) => {
      thud(a, 110, 0.4, 0.35);
      metal(a.ctx, a.out, a.t, 190 * vary(a.r, 0.05), 0.16, 0.6);
      return noise(a.ctx, a.out, a.t, {
        filter: 'lowpass',
        freq: 2200,
        to: 300,
        gain: 0.25,
        decay: 0.3,
      });
    },
  },
  /** Impact métallique de la clé sur une cible (amount : 0 léger, 1 lourd). */
  impact: {
    bus: 'sfx',
    max: 4,
    gapMs: 25,
    repetitive: true,
    render: (a) => {
      const heavy = a.amount > 0.5;
      const base = (heavy ? 330 : 560) * vary(a.r, 0.06);
      noise(a.ctx, a.out, a.t, { filter: 'highpass', freq: 2500, gain: 0.18, decay: 0.025 });
      thud(a, heavy ? 150 : 210, heavy ? 0.3 : 0.2, 0.12);
      return metal(a.ctx, a.out, a.t, base, heavy ? 0.16 : 0.11, heavy ? 0.45 : 0.28);
    },
  },
  /** Consultant : liasse de papier qui vole. */
  hitPaper: {
    bus: 'sfx',
    max: 3,
    gapMs: 30,
    repetitive: true,
    render: (a) => paper(a, 5, 0.22),
  },
  /** Consultant (coup lourd) ou Manager : ordinateur portable qui claque et bipe. */
  hitLaptop: {
    bus: 'sfx',
    max: 3,
    gapMs: 40,
    repetitive: true,
    render: (a) => {
      const f = lowpass(a.ctx, a.out, 3000);
      tone(a.ctx, f, a.t, 1700 * vary(a.r, 0.05), { type: 'square', gain: 0.06, decay: 0.03 });
      noise(a.ctx, a.out, a.t, { filter: 'bandpass', freq: 2200, q: 3, gain: 0.2, decay: 0.05 });
      return tone(a.ctx, a.out, a.t + 0.05, 880, {
        type: 'triangle',
        to: 440,
        gain: 0.06,
        decay: 0.14,
      });
    },
  },
  /** Borne automatique : carcasse de tôle. */
  hitMetal: {
    bus: 'sfx',
    max: 3,
    gapMs: 30,
    repetitive: true,
    render: (a) => {
      noise(a.ctx, a.out, a.t, { filter: 'bandpass', freq: 1800, q: 2, gain: 0.16, decay: 0.08 });
      return metal(a.ctx, a.out, a.t, 270 * vary(a.r, 0.05), 0.12, 0.5, [1, 1.58, 2.42, 3.9]);
    },
  },
  /** Drone : coque plastique + moteur qui hoquette. */
  hitDrone: {
    bus: 'sfx',
    max: 3,
    gapMs: 30,
    repetitive: true,
    render: (a) => {
      tone(a.ctx, a.out, a.t, 1300, { type: 'triangle', gain: 0.08, decay: 0.04 });
      return tone(a.ctx, lowpass(a.ctx, a.out, 2000), a.t, 420, {
        type: 'sawtooth',
        to: 260,
        gain: 0.07,
        decay: 0.15,
      });
    },
  },
  /** Auditeur : costume épais et dossier. */
  hitBoss: {
    bus: 'sfx',
    max: 3,
    gapMs: 40,
    repetitive: true,
    render: (a) => {
      thud(a, 120, 0.25, 0.18);
      return paper(a, 3, 0.15);
    },
  },
  crit: {
    bus: 'sfx',
    max: 2,
    gapMs: 50,
    render: (a) => {
      tone(a.ctx, a.out, a.t, 90, { to: 45, gain: 0.25, decay: 0.2 });
      return metal(a.ctx, a.out, a.t + 0.01, 1180 * vary(a.r, 0.03), 0.09, 0.5, [1, 2, 3.01, 4.1]);
    },
  },
  kill: {
    bus: 'sfx',
    max: 3,
    gapMs: 40,
    repetitive: true,
    render: (a) => {
      tone(a.ctx, a.out, a.t, 170, { to: 60, gain: 0.2, decay: 0.22 });
      return noise(a.ctx, a.out, a.t, {
        filter: 'lowpass',
        freq: 1400,
        to: 300,
        gain: 0.2,
        decay: 0.28,
      });
    },
  },
  lastKill: {
    bus: 'sfx',
    max: 1,
    gapMs: 300,
    spatial: false,
    render: (a) => {
      tone(a.ctx, a.out, a.t, 100, { to: 38, gain: 0.3, decay: 0.7 });
      metal(a.ctx, a.out, a.t, 147, 0.08, 1.4);
      return noise(a.ctx, a.out, a.t, {
        filter: 'lowpass',
        freq: 900,
        to: 120,
        gain: 0.18,
        decay: 0.8,
      });
    },
  },
  // ── Mouvements et capacités ────────────────────────────────────────────────
  /** Dash « Retard » : souffle + crissement de frein, filtré pour rester doux. */
  dash: {
    bus: 'sfx',
    max: 2,
    gapMs: 80,
    render: (a) => {
      whoosh(a, 350, 1500, 0.24, 0.42);
      const soft = lowpass(a.ctx, a.out, 2600);
      return (
        tone(a.ctx, soft, a.t + 0.08, 1650 * vary(a.r, 0.03), {
          type: 'triangle',
          to: 1500,
          gain: 0.045,
          attack: 0.04,
          decay: 0.26,
          vibrato: [18, 23],
        }) + 0.08
      );
    },
  },
  perfectDash: {
    bus: 'sfx',
    max: 1,
    gapMs: 150,
    spatial: false,
    render: (a) => {
      whoosh(a, 3000, 600, 0.3, 0.18);
      return arpeggio(a, [79, 86], 0.05, 0.08, 0.4);
    },
  },
  /** Coup de sifflet du chef de gare. */
  whistle: {
    bus: 'sfx',
    max: 1,
    gapMs: 200,
    spatial: false,
    render: (a) => peaWhistle(a, a.t, 0.32, 0.11),
  },
  /** Préavis de grève : sifflet long, puis clameur qui gonfle. */
  preavis: {
    bus: 'sfx',
    max: 1,
    gapMs: 400,
    spatial: false,
    render: (a) => {
      peaWhistle(a, a.t, 0.9, 0.11);
      thud(a, 90, 0.3, 0.4, a.t + 0.25);
      return clamor(a, a.t + 0.2, 1.7, 0.12) + 0.2;
    },
  },
  /** Gobelet sorti (plastique creux). */
  coffeeCup: {
    bus: 'sfx',
    max: 1,
    gapMs: 150,
    render: (a) => {
      tone(a.ctx, a.out, a.t, 920, { type: 'triangle', gain: 0.08, decay: 0.05 });
      tone(a.ctx, a.out, a.t + 0.06, 1240, { type: 'triangle', gain: 0.05, decay: 0.04 });
      return noise(a.ctx, a.out, a.t, {
        filter: 'bandpass',
        freq: 1800,
        q: 4,
        gain: 0.08,
        decay: 0.06,
      });
    },
  },
  /** Gorgée : deux « glouglous » et une aspiration. */
  coffeeSip: {
    bus: 'sfx',
    max: 1,
    gapMs: 150,
    render: (a) => {
      noise(a.ctx, a.out, a.t, {
        filter: 'bandpass',
        freq: 1300,
        to: 700,
        q: 2,
        gain: 0.08,
        attack: 0.05,
        decay: 0.2,
      });
      tone(a.ctx, a.out, a.t + 0.18, 260, { to: 170, gain: 0.16, attack: 0.01, decay: 0.07 });
      return (
        tone(a.ctx, a.out, a.t + 0.3, 240, { to: 330, gain: 0.12, attack: 0.01, decay: 0.08 }) + 0.3
      );
    },
  },
  hurt: {
    bus: 'sfx',
    max: 2,
    gapMs: 90,
    spatial: false,
    render: (a) => {
      thud(a, 160, 0.3, 0.16);
      return tone(a.ctx, lowpass(a.ctx, a.out, 800), a.t, 190 * vary(a.r, 0.05), {
        type: 'sawtooth',
        to: 95,
        gain: 0.12,
        decay: 0.2,
      });
    },
  },
  /** Le Burnout franchit un palier : tension qui monte. */
  burnoutUp: {
    bus: 'sfx',
    max: 1,
    gapMs: 600,
    spatial: false,
    render: (a) => {
      const f = a.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(350, a.t);
      f.frequency.exponentialRampToValueAtTime(1400, a.t + 0.6);
      f.connect(a.out);
      tone(a.ctx, f, a.t, 110, {
        type: 'sawtooth',
        to: 165,
        gain: 0.07,
        attack: 0.25,
        decay: 0.45,
        glide: 0.6,
      });
      return tone(a.ctx, f, a.t, 110, {
        type: 'sawtooth',
        to: 166,
        gain: 0.07,
        attack: 0.25,
        decay: 0.45,
        detune: 12,
        glide: 0.6,
      });
    },
  },
  /** Pétage de plombs : bourdonnement électrique, crépitements, plomb qui saute, extinction. */
  meltdown: {
    bus: 'sfx',
    max: 1,
    gapMs: 1000,
    spatial: false,
    render: (a) => {
      const soft = lowpass(a.ctx, a.out, 2500);
      tone(a.ctx, soft, a.t, 100, {
        type: 'sawtooth',
        gain: 0.06,
        attack: 0.05,
        hold: 0.35,
        decay: 0.2,
      });
      for (let i = 0; i < 9; i += 1) {
        noise(a.ctx, a.out, a.t + a.r() * 0.5, {
          filter: 'bandpass',
          freq: 2500 + a.r() * 1500,
          q: 3,
          gain: 0.1,
          decay: 0.02,
        });
      }
      thud(a, 140, 0.35, 0.3, a.t + 0.55);
      noise(a.ctx, a.out, a.t + 0.55, {
        filter: 'lowpass',
        freq: 3000,
        to: 400,
        gain: 0.2,
        decay: 0.25,
      });
      return (
        tone(a.ctx, a.out, a.t + 0.6, 520, { type: 'triangle', to: 55, gain: 0.1, decay: 0.7 }) +
        0.6
      );
    },
  },
  death: {
    bus: 'sfx',
    max: 1,
    gapMs: 1000,
    spatial: false,
    render: (a) => {
      thud(a, 120, 0.35, 0.4);
      const soft = lowpass(a.ctx, a.out, 1100);
      // « Wah wah waaah » de trombone, en dents de scie filtrées.
      [58, 57, 56].forEach((n, i) => {
        tone(a.ctx, soft, a.t + 0.35 + i * 0.32, mtof(n), {
          type: 'sawtooth',
          gain: 0.08,
          attack: 0.04,
          decay: 0.26,
          vibrato: [10, 5],
        });
      });
      return (
        tone(a.ctx, soft, a.t + 1.31, mtof(55), {
          type: 'sawtooth',
          to: mtof(53),
          gain: 0.08,
          attack: 0.05,
          hold: 0.4,
          decay: 0.6,
          vibrato: [25, 6],
        }) + 1.31
      );
    },
  },
  victory: {
    bus: 'sfx',
    max: 1,
    gapMs: 1000,
    spatial: false,
    render: (a) => {
      const soft = lowpass(a.ctx, a.out, 2400);
      [60, 64, 67, 72].forEach((n, i) => {
        tone(a.ctx, soft, a.t + i * 0.13, mtof(n), { type: 'square', gain: 0.045, decay: 0.2 });
        bell(a, mtof(n), a.t + i * 0.13, 0.07, 0.3);
      });
      for (const n of [60, 64, 67, 72]) {
        tone(a.ctx, soft, a.t + 0.55, mtof(n), {
          type: 'sawtooth',
          gain: 0.035,
          attack: 0.05,
          hold: 0.6,
          decay: 0.9,
        });
      }
      return 2.1;
    },
  },
  // ── Ennemis ───────────────────────────────────────────────────────────────
  /** Télégraphe : bip montant (même code couleur que le magenta à l'écran). */
  telegraph: {
    bus: 'sfx',
    max: 3,
    gapMs: 70,
    repetitive: true,
    render: (a) => {
      const low = a.amount > 0.5;
      return tone(a.ctx, a.out, a.t, low ? 440 : 640, {
        type: 'triangle',
        to: low ? 880 : 1180,
        gain: 0.11,
        attack: 0.012,
        hold: 0.06,
        decay: 0.09,
        glide: 0.1,
      });
    },
  },
  /** Borne : imprimante à tickets + éjection. */
  ticketFire: {
    bus: 'sfx',
    max: 3,
    gapMs: 50,
    repetitive: true,
    render: (a) => {
      const soft = lowpass(a.ctx, a.out, 2800);
      for (let i = 0; i < 4; i += 1)
        tone(a.ctx, soft, a.t + i * 0.022, 1250 * vary(a.r, 0.03), {
          type: 'square',
          gain: 0.03,
          decay: 0.015,
        });
      return whoosh({ ...a, t: a.t + 0.08 }, 1200, 3000, 0.1, 0.12) + 0.08;
    },
  },
  ticketTear: {
    bus: 'sfx',
    max: 3,
    gapMs: 40,
    repetitive: true,
    render: (a) =>
      noise(a.ctx, a.out, a.t, {
        filter: 'highpass',
        freq: 2200,
        to: 4500,
        gain: 0.14,
        attack: 0.01,
        decay: 0.09,
      }),
  },
  ticketThud: {
    bus: 'sfx',
    max: 2,
    gapMs: 60,
    repetitive: true,
    render: (a) =>
      noise(a.ctx, a.out, a.t, { filter: 'lowpass', freq: 700, gain: 0.1, decay: 0.06 }),
  },
  droneShot: {
    bus: 'sfx',
    max: 2,
    gapMs: 60,
    repetitive: true,
    render: (a) =>
      tone(a.ctx, lowpass(a.ctx, a.out, 2200), a.t, 950 * vary(a.r, 0.05), {
        type: 'square',
        to: 320,
        gain: 0.06,
        decay: 0.09,
      }),
  },
  droneDive: {
    bus: 'sfx',
    max: 2,
    gapMs: 200,
    render: (a) =>
      tone(a.ctx, lowpass(a.ctx, a.out, 2000), a.t, 1100, {
        type: 'sawtooth',
        to: 380,
        gain: 0.06,
        attack: 0.05,
        decay: 0.45,
      }),
  },
  droneScan: {
    bus: 'sfx',
    max: 1,
    gapMs: 400,
    render: (a) =>
      tone(a.ctx, a.out, a.t, 620, {
        type: 'sine',
        to: 980,
        gain: 0.07,
        attack: 0.08,
        hold: 0.25,
        decay: 0.2,
        vibrato: [60, 9],
      }),
  },
  /** Manager KPI : chronomètre (tic-tac puis « ding »). */
  chrono: {
    bus: 'sfx',
    max: 2,
    gapMs: 300,
    render: (a) => {
      for (let i = 0; i < 4; i += 1) {
        const at = a.t + i * 0.12;
        noise(a.ctx, a.out, at, {
          filter: 'bandpass',
          freq: 2600,
          q: 1.5,
          gain: 0.1,
          decay: 0.012,
        });
        tone(a.ctx, a.out, at, i % 2 ? 2100 : 2500, { type: 'triangle', gain: 0.025, decay: 0.02 });
      }
      return bell(a, 1568, a.t + 0.5, 0.06, 0.45) + 0.5;
    },
  },
  tablet: {
    bus: 'sfx',
    max: 2,
    gapMs: 100,
    render: (a) => {
      noise(a.ctx, a.out, a.t, { filter: 'lowpass', freq: 2200, gain: 0.16, decay: 0.06 });
      return tone(a.ctx, a.out, a.t, 320, { to: 150, gain: 0.14, decay: 0.12 });
    },
  },
  /** Reporting : « ding-dong » de réunion. */
  report: {
    bus: 'sfx',
    max: 1,
    gapMs: 500,
    render: (a) => {
      bell(a, mtof(76), a.t, 0.07, 0.5);
      return bell(a, mtof(72), a.t + 0.22, 0.07, 0.6) + 0.22;
    },
  },
  /** Coup de diaporama : glissement + « clac » de projecteur. */
  enemyMelee: {
    bus: 'sfx',
    max: 3,
    gapMs: 60,
    repetitive: true,
    render: (a) => {
      tone(a.ctx, lowpass(a.ctx, a.out, 1800), a.t, 420, {
        type: 'square',
        gain: 0.04,
        decay: 0.025,
      });
      return whoosh(a, 400, 1400, 0.18, 0.2);
    },
  },
  /** Quick win : ruée. */
  rush: {
    bus: 'sfx',
    max: 2,
    gapMs: 120,
    render: (a) => whoosh(a, 250, 1800, 0.38, 0.26),
  },
  // ── Boss : l'Auditeur des Quais ────────────────────────────────────────────
  bossSweep: {
    bus: 'sfx',
    max: 1,
    gapMs: 200,
    render: (a) => {
      whoosh(a, 180, 1300, 0.45, 0.4);
      return paper(a, 6, 0.12, a.t + 0.1) + 0.1;
    },
  },
  /** Barrières de quai qui s'entrechoquent. */
  bossBarrier: {
    bus: 'sfx',
    max: 2,
    gapMs: 150,
    render: (a) => {
      [0, 0.07, 0.15].forEach((d, i) => {
        metal(a.ctx, a.out, a.t + d, [210, 245, 188][i] ?? 210, 0.1, 0.5, [1, 2.3, 3.7, 5.1]);
      });
      return (
        noise(a.ctx, a.out, a.t, {
          filter: 'bandpass',
          freq: 1600,
          q: 1.5,
          gain: 0.1,
          hold: 0.15,
          decay: 0.2,
        }) + 0.15
      );
    },
  },
  /** Tampon « Contrôle ! » : coup sourd et claquement caoutchouc. */
  bossStamp: {
    bus: 'sfx',
    max: 2,
    gapMs: 200,
    render: (a) => {
      thud(a, 95, 0.45, 0.35);
      noise(a.ctx, a.out, a.t, { filter: 'bandpass', freq: 2400, q: 1.2, gain: 0.16, decay: 0.05 });
      return (
        tone(a.ctx, a.out, a.t, 210, { type: 'triangle', to: 120, gain: 0.12, decay: 0.08 }) + 0.3
      );
    },
  },
  bossLand: {
    bus: 'sfx',
    max: 1,
    gapMs: 300,
    render: (a) => {
      thud(a, 80, 0.5, 0.5);
      return noise(a.ctx, a.out, a.t, {
        filter: 'lowpass',
        freq: 500,
        to: 80,
        gain: 0.25,
        decay: 0.8,
      });
    },
  },
  kpi: {
    bus: 'sfx',
    max: 2,
    gapMs: 150,
    render: (a) => {
      const f = a.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 6;
      f.frequency.setValueAtTime(300, a.t);
      f.frequency.exponentialRampToValueAtTime(2200, a.t + 0.25);
      f.connect(a.out);
      return tone(a.ctx, f, a.t, 110, { type: 'sawtooth', gain: 0.1, attack: 0.02, decay: 0.3 });
    },
  },
  /** Changement de phase : corne grave. */
  bossPhase: {
    bus: 'sfx',
    max: 1,
    gapMs: 1000,
    spatial: false,
    render: (a) => {
      const soft = lowpass(a.ctx, a.out, 650);
      for (const n of [38, 45, 50])
        tone(a.ctx, soft, a.t, mtof(n), {
          type: 'sawtooth',
          gain: 0.09,
          attack: 0.15,
          hold: 0.5,
          decay: 0.8,
          detune: (a.r() - 0.5) * 10,
        });
      return 1.5;
    },
  },
  // ── Zones de danger, explosions ────────────────────────────────────────────
  hazardThud: {
    bus: 'sfx',
    max: 3,
    gapMs: 60,
    repetitive: true,
    render: (a) => thud(a, 120, 0.3, 0.25),
  },
  ringPulse: {
    bus: 'sfx',
    max: 2,
    gapMs: 100,
    render: (a) => {
      noise(a.ctx, a.out, a.t, {
        filter: 'bandpass',
        freq: 300,
        to: 1200,
        q: 2,
        gain: 0.15,
        attack: 0.03,
        decay: 0.3,
      });
      return tone(a.ctx, a.out, a.t, 200, { to: 80, gain: 0.2, decay: 0.3 });
    },
  },
  kpiZap: {
    bus: 'sfx',
    max: 2,
    gapMs: 100,
    render: (a) =>
      tone(a.ctx, lowpass(a.ctx, a.out, 1800), a.t, 180, {
        type: 'sawtooth',
        to: 90,
        gain: 0.1,
        decay: 0.25,
      }),
  },
  /** Rame qui traverse la voie : grondement, claquements d'essieux, avertisseur deux tons. */
  train: {
    bus: 'sfx',
    max: 1,
    gapMs: 800,
    render: (a) => {
      noise(a.ctx, a.out, a.t, {
        filter: 'lowpass',
        freq: 320,
        gain: 0.3,
        attack: 0.15,
        hold: 0.6,
        decay: 0.6,
      });
      for (let i = 0; i < 6; i += 1) {
        const at = a.t + 0.1 + i * 0.16 + (i % 2) * 0.05;
        metal(a.ctx, a.out, at, 620, 0.04, 0.08);
        noise(a.ctx, a.out, at, { filter: 'bandpass', freq: 900, q: 2, gain: 0.08, decay: 0.04 });
      }
      const soft = lowpass(a.ctx, a.out, 1200);
      tone(a.ctx, soft, a.t, 330, {
        type: 'sawtooth',
        gain: 0.035,
        attack: 0.04,
        hold: 0.22,
        decay: 0.1,
      });
      tone(a.ctx, soft, a.t + 0.32, 277, {
        type: 'sawtooth',
        gain: 0.035,
        attack: 0.04,
        hold: 0.3,
        decay: 0.2,
      });
      return 1.4;
    },
  },
  explosion: {
    bus: 'sfx',
    max: 2,
    gapMs: 120,
    render: (a) => {
      const s = Math.max(0.3, Math.min(2, a.amount * 2));
      tone(a.ctx, a.out, a.t, 85, { to: 32, gain: 0.25 * Math.min(1.4, s), decay: 0.4 + 0.2 * s });
      return noise(a.ctx, a.out, a.t, {
        filter: 'lowpass',
        freq: 1600,
        to: 160,
        gain: 0.25 * Math.min(1.3, s),
        decay: 0.5 + 0.2 * s,
      });
    },
  },
  wallSlam: {
    bus: 'sfx',
    max: 2,
    gapMs: 80,
    repetitive: true,
    render: (a) => {
      thud(a, 140, 0.22, 0.15);
      return metal(a.ctx, a.out, a.t, 320, 0.04, 0.2);
    },
  },
  spawn: {
    bus: 'sfx',
    max: 2,
    gapMs: 90,
    repetitive: true,
    render: (a) =>
      tone(a.ctx, a.out, a.t, 300 * vary(a.r, 0.1), {
        type: 'triangle',
        to: 620,
        gain: 0.04,
        attack: 0.02,
        decay: 0.08,
      }),
  },
  // ── Salles, portes, récompenses ───────────────────────────────────────────
  /** Annonce de gare : carillon à 3 notes (sans voix). */
  chime: {
    bus: 'sfx',
    max: 1,
    gapMs: 1500,
    spatial: false,
    render: (a) => {
      const notes = [mtof(67), mtof(72), mtof(76)];
      notes.forEach((f, i) => bell(a, f, a.t + i * 0.36, 0.11, 1.4));
      return 0.72 + 1.4;
    },
  },
  /** Salle nettoyée : verrou qui saute et deux notes de récompense. */
  doorUnlock: {
    bus: 'sfx',
    max: 1,
    gapMs: 500,
    spatial: false,
    render: (a) => {
      metal(a.ctx, a.out, a.t, 400, 0.08, 0.15, [1, 2.2, 3.4]);
      thud(a, 180, 0.15, 0.1);
      return arpeggio({ ...a, t: a.t + 0.15 }, [74, 79, 86], 0.09, 0.08, 0.6) + 0.15;
    },
  },
  doorTaken: {
    bus: 'sfx',
    max: 1,
    gapMs: 300,
    spatial: false,
    render: (a) => whoosh(a, 300, 900, 0.3, 0.18),
  },
  pickupTickets: {
    bus: 'sfx',
    max: 2,
    gapMs: 50,
    repetitive: true,
    render: (a) => {
      paper(a, 2, 0.1);
      return bell(a, 1568 * vary(a.r, 0.02), a.t + 0.02, 0.06, 0.2);
    },
  },
  pickupPs: {
    bus: 'sfx',
    max: 2,
    gapMs: 60,
    repetitive: true,
    render: (a) => arpeggio(a, [72, 79], 0.07, 0.08, 0.35),
  },
  pickupGrains: {
    bus: 'sfx',
    max: 2,
    gapMs: 60,
    repetitive: true,
    render: (a) => {
      for (let i = 0; i < 6; i += 1)
        noise(a.ctx, a.out, a.t + a.r() * 0.12, {
          filter: 'bandpass',
          freq: 3200 * vary(a.r, 0.2),
          q: 4,
          gain: 0.08,
          decay: 0.015,
        });
      return 0.2;
    },
  },
  pickupGobelet: {
    bus: 'sfx',
    max: 1,
    gapMs: 100,
    render: (a) => {
      tone(a.ctx, a.out, a.t, 880, { type: 'triangle', gain: 0.07, decay: 0.06 });
      return arpeggio({ ...a, t: a.t + 0.05 }, [69, 76], 0.06, 0.06, 0.3) + 0.05;
    },
  },
  pickupCornet: {
    bus: 'sfx',
    max: 1,
    gapMs: 100,
    render: (a) => {
      for (let i = 0; i < 5; i += 1)
        noise(a.ctx, a.out, a.t + i * 0.035, {
          filter: 'bandpass',
          freq: 1800 + a.r() * 1200,
          q: 1.5,
          gain: 0.1,
          decay: 0.03,
        });
      return arpeggio({ ...a, t: a.t + 0.12 }, [72, 76], 0.06, 0.06, 0.3) + 0.12;
    },
  },
  pickupAvantage: {
    bus: 'sfx',
    max: 1,
    gapMs: 200,
    spatial: false,
    render: (a) => arpeggio(a, [72, 76, 79, 84], 0.06, 0.09, 0.6),
  },
  /** Fenêtre de choix d'Avantage. */
  choice: {
    bus: 'ui',
    max: 1,
    gapMs: 300,
    spatial: false,
    render: (a) => {
      const soft = lowpass(a.ctx, a.out, 1800);
      for (const n of [60, 67, 71, 76])
        tone(a.ctx, soft, a.t, mtof(n), {
          type: 'triangle',
          gain: 0.035,
          attack: 0.12,
          hold: 0.2,
          decay: 0.7,
        });
      return arpeggio({ ...a, t: a.t + 0.05 }, [83, 88], 0.08, 0.05, 0.5) + 0.05;
    },
  },
  loot0: {
    bus: 'sfx',
    max: 2,
    gapMs: 80,
    repetitive: true,
    render: (a) => RARITY_STAMPS[0]?.(a) ?? 0,
  },
  loot1: { bus: 'sfx', max: 2, gapMs: 80, render: (a) => RARITY_STAMPS[1]?.(a) ?? 0 },
  loot2: { bus: 'sfx', max: 2, gapMs: 100, render: (a) => RARITY_STAMPS[2]?.(a) ?? 0 },
  loot3: {
    bus: 'sfx',
    max: 1,
    gapMs: 200,
    spatial: false,
    render: (a) => RARITY_STAMPS[3]?.(a) ?? 0,
  },
  loot4: {
    bus: 'sfx',
    max: 1,
    gapMs: 400,
    spatial: false,
    render: (a) => RARITY_STAMPS[4]?.(a) ?? 0,
  },
  // ── Interface ─────────────────────────────────────────────────────────────
  uiHover: {
    bus: 'ui',
    max: 1,
    gapMs: 45,
    spatial: false,
    render: (a) =>
      tone(a.ctx, a.out, a.t, 1500, { type: 'sine', gain: 0.035, attack: 0.003, decay: 0.03 }),
  },
  uiClick: {
    bus: 'ui',
    max: 2,
    gapMs: 40,
    spatial: false,
    render: (a) => {
      noise(a.ctx, a.out, a.t, { filter: 'bandpass', freq: 2500, q: 2, gain: 0.05, decay: 0.012 });
      return tone(a.ctx, a.out, a.t, 1050, { type: 'triangle', to: 800, gain: 0.08, decay: 0.06 });
    },
  },
  uiOpen: {
    bus: 'ui',
    max: 1,
    gapMs: 120,
    spatial: false,
    render: (a) => {
      whoosh(a, 500, 1600, 0.16, 0.08);
      return arpeggio({ ...a, t: a.t + 0.04 }, [72, 79], 0.05, 0.045, 0.25) + 0.04;
    },
  },
} satisfies Record<string, SfxDef>;

export type SfxId = keyof typeof SFX;

export const SFX_IDS = Object.keys(SFX) as SfxId[];

/** Son de loot au sol selon la rareté (0 = Réformé … 4 = Patrimoine). */
export function lootSfx(rank: number): SfxId {
  const ids: readonly SfxId[] = ['loot0', 'loot1', 'loot2', 'loot3', 'loot4'];
  return ids[Math.max(0, Math.min(4, Math.round(rank)))] ?? 'loot0';
}
