import Phaser from 'phaser';
import { sheetOf } from '@/config/assets';
import { Depth } from '@/config/constants';

export interface ProjectileSpec {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly speed: number;
  readonly damage: number;
  readonly lifeMs: number;
  readonly radius: number;
  readonly owner: string;
  readonly anim?: string;
  readonly scale?: number;
}

/**
 * Projectile ennemi (« ticket d'amende »). Mis en pool par RunScene : `fire` le réactive, `kill` le rend.
 * Hitbox circulaire Arcade ; détruit par les murs, par le coup 3 et par le sifflet.
 */
export class Projectile extends Phaser.Physics.Arcade.Sprite {
  declare public body: Phaser.Physics.Arcade.Body;
  public damage = 0;
  public owner = '';
  private lifeLeft = 0;

  public constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, sheetOf('proj-ticket-spin'), 0);
  }

  public fire(spec: ProjectileSpec): void {
    this.setActive(true)
      .setVisible(true)
      .setPosition(spec.x, spec.y)
      .setScale(spec.scale ?? 1)
      .setDepth(Depth.Above);
    this.body.enable = true;
    this.body.reset(spec.x, spec.y);
    const r = spec.radius;
    this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    this.setVelocity(Math.cos(spec.angle) * spec.speed, Math.sin(spec.angle) * spec.speed);
    this.damage = spec.damage;
    this.owner = spec.owner;
    this.lifeLeft = spec.lifeMs;
    this.play(spec.anim ?? 'proj-ticket-spin');
  }

  public tick(dtMs: number): void {
    if (!this.active) return;
    this.lifeLeft -= dtMs;
    if (this.lifeLeft <= 0) this.kill();
  }

  /** Centre de la hitbox. */
  public get hitCircle(): { x: number; y: number; r: number } {
    return { x: this.body.center.x, y: this.body.center.y, r: this.body.halfWidth };
  }

  public kill(): void {
    if (!this.active) return;
    this.anims.stop();
    this.setActive(false).setVisible(false);
    this.setVelocity(0, 0);
    this.body.enable = false;
  }
}
