import { VANDERSLIDE } from '@/config/balance';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { blocksWalker, tileAt } from '@/systems/procedural/RoomLayout';
import { pick } from '@/utils/rng';
import { PHASE_LINES } from '@/sim/biomes';
import type { SimWorld } from '@/sim/SimWorld';
import type { PhasedEnemy } from '@/sim/enemies/EnemySim';
import { EnemySim } from '@/sim/enemies/EnemySim';

export type DeckPattern = 'bullets' | 'charts' | 'copy' | 'report';

const COPY_WINDUP_MS = 600;
const PHASE2_TEMPO = 0.85;

/**
 * Boss du biome 3, **version de travail** : Gontran Vanderslide (LORE § 7.3). Placeholder cohérent du
 * GDD § 7.9 en attendant la jauge de signature, les Preuves en main et la Salle du Conseil :
 * - Phase 1 « Méga-Deck 2032 » : bullet points (3 lignes qui balaient la salle, un trou par ligne),
 *   piliers-graphiques (3 cercles), « Je vous mets en copie » (2 Consultants) ;
 * - Phase 2 « Conseil d'Administration en visio » (50 %) : télégraphes ×0,85, Reporting géant ;
 * - Coup final sous 5 % : « Mais concrètement, sur le terrain, ça donne quoi ? » — il reste sans voix,
 *   étourdi 6 s, et encaisse ×4.
 */
export class VanderslideSim extends EnemySim implements PhasedEnemy {
  public phase = 1;
  public transitionLeft = 0;
  public finalBlow = false;
  private nextPatternAt = 0;
  private readonly cooldowns = new Map<DeckPattern, number>();

  public constructor(world: SimWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'vanderslide', x, y, scale);
    this.nextPatternAt = world.now() + 1500;
  }

  public override isHittable(): boolean {
    return super.isHittable() && this.transitionLeft <= 0;
  }

  private get tempo(): number {
    return this.phase >= 2 ? PHASE2_TEMPO : 1;
  }

  public override tick(dtMs: number): void {
    super.tick(dtMs);
    if (this.isDead) return;
    if (this.transitionLeft > 0) {
      this.transitionLeft -= dtMs;
      this.halt();
    }
  }

  private ready(p: DeckPattern): boolean {
    return (this.cooldowns.get(p) ?? 0) <= this.world.now();
  }

  protected think(): string | null {
    const now = this.world.now();
    const d = this.distToHero();
    const h = this.world.hero.body;
    this.facing = this.angleToHero();
    if (this.transitionLeft > 0 || this.finalBlow) return null;
    if (d > VANDERSLIDE.KEEP_PX + 40) this.moveToward(h.x, h.y);
    else if (d < VANDERSLIDE.KEEP_PX - 50) this.moveAngle(this.facing + Math.PI, this.speed);
    else this.moveAngle(this.facing + Math.PI / 2, this.speed * 0.5);
    this.facing = this.angleToHero();
    if (now < this.nextPatternAt) return null;
    const options: DeckPattern[] = [];
    if (this.ready('bullets')) options.push('bullets', 'bullets');
    if (this.ready('charts')) options.push('charts', 'charts');
    if (this.ready('copy') && this.consultants() < VANDERSLIDE.COPY_MAX_ALIVE) options.push('copy');
    if (this.phase >= 2 && this.ready('report')) options.push('report');
    return pick(this.world.rng, options) ?? null;
  }

  private consultants(): number {
    return this.world.livingEnemies().filter((e) => e.kind === 'consultant').length;
  }

  protected tokenFor(): TokenKind | null {
    return null;
  }

  protected windupMs(attack: string): number {
    switch (attack as DeckPattern) {
      case 'bullets':
        return Math.max(800, VANDERSLIDE.BULLETS_TELEGRAPH_MS * this.tempo);
      case 'charts':
        return Math.max(700, VANDERSLIDE.CHART_TELEGRAPH_MS * this.tempo);
      case 'copy':
        return COPY_WINDUP_MS;
      case 'report':
        return 500;
    }
  }

  protected onWindup(attack: string): void {
    const h = this.world.hero.body;
    const arena = this.world.arena;
    const rng = this.world.rng;
    this.telegraph = null;
    switch (attack as DeckPattern) {
      case 'bullets': {
        const tele = this.windupMs('bullets');
        const x0 = arena.tileSize * 1.5;
        const x1 = arena.widthPx - arena.tileSize * 1.5;
        for (let i = 0; i < VANDERSLIDE.BULLET_LINES; i += 1) {
          const y = h.y + (i - (VANDERSLIDE.BULLET_LINES - 1) / 2) * VANDERSLIDE.BULLET_SPACING;
          if (y < arena.tileSize * 2.5 || y > arena.heightPx - arena.tileSize * 1.5) continue;
          const gap = VANDERSLIDE.BULLET_GAP / (x1 - x0);
          const from = 0.08 + rng() * (0.84 - gap);
          this.world.spawnHazard({
            kind: 'line',
            x0,
            y0: y,
            x1,
            y1: y,
            width: VANDERSLIDE.BULLET_WIDTH,
            telegraphMs: tele,
            lingerMs: 240,
            tickMs: 1,
            once: true,
            gapFrom: from,
            gapTo: from + gap,
            damage: Math.round(VANDERSLIDE.BULLET_DAMAGE * this.damageMult),
            owner: this.displayName,
            skin: 'bullet',
          });
        }
        break;
      }
      case 'charts': {
        const tele = this.windupMs('charts');
        for (let i = 0; i < VANDERSLIDE.CHARTS; i += 1) {
          const a = rng() * Math.PI * 2;
          const r = i === 0 ? 0 : 60 + rng() * 50;
          const x = h.x + Math.cos(a) * r;
          const y = h.y + Math.sin(a) * r;
          const t = tileAt(
            arena.layout,
            Math.floor(x / arena.tileSize),
            Math.floor(y / arena.tileSize),
          );
          if (i > 0 && blocksWalker(t)) continue;
          this.world.spawnHazard({
            kind: 'circle',
            x,
            y,
            radius: VANDERSLIDE.CHART_RADIUS,
            telegraphMs: tele,
            damage: Math.round(VANDERSLIDE.CHART_DAMAGE * this.damageMult),
            owner: this.displayName,
            skin: 'chart',
          });
        }
        break;
      }
      default:
        break;
    }
  }

  protected override onAttackStart(attack: string): void {
    const now = this.world.now();
    const b = this.body;
    const pattern = attack as DeckPattern;
    const cd: Record<DeckPattern, number> = {
      bullets: VANDERSLIDE.BULLET_COOLDOWN_MS,
      charts: VANDERSLIDE.CHART_COOLDOWN_MS,
      copy: VANDERSLIDE.COPY_COOLDOWN_MS,
      report: VANDERSLIDE.REPORT_COOLDOWN_MS,
    };
    this.cooldowns.set(pattern, now + cd[pattern] * this.tempo);
    this.world.emit({
      type: 'enemyStrike',
      id: this.id,
      attack,
      x: b.x,
      y: b.y,
      angle: this.facing,
    });
    if (pattern === 'copy') {
      for (let i = 0; i < VANDERSLIDE.COPY_COUNT; i += 1) {
        const a = this.world.rng() * Math.PI * 2;
        this.world.spawnEnemy('consultant', b.x + Math.cos(a) * 60, b.y + Math.sin(a) * 44);
      }
      this.world.emit({
        type: 'text',
        x: b.x,
        y: b.y - 50,
        text: 'Je vous mets en copie.',
        tone: 'danger',
      });
    } else if (pattern === 'report') {
      this.world.emit({
        type: 'text',
        x: b.x,
        y: b.y - 50,
        text: 'REPORTING DU CONSEIL',
        tone: 'danger',
      });
      this.world.spawnHazard({
        kind: 'ring',
        x: b.x,
        y: b.y,
        maxRadius: VANDERSLIDE.REPORT_RADIUS,
        thickness: VANDERSLIDE.REPORT_THICKNESS,
        telegraphMs: VANDERSLIDE.REPORT_TELEGRAPH_MS,
        expandMs: VANDERSLIDE.REPORT_EXPAND_MS,
        damage: Math.round(VANDERSLIDE.REPORT_DAMAGE * this.damageMult),
        owner: this.displayName,
      });
    }
  }

  protected updateAttack(attack: string, _dt: number, elapsed: number): number | null {
    const gap = (VANDERSLIDE.PATTERN_GAP_MS[this.phase - 1] ?? 1500) * this.tempo;
    const done = (recovery: number): number => {
      this.nextPatternAt = this.world.now() + gap;
      return recovery;
    };
    switch (attack as DeckPattern) {
      case 'report':
        return elapsed >= VANDERSLIDE.REPORT_TELEGRAPH_MS ? done(500) : null;
      default:
        return elapsed >= 200 ? done(600) : null;
    }
  }

  protected override interruptible(): boolean {
    return false;
  }

  protected override onHurt(): void {
    const ratio = this.hp / this.maxHp;
    if (!this.finalBlow && ratio <= VANDERSLIDE.FINAL_AT) {
      this.finalBlow = true;
      this.makeVulnerable(3, VANDERSLIDE.FINAL_STUN_MS);
      this.stun(VANDERSLIDE.FINAL_STUN_MS);
      this.world.time.slowmo(0.4, 900, 300);
      this.world.emit({ type: 'fx', name: 'finalBlow', x: this.body.x, y: this.body.y });
      this.world.emit({
        type: 'bossLine',
        speaker: 'Héros',
        text: 'Mais concrètement, sur le terrain, ça donne quoi ?',
        fictive: false,
      });
      return;
    }
    if (this.phase === 1 && ratio <= VANDERSLIDE.PHASE_AT) {
      this.phase = 2;
      this.transitionLeft = VANDERSLIDE.PHASE_TRANSITION_MS;
      this.telegraph = null;
      this.world.emit({ type: 'bossPhase', phase: 2, title: 'CONSEIL D’ADMINISTRATION EN VISIO' });
      const line = PHASE_LINES.vanderslide?.[0];
      if (line) this.world.emit({ type: 'bossLine', ...line });
      this.nextPatternAt = this.world.now() + VANDERSLIDE.PHASE_TRANSITION_MS + 500;
      this.fsm.request({ to: 'recover', payload: { ms: VANDERSLIDE.PHASE_TRANSITION_MS } });
    }
  }

  protected override onDeath(): void {
    this.world.emit({ type: 'explosion', x: this.body.x, y: this.body.y, scale: 1.4 });
  }
}
