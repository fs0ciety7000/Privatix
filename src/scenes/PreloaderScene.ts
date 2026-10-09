import Phaser from 'phaser';
import { AssetKeys, GAME_HEIGHT, GAME_WIDTH, SceneKeys } from '@/config/constants';
import { COLORS } from '@/config/colors';

/**
 * Preloader : seule scène autorisée à appeler `this.load.*`.
 * Charge le pack d'assets déclaré dans `public/assets/asset-pack.json`
 * et affiche une barre de progression.
 */
export class PreloaderScene extends Phaser.Scene {
  public constructor() {
    super(SceneKeys.Preloader);
  }

  public preload(): void {
    const barWidth = 320;
    const barHeight = 16;
    const x = (GAME_WIDTH - barWidth) / 2;
    const y = GAME_HEIGHT / 2;

    const frame = this.add.rectangle(x, y, barWidth, barHeight, COLORS.sncb.text).setOrigin(0, 0.5);
    frame.setStrokeStyle(2, COLORS.sncb.accent);
    const bar = this.add
      .rectangle(x + 2, y, 0, barHeight - 4, COLORS.sncb.accent)
      .setOrigin(0, 0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      bar.width = (barWidth - 4) * progress;
    });

    this.load.pack(AssetKeys.AssetPack, 'assets/asset-pack.json');
  }

  public create(): void {
    this.scene.start(SceneKeys.MainMenu);
  }
}
