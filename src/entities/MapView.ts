import Phaser from 'phaser';
import { AssetKeys, TILE_SIZE } from '@/config/constants';
import { CHARACTERS } from '@/data/characters';
import type { ConditionContext } from '@/systems/story/Conditions';
import type { PlacedMarker, WorldMap } from '@/systems/world/WorldMap';
import { isMarkerVisible } from '@/systems/world/WorldMap';
import { tileToWorld } from '@/entities/Player';
import { characterTextureKey, terrainIndex } from '@/ui/PlaceholderTextures';

/** Distance (en cases) sous laquelle le nom d'un objet s'affiche : évite le chevauchement des étiquettes. */
const PROP_LABEL_RANGE = 2;

const PROP_TINTS = [0xffd200, 0x3fb8e8, 0xe8505b, 0x5bd17a, 0xf2a541, 0xb48cff, 0x9fb0c6, 0xc8323c];

function tintFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PROP_TINTS[hash % PROP_TINTS.length] ?? 0xffffff;
}

interface MarkerView {
  readonly marker: PlacedMarker;
  readonly objects: readonly (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[];
}

/**
 * Affichage d'une WorldMap : tilemap des terrains + PNJ, objets et portails (placeholders).
 * Ne contient aucune règle : la visibilité vient de `isMarkerVisible`, appelée par `refresh`.
 */
export class MapView {
  public readonly widthPx: number;
  public readonly heightPx: number;
  private readonly tilemap: Phaser.Tilemaps.Tilemap;
  private readonly views: MarkerView[] = [];
  private ctx: ConditionContext = { flags: {}, act: 1 };
  private focus: { tileX: number; tileY: number } | null = null;

  public constructor(
    private readonly scene: Phaser.Scene,
    world: WorldMap,
  ) {
    this.widthPx = world.width * TILE_SIZE;
    this.heightPx = world.height * TILE_SIZE;

    const data = world.terrain.map((row) => row.map((t) => terrainIndex(t)));
    this.tilemap = scene.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = this.tilemap.addTilesetImage(
      AssetKeys.PlaceholderTiles,
      AssetKeys.PlaceholderTiles,
      TILE_SIZE,
      TILE_SIZE,
      0,
      0,
    );
    if (!tileset)
      throw new Error('Tileset placeholder introuvable (PreloaderScene non exécutée ?)');
    this.tilemap.createLayer(0, tileset, 0, 0).setDepth(-1);

    for (const marker of world.markers) {
      const objects = this.createMarkerObjects(marker);
      if (objects.length > 0) this.views.push({ marker, objects });
    }
  }

  /** Affiche ou masque PNJ et objets selon l'état de l'histoire. */
  public refresh(ctx: ConditionContext): void {
    this.ctx = ctx;
    this.applyVisibility();
  }

  /** Position du héros : les noms d'objets ne s'affichent qu'à proximité (les noms des PNJ, toujours). */
  public setFocus(tileX: number, tileY: number): void {
    this.focus = { tileX, tileY };
    this.applyVisibility();
  }

  private applyVisibility(): void {
    for (const view of this.views) {
      const visible = isMarkerVisible(view.marker, this.ctx);
      const [main, label] = view.objects;
      main?.setVisible(visible);
      if (!label) continue;
      const near =
        view.marker.def.kind !== 'prop' ||
        (this.focus !== null &&
          Math.abs(this.focus.tileX - view.marker.tileX) +
            Math.abs(this.focus.tileY - view.marker.tileY) <=
            PROP_LABEL_RANGE);
      label.setVisible(visible && near);
    }
  }

  /** Oriente un PNJ (vers le héros quand on lui parle). */
  public faceNpc(marker: PlacedMarker, facing: 'up' | 'down' | 'left' | 'right'): void {
    if (marker.def.kind !== 'npc') return;
    const view = this.views.find((v) => v.marker === marker);
    const sprite = view?.objects[0];
    if (sprite instanceof Phaser.GameObjects.Image)
      sprite.setTexture(characterTextureKey(marker.def.character, facing));
  }

  public destroy(): void {
    for (const view of this.views) for (const o of view.objects) o.destroy();
    this.views.length = 0;
    this.tilemap.destroy();
  }

  private createMarkerObjects(
    marker: PlacedMarker,
  ): (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] {
    const def = marker.def;
    const { x, y } = tileToWorld(marker.tileX, marker.tileY);
    if (def.kind === 'npc') {
      const sprite = this.scene.add
        .image(x, y, characterTextureKey(def.character, def.facing ?? 'down'))
        .setOrigin(0.5, 1)
        .setDepth(y);
      const name = CHARACTERS[def.character].name;
      return [sprite, this.label(x, y - 24, name)];
    }
    if (def.kind === 'prop') {
      const image = this.scene.add
        .image(x, y, AssetKeys.PlaceholderProp)
        .setOrigin(0.5, 1)
        .setTint(tintFor(def.id))
        .setDepth(def.blocking ? y : y - TILE_SIZE);
      return [image, this.label(x, y - 16, def.label)];
    }
    if (def.kind === 'portal') {
      return [
        this.scene.add.image(x, y, AssetKeys.PlaceholderPortal).setOrigin(0.5, 1).setDepth(0),
      ];
    }
    return [];
  }

  private label(x: number, y: number, text: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(x, y, text, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#ffffff',
        stroke: '#101828',
        strokeThickness: 2,
      })
      .setResolution(2)
      .setOrigin(0.5, 1)
      .setDepth(10_000);
  }
}
