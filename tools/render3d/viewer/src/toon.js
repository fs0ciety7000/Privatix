// Matériaux toon des GLB de tools/render3d, proches de prototypes/proto3d/src/toon.ts :
//  - « toon » : MeshToonMaterial, rampe 4 marches, couleur de sommet (RGB), part émissive (A),
//    liseré coloré venant du haut-droite de l'écran, flash de coup ;
//  - « glow » : émissif pur (A = masque « télégraphe » : passe au magenta quand uTelegraph > 0) ;
//  - « mirror » : boule à facettes (R = identifiant de facette), reflets procéduraux en 3 tons ;
//  - « glass » : verre de lunettes, fresnel teinté, reflet en diagonale ;
//  - contour : coque inversée extrudée le long de l'attribut `_outline` (normales lissées par pièce,
//    × largeur relative ; 0 = pas de contour), épaisseur constante en pixels écran.
import * as THREE from 'three';

export const PAL = { outline: 0x14101a, enemyOutline: 0x06302c, rim: 0x6ff3ff, danger: 0xff3ea5 };

let gradient = null;
export function toonGradient() {
  if (!gradient) {
    const steps = [38, 92, 190, 255];
    const data = new Uint8Array(steps.length * 4);
    steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
    gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

/** Uniformes partagés par tous les matériaux d'un personnage (flash, télégraphe, temps). */
export function makeShared(opts = {}) {
  return {
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uTelegraph: { value: 0 },
    uDanger: { value: new THREE.Color(PAL.danger) },
    uTime: { value: 0 },
    uRimColor: { value: new THREE.Color(opts.rim ?? PAL.rim) },
    uRimStrength: { value: opts.rimStrength ?? 0.9 },
  };
}

export function toonMaterial(shared) {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: toonGradient() });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared);
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

export function glowMaterial(shared, intensity = 3.2) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared);
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
        .replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, uFlashColor, uFlash * 0.5);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'glb-glow';
  return m;
}

const SKIN_VERT = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
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

/** Boule à facettes : chaque facette reflète un ciel procédural (fond sombre semé de projecteurs),
 *  avec une normale légèrement perturbée par son identifiant ; sortie quantifiée en 3 tons
 *  (acier, argent, blanc) + scintillement HDR des facettes alignées sur la lumière. */
export function mirrorMaterial(shared) {
  return new THREE.ShaderMaterial({
    vertexColors: true,
    uniforms: { ...shared, uSpin: { value: 0 } },
    vertexShader: SKIN_VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime;
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
        // ciel : sol sombre violet → plafond bleu acier
        vec3 env = mix(vec3(0.05, 0.03, 0.10), vec3(0.22, 0.24, 0.40), smoothstep(-0.3, 0.9, R.y));
        vec3 warm = mix(vec3(1.0, 0.85, 0.55), uDanger, uTelegraph);
        vec3 cool = mix(vec3(0.45, 0.95, 1.0), uDanger, uTelegraph);
        env += spot(R, vec3(-0.35, 0.85, 0.4), vec3(1.0), 24.0) * 1.6;         // lune / clé
        env += spot(R, vec3(0.6, 0.3, 0.7), warm, 18.0) * 1.2;                  // lampe chaude
        env += spot(R, vec3(0.8, 0.5, -0.4), cool, 14.0) * 1.0;                 // contre-jour cyan
        env += spot(R, vec3(-0.7, 0.2, -0.6), mix(vec3(1.0, 0.85, 0.3), uDanger, uTelegraph), 16.0) * 0.8;
        env += spot(R, vec3(0.0, -0.2, 1.0), mix(vec3(0.7, 0.4, 1.0), uDanger, uTelegraph), 10.0) * 0.6;
        float lum = dot(env, vec3(0.299, 0.587, 0.114));
        float jitter = (hash3(id + 7.0).x - 0.5) * 0.25;
        lum += jitter;
        vec3 steel = vec3(0.30, 0.33, 0.46);
        vec3 silver = vec3(0.70, 0.74, 0.86);
        vec3 white = vec3(1.0, 0.98, 0.95);
        vec3 tint = env / max(lum, 0.05);
        vec3 col = lum < 0.28 ? steel : (lum < 0.62 ? silver : white);
        col *= mix(vec3(1.0), clamp(tint, 0.0, 1.6), 0.35);
        // scintillement : quelques facettes flashent (HDR → bloom en jeu)
        float tw = step(0.985, fract(hash3(id + 3.0).y + uTime * 0.35)) * step(0.5, lum);
        col += vec3(2.5) * tw;
        col = mix(col, uFlashColor, uFlash);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** Verres de lunettes : quasi invisibles au centre, fresnel blanc bleuté, reflet en diagonale. */
export function glassMaterial(shared) {
  return new THREE.ShaderMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    uniforms: { ...shared },
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
        #include <colorspace_fragment>
      }`,
  });
}

export const outlineUniforms = { uRes: { value: new THREE.Vector2(1280, 720) } };

export function outlineMaterial(color = PAL.outline, widthPx = 2.6, shared = null) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uRes: outlineUniforms.uRes,
      uWidth: { value: widthPx },
      uColor: { value: new THREE.Color(color) },
      uTelegraph: shared ? shared.uTelegraph : { value: 0 },
      uDanger: shared ? shared.uDanger : { value: new THREE.Color(PAL.danger) },
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
        // léger recul en profondeur : la coque ne mord jamais sur les pièces voisines
        gl_Position.z += 0.0004 * gl_Position.w * step(0.001, wl);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTelegraph;
      uniform vec3 uDanger;
      void main() {
        vec3 c = mix(uColor, uDanger * 1.6, step(0.001, uTelegraph));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** Remplace les matériaux importés (par nom) et ajoute la coque de contour (à côté de chaque
 *  maillage, même squelette). `root` = sous-arbre ou liste de maillages.
 *  Renvoie { calls: appels de rendu, outlines: coques créées }. */
export function toonify(root, shared, { outlineColor = PAL.outline, outlineWidth = 2.6 } = {}) {
  const mats = {};
  const get = (name) => {
    if (!mats[name]) {
      if (name.startsWith('glow')) mats[name] = glowMaterial(shared);
      else if (name.startsWith('mirror')) mats[name] = mirrorMaterial(shared);
      else if (name.startsWith('glass')) mats[name] = glassMaterial(shared);
      else mats[name] = toonMaterial(shared);
    }
    return mats[name];
  };
  const meshes = [];
  if (Array.isArray(root)) meshes.push(...root);
  else
    root.traverse((o) => {
      if (o.isMesh && !o.userData.outline) meshes.push(o);
    });
  let calls = 0;
  const outlines = [];
  const olMat = outlineMaterial(outlineColor, outlineWidth, shared);
  for (const mesh of meshes) {
    const src = mesh.material;
    mesh.material = get(src.name || 'toon');
    mesh.castShadow = !(src.name || '').startsWith('glass');
    mesh.receiveShadow = false; // pas d'auto-ombrage : acné sur les sphères low-poly, et le toon se lit mieux sans
    mesh.frustumCulled = false;
    calls++;
    if (mesh.geometry.getAttribute('_outline') && !/^(glass|glow|mirror)/.test(src.name || '')) {
      const o = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, olMat) : new THREE.Mesh(mesh.geometry, olMat);
      if (mesh.isSkinnedMesh) o.bind(mesh.skeleton, mesh.bindMatrix);
      o.userData.outline = true;
      o.frustumCulled = false;
      o.castShadow = false;
      o.position.copy(mesh.position);
      o.quaternion.copy(mesh.quaternion);
      o.scale.copy(mesh.scale);
      mesh.parent.add(o);
      outlines.push(o);
      calls++;
    }
  }
  return { calls, outlines };
}
