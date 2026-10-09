import type { DropSource, GearStat, ItemRarity, SlotId } from '@/config/loot';
import type { FamilyId } from '@/systems/meta/Avantages';

/**
 * Types d'exécution du loot (les données statiques sont dans `src/config/loot.ts`).
 * Tout est immuable : les fonctions du système renvoient de nouveaux objets.
 */

/** Un affixe tiré : seule la qualité normalisée `q` est sauvegardée, jamais la valeur. */
export interface AffixRoll {
  readonly affixId: string;
  /** Qualité dans [0, 1], au centième. */
  readonly q: number;
  /** S15 « de Solidarité » : famille d'Avantages tirée avec l'affixe. */
  readonly family?: FamilyId;
}

export interface ItemOrigin {
  readonly source: DropSource;
  /** Numéro du Shift (compteur méta `stats.shifts` au moment du drop). */
  readonly shift: number;
  readonly room: number;
}

/** Objet tiré. Sérialisable tel quel en JSON (≈ 120 octets). */
export interface ItemInstance {
  /** `it-000123` : compteur méta, sans aléatoire. */
  readonly uid: string;
  readonly defId: string;
  readonly rarity: ItemRarity;
  /** Plafond de puissance (1 à 30) ; l'ilvl effectif dépend de la salle (`effectiveIlvl`). */
  readonly ilvl: number;
  readonly implicitQ: number;
  readonly affixes: readonly AffixRoll[];
  readonly legendaryId?: string;
  readonly setId?: string;
  readonly origin: ItemOrigin;
  /** Réaffûtages déjà faits (coût croissant chez Béné). */
  readonly rerolls: number;
  /** Cadenas du Vestiaire : protège du démontage. */
  readonly locked: boolean;
}

export type EquippedItems = Readonly<Record<SlotId, ItemInstance | null>>;

/** Équipement d'une run : 6 emplacements et le sac de service (4 cases). */
export interface GearLoadout {
  readonly equipped: EquippedItems;
  readonly bag: readonly (ItemInstance | null)[];
}

/** Compteurs de tirage propres à une run (jamais sauvegardés en méta). */
export interface LootRunState {
  /** Sac mélangé d'emplacements : on tire sans remise, on le remplit quand il est vide. */
  readonly slotBag: readonly SlotId[];
  /** Sac des Outils débloqués, tirés sans remise. */
  readonly toolBag: readonly string[];
  /** Objets d'affilée sous Homologué (Réclamation). */
  readonly sinceHomologue: number;
  /** Compteur de drops par salle : flux seedé `roomRng(seed, room, 1000 + n)`. */
  readonly dropIndexByRoom: Readonly<Record<number, number>>;
  /** Prochain uid (initialisé depuis la méta, rendu à la méta en fin de run). */
  readonly nextUid: number;
  /** Plans de Patrimoine découverts pendant la run (archivés chez Béné en fin de run). */
  readonly newPlans: readonly string[];
}

/** Protection méta contre la malchance (sauvegardée, sauf en Shift imposé). */
export interface LootPity {
  /** Ancienneté du butin : points de Patrimoine (0 à 8). */
  readonly patrimoine: number;
  readonly welcomeDone: boolean;
  /** Shift à graine saisie : la pitié méta n'est ni lue ni écrite. */
  readonly frozen: boolean;
}

/** Agrégat de stats (toutes additives). */
export type GearStats = Readonly<Record<GearStat, number>>;
