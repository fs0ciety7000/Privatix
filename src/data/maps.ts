import type { MapDefinition, MapId } from '@/data/types';

/**
 * Cartes placeholder de l'Acte I (ASCII). Légende des terrains : `TERRAIN_CHARS` dans `src/data/types.ts`.
 * STUB : remplacé par le contenu de l'Acte I.
 */
export const MAPS = {
  'gare-mons': {
    id: 'gare-mons',
    name: 'Gare de Mons',
    theme: 'sncb',
    floor: 'platform',
    rows: ['#####', '#S_E#', '#####'],
    markers: {
      S: { kind: 'spawn', id: 'depart' },
      E: { kind: 'portal', to: 'occ', spawn: 'entree' },
    },
    onEnter: [{ when: { flags: { 'intro-vue': false } }, dialogue: 'intro' }],
  },
  'gare-salle-pauses': {
    id: 'gare-salle-pauses',
    name: 'Salle des pauses',
    theme: 'sncb',
    floor: 'floor',
    rows: ['####', '#S.#', '####'],
    markers: { S: { kind: 'spawn', id: 'porte' } },
  },
  'gare-couloir-technique': {
    id: 'gare-couloir-technique',
    name: 'Couloir technique',
    theme: 'sncb',
    floor: 'floor',
    rows: ['####', '#S.#', '####'],
    markers: { S: { kind: 'spawn', id: 'porte' } },
  },
  occ: {
    id: 'occ',
    name: 'OCC — Operation Coffee Center',
    theme: 'occ',
    floor: 'occ-floor',
    rows: ['%%%%%', '%S+X%', '%%%%%'],
    markers: {
      S: { kind: 'spawn', id: 'entree' },
      X: { kind: 'portal', to: 'gare-mons', spawn: 'depart' },
    },
  },
} satisfies Record<MapId, MapDefinition>;
