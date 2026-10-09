import type { SpecialDef } from '@/config/balance';
import type { ToolDef, ToolStep } from '@/config/loot';
import {
  BURNOUT,
  COFFEE,
  COMBO,
  COMBO_RULES,
  DASH,
  FEEL,
  HERO,
  INPUT,
  MOBILISATION,
  PREAVIS,
  SPECIAL_RULES,
  WHISTLE,
} from '@/config/balance';
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
import type { Circle } from '@/systems/combat/geometry';
import { InputBuffer } from '@/systems/InputBuffer';
import { heal, maxEnergy } from '@/systems/meta/RunState';
import { StateMachine } from '@/systems/StateMachine';
import type { StateTable, Transition } from '@/systems/StateMachine';
import { approach } from '@/utils/math';
import type { PlayerIntent } from '@/sim/intent';
import { NO_INTENT } from '@/sim/intent';
import type { Body, HitSource, SimWorld } from '@/sim/SimWorld';
import { makeBody } from '@/sim/SimWorld';
import { Weapon } from '@/sim/Weapon';

type Action = 'attack' | 'dash' | 'special' | 'coffee';

export interface HeroStates {
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

export type HeroStateName = keyof HeroStates;

/** Durée de l'animation de mort avant l'événement `heroDied` (version Phaser : 1 500 ms). */
export const HERO_DEATH_MS = 1500;
/** Distance (u) des effets d'impact du coup 3 devant le héros. */
const SLAM_FX_DIST = 34;

/**
 * Le cheminot, côté simulation (port pur de `entities/Player.ts`). La table d'états est conservée
 * presque mot pour mot ; le corps Arcade devient un `Body`, les appels à `GameFeel` deviennent des
 * événements (`SimWorld.emit`) et des demandes à `TimeControl` (hitstop, ralenti). La vue lit l'état,
 * le temps dans l'état et le timing du coup courant pour poser l'animation.
 */
export class HeroSim {
  public readonly body: Body;
  /** Angle de la dernière visée / du dernier déplacement (logique). */
  public facingAngle = Math.PI / 2;
  private readonly fsm: StateMachine<HeroSim, HeroStates>;
  private readonly buffer = new InputBuffer<Action>(INPUT.BUFFER_MS);
  private readonly weapon: Weapon;
  private intent: PlayerIntent = NO_INTENT;
  // Combo
  private comboIndex = 0;
  private step: ToolStep = COMBO[0];
  private stepTiming: StepTiming = timingOf(COMBO[0]);
  private activeStarted = false;
  private lastAttackEnd = -Infinity;
  private lastCombo = -1;
  private hitThisSwing = false;
  // Dash
  private dashDir = 0;
  private dashStartedAt = -Infinity;
  private lastDashEnd = -Infinity;
  private perfectUsed = false;
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
  private specialKindValue: 'whistle' | 'preavis' = 'whistle';
  private specialStruck = false;
  private hurtAngle = 0;
  private hurtPx = 0;
  private diedEmitted = false;

  public constructor(
    private readonly world: SimWorld,
    x: number,
    y: number,
  ) {
    this.body = makeBody(x, y, HERO.FEET_RADIUS);
    this.weapon = new Weapon(world);
    this.fsm = new StateMachine<HeroSim, HeroStates>(this, this.buildStates());
    this.fsm.start({ to: 'idle', payload: null });
    this.shieldReadyAt = world.now();
  }

  // ─── Lecture d'état (vue, HUD) ─────────────────────────────────────────────

  public get state(): HeroStateName {
    return this.fsm.current;
  }

  public get stateTime(): number {
    return this.fsm.timeInState;
  }

  public get isDead(): boolean {
    return this.fsm.is('dead');
  }

  /** Coup du combo en cours (0 à 3 selon l'Outil). */
  public get combo(): number {
    return this.comboIndex;
  }

  /** Outil équipé (moveset) : Clé à tire-fond sans équipement. */
  public get tool(): ToolDef {
    return this.world.loot.mods.tool;
  }

  /** Le coup en cours est le coup final de l'Outil. */
  public get isFinisher(): boolean {
    return this.comboIndex === this.tool.finisherIndex;
  }

  /**
   * Clip d'attaque à jouer (0, 1, 2 = attack1, attack2, attack3) : le coup final prend toujours le
   * coup lourd, les autres alternent (combos de 2 à 4 coups).
   */
  public get animCombo(): number {
    if (this.isFinisher) return 2;
    return this.comboIndex % 2;
  }

  /** Timing du coup en cours (vitesse d'attaque comprise) : la vue y cale l'animation. */
  public get timing(): StepTiming {
    return this.stepTiming;
  }

  public get dashAngle(): number {
    return this.dashDir;
  }

  public get specialKind(): 'whistle' | 'preavis' {
    return this.specialKindValue;
  }

  /** Clignotement des i-frames après un coup reçu. */
  public get blinking(): boolean {
    return this.world.now() < this.iframesUntil && !this.isDead;
  }

  public get hasShield(): boolean {
    const every = this.world.run.mods.shieldEveryMs;
    return every > 0 && this.world.now() >= this.shieldReadyAt;
  }

  /** Hurtbox du torse (cercle), pour les attaques ennemies. */
  public get hurtCircle(): Circle {
    return { x: this.body.x, y: this.body.y - HERO.HURT_OFFSET_Y, r: HERO.HURT_RADIUS };
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
    const loot = this.world.loot;
    return {
      damageBonus:
        tier.damageDealt +
        mods.damageBonus +
        loot.damageBonusNow() +
        (energyRatio < 0.5 ? mods.lowEnergyDamageBonus : 0),
      // Le critique de base vient de l'Outil ; le total est plafonné (GDD § 9 bis.8).
      critChance: loot.capCrit(
        loot.mods.damage.critChanceBase +
          tierCrit +
          mods.critChance +
          mods.critPerBurnout * Math.floor(overBurn / 10),
      ),
      critMult: HERO.CRIT_MULT + mods.critMult + (energyRatio < 0.3 ? mods.lowEnergyCritMult : 0),
    };
  }

  private get attackSpeedBonus(): number {
    const gear = this.world.loot.mods;
    const caffeine =
      this.world.now() < this.caffeineUntil
        ? COFFEE.CAFFEINE_ATTACK_SPEED + gear.coffee.caffeineAttackSpeedBonus
        : 0;
    return this.world.run.burnout.tier.attackSpeed + caffeine + (gear.attackSpeedMult - 1);
  }

  private get moveSpeed(): number {
    const run = this.world.run;
    const ballast =
      this.world.arena.isSlowGround(this.body.x, this.body.y) &&
      !this.world.loot.mods.movement.ballastImmune
        ? HERO.BALLAST_SLOW
        : 0;
    const slow = this.slowLeft > 0 ? this.slowFactor : 0;
    return (
      HERO.SPEED * (1 + run.burnout.tier.speed + run.mods.speedBonus) * (1 - slow) * (1 - ballast)
    );
  }

  // ─── Effets subis ──────────────────────────────────────────────────────────

  public mark(ms: number, bonus: number): void {
    if (!this.isMarked) this.text('SIGNALÉ', 'danger');
    this.markUntil = this.world.now() + ms;
    this.markBonus = bonus;
  }

  public applySlow(factor: number, ms: number): void {
    this.slowFactor = Math.max(factor, this.slowLeft > 0 ? this.slowFactor : 0);
    this.slowLeft = Math.max(this.slowLeft, ms * this.world.loot.mods.defense.slowTakenMult);
  }

  /** Vrai si le héros est dans la fenêtre de dash parfait. */
  public inPerfectWindow(): boolean {
    const t = this.world.now() - this.dashStartedAt;
    return (
      this.fsm.is('dash') &&
      !this.perfectUsed &&
      t <=
        (DASH.PERFECT_WINDOW_MS + this.world.run.mods.perfectDashWindowBonusMs) *
          this.world.loot.perfectWindowMult
    );
  }

  public isInvulnerable(): boolean {
    const now = this.world.now();
    const dashIframes = this.fsm.is('dash') && now - this.dashStartedAt <= DASH.IFRAMES_MS;
    return this.isDead || dashIframes || now < this.iframesUntil;
  }

  /** Coup reçu (appelé par le monde via `SimWorld.damageHero`). */
  public receiveHit(base: number, source: HitSource): boolean {
    if (this.isDead) return false;
    if (this.fsm.is('dash') && this.isInvulnerable()) {
      if (this.inPerfectWindow()) this.perfectDash();
      return false;
    }
    if (this.isInvulnerable()) return false;
    const run = this.world.run;
    const now = this.world.now();
    const loot = this.world.loot;
    if (loot.absorbHit()) {
      this.iframesUntil = now + 300;
      return false;
    }
    if (this.hasShield) {
      this.shieldReadyAt = now + run.mods.shieldEveryMs;
      this.iframesUntil = now + 300;
      this.text('PAUSE LÉGALE', 'info');
      return false;
    }
    const takenBonus = run.burnout.tier.damageTaken + (this.isMarked ? this.markBonus : 0);
    const amount = Math.max(
      1,
      Math.round(incoming(base, takenBonus) * loot.mods.defense.damageTakenMult),
    );
    run.energy = Math.max(0, run.energy - amount);
    run.lastHitBy = source.name;
    run.mobilisation.add(MOBILISATION.PER_HIT_TAKEN);
    loot.onHitTaken();
    this.handleBurnout(run.burnout.onDamageTaken(amount * loot.mods.burnout.onHitMult));
    const angle = Math.atan2(this.body.y - source.y, this.body.x - source.x);
    this.world.time.hitstop(FEEL.HERO_HIT_HITSTOP_MS);
    this.world.emit({ type: 'shake', px: FEEL.HERO_HIT_SHAKE_PX, ms: FEEL.HERO_HIT_SHAKE_MS });
    this.world.emit({ type: 'heroHurt', x: this.body.x, y: this.body.y, amount, angle });
    this.iframesUntil = now + HERO.IFRAMES_AFTER_HIT_MS;

    if (run.energy <= 0) {
      if (run.loadout.reviveFraction > 0 && !run.reviveUsed) {
        run.reviveUsed = true;
        run.energy = Math.round(maxEnergy(run) * run.loadout.reviveFraction);
        this.text('MUTUELLE : ON SE RELÈVE', 'gold');
        this.world.time.slowmo(0.3, 500, 300);
        this.iframesUntil = now + 1500;
      } else {
        this.fsm.request({ to: 'dead', payload: null });
        return true;
      }
    }
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
    this.world.time.slowmo(DASH.PERFECT_TIMESCALE, DASH.PERFECT_SLOWMO_MS, 80);
    this.world.emit({ type: 'perfectDash', x: this.body.x, y: this.body.y });
    this.world.loot.onPerfectDash(this.body.x, this.body.y);
    this.text('+15 min', 'gold');
  }

  private text(text: string, tone: 'info' | 'danger' | 'gold' | 'hero'): void {
    this.world.emit({ type: 'text', x: this.body.x, y: this.body.y, text, tone });
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
    run.dash.rechargeRate =
      (run.burnout.inMeltdown ? 2 : 1) / Math.max(0.5, this.world.loot.mods.dash.rechargeMult);
    run.dash.tick(dtMs);
    this.handleBurnout(run.burnout.tick(dtMs));
    this.fsm.update(dtMs);
  }

  private handleBurnout(events: readonly BurnoutEvent[]): void {
    const run = this.world.run;
    for (const e of events) {
      if (e.kind === 'meltdown-start') {
        this.world.loot.onMeltdown();
        this.world.emit({ type: 'shake', px: 6, ms: 300 });
        this.world.emit({ type: 'vignette', amount: 0.35 });
        this.text('PÉTAGE DE PLOMBS !', 'danger');
      } else if (e.kind === 'meltdown-end') {
        run.maxEnergyPenalty += e.maxEnergyPenalty;
        run.energy = Math.min(run.energy, maxEnergy(run));
        this.text(`ARRÊT MALADIE : −${String(e.maxEnergyPenalty)} Énergie max`, 'info');
      }
    }
  }

  /** Vitesse cible selon le déplacement demandé, avec accélération et décélération du GDD. */
  private steer(dtMs: number, factor: number): void {
    const { moveX, moveY } = this.intent;
    const speed = this.moveSpeed * factor;
    const tx = moveX * speed;
    const ty = moveY * speed;
    const rate = ((this.moving ? HERO.ACCEL : HERO.DECEL) * dtMs) / 1000;
    this.body.vx = approach(this.body.vx, tx, rate);
    this.body.vy = approach(this.body.vy, ty, rate);
  }

  private setVelocity(vx: number, vy: number): void {
    this.body.vx = vx;
    this.body.vy = vy;
  }

  private get moving(): boolean {
    return this.intent.moveX !== 0 || this.intent.moveY !== 0;
  }

  private moveAngle(): number {
    return Math.atan2(this.intent.moveY, this.intent.moveX);
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  /** Choix de l'action suivante depuis un état « libre » (priorités : Dash > Spéciale > Attaque > Café). */
  private nextFromFree(): Transition<HeroStates> | null {
    const now = this.world.now();
    const run = this.world.run;
    if (this.buffer.peek('dash', now) && run.dash.canDash()) {
      this.buffer.consume('dash', now);
      return { to: 'dash', payload: { angle: this.moving ? this.moveAngle() : this.facingAngle } };
    }
    if (this.buffer.consume('special', now)) {
      if (now - this.lastSpecialAt < SPECIAL_RULES.COOLDOWN_MS)
        this.text('Sifflet en recharge', 'info');
      else if (!run.mobilisation.canSpend(WHISTLE.cost))
        this.text('Mobilisation insuffisante', 'info');
      else return { to: 'charge', payload: null };
    }
    if (this.buffer.consume('attack', now)) {
      if (now - this.lastDashEnd <= DASH.ATTACK_WINDOW_MS)
        return { to: 'dashAttack', payload: null };
      // Clé à cliquet perpétuel : le combo ne se réinitialise plus.
      const ratchet = this.world.loot.mods.legendaries.some((l) => l.power === 'cliquet-perpetuel');
      const chained =
        this.lastCombo >= 0 && (ratchet || now - this.lastAttackEnd <= COMBO_RULES.CHAIN_GRACE_MS);
      return {
        to: 'attack',
        payload: { combo: chained ? (this.lastCombo + 1) % this.tool.combo.length : 0 },
      };
    }
    if (this.buffer.consume('coffee', now)) {
      if (run.gobelets <= 0) this.text('Plus de Gobelet', 'info');
      else if (run.burnout.inMeltdown) this.text('Pas le temps pour un café !', 'danger');
      else return { to: 'drink', payload: null };
    }
    return null;
  }

  private beginSwing(step: ToolStep, comboIndex: number): void {
    this.step = step;
    this.stepTiming = timingOf(step, this.attackSpeedBonus);
    this.activeStarted = false;
    this.hitThisSwing = false;
    this.comboIndex = comboIndex;
    this.facingAngle = this.intent.aim;
    this.world.loot.onSwingStart(comboIndex);
  }

  /** Dégâts du coup : base × Calibre (garde-fou compris) × bonus de coup final ou de dash. */
  private stepDamage(finisher: boolean, dashAttack: boolean): number {
    const gear = this.world.loot.mods.damage;
    const mult =
      gear.baseMult * (finisher ? gear.finisherMult : 1) * (dashAttack ? gear.dashAttackMult : 1);
    return this.step.damage * mult + (finisher ? this.world.run.mods.finisherDamage : 0);
  }

  /** Frames actives : fente, hitbox, et retour de game feel si le coup porte. */
  private updateSwing(dtMs: number, elapsed: number, finisher: boolean, dashAttack: boolean): void {
    const phase = phaseAt(this.stepTiming, elapsed);
    if (phase === 'startup' || phase === 'active')
      this.steer(dtMs, this.tool.moveFactor ?? COMBO_RULES.MOVE_FACTOR);
    else this.steer(dtMs, 0);
    if (phase !== 'active') return;
    const a = this.facingAngle;
    if (!this.activeStarted) {
      this.activeStarted = true;
      this.weapon.begin();
      const lunge = (this.step.lungePx * 1000) / Math.max(1, this.stepTiming.activeMs);
      this.setVelocity(Math.cos(a) * lunge, Math.sin(a) * lunge);
      const shape = this.step.shape;
      this.world.emit({
        type: 'swing',
        combo: this.comboIndex,
        finisher,
        dashAttack,
        x: this.body.x,
        y: this.body.y,
        angle: a,
        reach:
          shape.kind === 'arc'
            ? shape.radius
            : shape.kind === 'circle'
              ? shape.at + shape.radius
              : shape.from + shape.length,
        arcDeg: shape.kind === 'arc' ? shape.angleDeg : shape.kind === 'circle' ? 360 : 0,
      });
      if (finisher)
        this.world.loot.onFinisher(this.body.x, this.body.y, a, this.stepDamage(true, false));
      if (finisher) {
        this.world.emit({
          type: 'enemyStrike',
          id: 0,
          attack: 'slam',
          x: this.body.x + Math.cos(a) * SLAM_FX_DIST,
          y: this.body.y + Math.sin(a) * SLAM_FX_DIST,
          angle: a,
        });
      }
    }
    const report = this.weapon.sweep(
      { x: this.body.x, y: this.body.y - HERO.ATTACK_ORIGIN_Y },
      a,
      {
        shape: this.step.shape,
        damage: this.stepDamage(finisher, dashAttack),
        knockbackPx: this.step.knockbackPx,
        knockbackMs: this.step.knockbackMs,
        stunMs: this.step.stunMs,
        breaksProjectiles: this.step.breaksProjectiles,
        finisher,
        combo: this.fsm.is('attack'),
        ...(this.step.slow ? { slow: this.step.slow } : {}),
      },
      this.outgoingMods(),
    );
    if (report.targets > 0) {
      this.world.loot.onSwingHit();
      this.world.time.hitstop(hitstopFor(this.step, report.targets, report.crit));
      this.world.emit({
        type: 'shake',
        px: report.crit ? 4 : this.step.shakePx,
        ms: report.crit ? 140 : this.step.shakeMs,
      });
      if (finisher && !this.hitThisSwing) this.world.emit({ type: 'zoomPunch' });
      this.hitThisSwing = true;
    }
  }

  private finishSwing(): void {
    this.lastAttackEnd = this.world.now();
    this.lastCombo = this.comboIndex;
  }

  private dashSpeed(): number {
    const distance = DASH.DISTANCE_PX + this.world.run.mods.dashDistanceBonus;
    return (distance * 1000) / DASH.DURATION_MS;
  }

  private startDash(angle: number): void {
    const run = this.world.run;
    run.dash.consume();
    this.dashDir = angle;
    this.facingAngle = angle;
    this.dashStartedAt = this.world.now();
    this.perfectUsed = false;
    this.handleBurnout(run.burnout.onDash());
    run.delayMinutes += 5;
    const speed = this.dashSpeed();
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.world.emit({ type: 'dash', x: this.body.x, y: this.body.y, angle });
  }

  private endDash(): void {
    this.lastDashEnd = this.world.now();
    this.world.emit({ type: 'dashEnd', x: this.body.x, y: this.body.y });
  }

  private releaseSpecial(def: SpecialDef): void {
    const mods = this.world.run.mods;
    const isWhistle = def === WHISTLE;
    const radius = def.radius + (isWhistle ? mods.whistleRadiusBonus : 0);
    const damage = Math.round(def.damage * (1 + (isWhistle ? mods.whistleDamageBonus : 0)));
    this.weapon.begin();
    this.weapon.sweep(
      { x: this.body.x, y: this.body.y - 6 },
      0,
      {
        shape: { kind: 'radial', radius },
        damage,
        knockbackPx: def.knockbackPx,
        knockbackMs: 160,
        stunMs: def.stunMs,
        eliteStunMs: def.eliteStunMs,
        breaksProjectiles: true,
        finisher: false,
        combo: false,
      },
      this.outgoingMods(),
    );
    this.world.emit({ type: 'shake', px: def.shakePx, ms: def.shakeMs });
    this.world.emit({
      type: 'special',
      kind: isWhistle ? 'whistle' : 'preavis',
      x: this.body.x,
      y: this.body.y,
      radius,
    });
    this.text(isWhistle ? 'COUP DE SIFFLET !' : 'PRÉAVIS DE GRÈVE !', 'gold');
  }

  // ─── Table d'états ─────────────────────────────────────────────────────────

  private buildStates(): StateTable<HeroSim, HeroStates> {
    return {
      idle: {
        update: (p, dt) => {
          p.steer(dt, 1);
          const next = p.nextFromFree();
          if (next) return next;
          if (p.moving) return { to: 'run', payload: null };
          p.facingAngle = p.intent.aim;
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
          return null;
        },
      },
      attack: {
        enter: (p, { combo }) => {
          const moves = p.tool.combo;
          p.beginSwing(moves[combo] ?? moves[0] ?? COMBO[0], combo);
        },
        update: (p, dt, t) => {
          const now = p.world.now();
          p.updateSwing(dt, t, p.isFinisher, false);
          // Annulation par dash (jamais pendant l'active).
          if (
            p.buffer.peek('dash', now) &&
            p.world.run.dash.canDash() &&
            canDashCancel(p.stepTiming, p.isFinisher ? 2 : 0, t)
          ) {
            p.buffer.consume('dash', now);
            p.finishSwing();
            return { to: 'dash', payload: { angle: p.moving ? p.moveAngle() : p.facingAngle } };
          }
          const phase = phaseAt(p.stepTiming, t);
          if (phase === 'recovery' && canChain(p.stepTiming, t)) {
            if (p.buffer.peek('special', now)) {
              p.finishSwing();
              const next = p.nextFromFree();
              if (next) return next;
            }
            if (p.buffer.consume('attack', now)) {
              p.finishSwing();
              return {
                to: 'attack',
                payload: { combo: (p.comboIndex + 1) % p.tool.combo.length },
              };
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
          p.beginSwing(p.tool.dashAttack, 0);
          p.facingAngle = p.dashDir;
        },
        update: (p, dt, t) => {
          p.updateSwing(dt, t, false, true);
          if (phaseAt(p.stepTiming, t) === 'done') {
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
            const speed = p.dashSpeed();
            p.setVelocity(Math.cos(p.dashDir) * speed, Math.sin(p.dashDir) * speed);
            return null;
          }
          p.endDash();
          const now = p.world.now();
          // Sortie de dash : on garde un peu d'élan.
          const v = Math.hypot(p.body.vx, p.body.vy);
          const keep = v > 0 ? Math.min(1, (HERO.SPEED * 0.6) / v) : 0;
          p.setVelocity(p.body.vx * keep, p.body.vy * keep);
          if (p.buffer.consume('attack', now)) return { to: 'dashAttack', payload: null };
          return p.moving ? { to: 'run', payload: null } : { to: 'idle', payload: null };
        },
      },
      charge: {
        update: (p, dt, t) => {
          p.steer(dt, SPECIAL_RULES.HOLD_SPEED_FACTOR);
          const mob = p.world.run.mobilisation;
          if (t >= SPECIAL_RULES.HOLD_FOR_PREAVIS_MS && mob.canSpend(PREAVIS.cost)) {
            return { to: 'special', payload: { kind: 'preavis' } };
          }
          if (!p.intent.specialHeld) return { to: 'special', payload: { kind: 'whistle' } };
          return null;
        },
      },
      special: {
        canEnter: (p) => p.world.run.mobilisation.canSpend(WHISTLE.cost),
        enter: (p, { kind }) => {
          const def = kind === 'preavis' ? PREAVIS : WHISTLE;
          p.world.run.mobilisation.spend(def.cost);
          p.specialKindValue = kind;
          p.specialStruck = false;
          p.lastSpecialAt = p.world.now();
          p.setVelocity(0, 0);
        },
        update: (p, _dt, t) => {
          const def = p.specialKindValue === 'preavis' ? PREAVIS : WHISTLE;
          p.setVelocity(0, 0);
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
          p.text('Gorgée de café…', 'info');
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
            const gear = p.world.loot.mods.coffee;
            run.gobelets -= 1;
            const ratio =
              COFFEE.HEAL_FRACTION * run.burnout.tier.coffeeHeal +
              run.mods.coffeeHealBonus +
              p.world.loot.onCupDrink();
            const healed = heal(run, Math.round(maxEnergy(run) * ratio));
            p.handleBurnout(run.burnout.add(BURNOUT.PER_COFFEE + gear.burnoutDelta));
            p.caffeineUntil = now + COFFEE.CAFFEINE_MS + gear.caffeineMsBonus;
            p.text(`+${String(healed)} Énergie · Caféine`, 'gold');
          }
          return t >= COFFEE.DRINK_MS ? { to: 'idle', payload: null } : null;
        },
      },
      hurt: {
        enter: (p, { angle, px }) => {
          p.hurtAngle = angle;
          p.hurtPx = px;
        },
        update: (p, _dt, t) => {
          if (t < HERO.KNOCKBACK_TAKEN_MS) {
            const speed = (p.hurtPx * 1000) / HERO.KNOCKBACK_TAKEN_MS;
            p.setVelocity(Math.cos(p.hurtAngle) * speed, Math.sin(p.hurtAngle) * speed);
          } else p.setVelocity(0, 0);
          if (t < HERO.HURT_STUN_MS) return null;
          return (
            p.nextFromFree() ??
            (p.moving ? { to: 'run', payload: null } : { to: 'idle', payload: null })
          );
        },
      },
      dead: {
        enter: (p) => {
          p.setVelocity(0, 0);
          p.body.enabled = false;
          p.world.time.slowmo(0.4, 900, 300);
        },
        update: (p, _dt, t) => {
          if (t >= HERO_DEATH_MS && !p.diedEmitted) {
            p.diedEmitted = true;
            p.world.emit({ type: 'heroDied', x: p.body.x, y: p.body.y });
          }
          return null;
        },
      },
    };
  }
}
