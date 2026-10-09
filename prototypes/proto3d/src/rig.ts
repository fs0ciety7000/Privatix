// Squelette rigide à la manière de tools/render3d/rig.py : des articulations (Groups) et des pièces
// arrondies accrochées dessus. Les poses sont des rotations en degrés (ordre YXZ) par articulation.
// Conventions (personnage tourné vers +Z, Y vers le haut, sa droite en -X) :
//  - membre pendant (bras, jambe) : X < 0 le porte vers l'avant, Z > 0 l'écarte vers +X ;
//  - tronc / tête : X > 0 penche vers l'avant ; Y = rotation sur soi (vers sa gauche).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addOutline, capsuleGeo, cylGeo, hemiGeo, outlineGeo, outlineMat, rboxGeo, sphereGeo } from './toon';

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
    if (opts.outline !== false) {
      const w = opts.outlineWidth ?? this.outlineWidth;
      addOutline(m, w);
      m.userData.outlineWidth = w;
    }
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

  /**
   * Réduit les appels de rendu d'un personnage, une fois celui-ci construit (avant tout traitement
   * qui parcourt ses maillages) :
   *  - les pièces portées par les articulations deviennent UN maillage skinné par matériau (poids 1
   *    sur l'articulation porteuse : rigide, aucune déformation), coques de contour comprises ;
   *  - les pièces des groupes d'équipement (casques, clés) sont fusionnées par groupe et par matériau.
   * Avant : 1 appel par pièce + 1 par coque + 1 dans la passe d'ombre ; après : 1 par matériau.
   */
  optimize(): void {
    this.root.updateMatrixWorld(true);
    const bones = [...this.joints.values()];
    const boneIdx = new Map<THREE.Object3D, number>(bones.map((b, i) => [b, i]));
    const candidates = new Set<THREE.Mesh>(this.meshes);
    // pièces ajoutées directement sur les articulations (dents, griffes, yeux…)
    for (const j of bones)
      for (const c of j.children)
        if (c instanceof THREE.Mesh && !c.userData.outline) {
          const mt = c.material;
          if ((mt instanceof THREE.MeshToonMaterial || mt instanceof THREE.MeshBasicMaterial) && !mt.transparent && !mt.map) candidates.add(c);
        }
    const skinGroups = new Map<string, THREE.Mesh[]>();
    const plainGroups = new Map<string, THREE.Mesh[]>();
    for (const m of candidates) {
      const p = m.parent;
      if (!p || m.userData.noMerge || !m.visible || (m.material as THREE.MeshToonMaterial).map || Array.isArray(m.material)) continue;
      if (m.children.some((c) => !c.userData.outline)) continue;
      const key = `${(m.material as THREE.Material).uuid}|${m.castShadow}|${m.receiveShadow}|${m.userData.outlineWidth ?? 0}|${m.userData.noGhost ? 1 : 0}`;
      const skinned = boneIdx.has(p);
      const map = skinned ? skinGroups : plainGroups;
      const k = skinned ? key : `${p.uuid}|${key}`;
      let g = map.get(k);
      if (!g) map.set(k, (g = []));
      g.push(m);
    }
    const kept: THREE.Mesh[] = [];
    const gone = new Set<THREE.Mesh>();
    // 1) pièces des articulations → maillages skinnés rigides
    if (skinGroups.size > 0) {
      const skeleton = new THREE.Skeleton(bones as unknown as THREE.Bone[]);
      const bodyInv = this.body.matrixWorld.clone().invert();
      const bind = this.body.matrixWorld.clone();
      const M = new THREE.Matrix4();
      for (const list of skinGroups.values()) {
        const geos: THREE.BufferGeometry[] = [];
        const oGeos: THREE.BufferGeometry[] = [];
        for (const m of list) {
          m.updateMatrix();
          const bi = boneIdx.get(m.parent as THREE.Object3D) ?? 0;
          M.multiplyMatrices(bodyInv, (m.parent as THREE.Object3D).matrixWorld).multiply(m.matrix);
          geos.push(withSkin(strip(m.geometry).applyMatrix4(M), bi));
          if (m.userData.outlineWidth) oGeos.push(withSkin(outlineGeo(m.geometry).clone().applyMatrix4(M), bi));
        }
        const g = mergeGeometries(geos, false);
        if (!g) continue;
        const first = list[0];
        const mesh = new THREE.SkinnedMesh(g, first.material);
        mesh.castShadow = first.castShadow;
        mesh.receiveShadow = first.receiveShadow;
        mesh.frustumCulled = false;
        mesh.userData.noGhost = !!first.userData.noGhost;
        this.body.add(mesh);
        mesh.bind(skeleton, bind);
        const w = first.userData.outlineWidth as number | undefined;
        if (w && oGeos.length) {
          const og = mergeGeometries(oGeos, false);
          if (og) {
            const o = new THREE.SkinnedMesh(og, outlineMat(w));
            o.castShadow = false;
            o.receiveShadow = false;
            o.frustumCulled = false;
            o.userData.outline = true;
            o.raycast = () => undefined;
            mesh.add(o);
            o.bind(skeleton, bind);
          }
          mesh.userData.outlineWidth = w;
        }
        for (const m of list) {
          m.removeFromParent();
          gone.add(m);
        }
        kept.push(mesh);
      }
    }
    // 2) groupes d'équipement : fusion simple par parent et par matériau
    for (const list of plainGroups.values()) {
      if (list.length < 2) continue;
      const parent = list[0].parent as THREE.Object3D;
      const geos: THREE.BufferGeometry[] = [];
      const oGeos: THREE.BufferGeometry[] = [];
      for (const m of list) {
        m.updateMatrix();
        geos.push(indexed(strip(m.geometry)).applyMatrix4(m.matrix));
        if (m.userData.outlineWidth) oGeos.push(outlineGeo(m.geometry).clone().applyMatrix4(m.matrix));
      }
      const g = mergeGeometries(geos, false);
      if (!g) continue;
      g.computeBoundingSphere();
      const first = list[0];
      const mesh = new THREE.Mesh(g, first.material);
      mesh.castShadow = first.castShadow;
      mesh.receiveShadow = first.receiveShadow;
      mesh.userData.noGhost = !!first.userData.noGhost;
      const w = first.userData.outlineWidth as number | undefined;
      if (w && oGeos.length) {
        const og = mergeGeometries(oGeos, false);
        if (og) {
          const o = new THREE.Mesh(og, outlineMat(w));
          o.castShadow = false;
          o.receiveShadow = false;
          o.userData.outline = true;
          o.raycast = () => undefined;
          mesh.add(o);
        }
        mesh.userData.outlineWidth = w;
      }
      for (const m of list) {
        m.removeFromParent();
        gone.add(m);
      }
      parent.add(mesh);
      kept.push(mesh);
    }
    for (let i = this.meshes.length - 1; i >= 0; i--) if (gone.has(this.meshes[i])) this.meshes.splice(i, 1);
    this.meshes.push(...kept);
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

/** Copie position + normale, toujours indexée : les UV ne servent pas aux matériaux unis. */
function strip(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', src.getAttribute('position').clone());
  const n = src.getAttribute('normal');
  if (n) g.setAttribute('normal', n.clone());
  if (src.index) g.setIndex(src.index.clone());
  return indexed(g);
}

/** Les géométries non indexées (RoundedBox…) sont soudées pour pouvoir être fusionnées avec les autres. */
function indexed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  return g.index ? g : mergeVertices(g, 1e-5);
}

/** Attache tous les sommets à une seule articulation (poids 1). */
function withSkin(g: THREE.BufferGeometry, bone: number): THREE.BufferGeometry {
  const n = g.getAttribute('position').count;
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    si[i * 4] = bone;
    sw[i * 4] = 1;
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return g;
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
