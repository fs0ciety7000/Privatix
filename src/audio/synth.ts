/**
 * Primitives de synthèse (Web Audio pur, jamais three ni la sim). Elles prennent un `BaseAudioContext`
 * pour servir à la fois au jeu (`AudioContext`) et au rendu hors ligne des tests d'écoute
 * (`OfflineAudioContext`, `tools/audio/render.mjs`). Chaque fonction planifie ses nœuds à l'instant `t`
 * (secondes, horloge du contexte) et les branche sur `out` ; les nœuds s'arrêtent d'eux-mêmes.
 *
 * Règles anti-fatigue : enveloppes sans attaque instantanée (≥ 2 ms, pas de clic), aigus filtrés
 * (rien d'utile au-dessus de 9 kHz), crêtes gérées par le limiteur du bus maître.
 */

/** Plus petite attaque : évite les clics numériques. */
const MIN_ATTACK = 0.002;
/** Plancher des rampes exponentielles (elles ne peuvent pas atteindre 0). */
const FLOOR = 0.0001;

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Bruit blanc de 2 s, déterministe (LCG), mis en cache par contexte. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let s = 0x9e3779b9;
  for (let i = 0; i < len; i += 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    data[i] = (s / 0xffffffff) * 2 - 1;
  }
  noiseCache.set(ctx, buf);
  return buf;
}

/** Enveloppe attaque / déclin exponentiel sur un `AudioParam` de gain. */
export function envelope(
  p: AudioParam,
  t: number,
  peak: number,
  attack: number,
  decay: number,
  hold = 0,
): void {
  const a = Math.max(MIN_ATTACK, attack);
  p.cancelScheduledValues(t);
  p.setValueAtTime(FLOOR, t);
  p.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) p.setValueAtTime(peak, t + a + hold);
  p.exponentialRampToValueAtTime(FLOOR, t + a + hold + Math.max(0.005, decay));
}

export interface ToneOpts {
  readonly type?: OscillatorType;
  readonly gain?: number;
  readonly attack?: number;
  readonly decay?: number;
  readonly hold?: number;
  /** Fréquence d'arrivée (glissando exponentiel sur la durée de l'enveloppe). */
  readonly to?: number;
  /** Durée du glissando (s), par défaut toute l'enveloppe. */
  readonly glide?: number;
  readonly detune?: number;
  /** Vibrato : profondeur (cents) et vitesse (Hz). */
  readonly vibrato?: readonly [number, number];
}

/** Oscillateur enveloppé. Renvoie sa durée (s). */
export function tone(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  o: ToneOpts = {},
): number {
  const attack = o.attack ?? 0.005;
  const decay = o.decay ?? 0.2;
  const hold = o.hold ?? 0;
  const dur = attack + hold + decay;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.to !== undefined)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + (o.glide ?? dur));
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  const g = ctx.createGain();
  envelope(g.gain, t, o.gain ?? 0.3, attack, decay, hold);
  osc.connect(g).connect(out);
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.setValueAtTime(o.vibrato[1], t);
    depth.gain.setValueAtTime(o.vibrato[0], t);
    lfo.connect(depth).connect(osc.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.02);
  }
  osc.start(t);
  osc.stop(t + dur + 0.02);
  return dur;
}

export interface NoiseOpts {
  readonly filter?: BiquadFilterType;
  readonly freq?: number;
  readonly to?: number;
  readonly q?: number;
  readonly gain?: number;
  readonly attack?: number;
  readonly decay?: number;
  readonly hold?: number;
  /** Vitesse de lecture du bruit (< 1 : plus sourd). */
  readonly rate?: number;
}

/** Bouffée de bruit filtré enveloppée. Renvoie sa durée (s). */
export function noise(ctx: BaseAudioContext, out: AudioNode, t: number, o: NoiseOpts = {}): number {
  const attack = o.attack ?? 0.003;
  const decay = o.decay ?? 0.15;
  const hold = o.hold ?? 0;
  const dur = attack + hold + decay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.playbackRate.setValueAtTime(o.rate ?? 1, t);
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 1500, t);
  if (o.to !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
  f.Q.setValueAtTime(o.q ?? 1, t);
  const g = ctx.createGain();
  envelope(g.gain, t, o.gain ?? 0.3, attack, decay, hold);
  src.connect(f).connect(g).connect(out);
  // Départ à un endroit variable du tampon : deux bouffées successives ne sont pas identiques.
  src.start(t, (t * 7.31) % 1.5);
  src.stop(t + dur + 0.02);
  return dur;
}

/**
 * Corps métallique (barre libre) : partiels inharmoniques (modes 1 ; 2,76 ; 5,40 ; 8,93) à déclins
 * décroissants. C'est le « tang » de la clé à tire-fond et des barrières.
 */
export function metal(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  base: number,
  gain: number,
  decay: number,
  ratios: readonly number[] = [1, 2.76, 5.4, 8.93],
): number {
  ratios.forEach((r, i) => {
    const f = base * r;
    if (f > 9000) return;
    tone(ctx, out, t, f, {
      type: 'sine',
      gain: gain / (1 + i * 0.9),
      attack: 0.001,
      decay: decay / (1 + i * 0.7),
    });
  });
  return decay;
}

/** Filtre passe-bas commun (adoucit un groupe de couches). */
export function lowpass(
  ctx: BaseAudioContext,
  out: AudioNode,
  freq: number,
  q = 0.7,
): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(out);
  return f;
}

/** Gain fixe intermédiaire. */
export function gainNode(ctx: BaseAudioContext, out: AudioNode, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  g.connect(out);
  return g;
}

/** Fréquence d'une note MIDI. */
export function mtof(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}
