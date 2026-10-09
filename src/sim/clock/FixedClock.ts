import type { TimeControl } from '@/sim/clock/TimeControl';

/** Pas fixe de la simulation : 60 Hz, quelle que soit la fréquence de l'écran. */
export const SIM_HZ = 60;
export const SIM_DT_MS = 1000 / SIM_HZ;
/** Au-delà, on abandonne le retard (onglet en arrière-plan) : pas de « spirale de la mort ». */
export const MAX_STEPS_PER_FRAME = 5;
/** Une frame réelle plus longue est tronquée. */
export const MAX_FRAME_MS = 250;

/** Ce que l'horloge fait avancer. */
export interface Steppable {
  /** Copie l'état courant dans l'état précédent (base de l'interpolation). */
  snapshot(): void;
  step(dtMs: number): void;
}

/**
 * Accumulateur à pas fixe avec interpolation (docs/ARCHITECTURE.md, « Boucle à pas fixe »).
 * Le temps réel passe par `TimeControl` : pendant un hitstop il vaut 0, donc aucun pas n'est joué et la
 * vue garde l'image du coup. Si un pas déclenche un hitstop, les pas restants de la frame sont abandonnés.
 */
export class FixedClock {
  private acc = 0;

  public constructor(private readonly time: TimeControl) {}

  /** Facteur d'interpolation entre l'état précédent et l'état courant (0..1). */
  public get alpha(): number {
    return Math.min(1, this.acc / SIM_DT_MS);
  }

  /** Avance d'une frame réelle ; renvoie le nombre de pas de simulation joués. */
  public frame(realMs: number, target: Steppable): number {
    const real = Math.min(MAX_FRAME_MS, Math.max(0, realMs));
    this.acc += this.time.advance(real);
    let steps = 0;
    while (this.acc >= SIM_DT_MS && steps < MAX_STEPS_PER_FRAME) {
      target.snapshot();
      target.step(SIM_DT_MS);
      this.acc -= SIM_DT_MS;
      steps += 1;
      if (this.time.frozen) {
        // Gel déclenché pendant ce pas : on fige l'image sur l'état du coup.
        target.snapshot();
        this.acc = 0;
        break;
      }
    }
    if (steps === MAX_STEPS_PER_FRAME && this.acc >= SIM_DT_MS) this.acc = 0;
    return steps;
  }

  public reset(): void {
    this.acc = 0;
  }
}
