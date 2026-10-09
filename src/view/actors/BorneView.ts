// Borne Automatique en 3D : un distributeur de tickets turquoise sur socle, tourelle à fente qui crache
// les amendes, écran froid qui vire au magenta pendant le télégraphe, panneau arrière jaune et noir
// (le point faible, ×2 de dégâts). Elle se déplie à l'apparition.
import * as THREE from 'three';
import { BORNE } from '@/config/balance';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import { BorneSim } from '@/sim/enemies/BorneSim';
import { ProceduralEnemyView } from '@/view/actors/ProceduralEnemyView';
import { glow, PAL } from '@/view/materials/toon';
import type { Pose } from '@/view/rig';
import { easeOut } from '@/view/rig';

export class BorneView extends ProceduralEnemyView {
  private readonly screen: THREE.MeshBasicMaterial;
  private readonly mouth: THREE.MeshBasicMaterial;
  private recoil = 0;

  public constructor(scene: THREE.Scene, reducedMotion: boolean) {
    super(scene, reducedMotion, { barY: 1.75, barW: 0.9, spawnR: 0.5, topple: false });
    const r = this.rig;
    const shell = this.mat(0x19c3b1, 0.9);
    const dark = this.mat(0x1d2a48, 0.6);
    const steel = this.mat(0x8c98b8, 0.8);
    const warn = this.mat(0xffd200, 0.4);
    const ink = this.mat(0x14101a, 0);
    this.screen = this.track(glow(0x2a3a6a, 1.4));
    this.mouth = this.track(glow(PAL.danger, 1.5));

    r.joint('base', null, [0, 0, 0]);
    r.joint('trunk', 'base', [0, 0.22, 0]);
    r.joint('head', 'trunk', [0, 0.92, 0]);

    // Socle boulonné au quai
    r.box('base', dark, [0, 0.11, 0], [0.7, 0.22, 0.6], 0.06);
    r.box('base', steel, [0, 0.235, 0], [0.62, 0.04, 0.52], 0.02, { outline: false });
    // Fût : coque turquoise, bandes magenta, écran à l'avant, panneau de maintenance à l'arrière
    r.box('trunk', shell, [0, 0.45, 0], [0.56, 0.9, 0.46], 0.09);
    for (const sx of [1, -1])
      r.box('trunk', this.mat(PAL.danger, 0.3), [0.285 * sx, 0.45, 0], [0.02, 0.8, 0.3], 0.01, {
        outline: false,
      });
    const face = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(0.36, 0.26)), this.screen);
    face.position.set(0, 0.62, 0.236);
    r.j('trunk').add(face);
    r.box('trunk', ink, [0, 0.32, 0.235], [0.3, 0.05, 0.02], 0.01, { outline: false });
    // Panneau arrière exposé : hachures jaunes et noires
    r.box('trunk', warn, [0, 0.45, -0.236], [0.4, 0.5, 0.02], 0.01, { outline: false });
    for (let i = 0; i < 4; i += 1)
      r.box('trunk', ink, [-0.12 + i * 0.08, 0.45, -0.248], [0.03, 0.5, 0.01], 0, {
        rot: [0, 0, 30],
        outline: false,
      });
    // Tourelle : tête arrondie, fente à tickets, antenne
    r.box('head', shell, [0, 0.12, 0], [0.62, 0.28, 0.52], 0.12);
    r.box('head', dark, [0, 0.12, 0.25], [0.44, 0.12, 0.08], 0.03);
    const slot = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.34, 0.04, 0.04)), this.mouth);
    slot.position.set(0, 0.12, 0.3);
    r.j('head').add(slot);
    r.cyl('head', steel, [0.18, 0.36, -0.1], 0.015, 0.22);
    const tip = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.035, 8, 6)), this.mouth);
    tip.position.set(0.18, 0.48, -0.1);
    r.j('head').add(tip);
  }

  /** La simulation fait déjà tourner la tourelle à 90°/s : la vue la suit sans retard. */
  protected override readonly turnRate: number = 30;

  protected animate(sim: EnemySim, dt: number, windup: number): void {
    const deploy = sim instanceof BorneSim ? Math.min(1, sim.deployMs / BORNE.DEPLOY_MS) : 1;
    const d = easeOut(deploy);
    const w = sim.state === 'windup' ? windup : 0;
    if (sim.state === 'attack') this.recoil = 1;
    this.recoil = Math.max(0, this.recoil - dt * 5);
    const bob = Math.sin(this.time * 3) * 0.01;
    const pose: Pose = {
      rot: {
        head: [-6 * w + 14 * this.recoil, 0, 0],
        trunk: [0, 0, 0],
      },
      root: [0, -0.25 * (1 - d) + bob, -0.04 * this.recoil],
      scale: [1 + 0.05 * w, 0.6 + 0.4 * d - 0.04 * w, 1 + 0.05 * w],
    };
    this.rig.apply(pose, dt, 18);
    // Écran et fente : froids au repos, magenta qui monte pendant le télégraphe.
    if (sim.state === 'windup' || this.recoil > 0) {
      const k = Math.max(w, this.recoil);
      this.screen.color.setHex(PAL.danger).multiplyScalar(1.2 + 3 * k);
      this.mouth.color.setHex(PAL.danger).multiplyScalar(1.5 + 4 * k);
    } else {
      this.screen.color.setHex(0x3fd8e8).multiplyScalar(0.9 * d);
      this.mouth.color.setHex(PAL.danger).multiplyScalar(1.2);
    }
  }

  protected override onDeath(): void {
    this.screen.color.setHex(0x101018);
    this.mouth.color.setHex(0x101018);
  }
}
