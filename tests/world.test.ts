import { describe, expect, it } from 'vitest';
import type { MapDefinition } from '@/data/types';
import { facingTile, step } from '@/systems/movement/GridMovement';
import { evaluateCondition, firstMatching } from '@/systems/story/Conditions';
import {
  buildWorldMap,
  findSpawn,
  interactableAt,
  isBlocked,
  reachableTiles,
  stepMarkerAt,
  terrainAt,
} from '@/systems/world/WorldMap';

const DEF: MapDefinition = {
  id: 'gare-mons',
  name: 'Test',
  theme: 'sncb',
  floor: 'platform',
  rows: ['#######', '#S_N_P#', '#_=#_C#', '#__G_T#', '#######'],
  markers: {
    S: { kind: 'spawn', id: 'depart', facing: 'right' },
    P: { kind: 'portal', to: 'occ', spawn: 'entree' },
    N: {
      kind: 'npc',
      character: 'rudy',
      interactions: [{ dialogue: 'a' }],
      visibleWhen: { flags: { 'intro-vue': false } },
    },
    C: {
      kind: 'prop',
      id: 'ecran',
      label: 'Écran',
      blocking: true,
      interactions: [{ dialogue: 'b' }],
    },
    G: {
      kind: 'prop',
      id: 'grille',
      label: 'Grille',
      blocking: false,
      interactions: [{ dialogue: 'c' }],
    },
    T: { kind: 'trigger', interactions: [{ dialogue: 'd' }] },
  },
};

const start = { flags: {}, act: 1 } as const;
const later = { flags: { 'intro-vue': true }, act: 1 } as const;

describe('Conditions', () => {
  it('compare les drapeaux (absent = faux) et l’acte', () => {
    expect(evaluateCondition(undefined, start)).toBe(true);
    expect(evaluateCondition({ flags: { 'intro-vue': false } }, start)).toBe(true);
    expect(evaluateCondition({ flags: { 'intro-vue': true } }, start)).toBe(false);
    expect(evaluateCondition({ flags: { 'intro-vue': true } }, later)).toBe(true);
    expect(evaluateCondition({ act: 2 }, start)).toBe(false);
  });

  it('prend la première interaction dont la condition est vraie', () => {
    const list = [
      { when: { flags: { 'intro-vue': true } }, dialogue: 'apres' },
      { dialogue: 'defaut' },
    ];
    expect(firstMatching(list, start)?.dialogue).toBe('defaut');
    expect(firstMatching(list, later)?.dialogue).toBe('apres');
    expect(firstMatching([], start)).toBeNull();
  });
});

describe('GridMovement', () => {
  const free = (): boolean => false;
  const wall = (): boolean => true;

  it('avance d’une case quand la voie est libre', () => {
    expect(step({ tileX: 2, tileY: 2, facing: 'down' }, 'right', free)).toEqual({
      tileX: 3,
      tileY: 2,
      facing: 'right',
    });
  });

  it('se tourne sans avancer contre un obstacle', () => {
    expect(step({ tileX: 2, tileY: 2, facing: 'down' }, 'up', wall)).toEqual({
      tileX: 2,
      tileY: 2,
      facing: 'up',
    });
  });

  it('vise la case en face', () => {
    expect(facingTile({ tileX: 2, tileY: 2, facing: 'left' })).toEqual({ tileX: 1, tileY: 2 });
  });
});

describe('WorldMap', () => {
  const map = buildWorldMap(DEF);

  it('lit la grille, les terrains et pose le sol sous les marqueurs', () => {
    expect(map.width).toBe(7);
    expect(map.height).toBe(5);
    expect(terrainAt(map, 2, 2)).toBe('track');
    expect(terrainAt(map, 1, 1)).toBe('platform');
    expect(terrainAt(map, 99, 99)).toBe('void');
  });

  it('refuse les lignes de longueurs différentes et les caractères inconnus', () => {
    expect(() => buildWorldMap({ ...DEF, rows: ['###', '##'] })).toThrow(/ligne 1/);
    expect(() => buildWorldMap({ ...DEF, rows: ['#Z#'] })).toThrow(/inconnu/);
  });

  it('trouve un point d’arrivée et son orientation', () => {
    expect(findSpawn(map, 'depart')).toEqual({ tileX: 1, tileY: 1, facing: 'right' });
    expect(findSpawn(map, 'absent')).toBeNull();
  });

  it('bloque terrains, PNJ visibles et objets bloquants', () => {
    expect(isBlocked(map, 0, 0, start)).toBe(true); // mur
    expect(isBlocked(map, 2, 2, start)).toBe(true); // voie
    expect(isBlocked(map, 3, 1, start)).toBe(true); // PNJ visible
    expect(isBlocked(map, 3, 1, later)).toBe(false); // PNJ caché
    expect(isBlocked(map, 5, 2, start)).toBe(true); // objet bloquant
    expect(isBlocked(map, 3, 3, start)).toBe(false); // objet non bloquant
    expect(isBlocked(map, 5, 3, start)).toBe(false); // déclencheur
  });

  it('trouve ce qu’on peut utiliser et ce qui se déclenche en marchant', () => {
    expect(interactableAt(map, 3, 1, start)?.char).toBe('N');
    expect(interactableAt(map, 3, 1, later)).toBeNull();
    expect(interactableAt(map, 5, 2, start)?.char).toBe('C');
    expect(stepMarkerAt(map, 5, 1)?.def.kind).toBe('portal');
    expect(stepMarkerAt(map, 5, 3)?.def.kind).toBe('trigger');
    expect(stepMarkerAt(map, 1, 1)).toBeNull();
  });

  it('calcule les cases accessibles en tenant compte des PNJ', () => {
    // Couloir d'une case : Rudy bloque l'accès au portail tant qu'il est visible.
    const corridor = buildWorldMap({ ...DEF, rows: ['#####', '#SNP#', '#####'] });
    expect(reachableTiles(corridor, 1, 1, start).has('3,1')).toBe(false);
    expect(reachableTiles(corridor, 1, 1, later).has('3,1')).toBe(true);
    expect(reachableTiles(map, 1, 1, start).has('5,1')).toBe(true); // détour par le bas sur la grande carte
  });
});
