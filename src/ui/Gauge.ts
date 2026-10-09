import Phaser from 'phaser';
import { COLORS, toCss } from '@/config/colors';
import { clamp } from '@/utils/math';

export interface GaugeConfig {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly width?: number;
  readonly height?: number;
  readonly color: number;
  readonly backgroundColor: number;
}

const LABEL_WIDTH = 34;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: toCss(COLORS.sncb.text),
};

/**
 * Jauge horizontale (PV, PE, Fatigue) : libellé, barre, valeur texte.
 * Composant d'affichage pur : il ne lit aucun état, la scène lui pousse les valeurs.
 * La barre est un Graphics redessiné uniquement quand la valeur change (pas à chaque frame).
 */
export class Gauge extends Phaser.GameObjects.Container {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly barWidth: number;
  private readonly barHeight: number;
  private readonly backgroundColor: number;
  private color: number;
  private ratio = -1;

  public constructor(scene: Phaser.Scene, config: GaugeConfig) {
    super(scene, config.x, config.y);
    this.barWidth = config.width ?? 160;
    this.barHeight = config.height ?? 10;
    this.backgroundColor = config.backgroundColor;
    this.color = config.color;

    const label = scene.add.text(0, -2, config.label, TEXT_STYLE);
    this.bar = scene.add.graphics({ x: LABEL_WIDTH, y: 0 });
    this.valueText = scene.add.text(LABEL_WIDTH + this.barWidth + 8, -2, '', TEXT_STYLE);

    this.add([label, this.bar, this.valueText]);
    scene.add.existing(this);
  }

  /** Met à jour la barre ; `text` remplace l'affichage « valeur/max » par défaut. */
  public setValue(value: number, max: number, text?: string, color?: number): this {
    const ratio = max > 0 ? clamp(value / max, 0, 1) : 0;
    const nextColor = color ?? this.color;
    if (ratio !== this.ratio || nextColor !== this.color) {
      this.ratio = ratio;
      this.color = nextColor;
      this.redraw();
    }
    this.valueText.setText(text ?? `${Math.floor(value)}/${max}`);
    return this;
  }

  private redraw(): void {
    const filled = Math.round(this.barWidth * this.ratio);
    this.bar.clear();
    this.bar.fillStyle(this.backgroundColor, 1).fillRect(0, 0, this.barWidth, this.barHeight);
    if (filled > 0) {
      this.bar.fillStyle(this.color, 1).fillRect(0, 0, filled, this.barHeight);
    }
    this.bar.lineStyle(1, COLORS.sncb.border, 1).strokeRect(0, 0, this.barWidth, this.barHeight);
  }
}
