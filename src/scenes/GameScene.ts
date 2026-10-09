import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SceneKeys } from '@/config/constants';
import { COLORS, toCss } from '@/config/colors';
import { Player } from '@/entities/Player';

/**
 * Game : scène d'exploration (gare de Mons).
 * Lance la scène UI en parallèle (overlay HUD) et la stoppe proprement au shutdown.
 */
export class GameScene extends Phaser.Scene {
  private player!: Player;

  public constructor() {
    super(SceneKeys.Game);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(COLORS.sncb.panel);

    this.add
      .text(GAME_WIDTH / 2, 24, 'Gare de Mons - Quais (placeholder)', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: toCss(COLORS.sncb.text),
      })
      .setOrigin(0.5);

    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2);

    this.scene.launch(SceneKeys.UI);

    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  public override update(_time: number, delta: number): void {
    this.player.update(delta);
  }

  private returnToMenu(): void {
    this.scene.start(SceneKeys.MainMenu);
  }

  /** Libère tout ce que cette scène a créé hors de son display list (listeners, scènes parallèles). */
  private onShutdown(): void {
    this.input.keyboard?.off('keydown-ESC', this.returnToMenu, this);
    this.scene.stop(SceneKeys.UI);
  }
}
