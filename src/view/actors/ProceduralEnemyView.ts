// Base des ennemis procéduraux (Borne, Drone, Manager, Auditeur) : interpolation, apparition (disque
// magenta qui se remplit puis « pop » du corps), télégraphes au sol à la forme exacte de la hitbox,
// barre de vie, flash et squash de coup, chute puis dissolution du corps. Les sous-classes ne
// décrivent que le modèle et ses poses.
import * as THREE from 'three';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import { pxToM, yawFromAngle } from '@/sim/units';
import type { ActorFrame, EnemyView } from '@/view/actors/ActorView';
import { DiscTelegraph } from '@/view/fx/effects';
import { TelegraphPainter } from '@/view/fx/TelegraphPainter';
import type { Flash, ToonOpts } from '@/view/materials/toon';
import { makeFlash, PAL, toon } from '@/view/materials/toon';
import { easeOut, Rig } from '@/view/rig';

const DEATH_FALL_S = 1.2;
const DEATH_DISSOLVE_S = 0.6;

export interface EnemyLook {
  /** Hauteur de la barre de vie (m). */
  readonly barY: number;
  /** Largeur de la barre de vie (m). */
  readonly barW: number;
  /** Rayon du disque d'apparition (m). */
  readonly spawnR: number;
  /** Chute en arrière à la mort (humanoïdes) ou affaissement (machines). */
  readonly topple: boolean;
  /** Échelle du modèle (élites, boss). */
  readonly scale?: number;
}

export abstract class ProceduralEnemyView implements EnemyView {
  public readonly rig = new Rig();
  public readonly flash: Flash = makeFlash();
  public readonly pos = new THREE.Vector3();
  public finished = false;
  protected yaw = 0;
  protected time = Math.random() * 10;
  protected dead = false;
  private readonly hpBar = new THREE.Group();
  private readonly hpFill: THREE.Mesh;
  private readonly spawnTele: DiscTelegraph;
  private readonly tele: TelegraphPainter;
  private readonly ownGeos: THREE.BufferGeometry[] = [];
  private readonly ownMats: THREE.Material[] = [];
  private hitFlash = 0;
  private materialized = false;
  private spawnT = 0;
  private deathT = 0;
  private readonly deathVel = new THREE.Vector3();
  private readonly deathKb = new THREE.Vector3();

  protected constructor(
    scene: THREE.Scene,
    protected readonly reducedMotion: boolean,
    private readonly look: EnemyLook,
  ) {
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(look.barW, 0.09),
      new THREE.MeshBasicMaterial({
        color: 0x14101a,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      }),
    );
    this.hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(look.barW - 0.04, 0.055).translate((look.barW - 0.04) / 2, 0, 0),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(PAL.danger).multiplyScalar(1.6),
        depthTest: false,
      }),
    );
    this.hpFill.position.set(-(look.barW - 0.04) / 2, 0, 0.001);
    bg.renderOrder = 30;
    this.hpFill.renderOrder = 31;
    this.hpBar.add(bg, this.hpFill);
    this.ownGeos.push(bg.geometry, this.hpFill.geometry);
    this.ownMats.push(bg.material, this.hpFill.material as THREE.Material);
    this.hpBar.visible = false;
    this.spawnTele = new DiscTelegraph(look.spawnR, PAL.danger);
    this.tele = new TelegraphPainter(scene);
    this.rig.root.scale.setScalar(0.01);
    this.rig.root.visible = false;
    scene.add(this.rig.root, this.hpBar, this.spawnTele.mesh);
  }

  /** Matériau toon de ce personnage (flash partagé, libéré avec lui). */
  protected mat(color: number, rim = 0.8, o: ToonOpts = {}): THREE.MeshToonMaterial {
    const m = toon(color, { rimStrength: rim, rim: o.rim ?? 0xff7ac8, flash: this.flash, ...o });
    this.ownMats.push(m);
    return m;
  }

  protected track<T extends THREE.Material>(m: T): T {
    this.ownMats.push(m);
    return m;
  }

  protected trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.ownGeos.push(g);
    return g;
  }

  public get root(): THREE.Object3D {
    return this.rig.root;
  }

  public hit(heavy: boolean): void {
    this.hitFlash = 1;
    this.flash.color.value.setRGB(0.92, 0.9, 0.95);
    this.rig.punchScale(heavy ? [1.18, 0.82, 1.18] : [1.1, 0.9, 1.1]);
  }

  public die(angle: number): void {
    if (this.dead) return;
    this.dead = true;
    this.deathT = 0;
    this.hpBar.visible = false;
    this.tele.hide();
    this.deathKb
      .set(Math.cos(angle), 0, Math.sin(angle))
      .multiplyScalar(this.look.topple ? 4.5 : 1.5);
    this.deathVel.set(0, this.look.topple ? 5.5 : 2, 0);
    this.onDeath();
  }

  public update(sim: EnemySim | null, f: ActorFrame): void {
    this.time += f.simDt;
    if (sim && !this.dead) {
      const b = sim.body;
      this.pos.set(
        pxToM(b.prevX + (b.x - b.prevX) * f.alpha),
        0,
        pxToM(b.prevY + (b.y - b.prevY) * f.alpha),
      );
      this.updateAlive(sim, f);
    } else {
      this.updateDeath(f.simDt);
    }
    this.rig.root.position.x = this.pos.x;
    this.rig.root.position.z = this.pos.z;
    this.rig.root.rotation.y = this.yaw;
    this.hitFlash = Math.max(0, this.hitFlash - f.realDt * 9);
    const peak = this.reducedMotion ? 0.4 : 0.8;
    this.flash.amount.value = this.hitFlash > 0.01 ? Math.min(peak, this.hitFlash * 1.2) : 0;
    if (this.hpBar.visible) {
      this.hpBar.position.set(this.pos.x, this.look.barY + this.rig.root.position.y, this.pos.z);
      this.hpBar.quaternion.copy(f.camera.quaternion);
    }
  }

  private updateAlive(sim: EnemySim, f: ActorFrame): void {
    const state = sim.state;
    if (state === 'spawn' && !sim.materialized) {
      this.spawnTele.mesh.visible = true;
      this.spawnTele.mesh.position.set(this.pos.x, 0.035, this.pos.z);
      this.spawnTele.set(sim.windupProgress, Math.min(1, sim.windupProgress * 4), f.time);
      this.rig.root.visible = false;
      this.yaw = yawFromAngle(sim.facing);
      return;
    }
    this.spawnTele.mesh.visible = false;
    if (!this.materialized) {
      this.materialized = true;
      this.spawnT = 0;
    }
    this.rig.root.visible = !sim.hidden;
    if (this.spawnT < 0.45) {
      this.spawnT += f.simDt;
      const k = Math.min(1, this.spawnT / 0.45);
      const s = k < 0.7 ? easeOut(k / 0.7) * 1.15 : 1.15 - 0.15 * ((k - 0.7) / 0.3);
      this.rig.root.scale.setScalar(Math.max(0.01, s) * this.size);
    } else this.rig.root.scale.setScalar(this.size);

    this.turnTo(
      yawFromAngle(sim.facing),
      f.simDt,
      state === 'windup' || state === 'attack' ? 30 : this.turnRate,
    );
    if (sim.hp < sim.maxHp && !sim.hidden) this.hpBar.visible = true;
    else if (sim.hidden) this.hpBar.visible = false;
    this.hpFill.scale.x = Math.max(0.001, sim.hp / sim.maxHp);

    // Télégraphe : se remplit pendant le windup, reste plein pendant l'attaque (scan, saut).
    const k = state === 'windup' ? sim.windupProgress : 1;
    this.tele.show(sim.telegraph, Math.min(1, k * 1.05), Math.min(1, 0.25 + k * 4), f.time);
    this.animate(sim, f.simDt, k);
  }

  private updateDeath(dt: number): void {
    this.spawnTele.mesh.visible = false;
    this.tele.hide();
    if (!this.dead) this.die(0);
    this.rig.root.visible = true;
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
    if (this.look.topple) this.rig.body.rotation.x = -Math.min(1, this.deathT / 0.38) * 1.45;
    else this.rig.body.scale.y = Math.max(0.55, 1 - this.deathT * 1.2);
    this.animateDeath(dt);
    if (this.deathT > DEATH_FALL_S) {
      const k = Math.min(1, (this.deathT - DEATH_FALL_S) / DEATH_DISSOLVE_S);
      this.rig.root.scale.setScalar(Math.max(0.01, 1 - k * 0.9) * this.size);
      p.y = -k * 0.6;
      if (k >= 1) this.finished = true;
    }
  }

  private get size(): number {
    return this.look.scale ?? 1;
  }

  /** Vitesse de rotation au repos (machines lentes, drones vifs). */
  protected readonly turnRate: number = 8;

  protected turnTo(target: number, dt: number, k: number): void {
    let d = target - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * (1 - Math.exp(-k * dt));
  }

  /** Pose du modèle (`windup` : progression du télégraphe 0..1, 1 hors windup). */
  protected abstract animate(sim: EnemySim, dt: number, windup: number): void;
  protected onDeath(): void {
    // Optionnel.
  }
  protected animateDeath(_dt: number): void {
    // Optionnel.
  }

  public dispose(): void {
    this.rig.dispose();
    this.hpBar.removeFromParent();
    this.spawnTele.dispose();
    this.tele.dispose();
    for (const g of this.ownGeos) g.dispose();
    for (const m of this.ownMats) m.dispose();
  }
}
