// PNJ du hub (LORE § 4) : modèles procéduraux aux proportions du héros (grosse tête lisible, épaules
// larges), une silhouette et un accessoire par personnage, et une animation idle (respiration, regard
// vers le héros, geste de pupitre). Point d'entrée unique : `createNpcView`. Le jour où le GLB d'un
// PNJ est intégré (public/models : bene, josiane, kevin…), il se branche ici derrière `NpcView`,
// sans toucher à la sim ni au décor du hub.
import * as THREE from 'three';
import type { HubNpcId } from '@/sim/hub/stations';
import { glow, PAL, toon } from '@/view/materials/toon';
import type { Pose } from '@/view/rig';
import { Rig } from '@/view/rig';

/** Vue d'un PNJ du hub. */
export interface NpcView {
  readonly root: THREE.Object3D;
  /** `hero` : position du héros (m), pour le regard ; `null` s'il est loin. */
  update(dt: number, time: number, hero: THREE.Vector3 | null): void;
  /** Petite réaction quand on lui parle. */
  talk(): void;
  dispose(): void;
}

type Hat = 'cap' | 'kepi' | 'beanie' | 'headwrap' | 'bun' | 'bob' | 'white' | 'redcap';

interface Look {
  readonly skin: number;
  readonly hair: number;
  readonly top: number;
  readonly trim: number;
  readonly legs: number;
  readonly shoes: number;
  readonly hat: Hat;
  readonly hatColor?: number;
  readonly glasses?: boolean;
  readonly headset?: boolean;
  readonly mustache?: boolean;
  readonly stripes?: boolean;
  readonly scale: number;
  /** Geste de pupitre (frappe au clavier) ou main dans le dos. */
  readonly gesture: 'desk' | 'arms' | 'whistle';
}

const LOOKS: Readonly<Record<HubNpcId, Look>> = {
  // Conducteur « retraité depuis 2011 » : veste bleu marine, casquette à bande dorée, moustache blanche.
  marcel: {
    skin: 0xe5a585,
    hair: 0xe8e6e0,
    top: 0x1e2d5c,
    trim: 0xffc83a,
    legs: 0x22243a,
    shoes: 0x1a1418,
    hat: 'cap',
    hatColor: 0x1a2650,
    mustache: true,
    scale: 0.96,
    gesture: 'arms',
  },
  // Conseillère en prévention : gilet sarcelle, foulard de tête orange et vert.
  fatou: {
    skin: 0x7a4a32,
    hair: 0x1c1210,
    top: 0x1f8f8a,
    trim: 0xf2f0e8,
    legs: 0x2c2a3e,
    shoes: 0x3a2a2a,
    hat: 'headwrap',
    hatColor: 0xf08a24,
    scale: 0.95,
    gesture: 'desk',
  },
  // Régulatrice : bordeaux, chignon, casque radio.
  yasmina: {
    skin: 0xc68a62,
    hair: 0x1a0f0c,
    top: 0x8a2238,
    trim: 0xe8d6c8,
    legs: 0x1e1c2c,
    shoes: 0x1a1418,
    hat: 'bun',
    headset: true,
    scale: 0.94,
    gesture: 'desk',
  },
  // Technicien caténaires de l'Infra : veste de travail verte à bandes, bonnet.
  kevin: {
    skin: 0xf0b48e,
    hair: 0x7a4a26,
    top: 0x3c6a3a,
    trim: 0xe8eeff,
    legs: 0x2e3a52,
    shoes: 0x4a3426,
    hat: 'beanie',
    hatColor: 0xd8a020,
    stripes: true,
    scale: 1.04,
    gesture: 'desk',
  },
  // Guichetière : chemisier lilas, carré gris, lunettes.
  bene: {
    skin: 0xf2c0a0,
    hair: 0xa8a8b4,
    top: 0x9b7fd0,
    trim: 0xffffff,
    legs: 0x2a2840,
    shoes: 0x22181c,
    hat: 'bob',
    glasses: true,
    scale: 0.92,
    gesture: 'desk',
  },
  // Accompagnatrice de train (DPD) : uniforme bleu nuit, chemise ciel, képi.
  josiane: {
    skin: 0xeab192,
    hair: 0x8a5a3a,
    top: 0x1c2a58,
    trim: 0x9ad0ff,
    legs: 0x1c2a58,
    shoes: 0x14101a,
    hat: 'kepi',
    hatColor: 0x18234a,
    scale: 0.97,
    gesture: 'arms',
  },
  // Chef de quai (TLI & AIT) : manteau noir, casquette rouge, sifflet.
  rudy: {
    skin: 0xdfa07c,
    hair: 0x2a1a14,
    top: 0x22202c,
    trim: 0xe0283c,
    legs: 0x1c1a26,
    shoes: 0x14101a,
    hat: 'redcap',
    hatColor: 0xd8283a,
    scale: 1.0,
    gesture: 'whistle',
  },
};

class ProceduralNpcView implements NpcView {
  private readonly rig = new Rig();
  private readonly mats: THREE.Material[] = [];
  private readonly phase: number;
  private talkT = 0;
  private lookYaw = 0;
  private whistleGeo: THREE.BufferGeometry | null = null;

  public constructor(
    private readonly look: Look,
    seed: number,
    private readonly reducedMotion: boolean,
  ) {
    this.phase = seed * 1.7;
    const m = (c: number, rim = 0.55): THREE.MeshToonMaterial => {
      const mat = toon(c, { rimStrength: rim, rim: 0xffc27a });
      this.mats.push(mat);
      return mat;
    };
    const skin = m(look.skin, 0.4);
    const hair = m(look.hair, 0.3);
    const top = m(look.top);
    const trim = m(look.trim, 0.3);
    const legs = m(look.legs, 0.3);
    const shoes = m(look.shoes, 0.2);
    const eyes = m(PAL.outline, 0);
    const hatMat = m(look.hatColor ?? look.top, 0.4);
    const r = this.rig;

    r.joint('pelvis', null, [0, 0.66, 0]);
    r.joint('spine', 'pelvis', [0, 0.1, 0]);
    r.joint('chest', 'spine', [0, 0.17, 0]);
    r.joint('neck', 'chest', [0, 0.3, 0]);
    r.joint('head', 'neck', [0, 0.05, 0]);
    for (const [s, sx] of [
      ['L', 1],
      ['R', -1],
    ] as const) {
      r.joint(`shoulder_${s}`, 'chest', [0.3 * sx, 0.2, 0]);
      r.joint(`elbow_${s}`, `shoulder_${s}`, [0, -0.24, 0]);
      r.joint(`hand_${s}`, `elbow_${s}`, [0, -0.21, 0]);
      r.joint(`hip_${s}`, 'pelvis', [0.12 * sx, -0.03, 0]);
      r.joint(`knee_${s}`, `hip_${s}`, [0, -0.3, 0]);
      r.joint(`foot_${s}`, `knee_${s}`, [0, -0.28, 0]);
    }
    for (const s of ['L', 'R']) {
      r.capsule(`hip_${s}`, legs, [0, 0, 0], [0, -0.3, 0], 0.1);
      r.capsule(`knee_${s}`, legs, [0, 0, 0], [0, -0.22, 0], 0.088);
      r.box(`foot_${s}`, shoes, [0, 0.03, 0.04], [0.18, 0.14, 0.28], 0.06);
    }
    r.box('pelvis', legs, [0, 0, 0], [0.38, 0.2, 0.26], 0.08);
    r.box('spine', top, [0, 0.04, 0], [0.4, 0.22, 0.27], 0.09);
    r.box('chest', top, [0, 0.1, 0], [0.56, 0.42, 0.33], 0.12);
    // Col et revers (couleur de garniture), bandes réfléchissantes pour Kevin.
    r.box('chest', trim, [0, 0.3, 0.06], [0.24, 0.07, 0.2], 0.03, { outline: false });
    r.box('chest', trim, [0, 0.12, 0.16], [0.08, 0.3, 0.03], 0.01, { outline: false });
    if (look.stripes) {
      r.box('chest', trim, [0, 0.02, 0], [0.57, 0.04, 0.34], 0.015, { outline: false });
      r.box('chest', trim, [0, 0.14, 0], [0.57, 0.04, 0.34], 0.015, { outline: false });
    }
    for (const s of ['L', 'R']) {
      r.sphere(`shoulder_${s}`, top, [0, -0.01, 0], [0.13, 0.13, 0.14]);
      r.capsule(`shoulder_${s}`, top, [0, -0.04, 0], [0, -0.23, 0], 0.078);
      r.capsule(`elbow_${s}`, top, [0, 0, 0], [0, -0.17, 0], 0.072);
      r.sphere(`hand_${s}`, skin, [0, -0.04, 0], [0.085, 0.09, 0.085]);
    }
    // Tête
    r.cyl('neck', skin, [0, 0.0, 0], 0.08, 0.12);
    r.sphere('head', skin, [0, 0.17, 0.01], [0.27, 0.27, 0.26]);
    for (const sx of [1, -1]) {
      r.sphere('head', skin, [0.27 * sx, 0.15, 0], [0.05, 0.07, 0.05]);
      r.sphere('head', eyes, [0.095 * sx, 0.2, 0.24], [0.035, 0.052, 0.03], {
        outline: false,
        shadow: false,
      });
    }
    r.sphere('head', skin, [0, 0.13, 0.265], [0.05, 0.045, 0.045], { outline: false });
    if (look.mustache)
      r.box('head', hair, [0, 0.075, 0.245], [0.24, 0.055, 0.07], 0.025, { outline: false });
    if (look.glasses) {
      for (const sx of [1, -1])
        r.box('head', eyes, [0.1 * sx, 0.2, 0.262], [0.11, 0.08, 0.015], 0.01, {
          outline: false,
          shadow: false,
        });
      r.box('head', eyes, [0, 0.21, 0.265], [0.08, 0.015, 0.012], 0, { outline: false });
    }
    this.buildHair(look, hair, hatMat, trim);
    if (look.headset) {
      r.box('head', eyes, [0, 0.34, 0], [0.6, 0.04, 0.06], 0.02, { outline: false });
      r.sphere('head', eyes, [0.29, 0.15, 0], [0.07, 0.09, 0.09]);
      r.capsule('head', eyes, [0.29, 0.1, 0.04], [0.12, 0.04, 0.24], 0.015, { outline: false });
    }
    if (look.gesture === 'whistle') {
      const wm = glow(0xd8e2ff, 1.2);
      this.mats.push(wm);
      this.whistleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.09, 10);
      const whistle = new THREE.Mesh(this.whistleGeo, wm);
      whistle.rotation.z = Math.PI / 2;
      whistle.position.set(0, -0.08, 0.04);
      r.j('hand_R').add(whistle);
    }
    this.rig.root.scale.setScalar(look.scale * 1.08);
  }

  private buildHair(
    look: Look,
    hair: THREE.Material,
    hat: THREE.Material,
    trim: THREE.Material,
  ): void {
    const r = this.rig;
    switch (look.hat) {
      case 'cap':
      case 'redcap':
        r.sphere('head', hair, [0, 0.16, -0.08], [0.27, 0.2, 0.2]);
        r.cyl('head', hat, [0, 0.36, -0.01], 0.25, 0.12, { rBottom: 0.28 });
        r.box('head', hat, [0, 0.3, 0.22], [0.36, 0.03, 0.18], 0.015);
        if (look.hat === 'cap')
          r.cyl('head', trim, [0, 0.32, -0.01], 0.283, 0.035, { outline: false });
        break;
      case 'kepi':
        r.sphere('head', hair, [0, 0.14, -0.12], [0.26, 0.22, 0.18]);
        r.cyl('head', hat, [0, 0.38, -0.01], 0.24, 0.16, { rBottom: 0.27 });
        r.box('head', hat, [0, 0.31, 0.21], [0.32, 0.03, 0.14], 0.012);
        r.cyl('head', trim, [0, 0.33, -0.01], 0.272, 0.03, { outline: false });
        break;
      case 'beanie':
        r.hemi('head', hat, [0, 0.27, -0.01], [0.29, 0.26, 0.28]);
        r.cyl('head', hat, [0, 0.28, -0.01], 0.29, 0.07);
        break;
      case 'headwrap':
        r.sphere('head', hat, [0, 0.33, -0.04], [0.3, 0.22, 0.29]);
        r.sphere('head', trim, [0.12, 0.47, -0.02], [0.12, 0.08, 0.1], { outline: false });
        break;
      case 'bun':
        r.sphere('head', hair, [0, 0.23, -0.06], [0.285, 0.24, 0.24]);
        r.sphere('head', hair, [0, 0.38, -0.2], [0.11, 0.11, 0.11]);
        break;
      case 'bob':
        r.sphere('head', hair, [0, 0.22, -0.04], [0.3, 0.25, 0.27]);
        r.box('head', hair, [0, 0.05, -0.06], [0.58, 0.24, 0.42], 0.1);
        break;
      case 'white':
        r.sphere('head', hair, [0, 0.21, -0.06], [0.28, 0.23, 0.23]);
        break;
    }
  }

  public get root(): THREE.Object3D {
    return this.rig.root;
  }

  public talk(): void {
    this.talkT = 1;
    if (!this.reducedMotion) this.rig.punchScale([1.06, 0.94, 1.06]);
  }

  public update(dt: number, time: number, hero: THREE.Vector3 | null): void {
    const t = time + this.phase;
    const breathe = this.reducedMotion ? 0 : Math.sin(t * 1.9) * 2;
    this.talkT = Math.max(0, this.talkT - dt * 0.8);
    // Regard vers le héros (tête, puis un peu le buste), borné.
    let want = 0;
    if (hero) {
      const p = this.rig.root.position;
      const yaw = Math.atan2(hero.x - p.x, hero.z - p.z) - this.rig.root.rotation.y;
      want =
        (Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(yaw), Math.cos(yaw)))) * 180) / Math.PI;
    }
    this.lookYaw += (want - this.lookYaw) * (1 - Math.exp(-5 * dt));
    const rot: Record<string, [number, number, number]> = {
      spine: [breathe * 0.5, this.lookYaw * 0.15, 0],
      chest: [breathe, this.lookYaw * 0.15, 0],
      head: [-breathe * 0.6 + this.talkT * 8 * Math.sin(t * 9), this.lookYaw * 0.7, 0],
      shoulder_L: [0, 0, 6],
      shoulder_R: [0, 0, -6],
      elbow_L: [-8, 0, 0],
      elbow_R: [-8, 0, 0],
    };
    const g = this.look.gesture;
    if (g === 'desk') {
      // Frappe au clavier du pupitre, par salves.
      const typing = !this.reducedMotion && Math.sin(t * 0.7) > 0.1 && !hero;
      const k = typing ? Math.sin(t * 14) * 6 : 0;
      rot.shoulder_L = [-35 + k, 0, 10];
      rot.shoulder_R = [-35 - k, 0, -10];
      rot.elbow_L = [-55, 0, 0];
      rot.elbow_R = [-55, 0, 0];
    } else if (g === 'arms') {
      rot.shoulder_L = [12, 0, 18];
      rot.shoulder_R = [12, 0, -18];
      rot.elbow_L = [-40, 0, -30];
      rot.elbow_R = [-40, 0, 30];
    } else {
      // Rudy porte son sifflet à la bouche de temps en temps.
      const up = !this.reducedMotion && Math.sin(t * 0.45) > 0.85 ? 1 : 0;
      rot.shoulder_R = [-60 * up - 5, 0, -8 - 20 * up];
      rot.elbow_R = [-110 * up - 10, 0, 0];
    }
    const pose: Pose = {
      rot,
      scale: [1, 1 + (this.reducedMotion ? 0 : Math.sin(t * 1.9) * 0.008), 1],
    };
    this.rig.apply(pose, dt, 10);
  }

  public dispose(): void {
    this.rig.dispose();
    for (const m of this.mats) m.dispose();
    this.whistleGeo?.dispose();
  }
}

const SEEDS: Readonly<Record<HubNpcId, number>> = {
  marcel: 1,
  fatou: 2,
  yasmina: 3,
  kevin: 4,
  bene: 5,
  josiane: 6,
  rudy: 7,
};

/**
 * Fabrique des PNJ du hub. Point d'entrée des futurs GLB (`public/models/<id>.glb`) : il suffira de
 * renvoyer ici une vue chargée par la fabrique d'acteurs (`view/actors`) quand elle les exposera.
 */
export function createNpcView(id: HubNpcId, reducedMotion: boolean): NpcView {
  return new ProceduralNpcView(LOOKS[id], SEEDS[id], reducedMotion);
}
