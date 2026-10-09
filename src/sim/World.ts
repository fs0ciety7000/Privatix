import type { EnemyKind, ShiftId } from '@/config/balance';
import {
  BURNOUT,
  ENEMY_RULES,
  ENVIRONMENT,
  FEEL,
  FURET,
  HERO,
  MOBILISATION,
  SCALING,
} from '@/config/balance';
import { AttackTokens } from '@/systems/combat/AttackTokens';
import { enemyScale } from '@/systems/combat/damage';
import type { MetaState } from '@/systems/meta/MetaState';
import { newMeta } from '@/systems/meta/MetaState';
import type { RunState } from '@/systems/meta/RunState';
import { createRun, heal, maxEnergy } from '@/systems/meta/RunState';
import { roomIndex } from '@/systems/procedural/ShiftPlan';
import type { RoomTemplateId } from '@/systems/procedural/roomTemplates';
import { blocksWalker, parseRoom, tileAt } from '@/systems/procedural/RoomLayout';
import type { Rng } from '@/utils/rng';
import { createRng } from '@/utils/rng';
import { Arena } from '@/sim/Arena';
import { TimeControl } from '@/sim/clock/TimeControl';
import type { Steppable } from '@/sim/clock/FixedClock';
import { AuditeurSim } from '@/sim/enemies/AuditeurSim';
import { BorneSim } from '@/sim/enemies/BorneSim';
import { ConsultantSim } from '@/sim/enemies/ConsultantSim';
import { DiRupoSim } from '@/sim/enemies/DiRupoSim';
import { DiscosaureSim } from '@/sim/enemies/DiscosaureSim';
import { DroneSim } from '@/sim/enemies/DroneSim';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import { FluidifieurSim } from '@/sim/enemies/FluidifieurSim';
import { FuretSim } from '@/sim/enemies/FuretSim';
import { ManagerSim } from '@/sim/enemies/ManagerSim';
import { VanderslideSim } from '@/sim/enemies/VanderslideSim';
import type { SimEvent } from '@/sim/events';
import type { HazardHost, HazardSpec } from '@/sim/Hazards';
import { HazardSim } from '@/sim/Hazards';
import { HeroSim } from '@/sim/hero/HeroSim';
import type { PlayerIntent } from '@/sim/intent';
import { mergeIntent, NO_INTENT, releaseEdges } from '@/sim/intent';
import type { TileGrid } from '@/sim/physics/collision';
import { moveCircle } from '@/sim/physics/collision';
import type { PickupSim } from '@/sim/Pickups';
import type { ProjectileSim, ProjectileSpec } from '@/sim/Projectiles';
import { Projectiles } from '@/sim/Projectiles';
import { RunDirector } from '@/sim/RunDirector';
import type { Body, HitSource, SimWorld } from '@/sim/SimWorld';

export interface WorldOptions {
  readonly seed: number;
  /** Gabarit de la première salle (défaut : tiré par le plan du Shift, `quai-1` sans vagues). */
  readonly room?: RoomTemplateId;
  readonly shift?: ShiftId;
  /** Progression permanente (bonus du Tableau des revendications), lue seulement. */
  readonly meta?: MetaState;
  /** Flux du Shift et vagues (faux dans les tests qui placent leurs ennemis à la main). */
  readonly waves?: boolean;
  /** Réduction des mouvements (coupe les patterns stroboscopiques). */
  readonly reducedMotion?: boolean;
}

/**
 * Le monde de la simulation : possède le héros, les ennemis, les projectiles, les zones de danger,
 * les récompenses au sol, l'état du Shift, l'aléatoire, les jetons d'attaque, le temps de jeu et la
 * file d'événements. Pur (ni three, ni DOM) et déterministe : même graine + mêmes intentions = même
 * partie. Le flux du Shift (salles, portes, vagues, récompenses) est délégué à `RunDirector`.
 */
export class World implements SimWorld, Steppable {
  public readonly rng: Rng;
  public readonly run: RunState;
  public arena: Arena;
  public readonly tokens: AttackTokens;
  public readonly time = new TimeControl();
  public readonly hero: HeroSim;
  public readonly director: RunDirector;
  public readonly enemies: EnemySim[] = [];
  public readonly projectiles = new Projectiles();
  public readonly hazards: HazardSim[] = [];
  public readonly pickups: PickupSim[] = [];
  /** Réduction des mouvements (accessibilité) : modifiable en cours de Shift (touche M, options). */
  public reducedMotion: boolean;
  private timeMs = 0;
  /** Dernière position sûre du héros (hors du vide), pour la chute. */
  private safeX = 0;
  private safeY = 0;
  /** Grille des ennemis qui marchent : le vide les arrête. */
  private walkerGrid: TileGrid;
  private events: SimEvent[] = [];
  private intent: PlayerIntent = NO_INTENT;
  private interactPressed = false;
  private heroPrevFacing = Math.PI / 2;
  private readonly hazardHost: HazardHost;

  public constructor(opts: WorldOptions) {
    this.rng = createRng(opts.seed);
    this.run = createRun(opts.meta ?? newMeta(), opts.shift ?? 'matin', opts.seed);
    const shiftFlow = opts.waves ?? true;
    this.reducedMotion = opts.reducedMotion ?? false;
    this.arena = new Arena(parseRoom(opts.room ?? 'quai-1'));
    this.walkerGrid = walkerGridOf(this.arena);
    this.tokens = new AttackTokens({
      melee: ENEMY_RULES.MAX_MELEE_TOKENS,
      ranged: ENEMY_RULES.MAX_RANGED_TOKENS,
    });
    const spawn = this.arena.playerSpawn;
    this.hero = new HeroSim(this, spawn.x, spawn.y);
    this.hero.facingAngle = -Math.PI / 2;
    this.hazardHost = {
      heroFeet: this.hero.body,
      damageHero: (amount, source) => this.damageHero(amount, source),
      slowHero: (factor, ms) => {
        this.hero.applySlow(factor, ms);
      },
      addBurnout: (points) => {
        this.hero.addBurnout(points);
      },
      fallHero: () => {
        this.fallHero();
      },
      emit: (e) => {
        this.emit(e);
      },
      shake: (px, ms) => {
        this.emit({ type: 'shake', px, ms });
      },
    };
    this.safeX = spawn.x;
    this.safeY = spawn.y;
    this.director = new RunDirector(this, shiftFlow);
    if (shiftFlow) this.director.start(opts.room);
  }

  public now(): number {
    return this.timeMs;
  }

  /** Angle de visée du pas précédent (interpolation de l'orientation). */
  public get heroPreviousFacing(): number {
    return this.heroPrevFacing;
  }

  public livingEnemies(): readonly EnemySim[] {
    return this.enemies.filter((e) => !e.isDead);
  }

  /** Dépose l'intention de la frame ; les appuis restent mémorisés jusqu'au prochain pas. */
  public queueIntent(intent: PlayerIntent): void {
    this.intent = mergeIntent(this.intent, intent);
  }

  /** Appui « interagir » du pas courant (lu une fois par le directeur). */
  public consumeInteract(): boolean {
    const v = this.interactPressed;
    this.interactPressed = false;
    return v;
  }

  public emit(event: SimEvent): void {
    this.events.push(event);
    switch (event.type) {
      case 'heroDied':
        this.director.onHeroDied();
        break;
      case 'special':
        this.onHeroSpecial(event.kind, event.x, event.y, event.radius);
        break;
      case 'swing':
        this.onHeroSwing(event);
        break;
      case 'perfectDash':
        for (const e of this.livingEnemies()) e.onPerfectDash(event.x, event.y);
        break;
      default:
        break;
    }
  }

  /** Sifflet ou Préavis : les ennemis réagissent, les nuages de puanteur se dispersent. */
  private onHeroSpecial(kind: 'whistle' | 'preavis', x: number, y: number, radius: number): void {
    for (const h of this.hazards) {
      if (h.spec.kind !== 'cloud' || h.done) continue;
      const reach = radius + FURET.WHISTLE_CLEAR_BONUS + h.cloudRadius;
      if (kind === 'preavis' || Math.hypot(h.x - x, h.y - y) <= reach) h.finish();
    }
    for (const e of this.livingEnemies()) e.onHeroSpecial(kind, x, y, radius);
  }

  /** Coup du héros : bulles à crever (promesses), ruban à couper. */
  private onHeroSwing(s: Extract<SimEvent, { type: 'swing' }>): void {
    const half = s.arcDeg > 0 ? (s.arcDeg * Math.PI) / 360 : 0.45;
    for (const h of this.hazards) {
      if (h.done || h.spec.kind !== 'circle' || h.spec.poppable !== true || !h.telegraphing)
        continue;
      const d = Math.hypot(h.x - s.x, h.y - s.y);
      if (d > s.reach + 24) continue;
      let diff = Math.atan2(h.y - s.y, h.x - s.x) - s.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (d < 20 || Math.abs(diff) <= half + 0.35) h.pop();
    }
    const info = {
      x: s.x,
      y: s.y,
      angle: s.angle,
      reach: s.reach,
      arcDeg: s.arcDeg,
      finisher: s.finisher,
      dashAttack: s.dashAttack,
    };
    for (const e of this.livingEnemies()) e.onHeroSwing(info);
  }

  /** Le héros tombe dans le vide : −10 % d'Énergie max et retour à la dernière position sûre. */
  public fallHero(): void {
    const hero = this.hero;
    if (hero.isDead || this.director.frozen) return;
    const b = hero.body;
    const fromX = b.x;
    const fromY = b.y;
    b.x = this.safeX;
    b.y = this.safeY;
    b.prevX = b.x;
    b.prevY = b.y;
    b.vx = 0;
    b.vy = 0;
    this.emit({ type: 'fx', name: 'heroFell', x: fromX, y: fromY });
    hero.receiveHit(Math.round(maxEnergy(this.run) * ENVIRONMENT.VOID_FALL_ENERGY_PCT), {
      x: b.x,
      y: b.y,
      name: 'Le vide de la Passerelle',
      knockbackPx: 0,
    });
  }

  /** Le héros (hors dash) au-dessus du vide tombe ; sinon sa position devient la position sûre. */
  private checkVoid(): void {
    const hero = this.hero;
    const b = hero.body;
    if (hero.isDead || !b.enabled) return;
    const kind = this.arena.kindAt(b.x, b.y);
    if (kind === 'void') {
      if (hero.state !== 'dash') this.fallHero();
      return;
    }
    if (hero.state === 'dash') return;
    // Position sûre : pas de vide sous les pieds ni juste à côté.
    const r = b.r + 4;
    for (const [dx, dy] of [
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
    ] as const) {
      if (this.arena.kindAt(b.x + dx, b.y + dy) === 'void') return;
    }
    this.safeX = b.x;
    this.safeY = b.y;
  }

  /** Poussée de l'environnement (rafale de vent) : déplace le héros contre le décor. */
  public pushHero(dx: number, dy: number): void {
    const b = this.hero.body;
    if (this.hero.isDead || !b.enabled) return;
    moveCircle(this.arena, b, dx, dy);
  }

  /** Événements publiés depuis le dernier appel (la vue les consomme une fois par frame). */
  public drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ─── Salle ─────────────────────────────────────────────────────────────────

  /** Construit une salle depuis son gabarit : tout ce qui vivait dans la précédente disparaît. */
  public loadRoom(template: RoomTemplateId): void {
    this.arena = new Arena(parseRoom(template));
    this.walkerGrid = walkerGridOf(this.arena);
    this.enemies.length = 0;
    this.projectiles.clear();
    this.hazards.length = 0;
    this.pickups.length = 0;
    this.tokens.clear();
    const spawn = this.arena.playerSpawn;
    const b = this.hero.body;
    b.x = spawn.x;
    b.y = spawn.y;
    b.prevX = spawn.x;
    b.prevY = spawn.y;
    b.vx = 0;
    b.vy = 0;
    this.safeX = spawn.x;
    this.safeY = spawn.y;
    this.hero.facingAngle = -Math.PI / 2;
  }

  // ─── Combat ────────────────────────────────────────────────────────────────

  public damageHero(amount: number, source: HitSource): boolean {
    if (this.director.frozen) return false;
    return this.hero.receiveHit(amount, source);
  }

  public onEnemyDamaged(_enemy: EnemySim, amount: number, _crit: boolean): void {
    this.run.mobilisation.onDamageDealt(amount);
  }

  public onEnemyKilled(enemy: EnemySim): void {
    const run = this.run;
    const elite = enemy.isHeavy;
    const last = this.director.waves.isLastKill();
    run.kills += 1;
    run.mobilisation.add(MOBILISATION.PER_KILL + (elite ? MOBILISATION.ELITE_KILL_BONUS : 0));
    run.burnout.add(elite ? BURNOUT.PER_ELITE_KILL : BURNOUT.PER_KILL);
    if (run.mods.killHeal > 0) heal(run, run.mods.killHeal);
    const tickets = Math.round(enemy.stats.tickets * (run.shift.id === 'apres-midi' ? 1.2 : 1));
    run.tickets += tickets;
    this.emit({
      type: 'enemyKilled',
      id: enemy.id,
      kind: enemy.kind,
      x: enemy.body.x,
      y: enemy.body.y,
      angle: enemy.deathAngle,
      last,
    });
    if (enemy.kind !== 'auditeur')
      this.emit({
        type: 'text',
        x: enemy.body.x,
        y: enemy.body.y,
        text: `+${String(tickets)} tickets`,
        tone: 'danger',
      });
    this.emit({ type: 'shake', px: FEEL.KILL_SHAKE_PX, ms: FEEL.KILL_SHAKE_MS });
    this.director.onEnemyKilled(enemy.kind, enemy.body.x, enemy.body.y, enemy.isHeavy);
  }

  public spawnEnemy(kind: EnemyKind, x: number, y: number, immediate = false): EnemySim | null {
    if (this.livingEnemies().length >= ENEMY_RULES.MAX_ALIVE) return null;
    const scale = enemyScale(roomIndex(this.run.room), this.run.shift, SCALING);
    // Boss : PV et dégâts fixes (pas de r), seuls les modificateurs du roulement (GDD § 3.7).
    const bossScale = enemyScale(1, this.run.shift, SCALING);
    let enemy: EnemySim;
    switch (kind) {
      case 'borne':
        enemy = new BorneSim(this, x, y, scale);
        break;
      case 'drone':
        enemy = new DroneSim(this, x, y, scale);
        break;
      case 'manager':
        enemy = new ManagerSim(this, x, y, scale);
        break;
      case 'auditeur':
        enemy = new AuditeurSim(this, x, y, scale);
        break;
      case 'furet':
        enemy = new FuretSim(this, x, y, scale);
        break;
      case 'fluidifieur':
        enemy = new FluidifieurSim(this, x, y, scale);
        break;
      case 'discosaure':
        enemy = new DiscosaureSim(this, x, y, scale);
        break;
      case 'dirupo':
        enemy = new DiRupoSim(this, x, y, bossScale);
        break;
      case 'vanderslide':
        enemy = new VanderslideSim(this, x, y, bossScale);
        break;
      default:
        enemy = new ConsultantSim(this, x, y, scale);
    }
    enemy.start(immediate);
    this.enemies.push(enemy);
    return enemy;
  }

  public spawnProjectile(spec: ProjectileSpec): void {
    this.projectiles.fire(spec);
    this.emit({ type: 'projectileFired', x: spec.x, y: spec.y });
  }

  public spawnHazard(spec: HazardSpec): HazardSim {
    const h = new HazardSim(spec);
    this.hazards.push(h);
    return h;
  }

  public activeProjectiles(): readonly ProjectileSim[] {
    return this.projectiles.active();
  }

  public breakProjectile(p: ProjectileSim): void {
    if (!p.active) return;
    p.active = false;
    this.emit({ type: 'projectileBroken', x: p.x, y: p.y, by: 'weapon' });
  }

  // ─── Pas de simulation ─────────────────────────────────────────────────────

  public snapshot(): void {
    snap(this.hero.body);
    this.heroPrevFacing = this.hero.facingAngle;
    for (const e of this.enemies) snap(e.body);
    this.projectiles.snapshot();
  }

  public step(dtMs: number): void {
    this.timeMs += dtMs;
    const dt = dtMs / 1000;
    const intent = this.director.frozen ? NO_INTENT : this.intent;
    this.interactPressed = intent.interact ?? false;
    this.hero.tick(dtMs, intent);
    this.intent = releaseEdges(this.intent);
    integrate(this.arena, this.hero.body, dt);
    this.checkVoid();

    for (const e of this.enemies) {
      if (e.removed) continue;
      e.tick(dtMs);
      // Le vide arrête ceux qui marchent ; un non-élite projeté dedans est éliminé.
      const pushed = e.knockedBack && !e.isHeavy;
      integrate(pushed ? this.arena : this.walkerGrid, e.body, dt);
      if (pushed && e.body.enabled && this.arena.kindAt(e.body.x, e.body.y) === 'void') {
        this.emit({ type: 'fx', name: 'enemyFell', x: e.body.x, y: e.body.y });
        e.debugKill();
      }
    }
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      if (this.enemies[i]?.removed) this.enemies.splice(i, 1);
    }
    this.stepProjectiles(dtMs);
    for (const h of this.hazards) h.update(dtMs, this.hazardHost);
    for (let i = this.hazards.length - 1; i >= 0; i -= 1) {
      if (this.hazards[i]?.done) this.hazards.splice(i, 1);
    }
    this.director.update();
  }

  /** Projectiles : murs, puis héros (i-frames, dash parfait), comme la boucle de `RunScene`. */
  private stepProjectiles(dtMs: number): void {
    this.projectiles.step(dtMs, this.arena, (p) => {
      this.emit({ type: 'projectileBroken', x: p.x, y: p.y, by: 'wall' });
    });
    const hero = this.hero;
    const hb = hero.body;
    for (const p of this.projectiles.pool) {
      if (!p.active) continue;
      if (Math.hypot(p.x - hb.x, p.y - hb.y) > p.r + HERO.HURT_RADIUS) continue;
      const source = { x: p.x, y: p.y, name: p.owner, knockbackPx: 12 };
      if (hero.isInvulnerable()) {
        if (hero.inPerfectWindow()) hero.receiveHit(p.damage, source);
        continue;
      }
      if (this.damageHero(p.damage, source)) {
        p.active = false;
        this.emit({ type: 'projectileBroken', x: p.x, y: p.y, by: 'hero' });
      }
    }
  }
}

/** Grille des marcheurs : le vide (Passerelle) y est plein. */
function walkerGridOf(arena: Arena): TileGrid {
  const layout = arena.layout;
  return {
    cols: arena.cols,
    rows: arena.rows,
    tileSize: arena.tileSize,
    solidAt: (tx, ty) => blocksWalker(tileAt(layout, tx, ty)),
  };
}

function snap(b: Body): void {
  b.prevX = b.x;
  b.prevY = b.y;
}

function integrate(arena: TileGrid, b: Body, dt: number): void {
  if (!b.enabled) {
    b.blocked = false;
    return;
  }
  const res = moveCircle(arena, b, b.vx * dt, b.vy * dt);
  b.blocked = res.blocked;
}
