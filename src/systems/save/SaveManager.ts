/** Sous-ensemble de l'API Storage du navigateur (injecté : un Map suffit en test). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveData<T> {
  readonly savedAt: string;
  readonly state: T;
}

export type LoadResult<T> =
  | { readonly ok: true; readonly data: SaveData<T> }
  | {
      readonly ok: false;
      readonly reason: 'empty' | 'corrupted' | 'too-new' | 'storage-unavailable';
    };

type Raw = Record<string, unknown>;

export interface SaveSchema<T> {
  /** Version courante (champ `version` de l'état sauvegardé). */
  readonly version: number;
  /** Migrations `vN → vN+1`, appliquées dans l'ordre au chargement. */
  readonly migrations: Readonly<Record<number, (state: Raw) => Raw>>;
  /**
   * Nettoyage tolérant, après les migrations et avant `validate` (ex. : objets de loot inconnus
   * convertis en Ferraille plutôt que de rejeter toute la sauvegarde).
   */
  readonly sanitize?: (state: Raw) => Raw;
  readonly validate: (value: unknown) => value is T;
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Sauvegardes versionnées dans le localStorage (docs/ARCHITECTURE.md, « Sauvegarde »).
 * Aucune méthode ne lève : stockage absent, plein ou bloqué renvoie un échec que l'UI affiche.
 */
export class SaveManager<T> {
  public constructor(
    private readonly storage: KeyValueStorage | null,
    private readonly schema: SaveSchema<T>,
    private readonly key = 'privatix.meta',
    private readonly now: () => Date = () => new Date(),
  ) {}

  public save(state: T): boolean {
    if (!this.storage) return false;
    const payload: SaveData<T> = { savedAt: this.now().toISOString(), state };
    try {
      this.storage.setItem(this.key, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  public load(): LoadResult<T> {
    if (!this.storage) return { ok: false, reason: 'storage-unavailable' };
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      return { ok: false, reason: 'storage-unavailable' };
    }
    if (raw === null) return { ok: false, reason: 'empty' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'corrupted' };
    }
    if (!isRecord(parsed) || typeof parsed.savedAt !== 'string' || !isRecord(parsed.state)) {
      return { ok: false, reason: 'corrupted' };
    }

    let state: Raw = parsed.state;
    const version = state.version;
    if (typeof version !== 'number') return { ok: false, reason: 'corrupted' };
    if (version > this.schema.version) return { ok: false, reason: 'too-new' };
    for (let v = version; v < this.schema.version; v += 1) {
      const migrate = this.schema.migrations[v];
      if (!migrate) return { ok: false, reason: 'corrupted' };
      state = migrate(state);
    }
    if (this.schema.sanitize) state = this.schema.sanitize(state);
    return this.schema.validate(state)
      ? { ok: true, data: { savedAt: parsed.savedAt, state } }
      : { ok: false, reason: 'corrupted' };
  }

  public clear(): void {
    try {
      this.storage?.removeItem(this.key);
    } catch {
      // Stockage bloqué : rien à effacer.
    }
  }
}
