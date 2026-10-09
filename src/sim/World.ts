import type { EnemyKind, ShiftId } from '@/config/balance';
import { BURNOUT, ENEMY_RULES, FEEL, MOBILISATION, SCALING } from '@/config/balance';
import { AttackTokens } from '@/systems/combat/AttackTokens';
import { enemyScale } from '@/systems/combat/damage';
import { newMeta } from '@/systems/meta/MetaState';
import type { RunState } from '@/systems/meta/RunState';
import { createRun, heal } from '@/systems/meta/RunState';
import type { RoomTemplateId } from '@/systems/procedural/roomTemplates';
import { parseRoom } from '@/systems/procedural/RoomLayout';
import type { Rng } from '@/utils/rng';
import { createRng } from '@/utils/rng';
import { Arena } from '@/sim/Arena';
import { TimeControl } from '@/sim/clock/TimeControl';
import type { Steppable } from '@/sim/clock/FixedClock';
import { ConsultantSim } from '@/sim/enemies/ConsultantSim';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import type { SimEvent } from '@/sim/events';
import { HeroSim } from '@/sim/hero/HeroSim';
import type { PlayerIntent } from '@/sim/intent';
import { mergeIntent, NO_INTENT, releaseEdges } from '@/sim/intent';
import { moveCircle } from '@/sim/physics/collision';
import type { Body, HitSource, SimWorld } from '@/sim/SimWorld';
import { WaveDirector } from '@/sim/WaveDirector';

export interface WorldOptions {
  readonly seed: number;
  readonly room?: RoomTemplateId;
  readonly shift?: ShiftId;
  /** Vagues automatiques (faux dans les tests qui placent leurs ennemis à la main). */
  readonly waves?: boolean;
}

/**
 * Le monde de la simulation : possède le héros, les ennemis, l'état du Shift, l'aléatoire, les jetons
 * d'attaque, le temps de jeu et la file d'événements. Pur (ni three, ni DOM) et déterministe : même
 * graine + mêmes intentions = même partie.
 */
export class World implements SimWorld, Steppable {
  public readonly rng: Rng;
  public readonly run: RunState;
  public readonly arena: Arena;
  public readonly tokens: AttackTokens;
  public readonly time = new TimeControl();
  public readonly hero: HeroSim;
  public readonly director: WaveDirector;
  public readonly enemies: EnemySim[] = [];
  private timeMs = 0;
  private events: SimEvent[] = [];
  private intent: PlayerIntent = NO_INTENT;
  private heroPrevFacing = Math.PI / 2;

  public constructor(opts: WorldOptions) {
    this.rng = createRng(opts.seed);
    this.run = createRun(newMeta(), opts.shift ?? 'matin', opts.seed);
    this.arena = new Arena(parseRoom(opts.room ?? 'quai-1'));
    this.tokens = new AttackTokens({
      melee: ENEMY_RULES.MAX_MELEE_TOKENS,
      ranged: ENEMY_RULES.MAX_RANGED_TOKENS,
    });
    const spawn = this.arena.playerSpawn;
    this.hero = new HeroSim(this, spawn.x, spawn.y);
    this.hero.facingAngle = -Math.PI / 2;
    this.director = new WaveDirector(this, opts.waves ?? true);
    if (this.director.enabled) this.director.startRoom(1);
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

  public emit(event: SimEvent): void {
    this.events.push(event);
  }

  /** Événements publiés depuis le dernier appel (la vue les consomme une fois par frame). */
  public drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ─── Combat ────────────────────────────────────────────────────────────────

  public damageHero(amount: number, source: HitSource): boolean {
    return this.hero.receiveHit(amount, source);
  }

  public onEnemyDamaged(_enemy: EnemySim, amount: number, _crit: boolean): void {
    this.run.mobilisation.onDamageDealt(amount);
  }

  public onEnemyKilled(enemy: EnemySim): void {
    const run = this.run;
    const elite = enemy.kind === 'manager';
    const last = this.director.enabled && this.director.isLastKill();
    run.kills += 1;
    this.director.onKilled();
    run.mobilisation.add(MOBILISATION.PER_KILL + (elite ? MOBILISATION.ELITE_KILL_BONUS : 0));
    run.burnout.add(elite ? BURNOUT.PER_ELITE_KILL : BURNOUT.PER_KILL);
    if (run.mods.killHeal > 0) heal(run, run.mods.killHeal);
    run.tickets += enemy.stats.tickets;
    this.emit({
      type: 'enemyKilled',
      id: enemy.id,
      x: enemy.body.x,
      y: enemy.body.y,
      angle: enemy.deathAngle,
      last,
    });
    this.emit({ type: 'shake', px: FEEL.KILL_SHAKE_PX, ms: FEEL.KILL_SHAKE_MS });
  }

  public spawnEnemy(kind: EnemyKind, x: number, y: number, immediate = false): EnemySim | null {
    if (this.livingEnemies().length >= ENEMY_RULES.MAX_ALIVE) return null;
    const scale = enemyScale(this.director.r, this.run.shift, SCALING);
    // Seul le Consultant est porté pour l'instant ; les autres types arrivent en J2 suite / J7.
    const enemy = new ConsultantSim(this, x, y, scale);
    void kind;
    enemy.start(immediate);
    this.enemies.push(enemy);
    return enemy;
  }

  // ─── Pas de simulation ─────────────────────────────────────────────────────

  public snapshot(): void {
    snap(this.hero.body);
    this.heroPrevFacing = this.hero.facingAngle;
    for (const e of this.enemies) snap(e.body);
  }

  public step(dtMs: number): void {
    this.timeMs += dtMs;
    const dt = dtMs / 1000;
    this.hero.tick(dtMs, this.intent);
    this.intent = releaseEdges(this.intent);
    integrate(this.arena, this.hero.body, dt);

    for (const e of this.enemies) {
      if (e.removed) continue;
      e.tick(dtMs);
      integrate(this.arena, e.body, dt);
    }
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      if (this.enemies[i]?.removed) this.enemies.splice(i, 1);
    }
    this.director.update();
  }
}

function snap(b: Body): void {
  b.prevX = b.x;
  b.prevY = b.y;
}

function integrate(arena: Arena, b: Body, dt: number): void {
  if (!b.enabled) {
    b.blocked = false;
    return;
  }
  const res = moveCircle(arena, b, b.vx * dt, b.vy * dt);
  b.blocked = res.blocked;
}
