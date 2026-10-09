import { DIRUPO } from '@/config/balance';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { distanceToSegment } from '@/systems/combat/geometry';
import { pick } from '@/utils/rng';
import { PHASE_LINES } from '@/sim/biomes';
import type { HazardSim } from '@/sim/Hazards';
import type { SimWorld } from '@/sim/SimWorld';
import type { EnemyHit, HeroSwingInfo, PhasedEnemy } from '@/sim/enemies/EnemySim';
import { EnemySim } from '@/sim/enemies/EnemySim';

export type DiRupoPattern = 'bowtie' | 'speech' | 'promises' | 'ballots' | 'motions' | 'scissors';

/** Nœud papillon en vol (boomerang) : lu par la vue. */
export interface Bowtie {
  x: number;
  y: number;
  angle: number;
  dist: number;
  back: boolean;
  hitOut: boolean;
  hitBack: boolean;
}

/** Ruban d'enceinte (phase 3) : cercle centré sur l'arène qui se resserre. */
export interface Ribbon {
  readonly cx: number;
  readonly cy: number;
  radius: number;
  /** Ms restantes avant que le ruban ne soit tendu (télégraphe : les poteaux se plantent). */
  armLeft: number;
}

const PROMISE_WINDUP_MS = 400;

/**
 * Boss obligatoire du biome 2 : Elio Di Rupo, « l'Invité d'honneur » (GDD § 7.8, LORE § 7.5).
 * Caricature autorisée, satire **bon enfant** : c'est un duel oratoire, il est vaincu (« temps de
 * parole épuisé »), jamais tué ; toutes ses répliques sont fictives et signalées comme telles.
 * - Phase 1 « Le Discours inaugural » : nœud papillon boomerang, « Et j'ajouterai… » (anneaux à brèche
 *   tournante, dos exposé, interrompu par le Sifflet), promesses à crever (frappées : « promesse
 *   tenue »), pluie de bulletins ;
 * - Phase 2 « La Première Pierre » (60 %) : + motions de procédure (3 couloirs) ;
 * - Phase 3 « Le Ruban » (25 %) : ruban d'enceinte qui se resserre (un coup final, une dash-attaque
 *   ou un dash parfait le coupe : étourdi 3 s, +25 %), ciseaux d'inauguration ; télégraphes ×0,85
 *   (jamais sous 800 ms).
 * Préavis : « Concertation sociale », il pose le micro 4 s (aucune attaque, +15 %).
 */
export class DiRupoSim extends EnemySim implements PhasedEnemy {
  public phase = 1;
  public transitionLeft = 0;
  public bowtie: Bowtie | null = null;
  public ribbon: Ribbon | null = null;
  /** Concertation sociale (Préavis) : ms restantes. */
  public talksLeft = 0;
  /** Au pupitre (grand discours) : ms restantes. */
  public speaking = false;
  private nextPatternAt = 0;
  private readonly cooldowns = new Map<DiRupoPattern, number>();
  private readonly speechRings: HazardSim[] = [];
  private speechGap = 0;
  private ringsSent = 0;
  private aim = 0;
  private ribbonCutReadyAt = 0;
  private ribbonHitAt = 0;
  private ribbonShrinkFrom: number = DIRUPO.RIBBON_START;
  private ribbonShrinkT = 0;

  public constructor(world: SimWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'dirupo', x, y, scale);
    const now = world.now();
    this.nextPatternAt = now + 1600;
    this.cooldowns.set('speech', now + 5000);
    this.cooldowns.set('promises', now + 3000);
  }

  protected override get speed(): number {
    return (DIRUPO.SPEEDS[this.phase - 1] ?? DIRUPO.speed) * this.speedMult;
  }

  public override isHittable(): boolean {
    return super.isHittable() && this.transitionLeft <= 0;
  }

  /** Télégraphe d'un pattern (phase 3 : ×0,85, jamais sous 800 ms). */
  private tele(ms: number): number {
    return this.phase >= 3 ? Math.max(DIRUPO.MIN_TELEGRAPH_MS, ms * DIRUPO.P3_TELEGRAPH_MULT) : ms;
  }

  public override tick(dtMs: number): void {
    super.tick(dtMs);
    if (this.isDead) return;
    if (this.transitionLeft > 0) {
      this.transitionLeft -= dtMs;
      this.halt();
    }
    if (this.talksLeft > 0) {
      this.talksLeft = Math.max(0, this.talksLeft - dtMs);
      this.halt();
    }
    this.updateBowtie(dtMs);
    this.updateRibbon(dtMs);
  }

  private ready(p: DiRupoPattern): boolean {
    return (this.cooldowns.get(p) ?? 0) <= this.world.now();
  }

  protected think(): string | null {
    const now = this.world.now();
    const d = this.distToHero();
    const h = this.world.hero.body;
    this.facing = this.angleToHero();
    if (this.transitionLeft > 0 || this.talksLeft > 0) return null;
    // Orateur : il garde la bonne distance, de profil, en gesticulant.
    if (d > DIRUPO.KEEP_PX + 40) this.moveToward(h.x, h.y);
    else if (d < DIRUPO.KEEP_PX - 40) this.moveAngle(this.facing + Math.PI, this.speed);
    else this.moveAngle(this.facing + Math.PI / 2, this.speed * 0.4);
    this.facing = this.angleToHero();
    if (now < this.nextPatternAt || this.bowtie) return null;
    const options: DiRupoPattern[] = [];
    if (this.ready('bowtie')) options.push('bowtie', 'bowtie');
    if (this.ready('speech')) options.push('speech');
    if (this.ready('promises')) options.push('promises', 'promises');
    if (this.ready('ballots')) options.push('ballots');
    if (this.phase >= 2 && this.ready('motions')) options.push('motions', 'motions');
    if (this.phase >= 3 && this.ready('scissors') && d < DIRUPO.SCISSORS_LENGTH)
      options.push('scissors', 'scissors');
    return pick(this.world.rng, options) ?? null;
  }

  protected tokenFor(): TokenKind | null {
    return null;
  }

  protected windupMs(attack: string): number {
    switch (attack as DiRupoPattern) {
      case 'bowtie':
        return this.tele(DIRUPO.BOWTIE_TELEGRAPH_MS);
      case 'speech':
        return this.tele(DIRUPO.SPEECH_TELEGRAPH_MS);
      case 'promises':
        return PROMISE_WINDUP_MS;
      case 'ballots':
        return this.tele(DIRUPO.BALLOT_TELEGRAPH_MS);
      case 'motions':
        return this.tele(DIRUPO.MOTIONS_TELEGRAPH_MS);
      case 'scissors':
        return this.tele(DIRUPO.SCISSORS_TELEGRAPH_MS);
    }
  }

  protected onWindup(attack: string): void {
    const b = this.body;
    const h = this.world.hero.body;
    this.aim = this.angleToHero();
    this.facing = this.aim;
    switch (attack as DiRupoPattern) {
      case 'bowtie':
        this.telegraph = {
          kind: 'line',
          x: b.x,
          y: b.y,
          angle: this.aim,
          length: DIRUPO.BOWTIE_OUT,
          width: DIRUPO.BOWTIE_RADIUS * 2 + 6,
        };
        break;
      case 'speech':
        this.telegraph = { kind: 'circle', x: b.x, y: b.y, radius: DIRUPO.SPEECH_RING_MAX };
        break;
      case 'promises':
      case 'motions':
        this.telegraph = null;
        if (attack === 'motions') this.spawnMotions();
        break;
      case 'ballots': {
        this.telegraph = null;
        const rng = this.world.rng;
        const tele = this.tele(DIRUPO.BALLOT_TELEGRAPH_MS);
        for (let i = 0; i < DIRUPO.BALLOTS; i += 1) {
          const onHero = i < DIRUPO.BALLOTS_ON_HERO;
          const a = rng() * Math.PI * 2;
          const r = onHero ? rng() * 18 : 50 + rng() * 170;
          this.world.spawnHazard({
            kind: 'circle',
            x: h.x + Math.cos(a) * r,
            y: h.y + Math.sin(a) * r * 0.8,
            radius: DIRUPO.BALLOT_RADIUS,
            telegraphMs: tele + i * 40,
            damage: Math.round(DIRUPO.BALLOT_DAMAGE * this.damageMult),
            owner: this.displayName,
            skin: 'ballot',
          });
        }
        break;
      }
      case 'scissors':
        this.telegraph = {
          kind: 'line',
          x: b.x,
          y: b.y,
          angle: this.aim,
          length: DIRUPO.SCISSORS_LENGTH,
          width: DIRUPO.SCISSORS_WIDTH,
        };
        break;
    }
  }

  private spawnMotions(): void {
    const b = this.body;
    const a = this.aim;
    const px = -Math.sin(a);
    const py = Math.cos(a);
    const tele = this.tele(DIRUPO.MOTIONS_TELEGRAPH_MS);
    for (let i = 0; i < DIRUPO.MOTION_LANES; i += 1) {
      const off = (i - (DIRUPO.MOTION_LANES - 1) / 2) * DIRUPO.MOTION_SPACING;
      const x0 = b.x + px * off;
      const y0 = b.y + py * off;
      this.world.spawnHazard({
        kind: 'line',
        x0,
        y0,
        x1: x0 + Math.cos(a) * DIRUPO.MOTION_LENGTH,
        y1: y0 + Math.sin(a) * DIRUPO.MOTION_LENGTH,
        width: DIRUPO.MOTION_WIDTH,
        telegraphMs: tele,
        lingerMs: 220,
        tickMs: 1,
        once: true,
        damage: Math.round(DIRUPO.MOTION_DAMAGE * this.damageMult),
        owner: this.displayName,
        skin: 'motion',
      });
    }
  }

  protected override onAttackStart(attack: string): void {
    const now = this.world.now();
    const b = this.body;
    const pattern = attack as DiRupoPattern;
    const cd: Record<DiRupoPattern, number> = {
      bowtie: DIRUPO.BOWTIE_COOLDOWN_MS,
      speech: DIRUPO.SPEECH_COOLDOWN_MS,
      promises: DIRUPO.PROMISE_COOLDOWN_MS,
      ballots: DIRUPO.BALLOT_COOLDOWN_MS,
      motions: DIRUPO.MOTION_COOLDOWN_MS,
      scissors: DIRUPO.SCISSORS_COOLDOWN_MS,
    };
    this.cooldowns.set(pattern, now + cd[pattern]);
    this.world.emit({ type: 'enemyStrike', id: this.id, attack, x: b.x, y: b.y, angle: this.aim });
    switch (pattern) {
      case 'bowtie':
        this.bowtie = {
          x: b.x,
          y: b.y - 20,
          angle: this.aim,
          dist: 0,
          back: false,
          hitOut: false,
          hitBack: false,
        };
        this.world.emit({ type: 'fx', name: 'bowtieThrow', x: b.x, y: b.y });
        break;
      case 'speech':
        this.speaking = true;
        this.ringsSent = 0;
        this.speechGap = this.world.rng() * Math.PI * 2;
        this.world.emit({
          type: 'text',
          x: b.x,
          y: b.y - 60,
          text: '« Et j’ajouterai… »',
          tone: 'danger',
        });
        break;
      case 'promises':
        this.spawnPromises();
        break;
      case 'scissors': {
        const h = this.world.hero.hurtCircle;
        const end = {
          x: b.x + Math.cos(this.aim) * DIRUPO.SCISSORS_LENGTH,
          y: b.y + Math.sin(this.aim) * DIRUPO.SCISSORS_LENGTH,
        };
        if (distanceToSegment(h, { x: b.x, y: b.y }, end) <= DIRUPO.SCISSORS_WIDTH / 2 + h.r)
          this.hitHero(DIRUPO.SCISSORS_DAMAGE, 40);
        this.world.emit({ type: 'shake', px: 3, ms: 160 });
        break;
      }
      default:
        break;
    }
  }

  private spawnPromises(): void {
    const h = this.world.hero.body;
    const rng = this.world.rng;
    const run = this.world.run;
    for (let i = 0; i < DIRUPO.PROMISES; i += 1) {
      const a = (i / DIRUPO.PROMISES) * Math.PI * 2 + rng() * 0.6;
      const r = 40 + rng() * 90;
      const x = h.x + Math.cos(a) * r;
      const y = h.y + Math.sin(a) * r * 0.8;
      this.world.spawnHazard({
        kind: 'circle',
        x,
        y,
        radius: DIRUPO.PROMISE_BURST_RADIUS,
        telegraphMs: DIRUPO.PROMISE_TELEGRAPH_MS,
        damage: Math.round(DIRUPO.PROMISE_DAMAGE * this.damageMult),
        owner: this.displayName,
        skin: 'promise',
        poppable: true,
        onPop: () => {
          run.mobilisation.add(DIRUPO.PROMISE_KEPT_MOBILISATION);
          this.world.hero.addBurnout(DIRUPO.PROMISE_KEPT_BURNOUT);
          this.world.emit({ type: 'fx', name: 'promiseKept', x, y });
          this.world.emit({ type: 'text', x, y, text: 'Promesse tenue', tone: 'gold' });
        },
      });
    }
  }

  protected updateAttack(attack: string, _dt: number, elapsed: number): number | null {
    const gap = DIRUPO.PATTERN_GAP_MS[this.phase - 1] ?? 1500;
    const done = (recovery: number): number => {
      this.nextPatternAt = this.world.now() + gap;
      return recovery;
    };
    switch (attack as DiRupoPattern) {
      case 'bowtie':
        // Il attend le retour du nœud, puis reste 600 ms la garde baissée.
        return this.bowtie ? null : done(DIRUPO.BOWTIE_RECOVERY_MS);
      case 'speech': {
        this.halt();
        const b = this.body;
        while (this.ringsSent * DIRUPO.SPEECH_RING_EVERY_MS <= elapsed && this.ringsSent < 4) {
          this.ringsSent += 1;
          this.speechRings.push(
            this.world.spawnHazard({
              kind: 'ring',
              x: b.x,
              y: b.y,
              maxRadius: DIRUPO.SPEECH_RING_MAX,
              thickness: DIRUPO.SPEECH_RING_THICKNESS,
              telegraphMs: 0,
              expandMs: DIRUPO.SPEECH_RING_EXPAND_MS,
              damage: Math.round(DIRUPO.SPEECH_DAMAGE * this.damageMult),
              owner: this.displayName,
              gapDeg: DIRUPO.SPEECH_GAP_DEG,
              gapAngle:
                this.speechGap +
                ((elapsed / 1000) * DIRUPO.SPEECH_GAP_TURN_DEG_PER_S * Math.PI) / 180,
              gapTurnDegPerS: DIRUPO.SPEECH_GAP_TURN_DEG_PER_S,
              skin: 'speech',
            }),
          );
        }
        if (elapsed >= DIRUPO.SPEECH_MS) {
          this.speaking = false;
          return done(400);
        }
        return null;
      }
      case 'promises':
        return elapsed >= 300 ? done(500) : null;
      case 'ballots':
        this.halt();
        return elapsed >= 200 ? done(DIRUPO.BALLOT_RECOVERY_MS) : null;
      case 'motions':
        return elapsed >= 150 ? done(DIRUPO.MOTION_RECOVERY_MS) : null;
      case 'scissors':
        return elapsed >= 150 ? done(DIRUPO.SCISSORS_RECOVERY_MS) : null;
    }
  }

  // ─── Nœud papillon ─────────────────────────────────────────────────────────

  private updateBowtie(dtMs: number): void {
    const bt = this.bowtie;
    if (!bt) return;
    const b = this.body;
    const step = (DIRUPO.BOWTIE_SPEED * dtMs) / 1000;
    if (!bt.back) {
      bt.dist += step;
      bt.x = b.x + Math.cos(bt.angle) * bt.dist;
      bt.y = b.y - 20 + Math.sin(bt.angle) * bt.dist;
      if (bt.dist >= DIRUPO.BOWTIE_OUT) bt.back = true;
    } else {
      // Retour vers le cou, en courbe (il suit l'orateur).
      const tx = b.x;
      const ty = b.y - 20;
      const d = Math.hypot(tx - bt.x, ty - bt.y);
      if (d <= step + 4) {
        this.bowtie = null;
        return;
      }
      bt.x += ((tx - bt.x) / d) * step;
      bt.y += ((ty - bt.y) / d) * step;
    }
    const h = this.world.hero.hurtCircle;
    if (Math.hypot(h.x - bt.x, h.y - bt.y) <= DIRUPO.BOWTIE_RADIUS + h.r) {
      if (!bt.back && !bt.hitOut) {
        bt.hitOut = true;
        this.hitHero(DIRUPO.BOWTIE_DAMAGE, 18);
      } else if (bt.back && !bt.hitBack) {
        bt.hitBack = true;
        this.hitHero(DIRUPO.BOWTIE_DAMAGE, 18);
      }
    }
  }

  // ─── Ruban d'enceinte ──────────────────────────────────────────────────────

  private raiseRibbon(): void {
    const a = this.world.arena;
    this.ribbon = {
      cx: a.widthPx / 2,
      cy: a.heightPx / 2 + 8,
      radius: DIRUPO.RIBBON_START,
      armLeft: DIRUPO.RIBBON_TELEGRAPH_MS,
    };
    this.ribbonShrinkFrom = DIRUPO.RIBBON_START;
    this.ribbonShrinkT = 0;
    this.world.emit({ type: 'fx', name: 'ribbonUp', x: a.widthPx / 2, y: a.heightPx / 2 });
  }

  private updateRibbon(dtMs: number): void {
    const r = this.ribbon;
    if (!r) return;
    if (r.armLeft > 0) {
      r.armLeft = Math.max(0, r.armLeft - dtMs);
      return;
    }
    this.ribbonShrinkT += dtMs;
    const k = Math.min(1, this.ribbonShrinkT / DIRUPO.RIBBON_SHRINK_MS);
    r.radius = this.ribbonShrinkFrom + (DIRUPO.RIBBON_MIN - this.ribbonShrinkFrom) * k;
    const hero = this.world.hero;
    const hb = hero.body;
    const dx = hb.x - r.cx;
    const dy = hb.y - r.cy;
    const d = Math.hypot(dx, dy);
    if (d < r.radius - DIRUPO.RIBBON_WIDTH / 2 - 4) return;
    // Contact : 8 dégâts et entrave (un dash parfait le coupe : voir `onPerfectDash`).
    const now = this.world.now();
    if (now >= this.ribbonHitAt) {
      this.ribbonHitAt = now + DIRUPO.RIBBON_HIT_GAP_MS;
      const hurt = this.world.damageHero(Math.round(DIRUPO.RIBBON_DAMAGE * this.damageMult), {
        x: r.cx + (dx / Math.max(1, d)) * (r.radius + 30),
        y: r.cy + (dy / Math.max(1, d)) * (r.radius + 30),
        name: 'Le ruban d’inauguration',
        knockbackPx: 16,
      });
      if (hurt) hero.applySlow(DIRUPO.RIBBON_SLOW, DIRUPO.RIBBON_SLOW_MS);
    }
    if (!this.ribbon) return;
    // Le ruban retient : on ne sort pas de l'enceinte.
    const max = r.radius - DIRUPO.RIBBON_WIDTH / 2 - 6;
    if (d > max && d > 0) {
      hb.x = r.cx + (dx / d) * max;
      hb.y = r.cy + (dy / d) * max;
    }
  }

  /** « Inauguration ratée » : le ruban est coupé, il est étourdi 3 s (+25 %). */
  private cutRibbon(x: number, y: number): void {
    const r = this.ribbon;
    const now = this.world.now();
    if (!r || r.armLeft > 0 || now < this.ribbonCutReadyAt || this.isDead) return;
    this.ribbonCutReadyAt = now + DIRUPO.RIBBON_CUT_COOLDOWN_MS;
    r.radius = Math.min(DIRUPO.RIBBON_START, r.radius + DIRUPO.RIBBON_CUT_SLACK);
    this.ribbonShrinkFrom = r.radius;
    this.ribbonShrinkT = 0;
    this.makeVulnerable(DIRUPO.RIBBON_CUT_DAMAGE_TAKEN, DIRUPO.RIBBON_CUT_STUN_MS);
    this.nextPatternAt = now + DIRUPO.RIBBON_CUT_STUN_MS + 500;
    this.stun(DIRUPO.RIBBON_CUT_STUN_MS);
    this.world.time.slowmo(0.35, 500, 200);
    this.world.emit({ type: 'fx', name: 'ribbonCut', x, y });
    this.world.emit({ type: 'shake', px: 4, ms: 250 });
    this.world.emit({
      type: 'text',
      x: this.body.x,
      y: this.body.y - 60,
      text: 'INAUGURATION RATÉE !',
      tone: 'gold',
    });
  }

  /** Le héros est-il sur le ruban (à `margin` u près) ? */
  private nearRibbon(x: number, y: number, margin: number): boolean {
    const r = this.ribbon;
    if (!r) return false;
    return Math.abs(Math.hypot(x - r.cx, y - r.cy) - r.radius) <= margin;
  }

  public override onHeroSwing(s: HeroSwingInfo): void {
    if (!(s.finisher || s.dashAttack) || !this.ribbon) return;
    if (this.nearRibbon(s.x, s.y, s.reach + DIRUPO.RIBBON_WIDTH)) this.cutRibbon(s.x, s.y);
  }

  public override onPerfectDash(x: number, y: number): void {
    if (this.nearRibbon(x, y, 40)) this.cutRibbon(x, y);
  }

  public override onHeroSpecial(kind: 'whistle' | 'preavis'): void {
    if (this.isDead) return;
    if (kind === 'whistle') {
      // « Rappel au règlement » : interrompt le grand discours.
      if (this.speaking) {
        this.speaking = false;
        for (const r of this.speechRings) r.finish();
        this.speechRings.length = 0;
        this.nextPatternAt = this.world.now() + DIRUPO.SPEECH_INTERRUPT_STUN_MS + 400;
        this.stun(DIRUPO.SPEECH_INTERRUPT_STUN_MS);
        this.world.emit({
          type: 'text',
          x: this.body.x,
          y: this.body.y - 60,
          text: 'RAPPEL AU RÈGLEMENT',
          tone: 'gold',
        });
      }
      return;
    }
    // « Concertation sociale » : il pose le micro et négocie.
    this.speaking = false;
    for (const r of this.speechRings) r.finish();
    this.speechRings.length = 0;
    this.telegraph = null;
    this.talksLeft = DIRUPO.PREAVIS_TALKS_MS;
    this.makeVulnerable(DIRUPO.PREAVIS_DAMAGE_TAKEN, DIRUPO.PREAVIS_TALKS_MS);
    this.nextPatternAt = this.world.now() + DIRUPO.PREAVIS_TALKS_MS + 300;
    this.fsm.request({ to: 'recover', payload: { ms: DIRUPO.PREAVIS_TALKS_MS } });
    this.world.emit({ type: 'fx', name: 'concertation', x: this.body.x, y: this.body.y });
    this.world.emit({
      type: 'bossLine',
      speaker: "L'Invité d'honneur",
      text: 'Une concertation ? Excellente idée. Je note… je note.',
      fictive: true,
    });
  }

  /** Grand discours : le dos est exposé (+25 %). */
  protected override damageTakenMult(hit: EnemyHit): number {
    let mult = super.damageTakenMult(hit);
    if (this.speaking) {
      const from = Math.atan2(hit.fromY - this.body.y, hit.fromX - this.body.x);
      let diff = from - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > Math.PI / 2) mult += DIRUPO.SPEECH_BACK_DAMAGE_TAKEN;
    }
    return mult;
  }

  protected override interruptible(): boolean {
    return false;
  }

  protected override onHurt(): void {
    const ratio = this.hp / this.maxHp;
    const next = ratio <= DIRUPO.PHASE_AT[1] ? 3 : ratio <= DIRUPO.PHASE_AT[0] ? 2 : 1;
    if (next <= this.phase) return;
    this.phase = next;
    this.transitionLeft = DIRUPO.PHASE_TRANSITION_MS;
    this.telegraph = null;
    this.speaking = false;
    for (const r of this.speechRings) r.finish();
    this.speechRings.length = 0;
    const title = next === 2 ? 'LA PREMIÈRE PIERRE' : 'LE RUBAN';
    this.world.emit({ type: 'bossPhase', phase: next, title });
    this.world.emit({ type: 'shake', px: 4, ms: 350 });
    const line = PHASE_LINES.dirupo?.[next - 2];
    if (line) this.world.emit({ type: 'bossLine', ...line });
    const now = this.world.now();
    this.nextPatternAt = now + DIRUPO.PHASE_TRANSITION_MS + 600;
    if (next === 3) this.raiseRibbon();
    this.fsm.request({ to: 'recover', payload: { ms: DIRUPO.PHASE_TRANSITION_MS } });
  }

  protected override onDeath(): void {
    // Vaincu, jamais tué : il coupe enfin le ruban, salue et descend de l'estrade (vue).
    this.bowtie = null;
    this.ribbon = null;
    this.speaking = false;
    for (const r of this.speechRings) r.finish();
    this.speechRings.length = 0;
    this.world.emit({ type: 'fx', name: 'confetti', x: this.body.x, y: this.body.y });
    this.world.emit({
      type: 'text',
      x: this.body.x,
      y: this.body.y - 60,
      text: 'TEMPS DE PAROLE ÉPUISÉ',
      tone: 'gold',
    });
  }
}
