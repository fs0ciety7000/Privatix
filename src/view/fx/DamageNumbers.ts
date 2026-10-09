// Nombres de dégâts et textes flottants : éléments DOM en pool, projetés depuis le monde 3D.
// Repris du prototype ; un passage en quads WebGL instanciés est prévu (plan § 4.7).
import * as THREE from 'three';

export type FloatKind = 'normal' | 'big' | 'crit' | 'hurt' | 'info' | 'gold' | 'danger';

interface FloatItem {
  readonly el: HTMLDivElement;
  readonly pos: THREE.Vector3;
  t: number;
  dur: number;
  vx: number;
  alive: boolean;
}

export class DamageNumbers {
  private readonly pool: FloatItem[] = [];
  private readonly v = new THREE.Vector3();

  public constructor(host: HTMLElement, size = 40) {
    for (let i = 0; i < size; i += 1) {
      const el = document.createElement('div');
      el.className = 'dmg';
      el.style.display = 'none';
      host.appendChild(el);
      this.pool.push({ el, pos: new THREE.Vector3(), t: 0, dur: 0.9, vx: 0, alive: false });
    }
  }

  public spawn(pos: THREE.Vector3, text: string, kind: FloatKind): void {
    const it = this.pool.find((p) => !p.alive) ?? this.pool[0];
    if (!it) return;
    const isText = kind === 'info' || kind === 'gold' || kind === 'danger';
    it.alive = true;
    it.t = 0;
    it.dur = isText ? 1.3 : 0.9;
    it.pos.copy(pos);
    it.vx = isText ? 0 : (Math.random() - 0.5) * 1.2;
    it.el.textContent = text;
    it.el.className = `dmg dmg-${kind}`;
    it.el.style.display = 'block';
  }

  public update(dt: number, cam: THREE.Camera, w: number, h: number): void {
    for (const it of this.pool) {
      if (!it.alive) continue;
      it.t += dt;
      const k = it.t / it.dur;
      if (k >= 1) {
        it.alive = false;
        it.el.style.display = 'none';
        continue;
      }
      this.v.copy(it.pos);
      this.v.y += 0.6 + 1.4 * (1 - (1 - k) * (1 - k));
      this.v.x += it.vx * k;
      this.v.project(cam);
      const x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * h;
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.9 : 1.5 - Math.min(0.5, (k - 0.12) * 2.5);
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${pop.toFixed(3)})`;
      it.el.style.opacity = k > 0.7 ? String(1 - (k - 0.7) / 0.3) : '1';
    }
  }

  public clear(): void {
    for (const it of this.pool) {
      it.alive = false;
      it.el.style.display = 'none';
    }
  }
}
