// Mannequin de formation sécurité (Cour intérieure, DA § 2.12) : poteau planté dans une palette,
// buste de toile en gilet orange, casque jaune, bras en croix. Il vacille sur un ressort à chaque coup
// (pas de mort). Vue d'ennemi (`EnemyView`) branchée par `GameViewOptions.enemyView` pour le seul
// `TrainingDummySim` : le reste du combat (nombres de dégâts, étincelles, hitstop) vient de `GameView`.
import * as THREE from 'three';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import { pxToM } from '@/sim/units';
import type { ActorFrame, EnemyView } from '@/view/actors/ActorView';
import type { Flash } from '@/view/materials/toon';
import {
  addOutline,
  capsuleGeo,
  cylGeo,
  makeFlash,
  rboxGeo,
  sphereGeo,
  toon,
} from '@/view/materials/toon';

export class DummyView implements EnemyView {
  public readonly root = new THREE.Group();
  public readonly pos = new THREE.Vector3();
  public readonly finished = false;
  private readonly flash: Flash = makeFlash();
  private readonly body = new THREE.Group();
  private readonly mats: THREE.Material[] = [];
  /** Ressort amorti de l'inclinaison (rad) et de sa vitesse. */
  private tilt = 0;
  private tiltV = 0;
  private tiltDir = 0;
  private flashT = 0;

  public constructor(
    scene: THREE.Scene,
    private readonly reducedMotion: boolean,
  ) {
    const m = (c: number, rim = 0.5): THREE.MeshToonMaterial => {
      const mat = toon(c, { rimStrength: rim, flash: this.flash });
      this.mats.push(mat);
      return mat;
    };
    const wood = m(0xb07a44, 0.2);
    const woodDark = m(0x7a5230, 0.2);
    const canvas = m(0xd9c79a, 0.4);
    const vest = m(0xff6a12, 0.9);
    const stripe = m(0xe8eeff, 0.3);
    const helmet = m(0xffc21a, 0.8);
    const add = (
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      s?: readonly [number, number, number],
      outline = true,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      if (s) mesh.scale.set(s[0], s[1], s[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (outline) addOutline(mesh, 2.2);
      parent.add(mesh);
      return mesh;
    };
    // Palette (fixe).
    for (const z of [-0.36, 0, 0.36])
      add(this.root, rboxGeo(1.1, 0.06, 0.22, 0.01), wood, 0, 0.13, z);
    for (const x of [-0.45, 0, 0.45])
      add(this.root, rboxGeo(0.14, 0.1, 0.96, 0.01), woodDark, x, 0.05, 0, undefined, false);
    // Corps (vacille autour de la base).
    this.body.position.y = 0.16;
    this.root.add(this.body);
    add(this.body, cylGeo(0.06, 0.07, 0.9, 10), woodDark, 0, 0.45, 0);
    add(this.body, capsuleGeo(0.27, 0.42), canvas, 0, 1.2, 0);
    add(this.body, rboxGeo(0.62, 0.44, 0.48, 0.12), vest, 0, 1.24, 0);
    add(this.body, rboxGeo(0.63, 0.05, 0.49, 0.02), stripe, 0, 1.16, 0, undefined, false);
    add(this.body, rboxGeo(0.63, 0.05, 0.49, 0.02), stripe, 0, 1.3, 0, undefined, false);
    const arms = add(this.body, capsuleGeo(0.07, 1.2), canvas, 0, 1.38, 0);
    arms.rotation.z = Math.PI / 2;
    add(this.body, sphereGeo(16), canvas, 0, 1.78, 0, [0.22, 0.23, 0.22]);
    add(this.body, sphereGeo(16), helmet, 0, 1.86, 0, [0.25, 0.16, 0.26]);
    // Visage dessiné au feutre (deux croix).
    const ink = m(0x14101a, 0);
    for (const sx of [-1, 1])
      add(this.body, rboxGeo(0.07, 0.015, 0.01, 0), ink, 0.07 * sx, 1.8, 0.215, undefined, false);
    scene.add(this.root);
  }

  public hit(heavy: boolean): void {
    this.flashT = this.reducedMotion ? 0.4 : 1;
    this.tiltV += (heavy ? 5.5 : 3.2) * (this.reducedMotion ? 0.5 : 1);
  }

  public die(): void {
    // Le mannequin ne meurt jamais.
  }

  public update(sim: EnemySim | null, frame: ActorFrame): void {
    if (sim) {
      const b = sim.body;
      const x = b.prevX + (b.x - b.prevX) * frame.alpha;
      const y = b.prevY + (b.y - b.prevY) * frame.alpha;
      this.pos.set(pxToM(x), 0, pxToM(y));
      this.root.position.copy(this.pos);
      // Le coup vient du héros : on penche à l'opposé (direction d'où il regarde).
      this.tiltDir = Math.PI / 2 - sim.facing + Math.PI;
    }
    const dt = Math.min(0.05, frame.realDt);
    // Ressort amorti : k = 60, amortissement 7.
    this.tiltV += (-60 * this.tilt - 7 * this.tiltV) * dt;
    this.tilt += this.tiltV * dt;
    this.body.rotation.set(
      Math.cos(this.tiltDir) * this.tilt * 0.35,
      0,
      -Math.sin(this.tiltDir) * this.tilt * 0.35,
    );
    this.flashT = Math.max(0, this.flashT - frame.realDt * 8);
    this.flash.amount.value = this.flashT * 0.8;
  }

  public dispose(): void {
    this.root.removeFromParent();
    for (const mat of this.mats) mat.dispose();
  }
}
