import { AudioDirector } from '@/audio/AudioDirector';
import { probeWorld } from '@/audio/probe';
import { COFFEE, ENEMY_NAMES } from '@/config/balance';
import { ITEM_RARITIES, LOOT_PICKUP, RARITY_ORDER } from '@/config/loot';
import type { ItemInstance } from '@/systems/loot';
import { buildPaquetage, compareInLoadout, itemName, slotOf } from '@/systems/loot';
import type { EnemyKind, ShiftId } from '@/config/balance';
import { hasSave, loadMeta, metaSave } from '@/platform/save';
import { browserStorage } from '@/platform/storage';
import { autoAimTarget } from '@/sim/aim';
import { FixedClock, SIM_DT_MS } from '@/sim/clock/FixedClock';
import type { SimEvent } from '@/sim/events';
import { NO_INTENT } from '@/sim/intent';
import { World } from '@/sim/World';
import { AVANTAGES_BY_ID, RARITIES } from '@/systems/meta/Avantages';
import type { MetaState } from '@/systems/meta/MetaState';
import { newMeta } from '@/systems/meta/MetaState';
import type { ShiftEnd } from '@/systems/meta/RunState';
import { maxEnergy } from '@/systems/meta/RunState';
import { settleShift } from '@/systems/meta/settle';
import type { PlayerIntent } from '@/sim/intent';
import { HubController } from '@/scenes3d/hub/HubController';
import { HubUi } from '@/ui/hub/HubUi';
import { HUB_SERVICES } from '@/ui/hub/services';
import type { RawInput, TouchElements } from '@/engine/Input';
import { Input } from '@/engine/Input';
import type { HudSnapshot } from '@/ui/hud/Hud';
import { Hud } from '@/ui/hud/Hud';
import type { NearItemView } from '@/ui/loot/LootHud';
import { CompareCard, GearStrip } from '@/ui/loot/LootHud';
import { showConsigne, showTenue } from '@/ui/loot/lootPanels';
import type { ResultsLoot } from '@/ui/menus/Menus';
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

type Phase = 'title' | 'hub' | 'run' | 'results';

/**
 * Jeu 3D (jalons J4 et J6) : écran titre → hub (OCC, `scenes3d/hub`) → Shift complet (salles, portes,
 * vagues, récompenses, boss) → écran des départs → retour au hub. La progression (`MetaState`) est
 * chargée au démarrage et sauvegardée à chaque fin de Shift et à chaque achat. Mince par construction : relie la simulation (`sim/`, dont
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
  private readonly hubUi: HubUi;
  /** Loot : carte de comparaison à l'approche, bandeau des emplacements, écran Tenue ouvert. */
  private readonly lootCard: CompareCard;
  private readonly gearStrip: GearStrip;
  private tenueOpen = false;
  /** Hub en cours (phase `hub`), sinon `null`. */
  private hub: HubController | null = null;
  /** Progression permanente (chargée au démarrage, sauvegardée par `saveMeta`). */
  private meta: MetaState;
  /** Issue et cause du dernier Shift (répliques des PNJ, mur synoptique). */
  private lastEnd: ShiftEnd | null = null;
  private lastCause: string | null = null;
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
  /** Audio (src/audio) : s'abonne aux événements de la sim, déverrouillé au premier geste. */
  public readonly audio = new AudioDirector({ storage: browserStorage() });

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
    this.meta = loadMeta();
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
    this.audio.bind(document, dom.ui);
    this.hubUi = new HubUi(dom.ui, this.menus, HUB_SERVICES);
    this.hubUi.reducedMotion = settings.reducedMotion;
    this.lootCard = new CompareCard(
      dom.ui,
      (a) => {
        this.world.loot.act(a);
      },
      this.input.touch,
    );
    this.lootCard.reducedMotion = settings.reducedMotion;
    this.gearStrip = new GearStrip(dom.ui, () => {
      if (this.phase === 'run' && !this.menus.open) this.openTenue();
    });
    this.gearStrip.setVisible(false);
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

  /** Hub en cours (outil de démonstration), sinon `null`. */
  public get hubController(): HubController | null {
    return this.hub;
  }

  /** Progression courante (outil de démonstration). */
  public get progress(): MetaState {
    return this.hub?.sim.meta ?? this.meta;
  }

  public resize(w: number, h: number): void {
    this.view.resize(w, h);
  }

  public setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.audio.setHidden(hidden);
  }

  /** Décor du titre : la salle de départ, sans vagues, le héros au repos. */
  private backdropWorld(): World {
    return new World({ seed: this.seed, waves: false, room: 'quai-1' });
  }

  // ─── Écrans ────────────────────────────────────────────────────────────────

  private showTitle(): void {
    this.phase = 'title';
    this.hud.setVisible(false);
    this.gearStrip.setVisible(false);
    this.lootCard.update(null, 0, 0);
    this.hubUi.setVisible(false);
    this.menus.showPauseButton(false);
    this.menus.setBoss(null);
    this.menus.setPrompt(null, 0, 0, false);
    const m = this.meta;
    this.menus.showTitle({
      hasSave: hasSave(),
      saveSummary: `${String(m.ps)} PS · ${String(m.grains)} Grains · ${String(m.stats.shifts)} Shift${m.stats.shifts > 1 ? 's' : ''}`,
      onNew: () => {
        this.meta = newMeta();
        this.saveMeta(this.meta);
        this.enterHub();
      },
      onResume: () => {
        this.meta = loadMeta();
        this.enterHub();
      },
      onErase: () => {
        this.menus.showConfirm(
          'Effacer la progression ?',
          'PS, Grains, Pièces, revendications, statistiques et Vestiaire seront perdus. « Rien à signaler, sauf tout. »',
          'Oui, tout effacer',
          () => {
            metaSave.clear();
            this.meta = newMeta();
            this.lastEnd = null;
            this.lastCause = null;
            this.showTitle();
          },
          () => {
            this.showTitle();
          },
        );
      },
      onOptions: () => {
        this.openOptions(() => {
          this.showTitle();
        });
      },
    });
  }

  private saveMeta(meta: MetaState): boolean {
    this.meta = meta;
    return metaSave.save(meta);
  }

  /** Le hub (OCC) : nouveau monde paisible, décor du hub, PNJ et services. */
  public enterHub(): void {
    this.menus.close();
    this.leaveHub();
    this.hub = new HubController(
      {
        menus: this.menus,
        toScreen: (x, y, h) => this.view.toScreen(x, y, h),
        save: (meta) => this.saveMeta(meta),
        depart: (shift, meta) => {
          this.meta = meta;
          this.startRun(shift);
        },
        openOptions: (back) => {
          this.openOptions(back);
        },
        quitToTitle: () => {
          this.leaveHub();
          this.world = this.backdropWorld();
          this.clock = new FixedClock(this.world.time);
          this.rebuildView();
          this.showTitle();
        },
      },
      this.hubUi,
      { meta: this.meta, seed: this.seed, fromResult: this.lastEnd, lastCause: this.lastCause },
    );
    this.world = this.hub.sim.world;
    this.clock = new FixedClock(this.world.time);
    this.phase = 'hub';
    this.rebuildView();
    this.afterModal = true;
    this.hud.setVisible(false);
    this.gearStrip.setVisible(false);
    this.lootCard.update(null, 0, 0);
    this.menus.showPauseButton(this.input.touch);
    this.menus.setBoss(null);
    this.menus.fade(1, 0);
    this.menus.fade(0, 500);
  }

  private leaveHub(): void {
    this.hub?.dispose();
    this.hub = null;
  }

  /** Nouveau Shift : nouveau monde (graine suivante), nouvelle vue. */
  public startRun(shift: ShiftId = 'matin'): void {
    this.menus.close();
    this.leaveHub();
    this.seed += 1;
    this.world = new World({ seed: this.seed, meta: this.meta, shift });
    this.clock = new FixedClock(this.world.time);
    this.rebuildView();
    this.phase = 'run';
    this.resultsIn = -1;
    this.afterModal = true;
    this.hud.setVisible(true);
    this.gearStrip.setVisible(true);
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
      {
        get: () => this.audio.settings,
        set: (next) => {
          this.audio.setSettings(next);
        },
      },
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
    this.hubUi.reducedMotion = next.reducedMotion;
    this.lootCard.reducedMotion = next.reducedMotion;
    browserStorage()?.setItem(QUALITY_KEY, quality.id);
    this.rebuildView();
  }

  /**
   * Écran des départs : le bilan est réglé dans la méta (PS, Grains, statistiques ; crochet loot de
   * `settleShift`, que le lot Loot alimentera avec le `RunEnd` du Shift) puis sauvegardé.
   */
  private showResults(): void {
    const result = this.world.director.result;
    if (!result) return;
    this.phase = 'results';
    this.hud.setVisible(false);
    this.gearStrip.setVisible(false);
    this.lootCard.update(null, 0, 0);
    this.menus.showPauseButton(false);
    this.menus.setBoss(null);
    this.menus.setPrompt(null, 0, 0, false);
    this.menus.fade(0, 300);
    const loot = this.world.loot;
    const end = result.end;
    const candidates = loot.consignCandidates();
    const settle = (keep: readonly string[]): void => {
      // Fin de Shift : PS, Grains, statistiques, puis consigne du loot (settleShift → settleLootRun).
      const settled = settleShift(this.meta, result, loot.runEnd(end, keep));
      const saved = this.saveMeta(settled.meta);
      this.lastEnd = end;
      this.lastCause = result.cause;
      const color = (i: ItemInstance): { name: string; color: string } => ({
        name: itemName(i),
        color: ITEM_RARITIES[i.rarity].color,
      });
      const best = [...loot.found].sort(
        (a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity),
      )[0];
      const summary: ResultsLoot = {
        found: loot.found.length,
        best: best ? color(best) : null,
        kept: settled.kept.map(color),
        ferraille: settled.ferraille,
        error: settled.lootError,
      };
      this.menus.showResults(
        result,
        this.world.director.clock,
        { ps: settled.meta.ps, grains: settled.meta.grains, saved },
        () => {
          this.enterHub();
        },
        summary,
      );
    };
    if (candidates.length === 0) {
      settle([]);
      return;
    }
    showConsigne(
      this.menus,
      {
        outcome: end,
        candidates,
        limit: loot.consignLimit(end),
        preselect: loot.defaultKeep(end),
        paquetage: buildPaquetage(this.meta),
        ferrailleEarned: loot.ferraille,
        reducedMotion: this.settings.reducedMotion,
      },
      settle,
    );
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
    else if (this.phase === 'hub') this.hub?.input(this.intentFrom(raw), raw.pause);
    this.world.time.paused = this.hidden || this.menus.open || !this.playing;
    this.clock.frame(realMs, this.hub?.sim ?? this.world);
    this.afterStep(realMs);

    const realDt = realMs / 1000;
    this.view.sync(this.clock.alpha, realDt);
    this.view.render(realDt);
    if (this.phase === 'run') this.updateOverlay(realDt);
    else if (this.phase === 'hub') this.hub?.overlay(realDt);
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

  /** Le monde avance (Shift ou hub). */
  private get playing(): boolean {
    return this.phase === 'run' || this.phase === 'hub';
  }

  /** Intention de la frame d'après les entrées brutes (et le forçage des captures). */
  private intentFrom(raw: RawInput): PlayerIntent {
    const o = this.override;
    return {
      moveX: o.moveX ?? raw.moveX,
      moveY: o.moveY ?? raw.moveY,
      aim: o.aim ?? this.aimFor(raw),
      attack: raw.attack,
      dash: raw.dash,
      special: raw.special,
      coffee: raw.coffee,
      specialHeld: raw.specialHeld,
      interact: raw.interact,
      interactHeld: raw.interactHeld,
      scrapHeld: raw.scrapHeld,
    };
  }

  private runInput(raw: RawInput): void {
    const director = this.world.director;
    if (this.menus.open) {
      if (raw.inventory && this.tenueOpen) this.closeTenue();
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
    if (raw.inventory && !director.ended) {
      this.openTenue();
      return;
    }
    if (this.cheats) this.runCheats();
    this.world.queueIntent(this.intentFrom(raw));
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
    this.hearEvents(events);
    this.announce(events);
    this.hub?.afterStep();
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

  private hearEvents(events: readonly SimEvent[]): void {
    const menu = this.menus.current;
    this.audio.frame(events, probeWorld(this.world, this.phase, menu, this.world.time.paused));
    for (const e of events) if (e.type === 'lootDropped') this.audio.loot(e.rank, e.x, e.y);
  }

  /**
   * Avance la simulation de `ms` sans dessiner (outil de capture : le rendu logiciel est trop lent
   * pour jouer en temps réel). Les intentions viennent de `override` et des appuis simulés.
   */
  public fastForward(ms: number): void {
    const steps = Math.max(1, Math.round(ms / SIM_DT_MS));
    for (let i = 0; i < steps; i += 1) {
      const raw = this.input.read();
      if (this.phase === 'hub' && this.hub && !this.menus.open) {
        this.hub.input(
          { ...this.intentFrom(raw), aim: this.override.aim ?? this.world.hero.facingAngle },
          false,
        );
      } else if (this.phase === 'run' && !this.menus.open && !this.world.director.choice) {
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
          interactHeld: raw.interactHeld,
          scrapHeld: raw.scrapHeld,
        });
      }
      this.world.time.paused = this.menus.open || !this.playing;
      this.clock.frame(SIM_DT_MS, this.hub?.sim ?? this.world);
      this.afterStep(SIM_DT_MS);
      this.view.sync(this.clock.alpha, SIM_DT_MS / 1000);
      if (this.phase === 'hub') this.hub?.overlay(SIM_DT_MS / 1000);
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
          if (this.playing) this.menus.fade(0, FADE_IN_MS);
          break;
        case 'heroDied':
          this.hud.announce('FIN DE SERVICE', 2.4, 'danger');
          break;
        case 'shiftEnded':
          this.menus.fade(1, END_FADE_MS);
          this.resultsIn = END_FADE_MS + 200;
          if (this.tenueOpen) this.closeTenue();
          break;
        case 'lootDropped':
          this.onLootDropped(e.rank, e.quiet, e.name);
          break;
        default:
          break;
      }
    }
  }

  /**
   * Mise en scène d'un drop (narrative_level.md § 3.1) : un Patrimoine tombé dans une salle vide
   * déclenche un ralenti (jamais en Réduction des mouvements) et l'annonce de Rudy ; le Hors-série a
   * son bandeau. Le son (`audio.loot`) part de `hearEvents`.
   */
  private onLootDropped(rank: number, quiet: boolean, name: string): void {
    if (this.phase !== 'run') return;
    const top = RARITY_ORDER.length - 1;
    if (rank >= top) {
      if (quiet && !this.settings.reducedMotion) {
        const s = LOOT_PICKUP.PATRIMOINE_SLOWMO;
        this.world.time.slowmo(s.scale, s.ms, s.easeMs);
      }
      this.hud.announce(`RUDY : « OBJET DU PATRIMOINE SUR LA VOIE » · ${name}`, 3, 'gold');
    } else if (rank === top - 1) this.hud.announce(`HORS-SÉRIE · ${name}`, 2, 'info');
  }

  /** Carte de comparaison de l'objet au sol le plus proche (ou `null`). */
  private nearItem(): NearItemView | null {
    const loot = this.world.loot;
    const g = loot.near;
    if (!g || this.menus.open || this.world.director.frozen) return null;
    const slot = slotOf(g.item);
    const p = this.view.toScreen(g.x, g.y, 0.6);
    return {
      id: g.id,
      item: g.item,
      compare: compareInLoadout(loot.loadout.equipped, g.item, { r: loot.r }),
      current: slot ? loot.loadout.equipped[slot] : null,
      r: loot.r,
      canTake: loot.canTake,
      hold: loot.hold,
      bagFull: !loot.loadout.bag.includes(null),
      choice: g.group > 0,
      x: p.x,
      y: p.y,
      version: loot.version,
    };
  }

  /** Écran « Tenue » (I, Tab, toucher du bandeau) : le jeu est en pause tant qu'il est ouvert. */
  private openTenue(refresh = false): void {
    const loot = this.world.loot;
    this.tenueOpen = true;
    showTenue(
      this.menus,
      {
        equipped: loot.loadout.equipped,
        bag: loot.loadout.bag,
        mods: loot.mods,
        r: loot.r,
        editable: loot.editable,
        ferraille: loot.ferraille,
      },
      {
        equipBag: (i) => {
          loot.equipBag(i);
          this.openTenue(true);
        },
        scrapBag: (i) => {
          loot.scrapBag(i);
          this.openTenue(true);
        },
        close: () => {
          this.closeTenue();
        },
      },
      refresh,
    );
  }

  private closeTenue(): void {
    this.tenueOpen = false;
    this.menus.close();
  }

  /** HUD, invite contextuelle et barre du boss. */
  private updateOverlay(realDt: number): void {
    this.hud.update(this.snapshot(), realDt);
    const loot = this.world.loot;
    this.gearStrip.update(loot.loadout.equipped, loot.loadout.bag);
    const near = this.nearItem();
    this.lootCard.update(near, innerWidth, innerHeight);
    const director = this.world.director;
    const prompt = director.prompt;
    if (prompt && !this.menus.open && !director.frozen && !near) {
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
    this.view = new GameView(
      this.dom.app,
      this.dom.floats,
      this.world,
      this.settings,
      this.safe,
      this.hub?.viewOptions() ?? {},
    );
    const events = this.world.drainEvents();
    this.view.applyEvents(events);
    this.hearEvents(events);
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
    this.leaveHub();
    this.hubUi.dispose();
    this.hud.dispose();
    this.lootCard.dispose();
    this.gearStrip.dispose();
    this.menus.dispose();
    this.view.dispose();
    this.audio.dispose();
  }
}

/** Preset de qualité mémorisé dans le navigateur (options), ou `null`. */
export function storedQuality(): QualityId | null {
  const q = browserStorage()?.getItem(QUALITY_KEY) ?? null;
  return isQualityId(q) ? q : null;
}
