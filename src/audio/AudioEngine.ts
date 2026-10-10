/**
 * Moteur audio de l'entrée 3D (Web Audio, jamais three ni la sim). Graphe :
 *
 *   voix ─ gain ─ panoramique ─┐
 *                              ├─ bus sfx ─┐
 *                              ├─ bus ui ──┤
 *   musique (music.ts) ────────┼─ bus music┼─ maître ─ compresseur ─ limiteur ─ coupure ─ sortie
 *   ambiance (music.ts) ───────┼─ bus amb ─┤
 *   dialogues (voice.ts) ──────┴─ bus voix┘
 *
 * - Le contexte n'est créé qu'au premier geste (clic, touche, toucher) : aucun avertissement d'autoplay.
 * - Pool de voix : au plus `MAX_VOICES` sons en même temps, et par son `max` voix et `gapMs` d'écart
 *   (la plus ancienne voix du même son est coupée en fondu, un déclenchement trop rapproché est ignoré).
 * - Spatialisation simple : panoramique selon l'écart horizontal au héros (≈ x écran, la caméra le suit)
 *   et atténuation douce avec la distance.
 * - Réglages (maître, musique, effets, voix, coupure, sons répétitifs réduits) persistés dans le navigateur ;
 *   chaque accès au stockage est protégé (navigation privée, quota).
 */
import type { KeyValueStorage } from '@/systems/save/SaveManager';
import type { SfxDef, SfxId } from './sfx';
import { SFX } from './sfx';

export interface AudioSettings {
  /** Volumes 0..1 (courbe quadratique appliquée au gain). */
  readonly master: number;
  readonly music: number;
  readonly sfx: number;
  /** Dialogues enregistrés. */
  readonly voice: number;
  readonly muted: boolean;
  /** Accessibilité : divise les voix des sons répétitifs et espace leurs déclenchements. */
  readonly reduceRepetitive: boolean;
}

/** Volumes bas par défaut : la musique ne doit pas fatiguer. */
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 0.8,
  music: 0.5,
  sfx: 0.8,
  voice: 0.9,
  muted: false,
  reduceRepetitive: false,
};

export const AUDIO_SETTINGS_KEY = 'privatix.audio';
/** Voix simultanées au total (tous sons confondus). */
export const MAX_VOICES = 24;
/** Gain propre de chaque bus, sous le curseur correspondant. */
const TRIM = { music: 0.55, ambience: 0.5, sfx: 1, ui: 0.8, voice: 1 } as const;
/** Multiplicateurs pendant la pause : on étouffe les effets, la musique baisse, l'UI reste. */
const PAUSED = { music: 0.45, ambience: 0.6, sfx: 0, ui: 1, voice: 0.85 } as const;
const RAMP = 0.06;

export type MixBus = keyof typeof TRIM;

export interface PlayOptions {
  /** Position logique (u) : spatialisée si le son l'est. */
  readonly x?: number | undefined;
  readonly y?: number | undefined;
  readonly amount?: number | undefined;
  readonly gain?: number | undefined;
}

interface Voice {
  readonly id: SfxId;
  readonly start: number;
  end: number;
  readonly out: GainNode;
}

export interface AudioEngineDeps {
  /** Fabrique du contexte (injectée par les tests). `null` : pas de Web Audio. */
  readonly createContext?: () => AudioContext | null;
  readonly storage?: KeyValueStorage | null;
  readonly random?: () => number;
}

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

/** Lit les réglages mémorisés ; toute valeur absente ou invalide reprend sa valeur par défaut. */
export function loadAudioSettings(storage: KeyValueStorage | null): AudioSettings {
  const d = DEFAULT_AUDIO_SETTINGS;
  let raw: string | null;
  try {
    raw = storage?.getItem(AUDIO_SETTINGS_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (!raw) return d;
  try {
    const p = JSON.parse(raw) as Partial<Record<keyof AudioSettings, unknown>>;
    return {
      master: clamp01(p.master, d.master),
      music: clamp01(p.music, d.music),
      sfx: clamp01(p.sfx, d.sfx),
      voice: clamp01(p.voice, d.voice),
      muted: typeof p.muted === 'boolean' ? p.muted : d.muted,
      reduceRepetitive:
        typeof p.reduceRepetitive === 'boolean' ? p.reduceRepetitive : d.reduceRepetitive,
    };
  } catch {
    return d;
  }
}

/** Panoramique (−1..1) et gain de distance d'une source à (dx, dy) u du héros. */
export function spatialize(dx: number, dy: number): { pan: number; gain: number } {
  const pan = Math.max(-1, Math.min(1, dx / 340)) * 0.8;
  const d = Math.hypot(dx, dy);
  const gain = Math.max(0.3, 1 / (1 + Math.max(0, d - 110) / 300));
  return { pan, gain };
}

/** Curseur 0..1 → gain (courbe quadratique, plus naturelle à l'oreille). */
export function sliderGain(v: number): number {
  return v * v;
}

/** Gain d'un bus : curseur (musique ou effets) × trim du bus × atténuation de pause. */
export function busGainFor(s: AudioSettings, id: MixBus, paused: boolean): number {
  const slider = id === 'music' || id === 'ambience' ? s.music : id === 'voice' ? s.voice : s.sfx;
  return sliderGain(slider) * TRIM[id] * (paused ? PAUSED[id] : 1);
}

export interface MixChain {
  readonly buses: Record<MixBus, GainNode>;
  readonly master: GainNode;
  readonly out: GainNode;
}

/**
 * Bus → maître → compresseur de bus → limiteur → coupure → `dest`. Partagé par le jeu et le rendu
 * hors ligne des tests d'écoute (mêmes niveaux, même limiteur).
 */
export function createMixChain(ctx: BaseAudioContext, dest: AudioNode): MixChain {
  const out = ctx.createGain();
  out.connect(dest);
  // Limiteur : compresseur dur, attaque minimale, juste sous 0 dBFS.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.12;
  limiter.connect(out);
  // Compresseur de bus : colle le mélange, adoucit les pics des coups superposés.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 10;
  comp.ratio.value = 3;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  comp.connect(limiter);
  const master = ctx.createGain();
  master.connect(comp);
  const mk = (): GainNode => {
    const g = ctx.createGain();
    g.connect(master);
    return g;
  };
  return {
    buses: { music: mk(), ambience: mk(), sfx: mk(), ui: mk(), voice: mk() },
    master,
    out,
  };
}

function defaultContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  try {
    return new AudioContext({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
}

export class AudioEngine {
  private ctxRef: AudioContext | null = null;
  private buses: Record<MixBus, GainNode> | null = null;
  private outGain: GainNode | null = null;
  private settingsRef: AudioSettings;
  private voices: Voice[] = [];
  private readonly lastPlay = new Map<SfxId, number>();
  private readonly storage: KeyValueStorage | null;
  private readonly createContext: () => AudioContext | null;
  private readonly random: () => number;
  private readonly readyListeners: (() => void)[] = [];
  private unlockTarget: EventTarget | null = null;
  private readonly unlockHandler = (): void => {
    this.unlock();
  };
  private pausedRef = false;
  private hiddenRef = false;
  /** Position du héros (u) : référence de la spatialisation. */
  public listenerX = 0;
  public listenerY = 0;

  public constructor(deps: AudioEngineDeps = {}) {
    this.storage = deps.storage ?? null;
    this.createContext = deps.createContext ?? defaultContext;
    this.random = deps.random ?? Math.random;
    this.settingsRef = loadAudioSettings(this.storage);
  }

  // ─── Cycle de vie ──────────────────────────────────────────────────────────

  public get ctx(): AudioContext | null {
    return this.ctxRef;
  }

  /** Le contexte tourne (déverrouillé par un geste). */
  public get running(): boolean {
    return this.ctxRef?.state === 'running';
  }

  public get settings(): AudioSettings {
    return this.settingsRef;
  }

  public get activeVoices(): number {
    this.sweep();
    return this.voices.length;
  }

  /** Bus de sortie (la musique et l'ambiance s'y branchent). `null` avant le premier geste. */
  public bus(id: MixBus): GainNode | null {
    return this.buses?.[id] ?? null;
  }

  /** Appelé une fois que le contexte tourne (démarrage de la musique). */
  public onReady(cb: () => void): void {
    if (this.running) cb();
    else this.readyListeners.push(cb);
  }

  /** Écoute le premier geste de l'utilisateur sur `target` (document) pour déverrouiller l'audio. */
  public attachUnlock(target: EventTarget): void {
    this.unlockTarget = target;
    for (const ev of ['pointerdown', 'keydown', 'touchend', 'mousedown'])
      target.addEventListener(ev, this.unlockHandler, { capture: true });
  }

  private detachUnlock(): void {
    const t = this.unlockTarget;
    if (!t) return;
    for (const ev of ['pointerdown', 'keydown', 'touchend', 'mousedown'])
      t.removeEventListener(ev, this.unlockHandler, { capture: true });
    this.unlockTarget = null;
  }

  /** Crée le contexte au besoin et le relance (à appeler dans un geste utilisateur). */
  public unlock(): void {
    if (!this.ctxRef) {
      this.ctxRef = this.createContext();
      if (!this.ctxRef) {
        this.detachUnlock();
        return;
      }
      this.build(this.ctxRef);
    }
    const ctx = this.ctxRef;
    if (this.hiddenRef) return;
    if (ctx.state === 'running') {
      this.ready();
      return;
    }
    void ctx
      .resume()
      .then(() => {
        if (ctx.state === 'running') this.ready();
      })
      .catch(() => undefined);
  }

  private ready(): void {
    this.detachUnlock();
    const cbs = this.readyListeners.splice(0);
    for (const cb of cbs) cb();
  }

  private build(ctx: AudioContext): void {
    const chain = createMixChain(ctx, ctx.destination);
    this.buses = chain.buses;
    this.outGain = chain.out;
    this.masterGain = chain.master;
    this.applyMix(true);
  }

  private masterGain: GainNode | null = null;

  // ─── Réglages, pause ──────────────────────────────────────────────────────

  public setSettings(next: Partial<AudioSettings>): void {
    const s = { ...this.settingsRef, ...next };
    this.settingsRef = {
      master: clamp01(s.master, DEFAULT_AUDIO_SETTINGS.master),
      music: clamp01(s.music, DEFAULT_AUDIO_SETTINGS.music),
      sfx: clamp01(s.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
      voice: clamp01(s.voice, DEFAULT_AUDIO_SETTINGS.voice),
      muted: s.muted,
      reduceRepetitive: s.reduceRepetitive,
    };
    try {
      this.storage?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settingsRef));
    } catch {
      // Stockage plein ou bloqué : le réglage vaut pour la session.
    }
    this.applyMix(false);
  }

  /** Jeu en pause (menu ouvert) : effets coupés, musique baissée, interface intacte. */
  public setPaused(paused: boolean): void {
    if (paused === this.pausedRef) return;
    this.pausedRef = paused;
    this.applyMix(false);
  }

  public get paused(): boolean {
    return this.pausedRef;
  }

  /** Onglet caché : le contexte est suspendu (aucun calcul audio), repris au retour. */
  public setHidden(hidden: boolean): void {
    if (hidden === this.hiddenRef) return;
    this.hiddenRef = hidden;
    const ctx = this.ctxRef;
    if (!ctx) return;
    if (hidden) void ctx.suspend().catch(() => undefined);
    else if (!this.unlockTarget) this.unlock();
  }

  /** Gain cible d'un bus d'après les réglages et la pause. */
  public busGain(id: MixBus): number {
    return busGainFor(this.settingsRef, id, this.pausedRef);
  }

  private applyMix(immediate: boolean): void {
    const ctx = this.ctxRef;
    if (!ctx || !this.buses || !this.outGain || !this.masterGain) return;
    const t = ctx.currentTime;
    const set = (p: AudioParam, v: number): void => {
      if (immediate) p.setValueAtTime(v, t);
      else p.setTargetAtTime(v, t, RAMP / 3);
    };
    const s = this.settingsRef;
    set(this.masterGain.gain, sliderGain(s.master));
    set(this.outGain.gain, s.muted ? 0 : 1);
    for (const id of Object.keys(this.buses) as MixBus[])
      set(this.buses[id].gain, this.busGain(id));
  }

  // ─── Lecture ──────────────────────────────────────────────────────────────

  /** Retire les voix terminées (et débranche leurs nœuds). */
  private sweep(): void {
    const ctx = this.ctxRef;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.voices = this.voices.filter((v) => {
      if (v.end > now) return true;
      v.out.disconnect();
      return false;
    });
  }

  private stopVoice(v: Voice, now: number): void {
    v.out.gain.cancelScheduledValues(now);
    v.out.gain.setTargetAtTime(0, now, 0.01);
    v.end = Math.min(v.end, now + 0.06);
  }

  /** Limites effectives d'un son (le mode « sons répétitifs réduits » les resserre). */
  public limits(def: SfxDef): { max: number; gapMs: number } {
    if (!this.settingsRef.reduceRepetitive || !def.repetitive)
      return { max: def.max, gapMs: def.gapMs };
    return { max: 1, gapMs: Math.max(def.gapMs * 2.5, 90) };
  }

  /** Joue un effet. Renvoie `false` s'il est ignoré (verrouillé, pause, limite de voix, trop rapproché). */
  public play(id: SfxId, o: PlayOptions = {}): boolean {
    const ctx = this.ctxRef;
    const buses = this.buses;
    if (!ctx || !buses || ctx.state !== 'running') return false;
    const def: SfxDef = SFX[id];
    if (this.pausedRef && def.bus === 'sfx') return false;
    const now = ctx.currentTime;
    const { max, gapMs } = this.limits(def);
    const last = this.lastPlay.get(id);
    if (last !== undefined && (now - last) * 1000 < gapMs) return false;
    this.sweep();
    const same = this.voices.filter((v) => v.id === id && v.end > now + 0.05);
    if (same.length >= max) {
      const oldest = same[0];
      if (oldest) this.stopVoice(oldest, now);
    }
    if (this.voices.length >= MAX_VOICES) {
      const oldest = this.voices.reduce((a, b) => (b.start < a.start ? b : a));
      this.stopVoice(oldest, now);
      oldest.out.disconnect();
      this.voices.splice(this.voices.indexOf(oldest), 1);
    }
    this.lastPlay.set(id, now);

    const out = ctx.createGain();
    let gain = o.gain ?? 1;
    let dest: AudioNode = buses[def.bus];
    if (def.spatial !== false && o.x !== undefined && o.y !== undefined) {
      const sp = spatialize(o.x - this.listenerX, o.y - this.listenerY);
      gain *= sp.gain;
      if (typeof ctx.createStereoPanner === 'function') {
        const pan = ctx.createStereoPanner();
        pan.pan.value = sp.pan;
        pan.connect(dest);
        dest = pan;
      }
    }
    out.gain.value = gain;
    out.connect(dest);
    const t = now + 0.005;
    const dur = def.render({
      ctx,
      out,
      t,
      r: this.random,
      amount: o.amount ?? 0,
    });
    this.voices.push({ id, start: now, end: t + dur + 0.1, out });
    return true;
  }

  public dispose(): void {
    this.detachUnlock();
    this.voices = [];
    const ctx = this.ctxRef;
    this.ctxRef = null;
    this.buses = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }
}
