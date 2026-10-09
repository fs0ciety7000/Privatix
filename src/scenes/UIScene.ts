import Phaser from 'phaser';
import { GAME_WIDTH, RegistryKeys, SceneKeys } from '@/config/constants';
import { COLORS, toCss } from '@/config/colors';
import type { GameState } from '@/systems/GameState';
import { formatClock, shiftLabel } from '@/systems/GameState';

/**
 * UI : scène overlay lancée au-dessus de Game.
 * Affiche le HUD (horloge 3x8, pause en cours, PV, Fatigue). Ne contient aucune logique de jeu.
 */
export class UIScene extends Phaser.Scene {
  private clockText!: Phaser.GameObjects.Text;

  public constructor() {
    super(SceneKeys.UI);
  }

  public create(): void {
    const panel = this.add.rectangle(0, 0, GAME_WIDTH, 36, COLORS.sncb.bgDeep, 0.85).setOrigin(0);
    panel.setStrokeStyle(1, COLORS.sncb.accent);

    this.clockText = this.add.text(12, 10, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: toCss(COLORS.sncb.accent),
    });

    this.add.text(GAME_WIDTH - 12, 10, 'ÉCHAP : menu', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: toCss(COLORS.sncb.text),
    }).setOrigin(1, 0);

    this.registry.events.on(Phaser.Data.Events.CHANGE_DATA, this.onRegistryChange, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(Phaser.Data.Events.CHANGE_DATA, this.onRegistryChange, this);
    });

    this.refresh(this.registry.get(RegistryKeys.GameState) as GameState);
  }

  private onRegistryChange(_parent: unknown, key: string, value: unknown): void {
    if (key === RegistryKeys.GameState) {
      this.refresh(value as GameState);
    }
  }

  private refresh(state: GameState): void {
    this.clockText.setText(
      `${formatClock(state.clockMinutes)}  |  Pause : ${shiftLabel(state.clockMinutes)}  |  PV ${state.player.hp}/${state.player.maxHp}  |  Fatigue ${state.player.fatigue}`,
    );
  }
}
