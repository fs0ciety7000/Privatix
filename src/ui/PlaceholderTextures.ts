import type Phaser from 'phaser';
import { AssetKeys, TILE_SIZE } from '@/config/constants';
import { CHARACTERS } from '@/data/characters';
import type { CharacterId, Facing, TerrainId } from '@/data/types';

/**
 * Textures générées au démarrage (docs/ASSETS_GUIDE.md § 5) : on développe sans attendre les graphismes.
 * Remplacées une à une par les vrais assets (même clé ou clé dédiée) sans toucher au reste du code.
 */

/** Ordre des terrains dans le tileset placeholder : l'index de tuile = la position dans ce tableau. */
export const TERRAIN_ORDER: readonly TerrainId[] = [
  'void',
  'wall',
  'floor',
  'platform',
  'track',
  'footbridge',
  'hall',
  'office',
  'occ-floor',
  'occ-wall',
  'counter',
  'escalator',
];

export function terrainIndex(terrain: TerrainId): number {
  return TERRAIN_ORDER.indexOf(terrain);
}

export function characterTextureKey(id: CharacterId, facing: Facing): string {
  return `char-${id}-${facing}`;
}

const CHAR_WIDTH = 16;
const CHAR_HEIGHT = 24;
const OUTLINE = 0x101828;
const SKIN = 0xf1c27d;

type Painter = (g: Phaser.GameObjects.Graphics, x: number) => void;

const T = TILE_SIZE;
const TERRAIN_PAINTERS: Readonly<Record<TerrainId, Painter>> = {
  void: (g, x) => g.fillStyle(0x05080f).fillRect(x, 0, T, T),
  wall: (g, x) => {
    g.fillStyle(0x2a3550).fillRect(x, 0, T, T);
    g.fillStyle(0x1b2338).fillRect(x, T - 4, T, 4);
    g.fillStyle(0x3a4766).fillRect(x, 0, T, 2);
  },
  floor: (g, x) => {
    g.fillStyle(0x8c96a8).fillRect(x, 0, T, T);
    g.fillStyle(0x7d879a).fillRect(x, 0, 1, T).fillRect(x, 0, T, 1);
  },
  platform: (g, x) => {
    g.fillStyle(0x9aa3b2).fillRect(x, 0, T, T);
    g.fillStyle(0x8a93a3).fillRect(x + 7, 7, 2, 2);
  },
  track: (g, x) => {
    g.fillStyle(0x4b4038).fillRect(x, 0, T, T);
    g.fillStyle(0x6b5a4a).fillRect(x, 2, T, 2).fillRect(x, 8, T, 2).fillRect(x, 14, T, 2);
    g.fillStyle(0xb8bcc4)
      .fillRect(x + 3, 0, 2, T)
      .fillRect(x + 11, 0, 2, T);
  },
  footbridge: (g, x) => {
    g.fillStyle(0xe6e9ee).fillRect(x, 0, T, T);
    g.fillStyle(0xcfd4dc).fillRect(x, 0, T, 1).fillRect(x, 8, T, 1);
  },
  hall: (g, x) => {
    g.fillStyle(0xc9c2b2).fillRect(x, 0, T, T);
    g.fillStyle(0xb5ad9c)
      .fillRect(x, 0, 8, 8)
      .fillRect(x + 8, 8, 8, 8);
  },
  office: (g, x) => {
    g.fillStyle(0x6f7f6a).fillRect(x, 0, T, T);
    g.fillStyle(0x64735f).fillRect(x, 4, T, 1).fillRect(x, 12, T, 1);
  },
  'occ-floor': (g, x) => {
    g.fillStyle(0x6b4a33).fillRect(x, 0, T, T);
    g.fillStyle(0x5a3d2a).fillRect(x, 5, T, 1).fillRect(x, 11, T, 1);
  },
  'occ-wall': (g, x) => {
    g.fillStyle(0x3b2418).fillRect(x, 0, T, T);
    g.fillStyle(0x4a2e1f)
      .fillRect(x, 0, 7, 7)
      .fillRect(x + 8, 8, 8, 7);
  },
  counter: (g, x) => {
    g.fillStyle(0x7a4e33).fillRect(x, 0, T, T);
    g.fillStyle(0xa8734a).fillRect(x, 0, T, 4);
  },
  escalator: (g, x) => {
    g.fillStyle(0x5c6370).fillRect(x, 0, T, T);
    g.fillStyle(0x9aa1ad)
      .fillRect(x, 1, T, 1)
      .fillRect(x, 5, T, 1)
      .fillRect(x, 9, T, 1)
      .fillRect(x, 13, T, 1);
  },
};

function drawCharacter(g: Phaser.GameObjects.Graphics, body: number, facing: Facing): void {
  // Corps et tête, contour sombre pour la lisibilité sur tous les sols.
  g.fillStyle(OUTLINE).fillRect(2, 9, 12, 15).fillRect(3, 0, 10, 11);
  g.fillStyle(body).fillRect(3, 10, 10, 13);
  g.fillStyle(SKIN).fillRect(4, 1, 8, 9);
  g.fillStyle(0x3b2a20).fillRect(4, 1, 8, facing === 'up' ? 8 : 3); // cheveux (de dos : toute la tête)
  g.fillStyle(OUTLINE);
  if (facing === 'down') g.fillRect(5, 5, 2, 2).fillRect(9, 5, 2, 2);
  if (facing === 'left') g.fillRect(4, 5, 2, 2);
  if (facing === 'right') g.fillRect(10, 5, 2, 2);
}

/** Crée toutes les textures placeholder (idempotent). À appeler une fois, dans PreloaderScene. */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({}, false);

  if (!scene.textures.exists(AssetKeys.PlaceholderTiles)) {
    TERRAIN_ORDER.forEach((terrain, i) => {
      TERRAIN_PAINTERS[terrain](g, i * T);
    });
    g.generateTexture(AssetKeys.PlaceholderTiles, TERRAIN_ORDER.length * T, T);
  }

  for (const [id, def] of Object.entries(CHARACTERS) as [CharacterId, { color: number }][]) {
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      const key = characterTextureKey(id, facing);
      if (scene.textures.exists(key)) continue;
      g.clear();
      drawCharacter(g, def.color, facing);
      g.generateTexture(key, CHAR_WIDTH, CHAR_HEIGHT);
    }
  }

  if (!scene.textures.exists(AssetKeys.PlaceholderProp)) {
    // Blanc : teinté par objet (setTint) pour distinguer les objets sans texture dédiée.
    g.clear();
    g.fillStyle(OUTLINE).fillRect(0, 0, T, T);
    g.fillStyle(0xffffff).fillRect(1, 1, T - 2, T - 2);
    g.fillStyle(0xcccccc).fillRect(3, 3, T - 6, 4);
    g.generateTexture(AssetKeys.PlaceholderProp, T, T);
  }

  if (!scene.textures.exists(AssetKeys.PlaceholderPortal)) {
    g.clear();
    g.fillStyle(0xffd200, 0.35).fillRect(0, 0, T, T);
    g.lineStyle(1, 0xffd200, 0.9).strokeRect(0.5, 0.5, T - 1, T - 1);
    g.generateTexture(AssetKeys.PlaceholderPortal, T, T);
  }

  g.destroy();
}
