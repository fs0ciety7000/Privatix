/** Récompense au sol (port de `entities/Pickup.ts` sans Phaser) : la vue la dessine, le directeur l'applique. */
export type PickupKind = 'avantage' | 'gobelet' | 'tickets' | 'ps' | 'grains' | 'cornet';

export const PICKUP_LABELS: Readonly<Record<PickupKind, string>> = {
  avantage: 'Avantage acquis',
  gobelet: 'Gobelet',
  tickets: 'Tickets',
  ps: 'Points de Syndicalisme',
  grains: 'Grains de café',
  cornet: 'Cornet de frites',
};

/** Rayon de ramassage au contact (u, version Phaser). */
export const PICKUP_RADIUS = 14;

let nextPickupId = 1;

export interface PickupSim {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly kind: PickupKind;
  readonly amount: number;
  /** Étiquette affichée au-dessus (récompenses de salle). */
  readonly label: boolean;
  collected: boolean;
}

export function makePickup(
  x: number,
  y: number,
  kind: PickupKind,
  amount: number,
  label: boolean,
): PickupSim {
  return { id: nextPickupId++, x, y, kind, amount, label, collected: false };
}
