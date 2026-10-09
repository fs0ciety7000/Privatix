import Phaser from 'phaser';
import { Colors, Css, FONT, GAME_HEIGHT, GAME_WIDTH, SceneKeys } from '@/config/constants';
import type { OwnedAvantage } from '@/systems/meta/Avantages';
import { AVANTAGES_BY_ID, RARITIES } from '@/systems/meta/Avantages';

export interface PauseData {
  readonly seed: number;
  readonly avantages: readonly OwnedAvantage[];
}

/** Pause : graine du Shift, Avantages acquis, reprendre ou abandonner (retour à l'OCC). */
export class PauseScene extends Phaser.Scene {
  private data_!: PauseData;

  public constructor() {
    super(SceneKeys.Pause);
  }

  public init(data: PauseData): void {
    this.data_ = data;
  }

  public create(): void {
    const style = {
      fontFamily: FONT,
      fontSize: '8px',
      color: Css.white,
      stroke: Css.outline,
      strokeThickness: 2,
    };
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05080d, 0.8).setOrigin(0);
    this.add
      .text(GAME_WIDTH / 2, 50, 'PAUSE — « Ce n’est pas du temps de travail effectif »', {
        ...style,
        fontSize: '10px',
        color: Css.quaiYellow,
      })
      .setOrigin(0.5)
      .setResolution(2);
    const seed = this.data_.seed.toString(36).toUpperCase().padStart(7, '0');
    this.add
      .text(
        GAME_WIDTH / 2,
        70,
        `Graine du Shift : ${seed.slice(0, 2)}-${seed.slice(2, 5)}-${seed.slice(5, 7)}`,
        { ...style, color: Css.ballast },
      )
      .setOrigin(0.5)
      .setResolution(2);
    const lines = this.data_.avantages.map((a) => {
      const def = AVANTAGES_BY_ID.get(a.id);
      return `• ${def?.name ?? a.id} (${RARITIES[a.rarity].label}) — ${def?.describe(RARITIES[a.rarity].mult) ?? ''}`;
    });
    this.add
      .text(
        60,
        92,
        lines.length > 0
          ? ['Avantages acquis :', ...lines].join('\n')
          : 'Aucun Avantage acquis pour l’instant.',
        { ...style, wordWrap: { width: GAME_WIDTH - 120 }, lineSpacing: 3 },
      )
      .setResolution(2);

    const button = (y: number, label: string, cb: () => void): void => {
      const r = this.add
        .rectangle(GAME_WIDTH / 2, y, 200, 20, Colors.night)
        .setStrokeStyle(1, Colors.quaiYellow)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(GAME_WIDTH / 2, y, label, style)
        .setOrigin(0.5)
        .setResolution(2);
      r.on(Phaser.Input.Events.POINTER_UP, cb);
    };
    button(GAME_HEIGHT - 70, 'Reprendre (Échap)', () => {
      this.resumeRun();
    });
    button(GAME_HEIGHT - 42, 'Abandonner le Shift', () => {
      this.scene.stop(SceneKeys.UI);
      this.scene.stop(SceneKeys.Run);
      this.scene.start(SceneKeys.Hub);
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      this.resumeRun();
    });
    this.input.keyboard?.on('keydown-P', () => {
      this.resumeRun();
    });
  }

  private resumeRun(): void {
    this.scene.resume(SceneKeys.Run);
    this.scene.stop();
  }
}
