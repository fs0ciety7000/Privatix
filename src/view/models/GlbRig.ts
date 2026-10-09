// Instance animée d'un personnage GLB : clone du gabarit (SkeletonUtils.clone, géométries partagées),
// matériaux du jeu (glbToon), contours en coque inversée, AnimationMixer avec fondus entre clips,
// lecture « calée » (scrub) sur un temps imposé par la simulation, événements du manifeste, os pilotés
// à l'exécution et sockets. Les vues (GlbEnemyView, GlbHeroView) décident QUEL clip jouer et à quel
// rythme ; cette classe ne connaît pas la simulation.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Flash } from '@/view/materials/toon';
import { outlinesOn } from '@/view/materials/toon';
import type { GlbUniforms } from '@/view/materials/glbToon';
import {
  GlbMaterialSet,
  glbSilhouetteMaterial,
  kindOf,
  makeGlbUniforms,
} from '@/view/materials/glbToon';
import type { ClipMeta, CharacterMeta } from '@/view/models/manifest';
import type { CharacterTemplate } from '@/view/models/ModelLibrary';

export interface GlbRigOpts {
  /** Flash de coup de la vue (partagé avec les uniformes du modèle). */
  readonly flash?: Flash;
  readonly reducedMotion: boolean;
  /** Épaisseur du contour (px écran). */
  readonly outlineWidth?: number;
  readonly rimStrength?: number;
  /** Événement de clip franchi (`active`, `land`, `glint`…, plus `step` synthétique en course). */
  readonly onEvent?: (event: string, clip: string) => void;
}

export interface PlayOpts {
  /** Durée du fondu enchaîné (s). */
  readonly fade?: number;
  /** Vitesse de lecture (1 = nominale). */
  readonly timeScale?: number;
  /** Repartir du début même si le clip est déjà en cours. */
  readonly restart?: boolean;
  /** Temps de départ (s). */
  readonly from?: number;
}

/** Clips de déplacement : un événement `step` à chaque demi-cycle (poussière, son de pas). */
const STEP_CLIPS = new Set(['run', 'walk']);

export class GlbRig {
  /** Racine du clone (à placer sous la racine de la vue). */
  public readonly object: THREE.Object3D;
  public readonly uniforms: GlbUniforms;
  public readonly materials: GlbMaterialSet;
  public readonly meta: CharacterMeta;
  public readonly mixer: THREE.AnimationMixer;
  /** Vitesse de rotation des os pilotés à l'exécution (rad/s autour de Y). */
  public spinRate = 1.2;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly bodies: THREE.SkinnedMesh[] = [];
  private readonly extraMeshes: THREE.Object3D[] = [];
  private readonly extraOwned: THREE.Material[] = [];
  private readonly runtimeBones: THREE.Object3D[] = [];
  private readonly sockets = new Map<string, THREE.Object3D>();
  private current: THREE.AnimationAction | null = null;
  private currentName = '';
  private eventPrev = 0;
  private readonly onEvent: ((event: string, clip: string) => void) | undefined;

  public constructor(tpl: CharacterTemplate, opts: GlbRigOpts) {
    this.meta = tpl.meta;
    this.onEvent = opts.onEvent;
    this.object = cloneSkinned(tpl.scene);
    this.object.name = `glb:${tpl.name}`;
    this.uniforms = makeGlbUniforms({
      rim: tpl.meta.rim,
      rimStrength: opts.rimStrength ?? (tpl.meta.kind === 'hero' ? 0.85 : 0.9),
      twinkle: !opts.reducedMotion,
      ...(opts.flash ? { flash: opts.flash } : {}),
    });
    this.materials = new GlbMaterialSet(
      this.uniforms,
      tpl.meta.outline,
      opts.outlineWidth ?? (tpl.meta.height > 3 ? 3.2 : 2.6),
    );
    this.object.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) this.bodies.push(o as THREE.SkinnedMesh);
      if (o.name.startsWith('socket_')) this.sockets.set(o.name, o);
    });
    this.toonify(this.object);
    for (const b of tpl.meta.runtimeBones) {
      const o = this.object.getObjectByName(b);
      if (o) this.runtimeBones.push(o);
    }
    this.mixer = new THREE.AnimationMixer(this.object);
    for (const clip of tpl.clips) {
      const a = this.mixer.clipAction(clip);
      if (!(tpl.meta.clips[clip.name]?.loop ?? false)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions.set(clip.name, a);
    }
  }

  /**
   * Remplace les matériaux importés (d'après leur nom) par ceux du personnage et ajoute la coque de
   * contour à côté de chaque maillage qui porte `_outline` (même géométrie, même squelette). Sert au
   * corps et à l'équipement. Renvoie les objets ajoutés (à retirer avec la pièce).
   */
  public toonify(root: THREE.Object3D): THREE.Object3D[] {
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.outline !== true) meshes.push(o as THREE.Mesh);
    });
    const added: THREE.Object3D[] = [];
    for (const mesh of meshes) {
      const src = mesh.material as THREE.Material;
      const kind = kindOf(src.name);
      mesh.material = this.materials.get(src.name);
      mesh.castShadow = kind !== 'glass';
      mesh.receiveShadow = kind === 'toon';
      // Les squelettes animés sortent de la boîte de repos : pas de culling par sphère englobante.
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      if (!outlinesOn() || kind !== 'toon' || !mesh.geometry.hasAttribute('_outline')) continue;
      const mat = this.materials.outlineMaterial();
      let o: THREE.Mesh;
      if (mesh instanceof THREE.SkinnedMesh) {
        const sk = mesh;
        const so = new THREE.SkinnedMesh(sk.geometry, mat);
        so.bind(sk.skeleton, sk.bindMatrix);
        o = so;
      } else o = new THREE.Mesh(mesh.geometry, mat);
      o.userData.outline = true;
      o.frustumCulled = false;
      o.castShadow = false;
      o.receiveShadow = false;
      o.renderOrder = 2;
      o.raycast = () => undefined;
      o.position.copy(mesh.position);
      o.quaternion.copy(mesh.quaternion);
      o.scale.copy(mesh.scale);
      mesh.parent?.add(o);
      added.push(o);
    }
    return added;
  }

  /** Silhouette tramée visible à travers les obstacles (héros). */
  public addSilhouette(): void {
    const mat = glbSilhouetteMaterial();
    for (const b of [...this.bodies]) {
      const s = new THREE.SkinnedMesh(b.geometry, mat);
      s.bind(b.skeleton, b.bindMatrix);
      s.renderOrder = 1;
      s.castShadow = false;
      s.frustumCulled = false;
      s.userData.outline = true;
      s.userData.silhouette = true;
      s.raycast = () => undefined;
      s.position.copy(b.position);
      s.quaternion.copy(b.quaternion);
      s.scale.copy(b.scale);
      b.parent?.add(s);
      this.extraMeshes.push(s);
    }
    this.extraOwned.push(mat);
  }

  /** Maillage skinné principal (corps), parent des vêtements skinnés. */
  public get body(): THREE.SkinnedMesh | null {
    return this.bodies[0] ?? null;
  }

  public socket(name: string): THREE.Object3D | null {
    return this.sockets.get(name) ?? this.object.getObjectByName(name) ?? null;
  }

  public bone(name: string): THREE.Object3D | null {
    return this.object.getObjectByName(name) ?? null;
  }

  // ─── Clips ─────────────────────────────────────────────────────────────────

  public has(clip: string): boolean {
    return this.actions.has(clip);
  }

  public clip(name: string): ClipMeta | undefined {
    return this.meta.clips[name];
  }

  /** Durée d'un clip (s), 0 s'il n'existe pas. */
  public duration(name: string): number {
    return this.actions.get(name)?.getClip().duration ?? 0;
  }

  /** Temps d'un événement du manifeste (s), ou `fallback`. */
  public eventAt(clip: string, event: string, fallback: number): number {
    const ms = this.meta.clips[clip]?.events[event];
    return ms === undefined ? fallback : ms / 1000;
  }

  public get playing(): string {
    return this.currentName;
  }

  /** Temps courant du clip joué (s). */
  public get time(): number {
    return this.current?.time ?? 0;
  }

  /** Le clip courant (non bouclé) est arrivé au bout. */
  public get finished(): boolean {
    const a = this.current;
    if (!a) return true;
    if (a.loop !== THREE.LoopOnce) return false;
    return a.time >= a.getClip().duration - 1e-3;
  }

  /**
   * Joue `name` en fondu enchaîné depuis le clip courant. Si c'est déjà le clip courant, seule la
   * vitesse change (sauf `restart`). Renvoie `false` si le clip n'existe pas.
   */
  public play(name: string, o: PlayOpts = {}): boolean {
    const next = this.actions.get(name);
    if (!next) return false;
    const ts = o.timeScale ?? 1;
    if (next === this.current && o.restart !== true) {
      next.paused = false;
      next.setEffectiveTimeScale(ts);
      return true;
    }
    const fade = o.fade ?? 0.12;
    next.reset();
    next.setEffectiveTimeScale(ts);
    next.setEffectiveWeight(1);
    if (o.from !== undefined) next.time = Math.min(o.from, next.getClip().duration);
    next.play();
    const prev = this.current;
    if (prev && prev !== next) {
      if (fade > 0) prev.crossFadeTo(next, fade, false);
      else prev.stop();
    } else if (fade > 0) next.fadeIn(fade);
    this.current = next;
    this.currentName = name;
    this.eventPrev = next.time - 1e-4;
    return true;
  }

  /**
   * Pose le clip `name` au temps `t` (s) imposé par la simulation (lecture figée, `timeScale` 0) :
   * c'est ainsi que le frame actif d'une attaque tombe exactement sur le frame actif de la sim.
   */
  public scrub(name: string, t: number, fade = 0.06): boolean {
    if (this.currentName !== name && !this.play(name, { fade, timeScale: 0 })) return false;
    const a = this.current;
    if (!a) return false;
    a.setEffectiveTimeScale(0);
    a.paused = false;
    a.time = THREE.MathUtils.clamp(t, 0, a.getClip().duration);
    return true;
  }

  /** Avance les animations (temps de jeu : nul pendant le hitstop). */
  public update(dt: number, time: number): void {
    this.uniforms.uTime.value = time;
    for (const b of this.runtimeBones) b.rotation.y += dt * this.spinRate;
    // Pendant le hitstop (dt nul), la pose reste figée ; un clip calé (scrub) est quand même réappliqué.
    this.mixer.update(Math.max(0, dt));
    this.fireEvents();
  }

  private fireEvents(): void {
    const a = this.current;
    if (!a || !this.onEvent) return;
    const name = this.currentName;
    const dur = a.getClip().duration;
    const t = a.time;
    const prev = this.eventPrev;
    this.eventPrev = t;
    if (t === prev) return;
    const events = this.meta.clips[name]?.events ?? {};
    const crossed = (at: number): boolean =>
      t >= prev ? at > prev && at <= t : at > prev || at <= t; // boucle : on a repassé par 0
    for (const [e, ms] of Object.entries(events)) if (crossed(ms / 1000)) this.onEvent(e, name);
    if (STEP_CLIPS.has(name) && (crossed(dur * 0.25) || crossed(dur * 0.75)))
      this.onEvent('step', name);
  }

  /** Arrête tout et revient à la pose de repos (avant un nouveau clip forcé). */
  public stopAll(): void {
    this.mixer.stopAllAction();
    this.current = null;
    this.currentName = '';
  }

  /** Objets ajoutés hors du clone (silhouette), retirés au dispose. */
  public track(o: THREE.Object3D): void {
    this.extraMeshes.push(o);
  }

  public dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.object);
    const skeletons = new Set<THREE.Skeleton>();
    this.object.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) skeletons.add(o.skeleton);
    });
    for (const s of skeletons) s.dispose();
    for (const o of this.extraMeshes) o.removeFromParent();
    this.object.removeFromParent();
    this.materials.dispose();
    for (const m of this.extraOwned) m.dispose();
  }
}
