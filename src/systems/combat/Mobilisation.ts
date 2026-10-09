import { MOBILISATION } from '@/config/balance';
import { clamp } from '@/utils/math';

/** Jauge de Mobilisation (0–100) qui alimente le Coup de sifflet (50) et le Préavis de grève (100). */
export class Mobilisation {
  private v: number;
  private damageCarry = 0;

  public constructor(initial = 0) {
    this.v = clamp(initial, 0, MOBILISATION.MAX);
  }

  public get value(): number {
    return this.v;
  }

  public add(points: number): void {
    this.v = clamp(this.v + points, 0, MOBILISATION.MAX);
  }

  /** +1 par tranche de 4 dégâts infligés (le reste est conservé). */
  public onDamageDealt(amount: number): void {
    this.damageCarry += amount;
    const points = Math.floor(this.damageCarry / MOBILISATION.DAMAGE_PER_POINT);
    this.damageCarry -= points * MOBILISATION.DAMAGE_PER_POINT;
    this.add(points);
  }

  public canSpend(cost: number): boolean {
    return this.v >= cost;
  }

  public spend(cost: number): boolean {
    if (!this.canSpend(cost)) return false;
    this.v -= cost;
    return true;
  }
}
