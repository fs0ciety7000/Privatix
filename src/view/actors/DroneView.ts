// Drone Optimètre en 3D : quadrirotor turquoise à objectif unique, qui flotte au-dessus de son ombre.
// L'objectif passe du cyan au magenta pendant le télégraphe (tir, piqué, scan) ; il pique vers sa
// cible, puis reste cloué au sol, rotors calés.
import * as THREE from 'three';
import { DRONE } from '@/config/balance';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import { pxToM } from '@/sim/units';
import { ProceduralEnemyView } from '@/view/actors/ProceduralEnemyView';
import { glow, PAL } from '@/view/materials/toon';

const FLY_Y = pxToM(DRONE.hurtOffsetY) + 0.35;
const GROUND_Y = 0.16;

export class DroneView extends ProceduralEnemyView {
  private readonly lens: THREE.MeshBasicMaterial;
  private readonly rotors: THREE.Object3D[] = [];
  private height = FLY_Y;
  private spin = 0;

  public constructor(scene: THREE.Scene, reducedMotion: boolean) {
    super(scene, reducedMotion, { barY: 1.45, barW: 0.7, spawnR: 0.4, topple: false });
    const r = this.rig;
    const shell = this.mat(0x19c3b1, 1.0);
    const dark = this.mat(0x1d2a48, 0.6);
    const steel = this.mat(0x9aa6c8, 0.7);
    this.lens = this.track(glow(0x6ff3ff, 2.5));

    r.joint('core', null, [0, FLY_Y, 0]);
    r.sphere('core', shell, [0, 0, 0], [0.25, 0.18, 0.25]);
    r.cyl('core', dark, [0, -0.02, 0], 0.23, 0.08, { seg: 18 });
    r.box('core', dark, [0, -0.15, 0.02], [0.18, 0.08, 0.2], 0.03);
    // Objectif (l'œil de l'audit) : un anneau sombre et une lentille émissive à l'avant.
    r.cyl('core', dark, [0, 0.02, 0.19], 0.09, 0.06, { rot: [90, 0, 0] });
    const eye = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.07, 12, 8)), this.lens);
    eye.position.set(0, 0.02, 0.23);
    r.j('core').add(eye);
    // Bras et rotors
    for (let i = 0; i < 4; i += 1) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const x = Math.cos(a) * 0.36;
      const z = Math.sin(a) * 0.36;
      r.box('core', steel, [x / 2, 0.03, z / 2], [0.36, 0.035, 0.05], 0.015, {
        rot: [0, (-a * 180) / Math.PI, 0],
        outline: false,
      });
      r.joint(`rotor${String(i)}`, 'core', [x, 0.08, z]);
      r.cyl(`rotor${String(i)}`, dark, [0, -0.02, 0], 0.03, 0.06);
      const blade = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(0.3, 0.01, 0.04)),
        this.track(glow(0xd8f6ff, 0.9, { transparent: true, opacity: 0.6 })),
      );
      blade.position.y = 0.015;
      r.j(`rotor${String(i)}`).add(blade);
      this.rotors.push(blade);
    }
  }

  protected override readonly turnRate: number = 12;

  protected animate(sim: EnemySim, dt: number, windup: number): void {
    const diving = sim.currentAttack === 'dive' && sim.state === 'attack';
    const target = sim.grounded ? GROUND_Y : diving ? 0.35 : FLY_Y;
    this.height += (target - this.height) * (1 - Math.exp(-(sim.grounded ? 18 : 6) * dt));
    const bob = sim.grounded ? 0 : Math.sin(this.time * 5.5) * 0.06;
    const w = sim.state === 'windup' ? windup : 0;
    const pitch = diving
      ? 35
      : sim.state === 'windup' && sim.currentAttack === 'dive'
        ? -15 * w
        : 0;
    this.rig.apply(
      {
        rot: { core: [pitch + (sim.grounded ? 12 : 0), 0, Math.sin(this.time * 2.3) * 4] },
        root: [0, this.height - FLY_Y + bob, 0],
        scale: [1 + 0.08 * w, 1 - 0.06 * w, 1 + 0.08 * w],
      },
      dt,
      14,
    );
    this.spin += dt * (sim.grounded ? 2 : 38);
    for (const [i, b] of this.rotors.entries()) b.rotation.y = this.spin * (i % 2 === 0 ? 1 : -1);
    const hot = sim.state === 'windup' || (sim.state === 'attack' && sim.currentAttack === 'scan');
    if (hot) this.lens.color.setHex(PAL.danger).multiplyScalar(2 + 4 * w);
    else this.lens.color.setHex(sim.grounded ? 0x30404a : 0x6ff3ff).multiplyScalar(2.5);
  }

  protected override onDeath(): void {
    this.lens.color.setHex(0x101018);
  }

  protected override animateDeath(dt: number): void {
    this.spin += dt * 4;
  }
}
