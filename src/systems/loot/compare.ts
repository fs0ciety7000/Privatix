import { HERO } from '@/config/balance';
import type { GearStat } from '@/config/loot';
import { GEAR_STATS, SETS } from '@/config/loot';
import type { DpsContext } from '@/systems/loot/power';
import { dpsEstimate, nakedDps } from '@/systems/loot/power';
import type { EquipmentModifiers, GearOptions } from '@/systems/loot/stats';
import { equipmentModifiers, GEAR_STAT_IDS, gearStats, slotOf } from '@/systems/loot/stats';
import type { EquippedItems, ItemInstance } from '@/systems/loot/types';
import { formatStat } from '@/systems/loot/values';

/** Énergie effective estimée (résumé « Tenue ») : Énergie max / multiplicateur de dégâts subis. */
export function effectiveHpEstimate(mods: EquipmentModifiers): number {
  return (HERO.MAX_ENERGY + mods.defense.maxEnergyBonus) / mods.defense.damageTakenMult;
}

/**
 * Puissance offensive de l'équipement : DPS estimé rapporté au même Outil porté sans aucun
 * équipement (les types d'Outil sont une progression horizontale). C'est la mesure du budget
 * « Équipement » (GDD § 9 bis.8) et du garde-fou `GEAR_POWER_CAP`.
 */
export function powerRatio(mods: EquipmentModifiers, ctx: DpsContext = {}): number {
  return dpsEstimate(mods, ctx) / nakedDps(mods.tool, ctx);
}

export type DeltaDirection = 'up' | 'down' | 'same';

/** Ligne de la carte de comparaison : ▲ (mieux), ▼ (moins bien), = (identique). */
export interface StatDelta {
  readonly stat: GearStat | 'calibre';
  readonly label: string;
  readonly current: number;
  readonly candidate: number;
  readonly delta: number;
  readonly direction: DeltaDirection;
  /** « +3 % », pour l'UI. */
  readonly text: string;
  readonly arrow: '▲' | '▼' | '=';
}

function direction(delta: number, better: 'higher' | 'lower'): DeltaDirection {
  if (Math.abs(delta) < 1e-9) return 'same';
  return delta > 0 === (better === 'higher') ? 'up' : 'down';
}

const ARROWS: Readonly<Record<DeltaDirection, '▲' | '▼' | '='>> = { up: '▲', down: '▼', same: '=' };

/**
 * Deltas stat par stat entre un objet candidat et l'objet actuellement porté au même emplacement
 * (`null` : emplacement vide). Les valeurs sont prises à l'ilvl effectif en salle `opts.r`.
 */
export function compareItems(
  candidate: ItemInstance,
  current: ItemInstance | null,
  opts: GearOptions = {},
): StatDelta[] {
  const a = gearStats([candidate], opts);
  const b = gearStats(current ? [current] : [], opts);
  const out: StatDelta[] = [];
  if (slotOf(candidate) === 'outil') {
    const delta = Number((a.calibre - b.calibre).toFixed(4));
    const dir = direction(delta, 'higher');
    out.push({
      stat: 'calibre',
      label: 'Calibre',
      current: b.calibre,
      candidate: a.calibre,
      delta,
      direction: dir,
      text: `×${String(a.calibre).replace('.', ',')}`,
      arrow: ARROWS[dir],
    });
  }
  for (const k of GEAR_STAT_IDS) {
    const cand = a.raw[k];
    const cur = b.raw[k];
    if (cand === 0 && cur === 0) continue;
    const delta = Number((cand - cur).toFixed(6));
    const dir = direction(delta, GEAR_STATS[k].better);
    out.push({
      stat: k,
      label: GEAR_STATS[k].label,
      current: cur,
      candidate: cand,
      delta,
      direction: dir,
      text: formatStat(k, delta),
      arrow: ARROWS[dir],
    });
  }
  return out;
}

export interface LoadoutComparison {
  readonly deltas: readonly StatDelta[];
  /** « Frappe ≈ +6 % » : variation relative du DPS estimé. */
  readonly frappe: number;
  /** « Tenue ≈ −3 % » : variation relative de l'Énergie effective. */
  readonly tenue: number;
  /** Progression d'Attelage du candidat (« 2/4 »), si c'en est une pièce. */
  readonly setProgress?: { readonly setId: string; readonly count: number; readonly total: number };
}

/** Carte de comparaison complète : deltas, résumés « Frappe » et « Tenue », progression d'Attelage. */
export function compareInLoadout(
  equipped: EquippedItems,
  candidate: ItemInstance,
  opts: GearOptions = {},
): LoadoutComparison {
  const slot = slotOf(candidate);
  if (!slot) return { deltas: [], frappe: 0, tenue: 0 };
  const current = equipped[slot];
  const after: EquippedItems = { ...equipped, [slot]: candidate };
  const before = equipmentModifiers(equipped, opts);
  const next = equipmentModifiers(after, opts);
  const set = candidate.setId ? SETS.find((s) => s.id === candidate.setId) : undefined;
  const progress = set ? next.sets.find((s) => s.setId === set.id) : undefined;
  return {
    deltas: compareItems(candidate, current, opts),
    frappe: dpsEstimate(next) / dpsEstimate(before) - 1,
    tenue: effectiveHpEstimate(next) / effectiveHpEstimate(before) - 1,
    ...(set && progress
      ? { setProgress: { setId: set.id, count: progress.count, total: set.pieces.length } }
      : {}),
  };
}
