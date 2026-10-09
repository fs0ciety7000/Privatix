// Point unique de construction des vues de personnages. Un GLB (public/models, tools/render3d) est
// utilisé quand la bibliothèque de modèles l'a chargé ; sinon (bibliothèque absente avec `?procedural`,
// fichier manquant ou en échec), on retombe sur le modèle procédural, derrière la même interface.
import type * as THREE from 'three';
import type { EnemyKind } from '@/config/balance';
import type { ActorFxSink, EnemyView, HeroActorView } from '@/view/actors/ActorView';
import { AuditeurView } from '@/view/actors/AuditeurView';
import { BorneView } from '@/view/actors/BorneView';
import { ConsultantView } from '@/view/actors/ConsultantView';
import { DroneView } from '@/view/actors/DroneView';
import { ENEMY_CLIPS } from '@/view/actors/actorClips';
import { GlbEnemyView } from '@/view/actors/GlbEnemyView';
import { GlbHeroView } from '@/view/actors/GlbHeroView';
import { HeroView } from '@/view/actors/HeroView';
import { ManagerView } from '@/view/actors/ManagerView';
import { modelLibrary } from '@/view/models/ModelLibrary';

export function createEnemyView(
  kind: EnemyKind,
  scene: THREE.Scene,
  reducedMotion: boolean,
  fx: ActorFxSink | null = null,
): EnemyView {
  const map = ENEMY_CLIPS[kind];
  const tpl = modelLibrary()?.character(map.model) ?? null;
  if (tpl) {
    try {
      return new GlbEnemyView(tpl, map, scene, reducedMotion, fx);
    } catch (e) {
      console.warn(`[modèles] ${kind} : GLB inutilisable, repli procédural :`, e);
    }
  }
  return createProceduralEnemyView(kind, scene, reducedMotion);
}

export function createProceduralEnemyView(
  kind: EnemyKind,
  scene: THREE.Scene,
  reducedMotion: boolean,
): EnemyView {
  switch (kind) {
    case 'borne':
      return new BorneView(scene, reducedMotion);
    case 'drone':
      return new DroneView(scene, reducedMotion);
    case 'manager':
      return new ManagerView(scene, reducedMotion);
    case 'auditeur':
      return new AuditeurView(scene, reducedMotion);
    case 'consultant':
      return new ConsultantView(scene, reducedMotion);
  }
}

/** Vue du héros : GLB équipé (casque, gilet, clé) si chargé, sinon le héros procédural. */
export function createHeroView(
  reducedMotion: boolean,
  fx: ActorFxSink | null = null,
): HeroActorView {
  const lib = modelLibrary();
  const tpl = lib?.character('hero') ?? null;
  if (lib && tpl) {
    try {
      return new GlbHeroView(tpl, lib, reducedMotion, fx);
    } catch (e) {
      console.warn('[modèles] héros : GLB inutilisable, repli procédural :', e);
    }
  }
  return new HeroView(reducedMotion);
}
