/**
 * Rendu hors ligne (OfflineAudioContext) des effets et de la musique, à travers la même chaîne de
 * mixage que le jeu. Outil de développement : n'est importé que par `tools/audio/render.mjs` (via le
 * serveur Vite, dans Chromium) pour écrire des WAV et mesurer crête et RMS. Absent du build du jeu.
 */
import { busGainFor, createMixChain, DEFAULT_AUDIO_SETTINGS } from './AudioEngine';
import type { MixBus } from './AudioEngine';
import type { MusicMode } from './music';
import { MusicDirector } from './music';
import type { SfxId } from './sfx';
import { SFX } from './sfx';

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
