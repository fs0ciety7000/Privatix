import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RegistryKeys, SceneKeys } from '@/config/constants';
import { COLORS, toCss } from '@/config/colors';
import type { FatigueTierId } from '@/config/balance';
import { OBJECTIVES } from '@/data/objectives';
import { isGameState } from '@/systems/GameState';
import type { GameState } from '@/systems/GameState';
import { contextOf } from '@/systems/story/DialogueRunner';
import { currentObjective } from '@/systems/story/Objectives';
import { fatigueTier, shiftAt } from '@/systems/time/FatigueClock';
import { Clock3x8 } from '@/ui/Clock3x8';
import { Gauge } from '@/ui/Gauge';
import { VirtualPad } from '@/ui/VirtualPad';
import { getGameState, isNotice } from '@/utils/registry';

const FATIGUE_COLORS: Readonly<Record<FatigueTierId, number>> = {
  frais: COLORS.gauge.fatigue,
  fatigue: COLORS.gauge.fatigue,
  epuise: COLORS.gauge.fatigueHeavy,
  'burn-out': COLORS.gauge.fatigueBurnout,
  effondre: COLORS.gauge.fatigueBurnout,
};

const TOAST_TOP = 112;
const TOAST_GAP = 34;
const TOAST_LIFETIME_MS = 2600;

/**
 * UI : scène overlay lancée au-dessus de Game.
 * HUD d'exploration (UX § 3.2) : statut PV/PE/Fatigue, horloge 3x8, invite d'interaction, bandeaux, pad tactile.
 * Aucune logique de jeu : elle lit le registry et réagit à ses changements.
 */
export class UIScene extends Phaser.Scene {
  private nameText!: Phaser.GameObjects.Text;
  private hpGauge!: Gauge;
  private peGauge!: Gauge;
  private fatigueGauge!: Gauge;
  private clock!: Clock3x8;
  private hintText!: Phaser.GameObjects.Text;
  private toasts: Phaser.GameObjects.Text[] = [];
  private touch = false;

  public constructor() {
    super(SceneKeys.UI);
  }

  public create(): void {
    this.toasts = [];
    this.touch = this.sys.game.device.input.touch;

    const status = this.add.rectangle(16, 16, 272, 80, COLORS.sncb.panel, 0.92).setOrigin(0);
    status.setStrokeStyle(2, COLORS.sncb.border);
    this.nameText = this.add.text(28, 22, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: toCss(COLORS.sncb.accent),
    });
    const gauge = { x: 28, width: 140 } as const;
    this.hpGauge = new Gauge(this, {
      ...gauge,
      y: 42,
      label: 'PV',
      color: COLORS.gauge.hp,
      backgroundColor: COLORS.gauge.hpBg,
    });
    this.peGauge = new Gauge(this, {
      ...gauge,
      y: 58,
      label: 'PE',
      color: COLORS.gauge.pe,
      backgroundColor: COLORS.gauge.peBg,
    });
    this.fatigueGauge = new Gauge(this, {
      ...gauge,
      y: 74,
      label: 'FAT',
      color: COLORS.gauge.fatigue,
      backgroundColor: COLORS.gauge.fatigueBg,
    });
    this.clock = new Clock3x8(this, GAME_WIDTH - 216, 16);

    this.hintText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 72, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: toCss(COLORS.sncb.bgDeep),
        backgroundColor: toCss(COLORS.sncb.accent),
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    if (this.touch) new VirtualPad(this);

    const keysHelp = import.meta.env.DEV
      ? 'E : interagir · Maj : courir · ÉCHAP : menu · [dev] T : +1 h · N : acte suivant'
      : 'E : interagir · Maj : courir · ÉCHAP : menu';
    if (!this.touch) {
      this.add
        .text(GAME_WIDTH - 16, GAME_HEIGHT - 12, keysHelp, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: toCss(COLORS.sncb.textMuted),
        })
        .setOrigin(1, 1);
    }

    this.registry.events.on(Phaser.Data.Events.CHANGE_DATA, this.onRegistryChange, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(Phaser.Data.Events.CHANGE_DATA, this.onRegistryChange, this);
    });

    this.refresh(getGameState(this.registry));
    this.showHint(this.registry.get(RegistryKeys.InteractionHint));
  }

  private onRegistryChange(_parent: unknown, key: string, value: unknown, previous: unknown): void {
    if (key === RegistryKeys.InteractionHint) {
      this.showHint(value);
      return;
    }
    if (key === RegistryKeys.Notice) {
      if (isNotice(value)) this.toast(value.text);
      return;
    }
    if (key !== RegistryKeys.GameState || !isGameState(value)) return;
    this.refresh(value);
    if (!isGameState(previous)) return;
    if (shiftAt(previous.time.totalMinutes) !== shiftAt(value.time.totalMinutes))
      this.clock.flash();
    const before = currentObjective(OBJECTIVES, contextOf(previous));
    const after = currentObjective(OBJECTIVES, contextOf(value));
    if (after && before !== after) this.toast(`Objectif : ${after.text}`);
  }

  private refresh(state: GameState): void {
    const { player, time } = state;
    const tier = fatigueTier(time.fatigue);
    this.nameText.setText(
      `${player.name.toUpperCase()} · Moral ${String(Math.floor(state.moral))}`,
    );
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

  private showHint(value: unknown): void {
    const text = typeof value === 'string' ? value : null;
    this.hintText
      .setText(text ? `${this.touch ? '[A]' : '[E]'} ${text}` : '')
      .setVisible(text !== null);
  }

  /** Bandeau temporaire, empilé sous le HUD, centré. */
  private toast(text: string): void {
    const toast = this.add
      .text(GAME_WIDTH / 2, TOAST_TOP + this.toasts.length * TOAST_GAP, text, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: toCss(COLORS.sncb.text),
        backgroundColor: toCss(COLORS.sncb.bgDeep),
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.toasts.push(toast);
    this.tweens.add({ targets: toast, alpha: 1, duration: 150 });
    this.time.delayedCall(TOAST_LIFETIME_MS, () => {
      this.tweens.add({
        targets: toast,
        alpha: 0,
        duration: 250,
        onComplete: () => {
          this.toasts = this.toasts.filter((t) => t !== toast);
          toast.destroy();
          this.toasts.forEach((t, i) => t.setY(TOAST_TOP + i * TOAST_GAP));
        },
      });
    });
  }
}
