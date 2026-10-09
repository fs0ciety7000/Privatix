// Squelette rigide à la manière de tools/render3d/rig.py : des articulations (Groups) et des pièces
// arrondies accrochées dessus. Les poses sont des rotations en degrés (ordre YXZ) par articulation.
// Repris du prototype validé (prototypes/proto3d/src/rig.ts).
// Conventions (personnage tourné vers +Z, Y vers le haut, sa droite en -X) :
//  - membre pendant (bras, jambe) : X < 0 le porte vers l'avant, Z > 0 l'écarte vers +X ;
//  - tronc / tête : X > 0 penche vers l'avant ; Y = rotation sur soi (vers sa gauche).
import * as THREE from 'three';
import { addOutline, capsuleGeo, cylGeo, hemiGeo, rboxGeo, sphereGeo } from '@/view/materials/toon';

export type V3 = readonly [number, number, number];

export interface Pose {
  readonly rot: Readonly<Record<string, V3>>;
  /** Décalage du corps (bassin) dans le repère local du personnage. */
  readonly root?: V3;
  /** Échelle du corps (squash & stretch). */
  readonly scale?: V3;
}

export interface PartOpts {
  readonly rot?: V3;
  readonly scale?: V3;
  readonly shadow?: boolean;
  readonly outline?: boolean;
  readonly outlineWidth?: number;
  readonly parent?: THREE.Object3D;
}

const D2R = Math.PI / 180;
const ZERO: V3 = [0, 0, 0];
const ONE: V3 = [1, 1, 1];

export class Rig {
  public readonly root = new THREE.Group();
  public readonly body = new THREE.Group();
  public readonly joints = new Map<string, THREE.Group>();
  public readonly meshes: THREE.Mesh[] = [];
  public outlineWidth = 2.6;
  private readonly cur = new Map<string, [number, number, number]>();
  private readonly curRoot: [number, number, number] = [0, 0, 0];
  private readonly curScale: [number, number, number] = [1, 1, 1];

  public constructor() {
    this.root.add(this.body);
  }

  public joint(name: string, parent: string | null, pos: V3): THREE.Group {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(pos[0], pos[1], pos[2]);
    g.rotation.order = 'YXZ';
    (parent ? this.j(parent) : this.body).add(g);
    this.joints.set(name, g);
    return g;
  }

  public j(name: string): THREE.Group {
    const g = this.joints.get(name);
    if (!g) throw new Error(`articulation inconnue : ${name}`);
    return g;
  }

  private attach(
    jointName: string,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: V3,
    opts: PartOpts = {},
  ): THREE.Mesh {
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

  public sphere(
    joint: string,
    mat: THREE.Material,
    pos: V3,
    scale: V3,
    opts: PartOpts = {},
  ): THREE.Mesh {
    return this.attach(joint, sphereGeo(18), mat, pos, { ...opts, scale });
  }

  public hemi(
    joint: string,
    mat: THREE.Material,
    pos: V3,
    scale: V3,
    opts: PartOpts = {},
  ): THREE.Mesh {
    return this.attach(joint, hemiGeo(20), mat, pos, { ...opts, scale });
  }

  public box(
    joint: string,
    mat: THREE.Material,
    pos: V3,
    size: V3,
    radius: number,
    opts: PartOpts = {},
  ): THREE.Mesh {
    return this.attach(joint, rboxGeo(size[0], size[1], size[2], radius), mat, pos, opts);
  }

  public cyl(
    joint: string,
    mat: THREE.Material,
    pos: V3,
    r: number,
    h: number,
    opts: PartOpts & { readonly rBottom?: number; readonly seg?: number } = {},
  ): THREE.Mesh {
    return this.attach(joint, cylGeo(r, opts.rBottom ?? r, h, opts.seg ?? 14), mat, pos, opts);
  }

  /** Capsule de `from` à `to` (repère de l'articulation). */
  public capsule(
    joint: string,
    mat: THREE.Material,
    from: V3,
    to: V3,
    r: number,
    opts: PartOpts = {},
  ): THREE.Mesh {
    const a = new THREE.Vector3(from[0], from[1], from[2]);
    const b = new THREE.Vector3(to[0], to[1], to[2]);
    const len = a.distanceTo(b);
    const m = this.attach(
      joint,
      capsuleGeo(r, len),
      mat,
      [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2],
      opts,
    );
    const dir = b.clone().sub(a).normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return m;
  }

  /** Applique une pose en amortissant vers elle (k élevé = pose quasi immédiate). */
  public apply(p: Pose, dt: number, k: number): void {
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
    for (let i = 0; i < 3; i += 1) {
      this.curRoot[i] = (this.curRoot[i] ?? 0) + ((r[i] ?? 0) - (this.curRoot[i] ?? 0)) * t;
      this.curScale[i] =
        (this.curScale[i] ?? 1) + ((s[i] ?? 1) - (this.curScale[i] ?? 1)) * Math.min(1, t * 1.4);
    }
    this.body.position.set(this.curRoot[0], this.curRoot[1], this.curRoot[2]);
    this.body.scale.set(this.curScale[0], this.curScale[1], this.curScale[2]);
  }

  /** Impulsion de squash & stretch, amortie ensuite par apply(). */
  public punchScale(s: V3): void {
    this.curScale[0] = s[0];
    this.curScale[1] = s[1];
    this.curScale[2] = s[2];
  }

  /** Libère les géométries propres (les géométries partagées du cache restent). */
  public dispose(): void {
    this.root.removeFromParent();
  }
}

// ─── Outils de poses ────────────────────────────────────────────────────────────

export function merge(a: Pose, rot: Readonly<Record<string, V3>>, extra: Partial<Pose> = {}): Pose {
  const root = extra.root ?? a.root;
  const scale = extra.scale ?? a.scale;
  return {
    rot: { ...a.rot, ...rot },
    ...(root ? { root } : {}),
    ...(scale ? { scale } : {}),
  };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const rot: Record<string, V3> = {};
  const keys = new Set([...Object.keys(a.rot), ...Object.keys(b.rot)]);
  for (const k of keys) {
    const ra = a.rot[k] ?? ZERO;
    const rb = b.rot[k] ?? ZERO;
    rot[k] = [
      ra[0] + (rb[0] - ra[0]) * t,
      ra[1] + (rb[1] - ra[1]) * t,
      ra[2] + (rb[2] - ra[2]) * t,
    ];
  }
  const lr = (x: V3 | undefined, y: V3 | undefined, d: V3): V3 => {
    const p = x ?? d;
    const q = y ?? d;
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  };
  return { rot, root: lr(a.root, b.root, ZERO), scale: lr(a.scale, b.scale, ONE) };
}

/** Copie modifiable d'une pose (pour y écrire des articulations secondaires : écharpe, cravate). */
export function editable(p: Pose): { rot: Record<string, V3>; root?: V3; scale?: V3 } {
  return {
    rot: { ...p.rot },
    ...(p.root ? { root: p.root } : {}),
    ...(p.scale ? { scale: p.scale } : {}),
  };
}

export type Ease = (t: number) => number;
export const easeInOut: Ease = (t) => t * t * (3 - 2 * t);
export const easeOut: Ease = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeIn: Ease = (t) => t * t * t;

export type PoseKey = readonly [number, Pose, Ease?];

/** Poses clés (temps en ms) interpolées ; chaque segment peut avoir son easing. */
export function keyed(keys: readonly PoseKey[], tMs: number): Pose {
  const first = keys[0];
  if (!first) throw new Error('keyed : aucune pose');
  if (tMs <= first[0]) return first[1];
  for (let i = 0; i < keys.length - 1; i += 1) {
    const ka = keys[i];
    const kb = keys[i + 1];
    if (!ka || !kb) break;
    const [ta, pa] = ka;
    const [tb, pb, e] = kb;
    if (tMs <= tb) {
      const u = tb === ta ? 1 : (tMs - ta) / (tb - ta);
      return lerpPose(pa, pb, (e ?? easeInOut)(u));
    }
  }
  const last = keys[keys.length - 1] ?? first;
  return last[1];
}
