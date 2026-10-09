import type { ItemInstance } from '@/systems/loot/types';
import type { RunEnd } from '@/systems/loot/vestiaire';
import { settleLootRun } from '@/systems/loot/vestiaire';
import type { MetaState } from '@/systems/meta/MetaState';
import type { ShiftResult } from '@/systems/meta/RunState';
import { applyResult } from '@/systems/meta/RunState';

/**
 * Fin d'un Shift (entrée 3D, jalon J6) : tout ce qui est gardé passe dans la méta, en une fonction
 * pure que la scène appelle une fois, avant d'écrire la sauvegarde.
 *
 * 1. PS, Grains et statistiques (`applyResult`, gardés à 100 %, mort comprise) ;
 * 2. **crochet loot** : si la scène fournit la fin de Shift du loot (`RunEnd` : équipement porté,
 *    curseur, pitié, objets choisis à l'écran « Consigne »), `settleLootRun` range la consigne au
 *    Vestiaire et réforme le reste en Ferraille. Sans loot (aujourd'hui), la méta loot est intacte.
 *    Un refus du loot (consigne trop grande, Vestiaire plein) n'annule jamais les PS : on règle alors
 *    la méta sans rien garder (`keep: []`), puis, si même cela échoue, sans toucher au loot.
 */
export interface ShiftSettlement {
  readonly meta: MetaState;
  /** Objets rangés au Vestiaire (vide sans loot). */
  readonly kept: readonly ItemInstance[];
  /** Ferraille gagnée par la réforme de fin de Shift. */
  readonly ferraille: number;
  /** Raison d'un refus de la consigne demandée (l'UI peut l'afficher), sinon `null`. */
  readonly lootError: string | null;
}

export function settleShift(
  meta: MetaState,
  result: ShiftResult,
  loot: RunEnd | null = null,
): ShiftSettlement {
  const base = applyResult(meta, result);
  if (!loot) return { meta: base, kept: [], ferraille: 0, lootError: null };
  const settled = settleLootRun(base, loot);
  if (settled.ok)
    return {
      meta: settled.meta,
      kept: settled.kept,
      ferraille: settled.ferraille,
      lootError: null,
    };
  const fallback = settleLootRun(base, { ...loot, keep: [] });
  if (fallback.ok)
    return {
      meta: fallback.meta,
      kept: [],
      ferraille: fallback.ferraille,
      lootError: settled.reason,
    };
  return { meta: base, kept: [], ferraille: 0, lootError: settled.reason };
}
