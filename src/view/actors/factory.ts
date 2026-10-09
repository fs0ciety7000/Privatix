// Point unique de construction des vues d'ennemis : le jour où un GLB existe pour un type
// (public/models, tools/render3d), il suffit de le brancher ici derrière l'interface `ActorView`.
import type * as THREE from 'three';
import type { EnemyKind } from '@/config/balance';
import type { EnemyView } from '@/view/actors/ActorView';
import { AuditeurView } from '@/view/actors/AuditeurView';
import { BorneView } from '@/view/actors/BorneView';
import { ConsultantView } from '@/view/actors/ConsultantView';
import { DroneView } from '@/view/actors/DroneView';
import { ManagerView } from '@/view/actors/ManagerView';

export function createEnemyView(
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
