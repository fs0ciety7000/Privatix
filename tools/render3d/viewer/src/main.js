// Visionneuse des GLB de public/models (export_glb.py) : rendu toon proche du prototype 3D,
// lecture des clips, équipement accroché aux sockets (casque, outil) ou lié au squelette (gilet).
// Mode capture : ?shot → panneau masqué, API window.viewer pilotée par shots.mjs (Playwright).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { makeShared, outlineUniforms, PAL, toonify } from './toon.js';

const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');
// Mode portrait (vitrines du site, `portraits.mjs`) : fond transparent, sol réduit à ses ombres,
// deux lumières de contour colorées en contre-jour. N'affecte pas le mode normal.
const PORTRAIT = params.has('portrait');
if (SHOT) document.body.classList.add('shot');

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: SHOT, alpha: PORTRAIT });
renderer.setPixelRatio(SHOT ? 1 : Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = PORTRAIT ? null : backdrop();
if (PORTRAIT) renderer.setClearColor(0x000000, 0);
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);

// Lumières « Quais, Nuit » du prototype : ciel violet, lune froide (ombres), lampe chaude du héros.
scene.add(new THREE.HemisphereLight(0x5a5ad0, 0x2a1438, 0.75));
const sun = new THREE.DirectionalLight(0xa8b8ff, 1.9);
sun.position.set(-8, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const warm = new THREE.PointLight(0xffc98a, 5, 9, 1.5);
scene.add(warm);
const back = new THREE.DirectionalLight(0x6ff3ff, 0.45);
back.position.set(6, 5, -8);
scene.add(back);

// Sol : dalle de quai sombre, anneau de lecture
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2),
  new THREE.MeshToonMaterial({ color: 0x241c40, gradientMap: null }),
);
ground.receiveShadow = true;
scene.add(ground);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a2f6a }));
ring.position.y = 0.002;
scene.add(ring);
const yellow = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.06).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8a7420 }));
yellow.position.set(0, 0.003, -0.55);
scene.add(yellow);
const rimA = new THREE.DirectionalLight(0xff3ea5, 0);
const rimB = new THREE.DirectionalLight(0x6ff3ff, 0);
if (PORTRAIT) {
  ground.visible = ring.visible = yellow.visible = false;
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: 0x05030c, opacity: 0.55 }));
  catcher.receiveShadow = true;
  scene.add(catcher);
  rimA.intensity = 2.2;
  rimB.intensity = 1.8;
  scene.add(rimA, rimB);
}

function backdrop() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#1a1236');
  gr.addColorStop(0.6, '#0e0a22');
  gr.addColorStop(1, '#07050f');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
function load(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url);
}

const state = {
  manifest: null,
  name: null,
  root: null,
  mixer: null,
  actions: {},
  clip: null,
  shared: null,
  calls: 0,
  equip: {},
  equipObjs: [],
  runtimeBones: [],
  speed: 1,
  turn: false,
  cam: 'threequarter',
  yaw: 0,
  info: null,
  holdUntil: 0,
};

const el = (id) => document.getElementById(id);

async function init() {
  state.manifest = await (await fetch('models/manifest.json', { cache: 'no-store' })).json();
  const sel = el('model');
  for (const n of Object.keys(state.manifest.characters)) sel.add(new Option(n, n));
  sel.onchange = () => setModel(sel.value);
  el('speed').oninput = (e) => (state.speed = +e.target.value);
  el('outline').onchange = (e) => state.root?.traverse((o) => o.userData.outline && (o.visible = e.target.checked));
  el('turn').onchange = (e) => (state.turn = e.target.checked);
  el('tele').oninput = (e) => state.shared && (state.shared.uTelegraph.value = +e.target.value);
  el('cam').onchange = (e) => setCam(e.target.value);
  el('cam').value = state.cam;
  const first = params.get('model') ?? Object.keys(state.manifest.characters)[0];
  sel.value = first;
  await setModel(first);
}

async function setModel(name) {
  const info = state.manifest.characters[name];
  const gltf = await load(info.file);
  if (state.root) scene.remove(state.root);
  // clone profond (squelette compris) pour pouvoir recharger le même modèle
  const root = skClone(gltf.scene);
  state.shared = makeShared({ rim: parseInt((info.rim ?? '#6FF3FF').slice(1), 16), rimStrength: info.kind === 'hero' ? 0.85 : 0.9 });
  const outlineColor = parseInt((info.outline ?? '#14101A').slice(1), 16);
  const ow = +(params.get('ow') ?? 1); // multiplicateur d'épaisseur du contour (captures haute définition)
  state.calls = toonify(root, state.shared, { outlineColor, outlineWidth: (info.height > 3 ? 3.2 : 2.6) * ow }).calls;
  state.outlineColor = outlineColor;
  scene.add(root);
  state.root = root;
  state.name = name;
  state.info = info;
  state.runtimeBones = (info.runtimeBones ?? []).map((b) => root.getObjectByName(b)).filter(Boolean);
  state.mixer = new THREE.AnimationMixer(root);
  state.actions = {};
  for (const c of gltf.animations) {
    const clip = c.clone();
    clip.tracks = clip.tracks.filter((t) => !(info.runtimeBones ?? []).some((b) => t.name.startsWith(`${b}.`)));
    const a = state.mixer.clipAction(clip);
    const meta = info.clips[c.name] ?? {};
    if (!meta.loop) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    state.actions[c.name] = a;
  }
  // boîte englobante de repos (géométrie) : cadrage et taille du sol
  // (positions quantifiées par meshopt : on passe par les matrices monde et le skinning)
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverse((o) => {
    if (o.isMesh && !o.userData.outline) box.expandByObject(o, true);
  });
  state.box = box;
  // scène à l'échelle du personnage
  const h = info.height ?? 2;
  const r = Math.max(1.6, (info.radius ?? 0.5) * 3.2, h * 0.9);
  ground.scale.setScalar(r);
  ring.scale.setScalar(r);
  yellow.scale.set(r, 1, 1);
  yellow.position.z = -r * 0.55;
  warm.position.set(0.6 * h, 1.7 * h, 1.2 * h);
  rimA.position.set(-1.2 * h, 1.1 * h, -1.4 * h);
  rimB.position.set(1.4 * h, 0.9 * h, -1.0 * h);
  warm.distance = h * 5;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -r * 1.5;
  sun.shadow.camera.right = sun.shadow.camera.top = r * 1.5;
  sun.shadow.camera.updateProjectionMatrix();
  buildClipButtons();
  buildEquipUI();
  state.equipObjs = [];
  state.equip = {};
  if (info.kind === 'hero') {
    const def = { casque: 'casque_chantier', gilet: 'gilet_hv', outil: 'cle_tire_fond' };
    await setEquip(def);
  }
  const first = info.clips.idle ? 'idle' : Object.keys(info.clips)[0];
  playClip(first);
  setCam(state.cam);
  updateInfo();
}

function buildClipButtons() {
  const box = el('clips');
  box.innerHTML = '';
  for (const [n, c] of Object.entries(state.info.clips)) {
    const b = document.createElement('button');
    b.textContent = `${n} ${c.duration.toFixed(2)}s`;
    b.dataset.clip = n;
    b.onclick = () => playClip(n);
    box.appendChild(b);
  }
}

function buildEquipUI() {
  const box = el('equip');
  box.innerHTML = '';
  if (state.info.kind !== 'hero') return;
  const items = state.manifest.items;
  for (const slot of ['casque', 'gilet', 'outil']) {
    const lab = document.createElement('label');
    lab.textContent = slot[0].toUpperCase() + slot.slice(1);
    const s = document.createElement('select');
    s.add(new Option('(aucun)', ''));
    for (const [n, it] of Object.entries(items)) if (it.slot === slot) s.add(new Option(n, n));
    s.id = `eq-${slot}`;
    s.onchange = () => setEquip({ ...state.equip, [slot]: s.value || null });
    lab.appendChild(s);
    box.appendChild(lab);
  }
}

async function setEquip(eq) {
  for (const o of state.equipObjs) o.removeFromParent();
  state.equipObjs = [];
  state.equip = { ...eq };
  const items = state.manifest.items;
  let calls = 0;
  for (const [slot, name] of Object.entries(eq)) {
    const s = document.getElementById(`eq-${slot}`);
    if (s) s.value = name ?? '';
    if (!name) continue;
    const it = items[name];
    const gltf = await load(it.file);
    if (it.skinned) {
      // vêtement skinné : on relie ses os à ceux du héros (mêmes noms, contrat de squelette)
      const src = skClone(gltf.scene);
      const meshes = [];
      src.traverse((o) => o.isSkinnedMesh && meshes.push(o));
      const heroMesh = findSkinned(state.root);
      for (const m of meshes) {
        const bones = m.skeleton.bones.map((b) => state.root.getObjectByName(b.name));
        heroMesh.parent.add(m);
        m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix);
        const r = toonify([m], state.shared, { outlineColor: state.outlineColor, outlineWidth: 2.6 * +(params.get('ow') ?? 1) });
        calls += r.calls;
        state.equipObjs.push(m, ...r.outlines);
      }
    } else {
      const socket = state.root.getObjectByName(it.socket);
      if (!socket) continue;
      const obj = gltf.scene.clone(true);
      calls += toonify(obj, state.shared, { outlineColor: state.outlineColor, outlineWidth: 2.6 * +(params.get('ow') ?? 1) }).calls;
      socket.add(obj);
      state.equipObjs.push(obj);
    }
  }
  state.equipCalls = calls;
  updateInfo();
}

function findSkinned(root) {
  let s = null;
  root.traverse((o) => {
    if (!s && o.isSkinnedMesh && !o.userData.outline) s = o;
  });
  return s;
}

function playClip(name) {
  const a = state.actions[name];
  if (!a) return;
  state.mixer.stopAllAction();
  a.reset().play();
  state.clip = name;
  for (const b of el('clips').children) b.classList.toggle('on', b.dataset.clip === name);
  state.holdUntil = 0;
}

function setCam(name, yaw = state.yaw, zoom = 1, ty = null) {
  state.cam = name;
  state.yaw = yaw;
  const b = state.box;
  const h = b ? b.max.y : state.info?.height ?? 2;
  const size = b ? b.getSize(new THREE.Vector3()) : new THREE.Vector3(1, h, 1);
  const span = Math.max(h * 1.05, size.x * 0.95, size.z * 0.85, 1.6);
  const el2 = { game: 41.5, threequarter: 18, front: 6, side: 6, back: 12, portrait: 9 }[name] ?? 18;
  const az = ({ game: 0, threequarter: 35, front: 0, side: 90, back: 180, portrait: 30 }[name] ?? 0) + yaw;
  const fit = (span * 0.56) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const d = (name === 'game' ? fit * 1.25 : fit) / zoom;
  const e = THREE.MathUtils.degToRad(el2);
  const a = THREE.MathUtils.degToRad(az);
  const target = new THREE.Vector3(b ? (b.min.x + b.max.x) / 2 : 0, ty ?? h * 0.47, b ? (b.min.z + b.max.z) / 2 : 0);
  camera.position.set(Math.sin(a) * Math.cos(e) * d, target.y + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d);
  camera.lookAt(target);
}

function updateInfo() {
  if (!state.info) return;
  const i = state.info;
  const kb = (b) => (b ? `${(b / 1024).toFixed(1)} Kio` : '?');
  el('info').textContent = [
    `${state.name} · ${i.kind}`,
    `${i.triangles} tris · ${i.bones} os · ${i.sockets.length} sockets`,
    `GLB ${kb(i.bytes)} (${i.compression ?? 'brut'}, brut ${kb(i.bytesRaw)})`,
    `appels de rendu : ${state.calls} (+${state.equipCalls ?? 0} équipement)`,
    `hauteur ${i.height} m · rayon ${i.radius} m`,
    `sockets : ${i.sockets.join(', ')}`,
  ].join('\n');
}

function resize() {
  const w = SHOT ? +(params.get('w') ?? 720) : innerWidth;
  const h = SHOT ? +(params.get('h') ?? 720) : innerHeight;
  renderer.setSize(w, h, !SHOT);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const v = new THREE.Vector2();
  renderer.getDrawingBufferSize(v);
  outlineUniforms.uRes.value.copy(v);
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let time = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  if (!SHOT) {
    time += dt;
    tick(dt * state.speed);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

function tick(dt) {
  if (!state.mixer) return;
  state.mixer.update(dt);
  const a = state.actions[state.clip];
  // clips non bouclés : petite pause puis on rejoue (lecture interactive)
  if (a && !a.isRunning() && !SHOT) {
    if (!state.holdUntil) state.holdUntil = time + 0.7;
    else if (time > state.holdUntil) playClip(state.clip);
  }
  for (const b of state.runtimeBones) b.rotation.y += dt * 1.2;
  if (state.turn) state.root.rotation.y += dt * 0.6;
  if (state.shared) state.shared.uTime.value = time;
}

// ─── API de capture (Playwright) ─────────────────────────────────────────────────
window.viewer = {
  async model(name, equip = null) {
    await setModel(name);
    if (equip) await setEquip(equip);
    return true;
  },
  async equip(eq) {
    await setEquip(eq);
    return true;
  },
  pose(clip, t, yaw = 0, cam = 'threequarter', tele = 0, zoom = 1, ty = null) {
    playClip(clip);
    state.mixer.setTime(t);
    for (const b of state.runtimeBones) b.rotation.y = t * 1.2;
    state.shared.uTelegraph.value = tele;
    state.shared.uTime.value = t;
    setCam(cam, yaw, zoom, ty);
    renderer.render(scene, camera);
    return true;
  },
  /** Mode portrait : couleurs et intensités des deux contre-jours, liseré du shader toon. */
  stage(o = {}) {
    if (o.rimA != null) rimA.color.set(o.rimA);
    if (o.rimB != null) rimB.color.set(o.rimB);
    if (o.rimAI != null) rimA.intensity = o.rimAI;
    if (o.rimBI != null) rimB.intensity = o.rimBI;
    if (o.rim != null && state.shared) state.shared.uRimColor.value.set(o.rim);
    if (o.rimStrength != null && state.shared) state.shared.uRimStrength.value = o.rimStrength;
    if (o.exposure != null) renderer.toneMappingExposure = o.exposure;
    return true;
  },
  info() {
    return { ...state.info, calls: state.calls, equipCalls: state.equipCalls ?? 0, renderCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  },
  manifest() {
    return state.manifest;
  },
};

init().then(() => {
  window.viewerReady = true;
});
requestAnimationFrame(frame);
void PAL;
