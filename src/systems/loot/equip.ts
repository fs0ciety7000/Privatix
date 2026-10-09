import { ITEM_RARITIES, LOOT_RULES, SCRAP, SLOTS } from '@/config/loot';
import type { SlotId } from '@/config/loot';
import { slotOf } from '@/systems/loot/stats';
import type { EquippedItems, GearLoadout, ItemInstance } from '@/systems/loot/types';

/** Équipement vide : 6 emplacements libres et sac de 4 cases vides. */
export function emptyLoadout(): GearLoadout {
  const equipped = Object.fromEntries(SLOTS.map((s) => [s, null])) as Record<
    SlotId,
    ItemInstance | null
  >;
  return { equipped, bag: Array.from({ length: LOOT_RULES.BAG_SIZE }, () => null) };
}

/** Tous les objets d'un équipement (équipés puis sac). */
export function loadoutItems(loadout: GearLoadout): ItemInstance[] {
  return [...SLOTS.map((s) => loadout.equipped[s]), ...loadout.bag].filter(
    (i): i is ItemInstance => i !== null,
  );
}

export interface EquipResult {
  readonly loadout: GearLoadout;
  /** Objet remplacé qui n'a pas trouvé de place au sac : il tombe au sol. */
  readonly dropped: ItemInstance | null;
}

function withBag(loadout: GearLoadout, bag: readonly (ItemInstance | null)[]): GearLoadout {
  return { ...loadout, bag };
}

/** Range un objet dans la première case libre du sac (`null` si le sac est plein). */
export function stash(loadout: GearLoadout, item: ItemInstance): GearLoadout | null {
  const i = loadout.bag.indexOf(null);
  if (i < 0) return null;
  const bag = [...loadout.bag];
  bag[i] = item;
  return withBag(loadout, bag);
}

/**
 * Équipe un objet ramassé : l'ancien objet de l'emplacement va au sac, ou au sol si le sac est
 * plein. L'objet déplacé n'est jamais perdu.
 */
export function equip(loadout: GearLoadout, item: ItemInstance): EquipResult {
  const slot = slotOf(item);
  if (!slot) return { loadout, dropped: item };
  const previous = loadout.equipped[slot];
  const equipped: EquippedItems = { ...loadout.equipped, [slot]: item };
  const next: GearLoadout = { ...loadout, equipped };
  if (!previous) return { loadout: next, dropped: null };
  const stashed = stash(next, previous);
  return stashed ? { loadout: stashed, dropped: null } : { loadout: next, dropped: previous };
}

/** Équipe l'objet de la case `index` du sac ; l'objet remplacé prend sa case. */
export function equipFromBag(loadout: GearLoadout, index: number): GearLoadout {
  const item = loadout.bag[index];
  if (!item) return loadout;
  const slot = slotOf(item);
  if (!slot) return loadout;
  const bag = [...loadout.bag];
  bag[index] = loadout.equipped[slot];
  return { equipped: { ...loadout.equipped, [slot]: item }, bag };
}

/** Retire l'objet de la case `index` du sac (à démonter ou à poser au sol). */
export function takeFromBag(
  loadout: GearLoadout,
  index: number,
): { loadout: GearLoadout; item: ItemInstance | null } {
  const item = loadout.bag[index] ?? null;
  if (!item) return { loadout, item: null };
  const bag = [...loadout.bag];
  bag[index] = null;
  return { loadout: withBag(loadout, bag), item };
}

/** Retire un objet équipé par emplacement. */
export function unequip(
  loadout: GearLoadout,
  slot: SlotId,
): { loadout: GearLoadout; item: ItemInstance | null } {
  const item = loadout.equipped[slot];
  if (!item) return { loadout, item: null };
  return { loadout: { ...loadout, equipped: { ...loadout.equipped, [slot]: null } }, item };
}

/**
 * Ferraille rendue par le démontage (§ 5.5) : Réforme 1, Réglementaire 3, Homologué 6,
 * Hors-série 15, Patrimoine 40, +floor(ilvl / 10). Objet laissé au sol : 50 % (arrondi bas).
 */
export function scrapValue(item: Pick<ItemInstance, 'rarity' | 'ilvl'>, ground = false): number {
  const full = ITEM_RARITIES[item.rarity].scrap + Math.floor(item.ilvl / SCRAP.ILVL_DIVISOR);
  return ground ? Math.floor(full * SCRAP.GROUND_RATIO) : full;
}
