// Télégraphes au sol génériques : un décalque magenta à la forme exacte de la hitbox logique
// (secteur, couloir, disque), avec un front qui avance au rythme du windup. Les maillages sont mis en
// cache par forme (un ennemi réutilise les siens d'une attaque à l'autre, sans recompiler de shader).
import type * as THREE from 'three';
import type { Telegraph } from '@/sim/enemies/EnemySim';
import { pxToM, yawFromAngle } from '@/sim/units';
import type { GroundTelegraph } from '@/view/fx/effects';
import { ArcTelegraph, DiscTelegraph, RectTelegraph } from '@/view/fx/effects';
import { PAL } from '@/view/materials/toon';

export class TelegraphPainter {
  private readonly cache = new Map<string, GroundTelegraph>();
  private current: GroundTelegraph | null = null;

  public constructor(private readonly scene: THREE.Scene) {}

  private get(key: string, make: () => GroundTelegraph): GroundTelegraph {
    let t = this.cache.get(key);
    if (!t) {
      t = make();
      this.scene.add(t.mesh);
      this.cache.set(key, t);
    }
    return t;
  }

  /** Affiche `tele` (ou rien) ; `progress` : remplissage 0..1 ; `alpha` : opacité 0..1. */
  public show(tele: Telegraph | null, progress: number, alpha: number, time: number): void {
    let next: GroundTelegraph | null = null;
    if (tele) {
      switch (tele.kind) {
        case 'arc':
          next = this.get(`a${String(tele.reach)}:${String(tele.arcDeg)}`, () => {
            return new ArcTelegraph(pxToM(tele.reach), tele.arcDeg, PAL.danger);
          });
          next.mesh.rotation.y = yawFromAngle(tele.angle);
          break;
        case 'line':
          next = this.get(`l${String(tele.width)}:${String(tele.length)}`, () => {
            return new RectTelegraph(pxToM(tele.width), pxToM(tele.length), PAL.danger);
          });
          next.mesh.rotation.y = yawFromAngle(tele.angle);
          break;
        case 'circle':
          next = this.get(`c${String(tele.radius)}`, () => {
            return new DiscTelegraph(pxToM(tele.radius), PAL.danger);
          });
          break;
      }
      next.mesh.position.set(pxToM(tele.x), next.mesh.position.y, pxToM(tele.y));
      next.set(Math.min(1, progress), Math.min(1, alpha), time);
    }
    if (this.current && this.current !== next) this.current.mesh.visible = false;
    if (next) next.mesh.visible = true;
    this.current = next;
  }

  public hide(): void {
    if (this.current) this.current.mesh.visible = false;
    this.current = null;
  }

  public dispose(): void {
    for (const t of this.cache.values()) t.dispose();
    this.cache.clear();
    this.current = null;
  }
}
