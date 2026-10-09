import type { BurnoutTierDef } from '@/config/balance';
import { BURNOUT, BURNOUT_TIERS, MELTDOWN_TIER } from '@/config/balance';
import { clamp } from '@/utils/math';

export type BurnoutEvent =
  | { readonly kind: 'tier'; readonly tier: BurnoutTierDef }
  | { readonly kind: 'meltdown-start' }
  | { readonly kind: 'meltdown-end'; readonly maxEnergyPenalty: number };

/**
 * Jauge de Burnout (GDD « Énergie et Burnout ») : plus elle est haute, plus le héros frappe fort
 * et plus il est fragile. À 100 : Pétage de plombs de 8 s, puis séquelle sur l'Énergie max.
 * Pure : le temps est passé à `tick`, les événements sont renvoyés pour l'affichage.
 */
export class BurnoutMeter {
  private v: number;
  private floorValue = 0;
  private calmMs = 0;
  private meltdownLeft = 0;
  private tierId: BurnoutTierDef['id'];
  /** Bonus de récupération passive (méta « Local syndical »), en points/s. */
  public extraDecayPerS = 0;
  /** Multiplicateur de la récupération passive (Casque Cocotte-minute : 0,5), 1 = neutre. */
  public decayMult = 1;
  /**
   * Plafond de la jauge (Casque Cocotte-minute : 99). Sous `BURNOUT.MAX`, le Pétage de plombs ne se
   * déclenche plus. Par défaut : `BURNOUT.MAX`.
   */
  public cap: number = BURNOUT.MAX;

  public constructor(initial = 0) {
    this.v = clamp(initial, 0, BURNOUT.MAX);
    this.tierId = this.tier.id;
  }

  public get value(): number {
    return this.v;
  }

  public get floor(): number {
    return this.floorValue;
  }

  public get inMeltdown(): boolean {
    return this.meltdownLeft > 0;
  }

  /** Temps restant de Pétage de plombs (ms). */
  public get meltdownRemainingMs(): number {
    return this.meltdownLeft;
  }

  public get tier(): BurnoutTierDef {
    if (this.inMeltdown) return MELTDOWN_TIER;
    let current = BURNOUT_TIERS[0] ?? MELTDOWN_TIER;
    for (const t of BURNOUT_TIERS) if (this.v >= t.from) current = t;
    return current;
  }

  /** Plancher « Fatigue de fond » : heures écoulées × 5 (× multiplicateur du Shift). */
  public setFloor(hoursElapsed: number, floorMult: number): void {
    this.floorValue = clamp(hoursElapsed * BURNOUT.FLOOR_PER_HOUR * floorMult, 0, BURNOUT.MAX - 1);
    if (this.v < this.floorValue) this.v = this.floorValue;
  }

  /** Ajoute (ou retire) des points. Les gains interrompent la récupération passive si `resetsCalm`. */
  public add(points: number, resetsCalm = false, out: BurnoutEvent[] = []): BurnoutEvent[] {
    if (resetsCalm) this.calmMs = 0;
    if (this.inMeltdown) return out;
    this.v = clamp(this.v + points, this.floorValue, Math.min(BURNOUT.MAX, this.cap));
    if (this.v >= BURNOUT.MAX) {
      this.meltdownLeft = BURNOUT.MELTDOWN_MS;
      out.push({ kind: 'meltdown-start' });
    }
    this.checkTier(out);
    return out;
  }

  public onDamageTaken(amount: number, out: BurnoutEvent[] = []): BurnoutEvent[] {
    return this.add(amount * BURNOUT.PER_DAMAGE_TAKEN, true, out);
  }

  public onDash(out: BurnoutEvent[] = []): BurnoutEvent[] {
    return this.add(BURNOUT.PER_DASH, true, out);
  }

  public tick(dtMs: number, out: BurnoutEvent[] = []): BurnoutEvent[] {
    if (this.inMeltdown) {
      this.meltdownLeft = Math.max(0, this.meltdownLeft - dtMs);
      if (this.meltdownLeft === 0) {
        this.v = Math.max(this.floorValue, BURNOUT.MELTDOWN_EXIT_MIN);
        out.push({ kind: 'meltdown-end', maxEnergyPenalty: BURNOUT.MELTDOWN_MAX_ENERGY_PENALTY });
        this.calmMs = 0;
        this.checkTier(out, true);
      }
      return out;
    }
    this.calmMs += dtMs;
    if (this.calmMs >= BURNOUT.CALM_DELAY_MS && this.v > this.floorValue) {
      const decay =
        ((BURNOUT.CALM_DECAY_PER_S + this.extraDecayPerS) * this.decayMult * dtMs) / 1000;
      this.v = Math.max(this.floorValue, this.v - decay);
      this.checkTier(out);
    }
    return out;
  }

  private checkTier(out: BurnoutEvent[], force = false): void {
    const t = this.tier;
    if (force || t.id !== this.tierId) {
      this.tierId = t.id;
      out.push({ kind: 'tier', tier: t });
    }
  }
}
