import Phaser from 'phaser';
import { RUN_STEP_DURATION_MS, STEP_DURATION_MS, TILE_SIZE } from '@/config/constants';
import type { Facing } from '@/data/types';
import type { GridPos, IsBlocked } from '@/systems/movement/GridMovement';
import { step } from '@/systems/movement/GridMovement';
import { characterTextureKey } from '@/ui/PlaceholderTextures';

/** Coordonnées écran d'un personnage posé sur une case (ancré en bas au centre de la tuile). */
export function tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
  return { x: tileX * TILE_SIZE + TILE_SIZE / 2, y: (tileY + 1) * TILE_SIZE };
}

/**
 * Héros en exploration : déplacement case par case (GridMovement pur) interpolé par un tween.
 * Pas de moteur physique : les collisions viennent de la carte (`IsBlocked`).
 */
export class Player extends Phaser.GameObjects.Sprite {
  private pos: GridPos;
  private moving = false;

  public constructor(scene: Phaser.Scene, pos: GridPos) {
    const { x, y } = tileToWorld(pos.tileX, pos.tileY);
    super(scene, x, y, characterTextureKey('heros', pos.facing));
    this.pos = pos;
    this.setOrigin(0.5, 1);
    this.setDepth(y);
    scene.add.existing(this);
  }

  public get gridPos(): GridPos {
    return this.pos;
  }

  public isMoving(): boolean {
    return this.moving;
  }

  /** Place le héros immédiatement (chargement de carte, téléportation). */
  public placeAt(pos: GridPos): void {
    this.scene.tweens.killTweensOf(this);
    this.moving = false;
    this.pos = pos;
    const { x, y } = tileToWorld(pos.tileX, pos.tileY);
    this.setPosition(x, y).setDepth(y);
    this.setTexture(characterTextureKey('heros', pos.facing));
  }

  /**
   * Tente un pas : se tourne toujours, avance si la case est libre.
   * `onArrive` est appelé à la fin du pas (pas appelé si le héros n'a fait que se tourner).
   */
  public tryStep(
    dir: Facing,
    isBlocked: IsBlocked,
    run: boolean,
    onArrive: (pos: GridPos) => void,
  ): void {
    if (this.moving) return;
    const next = step(this.pos, dir, isBlocked);
    this.setTexture(characterTextureKey('heros', dir));
    const moved = next.tileX !== this.pos.tileX || next.tileY !== this.pos.tileY;
    this.pos = next;
    if (!moved) return;

    const { x, y } = tileToWorld(next.tileX, next.tileY);
    this.moving = true;
    this.setDepth(Math.max(this.depth, y));
    this.scene.tweens.add({
      targets: this,
      x,
      y,
      duration: run ? RUN_STEP_DURATION_MS : STEP_DURATION_MS,
      onComplete: () => {
        this.moving = false;
        this.setDepth(y);
        onArrive(this.pos);
      },
    });
  }

  public override destroy(fromScene?: boolean): void {
    this.scene.tweens.killTweensOf(this);
    super.destroy(fromScene);
  }
}
