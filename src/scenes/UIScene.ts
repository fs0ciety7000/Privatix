import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RegistryKeys, SceneKeys } from '@/config/constants';
import { COLORS, toCss } from '@/config/colors';
import type { FatigueTierId } from '@/config/balance';
import { isGameState } from '@/systems/GameState';
import type { GameState } from '@/systems/GameState';
import { fatigueTier, shiftAt } from '@/systems/time/FatigueClock';
import { Clock3x8 } from '@/ui/Clock3x8';
import { Gauge } from '@/ui/Gauge';
import { getGameState } from '@/utils/registry';

const FATIGUE_COLORS: Readonly<Record<FatigueTierId, number>> = {
  frais: COLORS.gauge.fatigue,
  fatigue: COLORS.gauge.fatigue,
  epuise: COLORS.gauge.fatigueHeavy,
  'burn-out': COLORS.gauge.fatigueBurnout,
  effondre: COLORS.gauge.fatigueBurnout,
};

/**
 * UI : scène overlay lancée au-dessus de Game.
 * HUD d'exploration (UX § 3.2) : bloc statut PV/PE/Fatigue en haut à gauche, horloge 3x8 en haut à droite.
 * Ne contient aucune logique de jeu : elle lit le GameState du registry et réagit à ses changements.
 */
export class UIScene extends Phaser.Scene {
  private nameText!: Phaser.GameObjects.Text;
  private hpGauge!: Gauge;
  private peGauge!: Gauge;
  private fatigueGauge!: Gauge;
  private clock!: Clock3x8;

  public constructor() {
    super(SceneKeys.UI);
  }

  public create(): void {
    const status = this.add.rectangle(16, 16, 272, 80, COLORS.sncb.panel, 0.92).setOrigin(0);
    status.setStrokeStyle(2, COLORS.sncb.border);

    this.nameText = this.add.text(28, 22, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: toCss(COLORS.sncb.accent),
    });
    const gaugeX = 28;
    const gaugeWidth = 140;
    this.hpGauge = new Gauge(this, {
      x: gaugeX,
      y: 42,
      label: 'PV',
      width: gaugeWidth,
      color: COLORS.gauge.hp,
      backgroundColor: COLORS.gauge.hpBg,
    });
    this.peGauge = new Gauge(this, {
      x: gaugeX,
      y: 58,
      label: 'PE',
      width: gaugeWidth,
      color: COLORS.gauge.pe,
      backgroundColor: COLORS.gauge.peBg,
    });
    this.fatigueGauge = new Gauge(this, {
      x: gaugeX,
      y: 74,
      label: 'FAT',
      width: gaugeWidth,
      color: COLORS.gauge.fatigue,
      backgroundColor: COLORS.gauge.fatigueBg,
    });

    this.clock = new Clock3x8(this, GAME_WIDTH - 216, 16);

    const hints = import.meta.env.DEV
      ? 'ÉCHAP : menu · [dev] T : +1 h · N : acte suivant'
      : 'ÉCHAP : menu';
    this.add
      .text(GAME_WIDTH - 16, GAME_HEIGHT - 12, hints, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: toCss(COLORS.sncb.textMuted),
      })
      .setOrigin(1, 1);

    this.registry.events.on(Phaser.Data.Events.CHANGE_DATA, this.onRegistryChange, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(Phaser.Data.Events.CHANGE_DATA, this.onRegistryChange, this);
    });

    this.refresh(getGameState(this.registry));
  }

  private onRegistryChange(_parent: unknown, key: string, value: unknown, previous: unknown): void {
    if (key !== RegistryKeys.GameState || !isGameState(value)) return;
    this.refresh(value);
    if (
      isGameState(previous) &&
      shiftAt(previous.time.totalMinutes) !== shiftAt(value.time.totalMinutes)
    ) {
      this.clock.flash();
    }
  }

  private refresh(state: GameState): void {
    const { player, time } = state;
    const tier = fatigueTier(time.fatigue);

    this.nameText.setText(player.name.toUpperCase());
    this.hpGauge.setValue(player.hp, player.maxHp);
    this.peGauge.setValue(player.energy, player.maxEnergy);
    this.fatigueGauge.setValue(
      time.fatigue,
      100,
      `${String(Math.floor(time.fatigue))} ${tier.label}`,
      FATIGUE_COLORS[tier.id],
    );
    this.clock.render(time);
  }
}
