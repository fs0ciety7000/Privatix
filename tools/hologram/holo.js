// Page de capture de l'hologramme du héros (pilotée par render.mjs) : hero.glb équipé de sa
// dotation de base, matériaux toon et contours de la visionneuse (tools/render3d/viewer/src/toon.js,
// eux-mêmes alignés sur le jeu), fond transparent, caméra 3/4 légèrement plongeante.
// Aucune boucle temps réel : `window.holo.frame(i)` pose le squelette et la rotation de l'image i et
// dessine une seule fois (capture déterministe, indépendante de la lenteur de SwiftShader).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { makeShared, outlineUniforms, toonify } from '../render3d/viewer/src/toon.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') ?? 720);
const H = +(params.get('h') ?? 960);
/** Multiplicateur d'épaisseur du contour (rendu suréchantillonné puis réduit). */
const OW = +(params.get('ow') ?? 2);
/** Images de la boucle, nombre de cycles d'idle qu'elle contient, élévation et lacet de départ. */
const FRAMES = +(params.get('frames') ?? 120);
const CYCLES = +(params.get('cycles') ?? 2);
const ELEV = +(params.get('elev') ?? 14);
const YAW0 = +(params.get('yaw') ?? -35);

// Rendu identique à la visionneuse en mode portrait (tone mapping neutre, exposition 1,12).
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
outlineUniforms.uRes.value.set(W, H);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 200);

// Lumières « Quais, Nuit » de la visionneuse (sans ombres : un hologramme n'en porte pas),
// contre-jours sodium et cyan du héros (tools/artbook/characters.json, `stage`).
scene.add(new THREE.HemisphereLight(0x5a5ad0, 0x2a1438, 0.75));
const sun = new THREE.DirectionalLight(0xa8b8ff, 1.9);
sun.position.set(-8, 20, 10);
scene.add(sun);
const back = new THREE.DirectionalLight(0x6ff3ff, 0.45);
back.position.set(6, 5, -8);
scene.add(back);
const warm = new THREE.PointLight(0xffc98a, 5, 10, 1.5);
const rimA = new THREE.DirectionalLight(0xffb347, 2.2);
const rimB = new THREE.DirectionalLight(0x6ff3ff, 1.8);
scene.add(warm, rimA, rimB);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
/** Dotation de base du héros (celle de la visionneuse et de la planche « Réforme »). */
const EQUIP = { casque: 'casque_chantier', gilet: 'gilet_hv', outil: 'cle_tire_fond' };

const state = { root: null, mixer: null, idle: null, box: null, clipDuration: 1 };

async function init() {
  const manifest = await (await fetch('models/manifest.json', { cache: 'no-store' })).json();
  const info = manifest.characters.hero;
  const gltf = await loader.loadAsync(info.file);
  const root = skClone(gltf.scene);
  const shared = makeShared({ rim: parseInt(info.rim.slice(1), 16), rimStrength: 0.85 });
  const outlineColor = parseInt(info.outline.slice(1), 16);
  toonify(root, shared, { outlineColor, outlineWidth: 2.6 * OW });
  scene.add(root);

  // Équipement : pièces rigides accrochées aux sockets, gilet skinné relié aux os du héros.
  let body = null;
  root.traverse((o) => {
    if (!body && o.isSkinnedMesh && !o.userData.outline) body = o;
  });
  for (const name of Object.values(EQUIP)) {
    const it = manifest.items[name];
    const g = await loader.loadAsync(it.file);
    if (it.skinned) {
      const src = skClone(g.scene);
      const meshes = [];
      src.traverse((o) => o.isSkinnedMesh && meshes.push(o));
      for (const m of meshes) {
        const bones = m.skeleton.bones.map((b) => root.getObjectByName(b.name));
        body.parent.add(m);
        m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix);
        toonify([m], shared, { outlineColor, outlineWidth: 2.6 * OW });
      }
    } else {
      const socket = root.getObjectByName(it.socket);
      if (!socket) continue;
      const obj = g.scene.clone(true);
      toonify(obj, shared, { outlineColor, outlineWidth: 2.6 * OW });
      socket.add(obj);
    }
  }

  state.mixer = new THREE.AnimationMixer(root);
  const clip = gltf.animations.find((c) => c.name === 'idle');
  state.idle = state.mixer.clipAction(clip);
  state.idle.play();
  state.clipDuration = clip.duration;
  state.root = root;

  // Boîte de la pose d'idle (géométrie skinnée, échantillonnée sur le cycle) : hauteur et rayon de
  // cadrage. Le héros tourne autour de son origine (entre ses pieds), pas du centre de la boîte que
  // la clé tirerait vers l'avant.
  const box = new THREE.Box3();
  for (let k = 0; k < 8; k++) {
    state.mixer.setTime((k / 8) * clip.duration);
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (o.isMesh && !o.userData.outline) box.expandByObject(o, true);
    });
  }
  state.box = box;
  const h = box.max.y;
  warm.position.set(0.6 * h, 1.7 * h, 1.2 * h);
  rimA.position.set(-1.2 * h, 1.1 * h, -1.4 * h);
  rimB.position.set(1.4 * h, 0.9 * h, -1.0 * h);

  // Caméra fixe, 3/4 plongeante : la distance laisse la place au personnage et à son outil, quel que
  // soit l'angle de rotation (le recadrage serré se fait après coup sur l'union des silhouettes).
  // Rayon horizontal maximal autour de l'axe de rotation (la clé dépasse loin devant le héros).
  let radius = 0;
  for (const x of [box.min.x, box.max.x])
    for (const z of [box.min.z, box.max.z]) radius = Math.max(radius, Math.hypot(x, z));
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const d = Math.max((h * 0.62) / tanV, (radius * 1.08) / (tanV * camera.aspect)) + radius * 0.3;
  const e = THREE.MathUtils.degToRad(ELEV);
  const target = new THREE.Vector3(0, h * 0.5, 0);
  camera.position.set(0, target.y + Math.sin(e) * d, Math.cos(e) * d);
  camera.lookAt(target);
}

// Tampon 2D réutilisé pour mesurer la silhouette (boîte des pixels non transparents).
const probe = document.createElement('canvas');
probe.width = W;
probe.height = H;
const pctx = probe.getContext('2d', { willReadFrequently: true });

function alphaBox() {
  pctx.clearRect(0, 0, W, H);
  pctx.drawImage(renderer.domElement, 0, 0);
  const px = pctx.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (px[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return [x0, y0, x1, y1];
}

window.holo = {
  frames: FRAMES,
  /** Boîte de repos (contrôle du cadrage). */
  box: () => [state.box.min.toArray(), state.box.max.toArray()],
  /** Pose l'image i de la boucle, la dessine et renvoie le PNG (data URL) et la boîte de silhouette. */
  frame(i) {
    const u = i / FRAMES;
    // Idle : CYCLES cycles complets sur la boucle (léger ajustement de vitesse, imperceptible) ;
    // rotation complète autour de l'axe vertical, partant d'un 3/4 face.
    state.mixer.setTime(u * CYCLES * state.clipDuration);
    state.root.rotation.y = THREE.MathUtils.degToRad(YAW0) + u * Math.PI * 2;
    renderer.render(scene, camera);
    return { png: renderer.domElement.toDataURL('image/png'), box: alphaBox() };
  },
};

init().then(
  () => {
    window.holoReady = true;
  },
  (e) => {
    window.holoError = String(e?.stack ?? e);
  },
);
