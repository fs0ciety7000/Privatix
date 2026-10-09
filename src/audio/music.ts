/**
 * Musique générative légère (aucun fichier : tout est planifié en avance sur l'horloge Web Audio).
 *
 * Modes :
 * - `quai`   : ambiance de quai de nuit seule (bourdon grave, néon qui grésille, rails au loin) ;
 * - `combat` : l'ambiance + un thème en ré mineur à 4 couches (basse, grosse caisse, charleston, arpège)
 *              qui s'ouvrent avec l'intensité (ennemis en vie, Burnout) ;
 * - `boss`   : variante plus tendue (mib phrygien, cuivres graves en début de mesure, tempo plus vif) ;
 * - `hub`    : Centre Opérationnel, calme et chaleureux (piano électrique, radio de bureau qui crachote,
 *              cafetière qui gargouille de temps en temps) ;
 * - `off`.
 *
 * Planification classique « lookahead » : `update()` (chaque frame) programme les pas de double-croche
 * des 200 prochaines millisecondes. Les couches ont chacune un gain lissé ; une couche muette ne
 * programme rien (pas de CPU gaspillé). Volumes internes bas : le bus musique ajoute son propre trim.
 */
import { lowpass, metal, mtof, noise, noiseBuffer, tone } from './synth';

export type MusicMode = 'off' | 'quai' | 'combat' | 'boss' | 'hub';

const LOOKAHEAD = 0.2;
/** Seuils d'intensité d'ouverture des couches de combat. */
export const LAYER_THRESHOLDS = { bass: 0.02, kick: 0.3, hats: 0.55, arp: 0.75 } as const;
type Layer = keyof typeof LAYER_THRESHOLDS;

interface Theme {
  readonly bpm: number;
  /** Fondamentale MIDI de chaque mesure (boucle). */
  readonly roots: readonly number[];
  /** Tierce de chaque mesure (3 = mineure, 4 = majeure). */
  readonly thirds: readonly number[];
}

const COMBAT: Theme = { bpm: 100, roots: [38, 34, 41, 36], thirds: [3, 4, 4, 4] };
const BOSS: Theme = { bpm: 112, roots: [38, 39, 38, 37], thirds: [3, 4, 3, 3] };
/** Hub : Fa maj7, Mi m7, Ré m7, Do maj7 (voicings fermés). */
const HUB_CHORDS: readonly (readonly number[])[] = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
const HUB_BPM = 74;
/** Bribes de mélodie de la radio (degrés MIDI, 0 = silence). */
const RADIO_PHRASES: readonly (readonly number[])[] = [
  [72, 0, 74, 76, 0, 79, 76, 0],
  [77, 76, 74, 0, 72, 0, 69, 0],
  [69, 72, 0, 74, 0, 72, 0, 0],
];

/** Petit générateur pseudo-aléatoire (variations reproductibles d'une partie à l'autre). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

interface Sustained {
  stop(at: number): void;
}

export class MusicDirector {
  private modeRef: MusicMode = 'off';
  private intensityRef = 0;
  private bossPhase = 1;
  private step = 0;
  private nextStep = 0;
  private ambientAt = 0;
  private railAt = 0;
  private hubEventAt = 0;
  private readonly rnd = lcg(0x5eed);
  private sustained: Sustained[] = [];
  private layers: Record<Layer, GainNode> | null = null;
  private layerBus: GainNode | null = null;
  private ctx: BaseAudioContext | null = null;
  private musicOut: AudioNode | null = null;
  private ambienceOut: AudioNode | null = null;

  public get mode(): MusicMode {
    return this.modeRef;
  }

  public get intensity(): number {
    return this.intensityRef;
  }

  /** Branche le directeur sur un contexte (après le déverrouillage) et démarre le mode courant. */
  public attach(ctx: BaseAudioContext, musicOut: AudioNode, ambienceOut: AudioNode): void {
    this.ctx = ctx;
    this.musicOut = musicOut;
    this.ambienceOut = ambienceOut;
    const bus = ctx.createGain();
    bus.gain.value = 0.9;
    bus.connect(musicOut);
    this.layerBus = bus;
    const mk = (): GainNode => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(bus);
      return g;
    };
    this.layers = { bass: mk(), kick: mk(), hats: mk(), arp: mk() };
    const m = this.modeRef;
    this.modeRef = 'off';
    this.setMode(m);
  }

  public setMode(mode: MusicMode): void {
    if (mode === this.modeRef) return;
    const prev = this.modeRef;
    this.modeRef = mode;
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const ambient = (m: MusicMode): 'quai' | 'hub' | null =>
      m === 'hub' ? 'hub' : m === 'off' ? null : 'quai';
    if (ambient(prev) !== ambient(mode)) {
      for (const s of this.sustained) s.stop(t);
      this.sustained = [];
      const a = ambient(mode);
      if (a === 'quai') this.startQuai(t);
      else if (a === 'hub') this.startHubBed(t);
    }
    this.nextStep = Math.max(this.nextStep, t + 0.05);
    this.step = 0;
    this.ambientAt = t + 1;
    this.railAt = t + 4;
    this.hubEventAt = t + 6;
  }

  /** Intensité de combat (0..1), lissée par le gain des couches. */
  public setIntensity(v: number, bossPhase = 1): void {
    this.intensityRef = Math.max(0, Math.min(1, v));
    this.bossPhase = bossPhase;
  }

  /** Programme ce qui doit sonner dans les 200 prochaines millisecondes. */
  public update(lookahead = LOOKAHEAD): void {
    const ctx = this.ctx;
    if (!ctx || !this.layers || this.modeRef === 'off') return;
    const now = ctx.currentTime;
    if (this.nextStep < now) this.nextStep = now + 0.02;
    this.updateLayers(now);
    const horizon = now + lookahead;
    if (this.modeRef === 'quai' || this.modeRef === 'combat' || this.modeRef === 'boss')
      this.ambientEvents(now, horizon);
    if (this.modeRef === 'hub') this.hubEvents(now, horizon);
    const bpm =
      this.modeRef === 'boss'
        ? BOSS.bpm + (this.bossPhase - 1) * 4
        : this.modeRef === 'hub'
          ? HUB_BPM
          : COMBAT.bpm;
    const stepDur = 60 / bpm / 4;
    while (this.nextStep < horizon) {
      this.scheduleStep(this.step, this.nextStep, stepDur);
      this.step += 1;
      this.nextStep += stepDur;
    }
  }

  /** Gains cibles des couches selon le mode et l'intensité. */
  public layerTargets(): Record<Layer, number> {
    const m = this.modeRef;
    const on = m === 'combat' || m === 'boss';
    const i = m === 'boss' ? Math.max(0.6, this.intensityRef) : this.intensityRef;
    const lvl = (l: Layer): number => {
      if (!on) return 0;
      const th = LAYER_THRESHOLDS[l];
      return i <= th ? 0 : Math.min(1, (i - th) / 0.15);
    };
    return { bass: lvl('bass'), kick: lvl('kick'), hats: lvl('hats'), arp: lvl('arp') };
  }

  private updateLayers(now: number): void {
    if (!this.layers) return;
    const tg = this.layerTargets();
    for (const l of Object.keys(tg) as Layer[])
      this.layers[l].gain.setTargetAtTime(tg[l], now, 0.6);
  }

  private scheduleStep(step: number, t: number, sd: number): void {
    const m = this.modeRef;
    if (m === 'combat' || m === 'boss') this.combatStep(step, t, sd, m === 'boss' ? BOSS : COMBAT);
    else if (m === 'hub') this.hubStep(step, t, sd);
  }

  // ─── Combat ───────────────────────────────────────────────────────────────

  private combatStep(step: number, t: number, sd: number, theme: Theme): void {
    const ctx = this.ctx;
    const L = this.layers;
    if (!ctx || !L) return;
    const tg = this.layerTargets();
    const bar = Math.floor(step / 16) % theme.roots.length;
    const s = step % 16;
    const root = theme.roots[bar] ?? 38;
    const third = theme.thirds[bar] ?? 3;
    const boss = theme === BOSS;
    if (tg.bass > 0 && s % 2 === 0) {
      // Basse en croches : fondamentale, octave sur les contretemps.
      const n = s % 4 === 2 ? root + 12 : root;
      const f = lowpass(ctx, L.bass, boss ? 700 : 520, 2);
      tone(ctx, f, t, mtof(n), { type: 'sawtooth', gain: 0.07, attack: 0.008, decay: sd * 1.7 });
      tone(ctx, L.bass, t, mtof(n), {
        type: 'triangle',
        gain: 0.08,
        attack: 0.008,
        decay: sd * 1.8,
      });
    }
    if (tg.kick > 0 && (s === 0 || s === 8 || (this.intensityRef > 0.8 && s % 4 === 0))) {
      tone(ctx, L.kick, t, 120, { to: 42, gain: 0.32, attack: 0.002, decay: 0.22, glide: 0.12 });
    }
    if (tg.kick > 0 && boss && s === 12) {
      noise(ctx, L.kick, t, { filter: 'bandpass', freq: 1800, q: 0.8, gain: 0.08, decay: 0.12 });
    }
    if (tg.hats > 0 && s % 4 === 2) {
      noise(ctx, L.hats, t, { filter: 'bandpass', freq: 6200, q: 1.2, gain: 0.035, decay: 0.035 });
    }
    if (tg.arp > 0) {
      const chord = [root + 24, root + 24 + third, root + 31, root + 36];
      const n = chord[(s * 3) % chord.length] ?? root + 24;
      const f = lowpass(ctx, L.arp, 1900);
      tone(ctx, f, t, mtof(n), { type: 'triangle', gain: 0.035, attack: 0.004, decay: sd * 1.5 });
    }
    if (boss && s === 0 && tg.bass > 0) {
      // Cuivres graves en début de mesure.
      const f = lowpass(ctx, L.bass, 800);
      for (const n of [root, root + 7, root + 12 + third])
        tone(ctx, f, t, mtof(n), {
          type: 'sawtooth',
          gain: 0.03,
          attack: 0.05,
          hold: sd * 4,
          decay: sd * 6,
        });
    }
  }

  // ─── Ambiance de quai ─────────────────────────────────────────────────────

  private startQuai(t: number): void {
    const ctx = this.ctx;
    const out = this.ambienceOut;
    if (!ctx || !out) return;
    const stops: AudioScheduledSourceNode[] = [];
    const bed = ctx.createGain();
    bed.gain.setValueAtTime(0.0001, t);
    bed.gain.exponentialRampToValueAtTime(1, t + 2.5);
    bed.connect(out);
    // Bourdon : deux dents de scie désaccordées très graves, filtre qui respire lentement.
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 180;
    f.Q.value = 0.8;
    const drone = ctx.createGain();
    drone.gain.value = 0.07;
    f.connect(drone).connect(bed);
    for (const [freq, det] of [
      [mtof(26), -6],
      [mtof(38), 5],
      [mtof(45), 0],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(f);
      stops.push(o);
    }
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoDepth.gain.value = 70;
    lfo.connect(lfoDepth).connect(f.frequency);
    stops.push(lfo);
    // Néon : bourdonnement secteur à 100 Hz, seulement ses harmoniques médiums, très bas.
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 100;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1200;
    hp.Q.value = 0.7;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.007;
    hum.connect(hp).connect(humGain).connect(bed);
    stops.push(hum);
    for (const s of stops) s.start(t);
    this.sustained.push({
      stop: (at) => {
        bed.gain.cancelScheduledValues(at);
        bed.gain.setTargetAtTime(0.0001, at, 0.4);
        for (const s of stops) s.stop(at + 2);
      },
    });
  }

  /** Grésillements du néon, rails au loin, rame qui passe très loin. */
  private ambientEvents(now: number, horizon: number): void {
    const ctx = this.ctx;
    const out = this.ambienceOut;
    if (!ctx || !out) return;
    while (this.ambientAt < horizon) {
      const t = Math.max(now, this.ambientAt);
      const n = 2 + Math.floor(this.rnd() * 4);
      for (let i = 0; i < n; i += 1)
        noise(ctx, out, t + i * (0.03 + this.rnd() * 0.06), {
          filter: 'bandpass',
          freq: 2600 + this.rnd() * 1800,
          q: 2.5,
          gain: 0.025,
          decay: 0.015 + this.rnd() * 0.02,
        });
      this.ambientAt = t + 3 + this.rnd() * 7;
    }
    while (this.railAt < horizon) {
      const t = Math.max(now, this.railAt);
      const far = lowpass(ctx, out, 1400);
      if (this.rnd() < 0.25) {
        // Rame lointaine : grondement qui monte et s'éteint.
        noise(ctx, far, t, {
          filter: 'lowpass',
          freq: 160,
          gain: 0.12,
          attack: 2.5,
          hold: 1,
          decay: 3.5,
        });
        for (let i = 0; i < 8; i += 1)
          metal(ctx, far, t + 1.8 + i * 0.19 + (i % 2) * 0.06, 420, 0.012, 0.07);
      } else {
        // « Clac-clac » d'un joint de rail.
        for (const d of [0, 0.11, 0.62, 0.73])
          metal(ctx, far, t + d, 380 + this.rnd() * 60, 0.02, 0.1);
      }
      this.railAt = t + 7 + this.rnd() * 9;
    }
  }

  // ─── Hub : Centre Opérationnel ────────────────────────────────────────────

  private startHubBed(t: number): void {
    const ctx = this.ctx;
    const out = this.ambienceOut;
    if (!ctx || !out) return;
    // Souffle de la radio (bruit filtré, très bas) et ronron de la cafetière (50 Hz).
    const bed = ctx.createGain();
    bed.gain.setValueAtTime(0.0001, t);
    bed.gain.exponentialRampToValueAtTime(1, t + 2);
    bed.connect(out);
    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer(ctx);
    hiss.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.006;
    hiss.connect(f).connect(g).connect(bed);
    const hum = ctx.createOscillator();
    hum.frequency.value = 50;
    const hg = ctx.createGain();
    hg.gain.value = 0.02;
    hum.connect(hg).connect(bed);
    hiss.start(t);
    hum.start(t);
    this.sustained.push({
      stop: (at) => {
        bed.gain.cancelScheduledValues(at);
        bed.gain.setTargetAtTime(0.0001, at, 0.4);
        hiss.stop(at + 2);
        hum.stop(at + 2);
      },
    });
  }

  private hubStep(step: number, t: number, sd: number): void {
    const ctx = this.ctx;
    const out = this.musicOut;
    if (!ctx || !out) return;
    const bar = Math.floor(step / 16) % HUB_CHORDS.length;
    const s = step % 16;
    const chord = HUB_CHORDS[bar] ?? HUB_CHORDS[0] ?? [];
    const warm = lowpass(ctx, out, 1500);
    if (s === 0 || s === 10) {
      // Piano électrique : sinus + octave douce, attaque feutrée, trémolo léger.
      chord.forEach((n, i) => {
        tone(ctx, warm, t + i * 0.012, mtof(n), {
          gain: 0.04,
          attack: 0.01,
          decay: sd * (s === 0 ? 14 : 7),
          vibrato: [6, 4.5],
        });
        tone(ctx, warm, t + i * 0.012, mtof(n + 12), {
          type: 'triangle',
          gain: 0.008,
          attack: 0.005,
          decay: sd * 3,
        });
      });
      tone(ctx, warm, t, mtof((chord[0] ?? 48) - 12), {
        type: 'triangle',
        gain: 0.06,
        attack: 0.02,
        decay: sd * 12,
      });
    }
    // Radio : une phrase par mesure paire, filtrée comme un petit haut-parleur.
    if (bar % 2 === 0 && s % 2 === 0) {
      const phrase = RADIO_PHRASES[Math.floor(step / 32) % RADIO_PHRASES.length] ?? [];
      const n = phrase[s / 2] ?? 0;
      if (n > 0) {
        const radio = ctx.createBiquadFilter();
        radio.type = 'bandpass';
        radio.frequency.value = 1400;
        radio.Q.value = 1.2;
        radio.connect(out);
        tone(ctx, radio, t, mtof(n), {
          type: 'square',
          gain: 0.014,
          attack: 0.01,
          decay: sd * 1.6,
        });
      }
    }
  }

  private hubEvents(now: number, horizon: number): void {
    const ctx = this.ctx;
    const out = this.ambienceOut;
    if (!ctx || !out) return;
    while (this.hubEventAt < horizon) this.hubEvent(Math.max(now, this.hubEventAt), ctx, out);
  }

  private hubEvent(t: number, ctx: BaseAudioContext, out: AudioNode): void {
    if (this.rnd() < 0.5) {
      // Cafetière : gargouillis de bulles graves.
      for (let i = 0; i < 7; i += 1)
        tone(ctx, out, t + i * 0.09 + this.rnd() * 0.05, 180 + this.rnd() * 160, {
          to: 320 + this.rnd() * 200,
          gain: 0.035,
          attack: 0.01,
          decay: 0.06,
        });
      noise(ctx, out, t, {
        filter: 'bandpass',
        freq: 900,
        q: 1,
        gain: 0.02,
        attack: 0.3,
        hold: 0.4,
        decay: 0.6,
      });
    } else {
      // Crachotement de la radio.
      for (let i = 0; i < 5; i += 1)
        noise(ctx, out, t + this.rnd() * 0.6, {
          filter: 'bandpass',
          freq: 2200,
          q: 1.5,
          gain: 0.02,
          decay: 0.03,
        });
    }
    this.hubEventAt = t + 12 + this.rnd() * 14;
  }

  public dispose(): void {
    const t = this.ctx?.currentTime ?? 0;
    for (const s of this.sustained) s.stop(t);
    this.sustained = [];
    this.layerBus?.disconnect();
    this.ctx = null;
  }
}
