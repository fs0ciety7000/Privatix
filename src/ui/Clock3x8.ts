import Phaser from 'phaser';
import { COLORS, toCss } from '@/config/colors';
import { BALANCE } from '@/config/balance';
import type { FatigueClockState } from '@/systems/time/FatigueClock';
import {
  formatClock,
  minuteOfDay,
  MINUTES_PER_DAY,
  shiftAt,
  shiftLabel,
} from '@/systems/time/FatigueClock';

const WIDTH = 200;
const HEIGHT = 80;
const BAR_X = 12;
const BAR_Y = 40;
const BAR_WIDTH = WIDTH - BAR_X * 2;
const BAR_HEIGHT = 8;

/**
 * Afficheur de l'horloge 3x8 (UX : bloc en haut à droite, style tableau de quai).
 * HH:MM, barre de 24 h segmentée en trois pauses avec un curseur « maintenant », libellé de la pause.
 * Composant d'affichage : il ne modifie jamais l'état de l'horloge.
 */
export class Clock3x8 extends Phaser.GameObjects.Container {
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly shiftText: Phaser.GameObjects.Text;
  private readonly overtimeText: Phaser.GameObjects.Text;
  private readonly cursor: Phaser.GameObjects.Rectangle;
  private overtimeTween: Phaser.Tweens.Tween | null = null;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    const panel = scene.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.sncb.panel, 0.92).setOrigin(0);
    panel.setStrokeStyle(2, COLORS.sncb.accent);

    this.timeText = scene.add.text(BAR_X, 8, '', {
      fontFamily: 'monospace',
      fontSize: '22px',
      fontStyle: 'bold',
      color: toCss(COLORS.sncb.accent),
    });
    this.overtimeText = scene.add
      .text(WIDTH - BAR_X, 13, "HEURES SUP'", {
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: toCss(COLORS.semantic.dangerText),
      })
      .setOrigin(1, 0)
      .setVisible(false);

    const segments = scene.add.graphics({ x: BAR_X, y: BAR_Y });
    this.drawSegments(segments);
    this.cursor = scene.add
      .rectangle(BAR_X, BAR_Y - 2, 2, BAR_HEIGHT + 4, COLORS.sncb.text)
      .setOrigin(0.5, 0);

    this.shiftText = scene.add.text(BAR_X, BAR_Y + BAR_HEIGHT + 6, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: toCss(COLORS.sncb.text),
    });

    this.add([panel, this.timeText, this.overtimeText, segments, this.cursor, this.shiftText]);
    scene.add.existing(this);
  }

  public render(time: FatigueClockState): void {
    const shift = shiftAt(time.totalMinutes);
    this.timeText.setText(formatClock(time.totalMinutes));
    this.shiftText.setText(`${shiftLabel(shift).toUpperCase()} · Acte ${String(time.act)}`);
    this.cursor.setX(
      BAR_X + Math.round((minuteOfDay(time.totalMinutes) / MINUTES_PER_DAY) * BAR_WIDTH),
    );
    this.setOvertime(time.overtime);
  }

  /** Petit flash du panneau à la relève (appelé par la scène lors d'un changement de pause). */
  public flash(): void {
    this.scene.tweens.add({ targets: this, alpha: { from: 0.3, to: 1 }, duration: 180, repeat: 2 });
  }

  public override destroy(fromScene?: boolean): void {
    this.overtimeTween?.remove();
    this.overtimeTween = null;
    super.destroy(fromScene);
  }

  private setOvertime(active: boolean): void {
    if (active === this.overtimeText.visible) return;
    this.overtimeText.setVisible(active);
    if (active) {
      this.overtimeTween = this.scene.tweens.add({
        targets: this.overtimeText,
        alpha: { from: 1, to: 0.25 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.overtimeTween?.remove();
      this.overtimeTween = null;
      this.overtimeText.setAlpha(1);
    }
  }

  /** Barre 24 h : 00-06 nuit, 06-14 matin, 14-22 après-midi, 22-24 nuit. */
  private drawSegments(g: Phaser.GameObjects.Graphics): void {
    const { morning, afternoon, night } = BALANCE.clock.PAUSE_START;
    const toX = (minute: number): number => Math.round((minute / MINUTES_PER_DAY) * BAR_WIDTH);
    const spans: readonly (readonly [number, number, number])[] = [
      [0, morning, COLORS.shift.night],
      [morning, afternoon, COLORS.shift.morning],
      [afternoon, night, COLORS.shift.afternoon],
      [night, MINUTES_PER_DAY, COLORS.shift.night],
    ];
    for (const [from, to, color] of spans) {
      g.fillStyle(color, 1).fillRect(toX(from), 0, toX(to) - toX(from), BAR_HEIGHT);
    }
    g.lineStyle(1, COLORS.sncb.bgDeep, 1).strokeRect(0, 0, BAR_WIDTH, BAR_HEIGHT);
  }
}
