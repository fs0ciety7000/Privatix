import type { EnemyKind } from '@/config/balance';
import { BURNOUT, ENEMY_RULES, FEEL } from '@/config/balance';
import type { Wave } from '@/systems/procedural/Waves';
import { shouldSendNextWave, wavesFor } from '@/systems/procedural/Waves';
import type { SimWorld } from '@/sim/SimWorld';

/** Délai avant la première vague d'une salle (version Phaser : 700 ms). */
const FIRST_WAVE_DELAY_MS = 700;
/** Pause entre deux « salles » de démonstration, une fois la précédente nettoyée. */
const NEXT_ROOM_DELAY_MS = 2600;

/** Ennemis portés dans la simulation 3D. Les autres types attendent leur port (J2 suite, J7). */
const PORTED: ReadonlySet<EnemyKind> = new Set<EnemyKind>(['consultant']);

interface PendingSpawn {
  readonly at: number;
  readonly kind: EnemyKind;
}

/**
 * Directeur de vagues (extrait du flux de `RunScene`, en pur) : vagues du GDD (`wavesFor`), envoi de la
 * vague suivante (`shouldSendNextWave`), apparitions échelonnées loin du héros, nettoyage de salle.
 * Tant que `RunDirector` (J4) n'existe pas, il enchaîne les « salles » dans le même décor, en montant
 * la difficulté (`r` + 1 à chaque salle nettoyée).
 */
export class WaveDirector {
  /** Indice de salle comptée (GDD § 3.2). */
  public r = 1;
  private waves: Wave[] = [];
  private waveIndex = 0;
  private waveSize = 0;
  private killedInWave = 0;
  private pending: PendingSpawn[] = [];
  private cleared = false;
  private startAt = 0;
  private nextRoomAt = -1;

  public constructor(
    private readonly world: SimWorld,
    public enabled = true,
  ) {}

  public get roomCleared(): boolean {
    return this.cleared;
  }

  public get waveNumber(): number {
    return this.waveIndex;
  }

  public get waveCount(): number {
    return this.waves.length;
  }

  /** Prépare les vagues de la salle `r`. */
  public startRoom(r: number): void {
    const run = this.world.run;
    this.r = r;
    this.waves = wavesFor(
      { r, elite: false, budgetMult: run.shift.budgetMult, extraDronesPerWave: 0 },
      this.world.rng,
    ).map((w) => w.map((k) => (PORTED.has(k) ? k : 'consultant')));
    this.waveIndex = 0;
    this.waveSize = 0;
    this.killedInWave = 0;
    this.pending = [];
    this.cleared = false;
    this.startAt = this.world.now() + FIRST_WAVE_DELAY_MS;
    this.nextRoomAt = -1;
  }

  public onKilled(): void {
    this.killedInWave += 1;
  }

  public update(): void {
    if (!this.enabled) return;
    const now = this.world.now();
    for (let i = this.pending.length - 1; i >= 0; i -= 1) {
      const p = this.pending[i];
      if (!p || p.at > now) continue;
      this.pending.splice(i, 1);
      this.spawnOne(p.kind);
    }
    if (this.cleared) {
      if (this.nextRoomAt >= 0 && now >= this.nextRoomAt) this.startRoom(this.r + 1);
      return;
    }
    if (this.pending.length > 0 || now < this.startAt) return;
    const alive = this.world.livingEnemies().length;
    if (this.waveIndex < this.waves.length) {
      if (shouldSendNextWave(alive, this.waveSize, this.killedInWave)) this.sendWave();
      return;
    }
    if (alive === 0 && this.waves.length > 0) this.clearRoom();
  }

  /** Le prochain mort est-il le dernier de la salle ? (ralenti du dernier coup) */
  public isLastKill(): boolean {
    return (
      this.waveIndex >= this.waves.length &&
      this.pending.length === 0 &&
      this.world.livingEnemies().length === 0
    );
  }

  private sendWave(): void {
    const wave = this.waves[this.waveIndex];
    if (!wave) return;
    this.waveIndex += 1;
    this.waveSize = wave.length;
    this.killedInWave = 0;
    const now = this.world.now();
    wave.forEach((kind, i) => {
      this.pending.push({ at: now + i * ENEMY_RULES.SPAWN_STAGGER_MS, kind });
    });
    this.world.emit({
      type: 'wave',
      index: this.waveIndex,
      count: this.waves.length,
      room: this.r,
    });
  }

  private spawnOne(kind: EnemyKind): void {
    const hero = this.world.hero.body;
    const points = this.world.arena.spawnPoints(hero, ENEMY_RULES.SPAWN_MIN_DIST_PX);
    const at =
      points[Math.floor(this.world.rng() * points.length)] ?? this.world.arena.playerSpawn;
    this.world.spawnEnemy(kind, at.x, at.y);
  }

  private clearRoom(): void {
    this.cleared = true;
    const run = this.world.run;
    this.world.time.slowmo(FEEL.LAST_KILL_SLOWMO, FEEL.LAST_KILL_SLOWMO_MS, 250);
    this.world.emit({ type: 'shake', px: FEEL.LAST_KILL_SHAKE_PX, ms: FEEL.LAST_KILL_SHAKE_MS });
    run.burnout.add(BURNOUT.PER_ROOM_CLEARED);
    this.world.emit({ type: 'roomCleared', room: this.r });
    this.nextRoomAt = this.world.now() + NEXT_ROOM_DELAY_MS;
  }
}
