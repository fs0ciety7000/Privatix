import { COFFEE, ENEMY_NAMES } from '@/config/balance';
import type { EnemyKind } from '@/config/balance';
import { loadMeta } from '@/platform/save';
import { browserStorage } from '@/platform/storage';
import { autoAimTarget } from '@/sim/aim';
import { FixedClock, SIM_DT_MS } from '@/sim/clock/FixedClock';
import type { SimEvent } from '@/sim/events';
import { NO_INTENT } from '@/sim/intent';
import { World } from '@/sim/World';
import { AVANTAGES_BY_ID, RARITIES } from '@/systems/meta/Avantages';
import { maxEnergy } from '@/systems/meta/RunState';
import type { RawInput, TouchElements } from '@/engine/Input';
import { Input } from '@/engine/Input';
import type { HudSnapshot } from '@/ui/hud/Hud';
import { Hud } from '@/ui/hud/Hud';
import type { OptionsState } from '@/ui/menus/Menus';
import { Menus } from '@/ui/menus/Menus';
import { GameView } from '@/view/GameView';
import type { QualityId, ViewSettings } from '@/view/quality';
import { isQualityId, QUALITY } from '@/view/quality';

/** Portée de l'aide à la visée tactile (u) : 4,5 m. */
const AUTO_AIM_RANGE = 135;
/** Fondus (temps réel, ms), comme la version Phaser. */
const FADE_OUT_MS = 220;
const FADE_IN_MS = 260;
const END_FADE_MS = 600;
const QUALITY_KEY = 'privatix.3d.quality';

export interface SceneDom {
  readonly app: HTMLElement;
  readonly ui: HTMLElement;
  readonly floats: HTMLElement;
  readonly touch: TouchElements | null;
}

type Phase = 'title' | 'run' | 'results';

/**
 * Jeu 3D (jalon J4) : écran titre → Shift complet (salles, portes, vagues, récompenses, boss) → écran
 * des départs → retour au titre. Mince par construction : relie la simulation (`sim/`, dont
 * `RunDirector` porte le flux de `RunScene`), la vue (`view/`), les entrées (`engine/`), le HUD et les
 * menus DOM (`ui/`), qui ne se connaissent pas entre eux.
 */
export class Game3D {
  private world: World;
  private view: GameView;
  private clock: FixedClock;
  private readonly input: Input;
  private readonly hud: Hud;
  private readonly menus: Menus;
  private phase: Phase = 'title';
  private seed: number;
  private statsT = 0;
  private hidden = false;
  /** Après la fermeture d'un menu, on ignore une frame d'entrées (la touche qui ferme n'agit pas en jeu). */
  private afterModal = false;
  private resultsIn = -1;
  private settings: ViewSettings;
  /** Forçage des axes et de la visée (captures automatisées, outil de démonstration en dev). */
  public override: { moveX?: number; moveY?: number; aim?: number } = {};
  /** Raccourcis de test (`?cheat`, dev uniquement). */
  private readonly cheats: boolean;
  private cheatQueue: string[] = [];
  private readonly cheatHandler: (e: KeyboardEvent) => void;

  public constructor(
    private readonly dom: SceneDom,
    settings: ViewSettings,
    private readonly safe: boolean,
    seed: number,
    private readonly onReducedMotion: (on: boolean) => void,
    cheats: boolean,
  ) {
    this.settings = settings;
    this.seed = seed;
    this.cheats = cheats;
    this.world = this.backdropWorld();
    this.clock = new FixedClock(this.world.time);
    this.view = new GameView(dom.app, dom.floats, this.world, settings, safe);
    this.input = new Input(dom.app, dom.touch);
    this.hud = new Hud(dom.ui);
    this.menus = new Menus(
      dom.ui,
      () => {
        this.input.press('interact');
      },
      () => {
        if (this.phase === 'run' && !this.menus.open) this.openPause();
      },
    );
    this.menus.reducedMotion = settings.reducedMotion;
    this.cheatHandler = (e) => {
      if (!e.repeat && ['KeyK', 'KeyG', 'KeyN', 'KeyB'].includes(e.code))
        this.cheatQueue.push(e.code.slice(3));
    };
    if (cheats) document.addEventListener('keydown', this.cheatHandler);
    this.showTitle();
  }

  public get simWorld(): World {
    return this.world;
  }

  public get gameView(): GameView {
    return this.view;
  }

  public get controls(): Input {
    return this.input;
  }

  public get state(): Phase {
    return this.phase;
  }

  public get menuScreen(): string {
    return this.menus.current;
  }

  public resize(w: number, h: number): void {
    this.view.resize(w, h);
  }

  public setHidden(hidden: boolean): void {
    this.hidden = hidden;
  }

  /** Décor du titre : la salle de départ, sans vagues, le héros au repos. */
  private backdropWorld(): World {
    return new World({ seed: this.seed, waves: false, room: 'quai-1' });
  }

  // ─── Écrans ────────────────────────────────────────────────────────────────

  private showTitle(): void {
    this.phase = 'title';
    this.hud.setVisible(false);
    this.menus.showPauseButton(false);
    this.menus.setBoss(null);
    this.menus.setPrompt(null, 0, 0, false);
    this.menus.showTitle(
      () => {
        this.startRun();
      },
      () => {
        this.openOptions(() => {
          this.showTitle();
        });
      },
    );
  }

  /** Nouveau Shift : nouveau monde (graine suivante), nouvelle vue. */
  public startRun(): void {
    this.menus.close();
    this.seed += 1;
    this.world = new World({ seed: this.seed, meta: loadMeta() });
    this.clock = new FixedClock(this.world.time);
    this.rebuildView();
    this.phase = 'run';
    this.resultsIn = -1;
    this.afterModal = true;
    this.hud.setVisible(true);
    this.menus.showPauseButton(this.input.touch);
    this.menus.fade(1, 0);
    this.menus.fade(0, 400);
    this.hud.announce('QUAI 3 · PRISE DE SERVICE', 2.2, 'gold');
  }

  private openPause(): void {
    const run = this.world.run;
    this.menus.showPause(
      {
        seed: run.seed.toString(36).toUpperCase().padStart(7, '0'),
        avantages: run.avantages.map((a) => {
          const def = AVANTAGES_BY_ID.get(a.id);
          const r = RARITIES[a.rarity];
          return `${def?.name ?? a.id} (${r.label}) — ${def?.describe(r.mult) ?? ''}`;
        }),
      },
      () => {
        this.menus.close();
      },
      () => {
        this.openOptions(() => {
          this.openPause();
        });
      },
      () => {
        this.menus.close();
        this.world.director.endShift('mort');
      },
    );
  }

  private openOptions(back: () => void): void {
    const state: OptionsState = {
      quality: this.settings.quality.id,
      reducedMotion: this.settings.reducedMotion,
    };
    this.menus.showOptions(
      state,
      (next) => {
        this.applyOptions(next);
        this.openOptions(back);
      },
      back,
    );
  }

  private applyOptions(next: OptionsState): void {
    const quality = QUALITY[next.quality];
    const changed =
      quality.id !== this.settings.quality.id || next.reducedMotion !== this.settings.reducedMotion;
    if (!changed) return;
    if (next.reducedMotion !== this.settings.reducedMotion)
      this.onReducedMotion(next.reducedMotion);
    this.settings = { quality, reducedMotion: next.reducedMotion };
    this.menus.reducedMotion = next.reducedMotion;
    browserStorage()?.setItem(QUALITY_KEY, quality.id);
    this.rebuildView();
  }

  private showResults(): void {
    const result = this.world.director.result;
    if (!result) return;
    this.phase = 'results';
    this.hud.setVisible(false);
    this.menus.showPauseButton(false);
    this.menus.setBoss(null);
    this.menus.setPrompt(null, 0, 0, false);
    this.menus.fade(0, 300);
    this.menus.showResults(result, this.world.director.clock, () => {
      this.world = this.backdropWorld();
      this.clock = new FixedClock(this.world.time);
      this.rebuildView();
      this.showTitle();
    });
  }

  // ─── Boucle ────────────────────────────────────────────────────────────────

  /** Une frame : entrées → pas de simulation → événements → vue → HUD et menus. */
  public frame(realMs: number): void {
    const raw = this.input.read();
    if (raw.toggleStats) this.hud.toggleStats();
    if (raw.toggleReducedMotion && !this.menus.open)
      this.applyOptions({
        quality: this.settings.quality.id,
        reducedMotion: !this.settings.reducedMotion,
      });
    if (this.phase === 'run') this.runInput(raw);
    this.world.time.paused = this.hidden || this.menus.open || this.phase !== 'run';
    this.clock.frame(realMs, this.world);
    this.afterStep(realMs);

    const realDt = realMs / 1000;
    this.view.sync(this.clock.alpha, realDt);
    this.view.render(realDt);
    if (this.phase === 'run') this.updateOverlay(realDt);
    this.statsT += realDt;
    if (this.hud.statsVisible && this.statsT > 0.25) {
      this.statsT = 0;
      this.hud.showStats({
        ...this.view.stats(),
        quality: this.settings.quality.id,
        enemies: this.world.livingEnemies().length,
      });
    }
  }

  private runInput(raw: RawInput): void {
    const director = this.world.director;
    if (this.menus.open) {
      this.afterModal = true;
      return;
    }
    if (this.afterModal) {
      this.afterModal = false;
      return;
    }
    if (director.choice) return;
    if (raw.pause && !director.ended) {
      this.openPause();
      return;
    }
    if (this.cheats) this.runCheats();
    const o = this.override;
    this.world.queueIntent({
      moveX: o.moveX ?? raw.moveX,
      moveY: o.moveY ?? raw.moveY,
      aim: o.aim ?? this.aimFor(raw),
      attack: raw.attack,
      dash: raw.dash,
      special: raw.special,
      coffee: raw.coffee,
      specialHeld: raw.specialHeld,
      interact: raw.interact,
    });
  }

  private runCheats(): void {
    const d = this.world.director;
    for (const key of this.cheatQueue) {
      if (key === 'K') console.info(`[cheat] K ${String(d.cheatKillAll())}`);
      else if (key === 'G') d.godMode = !d.godMode;
      else if (key === 'N') d.cheatNext();
      else if (key === 'B') d.cheatBoss();
    }
    this.cheatQueue = [];
  }

  /** Après les pas : événements (vue, bandeaux, fondus), fenêtres de choix, fin du Shift. */
  private afterStep(realMs: number): void {
    const events = this.world.drainEvents();
    this.view.applyEvents(events);
    this.announce(events);
    const director = this.world.director;
    if (this.phase === 'run' && director.choice && !this.menus.open) {
      this.menus.showChoice(director.choice, (i) => {
        this.menus.close();
        this.world.director.choose(i);
      });
    }
    if (this.resultsIn >= 0) {
      this.resultsIn -= realMs;
      if (this.resultsIn < 0) this.showResults();
    }
  }

  /**
   * Avance la simulation de `ms` sans dessiner (outil de capture : le rendu logiciel est trop lent
   * pour jouer en temps réel). Les intentions viennent de `override` et des appuis simulés.
   */
  public fastForward(ms: number): void {
    const steps = Math.max(1, Math.round(ms / SIM_DT_MS));
    for (let i = 0; i < steps; i += 1) {
      const raw = this.input.read();
      if (this.phase === 'run' && !this.menus.open && !this.world.director.choice) {
        if (this.cheats) this.runCheats();
        const o = this.override;
        this.world.queueIntent({
          ...NO_INTENT,
          moveX: o.moveX ?? raw.moveX,
          moveY: o.moveY ?? raw.moveY,
          aim: o.aim ?? this.world.hero.facingAngle,
          attack: raw.attack,
          dash: raw.dash,
          special: raw.special,
          coffee: raw.coffee,
          specialHeld: raw.specialHeld,
          interact: raw.interact,
        });
      }
      this.world.time.paused = this.menus.open || this.phase !== 'run';
      this.clock.frame(SIM_DT_MS, this.world);
      this.afterStep(SIM_DT_MS);
      this.view.sync(this.clock.alpha, SIM_DT_MS / 1000);
    }
  }

  /** Angle de visée : stick droit, puis aide tactile, puis souris (rayon sur le sol), sinon l'actuel. */
  private aimFor(raw: RawInput): number {
    const hero = this.world.hero;
    const h = hero.body;
    if (raw.stickAim !== null) return raw.stickAim;
    if (raw.touchAttack || (this.input.touch && raw.pointer === null)) {
      const target = autoAimTarget(
        h,
        this.world
          .livingEnemies()
          .map((e) => ({ x: e.body.x, y: e.body.y, hittable: e.isHittable() })),
        AUTO_AIM_RANGE,
      );
      if (target) return Math.atan2(target.y - h.y, target.x - h.x);
      if (raw.moveX !== 0 || raw.moveY !== 0) return Math.atan2(raw.moveY, raw.moveX);
      return hero.facingAngle;
    }
    if (raw.pointer) {
      const p = this.view.groundPoint(raw.pointer.x, raw.pointer.y);
      if (p && Math.hypot(p.x - h.x, p.y - h.y) > 4) return Math.atan2(p.y - h.y, p.x - h.x);
    }
    return hero.facingAngle;
  }

  private announce(events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'wave':
          if (e.index === 1) this.hud.announce(`VAGUE 1 / ${String(e.count)}`, 1.4, 'danger');
          else this.hud.announce(`VAGUE ${String(e.index)} / ${String(e.count)}`, 1.4, 'danger');
          break;
        case 'roomCleared':
          this.hud.announce('SALLE NETTOYÉE · PORTES OUVERTES', 2, 'gold');
          break;
        case 'notice':
          if (this.phase === 'run')
            this.hud.announce(e.text, 2.4, e.tone === 'hero' ? 'info' : e.tone);
          break;
        case 'bossPhase':
          this.hud.announce(e.title, 2.4, 'danger');
          break;
        case 'doorTaken':
          this.menus.fade(1, FADE_OUT_MS);
          break;
        case 'roomEntered':
          if (this.phase === 'run') this.menus.fade(0, FADE_IN_MS);
          break;
        case 'heroDied':
          this.hud.announce('FIN DE SERVICE', 2.4, 'danger');
          break;
        case 'shiftEnded':
          this.menus.fade(1, END_FADE_MS);
          this.resultsIn = END_FADE_MS + 200;
          break;
        default:
          break;
      }
    }
  }

  /** HUD, invite contextuelle et barre du boss. */
  private updateOverlay(realDt: number): void {
    this.hud.update(this.snapshot(), realDt);
    const director = this.world.director;
    const prompt = director.prompt;
    if (prompt && !this.menus.open && !director.frozen) {
      const p = this.view.toScreen(prompt.x, prompt.y, prompt.door ? 2.9 : 2.0);
      this.menus.setPrompt(prompt.label, p.x, p.y, !prompt.door && !this.input.touch);
    } else this.menus.setPrompt(null, 0, 0, false);
    const boss = director.boss;
    this.menus.setBoss(
      boss && !boss.isDead && boss.materialized
        ? { name: ENEMY_NAMES.auditeur, ratio: boss.hp / boss.maxHp, phase: boss.phase }
        : null,
    );
  }

  private snapshot(): HudSnapshot {
    const run = this.world.run;
    const d = this.world.director;
    return {
      energy: run.energy,
      maxEnergy: maxEnergy(run),
      burnout: run.burnout.value,
      burnoutLabel: run.burnout.tier.label,
      meltdown: run.burnout.inMeltdown,
      dashCharges: run.dash.available,
      dashMax: run.dash.max,
      dashProgress: run.dash.progress,
      mobilisation: run.mobilisation.value,
      gobelets: Math.min(run.gobelets, COFFEE.MAX),
      room: Math.min(run.room, 10),
      wave: d.waves.waveNumber,
      waveCount: d.waves.waveCount,
      kills: run.kills,
      clock: d.clock,
      roomLabel: d.roomLabel,
      tickets: run.tickets,
      ps: run.psEarned,
      marked: this.world.hero.isMarked,
    };
  }

  /** Reconstruit la vue (réglages changés, nouveau monde). Les entrées écoutent le conteneur : rien à rebrancher. */
  private rebuildView(): void {
    this.view.dispose();
    this.view = new GameView(this.dom.app, this.dom.floats, this.world, this.settings, this.safe);
    this.view.applyEvents(this.world.drainEvents());
  }

  // ─── Outils de test (dev) ──────────────────────────────────────────────────

  /** Fait apparaître un ennemi près du héros (outil de capture). */
  public spawnNear(kind: EnemyKind, dx: number, dy: number): number {
    const h = this.world.hero.body;
    return this.world.spawnEnemy(kind, h.x + dx, h.y + dy, true)?.id ?? -1;
  }

  /** Répond à la fenêtre de choix ouverte (outil de capture). */
  public choose(index: number): void {
    if (!this.world.director.choice) return;
    this.menus.close();
    this.world.director.choose(index);
  }

  /** Raccourci de test (K, G, N, B), comme une touche avec `?cheat`. */
  public cheat(key: 'K' | 'G' | 'N' | 'B'): void {
    this.cheatQueue.push(key);
  }

  public dispose(): void {
    if (this.cheats) document.removeEventListener('keydown', this.cheatHandler);
    this.input.dispose();
    this.hud.dispose();
    this.menus.dispose();
    this.view.dispose();
  }
}

/** Preset de qualité mémorisé dans le navigateur (options), ou `null`. */
export function storedQuality(): QualityId | null {
  const q = browserStorage()?.getItem(QUALITY_KEY) ?? null;
  return isQualityId(q) ? q : null;
}
