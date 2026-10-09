import type * as THREE from 'three';
import type { Bursts, DamageNumbers, Ghosts, Puffs, Rings, Shake, Smear, Sparks } from './fx';

export interface HitShape {
  kind: 'arc' | 'rect';
  origin: THREE.Vector3;
  /** angle de visée (radians, 0 = +Z, sens trigonométrique vers +X) */
  angle: number;
  radius: number;
  /** ouverture totale de l'arc (radians) */
  spread: number;
  /** rectangle : de `near` à `far` devant, demi-largeur `half` */
  near: number;
  far: number;
  half: number;
}

export interface HitInfo {
  damage: number;
  knockback: number;
  stun: number;
  heavy: boolean;
  crit: boolean;
}

/** Ennemi frappable (consultant, Discosaure). */
export interface Foe {
  readonly pos: THREE.Vector3;
  readonly radius: number;
  readonly alive: boolean;
  readonly spawning: boolean;
  readonly removed: boolean;
  readonly elite: boolean;
  hp: number;
  readonly maxHp: number;
  readonly name: string;
  hit(h: HitInfo, from: THREE.Vector3): void;
  update(dt: number): void;
  faceCamera(cam: THREE.Camera): void;
  place(x: number, z: number): void;
}

export interface World {
  readonly discoEnv: THREE.Texture;
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  readonly sparks: Sparks;
  readonly puffs: Puffs;
  readonly glows: Puffs;
  readonly ghosts: Ghosts;
  readonly rings: Rings;
  readonly bursts: Bursts;
  readonly dmg: DamageNumbers;
  readonly shake: Shake;
  readonly heroSmear: Smear;
  readonly enemySmears: Smear[];
  readonly scene: THREE.Scene;
  time: number;
  hitstop(ms: number): void;
  slowmo(scale: number, ms: number): void;
  collide(p: THREE.Vector3, r: number): void;
  /** Frappe les ennemis dans la forme ; renvoie le nombre de cibles touchées. */
  strike(shape: HitShape, hit: HitInfo): number;
  heroPos(): THREE.Vector3;
  heroHit(damage: number, from: THREE.Vector3): boolean;
  requestToken(id: number): boolean;
  releaseToken(id: number): void;
  onEnemyDeath(pos: THREE.Vector3): void;
}
