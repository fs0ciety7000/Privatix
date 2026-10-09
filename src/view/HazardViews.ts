// Zones de danger en 3D : décalques magenta au sol qui se remplissent pendant le télégraphe (cercle,
// dalle, couloir, faisceaux), anneau qui s'étend (avec sa brèche pour le grand discours), rame ou
// cloison mobile qui traverse sa bande, nuage de puanteur (vert : il ne blesse pas, il n'est donc
// jamais magenta), bulles des promesses, bulletins, taches de la Piste de danse. Lit `HazardSim` (sim) ;
// une vue par zone, libérée à la fin de la zone. Aucun clignotement en Réduction des mouvements.
import * as THREE from 'three';
import type { HazardSim } from '@/sim/Hazards';
import { TRAIN_LENGTH } from '@/sim/Hazards';
import { pxToM, yawFromAngle } from '@/sim/units';
import type { GroundTelegraph } from '@/view/fx/effects';
import { DiscTelegraph, RectTelegraph } from '@/view/fx/effects';
import { glow, PAL, radialTexture, rboxGeo, sphereGeo, toon } from '@/view/materials/toon';

const ANNULUS_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** Anneau d'épaisseur réglable (rayons normalisés au demi-côté du plan), avec une brèche facultative. */
const ANNULUS_FS = /* glsl */ `
uniform float uR;
uniform float uW;
uniform float uAlpha;
uniform float uGap;
uniform float uGapAngle;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float d = abs(r - uR);
  float a = (1.0 - smoothstep(uW * 0.5, uW * 0.5 + 0.012, d)) * uAlpha;
  if (uGap > 0.0) {
    // Angle logique : x vers la droite, y logique = +z = -v.
    float ang = atan(-p.y, p.x);
    float dg = abs(mod(ang - uGapAngle + 3.14159265, 6.2831853) - 3.14159265);
    a *= smoothstep(uGap, uGap + 0.05, dg);
  }
  if (a <= 0.001) discard;
  gl_FragColor = vec4(uColor * a, a);
}`;

export class Annulus {
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
        uGap: { value: 0 },
        uGapAngle: { value: 0 },
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

  /** Rayon et épaisseur en mètres ; brèche (demi-ouverture et angle, rad). */
  public set(radiusM: number, widthM: number, alpha: number, gapHalf = 0, gapAngle = 0): void {
    const u = this.mat.uniforms;
    (u.uR as THREE.IUniform<number>).value = radiusM / this.radiusM;
    (u.uW as THREE.IUniform<number>).value = widthM / this.radiusM;
    (u.uAlpha as THREE.IUniform<number>).value = alpha;
    (u.uGap as THREE.IUniform<number>).value = gapHalf;
    (u.uGapAngle as THREE.IUniform<number>).value = gapAngle;
  }

  public dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

interface Mover {
  readonly group: THREE.Group;
  dispose(): void;
}

/** Rame qui traverse la voie (boîte claire, bande rouge, fenêtres émissives). */
function makeTrain(height: number): Mover {
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
  const noseMat = glow(0xffe08a, 4);
  const nose = new THREE.Mesh(gWin, noseMat);
  nose.position.set(L + 0.01, 1.5, 0);
  nose.rotation.y = Math.PI / 2;
  group.add(nose);
  return {
    group,
    dispose: () => {
      // rboxGeo est en cache partagé : seul le plan des fenêtres est propre à la rame.
      gWin.dispose();
      body.dispose();
      stripe.dispose();
      win.dispose();
      noseMat.dispose();
    },
  };
}

/** Cloison mobile du BAG : une rangée de panneaux de verre dépoli sur un rail. */
function makePartition(height: number): Mover {
  const L = pxToM(TRAIN_LENGTH);
  const W = Math.max(0.6, height * 0.5);
  const group = new THREE.Group();
  const frame = toon(0x3a3f5c, { rimStrength: 0.6 });
  const glass = toon(0xcfe6ff, {
    transparent: true,
    opacity: 0.55,
    rimStrength: 0.8,
    rim: 0x6ff3ff,
  });
  const sticker = glow(0xb05cff, 1.4);
  const plane = new THREE.PlaneGeometry(0.5, 0.18);
  for (let x = 0.2; x < L - 0.2; x += 1.25) {
    const pane = new THREE.Mesh(rboxGeo(1.18, 1.9, 0.08, 0.02), glass);
    pane.position.set(x + 0.6, 1.0, 0);
    const top = new THREE.Mesh(rboxGeo(1.24, 0.08, 0.14, 0.02), frame);
    top.position.set(x + 0.6, 1.98, 0);
    const foot = new THREE.Mesh(rboxGeo(1.24, 0.1, W, 0.03), frame);
    foot.position.set(x + 0.6, 0.05, 0);
    const label = new THREE.Mesh(plane, sticker);
    label.position.set(x + 0.6, 1.3, 0.05);
    group.add(pane, top, foot, label);
  }
  return {
    group,
    dispose: () => {
      plane.dispose();
      frame.dispose();
      glass.dispose();
      sticker.dispose();
    },
  };
}

/** Matériaux partagés des habillages (créés à la demande, libérés avec `HazardViews`). */
class SkinKit {
  private mats = new Map<string, THREE.Material>();
  private geos = new Map<string, THREE.BufferGeometry>();

  public mat(key: string, make: () => THREE.Material): THREE.Material {
    let m = this.mats.get(key);
    if (!m) {
      m = make();
      this.mats.set(key, m);
    }
    return m;
  }

  public geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.geos.get(key);
    if (!g) {
      g = make();
      this.geos.set(key, g);
    }
    return g;
  }

  public dispose(): void {
    for (const m of this.mats.values()) m.dispose();
    for (const g of this.geos.values()) g.dispose();
    this.mats.clear();
    this.geos.clear();
  }
}

class HazardView {
  private readonly decals: GroundTelegraph[] = [];
  private readonly ring: Annulus | null = null;
  private readonly mover: Mover | null = null;
  /** Habillage au-dessus du décalque (bulle, bulletin, tache de lumière, nuage, faisceaux, trou). */
  private readonly deco = new THREE.Group();
  private readonly beams: THREE.Mesh[] = [];
  private readonly puffs: THREE.Sprite[] = [];
  private hole: THREE.Mesh | null = null;
  private readonly seed = Math.random() * 10;

  public constructor(
    private readonly scene: THREE.Scene,
    private readonly sim: HazardSim,
    private readonly reducedMotion: boolean,
    kit: SkinKit,
  ) {
    const s = sim.spec;
    switch (s.kind) {
      case 'circle': {
        const d = new DiscTelegraph(pxToM(s.radius), PAL.danger);
        this.decals.push(d);
        const skin = s.skin ?? 'default';
        if (skin === 'promise') {
          // Bulle dorée (la promesse) : se crève d'un coup.
          const bubble = new THREE.Mesh(
            sphereGeo(20),
            kit.mat('promise', () =>
              toon(0xffd76a, {
                transparent: true,
                opacity: 0.72,
                emissive: 0xffb020,
                emissiveIntensity: 0.55,
                rimStrength: 1,
                rim: 0xfff2c0,
              }),
            ),
          );
          bubble.scale.setScalar(pxToM(24) * 0.75);
          bubble.position.y = 0.9;
          bubble.name = 'bob';
          const shine = new THREE.Mesh(
            sphereGeo(10),
            kit.mat('shine', () => glow(0xffffff, 2.2)),
          );
          shine.scale.setScalar(0.09);
          shine.position.set(-0.18, 1.12, 0.22);
          shine.name = 'bob';
          this.deco.add(bubble, shine);
        } else if (skin === 'ballot') {
          const sheet = new THREE.Mesh(
            kit.geo('sheet', () => new THREE.PlaneGeometry(0.34, 0.46)),
            kit.mat(
              'sheet',
              () => new THREE.MeshBasicMaterial({ color: 0xf4f0e6, side: THREE.DoubleSide }),
            ),
          );
          sheet.name = 'fall';
          this.deco.add(sheet);
        } else if (skin === 'spot') {
          // Tache de lumière de la boule : couleur douce en orbite, puis magenta une fois figée.
          const light = new THREE.Mesh(
            kit.geo('spot', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
            new THREE.MeshBasicMaterial({
              map: radialTexture(),
              color: new THREE.Color(0xfff4d0).multiplyScalar(1.6),
              transparent: true,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          light.scale.setScalar(pxToM(s.radius) * 3);
          light.position.y = 0.03;
          light.name = 'spot';
          this.deco.add(light);
        } else if (skin === 'chart') {
          // Pilier-graphique : trois barres qui montent avec le télégraphe.
          const bar = kit.geo('bar', () =>
            new THREE.BoxGeometry(0.22, 1, 0.22).translate(0, 0.5, 0),
          );
          const cols = [0x6ff3ff, 0xb05cff, 0xffd200];
          cols.forEach((c, i) => {
            const m = new THREE.Mesh(
              bar,
              kit.mat(`bar${String(i)}`, () => glow(c, 1.6)),
            );
            m.position.set((i - 1) * 0.3, 0, 0);
            m.name = 'bar';
            this.deco.add(m);
          });
        }
        break;
      }
      case 'square': {
        const side = pxToM(s.half * 2);
        const d = new RectTelegraph(side, side, PAL.danger);
        d.mesh.rotation.y = yawFromAngle(Math.PI / 2);
        this.decals.push(d);
        if (s.voidFall) {
          // La dalle s'ouvre sur le vide : un trou sombre (visible après l'impact).
          this.hole = new THREE.Mesh(
            kit.geo('hole', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
            kit.mat('hole', () => new THREE.MeshBasicMaterial({ color: 0x050310 })),
          );
          this.hole.scale.set(side * 0.94, 1, side * 0.94);
          this.hole.position.set(pxToM(s.x), 0.02, pxToM(s.y));
          this.hole.visible = false;
          scene.add(this.hole);
        }
        break;
      }
      case 'ring':
        this.ring = new Annulus(pxToM(s.maxRadius + s.thickness));
        this.ring.mesh.position.set(pxToM(s.x), 0.05, pxToM(s.y));
        if (s.telegraphMs > 0) {
          const d = new DiscTelegraph(pxToM(s.maxRadius), PAL.danger);
          this.decals.push(d);
        }
        break;
      case 'band': {
        const len = s.x1 - s.x0;
        const d = new RectTelegraph(pxToM(s.height), pxToM(len), PAL.danger);
        d.mesh.position.set(pxToM(s.x0), 0.05, pxToM(s.y + s.height / 2));
        d.mesh.rotation.y = yawFromAngle(0);
        this.decals.push(d);
        this.mover =
          s.skin === 'cloison' ? makePartition(pxToM(s.height)) : makeTrain(pxToM(s.height));
        this.mover.group.position.set(pxToM(s.x0 - TRAIN_LENGTH), 0, pxToM(s.y + s.height / 2));
        this.mover.group.visible = false;
        scene.add(this.mover.group);
        break;
      }
      case 'line': {
        const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
        const yaw = yawFromAngle(Math.atan2(s.y1 - s.y0, s.x1 - s.x0));
        const parts: [number, number][] =
          s.gapFrom !== undefined && s.gapTo !== undefined
            ? [
                [0, s.gapFrom],
                [s.gapTo, 1],
              ]
            : [[0, 1]];
        for (const [a, b] of parts) {
          if (b - a <= 0.001) continue;
          const d = new RectTelegraph(
            pxToM(s.width),
            Math.max(0.05, pxToM(len * (b - a))),
            PAL.danger,
          );
          d.mesh.position.set(
            pxToM(s.x0 + (s.x1 - s.x0) * a),
            0.04,
            pxToM(s.y0 + (s.y1 - s.y0) * a),
          );
          d.mesh.rotation.y = yaw;
          this.decals.push(d);
        }
        break;
      }
      case 'beams': {
        const beamGeo = kit.geo(`beam${String(s.length)}`, () =>
          new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5),
        );
        for (let i = 0; i < s.count; i += 1) {
          const d = new RectTelegraph(pxToM(s.width), pxToM(s.length), PAL.danger);
          this.decals.push(d);
          const beam = new THREE.Mesh(
            beamGeo,
            kit.mat('laser', () => glow(PAL.danger, 3.2, { transparent: true, opacity: 0.9 })),
          );
          beam.scale.set(pxToM(s.width) * 0.5, 0.06, pxToM(s.length));
          beam.position.y = 0.55;
          beam.visible = false;
          this.beams.push(beam);
          this.deco.add(beam);
        }
        break;
      }
      case 'cloud': {
        // Puanteur : volutes vertes, jamais magenta (elles ne blessent pas).
        const mat = kit.mat(
          'stink',
          () =>
            new THREE.SpriteMaterial({
              map: radialTexture(),
              color: 0xa8e64a,
              transparent: true,
              opacity: 0.6,
              depthWrite: false,
            }),
        );
        for (let i = 0; i < 6; i += 1) {
          const sp = new THREE.Sprite(mat as THREE.SpriteMaterial);
          this.puffs.push(sp);
          this.deco.add(sp);
        }
        const ground = new THREE.Mesh(
          kit.geo('spot', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
          kit.mat(
            'stinkGround',
            () =>
              new THREE.MeshBasicMaterial({
                map: radialTexture(),
                color: new THREE.Color(0x4e5a2a).multiplyScalar(1.4),
                transparent: true,
                opacity: 0.7,
                depthWrite: false,
              }),
          ),
        );
        ground.position.y = 0.02;
        ground.name = 'ground';
        this.deco.add(ground);
        break;
      }
    }
    for (const d of this.decals) {
      d.mesh.visible = true;
      scene.add(d.mesh);
    }
    if (this.ring) scene.add(this.ring.mesh);
    scene.add(this.deco);
  }

  public update(time: number): void {
    const h = this.sim;
    const s = h.spec;
    const tele = h.telegraphing;
    const pulse = this.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(time * 14);
    const decal = this.decals[0];
    switch (s.kind) {
      case 'circle': {
        if (!decal) return;
        decal.mesh.position.set(pxToM(h.x), 0.04, pxToM(h.y));
        this.deco.position.set(pxToM(h.x), 0, pxToM(h.y));
        const skin = s.skin ?? 'default';
        if (tele) {
          // Tache en orbite : contour seul (le remplissage commence une fois figée).
          decal.set(h.progress, skin === 'spot' && h.progress <= 0 ? 0.7 : 1, time);
        } else {
          const linger = s.lingerMs ?? 0;
          const a = h.after < linger ? 0.75 * pulse : Math.max(0, 1 - (h.after - linger) / 120);
          decal.set(1, a, time);
        }
        for (const c of this.deco.children) {
          if (c.name === 'bob') c.position.y += Math.sin(time * 3 + this.seed) * 0.002;
          if (c.name === 'fall') {
            const k = h.progress;
            c.position.set(0, 0.05 + (1 - k) * 3.2, 0);
            c.rotation.set(-Math.PI / 2 + (1 - k) * 1.2, (1 - k) * 4 + this.seed, (1 - k) * 2);
            c.visible = tele;
          }
          if (c.name === 'spot') {
            const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
            const fixed = h.progress > 0 || !tele;
            m.color.setHex(fixed ? PAL.danger : 0xfff4d0).multiplyScalar(fixed ? 1.4 : 1.6);
            c.visible = tele;
          }
          if (c.name === 'bar') c.scale.y = Math.max(0.05, h.progress * 1.8);
        }
        if (!tele && (skin === 'promise' || skin === 'ballot' || skin === 'chart'))
          this.deco.visible = false;
        return;
      }
      case 'square': {
        if (!decal) return;
        decal.mesh.position.set(pxToM(s.x), 0.04, pxToM(s.y - s.half));
        if (tele) decal.set(h.progress, 1, time);
        else {
          const open = h.after < s.lingerMs;
          decal.set(1, open ? 0.65 : Math.max(0, 1 - (h.after - s.lingerMs) / 120), time);
          if (this.hole) this.hole.visible = open;
        }
        return;
      }
      case 'ring': {
        decal?.mesh.position.set(pxToM(s.x), 0.04, pxToM(s.y));
        const gap = s.gapDeg ? (s.gapDeg * Math.PI) / 360 : 0;
        if (tele) {
          decal?.set(h.progress, 0.6, time);
          this.ring?.set(pxToM(s.maxRadius), 0.06, pulse, gap, h.angle);
        } else {
          if (decal) decal.mesh.visible = false;
          const k = Math.min(1, h.after / Math.max(1, s.expandMs));
          this.ring?.set(pxToM(h.ringRadius), pxToM(s.thickness), 1 - k * 0.5, gap, h.angle);
        }
        return;
      }
      case 'band': {
        if (!decal) return;
        decal.set(tele ? h.progress : 1, tele ? pulse : 0.5, time);
        if (this.mover && h.trainActive) {
          this.mover.group.visible = true;
          this.mover.group.position.x = pxToM(h.trainX);
        }
        return;
      }
      case 'line': {
        const k = tele ? 1 : 0.45 * (1 - h.after / Math.max(1, s.lingerMs)) + 0.25;
        for (const d of this.decals) d.set(tele ? h.progress : 1, tele ? 1 : k * 2, time);
        return;
      }
      case 'beams': {
        this.deco.position.set(pxToM(h.x), 0, pxToM(h.y));
        this.decals.forEach((d, i) => {
          const a = h.angle + (i * Math.PI * 2) / s.count;
          d.mesh.position.set(pxToM(h.x), 0.04, pxToM(h.y));
          d.mesh.rotation.y = yawFromAngle(a);
          // Télégraphe : lignes de visée qui se remplissent ; ensuite, faisceau fixe (aucun stroboscope).
          d.set(tele ? h.progress : 1, tele ? 0.8 : 0.35, time);
          const beam = this.beams[i];
          if (beam) {
            beam.visible = !tele;
            beam.rotation.y = yawFromAngle(a);
          }
        });
        return;
      }
      case 'cloud': {
        const r = pxToM(h.cloudRadius);
        this.deco.position.set(pxToM(h.x), 0, pxToM(h.y));
        const fade = Math.min(1, (s.lifeMs - h.after) / 600);
        this.puffs.forEach((p, i) => {
          const a = this.seed + i * 1.05 + time * (this.reducedMotion ? 0.05 : 0.25);
          const rr = r * (0.25 + 0.45 * ((i % 3) / 2));
          p.position.set(
            Math.cos(a) * rr,
            0.35 + (i % 2) * 0.45 + Math.sin(time + i) * 0.05,
            Math.sin(a) * rr * 0.8,
          );
          p.scale.setScalar(r * (1.3 + 0.3 * (i % 2)) * Math.max(0.2, fade));
        });
        const g = this.deco.getObjectByName('ground');
        g?.scale.setScalar(r * 2.3 * Math.max(0.2, fade));
        return;
      }
    }
  }

  public dispose(): void {
    for (const d of this.decals) d.dispose();
    this.ring?.dispose();
    if (this.mover) {
      this.scene.remove(this.mover.group);
      this.mover.dispose();
    }
    this.hole?.removeFromParent();
    // Matériaux propres à la tache (les autres sont dans le kit partagé).
    const spot = this.deco.getObjectByName('spot');
    if (spot instanceof THREE.Mesh) (spot.material as THREE.Material).dispose();
    this.deco.removeFromParent();
  }
}

/** Toutes les zones de danger visibles : une vue par `HazardSim`, créée et libérée à la volée. */
export class HazardViews {
  private readonly views = new Map<HazardSim, HazardView>();
  private readonly kit = new SkinKit();

  public constructor(
    private readonly scene: THREE.Scene,
    private readonly reducedMotion: boolean,
  ) {}

  public sync(hazards: readonly HazardSim[], time: number): void {
    const alive = new Set(hazards);
    for (const h of hazards) {
      let v = this.views.get(h);
      if (!v) {
        v = new HazardView(this.scene, h, this.reducedMotion, this.kit);
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

  public dispose(): void {
    this.clear();
    this.kit.dispose();
  }
}
