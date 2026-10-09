import Phaser from 'phaser';
import {
  Colors,
  Css,
  FONT,
  GAME_HEIGHT,
  GAME_WIDTH,
  RegistryKeys,
  SceneKeys,
} from '@/config/constants';
import { SHIFTS } from '@/config/balance';
import type { ShiftResult } from '@/systems/meta/RunState';
import { clockLabel } from '@/systems/procedural/ShiftPlan';

/** Écran des départs de fin de Shift : « Shift — SUPPRIMÉ — cause : … » ou « Shift tenu ». */
export class ResultsScene extends Phaser.Scene {
  public constructor() {
    super(SceneKeys.Results);
  }

  public create(): void {
    const result = this.registry.get(RegistryKeys.LastResult) as ShiftResult | null;
    const style = { fontFamily: FONT, fontSize: '8px', color: Css.white };
    this.cameras.main.setBackgroundColor(0x05080d);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 460, 250, 0x0b1f3a)
      .setStrokeStyle(2, Colors.outline);
    if (!result) {
      this.scene.start(SceneKeys.Hub);
      return;
    }
    const shift = SHIFTS[result.shift];
    const won = result.end === 'victoire';
    const clock = clockLabel(shift.startHour, result.clock);
    this.add
      .text(GAME_WIDTH / 2, 70, 'DÉPARTS — GARE DE MONS', {
        ...style,
        fontSize: '10px',
        color: Css.quaiYellow,
      })
      .setOrigin(0.5)
      .setResolution(2);
    const status = won ? 'À L’HEURE — SHIFT TENU' : 'SUPPRIMÉ';
    const rows: [string, string][] = [
      [`Shift du ${shift.label}`, status],
      ['Fin de service', won ? clock : `anticipée à ${clock}`],
      ['Cause', won ? 'L’Auditeur des Quais est rentré chez lui' : (result.cause ?? 'Fatigue')],
      ['Salle atteinte', `${String(result.room)} / 10`],
      ['Ennemis renvoyés', String(result.kills)],
      ['Avantages acquis', String(result.avantages)],
      ['Points de Syndicalisme', `+${String(result.psEarned)} (acquis à 100 %)`],
      ['Grains de café', `+${String(result.grainsEarned)}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 98 + i * 18;
      this.add.text(GAME_WIDTH / 2 - 210, y, k, { ...style, color: Css.ballast }).setResolution(2);
      this.add
        .text(GAME_WIDTH / 2 + 210, y, v, {
          ...style,
          color: i === 0 ? (won ? '#5bd17a' : '#ff5a3a') : Css.white,
        })
        .setOrigin(1, 0)
        .setResolution(2);
    });
    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 50, 'Retour à l’OCC — clic, toucher ou Entrée', {
        ...style,
        color: Css.quaiYellow,
      })
      .setOrigin(0.5)
      .setResolution(2);
    this.tweens.add({ targets: hint, alpha: 0.3, yoyo: true, repeat: -1, duration: 600 });
    const go = (): void => {
      this.scene.start(SceneKeys.Hub, { fromResult: result.end });
    };
    this.time.delayedCall(600, () => {
      this.input.once(Phaser.Input.Events.POINTER_UP, go);
      this.input.keyboard?.once('keydown-ENTER', go);
      this.input.keyboard?.once('keydown-SPACE', go);
      this.input.keyboard?.once('keydown-E', go);
    });
  }
}
