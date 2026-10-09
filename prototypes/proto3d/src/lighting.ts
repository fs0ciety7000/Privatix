// Budget de lumières dynamiques par preset.
//  - Haut : toutes les lampes du décor sont de vraies PointLight (comportement d'origine).
//  - Moyen / Bas : les lampes du décor sont « cuites » dans les sommets du décor statique
//    (8 canaux de poids par sommet × couleur courante en uniform) et seules N vraies lumières
//    (« slots ») suivent les sources les plus utiles autour du héros. Quand une lampe reçoit un
//    slot, son apport cuit s'efface en fondu : pas de double éclairage, pas de saut.
// Le nombre de lumières reste constant dans un preset : aucun shader n'est recompilé en jeu.
import * as THREE from 'three';
import { BAKE_CHANNELS, bakedToon, bakeUniforms } from './toon';

interface Source {
  light: THREE.PointLight;
  /** canal de cuisson (lampes du décor) ou -1 (sources mobiles : butin). */
  channel: number;
  /** poids de priorité (le butin passe avant le décor). */
  priority: number;
  /** part actuellement rendue par un vrai slot (0..1). */
  real: number;
}

interface Slot {
  light: THREE.PointLight;
  src: Source | null;
  fade: number;
}

interface BakedMesh {
  mesh: THREE.Mesh;
  hiGeo: THREE.BufferGeometry;
  hiMat: THREE.Material | THREE.Material[];
  loGeo: THREE.BufferGeometry | null;
  loMat: THREE.Material | null;
}

const FADE_RATE = 7; // fondu d'un slot (1/s)

export class LightBudget {
  private sources: Source[] = [];
  private slots: Slot[] = [];
  private baked: BakedMesh[] = [];
  private bakeLights: THREE.PointLight[];
  /** null = toutes les lumières réelles (Haut). */
  private nSlots: number | null = null;
  private readonly tmp = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    bakeLights: THREE.PointLight[],
    dynamicLights: THREE.PointLight[],
    /** lumières coupées hors Haut (flash d'étincelle de caténaire). */
    private readonly highOnly: THREE.PointLight[],
  ) {
    this.bakeLights = bakeLights.slice(0, BAKE_CHANNELS);
    this.bakeLights.forEach((l, i) => this.sources.push({ light: l, channel: i, priority: 1, real: 1 }));
    // butin : lumière faible mais au plus près du héros (sa lueur reste portée par le faisceau et le disque)
    for (const l of dynamicLights) this.sources.push({ light: l, channel: -1, priority: 5, real: 1 });
  }

  /** Enregistre un maillage statique du décor (matériau toon) à cuire. */
  registerStatic(mesh: THREE.Mesh): void {
    if (!(mesh.material instanceof THREE.MeshToonMaterial)) return;
    this.baked.push({ mesh, hiGeo: mesh.geometry, hiMat: mesh.material, loGeo: null, loMat: null });
  }

  get realLightCount(): number {
    let n = 0;
    this.scene.traverseVisible((o) => {
      if ((o as THREE.PointLight).isPointLight) n++;
    });
    return n;
  }

  get bakedTriangles(): number {
    let t = 0;
    for (const b of this.baked) if (b.loGeo) t += (b.loGeo.getAttribute('position').count / 3) | 0;
    return t;
  }

  /** n = nombre de slots dynamiques (hors lampe frontale du héros), null = tout réel. */
  setMode(n: number | null): void {
    this.nSlots = n;
    const real = n === null;
    for (const s of this.sources) {
      s.light.visible = real;
      s.real = real ? 1 : 0;
    }
    for (const l of this.highOnly) l.visible = real;
    while (this.slots.length < (n ?? 0)) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      l.position.set(0, -50, 0);
      this.scene.add(l);
      this.slots.push({ light: l, src: null, fade: 0 });
    }
    this.slots.forEach((s, i) => {
      s.light.visible = !real && i < (n ?? 0);
      s.src = null;
      s.fade = 0;
      s.light.intensity = 0;
    });
    if (!real) this.ensureBaked();
    for (const b of this.baked) {
      b.mesh.geometry = real || !b.loGeo ? b.hiGeo : b.loGeo;
      b.mesh.material = real || !b.loMat ? b.hiMat : b.loMat;
    }
  }

  update(focus: THREE.Vector3, dt: number): void {
    if (this.nSlots === null) return;
    const n = this.nSlots;
    const active = this.slots.slice(0, n);
    // Score : intensité × priorité, décroissant avec la distance (plan XZ) au point d'intérêt.
    const score = (s: Source): number => {
      const l = s.light;
      if (l.intensity <= 0.01) return 0;
      const wp = l.getWorldPosition(this.tmp);
      const d2 = (wp.x - focus.x) ** 2 + (wp.z - focus.z) ** 2;
      const held = active.some((sl) => sl.src === s) ? 1.35 : 1; // hystérésis
      return (l.intensity * s.priority * held) / (1 + d2 / 16);
    };
    const ranked = this.sources
      .map((s) => ({ s, k: score(s) }))
      .filter((r) => r.k > 0)
      .sort((a, b) => b.k - a.k)
      .slice(0, n)
      .map((r) => r.s);
    for (const sl of active) {
      const wanted = sl.src !== null && ranked.includes(sl.src);
      if (sl.src && !wanted) {
        sl.fade = Math.max(0, sl.fade - dt * FADE_RATE);
        if (sl.fade === 0) sl.src = null;
      } else if (sl.src) sl.fade = Math.min(1, sl.fade + dt * FADE_RATE);
    }
    for (const s of ranked) {
      if (active.some((sl) => sl.src === s)) continue;
      const free = active.find((sl) => sl.src === null);
      if (free) {
        free.src = s;
        free.fade = 0;
      }
    }
    for (const s of this.sources) s.real = 0;
    for (const sl of active) {
      const s = sl.src;
      if (!s) {
        sl.light.intensity = 0;
        continue;
      }
      const l = s.light;
      l.getWorldPosition(sl.light.position);
      sl.light.color.copy(l.color);
      sl.light.distance = l.distance;
      sl.light.decay = l.decay;
      sl.light.intensity = l.intensity * sl.fade;
      s.real = sl.fade;
    }
    // apport cuit restant de chaque lampe du décor
    const cols = bakeUniforms.uBakeCol.value;
    for (const s of this.sources) {
      if (s.channel < 0) continue;
      cols[s.channel].copy(s.light.color).multiplyScalar(s.light.intensity * (1 - s.real));
    }
  }

  // ─── Cuisson ──────────────────────────────────────────────────────────────────

  private ensureBaked(): void {
    const mats = new Map<string, THREE.MeshToonMaterial>();
    const lights = this.bakeLights.map((l) => {
      l.updateWorldMatrix(true, false);
      return { pos: l.getWorldPosition(new THREE.Vector3()), dist: l.distance, decay: l.decay };
    });
    for (const b of this.baked) {
      if (b.loGeo) continue;
      const src = b.hiMat as THREE.MeshToonMaterial;
      let m = mats.get(src.uuid);
      if (!m) {
        m = bakedToon(src);
        mats.set(src.uuid, m);
      }
      b.mesh.updateWorldMatrix(true, false);
      b.loGeo = bakeGeometry(b.hiGeo, b.mesh.matrixWorld, lights);
      b.loMat = m;
    }
  }
}

// Rampe toon (cf. toonGradient) : valeurs linéaires des 4 marches.
const RAMP = [38 / 255, 92 / 255, 190 / 255, 1];
// Longueur max d'une arête après subdivision : fine près des lampes, lâche au loin
// (l'éclairage par sommet est interpolé linéairement entre les sommets).
const EDGE_MIN = 2;
const EDGE_REL = 0.6;

type BakeLight = { pos: THREE.Vector3; dist: number; decay: number };

function bakeGeometry(src: THREE.BufferGeometry, world: THREE.Matrix4, lights: BakeLight[]): THREE.BufferGeometry {
  const g = tessellate(src.index ? src.toNonIndexed() : src, world, lights);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const nm = new THREE.Matrix3().getNormalMatrix(world);
  const n = pos.count;
  const a0 = new Float32Array(n * 4);
  const a1 = new Float32Array(n * 4);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const L = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    P.fromBufferAttribute(pos, i).applyMatrix4(world);
    if (nor) N.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
    else N.set(0, 1, 0);
    for (let c = 0; c < BAKE_CHANNELS; c++) {
      const li = lights[c];
      let w = 0;
      if (li) {
        L.copy(li.pos).sub(P);
        const d = Math.max(1e-4, L.length());
        L.divideScalar(d);
        const u = N.dot(L) * 0.5 + 0.5;
        const ramp = RAMP[Math.min(3, Math.max(0, Math.floor(u * 4)))];
        let att = 1 / Math.max(Math.pow(d, li.decay), 0.01);
        if (li.dist > 0) {
          const k = Math.min(1, Math.max(0, 1 - Math.pow(d / li.dist, 4)));
          att *= k * k;
        }
        w = (ramp * att) / Math.PI;
      }
      (c < 4 ? a0 : a1)[i * 4 + (c % 4)] = w;
    }
  }
  g.setAttribute('aBake0', new THREE.BufferAttribute(a0, 4));
  g.setAttribute('aBake1', new THREE.BufferAttribute(a1, 4));
  g.computeBoundingSphere();
  return g;
}

/**
 * Subdivision par bissection de l'arête la plus longue, jusqu'à ce que chaque arête soit plus
 * courte qu'un seuil qui ne dépend QUE de l'arête (longueur et distance de son milieu à la lampe
 * la plus proche). Une arête partagée est donc coupée aux mêmes milieux des deux côtés : pas de
 * fissure en T. Interpole position, normale et UV.
 */
function tessellate(src: THREE.BufferGeometry, world: THREE.Matrix4, lights: BakeLight[]): THREE.BufferGeometry {
  const pos = src.getAttribute('position');
  const nor = src.getAttribute('normal');
  const uv = src.getAttribute('uv');
  type V = { p: THREE.Vector3; w: THREE.Vector3; n: number[]; t: number[] };
  const out: V[] = [];
  const get = (i: number): V => {
    const p = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    return {
      p,
      w: p.clone().applyMatrix4(world),
      n: nor ? [nor.getX(i), nor.getY(i), nor.getZ(i)] : [0, 1, 0],
      t: uv ? [uv.getX(i), uv.getY(i)] : [0, 0],
    };
  };
  const mid = (a: V, b: V): V => {
    const n = [(a.n[0] + b.n[0]) / 2, (a.n[1] + b.n[1]) / 2, (a.n[2] + b.n[2]) / 2];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return {
      p: a.p.clone().add(b.p).multiplyScalar(0.5),
      w: a.w.clone().add(b.w).multiplyScalar(0.5),
      n: [n[0] / l, n[1] / l, n[2] / l],
      t: [(a.t[0] + b.t[0]) / 2, (a.t[1] + b.t[1]) / 2],
    };
  };
  const m = new THREE.Vector3();
  // excès de longueur de l'arête (> 0 : à couper)
  const excess = (a: V, b: V): number => {
    const len = a.w.distanceTo(b.w);
    m.copy(a.w).add(b.w).multiplyScalar(0.5);
    let dmin = Infinity;
    for (const l of lights) dmin = Math.min(dmin, l.pos.distanceTo(m));
    return len - Math.max(EDGE_MIN, dmin * EDGE_REL);
  };
  const tri = (a: V, b: V, c: V, depth: number): void => {
    const eab = excess(a, b);
    const ebc = excess(b, c);
    const eca = excess(c, a);
    if (depth > 20 || (eab <= 0 && ebc <= 0 && eca <= 0)) {
      out.push(a, b, c);
      return;
    }
    // coupe l'arête la plus longue (à égalité d'excès, la plus longue dans le monde)
    const lab = a.w.distanceToSquared(b.w);
    const lbc = b.w.distanceToSquared(c.w);
    const lca = c.w.distanceToSquared(a.w);
    if (lab >= lbc && lab >= lca) {
      const k = mid(a, b);
      tri(a, k, c, depth + 1);
      tri(k, b, c, depth + 1);
    } else if (lbc >= lca) {
      const k = mid(b, c);
      tri(a, b, k, depth + 1);
      tri(a, k, c, depth + 1);
    } else {
      const k = mid(c, a);
      tri(a, b, k, depth + 1);
      tri(k, b, c, depth + 1);
    }
  };
  for (let i = 0; i + 2 < pos.count; i += 3) tri(get(i), get(i + 1), get(i + 2), 0);
  const g = new THREE.BufferGeometry();
  const P = new Float32Array(out.length * 3);
  const Nn = new Float32Array(out.length * 3);
  const T = new Float32Array(out.length * 2);
  out.forEach((v, i) => {
    P[i * 3] = v.p.x;
    P[i * 3 + 1] = v.p.y;
    P[i * 3 + 2] = v.p.z;
    Nn.set(v.n, i * 3);
    T.set(v.t, i * 2);
  });
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(T, 2));
  return g;
}
