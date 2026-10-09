import { COFFEE } from '@/config/balance';
import { autoAimTarget } from '@/sim/aim';
import { FixedClock, SIM_DT_MS } from '@/sim/clock/FixedClock';
import type { SimEvent } from '@/sim/events';
import { World } from '@/sim/World';
import { maxEnergy } from '@/systems/meta/RunState';
import type { RawInput, TouchElements } from '@/engine/Input';
import { Input } from '@/engine/Input';
import type { HudSnapshot } from '@/ui/hud/Hud';
import { Hud } from '@/ui/hud/Hud';
import { GameView } from '@/view/GameView';
import type { ViewSettings } from '@/view/quality';

/** Portée de l'aide à la visée tactile (u) : 4,5 m. */
const AUTO_AIM_RANGE = 135;
/** Délai entre la fin de service (mort) et la reprise (temps réel, ms). */
const RESTART_MS = 2600;

export interface SceneDom {
  readonly app: HTMLElement;
  readonly ui: HTMLElement;
  readonly floats: HTMLElement;
  readonly touch: TouchElements | null;
}

/**
 * Scène de combat 3D (jalons J1-J2) : une salle de quai réelle, le héros, des vagues de consultants.
 * Mince par construction : elle relie la simulation (`sim/`), la vue (`view/`), les entrées (`engine/`)
 * et le HUD (`ui/`), qui ne se connaissent pas entre eux.
 */
export class QuaiScene {
  private world: World;
  private view: GameView;
  private clock: FixedClock;
  private readonly input: Input;
  private readonly hud: Hud;
  private restartIn = -1;
  private seed: number;
  private statsT = 0;
  /** Forçage des axes et de la visée (captures automatisées, outil de démonstration en dev). */
  public override: { moveX?: number; moveY?: number; aim?: number } = {};

  public constructor(
    private readonly dom: SceneDom,
    private settings: ViewSettings,
    private readonly safe: boolean,
    seed: number,
    private readonly onReducedMotion: (on: boolean) => void,
  ) {
    this.seed = seed;
    this.world = new World({ seed });
    this.clock = new FixedClock(this.world.time);
    this.view = new GameView(dom.app, dom.floats, this.world, settings, safe);
    this.input = new Input(dom.app, dom.touch);
    this.hud = new Hud(dom.ui);
    this.hud.announce('QUAI 3 · PRISE DE SERVICE', 2.2, 'gold');
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

  public resize(w: number, h: number): void {
    this.view.resize(w, h);
  }

  public setPaused(paused: boolean): void {
    this.world.time.paused = paused;
  }

  /** Une frame : entrées → pas de simulation → événements → vue → HUD. */
  public frame(realMs: number): void {
    const raw = this.input.read();
    if (raw.toggleStats) this.hud.toggleStats();
    if (raw.toggleReducedMotion) this.toggleReducedMotion();
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
    });
    this.clock.frame(realMs, this.world);
    const events = this.world.drainEvents();
    this.view.applyEvents(events);
    this.announce(events);

    const realDt = realMs / 1000;
    this.view.sync(this.clock.alpha, realDt);
    this.view.render(realDt);
    this.hud.update(this.snapshot(), realDt);
    this.statsT += realDt;
    if (this.hud.statsVisible && this.statsT > 0.25) {
      this.statsT = 0;
      this.hud.showStats({
        ...this.view.stats(),
        quality: this.settings.quality.id,
        enemies: this.world.livingEnemies().length,
      });
    }

    if (this.restartIn >= 0) {
      this.restartIn -= realMs;
      if (this.restartIn < 0) this.restart();
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
      const o = this.override;
      this.world.queueIntent({
        moveX: o.moveX ?? raw.moveX,
        moveY: o.moveY ?? raw.moveY,
        aim: o.aim ?? this.world.hero.facingAngle,
        attack: raw.attack,
        dash: raw.dash,
        special: raw.special,
        coffee: raw.coffee,
        specialHeld: raw.specialHeld,
      });
      this.clock.frame(SIM_DT_MS, this.world);
      const events = this.world.drainEvents();
      this.view.applyEvents(events);
      this.announce(events);
      this.view.sync(this.clock.alpha, SIM_DT_MS / 1000);
      if (this.restartIn >= 0) {
        this.restartIn -= SIM_DT_MS;
        if (this.restartIn < 0) this.restart();
      }
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
      if (e.type === 'wave') {
        this.hud.announce(
          e.index === 1 ? `SALLE ${String(e.room)} · VAGUE 1` : `VAGUE ${String(e.index)}`,
          1.6,
          'danger',
        );
      } else if (e.type === 'roomCleared') {
        this.hud.announce('SALLE NETTOYÉE', 2.2, 'gold');
      } else if (e.type === 'heroDied') {
        this.hud.announce('FIN DE SERVICE', 2.4, 'danger');
        this.restartIn = RESTART_MS;
      }
    }
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
      room: d.r,
      wave: d.waveNumber,
      waveCount: d.waveCount,
      kills: run.kills,
    };
  }

  /** Nouvelle prise de service : nouveau monde, même vue reconstruite. */
  public restart(): void {
    this.restartIn = -1;
    this.seed += 1;
    this.world = new World({ seed: this.seed });
    this.clock = new FixedClock(this.world.time);
    this.rebuildView();
    this.hud.announce('REPRISE DE SERVICE', 2, 'gold');
  }

  private toggleReducedMotion(): void {
    this.settings = { ...this.settings, reducedMotion: !this.settings.reducedMotion };
    this.onReducedMotion(this.settings.reducedMotion);
    this.rebuildView();
    this.hud.announce(
      this.settings.reducedMotion ? 'MOUVEMENTS RÉDUITS' : 'MOUVEMENTS COMPLETS',
      1.4,
    );
  }

  /** Reconstruit la vue (réglages changés, nouveau monde). Les entrées écoutent le conteneur : rien à rebrancher. */
  private rebuildView(): void {
    this.view.dispose();
    this.view = new GameView(this.dom.app, this.dom.floats, this.world, this.settings, this.safe);
  }

  public dispose(): void {
    this.input.dispose();
    this.hud.dispose();
    this.view.dispose();
  }
}
