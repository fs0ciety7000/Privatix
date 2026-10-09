import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RegistryKeys } from '@/config/constants';
import { COLORS } from '@/config/colors';
import type { Facing } from '@/data/types';

const PAD = { x: 120, y: GAME_HEIGHT - 120, size: 56 } as const;
const BUTTON_A = { x: GAME_WIDTH - 110, y: GAME_HEIGHT - 110, radius: 44 } as const;

/**
 * D-pad et bouton A tactiles (UX § 4), affichés seulement sur les appareils tactiles.
 * Ils écrivent dans le registry (`VirtualDir`, `VirtualAction`) : GameScene les lit comme le clavier.
 */
export class VirtualPad extends Phaser.GameObjects.Container {
  private actionCount = 0;

  public constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const dirs: readonly [Facing, number, number, string][] = [
      ['up', 0, -1, '▲'],
      ['down', 0, 1, '▼'],
      ['left', -1, 0, '◀'],
      ['right', 1, 0, '▶'],
    ];
    for (const [dir, dx, dy, glyph] of dirs) {
      const x = PAD.x + dx * PAD.size;
      const y = PAD.y + dy * PAD.size;
      const zone = scene.add
        .rectangle(x, y, PAD.size, PAD.size, COLORS.sncb.panel, 0.5)
        .setStrokeStyle(2, COLORS.sncb.accent, 0.8);
      const label = scene.add
        .text(x, y, glyph, { fontFamily: 'monospace', fontSize: '22px', color: '#ffd200' })
        .setOrigin(0.5);
      zone.setInteractive();
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        zone.setFillStyle(COLORS.sncb.panel, 0.85);
        scene.registry.set(RegistryKeys.VirtualDir, dir);
      });
      const release = (): void => {
        zone.setFillStyle(COLORS.sncb.panel, 0.5);
        if (scene.registry.get(RegistryKeys.VirtualDir) === dir)
          scene.registry.set(RegistryKeys.VirtualDir, null);
      };
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, release);
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, release);
      this.add([zone, label]);
    }

    const a = scene.add
      .circle(BUTTON_A.x, BUTTON_A.y, BUTTON_A.radius, COLORS.occ.accent, 0.6)
      .setStrokeStyle(2, COLORS.occ.text);
    const aLabel = scene.add
      .text(BUTTON_A.x, BUTTON_A.y, 'A', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#2b1a12',
      })
      .setOrigin(0.5);
    a.setInteractive();
    a.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.actionCount += 1;
      scene.registry.set(RegistryKeys.VirtualAction, this.actionCount);
    });
    this.add([a, aLabel]);
    scene.add.existing(this);
  }

  public override destroy(fromScene?: boolean): void {
    this.scene.registry.set(RegistryKeys.VirtualDir, null);
    super.destroy(fromScene);
  }
}
