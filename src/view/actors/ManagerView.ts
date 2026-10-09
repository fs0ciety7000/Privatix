// Manager KPI « Le Tableur » en 3D (élite) : costume trois-pièces turquoise sombre, cravate magenta,
// tablette dont l'écran affiche des courbes, bulle de posture (le « Costume trois-pièces ») qui le
// rend insensible aux coups 1-2 et se brise au « burn-out du manager ».
import * as THREE from 'three';
import { MANAGER } from '@/config/balance';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import { pxToM } from '@/sim/units';
import { ProceduralEnemyView } from '@/view/actors/ProceduralEnemyView';
import { canvasTexture, glow, PAL } from '@/view/materials/toon';
import type { Pose } from '@/view/rig';
import { easeIn, easeOut, keyed } from '@/view/rig';

const SCALE = 1.18;

export interface ManagerLook {
  /** Agrandissement relatif (repli procédural du boss final : 1,4, comme son GLB provisoire). */
  readonly grow?: number;
  /** Bulle de posture (Manager KPI seulement : le boss final n'a pas cette mécanique). */
  readonly posture?: boolean;
}

export class ManagerView extends ProceduralEnemyView {
  private readonly screen: THREE.MeshBasicMaterial;
  private readonly shieldMat: THREE.MeshBasicMaterial;
  private readonly shield: THREE.Mesh;
  private readonly screenTex: THREE.Texture;
  private walk = Math.random() * 6;
  private shieldK = 1;

  private readonly posture: boolean;

  public constructor(scene: THREE.Scene, reducedMotion: boolean, look: ManagerLook = {}) {
    const grow = look.grow ?? 1;
    super(scene, reducedMotion, {
      barY: 2.55 * grow,
      barW: 1.3 * Math.min(grow, 1.4),
      spawnR: 0.6 * grow,
      topple: true,
      scale: SCALE * grow,
    });
    this.posture = look.posture ?? true;
    if (!this.posture) this.shieldK = 0;
    const r = this.rig;
    const suit = this.mat(0x0f6f6a, 0.9);
    const vest = this.mat(0x19c3b1, 0.7);
    const shirt = this.mat(0xf2f4fa, 0.3);
    const tie = this.mat(PAL.danger, 0.4, { emissive: PAL.danger, emissiveIntensity: 0.3 });
    const skin = this.mat(0xe9b088, 0.6, { rim: PAL.rim });
    const hair = this.mat(0x9a9aa8, 0.5, { rim: PAL.rim });
    const shoes = this.mat(0x14101a, 0.4);
    const frame = this.mat(0x1d2a48, 0.6);
    const ink = this.mat(0x14101a, 0);
    this.screenTex = canvasTexture(128, 96, (g) => {
      g.fillStyle = '#071a26';
      g.fillRect(0, 0, 128, 96);
      g.strokeStyle = '#5ff7e4';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(8, 80);
      g.lineTo(40, 58);
      g.lineTo(64, 66);
      g.lineTo(96, 26);
      g.lineTo(120, 14);
      g.stroke();
      g.fillStyle = '#ff3ea5';
      for (let i = 0; i < 4; i += 1) g.fillRect(14 + i * 26, 90 - (i + 1) * 12, 14, (i + 1) * 12);
    });
    this.screen = this.track(new THREE.MeshBasicMaterial({ map: this.screenTex }));
    this.screen.color.setScalar(1.6);

    r.joint('pelvis', null, [0, 0.64, 0]);
    r.joint('spine', 'pelvis', [0, 0.1, 0]);
    r.joint('chest', 'spine', [0, 0.16, 0]);
    r.joint('neck', 'chest', [0, 0.3, 0]);
    r.joint('head', 'neck', [0, 0.05, 0]);
    for (const [s, sx] of [
      ['L', 1],
      ['R', -1],
    ] as const) {
      r.joint(`shoulder_${s}`, 'chest', [0.3 * sx, 0.2, 0]);
      r.joint(`elbow_${s}`, `shoulder_${s}`, [0, -0.23, 0]);
      r.joint(`hand_${s}`, `elbow_${s}`, [0, -0.21, 0]);
      r.joint(`hip_${s}`, 'pelvis', [0.11 * sx, -0.02, 0]);
      r.joint(`knee_${s}`, `hip_${s}`, [0, -0.3, 0]);
      r.joint(`foot_${s}`, `knee_${s}`, [0, -0.29, 0]);
    }
    r.joint('tablet', 'hand_L', [0, -0.06, 0]);

    for (const s of ['L', 'R']) {
      r.capsule(`hip_${s}`, suit, [0, 0, 0], [0, -0.3, 0], 0.1);
      r.capsule(`knee_${s}`, suit, [0, 0, 0], [0, -0.26, 0], 0.088);
      r.box(`foot_${s}`, shoes, [0, 0.03, 0.06], [0.16, 0.1, 0.32], 0.04);
    }
    r.box('pelvis', suit, [0, 0, 0], [0.42, 0.18, 0.27], 0.07);
    r.box('spine', vest, [0, 0.04, 0], [0.44, 0.2, 0.28], 0.08);
    r.box('chest', suit, [0, 0.1, 0], [0.56, 0.42, 0.32], 0.11);
    r.box('chest', vest, [0, 0.1, 0.12], [0.3, 0.4, 0.1], 0.04, { outline: false });
    r.box('chest', shirt, [0, 0.2, 0.165], [0.14, 0.2, 0.03], 0.012, { outline: false });
    r.box('chest', tie, [0, 0.12, 0.18], [0.07, 0.3, 0.025], 0.01);
    r.box('chest', shirt, [0, 0.3, 0.02], [0.27, 0.06, 0.22], 0.025);
    for (const s of ['L', 'R']) {
      r.sphere(`shoulder_${s}`, suit, [0, -0.01, 0], [0.13, 0.12, 0.13]);
      r.capsule(`shoulder_${s}`, suit, [0, -0.02, 0], [0, -0.23, 0], 0.078);
      r.capsule(`elbow_${s}`, suit, [0, 0, 0], [0, -0.15, 0], 0.07);
      r.sphere(`hand_${s}`, skin, [0, -0.03, 0], [0.085, 0.09, 0.085]);
    }
    r.cyl('neck', skin, [0, 0, 0], 0.08, 0.1);
    r.sphere('head', skin, [0, 0.16, 0], [0.26, 0.26, 0.25]);
    r.sphere('head', hair, [0, 0.24, -0.05], [0.255, 0.16, 0.22]);
    for (const sx of [1, -1]) {
      r.box('head', frame, [0.085 * sx, 0.18, 0.22], [0.1, 0.07, 0.02], 0.01, { outline: false });
      r.sphere('head', ink, [0.085 * sx, 0.18, 0.225], [0.025, 0.03, 0.02], {
        outline: false,
        shadow: false,
      });
    }
    r.box('head', ink, [0, 0.07, 0.22], [0.1, 0.02, 0.02], 0.005, { outline: false });
    // Tablette tenue main gauche, écran vers l'extérieur
    r.box('tablet', frame, [0, 0, 0.02], [0.34, 0.24, 0.03], 0.02, { rot: [-80, 0, 0] });
    const screen = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(0.3, 0.2)), this.screen);
    screen.position.set(0, 0.02, 0.025);
    screen.rotation.x = -Math.PI / 2 + 0.17;
    r.j('tablet').add(screen);

    // Bulle de posture : coque translucide additive, visible tant que la posture tient.
    this.shieldMat = this.track(glow(PAL.enemy, 0.55, { transparent: true, additive: true }));
    this.shield = new THREE.Mesh(
      this.trackGeo(new THREE.IcosahedronGeometry(1, 1)),
      this.shieldMat,
    );
    this.shield.scale.set(0.62, 0.95, 0.62);
    this.shield.position.y = 0.95;
    r.root.add(this.shield);
  }

  protected animate(sim: EnemySim, dt: number, windup: number): void {
    const sp = Math.min(1, pxToM(Math.hypot(sim.body.vx, sim.body.vy)) / 2);
    const t = sim.stateTime;
    const attack = sim.currentAttack;
    let pose: Pose;
    let k = 12;
    switch (sim.state) {
      case 'windup':
        pose =
          attack === 'tablet'
            ? keyed(
                [
                  [0, idle(this.time)],
                  [MANAGER.TABLET_TELEGRAPH_MS * 0.5, RAISE, easeOut],
                  [MANAGER.TABLET_TELEGRAPH_MS, RAISE],
                ],
                t,
              )
            : PRESENT(windup);
        k = 16;
        break;
      case 'attack':
        pose =
          attack === 'tablet'
            ? keyed(
                [
                  [0, RAISE],
                  [90, SLAM, easeIn],
                ],
                t,
              )
            : PRESENT(1);
        k = 40;
        break;
      case 'stagger':
        pose = HURT;
        k = 24;
        break;
      default:
        if (sp > 0.08) {
          this.walk += dt * Math.PI * 2 * (1.3 * sp + 0.4);
          pose = walkPose(this.walk, sp);
        } else pose = idle(this.time);
    }
    this.rig.apply(pose, dt, k);
    // Tablette : l'écran vire au magenta pendant le télégraphe.
    if (sim.state === 'windup') this.screen.color.setRGB(1.6 + 2 * windup, 0.6, 1.2);
    else this.screen.color.setScalar(1.6);
    // Bulle de posture : se brise au burn-out, revient après.
    const target = sim.broken || !this.posture ? 0 : 1;
    this.shieldK += (target - this.shieldK) * (1 - Math.exp(-(sim.broken ? 20 : 3) * dt));
    this.shield.visible = this.shieldK > 0.03;
    const pulse = this.reducedMotion ? 0 : Math.sin(this.time * 3) * 0.04;
    this.shield.scale.set(0.62 + pulse, 0.95 + pulse, 0.62 + pulse);
    this.shieldMat.color.setHex(PAL.enemy).multiplyScalar(0.5 * this.shieldK);
    this.shield.rotation.y = this.time * 0.4;
  }

  protected override onDeath(): void {
    this.shield.visible = false;
  }

  public override dispose(): void {
    this.screenTex.dispose();
    super.dispose();
  }
}

function idle(t: number): Pose {
  const b = Math.sin(t * 1.8);
  return {
    rot: {
      spine: [-4 + b, 0, 0],
      chest: [-6, 0, 0],
      head: [-10 + b, 0, 0],
      shoulder_L: [-40, 0, 14],
      elbow_L: [-70, 0, 0],
      tablet: [10, 0, 0],
      shoulder_R: [6, 0, -10],
      elbow_R: [-14, 0, 0],
      hip_L: [-3, 0, 4],
      knee_L: [4, 0, 0],
      hip_R: [3, 0, -4],
      knee_R: [4, 0, 0],
    },
    root: [0, b * 0.008, 0],
  };
}

function walkPose(ph: number, sp: number): Pose {
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const a = 24 * s * (0.5 + sp * 0.5);
  return {
    rot: {
      pelvis: [0, 5 * s, 0],
      spine: [-2, -3 * s, 0],
      chest: [-6, -5 * s, 0],
      head: [-10, 4 * s, 0],
      shoulder_L: [-40, 0, 14],
      elbow_L: [-70, 0, 0],
      shoulder_R: [-a * 0.6, 0, -10],
      elbow_R: [-14, 0, 0],
      hip_L: [-a, 0, 3],
      knee_L: [8 + 45 * Math.max(0, c), 0, 0],
      hip_R: [a, 0, -3],
      knee_R: [8 + 45 * Math.max(0, -c), 0, 0],
    },
    root: [0, -0.02 + 0.03 * Math.abs(c), 0],
  };
}

/** Tablette brandie au-dessus de la tête (coup de tablette). */
const RAISE: Pose = {
  rot: {
    spine: [-14, 20, 0],
    chest: [-10, 15, 0],
    head: [0, -10, 0],
    shoulder_L: [-165, 0, 30],
    elbow_L: [-30, 0, 0],
    tablet: [-20, 0, 0],
    shoulder_R: [-20, 0, -30],
    elbow_R: [-40, 0, 0],
    hip_L: [-12, 0, 6],
    knee_L: [16, 0, 0],
    hip_R: [12, 0, -6],
    knee_R: [14, 0, 0],
  },
  root: [0, 0.03, -0.05],
  scale: [0.97, 1.04, 0.97],
};

const SLAM: Pose = {
  rot: {
    spine: [34, -20, 0],
    chest: [14, -15, 0],
    head: [-18, 0, 0],
    shoulder_L: [-70, 0, 10],
    elbow_L: [-10, 0, 0],
    tablet: [-60, 0, 0],
    shoulder_R: [30, 0, -30],
    elbow_R: [-30, 0, 0],
    hip_L: [-40, 0, 6],
    knee_L: [50, 0, 0],
    hip_R: [24, 0, -6],
    knee_R: [36, 0, 0],
  },
  root: [0, -0.16, 0.15],
  scale: [1.06, 0.92, 1.06],
};

/** Présente la tablette (Chronométrage, Reporting) : bras tendu, écran vers le héros. */
function PRESENT(k: number): Pose {
  return {
    rot: {
      spine: [-6 * k, 0, 0],
      chest: [-8, 0, 0],
      head: [-14, 0, 0],
      shoulder_L: [-80 - 10 * k, 0, 6],
      elbow_L: [-10, 0, 0],
      tablet: [-80, 0, 0],
      shoulder_R: [-30 * k, 0, -40 * k],
      elbow_R: [-60 * k, 0, 0],
      hip_L: [-4, 0, 4],
      knee_L: [6, 0, 0],
      hip_R: [4, 0, -4],
      knee_R: [6, 0, 0],
    },
  };
}

const HURT: Pose = {
  rot: {
    spine: [-24, 0, 10],
    chest: [-12, 0, 0],
    head: [-30, 20, 10],
    shoulder_L: [-30, 0, 70],
    elbow_L: [-40, 0, 0],
    shoulder_R: [-30, 0, -60],
    elbow_R: [-30, 0, 0],
    hip_L: [-20, 0, 8],
    knee_L: [30, 0, 0],
    hip_R: [10, 0, -8],
    knee_R: [20, 0, 0],
  },
  root: [0, -0.08, -0.1],
};
