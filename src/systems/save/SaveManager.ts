import { STARTING_INVENTORY } from '@/data/combat';
import type { GameState } from '@/systems/GameState';
import { isGameState } from '@/systems/GameState';

/** Sous-ensemble de l'API Storage du navigateur (injecté : un Map suffit en test). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveSlot = 'slot-1' | 'auto';

export interface SaveData {
  readonly savedAt: string;
  readonly state: GameState;
}

export type LoadResult =
  | { readonly ok: true; readonly data: SaveData }
  | {
      readonly ok: false;
      readonly reason: 'empty' | 'corrupted' | 'too-new' | 'storage-unavailable';
    };

/** Version courante du GameState sauvegardé. */
export const CURRENT_SAVE_VERSION = 2;

type Raw = Record<string, unknown>;

/**
 * Migrations `vN → vN+1` appliquées au chargement, dans l'ordre. Vide tant que le format n'a pas changé :
 * toute modification incompatible du GameState incrémente `version` et ajoute une entrée ici (+ test).
 */
export const MIGRATIONS: Readonly<Record<number, (state: Raw) => Raw>> = {
  /** v1 → v2 (jalon M2) : XP, collègues, inventaire de départ, Gobelets, Grains, ennemis vaincus. */
  1: (state) => ({
    ...state,
    version: 2,
    player: { ...(isRecord(state.player) ? state.player : {}), xp: 0 },
    allies: {},
    inventory: { ...STARTING_INVENTORY },
    gobelets: 0,
    gobeletsShiftIndex: null,
    coffeeBeans: 0,
    defeatedEncounters: {},
  }),
};

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Sauvegardes versionnées dans le localStorage (ARCHITECTURE § 7).
 * Aucune méthode ne lève : stockage absent, plein ou bloqué renvoie un échec que l'UI affiche.
 */
export class SaveManager {
  public constructor(
    private readonly storage: KeyValueStorage | null,
    private readonly prefix = 'privatix.save',
    private readonly now: () => Date = () => new Date(),
  ) {}

  public save(slot: SaveSlot, state: GameState): boolean {
    if (!this.storage) return false;
    const payload: SaveData = { savedAt: this.now().toISOString(), state };
    try {
      this.storage.setItem(this.key(slot), JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  public load(slot: SaveSlot): LoadResult {
    if (!this.storage) return { ok: false, reason: 'storage-unavailable' };
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.key(slot));
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
    if (version > CURRENT_SAVE_VERSION) return { ok: false, reason: 'too-new' };
    for (let v = version; v < CURRENT_SAVE_VERSION; v += 1) {
      const migrate = MIGRATIONS[v];
      if (!migrate) return { ok: false, reason: 'corrupted' };
      state = migrate(state);
    }
    return isGameState(state)
      ? { ok: true, data: { savedAt: parsed.savedAt, state } }
      : { ok: false, reason: 'corrupted' };
  }

  /** Vrai si l'emplacement contient une sauvegarde chargeable. */
  public has(slot: SaveSlot): boolean {
    return this.load(slot).ok;
  }

  /** Sauvegarde la plus récente parmi les emplacements chargeables. */
  public latest(): SaveData | null {
    const loaded = (['slot-1', 'auto'] as const)
      .map((slot) => this.load(slot))
      .flatMap((r) => (r.ok ? [r.data] : []));
    return loaded.sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] ?? null;
  }

  private key(slot: SaveSlot): string {
    return `${this.prefix}.${slot}`;
  }
}
