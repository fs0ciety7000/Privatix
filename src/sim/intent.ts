/**
 * Ce que les commandes demandent au héros pour un pas de simulation (clavier, souris, manette ou
 * tactile). Même forme que `PlayerIntent` de `entities/Player.ts` (version Phaser) : les deux seront
 * fusionnés à la bascule, celle-ci faisant foi.
 */
export interface PlayerIntent {
  /** Direction de déplacement (norme ≤ 1), axes logiques (x droite, y bas). */
  readonly moveX: number;
  readonly moveY: number;
  /** Angle de visée logique (atan2(dy, dx)). */
  readonly aim: number;
  readonly attack: boolean;
  readonly dash: boolean;
  readonly special: boolean;
  readonly coffee: boolean;
  readonly specialHeld: boolean;
  /** Interagir (machine à café, étal, socle) : appui. */
  readonly interact?: boolean;
}

export const NO_INTENT: PlayerIntent = {
  moveX: 0,
  moveY: 0,
  aim: Math.PI / 2,
  attack: false,
  dash: false,
  special: false,
  coffee: false,
  specialHeld: false,
};

/** Fusionne une nouvelle intention dans celle en attente : les appuis s'additionnent jusqu'au pas suivant. */
export function mergeIntent(pending: PlayerIntent, next: PlayerIntent): PlayerIntent {
  return {
    moveX: next.moveX,
    moveY: next.moveY,
    aim: next.aim,
    specialHeld: next.specialHeld,
    attack: pending.attack || next.attack,
    dash: pending.dash || next.dash,
    special: pending.special || next.special,
    coffee: pending.coffee || next.coffee,
    interact: (pending.interact ?? false) || (next.interact ?? false),
  };
}

/** L'intention après consommation par un pas : on garde les axes, on retire les appuis. */
export function releaseEdges(i: PlayerIntent): PlayerIntent {
  return { ...i, attack: false, dash: false, special: false, coffee: false, interact: false };
}
