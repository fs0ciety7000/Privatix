// Objets du monde en 3D : projectiles ennemis (tickets d'amende en pool instancié : un seul appel de
// rendu), récompenses au sol (gobelet, tickets, PS, grains, Avantage, cornet) et objets interactifs des
// salles calmes (machine à café, étals de la Friterie, consigne). Lit la simulation, ne la modifie pas.
import * as THREE from 'three';
import type { PickupKind, PickupSim } from '@/sim/Pickups';
import type { ProjectileSim } from '@/sim/Projectiles';
import type { Interactable } from '@/sim/RunDirector';
import { pxToM, yawFromAngle } from '@/sim/units';
import { glow, PAL, radialTexture, rboxGeo, toon } from '@/view/materials/toon';

const MAX_PROJECTILES = 96;
const dummy = new THREE.Object3D();

/** Tickets d'amende : un `InstancedMesh` émissif (le bloom les fait briller). */
export class ProjectileView {
  public readonly mesh: THREE.InstancedMesh;
  public readonly halo: THREE.InstancedMesh;
  private spin = 0;

  public constructor() {
    const geo = new THREE.BoxGeometry(0.26, 0.04, 0.16);
    this.mesh = new THREE.InstancedMesh(geo, glow(0xffd3ec, 2.4), MAX_PROJECTILES);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    const haloMat = new THREE.MeshBasicMaterial({
      map: radialTexture(),
      color: new THREE.Color(PAL.danger).multiplyScalar(1.4),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.halo = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.7, 0.7).rotateX(-Math.PI / 2),
      haloMat,
      MAX_PROJECTILES,
    );
    this.halo.frustumCulled = false;
    this.halo.count = 0;
    this.halo.renderOrder = 4;
  }

  public sync(pool: readonly ProjectileSim[], alpha: number, simDt: number): void {
    this.spin += simDt * 14;
    let n = 0;
    for (const p of pool) {
      if (!p.active || n >= MAX_PROJECTILES) continue;
      const x = pxToM(p.prevX + (p.x - p.prevX) * alpha);
      const z = pxToM(p.prevY + (p.y - p.prevY) * alpha);
      const y = Math.max(0.25, pxToM(p.height) + 0.2);
      const s = p.scale;
      dummy.position.set(x, y, z);
      dummy.rotation.set(this.spin + p.id, yawFromAngle(p.angle), 0, 'YXZ');
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(n, dummy.matrix);
      dummy.position.set(x, 0.03, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      this.halo.setMatrixAt(n, dummy.matrix);
      n += 1;
    }
    this.mesh.count = n;
    this.halo.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.halo.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.mesh.removeFromParent();
    this.halo.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.halo.geometry.dispose();
    (this.halo.material as THREE.Material).dispose();
  }
}

const PICKUP_COLOR: Readonly<Record<PickupKind, number>> = {
  avantage: 0xffd200,
  gobelet: 0xc87a3a,
  tickets: PAL.danger,
  ps: PAL.hero,
  grains: 0x8a5230,
  cornet: 0xffd200,
};

/** Modèle d'une récompense (petit, lisible, avec un halo au sol de sa couleur). */
function pickupModel(kind: PickupKind, mats: THREE.Material[], geos: THREE.BufferGeometry[]) {
  const g = new THREE.Group();
  const m = (c: number, o: Parameters<typeof toon>[1] = {}): THREE.Material => {
    const mat = toon(c, { rimStrength: 0.8, ...o });
    mats.push(mat);
    return mat;
  };
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  switch (kind) {
    case 'gobelet':
      add(new THREE.CylinderGeometry(0.13, 0.1, 0.3, 14), m(0xf4f0e6), 0, 0.15);
      add(new THREE.CylinderGeometry(0.135, 0.135, 0.08, 14), m(0xc87a3a), 0, 0.16);
      add(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 14), m(0x2a2148), 0, 0.31);
      break;
    case 'tickets':
      for (let i = 0; i < 3; i += 1)
        add(
          rboxGeo(0.34, 0.035, 0.22, 0.01),
          m(i === 2 ? PAL.danger : 0xffd3ec),
          0,
          0.03 + i * 0.05,
          0,
        ).rotation.y = i * 0.3;
      break;
    case 'ps': {
      const star = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 5);
      add(star, m(PAL.hero, { emissive: PAL.hero, emissiveIntensity: 0.6 }), 0, 0.2).rotation.x =
        Math.PI / 2;
      break;
    }
    case 'grains':
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2;
        add(
          new THREE.SphereGeometry(0.07, 10, 8),
          m(0x6b3e26),
          Math.cos(a) * 0.08,
          0.1,
          Math.sin(a) * 0.08,
        ).scale.set(1, 0.7, 1.3);
      }
      break;
    case 'avantage': {
      const mat = glow(0xffd200, 2.6);
      mats.push(mat);
      add(new THREE.OctahedronGeometry(0.2), mat, 0, 0.3);
      add(rboxGeo(0.16, 0.24, 0.08, 0.03), m(0x2a2148), 0, 0.3, -0.05);
      break;
    }
    case 'cornet':
      add(new THREE.ConeGeometry(0.14, 0.34, 12).rotateX(Math.PI), m(0xf4f0e6), 0, 0.17);
      add(new THREE.SphereGeometry(0.14, 10, 8), m(0xffd200), 0, 0.36);
      break;
  }
  const haloMat = new THREE.MeshBasicMaterial({
    map: radialTexture(),
    color: new THREE.Color(PICKUP_COLOR[kind]).multiplyScalar(0.9),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  mats.push(haloMat);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2), haloMat);
  geos.push(halo.geometry);
  halo.position.y = 0.03;
  halo.renderOrder = 3;
  return { group: g, halo };
}

interface PickupItem {
  readonly group: THREE.Group;
  readonly halo: THREE.Mesh;
  readonly mats: THREE.Material[];
  readonly geos: THREE.BufferGeometry[];
  t: number;
}

/** Récompenses au sol : une petite vue par `PickupSim`, qui tourne et flotte. */
export class PickupViews {
  private readonly items = new Map<number, PickupItem>();

  public constructor(private readonly scene: THREE.Scene) {}

  public sync(pickups: readonly PickupSim[], dt: number, reducedMotion: boolean): void {
    const alive = new Set<number>();
    for (const p of pickups) {
      alive.add(p.id);
      let it = this.items.get(p.id);
      if (!it) {
        const mats: THREE.Material[] = [];
        const geos: THREE.BufferGeometry[] = [];
        const { group, halo } = pickupModel(p.kind, mats, geos);
        group.position.set(pxToM(p.x), 0, pxToM(p.y));
        halo.position.set(pxToM(p.x), 0.03, pxToM(p.y));
        this.scene.add(group, halo);
        it = { group, halo, mats, geos, t: Math.random() * 3 };
        this.items.set(p.id, it);
      }
      it.t += dt;
      const bob = reducedMotion ? 0.08 : 0.08 + Math.sin(it.t * 4) * 0.06;
      it.group.position.y = bob;
      it.group.rotation.y = it.t * 1.6;
    }
    for (const [id, it] of this.items) {
      if (alive.has(id)) continue;
      this.remove(it);
      this.items.delete(id);
    }
  }

  private remove(it: PickupItem): void {
    it.group.removeFromParent();
    it.halo.removeFromParent();
    for (const m of it.mats) m.dispose();
    for (const g of it.geos) g.dispose();
  }

  public clear(): void {
    for (const it of this.items.values()) this.remove(it);
    this.items.clear();
  }
}

/** Objets interactifs des salles calmes, posés aux marques du gabarit. */
export class PropViews {
  private readonly group = new THREE.Group();
  private readonly mats: THREE.Material[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly lamps: { mat: THREE.MeshBasicMaterial; it: Interactable }[] = [];

  public constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  private m(c: number, o: Parameters<typeof toon>[1] = {}): THREE.Material {
    const mat = toon(c, { rimStrength: 0.6, ...o });
    this.mats.push(mat);
    return mat;
  }

  private add(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh {
    this.geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** Reconstruit les objets de la salle d'après les interactions proposées par le directeur. */
  public build(items: readonly Interactable[]): void {
    this.clear();
    for (const it of items) {
      const g = new THREE.Group();
      g.position.set(pxToM(it.x), 0, pxToM(it.y) - 0.35);
      const lamp = glow(0x5dff8a, 2.5);
      this.mats.push(lamp);
      this.lamps.push({ mat: lamp, it });
      switch (it.prop) {
        case 'coffee':
        case 'machine': {
          this.add(g, rboxGeo(0.7, 1.5, 0.55, 0.06), this.m(0x6b3e26), 0, 0.75, 0);
          this.add(g, rboxGeo(0.5, 0.4, 0.05, 0.02), this.m(0x1d2a48), 0, 1.05, 0.28);
          const screen = glow(0xffb347, 1.8);
          this.mats.push(screen);
          this.add(g, new THREE.PlaneGeometry(0.4, 0.28), screen, 0, 1.1, 0.31);
          this.add(g, new THREE.BoxGeometry(0.22, 0.05, 0.05), lamp, 0, 0.55, 0.3);
          break;
        }
        case 'stand': {
          this.add(g, rboxGeo(0.9, 0.8, 0.6, 0.05), this.m(0xffd200), 0, 0.4, 0);
          this.add(g, rboxGeo(1.0, 0.08, 0.7, 0.03), this.m(0xe0302a), 0, 0.84, 0);
          this.add(g, new THREE.BoxGeometry(0.5, 0.05, 0.05), lamp, 0, 0.5, 0.31);
          break;
        }
        case 'locker': {
          this.add(g, rboxGeo(0.9, 1.6, 0.5, 0.04), this.m(0x3a4266), 0, 0.8, 0);
          for (let i = 0; i < 3; i += 1)
            this.add(
              g,
              rboxGeo(0.26, 0.5, 0.03, 0.01),
              this.m(0x5a6488),
              -0.29 + i * 0.29,
              0.9,
              0.26,
            );
          this.add(g, new THREE.BoxGeometry(0.2, 0.05, 0.05), lamp, 0, 0.3, 0.27);
          break;
        }
      }
      this.group.add(g);
    }
  }

  /** Voyant vert tant que l'objet est utilisable. */
  public update(): void {
    for (const l of this.lamps)
      l.mat.color.setHex(l.it.used ? 0x40303a : 0x5dff8a).multiplyScalar(l.it.used ? 1 : 2.5);
  }

  public clear(): void {
    this.group.clear();
    for (const m of this.mats) m.dispose();
    for (const g of this.geos) g.dispose();
    this.mats.length = 0;
    this.geos.length = 0;
    this.lamps.length = 0;
  }

  public dispose(): void {
    this.clear();
    this.group.removeFromParent();
  }
}
