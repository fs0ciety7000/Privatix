// Contrat d'une vue de personnage 3D : la scène et `GameView` ne connaissent que cette interface.
// Aujourd'hui, chaque personnage est un modèle procédural (pièces rigides sur un squelette, repris du
// prototype validé) ; demain, un GLB skinné (tools/render3d, public/models) prendra la place derrière
// la même interface, sans toucher à la simulation ni à `GameView` (voir `createEnemyView`).
import type * as THREE from 'three';
import type { EnemySim } from '@/sim/enemies/EnemySim';

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
