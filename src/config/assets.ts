/**
 * Catalogue des assets pixel art (docs/PIXEL_ART_GUIDE.md), lu dans le manifeste du générateur
 * (`tools/pixelart/manifest.json`, régénéré par `npm run assets`). Nommage des fichiers :
 * `<entité>_<anim>[_<direction>]_strip<N>.png`, clé de texture = nom sans `.png`,
 * clé d'animation `<entité>-<anim>[-<direction>]`.
 *
 * Remplacer un PNG (pack itch.io, freelance) ne change aucun code tant que le nom, la taille de frame
 * et le nombre de frames sont respectés. Toute feuille absente est remplacée au chargement par un
 * placeholder généré (PreloaderScene) : le jeu tourne avec ou sans les vrais sprites.
 */
import manifest from '../../tools/pixelart/manifest.json';

export type Direction = 'down' | 'up' | 'side';
export const DIRECTIONS: readonly Direction[] = ['down', 'up', 'side'];

export interface SheetDef {
  readonly key: string;
  readonly path: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  /** Couleur dominante du placeholder. */
  readonly tint: number;
}

export interface AnimDef {
  readonly key: string;
  readonly sheet: string;
  /** Durée de chaque frame (ms) ; la longueur = nombre de frames. */
  readonly durations: readonly number[];
  /** -1 = boucle, 0 = une fois. */
  readonly repeat: number;
}

export interface ImageDef {
  readonly key: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly tint: number;
  readonly atlas?: string;
}

export interface TilesetDef {
  readonly key: string;
  readonly path: string;
  readonly margin: number;
  readonly spacing: number;
  readonly columns: number;
  readonly rows: number;
  /** Nom → index de tuile. */
  readonly names: Readonly<Record<string, number>>;
}

interface ManifestAnimation {
  readonly file: string;
  readonly texture: string;
  readonly anim: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  readonly durations: readonly number[];
  readonly loop: boolean;
}

interface ManifestImage {
  readonly file: string;
  readonly texture: string;
  readonly type: string;
  readonly width: number;
  readonly height: number;
  readonly atlas?: string;
}

interface ManifestTileset {
  readonly file: string;
  readonly texture: string;
  readonly margin: number;
  readonly spacing: number;
  readonly columns: number;
  readonly rows: number;
  readonly tiles: Readonly<Record<string, number>>;
}

const M = manifest as unknown as {
  readonly animations: readonly ManifestAnimation[];
  readonly images: readonly ManifestImage[];
  readonly tilesets: readonly ManifestTileset[];
};

/** Couleur de placeholder d'après la catégorie (dossier). */
function tintFor(file: string): number {
  if (file.includes('/player/')) return 0xff7a1a;
  if (file.includes('/bosses/')) return 0x1e8f86;
  if (file.includes('/enemies/')) return 0x19c3b1;
  if (file.includes('/npcs/')) return 0x5b8def;
  if (file.includes('proj-')) return 0xff3ea5;
  return 0xffe2a8;
}

export const SPRITE_SHEETS: readonly SheetDef[] = M.animations.map((a) => ({
  key: a.texture,
  path: a.file,
  frameWidth: a.frameWidth,
  frameHeight: a.frameHeight,
  frames: a.frames,
  tint: tintFor(a.file),
}));

export const ANIMATIONS: readonly AnimDef[] = M.animations.map((a) => ({
  key: a.anim,
  sheet: a.texture,
  durations: a.durations,
  repeat: a.loop ? -1 : 0,
}));

export const IMAGES: readonly ImageDef[] = M.images
  .filter((i) => i.type === 'image' || i.type === 'atlas')
  .map((i) => ({
    key: i.texture,
    path: i.file,
    width: i.width,
    height: i.height,
    tint: i.texture.startsWith('shadow_') ? 0x14101a : 0x9fb0c6,
    ...(i.atlas ? { atlas: i.atlas } : {}),
  }));

export const TILESETS: readonly TilesetDef[] = M.tilesets.map((t) => ({
  key: t.texture,
  path: t.file,
  margin: t.margin,
  spacing: t.spacing,
  columns: t.columns,
  rows: t.rows,
  names: t.tiles,
}));

export type TilesetKey = 'tiles_quais' | 'tiles_occ';

export function tileset(key: TilesetKey): TilesetDef {
  const t = TILESETS.find((d) => d.key === key);
  if (!t) throw new Error(`Tileset ${key} absent du manifeste`);
  return t;
}

/** PNJ du hub : clé de texture et d'animation (`marcel_idle_strip4`, `marcel-idle`). */
export const NPCS = {
  M: { id: 'marcel', name: 'Marcel' },
  F: { id: 'fatou', name: 'Fatou' },
  Y: { id: 'yasmina', name: 'Yasmina' },
  K: { id: 'kevin', name: 'Kevin' },
  N: { id: 'bene', name: 'Béné' },
  J: { id: 'josiane', name: 'Josiane' },
  U: { id: 'rudy', name: 'Rudy' },
} as const;

/** Clé d'animation : `entité-anim[-direction]`. */
export function animKey(entity: string, name: string, dir?: Direction): string {
  return dir ? `${entity}-${name}-${dir}` : `${entity}-${name}`;
}
