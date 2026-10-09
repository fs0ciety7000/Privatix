import { FLUIDIFIEUR } from '@/config/balance';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { distanceToSegment } from '@/systems/combat/geometry';
import { blocksWalker, tileAt } from '@/systems/procedural/RoomLayout';
import { pick } from '@/utils/rng';
import { PHASE_LINES } from '@/sim/biomes';
import type { SimWorld } from '@/sim/SimWorld';
import type { PhasedEnemy } from '@/sim/enemies/EnemySim';
import { EnemySim } from '@/sim/enemies/EnemySim';

export type FluidPattern = 'glide' | 'slabs' | 'binder' | 'swap' | 'org';

/** Page du Règlement emportée par le vent (lue par la vue). */
export interface RulePage {
  x: number;
  y: number;
  readonly ax: number;
  readonly ay: number;
  readonly seed: number;
  taken: boolean;
}

const SLABS_WINDUP_MS = 600;
const ORG_WINDUP_MS = 700;
const GLIDE_PAUSE_MS = 320;

/**
 * Élite majeur du biome 2 : le Fluidifieur, régisseur de l'inauguration (LORE § 7.2, GDD § 7.10),
 * Salle gardée de la salle 8 (le nœud sous le grand arc, bords sur le vide).
 * - Phase 1 « Mobilité interne » : glissade en chaise à roulettes (couloir 900 ms, 2 rebonds re-visés,
 *   chacun télégraphié), changement de roulement la veille (damier de dalles qui s'ouvrent sur le vide
 *   4 s, télégraphe 1,5 s), classeur « Congé en cours de validation » (projectile lent) ;
 * - Phase 2 « Plan de transformation » (sous 50 %) : mutation d'office (ligne magenta 1 s puis échange
 *   de positions) et organigramme (2 Consultants).
 * Faiblesse « Le Règlement » : 3 pages volent ; les 3 attrapées, le Sifflet devient « Article 47,
 * alinéa 3 » (étourdi 4 s, ×2 dégâts). Sifflet ordinaire : étourdi 0,6 s.
 */
export class FluidifieurSim extends EnemySim implements PhasedEnemy {
  public phase = 1;
  public transitionLeft = 0;
  public readonly pages: RulePage[] = [];
  /** Les 3 pages attrapées : le prochain Sifflet est « Article 47, alinéa 3 ». */
  public reglementReady = false;
  private nextPatternAt = 0;
  private readonly cooldowns = new Map<FluidPattern, number>();
  private glideAngle = 0;
  private glideSegment = 0;
  private glideSegStart = 0;
  private glidePauseLeft = 0;
  private glideHit = false;
  private swapLine = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private pagesRespawnAt = 0;

  public constructor(world: SimWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'fluidifieur', x, y, scale);
    const now = world.now();
    this.nextPatternAt = now + 1400;
    this.cooldowns.set('slabs', now + 3500);
    this.scatterPages();
  }

  public override isHittable(): boolean {
    return super.isHittable() && this.transitionLeft <= 0;
  }

  /** En pleine glissade (la vue joue la chaise lancée). */
  public get gliding(): boolean {
    return this.state === 'attack' && this.currentAttack === 'glide';
  }

  private scatterPages(): void {
    const arena = this.world.arena;
    const rng = this.world.rng;
    this.pages.length = 0;
    for (let i = 0; i < FLUIDIFIEUR.PAGES; i += 1) {
      for (let guard = 0; guard < 40; guard += 1) {
        const x = 48 + rng() * (arena.widthPx - 96);
        const y = 48 + rng() * (arena.heightPx - 96);
        const t = tileAt(
          arena.layout,
          Math.floor(x / arena.tileSize),
          Math.floor(y / arena.tileSize),
        );
        if (blocksWalker(t)) continue;
        this.pages.push({ x, y, ax: x, ay: y, seed: rng() * 10, taken: false });
        break;
      }
    }
  }

  public override tick(dtMs: number): void {
    super.tick(dtMs);
    if (this.isDead) return;
    if (this.transitionLeft > 0) {
      this.transitionLeft -= dtMs;
      this.halt();
    }
    this.updatePages();
  }

  private updatePages(): void {
    const now = this.world.now();
    const t = now / 1000;
    const h = this.world.hero.body;
    for (const p of this.pages) {
      if (p.taken) continue;
      // Les pages flottent au vent autour de leur point d'ancrage.
      p.x = p.ax + Math.sin(t * 0.9 + p.seed) * FLUIDIFIEUR.PAGE_DRIFT;
      p.y = p.ay + Math.cos(t * 0.7 + p.seed * 1.3) * FLUIDIFIEUR.PAGE_DRIFT * 0.6;
      if (Math.hypot(h.x - p.x, h.y - p.y) <= FLUIDIFIEUR.PAGE_RADIUS + 6) {
        p.taken = true;
        const n = this.pages.filter((q) => q.taken).length;
        this.world.emit({ type: 'fx', name: 'pageTaken', x: p.x, y: p.y, value: n });
        this.world.emit({
          type: 'text',
          x: p.x,
          y: p.y,
          text: `Règlement : page ${String(n)}/${String(FLUIDIFIEUR.PAGES)}`,
          tone: 'gold',
        });
        if (n >= FLUIDIFIEUR.PAGES) {
          this.reglementReady = true;
          this.world.emit({
            type: 'notice',
            text: 'Article 47, alinéa 3 : prêt. Coup de sifflet !',
            tone: 'gold',
          });
        }
      }
    }
    if (!this.reglementReady && this.pages.every((p) => p.taken) && this.pagesRespawnAt === 0)
      this.pagesRespawnAt = now + 15000;
    if (this.pagesRespawnAt > 0 && now >= this.pagesRespawnAt && !this.reglementReady) {
      this.pagesRespawnAt = 0;
      this.scatterPages();
    }
  }

  private ready(p: FluidPattern): boolean {
    return (this.cooldowns.get(p) ?? 0) <= this.world.now();
  }

  protected think(): string | null {
    const now = this.world.now();
    const d = this.distToHero();
    const h = this.world.hero.body;
    this.facing = this.angleToHero();
    if (this.transitionLeft > 0) return null;
    if (d > FLUIDIFIEUR.KEEP_PX + 40) this.moveToward(h.x, h.y);
    else if (d < FLUIDIFIEUR.KEEP_PX - 40) this.moveAngle(this.facing + Math.PI, this.speed);
    else this.moveAngle(this.facing - Math.PI / 2, this.speed * 0.6);
    this.facing = this.angleToHero();
    if (now < this.nextPatternAt) return null;
    const options: FluidPattern[] = [];
    if (this.ready('glide')) options.push('glide', 'glide');
    if (this.ready('slabs')) options.push('slabs');
    if (this.ready('binder')) options.push('binder');
    if (this.phase >= 2) {
      if (this.ready('swap')) options.push('swap', 'swap');
      if (this.ready('org') && this.consultants() < FLUIDIFIEUR.ORG_MAX_ALIVE) options.push('org');
    }
    return pick(this.world.rng, options) ?? null;
  }

  private consultants(): number {
    return this.world.livingEnemies().filter((e) => e.kind === 'consultant').length;
  }

  protected tokenFor(): TokenKind | null {
    return null;
  }

  protected windupMs(attack: string): number {
    switch (attack as FluidPattern) {
      case 'glide':
        return FLUIDIFIEUR.GLIDE_TELEGRAPH_MS;
      case 'slabs':
        return SLABS_WINDUP_MS;
      case 'binder':
        return FLUIDIFIEUR.BINDER_TELEGRAPH_MS;
      case 'swap':
        return FLUIDIFIEUR.SWAP_TELEGRAPH_MS;
      case 'org':
        return ORG_WINDUP_MS;
    }
  }

  private glideTelegraph(): void {
    this.telegraph = {
      kind: 'line',
      x: this.body.x,
      y: this.body.y,
      angle: this.glideAngle,
      length: FLUIDIFIEUR.GLIDE_DISTANCE,
      width: FLUIDIFIEUR.GLIDE_WIDTH,
    };
  }

  protected onWindup(attack: string): void {
    const b = this.body;
    const h = this.world.hero.body;
    this.facing = this.angleToHero();
    switch (attack as FluidPattern) {
      case 'glide':
        this.glideAngle = this.facing;
        this.glideTelegraph();
        break;
      case 'slabs': {
        this.telegraph = null;
        // Damier de dalles autour du héros (une case sur deux).
        const s = FLUIDIFIEUR.SLABS_HALF * 2;
        const cells: [number, number][] = [
          [0, 0],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
          [2, 0],
          [-2, 0],
          [0, 2],
          [0, -2],
        ];
        for (const [cx, cy] of cells.slice(0, FLUIDIFIEUR.SLABS_COUNT + 1)) {
          this.world.spawnHazard({
            kind: 'square',
            x: Math.round(h.x / s) * s + cx * s,
            y: Math.round(h.y / s) * s + cy * s,
            half: FLUIDIFIEUR.SLABS_HALF - 1,
            telegraphMs: FLUIDIFIEUR.SLABS_TELEGRAPH_MS,
            damage: Math.round(FLUIDIFIEUR.SLABS_DAMAGE * this.damageMult),
            owner: this.displayName,
            lingerMs: FLUIDIFIEUR.SLABS_OPEN_MS,
            voidFall: true,
            skin: 'slab',
          });
        }
        this.world.emit({
          type: 'text',
          x: b.x,
          y: b.y - 50,
          text: 'Changement de roulement !',
          tone: 'danger',
        });
        break;
      }
      case 'binder':
        this.telegraph = {
          kind: 'line',
          x: b.x,
          y: b.y,
          angle: this.facing,
          length: 200,
          width: FLUIDIFIEUR.BINDER_RADIUS * 2 + 6,
        };
        break;
      case 'swap': {
        const len = Math.max(30, Math.hypot(h.x - b.x, h.y - b.y));
        this.swapLine = { x0: b.x, y0: b.y, x1: h.x, y1: h.y };
        this.telegraph = {
          kind: 'line',
          x: b.x,
          y: b.y,
          angle: this.facing,
          length: len,
          width: FLUIDIFIEUR.SWAP_WIDTH,
        };
        break;
      }
      case 'org':
        this.telegraph = null;
        break;
    }
  }

  protected override onAttackStart(attack: string): void {
    const now = this.world.now();
    const b = this.body;
    const pattern = attack as FluidPattern;
    const cd: Record<FluidPattern, number> = {
      glide: 4500,
      slabs: FLUIDIFIEUR.SLABS_COOLDOWN_MS,
      binder: FLUIDIFIEUR.BINDER_COOLDOWN_MS,
      swap: FLUIDIFIEUR.SWAP_COOLDOWN_MS,
      org: FLUIDIFIEUR.ORG_COOLDOWN_MS,
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
      case 'glide':
        this.glideSegment = 0;
        this.glideSegStart = 0;
        this.glidePauseLeft = 0;
        this.glideHit = false;
        this.telegraph = null;
        break;
      case 'binder':
        this.world.spawnProjectile({
          x: b.x,
          y: b.y,
          angle: this.facing,
          speed: FLUIDIFIEUR.BINDER_SPEED,
          damage: Math.round(FLUIDIFIEUR.BINDER_DAMAGE * this.damageMult),
          lifeMs: 4500,
          radius: FLUIDIFIEUR.BINDER_RADIUS,
          owner: 'Le classeur « Roulements 2027 »',
          height: 16,
        });
        break;
      case 'swap': {
        const l = this.swapLine;
        const hc = this.world.hero.hurtCircle;
        if (
          distanceToSegment(hc, { x: l.x0, y: l.y0 }, { x: l.x1, y: l.y1 }) <=
          FLUIDIFIEUR.SWAP_WIDTH / 2 + hc.r
        ) {
          // Mutation d'office : échange de positions.
          const hb = this.world.hero.body;
          const hx = hb.x;
          const hy = hb.y;
          hb.x = b.x;
          hb.y = b.y;
          hb.prevX = b.x;
          hb.prevY = b.y;
          b.x = hx;
          b.y = hy;
          b.prevX = hx;
          b.prevY = hy;
          this.hitHero(FLUIDIFIEUR.SWAP_DAMAGE, 0);
          this.world.emit({ type: 'fx', name: 'swap', x: hx, y: hy });
          this.world.emit({
            type: 'text',
            x: hx,
            y: hy,
            text: 'MUTATION D’OFFICE',
            tone: 'danger',
          });
        }
        break;
      }
      case 'org': {
        const arena = this.world.arena;
        for (let i = 0; i < FLUIDIFIEUR.ORG_COUNT; i += 1) {
          const a = this.world.rng() * Math.PI * 2;
          const x = b.x + Math.cos(a) * 56;
          const y = b.y + Math.sin(a) * 40;
          const t = tileAt(
            arena.layout,
            Math.floor(x / arena.tileSize),
            Math.floor(y / arena.tileSize),
          );
          if (!blocksWalker(t)) this.world.spawnEnemy('consultant', x, y);
        }
        this.world.emit({
          type: 'text',
          x: b.x,
          y: b.y - 50,
          text: 'L’organigramme, c’est moi.',
          tone: 'danger',
        });
        break;
      }
      default:
        break;
    }
  }

  protected updateAttack(attack: string, dtMs: number, elapsed: number): number | null {
    const gap = FLUIDIFIEUR.PATTERN_GAP_MS[this.phase - 1] ?? 1400;
    const done = (recovery: number): number => {
      this.nextPatternAt = this.world.now() + gap;
      return recovery;
    };
    switch (attack as FluidPattern) {
      case 'glide':
        return this.updateGlide(dtMs, elapsed) ? done(FLUIDIFIEUR.GLIDE_RECOVERY_MS) : null;
      case 'slabs':
        return elapsed >= 200 ? done(500) : null;
      case 'binder':
        return elapsed >= 200 ? done(600) : null;
      case 'swap':
        return elapsed >= 150 ? done(700) : null;
      case 'org':
        return elapsed >= 200 ? done(500) : null;
    }
  }

  /** Glissade : 1 + 2 segments ; entre deux, une pause télégraphiée et un nouveau cap. */
  private updateGlide(dtMs: number, elapsed: number): boolean {
    if (this.glidePauseLeft > 0) {
      this.halt(true);
      this.glidePauseLeft -= dtMs;
      if (this.glidePauseLeft <= 0) {
        this.telegraph = null;
        this.glideSegStart = elapsed;
        this.glideHit = false;
      }
      return false;
    }
    this.moveAngle(this.glideAngle, FLUIDIFIEUR.GLIDE_SPEED);
    this.facing = this.glideAngle;
    const h = this.world.hero.body;
    if (!this.glideHit && Math.hypot(h.x - this.body.x, h.y - this.body.y) < 26) {
      this.glideHit = true;
      this.hitHero(FLUIDIFIEUR.GLIDE_DAMAGE, 40);
    }
    const segMs = (FLUIDIFIEUR.GLIDE_DISTANCE * 1000) / FLUIDIFIEUR.GLIDE_SPEED;
    const t = elapsed - this.glideSegStart;
    if (t >= segMs || (t > 60 && this.body.blocked)) {
      this.halt(true);
      if (this.glideSegment >= FLUIDIFIEUR.GLIDE_BOUNCES) return true;
      this.glideSegment += 1;
      // Rebond : nouveau cap vers le héros, annoncé par un couloir magenta.
      this.glideAngle = this.angleToHero();
      this.glidePauseLeft = GLIDE_PAUSE_MS;
      this.glideTelegraph();
    }
    return false;
  }

  protected override interruptible(): boolean {
    return false;
  }

  public override onHeroSpecial(
    kind: 'whistle' | 'preavis',
    x: number,
    y: number,
    r: number,
  ): void {
    if (this.isDead || kind !== 'whistle') return;
    if (this.reglementReady) {
      this.reglementReady = false;
      this.pagesRespawnAt = this.world.now() + 15000;
      this.makeVulnerable(FLUIDIFIEUR.REGLEMENT_DAMAGE_TAKEN, FLUIDIFIEUR.REGLEMENT_STUN_MS);
      this.nextPatternAt = this.world.now() + FLUIDIFIEUR.REGLEMENT_STUN_MS + 400;
      this.stun(FLUIDIFIEUR.REGLEMENT_STUN_MS);
      this.world.emit({ type: 'fx', name: 'reglement', x: this.body.x, y: this.body.y });
      this.world.emit({
        type: 'bossLine',
        speaker: 'Héros',
        text: 'Article 47, alinéa 3 : préavis de sept jours.',
        fictive: false,
      });
      this.world.emit({
        type: 'text',
        x: this.body.x,
        y: this.body.y - 50,
        text: 'Il y a un alinéa 3 ?!',
        tone: 'gold',
      });
      return;
    }
    if (Math.hypot(this.body.x - x, this.body.y - y) <= r + 40)
      this.stun(FLUIDIFIEUR.WHISTLE_STUN_MS);
  }

  protected override onHurt(): void {
    if (this.phase !== 1 || this.hp > this.maxHp * FLUIDIFIEUR.PHASE_AT) return;
    this.phase = 2;
    this.transitionLeft = FLUIDIFIEUR.PHASE_TRANSITION_MS;
    this.telegraph = null;
    this.world.emit({ type: 'bossPhase', phase: 2, title: 'PLAN DE TRANSFORMATION' });
    const line = PHASE_LINES.fluidifieur?.[0];
    if (line) this.world.emit({ type: 'bossLine', ...line });
    this.nextPatternAt = this.world.now() + FLUIDIFIEUR.PHASE_TRANSITION_MS + 500;
    this.fsm.request({ to: 'recover', payload: { ms: FLUIDIFIEUR.PHASE_TRANSITION_MS } });
  }

  protected override onDeath(): void {
    for (const p of this.pages) p.taken = true;
    this.world.emit({
      type: 'text',
      x: this.body.x,
      y: this.body.y - 50,
      text: '… Sept jours ? Personne ne lit jamais l’alinéa 3.',
      tone: 'gold',
    });
  }
}
