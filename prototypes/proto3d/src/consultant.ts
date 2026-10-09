// Consultant Junior : costume turquoise trop court (chaussettes visibles), baskets blanches, cravate
// magenta qui flotte, houppe gominée, laptop. « Coup de diaporama » : il lève le laptop ouvert
// (écran magenta = télégraphe), puis l'abat devant lui.
import * as THREE from 'three';
import { easeIn, easeOut, keyed, Rig, type Pose } from './rig';
import { glow, makeFlash, PAL, toon, type Flash } from './toon';
import { Telegraph } from './fx';
import type { Foe, HitInfo, World } from './types';

const WINDUP = 700;
const ACTIVE = 120;
const RECOVER = 750;
const RANGE = 2.0;
const TELE_W = 1.6;
const TELE_L = 2.6;

type State = 'spawn' | 'chase' | 'windup' | 'attack' | 'recover' | 'hurt' | 'dead';

let NEXT_ID = 1;

export class Consultant implements Foe {
  readonly elite = false;
  readonly name = 'Consultant Junior';
  readonly id = NEXT_ID++;
  readonly rig = new Rig();
  readonly flash: Flash = makeFlash();
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  readonly kb = new THREE.Vector3();
  readonly radius = 0.45;
  facing = 0;
  hp = 70;
  readonly maxHp = 70;
  state: State = 'spawn';
  private t = 0;
  private cooldown = 600 + Math.random() * 900;
  private stun = 0;
  private walkPhase = Math.random() * 6;
  private strafeDir = Math.random() < 0.5 ? -1 : 1;
  private hasToken = false;
  private screenMat: THREE.MeshBasicMaterial;
  private logoMat: THREE.MeshBasicMaterial;
  private screen: THREE.Mesh;
  readonly telegraph: Telegraph;
  private hitFlash = 0;
  private deathSpin = new THREE.Vector3();
  removed = false;
  private hpBar: THREE.Group;
  private hpFill: THREE.Mesh;
  private dropped = false;
  private smearIdx = 0;
  private tieV = 0;

  constructor(private readonly world: World, pos: THREE.Vector3) {
    this.pos.copy(pos);
    const f = this.flash;
    const m = (c: number, rim = 0.9, o: Partial<Parameters<typeof toon>[1]> = {}) => toon(c, { rimStrength: rim, rim: 0xff7ac8, flash: f, ...o });
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
      r.box(`foot_${s}`, m(0xff3ea5, 0.2), [0, -0.025, 0.05], [0.165, 0.03, 0.305], 0.01, { outline: false });
    }
    r.box('pelvis', suit, [0, 0, 0], [0.36, 0.17, 0.24], 0.07);
    r.box('spine', suit, [0, 0.03, 0], [0.37, 0.18, 0.25], 0.08);
    // Veste cintrée + revers + chemise + col
    r.box('chest', suit, [0, 0.09, 0], [0.48, 0.38, 0.29], 0.1);
    r.box('chest', shirt, [0, 0.14, 0.135], [0.15, 0.24, 0.04], 0.015, { outline: false });
    for (const sx of [1, -1]) r.box('chest', suitDark, [0.09 * sx, 0.15, 0.142], [0.07, 0.26, 0.03], 0.012, { rot: [0, 0, 16 * sx], outline: false });
    r.box('chest', shirt, [0, 0.27, 0.02], [0.27, 0.06, 0.2], 0.025);
    // Badge (cordon magenta, carte turquoise)
    r.box('chest', m(0xff3ea5, 0.2), [0.12, 0.12, 0.148], [0.018, 0.2, 0.01], 0.004, { outline: false, rot: [0, 0, 10] });
    r.box('chest', m(0x5ff7e4, 0.3, { emissive: 0x19c3b1, emissiveIntensity: 0.4 }), [0.14, 0.01, 0.15], [0.07, 0.09, 0.012], 0.008, { outline: false });
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
      r.sphere('head', eyes, [0.085 * sx, 0.17, 0.215], [0.03, 0.04, 0.025], { outline: false, shadow: false });
      r.box('head', hair, [0.09 * sx, 0.235, 0.22], [0.09, 0.025, 0.03], 0.01, { rot: [0, 0, 14 * sx], outline: false, shadow: false });
      r.sphere('head', skin, [0.245 * sx, 0.14, 0], [0.045, 0.06, 0.045]);
    }
    r.box('head', m(0x8a0f52, 0), [0, 0.08, 0.215], [0.11, 0.022, 0.03], 0.01, { rot: [0, 0, 6], outline: false, shadow: false });
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), glow(PAL.danger, 4));
    ear.position.set(-0.27, 0.14, 0.03);
    r.j('head').add(ear);

    // Laptop : repère local, socle à plat (XZ), charnière à l'arrière (z = -0.14)
    r.box('laptop', shell, [0, 0, 0], [0.42, 0.03, 0.28], 0.012);
    r.box('laptop', m(0x1a2140, 0), [0, 0.016, 0.01], [0.36, 0.004, 0.18], 0.0, { outline: false, shadow: false });
    r.box('lid', shell, [0, 0.014, 0.14], [0.42, 0.026, 0.28], 0.012);
    this.screenMat = glow(0x2a3a6a, 1);
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.24), this.screenMat);
    this.screen.rotation.x = Math.PI / 2;
    this.screen.position.set(0, -0.001, 0.14);
    this.screen.userData.noGhost = true;
    r.j('lid').add(this.screen);
    this.logoMat = glow(PAL.enemy, 2.5);
    const logo = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), this.logoMat);
    logo.rotation.x = -Math.PI / 2;
    logo.position.set(0, 0.029, 0.14);
    r.j('lid').add(logo);

    this.rig.optimize();

    // Barre de vie flottante
    this.hpBar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.09), new THREE.MeshBasicMaterial({ color: 0x14101a, transparent: true, opacity: 0.85, depthTest: false }));
    this.hpFill = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.055).translate(0.43, 0, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.danger).multiplyScalar(1.6), depthTest: false }));
    this.hpFill.position.set(-0.43, 0, 0.001);
    bg.renderOrder = 30;
    this.hpFill.renderOrder = 31;
    this.hpBar.add(bg, this.hpFill);
    this.hpBar.visible = false;
    world.scene.add(this.hpBar);

    this.telegraph = new Telegraph(TELE_W, TELE_L, PAL.danger);
    world.scene.add(this.telegraph.mesh);
    this.smearIdx = this.id % world.enemySmears.length;

    this.rig.root.position.copy(this.pos);
    this.rig.root.scale.setScalar(0.01);
    world.scene.add(this.rig.root);
    world.rings.spawn(this.pos, PAL.enemy, 0.2, 1.6, 0.6, 0.18, 0.4, 2.2);
    world.rings.spawn(this.pos, PAL.danger, 1.6, 0.2, 0.6, 0.12, 0.0, 2.2);
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  get spawning(): boolean {
    return this.state === 'spawn';
  }

  place(x: number, z: number): void {
    this.pos.set(x, 0, z);
    this.rig.root.position.set(x, 0, z);
  }

  hit(h: HitInfo, from: THREE.Vector3): void {
    if (!this.alive) return;
    this.hp -= h.damage;
    this.hitFlash = 1;
    this.flash.color.value.setRGB(0.92, 0.9, 0.95);
    const dir = this.pos.clone().sub(from).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    this.kb.copy(dir).multiplyScalar(h.knockback * 9);
    this.rig.punchScale(h.heavy ? [1.25, 0.75, 1.25] : [1.15, 0.88, 1.15]);
    const w = this.world;
    const hp = this.pos.clone().setY(1.0);
    w.dmg.spawn(hp.clone().setY(1.7), String(h.damage), h.crit ? 'crit' : h.heavy ? 'big' : 'normal');
    w.bursts.spawn(hp.clone().addScaledVector(dir, -0.2), h.crit ? 0xfff0a0 : 0xffffff, h.heavy ? 2.6 : 1.8, 0.14, 3.2);
    w.sparks.burst(hp, dir, h.heavy ? 22 : 12, 0xffd27a, 9, 0.9, 0.4, 0.035, 3);
    w.sparks.burst(hp, dir, 6, 0xffffff, 12, 0.5, 0.25, 0.03, 2);
    // feuilles de papier (le rapport du consultant)
    for (let i = 0; i < (h.heavy ? 8 : 3); i++) {
      const v = dir.clone().multiplyScalar(2 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 2, 2 + Math.random() * 3, (Math.random() - 0.5) * 2));
      w.puffs.emit(hp, v, 0xf4f0e6, 1.2 + Math.random() * 0.6, 0.11, { grav: 4, drag: 2.2, alpha: 1, shape: 1 });
    }
    if (this.hp <= 0) {
      this.die(dir, h);
      return;
    }
    if (this.state === 'windup' || this.state === 'attack') this.cancelAttack();
    this.state = 'hurt';
    this.t = 0;
    this.stun = h.stun;
    this.hpBar.visible = true;
  }

  private die(dir: THREE.Vector3, h: HitInfo): void {
    this.cancelAttack();
    this.state = 'dead';
    this.t = 0;
    this.hp = 0;
    this.kb.copy(dir).multiplyScalar(h.knockback * 9 + 7);
    this.vel.set(0, 6.5, 0);
    this.deathSpin.set(-7, (Math.random() - 0.5) * 6, 0);
    this.hpBar.visible = false;
    const w = this.world;
    const p = this.pos.clone().setY(1);
    w.bursts.spawn(p, 0xffffff, 3.6, 0.22, 4);
    w.sparks.burst(p, dir, 30, PAL.enemy, 11, 1.4, 0.6, 0.04, 5);
    w.sparks.burst(p, dir, 16, PAL.danger, 8, 2.5, 0.5, 0.035, 4);
    for (let i = 0; i < 14; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5).addScaledVector(dir, 3);
      w.puffs.emit(p, v, 0xf4f0e6, 1.6 + Math.random(), 0.12, { grav: 3.5, drag: 2, alpha: 1, shape: 1 });
    }
    w.shake.add(0.6);
    w.hitstop(130);
  }

  private cancelAttack(): void {
    this.telegraph.mesh.visible = false;
    if (this.hasToken) {
      this.world.releaseToken(this.id);
      this.hasToken = false;
    }
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

  update(dtS: number): void {
    const dt = dtS * 1000;
    this.t += dt;
    const w = this.world;
    const hero = w.heroPos();
    const toHero = hero.clone().sub(this.pos).setY(0);
    const dist = toHero.length();
    const heroAngle = Math.atan2(toHero.x, toHero.z);

    switch (this.state) {
      case 'spawn': {
        const k = Math.min(1, this.t / 450);
        const s = k < 0.7 ? easeOut(k / 0.7) * 1.15 : 1.15 - 0.15 * ((k - 0.7) / 0.3);
        this.rig.root.scale.setScalar(Math.max(0.01, s));
        this.facing = heroAngle;
        if (this.t >= 450) {
          this.rig.root.scale.setScalar(1);
          this.state = 'chase';
          this.t = 0;
          w.puffs.dustRing(this.pos, 8, 0.3, 0x3a8a8a, 2);
        }
        break;
      }
      case 'chase': {
        this.cooldown -= dt;
        let desired = new THREE.Vector3();
        if (dist > RANGE * 0.9) {
          desired = toHero.clone().normalize().multiplyScalar(2.7);
        } else if (dist < 1.2) {
          desired = toHero.clone().normalize().multiplyScalar(-1.6);
        }
        if (this.cooldown <= 0 && dist < RANGE + 0.3) {
          if (w.requestToken(this.id)) {
            this.hasToken = true;
            this.state = 'windup';
            this.t = 0;
            this.facing = heroAngle;
            this.telegraph.mesh.visible = true;
            this.rig.punchScale([0.9, 1.12, 0.9]);
            break;
          }
          // pas de jeton : tourne autour du héros
          const side = new THREE.Vector3(toHero.z, 0, -toHero.x).normalize().multiplyScalar(1.6 * this.strafeDir);
          desired = side.add(toHero.clone().normalize().multiplyScalar(dist < 3 ? -1.2 : 0.6));
        }
        this.vel.lerp(desired, 1 - Math.exp(-6 * dtS));
        this.turnTo(heroAngle, dtS, 8);
        break;
      }
      case 'windup': {
        this.vel.multiplyScalar(Math.exp(-12 * dtS));
        const k = this.t / WINDUP;
        // le télégraphe suit la position mais l'orientation est verrouillée
        const tm = this.telegraph.mat.uniforms;
        tm.uProgress.value = Math.min(1, k * 1.05);
        tm.uAlpha.value = Math.min(1, k * 4);
        tm.uTime.value = w.time;
        this.setScreen(true, k);
        if (this.t >= WINDUP) {
          this.state = 'attack';
          this.t = 0;
          this.strikeHero();
        }
        break;
      }
      case 'attack': {
        this.vel.multiplyScalar(Math.exp(-12 * dtS));
        this.telegraph.mat.uniforms.uAlpha.value = Math.max(0, 1 - this.t / ACTIVE);
        if (this.t >= ACTIVE) {
          this.telegraph.mesh.visible = false;
          this.state = 'recover';
          this.t = 0;
          this.setScreen(false);
        }
        break;
      }
      case 'recover': {
        this.vel.multiplyScalar(Math.exp(-10 * dtS));
        if (this.t >= RECOVER) {
          this.state = 'chase';
          this.t = 0;
          this.cooldown = 900 + Math.random() * 1400;
          this.strafeDir = Math.random() < 0.5 ? -1 : 1;
          if (this.hasToken) {
            w.releaseToken(this.id);
            this.hasToken = false;
          }
        }
        break;
      }
      case 'hurt': {
        this.vel.multiplyScalar(Math.exp(-10 * dtS));
        if (this.t >= this.stun) {
          this.state = 'chase';
          this.t = 0;
          this.cooldown = Math.max(this.cooldown, 350);
        }
        break;
      }
      case 'dead': {
        this.vel.y -= 22 * dtS;
        const p = this.rig.root.position;
        p.y += this.vel.y * dtS;
        if (p.y <= 0 && this.vel.y < 0) {
          p.y = 0;
          if (this.vel.y < -3) {
            w.puffs.dustRing(this.pos, 10, 0.5, 0x4a4466, 2.5);
            w.shake.add(0.25);
          }
          this.vel.y = Math.abs(this.vel.y) > 3 ? -this.vel.y * 0.3 : 0;
          this.deathSpin.multiplyScalar(0.4);
          this.kb.multiplyScalar(0.4);
        }
        // bascule sur le dos
        const tilt = Math.min(1, this.t / 380);
        this.rig.body.rotation.x = -tilt * 1.45;
        if (!this.dropped && this.t > 260) {
          this.dropped = true;
          w.onEnemyDeath(this.pos.clone());
        }
        if (this.t > 1500) {
          // dissolution : enfoncement + rétrécissement
          const k = Math.min(1, (this.t - 1500) / 600);
          this.rig.root.scale.setScalar(1 - k * 0.9);
          p.y = -k * 0.6;
          if (Math.random() < 0.5) w.glows.emit(this.pos.clone().setY(0.3 + Math.random() * 0.4).add(new THREE.Vector3((Math.random() - 0.5) * 1, 0, (Math.random() - 0.5) * 1)), new THREE.Vector3(0, 1.5, 0), PAL.enemy, 0.6, 0.09);
          if (k >= 1) this.remove();
        }
        break;
      }
    }

    // Recul (knockback) + déplacement
    this.pos.addScaledVector(this.kb, dtS);
    this.kb.multiplyScalar(Math.exp(-9 * dtS));
    if (this.state !== 'dead') this.pos.addScaledVector(new THREE.Vector3(this.vel.x, 0, this.vel.z), dtS);
    w.collide(this.pos, this.radius);
    this.rig.root.position.x = this.pos.x;
    this.rig.root.position.z = this.pos.z;
    this.rig.root.rotation.y = this.facing;

    this.hitFlash = Math.max(0, this.hitFlash - dtS * 9);
    this.flash.amount.value = this.hitFlash > 0.01 ? Math.min(0.8, this.hitFlash * 1.2) : 0;

    // Barre de vie
    if (this.hpBar.visible) {
      this.hpBar.position.set(this.pos.x, 2.25, this.pos.z);
      this.hpFill.scale.x = Math.max(0.001, this.hp / this.maxHp);
    }
    if (this.telegraph.mesh.visible) {
      this.telegraph.mesh.position.set(this.pos.x, 0.03, this.pos.z);
      this.telegraph.mesh.rotation.y = this.facing;
    }
    this.animate(dtS);
  }

  faceCamera(cam: THREE.Camera): void {
    this.hpBar.quaternion.copy(cam.quaternion);
  }

  private strikeHero(): void {
    const w = this.world;
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    const rel = w.heroPos().clone().sub(this.pos);
    const along = rel.dot(fwd);
    const side = rel.dot(new THREE.Vector3(fwd.z, 0, -fwd.x));
    const hr = 0.4;
    if (along > -hr && along < TELE_L + hr && Math.abs(side) < TELE_W / 2 + hr) w.heroHit(14, this.pos);
    const impact = this.pos.clone().addScaledVector(fwd, 1.5).setY(0.05);
    w.rings.spawn(impact, PAL.danger, 0.2, 1.5, 0.28, 0.25, 0.4, 2.6);
    w.sparks.burst(impact.clone().setY(0.2), fwd, 16, PAL.danger, 7, 1.6, 0.4, 0.035, 4);
    w.puffs.dustRing(impact, 8, 0.3, 0x5a4a70, 2.5);
    w.shake.add(0.3);
    const center = this.pos.clone().add(new THREE.Vector3(0, 1.25, 0)).addScaledVector(fwd, 0.1);
    w.enemySmears[this.smearIdx].fire(center, new THREE.Vector3(0, 1, 0), fwd, -20, 130, 0.4, 1.7, 0.09, 0.14, { core: 0xffd3ec, edge: PAL.danger });
  }

  private turnTo(target: number, dt: number, k: number): void {
    let d = target - this.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.facing += d * (1 - Math.exp(-k * dt));
  }

  private remove(): void {
    this.removed = true;
    this.world.scene.remove(this.rig.root);
    this.world.scene.remove(this.hpBar);
    this.world.scene.remove(this.telegraph.mesh);
  }

  // ─── Animation ────────────────────────────────────────────────────────────────

  private animate(dt: number): void {
    const time = this.world.time + this.id * 1.7;
    const sp = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 2.7);
    let pose: Pose;
    let k = 12;
    switch (this.state) {
      case 'windup':
        pose = keyed(
          [
            [0, idle(time)],
            [WINDUP * 0.45, RAISE(0), easeOut],
            [WINDUP, RAISE(1)],
          ],
          this.t,
        );
        k = 18;
        break;
      case 'attack':
        pose = keyed(
          [
            [0, RAISE(1)],
            [ACTIVE * 0.6, SLAM, easeIn],
            [ACTIVE, SLAM],
          ],
          this.t,
        );
        k = 45;
        break;
      case 'recover':
        pose = keyed(
          [
            [0, SLAM],
            [RECOVER * 0.55, SLAM],
            [RECOVER, idle(time)],
          ],
          this.t,
        );
        k = 14;
        break;
      case 'hurt':
        pose = HURT;
        k = 30;
        break;
      case 'dead':
        pose = DEAD;
        k = 10;
        break;
      default:
        pose = sp > 0.1 ? walk(this.walkPhase, sp) : idle(time);
        if (sp > 0.1) this.walkPhase += dt * Math.PI * 2 * (1.6 * sp + 0.4);
    }
    // cravate : traîne selon la vitesse
    const tv = this.state === 'hurt' || this.state === 'dead' ? 1.4 : sp;
    this.tieV += (tv - this.tieV) * (1 - Math.exp(-6 * dt));
    pose.rot.tie0 = [-8 - this.tieV * 30 + Math.sin(time * 9) * 6 * this.tieV, 0, Math.sin(time * 7) * 8 * this.tieV];
    pose.rot.tie1 = [-6 - this.tieV * 30 + Math.sin(time * 11 + 1) * 10 * this.tieV, 0, 0];
    this.rig.apply(pose, dt, k);
    if (this.state === 'windup' && this.t > WINDUP * 0.6) this.rig.body.position.x += (Math.random() - 0.5) * 0.05;
  }
}

// Laptop au repos : fermé, porté à la verticale le long de la jambe (repère de la main)
const LAPTOP_CARRY: [number, number, number] = [0, 90, 90];

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
