// Décor 3D du hub (jalon J6), construit depuis le gabarit de la sim comme `RoomView` :
// - Centre Opérationnel (DA § 2.11) : salle de supervision bleu ardoise, mur synoptique émissif cyan et
//   vert (source principale), pupitres à îlots de tungstène, coin café de la Vieille Dame, Salle
//   photocopieuse au néon froid avec le Tableau des revendications, sas et son distributeur ;
// - Cour intérieure du BAG (DA § 2.12-2.13) : cour en U de brique jaune à fenêtres en grille,
//   soubassement strié, cage d'escalier vitrée, pavés moussus, traces de peinture, voitures de service,
//   panneaux bleus, casiers de la DPD, coin poubelles, côté ouvert vers les quais (départ du Shift).
// L'ambiance (ciel, soleil, fenêtres allumées) suit le roulement. Nombre de lumières fixe : le preset
// de qualité + 1, dans les deux zones (pas de recompilation de shaders entre elles).
import * as THREE from 'three';
import type { ShiftId } from '@/config/balance';
import { TILE } from '@/config/constants';
import type { HubZoneId } from '@/sim/hub/layout';
import { CO_DESKS, CO_PARTITION_GAP, CO_PARTITION_X, COUR_CARS } from '@/sim/hub/layout';
import type { HubNpcId } from '@/sim/hub/stations';
import { HUB_NPCS, HUB_STATIONS, STATION_RADIUS } from '@/sim/hub/stations';
import type { DoorState } from '@/sim/RunDirector';
import { PX_PER_M, pxToM } from '@/sim/units';
import type { RoomLayout } from '@/systems/procedural/RoomLayout';
import type { RoomDecor, SceneLights } from '@/view/GameView';
import { glow, radialTexture, rboxGeo, rng, toon } from '@/view/materials/toon';
import type { ViewSettings } from '@/view/quality';
import { mat4, StaticBatch } from '@/view/RoomView';
import type { NpcView } from '@/view/hub/NpcView';
import { createNpcView } from '@/view/hub/NpcView';
import type { SynopticInfo } from '@/view/hub/textures';
import {
  corkTexture,
  darkBrickTexture,
  facadeTexture,
  linoTexture,
  paversTexture,
  signTexture,
  stairGlassTexture,
  SynopticWall,
} from '@/view/hub/textures';

/** Taille d'une tuile (m). */
const T = pxToM(TILE);
const CO_WALL_H = 4.2;
const SIDE_WALL_H = 3.0;
const LOW_WALL_H = 0.55;
const FACADE_H = 17;
const TUNGSTEN = 0xffc27a;

/** Ce que le décor affiche de l'état du jeu (lu à la construction et à chaque changement). */
export interface HubDecorInfo {
  readonly shift: ShiftId;
  readonly synoptic: SynopticInfo;
  /** Rangs obtenus au Tableau des revendications (feuilles punaisées). */
  readonly ownedRanks: number;
}

interface Ambiance {
  readonly background: number;
  readonly fog: number;
  readonly fogDensity: number;
  readonly sky: number;
  readonly ground: number;
  readonly hemi: number;
  readonly sun: number;
  readonly sunIntensity: number;
  /** Direction du soleil (depuis la cible). */
  readonly sunDir: readonly [number, number, number];
  readonly lamp: number;
}

const AMBIANCE: Readonly<Record<HubZoneId, Readonly<Record<ShiftId, Ambiance>>>> = {
  co: {
    matin: {
      background: 0x0b1220,
      fog: 0x0e1626,
      fogDensity: 0.016,
      sky: 0x52648e,
      ground: 0x161c2a,
      hemi: 0.75,
      sun: 0xb4c4e8,
      sunIntensity: 0.7,
      sunDir: [-6, 20, 10],
      lamp: 13,
    },
    'apres-midi': {
      background: 0x120f1c,
      fog: 0x1a1420,
      fogDensity: 0.016,
      sky: 0x6a5a78,
      ground: 0x1c1820,
      hemi: 0.7,
      sun: 0xffc890,
      sunIntensity: 0.8,
      sunDir: [-16, 12, 6],
      lamp: 13,
    },
    nuit: {
      background: 0x060a16,
      fog: 0x0a1020,
      fogDensity: 0.02,
      sky: 0x34407a,
      ground: 0x10121c,
      hemi: 0.55,
      sun: 0x7080d0,
      sunIntensity: 0.45,
      sunDir: [6, 20, 8],
      lamp: 16,
    },
  },
  cour: {
    matin: {
      background: 0x9aa4b2,
      fog: 0x8f99a8,
      fogDensity: 0.01,
      sky: 0xc8d2de,
      ground: 0x5e5a4e,
      hemi: 1.15,
      sun: 0xe8eef8,
      sunIntensity: 1.5,
      sunDir: [-7, 20, 7],
      lamp: 4,
    },
    'apres-midi': {
      background: 0xd6a274,
      fog: 0xc8986e,
      fogDensity: 0.011,
      sky: 0xffd4a8,
      ground: 0x6a5238,
      hemi: 0.95,
      sun: 0xffad5c,
      sunIntensity: 2.6,
      sunDir: [-22, 9, 3],
      lamp: 5,
    },
    nuit: {
      background: 0x0a1030,
      fog: 0x0c1432,
      fogDensity: 0.018,
      sky: 0x34449a,
      ground: 0x181424,
      hemi: 0.6,
      sun: 0x8a9cff,
      sunIntensity: 0.9,
      sunDir: [6, 18, 8],
      lamp: 22,
    },
  },
};

interface PlacedNpc {
  readonly id: HubNpcId;
  readonly view: NpcView;
  readonly pos: THREE.Vector3;
}

export class HubRoomView implements RoomDecor {
  public readonly group = new THREE.Group();
  public readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  private readonly W: number;
  private readonly H: number;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly npcs: PlacedNpc[] = [];
  private readonly lamps: THREE.PointLight[] = [];
  private readonly ring: THREE.Mesh;
  private readonly ringFill: THREE.Mesh;
  private synoptic: SynopticWall | null = null;
  private neon: THREE.MeshBasicMaterial | null = null;
  private readonly facadeMats: {
    mat: THREE.MeshToonMaterial;
    w: number;
    h: number;
    seed: number;
    stairX: number | null;
  }[] = [];
  private cork: THREE.MeshBasicMaterial | null = null;
  private stairGlass: THREE.MeshBasicMaterial | null = null;
  private shift: ShiftId;
  private ringT = 0;

  public constructor(
    private readonly layout: RoomLayout,
    private readonly zone: HubZoneId,
    private readonly settings: ViewSettings,
    private readonly lights: SceneLights,
    private readonly info: () => HubDecorInfo,
  ) {
    this.W = layout.width * T;
    this.H = layout.height * T;
    this.bounds = { minX: T, maxX: this.W - T, minZ: 2 * T, maxZ: this.H - T };
    const now = info();
    this.shift = now.shift;
    const batch = new StaticBatch();
    if (zone === 'co') this.buildCo(batch, now);
    else this.buildCour(batch);
    batch.build(this.group);
    this.placeNpcs();
    // Décalque d'interaction (blanc et or, jamais magenta : DA § 2.11).
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.6, 40).rotateX(-Math.PI / 2),
      glow(0xffd27a, 2.2, { transparent: true, opacity: 0.9, additive: true }),
    );
    this.ringFill = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 40).rotateX(-Math.PI / 2),
      glow(0xfff4d8, 0.9, { transparent: true, opacity: 0.35, additive: true }),
    );
    for (const m of [this.ring, this.ringFill]) {
      m.position.y = 0.02;
      m.renderOrder = 3;
      m.visible = false;
      this.group.add(m);
      this.disposables.push(m.geometry, m.material as THREE.Material);
    }
    this.applyAmbiance();
  }

  // ─── Outils de construction ────────────────────────────────────────────────

  private mat(color: number, opts: Parameters<typeof toon>[1] = {}): THREE.MeshToonMaterial {
    const m = toon(color, opts);
    this.disposables.push(m);
    return m;
  }

  private tex<Tx extends THREE.Texture>(t: Tx): Tx {
    this.disposables.push(t);
    return t;
  }

  /** Boîte statique (fusionnée par matériau). */
  private static box(
    batch: StaticBatch,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    o: { r?: number; outline?: number; cast?: boolean; ry?: number } = {},
  ): void {
    batch.add(rboxGeo(w, h, d, o.r ?? 0.02), mat, mat4(x, y, z, o.ry ?? 0), {
      outline: o.outline ?? 2,
      cast: o.cast ?? true,
    });
  }

  /** Plan émissif (écrans, panneaux lumineux), hors fusion. */
  private emissive(
    map: THREE.Texture | null,
    color: number,
    intensity: number,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    ry = 0,
  ): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial({
      map,
      color: new THREE.Color(color).multiplyScalar(intensity),
      transparent: map !== null,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    this.group.add(mesh);
    this.disposables.push(m, mesh.geometry);
    return m;
  }

  /** Flaque de lumière chaude au sol (décalque additif, ne coûte aucune lumière). */
  private pool(x: number, z: number, size: number, color: number, strength: number): void {
    const m = new THREE.MeshBasicMaterial({
      map: radialTexture(),
      color: new THREE.Color(color).multiplyScalar(strength),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), m);
    mesh.position.set(x, 0.012, z);
    mesh.renderOrder = 2;
    this.group.add(mesh);
    this.disposables.push(m, mesh.geometry);
  }

  private floor(batch: StaticBatch, map: THREE.CanvasTexture, repeat: number): void {
    map.repeat.set(this.W / repeat, this.H / repeat);
    const top = new THREE.PlaneGeometry(this.W, this.H);
    top.rotateX(-Math.PI / 2);
    batch.add(top, this.mat(0xffffff, { map }), mat4(this.W / 2, 0, this.H / 2), {
      cast: false,
      outline: 0,
    });
  }

  /** Lampes ponctuelles : `roomLights` + 1 (la dernière est la lumière « signature » de la zone). */
  private addLamps(
    spots: readonly (readonly [number, number, number])[],
    extra: THREE.PointLight,
  ): void {
    const n = this.settings.quality.roomLights;
    for (let i = 0; i < n; i += 1) {
      const s = spots[i % Math.max(1, spots.length)] ?? [this.W / 2, 2.6, this.H / 2];
      const l = new THREE.PointLight(TUNGSTEN, 13, 9, 1.6);
      l.position.set(s[0], s[1], s[2]);
      this.group.add(l);
      this.lamps.push(l);
    }
    this.group.add(extra);
  }

  // ─── Centre Opérationnel ───────────────────────────────────────────────────

  private buildCo(batch: StaticBatch, info: HubDecorInfo): void {
    const { W, H } = this;
    const box = HubRoomView.box;
    this.floor(batch, this.tex(linoTexture()), 2);
    const wall = this.mat(0x26324a);
    const wallDark = this.mat(0x171f30);
    const panel = this.mat(0x2f3d58);
    const trim = this.mat(0x8c9ab4);
    const glass = this.mat(0x9fd8ff, { transparent: true, opacity: 0.16 });
    const alu = this.mat(0xa8b4c8, { rimStrength: 0.4 });
    const desk = this.mat(0x2a3348);
    const deskTop = this.mat(0x46536e);
    const screenBack = this.mat(0x141a28);
    const wood = this.mat(0x6a4a32);
    const steel = this.mat(0xb8c0cc, { rimStrength: 0.8 });
    const paper = this.mat(0xf4f0e4);
    const copier = this.mat(0xd8d2c0);

    // Mur du fond (nord), percé de la porte vitrée vers la Cour.
    const door = this.layout.doors[0];
    const dx0 = door ? door.tx * T : W;
    const dx1 = door ? (door.tx + door.width) * T : W;
    const wallZ = T;
    const face = 2 * T;
    for (const [a, b] of [
      [0, dx0],
      [dx1, W],
    ] as const) {
      if (b - a <= 0.01) continue;
      box(batch, wall, (a + b) / 2, CO_WALL_H / 2, wallZ, b - a, CO_WALL_H, 2 * T, { outline: 0 });
      box(batch, wallDark, (a + b) / 2, 0.18, face + 0.02, b - a, 0.36, 0.06, {
        outline: 0,
        cast: false,
      });
    }
    // Linteau au-dessus de la porte.
    box(batch, wall, (dx0 + dx1) / 2, CO_WALL_H - 0.7, wallZ, dx1 - dx0, 1.4, 2 * T, {
      outline: 0,
    });
    // Porte vitrée : cadre, vitres, lumière du jour derrière.
    box(batch, alu, dx0 + 0.05, 1.4, face, 0.1, 2.8, 0.12);
    box(batch, alu, dx1 - 0.05, 1.4, face, 0.1, 2.8, 0.12);
    box(batch, alu, (dx0 + dx1) / 2, 2.8, face, dx1 - dx0, 0.12, 0.12);
    box(batch, alu, (dx0 + dx1) / 2, 1.4, face, 0.06, 2.8, 0.1, { outline: 0 });
    this.stairGlass = this.emissive(
      null,
      0xcfe0f0,
      0.9,
      dx1 - dx0 - 0.2,
      2.7,
      (dx0 + dx1) / 2,
      1.38,
      face - 0.4,
    );
    this.pool((dx0 + dx1) / 2, face + 1.2, 3.2, 0xcfe0ff, 0.35);
    const doorSign = this.tex(signTexture(['COUR INTÉRIEURE'], '#1c2a40', '#dde8f0', 512, 96));
    this.emissive(doorSign, 0xffffff, 1.15, 1.8, 0.34, (dx0 + dx1) / 2, 3.15, face + 0.08);

    // Murs latéraux et mur bas (côté caméra).
    box(batch, panel, T / 2, SIDE_WALL_H / 2, H / 2, T, SIDE_WALL_H, H, { outline: 0 });
    box(batch, panel, W - T / 2, SIDE_WALL_H / 2, H / 2, T, SIDE_WALL_H, H, { outline: 0 });
    box(batch, wallDark, W / 2, LOW_WALL_H / 2, H - T / 2, W, LOW_WALL_H, T, { outline: 1.6 });
    box(batch, trim, W / 2, LOW_WALL_H + 0.02, H - T / 2, W, 0.05, T + 0.04, {
      outline: 0,
      cast: false,
    });

    // Mur synoptique (source principale de lumière de la salle).
    const synX0 = (CO_PARTITION_X + 1.6) * T;
    const synX1 = dx0 - 0.5;
    const synW = synX1 - synX0;
    box(batch, screenBack, (synX0 + synX1) / 2, 2.25, face + 0.06, synW + 0.3, 2.75, 0.12, {
      outline: 2,
    });
    this.synoptic = new SynopticWall(info.synoptic, this.settings.reducedMotion);
    this.disposables.push(this.synoptic);
    this.emissive(
      this.synoptic.texture,
      0xffffff,
      1.55,
      synW,
      synW / 4,
      (synX0 + synX1) / 2,
      2.25,
      face + 0.13,
    );
    this.pool((synX0 + synX1) / 2, face + 2.2, synW * 0.9, 0x40d8ff, 0.18);
    // Lanternes de signalisation récupérées (rouge, vert, blanc), accrochées par Marcel.
    const lanternCols = [0xff3b30, 0x5dff8a, 0xfff4e0];
    for (let i = 0; i < 9; i += 1) {
      const x = synX0 + (i + 0.5) * (synW / 9);
      const lm = glow(lanternCols[i % 3] ?? 0xffffff, 2.4);
      this.disposables.push(lm);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), lm);
      l.position.set(x, 3.85, face + 0.25);
      this.group.add(l);
      this.disposables.push(l.geometry);
    }

    // Cloison vitrée de la Salle photocopieuse (ouverte au milieu).
    const px = (CO_PARTITION_X + 0.5) * T;
    const gapZ0 = (CO_PARTITION_GAP[0] + 1) * T;
    const gapZ1 = (CO_PARTITION_GAP[1] + 2) * T;
    for (const [z0, z1] of [
      [face, gapZ0],
      [gapZ1, H - T],
    ] as const) {
      const len = z1 - z0;
      box(batch, glass, px, 1.2, (z0 + z1) / 2, 0.06, 2.4, len, { outline: 0, cast: false });
      box(batch, alu, px, 2.42, (z0 + z1) / 2, 0.12, 0.08, len, { outline: 1.4 });
      box(batch, alu, px, 0.04, (z0 + z1) / 2, 0.14, 0.08, len, { outline: 0 });
      for (let z = z0; z <= z1 + 1e-3; z += Math.max(1.2, len / Math.ceil(len / 1.6))) {
        box(batch, alu, px, 1.2, Math.min(z, z1 - 0.04), 0.1, 2.44, 0.08, { outline: 1.4 });
      }
    }

    // Salle photocopieuse : Tableau des revendications sur le mur du fond, néon froid, photocopieuse.
    this.cork = this.emissive(
      this.tex(corkTexture(info.ownedRanks)),
      0xffffff,
      0.95,
      3.2,
      2.0,
      5.5 * T,
      1.75,
      face + 0.06,
    );
    box(batch, wood, 5.5 * T, 1.75, face + 0.02, 3.4, 2.2, 0.06, { outline: 2 });
    this.neon = glow(0xdde8f0, 2.6);
    this.disposables.push(this.neon);
    const tube = new THREE.Mesh(rboxGeo(2.4, 0.06, 0.06, 0.02), this.neon);
    tube.position.set(5.5 * T, 3.2, face + 0.3);
    this.group.add(tube);
    this.pool(5.5 * T, face + 1.6, 4.5, 0xdde8f0, 0.22);
    box(batch, copier, 3 * T, 0.6, 7.5 * T, 2 * T, 1.2, 2 * T, { r: 0.06 });
    box(batch, this.mat(0x3a3a44), 3 * T, 1.24, 7.5 * T, 2 * T - 0.06, 0.1, 2 * T - 0.06, {
      outline: 0,
    });
    this.emissive(null, 0x5dff8a, 2, 0.12, 0.06, 3 * T + 0.35, 1.0, 8.5 * T + 0.01);
    for (let i = 0; i < 4; i += 1)
      box(
        batch,
        paper,
        7.6 * T + (i % 2) * 0.45,
        0.14 + Math.floor(i / 2) * 0.28,
        19.6 * T,
        0.4,
        0.26,
        0.55,
        { outline: 1.2 },
      );

    // Pupitres : console, plateau, trois écrans, lampe de pupitre et flaque de tungstène.
    for (const [x0, x1, row] of CO_DESKS) {
      const ax = x0 * T;
      const bx = (x1 + 1) * T;
      const z = (row + 1.5) * T;
      const w = bx - ax;
      box(batch, desk, (ax + bx) / 2, 0.38, z, w, 0.76, T * 0.9, { r: 0.04 });
      box(batch, deskTop, (ax + bx) / 2, 0.79, z - 0.04, w + 0.12, 0.06, T * 1.1, { outline: 1.6 });
      const screens = Math.max(2, Math.round(w / 0.75));
      for (let i = 0; i < screens; i += 1) {
        const sx = ax + (i + 0.5) * (w / screens);
        box(batch, screenBack, sx, 1.08, z + 0.05, w / screens - 0.08, 0.5, 0.06, { outline: 1.6 });
        // Lueur des écrans sur l'arrière (lisible depuis la caméra).
        this.emissive(
          null,
          i % 3 === 0 ? 0x5dff8a : 0x40d8ff,
          0.7,
          w / screens - 0.14,
          0.04,
          sx,
          1.34,
          z + 0.09,
        );
      }
      box(batch, steel, bx - 0.15, 1.0, z - 0.1, 0.04, 0.4, 0.04, { outline: 0 });
      const bulb = glow(TUNGSTEN, 3);
      this.disposables.push(bulb);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.12, 12, 1, true), bulb);
      shade.position.set(bx - 0.15, 1.24, z - 0.1);
      this.group.add(shade);
      this.disposables.push(shade.geometry);
      this.pool((ax + bx) / 2, z - 0.5, w + 1.8, TUNGSTEN, 0.3);
    }

    // Coin café : autel de traverses et la Vieille Dame (inox cabossé).
    const cx = 23 * T;
    const cz = 14.5 * T;
    for (let i = 0; i < 3; i += 1)
      box(batch, wood, cx, 0.12 + i * 0.22, cz, 2 * T + 0.1, 0.2, T * 0.9 - i * 0.04, {
        r: 0.02,
        outline: 1.6,
      });
    batch.add(new THREE.CylinderGeometry(0.2, 0.24, 0.62, 16), steel, mat4(cx, 0.99, cz), {
      outline: 2,
    });
    batch.add(new THREE.CylinderGeometry(0.12, 0.2, 0.12, 16), steel, mat4(cx, 1.36, cz), {
      outline: 1.6,
    });
    box(batch, steel, cx + 0.27, 1.05, cz, 0.16, 0.05, 0.05, { outline: 1.2 });
    this.emissive(null, 0xff3b30, 2.2, 0.05, 0.05, cx, 0.92, cz + 0.25);
    this.pool(cx, cz + 0.4, 3, TUNGSTEN, 0.35);
    // Plaque des 7 commandements (au-dessus du coin café, sur le mur du fond : trop loin, on la pose au mur ouest).

    // Sas : distributeur « HORS SERVICE » près de l'arrivée.
    const sx = 26 * T;
    const sz = H - 1.6 * T;
    box(batch, this.mat(0x3a3f52), sx, 0.9, sz, 0.9, 1.8, 0.6, { r: 0.04 });
    const hs = this.tex(signTexture(['HORS', 'SERVICE'], '#e8e2d0', '#c0392b', 256, 160));
    this.emissive(hs, 0xffffff, 1.0, 0.6, 0.38, sx, 1.25, sz + 0.31);

    // Lampes : îlots de tungstène sur les pupitres, puis coin café ; la lumière cyan du synoptique en plus.
    const lampAt = (x0: number, x1: number, row: number): [number, number, number] => [
      ((x0 + x1 + 1) / 2) * T,
      3.1,
      (row + 4) * T,
    ];
    const spots: [number, number, number][] = [
      lampAt(20, 27, 4),
      [cx, 2.6, cz + 0.6],
      lampAt(13, 16, 16),
      lampAt(31, 34, 4),
      lampAt(13, 16, 4),
      lampAt(30, 33, 11),
    ];
    const cyan = new THREE.PointLight(0x40d8ff, 20, 13, 1.5);
    cyan.position.set((synX0 + synX1) / 2, 2.2, face + 2.2);
    this.addLamps(spots, cyan);
  }

  // ─── Cour intérieure ───────────────────────────────────────────────────────

  private buildCour(batch: StaticBatch): void {
    const { W, H } = this;
    const box = HubRoomView.box;
    const r = rng(41);
    this.floor(batch, this.tex(paversTexture()), 1.4);
    const face = 2 * T;
    const exit = this.layout.doors.find((d) => d.ty <= 1);
    const back = this.layout.doors.find((d) => d.ty > 1);
    const ex0 = exit ? exit.tx * T : W;
    const ex1 = exit ? (exit.tx + exit.width) * T : W;
    const stairX = 18.5 * T;

    // Façade nord (aile du fond) avec la cage d'escalier vitrée.
    this.facade(batch, W / 2, face, W, 0, 11, stairX);
    // Ailes ouest et est (en U), qui s'arrêtent avant la caméra.
    const wingLen = H - 6;
    this.facade(batch, 0, face + wingLen / 2, wingLen, Math.PI / 2, 12, null);
    this.facade(batch, W, face + wingLen / 2, wingLen, -Math.PI / 2, 13, null);
    const plinth = this.mat(0x8e8e8a);
    box(
      batch,
      plinth,
      T / 2,
      LOW_WALL_H / 2,
      (face + wingLen + H) / 2,
      T,
      LOW_WALL_H,
      H - face - wingLen,
      { outline: 1.6 },
    );
    box(
      batch,
      plinth,
      W - T / 2,
      LOW_WALL_H / 2,
      (face + wingLen + H) / 2,
      T,
      LOW_WALL_H,
      H - face - wingLen,
      { outline: 1.6 },
    );

    // Cage d'escalier vitrée : verre qui reflète le ciel (lanterne la nuit), silhouettes de consultants.
    const glassTex = this.tex(stairGlassTexture());
    this.stairGlass = this.emissive(
      glassTex,
      0xffffff,
      0.9,
      2.6,
      FACADE_H - 1.8,
      stairX,
      (FACADE_H + 1.8) / 2,
      face + 0.08,
    );
    for (let y = 2.2; y < FACADE_H; y += 3.4) {
      box(batch, this.mat(0x3a3f48), stairX, y, face + 0.12, 2.7, 0.1, 0.1, {
        outline: 0,
        cast: false,
      });
      if (r() < 0.6)
        box(
          batch,
          this.mat(0x1a1c26),
          stairX + (r() - 0.5) * 1.6,
          y + 0.9,
          face + 0.1,
          0.35,
          1.3,
          0.02,
          { outline: 0, cast: false },
        );
    }
    // Porte vitrée au pied de la cage (sous scellés « Phase de transition »).
    const tape = this.tex(
      signTexture(['ACCÈS RÉSERVÉ — PHASE DE TRANSITION'], '#5a2a8a', '#ffffff', 512, 64),
    );
    this.emissive(tape, 0xffffff, 0.9, 2.3, 0.28, stairX, 1.3, face + 0.14);

    // Côté ouvert vers le couloir technique et les quais : départ du Shift.
    const exMid = (ex0 + ex1) / 2;
    box(batch, this.mat(0x07070c), exMid, 1.7, face - 0.2, ex1 - ex0, 3.4, 0.5, {
      outline: 0,
      cast: false,
    });
    box(batch, this.mat(0x6f6d6a), ex0 - 0.12, 1.8, face + 0.05, 0.24, 3.6, 0.3, { outline: 2 });
    box(batch, this.mat(0x6f6d6a), ex1 + 0.12, 1.8, face + 0.05, 0.24, 3.6, 0.3, { outline: 2 });
    box(batch, this.mat(0x6f6d6a), exMid, 3.65, face + 0.05, ex1 - ex0 + 0.5, 0.3, 0.3, {
      outline: 2,
    });
    const exitSign = this.tex(
      signTexture(
        ['COULOIR TECHNIQUE', '→ QUAIS · PRENDRE SON POSTE'],
        '#0c3a1e',
        '#7dff9a',
        512,
        128,
      ),
    );
    this.emissive(exitSign, 0xffffff, 1.6, 2.6, 0.65, exMid, 4.2, face + 0.22);
    this.emissive(null, 0x5dff8a, 3, 0.18, 0.18, ex1 - 0.3, 3.2, face + 0.22);
    this.emissive(null, 0xfff0c0, 0.7, ex1 - ex0 - 0.3, 2.6, exMid, 1.4, face - 0.4);
    // Chevrons dorés au sol, vers la sortie.
    const chevMat = glow(0xffd27a, 1.4, { transparent: true, opacity: 0.85 });
    this.disposables.push(chevMat);
    for (let i = 0; i < 4; i += 1) {
      const chev = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.4, 3, 1, Math.PI / 2 - 0.9, 1.8).rotateX(-Math.PI / 2),
        chevMat,
      );
      chev.rotation.y = Math.PI;
      chev.position.set(exMid, 0.02, face + 0.9 + i * 0.75);
      this.group.add(chev);
      this.disposables.push(chev.geometry);
    }

    // Coin poubelles (DA § 2.13) : pignon de brique sombre, bâche, conteneurs verts à couvercle jaune, sacs bleus.
    const gW = 10.5 * T;
    const gable = new THREE.Mesh(
      new THREE.PlaneGeometry(gW, 6.5),
      this.mat(0xffffff, { map: this.tex(darkBrickTexture(gW, 6.5)) }),
    );
    gable.position.set(gW / 2, 3.25, face + 0.05);
    gable.receiveShadow = true;
    this.group.add(gable);
    this.disposables.push(gable.geometry);
    const tarp = this.mat(0x8a8e94, { transparent: true, opacity: 0.92 });
    box(batch, tarp, gW * 0.45, 6.4, face + 0.4, gW * 0.8, 0.06, 0.9, {
      outline: 1.4,
      cast: false,
    });
    for (let i = 0; i < 6; i += 1)
      box(batch, this.mat(0x5a4030), 0.4 + i * 0.95, 6.6, face + 0.5, 0.08, 0.08, 1.1, {
        outline: 1.2,
      });
    const bin = this.mat(0x3e6b3a);
    const lid = this.mat(0xf2c230);
    for (let i = 0; i < 6; i += 1) {
      const big = i < 4;
      const x = (2.6 + i * 1.25) * T + (big ? 0 : 1.6 * T);
      const w = big ? 1.15 : 0.6;
      const h = big ? 1.3 : 1.05;
      box(batch, bin, x, h / 2, face + 0.75, w, h, 0.95, { r: 0.05 });
      box(batch, lid, x, h + 0.04, face + 0.72, w + 0.06, 0.08, 1.0, {
        r: 0.02,
        ry: 0,
        outline: 1.6,
      });
    }
    const bag = this.mat(0x2f7fd8, { rimStrength: 0.6 });
    for (let i = 0; i < 9; i += 1) {
      const g = new THREE.SphereGeometry(0.32, 12, 9);
      batch.add(
        g,
        bag,
        mat4(1.2 + r() * 3.4, 0.22 + (i > 5 ? 0.3 : 0), face + 1.65 + r() * 0.6, r() * 3, 0, 0, [
          1 + r() * 0.3,
          0.7,
          1,
        ]),
        { outline: 1.6 },
      );
    }

    // Palettes au pied de la cage d'escalier (le coin du Fantôme, plus tard).
    const pal = this.mat(0xb07a44);
    for (let i = 0; i < 4; i += 1)
      box(batch, pal, 18.5 * T, 0.08 + i * 0.16, face + 0.75, 1.5, 0.12, 1.0, {
        r: 0.01,
        outline: 1.4,
      });

    // Voitures de service (silhouettes génériques, sans marque).
    const carCols = [0x8a8f96, 0xd8d8d0];
    COUR_CARS.forEach(([x0, x1, y0, y1], i) => {
      const cx = ((x0 + x1 + 1) / 2) * T;
      const cz = ((y0 + y1 + 3) / 2) * T;
      const len = (x1 - x0 + 1) * T;
      const dep = (y1 - y0 + 1) * T;
      const body = this.mat(carCols[i % 2] ?? 0x8a8f96, { rimStrength: 0.6 });
      box(batch, body, cx, 0.5, cz, len, 0.62, dep, { r: 0.18 });
      box(batch, body, cx + 0.15, 1.02, cz, len * 0.55, 0.5, dep * 0.9, { r: 0.16 });
      box(batch, this.mat(0x1c2230), cx + 0.15, 1.04, cz, len * 0.57, 0.36, dep * 0.92, {
        r: 0.08,
        outline: 0,
      });
      for (const wx of [-1, 1])
        for (const wz of [-1, 1])
          batch.add(
            new THREE.CylinderGeometry(0.28, 0.28, 0.2, 14).rotateX(Math.PI / 2),
            this.mat(0x15151a),
            mat4(cx + wx * len * 0.32, 0.28, cz + wz * dep * 0.48),
            { outline: 1.4 },
          );
    });

    // Petits panneaux bleus sur piquets (textes de notre invention).
    const signs: [number, number, string[]][] = [
      [31.5, 10.5, ['RÉSERVÉ', 'PERMANENCE CONDUITE']],
      [31.5, 17.5, ['RÉSERVÉ PACO', 'BUS DE REMPLACEMENT']],
      [9.5, 19.5, ['ZONE D’EXERCICE', 'FORMATION SÉCURITÉ']],
    ];
    for (const [tx, ty, lines] of signs) {
      const x = tx * T;
      const z = (ty + 1) * T;
      box(batch, this.mat(0x9aa0a8), x, 0.6, z, 0.06, 1.2, 0.06, { outline: 1.2 });
      const st = this.tex(signTexture(lines, '#1d4fa8', '#ffffff', 256, 128));
      const m = new THREE.MeshToonMaterial({ map: st });
      this.disposables.push(m);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), m);
      plate.position.set(x, 1.35, z + 0.04);
      this.group.add(plate);
      this.disposables.push(plate.geometry);
    }

    // Casiers de la DPD sous un auvent, contre le soubassement ouest.
    const locker = this.mat(0x5a6a86, { rimStrength: 0.5 });
    const lockerDark = this.mat(0x2e3850);
    for (let ty = 10; ty <= 18; ty += 1) {
      const z = (ty + 1.5) * T;
      box(batch, locker, 1.5 * T + 0.05, 0.95, z, 0.42, 1.9, T - 0.03, { r: 0.02, outline: 1.6 });
      box(batch, lockerDark, 1.5 * T + 0.27, 1.45, z, 0.02, 0.24, T * 0.5, {
        outline: 0,
        cast: false,
      });
    }
    box(batch, this.mat(0x2f6a8a), 1.9 * T, 2.3, 15.5 * T, 1.3, 0.08, 10 * T, { outline: 1.6 });
    // Thermos sur un tabouret.
    box(batch, this.mat(0x6a4a32), 2.6 * T, 0.25, 19.8 * T, 0.3, 0.5, 0.3, { outline: 1.2 });
    batch.add(
      new THREE.CylinderGeometry(0.06, 0.06, 0.26, 10),
      this.mat(0xc0392b),
      mat4(2.6 * T, 0.63, 19.8 * T),
      { outline: 1.2 },
    );

    // Gaine de ventilation argentée sur l'aile est.
    const duct = this.mat(0xc8ccd4, { rimStrength: 0.9 });
    batch.add(new THREE.CylinderGeometry(0.42, 0.42, 9, 16), duct, mat4(W - 0.55, 4.5, face + 8), {
      outline: 2,
    });

    // Herbes folles le long des murs.
    const grass = this.mat(0x5a8a3a);
    for (let i = 0; i < 26; i += 1) {
      const side = i % 3;
      const x =
        side === 0 ? T + 0.15 + r() * 0.2 : side === 1 ? W - T - 0.2 : T * 2 + r() * (W - 4 * T);
      const z = side === 2 ? face + 0.3 : face + 1 + r() * (H - face - 3);
      batch.add(new THREE.ConeGeometry(0.1, 0.32, 5), grass, mat4(x, 0.16, z, r() * 3), {
        outline: 0,
        cast: false,
      });
    }

    // Traces de peinture rouge et bleue : l'anneau d'exercice du mannequin.
    const dummy = this.layout.marks.find((m) => m.kind === 'dummy');
    if (dummy) {
      const dx = (dummy.at.tx + 0.5) * T;
      const dz = (dummy.at.ty + 0.5) * T + pxToM(8);
      for (const [col, a0] of [
        [0xc0392b, 0],
        [0x2f5fd0, Math.PI],
      ] as const) {
        const m = new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.25, 1.45, 40, 1, a0, Math.PI * 0.85).rotateX(-Math.PI / 2),
          m,
        );
        ring.position.set(dx, 0.01, dz);
        ring.renderOrder = 1;
        this.group.add(ring);
        this.disposables.push(m, ring.geometry);
      }
    }

    // Côté caméra : soubassement de l'OCC, fenêtres basses à hauteur de pavés, porte vitrée.
    const bx0 = back ? back.tx * T : W / 2;
    const bx1 = back ? (back.tx + back.width) * T : W / 2;
    for (const [a, b] of [
      [0, bx0],
      [bx1, W],
    ] as const) {
      box(batch, plinth, (a + b) / 2, LOW_WALL_H / 2, H - T / 2, b - a, LOW_WALL_H, T, {
        outline: 1.6,
      });
      for (let x = a + 1.2; x < b - 0.8; x += 2.4)
        this.emissive(null, 0x40d8ff, 0.8, 0.9, 0.18, x, 0.3, H - T - 0.01, Math.PI);
    }
    this.emissive(null, 0x40d8ff, 0.5, bx1 - bx0, 0.6, (bx0 + bx1) / 2, 0.015, H - T - 0.3);
    const occSign = this.tex(
      signTexture(['OCC · SALLE DES OPÉRATIONS'], '#1c2a40', '#6ff3ff', 512, 80),
    );
    this.emissive(occSign, 0xffffff, 1.3, 2.2, 0.34, (bx0 + bx1) / 2, 0.95, H - T);
    box(batch, this.mat(0x6f6d6a), bx0 - 0.08, 0.6, H - T / 2, 0.16, 1.2, T, { outline: 1.6 });
    box(batch, this.mat(0x6f6d6a), bx1 + 0.08, 0.6, H - T / 2, 0.16, 1.2, T, { outline: 1.6 });

    // Lampes : appliques au sodium (casiers, sortie, mannequin, poubelles, voitures), lanterne de la cage.
    const spots: [number, number, number][] = [
      [4 * T, 2.6, 13.5 * T],
      [exMid, 3.2, face + 1.4],
      [14 * T, 3.0, 16 * T],
      [5 * T, 2.8, face + 2.2],
      [32 * T, 2.8, 12 * T],
      [19 * T, 2.4, H - 2 * T],
    ];
    const lantern = new THREE.PointLight(0xffd8a0, 14, 12, 1.5);
    lantern.position.set(stairX, 3.5, face + 1.2);
    this.addLamps(spots, lantern);
    for (const s of spots.slice(0, this.settings.quality.roomLights))
      this.pool(s[0], s[2], 4, 0xffb060, 0.12);
  }

  /** Une façade de brique (plan texturé + épaisseur sombre derrière). */
  private facade(
    batch: StaticBatch,
    x: number,
    z: number,
    w: number,
    ry: number,
    seed: number,
    stairX: number | null,
  ): void {
    const mat = this.mat(0xffffff, {
      map: this.tex(facadeTexture(w, FACADE_H, this.shift, seed, { stairX })),
      rimStrength: 0.15,
      rim: 0xffd8a0,
    });
    this.facadeMats.push({ mat, w, h: FACADE_H, seed, stairX });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, FACADE_H), mat);
    const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    plane.position.set(x + n.x * 0.02, FACADE_H / 2, z + n.z * 0.02);
    plane.rotation.y = ry;
    plane.receiveShadow = true;
    this.group.add(plane);
    this.disposables.push(plane.geometry);
    HubRoomView.box(
      batch,
      this.mat(0x6a5a3a),
      x - n.x * 0.25,
      FACADE_H / 2,
      z - n.z * 0.25,
      ry === 0 ? w : 0.5,
      FACADE_H,
      ry === 0 ? 0.5 : w,
      { outline: 0, cast: true },
    );
  }

  // ─── PNJ ───────────────────────────────────────────────────────────────────

  private placeNpcs(): void {
    for (const def of HUB_NPCS) {
      if (def.zone !== this.zone) continue;
      const mark = this.layout.marks.find((m) => m.kind === 'npc' && m.char === def.char);
      if (!mark) continue;
      const view = createNpcView(def.id, this.settings.reducedMotion);
      const pos = new THREE.Vector3((mark.at.tx + 0.5) * T, 0, (mark.at.ty + 0.6) * T);
      view.root.position.copy(pos);
      this.group.add(view.root);
      this.npcs.push({ id: def.id, view, pos });
      this.pool(pos.x, pos.z + 0.3, 2.4, TUNGSTEN, 0.32);
    }
  }

  /** Un PNJ réagit (on vient de lui parler). */
  public talk(id: HubNpcId): void {
    this.npcs.find((n) => n.id === id)?.view.talk();
  }

  // ─── Ambiance ──────────────────────────────────────────────────────────────

  /** Nouveau roulement : ciel, soleil, fenêtres de la Cour. */
  public setShift(shift: ShiftId): void {
    if (shift === this.shift) return;
    this.shift = shift;
    for (const f of this.facadeMats) {
      f.mat.map?.dispose();
      f.mat.map = facadeTexture(f.w, f.h, shift, f.seed, { stairX: f.stairX });
      this.disposables.push(f.mat.map);
      f.mat.needsUpdate = true;
    }
    this.applyAmbiance();
  }

  /** Infos du synoptique et du Tableau (après un achat). */
  public refresh(): void {
    const info = this.info();
    this.synoptic?.setInfo(info.synoptic);
    if (this.cork) {
      this.cork.map?.dispose();
      this.cork.map = this.tex(corkTexture(info.ownedRanks));
      this.cork.needsUpdate = true;
    }
    this.setShift(info.shift);
  }

  private applyAmbiance(): void {
    const a = AMBIANCE[this.zone][this.shift];
    const { scene, hemi } = this.lights;
    scene.background = new THREE.Color(a.background);
    scene.fog = new THREE.FogExp2(a.fog, a.fogDensity);
    hemi.color.setHex(a.sky);
    hemi.groundColor.setHex(a.ground);
    hemi.intensity = a.hemi;
    for (const l of this.lamps) l.intensity = a.lamp;
    if (this.stairGlass) {
      const night = this.shift === 'nuit';
      this.stairGlass.color
        .setHex(this.zone === 'cour' && night ? 0xffc27a : 0xcfe0f0)
        .multiplyScalar(night ? 1.1 : 0.85);
    }
  }

  // ─── Image ─────────────────────────────────────────────────────────────────

  public update(time: number, hero: THREE.Vector3, dt: number): void {
    const a = AMBIANCE[this.zone][this.shift];
    const { sun } = this.lights;
    // Le soleil suit le roulement (GameView recadre sa cible sur la salle).
    sun.color.setHex(a.sun);
    sun.intensity = a.sunIntensity;
    sun.position.set(
      sun.target.position.x + a.sunDir[0],
      a.sunDir[1],
      sun.target.position.z + a.sunDir[2],
    );
    this.synoptic?.update(time, dt);
    if (this.neon) {
      const flick = !this.settings.reducedMotion && Math.sin(time * 41) > 0.96;
      this.neon.color.setHex(0xdde8f0).multiplyScalar(flick ? 0.8 : 2.6);
    }
    for (const n of this.npcs) {
      const near = Math.hypot(hero.x - n.pos.x, hero.z - n.pos.z) < 4.5;
      n.view.update(dt, time, near ? hero : null);
    }
    // Décalque d'interaction sur la station la plus proche.
    const hx = hero.x * PX_PER_M;
    const hy = hero.z * PX_PER_M;
    let best: { x: number; y: number } | null = null;
    let bestD = STATION_RADIUS;
    for (const s of HUB_STATIONS) {
      if (s.zone !== this.zone) continue;
      const d = Math.hypot(hx - s.at.x, hy - s.at.y);
      if (d < bestD) {
        bestD = d;
        best = s.at;
      }
    }
    this.ring.visible = best !== null;
    this.ringFill.visible = best !== null;
    if (best) {
      this.ringT = this.settings.reducedMotion ? 1 : (this.ringT + dt * 1.2) % 1;
      this.ring.position.set(pxToM(best.x), 0.02, pxToM(best.y));
      this.ringFill.position.copy(this.ring.position);
      const s = 0.15 + 0.85 * this.ringT;
      this.ringFill.scale.set(s, 1, s);
    }
  }

  public setDoors(_doors: readonly DoorState[]): void {
    // Les portes du hub sont des données de la sim (`HUB_DOORS`), dessinées à la construction.
  }

  public setDoorsOpen(_open: boolean): void {
    // Toujours ouvertes.
  }

  public dispose(): void {
    for (const n of this.npcs) n.view.dispose();
    this.npcs.length = 0;
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.geometry as THREE.BufferGeometry).dispose();
    });
    for (const d of this.disposables) d.dispose();
  }
}
