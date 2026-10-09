// Consultant Junior en 3D : costume turquoise trop court (chaussettes visibles), baskets blanches,
// cravate magenta qui flotte, houppe gominée, laptop. Modèle et poses repris du prototype validé
// (prototypes/proto3d/src/consultant.ts) ; il lit l'état de `EnemySim` et affiche son télégraphe au sol
// à la forme exacte de la hitbox logique.
import * as THREE from 'three';
import { CONSULTANT } from '@/config/balance';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import { pxToM, yawFromAngle } from '@/sim/units';
import type { ActorFrame, EnemyView } from '@/view/actors/ActorView';
import type { GroundTelegraph } from '@/view/fx/effects';
import { ArcTelegraph, DiscTelegraph, RectTelegraph } from '@/view/fx/effects';
import type { Flash } from '@/view/materials/toon';
import { glow, makeFlash, PAL, toon } from '@/view/materials/toon';
import type { Pose, V3 } from '@/view/rig';
import { easeIn, easeOut, editable, keyed, Rig } from '@/view/rig';

/** Durée de la chute et de la dissolution du corps (s), au-delà de la fin du corps dans la sim. */
const DEATH_FALL_S = 1.5;
const DEATH_DISSOLVE_S = 0.6;

export class ConsultantView implements EnemyView {
  public readonly rig = new Rig();
  public readonly flash: Flash = makeFlash();
  public readonly pos = new THREE.Vector3();
  /** Vrai quand l'animation de mort est terminée : la vue peut être libérée. */
  public finished = false;
  private readonly screenMat: THREE.MeshBasicMaterial;
  private readonly logoMat: THREE.MeshBasicMaterial;
  private readonly hpBar = new THREE.Group();
  private readonly hpFill: THREE.Mesh;
  private readonly arcTele: ArcTelegraph;
  private readonly lineTele: RectTelegraph;
  private readonly spawnTele: DiscTelegraph;
  private yaw = 0;
  private walkPhase = Math.random() * 6;
  private tieV = 0;
  private hitFlash = 0;
  private time = Math.random() * 10;
  private dead = false;
  private deathT = 0;
  private readonly deathVel = new THREE.Vector3();
  private readonly deathKb = new THREE.Vector3();
  private materialized = false;
  private spawnT = 0;

  /** Géométries propres à cette instance (les autres viennent des caches partagés). */
  private readonly ownGeos: THREE.BufferGeometry[] = [];

  public constructor(
    scene: THREE.Scene,
    private readonly reducedMotion: boolean,
  ) {
    const f = this.flash;
    const m = (
      c: number,
      rim = 0.9,
      o: { rim?: number; emissive?: number; emissiveIntensity?: number } = {},
    ): THREE.MeshToonMaterial =>
      toon(c, {
        rimStrength: rim,
        rim: o.rim ?? 0xff7ac8,
        flash: f,
        emissive: o.emissive ?? 0,
        emissiveIntensity: o.emissiveIntensity ?? 1,
      });
    const suit = m(0x19c3b1, 1.0);
    const suitDark = m(0x0f7f7a, 0.6);
    const shirt = m(0xf2f4fa, 0.4);
    const tie = m(0xff3ea5, 0.5, { emissive: 0xff3ea5, emissiveIntensity: 0.25 });
    const skin = m(0xf2bc90, 0.7, { rim: PAL.rim });
    const hair = m(0x24161c, 0.5, { rim: PAL.rim });
    const socks = m(0x8c6ca6, 0.3);
    const sneaker = m(0xf4f6ff, 0.5);
    const shell = m(0x4c5c88, 0.8, { rim: PAL.rim });
    const eyes = m(0x14101a, 0);
    const r = this.rig;

    r.joint('pelvis', null, [0, 0.62, 0]);
    r.joint('spine', 'pelvis', [0, 0.1, 0]);
    r.joint('chest', 'spine', [0, 0.15, 0]);
    r.joint('neck', 'chest', [0, 0.28, 0]);
    r.joint('head', 'neck', [0, 0.05, 0]);
    for (const [s, sx] of [
      ['L', 1],
      ['R', -1],
    ] as const) {
      r.joint(`shoulder_${s}`, 'chest', [0.27 * sx, 0.18, 0]);
      r.joint(`elbow_${s}`, `shoulder_${s}`, [0, -0.21, 0]);
      r.joint(`hand_${s}`, `elbow_${s}`, [0, -0.2, 0]);
      r.joint(`hip_${s}`, 'pelvis', [0.1 * sx, -0.02, 0]);
      r.joint(`knee_${s}`, `hip_${s}`, [0, -0.29, 0]);
      r.joint(`foot_${s}`, `knee_${s}`, [0, -0.28, 0]);
    }
    r.joint('tie0', 'chest', [0, 0.22, 0.15]);
    r.joint('tie1', 'tie0', [0, -0.14, 0]);
    r.joint('laptop', 'hand_R', [0, -0.05, 0]);
    r.joint('lid', 'laptop', [0, 0.016, -0.14]);

    // Jambes : pantalon trop court, chaussettes, baskets blanches
    for (const s of ['L', 'R']) {
      r.capsule(`hip_${s}`, suit, [0, 0, 0], [0, -0.29, 0], 0.088);
      r.capsule(`knee_${s}`, suit, [0, 0, 0], [0, -0.14, 0], 0.076);
      r.capsule(`knee_${s}`, socks, [0, -0.16, 0], [0, -0.24, 0], 0.058);
      r.box(`foot_${s}`, sneaker, [0, 0.035, 0.05], [0.16, 0.13, 0.3], 0.055);
      r.box(`foot_${s}`, m(0xff3ea5, 0.2), [0, -0.025, 0.05], [0.165, 0.03, 0.305], 0.01, {
        outline: false,
      });
    }
    r.box('pelvis', suit, [0, 0, 0], [0.36, 0.17, 0.24], 0.07);
    r.box('spine', suit, [0, 0.03, 0], [0.37, 0.18, 0.25], 0.08);
    // Veste cintrée + revers + chemise + col
    r.box('chest', suit, [0, 0.09, 0], [0.48, 0.38, 0.29], 0.1);
    r.box('chest', shirt, [0, 0.14, 0.135], [0.15, 0.24, 0.04], 0.015, { outline: false });
    for (const sx of [1, -1])
      r.box('chest', suitDark, [0.09 * sx, 0.15, 0.142], [0.07, 0.26, 0.03], 0.012, {
        rot: [0, 0, 16 * sx],
        outline: false,
      });
    r.box('chest', shirt, [0, 0.27, 0.02], [0.27, 0.06, 0.2], 0.025);
    // Badge (cordon magenta, carte turquoise)
    r.box('chest', m(0xff3ea5, 0.2), [0.12, 0.12, 0.148], [0.018, 0.2, 0.01], 0.004, {
      outline: false,
      rot: [0, 0, 10],
    });
    r.box(
      'chest',
      m(0x5ff7e4, 0.3, { emissive: 0x19c3b1, emissiveIntensity: 0.4 }),
      [0.14, 0.01, 0.15],
      [0.07, 0.09, 0.012],
      0.008,
      { outline: false },
    );
    // Cravate
    r.box('tie0', tie, [0, 0.0, 0.0], [0.07, 0.05, 0.05], 0.015, { outline: false });
    r.box('tie0', tie, [0, -0.08, 0.0], [0.075, 0.14, 0.025], 0.01);
    r.box('tie1', tie, [0, -0.07, 0.0], [0.095, 0.15, 0.025], 0.01);
    // Bras (manches trop courtes, poignets blancs)
    for (const s of ['L', 'R']) {
      r.sphere(`shoulder_${s}`, suit, [0, -0.01, 0], [0.105, 0.1, 0.11]);
      r.capsule(`shoulder_${s}`, suit, [0, -0.02, 0], [0, -0.21, 0], 0.07);
      r.capsule(`elbow_${s}`, suit, [0, 0, 0], [0, -0.13, 0], 0.064);
      r.cyl(`hand_${s}`, shirt, [0, 0.05, 0], 0.062, 0.05);
      r.sphere(`hand_${s}`, skin, [0, -0.02, 0], [0.078, 0.082, 0.078]);
    }
    // Tête : houppe gominée, oreillette magenta, sourire satisfait
    r.cyl('neck', skin, [0, 0, 0], 0.075, 0.1);
    r.sphere('head', skin, [0, 0.15, 0.0], [0.25, 0.24, 0.235]);
    r.sphere('head', hair, [0, 0.2, -0.06], [0.245, 0.2, 0.2]);
    r.sphere('head', hair, [0, 0.31, -0.01], [0.22, 0.1, 0.21]);
    r.sphere('head', hair, [0.04, 0.34, 0.13], [0.15, 0.1, 0.11], { rot: [-20, 0, -8] });
    for (const sx of [1, -1]) {
      r.sphere('head', eyes, [0.085 * sx, 0.17, 0.215], [0.03, 0.04, 0.025], {
        outline: false,
        shadow: false,
      });
      r.box('head', hair, [0.09 * sx, 0.235, 0.22], [0.09, 0.025, 0.03], 0.01, {
        rot: [0, 0, 14 * sx],
        outline: false,
        shadow: false,
      });
      r.sphere('head', skin, [0.245 * sx, 0.14, 0], [0.045, 0.06, 0.045]);
    }
    r.box('head', m(0x8a0f52, 0), [0, 0.08, 0.215], [0.11, 0.022, 0.03], 0.01, {
      rot: [0, 0, 6],
      outline: false,
      shadow: false,
    });
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), glow(PAL.danger, 4));
    ear.position.set(-0.27, 0.14, 0.03);
    r.j('head').add(ear);
    this.ownGeos.push(ear.geometry);

    // Laptop : socle à plat (XZ), charnière à l'arrière (z = -0.14). L'écran sert de télégraphe.
    r.box('laptop', shell, [0, 0, 0], [0.42, 0.03, 0.28], 0.012);
    r.box('laptop', m(0x1a2140, 0), [0, 0.016, 0.01], [0.36, 0.004, 0.18], 0.0, {
      outline: false,
      shadow: false,
    });
    r.box('lid', shell, [0, 0.014, 0.14], [0.42, 0.026, 0.28], 0.012);
    this.screenMat = glow(0x2a3a6a, 1);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.24), this.screenMat);
    screen.rotation.x = Math.PI / 2;
    screen.position.set(0, -0.001, 0.14);
    r.j('lid').add(screen);
    this.logoMat = glow(PAL.enemy, 2.5);
    const logo = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), this.logoMat);
    logo.rotation.x = -Math.PI / 2;
    logo.position.set(0, 0.029, 0.14);
    r.j('lid').add(logo);
    this.ownGeos.push(screen.geometry, logo.geometry);

    // Barre de vie flottante
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.09),
      new THREE.MeshBasicMaterial({
        color: 0x14101a,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      }),
    );
    this.hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.055).translate(0.43, 0, 0),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(PAL.danger).multiplyScalar(1.6),
        depthTest: false,
      }),
    );
    this.hpFill.position.set(-0.43, 0, 0.001);
    bg.renderOrder = 30;
    this.hpFill.renderOrder = 31;
    this.hpBar.add(bg, this.hpFill);
    this.ownGeos.push(bg.geometry, this.hpFill.geometry);
    this.hpBar.visible = false;

    // Télégraphes : formes exactes des attaques logiques (m).
    this.arcTele = new ArcTelegraph(
      pxToM(CONSULTANT.MELEE_REACH),
      CONSULTANT.MELEE_ARC_DEG,
      PAL.danger,
    );
    this.lineTele = new RectTelegraph(
      pxToM(CONSULTANT.QW_WIDTH),
      pxToM(CONSULTANT.QW_DISTANCE),
      PAL.danger,
    );
    this.spawnTele = new DiscTelegraph(0.45, PAL.danger);
    this.rig.root.scale.setScalar(0.01);
    this.rig.root.visible = false;
    scene.add(
      this.rig.root,
      this.hpBar,
      this.arcTele.mesh,
      this.lineTele.mesh,
      this.spawnTele.mesh,
    );
  }

  public get root(): THREE.Object3D {
    return this.rig.root;
  }

  public update(sim: EnemySim | null, f: ActorFrame): void {
    this.sync(sim, f.alpha, f.simDt, f.realDt, f.camera, f.time);
  }

  public get isDying(): boolean {
    return this.dead;
  }

  public hit(heavy: boolean): void {
    this.hitFlash = 1;
    this.flash.color.value.setRGB(0.92, 0.9, 0.95);
    this.rig.punchScale(heavy ? [1.25, 0.75, 1.25] : [1.15, 0.88, 1.15]);
  }

  /** Mort : le corps est projeté dans la direction du coup (la vue prend le relais de la sim). */
  public die(angle: number): void {
    if (this.dead) return;
    this.dead = true;
    this.deathT = 0;
    this.hpBar.visible = false;
    this.deathKb.set(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(5.5);
    this.deathVel.set(0, 6.5, 0);
    this.arcTele.mesh.visible = false;
    this.lineTele.mesh.visible = false;
    this.setScreen(false);
  }

  private setScreen(on: boolean, k = 1): void {
    if (on) {
      this.screenMat.color.setHex(PAL.danger).multiplyScalar(1.5 + 3.5 * k);
      this.logoMat.color.setHex(PAL.danger).multiplyScalar(2 + 3 * k);
    } else {
      this.screenMat.color.setHex(0x2a3a6a);
      this.logoMat.color.setHex(PAL.enemy).multiplyScalar(2.5);
    }
  }

  /** Pose d'après l'ennemi simulé (ou poursuit l'animation de mort si `sim` a disparu). */
  public sync(
    sim: EnemySim | null,
    alpha: number,
    simDt: number,
    realDt: number,
    cam: THREE.Camera,
    time: number,
  ): void {
    this.time += simDt;
    if (sim && !this.dead) {
      const b = sim.body;
      this.pos.set(
        pxToM(b.prevX + (b.x - b.prevX) * alpha),
        0,
        pxToM(b.prevY + (b.y - b.prevY) * alpha),
      );
      this.syncAlive(sim, simDt, time);
    } else {
      this.syncDeath(simDt);
    }
    this.rig.root.position.x = this.pos.x;
    this.rig.root.position.z = this.pos.z;
    this.rig.root.rotation.y = this.yaw;
    this.hitFlash = Math.max(0, this.hitFlash - realDt * 9);
    const peak = this.reducedMotion ? 0.4 : 0.8;
    this.flash.amount.value = this.hitFlash > 0.01 ? Math.min(peak, this.hitFlash * 1.2) : 0;
    if (this.hpBar.visible) {
      this.hpBar.position.set(this.pos.x, 2.25, this.pos.z);
      this.hpBar.quaternion.copy(cam.quaternion);
    }
  }

  private syncAlive(sim: EnemySim, dt: number, time: number): void {
    const state = sim.state;
    // Apparition : disque magenta qui se remplit, puis « pop » du corps.
    if (state === 'spawn' && !sim.materialized) {
      this.spawnTele.mesh.visible = true;
      this.spawnTele.mesh.position.set(this.pos.x, 0.035, this.pos.z);
      this.spawnTele.set(sim.windupProgress, Math.min(1, sim.windupProgress * 4), time);
      this.rig.root.visible = false;
      this.yaw = yawFromAngle(sim.facing);
      return;
    }
    this.spawnTele.mesh.visible = false;
    if (!this.materialized) {
      this.materialized = true;
      this.rig.root.visible = true;
      this.spawnT = 0;
    }
    if (this.spawnT < 0.45) {
      this.spawnT += dt;
      const k = Math.min(1, this.spawnT / 0.45);
      const s = k < 0.7 ? easeOut(k / 0.7) * 1.15 : 1.15 - 0.15 * ((k - 0.7) / 0.3);
      this.rig.root.scale.setScalar(Math.max(0.01, s));
    } else this.rig.root.scale.setScalar(1);

    const target = yawFromAngle(sim.facing);
    this.turnTo(target, dt, state === 'windup' || state === 'attack' ? 40 : 8);
    if (sim.hp < sim.maxHp) this.hpBar.visible = true;
    this.hpFill.scale.x = Math.max(0.001, sim.hp / sim.maxHp);

    // Télégraphe au sol (forme et orientation figées au début du windup).
    const tele = sim.telegraph?.kind === 'circle' ? null : sim.telegraph;
    const k = sim.windupProgress;
    this.arcTele.mesh.visible = tele?.kind === 'arc';
    this.lineTele.mesh.visible = tele?.kind === 'line';
    if (tele) {
      const t: GroundTelegraph = tele.kind === 'arc' ? this.arcTele : this.lineTele;
      t.mesh.position.set(pxToM(tele.x), 0.03, pxToM(tele.y));
      t.mesh.rotation.y = yawFromAngle(tele.angle);
      t.set(Math.min(1, k * 1.05), Math.min(1, k * 4), time);
    }
    this.setScreen(state === 'windup', k);
    this.animate(sim, dt);
  }

  private syncDeath(dt: number): void {
    this.arcTele.mesh.visible = false;
    this.lineTele.mesh.visible = false;
    this.spawnTele.mesh.visible = false;
    if (!this.dead) this.die(0);
    this.deathT += dt;
    const p = this.rig.root.position;
    this.deathVel.y -= 22 * dt;
    p.y += this.deathVel.y * dt;
    if (p.y <= 0 && this.deathVel.y < 0) {
      p.y = 0;
      this.deathVel.y = Math.abs(this.deathVel.y) > 3 ? -this.deathVel.y * 0.3 : 0;
      this.deathKb.multiplyScalar(0.4);
    }
    this.pos.addScaledVector(this.deathKb, dt);
    this.deathKb.multiplyScalar(Math.exp(-6 * dt));
    this.rig.body.rotation.x = -Math.min(1, this.deathT / 0.38) * 1.45;
    this.rig.apply(DEAD, dt, 10);
    if (this.deathT > DEATH_FALL_S) {
      const k = Math.min(1, (this.deathT - DEATH_FALL_S) / DEATH_DISSOLVE_S);
      this.rig.root.scale.setScalar(Math.max(0.01, 1 - k * 0.9));
      p.y = -k * 0.6;
      if (k >= 1) this.finished = true;
    }
  }

  private turnTo(target: number, dt: number, k: number): void {
    let d = target - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * (1 - Math.exp(-k * dt));
  }

  private animate(sim: EnemySim, dt: number): void {
    const time = this.time;
    const sp = Math.min(1, pxToM(Math.hypot(sim.body.vx, sim.body.vy)) / 2.7);
    const t = sim.stateTime;
    const rush = sim.currentAttack === 'quickwin';
    let pose: Pose;
    let k = 12;
    switch (sim.state) {
      case 'windup': {
        const total = rush ? CONSULTANT.QW_TELEGRAPH_MS : CONSULTANT.MELEE_TELEGRAPH_MS;
        pose = rush
          ? keyed(
              [
                [0, idle(time)],
                [total * 0.5, CROUCH, easeOut],
                [total, CROUCH],
              ],
              t,
            )
          : keyed(
              [
                [0, idle(time)],
                [total * 0.45, RAISE(0), easeOut],
                [total, RAISE(1)],
              ],
              t,
            );
        k = 18;
        break;
      }
      case 'attack':
        if (rush) {
          this.walkPhase += dt * Math.PI * 2 * 3.2;
          pose = RUSH(this.walkPhase);
          k = 30;
        } else {
          pose = keyed(
            [
              [0, RAISE(1)],
              [70, SLAM, easeIn],
              [120, SLAM],
            ],
            t,
          );
          k = 45;
        }
        break;
      case 'recover':
        pose = rush
          ? keyed(
              [
                [0, STUMBLE],
                [CONSULTANT.QW_RECOVERY_MS, idle(time)],
              ],
              t,
            )
          : keyed(
              [
                [0, SLAM],
                [330, SLAM],
                [CONSULTANT.MELEE_RECOVERY_MS, idle(time)],
              ],
              t,
            );
        k = 14;
        break;
      case 'stagger':
        pose = HURT;
        k = 30;
        break;
      default:
        pose = sp > 0.1 ? walk(this.walkPhase, sp) : idle(time);
        if (sp > 0.1) this.walkPhase += dt * Math.PI * 2 * (1.6 * sp + 0.4);
    }
    // Cravate : traîne selon la vitesse
    const tv = sim.state === 'stagger' ? 1.4 : sp;
    this.tieV += (tv - this.tieV) * (1 - Math.exp(-6 * dt));
    const p = editable(pose);
    p.rot.tie0 = [
      -8 - this.tieV * 30 + Math.sin(time * 9) * 6 * this.tieV,
      0,
      Math.sin(time * 7) * 8 * this.tieV,
    ];
    p.rot.tie1 = [-6 - this.tieV * 30 + Math.sin(time * 11 + 1) * 10 * this.tieV, 0, 0];
    this.rig.apply(p, dt, k);
    // Tremblement de fin de télégraphe (coupé en réduction des mouvements)
    if (!this.reducedMotion && sim.state === 'windup' && sim.windupProgress > 0.6)
      this.rig.body.position.x += (Math.random() - 0.5) * 0.05;
  }

  public dispose(): void {
    // Matériaux propres à l'instance (toon et émissifs) ; les contours partagent un matériau en cache.
    this.rig.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.outline !== true)
        (o.material as THREE.Material).dispose();
    });
    this.hpBar.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
    });
    for (const g of this.ownGeos) g.dispose();
    this.rig.dispose();
    this.hpBar.removeFromParent();
    this.arcTele.dispose();
    this.lineTele.dispose();
    this.spawnTele.dispose();
  }
}

// Laptop au repos : fermé, porté à la verticale le long de la jambe (repère de la main)
const LAPTOP_CARRY: V3 = [0, 90, 90];

function idle(t: number): Pose {
  const b = Math.sin(t * 2.2);
  return {
    rot: {
      spine: [-3 + b, 0, 0],
      chest: [-4 - b * 1.5, 0, 0],
      head: [-8 + b, 0, 4],
      shoulder_L: [8, 0, 22],
      elbow_L: [-95, 0, 10],
      hand_L: [0, 0, 0],
      shoulder_R: [4 + b * 2, 0, -8],
      elbow_R: [-8, 0, 0],
      laptop: LAPTOP_CARRY,
      lid: [0, 0, 0],
      hip_L: [-4, 0, 6],
      knee_L: [6, 0, 0],
      foot_L: [-2, 0, 0],
      hip_R: [4, 0, -6],
      knee_R: [6, 0, 0],
      foot_R: [-10, 0, 0],
    },
    root: [0, -0.008 + b * 0.01, 0],
  };
}

function walk(ph: number, sp: number): Pose {
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const a = 30 * s * (0.5 + sp * 0.5);
  return {
    rot: {
      pelvis: [0, 6 * s, 3 * s],
      spine: [6, -4 * s, 0],
      chest: [-4, -8 * s, 0],
      head: [-8, 5 * s, 0],
      shoulder_L: [a * 0.8, 0, 12],
      elbow_L: [-40, 0, 0],
      shoulder_R: [-a * 0.3, 0, -8],
      elbow_R: [-10, 0, 0],
      laptop: LAPTOP_CARRY,
      lid: [0, 0, 0],
      hip_L: [-a - 4, 0, 4],
      knee_L: [10 + 55 * Math.max(0, c), 0, 0],
      foot_L: [0, 0, 0],
      hip_R: [a - 4, 0, -4],
      knee_R: [10 + 55 * Math.max(0, -c), 0, 0],
      foot_R: [0, 0, 0],
    },
    root: [0, -0.03 + 0.05 * Math.abs(c), 0],
  };
}

/** Laptop levé à deux mains au-dessus de la tête, ouvert, écran vers la cible. */
function RAISE(k: number): Pose {
  return {
    rot: {
      spine: [-12 - 8 * k, 0, 0],
      chest: [-10 - 6 * k, 0, 0],
      head: [6, 0, 0],
      shoulder_R: [-160 - 12 * k, 0, 22],
      elbow_R: [-40, 0, 0],
      hand_R: [0, 0, 0],
      shoulder_L: [-160 - 12 * k, 0, -22],
      elbow_L: [-40, 0, 0],
      laptop: [-90 - 20 * k, 0, 0],
      lid: [-110, 0, 0],
      hip_L: [-14, 0, 6],
      knee_L: [20, 0, 0],
      foot_L: [-6, 0, 0],
      hip_R: [10, 0, -6],
      knee_R: [18, 0, 0],
      foot_R: [-28, 0, 0],
    },
    root: [0, 0.02 + 0.04 * k, -0.06],
    scale: [0.96, 1.05, 0.96],
  };
}

const SLAM: Pose = {
  rot: {
    spine: [38, 0, 0],
    chest: [14, 0, 0],
    head: [-20, 0, 0],
    shoulder_R: [-80, 0, 16],
    elbow_R: [-10, 0, 0],
    shoulder_L: [-80, 0, -16],
    elbow_L: [-10, 0, 0],
    laptop: [-170, 0, 0],
    lid: [-100, 0, 0],
    hip_L: [-44, 0, 6],
    knee_L: [60, 0, 0],
    foot_L: [-16, 0, 0],
    hip_R: [26, 0, -6],
    knee_R: [40, 0, 0],
    foot_R: [-66, 0, 0],
  },
  root: [0, -0.2, 0.18],
  scale: [1.08, 0.9, 1.08],
};

/** « Quick win » : accroupi, laptop sous le bras, prêt à se ruer. */
const CROUCH: Pose = {
  rot: {
    spine: [30, 0, 0],
    chest: [10, 0, 0],
    head: [-24, 0, 0],
    shoulder_L: [30, 0, 30],
    elbow_L: [-60, 0, 0],
    shoulder_R: [-20, 0, -20],
    elbow_R: [-90, 0, 0],
    laptop: LAPTOP_CARRY,
    hip_L: [-50, 0, 8],
    knee_L: [80, 0, 0],
    foot_L: [-20, 0, 0],
    hip_R: [30, 0, -8],
    knee_R: [60, 0, 0],
    foot_R: [-40, 0, 0],
  },
  root: [0, -0.18, -0.05],
  scale: [1.06, 0.92, 1.06],
};

function RUSH(ph: number): Pose {
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  return {
    rot: {
      spine: [36, -6 * s, 0],
      chest: [6, -10 * s, 0],
      head: [-26, 0, 0],
      shoulder_L: [40 * s, 0, 20],
      elbow_L: [-70, 0, 0],
      shoulder_R: [-30, 0, -14],
      elbow_R: [-90, 0, 0],
      laptop: LAPTOP_CARRY,
      hip_L: [-50 * s - 10, 0, 4],
      knee_L: [20 + 80 * Math.max(0, c), 0, 0],
      hip_R: [50 * s - 10, 0, -4],
      knee_R: [20 + 80 * Math.max(0, -c), 0, 0],
    },
    root: [0, -0.04 + 0.06 * Math.abs(c), 0.06],
    scale: [0.94, 0.96, 1.12],
  };
}

const STUMBLE: Pose = {
  rot: {
    spine: [44, 0, 10],
    chest: [16, 0, 0],
    head: [-10, 20, 0],
    shoulder_L: [-60, 0, 50],
    elbow_L: [-30, 0, 0],
    shoulder_R: [-40, 0, -50],
    elbow_R: [-30, 0, 0],
    laptop: LAPTOP_CARRY,
    hip_L: [-40, 0, 8],
    knee_L: [50, 0, 0],
    hip_R: [20, 0, -8],
    knee_R: [30, 0, 0],
  },
  root: [0, -0.16, 0.1],
};

const HURT: Pose = {
  rot: {
    spine: [-22, 0, 8],
    chest: [-12, 0, 0],
    head: [-26, 0, 10],
    shoulder_L: [-50, 0, 60],
    elbow_L: [-30, 0, 0],
    shoulder_R: [-40, 0, -50],
    elbow_R: [-30, 0, 0],
    laptop: LAPTOP_CARRY,
    hip_L: [-20, 0, 6],
    knee_L: [24, 0, 0],
    hip_R: [14, 0, -6],
    knee_R: [20, 0, 0],
    foot_R: [-34, 0, 0],
  },
  root: [0, -0.05, -0.12],
};

const DEAD: Pose = {
  rot: {
    spine: [-10, 0, 0],
    head: [-30, 20, 0],
    shoulder_L: [-150, 0, 50],
    elbow_L: [-20, 0, 0],
    shoulder_R: [-140, 0, -60],
    elbow_R: [-20, 0, 0],
    laptop: [0, 0, 0],
    lid: [-130, 0, 0],
    hip_L: [-40, 0, 14],
    knee_L: [50, 0, 0],
    hip_R: [-10, 0, -10],
    knee_R: [20, 0, 0],
  },
  root: [0, 0.1, 0],
};
