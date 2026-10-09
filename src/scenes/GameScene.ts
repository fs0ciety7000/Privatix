import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SceneKeys } from '@/config/constants';
import { COLORS, toCss } from '@/config/colors';
import { Player } from '@/entities/Player';
import type { GameState } from '@/systems/GameState';
import type { ClockResult } from '@/systems/time/FatigueClock';
import { advanceTime, realMsToGameMinutes, startNextAct } from '@/systems/time/FatigueClock';
import { getGameState, updateGameState } from '@/utils/registry';

/**
 * Game : scène d'exploration (gare de Mons).
 * Lance la scène UI en parallèle (overlay HUD) et la stoppe proprement au shutdown.
 *
 * Horloge 3x8 : elle n'avance que pendant `update`, donc elle est automatiquement figée
 * quand cette scène est en pause (dialogue) ou en veille (combat), comme le veut le GDD § 4.1.
 */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  /** Reliquat de temps réel pas encore converti en minute in-game (< 8 s). */
  private clockCarryMs = 0;

  public constructor() {
    super(SceneKeys.Game);
  }

  public create(): void {
    this.clockCarryMs = 0;
    this.cameras.main.setBackgroundColor(COLORS.sncb.panel);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 52, 'Gare de Mons - Quais (placeholder)', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: toCss(COLORS.sncb.text),
      })
      .setOrigin(0.5);

    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2);

    this.scene.launch(SceneKeys.UI);

    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);
    if (import.meta.env.DEV) {
      this.input.keyboard?.on('keydown-T', this.debugSkipHour, this);
      this.input.keyboard?.on('keydown-N', this.debugNextAct, this);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  public override update(_time: number, delta: number): void {
    this.player.update(delta);

    const { minutes, carryMs } = realMsToGameMinutes(this.clockCarryMs + delta);
    this.clockCarryMs = carryMs;
    if (minutes > 0) {
      this.applyClock((state) => advanceTime(state.time, minutes));
    }
  }

  /**
   * Applique une transition de l'horloge au GameState en une seule écriture registry.
   * Les événements (`result.events`) ne sont pas encore consommés ici : l'UI déduit la relève
   * en comparant l'ancien et le nouvel état. À venir : `collapsed` hors combat déclenchera la
   * Mise à pied (GDD § 4.3 et § 5.8) ; en attendant, le HUD affiche le palier « Effondré ».
   */
  private applyClock(transition: (state: GameState) => ClockResult): void {
    updateGameState(this.registry, (state) => ({ ...state, time: transition(state).state }));
  }

  private debugSkipHour(): void {
    this.applyClock((state) => advanceTime(state.time, 60));
  }

  private debugNextAct(): void {
    if (getGameState(this.registry).time.act < 3) {
      this.applyClock((state) => startNextAct(state.time));
    }
  }

  private returnToMenu(): void {
    this.scene.start(SceneKeys.MainMenu);
  }

  /** Libère tout ce que cette scène a créé hors de son display list (listeners, scènes parallèles). */
  private onShutdown(): void {
    this.input.keyboard?.off('keydown-ESC', this.returnToMenu, this);
    this.input.keyboard?.off('keydown-T', this.debugSkipHour, this);
    this.input.keyboard?.off('keydown-N', this.debugNextAct, this);
    this.scene.stop(SceneKeys.UI);
  }
}
