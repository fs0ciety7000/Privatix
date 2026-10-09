import Phaser from 'phaser';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  INPUT_GRACE_MS,
  RegistryKeys,
  SceneKeys,
  WORLD_ZOOM,
} from '@/config/constants';
import { BALANCE } from '@/config/balance';
import { CHARACTERS } from '@/data/characters';
import { MAPS } from '@/data/maps';
import type { Facing, MapId } from '@/data/types';
import { MapView } from '@/entities/MapView';
import { Player } from '@/entities/Player';
import { browserStorage } from '@/platform/storage';
import type { GameState } from '@/systems/GameState';
import { activeTimeModifiers, spawnPosition } from '@/systems/GameState';
import type { GridPos } from '@/systems/movement/GridMovement';
import { facingTile, neighbor } from '@/systems/movement/GridMovement';
import type { BattleSceneData } from '@/scenes/BattleScene';
import { isBattleResume } from '@/scenes/battleResume';
import { SaveManager } from '@/systems/save/SaveManager';
import { firstMatching } from '@/systems/story/Conditions';
import { contextOf } from '@/systems/story/DialogueRunner';
import { applyLayoff, LAYOFF_DIALOGUE } from '@/systems/story/Layoff';
import type { ClockResult } from '@/systems/time/FatigueClock';
import { advanceTime, realMsToGameMinutes, startNextAct } from '@/systems/time/FatigueClock';
import type { PlacedMarker, WorldMap } from '@/systems/world/WorldMap';
import { buildWorldMap, interactableAt, isBlocked, stepMarkerAt } from '@/systems/world/WorldMap';
import { getGameState, pushNotice, updateGameState } from '@/utils/registry';

export interface DialogueSceneData {
  readonly dialogueId: string;
}

const OPPOSITE: Readonly<Record<Facing, Facing>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

interface MoveKeys {
  readonly up: readonly Phaser.Input.Keyboard.Key[];
  readonly down: readonly Phaser.Input.Keyboard.Key[];
  readonly left: readonly Phaser.Input.Keyboard.Key[];
  readonly right: readonly Phaser.Input.Keyboard.Key[];
  readonly run: Phaser.Input.Keyboard.Key;
}

/**
 * Game : exploration case par case (gare de Mons, OCC).
 * Lit la carte courante depuis le GameState, déplace le héros, déclenche portails, dialogues et horloge.
 * Les dialogues mettent cette scène en pause : l'horloge et les déplacements sont alors figés d'office.
 */
export class GameScene extends Phaser.Scene {
  private world!: WorldMap;
  private view: MapView | null = null;
  private player!: Player;
  /** La scène est réutilisée entre deux `start` : le héros de la partie précédente a été détruit. */
  private playerReady = false;
  private keys: MoveKeys | null = null;
  private clockCarryMs = 0;
  /** Horodatage avant lequel la touche d'interaction est ignorée (évite de rouvrir un dialogue en le fermant). */
  private interactBlockedUntil = 0;
  private hint: string | null = null;

  public constructor() {
    super(SceneKeys.Game);
  }

  public create(): void {
    this.clockCarryMs = 0;
    this.hint = null;
    this.view = null;
    this.playerReady = false;
    this.interactBlockedUntil = this.time.now + INPUT_GRACE_MS;
    this.cameras.main.setZoom(WORLD_ZOOM).setBackgroundColor(0x05080f);
    this.setupInput();

    this.scene.launch(SceneKeys.UI);
    this.loadCurrentMap(true);

    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.registry.events.on(Phaser.Data.Events.CHANGE_DATA, this.onRegistryChange, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  public override update(time: number, delta: number): void {
    const { minutes, carryMs } = realMsToGameMinutes(this.clockCarryMs + delta);
    this.clockCarryMs = carryMs;
    if (minutes > 0) {
      this.applyClock((state) => advanceTime(state.time, minutes, activeTimeModifiers(state)));
      if (this.checkCollapse()) return;
    }

    if (this.player.isMoving() || time < this.interactBlockedUntil) return;
    const dir = this.readDirection();
    if (dir) {
      const ctx = contextOf(getGameState(this.registry));
      // Foncer sur un groupe d'ennemis visible lance le combat.
      const ahead = neighbor(this.player.gridPos.tileX, this.player.gridPos.tileY, dir);
      const foe = interactableAt(this.world, ahead.tileX, ahead.tileY, ctx);
      if (foe?.def.kind === 'encounter') {
        this.startMapBattle(foe);
        return;
      }
      const run = this.keys?.run.isDown ?? false;
      this.player.tryStep(
        dir,
        (x, y) => isBlocked(this.world, x, y, ctx),
        run,
        (pos) => {
          this.onArrive(pos);
        },
      );
      this.updateHint();
    }
  }

  // -------------------------------------------------------------------------
  // Carte
  // -------------------------------------------------------------------------

  /** (Re)construit la carte du GameState et place le héros. `runOnEnter` joue l'éventuel dialogue d'arrivée. */
  private loadCurrentMap(runOnEnter: boolean): void {
    const state = getGameState(this.registry);
    this.world = buildWorldMap(MAPS[state.position.mapId]);
    this.view?.destroy();
    this.view = new MapView(this, this.world);
    this.view.refresh(contextOf(state));

    const pos: GridPos = {
      tileX: state.position.tileX,
      tileY: state.position.tileY,
      facing: state.position.facing,
    };
    if (this.playerReady) {
      this.player.placeAt(pos);
    } else {
      this.player = new Player(this, pos);
      this.playerReady = true;
    }

    this.view.setFocus(pos.tileX, pos.tileY);
    this.setupCamera();
    // Au premier chargement, l'UIScene (lancée en parallèle) n'existe pas encore : elle annonce la zone à sa création.
    if (this.scene.isActive(SceneKeys.UI)) pushNotice(this.registry, this.world.def.name);
    if (state.position.mapId === 'occ') this.autosave();
    this.updateHint();

    if (runOnEnter) {
      const enter = firstMatching(this.world.def.onEnter, contextOf(state));
      if (enter)
        this.time.delayedCall(1, () => {
          this.openDialogue(enter.dialogue);
        });
    }
  }

  /** Caméra zoomée qui suit le héros ; une carte plus petite que l'écran est centrée. */
  private setupCamera(): void {
    const cam = this.cameras.main;
    const viewW = GAME_WIDTH / WORLD_ZOOM;
    const viewH = GAME_HEIGHT / WORLD_ZOOM;
    const w = this.view?.widthPx ?? viewW;
    const h = this.view?.heightPx ?? viewH;
    const boundsW = Math.max(w, viewW);
    const boundsH = Math.max(h, viewH);
    cam.setBounds(-(boundsW - w) / 2, -(boundsH - h) / 2, boundsW, boundsH);
    cam.startFollow(this.player, true);
  }

  private travel(to: MapId, spawn: string): void {
    updateGameState(this.registry, (state) => ({
      ...state,
      time: advanceTime(state.time, BALANCE.clock.COST_MIN.zoneChange, activeTimeModifiers(state))
        .state,
      position: spawnPosition(to, spawn),
    }));
    if (!this.checkCollapse()) this.loadCurrentMap(true);
  }

  // -------------------------------------------------------------------------
  // Déplacements et interactions
  // -------------------------------------------------------------------------

  private onArrive(pos: GridPos): void {
    this.view?.setFocus(pos.tileX, pos.tileY);
    updateGameState(this.registry, (state) => ({
      ...state,
      position: {
        mapId: this.world.def.id,
        tileX: pos.tileX,
        tileY: pos.tileY,
        facing: pos.facing,
      },
    }));
    const marker = stepMarkerAt(this.world, pos.tileX, pos.tileY);
    if (marker?.def.kind === 'portal') {
      this.travel(marker.def.to, marker.def.spawn);
      return;
    }
    if (marker?.def.kind === 'trigger') {
      const trigger = firstMatching(
        marker.def.interactions,
        contextOf(getGameState(this.registry)),
      );
      if (trigger) this.openDialogue(trigger.dialogue);
    }
    this.updateHint();
  }

  private facingInteractable(): PlacedMarker | null {
    const target = facingTile(this.player.gridPos);
    return interactableAt(
      this.world,
      target.tileX,
      target.tileY,
      contextOf(getGameState(this.registry)),
    );
  }

  private interact(): void {
    if (
      this.player.isMoving() ||
      this.time.now < this.interactBlockedUntil ||
      !this.scene.isActive()
    )
      return;
    const marker = this.facingInteractable();
    if (marker?.def.kind === 'encounter') {
      this.startMapBattle(marker);
      return;
    }
    if (!marker || (marker.def.kind !== 'npc' && marker.def.kind !== 'prop')) return;
    const interaction = firstMatching(
      marker.def.interactions,
      contextOf(getGameState(this.registry)),
    );
    if (!interaction) return;
    this.view?.faceNpc(marker, OPPOSITE[this.player.gridPos.facing]);
    this.syncFacing();
    this.openDialogue(interaction.dialogue);
  }

  private openDialogue(dialogueId: string): void {
    this.setHint(null);
    const data: DialogueSceneData = { dialogueId };
    this.scene.pause();
    this.scene.launch(SceneKeys.Dialogue, data);
  }

  /** Lance un combat contre un groupe visible ; la scène est mise en pause pendant le combat. */
  private startMapBattle(marker: PlacedMarker): void {
    if (marker.def.kind !== 'encounter' || !this.scene.isActive()) return;
    this.setHint(null);
    const data: BattleSceneData = {
      encounterId: marker.def.encounter,
      caller: SceneKeys.Game,
      markerKey: marker.key,
    };
    this.scene.pause();
    this.scene.launch(SceneKeys.Battle, data);
  }

  /** Retour de dialogue ou de combat : téléportation, visibilité des PNJ, défaite, effondrement. */
  private onResume(_sys: Phaser.Scenes.Systems, data?: unknown): void {
    this.interactBlockedUntil = this.time.now + INPUT_GRACE_MS;
    const state = getGameState(this.registry);
    if (isBattleResume(data) && data.battleOutcome === 'defeat') {
      // Combat perdu (sur la carte ou dans un dialogue) : la Mise à pied est déjà appliquée au GameState.
      this.loadCurrentMap(false);
      this.time.delayedCall(1, () => {
        this.openDialogue(LAYOFF_DIALOGUE);
      });
      return;
    }
    if (this.checkCollapse()) return;
    if (state.position.mapId !== this.world.def.id) {
      this.loadCurrentMap(true);
      return;
    }
    const p = this.player.gridPos;
    if (p.tileX !== state.position.tileX || p.tileY !== state.position.tileY) {
      this.player.placeAt({
        tileX: state.position.tileX,
        tileY: state.position.tileY,
        facing: state.position.facing,
      });
      this.view?.setFocus(state.position.tileX, state.position.tileY);
    }
    this.view?.refresh(contextOf(state));
    this.updateHint();
  }

  /** Fatigue à 100 hors combat : Mise à pied (GDD § 5.8). Renvoie vrai si elle a eu lieu. */
  private checkCollapse(): boolean {
    if (getGameState(this.registry).time.fatigue < BALANCE.fatigue.MAX) return false;
    updateGameState(this.registry, applyLayoff);
    this.loadCurrentMap(false);
    this.time.delayedCall(1, () => {
      this.openDialogue(LAYOFF_DIALOGUE);
    });
    return true;
  }

  private updateHint(): void {
    const marker = this.player.isMoving() ? null : this.facingInteractable();
    let hint: string | null = null;
    if (marker?.def.kind === 'npc') hint = `Parler à ${CHARACTERS[marker.def.character].name}`;
    if (marker?.def.kind === 'prop') hint = `Examiner : ${marker.def.label}`;
    if (marker?.def.kind === 'encounter') hint = `Combattre : ${marker.def.label}`;
    this.setHint(hint);
  }

  private setHint(hint: string | null): void {
    if (hint === this.hint) return;
    this.hint = hint;
    this.registry.set(RegistryKeys.InteractionHint, hint);
  }

  private syncFacing(): void {
    const facing = this.player.gridPos.facing;
    updateGameState(this.registry, (state) => ({
      ...state,
      position: { ...state.position, facing },
    }));
  }

  private autosave(): void {
    new SaveManager(browserStorage()).save('auto', getGameState(this.registry));
  }

  // -------------------------------------------------------------------------
  // Entrées
  // -------------------------------------------------------------------------

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) {
      this.keys = null;
      return;
    }
    const K = Phaser.Input.Keyboard.KeyCodes;
    const add = (...codes: number[]): Phaser.Input.Keyboard.Key[] => codes.map((c) => kb.addKey(c));
    // ZQSD (AZERTY) et WASD (QWERTY) sont enregistrés tous les deux, plus les flèches.
    this.keys = {
      up: add(K.Z, K.W, K.UP),
      down: add(K.S, K.DOWN),
      left: add(K.Q, K.A, K.LEFT),
      right: add(K.D, K.RIGHT),
      run: kb.addKey(K.SHIFT),
    };
    for (const event of ['keydown-E', 'keydown-SPACE', 'keydown-ENTER'])
      kb.on(event, this.interact, this);
    kb.on('keydown-ESC', this.returnToMenu, this);
    if (import.meta.env.DEV) {
      kb.on('keydown-T', this.debugSkipHour, this);
      kb.on('keydown-N', this.debugNextAct, this);
    }
  }

  private readDirection(): Facing | null {
    const virtual = this.registry.get(RegistryKeys.VirtualDir) as Facing | null | undefined;
    if (virtual) return virtual;
    if (!this.keys) return null;
    const held = (keys: readonly Phaser.Input.Keyboard.Key[]): boolean =>
      keys.some((k) => k.isDown);
    if (held(this.keys.up)) return 'up';
    if (held(this.keys.down)) return 'down';
    if (held(this.keys.left)) return 'left';
    if (held(this.keys.right)) return 'right';
    return null;
  }

  private onRegistryChange(_parent: unknown, key: string): void {
    if (key === RegistryKeys.VirtualAction) this.interact();
  }

  private applyClock(transition: (state: GameState) => ClockResult): void {
    updateGameState(this.registry, (state) => ({ ...state, time: transition(state).state }));
  }

  private debugSkipHour(): void {
    this.applyClock((state) => advanceTime(state.time, 60, activeTimeModifiers(state)));
    this.checkCollapse();
  }

  private debugNextAct(): void {
    if (getGameState(this.registry).time.act < 3)
      this.applyClock((state) => startNextAct(state.time));
  }

  private returnToMenu(): void {
    this.scene.start(SceneKeys.MainMenu);
  }

  /** Libère ce qui survit à la scène : écouteurs du registry, scène UI lancée en parallèle. */
  private onShutdown(): void {
    this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.registry.events.off(Phaser.Data.Events.CHANGE_DATA, this.onRegistryChange, this);
    this.view?.destroy();
    this.view = null;
    this.registry.set(RegistryKeys.InteractionHint, null);
    this.scene.stop(SceneKeys.UI);
  }
}
