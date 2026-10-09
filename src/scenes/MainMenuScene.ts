import Phaser from 'phaser';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  INPUT_GRACE_MS,
  RegistryKeys,
  SceneKeys,
} from '@/config/constants';
import { COLORS, toCss } from '@/config/colors';
import { HERO_NAMES } from '@/data/story';
import { browserStorage } from '@/platform/storage';
import type { GameState } from '@/systems/GameState';
import { createInitialGameState } from '@/systems/GameState';
import { SaveManager } from '@/systems/save/SaveManager';
import { formatClock } from '@/systems/time/FatigueClock';

interface MenuItem {
  readonly label: string;
  readonly enabled: boolean;
  readonly action: () => void;
}

const ROW = 44;

/**
 * Menu principal façon tableau des départs : Nouvelle partie (choix Léon / Léa) ou Continuer
 * (dernière sauvegarde, manuelle ou automatique). Une nouvelle partie repart toujours d'un état neuf.
 */
export class MainMenuScene extends Phaser.Scene {
  private items: readonly MenuItem[] = [];
  private rows: Phaser.GameObjects.Text[] = [];
  private selected = 0;
  private acceptInputAt = 0;

  public constructor() {
    super(SceneKeys.MainMenu);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(COLORS.sncb.bgDeep);
    this.acceptInputAt = this.time.now + INPUT_GRACE_MS;
    this.rows = [];

    this.add
      .text(GAME_WIDTH / 2, 130, 'PRIVATIX', {
        fontFamily: 'monospace',
        fontSize: '64px',
        color: toCss(COLORS.sncb.accent),
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 186, 'Le rail ne se vend pas.', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: toCss(COLORS.sncb.text),
      })
      .setOrigin(0.5);

    const latest = new SaveManager(browserStorage()).latest();
    this.showMenu([
      {
        label: 'Nouvelle partie',
        enabled: true,
        action: () => {
          this.chooseHero();
        },
      },
      {
        label: latest
          ? `Continuer (${latest.state.player.name}, ${formatClock(latest.state.time.totalMinutes)})`
          : 'Continuer',
        enabled: latest !== null,
        action: () => {
          if (latest) this.startGame(latest.state);
        },
      },
    ]);

    const kb = this.input.keyboard;
    for (const e of ['keydown-UP', 'keydown-Z', 'keydown-W'])
      kb?.on(e, () => {
        this.move(-1);
      });
    for (const e of ['keydown-DOWN', 'keydown-S'])
      kb?.on(e, () => {
        this.move(1);
      });
    for (const e of ['keydown-ENTER', 'keydown-SPACE', 'keydown-E'])
      kb?.on(e, () => {
        this.activate();
      });
  }

  private chooseHero(): void {
    this.showMenu(
      HERO_NAMES.map((name) => ({
        label: `Jouer ${name}`,
        enabled: true,
        action: () => {
          this.startGame(createInitialGameState(name));
        },
      })),
    );
  }

  private startGame(state: GameState): void {
    this.registry.set(RegistryKeys.GameState, state);
    this.scene.start(SceneKeys.Game);
  }

  private showMenu(items: readonly MenuItem[]): void {
    for (const r of this.rows) r.destroy();
    this.items = items;
    this.rows = items.map((item, i) => {
      const row = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40 + i * ROW, item.label, {
          fontFamily: 'monospace',
          fontSize: '22px',
          padding: { x: 16, y: 6 },
        })
        .setOrigin(0.5);
      if (item.enabled) {
        row.setInteractive({ useHandCursor: true });
        row.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
          this.select(i);
        });
        row.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
          this.select(i);
          this.activate();
        });
      }
      return row;
    });
    this.select(items.findIndex((i) => i.enabled));
    this.acceptInputAt = this.time.now + INPUT_GRACE_MS;
  }

  private move(delta: number): void {
    const count = this.items.length;
    for (let step = 1; step <= count; step += 1) {
      const index = (this.selected + delta * step + count * step) % count;
      if (this.items[index]?.enabled) {
        this.select(index);
        return;
      }
    }
  }

  private select(index: number): void {
    this.selected = Math.max(0, index);
    this.rows.forEach((row, i) => {
      const enabled = this.items[i]?.enabled ?? false;
      const active = i === this.selected;
      row.setText(`${active ? '▶ ' : '  '}${this.items[i]?.label ?? ''}`);
      row.setColor(
        toCss(!enabled ? COLORS.sncb.textMuted : active ? COLORS.sncb.boardText : COLORS.sncb.text),
      );
      row.setBackgroundColor(active && enabled ? toCss(COLORS.sncb.boardBg) : 'transparent');
    });
  }

  private activate(): void {
    if (this.time.now < this.acceptInputAt) return;
    const item = this.items[this.selected];
    if (item?.enabled) item.action();
  }
}
