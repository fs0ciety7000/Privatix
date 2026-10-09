/**
 * Machine à états finis typée par charge utile (docs/ARCHITECTURE.md, « StateMachine »).
 * `M` associe chaque nom d'état à la charge utile reçue en y entrant ; une transition est donc
 * `{ to: 'attack', payload: { combo: 2 } }` et le compilateur refuse une charge utile mal formée.
 * Pure : aucun import Phaser, testable en Node.
 */

export type StateKey<M> = Extract<keyof M, string>;

export type Transition<M> = {
  [K in StateKey<M>]: { readonly to: K; readonly payload: M[K] };
}[StateKey<M>];

export interface StateDef<TCtx, M, K extends StateKey<M>> {
  /** Refuse l'entrée (ex. dash sans charge) : la transition est ignorée. */
  canEnter?(ctx: TCtx, from: StateKey<M>): boolean;
  enter?(ctx: TCtx, payload: M[K], from: StateKey<M> | null): void;
  /** Appelé à chaque frame ; renvoie une transition ou `null` pour rester. */
  update?(ctx: TCtx, dtMs: number, elapsedMs: number): Transition<M> | null;
  exit?(ctx: TCtx, to: StateKey<M>): void;
}

export type StateTable<TCtx, M> = { readonly [K in StateKey<M>]: StateDef<TCtx, M, K> };

/** Nombre maximal de transitions enchaînées dans une même frame (garde-fou contre les boucles). */
const MAX_CHAINED = 8;

export class StateMachine<TCtx, M extends object> {
  private state: StateKey<M> | null = null;
  private elapsed = 0;
  private transitioning = false;
  private readonly queue: Transition<M>[] = [];

  public constructor(
    private readonly ctx: TCtx,
    private readonly table: StateTable<TCtx, M>,
    private readonly onChange?: (from: StateKey<M> | null, to: StateKey<M>) => void,
  ) {}

  public get current(): StateKey<M> {
    if (this.state === null) throw new Error('StateMachine non démarrée (start() oublié)');
    return this.state;
  }

  /** Temps passé dans l'état courant (ms de jeu). */
  public get timeInState(): number {
    return this.elapsed;
  }

  public is(...keys: readonly StateKey<M>[]): boolean {
    return this.state !== null && keys.includes(this.state);
  }

  public start(initial: Transition<M>): void {
    this.state = null;
    this.queue.length = 0;
    this.request(initial);
  }

  /**
   * Demande une transition. Renvoie `false` si `canEnter` la refuse.
   * Une demande faite pendant un `enter`/`exit` est mise en file et appliquée juste après.
   */
  public request(t: Transition<M>): boolean {
    if (this.transitioning) {
      this.queue.push(t);
      return true;
    }
    const applied = this.apply(t);
    for (let i = 0; i < MAX_CHAINED && this.queue.length > 0; i += 1) {
      const next = this.queue.shift();
      if (next) this.apply(next);
    }
    this.queue.length = 0;
    return applied;
  }

  public update(dtMs: number): void {
    if (this.state === null) return;
    this.elapsed += dtMs;
    const def = this.table[this.state] as StateDef<TCtx, M, StateKey<M>>;
    const next = def.update?.(this.ctx, dtMs, this.elapsed) ?? null;
    if (next) this.request(next);
  }

  private apply(t: Transition<M>): boolean {
    const from = this.state;
    const nextDef = this.table[t.to] as StateDef<TCtx, M, StateKey<M>>;
    if (from !== null && nextDef.canEnter && !nextDef.canEnter(this.ctx, from)) return false;
    this.transitioning = true;
    try {
      if (from !== null)
        (this.table[from] as StateDef<TCtx, M, StateKey<M>>).exit?.(this.ctx, t.to);
      this.state = t.to;
      this.elapsed = 0;
      nextDef.enter?.(this.ctx, t.payload, from);
    } finally {
      this.transitioning = false;
    }
    this.onChange?.(from, t.to);
    return true;
  }
}
