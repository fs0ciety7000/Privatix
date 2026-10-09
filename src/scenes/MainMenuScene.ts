import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SceneKeys } from '@/config/constants';
import { COLORS, toCss } from '@/config/colors';

/** Menu principal : Nouvelle partie / Continuer. */
export class MainMenuScene extends Phaser.Scene {
  public constructor() {
    super(SceneKeys.MainMenu);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(COLORS.sncb.bgDeep);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 3, 'PRIVATIX', {
        fontFamily: 'monospace',
        fontSize: '64px',
        color: toCss(COLORS.sncb.accent),
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 3 + 56, 'Le rail ne se vend pas.', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: toCss(COLORS.sncb.text),
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(GAME_WIDTH / 2, (GAME_HEIGHT * 2) / 3, 'Appuyez sur ENTRÉE ou touchez l\'écran', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: toCss(COLORS.occ.accent),
      })
      .setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });

    this.input.keyboard?.once('keydown-ENTER', () => {
      this.startGame();
    });
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      this.startGame();
    });
  }

  private startGame(): void {
    this.scene.start(SceneKeys.Game);
  }
}
