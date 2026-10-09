// Salle 3D construite depuis le gabarit réel (RoomLayout, le même ASCII que la version Phaser) :
// quai dallé, lignes de sécurité, voies (ballast, traverses, rails), piliers en fonte, bancs, murs,
// portes, suspensions et néons. Le décor statique est fusionné par matériau (peu d'appels de rendu).
// Matériaux, textures et pièces repris du prototype validé (prototypes/proto3d/src/level.ts).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TILE } from '@/config/constants';
import type { RoomLayout, TileKind } from '@/systems/procedural/RoomLayout';
import { tileAt } from '@/systems/procedural/RoomLayout';
import { pxToM } from '@/sim/units';
import {
  addOutline,
  canvasTexture,
  glow,
  outlineGeo,
  outlineMat,
  outlinesOn,
  PAL,
  radialTexture,
  rboxGeo,
  rng,
  sncbLogoTexture,
  toon,
} from '@/view/materials/toon';
import type { QualityPreset } from '@/view/quality';

/** Taille d'une tuile en mètres (16 u / 30). */
const T = pxToM(TILE);
const BACK_WALL_H = 4.6;
const LOW_WALL_H = 0.55;
const LAMP_Y = 4.2;
/** Piliers plus bas que la façade : la caméra haute garde le jeu lisible. */
const PILLAR_H = 3.3;

interface PillarView {
  readonly x: number;
  readonly z: number;
  readonly mats: readonly THREE.MeshToonMaterial[];
  readonly outlines: readonly THREE.Object3D[];
  opacity: number;
}

interface AddOpts {
  readonly cast?: boolean;
  readonly receive?: boolean;
  /** Largeur du contour en px, 0 = pas de contour. */
  readonly outline?: number;
}

interface Bucket {
  readonly mat: THREE.Material;
  readonly geos: THREE.BufferGeometry[];
  readonly cast: boolean;
  readonly receive: boolean;
}

/** Regroupe les géométries statiques par matériau, puis les fusionne (un appel de rendu par seau). */
class StaticBatch {
  private readonly buckets = new Map<string, Bucket>();

  public add(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    m: THREE.Matrix4,
    o: AddOpts = {},
  ): void {
    const cast = o.cast ?? true;
    const receive = o.receive ?? true;
    const key = `${mat.uuid}|${String(cast)}|${String(receive)}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { mat, geos: [], cast, receive };
      this.buckets.set(key, b);
    }
    b.geos.push(normalize(geo, m, (mat as THREE.MeshToonMaterial).map !== null));
    const ow = o.outline ?? 2.2;
    if (ow > 0 && outlinesOn()) {
      const om = outlineMat(ow);
      const okey = `${om.uuid}|o`;
      let ob = this.buckets.get(okey);
      if (!ob) {
        ob = { mat: om, geos: [], cast: false, receive: false };
        this.buckets.set(okey, ob);
      }
      ob.geos.push(normalize(outlineGeo(geo), m, false));
    }
  }

  public build(parent: THREE.Object3D): void {
    for (const b of this.buckets.values()) {
      const g = mergeGeometries(b.geos, false) as THREE.BufferGeometry | null;
      for (const src of b.geos) src.dispose();
      if (!g) continue;
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.buckets.clear();
  }
}

function normalize(
  geo: THREE.BufferGeometry,
  m: THREE.Matrix4,
  keepUv: boolean,
): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = geo.getAttribute('position');
  g.setAttribute('position', pos.clone());
  const n = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (n) g.setAttribute('normal', n.clone());
  if (keepUv) {
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
    g.setAttribute(
      'uv',
      uv ? uv.clone() : new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2),
    );
  }
  if (geo.index) g.setIndex(geo.index.clone());
  const out = g.index ? g.toNonIndexed() : g;
  out.applyMatrix4(m);
  return out;
}

function mat4(
  x: number,
  y: number,
  z: number,
  ry = 0,
  rx = 0,
  rz = 0,
  s: readonly [number, number, number] = [1, 1, 1],
): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    q,
    new THREE.Vector3(s[0], s[1], s[2]),
  );
}

// ─── Textures ──────────────────────────────────────────────────────────────────

function floorTexture(): THREE.CanvasTexture {
  const R = rng(7);
  const t = canvasTexture(512, 512, (g) => {
    g.fillStyle = '#1a1830';
    g.fillRect(0, 0, 512, 512);
    const n = 4;
    const s = 512 / n;
    for (let y = 0; y < n; y += 1)
      for (let x = 0; x < n; x += 1) {
        const v = 70 + Math.floor(R() * 22);
        g.fillStyle = `rgb(${String(v - 6)},${String(v)},${String(v + 26)})`;
        g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
        for (let i = 0; i < 90; i += 1) {
          const a = R() * 0.18;
          g.fillStyle =
            R() > 0.5 ? `rgba(255,255,255,${String(a * 0.4)})` : `rgba(10,8,30,${String(a)})`;
          g.fillRect(
            x * s + 3 + R() * (s - 8),
            y * s + 3 + R() * (s - 8),
            2 + R() * 3,
            2 + R() * 3,
          );
        }
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(x * s + 3, y * s + 3, s - 6, 4);
      }
    for (let i = 0; i < 6; i += 1) {
      const sx = R() * 512;
      const sy = R() * 512;
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, 40 + R() * 80);
      gr.addColorStop(0, 'rgba(12,8,30,0.25)');
      gr.addColorStop(1, 'rgba(12,8,30,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 512, 512);
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function ballastTexture(): THREE.CanvasTexture {
  const R = rng(11);
  const t = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#2b2530';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i += 1) {
      const v = 40 + Math.floor(R() * 60);
      g.fillStyle = `rgb(${String(v + 6)},${String(v)},${String(v + 10)})`;
      const s = 3 + R() * 7;
      g.beginPath();
      g.ellipse(R() * 256, R() * 256, s, s * (0.6 + R() * 0.4), R() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function wallTexture(): THREE.CanvasTexture {
  const R = rng(3);
  const t = canvasTexture(512, 512, (g) => {
    g.fillStyle = '#231d36';
    g.fillRect(0, 0, 512, 512);
    const bw = 64;
    const bh = 24;
    for (let y = 0; y < 512 / bh + 1; y += 1)
      for (let x = -1; x < 512 / bw + 1; x += 1) {
        const v = 38 + Math.floor(R() * 16);
        g.fillStyle = `rgb(${String(v + 14)},${String(v - 4)},${String(v + 18)})`;
        g.fillRect(x * bw + (y % 2) * (bw / 2) + 2, y * bh + 2, bw - 4, bh - 4);
      }
    for (let i = 0; i < 10; i += 1) {
      const x = R() * 512;
      const gr = g.createLinearGradient(0, 0, 0, 512);
      gr.addColorStop(0, 'rgba(8,6,20,0.35)');
      gr.addColorStop(1, 'rgba(8,6,20,0)');
      g.fillStyle = gr;
      g.fillRect(x, 0, 6 + R() * 18, 200 + R() * 300);
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

function wrapText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lh: number,
): void {
  let line = '';
  let yy = y;
  for (const w of text.split(' ')) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) g.fillText(line, x, yy);
}

function adTexture(
  title: string,
  line: string,
  small: string,
  bg: string,
  fg: string,
  accent: string,
): THREE.CanvasTexture {
  return canvasTexture(512, 320, (g) => {
    const gr = g.createLinearGradient(0, 0, 512, 320);
    gr.addColorStop(0, bg);
    gr.addColorStop(1, '#0a0618');
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 320);
    g.strokeStyle = accent;
    g.lineWidth = 8;
    g.strokeRect(10, 10, 492, 300);
    g.fillStyle = fg;
    g.font = `900 58px ${FONT}`;
    g.fillText(title, 34, 96);
    g.font = `bold 30px ${FONT}`;
    g.fillStyle = '#ffffff';
    wrapText(g, line, 34, 150, 444, 36);
    g.font = 'italic 20px Arial, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText(small, 34, 286);
  });
}

// ─── Vue de salle ──────────────────────────────────────────────────────────────

interface Run {
  readonly ty: number;
  readonly tx0: number;
  readonly tx1: number;
}

/** Suites horizontales de tuiles d'un même type (murs, bancs). */
function runsOf(layout: RoomLayout, kind: TileKind): Run[] {
  const out: Run[] = [];
  for (let ty = 0; ty < layout.height; ty += 1) {
    let tx = 0;
    while (tx < layout.width) {
      if (tileAt(layout, tx, ty) !== kind) {
        tx += 1;
        continue;
      }
      const tx0 = tx;
      while (tx < layout.width && tileAt(layout, tx, ty) === kind) tx += 1;
      out.push({ ty, tx0, tx1: tx - 1 });
    }
  }
  return out;
}

/** Bandes de voie : suites verticales de rangées rail/ballast (bornes en tuiles). */
function trackBands(layout: RoomLayout): { ty0: number; ty1: number; tx0: number; tx1: number }[] {
  const isTrack = (ty: number): boolean => {
    const row = layout.tiles[ty];
    return row ? row.some((k) => k === 'rail' || k === 'ballast') : false;
  };
  const bands: { ty0: number; ty1: number; tx0: number; tx1: number }[] = [];
  let ty = 0;
  while (ty < layout.height) {
    if (!isTrack(ty)) {
      ty += 1;
      continue;
    }
    const ty0 = ty;
    let tx0 = layout.width;
    let tx1 = 0;
    while (ty < layout.height && isTrack(ty)) {
      const row = layout.tiles[ty] ?? [];
      row.forEach((k, tx) => {
        if (k === 'rail' || k === 'ballast') {
          tx0 = Math.min(tx0, tx);
          tx1 = Math.max(tx1, tx);
        }
      });
      ty += 1;
    }
    bands.push({ ty0, ty1: ty - 1, tx0, tx1 });
  }
  return bands;
}

export class RoomView {
  public readonly group = new THREE.Group();
  /** Limites du sol marchable (m), pour le cadrage caméra. */
  public readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  private readonly neon: THREE.MeshBasicMaterial;
  private readonly neonLight: THREE.PointLight;
  private readonly doorLamps: THREE.MeshBasicMaterial[] = [];
  private readonly disposables: { dispose(): void }[] = [];
  private readonly pillars: PillarView[] = [];
  private flickerOn: boolean;

  public constructor(
    private readonly layout: RoomLayout,
    quality: QualityPreset,
    reducedMotion: boolean,
  ) {
    this.flickerOn = !reducedMotion;
    const W = layout.width * T;
    const H = layout.height * T;
    this.bounds = { minX: T, maxX: W - T, minZ: 2 * T, maxZ: H - T };
    const batch = new StaticBatch();

    // Matériaux
    const floorMap = floorTexture();
    floorMap.repeat.set(W / 2, H / 2);
    const mFloor = toon(0xffffff, { map: floorMap });
    const mConcreteDark = toon(0x2c2944);
    const mCoping = toon(0x8c8fae);
    const mYellow = toon(0xffd400, { emissive: 0xffc400, emissiveIntensity: 0.35 });
    const mTactile = toon(0xb9bdd6);
    const ballastMap = ballastTexture();
    ballastMap.repeat.set(W / 3, 1);
    const mBallast = toon(0xffffff, { map: ballastMap });
    const mSleeper = toon(0x5a4a52);
    const mRail = toon(0x7d88a8, { rimStrength: 0.9 });
    const mRailTop = toon(0xd6e2ff, { emissive: 0x8090c0, emissiveIntensity: 0.4 });
    const wallMap = wallTexture();
    wallMap.repeat.set(W / 6, 1);
    const mWall = toon(0xffffff, { map: wallMap });
    const mIron = toon(0x2a3a6a, { rimStrength: 0.7 });
    const mIronDark = toon(0x1a2244);
    const mWire = toon(0x1a1626);
    const mWood = toon(0xb8693a);
    const mBenchMetal = toon(0x24315a);
    const mShutter = toon(0x3a4266, { rimStrength: 0.5 });
    this.disposables.push(floorMap, ballastMap, wallMap);

    const BOX = (w: number, h: number, d: number, r = 0.02): THREE.BufferGeometry =>
      rboxGeo(w, h, d, r);

    // ── Sol : une dalle sur tout l'intérieur ──
    {
      const top = new THREE.PlaneGeometry(W, H);
      top.rotateX(-Math.PI / 2);
      batch.add(top, mFloor, mat4(W / 2, 0, H / 2), { cast: false, outline: 0 });
    }

    // ── Voies : ballast, traverses, rails (marchables, au niveau du quai) ──
    for (const band of trackBands(layout)) {
      const x0 = band.tx0 * T;
      const x1 = (band.tx1 + 1) * T;
      const z0 = band.ty0 * T;
      const z1 = (band.ty1 + 1) * T;
      const len = x1 - x0;
      const depth = z1 - z0;
      const bal = new THREE.PlaneGeometry(len, depth);
      bal.rotateX(-Math.PI / 2);
      batch.add(bal, mBallast, mat4((x0 + x1) / 2, 0.006, (z0 + z1) / 2), {
        cast: false,
        outline: 0,
      });
      for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.72) {
        batch.add(BOX(0.24, 0.07, depth * 0.92, 0.02), mSleeper, mat4(x, 0.035, (z0 + z1) / 2), {
          cast: false,
          outline: 1.4,
        });
      }
      // Rails : au centre de chaque rangée « = ».
      for (let ty = band.ty0; ty <= band.ty1; ty += 1) {
        const row = layout.tiles[ty] ?? [];
        if (!row.includes('rail')) continue;
        const z = (ty + 0.5) * T;
        batch.add(BOX(len, 0.1, 0.07, 0), mRail, mat4((x0 + x1) / 2, 0.09, z), {
          cast: true,
          outline: 1.6,
        });
        batch.add(BOX(len, 0.025, 0.09, 0), mRailTop, mat4((x0 + x1) / 2, 0.15, z), {
          cast: false,
          outline: 0,
        });
      }
      // Fils de caténaire au-dessus de la voie (fins : ils ne masquent pas le jeu).
      const wire = new THREE.CylinderGeometry(0.02, 0.02, len, 5, 1, true);
      wire.rotateZ(Math.PI / 2);
      batch.add(wire, mWire, mat4((x0 + x1) / 2, 4.9, (z0 + z1) / 2), {
        cast: false,
        outline: 1.2,
      });
    }

    // ── Lignes de sécurité : bande jaune côté voie + bande podotactile + margelle ──
    for (const r of runsOf(layout, 'line')) {
      const x0 = r.tx0 * T;
      const x1 = (r.tx1 + 1) * T;
      const len = x1 - x0;
      const below = tileAt(layout, r.tx0, r.ty + 1);
      const trackBelow = below === 'rail' || below === 'ballast';
      const edgeZ = trackBelow ? (r.ty + 1) * T : r.ty * T;
      const s = trackBelow ? -1 : 1;
      batch.add(BOX(len, 0.05, 0.12, 0.02), mCoping, mat4((x0 + x1) / 2, 0.025, edgeZ + s * 0.06), {
        cast: false,
        outline: 1.6,
      });
      batch.add(BOX(len, 0.012, 0.07, 0), mYellow, mat4((x0 + x1) / 2, 0.008, edgeZ + s * 0.2), {
        cast: false,
        outline: 0,
      });
      const dots = new THREE.PlaneGeometry(len, 0.2);
      dots.rotateX(-Math.PI / 2);
      batch.add(dots, mTactile, mat4((x0 + x1) / 2, 0.004, edgeZ + s * 0.38), {
        cast: false,
        outline: 0,
      });
    }

    // ── Murs : le fond est haut (façade), les autres bas (parapets : la caméra voit par-dessus) ──
    for (const r of runsOf(layout, 'wall')) {
      const back = r.ty <= 1;
      const x0 = r.tx0 * T;
      const x1 = (r.tx1 + 1) * T;
      const len = x1 - x0;
      const z = (r.ty + 0.5) * T;
      if (back) {
        // La rangée 0 porte la façade, la rangée 1 sa plinthe.
        if (r.ty === 0) {
          batch.add(BOX(len, BACK_WALL_H, T, 0), mWall, mat4((x0 + x1) / 2, BACK_WALL_H / 2, z), {
            cast: false,
            outline: 0,
          });
        } else {
          batch.add(BOX(len, 0.5, T * 0.98, 0.04), mConcreteDark, mat4((x0 + x1) / 2, 0.25, z), {
            cast: false,
            outline: 2,
          });
          batch.add(
            BOX(len, BACK_WALL_H, T * 0.6, 0),
            mWall,
            mat4((x0 + x1) / 2, BACK_WALL_H / 2, z - T * 0.2),
            {
              cast: false,
              outline: 0,
            },
          );
        }
      } else {
        batch.add(
          BOX(len, LOW_WALL_H, T, 0.05),
          mConcreteDark,
          mat4((x0 + x1) / 2, LOW_WALL_H / 2, z),
          {
            cast: true,
            outline: 2.2,
          },
        );
        batch.add(
          BOX(len + 0.02, 0.08, T + 0.04, 0.03),
          mIron,
          mat4((x0 + x1) / 2, LOW_WALL_H + 0.04, z),
          {
            cast: false,
            outline: 2,
          },
        );
      }
    }

    // Corniche et pilastres de la façade du fond.
    batch.add(BOX(W, 0.3, 0.5, 0.05), mConcreteDark, mat4(W / 2, BACK_WALL_H - 0.15, T * 1.6), {
      cast: false,
      outline: 2,
    });
    for (let x = 2.6; x < W - 1; x += 5.3) {
      batch.add(
        BOX(0.6, BACK_WALL_H, 0.3, 0.06),
        mConcreteDark,
        mat4(x, BACK_WALL_H / 2, T * 1.75),
        {
          cast: false,
          outline: 2,
        },
      );
    }

    // ── Portes de sortie (dans le mur du fond) : rideau métallique fermé, voyant au-dessus ──
    for (const door of layout.doors) {
      const x0 = door.tx * T;
      const x1 = (door.tx + door.width) * T;
      const cx = (x0 + x1) / 2;
      const w = x1 - x0;
      const z = (door.ty + 1) * T;
      batch.add(BOX(w, 2.3, 0.12, 0.02), mShutter, mat4(cx, 1.15, z - 0.1), {
        cast: false,
        outline: 2,
      });
      for (let i = 0; i < 9; i += 1) {
        batch.add(BOX(w - 0.04, 0.03, 0.02, 0), mIronDark, mat4(cx, 0.15 + i * 0.25, z - 0.03), {
          cast: false,
          outline: 0,
        });
      }
      batch.add(BOX(w + 0.3, 0.18, 0.3, 0.03), mIron, mat4(cx, 2.4, z - 0.05), {
        cast: false,
        outline: 2,
      });
      for (const sx of [-1, 1]) {
        batch.add(
          BOX(0.16, 2.5, 0.3, 0.03),
          mIron,
          mat4(cx + sx * (w / 2 + 0.08), 1.25, z - 0.05),
          { cast: false, outline: 2 },
        );
      }
      const lampMat = glow(PAL.danger, 3);
      this.doorLamps.push(lampMat);
      const lamp = new THREE.Mesh(rboxGeo(0.5, 0.12, 0.08, 0.03), lampMat);
      lamp.position.set(cx, 2.65, z - 0.02);
      this.group.add(lamp);
    }

    // ── Piliers en fonte : objets séparés, pour s'effacer quand ils masquent le héros ──
    const pillarShaft = new THREE.CylinderGeometry(0.15, 0.19, PILLAR_H, 12);
    const pillarCap = new THREE.CylinderGeometry(0.32, 0.17, 0.32, 12);
    const pillarBase = rboxGeo(T * 0.95, 0.3, T * 0.95, 0.05);
    const pillarRing = new THREE.TorusGeometry(0.18, 0.035, 6, 14).rotateX(Math.PI / 2);
    this.disposables.push(pillarShaft, pillarCap, pillarRing);
    for (let ty = 0; ty < layout.height; ty += 1) {
      for (let tx = 0; tx < layout.width; tx += 1) {
        if (tileAt(layout, tx, ty) !== 'pillar') continue;
        this.addPillar(
          (tx + 0.5) * T,
          (ty + 0.5) * T,
          pillarBase,
          pillarShaft,
          pillarCap,
          pillarRing,
        );
      }
    }

    // ── Bancs (suite de tuiles « b ») ──
    for (const r of runsOf(layout, 'bench')) {
      const x0 = r.tx0 * T;
      const x1 = (r.tx1 + 1) * T;
      const len = x1 - x0 - 0.06;
      const cx = (x0 + x1) / 2;
      const z = (r.ty + 0.5) * T;
      for (const dx of [-len / 2 + 0.12, len / 2 - 0.12]) {
        batch.add(BOX(0.08, 0.42, 0.42, 0.02), mBenchMetal, mat4(cx + dx, 0.21, z), { outline: 2 });
      }
      for (let i = 0; i < 3; i += 1) {
        batch.add(BOX(len, 0.05, 0.12, 0.02), mWood, mat4(cx, 0.44, z - 0.14 + i * 0.14), {
          outline: 2,
        });
      }
      for (let i = 0; i < 2; i += 1) {
        batch.add(
          BOX(len, 0.11, 0.045, 0.02),
          mWood,
          mat4(cx, 0.62 + i * 0.15, z - 0.24, 0, -0.15),
          { outline: 2 },
        );
      }
    }

    batch.build(this.group);

    // ── Façade du fond : néon PRIVATIX, publicités, panneau MONS ──
    const wallFace = T * 1.62;
    const emissivePlane = (
      tex: THREE.Texture,
      w: number,
      h: number,
      x: number,
      y: number,
      intensity: number,
    ): THREE.Mesh => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map: tex,
          color: new THREE.Color(intensity, intensity, intensity),
          transparent: true,
        }),
      );
      m.position.set(x, y, wallFace + 0.02);
      this.group.add(m);
      this.disposables.push(tex);
      return m;
    };
    const neonTex = canvasTexture(1024, 256, (g) => {
      g.clearRect(0, 0, 1024, 256);
      g.font = `900 150px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = '#ff3ea5';
      g.shadowBlur = 30;
      g.strokeStyle = '#ff6ec0';
      g.lineWidth = 10;
      g.strokeText('PRIVATIX', 552, 134);
      g.shadowBlur = 0;
      g.fillStyle = '#ffd6ee';
      g.fillText('PRIVATIX', 552, 134);
      g.lineWidth = 14;
      g.strokeStyle = '#ffd6ee';
      g.beginPath();
      g.arc(110, 128, 52, -Math.PI / 2, Math.PI / 2);
      g.moveTo(110, 76);
      g.lineTo(110, 228);
      g.stroke();
    });
    const neon = emissivePlane(neonTex, 6, 1.5, W / 2, 2.7, 2.6);
    this.neon = neon.material as THREE.MeshBasicMaterial;
    const neonBack = new THREE.Mesh(
      new THREE.PlaneGeometry(6.6, 1.9),
      new THREE.MeshBasicMaterial({
        map: radialTexture(),
        color: new THREE.Color(PAL.danger).multiplyScalar(0.5),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    neonBack.position.set(W / 2, 2.7, wallFace + 0.01);
    neonBack.scale.set(1.5, 1.6, 1);
    this.group.add(neonBack);
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, W, 6).rotateZ(Math.PI / 2),
      glow(PAL.enemy, 3.2),
    );
    tube.position.set(W / 2, 3.75, wallFace + 0.08);
    this.group.add(tube);

    const adA = adTexture(
      'PRIVATIX',
      'Optimisons vos trajets.*',
      '* sous réserve de rentabilité',
      '#5a0f3e',
      '#ff6ec0',
      '#ff3ea5',
    );
    const adB = adTexture(
      'MODERNISATION',
      'Votre gare, bientôt plus agile.',
      'Plan Mons 2032 · merci de votre patience.',
      '#0d4a52',
      '#5ff7e4',
      '#19c3b1',
    );
    const doorXs = layout.doors.map((d) => (d.tx + d.width / 2) * T);
    const freeX = (x: number): boolean =>
      doorXs.every((dx) => Math.abs(dx - x) > 2.4) && Math.abs(x - W / 2) > 3.6;
    const adSlots = [W * 0.17, W * 0.33, W * 0.67, W * 0.83].filter(freeX);
    adSlots.forEach((x, i) => {
      const frame = new THREE.Mesh(rboxGeo(3.0, 1.95, 0.14, 0.05), mIronDark);
      frame.position.set(x, 2.05, wallFace);
      this.group.add(frame);
      emissivePlane(i % 2 === 0 ? adA : adB, 2.78, 1.74, x, 2.05, 1.5);
    });

    const monsTex = canvasTexture(512, 128, (g) => {
      g.fillStyle = '#1d3f9c';
      g.fillRect(0, 0, 512, 128);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 6;
      g.strokeRect(8, 8, 496, 112);
      g.fillStyle = '#ffffff';
      g.font = `900 78px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('MONS', 256, 68);
    });
    this.disposables.push(monsTex);
    // Panneaux de gare sur les piliers du quai central (logo SNCB autorisé, LORE § 1.4).
    const pillars: { x: number; z: number }[] = [];
    layout.tiles.forEach((row, ty) => {
      row.forEach((k, tx) => {
        if (k === 'pillar') pillars.push({ x: (tx + 0.5) * T, z: (ty + 0.5) * T });
      });
    });
    const midZ = H / 2;
    const signPillars = pillars.filter((p) => Math.abs(p.z - midZ) < H * 0.25).slice(0, 2);
    for (const p of signPillars) {
      const board = new THREE.Mesh(rboxGeo(1.9, 0.52, 0.08, 0.03), mIronDark);
      board.position.set(p.x, 2.6, p.z + 0.22);
      this.group.add(board);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(1.82, 0.46),
        new THREE.MeshBasicMaterial({ map: monsTex, color: new THREE.Color(1.05, 1.05, 1.05) }),
      );
      face.position.set(p.x, 2.6, p.z + 0.27);
      this.group.add(face);
      const logo = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.33),
        new THREE.MeshBasicMaterial({
          map: sncbLogoTexture(),
          transparent: true,
          color: new THREE.Color(1.3, 1.3, 1.3),
        }),
      );
      logo.position.set(p.x - 1.3, 2.6, p.z + 0.26);
      this.group.add(logo);
    }

    // ── Suspensions : nombre fixe par salle (preset de qualité), pas de recompilation ──
    const poolTex = radialTexture();
    const poolMat = new THREE.MeshBasicMaterial({
      map: poolTex,
      color: new THREE.Color(0xffa040).multiplyScalar(0.3),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lampSpots = this.lampSpots(quality.roomLights);
    for (const [x, z] of lampSpots) {
      // Suspensions hors champ (la caméra haute les verrait flotter au-dessus du combat) :
      // on ne garde que leur lumière et leur flaque au sol.
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5).rotateX(-Math.PI / 2), poolMat);
      pool.position.set(x, 0.015, z);
      pool.renderOrder = 2;
      this.group.add(pool);
      const light = new THREE.PointLight(0xffa64d, 26, 11, 1.6);
      light.position.set(x, LAMP_Y - 0.3, z);
      this.group.add(light);
    }
    // Lumière magenta du néon (sans ombre), toujours présente : compte dans le budget fixe.
    this.neonLight = new THREE.PointLight(PAL.danger, 22, 12, 1.6);
    this.neonLight.position.set(W / 2, 2.6, wallFace + 1.8);
    this.group.add(this.neonLight);
  }

  private addPillar(
    x: number,
    z: number,
    base: THREE.BufferGeometry,
    shaft: THREE.BufferGeometry,
    cap: THREE.BufferGeometry,
    ring: THREE.BufferGeometry,
  ): void {
    const iron = toon(0x2a3a6a, { rimStrength: 0.7, transparent: true });
    const dark = toon(0x1a2244, { transparent: true });
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const parts: [THREE.BufferGeometry, THREE.Material, number, boolean][] = [
      [base, dark, 0.15, true],
      [shaft, iron, PILLAR_H / 2, true],
      [cap, iron, PILLAR_H + 0.1, true],
      [ring, dark, 1.1, false],
    ];
    const outlines: THREE.Object3D[] = [];
    for (const [geo, mat, y, outlined] of parts) {
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      m.castShadow = true;
      m.receiveShadow = true;
      if (outlined) {
        const o = addOutline(m, 2.4);
        if (o) outlines.push(o);
      }
      g.add(m);
    }
    this.group.add(g);
    this.disposables.push(iron, dark);
    this.pillars.push({ x, z, mats: [iron, dark], outlines, opacity: 1 });
  }

  /** Points des suspensions, répartis sur les quais (rangées de sol libres). */
  private lampSpots(n: number): [number, number][] {
    const layout = this.layout;
    const floorRows: number[] = [];
    for (let ty = 2; ty < layout.height - 1; ty += 1) {
      const row = layout.tiles[ty] ?? [];
      const floor = row.filter((k) => k === 'floor').length;
      if (floor > row.length * 0.6) floorRows.push(ty);
    }
    // Rangée centrale de chaque quai (suite de rangées de sol).
    const quays: number[] = [];
    let i = 0;
    while (i < floorRows.length) {
      const start = floorRows[i] ?? 0;
      let end = start;
      while (floorRows[i + 1] === end + 1) {
        i += 1;
        end += 1;
      }
      quays.push((start + end) / 2);
      i += 1;
    }
    const spots: [number, number][] = [];
    const W = layout.width * T;
    const perQuay = Math.max(1, Math.ceil(n / Math.max(1, quays.length)));
    for (const q of quays) {
      for (let k = 0; k < perQuay && spots.length < n; k += 1) {
        const x = (W * (k + 0.5)) / perQuay;
        spots.push([x, (q + 0.5) * T]);
      }
    }
    return spots;
  }

  /** Animation du décor : néon qui grésille (coupé en réduction des mouvements), voyants des portes. */
  public update(time: number, hero: THREE.Vector3, dt: number): void {
    // Occlusion : un pilier entre la caméra (au sud) et le héros s'efface.
    for (const p of this.pillars) {
      const dz = p.z - hero.z;
      const hides = dz > -0.2 && dz < 4.5 && Math.abs(p.x - hero.x) < 0.9 + dz * 0.12;
      const target = hides ? 0.22 : 1;
      p.opacity += (target - p.opacity) * (1 - Math.exp(-10 * dt));
      for (const m of p.mats) m.opacity = p.opacity;
      for (const o of p.outlines) o.visible = p.opacity > 0.85;
    }
    const flick =
      this.flickerOn &&
      (Math.sin(time * 37) > 0.97 || (Math.sin(time * 0.7) > 0.995 && Math.sin(time * 53) > 0));
    this.neon.color.setScalar(flick ? 0.6 : 2.6);
    this.neonLight.intensity = flick ? 6 : 22;
  }

  /** Salle nettoyée : les voyants des portes passent au vert. */
  public setDoorsOpen(open: boolean): void {
    for (const m of this.doorLamps) m.color.setHex(open ? 0x5dff8a : PAL.danger).multiplyScalar(3);
  }

  public setReducedMotion(on: boolean): void {
    this.flickerOn = !on;
  }

  public dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.geometry as THREE.BufferGeometry).dispose();
    });
    for (const d of this.disposables) d.dispose();
  }
}
