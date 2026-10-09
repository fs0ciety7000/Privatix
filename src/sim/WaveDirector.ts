import type { EnemyKind } from '@/config/balance';
import { ENEMY_RULES } from '@/config/balance';
import type { Wave } from '@/systems/procedural/Waves';
import { shouldSendNextWave } from '@/systems/procedural/Waves';
import type { Rng } from '@/utils/rng';
import type { SimWorld } from '@/sim/SimWorld';

/** Délai avant la première vague d'une salle (version Phaser : 700 ms). */
export const FIRST_WAVE_DELAY_MS = 700;

interface PendingSpawn {
  readonly at: number;
  readonly kind: EnemyKind;
}

/**
 * Directeur de vagues d'une salle de combat (extrait de `RunScene`, en pur) : vagues du GDD
 * (`wavesFor`, tirées par `RunDirector`), envoi de la vague suivante (`shouldSendNextWave`),
 * apparitions échelonnées loin du héros. Signale la salle vidée à `onCleared`.
 */
export class WaveDirector {
  private waves: Wave[] = [];
  private waveIndex = 0;
  private waveSize = 0;
  private killedInWave = 0;
  private pending: PendingSpawn[] = [];
  private active = false;
  private done = false;
  private startAt = 0;
  private rng: Rng;

  public constructor(
    private readonly world: SimWorld,
    private readonly onCleared: () => void,
  ) {
    this.rng = world.rng;
  }

  public get waveNumber(): number {
    return this.waveIndex;
  }

  public get waveCount(): number {
    return this.waves.length;
  }

  /** Vagues en cours (salle de combat non vidée). */
  public get running(): boolean {
    return this.active && !this.done;
  }

  /** Prépare les vagues d'une salle ; la première part après `FIRST_WAVE_DELAY_MS`. */
  public start(waves: Wave[], rng: Rng): void {
    this.waves = waves;
    this.rng = rng;
    this.waveIndex = 0;
    this.waveSize = 0;
    this.killedInWave = 0;
    this.pending = [];
    this.active = waves.length > 0;
    this.done = false;
    this.startAt = this.world.now() + FIRST_WAVE_DELAY_MS;
  }

  /** Salle sans vagues (repos, boutique, boss, transition). */
  public stop(): void {
    this.waves = [];
    this.pending = [];
    this.active = false;
    this.done = false;
  }

  public onKilled(): void {
    this.killedInWave += 1;
  }

  public update(): void {
    if (!this.active || this.done) return;
    const now = this.world.now();
    for (let i = this.pending.length - 1; i >= 0; i -= 1) {
      const p = this.pending[i];
      if (!p || p.at > now) continue;
      this.pending.splice(i, 1);
      this.spawnOne(p.kind);
    }
    if (this.pending.length > 0 || now < this.startAt) return;
    const alive = this.world.livingEnemies().length;
    if (this.waveIndex < this.waves.length) {
      if (shouldSendNextWave(alive, this.waveSize, this.killedInWave)) this.sendWave();
      return;
    }
    if (alive === 0) {
      this.done = true;
      this.onCleared();
    }
  }

  /** Le prochain mort est-il le dernier de la salle ? (ralenti du dernier coup) */
  public isLastKill(): boolean {
    return (
      this.running &&
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
      room: this.world.run.room,
    });
  }

  private spawnOne(kind: EnemyKind): void {
    const hero = this.world.hero.body;
    const points = this.world.arena.spawnPoints(hero, ENEMY_RULES.SPAWN_MIN_DIST_PX);
    const at = points[Math.floor(this.rng() * points.length)] ?? this.world.arena.playerSpawn;
    this.world.spawnEnemy(kind, at.x, at.y);
  }
}
