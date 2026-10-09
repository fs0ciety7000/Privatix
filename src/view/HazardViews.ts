// Zones de danger en 3D : décalques magenta au sol qui se remplissent pendant le télégraphe (cercle,
// couloir de KPI, voie de la rame), anneau du Reporting qui s'étend, rame qui traverse la voie.
// Lit `HazardSim` (sim) ; une vue par zone, libérée à la fin de la zone.
import * as THREE from 'three';
import type { HazardSim } from '@/sim/Hazards';
import { TRAIN_LENGTH } from '@/sim/Hazards';
import { pxToM, yawFromAngle } from '@/sim/units';
import type { GroundTelegraph } from '@/view/fx/effects';
import { DiscTelegraph, RectTelegraph } from '@/view/fx/effects';
import { glow, PAL, rboxGeo, toon } from '@/view/materials/toon';

const ANNULUS_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** Anneau d'épaisseur réglable (rayons normalisés au demi-côté du plan). */
const ANNULUS_FS = /* glsl */ `
uniform float uR;
uniform float uW;
uniform float uAlpha;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float d = abs(r - uR);
  float a = (1.0 - smoothstep(uW * 0.5, uW * 0.5 + 0.012, d)) * uAlpha;
  if (a <= 0.001) discard;
  gl_FragColor = vec4(uColor * a, a);
}`;

class Annulus {
  public readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;

  public constructor(private readonly radiusM: number) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: ANNULUS_VS,
      fragmentShader: ANNULUS_FS,
      uniforms: {
        uR: { value: 1 },
        uW: { value: 0.02 },
        uAlpha: { value: 1 },
        uColor: { value: new THREE.Color(PAL.danger).multiplyScalar(2.4) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const g = new THREE.PlaneGeometry(radiusM * 2, radiusM * 2).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.renderOrder = 6;
  }

  /** Rayon et épaisseur en mètres. */
  public set(radiusM: number, widthM: number, alpha: number): void {
    const u = this.mat.uniforms;
    (u.uR as THREE.IUniform<number>).value = radiusM / this.radiusM;
    (u.uW as THREE.IUniform<number>).value = widthM / this.radiusM;
    (u.uAlpha as THREE.IUniform<number>).value = alpha;
  }

  public dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

/** Rame qui traverse la voie (boîte claire, bande rouge, fenêtres émissives). */
function makeTrain(height: number): { group: THREE.Group; dispose: () => void } {
  const L = pxToM(TRAIN_LENGTH);
  const W = Math.max(0.8, height - 0.15);
  const group = new THREE.Group();
  const body = toon(0xd8dde3, { rimStrength: 0.6 });
  const stripe = toon(0xe0302a);
  const win = glow(0xfff0c0, 1.8);
  const geos = [
    rboxGeo(L, 2.6, W, 0.25),
    rboxGeo(L + 0.02, 0.22, W + 0.02, 0.05),
    new THREE.PlaneGeometry(0.9, 0.6),
  ];
  const [gBody, gStripe, gWin] = geos;
  if (!gBody || !gStripe || !gWin) throw new Error('géométrie de rame');
  const m = new THREE.Mesh(gBody, body);
  m.position.set(L / 2, 1.45, 0);
  m.castShadow = true;
  const s = new THREE.Mesh(gStripe, stripe);
  s.position.set(L / 2, 0.8, 0);
  group.add(m, s);
  for (let x = 0.9; x < L - 0.5; x += 1.4) {
    for (const z of [W / 2 + 0.01, -W / 2 - 0.01]) {
      const w = new THREE.Mesh(gWin, win);
      w.position.set(x, 1.85, z);
      w.rotation.y = z > 0 ? 0 : Math.PI;
      group.add(w);
    }
  }
  const nose = new THREE.Mesh(gWin, glow(0xffe08a, 4));
  nose.position.set(L + 0.01, 1.5, 0);
  nose.rotation.y = Math.PI / 2;
  group.add(nose);
  return {
    group,
    dispose: () => {
      for (const g of geos) g.dispose();
      body.dispose();
      stripe.dispose();
      win.dispose();
      (nose.material as THREE.Material).dispose();
    },
  };
}

class HazardView {
  private readonly decal: GroundTelegraph | null = null;
  private readonly ring: Annulus | null = null;
  private readonly train: { group: THREE.Group; dispose: () => void } | null = null;

  public constructor(
    private readonly scene: THREE.Scene,
    private readonly sim: HazardSim,
    private readonly reducedMotion: boolean,
  ) {
    const s = sim.spec;
    switch (s.kind) {
      case 'circle':
        this.decal = new DiscTelegraph(pxToM(s.radius), PAL.danger);
        this.decal.mesh.position.set(pxToM(s.x), 0.04, pxToM(s.y));
        break;
      case 'ring':
        this.ring = new Annulus(pxToM(s.maxRadius + s.thickness));
        this.ring.mesh.position.set(pxToM(s.x), 0.05, pxToM(s.y));
        if (s.telegraphMs > 0) {
          this.decal = new DiscTelegraph(pxToM(s.maxRadius), PAL.danger);
          this.decal.mesh.position.set(pxToM(s.x), 0.04, pxToM(s.y));
        }
        break;
      case 'band': {
        const len = s.x1 - s.x0;
        this.decal = new RectTelegraph(pxToM(s.height), pxToM(len), PAL.danger);
        this.decal.mesh.position.set(pxToM(s.x0), 0.05, pxToM(s.y + s.height / 2));
        this.decal.mesh.rotation.y = yawFromAngle(0);
        this.train = makeTrain(pxToM(s.height));
        this.train.group.position.set(pxToM(s.x0 - TRAIN_LENGTH), 0, pxToM(s.y + s.height / 2));
        this.train.group.visible = false;
        scene.add(this.train.group);
        break;
      }
      case 'line': {
        const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
        this.decal = new RectTelegraph(pxToM(s.width), Math.max(0.05, pxToM(len)), PAL.danger);
        this.decal.mesh.position.set(pxToM(s.x0), 0.04, pxToM(s.y0));
        this.decal.mesh.rotation.y = yawFromAngle(Math.atan2(s.y1 - s.y0, s.x1 - s.x0));
        break;
      }
    }
    if (this.decal) {
      this.decal.mesh.visible = true;
      scene.add(this.decal.mesh);
    }
    if (this.ring) scene.add(this.ring.mesh);
  }

  public update(time: number): void {
    const h = this.sim;
    const s = h.spec;
    const tele = h.telegraphing;
    const pulse = this.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(time * 14);
    switch (s.kind) {
      case 'circle': {
        if (!this.decal) return;
        if (tele) this.decal.set(h.progress, 1, time);
        else {
          const linger = s.lingerMs ?? 0;
          const a = h.after < linger ? 0.75 * pulse : Math.max(0, 1 - (h.after - linger) / 120);
          this.decal.set(1, a, time);
        }
        return;
      }
      case 'ring': {
        if (tele) {
          this.decal?.set(h.progress, 0.6, time);
          this.ring?.set(pxToM(s.maxRadius), 0.06, pulse);
        } else {
          if (this.decal) this.decal.mesh.visible = false;
          const k = Math.min(1, h.after / Math.max(1, s.expandMs));
          this.ring?.set(pxToM(h.ringRadius), pxToM(s.thickness), 1 - k * 0.5);
        }
        return;
      }
      case 'band': {
        if (!this.decal) return;
        this.decal.set(tele ? h.progress : 1, tele ? pulse : 0.5, time);
        if (this.train && h.trainActive) {
          this.train.group.visible = true;
          this.train.group.position.x = pxToM(h.trainX);
        }
        return;
      }
      case 'line': {
        if (!this.decal) return;
        const k = tele ? 1 : 0.45 * (1 - h.after / Math.max(1, s.lingerMs)) + 0.25;
        this.decal.set(tele ? h.progress : 1, tele ? 1 : k * 2, time);
        return;
      }
    }
  }

  public dispose(): void {
    this.decal?.dispose();
    this.ring?.dispose();
    if (this.train) {
      this.scene.remove(this.train.group);
      this.train.dispose();
    }
  }
}

/** Toutes les zones de danger visibles : une vue par `HazardSim`, créée et libérée à la volée. */
export class HazardViews {
  private readonly views = new Map<HazardSim, HazardView>();

  public constructor(
    private readonly scene: THREE.Scene,
    private readonly reducedMotion: boolean,
  ) {}

  public sync(hazards: readonly HazardSim[], time: number): void {
    const alive = new Set(hazards);
    for (const h of hazards) {
      let v = this.views.get(h);
      if (!v) {
        v = new HazardView(this.scene, h, this.reducedMotion);
        this.views.set(h, v);
      }
      v.update(time);
    }
    for (const [h, v] of this.views) {
      if (alive.has(h)) continue;
      v.dispose();
      this.views.delete(h);
    }
  }

  public clear(): void {
    for (const v of this.views.values()) v.dispose();
    this.views.clear();
  }
}
