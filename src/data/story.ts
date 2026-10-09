import type { MapId } from '@/data/types';

/** Point de départ d'une nouvelle partie : quai 2, 4h47 (STORY_AND_LORE D1). */
export const NEW_GAME_START: { readonly map: MapId; readonly spawn: string } = {
  map: 'gare-mons',
  spawn: 'depart',
};

/** Point de retour en cas de Mise à pied (GDD § 5.8) : l'OCC si elle est connue, sinon le départ. */
export const LAYOFF_RETURN: { readonly map: MapId; readonly spawn: string } = {
  map: 'occ',
  spawn: 'entree',
};

/** Arrivée dans l'OCC après le bon code au distributeur. */
export const OCC_ENTRANCE: { readonly map: MapId; readonly spawn: string } = {
  map: 'occ',
  spawn: 'entree',
};

/** Boutons du distributeur « HORS SERVICE ». */
export type VendingButton = 'expresso' | 'lungo' | 'sucre';

/** Code de l'OCC (Acte I et II) : 7 × Expresso, 1 × Lungo, 2 × Sucre + (STORY_AND_LORE § 5.2). */
export const OCC_CODE: Readonly<Record<VendingButton, number>> = {
  expresso: 7,
  lungo: 1,
  sucre: 2,
};

/** Prénoms proposés au début (le héros ou l'héroïne). */
export const HERO_NAMES = ['Léon', 'Léa'] as const;
