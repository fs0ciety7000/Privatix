// Squelette rigide à la manière de tools/render3d/rig.py : des articulations (Groups) et des pièces
// arrondies accrochées dessus. Les poses sont des rotations en degrés (ordre YXZ) par articulation.
// Conventions (personnage tourné vers +Z, Y vers le haut, sa droite en -X) :
//  - membre pendant (bras, jambe) : X < 0 le porte vers l'avant, Z > 0 l'écarte vers +X ;
//  - tronc / tête : X > 0 penche vers l'avant ; Y = rotation sur soi (vers sa gauche).
import * as THREE from 'three';
import { addOutline, capsuleGeo, cylGeo, hemiGeo, rboxGeo, sphereGeo } from './toon';

export type V3 = [number, number, number];

export interface Pose {
  rot: Record<string, V3>;
  /** Décalage du corps (bassin) dans le repère local du personnage. */
  root?: V3;
  /** Échelle du corps (squash & stretch). */
  scale?: V3;
}

const D2R = Math.PI / 180;

export class Rig {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly joints = new Map<string, THREE.Group>();
  readonly meshes: THREE.Mesh[] = [];
  private cur = new Map<string, V3>();
  private curRoot: V3 = [0, 0, 0];
  private curScale: V3 = [1, 1, 1];
  outlineWidth = 2.6;

  constructor() {
    this.root.add(this.body);
  }

  joint(name: string, parent: string | null, pos: V3): THREE.Group {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(pos[0], pos[1], pos[2]);
    g.rotation.order = 'YXZ';
    (parent ? this.j(parent) : this.body).add(g);
    this.joints.set(name, g);
    return g;
  }

  j(name: string): THREE.Group {
    const g = this.joints.get(name);
    if (!g) throw new Error(`articulation inconnue : ${name}`);
    return g;
  }

  private attach(jointName: string, geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, opts: PartOpts = {}): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    if (opts.rot) m.rotation.set(opts.rot[0] * D2R, opts.rot[1] * D2R, opts.rot[2] * D2R);
    if (opts.scale) m.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
    m.castShadow = opts.shadow ?? true;
    m.receiveShadow = true;
    if (opts.outline !== false) addOutline(m, opts.outlineWidth ?? this.outlineWidth);
    (opts.parent ?? this.j(jointName)).add(m);
    this.meshes.push(m);
    return m;
  }

  sphere(joint: string, mat: THREE.Material, pos: V3, scale: V3, opts: PartOpts = {}): THREE.Mesh {
    return this.attach(joint, sphereGeo(18), mat, pos, { ...opts, scale });
  }

  hemi(joint: string, mat: THREE.Material, pos: V3, scale: V3, opts: PartOpts = {}): THREE.Mesh {
    return this.attach(joint, hemiGeo(20), mat, pos, { ...opts, scale });
  }

  box(joint: string, mat: THREE.Material, pos: V3, size: V3, radius: number, opts: PartOpts = {}): THREE.Mesh {
    return this.attach(joint, rboxGeo(size[0], size[1], size[2], radius), mat, pos, opts);
  }

  cyl(joint: string, mat: THREE.Material, pos: V3, r: number, h: number, opts: PartOpts & { rBottom?: number; seg?: number } = {}): THREE.Mesh {
    return this.attach(joint, cylGeo(r, opts.rBottom ?? r, h, opts.seg ?? 14), mat, pos, opts);
  }

  /** Capsule de `from` à `to` (repère de l'articulation). */
  capsule(joint: string, mat: THREE.Material, from: V3, to: V3, r: number, opts: PartOpts = {}): THREE.Mesh {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const len = a.distanceTo(b);
    const m = this.attach(joint, capsuleGeo(r, len), mat, [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], opts);
    const dir = b.clone().sub(a).normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return m;
  }

  /** Applique une pose en amortissant vers elle (k élevé = pose quasi immédiate). */
  apply(p: Pose, dt: number, k: number): void {
    const t = k <= 0 ? 1 : 1 - Math.exp(-k * dt);
    for (const [name, g] of this.joints) {
      const target = p.rot[name] ?? ZERO;
      let c = this.cur.get(name);
      if (!c) {
        c = [target[0], target[1], target[2]];
        this.cur.set(name, c);
      } else {
        c[0] += (target[0] - c[0]) * t;
        c[1] += (target[1] - c[1]) * t;
        c[2] += (target[2] - c[2]) * t;
      }
      g.rotation.set(c[0] * D2R, c[1] * D2R, c[2] * D2R);
    }
    const r = p.root ?? ZERO;
    const s = p.scale ?? ONE;
    for (let i = 0; i < 3; i++) {
      this.curRoot[i] += (r[i] - this.curRoot[i]) * t;
      this.curScale[i] += (s[i] - this.curScale[i]) * Math.min(1, t * 1.4);
    }
    this.body.position.set(this.curRoot[0], this.curRoot[1], this.curRoot[2]);
    this.body.scale.set(this.curScale[0], this.curScale[1], this.curScale[2]);
  }

  /** Impulsion de squash & stretch, amortie ensuite par apply(). */
  punchScale(s: V3): void {
    this.curScale = [s[0], s[1], s[2]];
  }
}

export interface PartOpts {
  rot?: V3;
  scale?: V3;
  shadow?: boolean;
  outline?: boolean;
  outlineWidth?: number;
  parent?: THREE.Object3D;
}

const ZERO: V3 = [0, 0, 0];
const ONE: V3 = [1, 1, 1];

// ─── Outils de poses ────────────────────────────────────────────────────────────

export function merge(a: Pose, rot: Record<string, V3>, extra: Partial<Pose> = {}): Pose {
  return { rot: { ...a.rot, ...rot }, root: extra.root ?? a.root, scale: extra.scale ?? a.scale };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const rot: Record<string, V3> = {};
  const keys = new Set([...Object.keys(a.rot), ...Object.keys(b.rot)]);
  for (const k of keys) {
    const ra = a.rot[k] ?? ZERO;
    const rb = b.rot[k] ?? ZERO;
    rot[k] = [ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t];
  }
  const lr = (x: V3 | undefined, y: V3 | undefined, d: V3): V3 => {
    const p = x ?? d;
    const q = y ?? d;
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  };
  return { rot, root: lr(a.root, b.root, ZERO), scale: lr(a.scale, b.scale, ONE) };
}

export type Ease = (t: number) => number;
export const easeInOut: Ease = (t) => t * t * (3 - 2 * t);
export const easeOut: Ease = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeIn: Ease = (t) => t * t * t;

/** Poses clés (temps en ms) interpolées ; chaque segment peut avoir son easing. */
export function keyed(keys: Array<[number, Pose, Ease?]>, tMs: number): Pose {
  if (tMs <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [ta, pa] = keys[i];
    const [tb, pb, e] = keys[i + 1];
    if (tMs <= tb) {
      const u = tb === ta ? 1 : (tMs - ta) / (tb - ta);
      return lerpPose(pa, pb, (e ?? easeInOut)(u));
    }
  }
  return keys[keys.length - 1][1];
}
