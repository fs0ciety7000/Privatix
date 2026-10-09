// Salle de quai nocturne : quai dallé, ligne jaune, voie en contrebas (ballast, traverses, rails),
// caténaires, piliers en fonte, bancs, suspensions, panneaux lumineux et néons Privatix.
// Le décor statique est fusionné par matériau (peu d'appels de rendu).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, glow, outlineGeo, outlineMat, PAL, radialTexture, rboxGeo, rng, sncbLogoTexture, toon } from './toon';

export interface Collider {
  kind: 'circle' | 'box';
  x: number;
  z: number;
  r: number;
  hx: number;
  hz: number;
}

export interface Level {
  group: THREE.Group;
  colliders: Collider[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  lamps: THREE.Vector3[];
  wireY: number;
  wireZ: number;
  sparkLight: THREE.PointLight;
  /** Lampes fixes du décor (ordre = canaux de cuisson). */
  bakeLights: THREE.PointLight[];
  /** Maillages statiques éclairés (toon) que l'on peut cuire. */
  staticMeshes: THREE.Mesh[];
  /** Coupe le grésillement du néon (réduction des mouvements). */
  steady: boolean;
  update(t: number, dt: number): void;
}

interface AddOpts {
  cast?: boolean;
  receive?: boolean;
  outline?: number; // largeur px, 0 = pas de contour
  uv?: boolean; // garder les UV même sans texture (shaders maison)
  order?: number; // renderOrder du maillage fusionné
}

class StaticBatch {
  private buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean; order: number }>();

  add(geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4, o: AddOpts = {}): void {
    const cast = o.cast ?? true;
    const receive = o.receive ?? true;
    const order = o.order ?? 0;
    const key = `${mat.uuid}|${cast}|${receive}|${order}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { mat, geos: [], cast, receive, order };
      this.buckets.set(key, b);
    }
    b.geos.push(normalize(geo, m, o.uv ?? (mat as THREE.MeshToonMaterial).map != null));
    const ow = o.outline ?? 2.2;
    if (ow > 0) {
      const om = outlineMat(ow);
      const okey = `${om.uuid}|o`;
      let ob = this.buckets.get(okey);
      if (!ob) {
        ob = { mat: om, geos: [], cast: false, receive: false, order: 0 };
        this.buckets.set(okey, ob);
      }
      ob.geos.push(normalize(outlineGeo(geo), m, false));
    }
  }

  build(parent: THREE.Object3D): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const b of this.buckets.values()) {
      const g = mergeGeometries(b.geos, false);
      if (!g) continue;
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.renderOrder = b.order;
      parent.add(mesh);
      out.push(mesh);
    }
    this.buckets.clear();
    return out;
  }
}

function normalize(geo: THREE.BufferGeometry, m: THREE.Matrix4, keepUv: boolean): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.getAttribute('position').clone());
  const n = geo.getAttribute('normal');
  if (n) g.setAttribute('normal', n.clone());
  const uv = geo.getAttribute('uv');
  if (keepUv) {
    if (uv) g.setAttribute('uv', uv.clone());
    else g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2));
  }
  if (geo.index) g.setIndex(geo.index.clone());
  const out = g.index ? g.toNonIndexed() : g;
  out.applyMatrix4(m);
  return out;
}

const M = new THREE.Matrix4();
function mat4(x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, s: [number, number, number] = [1, 1, 1]): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  return M.clone().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(...s));
}

// ─── Textures ──────────────────────────────────────────────────────────────────

function floorTexture(): THREE.CanvasTexture {
  const R = rng(7);
  const t = canvasTexture(512, 512, (g) => {
    g.fillStyle = '#1a1830';
    g.fillRect(0, 0, 512, 512);
    const n = 4;
    const s = 512 / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = 70 + Math.floor(R() * 22);
        g.fillStyle = `rgb(${v - 6},${v},${v + 26})`;
        g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
        // speckles
        for (let i = 0; i < 90; i++) {
          const a = R() * 0.18;
          g.fillStyle = R() > 0.5 ? `rgba(255,255,255,${a * 0.4})` : `rgba(10,8,30,${a})`;
          g.fillRect(x * s + 3 + R() * (s - 8), y * s + 3 + R() * (s - 8), 2 + R() * 3, 2 + R() * 3);
        }
        // bevel highlight
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(x * s + 3, y * s + 3, s - 6, 4);
      }
    // stains
    for (let i = 0; i < 6; i++) {
      const sx = R() * 512;
      const sy = R() * 512;
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, 40 + R() * 80);
      gr.addColorStop(0, 'rgba(12,8,30,0.25)');
      gr.addColorStop(1, 'rgba(12,8,30,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 512, 512);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function ballastTexture(): THREE.CanvasTexture {
  const R = rng(11);
  const t = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#2b2530';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      const v = 40 + Math.floor(R() * 60);
      g.fillStyle = `rgb(${v + 6},${v},${v + 10})`;
      const s = 3 + R() * 7;
      g.beginPath();
      g.ellipse(R() * 256, R() * 256, s, s * (0.6 + R() * 0.4), R() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function wallTexture(): THREE.CanvasTexture {
  const R = rng(3);
  const t = canvasTexture(512, 512, (g) => {
    g.fillStyle = '#231d36';
    g.fillRect(0, 0, 512, 512);
    // briques
    const bw = 64;
    const bh = 24;
    for (let y = 0; y < 512 / bh + 1; y++)
      for (let x = -1; x < 512 / bw + 1; x++) {
        const v = 38 + Math.floor(R() * 16);
        g.fillStyle = `rgb(${v + 14},${v - 4},${v + 18})`;
        g.fillRect(x * bw + (y % 2) * (bw / 2) + 2, y * bh + 2, bw - 4, bh - 4);
      }
    // coulures
    for (let i = 0; i < 10; i++) {
      const x = R() * 512;
      const gr = g.createLinearGradient(0, 0, 0, 512);
      gr.addColorStop(0, 'rgba(8,6,20,0.35)');
      gr.addColorStop(1, 'rgba(8,6,20,0)');
      g.fillStyle = gr;
      g.fillRect(x, 0, 6 + R() * 18, 200 + R() * 300);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function signTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  return canvasTexture(w, h, (g) => draw(g, w, h));
}

const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

// ─── Construction ──────────────────────────────────────────────────────────────

export function buildLevel(scene: THREE.Scene): Level {
  const group = new THREE.Group();
  scene.add(group);
  const batch = new StaticBatch();
  const colliders: Collider[] = [];
  const R = rng(42);

  const EDGE_Z = -5; // bord du quai
  const TRACK_Y = -1.25;
  const RAIL_Z = -8.2;
  const FAR_EDGE = -11.6;
  const WALL_Z = -14.2;
  const X0 = -34;
  const X1 = 34;

  // Matériaux
  const floorMap = floorTexture();
  floorMap.repeat.set((X1 - X0) / 2, 9);
  const mFloor = toon(0xffffff, { map: floorMap });
  const mConcrete = toon(0x5a5f82);
  const mConcreteDark = toon(0x2c2944);
  const mCoping = toon(0x8c8fae);
  const mYellow = toon(0xffd400, { emissive: 0xffc400, emissiveIntensity: 0.35 });
  const mTactile = toon(0xb9bdd6);
  const ballastMap = ballastTexture();
  ballastMap.repeat.set((X1 - X0) / 3, 3);
  const mBallast = toon(0xffffff, { map: ballastMap });
  const mSleeper = toon(0x5a4a52);
  const mRail = toon(0x7d88a8, { rimStrength: 0.9 });
  const mRailTop = toon(0xd6e2ff, { emissive: 0x8090c0, emissiveIntensity: 0.4 });
  const wallMap = wallTexture();
  wallMap.repeat.set((X1 - X0) / 6, 2);
  const mWall = toon(0xffffff, { map: wallMap });
  const mIron = toon(0x2a3a6a, { rimStrength: 0.7 });
  const mIronDark = toon(0x1a2244);
  const mMast = toon(0x4a5878);
  const mWire = toon(0x1a1626);
  const mWood = toon(0xb8693a);
  const mBenchMetal = toon(0x24315a);
  const mBin = toon(0x1e6a5a);
  const mLampShade = toon(0x26304e, { rimStrength: 0.6 });

  const BOX = (w: number, h: number, d: number, r = 0.02) => rboxGeo(w, h, d, r);

  // ── Quai ──
  const platW = X1 - X0;
  {
    const top = new THREE.PlaneGeometry(platW, 18);
    top.rotateX(-Math.PI / 2);
    batch.add(top, mFloor, mat4(0, 0, EDGE_Z + 0.6 + 9), { cast: false, outline: 0 });
    batch.add(BOX(platW, 1.2, 0.2, 0), mConcreteDark, mat4(0, -0.62, EDGE_Z + 0.1), { cast: false, outline: 0 });
    // margelle du bord
    batch.add(BOX(platW, 0.14, 0.7, 0.04), mCoping, mat4(0, -0.05, EDGE_Z + 0.33), { cast: false, outline: 2 });
    // ligne jaune + bande podotactile
    batch.add(BOX(platW, 0.02, 0.14, 0), mYellow, mat4(0, 0.012, EDGE_Z + 1.05), { cast: false, outline: 0 });
    const dots = new THREE.PlaneGeometry(platW, 0.42);
    dots.rotateX(-Math.PI / 2);
    batch.add(dots, mTactile, mat4(0, 0.006, EDGE_Z + 1.45), { cast: false, outline: 0 });
    // mur de quai côté voie (face visible)
    batch.add(BOX(platW, 1.25, 0.25, 0), mConcrete, mat4(0, TRACK_Y + 0.6, EDGE_Z - 0.0), { cast: false, outline: 0 });
  }

  // ── Voie ──
  {
    const bal = new THREE.PlaneGeometry(platW, FAR_EDGE - EDGE_Z < 0 ? EDGE_Z - FAR_EDGE : 7);
    bal.rotateX(-Math.PI / 2);
    batch.add(bal, mBallast, mat4(0, TRACK_Y, (EDGE_Z + FAR_EDGE) / 2), { cast: false, outline: 0 });
    // remblai sous la voie
    batch.add(BOX(platW, 0.3, 3.4, 0.12), mBallast, mat4(0, TRACK_Y + 0.05, RAIL_Z), { cast: false, outline: 0 });
    for (let x = X0; x <= X1; x += 0.72) {
      batch.add(BOX(0.26, 0.12, 2.7, 0.03), mSleeper, mat4(x, TRACK_Y + 0.24, RAIL_Z), { cast: true, outline: 1.6 });
    }
    for (const dz of [-0.72, 0.72]) {
      batch.add(BOX(platW, 0.14, 0.09, 0.0), mRail, mat4(0, TRACK_Y + 0.37, RAIL_Z + dz), { cast: true, outline: 1.8 });
      batch.add(BOX(platW, 0.035, 0.12, 0.0), mRailTop, mat4(0, TRACK_Y + 0.455, RAIL_Z + dz), { cast: false, outline: 0 });
      batch.add(BOX(platW, 0.03, 0.22, 0.0), mRail, mat4(0, TRACK_Y + 0.31, RAIL_Z + dz), { cast: false, outline: 0 });
    }
  }

  // ── Quai d'en face + mur du fond ──
  {
    const farTop = new THREE.PlaneGeometry(platW, WALL_Z - FAR_EDGE < 0 ? FAR_EDGE - WALL_Z : 2.6);
    farTop.rotateX(-Math.PI / 2);
    batch.add(farTop, mFloor, mat4(0, 0, (FAR_EDGE + WALL_Z) / 2), { cast: false, outline: 0 });
    batch.add(BOX(platW, 1.25, 0.25, 0), mConcrete, mat4(0, TRACK_Y + 0.6, FAR_EDGE - 0.12), { cast: false, outline: 0 });
    batch.add(BOX(platW, 0.14, 0.6, 0.04), mCoping, mat4(0, -0.05, FAR_EDGE - 0.3), { cast: false, outline: 2 });
    batch.add(BOX(platW, 0.02, 0.12, 0), mYellow, mat4(0, 0.012, FAR_EDGE - 0.95), { cast: false, outline: 0 });
    const wall = new THREE.PlaneGeometry(platW, 12);
    batch.add(wall, mWall, mat4(0, 5.5, WALL_Z), { cast: false, outline: 0 });
    // plinthe et corniche
    batch.add(BOX(platW, 0.5, 0.3, 0.05), mConcreteDark, mat4(0, 0.25, WALL_Z + 0.1), { cast: false, outline: 2 });
    batch.add(BOX(platW, 0.3, 0.5, 0.05), mConcreteDark, mat4(0, 7.2, WALL_Z + 0.2), { cast: false, outline: 2 });
    // pilastres du mur
    for (let x = X0 + 4; x < X1; x += 8) {
      batch.add(BOX(0.7, 8, 0.4, 0.06), mConcreteDark, mat4(x, 3.8, WALL_Z + 0.2), { cast: false, outline: 2 });
    }
  }

  // ── Caténaires : poteaux côté quai d'en face, consoles, fils ──
  const WIRE_Y = 4.6;
  {
    for (let x = X0 + 2; x < X1; x += 11) {
      batch.add(BOX(0.28, 6.4, 0.28, 0.03), mMast, mat4(x, 3.2, FAR_EDGE - 0.9), { cast: true, outline: 2.2 });
      batch.add(BOX(0.12, 0.12, 4.0, 0.02), mMast, mat4(x, 5.7, RAIL_Z - 0.4 + 0.2), { cast: true, outline: 2 });
      // hauban incliné
      const len = 3.4;
      batch.add(BOX(0.08, 0.08, len, 0.02), mMast, mat4(x, 5.05, RAIL_Z + 0.4, 0, -0.38), { cast: false, outline: 1.6 });
      // isolateurs
      batch.add(BOX(0.12, 0.3, 0.12, 0.04), toonCache('iso', () => toon(0x8a3a5a)), mat4(x, 5.4, RAIL_Z), { cast: false, outline: 1.6 });
      // pendules
    }
    const wire = (_y: number, r: number) => {
      const g = new THREE.CylinderGeometry(r, r, platW, 5, 1, true);
      g.rotateZ(Math.PI / 2);
      return g;
    };
    batch.add(wire(WIRE_Y, 0.025), mWire, mat4(0, WIRE_Y, RAIL_Z), { cast: true, outline: 1.4 });
    batch.add(wire(WIRE_Y + 0.9, 0.022), mWire, mat4(0, WIRE_Y + 0.9, RAIL_Z), { cast: true, outline: 1.4 });
    for (let x = X0; x < X1; x += 1.8) {
      batch.add(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 3), mWire, mat4(x, WIRE_Y + 0.45, RAIL_Z), { cast: false, outline: 1 });
    }
  }

  // ── Piliers en fonte (côté voie) ──
  const PILLAR_Z = -3.4;
  const pillarXs = [-15, -7.5, 7.5, 15];
  for (const x of pillarXs) {
    batch.add(BOX(0.62, 0.35, 0.62, 0.05), mIronDark, mat4(x, 0.17, PILLAR_Z), { outline: 2.4 });
    const shaft = new THREE.CylinderGeometry(0.2, 0.24, 6.2, 12);
    batch.add(shaft, mIron, mat4(x, 3.3, PILLAR_Z), { outline: 2.4 });
    batch.add(new THREE.CylinderGeometry(0.42, 0.22, 0.45, 12), mIron, mat4(x, 6.5, PILLAR_Z), { outline: 2.4 });
    batch.add(BOX(0.95, 0.12, 0.95, 0.03), mIronDark, mat4(x, 6.78, PILLAR_Z), { outline: 2.4 });
    // bague décorative
    batch.add(new THREE.TorusGeometry(0.23, 0.04, 6, 14).rotateX(Math.PI / 2), mIronDark, mat4(x, 1.2, PILLAR_Z), { outline: 0 });
    colliders.push({ kind: 'circle', x, z: PILLAR_Z, r: 0.38, hx: 0, hz: 0 });
  }

  // ── Bancs ──
  const bench = (x: number, z: number, ry: number) => {
    for (const dx of [-0.85, 0.85]) {
      const lx = Math.cos(ry) * dx;
      const lz = -Math.sin(ry) * dx;
      batch.add(BOX(0.08, 0.5, 0.5, 0.02), mBenchMetal, mat4(x + lx, 0.25, z + lz, ry), { outline: 2 });
    }
    for (let i = 0; i < 3; i++) {
      const off = -0.16 + i * 0.16;
      batch.add(BOX(2.1, 0.06, 0.13, 0.025), mWood, mat4(x + Math.sin(ry) * off, 0.52, z + Math.cos(ry) * off, ry), { outline: 2 });
    }
    for (let i = 0; i < 2; i++) {
      const bo = -0.28;
      batch.add(BOX(2.1, 0.13, 0.05, 0.02), mWood, mat4(x + Math.sin(ry) * bo, 0.72 + i * 0.18, z + Math.cos(ry) * bo, ry, -0.15), { outline: 2 });
    }
    colliders.push({ kind: 'box', x, z, r: 0, hx: Math.abs(Math.cos(ry)) * 1.1 + Math.abs(Math.sin(ry)) * 0.35, hz: Math.abs(Math.sin(ry)) * 1.1 + Math.abs(Math.cos(ry)) * 0.35 });
  };
  bench(-11, 3.6, Math.PI);
  bench(11, 3.6, Math.PI);
  bench(-3.6, -2.6, 0);

  // ── Poubelles ──
  for (const [x, z] of [
    [-5.4, -2.7],
    [12.8, 3.6],
    [4, 6.8],
  ] as const) {
    batch.add(new THREE.CylinderGeometry(0.3, 0.26, 0.85, 12), mBin, mat4(x, 0.42, z), { outline: 2.2 });
    batch.add(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 12), mIronDark, mat4(x, 0.88, z), { outline: 2.2 });
    colliders.push({ kind: 'circle', x, z, r: 0.34, hx: 0, hz: 0 });
  }

  // ── Distributeur « HORS SERVICE » ──
  {
    const x = -16.6;
    const z = 1.2;
    batch.add(BOX(1.1, 2.1, 0.9, 0.06), toonCache('vend', () => toon(0x9a1e3c, { rimStrength: 0.5 })), mat4(x, 1.05, z), { outline: 2.4 });
    const scr = signTexture(256, 160, (g, w, h) => {
      g.fillStyle = '#100616';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ff3b3b';
      g.font = `bold 34px ${FONT}`;
      g.textAlign = 'center';
      g.fillText('HORS', w / 2, 68);
      g.fillText('SERVICE', w / 2, 112);
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshBasicMaterial({ map: scr, color: new THREE.Color(2.2, 2.2, 2.2) }));
    p.position.set(x, 1.55, z + 0.46);
    group.add(p);
    colliders.push({ kind: 'box', x, z, r: 0, hx: 0.6, hz: 0.5 });
  }

  // ── Murs latéraux (limites de la salle) ──
  for (const sx of [-1, 1]) {
    batch.add(BOX(1.2, 7, 14, 0.08), mConcreteDark, mat4(sx * 18.2, 3.5, 2.2), { outline: 2.4 });
    batch.add(BOX(1.3, 0.4, 14.2, 0.06), mIron, mat4(sx * 18.2, 0.2, 2.2), { outline: 2.4 });
  }

  const staticMeshes = batch.build(group);
  // Second lot : décor posé après coup (panneaux, train, suspensions), fusionné lui aussi.
  const deco = new StaticBatch();
  const NO = { cast: false, receive: false, outline: 0 } as const;

  // ── Panneaux et néons (émissifs) ──
  const emissivePlane = (tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, intensity: number, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(intensity, intensity, intensity), transparent: true }),
    );
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0, 'YXZ');
    group.add(m);
    return m;
  };

  // Néon PRIVATIX sur le mur du fond
  const neonTex = signTexture(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = `900 150px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#ff3ea5';
    g.shadowBlur = 30;
    g.strokeStyle = '#ff6ec0';
    g.lineWidth = 10;
    g.strokeText('PRIVATIX', w / 2 + 40, h / 2 + 6);
    g.shadowBlur = 0;
    g.fillStyle = '#ffd6ee';
    g.fillText('PRIVATIX', w / 2 + 40, h / 2 + 6);
    // logo : flèche en P
    g.lineWidth = 14;
    g.strokeStyle = '#ffd6ee';
    g.beginPath();
    g.arc(110, h / 2, 52, -Math.PI / 2, Math.PI / 2);
    g.moveTo(110, h / 2 - 52);
    g.lineTo(110, h / 2 + 100);
    g.stroke();
  });
  const neon = emissivePlane(neonTex, 8, 2, 0, 3.3, WALL_Z + 0.05, 2.6);
  const neonBack = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 2.4), new THREE.MeshBasicMaterial({ map: radialTexture(), color: new THREE.Color(0xff3ea5).multiplyScalar(0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  neonBack.position.set(0, 3.3, WALL_Z + 0.03);
  neonBack.scale.set(1.5, 1.6, 1);
  group.add(neonBack);

  // Tubes néon turquoise le long du mur
  const tubeMat = glow(PAL.enemy, 3.2);
  for (const y of [6.55, 1.0]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, X1 - X0, 6).rotateZ(Math.PI / 2), tubeMat);
    tube.position.set(0, y, WALL_Z + 0.15);
    group.add(tube);
  }

  // Caissons publicitaires (satire, aucune marque réelle)
  const ad = (title: string, line: string, small: string, bg: string, fg: string, accent: string) =>
    signTexture(512, 320, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, bg);
      gr.addColorStop(1, '#0a0618');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = accent;
      g.lineWidth = 8;
      g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = fg;
      g.font = `900 58px ${FONT}`;
      g.fillText(title, 34, 96);
      g.font = `bold 30px ${FONT}`;
      g.fillStyle = '#ffffff';
      wrap(g, line, 34, 150, w - 68, 36);
      g.font = `italic 20px Arial, sans-serif`;
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillText(small, 34, h - 34);
    });
  const adA = ad('PRIVATIX', 'Optimisons vos trajets.*', '* sous réserve de rentabilité', '#5a0f3e', '#ff6ec0', '#ff3ea5');
  const adB = ad('MODERNISATION', 'Votre gare, bientôt plus agile.', 'Plan Mons 2032 · merci de votre patience.', '#0d4a52', '#5ff7e4', '#19c3b1');
  const adMats = new Map<THREE.Texture, THREE.MeshBasicMaterial>();
  for (const [tex, x] of [
    [adA, -9.5],
    [adB, 9.5],
    [adB, -26],
    [adA, 26],
  ] as const) {
    deco.add(rboxGeo(4.0, 2.6, 0.18, 0.05), mIronDark, mat4(x, 2.9, WALL_Z + 0.1), NO);
    let am = adMats.get(tex);
    if (!am) {
      am = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5), transparent: true });
      adMats.set(tex, am);
    }
    deco.add(new THREE.PlaneGeometry(3.7, 2.3), am, mat4(x, 2.9, WALL_Z + 0.2), NO);
  }

  // Panneau de gare « MONS » sur les piliers
  const monsTex = signTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#1d3f9c';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#ffffff';
    g.font = `900 78px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('MONS', w / 2, h / 2 + 4);
  });
  const monsMat = new THREE.MeshBasicMaterial({ map: monsTex, color: new THREE.Color(1.05, 1.05, 1.05) });
  const pillarLogoMat = new THREE.MeshBasicMaterial({ map: sncbLogoTexture(), transparent: true, color: new THREE.Color(1.3, 1.3, 1.3) });
  for (const x of [-7.5, 7.5]) {
    deco.add(rboxGeo(2.4, 0.66, 0.1, 0.03), mIronDark, mat4(x, 3.4, PILLAR_Z + 0.32), { cast: true, receive: false, outline: 0 });
    deco.add(new THREE.PlaneGeometry(2.3, 0.58), monsMat, mat4(x, 3.4, PILLAR_Z + 0.38), NO);
    deco.add(new THREE.PlaneGeometry(0.62, 0.41), pillarLogoMat, mat4(x - 1.65, 3.4, PILLAR_Z + 0.36), NO);
  }

  // ── Train garé sur la voie (à gauche) ──
  {
    const mWhite = toon(0xe8ecf6, { rimStrength: 0.8 });
    const mBlue = toon(0x0069b4, { rimStrength: 0.6 });
    const mYellowT = toon(0xffcc00, { rimStrength: 0.6 });
    const mGlass = toon(0x141a34, { rimStrength: 1.2, rim: 0x9fd8ff });
    const mRoof = toon(0x5a6280);
    const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc070).multiplyScalar(1.2) });
    const ty = TRACK_Y + 0.5;
    const tz = RAIL_Z;
    const cars = [
      [-23.6, 15],
      [-38.8, 15],
    ] as const;
    const trainLogoMat = new THREE.MeshBasicMaterial({ map: sncbLogoTexture(), transparent: true });
    const CAST = { cast: true, receive: false, outline: 0 } as const;
    for (const [cx, L] of cars) {
      deco.add(rboxGeo(L, 2.7, 2.9, 0.35), mWhite, mat4(cx, ty + 1.75, tz), CAST);
      deco.add(rboxGeo(L + 0.02, 0.5, 2.94, 0.05), mBlue, mat4(cx, ty + 0.75, tz), NO);
      deco.add(rboxGeo(L - 0.6, 0.3, 2.3, 0.12), mRoof, mat4(cx, ty + 3.2, tz), NO);
      for (let i = 0; i < 6; i++) {
        const wx = cx - L / 2 + 1.6 + i * ((L - 3.2) / 5);
        deco.add(new THREE.PlaneGeometry(1.5, 0.75), i % 2 ? winMat : mGlass, mat4(wx, ty + 2.15, tz + 1.46), NO);
      }
      deco.add(new THREE.PlaneGeometry(0.9, 1.9), mYellowT, mat4(cx + 0.2, ty + 1.45, tz + 1.47), NO);
      deco.add(new THREE.PlaneGeometry(1.15, 0.76), trainLogoMat, mat4(cx + 2.4, ty + 1.3, tz + 1.47), NO);
    }
    // cabine (nez du train) et phares
    deco.add(rboxGeo(1.2, 2.5, 2.8, 0.5), mYellowT, mat4(-15.7, ty + 1.65, tz), CAST);
    deco.add(rboxGeo(0.3, 0.9, 2.3, 0.1), mGlass, mat4(-15.25, ty + 2.4, tz), NO);
    const hlMat = glow(0xfff2c8, 6);
    for (const dz of [-0.9, 0.9]) deco.add(new THREE.SphereGeometry(0.14, 10, 8), hlMat, mat4(-15.12, ty + 0.9, tz + dz), NO);
  }

  // Tableau des départs suspendu
  const boardTex = signTexture(1024, 256, (g, w, h) => {
    g.fillStyle = '#07050d';
    g.fillRect(0, 0, w, h);
    g.font = `bold 46px "Courier New", monospace`;
    g.fillStyle = '#ffb02e';
    g.fillText('23:47  OMNIBUS   QUAI 3', 34, 74);
    g.fillStyle = '#ff3b3b';
    g.fillText('SUPPRIMÉ', 680, 74);
    g.fillStyle = '#ffb02e';
    g.fillText('00:12  ÉCONOMIE  QUAI 3', 34, 146);
    g.fillStyle = '#ff3b3b';
    g.fillText('À L’ÉTUDE', 680, 146);
    g.fillStyle = '#5ff7e4';
    g.font = `bold 30px "Courier New", monospace`;
    g.fillText('>> Merci de patienter pendant la restructuration <<', 34, 214);
  });
  {
    const bx = -11.25;
    const by = 3.9;
    const bz = -2.6;
    deco.add(rboxGeo(5.4, 1.5, 0.3, 0.06), mIronDark, mat4(bx, by, bz, 0, -0.35), { cast: true, receive: false, outline: 0 });
    const face = emissivePlane(boardTex, 5.1, 1.28, bx, by, bz, 2.0, 0, -0.35);
    face.position.z += 0.16 * Math.cos(0.35);
    face.position.y += 0.16 * Math.sin(0.35);
    for (const dx of [-2, 2]) deco.add(new THREE.CylinderGeometry(0.03, 0.03, 8, 5), mWire, mat4(bx + dx, by + 4.6, bz - 0.2), NO);
  }

  // ── Suspensions (lampes de quai) : abat-jour, ampoule, cône de lumière, flaque au sol ──
  const lamps: THREE.Vector3[] = [];
  const lampPos: Array<[number, number]> = [
    [-16, -1.5],
    [-4.2, -2.5],
    [4.2, -2.5],
    [11.25, -2.5],
  ];
  const bulbMat = glow(0xffd08a, 6);
  const poolTex = radialTexture();
  const coneMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(vUv.y, 1.6) * pow(f, 1.5) * 0.22; gl_FragColor = vec4(uColor*a, a); }`,
    uniforms: { uColor: { value: new THREE.Color(0xffb35c).multiplyScalar(1.4) } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const LAMP_Y = 4.5;
  const bakeLights: THREE.PointLight[] = [];
  mLampShade.side = THREE.DoubleSide;
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: new THREE.Color(0xffa040).multiplyScalar(0.35), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const poolMatFar = new THREE.MeshBasicMaterial({ map: poolTex, color: new THREE.Color(0xffa040).multiplyScalar(0.25), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [x, z] of lampPos) {
    deco.add(new THREE.CylinderGeometry(0.16, 0.46, 0.36, 16, 1, true), mLampShade, mat4(x, LAMP_Y + 0.12, z), NO);
    deco.add(new THREE.CylinderGeometry(0.12, 0.18, 0.14, 12), mLampShade, mat4(x, LAMP_Y + 0.38, z), NO);
    deco.add(new THREE.CylinderGeometry(0.015, 0.015, 9, 4), mWire, mat4(x, LAMP_Y + 4.9, z), NO);
    deco.add(new THREE.SphereGeometry(0.16, 12, 8), bulbMat, mat4(x, LAMP_Y - 0.02, z), NO);
    deco.add(new THREE.CylinderGeometry(0.4, 2.9, LAMP_Y, 24, 1, true), coneMat, mat4(x, LAMP_Y / 2, z), { ...NO, uv: true, order: 3 });
    deco.add(new THREE.PlaneGeometry(6.5, 6.5).rotateX(-Math.PI / 2), poolMat, mat4(x, 0.02, z), { ...NO, order: 2 });
    const light = new THREE.PointLight(0xffa64d, 40, 14, 1.6);
    light.position.set(x, LAMP_Y - 0.3, z);
    group.add(light);
    bakeLights.push(light);
    lamps.push(new THREE.Vector3(x, LAMP_Y, z));
  }

  // Lampes hors champ (côté caméra) : seulement leur lumière et leur flaque au sol
  for (const x of [-7.5, 7.5]) {
    const l = new THREE.PointLight(0xffb070, 20, 12, 1.6);
    l.position.set(x, 4.2, 5.2);
    group.add(l);
    bakeLights.push(l);
    deco.add(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), poolMatFar, mat4(x, 0.02, 5.2), { ...NO, order: 2 });
  }

  // Lumières d'ambiance colorées (néons) sans ombre
  const magentaLight = new THREE.PointLight(0xff3ea5, 30, 16, 1.6);
  magentaLight.position.set(0, 2.8, WALL_Z + 2.5);
  group.add(magentaLight);
  const tealLight = new THREE.PointLight(0x19c3b1, 18, 18, 1.5);
  tealLight.position.set(-16, 3, RAIL_Z);
  group.add(tealLight);
  bakeLights.push(magentaLight, tealLight);

  staticMeshes.push(...deco.build(group));

  // Lumière d'étincelle de caténaire (flash bref)
  const sparkLight = new THREE.PointLight(0x9fe8ff, 0, 10, 1.6);
  sparkLight.position.set(0, WIRE_Y - 0.2, RAIL_Z);
  group.add(sparkLight);

  void R;

  const level: Level = {
    group,
    colliders,
    bounds: { minX: -17.2, maxX: 17.2, minZ: EDGE_Z + 0.75, maxZ: 8.6 },
    lamps,
    wireY: WIRE_Y,
    wireZ: RAIL_Z,
    sparkLight,
    bakeLights,
    staticMeshes: staticMeshes.filter((m) => m.material instanceof THREE.MeshToonMaterial),
    steady: false,
    update(t: number) {
      // néon qui grésille parfois (coupé en réduction des mouvements)
      const flick = !level.steady && (Math.sin(t * 37) > 0.97 || (Math.sin(t * 0.7) > 0.995 && Math.sin(t * 53) > 0));
      (neon.material as THREE.MeshBasicMaterial).color.setScalar(flick ? 0.6 : 2.6);
      magentaLight.intensity = flick ? 8 : 30;
    },
  };
  return level;
}

const toonStore = new Map<string, THREE.MeshToonMaterial>();
function toonCache(k: string, make: () => THREE.MeshToonMaterial): THREE.MeshToonMaterial {
  let m = toonStore.get(k);
  if (!m) {
    m = make();
    toonStore.set(k, m);
  }
  return m;
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): void {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) g.fillText(line, x, yy);
}
