// Vue 3D d'une partie : renderer, scène, lumières, post-traitement, salle, acteurs, effets et caméra.
// Elle lit le monde simulé (interpolé) et consomme ses événements ; elle ne modifie jamais la sim.
// Rendu (toon, contours, bloom, étalonnage) repris du prototype validé (prototypes/proto3d).
import * as THREE from 'three';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import type { SimEvent } from '@/sim/events';
import type { World } from '@/sim/World';
import type { RoomLayout } from '@/systems/procedural/RoomLayout';
import type { DoorState } from '@/sim/RunDirector';
import { PX_PER_M, pxToM, yawFromAngle } from '@/sim/units';
import type { Vec2 } from '@/utils/math';
import type {
  ActorFrame,
  ActorFxSink,
  EnemyView,
  HeroActorView,
  HeroEquipment,
} from '@/view/actors/ActorView';
import { createEnemyView, createHeroView } from '@/view/actors/factory';
import type { FloatKind } from '@/view/fx/DamageNumbers';
import { DamageNumbers } from '@/view/fx/DamageNumbers';
import { Bursts, Ghosts, Puffs, Rings, Shake, Smear, Sparks } from '@/view/fx/effects';
import { outlineUniforms, PAL, setOutlinesEnabled } from '@/view/materials/toon';
import { Post } from '@/view/post/Post';
import type { ViewSettings } from '@/view/quality';
import { HazardViews } from '@/view/HazardViews';
import { PickupViews, ProjectileView, PropViews } from '@/view/ItemsView';
import {
  gearOutlineFor,
  gearPieceFor,
  LootViews,
  PATRIMOINE_GOLD,
  rarityHex,
} from '@/view/LootView';
import { DEFAULT_GEAR } from '@/view/actors/actorClips';
import type { EquipSlot } from '@/view/models/manifest';
import { RoomView } from '@/view/RoomView';

/** Emplacements d'équipement visibles sur le héros. */
const VISIBLE_SLOTS: readonly EquipSlot[] = ['casque', 'gilet', 'outil'];

/** Caméra 3/4 à la Hades : focale serrée (peu de déformation), tangage d'environ 41°. */
const CAM_OFFSET = new THREE.Vector3(0, 10.9, 12.3);
const CAM_LOOK_BACK = 2.5;
const FOV_LANDSCAPE = 30;
const FOV_PORTRAIT = 42;
const ZOOM_PUNCH_DEG = 2;

/** Lumières globales de la scène, prêtées au décor d'une salle (ambiance du hub selon le roulement). */
export interface SceneLights {
  readonly scene: THREE.Scene;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
}

/** Décor d'une salle : `RoomView` pour le Shift, un autre décor pour le hub (`view/hub`). */
export interface RoomDecor {
  readonly group: THREE.Group;
  /** Limites du sol marchable (m), pour le cadrage caméra. */
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  update(time: number, hero: THREE.Vector3, dt: number): void;
  setDoors(doors: readonly DoorState[]): void;
  setDoorsOpen(open: boolean): void;
  dispose(): void;
}

/**
 * Points d'extension de la vue (le hub s'en sert ; le Shift garde les valeurs par défaut) :
 * décor construit depuis le gabarit et vue dédiée d'un ennemi (mannequin de formation).
 */
export interface GameViewOptions {
  readonly room?: (layout: RoomLayout, settings: ViewSettings, lights: SceneLights) => RoomDecor;
  readonly enemyView?: (
    e: EnemySim,
    scene: THREE.Scene,
    reducedMotion: boolean,
  ) => EnemyView | null;
}

export interface ViewStats {
  readonly fps: number;
  readonly calls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly pixelRatio: number;
}

/** Conversion d'un point logique (u) en point 3D (m) à la hauteur `y`. */
function at(x: number, y: number, height = 0, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(x / PX_PER_M, height, y / PX_PER_M);
}

function dir(angle: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
}

export class GameView implements ActorFxSink {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene = new THREE.Scene();
  public readonly camera: THREE.PerspectiveCamera;
  private readonly post: Post;
  private room: RoomDecor;
  private shownLayout: RoomLayout;
  private readonly hero: HeroActorView;
  private readonly enemies = new Map<number, EnemyView>();
  private readonly hazards: HazardViews;
  private readonly projectiles = new ProjectileView();
  private readonly pickups: PickupViews;
  private readonly props: PropViews;
  private readonly loot: LootViews;
  /** Version de l'équipement déjà portée par le modèle du héros, et pièce par emplacement. */
  private gearVersion = -1;
  private readonly gearShown = new Map<EquipSlot, string>();
  private readonly sparks: Sparks;
  private readonly puffs: Puffs;
  private readonly glows: Puffs;
  private readonly ghosts = new Ghosts();
  private readonly rings = new Rings();
  private readonly bursts = new Bursts(12);
  private readonly shake = new Shake();
  private readonly heroSmear = new Smear(0xfff6d8, 0xff8a1a);
  private readonly enemySmears = [
    new Smear(0xffd3ec, PAL.danger),
    new Smear(0xffd3ec, PAL.danger),
    new Smear(0xffd3ec, PAL.danger),
  ];
  private readonly dmg: DamageNumbers;
  private readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private dust: THREE.Points | null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly camTarget = new THREE.Vector3();
  private readonly aimPoint = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private hasAim = false;
  private hurtVignette = 0;
  private zoomPunch = 0;
  private time = 0;
  private lastSimTime = 0;
  private ghostAt = 0;
  private frames = 0;
  private fpsT = 0;
  private fps = 60;
  private slowFor = 0;
  private prCap: number;
  private width = 1;
  private height = 1;

  public constructor(
    host: HTMLElement,
    floatHost: HTMLElement,
    private readonly world: World,
    private readonly settings: ViewSettings,
    safe: boolean,
    private readonly options: GameViewOptions = {},
  ) {
    const q = settings.quality;
    setOutlinesEnabled(q.outlines);
    this.prCap = q.pixelRatioCap;
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.info.autoReset = false;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.prCap));
    this.renderer.shadowMap.enabled = q.shadowMapSize > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0a0818);
    this.scene.fog = new THREE.FogExp2(0x120c2a, 0.017);
    this.camera = new THREE.PerspectiveCamera(FOV_LANDSCAPE, 16 / 9, 0.5, 120);

    // Lumières : ciel nocturne, lune froide (seule lumière à ombres), lampes chaudes de la salle.
    this.hemi = new THREE.HemisphereLight(0x5a5ad0, 0x2a1438, 0.7);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xa8b8ff, 1.9);
    this.sun.castShadow = q.shadowMapSize > 0;
    if (this.sun.castShadow) {
      this.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.03;
    }
    this.scene.add(this.sun, this.sun.target);

    // Salle réelle, construite depuis le gabarit de la sim.
    this.shownLayout = world.arena.layout;
    this.room = this.makeRoom(world.arena.layout);
    this.scene.add(this.room.group);
    const W = world.arena.widthPx / PX_PER_M;
    const H = world.arena.heightPx / PX_PER_M;
    this.fitSun(W, H);

    const pk = q.particles;
    this.sparks = new Sparks(Math.round(900 * pk));
    this.puffs = new Puffs(Math.round(400 * pk), false);
    this.glows = new Puffs(Math.round(300 * pk), true);
    this.bursts.intensityScale = settings.reducedMotion ? 0.45 : 1;
    this.shake.amplitude = settings.reducedMotion ? 0.5 : 1;
    this.scene.add(
      this.sparks.mesh,
      this.puffs.points,
      this.glows.points,
      this.ghosts.group,
      this.rings.group,
      this.bursts.group,
      this.heroSmear.mesh,
    );
    for (const s of this.enemySmears) this.scene.add(s.mesh);

    this.hero = createHeroView(settings.reducedMotion, this);
    this.scene.add(this.hero.root);
    this.hazards = new HazardViews(this.scene, settings.reducedMotion);
    this.pickups = new PickupViews(this.scene);
    this.props = new PropViews(this.scene);
    this.loot = new LootViews(this.scene, settings.reducedMotion, (p, v, c) => {
      this.glows.emit(p, v, c, 0.9 + Math.random() * 0.6, 0.12 + Math.random() * 0.1, {
        drag: 0.6,
        alpha: 0.9,
      });
    });
    this.scene.add(this.projectiles.mesh, this.projectiles.halo);
    this.room.setDoors(world.director.doors);
    this.props.build(world.director.interactables);
    this.dmg = new DamageNumbers(floatHost);
    this.dust = q.dust ? this.makeDust(W, H) : null;
    if (this.dust) this.scene.add(this.dust);

    const spawn = world.hero.body;
    this.camTarget.set(pxToM(spawn.x), 0, pxToM(spawn.y));
    this.post = new Post(this.renderer, this.scene, this.camera, innerWidth, innerHeight, q, safe);
    this.resize(innerWidth, innerHeight);
    this.lastSimTime = world.now();
  }

  /** Ombres de la lune cadrées sur la salle courante. */
  private fitSun(W: number, H: number): void {
    this.sun.position.set(W / 2 - 8, 20, H / 2 + 10);
    this.sun.target.position.set(W / 2, 0, H / 2);
    if (!this.sun.castShadow) return;
    const sc = this.sun.shadow.camera;
    const half = Math.max(W, H) / 2 + 2;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 1;
    sc.far = 60;
    sc.updateProjectionMatrix();
  }

  /**
   * Nouvelle salle (événement `roomEntered`) : le décor est reconstruit depuis le gabarit de la sim,
   * les acteurs et objets de la salle précédente sont libérés, la caméra se recale sur le héros.
   * Le nombre de lumières est fixe (preset) : aucun shader n'est recompilé.
   */
  public setRoom(): void {
    const world = this.world;
    if (this.shownLayout === world.arena.layout) return;
    this.shownLayout = world.arena.layout;
    this.room.dispose();
    this.room = this.makeRoom(world.arena.layout);
    this.scene.add(this.room.group);
    this.room.setDoors(world.director.doors);
    this.room.setDoorsOpen(world.director.cleared);
    const W = world.arena.widthPx / PX_PER_M;
    const H = world.arena.heightPx / PX_PER_M;
    this.fitSun(W, H);
    if (this.dust) {
      this.scene.remove(this.dust);
      this.dust.geometry.dispose();
      (this.dust.material as THREE.Material).dispose();
      this.dust = this.settings.quality.dust ? this.makeDust(W, H) : null;
      if (this.dust) this.scene.add(this.dust);
    }
    for (const v of this.enemies.values()) v.dispose();
    this.enemies.clear();
    this.hazards.clear();
    this.pickups.clear();
    this.props.build(world.director.interactables);
    const h = world.hero.body;
    this.camTarget.set(pxToM(h.x), 0, pxToM(h.y));
    this.hero.sync(world.hero, 1, 0, 0);
  }

  private makeRoom(layout: RoomLayout): RoomDecor {
    const make = this.options.room;
    if (make)
      return make(layout, this.settings, { scene: this.scene, sun: this.sun, hemi: this.hemi });
    return new RoomView(layout, this.settings.quality, this.settings.reducedMotion);
  }

  /**
   * Équipement visible du héros (GLB) pour l'agent loot : `attach(slot, pieceId)` / `detach(slot)`.
   * `null` si le héros est procédural (repli, `?procedural`).
   */
  public get heroEquipment(): HeroEquipment | null {
    return this.hero.equipment;
  }

  /** Événements d'animation des modèles GLB (manifeste) : poussière des pas, atterrissages, éclats. */
  public actorEvent(event: string, at: THREE.Vector3, size: number): void {
    const k = size / 2;
    switch (event) {
      case 'step':
        this.puffs.dustRing(at, 2, 0.1 * k, 0x50486a, 0.7 * k);
        break;
      case 'land':
        this.puffs.dustRing(at, 10, 0.35 * k, 0x5a5070, 3 * k);
        break;
      case 'glint':
        this.bursts.spawn(at, 0xffffff, 0.9 * k, 0.12, 2.5);
        break;
      case 'plates':
        this.sparks.burst(at, new THREE.Vector3(0, 1, 0), 24, 0xffd27a, 8, 2, 0.5, 0.04, 4);
        break;
    }
  }

  // ─── Entrées ───────────────────────────────────────────────────────────────

  /** Point logique (u) visé au sol sous un pointeur (coordonnées normalisées −1..1), ou `null`. */
  public groundPoint(ndcX: number, ndcY: number): Vec2 | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.ground, this.aimPoint);
    this.hasAim = hit !== null;
    return hit ? { x: hit.x * PX_PER_M, y: hit.z * PX_PER_M } : null;
  }

  // ─── Taille ────────────────────────────────────────────────────────────────

  public resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    const pr = Math.min(devicePixelRatio || 1, this.prCap);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // En portrait / écran étroit : on recule pour garder la lisibilité.
    this.camera.fov = w / h < 1.2 ? FOV_PORTRAIT : FOV_LANDSCAPE;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h, pr);
    outlineUniforms.uRes.value.set(w * pr, h * pr);
    this.sparks.setAspect(w / h);
    const scale = (h * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.puffs.setScale(scale);
    this.glows.setScale(scale);
    if (this.dust)
      (
        (this.dust.material as THREE.ShaderMaterial).uniforms.uScale as THREE.IUniform<number>
      ).value = scale;
  }

  // ─── Événements de la simulation ───────────────────────────────────────────

  public applyEvents(events: readonly SimEvent[]): void {
    for (const e of events) this.applyEvent(e);
  }

  private applyEvent(e: SimEvent): void {
    switch (e.type) {
      case 'swing':
        this.onSwing(e.combo, e.finisher, e.dashAttack, e.x, e.y, e.angle, e.reach);
        if (e.arcDeg >= 360) {
          // Cercle d'Outil (Masse, Pelle, Perche) : onde au sol à la forme de la hitbox.
          const c = at(e.x, e.y).addScaledVector(dir(e.angle), pxToM(e.reach) * 0.45);
          this.rings.spawn(c, 0xff8a1a, 0.2, pxToM(e.reach) * 0.6, 0.3, 0.22, 0.3, 2.4);
          this.puffs.dustRing(c, 12, pxToM(e.reach) * 0.4, 0x5a5070, 4);
        }
        break;
      case 'enemyStrike':
        this.onStrike(e.id, e.attack, e.x, e.y, e.angle);
        break;
      case 'enemyHit': {
        this.enemies.get(e.id)?.hit(e.heavy);
        const d = dir(e.angle);
        const p = at(e.x, e.y, 1.0);
        this.dmg.spawn(
          p.clone().setY(1.7),
          String(e.amount),
          e.crit ? 'crit' : e.heavy ? 'big' : 'normal',
        );
        this.bursts.spawn(
          p.clone().addScaledVector(d, -0.2),
          e.crit ? 0xfff0a0 : 0xffffff,
          e.heavy ? 2.6 : 1.8,
          0.14,
          3.2,
        );
        this.sparks.burst(p, d, e.heavy ? 22 : 12, 0xffd27a, 9, 0.9, 0.4, 0.035, 3);
        this.sparks.burst(p, d, 6, 0xffffff, 12, 0.5, 0.25, 0.03, 2);
        // Feuilles de papier (le rapport du consultant).
        for (let i = 0; i < (e.heavy ? 8 : 3); i += 1) {
          const v = d
            .clone()
            .multiplyScalar(2 + Math.random() * 3)
            .add(
              this.tmp.set(
                (Math.random() - 0.5) * 2,
                2 + Math.random() * 3,
                (Math.random() - 0.5) * 2,
              ),
            );
          this.puffs.emit(p, v, 0xf4f0e6, 1.2 + Math.random() * 0.6, 0.11, {
            grav: 4,
            drag: 2.2,
            alpha: 1,
            shape: 1,
          });
        }
        break;
      }
      case 'enemyKilled': {
        this.enemies.get(e.id)?.die(e.angle);
        const d = dir(e.angle);
        const p = at(e.x, e.y, 1);
        this.bursts.spawn(p, 0xffffff, e.last ? 4.6 : 3.6, 0.22, 4);
        this.sparks.burst(p, d, 30, PAL.enemy, 11, 1.4, 0.6, 0.04, 5);
        this.sparks.burst(p, d, 16, PAL.danger, 8, 2.5, 0.5, 0.035, 4);
        for (let i = 0; i < 14; i += 1) {
          const v = this.tmp
            .set((Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5)
            .addScaledVector(d, 3);
          this.puffs.emit(p, v, 0xf4f0e6, 1.6 + Math.random(), 0.12, {
            grav: 3.5,
            drag: 2,
            alpha: 1,
            shape: 1,
          });
        }
        break;
      }
      case 'enemySpawn': {
        const p = at(e.x, e.y);
        this.rings.spawn(p, PAL.enemy, 0.2, 1.6, 0.6, 0.18, 0.4, 2.2);
        this.rings.spawn(p, PAL.danger, 1.6, 0.2, 0.6, 0.12, 0.0, 2.2);
        break;
      }
      case 'wallSlam': {
        const p = at(e.x, e.y);
        this.puffs.dustRing(p, 10, 0.4, 0x4a4466, 2.5);
        this.sparks.burst(
          p.setY(0.6),
          new THREE.Vector3(0, 0, 1),
          10,
          0xffd27a,
          6,
          3,
          0.4,
          0.03,
          4,
        );
        break;
      }
      case 'heroHurt': {
        this.hero.hurt();
        this.hurtVignette = this.settings.reducedMotion ? 0.5 : 1;
        const p = at(e.x, e.y, 1.1);
        this.bursts.spawn(p, PAL.danger, 2.2, 0.16, 3);
        this.sparks.burst(p, dir(e.angle), 14, PAL.danger, 8, 1.2, 0.35, 0.035, 3);
        this.dmg.spawn(p.clone().setY(1.6), `-${String(e.amount)}`, 'hurt');
        break;
      }
      case 'dash': {
        const p = at(e.x, e.y);
        this.puffs.dustRing(p, 8, 0.3, 0x50486a, 3);
        this.rings.spawn(p, 0x6ff3ff, 0.3, 1.4, 0.25, 0.2, 0.1, 1.6);
        this.hero.punch([0.8, 1.15, 1.3]);
        this.ghostAt = 0;
        break;
      }
      case 'dashEnd':
        this.puffs.dustRing(at(e.x, e.y), 5, 0.25, 0x50486a, 1.5);
        break;
      case 'perfectDash': {
        const p = at(e.x, e.y);
        this.rings.spawn(p, 0xffd200, 0.3, 2.2, 0.35, 0.2, 0.2, 2.6);
        this.bursts.spawn(p.setY(1.1), 0xffd200, 2.4, 0.2, 3);
        break;
      }
      case 'special': {
        const p = at(e.x, e.y);
        const r = pxToM(e.radius);
        const col = e.kind === 'preavis' ? 0xffd200 : 0x6ff3ff;
        this.rings.spawn(p, col, 0.3, r, 0.35, 0.22, 0.25, 2.6);
        this.rings.spawn(p, 0xffffff, 0.2, r * 0.7, 0.25, 0.3, 0.4, 2.2);
        this.bursts.spawn(p.clone().setY(1.2), col, 3.4, 0.25, 3);
        this.puffs.dustRing(p, 16, r * 0.4, 0x5a5070, 5);
        break;
      }
      case 'shake':
        this.shake.add(Math.min(1, 0.1 + e.px * 0.105));
        break;
      case 'zoomPunch':
        if (!this.settings.reducedMotion) this.zoomPunch = 1;
        break;
      case 'vignette':
        this.hurtVignette = Math.max(
          this.hurtVignette,
          this.settings.reducedMotion ? e.amount * 0.5 : e.amount,
        );
        break;
      case 'text':
        this.dmg.spawn(at(e.x, e.y, 2.0), e.text, toneToKind(e.tone));
        break;
      case 'roomCleared':
        this.room.setDoorsOpen(true);
        break;
      case 'roomEntered':
        this.setRoom();
        break;
      case 'projectileBroken': {
        const p = at(e.x, e.y, 0.5);
        this.sparks.burst(p, new THREE.Vector3(0, 0, 1), 8, 0xffd3ec, 5, 3, 0.3, 0.03, 3);
        if (e.by === 'weapon') this.bursts.spawn(p, PAL.danger, 1.2, 0.12, 2);
        break;
      }
      case 'projectileFired':
        this.bursts.spawn(at(e.x, e.y, 0.6), PAL.danger, 0.9, 0.1, 2);
        break;
      case 'hazardImpact': {
        const p = at(e.x, e.y);
        if (e.kind === 'band') break;
        const r = pxToM(e.radius);
        this.rings.spawn(p, PAL.danger, r * 0.6, r * 1.1, 0.3, 0.25, 0.3, 2.4);
        this.puffs.dustRing(p, 10, r * 0.6, 0x5a4a70, 3);
        break;
      }
      case 'explosion': {
        const p = at(e.x, e.y, 0.8 * e.scale);
        this.bursts.spawn(p, 0xffb347, 3 * e.scale, 0.3, 4);
        this.sparks.burst(
          p,
          new THREE.Vector3(0, 0, 1),
          Math.round(26 * e.scale),
          0xff8a3a,
          9,
          3.2,
          0.6,
          0.045,
          6,
        );
        this.rings.spawn(at(e.x, e.y), 0xff8a3a, 0.2, 1.8 * e.scale, 0.4, 0.25, 0.3, 2.4);
        this.puffs.dustRing(at(e.x, e.y), 12, 0.4 * e.scale, 0x3a3048, 3.5);
        break;
      }
      case 'dust':
        this.puffs.dustRing(at(e.x, e.y), e.count, 0.3, 0x5a5070, 2.5);
        break;
      case 'pickup': {
        const p = at(e.x, e.y, 0.4);
        this.sparks.burst(p, new THREE.Vector3(0, 0, 1), 10, 0xffd200, 5, 3.2, 0.5, 0.035, 5);
        this.rings.spawn(at(e.x, e.y), 0xffd200, 0.2, 1.2, 0.3, 0.2, 0.2, 2.2);
        if (e.text) this.dmg.spawn(p.setY(1.8), e.text, 'gold');
        break;
      }
      case 'lootDropped':
        this.onLootDropped(e.x, e.y, e.fromX, e.fromY, e.rank, rarityHex(e.rarity));
        break;
      case 'lootTaken': {
        const p = at(e.x, e.y, 0.5);
        const c = e.action === 'scrap' ? 0x9aa4b0 : rarityHex(e.rarity);
        this.sparks.burst(p, new THREE.Vector3(0, 0, 1), 14, c, 5, 3.2, 0.5, 0.035, 5);
        this.rings.spawn(at(e.x, e.y), c, 0.2, 1.3, 0.35, 0.2, 0.25, 2.4);
        if (e.action === 'equip') this.hero.punch([1.12, 0.9, 1.12]);
        break;
      }
      case 'gearFx':
        this.onGearFx(e.kind, e.x, e.y, e.angle, e.size);
        break;
      case 'heroDied':
      case 'wave':
      case 'notice':
      case 'doorTaken':
      case 'shiftEnded':
      case 'bossPhase':
      case 'gearChanged':
        break;
    }
  }

  /**
   * Drop d'un objet : mise en scène croissante avec la rareté (narrative_level.md § 3.1). Réforme :
   * un peu de poussière ; Homologué : anneau bleu ; Hors-série : gerbe violette ; Patrimoine :
   * éclat d'or, double anneau et pluie d'étincelles (le ralenti est décidé par la scène).
   */
  private onLootDropped(
    x: number,
    y: number,
    fromX: number,
    fromY: number,
    rank: number,
    color: number,
  ): void {
    const from = at(fromX, fromY, 0.6);
    const land = at(x, y);
    this.sparks.burst(from, new THREE.Vector3(0, 0, 1), 4 + rank * 4, color, 4, 3.2, 0.4, 0.03, 4);
    if (rank <= 0) {
      this.puffs.dustRing(land, 5, 0.2, 0x5a5070, 1.5);
      return;
    }
    this.rings.spawn(land, color, 0.2, 0.8 + rank * 0.45, 0.45, 0.22, 0.2, 1.6 + rank * 0.4);
    if (rank >= 3) this.bursts.spawn(at(x, y, 1.2), color, 1.4 + rank * 0.5, 0.25, 3);
    if (rank >= 4) {
      const gold = PATRIMOINE_GOLD;
      this.rings.spawn(land, gold, 0.4, 4.2, 0.9, 0.18, 0.15, 3);
      this.bursts.spawn(at(x, y, 2.4), gold, 4.5, 0.4, 4);
      for (let i = 0; i < 40; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 3;
        this.sparks.emit(
          at(x, y, 0.3 + Math.random() * 3),
          this.tmp.set(Math.cos(a) * sp, 2 + Math.random() * 5, Math.sin(a) * sp),
          gold,
          0.8 + Math.random() * 0.8,
          0.04,
          4,
          1.2,
          false,
        );
      }
    }
  }

  /** Effets des pouvoirs Patrimoine (faille, soupape, taches de lumière, promesse). */
  private onGearFx(kind: string, x: number, y: number, angle: number, size: number): void {
    const p = at(x, y);
    switch (kind) {
      case 'rift': {
        // Faille de la Dernière Traverse : sillon (size > 0), puis éclatement (size < 0).
        const len = pxToM(Math.abs(size));
        const fwd = dir(angle);
        const bang = size < 0;
        for (let i = 0; i <= 8; i += 1) {
          const q = p.clone().addScaledVector(fwd, (i / 8) * len);
          if (bang) {
            this.rings.spawn(q, 0xff8c2b, 0.1, 0.7, 0.3, 0.3, 0.3, 2.6);
            this.sparks.burst(q.setY(0.2), new THREE.Vector3(0, 1, 0), 4, 0xffb347, 5, 2, 0.4);
          } else this.puffs.dustRing(q, 2, 0.1, 0x6a4a3a, 1);
        }
        break;
      }
      case 'valve':
        this.rings.spawn(p, 0xfff2c0, 0.2, pxToM(size), 0.35, 0.25, 0.3, 2.6);
        this.puffs.dustRing(p, 14, pxToM(size) * 0.5, 0xd8d0e0, 4);
        break;
      case 'spot':
        this.rings.spawn(p, 0xff8c2b, 0.1, pxToM(size), 0.5, 0.4, 0.5, 2.8);
        break;
      case 'promise':
        this.rings.spawn(p, 0xffffff, 0.2, 1.2, 0.3, 0.3, 0.2, 2.6);
        this.bursts.spawn(at(x, y, 1.1), 0xfff2c0, 1.6, 0.2, 3);
        break;
      case 'promiseKept':
        this.rings.spawn(p, PATRIMOINE_GOLD, 0.2, 1.6, 0.5, 0.2, 0.2, 2.6);
        break;
    }
  }

  /**
   * Équipement porté → modèle du héros (GLB) : Casque, Gilet et Outil prennent la pièce de leur base,
   * avec un liseré de rareté (Homologué et au-delà) ; un emplacement vide garde la tenue de départ.
   */
  private syncGear(): void {
    const loot = this.world.loot;
    if (loot.version === this.gearVersion) return;
    this.gearVersion = loot.version;
    const eq = this.hero.equipment;
    if (!eq) return;
    for (const slot of VISIBLE_SLOTS) {
      const item = loot.loadout.equipped[slot];
      const piece = (item ? gearPieceFor(item) : null) ?? DEFAULT_GEAR[slot];
      const outline = item ? gearOutlineFor(item) : null;
      const key = `${piece}|${String(outline)}`;
      if (this.gearShown.get(slot) === key) continue;
      if (eq.attach(slot, piece, { outline })) this.gearShown.set(slot, key);
    }
  }

  private onSwing(
    combo: number,
    finisher: boolean,
    dashAttack: boolean,
    x: number,
    y: number,
    angle: number,
    reach: number,
  ): void {
    const yaw = yawFromAngle(angle);
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const left = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const pos = at(x, y);
    const r = pxToM(reach);
    const colors = { core: 0xfff6d8, edge: 0xff8a1a };
    if (finisher) {
      this.hero.punch([0.92, 1.1, 0.92]);
      const center = pos
        .clone()
        .add(this.tmp.set(0, 1.15, 0))
        .addScaledVector(fwd, 0.15);
      this.heroSmear.fire(
        center,
        new THREE.Vector3(0, 1, 0),
        fwd,
        -25,
        128,
        0.5,
        Math.max(1.6, r * 0.95),
        0.08,
        0.16,
        colors,
      );
      return;
    }
    const center = pos.clone().add(this.tmp.set(0, 1.0, 0));
    const tilt = combo === 0 ? 0.18 : -0.12;
    const v = left
      .clone()
      .multiplyScalar(Math.cos(tilt))
      .addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(tilt));
    const [p0, p1] = dashAttack ? [-60, 60] : combo === 0 ? [-120, 80] : [110, -85];
    this.heroSmear.fire(center, fwd, v, p0, p1, 0.45, r * 1.15 + 0.25, 0.08, 0.13, colors);
  }

  private onStrike(id: number, attack: string, x: number, y: number, angle: number): void {
    const fwd = dir(angle);
    if (attack === 'slam') {
      // Coup 3 du héros : onde de choc, débris et poussière, même à vide.
      const impact = at(x, y, 0.05);
      this.rings.spawn(impact, 0xff8a1a, 0.2, 2.6, 0.35, 0.22, 0.35, 2.4);
      this.rings.spawn(impact, 0xfff2c0, 0.1, 1.5, 0.18, 0.4, 0.6, 2.4);
      this.puffs.dustRing(impact, 14, 0.5, 0x5a5070, 4.5);
      for (let i = 0; i < 26; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 3 + Math.random() * 6;
        this.sparks.emit(
          impact.clone().setY(0.1),
          this.tmp.set(Math.sin(a) * sp, 3 + Math.random() * 6, Math.cos(a) * sp),
          i % 3 === 0 ? 0xffffff : 0xffa040,
          0.5 + Math.random() * 0.4,
          0.04,
        );
      }
      this.bursts.spawn(impact.clone().setY(0.5), 0xffd08a, 3.2, 0.2, 3);
      return;
    }
    const pos = at(x, y);
    if (attack === 'quickwin') {
      this.puffs.dustRing(pos, 8, 0.3, 0x3a8a8a, 3);
      this.rings.spawn(pos, PAL.danger, 0.2, 1.0, 0.25, 0.25, 0.2, 2.2);
      return;
    }
    const impact = pos.clone().addScaledVector(fwd, 0.7).setY(0.05);
    this.rings.spawn(impact, PAL.danger, 0.2, 1.2, 0.28, 0.25, 0.4, 2.6);
    this.sparks.burst(impact.clone().setY(0.2), fwd, 16, PAL.danger, 7, 1.6, 0.4, 0.035, 4);
    this.puffs.dustRing(impact, 8, 0.3, 0x5a4a70, 2.5);
    const center = pos
      .clone()
      .add(this.tmp.set(0, 1.25, 0))
      .addScaledVector(fwd, 0.1);
    const smear = this.enemySmears[id % this.enemySmears.length] ?? this.enemySmears[0];
    smear?.fire(center, new THREE.Vector3(0, 1, 0), fwd, -20, 130, 0.4, 1.3, 0.09, 0.14, {
      core: 0xffd3ec,
      edge: PAL.danger,
    });
  }

  // ─── Synchronisation et rendu ──────────────────────────────────────────────

  /** Met la vue à jour d'après le monde (`alpha` : interpolation entre deux pas). */
  public sync(alpha: number, realDt: number): void {
    const world = this.world;
    const simNow = world.now();
    const simDt = Math.max(0, (simNow - this.lastSimTime) / 1000);
    this.lastSimTime = simNow;
    this.time += simDt;

    // Héros
    this.hero.sync(world.hero, alpha, simDt, realDt);
    if (world.hero.state === 'dash') {
      this.ghostAt -= simDt * 1000;
      if (this.ghostAt <= 0) {
        this.ghostAt = 32;
        this.ghosts.spawn(this.hero.root, 0x6ff3ff, 0.26);
      }
      if (Math.random() < 0.6) {
        const back = dir(world.hero.dashAngle).multiplyScalar(-6);
        const p = this.hero.pos
          .clone()
          .add(
            this.tmp.set(
              (Math.random() - 0.5) * 0.5,
              0.2 + Math.random() * 1.2,
              (Math.random() - 0.5) * 0.5,
            ),
          );
        this.sparks.emit(p, back, 0x6ff3ff, 0.18, 0.025, 0, 2, false);
      }
    }

    // Ennemis : création à la volée, suivi de la sim, fin d'animation de mort après la sim.
    const frame: ActorFrame = { alpha, simDt, realDt, camera: this.camera, time: this.time };
    const alive = new Set<number>();
    for (const e of world.enemies) {
      alive.add(e.id);
      this.enemyView(e).update(e, frame);
    }
    for (const [id, v] of this.enemies) {
      if (alive.has(id)) continue;
      v.update(null, frame);
      if (v.finished) {
        v.dispose();
        this.enemies.delete(id);
      }
    }
    this.hazards.sync(world.hazards, this.time);
    this.projectiles.sync(world.projectiles.pool, alpha, simDt);
    this.pickups.sync(world.pickups, simDt, this.settings.reducedMotion);
    this.props.update();
    const loot = world.loot;
    this.loot.sync(loot.ground, simNow, simDt, loot.near?.id ?? null, loot.canTake);
    this.syncGear();

    // Effets (gelés pendant le hitstop, sauf secousse et nombres)
    this.sparks.update(simDt);
    this.puffs.update(simDt);
    this.glows.update(simDt);
    this.ghosts.update(simDt);
    this.rings.update(simDt);
    this.bursts.update(simDt, this.camera);
    this.heroSmear.update(simDt);
    for (const s of this.enemySmears) s.update(simDt);
    this.shake.update(realDt);
    this.room.update(this.time, this.hero.pos, realDt);
    if (this.dust)
      (
        (this.dust.material as THREE.ShaderMaterial).uniforms.uTime as THREE.IUniform<number>
      ).value = this.time;
    this.hurtVignette = Math.max(0, this.hurtVignette - realDt * 2.2);
    this.zoomPunch = Math.max(0, this.zoomPunch - realDt * 10);

    this.updateCamera(realDt);
    this.dmg.update(realDt, this.camera, this.width, this.height);
  }

  private enemyView(e: EnemySim): EnemyView {
    let v = this.enemies.get(e.id);
    if (!v) {
      v =
        this.options.enemyView?.(e, this.scene, this.settings.reducedMotion) ??
        createEnemyView(e.kind, this.scene, this.settings.reducedMotion, this);
      this.enemies.set(e.id, v);
    }
    return v;
  }

  private updateCamera(realDt: number): void {
    const heroPos = this.hero.pos;
    const target = this.tmp.copy(heroPos);
    // Légère avance vers la visée.
    if (this.hasAim) {
      const lead = this.aimPoint.clone().sub(heroPos).setY(0).clampLength(0, 3).multiplyScalar(0.3);
      target.add(lead);
    }
    // Bornée par la salle : on ne montre pas le vide au-delà des murs.
    const b = this.room.bounds;
    const aspect = this.camera.aspect;
    const dist = CAM_OFFSET.length();
    const halfW = dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect * 0.92;
    const minX = b.minX + halfW - 1.2;
    const maxX = b.maxX - halfW + 1.2;
    target.x = minX < maxX ? THREE.MathUtils.clamp(target.x, minX, maxX) : (b.minX + b.maxX) / 2;
    target.z = THREE.MathUtils.clamp(target.z, b.minZ + 2.6, b.maxZ - 2.4);
    this.camTarget.lerp(target, 1 - Math.exp(-5 * realDt));
    const off = this.shake.offset;
    this.camera.position.copy(this.camTarget).add(CAM_OFFSET).add(off);
    this.camera.lookAt(this.camTarget.x + off.x * 0.5, 0.6, this.camTarget.z - CAM_LOOK_BACK);
    const baseFov = this.camera.aspect < 1.2 ? FOV_PORTRAIT : FOV_LANDSCAPE;
    const fov = baseFov - ZOOM_PUNCH_DEG * Math.sin(this.zoomPunch * Math.PI);
    if (Math.abs(fov - this.camera.fov) > 1e-3) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  public render(realDt: number): void {
    // Compteurs cumulés sur toutes les passes de la frame (F3).
    this.renderer.info.reset();
    this.post.render(this.time, this.hurtVignette);
    this.frames += 1;
    this.fpsT += realDt;
    if (this.fpsT >= 0.5) {
      this.fps = this.frames / this.fpsT;
      this.frames = 0;
      this.fpsT = 0;
      // Résolution dynamique : sous 50 fps pendant 2 s, on baisse le pixel ratio par paliers.
      if (this.settings.quality.dynamicResolution && this.time > 3) {
        this.slowFor = this.fps < 50 ? this.slowFor + 0.5 : 0;
        const pr = this.renderer.getPixelRatio();
        if (this.slowFor >= 2 && pr > 0.75) {
          this.prCap = Math.max(0.75, pr - 0.25);
          this.slowFor = 0;
          this.resize(this.width, this.height);
        }
      }
    }
  }

  public stats(): ViewStats {
    const info = this.renderer.info;
    return {
      fps: this.fps,
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      pixelRatio: this.renderer.getPixelRatio(),
    };
  }

  /** Projette un point logique à l'écran (px CSS), pour l'UI DOM (bulles, marqueurs). */
  public toScreen(x: number, y: number, height: number): Vec2 {
    const v = at(x, y, height).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height };
  }

  public dispose(): void {
    for (const v of this.enemies.values()) v.dispose();
    this.enemies.clear();
    this.hazards.clear();
    this.pickups.clear();
    this.props.dispose();
    this.loot.dispose();
    this.projectiles.dispose();
    this.hero.dispose();
    this.room.dispose();
    this.dmg.clear();
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  // ─── Ambiance ──────────────────────────────────────────────────────────────

  /** Poussières en suspension, éclairées sous les suspensions (repris du prototype). */
  private makeDust(W: number, H: number): THREE.Points {
    const N = 500;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i += 1) {
      pos[i * 3] = Math.random() * W;
      pos[i * 3 + 1] = 0.2 + Math.random() * 4.5;
      pos[i * 3 + 2] = Math.random() * H;
      seed[i] = Math.random() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uW: { value: W } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime; uniform float uScale; uniform float uW;
        varying float vB;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.21 + aSeed) * 0.8 + uTime * 0.12;
          p.y += sin(uTime * 0.33 + aSeed * 1.7) * 0.4;
          p.z += cos(uTime * 0.17 + aSeed * 2.3) * 0.6;
          p.x = mod(p.x, uW);
          vB = 0.12 + 0.5 * fract(aSeed * 7.13);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.045 + fract(aSeed) * 0.04) * uScale / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        varying float vB;
        void main(){
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = 1.0 - smoothstep(0.3, 1.0, d);
          vec3 c = mix(vec3(0.45, 0.55, 1.0), vec3(1.0, 0.75, 0.45), vB) * vB;
          gl_FragColor = vec4(c * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(g, mat);
    p.frustumCulled = false;
    return p;
  }
}

function toneToKind(tone: 'info' | 'danger' | 'gold' | 'hero'): FloatKind {
  if (tone === 'danger') return 'danger';
  if (tone === 'gold') return 'gold';
  return 'info';
}
