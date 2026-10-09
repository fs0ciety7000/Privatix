import type { ShiftId } from '@/config/balance';
import type { DropSource, TierIndex } from '@/config/loot';
import { ILVL_SHIFT_BONUS, ILVL_SOURCE_BONUS, LOOT_RULES } from '@/config/loot';

/** Borne un ilvl dans [1, 30]. */
export function clampIlvl(ilvl: number): number {
  const v = Number.isFinite(ilvl) ? Math.round(ilvl) : LOOT_RULES.ILVL_MIN;
  return Math.max(LOOT_RULES.ILVL_MIN, Math.min(LOOT_RULES.ILVL_MAX, v));
}

/**
 * Item level d'un drop (§ 5.1) : `clamp(r + B_source + B_roulement, 1, 30)`.
 * @param r indice de salle (GDD § 3.2), pas le numéro de porte.
 */
export function itemLevel(r: number, source: DropSource, shift: ShiftId): number {
  return clampIlvl(r + ILVL_SOURCE_BONUS[source] + ILVL_SHIFT_BONUS[shift]);
}

/** Palier d'affixes : I (1–9), II (10–18), III (19–30). */
export function tierOf(ilvl: number): TierIndex {
  const [, two, three] = LOOT_RULES.TIER_FROM;
  if (ilvl >= three) return 2;
  if (ilvl >= two) return 1;
  return 0;
}

/**
 * Ilvl effectif d'un objet en salle `r` : `min(ilvl, r + 3)`. C'est le garde-fou principal
 * contre le power creep : un objet du Vestiaire « monte en grade » avec la salle.
 * `r` absent ou infini : pas de plafond (écran du Vestiaire, valeurs nominales).
 */
export function effectiveIlvl(ilvl: number, r = Number.POSITIVE_INFINITY): number {
  return clampIlvl(Math.min(ilvl, r + LOOT_RULES.EFFECTIVE_ILVL_SLACK));
}
