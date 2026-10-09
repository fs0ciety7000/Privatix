// Matériaux des personnages GLB (tools/render3d, contrat SKELETON.md § 5), portés de la visionneuse
// de référence (tools/render3d/viewer/src/toon.js) et alignés sur le toon du jeu (materials/toon.ts) :
//  - « toon » : MeshToonMaterial à rampe 4 marches, couleur de sommet (RGB), part émissive (A),
//    liseré coloré venant du haut-droite de l'écran, flash de coup ;
//  - « glow » : émissif pur (A = masque télégraphe : passe au magenta quand uTelegraph > 0) ;
//  - « mirror » : boule à facettes (R = identifiant de facette), reflets en 3 tons, scintillement HDR
//    (coupé en Réduction des mouvements via uTwinkle) ;
//  - « glass » : verre fresnel transparent, reflet en diagonale ;
//  - contour : coque inversée extrudée le long de l'attribut `_outline` (normales lissées par pièce ×
//    largeur relative ; 0 = pas de contour), épaisseur constante en pixels écran, magenta pendant un
//    télégraphe.
// Les programmes sont partagés par tous les personnages (customProgramCacheKey) ; les uniformes, eux,
// appartiennent à chaque personnage (flash, télégraphe).
import * as THREE from 'three';
import { outlineUniforms, PAL, toonGradient } from '@/view/materials/toon';

/** Uniformes d'un personnage, partagés par tous ses matériaux (corps, équipement, contour). */
export interface GlbUniforms {
  readonly uFlash: { value: number };
  readonly uFlashColor: { value: THREE.Color };
  readonly uTelegraph: { value: number };
  readonly uDanger: { value: THREE.Color };
  readonly uTime: { value: number };
  readonly uTwinkle: { value: number };
  readonly uRimColor: { value: THREE.Color };
  readonly uRimStrength: { value: number };
}

export interface GlbUniformOpts {
  readonly rim?: number;
  readonly rimStrength?: number;
  /** Uniformes de flash existants (Flash de materials/toon), pour les partager avec la vue. */
  readonly flash?: { readonly amount: { value: number }; readonly color: { value: THREE.Color } };
  readonly twinkle?: boolean;
}

export function makeGlbUniforms(o: GlbUniformOpts = {}): GlbUniforms {
  return {
    uFlash: o.flash ? o.flash.amount : { value: 0 },
    uFlashColor: o.flash ? o.flash.color : { value: new THREE.Color(1, 1, 1) },
    uTelegraph: { value: 0 },
    uDanger: { value: new THREE.Color(PAL.danger) },
    uTime: { value: 0 },
    uTwinkle: { value: o.twinkle === false ? 0 : 1 },
    uRimColor: { value: new THREE.Color(o.rim ?? PAL.rim) },
    uRimStrength: { value: o.rimStrength ?? 0.9 },
  };
}

function bind(sh: THREE.WebGLProgramParametersWithUniforms, u: GlbUniforms): void {
  Object.assign(sh.uniforms, u);
}

export function glbToonMaterial(u: GlbUniforms): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({
    color: 0xffffff,
    vertexColors: true,
    gradientMap: toonGradient(),
  });
  m.name = 'toon';
  m.onBeforeCompile = (sh) => {
    bind(sh, u);
    sh.fragmentShader =
      'uniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uFlash;\nuniform vec3 uFlashColor;\n' +
      sh.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#if defined( USE_COLOR_ALPHA )
            diffuseColor.rgb *= vColor.rgb;
            float vEmitAmt = vColor.a;
          #elif defined( USE_COLOR )
            diffuseColor.rgb *= vColor;
            float vEmitAmt = 0.0;
          #else
            float vEmitAmt = 0.0;
          #endif`,
        )
        .replace(
          '#include <opaque_fragment>',
          `{
            vec3 vd = normalize(vViewPosition);
            float fr = 1.0 - clamp(dot(normal, vd), 0.0, 1.0);
            float side = clamp(dot(normalize(normal.xy + 1e-5), normalize(vec2(0.55, 0.85))), 0.0, 1.0);
            float r = smoothstep(0.55, 0.62, fr) * smoothstep(0.15, 0.5, side);
            outgoingLight += uRimColor * r * uRimStrength * (0.35 + 0.65 * max(max(diffuseColor.r, diffuseColor.g), diffuseColor.b));
            outgoingLight += diffuseColor.rgb * vEmitAmt * 2.2;
            outgoingLight = mix(outgoingLight, uFlashColor, uFlash);
          }
          #include <opaque_fragment>`,
        );
  };
  m.customProgramCacheKey = () => 'glb-toon';
  return m;
}

export function glbGlowMaterial(u: GlbUniforms, intensity = 3.2): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  m.name = 'glow';
  m.onBeforeCompile = (sh) => {
    bind(sh, u);
    sh.uniforms.uGlow = { value: intensity };
    sh.fragmentShader =
      'uniform float uGlow;\nuniform float uTelegraph;\nuniform vec3 uDanger;\nuniform float uFlash;\nuniform vec3 uFlashColor;\n' +
      sh.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#if defined( USE_COLOR_ALPHA )
            diffuseColor.rgb = mix(vColor.rgb * uGlow, uDanger * (1.5 + 3.5 * uTelegraph), vColor.a * step(0.001, uTelegraph));
            diffuseColor.a = 1.0;
          #elif defined( USE_COLOR )
            diffuseColor.rgb = vColor * uGlow;
          #endif`,
        )
        .replace(
          '#include <opaque_fragment>',
          'outgoingLight = mix(outgoingLight, uFlashColor, uFlash * 0.5);\n#include <opaque_fragment>',
        );
  };
  m.customProgramCacheKey = () => 'glb-glow';
  return m;
}

const SKIN_VERT = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
  #include <fog_pars_vertex>
  varying vec3 vN;
  varying vec3 vW;
  varying vec4 vCol;
  void main() {
    #include <beginnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    #include <project_vertex>
    vN = normalize(mat3(modelMatrix) * objectNormal);
    vW = (modelMatrix * vec4(transformed, 1.0)).xyz;
    #if defined( USE_COLOR_ALPHA )
      vCol = color;
    #elif defined( USE_COLOR )
      vCol = vec4(color, 1.0);
    #else
      vCol = vec4(1.0);
    #endif
  }`;

/**
 * Boule à facettes : chaque facette reflète un ciel procédural (fond sombre semé de projecteurs aux
 * couleurs de la scène : lune froide, lampe chaude, contre-jour cyan), normale perturbée par son
 * identifiant, sortie quantifiée en 3 tons (acier, argent, blanc). Scintillement HDR (bloom) de
 * quelques facettes alignées, multiplié par uTwinkle (0 en Réduction des mouvements : pas de
 * stroboscope, les reflets restent).
 */
export function glbMirrorMaterial(u: GlbUniforms): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    vertexColors: true,
    uniforms: { ...u },
    vertexShader: SKIN_VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uTwinkle;
      uniform float uTelegraph;
      uniform vec3 uDanger;
      uniform float uFlash;
      uniform vec3 uFlashColor;
      varying vec3 vN;
      varying vec3 vW;
      varying vec4 vCol;
      vec3 hash3(float n) { return fract(sin(vec3(n, n + 1.7, n + 3.1)) * vec3(43758.5453, 22578.1459, 19642.3490)); }
      vec3 spot(vec3 R, vec3 d, vec3 c, float k) { return c * pow(max(dot(R, normalize(d)), 0.0), k); }
      void main() {
        float id = vCol.r * 97.0;
        vec3 n = normalize(vN + (hash3(id) - 0.5) * 0.35);
        vec3 V = normalize(vW - cameraPosition);
        vec3 R = reflect(V, n);
        vec3 env = mix(vec3(0.05, 0.03, 0.10), vec3(0.22, 0.24, 0.40), smoothstep(-0.3, 0.9, R.y));
        vec3 warm = mix(vec3(1.0, 0.85, 0.55), uDanger, uTelegraph);
        vec3 cool = mix(vec3(0.45, 0.95, 1.0), uDanger, uTelegraph);
        env += spot(R, vec3(-0.35, 0.85, 0.4), vec3(0.75, 0.82, 1.0), 24.0) * 1.6;
        env += spot(R, vec3(0.6, 0.3, 0.7), warm, 18.0) * 1.2;
        env += spot(R, vec3(0.8, 0.5, -0.4), cool, 14.0) * 1.0;
        env += spot(R, vec3(-0.7, 0.2, -0.6), mix(vec3(1.0, 0.85, 0.3), uDanger, uTelegraph), 16.0) * 0.8;
        env += spot(R, vec3(0.0, -0.2, 1.0), mix(vec3(0.7, 0.4, 1.0), uDanger, uTelegraph), 10.0) * 0.6;
        float lum = dot(env, vec3(0.299, 0.587, 0.114));
        lum += (hash3(id + 7.0).x - 0.5) * 0.25;
        vec3 steel = vec3(0.30, 0.33, 0.46);
        vec3 silver = vec3(0.70, 0.74, 0.86);
        vec3 white = vec3(1.0, 0.98, 0.95);
        vec3 tint = env / max(lum, 0.05);
        vec3 col = lum < 0.28 ? steel : (lum < 0.62 ? silver : white);
        col *= mix(vec3(1.0), clamp(tint, 0.0, 1.6), 0.35);
        float tw = step(0.985, fract(hash3(id + 3.0).y + uTime * 0.35)) * step(0.5, lum);
        col += vec3(2.5) * tw * uTwinkle;
        col = mix(col, uFlashColor, uFlash);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  m.name = 'mirror';
  return m;
}

/** Verres de lunettes : quasi invisibles au centre, fresnel blanc bleuté, reflet en diagonale. */
export function glbGlassMaterial(u: GlbUniforms): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    uniforms: { ...u },
    vertexShader: SKIN_VERT,
    fragmentShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      varying vec4 vCol;
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        float fr = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
        float diag = fract((vW.x * 0.8 + vW.y) / 0.22 + 0.35);
        float streak = smoothstep(0.0, 0.08, diag) * (1.0 - smoothstep(0.18, 0.3, diag));
        float a = 0.10 + fr * 0.55 + streak * 0.55 * vCol.a;
        gl_FragColor = vec4(mix(vCol.rgb, vec3(1.0), 0.6 + streak * 0.4), clamp(a, 0.0, 0.9));
      }`,
  });
  m.name = 'glass';
  return m;
}

/** Coque inversée (contour) pilotée par l'attribut `_outline`, skinnée comme la normale. */
export function glbOutlineMaterial(u: GlbUniforms, color: number, widthPx: number): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uRes: outlineUniforms.uRes,
      uWidth: { value: widthPx },
      uColor: { value: new THREE.Color(color) },
      uTelegraph: u.uTelegraph,
      uDanger: u.uDanger,
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      attribute vec3 _outline;
      uniform vec2 uRes;
      uniform float uWidth;
      void main() {
        vec3 objectNormal = _outline;
        float wl = length(_outline);
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        vec3 nV = normalize(normalMatrix * objectNormal + 1e-6);
        vec4 nC = projectionMatrix * vec4(nV, 0.0);
        vec2 d = nC.xy;
        float l = length(d);
        d = l > 1e-5 ? d / l : vec2(0.0);
        gl_Position.xy += d * uWidth * wl * gl_Position.w * 2.0 / uRes;
        gl_Position.z += 0.0004 * gl_Position.w * step(0.001, wl);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTelegraph;
      uniform vec3 uDanger;
      void main() {
        vec3 c = mix(uColor, uDanger * 1.6, step(0.001, uTelegraph));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  m.name = 'outline';
  return m;
}

/**
 * Silhouette tramée du héros caché derrière un pilier ou un mur : double skinné dessiné AVANT le
 * corps avec un test de profondeur inversé (seulement là où autre chose est devant).
 */
export function glbSilhouetteMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      void main() {
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
      }`,
    fragmentShader: /* glsl */ `
      void main(){
        vec2 p = floor(gl_FragCoord.xy / 2.0);
        if (mod(p.x + p.y, 2.0) < 0.5) discard;
        gl_FragColor = vec4(1.0, 0.55, 0.15, 1.0);
      }`,
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
  });
}

/**
 * Intensité des émissifs en jeu : plus basse que dans la visionneuse (3,2), car le bloom du jeu (seuil
 * 0,96) et l'étalonnage les font déjà déborder ; au-delà, l'encre des écrans disparaît.
 */
const GLOW_INTENSITY = 1.7;

/** Jeu de matériaux d'un personnage, créés à la demande d'après le nom importé. */
export class GlbMaterialSet {
  private readonly byName = new Map<string, THREE.Material>();
  private outline: THREE.ShaderMaterial | null = null;

  public constructor(
    public readonly uniforms: GlbUniforms,
    private readonly outlineColor: number,
    private readonly outlineWidth: number,
  ) {}

  /** Matériau du jeu pour un matériau importé nommé `name` (toon, glow, mirror, glass). */
  public get(name: string): THREE.Material {
    const key = kindOf(name);
    let m = this.byName.get(key);
    if (!m) {
      m =
        key === 'glow'
          ? glbGlowMaterial(this.uniforms, GLOW_INTENSITY)
          : key === 'mirror'
            ? glbMirrorMaterial(this.uniforms)
            : key === 'glass'
              ? glbGlassMaterial(this.uniforms)
              : glbToonMaterial(this.uniforms);
      this.byName.set(key, m);
    }
    return m;
  }

  public outlineMaterial(): THREE.ShaderMaterial {
    this.outline ??= glbOutlineMaterial(this.uniforms, this.outlineColor, this.outlineWidth);
    return this.outline;
  }

  public dispose(): void {
    for (const m of this.byName.values()) m.dispose();
    this.byName.clear();
    this.outline?.dispose();
    this.outline = null;
  }
}

export type GlbMaterialKind = 'toon' | 'glow' | 'mirror' | 'glass';

export function kindOf(name: string): GlbMaterialKind {
  if (name.startsWith('glow')) return 'glow';
  if (name.startsWith('mirror')) return 'mirror';
  if (name.startsWith('glass')) return 'glass';
  return 'toon';
}
