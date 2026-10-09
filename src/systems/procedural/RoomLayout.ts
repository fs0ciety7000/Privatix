import type { RoomTemplateId } from '@/systems/procedural/roomTemplates';
import { ROOM_TEMPLATES } from '@/systems/procedural/roomTemplates';

/** Nature d'une tuile, indépendante du tileset (Room la traduit en index de tuile). */
export type TileKind =
  | 'wall'
  | 'floor'
  | 'line'
  | 'rail'
  | 'ballast'
  | 'pillar'
  | 'bench'
  | 'door'
  /** Vide de la Passerelle : on y tombe (héros : retour au bord ; non-élites : éliminés). */
  | 'void'
  | 'glass'
  | 'escalator'
  | 'desk'
  | 'shelf'
  | 'chair'
  | 'stage'
  | 'carpet';

export interface TilePos {
  readonly tx: number;
  readonly ty: number;
}

export interface DoorSlot {
  /** Tuile gauche de la porte (2 tuiles de large) dans le mur du haut. */
  readonly tx: number;
  readonly ty: number;
  readonly width: number;
}

export type MarkKind = 'coffee' | 'stand' | 'reward' | 'npc' | 'dummy';

export interface RoomMark {
  readonly kind: MarkKind;
  readonly at: TilePos;
  /** Lettre du gabarit (identifie le PNJ). */
  readonly char: string;
}

/** Lettres des PNJ du hub. */
export const NPC_CHARS = 'MFYKNJU';

export interface RoomLayout {
  readonly id: RoomTemplateId;
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly (readonly TileKind[])[];
  readonly playerSpawn: TilePos;
  readonly bossSpawn: TilePos | null;
  readonly doors: readonly DoorSlot[];
  /** Points d'intérêt : machine à café, étals, récompense, PNJ du hub (lettre). */
  readonly marks: readonly RoomMark[];
}

const CHAR_TILE: Readonly<Record<string, TileKind>> = {
  '#': 'wall',
  '.': 'floor',
  y: 'line',
  '=': 'rail',
  '~': 'ballast',
  o: 'pillar',
  b: 'bench',
  D: 'door',
  v: 'void',
  g: 'glass',
  '/': 'escalator',
  d: 'desk',
  h: 'shelf',
  c: 'chair',
  e: 'stage',
  k: 'carpet',
};

/** Tuiles bloquantes (corps Arcade). */
export function isSolid(kind: TileKind): boolean {
  return (
    kind === 'wall' ||
    kind === 'pillar' ||
    kind === 'bench' ||
    kind === 'door' ||
    kind === 'desk' ||
    kind === 'shelf' ||
    kind === 'chair'
  );
}

/** Tuile infranchissable pour un ennemi qui marche (le vide en plus des obstacles). */
export function blocksWalker(kind: TileKind): boolean {
  return isSolid(kind) || kind === 'void';
}

/**
 * Lit un gabarit. Une rangée de mur est ajoutée au-dessus : le mur du haut fait ainsi deux tuiles,
 * la hauteur d'une façade (haut + bas) dans les tilesets.
 */
export function parseRoom(
  id: RoomTemplateId,
  template: readonly string[] = ROOM_TEMPLATES[id],
): RoomLayout {
  const width = template[0]?.length ?? 0;
  const rows = ['#'.repeat(width), ...template];
  const height = rows.length;
  let playerSpawn: TilePos | null = null;
  let bossSpawn: TilePos | null = null;
  const marks: RoomMark[] = [];
  const doors: DoorSlot[] = [];

  const tiles = rows.map((row, ty) => {
    if (row.length !== width)
      throw new Error(
        `Gabarit ${id} : ligne ${String(ty)} de largeur ${String(row.length)} ≠ ${String(width)}`,
      );
    return Array.from({ length: row.length }, (_, tx) => row.charAt(tx)).map((ch, tx): TileKind => {
      const at = { tx, ty };
      switch (ch) {
        case 'P':
          playerSpawn = at;
          return 'floor';
        case 'B':
          bossSpawn = at;
          return 'floor';
        case 'C':
          marks.push({ kind: 'coffee', at, char: ch });
          return 'floor';
        case 'S':
          marks.push({ kind: 'stand', at, char: ch });
          return 'floor';
        case 'R':
          marks.push({ kind: 'reward', at, char: ch });
          return 'floor';
        case 'T':
          marks.push({ kind: 'dummy', at, char: ch });
          return 'floor';
        default: {
          if (NPC_CHARS.includes(ch)) {
            marks.push({ kind: 'npc', at, char: ch });
            return 'floor';
          }
          const kind = CHAR_TILE[ch];
          if (!kind) throw new Error(`Gabarit ${id} : caractère inconnu « ${ch} »`);
          return kind;
        }
      }
    });
  });

  // Portes : suites horizontales de « D ».
  tiles.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx += 1) {
      if (row[tx] !== 'door' || row[tx - 1] === 'door') continue;
      let w = 0;
      while (row[tx + w] === 'door') w += 1;
      doors.push({ tx, ty, width: w });
    }
  });

  if (!playerSpawn) throw new Error(`Gabarit ${id} : pas d'arrivée « P »`);
  return { id, width, height, tiles, playerSpawn, bossSpawn, doors, marks };
}

export function tileAt(layout: RoomLayout, tx: number, ty: number): TileKind {
  return layout.tiles[ty]?.[tx] ?? 'wall';
}

/** Tuiles marchables accessibles depuis l'arrivée (remplissage). Les portes sont atteintes par la tuile en dessous. */
export function reachableFrom(layout: RoomLayout, start: TilePos): Set<string> {
  const seen = new Set<string>();
  const stack: TilePos[] = [start];
  while (stack.length > 0) {
    const p = stack.pop();
    if (!p) break;
    const key = `${String(p.tx)},${String(p.ty)}`;
    if (seen.has(key) || isSolid(tileAt(layout, p.tx, p.ty))) continue;
    seen.add(key);
    stack.push(
      { tx: p.tx + 1, ty: p.ty },
      { tx: p.tx - 1, ty: p.ty },
      { tx: p.tx, ty: p.ty + 1 },
      { tx: p.tx, ty: p.ty - 1 },
    );
  }
  return seen;
}

/** Tuiles marchables où l'on peut faire apparaître un ennemi (hors rails, loin du héros). */
export function spawnableTiles(layout: RoomLayout, from: TilePos, minTiles: number): TilePos[] {
  const reach = reachableFrom(layout, layout.playerSpawn);
  const out: TilePos[] = [];
  for (let ty = 1; ty < layout.height - 1; ty += 1) {
    for (let tx = 1; tx < layout.width - 1; tx += 1) {
      if (!reach.has(`${String(tx)},${String(ty)}`)) continue;
      if (Math.hypot(tx - from.tx, ty - from.ty) < minTiles) continue;
      // Une tuile libre tout autour : pas d'apparition collée à un mur.
      const around = [-1, 0, 1].every((dy) =>
        [-1, 0, 1].every((dx) => !blocksWalker(tileAt(layout, tx + dx, ty + dy))),
      );
      if (around) out.push({ tx, ty });
    }
  }
  return out;
}
