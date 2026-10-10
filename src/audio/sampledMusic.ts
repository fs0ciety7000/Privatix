/**
 * Lecteur de l'OST enregistrée : un morceau à la fois, fondu enchaîné entre morceaux, boucle sans
 * coupure (la durée réelle de chaque prise diffère de la cible : chaque itération démarre
 * `LOOP_CROSSFADE` s avant le point de bouclage mesuré et la précédente s'éteint en même temps).
 *
 *   source ─ gain d'itération ─┐
 *   source ─ gain d'itération ─┴─ gain du morceau ─ passe-bas (intensité) ─ gain réactif ─ sortie
 */
import type { TrackDef } from './tracks';
import { LOOP_CROSSFADE, nextLoopAt, TRACK_CROSSFADE } from './tracks';

interface Iteration {
  readonly src: AudioBufferSourceNode;
  readonly gain: GainNode;
}

interface Playing {
  readonly track: TrackDef;
  readonly buffer: AudioBuffer;
  readonly out: GainNode;
  iterations: Iteration[];
  /** Début de la prochaine itération (temps du contexte), `null` : pas de boucle. */
  nextAt: number | null;
}

/** Marge de planification de la boucle (s). */
const SCHEDULE_AHEAD = 0.5;

export class SampledMusic {
  private readonly filter: BiquadFilterNode;
  private readonly level: GainNode;
  private current: Playing | null = null;

  public constructor(
    private readonly ctx: BaseAudioContext,
    out: AudioNode,
  ) {
    this.level = ctx.createGain();
    this.level.connect(out);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.filter.Q.value = 0.5;
    this.filter.connect(this.level);
  }

  /** Morceau en cours (ou en train de s'éteindre : `null` après `stop`). */
  public get trackId(): string | null {
    return this.current?.track.id ?? null;
  }

  public get playing(): boolean {
    return this.current !== null;
  }

  /** Lance `track` en fondu enchaîné avec le morceau en cours. */
  public play(track: TrackDef, buffer: AudioBuffer, fade = TRACK_CROSSFADE): void {
    if (this.current?.track.id === track.id) return;
    const t = this.ctx.currentTime + 0.02;
    this.fadeOut(fade);
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(1, t + fade);
    out.connect(this.filter);
    const p: Playing = { track, buffer, out, iterations: [], nextAt: null };
    this.current = p;
    this.startIteration(p, t, 0, 0);
  }

  /** Éteint le morceau en cours (`fade` 0 : coupure nette, pour le silence du coup final). */
  public stop(fade = TRACK_CROSSFADE): void {
    this.fadeOut(fade);
    this.current = null;
  }

  private fadeOut(fade: number): void {
    const p = this.current;
    if (!p) return;
    const t = this.ctx.currentTime;
    const g = p.out.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    const end = t + Math.max(0.03, fade);
    g.linearRampToValueAtTime(0, end);
    for (const it of p.iterations) {
      try {
        it.src.stop(end + 0.05);
      } catch {
        // Déjà arrêtée.
      }
    }
    p.iterations = [];
    p.nextAt = null;
  }

  /** Nouvelle itération à `at`, lue depuis `offset`, en fondu d'entrée de `fadeIn` s. */
  private startIteration(p: Playing, at: number, offset: number, fadeIn: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = p.buffer;
    const gain = this.ctx.createGain();
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(1, at + fadeIn);
    } else gain.gain.setValueAtTime(1, at);
    src.connect(gain).connect(p.out);
    src.start(at, offset);
    // Sans boucle, la source s'arrête d'elle-même à la fin du fichier.
    p.iterations.push({ src, gain });
    p.nextAt = nextLoopAt(p.track, at, offset);
  }

  /** À chaque frame : planifie la prochaine itération de la boucle. */
  public update(): void {
    const p = this.current;
    const nextAt = p?.nextAt ?? null;
    if (!p || nextAt === null) return;
    const now = this.ctx.currentTime;
    if (nextAt > now + SCHEDULE_AHEAD) return;
    const at = Math.max(now + 0.01, nextAt);
    const end = at + LOOP_CROSSFADE;
    for (const it of p.iterations) {
      it.gain.gain.setValueAtTime(1, at);
      it.gain.gain.linearRampToValueAtTime(0, end);
      try {
        it.src.stop(end + 0.05);
      } catch {
        // Déjà arrêtée.
      }
    }
    p.iterations = [];
    this.startIteration(p, at, p.track.loopStart, LOOP_CROSSFADE);
  }

  /** Passe-bas et gain (intensité de combat), lissés. */
  public setMix(cutoff: number, gain: number): void {
    const t = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.5);
    this.level.gain.setTargetAtTime(gain, t, 0.5);
  }

  public dispose(): void {
    this.stop(0.05);
    this.level.disconnect();
  }
}
