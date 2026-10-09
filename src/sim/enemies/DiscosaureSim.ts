import { DISCOSAURE } from '@/config/balance';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { circleInArc } from '@/systems/combat/geometry';
import { pick } from '@/utils/rng';
import type { HazardSim } from '@/sim/Hazards';
import type { SimWorld } from '@/sim/SimWorld';
import type { EnemyHit, PhasedEnemy } from '@/sim/enemies/EnemySim';
import { EnemySim } from '@/sim/enemies/EnemySim';

export type DiscoPattern = 'spots' | 'stomp' | 'charge' | 'tail' | 'lasers';

const SPOTS_WINDUP_MS = 700;
const CHARGE_SPEED = (DISCOSAURE.CHARGE_DISTANCE * 1000) / DISCOSAURE.CHARGE_DURATION_MS;

/**
 * Mini-boss du biome 3 : le Discosaure (LORE § 6.9 ; GDD § 7.10 ; game_designer.md § 11.1).
 * - **Piste de danse** : la boule accélère, ses taches de lumière tournent autour de lui (contour
 *   magenta), se figent, se remplissent puis explosent (télégraphe total de 1,4 s) ;
 * - **Piétinement** (900 ms) : cercle de 56 u puis onde de 0 à 140 u (se traverse au dash) ;
 * - **Charge** (1 s, couloir 240 × 40) : s'il percute un mur, il est étourdi 1,2 s (+25 %) ;
 * - **Coup de queue** (800 ms) : demi-cercle **arrière** contre qui cherche son dos ;
 * - **Lasers** (phase 2, sous 50 %) : 4 faisceaux en croix qui tournent 3 s — coupés en Réduction des
 *   mouvements (décision du porteur).
 * Dos (boule à facettes) ×1,5. Sifflet : la musique s'arrête (taches figées 3 s) ; Préavis : coupure de
 * courant (taches éteintes 5 s).
 */
export class DiscosaureSim extends EnemySim implements PhasedEnemy {
  public phase = 1;
  public transitionLeft = 0;
  private nextPatternAt = 0;
  private readonly cooldowns = new Map<DiscoPattern, number>();
  private readonly spots: HazardSim[] = [];
  private lasers: HazardSim | null = null;
  private chargeAngle = 0;
  private chargeHit = false;
  /** Coupure de courant (Préavis) : plus aucune tache. */
  public blackoutLeft = 0;
  /** Étourdi contre un mur après une charge (lecture côté vue). */
  public dizzyLeft = 0;

  public constructor(world: SimWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'discosaure', x, y, scale);
    const now = world.now();
    this.nextPatternAt = now + 1200;
    this.cooldowns.set('spots', now + DISCOSAURE.SPOTS_FIRST_AT_MS);
    this.cooldowns.set('lasers', now + 4000);
  }

  /** Taches dangereuses en cours (vue : la boule accélère). */
  public get dancing(): boolean {
    return this.spots.some((s) => !s.done);
  }

  public override isHittable(): boolean {
    return super.isHittable() && this.transitionLeft <= 0;
  }

  public override tick(dtMs: number): void {
    if (this.blackoutLeft > 0) this.blackoutLeft = Math.max(0, this.blackoutLeft - dtMs);
    if (this.dizzyLeft > 0) this.dizzyLeft = Math.max(0, this.dizzyLeft - dtMs);
    super.tick(dtMs);
    if (this.isDead) return;
    if (this.transitionLeft > 0) {
      this.transitionLeft -= dtMs;
      this.halt();
    }
    for (let i = this.spots.length - 1; i >= 0; i -= 1) {
      if (this.spots[i]?.done) this.spots.splice(i, 1);
    }
    if (this.lasers?.done) this.lasers = null;
  }

  private ready(p: DiscoPattern): boolean {
    return (this.cooldowns.get(p) ?? 0) <= this.world.now();
  }

  /** Le héros est-il dans son dos ? */
  private heroBehind(): boolean {
    const diff = Math.abs(wrap(this.angleToHero() - this.facing));
    return diff > Math.PI - (DISCOSAURE.BACK_ARC_DEG * Math.PI) / 360 - 0.35;
  }

  protected think(): string | null {
    const now = this.world.now();
    const d = this.distToHero();
    const h = this.world.hero.body;
    if (this.transitionLeft > 0) return null;
    // Il avance en rythme, lourdement, en tournant lentement vers le héros.
    const target = this.angleToHero();
    this.facing += wrap(target - this.facing) * 0.04;
    if (d > 70) this.moveAngle(this.facing, this.speed);
    else this.halt();
    if (now < this.nextPatternAt) return null;
    if (this.heroBehind() && d <= DISCOSAURE.TAIL_RADIUS + 10 && this.ready('tail')) return 'tail';
    const options: DiscoPattern[] = [];
    if (this.ready('spots') && this.blackoutLeft <= 0 && !this.dancing)
      options.push('spots', 'spots');
    if (d <= DISCOSAURE.STOMP_RADIUS + 50 && this.ready('stomp')) options.push('stomp', 'stomp');
    if (d > 90 && this.ready('charge')) options.push('charge');
    if (this.phase >= 2 && this.ready('lasers') && !this.world.reducedMotion)
      options.push('lasers');
    if (options.length === 0 && d <= 120 && this.ready('stomp')) options.push('stomp');
    const choice = pick(this.world.rng, options) ?? null;
    if (choice) this.facing = Math.atan2(h.y - this.body.y, h.x - this.body.x);
    return choice;
  }

  protected tokenFor(): TokenKind | null {
    return null;
  }

  protected windupMs(attack: string): number {
    switch (attack as DiscoPattern) {
      case 'spots':
        return SPOTS_WINDUP_MS;
      case 'stomp':
        return DISCOSAURE.STOMP_TELEGRAPH_MS;
      case 'charge':
        return DISCOSAURE.CHARGE_TELEGRAPH_MS;
      case 'tail':
        return DISCOSAURE.TAIL_TELEGRAPH_MS;
      case 'lasers':
        return DISCOSAURE.LASER_TELEGRAPH_MS;
    }
  }

  protected onWindup(attack: string): void {
    const b = this.body;
    switch (attack as DiscoPattern) {
      case 'spots':
        this.telegraph = null;
        break;
      case 'stomp':
        this.telegraph = { kind: 'circle', x: b.x, y: b.y, radius: DISCOSAURE.STOMP_RADIUS };
        break;
      case 'charge':
        this.chargeAngle = this.angleToHero();
        this.facing = this.chargeAngle;
        this.telegraph = {
          kind: 'line',
          x: b.x,
          y: b.y,
          angle: this.chargeAngle,
          length: DISCOSAURE.CHARGE_DISTANCE,
          width: DISCOSAURE.CHARGE_WIDTH,
        };
        break;
      case 'tail':
        this.telegraph = {
          kind: 'arc',
          x: b.x,
          y: b.y,
          angle: this.facing + Math.PI,
          reach: DISCOSAURE.TAIL_RADIUS,
          arcDeg: DISCOSAURE.TAIL_ARC_DEG,
        };
        break;
      case 'lasers':
        this.telegraph = null;
        this.lasers = this.world.spawnHazard({
          kind: 'beams',
          x: b.x,
          y: b.y - 4,
          count: DISCOSAURE.LASER_COUNT,
          length: DISCOSAURE.LASER_LENGTH,
          width: DISCOSAURE.LASER_WIDTH,
          angle0: this.world.rng() * Math.PI,
          degPerS: DISCOSAURE.LASER_TURN_DEG_PER_S,
          telegraphMs: DISCOSAURE.LASER_TELEGRAPH_MS,
          durationMs: DISCOSAURE.LASER_DURATION_MS,
          damage: Math.round(DISCOSAURE.LASER_DAMAGE * this.damageMult),
          tickMs: DISCOSAURE.LASER_TICK_MS,
          owner: this.displayName,
        });
        break;
    }
  }

  protected override onAttackStart(attack: string): void {
    const now = this.world.now();
    const b = this.body;
    const pattern = attack as DiscoPattern;
    const cd: Record<DiscoPattern, number> = {
      spots: DISCOSAURE.SPOTS_PERIOD_MS,
      stomp: 3500,
      charge: DISCOSAURE.CHARGE_COOLDOWN_MS,
      tail: 2500,
      lasers: DISCOSAURE.LASER_COOLDOWN_MS,
    };
    this.cooldowns.set(pattern, now + cd[pattern]);
    this.world.emit({
      type: 'enemyStrike',
      id: this.id,
      attack,
      x: b.x,
      y: b.y,
      angle: this.facing,
    });
    switch (pattern) {
      case 'spots':
        this.danceFloor();
        break;
      case 'stomp': {
        this.world.emit({ type: 'shake', px: 4, ms: 220 });
        this.world.emit({ type: 'dust', x: b.x, y: b.y, count: 18 });
        const hc = this.world.hero.hurtCircle;
        if (Math.hypot(hc.x - b.x, hc.y + 6 - b.y) <= DISCOSAURE.STOMP_RADIUS + hc.r)
          this.hitHero(DISCOSAURE.STOMP_DAMAGE, 40);
        this.world.spawnHazard({
          kind: 'ring',
          x: b.x,
          y: b.y,
          maxRadius: DISCOSAURE.STOMP_WAVE_RADIUS,
          thickness: DISCOSAURE.STOMP_WAVE_THICKNESS,
          telegraphMs: 0,
          expandMs: DISCOSAURE.STOMP_WAVE_EXPAND_MS,
          damage: Math.round(DISCOSAURE.STOMP_WAVE_DAMAGE * this.damageMult),
          owner: this.displayName,
          skin: 'stomp',
        });
        break;
      }
      case 'charge':
        this.chargeHit = false;
        break;
      case 'tail':
        if (
          circleInArc(
            { x: b.x, y: b.y },
            this.facing + Math.PI,
            DISCOSAURE.TAIL_RADIUS,
            DISCOSAURE.TAIL_ARC_DEG,
            this.world.hero.hurtCircle,
          )
        )
          this.hitHero(DISCOSAURE.TAIL_DAMAGE, DISCOSAURE.TAIL_KNOCKBACK);
        break;
      case 'lasers':
        break;
    }
  }

  /** Piste de danse : N taches en orbite autour de lui, qui se figent puis explosent. */
  private danceFloor(): void {
    const b = this.body;
    const n = this.phase >= 2 ? DISCOSAURE.SPOTS_COUNT_P2 : DISCOSAURE.SPOTS_COUNT;
    const turn =
      this.phase >= 2 ? DISCOSAURE.SPOTS_TURN_DEG_PER_S_P2 : DISCOSAURE.SPOTS_TURN_DEG_PER_S;
    const base = this.world.rng() * Math.PI * 2;
    const h = this.world.hero.body;
    for (let i = 0; i < n; i += 1) {
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const radius =
        DISCOSAURE.SPOTS_ORBIT_MIN + (DISCOSAURE.SPOTS_ORBIT_MAX - DISCOSAURE.SPOTS_ORBIT_MIN) * t;
      // Une tache vise toujours la position du héros à la fin de l'orbite (il faut bouger).
      const aimed = i === n - 1 ? Math.atan2(h.y - b.y, h.x - b.x) : base + i * 2.399;
      const swept = (((turn * DISCOSAURE.SPOTS_ORBIT_MS) / 1000) * Math.PI) / 180;
      const dist =
        i === n - 1
          ? Math.min(DISCOSAURE.SPOTS_ORBIT_MAX, Math.hypot(h.x - b.x, h.y - b.y))
          : radius;
      this.spots.push(
        this.world.spawnHazard({
          kind: 'circle',
          x: b.x,
          y: b.y,
          radius: DISCOSAURE.SPOTS_RADIUS,
          telegraphMs: DISCOSAURE.SPOTS_TELEGRAPH_MS,
          damage: Math.round(DISCOSAURE.SPOTS_DAMAGE * this.damageMult),
          owner: this.displayName,
          skin: 'spot',
          orbit: {
            cx: b.x,
            cy: b.y,
            radius: Math.max(DISCOSAURE.SPOTS_ORBIT_MIN, dist),
            angle0: aimed - swept,
            degPerS: turn,
            ms: DISCOSAURE.SPOTS_ORBIT_MS,
          },
        }),
      );
    }
    this.world.emit({ type: 'fx', name: 'facets', x: b.x, y: b.y, value: n });
  }

  protected updateAttack(attack: string, _dt: number, elapsed: number): number | null {
    const gap = DISCOSAURE.PATTERN_GAP_MS[this.phase - 1] ?? 1400;
    const done = (recovery: number): number => {
      this.nextPatternAt = this.world.now() + gap;
      return recovery;
    };
    switch (attack as DiscoPattern) {
      case 'spots':
        return elapsed >= 200 ? done(200) : null;
      case 'stomp':
        return elapsed >= 150 ? done(DISCOSAURE.STOMP_RECOVERY_MS) : null;
      case 'tail':
        return elapsed >= 150 ? done(DISCOSAURE.TAIL_RECOVERY_MS) : null;
      case 'lasers':
        this.halt();
        return elapsed >= DISCOSAURE.LASER_DURATION_MS ? done(500) : null;
      case 'charge': {
        this.moveAngle(this.chargeAngle, CHARGE_SPEED);
        const h = this.world.hero.body;
        if (!this.chargeHit && Math.hypot(h.x - this.body.x, h.y - this.body.y) < 34) {
          this.chargeHit = true;
          this.hitHero(DISCOSAURE.CHARGE_DAMAGE, 56);
        }
        if (elapsed > 60 && this.body.blocked) {
          // Fin de soirée contre le mur : étourdi, +25 % de dégâts subis.
          this.halt(true);
          this.world.emit({ type: 'wallSlam', x: this.body.x, y: this.body.y });
          this.world.emit({ type: 'shake', px: 6, ms: 300 });
          this.world.emit({
            type: 'text',
            x: this.body.x,
            y: this.body.y,
            text: 'FIN DE SOIRÉE !',
            tone: 'gold',
          });
          this.dizzy();
          return null;
        }
        if (elapsed >= DISCOSAURE.CHARGE_DURATION_MS) {
          this.halt(true);
          return done(700);
        }
        return null;
      }
    }
  }

  private dizzy(): void {
    this.dizzyLeft = DISCOSAURE.DIZZY_MS;
    this.makeVulnerable(DISCOSAURE.DIZZY_DAMAGE_TAKEN, DISCOSAURE.DIZZY_MS);
    this.nextPatternAt = this.world.now() + DISCOSAURE.DIZZY_MS + 600;
    this.stun(DISCOSAURE.DIZZY_MS);
  }

  protected override interruptible(): boolean {
    return false;
  }

  /** Dos (boule à facettes) : ×1,5. */
  protected override damageTakenMult(hit: EnemyHit): number {
    const from = Math.atan2(hit.fromY - this.body.y, hit.fromX - this.body.x);
    const back =
      Math.abs(wrap(from - this.facing)) > Math.PI - (DISCOSAURE.BACK_ARC_DEG * Math.PI) / 360;
    return super.damageTakenMult(hit) * (back ? DISCOSAURE.BACK_MULT : 1);
  }

  protected override onHurt(): void {
    if (this.phase === 1 && this.hp <= this.maxHp * DISCOSAURE.PHASE_AT) {
      this.phase = 2;
      this.transitionLeft = DISCOSAURE.PHASE_TRANSITION_MS;
      this.telegraph = null;
      this.world.emit({ type: 'bossPhase', phase: 2, title: 'BOULE EN SURCHAUFFE' });
      this.world.emit({ type: 'shake', px: 5, ms: 400 });
      const now = this.world.now();
      this.nextPatternAt = now + DISCOSAURE.PHASE_TRANSITION_MS + 400;
      this.cooldowns.set('lasers', now + DISCOSAURE.PHASE_TRANSITION_MS + 800);
      this.fsm.request({ to: 'recover', payload: { ms: DISCOSAURE.PHASE_TRANSITION_MS } });
    }
  }

  public override onHeroSpecial(
    kind: 'whistle' | 'preavis',
    x: number,
    y: number,
    r: number,
  ): void {
    if (this.isDead) return;
    if (kind === 'whistle') {
      // « La musique s'arrête » : les taches se figent.
      for (const s of this.spots) s.freeze(DISCOSAURE.WHISTLE_FREEZE_MS);
      this.world.emit({ type: 'fx', name: 'discoFreeze', x: this.body.x, y: this.body.y });
      if (Math.hypot(this.body.x - x, this.body.y - y) <= r + 40)
        this.stun(DISCOSAURE.STUN_WHISTLE_MS);
    } else {
      // « Coupure de courant » : la boule s'éteint.
      for (const s of this.spots) s.finish();
      this.lasers?.finish();
      this.blackoutLeft = DISCOSAURE.PREAVIS_BLACKOUT_MS;
      this.world.emit({ type: 'fx', name: 'discoBlackout', x: this.body.x, y: this.body.y });
      this.stun(DISCOSAURE.STUN_PREAVIS_MS);
    }
  }

  public override onPerfectDash(x: number, y: number): void {
    if (this.state !== 'attack' || this.currentAttack !== 'charge') return;
    if (Math.hypot(this.body.x - x, this.body.y - y) > 70) return;
    this.halt(true);
    this.world.emit({
      type: 'text',
      x: this.body.x,
      y: this.body.y,
      text: 'TRÉBUCHE !',
      tone: 'gold',
    });
    this.dizzy();
  }

  protected override onDeath(): void {
    for (const s of this.spots) s.finish();
    this.lasers?.finish();
    this.world.emit({ type: 'fx', name: 'sequins', x: this.body.x, y: this.body.y });
    this.world.emit({ type: 'shake', px: 6, ms: 500 });
    this.world.emit({
      type: 'text',
      x: this.body.x,
      y: this.body.y - 50,
      text: '… La musique… s’est arrêtée ?',
      tone: 'gold',
    });
  }
}

function wrap(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}
