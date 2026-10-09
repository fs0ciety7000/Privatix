import Phaser from 'phaser';
import { ANIMATIONS, IMAGES, SPRITE_SHEETS, TILESETS } from '@/config/assets';
import { Colors, Css, FONT, GAME_HEIGHT, GAME_WIDTH, SceneKeys } from '@/config/constants';
import {
  createPlaceholderImage,
  createPlaceholderSheet,
  createPlaceholderTileset,
  createUiTextures,
} from '@/ui/placeholders';

/**
 * Charge tous les assets déclarés dans `config/assets.ts`, puis crée les animations globales.
 * Toute feuille absente (PNG pas encore livré) est remplacée par un placeholder animé de mêmes dimensions.
 */
export class PreloaderScene extends Phaser.Scene {
  public constructor() {
    super(SceneKeys.Preloader);
  }

  public preload(): void {
    const bar = this.add
      .rectangle(GAME_WIDTH / 2 - 120, GAME_HEIGHT / 2, 0, 6, Colors.hero)
      .setOrigin(0, 0.5);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 244, 10).setStrokeStyle(1, Colors.ballast);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 18, 'Prise de poste…', {
        fontFamily: FONT,
        fontSize: '10px',
        color: Css.white,
      })
      .setOrigin(0.5)
      .setResolution(2);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => bar.setSize(240 * p, 6));

    for (const s of SPRITE_SHEETS) {
      this.load.spritesheet(s.key, s.path, {
        frameWidth: s.frameWidth,
        frameHeight: s.frameHeight,
      });
    }
    for (const img of IMAGES) {
      if (img.atlas) this.load.atlas(img.key, img.path, img.atlas);
      else this.load.image(img.key, img.path);
    }
    for (const t of TILESETS) this.load.image(t.key, t.path);
  }

  public create(): void {
    const missing: string[] = [];
    for (const s of SPRITE_SHEETS) {
      if (this.textures.exists(s.key)) continue;
      missing.push(s.key);
      createPlaceholderSheet(this, s);
    }
    for (const img of IMAGES) {
      if (!this.textures.exists(img.key)) createPlaceholderImage(this, img);
    }
    for (const t of TILESETS) {
      if (!this.textures.exists(t.key)) {
        missing.push(t.key);
        createPlaceholderTileset(this, t);
      }
    }
    createUiTextures(this);
    if (missing.length > 0) {
      console.info(
        `[Preloader] ${String(missing.length)} feuilles absentes, remplacées par des placeholders.`,
      );
    }

    for (const a of ANIMATIONS) {
      if (this.anims.exists(a.key)) continue;
      this.anims.create({
        key: a.key,
        // Phaser 4 : la durée d'une frame remplace msPerFrame quand elle est définie.
        frames: a.durations.map((duration, frame) => ({ key: a.sheet, frame, duration })),
        repeat: a.repeat,
      });
    }

    this.scene.start(SceneKeys.MainMenu);
  }
}
