import type { EnemyKind, EnemyStats } from '@/config/balance';
import { ENEMY_NAMES, ENEMY_RULES, ENEMY_STATS, HERO } from '@/config/balance';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { incoming } from '@/systems/combat/damage';
import type { Circle } from '@/systems/combat/geometry';
import { StateMachine } from '@/systems/StateMachine';
import type { StateTable } from '@/systems/StateMachine';
import type { Body, SimWorld } from '@/sim/SimWorld';
import { makeBody } from '@/sim/SimWorld';

export interface EnemyHit {
  readonly amount: number;
  readonly crit: boolean;
  readonly fromX: number;
  readonly fromY: number;
  readonly knockbackAngle: number;
  readonly knockbackPx: number;
  readonly knockbackMs: number;
  readonly stunMs: number;
  readonly slow: number;
  readonly slowMs: number;
  readonly vulnerable: number;
  readonly meltdownStun: boolean;
  /** Coup lourd (coup 3, spéciale) : réaction plus marquée côté vue. */
  readonly heavy: boolean;
}

export interface HitResult {
  readonly dealt: number;
  readonly killed: boolean;
}

/** États communs à tous les ennemis (docs/ARCHITECTURE.md, « IA des ennemis »). */
export interface EnemyStates {
  spawn: null;
  chase: null;
  windup: { readonly attack: string };
  attack: { readonly attack: string };
  recover: { readonly ms: number };
  stagger: { readonly ms: number };
  dead: null;
}

export type EnemyStateName = keyof EnemyStates;

/** Télégraphe à afficher au sol (magenta), en unités logiques. */
export type Telegraph =
  | {
      readonly kind: 'arc';
      readonly x: number;
      readonly y: number;
      readonly angle: number;
      readonly reach: number;
      readonly arcDeg: number;
    }
  | {
      readonly kind: 'line';
      readonly x: number;
      readonly y: number;
      readonly angle: number;
      readonly length: number;
      readonly width: number;
    };

let nextId = 1;

/**
 * Ennemi de base (port pur de `entities/Enemy.ts`) : corps aux pieds, hurtbox circulaire, PV mis à
 * l'échelle de la salle, knockback (et plaquage contre les murs), étourdissement, jetons d'attaque et
 * machine à états commune. Les sous-classes ne décrivent que leur comportement.
 */
export abstract class EnemySim {
  public readonly id = nextId++;
  public readonly stats: EnemyStats;
  public readonly body: Body;
  public hp: number;
  public readonly maxHp: number;
  public readonly damageMult: number;
  public readonly speedMult: number;
  /** Angle vers lequel l'ennemi regarde. */
  public facing = Math.PI / 2;
  /** Télégraphe en cours (lu par la vue), ou `null`. */
  public telegraph: Telegraph | null = null;
  /** Retiré du monde (fin du fondu du corps) : la vue peut libérer ses ressources. */
  public removed = false;
  /** Attaque en cours (télégraphe puis exécution). */
  public currentAttack = '';
  protected readonly fsm: StateMachine<EnemySim, EnemyStates>;
  private kbLeft = 0;
  private kbVx = 0;
  private kbVy = 0;
  private slowLeft = 0;
  private slowFactor = 0;
  private vulnLeft = 0;
  private vulnBonus = 0;
  private tokenKind: TokenKind | null = null;
  private recoverMs = 0;

  protected constructor(
    protected readonly world: SimWorld,
    public readonly kind: EnemyKind,
    x: number,
    y: number,
    scale: EnemyScale,
  ) {
    this.stats = ENEMY_STATS[kind];
    this.maxHp = Math.round(this.stats.hp * scale.hp);
    this.hp = this.maxHp;
    this.damageMult = scale.damage;
    this.speedMult = scale.speed;
    // Même rayon de pieds que le corps Arcade de la version Phaser.
    this.body = makeBody(x, y, Math.max(5, Math.round(this.stats.hurtRadius * 0.7)));
    this.fsm = new StateMachine<EnemySim, EnemyStates>(this, this.buildStates(), (_from, to) => {
      if (to !== 'windup' && to !== 'attack') this.releaseToken();
    });
  }

  public get displayName(): string {
    return ENEMY_NAMES[this.kind];
  }

  /** Élite ou boss : étourdissements réduits. */
  public get isHeavy(): boolean {
    return this.kind === 'manager' || this.kind === 'auditeur';
  }

  public get hurtCircle(): Circle {
    return { x: this.body.x, y: this.body.y - this.stats.hurtOffsetY, r: this.stats.hurtRadius };
  }

  public get state(): EnemyStateName {
    return this.fsm.current;
  }

  /** Temps passé dans l'état courant (ms de jeu). */
  public get stateTime(): number {
    return this.fsm.timeInState;
  }

  public get isDead(): boolean {
    return this.fsm.is('dead');
  }

  /** Progression du télégraphe d'apparition ou d'attaque (0..1). */
  public get windupProgress(): number {
    if (this.fsm.is('spawn')) return Math.min(1, this.stateTime / ENEMY_RULES.SPAWN_TELEGRAPH_MS);
    if (this.fsm.is('windup'))
      return Math.min(1, this.stateTime / Math.max(1, this.windupMs(this.currentAttack)));
    return 0;
  }

  /** Visible (le corps est apparu) : fin du télégraphe d'apparition. */
  public get materialized(): boolean {
    return !this.fsm.is('spawn') || this.stateTime >= ENEMY_RULES.SPAWN_TELEGRAPH_MS;
  }

  /** Touchable : ni en apparition, ni mort. */
  public isHittable(): boolean {
    return !this.fsm.is('spawn', 'dead');
  }

  public start(immediate = false): void {
    this.fsm.start(immediate ? { to: 'chase', payload: null } : { to: 'spawn', payload: null });
  }

  // ─── Boucle ────────────────────────────────────────────────────────────────

  public tick(dtMs: number): void {
    if (this.slowLeft > 0) this.slowLeft = Math.max(0, this.slowLeft - dtMs);
    if (this.vulnLeft > 0) this.vulnLeft = Math.max(0, this.vulnLeft - dtMs);
    this.fsm.update(dtMs);
    if (this.kbLeft > 0) {
      this.kbLeft -= dtMs;
      this.body.vx = this.kbVx;
      this.body.vy = this.kbVy;
      // Plaqué contre le mur : dégâts et étourdissement bonus.
      const speed = Math.hypot(this.kbVx, this.kbVy);
      if (speed >= HERO.WALL_SLAM_SPEED && this.body.blocked && !this.isDead) {
        this.kbLeft = 0;
        this.world.emit({ type: 'wallSlam', x: this.body.x, y: this.body.y });
        this.world.emit({ type: 'shake', px: 1, ms: 60 });
        this.applyDamage(HERO.WALL_SLAM_DAMAGE, false, false);
        if (!this.isDead && !this.isHeavy)
          this.fsm.request({ to: 'stagger', payload: { ms: HERO.WALL_SLAM_STUN_MS } });
      }
      if (this.kbLeft <= 0) this.halt(true);
    }
  }

  /** Vitesse effective (ralentissements compris). */
  protected get speed(): number {
    return this.stats.speed * this.speedMult * (1 - (this.slowLeft > 0 ? this.slowFactor : 0));
  }

  protected moveToward(tx: number, ty: number, speed = this.speed): void {
    if (this.kbLeft > 0) return;
    const a = Math.atan2(ty - this.body.y, tx - this.body.x);
    this.facing = a;
    this.body.vx = Math.cos(a) * speed;
    this.body.vy = Math.sin(a) * speed;
    this.addSeparation();
  }

  protected moveAngle(a: number, speed: number): void {
    if (this.kbLeft > 0) return;
    this.body.vx = Math.cos(a) * speed;
    this.body.vy = Math.sin(a) * speed;
    this.addSeparation();
  }

  protected halt(force = false): void {
    if (this.kbLeft > 0 && !force) return;
    this.body.vx = 0;
    this.body.vy = 0;
  }

  /** Séparation douce entre ennemis (pas de collider dur). */
  private addSeparation(): void {
    let ax = 0;
    let ay = 0;
    for (const other of this.world.livingEnemies()) {
      if (other === this) continue;
      const dx = this.body.x - other.body.x;
      const dy = this.body.y - other.body.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < ENEMY_RULES.SEPARATION_RADIUS) {
        const push = (ENEMY_RULES.SEPARATION_RADIUS - d) / ENEMY_RULES.SEPARATION_RADIUS;
        ax += (dx / d) * push;
        ay += (dy / d) * push;
      }
    }
    this.body.vx += ax * ENEMY_RULES.SEPARATION_ACCEL * 0.3;
    this.body.vy += ay * ENEMY_RULES.SEPARATION_ACCEL * 0.3;
  }

  protected distToHero(): number {
    const h = this.world.hero.body;
    return Math.hypot(h.x - this.body.x, h.y - this.body.y);
  }

  protected angleToHero(): number {
    const h = this.world.hero.body;
    return Math.atan2(h.y - this.body.y, h.x - this.body.x);
  }

  // ─── Jetons d'attaque ──────────────────────────────────────────────────────

  protected takeToken(kind: TokenKind): boolean {
    if (!this.world.tokens.tryTake(kind, this.id)) return false;
    this.tokenKind = kind;
    return true;
  }

  private releaseToken(): void {
    if (this.tokenKind === null) return;
    this.world.tokens.release(this.id);
    this.tokenKind = null;
  }

  // ─── Dégâts reçus ──────────────────────────────────────────────────────────

  /** Multiplicateur de dégâts reçus selon l'état (récupération, Vulnérable…). */
  protected damageTakenMult(_hit: EnemyHit): number {
    return 1 + (this.vulnLeft > 0 ? this.vulnBonus : 0);
  }

  /** Le coup interrompt-il l'ennemi ? (super-armure des élites et des bornes) */
  protected interruptible(_hit: EnemyHit): boolean {
    return !this.stats.superArmor;
  }

  public takeHit(hit: EnemyHit): HitResult {
    if (!this.isHittable()) return { dealt: 0, killed: false };
    const amount = Math.max(1, Math.round(hit.amount * this.damageTakenMult(hit)));
    if (hit.slow > 0) {
      this.slowFactor = hit.slow;
      this.slowLeft = hit.slowMs;
    }
    if (hit.vulnerable > 0) {
      this.vulnBonus = hit.vulnerable;
      this.vulnLeft = 3000;
    }
    const mass = this.stats.mass;
    if (hit.knockbackPx > 0 && mass > 0 && hit.knockbackMs > 0) {
      const speed = (hit.knockbackPx * mass * 1000) / hit.knockbackMs;
      this.kbVx = Math.cos(hit.knockbackAngle) * speed;
      this.kbVy = Math.sin(hit.knockbackAngle) * speed;
      this.kbLeft = hit.knockbackMs;
    }
    this.applyDamage(amount, hit.crit, hit.heavy, hit.knockbackAngle);
    if (this.isDead) return { dealt: amount, killed: true };
    this.onHurt(amount, hit);
    const stun = Math.max(hit.stunMs, hit.meltdownStun ? 150 : 0);
    if (stun > 0 || this.interruptible(hit)) {
      if (!this.fsm.is('stagger') || stun > 0) {
        this.fsm.request({
          to: 'stagger',
          payload: { ms: Math.max(stun, ENEMY_RULES.STAGGER_MS) },
        });
      }
    }
    return { dealt: amount, killed: false };
  }

  /** Outil de test : élimine l'ennemi sans passer par le combat. */
  public debugKill(): void {
    if (this.isHittable()) this.applyDamage(this.hp, false, true);
  }

  /** Dégâts bruts (sans réaction). */
  protected applyDamage(amount: number, crit: boolean, heavy: boolean, angle = this.facing): void {
    this.hp = Math.max(0, this.hp - amount);
    this.world.emit({
      type: 'enemyHit',
      id: this.id,
      x: this.body.x,
      y: this.body.y,
      amount,
      crit,
      heavy,
      angle,
    });
    this.world.onEnemyDamaged(this, amount, crit);
    if (this.hp <= 0 && !this.isDead) {
      this.deathAngle = angle;
      this.fsm.request({ to: 'dead', payload: null });
    }
  }

  /** Direction du coup fatal (la vue fait voler le corps dans ce sens). */
  public deathAngle = 0;

  /** Inflige des dégâts au héros, mis à l'échelle de la salle. */
  protected hitHero(base: number, knockbackPx: number = HERO.KNOCKBACK_TAKEN_PX): boolean {
    return this.world.damageHero(incoming(base * this.damageMult, 0), {
      x: this.body.x,
      y: this.body.y,
      name: this.displayName,
      knockbackPx,
    });
  }

  // ─── Hooks des sous-classes ────────────────────────────────────────────────

  /** Poursuite : se déplace et renvoie l'attaque à lancer, ou `null`. */
  protected abstract think(dtMs: number): string | null;
  /** Durée du télégraphe d'une attaque. */
  protected abstract windupMs(attack: string): number;
  protected abstract tokenFor(attack: string): TokenKind | null;
  /** Début du télégraphe : orientation et forme au sol. */
  protected abstract onWindup(attack: string): void;
  /** Exécution ; renvoie la durée de récupération quand l'attaque est finie, sinon `null`. */
  protected abstract updateAttack(attack: string, dtMs: number, elapsed: number): number | null;
  protected onAttackStart(_attack: string): void {
    // Optionnel.
  }
  protected onHurt(_amount: number, _hit: EnemyHit): void {
    // Optionnel.
  }
  /** Appelé à la mort, avant la disparition. */
  protected onDeath(): void {
    // Optionnel.
  }

  // ─── Table d'états ─────────────────────────────────────────────────────────

  private buildStates(): StateTable<EnemySim, EnemyStates> {
    return {
      spawn: {
        enter: (e) => {
          e.body.enabled = false;
          e.halt(true);
          e.world.emit({ type: 'enemySpawn', id: e.id, x: e.body.x, y: e.body.y });
        },
        update: (e, _dt, t) => {
          if (t >= ENEMY_RULES.SPAWN_TELEGRAPH_MS) e.body.enabled = true;
          return t >= ENEMY_RULES.SPAWN_TELEGRAPH_MS + ENEMY_RULES.SPAWN_IDLE_MS
            ? { to: 'chase', payload: null }
            : null;
        },
        exit: (e) => {
          e.body.enabled = true;
        },
      },
      chase: {
        update: (e, dt) => {
          const attack = e.think(dt);
          if (attack === null) return null;
          const token = e.tokenFor(attack);
          if (token !== null && !e.takeToken(token)) return null;
          return { to: 'windup', payload: { attack } };
        },
      },
      windup: {
        enter: (e, { attack }) => {
          e.halt();
          e.currentAttack = attack;
          e.onWindup(attack);
        },
        update: (e, _dt, t) => {
          if (e.kbLeft <= 0) e.halt();
          return t >= e.windupMs(e.currentAttack)
            ? { to: 'attack', payload: { attack: e.currentAttack } }
            : null;
        },
        exit: (e) => {
          e.telegraph = null;
        },
      },
      attack: {
        enter: (e, { attack }) => {
          e.currentAttack = attack;
          e.onAttackStart(attack);
        },
        update: (e, dt, t) => {
          const recover = e.updateAttack(e.currentAttack, dt, t);
          return recover === null ? null : { to: 'recover', payload: { ms: recover } };
        },
        exit: (e) => {
          e.telegraph = null;
        },
      },
      recover: {
        enter: (e, { ms }) => {
          e.recoverMs = ms;
          e.halt();
        },
        update: (e, _dt, t) => (t >= e.recoverMs ? { to: 'chase', payload: null } : null),
      },
      stagger: {
        enter: (e, { ms }) => {
          e.recoverMs = ms;
        },
        update: (e, _dt, t) => {
          if (e.kbLeft <= 0) e.halt();
          return t >= e.recoverMs ? { to: 'chase', payload: null } : null;
        },
      },
      dead: {
        enter: (e) => {
          e.telegraph = null;
          e.body.enabled = false;
          e.halt(true);
          e.kbLeft = 0;
          e.onDeath();
          e.world.onEnemyKilled(e);
        },
        update: (e, _dt, t) => {
          if (t >= DEATH_REMOVE_MS) e.removed = true;
          return null;
        },
      },
    };
  }
}

/** Le corps disparaît de la simulation après le délai de fondu de la version Phaser. */
export const DEATH_REMOVE_MS = 250 + ENEMY_RULES.CORPSE_FADE_MS;
