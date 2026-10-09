import { DASH } from '@/config/balance';

/** Charges du dash « Retard SNCB » : chaque charge se recharge en 750 ms, l'une après l'autre. */
export class DashCharges {
  private charges: number;
  private rechargeProgress = 0;
  private sinceLast = Number.POSITIVE_INFINITY;
  /** Multiplicateur de vitesse de recharge (×2 pendant le Pétage de plombs). */
  public rechargeRate = 1;

  public constructor(public max: number = DASH.CHARGES) {
    this.charges = max;
  }

  public get available(): number {
    return this.charges;
  }

  /** Progression de la charge en cours (0..1), pour le HUD. */
  public get progress(): number {
    return this.charges >= this.max ? 1 : this.rechargeProgress / DASH.RECHARGE_MS;
  }

  public canDash(): boolean {
    return this.charges >= 1 && this.sinceLast >= DASH.MIN_INTERVAL_MS;
  }

  public consume(): boolean {
    if (!this.canDash()) return false;
    this.charges -= 1;
    this.sinceLast = 0;
    return true;
  }

  /** Rend une fraction de charge (dash parfait : +0,5). */
  public refund(fraction: number): void {
    this.rechargeProgress += fraction * DASH.RECHARGE_MS;
    this.settle();
  }

  public tick(dtMs: number): void {
    this.sinceLast += dtMs;
    if (this.charges >= this.max) {
      this.rechargeProgress = 0;
      return;
    }
    this.rechargeProgress += dtMs * this.rechargeRate;
    this.settle();
  }

  private settle(): void {
    while (this.rechargeProgress >= DASH.RECHARGE_MS && this.charges < this.max) {
      this.rechargeProgress -= DASH.RECHARGE_MS;
      this.charges += 1;
    }
    if (this.charges >= this.max) {
      this.charges = this.max;
      this.rechargeProgress = 0;
    }
  }
}
