import Phaser from 'phaser';
import { sheetOf } from '@/config/assets';
import { Colors, Css, Depth, FONT } from '@/config/constants';

export type PickupKind = 'avantage' | 'gobelet' | 'tickets' | 'ps' | 'grains' | 'cornet';

const LOOK: Readonly<
  Record<
    PickupKind,
    { readonly label: string; readonly color: number; readonly anim: string | null }
  >
> = {
  avantage: { label: 'Avantage acquis', color: Colors.quaiYellow, anim: null },
  gobelet: { label: 'Gobelet', color: Colors.coffee, anim: 'pickup-cafe-idle' },
  tickets: { label: 'Tickets', color: Colors.danger, anim: null },
  ps: { label: 'Points de Syndicalisme', color: Colors.hero, anim: null },
  grains: { label: 'Grains de café', color: Colors.coffee, anim: 'pickup-grain-spin' },
  cornet: { label: 'Cornet de frites', color: Colors.quaiYellow, anim: null },
};

/**
 * Récompense posée au sol (socle de fin de salle, grain lâché par un ennemi).
 * Ramassée au contact ; la scène applique son effet.
 */
export class Pickup extends Phaser.GameObjects.Container {
  private readonly bobTween: Phaser.Tweens.Tween;
  public collected = false;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    public readonly kind: PickupKind,
    public readonly amount: number,
    withLabel = true,
  ) {
    super(scene, x, y);
    const look = LOOK[kind];
    const glow = scene.add.circle(0, 0, 10, look.color, 0.25);
    let icon: Phaser.GameObjects.GameObject;
    if (look.anim && scene.anims.exists(look.anim)) {
      icon = scene.add
        .sprite(
          0,
          -2,
          kind === 'gobelet' ? sheetOf('pickup-cafe-idle') : sheetOf('pickup-grain-spin'),
        )
        .play(look.anim);
    } else {
      const shape = scene.add.rectangle(0, -2, 8, 10, look.color).setStrokeStyle(1, Colors.outline);
      icon = shape;
    }
    this.add([glow, icon]);
    if (withLabel) {
      const text = scene.add
        .text(0, -16, look.label, {
          fontFamily: FONT,
          fontSize: '8px',
          color: Css.white,
          stroke: Css.outline,
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setResolution(2);
      this.add(text);
    }
    this.setDepth(Depth.Above - 10);
    scene.add.existing(this);
    this.bobTween = scene.tweens.add({
      targets: icon,
      y: -5,
      yoyo: true,
      repeat: -1,
      duration: 600,
      ease: 'Sine.easeInOut',
    });
  }

  public override destroy(fromScene?: boolean): void {
    this.bobTween.remove();
    super.destroy(fromScene);
  }
}
