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
import { metaSave } from '@/platform/save';
import { newMeta } from '@/systems/meta/MetaState';
import { getMeta } from '@/systems/meta/session';

/** Écran titre : « Prendre son poste » (OCC), effacer la progression, rappel des commandes. */
export class MainMenuScene extends Phaser.Scene {
  public constructor() {
    super(SceneKeys.MainMenu);
  }

  public create(): void {
    const style = {
      fontFamily: FONT,
      fontSize: '8px',
      color: Css.white,
      stroke: Css.outline,
      strokeThickness: 2,
    };
    this.cameras.main.setBackgroundColor(Colors.night);
    // Décor : voies qui défilent.
    const g = this.add.graphics();
    for (let i = 0; i < 2; i += 1) {
      const y = GAME_HEIGHT - 76 + i * 30;
      g.fillStyle(0x4a4440, 1).fillRect(0, y, GAME_WIDTH, 20);
      g.fillStyle(0xb8c0c8, 1)
        .fillRect(0, y + 4, GAME_WIDTH, 2)
        .fillRect(0, y + 14, GAME_WIDTH, 2);
    }
    const hero = this.add
      .sprite(GAME_WIDTH / 2 - 120, GAME_HEIGHT - 82, 'player_idle_side_strip6')
      .setScale(3)
      .setOrigin(0.5, 0.9167);
    if (this.anims.exists('player-idle-side')) hero.play('player-idle-side');
    const foe = this.add
      .sprite(GAME_WIDTH / 2 + 130, GAME_HEIGHT - 82, 'consultant_idle_side_strip4')
      .setScale(3)
      .setOrigin(0.5, 0.875)
      .setFlipX(true);
    if (this.anims.exists('consultant-idle-side')) foe.play('consultant-idle-side');

    const title = this.add
      .text(GAME_WIDTH / 2, 56, 'PRIVATIX', {
        ...style,
        fontSize: '32px',
        color: Css.hero,
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setResolution(2);
    this.tweens.add({
      targets: title,
      y: 60,
      yoyo: true,
      repeat: -1,
      duration: 1400,
      ease: 'Sine.easeInOut',
    });
    this.add
      .text(
        GAME_WIDTH / 2,
        88,
        'Gare de Mons, 6 h du matin. Les consultants arrivent. Le 7h12 n’arrivera pas.',
        { ...style, color: Css.ballast },
      )
      .setOrigin(0.5)
      .setResolution(2);

    const meta = getMeta(this.registry);
    const items: { label: string; action: () => void }[] = [
      {
        label:
          meta.stats.shifts > 0
            ? `Reprendre son poste (${String(meta.ps)} PS)`
            : 'Prendre son poste',
        action: () => {
          this.start();
        },
      },
      {
        label: 'Effacer la progression',
        action: () => {
          metaSave.clear();
          this.registry.set(RegistryKeys.Meta, newMeta());
          this.scene.restart();
        },
      },
    ];
    let selected = 0;
    const texts = items.map((it, i) => {
      const t = this.add
        .text(GAME_WIDTH / 2, 130 + i * 22, it.label, { ...style, fontSize: '10px' })
        .setOrigin(0.5)
        .setResolution(2)
        .setInteractive({ useHandCursor: true });
      t.on(Phaser.Input.Events.POINTER_OVER, () => {
        selected = i;
        refresh();
      });
      t.on(Phaser.Input.Events.POINTER_UP, () => {
        it.action();
      });
      return t;
    });
    const refresh = (): void => {
      texts.forEach((t, i) =>
        t
          .setColor(i === selected ? Css.quaiYellow : Css.white)
          .setText(`${i === selected ? '▶ ' : ''}${items[i]?.label ?? ''}`),
      );
    };
    refresh();
    const kb = this.input.keyboard;
    kb?.on('keydown-UP', () => {
      selected = (selected + items.length - 1) % items.length;
      refresh();
    });
    kb?.on('keydown-DOWN', () => {
      selected = (selected + 1) % items.length;
      refresh();
    });
    const confirm = (): void => items[selected]?.action();
    kb?.on('keydown-ENTER', confirm);
    kb?.on('keydown-SPACE', confirm);

    const help = [
      'ZQSD / WASD / flèches : se déplacer · Souris : viser · Clic gauche (ou J) : Frappe (combo 3 coups)',
      'Espace / Maj : Dash « Retard SNCB » (2 charges) · Clic droit / F : Coup de sifflet (maintenir : Préavis de grève)',
      'R : boire un Gobelet · E : interagir · Échap : pause · Tactile : joystick à gauche, boutons à droite',
    ];
    this.add
      .text(GAME_WIDTH / 2, 196, help.join('\n'), {
        ...style,
        color: Css.ballast,
        align: 'center',
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0)
      .setResolution(2);
  }

  private start(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start(SceneKeys.Hub),
    );
  }
}
