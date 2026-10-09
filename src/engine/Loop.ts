/**
 * Boucle d'animation du navigateur (requestAnimationFrame) : mesure le temps réel de chaque frame et
 * le transmet à la scène, qui fait avancer la simulation à pas fixe (`sim/clock/FixedClock`) puis
 * dessine. Pause automatique quand l'onglet est masqué.
 */
export class Loop {
  private last = 0;
  private handle = 0;
  private running = false;

  public constructor(
    private readonly onFrame: (realMs: number) => void,
    private readonly onVisibility?: (hidden: boolean) => void,
  ) {}

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    document.addEventListener('visibilitychange', this.visibility);
    this.handle = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
    document.removeEventListener('visibilitychange', this.visibility);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    const real = Math.max(0, now - this.last);
    this.last = now;
    this.onFrame(real);
    this.handle = requestAnimationFrame(this.tick);
  };

  private readonly visibility = (): void => {
    this.last = performance.now();
    this.onVisibility?.(document.hidden);
  };
}
