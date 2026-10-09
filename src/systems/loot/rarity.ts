import type { ShiftId } from '@/config/balance';
import type { DropSource, ItemRarity } from '@/config/loot';
import { FIXED_RARITY_SOURCES, LOOT_RULES, RARITY_ORDER, RARITY_WEIGHTS } from '@/config/loot';
import type { Rng } from '@/utils/rng';

export type RarityWeightTable = Record<ItemRarity, number>;

/** Contexte des décalages de rareté (§ 5.3). */
export interface RarityContext {
  /** Indice de salle `r`. */
  readonly r: number;
  readonly shift: ShiftId;
  /** Points du Plan d'Économies (0 à 28). */
  readonly planPoints?: number;
  /** Ancienneté du butin (points de Patrimoine, 0 à 8). 0 si la pitié est gelée. */
  readonly pityPatrimoine?: number;
  /** Réclamation : objets d'affilée sous Homologué. */
  readonly sinceHomologue?: number;
  /** Rareté minimale imposée (porte Dotation annoncée, Salle gardée…). */
  readonly minRarity?: ItemRarity;
}

export function rarityRank(rarity: ItemRarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function atLeast(rarity: ItemRarity, min: ItemRarity): boolean {
  return rarityRank(rarity) >= rarityRank(min);
}

/** Déplace `points` vers `to`, pris sur la rareté la plus basse encore disponible. */
function shiftWeight(w: RarityWeightTable, to: ItemRarity, points: number): void {
  let left = points;
  for (const from of RARITY_ORDER) {
    if (left <= 0 || rarityRank(from) >= rarityRank(to)) break;
    const take = Math.min(w[from], left);
    w[from] -= take;
    w[to] += take;
    left -= take;
  }
}

/** Ramène le Patrimoine à `cap` × total, en rendant l'excédent à la rareté disponible la plus basse. */
function capPatrimoine(w: RarityWeightTable, cap: number): void {
  const total = RARITY_ORDER.reduce((s, k) => s + w[k], 0);
  const max = total * cap;
  if (w.patrimoine <= max) return;
  const excess = w.patrimoine - max;
  w.patrimoine = max;
  const target = RARITY_ORDER.find((k) => k !== 'patrimoine' && w[k] > 0) ?? 'hors-serie';
  w[target] += excess;
}

/**
 * Poids de rareté d'un drop, en points (total 100) : table de la source, puis avancement (r),
 * Nuit, Plan d'Économies, plafond Patrimoine à 6 %, Ancienneté du butin, Réclamation et
 * rareté minimale. Les sources garanties (1er kill de boss, Friterie, Wagon-Bar) ne bougent pas.
 */
export function rarityWeights(source: DropSource, ctx: RarityContext): RarityWeightTable {
  const w: RarityWeightTable = { ...RARITY_WEIGHTS[source] };
  if (!FIXED_RARITY_SOURCES.includes(source)) {
    const steps = Math.max(0, ctx.r - 1);
    for (const [to, per] of Object.entries(LOOT_RULES.SHIFT_PER_ROOM) as [ItemRarity, number][]) {
      shiftWeight(w, to, per * steps);
    }
    if (ctx.shift === 'nuit') {
      for (const [to, pts] of Object.entries(LOOT_RULES.SHIFT_NIGHT) as [ItemRarity, number][]) {
        shiftWeight(w, to, pts);
      }
    }
    const plan = Math.min(LOOT_RULES.PLAN_MAX_POINTS, Math.max(0, ctx.planPoints ?? 0));
    shiftWeight(w, 'hors-serie', plan * LOOT_RULES.PLAN_HORS_SERIE_PER_POINT);
    capPatrimoine(w, LOOT_RULES.PATRIMOINE_CAP);
    // La pitié passe au-dessus du plafond (§ 5.3).
    shiftWeight(w, 'patrimoine', Math.min(LOOT_RULES.PITY_CAP, ctx.pityPatrimoine ?? 0));
  }
  let min: ItemRarity | undefined = ctx.minRarity;
  if ((ctx.sinceHomologue ?? 0) >= LOOT_RULES.RECLAMATION_AFTER) {
    min = min && atLeast(min, 'homologue') ? min : 'homologue';
  }
  if (min) applyMinRarity(w, min);
  return w;
}

/** Retire les raretés sous `min` ; si rien ne reste, la rareté minimale est certaine. */
export function applyMinRarity(w: RarityWeightTable, min: ItemRarity): void {
  for (const k of RARITY_ORDER) if (rarityRank(k) < rarityRank(min)) w[k] = 0;
  if (RARITY_ORDER.every((k) => w[k] <= 0)) w[min] = 1;
}

/** Tirage pondéré d'une rareté. */
export function pickRarity(rng: Rng, w: RarityWeightTable): ItemRarity {
  const total = RARITY_ORDER.reduce((s, k) => s + w[k], 0);
  let roll = rng() * total;
  for (const k of RARITY_ORDER) {
    if (w[k] <= 0) continue;
    roll -= w[k];
    if (roll < 0) return k;
  }
  return [...RARITY_ORDER].reverse().find((k) => w[k] > 0) ?? 'reforme';
}
