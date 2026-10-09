import Phaser from 'phaser';
import { PLAYER_SPEED, TILE_SIZE } from '@/config/constants';
import { COLORS } from '@/config/colors';

/**
 * Joueur en exploration. Placeholder : un rectangle tant que le spritesheet n'est pas intégré.
 * Contrôles : ZQSD / flèches.
 */
export class Player extends Phaser.GameObjects.Rectangle {
  private readonly keys: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  } | null;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TILE_SIZE, TILE_SIZE * 1.5, COLORS.sncb.accent);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const keyboard = scene.input.keyboard;
    this.keys = keyboard
      ? {
          up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
          down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
          left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
          right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        }
      : null;
    if (keyboard) {
      // Les flèches en plus de ZQSD.
      const cursors = keyboard.createCursorKeys();
      this.cursors = cursors;
    }
  }

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;

  public override update(_delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;

    const left = (this.keys?.left.isDown ?? false) || (this.cursors?.left.isDown ?? false);
    const right = (this.keys?.right.isDown ?? false) || (this.cursors?.right.isDown ?? false);
    const up = (this.keys?.up.isDown ?? false) || (this.cursors?.up.isDown ?? false);
    const down = (this.keys?.down.isDown ?? false) || (this.cursors?.down.isDown ?? false);

    const vx = (right ? 1 : 0) - (left ? 1 : 0);
    const vy = (down ? 1 : 0) - (up ? 1 : 0);
    const norm = vx !== 0 && vy !== 0 ? Math.SQRT1_2 : 1;

    body.setVelocity(vx * PLAYER_SPEED * norm, vy * PLAYER_SPEED * norm);
  }

  public override destroy(fromScene?: boolean): void {
    this.cursors = null;
    super.destroy(fromScene);
  }
}
