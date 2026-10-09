/**
 * Échelle du temps de jeu (extraite de `fx/GameFeel.ts`, en pur) : hitstop, ralenti et retour en
 * douceur. Les durées sont en temps réel ; `advance` renvoie le delta de jeu de la frame, nul pendant le
 * hitstop ou la pause.
 */
export class TimeControl {
  private hitstopLeft = 0;
  private slowScale = 1;
  private slowLeft = 0;
  private slowEase = 0;
  private easeLeft = 0;
  private easeTotal = 0;
  private easeFrom = 1;
  /** Pause du jeu (menu, onglet masqué) : aucun temps de jeu ne passe. */
  public paused = false;

  /** Vrai pendant un hitstop ou une pause : la simulation ne doit pas avancer. */
  public get frozen(): boolean {
    return this.paused || this.hitstopLeft > 0;
  }

  /** Échelle courante (0 gelé, 1 normal, 0,25 au ralenti). */
  public get scale(): number {
    return this.frozen ? 0 : this.slowScale;
  }

  /** Gel de l'action. Les hitstops se combinent au maximum, jamais en somme. */
  public hitstop(ms: number): void {
    if (ms <= 0) return;
    this.hitstopLeft = Math.max(this.hitstopLeft, ms);
  }

  /** Ralenti : `scale` (0..1) pendant `ms` (temps réel), puis retour à 1 en `easeMs`. */
  public slowmo(scale: number, ms: number, easeMs = 0): void {
    this.slowLeft = Math.max(this.slowLeft, ms);
    this.slowEase = easeMs;
    this.easeLeft = 0;
    this.slowScale = Math.min(this.slowScale, scale);
  }

  /** Fait passer `realMs` de temps réel et renvoie le temps de jeu correspondant (ms). */
  public advance(realMs: number): number {
    if (this.paused) return 0;
    if (this.hitstopLeft > 0) {
      this.hitstopLeft = Math.max(0, this.hitstopLeft - realMs);
      return 0;
    }
    if (this.slowLeft > 0) {
      this.slowLeft = Math.max(0, this.slowLeft - realMs);
      if (this.slowLeft === 0) {
        this.easeTotal = this.slowEase;
        this.easeLeft = this.slowEase;
        this.easeFrom = this.slowScale;
        if (this.easeTotal <= 0) this.slowScale = 1;
      }
    } else if (this.easeLeft > 0) {
      this.easeLeft = Math.max(0, this.easeLeft - realMs);
      const p = 1 - this.easeLeft / this.easeTotal;
      this.slowScale = this.easeFrom + (1 - this.easeFrom) * Math.sin((p * Math.PI) / 2);
    }
    return realMs * this.slowScale;
  }

  public reset(): void {
    this.hitstopLeft = 0;
    this.slowScale = 1;
    this.slowLeft = 0;
    this.easeLeft = 0;
    this.paused = false;
  }
}
