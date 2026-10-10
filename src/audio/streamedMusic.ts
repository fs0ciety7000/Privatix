/**
 * OST en streaming : `HTMLAudioElement` (préchargement « auto », même WebM/Opus) branché dans le
 * graphe Web Audio par `MediaElementAudioSourceNode`. Rien n'est décodé d'avance : le navigateur ne
 * garde que les octets compressés (≈ 1,5 Mo par morceau) au lieu de ≈ 46 Mo de PCM.
 *
 *   élément A ─ source ─ gain ─┐
 *   élément B ─ source ─ gain ─┴─ gain du morceau ─ passe-bas (intensité) ─ gain réactif ─ sortie
 *
 * Boucle : deux éléments du même fichier, alternés. Quand l'élément qui joue atteint
 * `loopEnd − LOOP_CROSSFADE`, l'autre repart de `loopStart` en fondu d'entrée pendant que le premier
 * s'éteint, puis il est mis en pause. Les fondus sont des rampes de l'horloge Web Audio.
 *
 * `MusicStreams` précharge les éléments (un par morceau demandé, au plus `MAX_ELEMENTS` en vie) et
 * signale ceux qui sont prêts (`canplaythrough`) ou en échec (`error`, lecture refusée) : l'appelant
 * garde alors la synthèse.
 */
import type { TrackDef } from './tracks';
import { LOOP_CROSSFADE, TRACK_CROSSFADE } from './tracks';

/** Ce que le lecteur utilise d'un `HTMLAudioElement` (simulable en test). */
export interface MediaLike {
  src: string;
  preload: string;
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  addEventListener(type: string, cb: () => void): void;
  removeEventListener(type: string, cb: () => void): void;
  removeAttribute?(name: string): void;
}

export type MediaFactory = () => MediaLike;

/** Contexte capable de brancher un élément média (le `BaseAudioContext` hors ligne ne l'est pas). */
interface MediaContext extends BaseAudioContext {
  createMediaElementSource(el: MediaLike): AudioNode;
}

export function canStream(ctx: BaseAudioContext): ctx is MediaContext {
  return typeof (ctx as Partial<MediaContext>).createMediaElementSource === 'function';
}

export type StreamStatus = 'idle' | 'loading' | 'ready' | 'failed';

/** Éléments préchargés gardés en vie (morceau en cours compris). */
const MAX_ELEMENTS = 8;

interface StreamEntry {
  readonly file: string;
  el: MediaLike | null;
  status: StreamStatus;
  usedAt: number;
  cleanup: () => void;
}

export class MusicStreams {
  private readonly entries = new Map<string, StreamEntry>();
  private clock = 0;
  /** Fichiers à ne pas libérer (morceau en cours). */
  public keep: ReadonlySet<string> = new Set();

  public constructor(
    private readonly baseUrl: string,
    private readonly create: MediaFactory,
    private readonly warn?: (msg: string) => void,
  ) {}

  public url(file: string): string {
    return this.baseUrl + file;
  }

  public status(file: string): StreamStatus {
    return this.entries.get(file)?.status ?? 'idle';
  }

  /** Précharge `file` (sans effet s'il est déjà demandé ou en échec). */
  public request(file: string): void {
    const known = this.entries.get(file);
    if (known && known.status !== 'idle') {
      known.usedAt = ++this.clock;
      return;
    }
    const el = this.create();
    const entry: StreamEntry = {
      file,
      el,
      status: 'loading',
      usedAt: ++this.clock,
      cleanup: () => undefined,
    };
    const ready = (): void => {
      if (entry.status === 'loading') entry.status = 'ready';
    };
    const error = (): void => {
      this.fail(file, 'erreur de chargement');
    };
    el.addEventListener('canplaythrough', ready);
    el.addEventListener('error', error);
    entry.cleanup = () => {
      el.removeEventListener('canplaythrough', ready);
      el.removeEventListener('error', error);
    };
    el.preload = 'auto';
    el.src = this.url(file);
    this.entries.set(file, entry);
    this.trim();
  }

  /** Élément prêt à jouer (préchargé), ou `null`. */
  public take(file: string): MediaLike | null {
    const e = this.entries.get(file);
    if (e?.status !== 'ready' || !e.el) return null;
    e.usedAt = ++this.clock;
    return e.el;
  }

  /** Lecture impossible (erreur réseau, format, lecture refusée) : la synthèse reste. */
  public fail(file: string, why: string): void {
    const e = this.entries.get(file);
    if (!e || e.status === 'failed') return;
    e.status = 'failed';
    this.warn?.(`[audio] ${file} indisponible (${why}) : synthèse conservée`);
  }

  /** Libère les éléments les plus anciens au-delà de `MAX_ELEMENTS` (jamais celui qui joue). */
  private trim(): void {
    const alive = [...this.entries.values()].filter((e) => e.el && e.status !== 'failed');
    if (alive.length <= MAX_ELEMENTS) return;
    alive.sort((a, b) => a.usedAt - b.usedAt);
    for (const e of alive.slice(0, alive.length - MAX_ELEMENTS)) {
      if (this.keep.has(e.file)) continue;
      e.cleanup();
      if (e.el) release(e.el);
      this.entries.delete(e.file);
    }
  }

  /** Éléments préchargés en vie (outil de test et de débogage). */
  public get alive(): number {
    let n = 0;
    for (const e of this.entries.values()) if (e.el) n += 1;
    return n;
  }

  public dispose(): void {
    for (const e of this.entries.values()) {
      e.cleanup();
      if (e.el) release(e.el);
    }
    this.entries.clear();
  }
}

/** Arrête un élément et rend sa mémoire (tampon, décodeur). */
function release(el: MediaLike): void {
  el.pause();
  el.removeAttribute?.('src');
  el.src = '';
  el.load();
}

interface Voice {
  readonly el: MediaLike;
  readonly gain: GainNode;
  /** Élément créé par le lecteur (le second de la boucle) : libéré à l'arrêt. */
  readonly owned: boolean;
}

interface Playing {
  readonly track: TrackDef;
  readonly out: GainNode;
  /** Les deux éléments alternés (le second est créé au démarrage pour se précharger). */
  readonly voices: Voice[];
  /** Élément qui joue (indice dans `voices`). */
  current: number;
  /** Fondu de boucle en cours jusqu'à ce temps du contexte. */
  swapUntil: number;
}

interface Fading {
  readonly voices: readonly Voice[];
  readonly until: number;
  readonly out: GainNode;
}

export class StreamedMusic {
  private readonly filter: BiquadFilterNode;
  private readonly level: GainNode;
  private current: Playing | null = null;
  private fading: Fading[] = [];
  /** Sources déjà créées (un élément ne se branche qu'une fois). */
  private readonly sources = new WeakMap<MediaLike, AudioNode>();
  private hidden = false;
  /** Appelé si la lecture est refusée (autoplay) ou échoue : l'appelant repasse à la synthèse. */
  public onFail: (file: string, why: string) => void = () => undefined;

  public constructor(
    private readonly ctx: MediaContext,
    out: AudioNode,
    private readonly create: MediaFactory,
    private readonly url: (file: string) => string,
  ) {
    this.level = ctx.createGain();
    this.level.connect(out);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.filter.Q.value = 0.5;
    this.filter.connect(this.level);
  }

  public get trackId(): string | null {
    return this.current?.track.id ?? null;
  }

  public get playing(): boolean {
    return this.current !== null;
  }

  /** Éléments en cours (lecture ou fondu de sortie). */
  public get elements(): number {
    return (
      (this.current?.voices.length ?? 0) + this.fading.reduce((n, f) => n + f.voices.length, 0)
    );
  }

  private connect(el: MediaLike, dest: AudioNode): GainNode {
    let src = this.sources.get(el);
    if (!src) {
      src = this.ctx.createMediaElementSource(el);
      this.sources.set(el, src);
    }
    const gain = this.ctx.createGain();
    src.connect(gain).connect(dest);
    return gain;
  }

  /** Lance `track` (élément préchargé `el`) en fondu enchaîné avec le morceau en cours. */
  public play(track: TrackDef, el: MediaLike, fade = TRACK_CROSSFADE): void {
    if (this.current?.track.id === track.id) return;
    const t = this.ctx.currentTime + 0.02;
    this.stop(fade);
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(1, t + fade);
    out.connect(this.filter);
    const a: Voice = { el, gain: this.connect(el, out), owned: false };
    a.gain.gain.setValueAtTime(1, t);
    const voices = [a];
    if (track.loop) {
      // Second élément du même fichier (cache HTTP) : il se précharge pendant le premier tour.
      const b = this.create();
      b.preload = 'auto';
      b.src = this.url(track.file);
      const vb: Voice = { el: b, gain: this.connect(b, out), owned: true };
      vb.gain.gain.setValueAtTime(0, t);
      voices.push(vb);
    }
    this.current = { track, out, voices, current: 0, swapUntil: 0 };
    el.currentTime = 0;
    this.start(track, el);
  }

  private start(track: TrackDef, el: MediaLike): void {
    if (this.hidden) return;
    el.play().catch((err: unknown) => {
      if (this.current?.track.id !== track.id) return;
      this.onFail(track.file, `lecture refusée : ${String(err)}`);
    });
  }

  /** Éteint le morceau en cours (`fade` ≈ 0 : coupure nette, pour le silence du coup final). */
  public stop(fade = TRACK_CROSSFADE): void {
    const p = this.current;
    if (!p) return;
    this.current = null;
    const t = this.ctx.currentTime;
    const g = p.out.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    const until = t + Math.max(0.03, fade);
    g.linearRampToValueAtTime(0, until);
    this.fading.push({ voices: p.voices, until: until + 0.05, out: p.out });
  }

  /** À chaque frame : boucle (bascule d'élément) et fin des fondus de sortie. */
  public update(): void {
    const now = this.ctx.currentTime;
    this.fading = this.fading.filter((f) => {
      if (f.until > now) return true;
      for (const v of f.voices) {
        // Le premier élément revient au préchargeur (réutilisable) ; le second est libéré.
        v.gain.disconnect();
        // Le même élément peut avoir été repris entre-temps (retour rapide sur le morceau).
        if (this.current?.voices.some((c) => c.el === v.el)) continue;
        v.el.pause();
        this.sources.get(v.el)?.disconnect();
        if (v.owned) release(v.el);
      }
      f.out.disconnect();
      return false;
    });
    const p = this.current;
    if (!p?.track.loop || this.hidden) return;
    const cur = p.voices[p.current];
    const next = p.voices[(p.current + 1) % p.voices.length];
    if (!cur || !next) return;
    if (p.swapUntil > 0 && now >= p.swapUntil) {
      // Fin du fondu : l'ancien élément s'arrête.
      p.swapUntil = 0;
      const old = p.voices[(p.current + 1) % p.voices.length];
      old?.el.pause();
    }
    if (p.swapUntil > 0) return;
    const loopAt =
      Math.max(p.track.loopStart + LOOP_CROSSFADE + 1, p.track.loopEnd) - LOOP_CROSSFADE;
    if (cur.el.currentTime < loopAt && !cur.el.ended) return;
    // Bascule : `next` repart du point de reprise en fondu d'entrée, `cur` s'éteint.
    const end = now + LOOP_CROSSFADE;
    next.el.currentTime = p.track.loopStart;
    next.gain.gain.cancelScheduledValues(now);
    next.gain.gain.setValueAtTime(0, now);
    next.gain.gain.linearRampToValueAtTime(1, end);
    cur.gain.gain.cancelScheduledValues(now);
    cur.gain.gain.setValueAtTime(1, now);
    cur.gain.gain.linearRampToValueAtTime(0, end);
    this.start(p.track, next.el);
    p.current = (p.current + 1) % p.voices.length;
    p.swapUntil = end;
  }

  /** Onglet caché : les éléments s'arrêtent (pas de décodage pour rien), reprise au retour. */
  public setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    const p = this.current;
    if (!p) return;
    const cur = p.voices[p.current];
    if (!cur) return;
    if (hidden) for (const v of p.voices) v.el.pause();
    else this.start(p.track, cur.el);
  }

  /** Passe-bas et gain (intensité de combat), lissés. */
  public setMix(cutoff: number, gain: number): void {
    const t = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.5);
    this.level.gain.setTargetAtTime(gain, t, 0.5);
  }

  public dispose(): void {
    this.stop(0.03);
    for (const f of this.fading)
      for (const v of f.voices) {
        v.el.pause();
        if (v.owned) release(v.el);
      }
    this.fading = [];
    this.level.disconnect();
  }
}
