// Contrat d'une vue de personnage 3D : la scène et `GameView` ne connaissent que ces interfaces.
// Deux implémentations derrière la même interface : un GLB skinné (tools/render3d, public/models ;
// `GlbEnemyView`, `GlbHeroView`) quand le modèle est chargé, sinon le modèle procédural repris du
// prototype validé (repli, ou `?procedural`). Choix dans `factory.ts`, sans toucher à la simulation.
import type * as THREE from 'three';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import type { HeroSim } from '@/sim/hero/HeroSim';
import type { EquipSlot } from '@/view/models/manifest';
import type { V3 } from '@/view/rig';

/** Temps et caméra d'une frame de vue. */
export interface ActorFrame {
  /** Interpolation entre deux pas de simulation (0..1). */
  readonly alpha: number;
  /** Temps de jeu écoulé (s), nul pendant le hitstop. */
  readonly simDt: number;
  /** Temps réel écoulé (s). */
  readonly realDt: number;
  readonly camera: THREE.Camera;
  /** Horloge de la vue (s, temps de jeu). */
  readonly time: number;
}

/** Vue d'un acteur piloté par un état de simulation `S`. */
export interface ActorView<S> {
  /** Racine du modèle (position et orientation au sol). */
  readonly root: THREE.Object3D;
  /** Position affichée (interpolée), au sol (m). */
  readonly pos: THREE.Vector3;
  /** Animation de mort terminée : la vue peut être libérée. */
  readonly finished: boolean;
  /** Coup reçu : flash et squash. */
  hit(heavy: boolean): void;
  /** Mort : le corps est projeté dans la direction `angle` (logique). */
  die(angle: number): void;
  /** Pose d'après la simulation, ou poursuite de l'animation de mort si `sim` est `null`. */
  update(sim: S | null, frame: ActorFrame): void;
  dispose(): void;
}

export type EnemyView = ActorView<EnemySim>;

/**
 * Événements visuels émis par l'animation d'un modèle (manifeste : `land`, `glint`, `active`… ; plus
 * `step` à chaque pas de course). `GameView` les traduit en effets (poussière, éclat).
 */
export interface ActorFxSink {
  /** `at` : position monde de l'événement ; `size` : échelle du personnage (m de hauteur). */
  actorEvent(event: string, at: THREE.Vector3, size: number): void;
}

/** Emplacements d'équipement du héros (sockets du contrat SKELETON.md § 3 et § 6). */
export type { EquipSlot };

/**
 * Équipement visible du héros, pour l'agent loot. `attach` remplace la pièce du même emplacement ;
 * l'identifiant est une clé de `items` dans `public/models/manifest.json` (`casque_chantier`,
 * `gilet_hv`, `cle_tire_fond`…). Sans effet (et `false`) si le héros est procédural ou si la pièce
 * n'existe pas ou ne correspond pas à l'emplacement.
 */
export interface HeroEquipment {
  attach(slot: EquipSlot, pieceId: string): boolean;
  detach(slot: EquipSlot): void;
  /** Pièce portée sur chaque emplacement (ou `null`). */
  readonly equipped: Readonly<Record<EquipSlot, string | null>>;
}

/** Vue du héros : piloté par `HeroSim` (interpolation, orientation, animation, flash). */
export interface HeroActorView {
  readonly root: THREE.Object3D;
  readonly pos: THREE.Vector3;
  /** Orientation affichée (rotation Y du modèle). */
  readonly facingYaw: number;
  /** Équipement (GLB seulement). */
  readonly equipment: HeroEquipment | null;
  /** Impulsion de squash & stretch. */
  punch(s: V3): void;
  /** Coup reçu : flash rouge et squash. */
  hurt(): void;
  sync(sim: HeroSim, alpha: number, simDt: number, realDt: number): void;
  dispose(): void;
}
