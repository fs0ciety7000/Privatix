// Objets d'équipement au sol (loot) : petit modèle qui tourne et flotte, halo au sol et faisceau
// vertical à la couleur de la rareté (GDD § 9 bis.6 ; mise en scène : narrative_level.md § 3.1).
// La hauteur du faisceau grandit avec la rareté (lisible avant la couleur, pour les daltoniens) :
// Réforme = reflet au sol, Réglementaire 24 px, Homologué 48, Hors-série 72 (pulsé), Patrimoine 128
// (colonne d'or qui perce le brouillard, poussière dorée). Lit la simulation, ne la modifie pas.
import * as THREE from 'three';
import type { ItemRarity, SlotId } from '@/config/loot';
import { ITEM_RARITIES, ITEMS_BY_ID, LOOT_PICKUP } from '@/config/loot';
import type { GroundItem } from '@/sim/loot/LootSim';
import type { ItemInstance } from '@/systems/loot';
import { pxToM } from '@/sim/units';
import { radialTexture, rboxGeo, toon } from '@/view/materials/toon';

/** Couleur de rareté (hexadécimal) ; Patrimoine : cuivre, reflets or. */
export function rarityHex(rarity: ItemRarity): number {
  return Number.parseInt(ITEM_RARITIES[rarity].color.slice(1), 16);
}

/** Or des reflets Patrimoine (colonne, poussière). */
export const PATRIMOINE_GOLD = 0xffc24a;

/** Émetteur de particules lumineuses fourni par `GameView` (poussière dorée). */
export type GlowEmitter = (pos: THREE.Vector3, vel: THREE.Vector3, color: number) => void;

let beamTex: THREE.DataTexture | null = null;

/** Dégradé vertical du faisceau : plein en bas, nul en haut (alpha). */
function beamTexture(): THREE.DataTexture {
  if (!beamTex) {
    const h = 64;
    const data = new Uint8Array(4 * h);
    for (let i = 0; i < h; i += 1) {
      const t = i / (h - 1);
      const a = Math.round(255 * Math.pow(1 - t, 1.6));
      data.set([255, 255, 255, a], i * 4);
    }
    beamTex = new THREE.DataTexture(data, 1, h);
    beamTex.needsUpdate = true;
  }
  return beamTex;
}

interface Shown {
  readonly root: THREE.Group;
  readonly model: THREE.Group;
  readonly halo: THREE.Mesh;
  readonly beam: THREE.Mesh | null;
  readonly core: THREE.Mesh | null;
  readonly mats: THREE.Material[];
  readonly geos: THREE.BufferGeometry[];
  readonly rarity: ItemRarity;
  readonly g: GroundItem;
  t: number;
  dust: number;
}

/** Couleur de base d'un objet selon son emplacement (acier, orange haute visibilité, laiton…). */
const SLOT_BASE: Readonly<Record<SlotId, number>> = {
  outil: 0x8d96a8,
  casque: 0xffb21a,
  gilet: 0xff7a1a,
  gants: 0xc89a5a,
  chaussures: 0x4a3a36,
  insigne: 0xd8a040,
};

/** Modèle procédural lisible d'un objet (silhouette par emplacement, accent de rareté). */
function itemModel(
  slot: SlotId,
  rarity: ItemRarity,
  mats: THREE.Material[],
  geos: THREE.BufferGeometry[],
): THREE.Group {
  const g = new THREE.Group();
  const accent = rarityHex(rarity);
  const shine = rarity === 'patrimoine' ? 0.55 : rarity === 'hors-serie' ? 0.45 : 0.15;
  const m = (c: number, emissive = 0x000000, ei = 0): THREE.Material => {
    const mat = toon(c, { rimStrength: 0.9, emissive, emissiveIntensity: ei });
    mats.push(mat);
    return mat;
  };
  const base = m(rarity === 'patrimoine' ? 0xc8783a : SLOT_BASE[slot]);
  const trim = m(accent, accent, shine);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  switch (slot) {
    case 'outil': {
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 8), base, 0, 0.36).rotation.z = 0.5;
      add(rboxGeo(0.3, 0.1, 0.1, 0.02), trim, 0.18, 0.66).rotation.z = 0.5;
      break;
    }
    case 'casque': {
      add(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), base, 0, 0.14);
      add(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 16), trim, 0, 0.15);
      break;
    }
    case 'gilet': {
      add(rboxGeo(0.4, 0.46, 0.12, 0.04), base, 0, 0.3);
      add(rboxGeo(0.42, 0.05, 0.13, 0.01), trim, 0, 0.3);
      add(rboxGeo(0.42, 0.05, 0.13, 0.01), trim, 0, 0.42);
      break;
    }
    case 'gants': {
      add(rboxGeo(0.14, 0.2, 0.08, 0.03), base, -0.09, 0.16).rotation.z = 0.25;
      add(rboxGeo(0.14, 0.2, 0.08, 0.03), base, 0.09, 0.16).rotation.z = -0.25;
      add(rboxGeo(0.34, 0.04, 0.09, 0.01), trim, 0, 0.05);
      break;
    }
    case 'chaussures': {
      add(rboxGeo(0.16, 0.16, 0.3, 0.04), base, -0.1, 0.1);
      add(rboxGeo(0.16, 0.16, 0.3, 0.04), base, 0.1, 0.1);
      add(rboxGeo(0.38, 0.04, 0.32, 0.01), trim, 0, 0.02);
      break;
    }
    case 'insigne': {
      add(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 18), trim, 0, 0.3).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 18), base, 0, 0.3).rotation.x = Math.PI / 2;
      break;
    }
  }
  return g;
}

/**
 * Objets d'équipement au sol : une vue par `GroundItem` (création à l'apparition, libération à la
 * disparition). Arc d'éjection calé sur le temps de sim, rotation, faisceau, halo, poussière dorée.
 */
export class LootViews {
  private readonly items = new Map<number, Shown>();
  private readonly beamGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0);
  private readonly haloGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly tmp = new THREE.Vector3();
  private readonly vel = new THREE.Vector3();

  public constructor(
    private readonly scene: THREE.Scene,
    private readonly reducedMotion: boolean,
    private readonly emitGlow: GlowEmitter,
  ) {}

  /**
   * `near` : objet que le héros peut prendre (contour plus vif) ; `ready` : salle calme (les
   * faisceaux s'intensifient quand les objets deviennent ramassables).
   */
  public sync(
    ground: readonly GroundItem[],
    simNow: number,
    dt: number,
    near: number | null,
    ready: boolean,
  ): void {
    const alive = new Set<number>();
    for (const g of ground) {
      alive.add(g.id);
      let it = this.items.get(g.id);
      if (!it) {
        it = this.create(g);
        this.items.set(g.id, it);
      }
      this.animate(it, simNow, dt, near === g.id, ready);
    }
    for (const [id, it] of this.items) {
      if (alive.has(id)) continue;
      this.remove(it);
      this.items.delete(id);
    }
  }

  private create(g: GroundItem): Shown {
    const rarity = g.item.rarity;
    const slot = ITEMS_BY_ID.get(g.item.defId)?.slot ?? 'outil';
    const mats: THREE.Material[] = [];
    const geos: THREE.BufferGeometry[] = [];
    const root = new THREE.Group();
    root.position.set(pxToM(g.x), 0, pxToM(g.y));
    const model = itemModel(slot, rarity, mats, geos);
    root.add(model);
    const color = new THREE.Color(rarityHex(rarity));
    const haloMat = new THREE.MeshBasicMaterial({
      map: radialTexture(),
      color: color.clone().multiplyScalar(rarity === 'reforme' ? 0.45 : 0.75),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    mats.push(haloMat);
    const halo = new THREE.Mesh(this.haloGeo, haloMat);
    const haloSize = rarity === 'patrimoine' ? 1.6 : rarity === 'hors-serie' ? 1.3 : 1.0;
    halo.scale.set(haloSize, 1, haloSize);
    halo.position.y = 0.03;
    halo.renderOrder = 3;
    root.add(halo);
    let beam: THREE.Mesh | null = null;
    let core: THREE.Mesh | null = null;
    const px = ITEM_RARITIES[rarity].beamPx;
    if (px > 0) {
      const tint = rarity === 'patrimoine' ? new THREE.Color(PATRIMOINE_GOLD) : color;
      const beamMat = new THREE.MeshBasicMaterial({
        color: tint.clone().multiplyScalar(rarity === 'patrimoine' ? 0.42 : 0.6),
        alphaMap: beamTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
        fog: false,
      });
      mats.push(beamMat);
      const h = pxToM(px) * (rarity === 'patrimoine' ? 1.5 : 1.4);
      const w = rarity === 'patrimoine' ? 0.2 : rarity === 'hors-serie' ? 0.14 : 0.11;
      beam = new THREE.Mesh(this.beamGeo, beamMat);
      beam.scale.set(w, h, w);
      beam.renderOrder = 5;
      root.add(beam);
      const coreMat = beamMat.clone();
      coreMat.color = new THREE.Color(0xffffff)
        .lerp(tint, 0.45)
        .multiplyScalar(rarity === 'patrimoine' ? 0.5 : 0.7);
      mats.push(coreMat);
      core = new THREE.Mesh(this.beamGeo, coreMat);
      core.scale.set(w * 0.3, h * 1.02, w * 0.3);
      core.renderOrder = 5;
      root.add(core);
    }
    this.scene.add(root);
    return {
      root,
      model,
      halo,
      beam,
      core,
      mats,
      geos,
      rarity,
      g,
      t: (g.id * 0.618) % 1,
      dust: 0,
    };
  }

  private animate(it: Shown, simNow: number, dt: number, near: boolean, ready: boolean): void {
    const g = it.g;
    it.t += dt;
    // Arc d'éjection (temps de sim) : du point de drop au point de chute, en cloche.
    const k = Math.min(1, Math.max(0, (simNow - g.at) / LOOT_PICKUP.EJECT_MS));
    const x = g.fromX + (g.x - g.fromX) * k;
    const y = g.fromY + (g.y - g.fromY) * k;
    const lift = Math.sin(k * Math.PI) * 1.1;
    it.root.position.set(pxToM(x), 0, pxToM(y));
    const bob = this.reducedMotion ? 0.12 : 0.12 + Math.sin(it.t * 3.2) * 0.05;
    it.model.position.y = lift + bob * k;
    it.model.rotation.y = it.t * (this.reducedMotion ? 0.6 : 1.5);
    const landed = k >= 1;
    const pulse =
      it.rarity === 'hors-serie' && !this.reducedMotion
        ? 0.75 + 0.25 * Math.sin(it.t * Math.PI * 2)
        : 1;
    const lit = (ready ? 1 : 0.6) * (near ? 1.35 : 1) * pulse;
    const grow = landed ? 1 : k;
    if (it.beam) {
      it.beam.visible = k > 0.4;
      (it.beam.material as THREE.MeshBasicMaterial).opacity = Math.min(1, lit) * grow;
    }
    if (it.core) {
      it.core.visible = k > 0.4;
      (it.core.material as THREE.MeshBasicMaterial).opacity = Math.min(1, lit) * grow;
    }
    (it.halo.material as THREE.MeshBasicMaterial).opacity = Math.min(1, lit * (near ? 1 : 0.8));
    // Poussière dorée dans la colonne Patrimoine, braises violettes du Hors-série.
    if (landed && (it.rarity === 'patrimoine' || it.rarity === 'hors-serie')) {
      it.dust -= dt;
      if (it.dust <= 0) {
        it.dust = it.rarity === 'patrimoine' ? 0.09 : 0.2;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.35;
        this.tmp.set(
          it.root.position.x + Math.cos(a) * r,
          0.2 + Math.random() * 0.6,
          it.root.position.z + Math.sin(a) * r,
        );
        this.vel.set(0, 0.8 + Math.random() * 1.4, 0);
        this.emitGlow(
          this.tmp,
          this.vel,
          it.rarity === 'patrimoine' ? PATRIMOINE_GOLD : rarityHex(it.rarity),
        );
      }
    }
  }

  private remove(it: Shown): void {
    it.root.removeFromParent();
    for (const m of it.mats) m.dispose();
    for (const g of it.geos) g.dispose();
  }

  public dispose(): void {
    for (const it of this.items.values()) this.remove(it);
    this.items.clear();
    this.beamGeo.dispose();
    this.haloGeo.dispose();
  }
}

/**
 * Pièce 3D (clé `items` de `public/models/manifest.json`) portée par le héros pour une base d'objet
 * visible (Casque, Gilet, Outil). Les Gants, Chaussures et Insigne ne se voient pas encore (pas de
 * modèle). Hors-série et Patrimoine prennent la pièce ornée quand elle existe.
 */
const GEAR_PIECES: Readonly<
  Record<string, { readonly piece: string; readonly rare?: string; readonly legendary?: string }>
> = {
  'cle-tire-fond': { piece: 'cle_tire_fond', rare: 'cle_tire_fond_epique' },
  'cle-cliquet': { piece: 'cle_tire_fond', rare: 'cle_tire_fond_epique' },
  'cle-releve': { piece: 'cle_tire_fond_epique' },
  'masse-voie': { piece: 'masse_de_voie' },
  'pied-de-biche': { piece: 'pince_catenaire' },
  'lanterne-signalisation': { piece: 'pince_catenaire' },
  'pelle-ballast': { piece: 'masse_de_voie' },
  'perche-isolante': { piece: 'pince_catenaire' },
  'casque-chantier': { piece: 'casque_chantier', legendary: 'casque_legendaire' },
  'casque-antibruit': { piece: 'casque_antibruit', legendary: 'casque_legendaire' },
  'casque-lampe': { piece: 'casque_chantier', legendary: 'casque_legendaire' },
  'gilet-classe2': { piece: 'gilet_hv', rare: 'gilet_porte_outils' },
  'gilet-signaleur': { piece: 'gilet_porte_outils' },
  'parka-nuit': { piece: 'gilet_porte_outils' },
};

/** Pièce GLB d'un objet porté, ou `null` (emplacement pas encore visible). */
export function gearPieceFor(item: ItemInstance): string | null {
  const p = GEAR_PIECES[item.defId];
  if (!p) return null;
  if (item.rarity === 'patrimoine') return p.legendary ?? p.rare ?? p.piece;
  if (item.rarity === 'hors-serie') return p.rare ?? p.piece;
  return p.piece;
}

/** Liseré de la pièce portée : couleur de rareté à partir d'Homologué (sinon contour d'origine). */
export function gearOutlineFor(item: ItemInstance): number | null {
  if (item.rarity === 'reforme' || item.rarity === 'reglementaire') return null;
  return item.rarity === 'patrimoine' ? PATRIMOINE_GOLD : rarityHex(item.rarity);
}
