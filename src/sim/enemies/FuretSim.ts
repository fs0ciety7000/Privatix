import { FURET } from '@/config/balance';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { circleInArc } from '@/systems/combat/geometry';
import type { HazardSim } from '@/sim/Hazards';
import type { SimWorld } from '@/sim/SimWorld';
import type { EnemyHit } from '@/sim/enemies/EnemySim';
import { EnemySim } from '@/sim/enemies/EnemySim';

export type FuretAttack = 'bite' | 'pounce' | 'stink' | 'burrow';

/** La morsure part de la tête (u au-dessus des pieds). */
const HEAD_Y = 6;

/**
 * Élite majeur du biome 1 : le Furet putride (LORE § 6.8, game_designer.md § 11.2). Rapide et fuyant :
 * il tourne autour du héros, mord au contact, bondit (fenêtre principale : 900 ms sur le flanc, +25 %),
 * lâche des nuages de puanteur (verts, sans dégâts : +6 Burnout/s et récupération passive bloquée ;
 * seules les zones bordées de magenta blessent), passe sous les quais puis resurgit sous le héros
 * (cercle magenta de 700 ms). Le Sifflet le débusque et l'étourdit 1,2 s ; il disperse les nuages.
 */
export class FuretSim extends EnemySim {
  private nextBite = 0;
  private nextPounce = 0;
  private nextStink = 0;
  private nextBurrow = 0;
  private readonly clouds: HazardSim[] = [];
  private pounceAngle = 0;
  private hiddenFor = 0;
  private emerge: HazardSim | null = null;
  private landed = false;
  private flankLeft = 0;
  private orbitDir = 1;

  public constructor(world: SimWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'furet', x, y, scale);
    const now = world.now();
    this.nextStink = now + FURET.STINK_FIRST_AT_MS;
    this.nextBurrow = now + FURET.BURROW_FIRST_AT_MS;
    this.nextPounce = now + 1200;
    this.orbitDir = world.rng() < 0.5 ? -1 : 1;
  }

  /** « Acculé » sous 30 % de PV : plus rapide, nuages plus grands, plongées plus fréquentes. */
  public get frenzy(): boolean {
    return this.hp <= this.maxHp * FURET.FRENZY_AT;
  }

  /** Sous le quai : invisible et intouchable. */
  public get burrowed(): boolean {
    return this.hidden;
  }

  /** Sur le flanc après un bond (fenêtre de punition). */
  public get onFlank(): boolean {
    return this.flankLeft > 0;
  }

  protected override get speed(): number {
    return super.speed * (this.frenzy ? FURET.FRENZY_SPEED_MULT : 1);
  }

  public override isHittable(): boolean {
    return super.isHittable() && !this.hidden;
  }

  public override tick(dtMs: number): void {
    if (this.flankLeft > 0) this.flankLeft = Math.max(0, this.flankLeft - dtMs);
    super.tick(dtMs);
  }

  private liveClouds(): number {
    for (let i = this.clouds.length - 1; i >= 0; i -= 1) {
      if (this.clouds[i]?.done) this.clouds.splice(i, 1);
    }
    return this.clouds.length;
  }

  protected think(): string | null {
    const now = this.world.now();
    const d = this.distToHero();
    const a = this.angleToHero();
    this.facing = a;
    if (now >= this.nextBurrow && d > 40) return 'burrow';
    if (now >= this.nextStink && this.liveClouds() < FURET.STINK_MAX) return 'stink';
    if (d >= FURET.POUNCE_MIN && d <= FURET.POUNCE_MAX && now >= this.nextPounce) return 'pounce';
    if (d <= FURET.BITE_RANGE && now >= this.nextBite) return 'bite';
    // Il tourne autour du héros à bonne distance, puis vient mordre.
    if (d > FURET.KEEP_PX + 30) this.moveToward(this.world.hero.body.x, this.world.hero.body.y);
    else if (d < FURET.BITE_RANGE - 4) this.moveAngle(a + Math.PI, this.speed * 0.6);
    else if (now >= this.nextBite) this.moveToward(this.world.hero.body.x, this.world.hero.body.y);
    else this.moveAngle(a + (this.orbitDir * Math.PI) / 2, this.speed * 0.8);
    this.facing = a;
    return null;
  }

  protected tokenFor(attack: string): TokenKind | null {
    return attack === 'bite' || attack === 'pounce' ? 'melee' : null;
  }

  protected windupMs(attack: string): number {
    switch (attack as FuretAttack) {
      case 'bite':
        return FURET.BITE_TELEGRAPH_MS;
      case 'pounce':
        return FURET.POUNCE_TELEGRAPH_MS;
      case 'stink':
        return FURET.STINK_TELEGRAPH_MS;
      case 'burrow':
        return FURET.BURROW_TELEGRAPH_MS;
    }
  }

  protected onWindup(attack: string): void {
    this.facing = this.angleToHero();
    const b = this.body;
    switch (attack as FuretAttack) {
      case 'bite':
        this.telegraph = {
          kind: 'arc',
          x: b.x,
          y: b.y - HEAD_Y,
          angle: this.facing,
          reach: FURET.BITE_REACH,
          arcDeg: FURET.BITE_ARC_DEG,
        };
        break;
      case 'pounce': {
        this.pounceAngle = this.facing;
        this.telegraph = {
          kind: 'line',
          x: b.x,
          y: b.y,
          angle: this.pounceAngle,
          length: FURET.POUNCE_DISTANCE,
          width: 20,
        };
        // Atterrissage : cercle magenta qui se remplit jusqu'au contact.
        const tx = b.x + Math.cos(this.pounceAngle) * FURET.POUNCE_DISTANCE;
        const ty = b.y + Math.sin(this.pounceAngle) * FURET.POUNCE_DISTANCE;
        this.world.spawnHazard({
          kind: 'circle',
          x: tx,
          y: ty,
          radius: FURET.POUNCE_LAND_RADIUS,
          telegraphMs: FURET.POUNCE_TELEGRAPH_MS + FURET.POUNCE_DURATION_MS,
          damage: Math.round(FURET.POUNCE_DAMAGE * this.damageMult),
          owner: this.displayName,
        });
        break;
      }
      case 'stink': {
        // Il se secoue : le nuage (vert, sans dégâts) gonfle pendant l'armé.
        const radius = this.frenzy ? FURET.STINK_RADIUS_FRENZY : FURET.STINK_RADIUS;
        const cloud = this.world.spawnHazard({
          kind: 'cloud',
          x: b.x,
          y: b.y,
          radius,
          telegraphMs: FURET.STINK_TELEGRAPH_MS,
          lifeMs: FURET.STINK_LIFE_MS,
          driftAngle: this.world.rng() * Math.PI * 2,
          drift: FURET.STINK_DRIFT,
          burnoutPerS: FURET.STINK_BURNOUT_PER_S,
          owner: this.displayName,
        });
        this.clouds.push(cloud);
        this.world.emit({ type: 'fx', name: 'stink', x: b.x, y: b.y, value: radius });
        break;
      }
      case 'burrow':
        this.telegraph = null;
        break;
    }
  }

  protected override onAttackStart(attack: string): void {
    const now = this.world.now();
    const b = this.body;
    this.landed = false;
    this.world.emit({
      type: 'enemyStrike',
      id: this.id,
      attack,
      x: b.x,
      y: b.y,
      angle: this.facing,
    });
    switch (attack as FuretAttack) {
      case 'bite':
        this.nextBite = now + FURET.BITE_COOLDOWN_MS;
        if (
          circleInArc(
            { x: b.x, y: b.y - HEAD_Y },
            this.facing,
            FURET.BITE_REACH,
            FURET.BITE_ARC_DEG,
            this.world.hero.hurtCircle,
          )
        )
          this.hitHero(FURET.BITE_DAMAGE, FURET.BITE_KNOCKBACK);
        break;
      case 'pounce':
        this.nextPounce = now + FURET.POUNCE_COOLDOWN_MS;
        break;
      case 'stink':
        this.nextStink = now + FURET.STINK_PERIOD_MS;
        break;
      case 'burrow': {
        this.nextBurrow =
          now + (this.frenzy ? FURET.BURROW_COOLDOWN_FRENZY_MS : FURET.BURROW_COOLDOWN_MS);
        this.hidden = true;
        b.enabled = false;
        this.emerge = null;
        const span = FURET.BURROW_HIDDEN_MAX_MS - FURET.BURROW_HIDDEN_MIN_MS;
        this.hiddenFor = FURET.BURROW_HIDDEN_MIN_MS + this.world.rng() * span;
        this.world.emit({ type: 'fx', name: 'burrow', x: b.x, y: b.y });
        this.world.emit({
          type: 'text',
          x: b.x,
          y: b.y,
          text: 'Tri en cours. Veuillez patienter.',
          tone: 'danger',
        });
        break;
      }
    }
  }

  protected updateAttack(attack: string, dtMs: number, elapsed: number): number | null {
    switch (attack as FuretAttack) {
      case 'bite':
        return elapsed >= 150 ? FURET.BITE_RECOVERY_MS : null;
      case 'stink':
        return elapsed >= 200 ? 300 : null;
      case 'pounce': {
        const speed = (FURET.POUNCE_DISTANCE * 1000) / FURET.POUNCE_DURATION_MS;
        this.moveAngle(this.pounceAngle, speed);
        if (elapsed >= FURET.POUNCE_DURATION_MS || (elapsed > 40 && this.body.blocked)) {
          this.halt(true);
          this.flankLeft = FURET.POUNCE_RECOVERY_MS;
          this.makeVulnerable(FURET.POUNCE_RECOVERY_DAMAGE_TAKEN, FURET.POUNCE_RECOVERY_MS);
          this.world.emit({ type: 'dust', x: this.body.x, y: this.body.y, count: 8 });
          return FURET.POUNCE_RECOVERY_MS;
        }
        return null;
      }
      case 'burrow': {
        if (this.landed) return FURET.EMERGE_RECOVERY_MS;
        const h = this.world.hero.body;
        const b = this.body;
        if (!this.emerge) {
          // Sous le quai : il suit le héros (traînée de poussière visible).
          const d = Math.hypot(h.x - b.x, h.y - b.y);
          const step = Math.min(d, (FURET.BURROW_TRAIL_SPEED * dtMs) / 1000);
          if (d > 0) {
            b.x += ((h.x - b.x) / d) * step;
            b.y += ((h.y - b.y) / d) * step;
          }
          if (elapsed >= this.hiddenFor) {
            const tx = h.x;
            const ty = h.y;
            this.emerge = this.world.spawnHazard({
              kind: 'circle',
              x: tx,
              y: ty,
              radius: FURET.EMERGE_RADIUS,
              telegraphMs: FURET.EMERGE_TELEGRAPH_MS,
              damage: Math.round(FURET.EMERGE_DAMAGE * this.damageMult),
              owner: this.displayName,
              skin: 'emerge',
              onImpact: () => {
                this.surface(tx, ty);
              },
            });
          }
        }
        return null;
      }
    }
  }

  /** Il ressort (fin du télégraphe ou débusqué par le Sifflet). */
  private surface(x: number, y: number): void {
    const b = this.body;
    b.x = x;
    b.y = y;
    b.prevX = x;
    b.prevY = y;
    this.hidden = false;
    this.landed = true;
    if (!this.isDead) b.enabled = true;
    this.world.emit({ type: 'fx', name: 'emerge', x, y });
    this.world.emit({ type: 'dust', x, y, count: 14 });
    this.world.emit({ type: 'shake', px: 2, ms: 140 });
  }

  protected override interruptible(hit: EnemyHit): boolean {
    // Le poil hérissé le protège pendant le bond seulement.
    if (this.state === 'attack' && this.currentAttack === 'pounce') return false;
    return super.interruptible(hit);
  }

  public override onHeroSpecial(
    kind: 'whistle' | 'preavis',
    x: number,
    y: number,
    r: number,
  ): void {
    if (this.isDead) return;
    const d = Math.hypot(this.body.x - x, this.body.y - y);
    if (this.hidden) {
      // Débusqué sur place.
      this.emerge?.finish();
      this.emerge = null;
      this.surface(this.body.x, this.body.y);
      this.world.emit({
        type: 'text',
        x: this.body.x,
        y: this.body.y,
        text: 'DÉBUSQUÉ !',
        tone: 'gold',
      });
      this.stun(FURET.WHISTLE_STUN_MS);
      return;
    }
    if (kind === 'whistle' && d <= r + 60) this.stun(FURET.WHISTLE_STUN_MS);
  }

  public override onPerfectDash(x: number, y: number): void {
    // Dash parfait sur le Bond : retourné sur le dos.
    if (this.state !== 'attack' || this.currentAttack !== 'pounce') return;
    if (Math.hypot(this.body.x - x, this.body.y - y) > 60) return;
    this.halt(true);
    this.flankLeft = 1000;
    this.stun(1000);
  }

  protected override onDeath(): void {
    this.hidden = false;
    this.emerge?.finish();
    for (const c of this.clouds) c.finish();
    this.clouds.length = 0;
    // « Bol d'air ».
    this.world.hero.addBurnout(FURET.DEATH_BURNOUT);
    this.world.emit({
      type: 'text',
      x: this.body.x,
      y: this.body.y,
      text: 'Tri… suspendu… · Bol d’air',
      tone: 'gold',
    });
  }
}
