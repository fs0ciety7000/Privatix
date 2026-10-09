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
import manifest3d from '../../tools/render3d/manifest.json';

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
  /** Normal map de mêmes dimensions (`<nom>_n.png`) pour l'éclairage dynamique. */
  readonly normalMap?: string;
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
  readonly normalMap?: string;
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
  readonly normalMap?: string;
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
  readonly normalMap?: string;
  readonly pivot?: { readonly x: number; readonly y: number };
  readonly events?: { readonly footstep?: readonly number[] } | null;
}

interface ManifestImage {
  readonly file: string;
  readonly texture: string;
  readonly type: string;
  readonly width: number;
  readonly height: number;
  readonly atlas?: string;
  readonly normalMap?: string;
}

interface ManifestTileset {
  readonly file: string;
  readonly texture: string;
  readonly margin: number;
  readonly spacing: number;
  readonly columns: number;
  readonly rows: number;
  readonly tiles: Readonly<Record<string, number>>;
  readonly normalMap?: string;
}

const M2D = manifest as unknown as {
  readonly animations: readonly ManifestAnimation[];
  readonly images: readonly ManifestImage[];
  readonly tilesets: readonly ManifestTileset[];
};

/**
 * Personnages rendus par le pipeline 3D → pixel (tools/render3d, méthode Dead Cells) :
 * ils remplacent les feuilles 2D de même clé d'animation.
 */
const M3D = manifest3d as unknown as { readonly animations: readonly ManifestAnimation[] };
const KEYS_3D = new Set(M3D.animations.map((a) => a.anim));

const M = {
  animations: [...M2D.animations.filter((a) => !KEYS_3D.has(a.anim)), ...M3D.animations],
  images: M2D.images,
  tilesets: M2D.tilesets,
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
  ...(a.normalMap ? { normalMap: a.normalMap } : {}),
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
    ...(i.normalMap ? { normalMap: i.normalMap } : {}),
  }));

export const TILESETS: readonly TilesetDef[] = M.tilesets.map((t) => ({
  key: t.texture,
  path: t.file,
  margin: t.margin,
  spacing: t.spacing,
  columns: t.columns,
  rows: t.rows,
  names: t.tiles,
  ...(t.normalMap ? { normalMap: t.normalMap } : {}),
}));

export type TilesetKey = 'tiles_quais' | 'tiles_occ';

export function tileset(key: TilesetKey): TilesetDef {
  const t = TILESETS.find((d) => d.key === key);
  if (!t) throw new Error(`Tileset ${key} absent du manifeste`);
  return t;
}

/** Données d'une animation utiles au code : feuille, taille de frame, pivot aux pieds, frames de pas. */
export interface AnimInfo {
  readonly sheet: string;
  readonly frameSize: number;
  readonly pivot: { readonly x: number; readonly y: number };
  readonly footsteps: readonly number[];
}

const ANIM_INFO: ReadonlyMap<string, AnimInfo> = new Map(
  M.animations.map((a) => [
    a.anim,
    {
      sheet: a.texture,
      frameSize: a.frameWidth,
      pivot: a.pivot ?? { x: a.frameWidth / 2, y: a.frameHeight - 4 },
      footsteps: a.events?.footstep ?? [],
    },
  ]),
);

/**
 * Infos d'une animation du manifeste. Les tailles et les pivots ne sont jamais codés en dur :
 * changer de sprites (générateur, rendu 3D, pack itch.io) ne demande aucune modification du code.
 */
export function animInfo(animKey: string): AnimInfo {
  const info = ANIM_INFO.get(animKey);
  if (!info) throw new Error(`Animation absente du manifeste : ${animKey}`);
  return info;
}

/** Clé de texture de la feuille d'une animation (pour créer un sprite avant de jouer l'animation). */
export function sheetOf(animKey: string): string {
  return animInfo(animKey).sheet;
}

/** Origine Phaser (pivot / taille de frame) d'une animation. */
export function originOf(animKey: string): [number, number] {
  const { frameSize, pivot } = animInfo(animKey);
  return [pivot.x / frameSize, pivot.y / frameSize];
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
