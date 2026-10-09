import { BLOCKING_TERRAINS, TERRAIN_CHARS } from '@/data/types';
import type { Facing, MapDefinition, MarkerDef, TerrainId } from '@/data/types';
import type { ConditionContext } from '@/systems/story/Conditions';
import { evaluateCondition } from '@/systems/story/Conditions';

/**
 * Carte de jeu lue depuis une définition ASCII (placeholder des futures cartes Tiled).
 * Le reste du jeu ne dépend que de cette interface : remplacer la source par Tiled ne touche pas les scènes.
 */
export interface PlacedMarker {
  /** Clé stable « carte:caractère » (ennemis vaincus, sauvegardes). */
  readonly key: string;
  readonly char: string;
  readonly tileX: number;
  readonly tileY: number;
  readonly def: MarkerDef;
}

export interface WorldMap {
  readonly def: MapDefinition;
  readonly width: number;
  readonly height: number;
  /** terrain[y][x] */
  readonly terrain: readonly (readonly TerrainId[])[];
  readonly markers: readonly PlacedMarker[];
}

/** Construit la carte ; lève une erreur explicite si la définition est invalide. */
export function buildWorldMap(def: MapDefinition): WorldMap {
  const height = def.rows.length;
  const width = def.rows[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new Error(`Carte ${def.id} vide`);

  const terrain: TerrainId[][] = [];
  const markers: PlacedMarker[] = [];
  def.rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(
        `Carte ${def.id} : la ligne ${String(y)} fait ${String(row.length)} caractères au lieu de ${String(width)}`,
      );
    }
    const line: TerrainId[] = [];
    for (let x = 0; x < row.length; x += 1) {
      const char = row.charAt(x);
      const t = TERRAIN_CHARS[char];
      if (t) {
        line.push(t);
        continue;
      }
      const marker = def.markers[char];
      if (!marker)
        throw new Error(
          `Carte ${def.id} : caractère inconnu « ${char} » en (${String(x)}, ${String(y)})`,
        );
      line.push(def.floor);
      markers.push({ key: `${def.id}:${char}`, char, tileX: x, tileY: y, def: marker });
    }
    terrain.push(line);
  });
  return { def, width, height, terrain, markers };
}

export function terrainAt(map: WorldMap, tileX: number, tileY: number): TerrainId {
  return map.terrain[tileY]?.[tileX] ?? 'void';
}

/** Point d'arrivée nommé, ou `null`. */
export function findSpawn(
  map: WorldMap,
  id: string,
): { tileX: number; tileY: number; facing: Facing } | null {
  for (const m of map.markers) {
    if (m.def.kind === 'spawn' && m.def.id === id) {
      return { tileX: m.tileX, tileY: m.tileY, facing: m.def.facing ?? 'down' };
    }
  }
  return null;
}

/** Délai de réapparition par défaut d'un groupe d'ennemis vaincu (minutes in-game). */
export const DEFAULT_RESPAWN_MINUTES = 120;

/** Un marqueur PNJ, objet ou groupe d'ennemis est-il présent dans l'état actuel du jeu ? */
export function isMarkerVisible(marker: PlacedMarker, ctx: ConditionContext): boolean {
  const def = marker.def;
  if (def.kind === 'npc' || def.kind === 'prop') return evaluateCondition(def.visibleWhen, ctx);
  if (def.kind === 'encounter') {
    if (!evaluateCondition(def.visibleWhen, ctx)) return false;
    const defeatedAt = ctx.defeated?.[marker.key];
    if (defeatedAt === undefined || ctx.now === undefined) return true;
    return ctx.now - defeatedAt >= (def.respawnMinutes ?? DEFAULT_RESPAWN_MINUTES);
  }
  return true;
}

function markersAt(map: WorldMap, tileX: number, tileY: number): PlacedMarker[] {
  return map.markers.filter((m) => m.tileX === tileX && m.tileY === tileY);
}

/** Case infranchissable : terrain bloquant, hors carte, PNJ visible ou objet bloquant visible. */
export function isBlocked(
  map: WorldMap,
  tileX: number,
  tileY: number,
  ctx: ConditionContext,
): boolean {
  if (BLOCKING_TERRAINS.has(terrainAt(map, tileX, tileY))) return true;
  return markersAt(map, tileX, tileY).some((m) => {
    if (!isMarkerVisible(m, ctx)) return false;
    return (
      m.def.kind === 'npc' ||
      m.def.kind === 'encounter' ||
      (m.def.kind === 'prop' && m.def.blocking)
    );
  });
}

/** PNJ, objet ou groupe d'ennemis visible avec lequel on peut interagir sur cette case. */
export function interactableAt(
  map: WorldMap,
  tileX: number,
  tileY: number,
  ctx: ConditionContext,
): PlacedMarker | null {
  return (
    markersAt(map, tileX, tileY).find(
      (m) =>
        (m.def.kind === 'npc' || m.def.kind === 'prop' || m.def.kind === 'encounter') &&
        isMarkerVisible(m, ctx),
    ) ?? null
  );
}

/** Portail ou déclencheur posé sur cette case (ce qui se passe quand on marche dessus). */
export function stepMarkerAt(map: WorldMap, tileX: number, tileY: number): PlacedMarker | null {
  return (
    markersAt(map, tileX, tileY).find((m) => m.def.kind === 'portal' || m.def.kind === 'trigger') ??
    null
  );
}

/** Cases atteignables à pied depuis un point (parcours en largeur), pour les tests de conception des cartes. */
export function reachableTiles(
  map: WorldMap,
  fromX: number,
  fromY: number,
  ctx: ConditionContext,
): Set<string> {
  const key = (x: number, y: number): string => `${String(x)},${String(y)}`;
  const seen = new Set<string>([key(fromX, fromY)]);
  const queue: [number, number][] = [[fromX, fromY]];
  // for…of sur un tableau qui grandit parcourt aussi les éléments ajoutés : c'est une file.
  for (const [x, y] of queue) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (seen.has(key(nx, ny)) || isBlocked(map, nx, ny, ctx)) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  return seen;
}
