// Matériaux toon (cel-shading à 4 bandes), liseré coloré, flash de coup et contours en coque inversée
// d'épaisseur constante à l'écran.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const PAL = {
  outline: 0x14101a,
  rim: 0x6ff3ff,
  hero: 0xff7a1a,
  enemy: 0x19c3b1,
  danger: 0xff3ea5,
  gold: 0xffc83a,
};

let gradient: THREE.DataTexture | null = null;

/** Rampe de lumière en 4 marches : ombre profonde, ombre, lumière, pleine lumière. */
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    const steps = [38, 92, 190, 255];
    const data = new Uint8Array(steps.length * 4);
    steps.forEach((v, i) => {
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    });
    gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export interface Flash {
  amount: { value: number };
  color: { value: THREE.Color };
}

export function makeFlash(): Flash {
  return { amount: { value: 0 }, color: { value: new THREE.Color(1, 1, 1) } };
}

export interface ToonOpts {
  rim?: number;
  rimStrength?: number;
  emissive?: number;
  emissiveIntensity?: number;
  map?: THREE.Texture | null;
  flash?: Flash;
  transparent?: boolean;
  opacity?: number;
}

/**
 * Matériau toon : bandes nettes (gradientMap), liseré coloré venant du haut-droite de l'écran
 * (à la Hades) et flash de coup partagé par tout un personnage.
 */
export function toon(color: number, o: ToonOpts = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient(),
    map: o.map ?? null,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
  });
  const rimStrength = o.rimStrength ?? 0;
  const flash = o.flash;
  if (rimStrength > 0 || flash) {
    const rimColor = new THREE.Color(o.rim ?? PAL.rim);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRimColor = { value: rimColor };
      sh.uniforms.uRimStrength = { value: rimStrength };
      sh.uniforms.uFlash = flash ? flash.amount : { value: 0 };
      sh.uniforms.uFlashColor = flash ? flash.color : { value: new THREE.Color(1, 1, 1) };
      sh.fragmentShader =
        'uniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uFlash;\nuniform vec3 uFlashColor;\n' +
        sh.fragmentShader.replace(
          '#include <opaque_fragment>',
          `{
            vec3 vd = normalize(vViewPosition);
            float fr = 1.0 - clamp(dot(normal, vd), 0.0, 1.0);
            float side = clamp(dot(normalize(normal.xy + 1e-5), normalize(vec2(0.55, 0.85))), 0.0, 1.0);
            float r = smoothstep(0.55, 0.62, fr) * smoothstep(0.15, 0.5, side);
            outgoingLight += uRimColor * r * uRimStrength;
            outgoingLight = mix(outgoingLight, uFlashColor, uFlash);
          }
          #include <opaque_fragment>`,
        );
    };
    m.customProgramCacheKey = () => 'toon-rim';
  }
  return m;
}

/** Matériau émissif pur (néons, écrans, VFX) : ignore la lumière, déborde dans le bloom. */
export function glow(color: number, intensity = 3, opts: { transparent?: boolean; opacity?: number; additive?: boolean } = {}): THREE.MeshBasicMaterial {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({
    color: c,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !opts.additive,
    fog: !opts.additive,
  });
}

// ─── Contours ──────────────────────────────────────────────────────────────────

export const outlineUniforms = { uRes: { value: new THREE.Vector2(1280, 720) } };
const outlineMats = new Map<string, THREE.MeshBasicMaterial>();

/** Coque inversée poussée le long des normales dans l'espace écran : trait d'épaisseur constante (px). */
export function outlineMat(widthPx = 2.6, color = PAL.outline): THREE.MeshBasicMaterial {
  const key = `${widthPx}:${color}`;
  let m = outlineMats.get(key);
  if (!m) {
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRes = outlineUniforms.uRes;
      sh.uniforms.uWidth = { value: widthPx };
      sh.vertexShader =
        'uniform vec2 uRes;\nuniform float uWidth;\n' +
        sh.vertexShader.replace(
          '#include <fog_vertex>',
          `{
            vec3 nV = normalize(normalMatrix * normal);
            vec4 nC = projectionMatrix * vec4(nV, 0.0);
            vec2 d = nC.xy;
            float l = length(d);
            d = l > 1e-5 ? d / l : vec2(0.0);
            gl_Position.xy += d * uWidth * gl_Position.w * 2.0 / uRes;
          }
          #include <fog_vertex>`,
        );
    };
    mat.customProgramCacheKey = () => 'outline';
    outlineMats.set(key, mat);
    m = mat;
  }
  return m;
}

const outlineGeoCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** Géométrie de coque : sommets soudés et normales moyennées (pas de trou aux arêtes vives). */
export function outlineGeo(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let o = outlineGeoCache.get(g);
  if (!o) {
    const c = new THREE.BufferGeometry();
    const pos = g.getAttribute('position');
    c.setAttribute('position', pos.clone());
    if (g.index) c.setIndex(g.index.clone());
    o = mergeVertices(c, 1e-3);
    o.computeVertexNormals();
    outlineGeoCache.set(g, o);
  }
  return o;
}

export function addOutline(mesh: THREE.Mesh, widthPx = 2.6, color = PAL.outline): THREE.Mesh {
  const o = new THREE.Mesh(outlineGeo(mesh.geometry), outlineMat(widthPx, color));
  o.castShadow = false;
  o.receiveShadow = false;
  o.userData.outline = true;
  o.raycast = () => undefined;
  mesh.add(o);
  return o;
}

// ─── Géométries partagées ──────────────────────────────────────────────────────

const geoCache = new Map<string, THREE.BufferGeometry>();

function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

export function sphereGeo(seg = 18): THREE.BufferGeometry {
  return cached(`s${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.7))));
}

export function hemiGeo(seg = 20): THREE.BufferGeometry {
  return cached(`h${seg}`, () => new THREE.SphereGeometry(1, seg, 10, 0, Math.PI * 2, 0, Math.PI / 2));
}

export function rboxGeo(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  return cached(`b${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)},${rr.toFixed(3)}`, () =>
    rr > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d),
  );
}

export function capsuleGeo(r: number, len: number): THREE.BufferGeometry {
  return cached(`c${r.toFixed(3)},${len.toFixed(3)}`, () => new THREE.CapsuleGeometry(r, Math.max(0.001, len), 5, 12));
}

export function cylGeo(rt: number, rb: number, h: number, seg = 14, open = false): THREE.BufferGeometry {
  return cached(`y${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
}

// ─── Textures procédurales ─────────────────────────────────────────────────────

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2D indisponible');
  draw(g);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Disque radial doux (halos, flaques de lumière, particules). */
export function radialTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }, false);
}

/** Pseudo-aléatoire déterministe. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let sncbTex: THREE.CanvasTexture | null = null;

/** Logo SNCB recréé en vectoriel (ellipse bleue + B serif gras) sur pastille blanche, fond transparent. */
export function sncbLogoTexture(): THREE.CanvasTexture {
  if (!sncbTex) {
    sncbTex = canvasTexture(512, 340, (g) => {
      const cx = 256;
      const cy = 170;
      g.clearRect(0, 0, 512, 340);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(cx, cy, 250, 166, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#0069b4';
      g.lineWidth = 26;
      g.beginPath();
      g.ellipse(cx, cy, 222, 140, 0, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#0069b4';
      g.font = 'bold 236px Georgia, "Times New Roman", "DejaVu Serif", serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('B', cx + 4, cy + 14);
    });
  }
  return sncbTex;
}
