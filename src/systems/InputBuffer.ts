/**
 * Tampon d'entrées (150 ms) : une action pressée un peu trop tôt (pendant la recovery d'un coup)
 * est consommée dès que l'état la permet. Pur, horloge injectée.
 */
export class InputBuffer<A extends string> {
  private readonly pressedAt = new Map<A, number>();

  public constructor(private readonly windowMs: number) {}

  public press(action: A, now: number): void {
    this.pressedAt.set(action, now);
  }

  /** Vrai si l'action a été pressée dans la fenêtre. */
  public peek(action: A, now: number): boolean {
    const at = this.pressedAt.get(action);
    return at !== undefined && now - at <= this.windowMs;
  }

  /** Comme `peek`, mais retire l'action si elle est présente. */
  public consume(action: A, now: number): boolean {
    const ok = this.peek(action, now);
    this.pressedAt.delete(action);
    return ok;
  }

  public clear(): void {
    this.pressedAt.clear();
  }
}
