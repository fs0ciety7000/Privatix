/**
 * Rendu hors ligne (OfflineAudioContext) des effets et de la musique, à travers la même chaîne de
 * mixage que le jeu. Outil de développement : n'est importé que par `tools/audio/render.mjs` (via le
 * serveur Vite, dans Chromium) pour écrire des WAV et mesurer crête et RMS. Absent du build du jeu.
 */
import { busGainFor, createMixChain, DEFAULT_AUDIO_SETTINGS } from './AudioEngine';
import type { MixBus } from './AudioEngine';
import type { MusicMode } from './music';
import { coffeeGurgle, MusicDirector, radioCrackle } from './music';
import type { RenderArgs, SfxId } from './sfx';
import { SFX } from './sfx';
import { mtof, noise, tone } from './synth';

export interface Rendered {
  readonly sampleRate: number;
  readonly left: number[];
  readonly right: number[];
  /** Crête avant le compresseur et le limiteur (rendu direct de la voix). */
  readonly rawPeak: number;
}

const SR = 48000;
/**
 * Pré-roll (s) : au tout début d'un rendu, le compresseur de Chromium part d'un état qui écrase les
 * transitoires (jusqu'à −13 dB sur un clic). En jeu la chaîne tourne en continu ; on fait donc tourner
 * la chaîne à vide 0,5 s avant le son, puis on retire ce silence.
 */
const PREROLL = 0.5;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function setBuses(buses: Record<MixBus, GainNode>): void {
  for (const id of Object.keys(buses) as MixBus[])
    buses[id].gain.setValueAtTime(busGainFor(DEFAULT_AUDIO_SETTINGS, id, false), 0);
}

async function rawPeakOf(id: SfxId, seconds: number, amount: number): Promise<number> {
  const ctx = new OfflineAudioContext(1, Math.ceil(SR * seconds), SR);
  SFX[id].render({ ctx, out: ctx.destination, t: 0.01, r: lcg(7), amount });
  const buf = await ctx.startRendering();
  let peak = 0;
  for (const v of buf.getChannelData(0)) peak = Math.max(peak, Math.abs(v));
  return peak;
}

/** Rend un effet (ou une rafale de `repeat` déclenchements espacés de `spacing` s). */
export async function renderSfx(
  id: SfxId,
  opts: { amount?: number; repeat?: number; spacing?: number; pan?: number } = {},
): Promise<Rendered> {
  const probe = new OfflineAudioContext(1, SR, SR);
  const dur = SFX[id].render({
    ctx: probe,
    out: probe.createGain(),
    t: 0,
    r: lcg(7),
    amount: opts.amount ?? 0,
  });
  const repeat = opts.repeat ?? 1;
  const spacing = opts.spacing ?? 0.1;
  const seconds = Math.min(8, dur + (repeat - 1) * spacing + 0.4);
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * (seconds + PREROLL)), SR);
  const chain = createMixChain(ctx, ctx.destination);
  setBuses(chain.buses);
  chain.master.gain.value = DEFAULT_AUDIO_SETTINGS.master ** 2;
  const def = SFX[id];
  const r = lcg(11);
  for (let i = 0; i < repeat; i += 1) {
    const voice = ctx.createGain();
    const pan = ctx.createStereoPanner();
    pan.pan.value = opts.pan ?? 0;
    voice.connect(pan).connect(chain.buses[def.bus]);
    def.render({ ctx, out: voice, t: PREROLL + 0.01 + i * spacing, r, amount: opts.amount ?? 0 });
  }
  const buf = await ctx.startRendering();
  const skip = Math.floor(PREROLL * SR);
  return {
    sampleRate: SR,
    left: Array.from(buf.getChannelData(0).subarray(skip)),
    right: Array.from(buf.getChannelData(1).subarray(skip)),
    rawPeak: await rawPeakOf(id, seconds, opts.amount ?? 0),
  };
}

/** Rend `seconds` de musique dans un mode et à une intensité donnés. */
export async function renderMusic(
  mode: MusicMode,
  seconds: number,
  intensity: number,
  bossPhase = 1,
): Promise<Rendered> {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
  const chain = createMixChain(ctx, ctx.destination);
  setBuses(chain.buses);
  chain.master.gain.value = DEFAULT_AUDIO_SETTINGS.master ** 2;
  const music = new MusicDirector();
  music.setMode(mode);
  music.setIntensity(intensity, bossPhase);
  music.attach(ctx, chain.buses.music, chain.buses.ambience);
  music.update(seconds);
  const buf = await ctx.startRendering();
  return {
    sampleRate: SR,
    left: Array.from(buf.getChannelData(0)),
    right: Array.from(buf.getChannelData(1)),
    rawPeak: 0,
  };
}

// ─── Rendu chronologique (trailer) ────────────────────────────────────────────
// `tools/trailer/audio.mjs` décrit 60 s de bande-son (modes, intensités, tempos, effets placés) ;
// ces fonctions la rendent avec le même code de synthèse que le jeu. Pas de compresseur ni de
// limiteur ici : le mastering est fait à part, sur le mélange musique + effets.

/** Section étanche : tout ce qui y est branché (réverbération comprise) n'est audible qu'entre `from` et `to`. */
export interface TimelineSection {
  readonly from: number;
  readonly to: number;
  /** Fondus d'entrée et de sortie (s) : quelques ms suffisent à éviter un clic. */
  readonly fadeIn?: number;
  readonly fadeOut?: number;
  /** Niveau d'envoi vers la réverbération de la section et durée de sa queue (s). */
  readonly reverb?: number;
  readonly reverbSeconds?: number;
}

/** Point d'automation d'un directeur : appliqué ≤ 40 ms avant `at` (la grille peut être recalée sur `at`). */
export interface MusicCue {
  readonly at: number;
  readonly mode?: MusicMode;
  readonly intensity?: number;
  readonly phase?: number;
  readonly tempo?: number;
  readonly tau?: number;
  readonly hubChords?: readonly (readonly number[])[];
  /** Le pas 0 (temps fort) tombe exactement à `at`. */
  readonly resync?: boolean;
}

export interface DirectorSpec {
  readonly section: number;
  readonly cues: readonly MusicCue[];
  /** Automation de gain [temps, gain] (rampes linéaires entre les points). */
  readonly gain: readonly (readonly [number, number])[];
}

/** Effet placé : un `SfxId` du jeu, ou un son propre au trailer (`x:…`, voir `EXTRAS`). */
export interface TimelineEvent {
  readonly id: string;
  readonly at: number;
  readonly section: number;
  readonly db?: number;
  readonly pan?: number;
  readonly amount?: number;
  /** Vitesse de lecture (1,05 = +5 % de hauteur). */
  readonly rate?: number;
  readonly lowpass?: number;
  /** Envoi vers une réverbération propre (queue longue), en plus de celle de la section. */
  readonly reverb?: number;
  readonly reverbSeconds?: number;
  /** Fondu de sortie (coupure propre en 40 ms) qui se termine à ce temps. */
  readonly cutAt?: number;
  readonly dur?: number;
  readonly notes?: readonly number[];
  readonly seed?: number;
}

export interface TimelineSpec {
  readonly seconds: number;
  readonly sections: readonly TimelineSection[];
  readonly directors?: readonly DirectorSpec[];
  readonly events?: readonly TimelineEvent[];
}

const DT = 0.02;
const LOOKAHEAD_TL = 0.04;

type ExtraRender = (a: RenderArgs, e: TimelineEvent) => number;

/** Voix radio sans mots : un « buzz » de glotte passé dans deux formants qui changent à chaque syllabe. */
function radioVoice(a: RenderArgs, e: TimelineEvent): number {
  const { ctx, t, r } = a;
  const dur = e.dur ?? 2;
  const radio = ctx.createBiquadFilter();
  radio.type = 'bandpass';
  radio.frequency.value = 1500;
  radio.Q.value = 1.1;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) curve[i] = Math.tanh(((i / 255) * 2 - 1) * 3);
  shaper.curve = curve;
  radio.connect(shaper).connect(a.out);
  const vowels: readonly (readonly [number, number])[] = [
    [730, 1090],
    [530, 1840],
    [300, 2200],
    [570, 840],
    [440, 1020],
  ];
  let at = t;
  while (at < t + dur - 0.1) {
    const syl = 0.07 + r() * 0.13;
    const v = vowels[Math.floor(r() * vowels.length)] ?? [730, 1090];
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    const f0 = 115 + r() * 50;
    src.frequency.setValueAtTime(f0, at);
    src.frequency.linearRampToValueAtTime(f0 * (0.85 + r() * 0.3), at + syl);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.09, at + 0.015);
    g.gain.setValueAtTime(0.09, at + syl * 0.6);
    g.gain.linearRampToValueAtTime(0, at + syl);
    for (const [fq, gn] of [
      [v[0], 1],
      [v[1], 0.6],
    ] as const) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fq;
      bp.Q.value = 6;
      const bg = ctx.createGain();
      bg.gain.value = gn;
      src.connect(bp).connect(bg).connect(g);
    }
    g.connect(radio);
    src.start(at);
    src.stop(at + syl + 0.02);
    at += syl + (r() < 0.25 ? 0.12 + r() * 0.15 : 0.01);
  }
  radioCrackle(ctx, a.out, t, r);
  radioCrackle(ctx, a.out, t + dur * 0.6, r);
  return dur + 0.2;
}

/** Montée de bruit vers un « drop » : souffle qui s'ouvre puis s'arrête net (fondu de 15 ms). */
function riser(a: RenderArgs, e: TimelineEvent): number {
  const dur = e.dur ?? 2;
  const { ctx, t } = a;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + dur - 0.015);
  g.gain.linearRampToValueAtTime(0, t + dur);
  g.connect(a.out);
  noise(ctx, g, t, {
    filter: 'bandpass',
    freq: 400,
    to: 7000,
    q: 1.6,
    gain: 0.5,
    attack: dur * 0.95,
    decay: dur * 0.1,
  });
  tone(ctx, g, t, 110, {
    type: 'sawtooth',
    to: 440,
    gain: 0.05,
    attack: dur * 0.95,
    decay: dur * 0.1,
  });
  return dur;
}

/** Larsen de micro de l'estrade : sifflement qui gonfle, vibre et retombe. */
function larsen(a: RenderArgs): number {
  const { ctx, t } = a;
  tone(ctx, a.out, t, 2480, {
    to: 2620,
    gain: 0.07,
    attack: 0.28,
    hold: 0.25,
    decay: 0.2,
    vibrato: [14, 7],
  });
  tone(ctx, a.out, t + 0.05, 3720, { gain: 0.02, attack: 0.25, hold: 0.2, decay: 0.15 });
  return 0.8;
}

/** Note tenue (fin du film) : triangle + sinus à l'octave, attaque douce, tenue pendant `dur`. */
function held(a: RenderArgs, e: TimelineEvent): number {
  const dur = e.dur ?? 3;
  for (const n of e.notes ?? [50]) {
    tone(a.ctx, a.out, a.t, mtof(n), {
      type: 'triangle',
      gain: 0.03,
      attack: 0.4,
      hold: dur,
      decay: 1,
    });
    tone(a.ctx, a.out, a.t, mtof(n + 12), { gain: 0.012, attack: 0.6, hold: dur, decay: 1 });
  }
  return dur + 1.4;
}

/** Sous-basse qui chute, pour asseoir le coup final. */
function subDrop(a: RenderArgs): number {
  return tone(a.ctx, a.out, a.t, 70, { to: 28, gain: 0.35, attack: 0.003, decay: 1.6, glide: 1.2 });
}

const EXTRAS: Record<string, ExtraRender> = {
  'x:radioVoice': radioVoice,
  'x:riser': riser,
  'x:larsen': larsen,
  'x:held': held,
  'x:subDrop': subDrop,
  'x:gurgle': (a) => {
    coffeeGurgle(a.ctx, a.out, a.t, a.r);
    return 1.4;
  },
  'x:crackle': (a) => {
    radioCrackle(a.ctx, a.out, a.t, a.r);
    return 0.7;
  },
};

function renderOne(a: RenderArgs, e: TimelineEvent): number {
  const extra = EXTRAS[e.id];
  if (extra) return extra(a, e);
  const def = (SFX as Record<string, (typeof SFX)[SfxId] | undefined>)[e.id];
  if (!def) throw new Error(`Effet inconnu : ${e.id}`);
  return def.render(a);
}

/** Réponse impulsionnelle stéréo synthétique (bruit à décroissance exponentielle, aigus amortis). */
function makeReverb(ctx: BaseAudioContext, seconds: number, seed: number): AudioBuffer {
  const len = Math.ceil(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const pre = Math.floor(ctx.sampleRate * 0.012);
  for (let c = 0; c < 2; c += 1) {
    const r = lcg(seed + c * 977);
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = pre; i < len; i += 1) {
      const x = i / len;
      const k = 0.35 + 0.55 * x; // plus la queue avance, plus elle est sourde
      lp = lp * k + (r() * 2 - 1) * (1 - k);
      d[i] = lp * Math.exp(-6.9 * x) * (1 - x) * 0.6;
    }
  }
  return buf;
}

interface SectionNodes {
  readonly dry: GainNode;
  readonly gate: GainNode;
}

function buildSections(ctx: BaseAudioContext, spec: TimelineSpec): SectionNodes[] {
  return spec.sections.map((s, i) => {
    const gate = ctx.createGain();
    const fi = s.fadeIn ?? 0.005;
    const fo = s.fadeOut ?? 0.03;
    gate.gain.setValueAtTime(0, 0);
    gate.gain.setValueAtTime(0, Math.max(0, s.from));
    gate.gain.linearRampToValueAtTime(1, s.from + fi);
    gate.gain.setValueAtTime(1, Math.max(s.from + fi, s.to - fo));
    gate.gain.linearRampToValueAtTime(0, s.to);
    gate.connect(ctx.destination);
    const dry = ctx.createGain();
    dry.connect(gate);
    if (s.reverb) {
      const send = ctx.createGain();
      send.gain.value = s.reverb;
      const conv = ctx.createConvolver();
      conv.normalize = false;
      conv.buffer = makeReverb(ctx, s.reverbSeconds ?? 1.6, 101 + i);
      dry.connect(send).connect(conv).connect(gate);
    }
    return { dry, gate };
  });
}

function applyGain(p: AudioParam, pts: readonly (readonly [number, number])[]): void {
  const first = pts[0];
  p.setValueAtTime(first ? first[1] : 1, 0);
  for (const [t, v] of pts) p.linearRampToValueAtTime(v, t);
}

function result(buf: AudioBuffer): Rendered {
  return {
    sampleRate: buf.sampleRate,
    left: Array.from(buf.getChannelData(0)),
    right: Array.from(buf.getChannelData(1)),
    rawPeak: 0,
  };
}

/**
 * Musique pilotée dans le temps : chaque directeur (`MusicDirector` du jeu) reçoit ses changements de
 * mode, d'intensité, de phase et de tempo au fil du rendu (suspensions toutes les 20 ms, planification
 * à 40 ms, comme le jeu à chaque image). Bus musique et ambiance aux trims du jeu.
 */
export async function renderMusicTimeline(spec: TimelineSpec): Promise<Rendered> {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * spec.seconds), SR);
  const sections = buildSections(ctx, spec);
  const musicTrim = busGainFor(DEFAULT_AUDIO_SETTINGS, 'music', false);
  const ambTrim = busGainFor(DEFAULT_AUDIO_SETTINGS, 'ambience', false);
  const runs = (spec.directors ?? []).map((d) => {
    const out = ctx.createGain();
    applyGain(out.gain, d.gain);
    const sec = sections[d.section];
    if (!sec) throw new Error(`Section inconnue : ${d.section}`);
    out.connect(sec.dry);
    const mBus = ctx.createGain();
    mBus.gain.value = musicTrim;
    mBus.connect(out);
    const aBus = ctx.createGain();
    aBus.gain.value = ambTrim;
    aBus.connect(out);
    const dir = new MusicDirector();
    dir.attach(ctx, mBus, aBus);
    return { dir, cues: [...d.cues].sort((x, y) => x.at - y.at), next: 0 };
  });
  const tick = (t: number): void => {
    for (const run of runs) {
      for (let c = run.cues[run.next]; c && c.at < t + LOOKAHEAD_TL; c = run.cues[run.next]) {
        if (c.tempo !== undefined) run.dir.tempoScale = c.tempo;
        if (c.tau !== undefined) run.dir.layerTau = c.tau;
        if (c.hubChords) run.dir.hubChords = c.hubChords;
        if (c.intensity !== undefined || c.phase !== undefined)
          run.dir.setIntensity(c.intensity ?? run.dir.intensity, c.phase ?? 1);
        if (c.mode) run.dir.setMode(c.mode);
        if (c.resync) run.dir.resync(c.at);
        run.next += 1;
      }
      run.dir.update(LOOKAHEAD_TL);
    }
  };
  const steps = Math.floor(spec.seconds / DT);
  for (let i = 1; i < steps; i += 1) {
    void ctx.suspend(i * DT).then(() => {
      tick(ctx.currentTime);
      void ctx.resume();
    });
  }
  await placeEvents(ctx, sections, spec.events ?? [], musicTrim);
  tick(0);
  return result(await ctx.startRendering());
}

/**
 * Effets placés : chaque événement est d'abord rendu seul (pour pouvoir le jouer plus haut, le couper
 * ou le filtrer), puis posé à son temps avec niveau, panoramique et réverbération.
 */
export async function renderSfxTimeline(spec: TimelineSpec): Promise<Rendered> {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * spec.seconds), SR);
  const sections = buildSections(ctx, spec);
  await placeEvents(
    ctx,
    sections,
    spec.events ?? [],
    busGainFor(DEFAULT_AUDIO_SETTINGS, 'sfx', false),
  );
  return result(await ctx.startRendering());
}

async function placeEvents(
  ctx: OfflineAudioContext,
  sections: readonly SectionNodes[],
  events: readonly TimelineEvent[],
  trim: number,
): Promise<void> {
  let n = 0;
  for (const e of events) {
    n += 1;
    const seed = e.seed ?? 7 + n;
    const probe = new OfflineAudioContext(1, SR, SR);
    const est = renderOne(
      { ctx: probe, out: probe.createGain(), t: 0, r: lcg(seed), amount: e.amount ?? 0 },
      e,
    );
    const lead = 0.005;
    const one = new OfflineAudioContext(1, Math.ceil(SR * Math.min(10, est + 0.6)), SR);
    renderOne({ ctx: one, out: one.destination, t: lead, r: lcg(seed), amount: e.amount ?? 0 }, e);
    const src = ctx.createBufferSource();
    src.buffer = await one.startRendering();
    const rate = e.rate ?? 1;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const lvl = trim * 10 ** ((e.db ?? 0) / 20);
    g.gain.setValueAtTime(lvl, 0);
    if (e.cutAt !== undefined) {
      g.gain.setValueAtTime(lvl, Math.max(0, e.cutAt - 0.04));
      g.gain.linearRampToValueAtTime(0, e.cutAt);
    }
    src.connect(g);
    let head: AudioNode = g;
    if (e.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = e.lowpass;
      f.Q.value = 0.7;
      g.connect(f);
      head = f;
    }
    const pan = ctx.createStereoPanner();
    pan.pan.value = e.pan ?? 0;
    head.connect(pan);
    const sec = sections[e.section];
    if (!sec) throw new Error(`Section inconnue : ${e.section}`);
    pan.connect(sec.dry);
    if (e.reverb) {
      const send = ctx.createGain();
      send.gain.value = e.reverb;
      const conv = ctx.createConvolver();
      conv.normalize = false;
      conv.buffer = makeReverb(ctx, e.reverbSeconds ?? 2, 303 + n);
      pan.connect(send).connect(conv).connect(sec.gate);
    }
    src.start(Math.max(0, e.at - lead / rate));
  }
}
