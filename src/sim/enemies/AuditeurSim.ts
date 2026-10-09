import { AUDITEUR } from '@/config/balance';
import type { EnemyScale } from '@/systems/combat/damage';
import { circleInArc } from '@/systems/combat/geometry';
import { maxEnergy } from '@/systems/meta/RunState';
import { pick } from '@/utils/rng';
import type { SimWorld } from '@/sim/SimWorld';
import { EnemySim } from '@/sim/enemies/EnemySim';

export type AuditeurPattern = 'sweep' | 'chrono' | 'barrage' | 'stamp' | 'kpi';

/** Origine du bras-barrière et de la bouche à tickets (u au-dessus des pieds, version Phaser). */
const SWEEP_ORIGIN_Y = 20;
const BARRAGE_ORIGIN_Y = 40;
const BARRAGE_TELEGRAPH_REACH = 150;
const KPI_WIDTH = 24;
const COOLDOWNS: Readonly<Record<AuditeurPattern, number>> = {
  sweep: 2500,
  chrono: 9000,
  barrage: 8000,
  stamp: 6000,
  kpi: 8000,
};

/**
 * Boss 1 : l'Auditeur des Quais aux commandes de la Borne Totale 3000 (port pur de
 * `entities/enemies/Auditeur.ts`).
 * Phase 1 « Audit bienveillant » : bras-barrière, chronomètres, barrage de tickets, « Contrôle ! ».
 * Phase 2 (60 %) « Plan de transport optimisé » : il commande les rames et appelle des renforts.
 * Phase 3 (25 %) « Objectif non atteint » : ruées qui laissent des lignes de KPI, tout 20 % plus rapide.
 */
export class AuditeurSim extends EnemySim {
  public phase = 1;
  private nextPatternAt = 0;
  private readonly cooldowns = new Map<AuditeurPattern, number>();
  private nextTrain = 0;
  private nextReinforce = 0;
  /** Transition de phase en cours (ms restantes) : intouchable. */
  public transitionLeft = 0;
  private step = 0;
  private stepAt = 0;
  private stampTarget = { x: 0, y: 0 };
  private dashFrom = { x: 0, y: 0 };
  private dashAngle = 0;
  private dashHit = false;
  private stunnedByTrain = 0;

  public constructor(world: SimWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'auditeur', x, y, scale);
    this.nextPatternAt = world.now() + 1500;
  }

  private get tempo(): number {
    return this.phase === 3 ? AUDITEUR.P3_SPEED_MULT : 1;
  }

  protected override get speed(): number {
    return (AUDITEUR.SPEEDS[this.phase - 1] ?? AUDITEUR.speed) * this.speedMult;
  }

  public override isHittable(): boolean {
    return super.isHittable() && this.transitionLeft <= 0 && !this.hidden;
  }

  public override tick(dtMs: number): void {
    super.tick(dtMs);
    if (this.isDead) return;
    if (this.transitionLeft > 0) {
      this.transitionLeft -= dtMs;
      this.halt();
      return;
    }
    if (this.stunnedByTrain > 0) this.stunnedByTrain -= dtMs;
    const now = this.world.now();
    // Phase 2+ : rames et renforts, en parallèle des attaques.
    if (this.phase >= 2) {
      if (now >= this.nextTrain) {
        this.nextTrain =
          now + (this.phase === 3 ? AUDITEUR.TRAIN_PERIOD_P3_MS : AUDITEUR.TRAIN_PERIOD_P2_MS);
        this.callTrain();
      }
      if (now >= this.nextReinforce) {
        this.nextReinforce = now + AUDITEUR.REINFORCE_PERIOD_MS;
        const consultants = this.world
          .livingEnemies()
          .filter((e) => e.kind === 'consultant').length;
        for (
          let i = 0;
          i < AUDITEUR.REINFORCE_COUNT && consultants + i < AUDITEUR.REINFORCE_MAX_ALIVE;
          i += 1
        ) {
          const angle = this.world.rng() * Math.PI * 2;
          const x = this.body.x + Math.cos(angle) * 60;
          const y = this.body.y + Math.sin(angle) * 40;
          const tx = Math.floor(x / this.world.arena.tileSize);
          const ty = Math.floor(y / this.world.arena.tileSize);
          if (!this.world.arena.solidAt(tx, ty)) this.world.spawnEnemy('consultant', x, y);
        }
        this.say('RENFORTS !', 'danger');
      }
    }
  }

  private say(text: string, tone: 'danger' | 'gold'): void {
    this.world.emit({ type: 'text', x: this.body.x, y: this.body.y - 60, text, tone });
  }

  private callTrain(): void {
    const band = pick(this.world.rng, this.world.arena.railBands);
    if (!band) return;
    this.world.emit({
      type: 'text',
      x: this.world.hero.body.x,
      y: band.y,
      text: 'VOIE 3 — PASSAGE',
      tone: 'danger',
    });
    this.world.spawnHazard({
      kind: 'band',
      x0: band.x0,
      x1: band.x1,
      y: band.y,
      height: band.height,
      telegraphMs: AUDITEUR.TRAIN_TELEGRAPH_MS,
      damage: Math.round(maxEnergy(this.world.run) * AUDITEUR.TRAIN_PLAYER_DAMAGE_PCT),
      owner: 'Une rame',
      speed: AUDITEUR.TRAIN_SPEED,
      onPass: (front) => {
        // L'attirer sur la voie, c'est la bonne idée : la rame le percute.
        const b = this.body;
        if (
          this.stunnedByTrain <= 0 &&
          !this.isDead &&
          b.y >= band.y - 8 &&
          b.y <= band.y + band.height + 8 &&
          Math.abs(front - b.x) < 40
        ) {
          this.stunnedByTrain = 2000;
          this.world.emit({ type: 'shake', px: 6, ms: 300 });
          this.say('CORRESPONDANCE !', 'gold');
          this.applyDamage(AUDITEUR.TRAIN_BOSS_DAMAGE, true, true);
          if (!this.isDead) this.fsm.request({ to: 'stagger', payload: { ms: 1500 } });
        }
      },
    });
  }

  protected think(): string | null {
    const now = this.world.now();
    const d = this.distToHero();
    this.facing = this.angleToHero();
    const h = this.world.hero.body;
    if (d > 60) this.moveToward(h.x, h.y);
    else this.halt();
    if (now < this.nextPatternAt) return null;
    const ready = (p: AuditeurPattern): boolean => (this.cooldowns.get(p) ?? 0) <= now;
    const options: AuditeurPattern[] = [];
    if (d <= AUDITEUR.SWEEP_RADIUS && ready('sweep')) options.push('sweep', 'sweep');
    if (ready('chrono')) options.push('chrono');
    if (ready('barrage') && d > 80) options.push('barrage');
    if (ready('stamp')) options.push('stamp');
    if (this.phase === 3 && ready('kpi')) options.push('kpi', 'kpi');
    return pick(this.world.rng, options) ?? null;
  }

  protected tokenFor(): null {
    return null;
  }

  protected windupMs(attack: string): number {
    const base: Record<AuditeurPattern, number> = {
      sweep: AUDITEUR.SWEEP_TELEGRAPH_MS,
      chrono: 300,
      barrage: AUDITEUR.BARRAGE_TELEGRAPH_MS,
      stamp: AUDITEUR.STAMP_TELEGRAPH_MS - AUDITEUR.STAMP_LOCK_MS,
      kpi: AUDITEUR.KPI_TELEGRAPH_MS,
    };
    return (base[attack as AuditeurPattern] ?? 600) / this.tempo;
  }

  protected onWindup(attack: string): void {
    const h = this.world.hero.body;
    this.facing = this.angleToHero();
    switch (attack as AuditeurPattern) {
      case 'sweep':
        this.telegraph = {
          kind: 'arc',
          x: this.body.x,
          y: this.body.y - SWEEP_ORIGIN_Y,
          angle: this.facing,
          reach: AUDITEUR.SWEEP_RADIUS,
          arcDeg: AUDITEUR.SWEEP_ARC_DEG,
        };
        break;
      case 'barrage':
        this.telegraph = {
          kind: 'arc',
          x: this.body.x,
          y: this.body.y,
          angle: this.facing,
          reach: BARRAGE_TELEGRAPH_REACH,
          arcDeg: AUDITEUR.BARRAGE_SPREAD_DEG + 10,
        };
        break;
      case 'stamp':
        this.stampTarget = { x: h.x, y: h.y };
        this.telegraph = {
          kind: 'circle',
          x: h.x,
          y: h.y,
          radius: AUDITEUR.STAMP_RADIUS,
        };
        break;
      case 'kpi':
        this.dashAngle = this.facing;
        this.telegraph = {
          kind: 'line',
          x: this.body.x,
          y: this.body.y,
          angle: this.dashAngle,
          length: AUDITEUR.KPI_DISTANCE,
          width: KPI_WIDTH,
        };
        break;
      default:
        break;
    }
  }

  protected override onAttackStart(attack: string): void {
    this.step = 0;
    this.stepAt = 0;
    const now = this.world.now();
    const pattern = attack as AuditeurPattern;
    this.cooldowns.set(pattern, now + COOLDOWNS[pattern] / this.tempo);
    this.world.emit({
      type: 'enemyStrike',
      id: this.id,
      attack,
      x: this.body.x,
      y: this.body.y,
      angle: this.facing,
    });
    if (attack === 'sweep') {
      this.world.emit({ type: 'shake', px: 3, ms: 150 });
      if (
        circleInArc(
          { x: this.body.x, y: this.body.y - SWEEP_ORIGIN_Y },
          this.facing,
          AUDITEUR.SWEEP_RADIUS,
          AUDITEUR.SWEEP_ARC_DEG,
          this.world.hero.hurtCircle,
        )
      ) {
        this.hitHero(AUDITEUR.SWEEP_DAMAGE, AUDITEUR.SWEEP_KNOCKBACK);
      }
    }
    if (attack === 'kpi') {
      this.dashFrom = { x: this.body.x, y: this.body.y };
      this.dashHit = false;
    }
  }

  protected updateAttack(attack: string, _dt: number, elapsed: number): number | null {
    const gap = (AUDITEUR.PATTERN_GAP_MS[this.phase - 1] ?? 1600) / this.tempo;
    const done = (recovery: number): number => {
      this.nextPatternAt = this.world.now() + gap;
      return recovery;
    };
    const h = this.world.hero.body;
    switch (attack as AuditeurPattern) {
      case 'sweep':
        return elapsed >= 200 ? done(AUDITEUR.SWEEP_RECOVERY_MS) : null;
      case 'chrono': {
        // 3 chronomètres posés en séquence sous le héros.
        if (this.step < AUDITEUR.CHRONO_COUNT && elapsed >= this.stepAt) {
          this.step += 1;
          this.stepAt = elapsed + AUDITEUR.CHRONO_GAP_MS / this.tempo;
          this.world.spawnHazard({
            kind: 'circle',
            x: h.x,
            y: h.y,
            radius: AUDITEUR.CHRONO_RADIUS,
            telegraphMs: AUDITEUR.CHRONO_TELEGRAPH_MS / this.tempo,
            damage: Math.round(AUDITEUR.CHRONO_DAMAGE * this.damageMult),
            owner: this.displayName,
          });
        }
        return this.step >= AUDITEUR.CHRONO_COUNT && elapsed >= this.stepAt ? done(300) : null;
      }
      case 'barrage': {
        if (this.step < AUDITEUR.BARRAGE_CYCLES && elapsed >= this.stepAt) {
          this.step += 1;
          this.stepAt = elapsed + 320 / this.tempo;
          const base = this.angleToHero() + (this.step % 2 === 0 ? 0.08 : -0.08);
          const spread = (AUDITEUR.BARRAGE_SPREAD_DEG * Math.PI) / 180;
          for (let i = 0; i < AUDITEUR.BARRAGE_COUNT; i += 1) {
            const t = i / Math.max(1, AUDITEUR.BARRAGE_COUNT - 1) - 0.5;
            this.world.spawnProjectile({
              x: this.body.x,
              y: this.body.y,
              angle: base + t * spread,
              speed: AUDITEUR.BARRAGE_SPEED * this.tempo,
              damage: Math.round(AUDITEUR.BARRAGE_DAMAGE * this.damageMult),
              lifeMs: 3000,
              radius: 3,
              owner: this.displayName,
              height: BARRAGE_ORIGIN_Y,
            });
          }
        }
        return this.step >= AUDITEUR.BARRAGE_CYCLES ? done(400) : null;
      }
      case 'stamp': {
        // Saut : il se dérobe 300 ms puis retombe sur la cible verrouillée.
        if (this.step === 0) {
          this.step = 1;
          this.hidden = true;
          this.body.enabled = false;
          const target = this.stampTarget;
          this.world.spawnHazard({
            kind: 'circle',
            x: target.x,
            y: target.y,
            radius: AUDITEUR.STAMP_RADIUS,
            telegraphMs: AUDITEUR.STAMP_LOCK_MS,
            damage: Math.round(AUDITEUR.STAMP_DAMAGE * this.damageMult),
            owner: this.displayName,
            onImpact: () => {
              this.land(target.x, target.y);
            },
          });
        }
        return elapsed >= AUDITEUR.STAMP_LOCK_MS + 200 ? done(700) : null;
      }
      case 'kpi': {
        const speed = (AUDITEUR.KPI_DISTANCE * 1000) / AUDITEUR.KPI_DURATION_MS;
        this.moveAngle(this.dashAngle, speed);
        if (!this.dashHit && Math.hypot(h.x - this.body.x, h.y - this.body.y) < 30) {
          this.dashHit = true;
          this.hitHero(AUDITEUR.KPI_DAMAGE, 48);
        }
        if (elapsed >= AUDITEUR.KPI_DURATION_MS || (elapsed > 0 && this.body.blocked)) {
          this.halt();
          this.world.spawnHazard({
            kind: 'line',
            x0: this.dashFrom.x,
            y0: this.dashFrom.y,
            x1: this.body.x,
            y1: this.body.y,
            width: 12,
            telegraphMs: 0,
            lingerMs: AUDITEUR.KPI_TRAIL_MS,
            tickMs: AUDITEUR.KPI_TRAIL_TICK_MS,
            damage: Math.round(AUDITEUR.KPI_TRAIL_DAMAGE * this.damageMult),
            owner: this.displayName,
          });
          return done(500);
        }
        return null;
      }
      default:
        return done(500);
    }
  }

  /** Retombée du « Contrôle ! » : il réapparaît sur la cible, onde de choc. */
  private land(x: number, y: number): void {
    const b = this.body;
    b.x = x;
    b.y = y;
    b.prevX = x;
    b.prevY = y;
    this.hidden = false;
    if (!this.isDead) b.enabled = true;
    this.world.emit({ type: 'shake', px: 6, ms: 250 });
    this.world.emit({ type: 'dust', x, y, count: 16 });
    this.world.emit({ type: 'enemyStrike', id: this.id, attack: 'land', x, y, angle: 0 });
    this.world.spawnHazard({
      kind: 'ring',
      x,
      y,
      maxRadius: AUDITEUR.STAMP_WAVE_RADIUS,
      thickness: 10,
      telegraphMs: 0,
      expandMs: 300,
      damage: Math.round(AUDITEUR.STAMP_WAVE_DAMAGE * this.damageMult),
      owner: this.displayName,
    });
  }

  protected override interruptible(): boolean {
    return false;
  }

  protected override onHurt(): void {
    const ratio = this.hp / this.maxHp;
    const next =
      ratio <= (AUDITEUR.PHASE_AT[1] ?? 0.25) ? 3 : ratio <= (AUDITEUR.PHASE_AT[0] ?? 0.6) ? 2 : 1;
    if (next > this.phase) {
      this.phase = next;
      this.transitionLeft = AUDITEUR.PHASE_TRANSITION_MS;
      this.telegraph = null;
      this.hidden = false;
      this.body.enabled = true;
      this.world.emit({ type: 'shake', px: 5, ms: 400 });
      const title = next === 2 ? 'PLAN DE TRANSPORT OPTIMISÉ' : 'OBJECTIF NON ATTEINT';
      this.world.emit({ type: 'bossPhase', phase: next, title });
      const now = this.world.now();
      this.nextTrain = now + 2500;
      this.nextReinforce = now + 4000;
      this.nextPatternAt = now + AUDITEUR.PHASE_TRANSITION_MS + 600;
      this.fsm.request({ to: 'recover', payload: { ms: AUDITEUR.PHASE_TRANSITION_MS } });
    }
  }

  protected override onDeath(): void {
    this.hidden = false;
    this.world.emit({ type: 'shake', px: 7, ms: 600 });
    this.world.emit({ type: 'explosion', x: this.body.x, y: this.body.y, scale: 2 });
    this.say('7:12', 'gold');
  }
}
