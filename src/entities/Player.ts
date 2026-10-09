import Phaser from 'phaser';
import type { AttackStep, SpecialDef } from '@/config/balance';
import {
  BURNOUT,
  COFFEE,
  COMBO,
  COMBO_RULES,
  DASH,
  DASH_ATTACK,
  HERO,
  INPUT,
  MOBILISATION,
  PREAVIS,
  SPECIAL_RULES,
  WHISTLE,
} from '@/config/balance';
import { Css, Depth } from '@/config/constants';
import type { Direction } from '@/config/assets';
import { animInfo, sheetOf } from '@/config/assets';
import {
  canChain,
  canDashCancel,
  hitstopFor,
  phaseAt,
  timingOf,
} from '@/systems/combat/attackTiming';
import type { StepTiming } from '@/systems/combat/attackTiming';
import type { BurnoutEvent } from '@/systems/combat/Burnout';
import type { OutgoingMods } from '@/systems/combat/damage';
import { incoming } from '@/systems/combat/damage';
import { InputBuffer } from '@/systems/InputBuffer';
import { heal, maxEnergy } from '@/systems/meta/RunState';
import { StateMachine } from '@/systems/StateMachine';
import type { StateTable } from '@/systems/StateMachine';
import { approach, facingFromAngle } from '@/utils/math';
import type { CombatWorld, HitSource } from '@/entities/CombatWorld';
import { Weapon } from '@/entities/Weapon';

/** Ce que les commandes demandent au héros pour cette frame (clavier, souris, manette ou tactile). */
export interface PlayerIntent {
  /** Direction de déplacement (norme ≤ 1). */
  readonly moveX: number;
  readonly moveY: number;
  /** Angle de visée (souris, stick droit ou aide à la visée tactile). */
  readonly aim: number;
  readonly attack: boolean;
  readonly dash: boolean;
  readonly special: boolean;
  readonly coffee: boolean;
  readonly specialHeld: boolean;
}

export const NO_INTENT: PlayerIntent = {
  moveX: 0,
  moveY: 0,
  aim: Math.PI / 2,
  attack: false,
  dash: false,
  special: false,
  coffee: false,
  specialHeld: false,
};

type Action = 'attack' | 'dash' | 'special' | 'coffee';

interface PlayerStates {
  idle: null;
  run: null;
  attack: { readonly combo: number };
  dashAttack: null;
  dash: { readonly angle: number };
  charge: null;
  special: { readonly kind: 'whistle' | 'preavis' };
  drink: null;
  hurt: { readonly angle: number; readonly px: number };
  dead: null;
}

interface Trail {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  left: number;
  acc: number;
}

/**
 * Le cheminot. Adaptateur Phaser : corps Arcade aux pieds, animations, et une StateMachine typée
 * dont chaque état décrit un pan du GDD (combo, dash « Retard SNCB », sifflet, café, coup reçu).
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  declare public body: Phaser.Physics.Arcade.Body;
  /** Angle de la dernière visée / du dernier déplacement. */
  public facingAngle = Math.PI / 2;
  public onDeath: (() => void) | null = null;
  /** Combat désactivé (hub) : les attaques fendent l'air, rien ne consomme de ressource. */
  public peaceful = false;
  private readonly fsm: StateMachine<Player, PlayerStates>;
  private readonly buffer = new InputBuffer<Action>(INPUT.BUFFER_MS);
  private readonly weapon: Weapon;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly trailGfx: Phaser.GameObjects.Graphics;
  private intent: PlayerIntent = NO_INTENT;
  private currentAnim = '';
  // Combo
  private combo = 0;
  private step: AttackStep = COMBO[0];
  private timing: StepTiming = timingOf(COMBO[0]);
  private activeStarted = false;
  private lastAttackEnd = -Infinity;
  private lastCombo = -1;
  private hitThisSwing = false;
  // Dash
  private dashAngle = 0;
  private dashStartedAt = -Infinity;
  private lastDashEnd = -Infinity;
  private perfectUsed = false;
  private ghostAt = 0;
  private readonly trails: Trail[] = [];
  // Défense
  private iframesUntil = 0;
  private markUntil = 0;
  private markBonus = 0;
  private slowLeft = 0;
  private slowFactor = 0;
  private shieldReadyAt = 0;
  private caffeineUntil = 0;
  // Spéciale et café
  private lastSpecialAt = -Infinity;
  private sipped = false;
  private specialKind: 'whistle' | 'preavis' = 'whistle';
  private specialStruck = false;
  private hurtAngle = 0;
  private hurtPx = 0;

  public constructor(
    private readonly world: CombatWorld,
    x: number,
    y: number,
  ) {
    super(world.stage, x, y, sheetOf('player-idle-down'), 0);
    world.stage.add.existing(this);
    world.stage.physics.add.existing(this);
    // Pivot aux pieds, lu dans le manifeste (taille de frame et pivot dépendent des sprites livrés).
    const { frameSize, pivot } = animInfo('player-idle-down');
    this.setOrigin(pivot.x / frameSize, pivot.y / frameSize);
    this.body.setCircle(HERO.FEET_RADIUS, pivot.x - HERO.FEET_RADIUS, pivot.y - HERO.FEET_RADIUS);
    this.body.setMaxSpeed(1200);
    this.weapon = new Weapon(world);
    this.shadow = world.stage.add.image(x, y, 'shadow_m').setAlpha(0.5).setDepth(Depth.Shadow);
    this.trailGfx = world.stage.add.graphics().setDepth(Depth.Decal);
    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onAnimFrame, this);
    this.fsm = new StateMachine<Player, PlayerStates>(this, this.buildStates());
    this.fsm.start({ to: 'idle', payload: null });
    this.shieldReadyAt = world.now();
  }

  // ─── Lecture d'état (HUD, scène) ───────────────────────────────────────────

  public get isDead(): boolean {
    return this.fsm.is('dead');
  }

  public get stateName(): string {
    return this.fsm.current;
  }

  public get hasShield(): boolean {
    const every = this.world.run.mods.shieldEveryMs;
    return every > 0 && this.world.now() >= this.shieldReadyAt;
  }

  public get isMarked(): boolean {
    return this.world.now() < this.markUntil;
  }

  /** Bonus offensifs courants (paliers de Burnout, Avantages, Énergie basse). */
  public outgoingMods(): OutgoingMods {
    const run = this.world.run;
    const tier = run.burnout.tier;
    const mods = run.mods;
    const energyRatio = run.energy / maxEnergy(run);
    const overBurn = Math.max(0, run.burnout.value - 30);
    const tierCrit = run.burnout.inMeltdown ? 0 : tier.crit;
    return {
      damageBonus:
        tier.damageDealt + mods.damageBonus + (energyRatio < 0.5 ? mods.lowEnergyDamageBonus : 0),
      critChance:
        HERO.CRIT_CHANCE +
        tierCrit +
        mods.critChance +
        mods.critPerBurnout * Math.floor(overBurn / 10),
      critMult: HERO.CRIT_MULT + mods.critMult + (energyRatio < 0.3 ? mods.lowEnergyCritMult : 0),
    };
  }

  private get attackSpeedBonus(): number {
    const caffeine = this.world.now() < this.caffeineUntil ? COFFEE.CAFFEINE_ATTACK_SPEED : 0;
    return this.world.run.burnout.tier.attackSpeed + caffeine;
  }

  private get moveSpeed(): number {
    const run = this.world.run;
    const ballast = this.world.room.isSlowGround(this.x, this.y) ? HERO.BALLAST_SLOW : 0;
    const slow = this.slowLeft > 0 ? this.slowFactor : 0;
    return (
      HERO.SPEED * (1 + run.burnout.tier.speed + run.mods.speedBonus) * (1 - slow) * (1 - ballast)
    );
  }

  // ─── Effets subis ──────────────────────────────────────────────────────────

  public mark(ms: number, bonus: number): void {
    if (!this.isMarked) this.world.feel.floatText(this.x, this.y - 40, 'SIGNALÉ', Css.danger, 900);
    this.markUntil = this.world.now() + ms;
    this.markBonus = bonus;
  }

  public applySlow(factor: number, ms: number): void {
    this.slowFactor = Math.max(factor, this.slowLeft > 0 ? this.slowFactor : 0);
    this.slowLeft = Math.max(this.slowLeft, ms);
  }

  /** Vrai si le héros est dans la fenêtre de dash parfait (pour les projectiles évités). */
  public inPerfectWindow(): boolean {
    const t = this.world.now() - this.dashStartedAt;
    return (
      this.fsm.is('dash') &&
      !this.perfectUsed &&
      t <= DASH.PERFECT_WINDOW_MS + this.world.run.mods.perfectDashWindowBonusMs
    );
  }

  public isInvulnerable(): boolean {
    const now = this.world.now();
    const dashIframes = this.fsm.is('dash') && now - this.dashStartedAt <= DASH.IFRAMES_MS;
    return this.isDead || dashIframes || now < this.iframesUntil;
  }

  /** Coup reçu (appelé par la scène via `CombatWorld.damagePlayer`). */
  public receiveHit(base: number, source: HitSource): boolean {
    if (this.isDead || this.peaceful) return false;
    if (this.fsm.is('dash') && this.isInvulnerable()) {
      if (this.inPerfectWindow()) this.perfectDash();
      return false;
    }
    if (this.isInvulnerable()) return false;
    const run = this.world.run;
    const feel = this.world.feel;
    if (this.hasShield) {
      this.shieldReadyAt = this.world.now() + run.mods.shieldEveryMs;
      this.iframesUntil = this.world.now() + 300;
      feel.floatText(this.x, this.y - 40, 'PAUSE LÉGALE', Css.white, 900);
      feel.sparksAt(this.x, this.y - 12, 8);
      return false;
    }
    const takenBonus = run.burnout.tier.damageTaken + (this.isMarked ? this.markBonus : 0);
    const amount = incoming(base, takenBonus);
    run.energy = Math.max(0, run.energy - amount);
    run.lastHitBy = source.name;
    run.mobilisation.add(MOBILISATION.PER_HIT_TAKEN);
    this.handleBurnout(run.burnout.onDamageTaken(amount));
    feel.hitstop(80);
    feel.shake(4, 180);
    feel.vignettePulse(0.3, 250);
    feel.flash(this, 60);
    feel.damageNumber(this.x, this.y - 30, amount, { hero: true });
    this.iframesUntil = this.world.now() + HERO.IFRAMES_AFTER_HIT_MS;

    if (run.energy <= 0) {
      if (run.loadout.reviveFraction > 0 && !run.reviveUsed) {
        run.reviveUsed = true;
        run.energy = Math.round(maxEnergy(run) * run.loadout.reviveFraction);
        feel.floatText(this.x, this.y - 44, 'MUTUELLE : ON SE RELÈVE', Css.quaiYellow, 1600);
        feel.slowmo(0.3, 500, 300);
        this.iframesUntil = this.world.now() + 1500;
      } else {
        this.fsm.request({ to: 'dead', payload: null });
        return true;
      }
    }
    const angle = Math.atan2(this.y - source.y, this.x - source.x);
    this.fsm.request({
      to: 'hurt',
      payload: { angle, px: source.knockbackPx ?? HERO.KNOCKBACK_TAKEN_PX },
    });
    return true;
  }

  private perfectDash(): void {
    const run = this.world.run;
    this.perfectUsed = true;
    run.dash.refund(DASH.PERFECT_CHARGE_REFUND);
    this.handleBurnout(run.burnout.add(DASH.PERFECT_BURNOUT));
    run.mobilisation.add(DASH.PERFECT_MOBILISATION);
    run.delayMinutes += 10;
    this.world.feel.slowmo(DASH.PERFECT_TIMESCALE, DASH.PERFECT_SLOWMO_MS, 80);
    this.world.feel.floatText(this.x, this.y - 40, '+15 min', Css.quaiYellow, 900);
    this.world.feel.sparksAt(this.x, this.y - 12, 6);
  }

  // ─── Boucle ────────────────────────────────────────────────────────────────

  public tick(dtMs: number, intent: PlayerIntent): void {
    const now = this.world.now();
    const run = this.world.run;
    this.intent = intent;
    if (intent.attack) this.buffer.press('attack', now);
    if (intent.dash) this.buffer.press('dash', now);
    if (intent.special) this.buffer.press('special', now);
    if (intent.coffee) this.buffer.press('coffee', now);
    if (this.slowLeft > 0) this.slowLeft = Math.max(0, this.slowLeft - dtMs);

    if (!this.peaceful) {
      run.dash.rechargeRate = run.burnout.inMeltdown ? 2 : 1;
      run.dash.tick(dtMs);
      this.handleBurnout(run.burnout.tick(dtMs));
    } else {
      run.dash.tick(dtMs);
    }

    this.fsm.update(dtMs);
    this.updateTrails(dtMs);

    // Clignotement pendant les i-frames.
    const blinking = now < this.iframesUntil && !this.isDead;
    this.setAlpha(blinking && Math.floor(now / HERO.BLINK_MS) % 2 === 0 ? 0.35 : 1);
    this.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y);
  }

  private handleBurnout(events: readonly BurnoutEvent[]): void {
    const run = this.world.run;
    for (const e of events) {
      if (e.kind === 'meltdown-start') {
        this.world.feel.shake(6, 300);
        this.world.feel.floatText(this.x, this.y - 46, 'PÉTAGE DE PLOMBS !', Css.danger, 1500);
        this.world.feel.vignettePulse(0.35, 600);
      } else if (e.kind === 'meltdown-end') {
        run.maxEnergyPenalty += e.maxEnergyPenalty;
        run.energy = Math.min(run.energy, maxEnergy(run));
        this.world.feel.floatText(
          this.x,
          this.y - 46,
          `ARRÊT MALADIE : −${String(e.maxEnergyPenalty)} Énergie max`,
          Css.ballast,
          1600,
        );
      }
    }
  }

  /** Vitesse cible selon le déplacement demandé, avec accélération et décélération du GDD. */
  private steer(dtMs: number, factor: number): void {
    const { moveX, moveY } = this.intent;
    const speed = this.moveSpeed * factor;
    const tx = moveX * speed;
    const ty = moveY * speed;
    const moving = moveX !== 0 || moveY !== 0;
    const rate = ((moving ? HERO.ACCEL : HERO.DECEL) * dtMs) / 1000;
    const v = this.body.velocity;
    this.body.setVelocity(approach(v.x, tx, rate), approach(v.y, ty, rate));
  }

  private get moving(): boolean {
    return this.intent.moveX !== 0 || this.intent.moveY !== 0;
  }

  private moveAngle(): number {
    return Math.atan2(this.intent.moveY, this.intent.moveX);
  }

  /** Seul point d'appel de `play` : direction (3 dessinées + miroir) et vitesse de lecture. */
  private playAnim(
    name: string,
    angle = this.facingAngle,
    durationMs?: number,
    restart = false,
  ): void {
    const { facing, flip } = facingFromAngle(angle);
    const single = name === 'death' || name === 'spawn' || name === 'special';
    const dir: Direction = facing;
    const key = single ? `player-${name}` : `player-${name}-${dir}`;
    this.setFlipX(!single && flip);
    if (!restart && key === this.currentAnim && this.anims.isPlaying) return;
    this.currentAnim = key;
    this.play(key);
    const anim = this.anims.currentAnim;
    if (durationMs !== undefined && anim) {
      const total = anim.frames.reduce((s, f) => s + (f.duration || anim.msPerFrame), 0);
      this.anims.timeScale = total / Math.max(1, durationMs);
    } else {
      this.anims.timeScale = 1;
    }
  }

  private onAnimFrame(
    _anim: Phaser.Animations.Animation,
    frame: Phaser.Animations.AnimationFrame,
  ): void {
    // Phaser 4 : AnimationFrame.index commence à 1. Poussière aux contacts au sol (frames du manifeste).
    if (this.fsm.is('run') && animInfo(this.currentAnim).footsteps.includes(frame.index - 1)) {
      this.world.feel.dustAt(this.x, this.y, 2);
    }
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  /** Choix de l'action suivante depuis un état « libre » (priorités : Dash > Spéciale > Attaque > Café). */
  private nextFromFree(): Parameters<StateMachine<Player, PlayerStates>['request']>[0] | null {
    const now = this.world.now();
    const run = this.world.run;
    if (this.buffer.peek('dash', now) && run.dash.canDash()) {
      this.buffer.consume('dash', now);
      return { to: 'dash', payload: { angle: this.moving ? this.moveAngle() : this.facingAngle } };
    }
    if (this.buffer.consume('special', now)) {
      if (this.peaceful) return null;
      if (now - this.lastSpecialAt < SPECIAL_RULES.COOLDOWN_MS) {
        this.world.feel.floatText(this.x, this.y - 40, 'Sifflet en recharge', Css.ballast, 700);
      } else if (!run.mobilisation.canSpend(WHISTLE.cost)) {
        this.world.feel.floatText(
          this.x,
          this.y - 40,
          'Mobilisation insuffisante',
          Css.ballast,
          700,
        );
      } else return { to: 'charge', payload: null };
    }
    if (this.buffer.consume('attack', now)) {
      if (now - this.lastDashEnd <= DASH.ATTACK_WINDOW_MS)
        return { to: 'dashAttack', payload: null };
      const chained = now - this.lastAttackEnd <= COMBO_RULES.CHAIN_GRACE_MS && this.lastCombo >= 0;
      return {
        to: 'attack',
        payload: { combo: chained ? (this.lastCombo + 1) % COMBO.length : 0 },
      };
    }
    if (this.buffer.consume('coffee', now)) {
      if (this.peaceful) return null;
      if (run.gobelets <= 0)
        this.world.feel.floatText(this.x, this.y - 40, 'Plus de Gobelet', Css.ballast, 700);
      else if (run.burnout.inMeltdown)
        this.world.feel.floatText(
          this.x,
          this.y - 40,
          'Pas le temps pour un café !',
          Css.danger,
          800,
        );
      else return { to: 'drink', payload: null };
    }
    return null;
  }

  private beginSwing(step: AttackStep, durationName: string, comboIndex: number): void {
    this.step = step;
    this.timing = timingOf(step, this.attackSpeedBonus);
    this.activeStarted = false;
    this.hitThisSwing = false;
    this.combo = comboIndex;
    this.facingAngle = this.intent.aim;
    this.playAnim(durationName, this.facingAngle, this.timing.totalMs, true);
  }

  /** Frames actives : lunge, hitbox, et retour de game feel si le coup porte. */
  private updateSwing(dtMs: number, elapsed: number, finisher: boolean): void {
    const phase = phaseAt(this.timing, elapsed);
    if (phase === 'startup' || phase === 'active') this.steer(dtMs, COMBO_RULES.MOVE_FACTOR);
    else this.steer(dtMs, 0);
    if (phase !== 'active') return;
    const a = this.facingAngle;
    if (!this.activeStarted) {
      this.activeStarted = true;
      this.weapon.begin();
      this.world.feel.squash(
        this,
        finisher ? 1.2 : 1.1,
        finisher ? 0.85 : 0.93,
        finisher ? 180 : 110,
      );
      const lunge = (this.step.lungePx * 1000) / Math.max(1, this.timing.activeMs);
      this.body.setVelocity(Math.cos(a) * lunge, Math.sin(a) * lunge);
      const ox = this.x + Math.cos(a) * 18;
      const oy = this.y - HERO.ATTACK_ORIGIN_Y + Math.sin(a) * 18;
      if (finisher) {
        this.world.vfx('vfx-slam', this.x + Math.cos(a) * 34, this.y + Math.sin(a) * 34 - 6, {
          rotation: 0,
        });
        this.world.feel.dustAt(this.x + Math.cos(a) * 40, this.y + Math.sin(a) * 40, 8);
      } else {
        this.world.vfx('vfx-slash-e', ox, oy, { rotation: a, flipY: this.combo === 1 });
      }
    }
    if (this.peaceful) return;
    const report = this.weapon.sweep({ x: this.x, y: this.y - HERO.ATTACK_ORIGIN_Y }, a, {
      shape: this.step.shape,
      damage: this.step.damage + (finisher ? this.world.run.mods.finisherDamage : 0),
      knockbackPx: this.step.knockbackPx,
      knockbackMs: this.step.knockbackMs,
      stunMs: this.step.stunMs,
      breaksProjectiles: this.step.breaksProjectiles,
      finisher,
      combo: this.fsm.is('attack'),
    });
    if (report.targets > 0) {
      const feel = this.world.feel;
      feel.hitstop(hitstopFor(this.step, report.targets, report.crit));
      feel.shake(report.crit ? 4 : this.step.shakePx, report.crit ? 140 : this.step.shakeMs);
      if (finisher && !this.hitThisSwing) feel.zoomPunch(1.02, 100);
      this.hitThisSwing = true;
    }
  }

  private finishSwing(): void {
    this.lastAttackEnd = this.world.now();
    this.lastCombo = this.combo;
  }

  private startDash(angle: number): void {
    const run = this.world.run;
    run.dash.consume();
    this.dashAngle = angle;
    this.facingAngle = angle;
    this.dashStartedAt = this.world.now();
    this.perfectUsed = false;
    if (!this.peaceful) {
      this.handleBurnout(run.burnout.onDash());
      run.delayMinutes += 5;
    }
    const distance = DASH.DISTANCE_PX + run.mods.dashDistanceBonus;
    const speed = (distance * 1000) / DASH.DURATION_MS;
    this.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.playAnim('dash', angle, DASH.DURATION_MS + 40, true);
    // Étirement dans le sens du dash, puis traînée rémanente (voir l'état « dash »).
    const horizontal = Math.abs(Math.cos(angle)) > 0.5;
    this.world.feel.squash(this, horizontal ? 1.25 : 0.8, horizontal ? 0.82 : 1.2, 160);
    this.ghostAt = 0;
    this.world.vfx('vfx-dash', this.x - Math.cos(angle) * 8, this.y - 10 - Math.sin(angle) * 8, {
      rotation: angle,
    });
    this.world.feel.dustAt(this.x, this.y, 4);
  }

  private endDash(): void {
    const run = this.world.run;
    this.lastDashEnd = this.world.now();
    const dist = DASH.DISTANCE_PX + run.mods.dashDistanceBonus;
    const from = {
      x: this.x - Math.cos(this.dashAngle) * dist,
      y: this.y - Math.sin(this.dashAngle) * dist,
    };
    if (!this.peaceful && run.mods.dashTrailDamage > 0) {
      this.trails.push({ x0: from.x, y0: from.y, x1: this.x, y1: this.y, left: 1500, acc: 500 });
    }
    if (!this.peaceful && run.mods.dashShockStunMs > 0) {
      for (const e of this.world.livingEnemies()) {
        if (Math.hypot(e.x - this.x, e.y - this.y) > 40) continue;
        e.takeHit({
          amount: 1,
          crit: false,
          fromX: this.x,
          fromY: this.y,
          knockbackAngle: 0,
          knockbackPx: 0,
          knockbackMs: 0,
          stunMs: run.mods.dashShockStunMs,
          slow: 0,
          slowMs: 0,
          vulnerable: 0,
          meltdownStun: false,
        });
      }
      this.world.vfx('vfx-hit', this.x, this.y - 8, { scale: 1.5 });
    }
  }

  /** Traînées électriques (Caténaire 3 kV) : piquent les ennemis toutes les 0,5 s. */
  private updateTrails(dtMs: number): void {
    const g = this.trailGfx;
    g.clear();
    for (let i = this.trails.length - 1; i >= 0; i -= 1) {
      const t = this.trails[i];
      if (!t) continue;
      t.left -= dtMs;
      t.acc += dtMs;
      if (t.left <= 0) {
        this.trails.splice(i, 1);
        continue;
      }
      g.lineStyle(3, 0x7cf2ff, 0.3 + 0.4 * Math.random()).lineBetween(t.x0, t.y0, t.x1, t.y1);
      if (t.acc < 500) continue;
      t.acc = 0;
      for (const e of this.world.livingEnemies()) {
        const dx = t.x1 - t.x0;
        const dy = t.y1 - t.y0;
        const len2 = dx * dx + dy * dy || 1;
        const k = Math.max(0, Math.min(1, ((e.x - t.x0) * dx + (e.y - t.y0) * dy) / len2));
        if (Math.hypot(e.x - (t.x0 + dx * k), e.y - (t.y0 + dy * k)) > 12) continue;
        e.takeHit({
          amount: Math.round(this.world.run.mods.dashTrailDamage),
          crit: false,
          fromX: e.x,
          fromY: e.y,
          knockbackAngle: 0,
          knockbackPx: 0,
          knockbackMs: 0,
          stunMs: 0,
          slow: 0,
          slowMs: 0,
          vulnerable: 0,
          meltdownStun: false,
        });
      }
    }
  }

  private releaseSpecial(def: SpecialDef): void {
    const run = this.world.run;
    const mods = run.mods;
    const isWhistle = def === WHISTLE;
    const radius = def.radius + (isWhistle ? mods.whistleRadiusBonus : 0);
    const damage = Math.round(def.damage * (1 + (isWhistle ? mods.whistleDamageBonus : 0)));
    this.weapon.begin();
    const report = this.weapon.sweep({ x: this.x, y: this.y - 6 }, 0, {
      shape: { kind: 'radial', radius },
      damage,
      knockbackPx: def.knockbackPx,
      knockbackMs: 160,
      stunMs: def.stunMs,
      eliteStunMs: def.eliteStunMs,
      breaksProjectiles: true,
      finisher: false,
      combo: false,
    });
    const feel = this.world.feel;
    feel.shake(def.shakePx, def.shakeMs);
    if (!isWhistle) feel.vignettePulse(0.2, 120, 0xffffff);
    this.world.vfx('vfx-shockwave', this.x, this.y - 6, { scale: (radius * 2) / 128 });
    feel.floatText(
      this.x,
      this.y - 48,
      isWhistle ? 'COUP DE SIFFLET !' : 'PRÉAVIS DE GRÈVE !',
      Css.quaiYellow,
      1000,
    );
    if (report.targets > 0) {
      for (const e of this.world.livingEnemies()) {
        if (Math.hypot(e.x - this.x, e.y - this.y) <= radius + 8)
          feel.floatText(e.x, e.y - 34, 'EN GRÈVE', Css.white, 900);
      }
    }
  }

  // ─── Table d'états ─────────────────────────────────────────────────────────

  private buildStates(): StateTable<Player, PlayerStates> {
    return {
      idle: {
        enter: (p) => {
          p.playAnim('idle');
        },
        update: (p, dt) => {
          p.steer(dt, 1);
          const next = p.nextFromFree();
          if (next) return next;
          if (p.moving) return { to: 'run', payload: null };
          p.facingAngle = p.intent.aim;
          p.playAnim('idle');
          return null;
        },
      },
      run: {
        update: (p, dt) => {
          p.steer(dt, 1);
          const next = p.nextFromFree();
          if (next) return next;
          if (!p.moving) return { to: 'idle', payload: null };
          p.facingAngle = p.moveAngle();
          p.playAnim('run');
          return null;
        },
      },
      attack: {
        enter: (p, { combo }) => {
          const step = COMBO[combo] ?? COMBO[0];
          p.beginSwing(step, `attack${String(combo + 1)}`, combo);
        },
        update: (p, dt, t) => {
          const now = p.world.now();
          p.updateSwing(dt, t, p.combo === 2);
          // Annulation par dash (jamais pendant l'active).
          if (
            p.buffer.peek('dash', now) &&
            p.world.run.dash.canDash() &&
            canDashCancel(p.timing, p.combo, t)
          ) {
            p.buffer.consume('dash', now);
            p.finishSwing();
            return { to: 'dash', payload: { angle: p.moving ? p.moveAngle() : p.facingAngle } };
          }
          const phase = phaseAt(p.timing, t);
          if (phase === 'recovery' && canChain(p.timing, t)) {
            if (p.buffer.peek('special', now)) {
              p.finishSwing();
              const next = p.nextFromFree();
              if (next) return next;
            }
            if (p.buffer.consume('attack', now)) {
              p.finishSwing();
              return { to: 'attack', payload: { combo: (p.combo + 1) % COMBO.length } };
            }
          }
          if (phase === 'done') {
            p.finishSwing();
            return p.moving ? { to: 'run', payload: null } : { to: 'idle', payload: null };
          }
          return null;
        },
      },
      dashAttack: {
        enter: (p) => {
          p.beginSwing(DASH_ATTACK, 'attack2', 0);
          p.facingAngle = p.dashAngle;
        },
        update: (p, dt, t) => {
          p.updateSwing(dt, t, false);
          if (phaseAt(p.timing, t) === 'done') {
            // La Frappe reprend au coup 2.
            p.lastAttackEnd = p.world.now();
            p.lastCombo = DASH.ATTACK_RESUME_COMBO - 1;
            return { to: 'idle', payload: null };
          }
          return null;
        },
      },
      dash: {
        canEnter: (p) => p.world.run.dash.canDash(),
        enter: (p, { angle }) => {
          p.startDash(angle);
        },
        update: (p, _dt, t) => {
          if (t < DASH.DURATION_MS) {
            const distance = DASH.DISTANCE_PX + p.world.run.mods.dashDistanceBonus;
            const speed = (distance * 1000) / DASH.DURATION_MS;
            p.body.setVelocity(Math.cos(p.dashAngle) * speed, Math.sin(p.dashAngle) * speed);
            if (t >= p.ghostAt) {
              p.ghostAt = t + 28;
              p.world.feel.afterimage(p, p.perfectUsed ? 0xffd200 : 0x7cf2ff);
            }
            return null;
          }
          p.endDash();
          const now = p.world.now();
          // Sortie de dash : on garde un peu d'élan.
          const v = Math.hypot(p.body.velocity.x, p.body.velocity.y);
          const keep = v > 0 ? Math.min(1, (HERO.SPEED * 0.6) / v) : 0;
          p.body.setVelocity(p.body.velocity.x * keep, p.body.velocity.y * keep);
          if (p.buffer.consume('attack', now)) return { to: 'dashAttack', payload: null };
          return p.moving ? { to: 'run', payload: null } : { to: 'idle', payload: null };
        },
      },
      charge: {
        enter: (p) => {
          p.playAnim('special', p.facingAngle, undefined, true);
          p.anims.pause(p.anims.currentAnim?.frames[1]);
        },
        update: (p, dt, t) => {
          p.steer(dt, SPECIAL_RULES.HOLD_SPEED_FACTOR);
          const mob = p.world.run.mobilisation;
          if (t >= SPECIAL_RULES.HOLD_FOR_PREAVIS_MS && mob.canSpend(PREAVIS.cost)) {
            return { to: 'special', payload: { kind: 'preavis' } };
          }
          if (!p.intent.specialHeld) return { to: 'special', payload: { kind: 'whistle' } };
          if (Math.floor(t / 100) % 2 === 0) p.world.feel.sparksAt(p.x, p.y - 20, 1);
          return null;
        },
      },
      special: {
        canEnter: (p) => p.world.run.mobilisation.canSpend(WHISTLE.cost),
        enter: (p, { kind }) => {
          const def = kind === 'preavis' ? PREAVIS : WHISTLE;
          p.world.run.mobilisation.spend(def.cost);
          p.specialKind = kind;
          p.specialStruck = false;
          p.lastSpecialAt = p.world.now();
          p.body.setVelocity(0, 0);
          p.playAnim('special', p.facingAngle, def.startupMs + def.activeMs + def.recoveryMs, true);
        },
        update: (p, _dt, t) => {
          const def = p.specialKind === 'preavis' ? PREAVIS : WHISTLE;
          p.body.setVelocity(0, 0);
          if (!p.specialStruck && t >= def.startupMs) {
            p.specialStruck = true;
            p.releaseSpecial(def);
          }
          return t >= def.startupMs + def.activeMs + def.recoveryMs
            ? { to: 'idle', payload: null }
            : null;
        },
      },
      drink: {
        enter: (p) => {
          p.sipped = false;
          p.playAnim('idle');
          p.world.feel.floatText(p.x, p.y - 40, 'Gorgée de café…', Css.white, 600);
        },
        update: (p, dt, t) => {
          const now = p.world.now();
          p.steer(dt, COFFEE.DRINK_MOVE_FACTOR);
          if (p.buffer.peek('dash', now) && p.world.run.dash.canDash()) {
            p.buffer.consume('dash', now);
            return { to: 'dash', payload: { angle: p.moving ? p.moveAngle() : p.facingAngle } };
          }
          if (!p.sipped && t >= COFFEE.SIP_AT_MS) {
            p.sipped = true;
            const run = p.world.run;
            run.gobelets -= 1;
            const ratio =
              COFFEE.HEAL_FRACTION * run.burnout.tier.coffeeHeal + run.mods.coffeeHealBonus;
            const healed = heal(run, Math.round(maxEnergy(run) * ratio));
            p.handleBurnout(run.burnout.add(BURNOUT.PER_COFFEE));
            p.caffeineUntil = now + COFFEE.CAFFEINE_MS;
            p.world.feel.floatText(
              p.x,
              p.y - 44,
              `+${String(healed)} Énergie · Caféine`,
              Css.quaiYellow,
              900,
            );
          }
          return t >= COFFEE.DRINK_MS ? { to: 'idle', payload: null } : null;
        },
      },
      hurt: {
        enter: (p, { angle, px }) => {
          p.hurtAngle = angle;
          p.hurtPx = px;
          p.playAnim('hurt', p.facingAngle, undefined, true);
          p.world.feel.squash(p, 0.82, 1.15, 180);
        },
        update: (p, _dt, t) => {
          if (t < HERO.KNOCKBACK_TAKEN_MS) {
            const speed = (p.hurtPx * 1000) / HERO.KNOCKBACK_TAKEN_MS;
            p.body.setVelocity(Math.cos(p.hurtAngle) * speed, Math.sin(p.hurtAngle) * speed);
          } else p.body.setVelocity(0, 0);
          if (t < HERO.HURT_STUN_MS) return null;
          return (
            p.nextFromFree() ??
            (p.moving ? { to: 'run', payload: null } : { to: 'idle', payload: null })
          );
        },
      },
      dead: {
        enter: (p) => {
          p.body.setVelocity(0, 0);
          p.body.enable = false;
          p.playAnim('death', p.facingAngle, 1500, true);
          p.world.feel.slowmo(0.4, 900, 300);
          p.scene.time.delayedCall(1500, () => p.onDeath?.());
        },
      },
    };
  }

  public override destroy(fromScene?: boolean): void {
    this.shadow.destroy();
    this.trailGfx.destroy();
    super.destroy(fromScene);
  }
}
