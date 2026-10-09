import Phaser from 'phaser';
import type { EnemyKind, EnemyStats } from '@/config/balance';
import { ENEMY_NAMES, ENEMY_RULES, ENEMY_STATS, HERO } from '@/config/balance';
import { Colors, Depth } from '@/config/constants';
import type { Direction } from '@/config/assets';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { incoming } from '@/systems/combat/damage';
import type { Circle } from '@/systems/combat/geometry';
import { StateMachine } from '@/systems/StateMachine';
import type { StateTable } from '@/systems/StateMachine';
import { facingFromAngle } from '@/utils/math';
import type { CombatWorld } from '@/entities/CombatWorld';

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

let nextId = 1;

/**
 * Ennemi de base : corps Arcade (pieds), hurtbox circulaire, PV mis à l'échelle de la salle,
 * knockback, étourdissement, jetons d'attaque et machine à états commune.
 * Chaque sous-classe ne décrit que son comportement : poursuite (`think`), télégraphe et attaques.
 */
export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare public body: Phaser.Physics.Arcade.Body;
  public readonly uid = nextId++;
  public readonly stats: EnemyStats;
  public hp: number;
  public readonly maxHp: number;
  public readonly damageMult: number;
  public readonly speedMult: number;
  /** Angle vers lequel l'ennemi regarde. */
  public facing = Math.PI / 2;
  protected readonly fsm: StateMachine<Enemy, EnemyStates>;
  protected readonly shadow: Phaser.GameObjects.Image;
  private telegraph: Phaser.GameObjects.Graphics | null = null;
  private kbLeft = 0;
  private kbVx = 0;
  private kbVy = 0;
  private slowLeft = 0;
  private slowFactor = 0;
  private vulnLeft = 0;
  private vulnBonus = 0;
  private tokenKind: TokenKind | null = null;
  private currentAnim = '';
  private flashTimer: Phaser.Time.TimerEvent | null = null;

  /** Directions dessinées (3) ou une seule (miroir horizontal). */
  protected abstract readonly directional: boolean;
  /** Préfixe des fichiers et des clés d'animation (`consultant`, `manager-kpi`…). */
  protected abstract readonly animPrefix: string;

  protected constructor(
    protected readonly world: CombatWorld,
    public readonly kind: EnemyKind,
    x: number,
    y: number,
    texture: string,
    scale: EnemyScale,
    protected readonly frameSize: number,
  ) {
    super(world.stage, x, y, texture, 0);
    world.stage.add.existing(this);
    world.stage.physics.add.existing(this);
    this.stats = ENEMY_STATS[kind];
    this.maxHp = Math.round(this.stats.hp * scale.hp);
    this.hp = this.maxHp;
    this.damageMult = scale.damage;
    this.speedMult = scale.speed;
    // Pivot aux pieds (PIXEL_ART_GUIDE § 1.2) : 28/32 pour les ennemis, 44/48 pour les élites, 88/96 pour les boss.
    const feet = frameSize === 32 ? 28 : frameSize === 48 ? 44 : 88;
    this.setOrigin(0.5, feet / frameSize);
    const r = Math.max(5, Math.round(this.stats.hurtRadius * 0.7));
    this.body.setCircle(r, frameSize / 2 - r, feet - r);
    this.body.setCollideWorldBounds(false);
    this.shadow = world.stage.add
      .image(x, y, frameSize >= 96 ? 'shadow_xl' : frameSize >= 48 ? 'shadow_l' : 'shadow_s')
      .setAlpha(0.5)
      .setDepth(Depth.Shadow);

    this.fsm = new StateMachine<Enemy, EnemyStates>(this, this.buildStates(), (_from, to) => {
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
    return { x: this.x, y: this.y - this.stats.hurtOffsetY, r: this.stats.hurtRadius };
  }

  public get aiState(): keyof EnemyStates {
    return this.fsm.current;
  }

  public get isDead(): boolean {
    return this.fsm.is('dead');
  }

  /** Touchable : ni en apparition, ni mort. */
  public isHittable(): boolean {
    return !this.fsm.is('spawn', 'dead');
  }

  public start(immediate = false): void {
    if (immediate) {
      this.fsm.start({ to: 'chase', payload: null });
    } else {
      this.fsm.start({ to: 'spawn', payload: null });
    }
  }

  // ─── Boucle ────────────────────────────────────────────────────────────────

  public tick(dtMs: number): void {
    if (this.slowLeft > 0) this.slowLeft = Math.max(0, this.slowLeft - dtMs);
    if (this.vulnLeft > 0) this.vulnLeft = Math.max(0, this.vulnLeft - dtMs);
    this.fsm.update(dtMs);
    if (this.kbLeft > 0) {
      this.kbLeft -= dtMs;
      this.body.setVelocity(this.kbVx, this.kbVy);
      // Plaqué contre le mur : dégâts et étourdissement bonus.
      const speed = Math.hypot(this.kbVx, this.kbVy);
      if (speed >= HERO.WALL_SLAM_SPEED && !this.body.blocked.none && !this.isDead) {
        this.kbLeft = 0;
        this.world.feel.dustAt(this.x, this.y, 6);
        this.world.feel.shake(1, 60);
        this.applyDamage(HERO.WALL_SLAM_DAMAGE, false);
        if (!this.isDead && !this.isHeavy)
          this.fsm.request({ to: 'stagger', payload: { ms: HERO.WALL_SLAM_STUN_MS } });
      }
      if (this.kbLeft <= 0) this.body.setVelocity(0, 0);
    }
    this.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y).setVisible(this.visible && !this.isDead);
  }

  /** Vitesse effective (ralentissements compris). */
  protected get speed(): number {
    return this.stats.speed * this.speedMult * (1 - (this.slowLeft > 0 ? this.slowFactor : 0));
  }

  protected moveToward(tx: number, ty: number, speed = this.speed): void {
    if (this.kbLeft > 0) return;
    const a = Math.atan2(ty - this.y, tx - this.x);
    this.facing = a;
    this.body.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
    this.addSeparation();
  }

  protected moveAngle(a: number, speed: number): void {
    if (this.kbLeft > 0) return;
    this.body.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
    this.addSeparation();
  }

  protected halt(): void {
    if (this.kbLeft > 0) return;
    this.body.setVelocity(0, 0);
  }

  /** Séparation douce entre ennemis (pas de collider dur). */
  private addSeparation(): void {
    let ax = 0;
    let ay = 0;
    for (const other of this.world.livingEnemies()) {
      if (other === this) continue;
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < ENEMY_RULES.SEPARATION_RADIUS) {
        const push = (ENEMY_RULES.SEPARATION_RADIUS - d) / ENEMY_RULES.SEPARATION_RADIUS;
        ax += (dx / d) * push;
        ay += (dy / d) * push;
      }
    }
    if (ax !== 0 || ay !== 0) {
      this.body.velocity.x += ax * ENEMY_RULES.SEPARATION_ACCEL * 0.3;
      this.body.velocity.y += ay * ENEMY_RULES.SEPARATION_ACCEL * 0.3;
    }
  }

  protected distToPlayer(): number {
    const p = this.world.player;
    return Math.hypot(p.x - this.x, p.y - this.y);
  }

  protected angleToPlayer(): number {
    const p = this.world.player;
    return Math.atan2(p.y - this.y, p.x - this.x);
  }

  // ─── Jetons d'attaque ──────────────────────────────────────────────────────

  protected takeToken(kind: TokenKind): boolean {
    if (!this.world.tokens.tryTake(kind, this.uid)) return false;
    this.tokenKind = kind;
    return true;
  }

  private releaseToken(): void {
    if (this.tokenKind === null) return;
    this.world.tokens.release(this.uid);
    this.tokenKind = null;
  }

  // ─── Animations ────────────────────────────────────────────────────────────

  /** Seul point d'appel de `play` : gère la direction et le miroir. */
  protected playAnim(name: string, restart = false): void {
    let key = `${this.animPrefix}-${name}`;
    const { facing, flip } = facingFromAngle(this.facing);
    if (this.directional) {
      const dir: Direction = facing;
      key = `${key}-${dir}`;
      this.setFlipX(flip);
    } else {
      this.setFlipX(Math.cos(this.facing) < 0);
    }
    if (!restart && key === this.currentAnim && this.anims.isPlaying) return;
    if (!this.scene.anims.exists(key)) return;
    this.currentAnim = key;
    this.play(key);
  }

  // ─── Télégraphes ───────────────────────────────────────────────────────────

  /** Dessine un télégraphe magenta (le contenu est tracé par `draw`). */
  protected showTelegraph(draw: (g: Phaser.GameObjects.Graphics) => void): void {
    this.telegraph ??= this.scene.add.graphics().setDepth(Depth.Decal);
    this.telegraph.clear();
    draw(this.telegraph);
  }

  protected hideTelegraph(): void {
    this.telegraph?.clear();
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
    this.applyDamage(amount, hit.crit);
    // Impact « gélatine » (Dead Cells) : écrasé puis rebond.
    if (this.kind !== 'auditeur') this.world.feel.squash(this, 1.2, 0.82, 160);
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

  /** Outil de test (mode `?cheat` en dev) : élimine l'ennemi sans passer par le combat. */
  public debugKill(): void {
    if (this.isHittable()) this.applyDamage(this.hp, false);
  }

  /** Dégâts bruts (sans réaction). */
  protected applyDamage(amount: number, crit: boolean): void {
    this.hp = Math.max(0, this.hp - amount);
    this.flash();
    this.world.onEnemyDamaged(this, amount, crit);
    if (this.hp <= 0 && !this.isDead) this.fsm.request({ to: 'dead', payload: null });
  }

  private flash(): void {
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.flashTimer?.remove();
    this.flashTimer = this.scene.time.delayedCall(ENEMY_RULES.FLASH_MS, () => {
      if (this.active) this.restoreTint();
    });
  }

  /** Teinte « de repos » (rouge pendant un télégraphe, etc.). */
  protected restoreTint(): void {
    this.clearTint();
  }

  /** Inflige des dégâts au héros, mis à l'échelle de la salle. */
  protected hitPlayer(base: number, knockbackPx: number = HERO.KNOCKBACK_TAKEN_PX): boolean {
    return this.world.damagePlayer(incoming(base * this.damageMult, 0), {
      x: this.x,
      y: this.y,
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
  /** Début du télégraphe (animation, tracé). */
  protected abstract onWindup(attack: string): void;
  /** Exécution ; renvoie la durée de récupération quand l'attaque est finie, sinon `null`. */
  protected abstract updateAttack(attack: string, dtMs: number, elapsed: number): number | null;
  protected onAttackStart(_attack: string): void {
    // Optionnel.
  }
  protected onHurt(_amount: number, _hit: EnemyHit): void {
    this.playAnim('hurt', true);
  }
  protected idleAnim(): string {
    return 'idle';
  }
  protected deathAnim(): string {
    return 'death';
  }
  /** Appelé à la mort, avant la disparition. */
  protected onDeath(): void {
    // Optionnel.
  }

  // ─── Table d'états ─────────────────────────────────────────────────────────

  private buildStates(): StateTable<Enemy, EnemyStates> {
    return {
      spawn: {
        enter: (e) => {
          e.setVisible(false);
          e.body.enable = false;
          e.showTelegraph((g) => {
            g.lineStyle(1, Colors.danger, 0.9).strokeCircle(e.x, e.y, 12);
          });
        },
        update: (e, _dt, t) => {
          const p = Math.min(1, t / ENEMY_RULES.SPAWN_TELEGRAPH_MS);
          if (p < 1) {
            e.showTelegraph((g) => {
              g.lineStyle(1, Colors.danger, 0.9).strokeCircle(e.x, e.y, 12);
              g.fillStyle(Colors.danger, 0.35).fillCircle(e.x, e.y, 12 * p);
            });
            return null;
          }
          if (!e.visible) {
            e.hideTelegraph();
            e.setVisible(true);
            e.body.enable = true;
            e.world.vfx('vfx-spawn-privatix', e.x, e.y - 8, { depth: e.y + 1 });
            e.playAnim(e.idleAnim(), true);
          }
          return t >= ENEMY_RULES.SPAWN_TELEGRAPH_MS + ENEMY_RULES.SPAWN_IDLE_MS
            ? { to: 'chase', payload: null }
            : null;
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
          e.windupAttack = attack;
          e.onWindup(attack);
        },
        update: (e, _dt, t) =>
          t >= e.windupMs(e.windupAttack)
            ? { to: 'attack', payload: { attack: e.windupAttack } }
            : null,
        exit: (e) => {
          e.hideTelegraph();
        },
      },
      attack: {
        enter: (e, { attack }) => {
          e.windupAttack = attack;
          e.onAttackStart(attack);
        },
        update: (e, dt, t) => {
          const recover = e.updateAttack(e.windupAttack, dt, t);
          return recover === null ? null : { to: 'recover', payload: { ms: recover } };
        },
        exit: (e) => {
          e.hideTelegraph();
        },
      },
      recover: {
        enter: (e, { ms }) => {
          e.recoverMs = ms;
          e.halt();
          e.playAnim(e.idleAnim());
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
          e.hideTelegraph();
          e.body.enable = false;
          e.body.setVelocity(0, 0);
          e.kbLeft = 0;
          e.onDeath();
          e.playAnim(e.deathAnim(), true);
          e.world.feel.papersAt(e.x, e.y - 10, 12);
          e.world.vfx('vfx-poof', e.x, e.y - 8, { depth: e.y + 1 });
          e.world.onEnemyKilled(e);
          e.scene.tweens.add({
            targets: e,
            alpha: 0,
            delay: 250,
            duration: ENEMY_RULES.CORPSE_FADE_MS,
            onComplete: () => {
              e.destroy();
            },
          });
        },
      },
    };
  }

  /** Attaque en cours (télégraphe puis exécution). */
  protected windupAttack = '';
  private recoverMs = 0;

  public override destroy(fromScene?: boolean): void {
    this.releaseToken();
    this.telegraph?.destroy();
    this.shadow.destroy();
    this.flashTimer?.remove();
    super.destroy(fromScene);
  }
}
