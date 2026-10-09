import { AUDITEUR } from '@/config/balance';
import { Colors, Css } from '@/config/constants';
import type { EnemyScale } from '@/systems/combat/damage';
import { circleInArc } from '@/systems/combat/geometry';
import { maxEnergy } from '@/systems/meta/RunState';
import { pick } from '@/utils/rng';
import type { CombatWorld } from '@/entities/CombatWorld';
import type { EnemyHit } from '@/entities/Enemy';
import { Enemy } from '@/entities/Enemy';

type Pattern = 'sweep' | 'chrono' | 'barrage' | 'stamp' | 'kpi';

/**
 * Boss 1 : l'Auditeur des Quais, aux commandes de la Borne Totale 3000 (96×96).
 * Phase 1 « Audit bienveillant » : bras-barrière, chronomètres, barrage de tickets, « Contrôle ! ».
 * Phase 2 (60 %) « Plan de transport optimisé » : il commande les rames et appelle des renforts.
 * Phase 3 (25 %) « Objectif non atteint » : ruées qui laissent des lignes de KPI, tout 20 % plus rapide.
 */
export class Auditeur extends Enemy {
  protected readonly directional = false;
  protected readonly animPrefix = 'auditeur';
  public phase = 1;
  private nextPatternAt = 0;
  private readonly cooldowns = new Map<Pattern, number>();
  private nextTrain = 0;
  private nextReinforce = 0;
  private transitionLeft = 0;
  private step = 0;
  private stepAt = 0;
  private stampTarget = { x: 0, y: 0 };
  private dashFrom = { x: 0, y: 0 };
  private dashAngle = 0;
  private dashHit = false;
  private stunnedByTrain = 0;

  public constructor(world: CombatWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'auditeur', x, y, 'auditeur-idle', scale);
    const now = world.now();
    this.nextPatternAt = now + 1500;
  }

  private get tempo(): number {
    return this.phase === 3 ? AUDITEUR.P3_SPEED_MULT : 1;
  }

  protected override get speed(): number {
    return (AUDITEUR.SPEEDS[this.phase - 1] ?? AUDITEUR.speed) * this.speedMult;
  }

  protected override idleAnim(): string {
    return this.phase >= 2 ? 'idle-p2' : 'idle';
  }

  public override isHittable(): boolean {
    return super.isHittable() && this.transitionLeft <= 0;
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
          this.world.spawnEnemy(
            'consultant',
            this.x + Math.cos(angle) * 60,
            this.y + Math.sin(angle) * 40,
          );
        }
        this.world.feel.floatText(this.x, this.y - 100, 'RENFORTS !', Css.danger, 1200);
      }
    }
  }

  private callTrain(): void {
    const bands = this.world.room.railBands;
    const band = pick(this.world.rng, bands);
    if (!band) return;
    this.world.feel.floatText(
      this.world.player.x,
      band.y - 6,
      'VOIE 3 — PASSAGE',
      Css.danger,
      1500,
    );
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
        if (
          this.stunnedByTrain <= 0 &&
          !this.isDead &&
          this.y >= band.y - 8 &&
          this.y <= band.y + band.height + 8 &&
          Math.abs(front - this.x) < 40
        ) {
          this.stunnedByTrain = 2000;
          this.world.feel.shake(6, 300);
          this.world.feel.floatText(this.x, this.y - 100, 'CORRESPONDANCE !', Css.quaiYellow, 1400);
          this.applyDamage(AUDITEUR.TRAIN_BOSS_DAMAGE, true);
          if (!this.isDead) this.fsm.request({ to: 'stagger', payload: { ms: 1500 } });
        }
      },
    });
  }

  protected think(): string | null {
    const now = this.world.now();
    const d = this.distToPlayer();
    this.facing = this.angleToPlayer();
    if (d > 60) {
      this.moveToward(this.world.player.x, this.world.player.y);
      this.playAnim(this.phase >= 2 ? 'move-p2' : 'move');
    } else {
      this.halt();
      this.playAnim(this.idleAnim());
    }
    if (now < this.nextPatternAt) return null;
    const ready = (p: Pattern): boolean => (this.cooldowns.get(p) ?? 0) <= now;
    const options: Pattern[] = [];
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
    const base: Record<Pattern, number> = {
      sweep: AUDITEUR.SWEEP_TELEGRAPH_MS,
      chrono: 300,
      barrage: AUDITEUR.BARRAGE_TELEGRAPH_MS,
      stamp: AUDITEUR.STAMP_TELEGRAPH_MS - AUDITEUR.STAMP_LOCK_MS,
      kpi: AUDITEUR.KPI_TELEGRAPH_MS,
    };
    return (base[attack as Pattern] ?? 600) / this.tempo;
  }

  protected onWindup(attack: string): void {
    const p = this.world.player;
    this.facing = this.angleToPlayer();
    switch (attack as Pattern) {
      case 'sweep': {
        this.playAnim('attack-sweep', true);
        const half = (AUDITEUR.SWEEP_ARC_DEG * Math.PI) / 360;
        this.showTelegraph((g) =>
          g
            .fillStyle(Colors.danger, 0.22)
            .slice(
              this.x,
              this.y - 20,
              AUDITEUR.SWEEP_RADIUS,
              this.facing - half,
              this.facing + half,
            )
            .fillPath(),
        );
        break;
      }
      case 'barrage':
        this.playAnim('attack-barrage', true);
        this.showTelegraph((g) =>
          g.lineStyle(2, Colors.danger, 0.8).strokeCircle(this.x, this.y - 40, 10),
        );
        break;
      case 'stamp':
        this.playAnim('attack-stamp', true);
        this.stampTarget = { x: p.x, y: p.y };
        this.showTelegraph((g) =>
          g.lineStyle(1, Colors.danger, 0.9).strokeCircle(p.x, p.y, AUDITEUR.STAMP_RADIUS),
        );
        break;
      case 'kpi': {
        this.dashAngle = this.angleToPlayer();
        const x1 = this.x + Math.cos(this.dashAngle) * AUDITEUR.KPI_DISTANCE;
        const y1 = this.y + Math.sin(this.dashAngle) * AUDITEUR.KPI_DISTANCE;
        this.showTelegraph((g) =>
          g.lineStyle(24, Colors.danger, 0.2).lineBetween(this.x, this.y, x1, y1),
        );
        this.playAnim('move-p2', true);
        break;
      }
      default:
        this.playAnim('attack-barrage', true);
    }
  }

  protected override onAttackStart(attack: string): void {
    this.step = 0;
    this.stepAt = 0;
    const now = this.world.now();
    const cd: Record<Pattern, number> = {
      sweep: 2500,
      chrono: 9000,
      barrage: 8000,
      stamp: 6000,
      kpi: 8000,
    };
    this.cooldowns.set(attack as Pattern, now + (cd[attack as Pattern] ?? 5000) / this.tempo);
    if (attack === 'sweep') {
      const p = this.world.player;
      this.world.feel.shake(3, 150);
      if (
        circleInArc(
          { x: this.x, y: this.y - 20 },
          this.facing,
          AUDITEUR.SWEEP_RADIUS,
          AUDITEUR.SWEEP_ARC_DEG,
          p.hurtCircle,
        )
      ) {
        this.hitPlayer(AUDITEUR.SWEEP_DAMAGE, AUDITEUR.SWEEP_KNOCKBACK);
      }
    }
    if (attack === 'kpi') {
      this.dashFrom = { x: this.x, y: this.y };
      this.dashHit = false;
    }
  }

  protected updateAttack(attack: string, _dt: number, elapsed: number): number | null {
    const gap = (AUDITEUR.PATTERN_GAP_MS[this.phase - 1] ?? 1600) / this.tempo;
    const done = (recovery: number): number => {
      this.nextPatternAt = this.world.now() + gap;
      return recovery;
    };
    const p = this.world.player;
    switch (attack as Pattern) {
      case 'sweep':
        return elapsed >= 200 ? done(AUDITEUR.SWEEP_RECOVERY_MS) : null;
      case 'chrono': {
        // 3 chronomètres posés en séquence sous le héros.
        if (this.step < AUDITEUR.CHRONO_COUNT && elapsed >= this.stepAt) {
          this.step += 1;
          this.stepAt = elapsed + AUDITEUR.CHRONO_GAP_MS / this.tempo;
          this.world.spawnHazard({
            kind: 'circle',
            x: p.x,
            y: p.y,
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
          const base = this.angleToPlayer() + (this.step % 2 === 0 ? 0.08 : -0.08);
          const spread = (AUDITEUR.BARRAGE_SPREAD_DEG * Math.PI) / 180;
          for (let i = 0; i < AUDITEUR.BARRAGE_COUNT; i += 1) {
            const t = i / Math.max(1, AUDITEUR.BARRAGE_COUNT - 1) - 0.5;
            this.world.spawnProjectile({
              x: this.x,
              y: this.y - 40,
              angle: base + t * spread,
              speed: AUDITEUR.BARRAGE_SPEED * this.tempo,
              damage: Math.round(AUDITEUR.BARRAGE_DAMAGE * this.damageMult),
              lifeMs: 3000,
              radius: 3,
              owner: this.displayName,
            });
          }
        }
        return this.step >= AUDITEUR.BARRAGE_CYCLES ? done(400) : null;
      }
      case 'stamp': {
        // Saut : il se dérobe 300 ms puis retombe sur la cible verrouillée.
        if (this.step === 0) {
          this.step = 1;
          this.setVisible(false);
          this.body.enable = false;
          this.world.spawnHazard({
            kind: 'circle',
            x: this.stampTarget.x,
            y: this.stampTarget.y,
            radius: AUDITEUR.STAMP_RADIUS,
            telegraphMs: AUDITEUR.STAMP_LOCK_MS,
            damage: Math.round(AUDITEUR.STAMP_DAMAGE * this.damageMult),
            owner: this.displayName,
            onImpact: () => {
              this.setPosition(this.stampTarget.x, this.stampTarget.y);
              this.body.reset(this.stampTarget.x, this.stampTarget.y);
              this.setVisible(true);
              this.body.enable = true;
              this.world.feel.shake(6, 250);
              this.world.feel.dustAt(this.x, this.y, 16);
              this.world.vfx('vfx-shockwave', this.x, this.y - 8, { scale: 0.8 });
              this.world.spawnHazard({
                kind: 'ring',
                x: this.x,
                y: this.y,
                maxRadius: AUDITEUR.STAMP_WAVE_RADIUS,
                thickness: 10,
                telegraphMs: 0,
                expandMs: 300,
                damage: Math.round(AUDITEUR.STAMP_WAVE_DAMAGE * this.damageMult),
                owner: this.displayName,
              });
            },
          });
        }
        return elapsed >= AUDITEUR.STAMP_LOCK_MS + 200 ? done(700) : null;
      }
      case 'kpi': {
        const speed = (AUDITEUR.KPI_DISTANCE * 1000) / AUDITEUR.KPI_DURATION_MS;
        this.moveAngle(this.dashAngle, speed);
        if (!this.dashHit && Math.hypot(p.x - this.x, p.y - this.y) < 30) {
          this.dashHit = true;
          this.hitPlayer(AUDITEUR.KPI_DAMAGE, 48);
        }
        if (elapsed >= AUDITEUR.KPI_DURATION_MS || !this.body.blocked.none) {
          this.halt();
          this.world.spawnHazard({
            kind: 'line',
            x0: this.dashFrom.x,
            y0: this.dashFrom.y,
            x1: this.x,
            y1: this.y,
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

  protected override interruptible(): boolean {
    return false;
  }

  protected override onHurt(_amount: number, _hit: EnemyHit): void {
    const ratio = this.hp / this.maxHp;
    const next =
      ratio <= (AUDITEUR.PHASE_AT[1] ?? 0.25) ? 3 : ratio <= (AUDITEUR.PHASE_AT[0] ?? 0.6) ? 2 : 1;
    if (next > this.phase) {
      this.phase = next;
      this.transitionLeft = AUDITEUR.PHASE_TRANSITION_MS;
      this.hideTelegraph();
      this.setVisible(true);
      this.body.enable = true;
      this.playAnim('phase', true);
      this.world.feel.shake(5, 400);
      this.world.feel.floatText(
        this.x,
        this.y - 104,
        next === 2 ? 'PLAN DE TRANSPORT OPTIMISÉ' : 'OBJECTIF NON ATTEINT',
        Css.danger,
        1800,
      );
      const now = this.world.now();
      this.nextTrain = now + 2500;
      this.nextReinforce = now + 4000;
      this.nextPatternAt = now + AUDITEUR.PHASE_TRANSITION_MS + 600;
      this.fsm.request({ to: 'recover', payload: { ms: AUDITEUR.PHASE_TRANSITION_MS } });
    }
  }

  protected override onDeath(): void {
    this.setVisible(true);
    this.world.feel.shake(7, 600);
    this.world.vfx('vfx-explosion', this.x, this.y - 40, { scale: 2 });
    this.world.feel.floatText(this.x, this.y - 104, '7:12', Css.quaiYellow, 2500);
  }
}
