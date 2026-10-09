// Le cheminot en 3D : casque de chantier, gilet orange haute visibilité à bandes réfléchissantes, tenue
// sombre, écharpe syndicale rouge, clé à tire-fond. Modèle et poses repris du prototype validé
// (prototypes/proto3d/src/hero.ts) ; ici il ne décide de rien : il lit l'état de `HeroSim`.
import * as THREE from 'three';
import { DASH_ATTACK, HERO, PREAVIS, WHISTLE } from '@/config/balance';
import type { HeroSim } from '@/sim/hero/HeroSim';
import type { HeroActorView } from '@/view/actors/ActorView';
import { pxToM, yawFromAngle } from '@/sim/units';
import type { Flash } from '@/view/materials/toon';
import { glow, makeFlash, PAL, sncbLogoTexture, toon } from '@/view/materials/toon';
import type { Pose, V3 } from '@/view/rig';
import { easeIn, easeOut, editable, keyed, merge, Rig } from '@/view/rig';

const C = {
  skin: 0xeb9a72,
  helmet: 0xffa419,
  vest: 0xff6a12,
  stripe: 0xe8eeff,
  cloth: 0x27345e,
  clothDark: 0x1b2244,
  boots: 0x3a2c38,
  glove: 0x4b3b46,
  steel: 0x9aaad0,
  steelDark: 0x4a5878,
  scarf: 0xe0283c,
  hair: 0x4a2c22,
  eyes: 0x14101a,
} as const;

/**
 * Durées des poses clés du prototype (ms) : ce sont les totaux startup + active + recovery des coups
 * du GDD (`COMBO`). L'animation est remise à l'échelle sur le timing réel du coup (vitesse d'attaque).
 */
const NOMINAL_MS = [310, 310, 600] as const;

export class HeroView implements HeroActorView {
  public readonly rig = new Rig();
  /** Le héros procédural n'a pas d'équipement interchangeable (voir GlbHeroView). */
  public readonly equipment = null;
  public readonly flash: Flash = makeFlash();
  /** Position affichée (interpolée), au sol. */
  public readonly pos = new THREE.Vector3();
  public readonly headLight: THREE.PointLight;
  private yaw = Math.PI;
  private runPhase = 0;
  private scarfV = 0;
  private hurtFlash = 0;
  private deathT = 0;
  private time = 0;

  public constructor(private readonly reducedMotion: boolean) {
    const f = this.flash;
    const m = (c: number, rim = 0.85): THREE.MeshToonMaterial =>
      toon(c, { rimStrength: rim, flash: f });
    const skin = m(C.skin);
    const cloth = m(C.cloth);
    const clothDark = m(C.clothDark);
    const boots = m(C.boots);
    const glove = m(C.glove);
    const scarf = m(C.scarf);
    const hair = m(C.hair, 0.5);
    const eyes = m(C.eyes, 0);
    const vest = m(C.vest, 1.0);
    const stripe = toon(C.stripe, {
      emissive: 0xb8c8ff,
      emissiveIntensity: 0.22,
      flash: f,
      rimStrength: 0.4,
    });
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
      r.joint(`shoulder_${s}`, 'chest', [0.34 * sx, 0.2, 0]);
      r.joint(`elbow_${s}`, `shoulder_${s}`, [0, -0.24, 0]);
      r.joint(`hand_${s}`, `elbow_${s}`, [0, -0.21, 0]);
      r.joint(`hip_${s}`, 'pelvis', [0.13 * sx, -0.03, 0]);
      r.joint(`knee_${s}`, `hip_${s}`, [0, -0.3, 0]);
      r.joint(`foot_${s}`, `knee_${s}`, [0, -0.28, 0]);
    }
    r.joint('scarf0', 'neck', [0.13, 0.0, -0.12]);
    r.joint('scarf1', 'scarf0', [0, 0, -0.15]);
    r.joint('scarf2', 'scarf1', [0, 0, -0.15]);
    r.joint('scarf3', 'scarf2', [0, 0, -0.13]);

    // Jambes et bottes de sécurité
    for (const s of ['L', 'R']) {
      r.capsule(`hip_${s}`, cloth, [0, 0, 0], [0, -0.3, 0], 0.112);
      r.capsule(`knee_${s}`, cloth, [0, 0, 0], [0, -0.22, 0], 0.096);
      r.box(`knee_${s}`, clothDark, [0, -0.0, 0.07], [0.17, 0.14, 0.06], 0.03);
      r.box(`foot_${s}`, boots, [0, 0.035, 0.05], [0.21, 0.17, 0.34], 0.07);
      r.box(`foot_${s}`, m(0xff7a1a, 0.4), [0, -0.035, 0.05], [0.22, 0.035, 0.35], 0.012, {
        outline: false,
      });
    }
    r.box('pelvis', cloth, [0, 0, 0], [0.42, 0.2, 0.28], 0.08);
    r.box('pelvis', m(0x3a241c, 0.3), [0, 0.08, 0], [0.44, 0.06, 0.3], 0.025, { outline: false });
    r.box('spine', clothDark, [0, 0.04, 0], [0.4, 0.2, 0.27], 0.09);
    // Gilet haute visibilité : corps, bretelles et deux bandes réfléchissantes
    r.box('chest', vest, [0, 0.1, 0], [0.64, 0.44, 0.37], 0.13);
    r.box('chest', stripe, [0, 0.02, 0], [0.655, 0.05, 0.385], 0.02, { outline: false });
    r.box('chest', stripe, [0, 0.15, 0], [0.655, 0.05, 0.385], 0.02, { outline: false });
    r.box('chest', stripe, [0.15, 0.14, 0], [0.065, 0.28, 0.39], 0.02, { outline: false });
    r.box('chest', stripe, [-0.15, 0.14, 0], [0.065, 0.28, 0.39], 0.02, { outline: false });
    r.box('chest', clothDark, [0, 0.33, 0.0], [0.3, 0.06, 0.24], 0.03);
    // Logo SNCB au dos du gilet (autorisé par le porteur, LORE § 1.4)
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(0.27, 0.18),
      new THREE.MeshBasicMaterial({ map: sncbLogoTexture(), transparent: true }),
    );
    back.position.set(-0.08, 0.1, -0.2);
    back.rotation.y = Math.PI;
    back.userData.noGhost = true;
    r.j('chest').add(back);
    // Bras
    for (const s of ['L', 'R']) {
      r.sphere(`shoulder_${s}`, vest, [0, -0.01, 0], [0.155, 0.145, 0.16]);
      r.capsule(`shoulder_${s}`, cloth, [0, -0.04, 0], [0, -0.23, 0], 0.088);
      r.capsule(`elbow_${s}`, cloth, [0, 0, 0], [0, -0.17, 0], 0.08);
      r.sphere(`hand_${s}`, glove, [0, -0.04, 0], [0.105, 0.105, 0.105]);
    }
    // Tête : gros visage lisible, moustache, oreilles
    r.cyl('neck', skin, [0, 0.0, 0], 0.085, 0.12);
    r.sphere('head', skin, [0, 0.17, 0.01], [0.29, 0.28, 0.27]);
    r.sphere('head', hair, [0, 0.2, -0.08], [0.28, 0.22, 0.22]);
    for (const sx of [1, -1]) {
      r.sphere('head', skin, [0.285 * sx, 0.15, -0.0], [0.055, 0.075, 0.05]);
      r.sphere('head', eyes, [0.1 * sx, 0.2, 0.25], [0.038, 0.058, 0.03], {
        outline: false,
        shadow: false,
      });
      r.box('head', hair, [0.11 * sx, 0.285, 0.255], [0.12, 0.035, 0.04], 0.012, {
        rot: [0, 0, -12 * sx],
        outline: false,
        shadow: false,
      });
    }
    r.sphere('head', skin, [0, 0.13, 0.275], [0.055, 0.05, 0.05], { outline: false });
    r.box('head', hair, [0, 0.075, 0.255], [0.24, 0.055, 0.07], 0.025, { outline: false });
    // Écharpe syndicale
    r.cyl('neck', scarf, [0, -0.03, 0], 0.175, 0.13);
    r.box('scarf0', scarf, [0, 0, -0.07], [0.17, 0.055, 0.17], 0.02);
    r.box('scarf1', scarf, [0, 0, -0.07], [0.155, 0.05, 0.17], 0.02);
    r.box('scarf2', scarf, [0, 0, -0.07], [0.14, 0.045, 0.16], 0.02);
    r.box('scarf3', scarf, [0, 0, -0.05], [0.13, 0.04, 0.12], 0.02);

    r.j('head').add(this.buildHelmet());
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.05, 12).rotateX(Math.PI / 2),
      glow(0xfff0c0, 1.6),
    );
    lamp.position.set(0, 0.36, 0.31);
    lamp.userData.noGhost = true;
    r.j('head').add(lamp);
    r.j('hand_R').add(this.buildWrench());

    this.addSilhouette();
    this.headLight = new THREE.PointLight(0xffc98a, 5, 7, 1.5);
    this.rig.root.add(this.headLight);
    this.headLight.position.set(0, 3.4, 1.6);
  }

  /**
   * Silhouette tramée visible quand le héros est caché (pilier, mur) : chaque pièce reçoit un double
   * dessiné AVANT le héros avec un test de profondeur inversé (seulement là où autre chose est devant).
   */
  private addSilhouette(): void {
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        void main(){
          vec2 p = floor(gl_FragCoord.xy / 2.0);
          if (mod(p.x + p.y, 2.0) < 0.5) discard;
          gl_FragColor = vec4(1.0, 0.55, 0.15, 1.0);
        }`,
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
    });
    const targets: THREE.Mesh[] = [];
    this.rig.root.traverse((o) => {
      if (
        o instanceof THREE.Mesh &&
        o.userData.outline !== true &&
        o.userData.noGhost !== true &&
        !(o.material instanceof THREE.MeshBasicMaterial)
      )
        targets.push(o as THREE.Mesh);
    });
    this.rig.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.outline === true) o.renderOrder = 2;
    });
    for (const m of targets) {
      m.renderOrder = 2;
      const s = new THREE.Mesh(m.geometry, mat);
      s.renderOrder = 1;
      s.castShadow = false;
      s.userData.outline = true;
      s.raycast = () => undefined;
      m.add(s);
    }
  }

  private buildHelmet(): THREE.Group {
    const g = new THREE.Group();
    const shell = toon(C.helmet, { rimStrength: 1, flash: this.flash });
    const r = this.rig;
    const p = { parent: g };
    r.hemi('head', shell, [0, 0.25, -0.01], [0.315, 0.25, 0.335], p);
    r.cyl('head', shell, [0, 0.255, 0.0], 0.33, 0.035, { ...p, seg: 22 });
    r.box('head', shell, [0, 0.26, 0.33], [0.34, 0.035, 0.14], 0.015, p);
    r.box('head', shell, [0, 0.47, -0.01], [0.07, 0.07, 0.48], 0.03, p);
    r.box(
      'head',
      toon(0x2a2234, { flash: this.flash }),
      [0, 0.36, 0.29],
      [0.14, 0.09, 0.07],
      0.02,
      p,
    );
    g.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.outline !== true) o.castShadow = false;
    });
    return g;
  }

  private buildWrench(): THREE.Group {
    const g = new THREE.Group();
    const r = this.rig;
    const p = { parent: g };
    const steel = toon(C.steel, { rimStrength: 1.4, rim: PAL.rim, flash: this.flash });
    const dark = toon(C.steelDark, { rimStrength: 0.8, flash: this.flash });
    const grip = toon(0xd02a2a, { rimStrength: 0.6, flash: this.flash });
    const L = 0.98;
    // Le manche part vers l'avant de la main (+Z local) ; poignée en T au poing.
    r.cyl('hand_R', steel, [0, 0, L / 2 - 0.12], 0.038, L, { ...p, rot: [90, 0, 0] });
    r.cyl('hand_R', dark, [0, 0, -0.12], 0.034, 0.42, { ...p, rot: [0, 0, 90] });
    for (const sx of [1, -1])
      r.cyl('hand_R', grip, [0.16 * sx, 0, -0.12], 0.048, 0.12, { ...p, rot: [0, 0, 90] });
    r.cyl('hand_R', dark, [0, 0, L - 0.08], 0.095, 0.22, { ...p, rot: [90, 0, 0] });
    r.cyl('hand_R', steel, [0, 0, L + 0.04], 0.105, 0.05, { ...p, rot: [90, 0, 0] });
    return g;
  }

  public get root(): THREE.Object3D {
    return this.rig.root;
  }

  /** Orientation affichée (rotation Y du modèle). */
  public get facingYaw(): number {
    return this.yaw;
  }

  public punch(s: V3): void {
    this.rig.punchScale(s);
  }

  public hurt(): void {
    this.hurtFlash = 1;
    this.flash.color.value.setHex(0xff3060);
    this.rig.punchScale([1.2, 0.82, 1.2]);
  }

  /**
   * Pose le héros d'après la simulation. `alpha` interpole la position entre deux pas, `simDt` est le
   * temps de jeu écoulé (nul pendant le hitstop : la pose reste figée), `realDt` le temps réel.
   */
  public sync(sim: HeroSim, alpha: number, simDt: number, realDt: number): void {
    const b = sim.body;
    this.pos.set(
      pxToM(b.prevX + (b.x - b.prevX) * alpha),
      0,
      pxToM(b.prevY + (b.y - b.prevY) * alpha),
    );
    this.time += simDt;
    const state = sim.state;
    const target = yawFromAngle(state === 'dash' ? sim.dashAngle : sim.facingAngle);
    const snap = state === 'attack' || state === 'dashAttack' || state === 'dash';
    this.turnTo(target, simDt, snap ? 60 : 16);
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;

    // Flash de coup reçu
    this.hurtFlash = Math.max(0, this.hurtFlash - realDt * 6);
    this.flash.amount.value = this.hurtFlash * (this.reducedMotion ? 0.35 : 0.8);
    // Clignotement des i-frames (remplacé par une teinte fixe en réduction des mouvements)
    if (sim.blinking && state !== 'hurt') {
      if (this.reducedMotion) {
        this.rig.body.visible = true;
        this.flash.color.value.setHex(0xffe6c8);
        this.flash.amount.value = Math.max(this.flash.amount.value, 0.25);
      } else {
        this.rig.body.visible = Math.floor((this.time * 1000) / HERO.BLINK_MS) % 2 !== 0;
      }
    } else {
      this.rig.body.visible = true;
    }
    this.animate(sim, simDt);
  }

  private turnTo(target: number, dt: number, k: number): void {
    let d = target - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * (1 - Math.exp(-k * dt));
  }

  private animate(sim: HeroSim, dt: number): void {
    const t = sim.stateTime;
    const speed = Math.min(1, pxToM(Math.hypot(sim.body.vx, sim.body.vy)) / pxToM(HERO.SPEED));
    let pose: Pose;
    let k = 14;
    switch (sim.state) {
      case 'attack': {
        const idx = sim.combo;
        const nominal = NOMINAL_MS[idx] ?? NOMINAL_MS[0];
        pose = attackPose(idx, (t * nominal) / Math.max(1, sim.timing.totalMs));
        k = 32;
        break;
      }
      case 'dashAttack': {
        const total = DASH_ATTACK.startupMs + DASH_ATTACK.activeMs + DASH_ATTACK.recoveryMs;
        pose = attackPose(1, (t * NOMINAL_MS[1]) / total);
        k = 32;
        break;
      }
      case 'dash':
        pose = dashPose();
        k = 30;
        break;
      case 'hurt':
        pose = hurtPose(t);
        k = 24;
        break;
      case 'charge':
        pose = OVERHEAD(Math.min(14, t / 40));
        k = 18;
        break;
      case 'special': {
        const def = sim.specialKind === 'preavis' ? PREAVIS : WHISTLE;
        pose = attackPose(2, (t * NOMINAL_MS[2]) / (def.startupMs + def.activeMs + def.recoveryMs));
        k = 32;
        break;
      }
      case 'drink':
        pose = merge(idlePose(this.time), DRINK_ARM);
        k = 16;
        break;
      case 'dead':
        this.deathT += dt;
        pose = DEAD_POSE;
        k = 10;
        break;
      default:
        if (speed > 0.15) {
          this.runPhase += dt * (2 * Math.PI) * (1.9 * speed + 0.2);
          pose = keyed(
            [
              [0, idlePose(this.time)],
              [1, runPose(this.runPhase)],
            ],
            Math.min(1, speed * 1.4),
          );
        } else {
          pose = idlePose(this.time);
        }
    }
    if (sim.state !== 'dead') this.deathT = 0;
    // Écharpe : flotte derrière selon la vitesse, retombe au repos
    const targetV = sim.state === 'dash' ? 1.3 : sim.state === 'attack' ? 0.7 : speed;
    this.scarfV += (targetV - this.scarfV) * (1 - Math.exp(-5 * dt));
    const sv = this.scarfV;
    const time = this.time;
    const w = (ph: number, a: number): number =>
      Math.sin(time * (6 + sv * 8) + ph) * a * (0.4 + sv);
    const p = editable(pose);
    p.rot.scarf0 = [-68 + sv * 52 + w(0, 6), 14 - sv * 10 + w(0.5, 8), 0];
    p.rot.scarf1 = [-12 + sv * 8 + w(1.2, 12), w(1.6, 10), 0];
    p.rot.scarf2 = [-6 + w(2.4, 16), w(2.8, 12), 0];
    p.rot.scarf3 = [-4 + w(3.6, 20), w(3.9, 14), 0];
    this.rig.apply(p, dt, k);
    // Chute en arrière à la mort.
    this.rig.body.rotation.x = -Math.min(1, this.deathT / 0.5) * 1.35;
  }

  public dispose(): void {
    this.rig.dispose();
  }
}

// ─── Poses ────────────────────────────────────────────────────────────────────

function idlePose(t: number): Pose {
  const b = Math.sin((t * 2 * Math.PI) / 2.6);
  return {
    rot: {
      spine: [7 + b * 1.4, 0, 0],
      chest: [-3 - b * 2, 0, 0],
      head: [-3 + b * 1.2, 0, 0],
      shoulder_L: [-6 + b * 2, 0, 13 + b * 2.5],
      elbow_L: [-32, 0, 0],
      shoulder_R: [-20 + b * 2, 0, -16 - b * 2],
      elbow_R: [-42, 0, 0],
      hand_R: [58, 8, 0],
      hip_L: [-7, 0, 8],
      knee_L: [16, 0, 0],
      foot_L: [-9, 0, -8],
      hip_R: [9, 0, -8],
      knee_R: [13, 0, 0],
      foot_R: [-22, 0, 8],
    },
    root: [0, -0.025 + b * 0.012, 0],
    scale: [1 + b * 0.012, 1 - b * 0.008, 1 + b * 0.012],
  };
}

function runPose(ph: number): Pose {
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const a = 40 * s;
  const kl = 18 + 78 * Math.max(0, c);
  const kr = 18 + 78 * Math.max(0, -c);
  return {
    rot: {
      pelvis: [0, 9 * s, 0],
      spine: [17, -5 * s, 0],
      chest: [-2, -14 * s, 0],
      head: [-12, 7 * s, 0],
      shoulder_L: [a * 0.95, 0, 12],
      elbow_L: [-72 + 18 * s, 0, 0],
      shoulder_R: [-a * 0.45 + 8, 0, -16],
      elbow_R: [-80, 0, 0],
      hand_R: [30, 0, 0],
      hip_L: [-a - 8, 0, 4],
      knee_L: [kl, 0, 0],
      foot_L: [-(-a - 8 + kl) * 0.45, 0, 0],
      hip_R: [a - 8, 0, -4],
      knee_R: [kr, 0, 0],
      foot_R: [-(a - 8 + kr) * 0.45, 0, 0],
    },
    root: [0, -0.05 + 0.08 * Math.abs(c), 0],
    scale: [1, 1 + 0.04 * Math.abs(c) - 0.02, 1],
  };
}

function dashPose(): Pose {
  return {
    rot: {
      spine: [34, 0, 0],
      chest: [8, 0, 0],
      head: [-24, 0, 0],
      shoulder_L: [58, 0, 28],
      elbow_L: [-24, 0, 0],
      shoulder_R: [52, 0, -28],
      elbow_R: [-26, 0, 0],
      hand_R: [100, 0, 0],
      hip_L: [-62, 0, 4],
      knee_L: [88, 0, 0],
      foot_L: [-10, 0, 0],
      hip_R: [38, 0, -4],
      knee_R: [34, 0, 0],
      foot_R: [-20, 0, 0],
    },
    root: [0, 0.14, 0],
    scale: [0.86, 0.92, 1.28],
  };
}

function hurtPose(t: number): Pose {
  const k = Math.min(1, t / 80);
  return {
    rot: {
      spine: [-20 * k, 0, 6],
      chest: [-10 * k, 0, 0],
      head: [-24 * k, 0, 0],
      shoulder_L: [-30, 0, 48],
      elbow_L: [-40, 0, 0],
      shoulder_R: [-26, 0, -50],
      elbow_R: [-40, 0, 0],
      hand_R: [70, 0, 0],
      hip_L: [-24, 0, 8],
      knee_L: [30, 0, 0],
      hip_R: [16, 0, -8],
      knee_R: [26, 0, 0],
      foot_R: [-40, 0, 0],
    },
    root: [0, -0.06, -0.12 * k],
  };
}

const DRINK_ARM: Readonly<Record<string, V3>> = {
  shoulder_L: [-128, 0, -26],
  elbow_L: [-112, 0, 0],
  head: [-14, 0, 0],
};

const DEAD_POSE: Pose = {
  rot: {
    spine: [-10, 0, 0],
    head: [-30, 20, 0],
    shoulder_L: [-150, 0, 50],
    elbow_L: [-20, 0, 0],
    shoulder_R: [-140, 0, -60],
    elbow_R: [-20, 0, 0],
    hand_R: [60, 0, 0],
    hip_L: [-40, 0, 14],
    knee_L: [50, 0, 0],
    hip_R: [-10, 0, -10],
    knee_R: [20, 0, 0],
  },
  root: [0, -0.3, 0],
};

/** Pose de coup horizontal : `yaw` = direction du bras (degrés, 0 = devant, + = vers sa gauche). */
function sw(yaw: number, arm = -88, lean = 10, lunge = 0): Pose {
  return {
    rot: {
      pelvis: [0, yaw * 0.15, 0],
      spine: [lean, yaw * 0.2, 0],
      chest: [0, yaw * 0.3, 0],
      head: [-lean * 0.6, -yaw * 0.4, 0],
      shoulder_R: [arm, yaw * 0.4, -8],
      elbow_R: [-10, 0, 0],
      hand_R: [84, 0, 0],
      shoulder_L: [-30, -yaw * 0.2, 42],
      elbow_L: [-78, 0, 0],
      hip_L: [-30 - lunge, 0, 7],
      knee_L: [32 + lunge, 0, 0],
      foot_L: [-2, 0, -6],
      hip_R: [24, 0, -7],
      knee_R: [24, 0, 0],
      foot_R: [-46, 0, 6],
    },
    root: [0, -0.1 - lunge * 0.004, 0.04 + lunge * 0.006],
  };
}

function OVERHEAD(extra: number): Pose {
  return {
    rot: {
      spine: [-14 - extra * 0.4, 0, 0],
      chest: [-10 - extra * 0.3, 0, 0],
      head: [8, 0, 0],
      shoulder_R: [-172 - extra, 0, 14],
      elbow_R: [-34, 0, 0],
      hand_R: [72, 0, 0],
      shoulder_L: [-166 - extra, 0, -26],
      elbow_L: [-46, 0, 0],
      hip_L: [-22, 0, 8],
      knee_L: [38, 0, 0],
      foot_L: [-16, 0, 0],
      hip_R: [10, 0, -8],
      knee_R: [32, 0, 0],
      foot_R: [-42, 0, 0],
    },
    root: [0, 0.04 + extra * 0.006, -0.06],
    scale: [0.95, 1.06 + extra * 0.003, 0.95],
  };
}

const SLAM: Pose = {
  rot: {
    spine: [40, 0, 0],
    chest: [12, 0, 0],
    head: [-26, 0, 0],
    shoulder_R: [-98, 0, 10],
    elbow_R: [-6, 0, 0],
    hand_R: [106, 0, 0],
    shoulder_L: [-96, 0, -16],
    elbow_L: [-12, 0, 0],
    hip_L: [-56, 0, 8],
    knee_L: [76, 0, 0],
    foot_L: [-20, 0, 0],
    hip_R: [34, 0, -8],
    knee_R: [52, 0, 0],
    foot_R: [-80, 0, 0],
  },
  root: [0, -0.26, 0.22],
  scale: [1.1, 0.86, 1.06],
};

function attackPose(idx: number, t: number): Pose {
  if (idx === 0) {
    return keyed(
      [
        [0, sw(-50, -70, 6)],
        [90, sw(-118, -84, 4), easeOut],
        [150, sw(78, -88, 16, 12), easeIn],
        [215, sw(104, -80, 14, 12), easeOut],
        [310, sw(70, -55, 8)],
      ],
      t,
    );
  }
  if (idx === 1) {
    return keyed(
      [
        [0, sw(70, -60, 6)],
        [80, sw(112, -80, 4), easeOut],
        [140, sw(-82, -92, 16, 12), easeIn],
        [205, sw(-108, -84, 14, 12), easeOut],
        [310, sw(-60, -55, 8)],
      ],
      t,
    );
  }
  return keyed(
    [
      [0, sw(0, -60, 4)],
      [120, OVERHEAD(0), easeOut],
      [200, OVERHEAD(14), easeOut],
      [250, SLAM, easeIn],
      [420, merge(SLAM, {}, { root: [0, -0.24, 0.22], scale: [1.02, 0.96, 1.02] })],
      [600, sw(0, -50, 8)],
    ],
    t,
  );
}
