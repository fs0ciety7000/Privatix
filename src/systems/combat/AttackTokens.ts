/**
 * Jetons d'attaque partagés : au plus N ennemis de mêlée et N tireurs attaquent en même temps,
 * ce qui garde les mêlées lisibles (GDD « Règles communes »).
 */
export type TokenKind = 'melee' | 'ranged';

export class AttackTokens {
  private readonly holders: Record<TokenKind, Set<number>> = {
    melee: new Set(),
    ranged: new Set(),
  };

  public constructor(private readonly limits: Readonly<Record<TokenKind, number>>) {}

  public tryTake(kind: TokenKind, id: number): boolean {
    const set = this.holders[kind];
    if (set.has(id)) return true;
    if (set.size >= this.limits[kind]) return false;
    set.add(id);
    return true;
  }

  public release(id: number): void {
    this.holders.melee.delete(id);
    this.holders.ranged.delete(id);
  }

  public held(kind: TokenKind): number {
    return this.holders[kind].size;
  }

  public clear(): void {
    this.holders.melee.clear();
    this.holders.ranged.clear();
  }
}
