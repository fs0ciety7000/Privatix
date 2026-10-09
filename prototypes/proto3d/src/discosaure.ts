// Le Discosaure (élite) : dinosaure trapu à la T-rex, une énorme boule à facettes vissée sur le dos.
// La boule (petits miroirs métalliques en flat shading + reflets d'environnement colorés) projette
// des taches de lumière qui tournent sur le sol et le mur du fond.
// Attaques : piétinement (onde de choc circulaire télégraphiée) et charge (couloir télégraphié).
import * as THREE from 'three';
import { easeOut, keyed, Rig, type Pose } from './rig';
import { canvasTexture, glow, makeFlash, PAL, radialTexture, toon, type Flash } from './toon';
import { DiscTelegraph, Telegraph } from './fx';
import type { Foe, HitInfo, World } from './types';
import { fxFlags } from './quality';

const STOMP_WINDUP = 1050;
const STOMP_ACTIVE = 160;
const STOMP_RECOVER = 900;
const STOMP_R = 3.9;
const CHARGE_WINDUP = 950;
const CHARGE_SPEED = 13;
const CHARGE_DIST = 10.5;
const CHARGE_W = 2.6;
const CRASH_STUN = 1300;
const WALK_SPEED = 1.7;

const DISCO_COLORS = [0xff3ea5, 0x6ff3ff, 0xffe14a, 0xb05cff, 0x5dff8a, 0xff8a2a, 0xffffff, 0x3a8cff];

type State = 'spawn' | 'walk' | 'stompWindup' | 'stomp' | 'stompRecover' | 'chargeWindup' | 'charge' | 'crash' | 'chargeRecover' | 'dead';

/** Texture des facettes : un carreau par segment de la sphère, joints sombres, teintes variées. */
function facetTexture(cols: number, rows: number): THREE.CanvasTexture {
  const cw = 16;
  const ch = 16;
  const t = canvasTexture(cols * cw, rows * ch, (g) => {
    g.fillStyle = '#0c0a14';
    g.fillRect(0, 0, cols * cw, rows * ch);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const v = 120 + Math.floor(Math.random() * 135);
        const tint = Math.random();
        const r = tint < 0.08 ? 255 : v;
        const gg = tint > 0.92 ? 255 : v;
        const b = Math.min(255, v + 18);
        g.fillStyle = `rgb(${r},${gg},${b})`;
        g.fillRect(x * cw + 2, y * ch + 2, cw - 4, ch - 4);
      }
  });
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  return t;
}

export class Discosaure implements Foe {
  readonly elite = true;
  readonly name = 'Discosaure';
  readonly rig = new Rig();
  readonly flash: Flash = makeFlash();
  readonly pos = new THREE.Vector3();
  readonly radius = 1.35;
  hp = 420;
  readonly maxHp = 420;
  removed = false;
  facing = 0;
  state: State = 'spawn';
  private t = 0;
  private vel = new THREE.Vector3();
  private kb = new THREE.Vector3();
  private cooldown = 1200;
  private walkPhase = 0;
  private lastStep = 0;
  private hitFlash = 0;
  private flinch = 0;
  private chargeDir = new THREE.Vector3();
  private chargeDone = 0;
  private chargeHit = false;
  private ball: THREE.Mesh;
  private ballPivot: THREE.Group;
  private ballSpin = 0;
  private glints: THREE.Points;
  private floorSpots: THREE.InstancedMesh;
  private wallSpots: THREE.InstancedMesh;
  /** 9 rayons visibles en un seul appel de rendu (instanciés, couleur par instance). */
  private beams: THREE.InstancedMesh;
  /** rotation des taches (figée en réduction des mouvements) */
  private spotSpin = 0;
  private spotDirs: Array<{ az: number; el: number; color: THREE.Color }> = [];
  private spotFade = 0;
  private eyeMat: THREE.MeshBasicMaterial;
  private stompTele: DiscTelegraph;
  private chargeTele: Telegraph;
  private ballBroken = false;
  private hasToken = false;
  private readonly id = 9000 + Math.floor(Math.random() * 1000);

  constructor(private readonly world: World, pos: THREE.Vector3) {
    this.pos.copy(pos);
    const f = this.flash;
    const m = (c: number, rim = 1.0, o: Partial<Parameters<typeof toon>[1]> = {}) => toon(c, { rimStrength: rim, rim: 0x6ff3ff, flash: f, ...o });
    const hide = m(0x7a2fd8, 1.1);
    const hideDark = m(0x4a1a9a, 0.7);
    const belly = m(0xff5ab8, 0.8, { rim: 0xffe14a });
    const gold = m(0xffc83a, 1.4, { emissive: 0xff9a00, emissiveIntensity: 0.25, rim: 0xffffff });
    const spike = m(0xff3ea5, 0.8, { emissive: 0xff3ea5, emissiveIntensity: 0.45 });
    const mouth = m(0x3a0820, 0);
    const teeth = m(0xfff6e8, 0.3);
    const r = this.rig;
    r.outlineWidth = 3.2;

    r.joint('pelvis', null, [0, 2.0, 0]);
    r.joint('chest', 'pelvis', [0, 0.45, 1.3]);
    r.joint('neck', 'chest', [0, 0.4, 0.75]);
    r.joint('head', 'neck', [0, 0.35, 0.45]);
    r.joint('jaw', 'head', [0, -0.05, 0.25]);
    for (const [s, sx] of [
      ['L', 1],
      ['R', -1],
    ] as const) {
      r.joint(`hip_${s}`, 'pelvis', [0.8 * sx, -0.05, 0.05]);
      r.joint(`knee_${s}`, `hip_${s}`, [0, -0.95, 0.4]);
      r.joint(`ankle_${s}`, `knee_${s}`, [0, -0.78, -0.42]);
      r.joint(`arm_${s}`, 'chest', [0.62 * sx, -0.3, 0.5]);
      r.joint(`fore_${s}`, `arm_${s}`, [0, -0.32, 0.05]);
    }
    r.joint('tail0', 'pelvis', [0, 0.15, -0.95]);
    r.joint('tail1', 'tail0', [0, -0.05, -0.85]);
    r.joint('tail2', 'tail1', [0, -0.03, -0.75]);
    r.joint('tail3', 'tail2', [0, -0.02, -0.6]);
    r.joint('ball', 'pelvis', [0, 1.45, 0.35]);

    // Corps : gros tonneau violet, ventre rose
    r.sphere('pelvis', hide, [0, 0.2, 0.25], [1.15, 1.05, 1.45]);
    r.sphere('pelvis', belly, [0, -0.2, 0.55], [0.95, 0.8, 1.15]);
    r.sphere('chest', hide, [0, 0.0, 0.1], [0.95, 0.9, 0.95]);
    r.sphere('chest', belly, [0, -0.25, 0.35], [0.75, 0.65, 0.65]);
    r.sphere('neck', hide, [0, 0.05, 0.1], [0.62, 0.62, 0.7]);
    // rayures sombres sur les flancs (lecture des volumes vus de haut)
    for (let i = 0; i < 4; i++) {
      for (const sx of [1, -1]) r.box('pelvis', hideDark, [sx * (1.02 - Math.abs(i - 1.5) * 0.06), 0.45, -0.55 + i * 0.42], [0.12, 0.5, 0.16], 0.05, { rot: [0, 0, -sx * 25], outline: false });
    }
    // Tête : crâne, museau, mâchoire, yeux lumineux, arcades
    r.sphere('head', hide, [0, 0.22, 0.15], [0.74, 0.62, 0.78]);
    r.box('head', hide, [0, 0.1, 1.0], [0.9, 0.48, 1.35], 0.22);
    r.box('head', hideDark, [0, 0.38, 0.5], [0.95, 0.18, 0.42], 0.08); // arcades
    for (let i = 0; i < 3; i++) r.box('head', hideDark, [0, 0.36 - i * 0.02, 0.95 + i * 0.3], [0.5 - i * 0.08, 0.06, 0.14], 0.03, { outline: false }); // rayures
    r.box('jaw', belly, [0, -0.15, 0.7], [0.82, 0.26, 1.3], 0.12);
    r.box('jaw', mouth, [0, -0.03, 0.7], [0.7, 0.06, 1.18], 0.03, { outline: false });
    for (let i = 0; i < 5; i++) {
      for (const sx of [1, -1]) {
        const z = 0.45 + i * 0.22;
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), teeth);
        tooth.position.set(sx * 0.37, -0.13, z);
        tooth.rotation.x = Math.PI;
        r.j('head').add(tooth);
        const t2 = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 6), teeth);
        t2.position.set(sx * 0.32, 0.02, z + 0.1);
        r.j('jaw').add(t2);
      }
    }
    this.eyeMat = glow(0x6ff3ff, 5);
    for (const sx of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), this.eyeMat);
      eye.position.set(0.43 * sx, 0.36, 0.6);
      eye.scale.set(0.7, 1, 0.8);
      r.j('head').add(eye);
      r.sphere('head', hideDark, [0.2 * sx, 0.3, 1.6], [0.07, 0.05, 0.06], { outline: false }); // narines
    }
    // Chaîne en or au cou
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.06, 8, 28), gold);
    chain.rotation.x = Math.PI / 2 - 0.5;
    chain.position.set(0, -0.12, 0.1);
    chain.castShadow = true;
    r.j('neck').add(chain);
    const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 16).rotateX(Math.PI / 2), gold);
    medal.position.set(0, -0.55, 0.62);
    r.j('neck').add(medal);
    // Petits bras griffus
    for (const s of ['L', 'R']) {
      r.capsule(`arm_${s}`, hide, [0, 0, 0], [0, -0.32, 0.05], 0.14);
      r.capsule(`fore_${s}`, hide, [0, 0, 0], [0, -0.05, 0.3], 0.11);
      for (const dx of [-0.06, 0.06]) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 6), gold);
        c.position.set(dx, -0.05, 0.42);
        c.rotation.x = Math.PI / 2;
        r.j(`fore_${s}`).add(c);
      }
    }
    // Pattes puissantes
    for (const s of ['L', 'R']) {
      r.sphere(`hip_${s}`, hide, [0, -0.35, 0.15], [0.5, 0.75, 0.62]);
      r.capsule(`knee_${s}`, hide, [0, 0, 0], [0, -0.78, -0.42], 0.24);
      r.box(`ankle_${s}`, hideDark, [0, -0.08, 0.32], [0.55, 0.28, 0.95], 0.12);
      for (const dx of [-0.17, 0, 0.17]) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26, 6), gold);
        c.position.set(dx, -0.12, 0.88);
        c.rotation.x = Math.PI / 2;
        c.castShadow = true;
        r.j(`ankle_${s}`).add(c);
      }
    }
    // Queue avec épines magenta
    const tailR = [0.5, 0.38, 0.26, 0.15];
    for (let i = 0; i < 4; i++) {
      const L = [0.85, 0.75, 0.6, 0.5][i];
      r.capsule(`tail${i}`, hide, [0, 0, 0], [0, -0.03, -L], tailR[i]);
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.11 * (1 - i * 0.18), 0.32 * (1 - i * 0.15), 6), spike);
      sp.position.set(0, tailR[i] + 0.05, -L * 0.5);
      sp.rotation.x = -0.4;
      sp.castShadow = true;
      r.j(`tail${i}`).add(sp);
    }
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 6), spike);
      sp.position.set(0, 0.62 - i * 0.06, 0.55 + i * 0.32);
      sp.rotation.x = 0.35;
      sp.position.set(0, 0.78, -0.25 + i * 0.36);
      r.j('chest').add(sp);
    }

    this.rig.optimize();

    // Socle doré de la boule (anneau + collier)
    const base = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.11, 10, 28), gold);
    base.rotation.x = Math.PI / 2;
    base.position.set(0, -0.78, 0);
    base.castShadow = true;
    r.j('ball').add(base);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.35, 16), gold);
    strut.position.set(0, -0.95, 0);
    r.j('ball').add(strut);

    // Boule à facettes : petits miroirs métalliques, flat shading, reflets d'environnement colorés
    const COLS = 30;
    const ROWS = 18;
    const ballGeo = new THREE.SphereGeometry(1.0, COLS, ROWS);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: facetTexture(COLS, ROWS),
      metalness: 1.0,
      roughness: 0.16,
      flatShading: true,
      envMap: world.discoEnv,
      envMapIntensity: 1.25,
    });
    this.ballPivot = new THREE.Group();
    r.j('ball').add(this.ballPivot);
    this.ball = new THREE.Mesh(ballGeo, ballMat);
    this.ball.castShadow = true;
    this.ballPivot.add(this.ball);
    const outline = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: PAL.outline, side: THREE.BackSide }));
    outline.scale.setScalar(1.035);
    outline.userData.outline = true;
    this.ballPivot.add(outline);
    // Étincelles sur les facettes
    const N = 46;
    const gp = new Float32Array(N * 3);
    const gs = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(1 - u * u) * 1.02;
      gp[i * 3] = Math.cos(a) * rr;
      gp[i * 3 + 1] = u * 1.02;
      gp[i * 3 + 2] = Math.sin(a) * rr;
      gs[i] = Math.random() * 50;
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(gp, 3));
    gg.setAttribute('aSeed', new THREE.BufferAttribute(gs, 1));
    this.glints = new THREE.Points(
      gg,
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uScale: { value: 500 } },
        vertexShader: /* glsl */ `
          attribute float aSeed; uniform float uTime; uniform float uScale; varying float vA;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vec3 n = normalize(mat3(modelViewMatrix) * position);
            float facing = clamp(n.z, 0.0, 1.0);
            float tw = pow(max(0.0, sin(uTime * (2.0 + fract(aSeed) * 3.0) + aSeed)), 24.0);
            vA = tw * facing;
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (0.25 + 0.35 * tw) * uScale / -mv.z;
          }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main(){
            vec2 p = gl_PointCoord - 0.5;
            float star = max(0.0, 1.0 - abs(p.x) * 14.0 - abs(p.y) * 2.2) + max(0.0, 1.0 - abs(p.y) * 14.0 - abs(p.x) * 2.2);
            float core = 1.0 - smoothstep(0.0, 0.18, length(p));
            float a = (star + core) * vA;
            gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * a * 3.0, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.glints.frustumCulled = false;
    this.glints.userData.noGhost = true;
    this.ballPivot.add(this.glints);

    // Taches de lumière (sol + mur du fond) et quelques rayons visibles
    for (let i = 0; i < 30; i++) {
      this.spotDirs.push({
        az: (i / 30) * Math.PI * 2 + Math.random() * 0.2,
        el: -0.22 - Math.random() * 0.75,
        color: new THREE.Color(DISCO_COLORS[i % DISCO_COLORS.length]).multiplyScalar(1.6),
      });
    }
    const spotTex = radialTexture();
    const spotMat = new THREE.MeshBasicMaterial({ map: spotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff });
    this.floorSpots = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), spotMat, 30);
    this.wallSpots = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), spotMat, 30);
    for (const im of [this.floorSpots, this.wallSpots]) {
      im.frustumCulled = false;
      im.renderOrder = 4;
      for (let i = 0; i < 30; i++) im.setColorAt(i, this.spotDirs[i].color);
      world.scene.add(im);
    }
    const beamMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vCol;
        void main(){
          vUv = uv;
          vec4 p = vec4(position, 1.0);
          vCol = vec3(1.0);
          #ifdef USE_INSTANCING
            p = instanceMatrix * p;
          #endif
          #ifdef USE_INSTANCING_COLOR
            vCol = instanceColor;
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * p;
        }`,
      fragmentShader: /* glsl */ `varying vec2 vUv; varying vec3 vCol; void main(){ float a = pow(vUv.y, 1.5) * 0.28; gl_FragColor = vec4(vCol * a, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    // cylindre de hauteur 1 couché sur +Y : uv.y = 1 côté boule
    this.beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.2, 1, 8, 1, true).translate(0, -0.5, 0), beamMat, 9);
    this.beams.renderOrder = 4;
    this.beams.frustumCulled = false;
    for (let i = 0; i < 9; i++) {
      this.beams.setColorAt(i, this.spotDirs[i * 3].color);
      this.beams.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    }
    world.scene.add(this.beams);

    this.stompTele = new DiscTelegraph(STOMP_R, PAL.danger);
    this.chargeTele = new Telegraph(CHARGE_W, CHARGE_DIST + 1.5, PAL.danger);
    world.scene.add(this.stompTele.mesh, this.chargeTele.mesh);

    this.rig.root.position.copy(this.pos);
    world.scene.add(this.rig.root);
    // Entrée : chute du plafond
    this.rig.root.position.y = 9;
    world.rings.spawn(this.pos, PAL.danger, 3.2, 0.4, 0.9, 0.12, 0.25, 2.4);
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  get spawning(): boolean {
    return this.state === 'spawn';
  }

  place(x: number, z: number): void {
    this.pos.set(x, 0, z);
    this.rig.root.position.x = x;
    this.rig.root.position.z = z;
  }

  faceCamera(): void {}

  /** Démo : déclenche une attaque tout de suite. */
  force(kind: 'stomp' | 'charge'): void {
    if (!this.alive || this.state === 'spawn') return;
    this.takeToken();
    this.facing = Math.atan2(this.world.heroPos().x - this.pos.x, this.world.heroPos().z - this.pos.z);
    this.begin(kind === 'stomp' ? 'stompWindup' : 'chargeWindup');
  }

  private ballWorld(): THREE.Vector3 {
    return this.ball.getWorldPosition(new THREE.Vector3());
  }

  hit(h: HitInfo, from: THREE.Vector3): void {
    if (!this.alive) return;
    this.hp -= h.damage;
    this.hitFlash = 1;
    const dir = this.pos.clone().sub(from).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    this.kb.copy(dir).multiplyScalar(h.knockback * 1.6);
    this.flinch = h.heavy ? 1 : 0.5;
    this.rig.punchScale(h.heavy ? [1.08, 0.92, 1.08] : [1.04, 0.96, 1.04]);
    const w = this.world;
    const p = this.pos.clone().setY(1.9).addScaledVector(dir, -1.0);
    w.dmg.spawn(p.clone().setY(3.4), String(h.damage), h.crit ? 'crit' : h.heavy ? 'big' : 'normal');
    w.bursts.spawn(p, h.crit ? 0xfff0a0 : 0xffffff, h.heavy ? 3.2 : 2.2, 0.14, 3.2);
    w.sparks.burst(p, dir.clone().negate(), h.heavy ? 26 : 14, 0xffd27a, 9, 1.2, 0.4, 0.04, 3);
    // quelques paillettes tombent de la boule à chaque coup
    const bp = this.ballWorld();
    for (let i = 0; i < (h.heavy ? 14 : 6); i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4);
      w.glows.emit(bp, v, DISCO_COLORS[i % DISCO_COLORS.length], 0.9 + Math.random() * 0.6, 0.1, { grav: 5, drag: 1.2 });
    }
    if (this.hp <= 0) this.die(dir);
  }

  private die(dir: THREE.Vector3): void {
    this.state = 'dead';
    this.t = 0;
    this.hp = 0;
    this.hitFlash = 0.3;
    this.stompTele.mesh.visible = false;
    this.chargeTele.mesh.visible = false;
    this.releaseToken();
    this.kb.copy(dir).multiplyScalar(2);
    const w = this.world;
    const c = this.ballWorld();
    // La boule éclate en paillettes
    this.ballBroken = true;
    this.ballPivot.visible = false;
    w.slowmo(0.3, 1100);
    w.hitstop(180);
    w.shake.add(1);
    w.bursts.spawn(c, 0xffffff, 4.2, 0.22, 2.2);
    w.bursts.spawn(c, 0xff3ea5, 3.2, 0.3, 1.6);
    w.rings.spawn(this.pos, 0xffffff, 0.5, 7, 0.7, 0.12, 0.05, 2);
    w.rings.spawn(this.pos, 0xff3ea5, 0.3, 5, 0.9, 0.2, 0.1, 2);
    for (let i = 0; i < 280; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(5 + Math.random() * 11);
      v.y = Math.abs(v.y) * 0.8 + 2;
      w.sparks.emit(c, v, DISCO_COLORS[i % DISCO_COLORS.length], 0.8 + Math.random() * 1.2, 0.045, 7, 0.8, true);
    }
    for (let i = 0; i < 110; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(3 + Math.random() * 7);
      v.y = Math.abs(v.y) + 1;
      w.glows.emit(c.clone().add(v.clone().multiplyScalar(0.15)), v, DISCO_COLORS[i % DISCO_COLORS.length], 1.6 + Math.random() * 1.6, 0.05 + Math.random() * 0.05, { grav: 1.6, drag: 1.4, alpha: 0.8 });
    }
    for (let i = 0; i < 90; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(3 + Math.random() * 8);
      v.y = Math.abs(v.y) + 2;
      const col = i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xc8d4ff : DISCO_COLORS[i % DISCO_COLORS.length];
      w.puffs.emit(c, v, col, 1.4 + Math.random(), 0.1 + Math.random() * 0.08, { grav: 12, drag: 0.6, alpha: 1, shape: 1 });
    }
    w.onEnemyDeath(this.pos.clone());
  }

  private takeToken(): boolean {
    if (this.hasToken) return true;
    this.hasToken = this.world.requestToken(this.id);
    return this.hasToken;
  }

  private releaseToken(): void {
    if (this.hasToken) this.world.releaseToken(this.id);
    this.hasToken = false;
  }

  update(dtS: number): void {
    const dt = dtS * 1000;
    this.t += dt;
    const w = this.world;
    const toHero = w.heroPos().clone().sub(this.pos).setY(0);
    const dist = toHero.length();
    const heroAngle = Math.atan2(toHero.x, toHero.z);
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));

    switch (this.state) {
      case 'spawn': {
        const p = this.rig.root.position;
        p.y = Math.max(0, 9 - (this.t / 550) ** 2 * 9);
        this.facing = heroAngle;
        if (p.y <= 0) {
          this.state = 'walk';
          this.t = 0;
          w.shake.add(0.9);
          w.hitstop(90);
          w.rings.spawn(this.pos, 0xffffff, 0.5, 5, 0.6, 0.15, 0.3, 2.6);
          w.puffs.dustRing(this.pos, 22, 1.2, 0x5a5070, 5);
          this.rig.punchScale([1.25, 0.72, 1.25]);
        }
        break;
      }
      case 'walk': {
        this.cooldown -= dt;
        this.turnTo(heroAngle, dtS, 2.6);
        const want = dist > 2.6 ? WALK_SPEED : 0;
        this.vel.lerp(fwd.clone().multiplyScalar(want), 1 - Math.exp(-4 * dtS));
        if (this.cooldown <= 0 && this.takeToken()) {
          if (dist < STOMP_R - 0.4) this.begin('stompWindup');
          else if (dist > 4.5) {
            this.begin('chargeWindup');
            this.facing = heroAngle;
          } else if (dist < STOMP_R + 0.6) this.begin('stompWindup');
        }
        break;
      }
      case 'stompWindup': {
        this.vel.multiplyScalar(Math.exp(-10 * dtS));
        const k = this.t / STOMP_WINDUP;
        const tm = this.stompTele.mat.uniforms;
        this.stompTele.mesh.visible = true;
        this.stompTele.mesh.position.set(this.pos.x, 0.035, this.pos.z);
        tm.uProgress.value = Math.min(1, k * 1.04);
        tm.uAlpha.value = Math.min(1, k * 4);
        tm.uTime.value = w.time;
        this.eyeMat.color.setHex(PAL.danger).multiplyScalar(3 + k * 4);
        if (this.t >= STOMP_WINDUP) {
          this.begin('stomp');
          this.doStomp();
        }
        break;
      }
      case 'stomp': {
        this.stompTele.mat.uniforms.uAlpha.value = Math.max(0, 1 - this.t / STOMP_ACTIVE);
        if (this.t >= STOMP_ACTIVE) {
          this.stompTele.mesh.visible = false;
          this.begin('stompRecover');
        }
        break;
      }
      case 'stompRecover':
      case 'chargeRecover': {
        this.vel.multiplyScalar(Math.exp(-8 * dtS));
        if (this.t >= (this.state === 'stompRecover' ? STOMP_RECOVER : 700)) this.endAttack();
        break;
      }
      case 'chargeWindup': {
        this.vel.multiplyScalar(Math.exp(-10 * dtS));
        if (this.t < CHARGE_WINDUP * 0.55) this.turnTo(heroAngle, dtS, 6);
        const k = this.t / CHARGE_WINDUP;
        const tm = this.chargeTele.mat.uniforms;
        this.chargeTele.mesh.visible = true;
        this.chargeTele.mesh.position.set(this.pos.x, 0.03, this.pos.z);
        this.chargeTele.mesh.rotation.y = this.facing;
        tm.uProgress.value = Math.min(1, k * 1.05);
        tm.uAlpha.value = Math.min(1, k * 4);
        tm.uTime.value = w.time;
        this.eyeMat.color.setHex(PAL.danger).multiplyScalar(3 + k * 4);
        // gratte le sol
        if (Math.random() < 0.3) w.puffs.emit(this.pos.clone().addScaledVector(fwd, 0.6).setY(0.1), fwd.clone().multiplyScalar(-3).setY(1), 0x5a5070, 0.5, 0.35, { grow: 0.8, drag: 3, alpha: 0.5 });
        if (this.t >= CHARGE_WINDUP) {
          this.begin('charge');
          this.chargeDir.copy(fwd);
          this.chargeDone = 0;
          this.chargeHit = false;
          w.shake.add(0.35);
        }
        break;
      }
      case 'charge': {
        this.chargeTele.mat.uniforms.uAlpha.value = Math.max(0.25, 1 - this.t / 500);
        this.vel.copy(this.chargeDir).multiplyScalar(CHARGE_SPEED);
        const before = this.pos.clone();
        this.pos.addScaledVector(this.vel, dtS);
        w.collide(this.pos, this.radius);
        const moved = this.pos.distanceTo(before);
        this.chargeDone += moved;
        this.vel.set(0, 0, 0);
        const head = this.pos.clone().addScaledVector(this.chargeDir, 1.6);
        if (!this.chargeHit && head.distanceTo(w.heroPos()) < 1.5) this.chargeHit = w.heroHit(22, this.pos);
        if (Math.random() < 0.8) w.puffs.emit(this.pos.clone().setY(0.15), this.chargeDir.clone().multiplyScalar(-2).setY(0.6), 0x5a5070, 0.6, 0.45, { grow: 1.2, drag: 3, alpha: 0.55 });
        if (moved < CHARGE_SPEED * dtS * 0.5) {
          // percute un mur ou un obstacle : sonné (fenêtre de punition)
          this.chargeTele.mesh.visible = false;
          this.begin('crash');
          w.shake.add(0.9);
          w.hitstop(80);
          const p = this.pos.clone().addScaledVector(this.chargeDir, 1.8).setY(1.2);
          w.bursts.spawn(p, 0xffffff, 3.5, 0.2, 3);
          w.sparks.burst(p, this.chargeDir.clone().negate(), 26, 0xffd27a, 9, 1.4, 0.5, 0.04, 4);
          w.puffs.dustRing(this.pos, 16, 1, 0x5a5070, 4);
          this.rig.punchScale([1.15, 0.85, 0.8]);
        } else if (this.chargeDone >= CHARGE_DIST) {
          this.chargeTele.mesh.visible = false;
          this.begin('chargeRecover');
          w.puffs.dustRing(this.pos, 10, 0.8, 0x5a5070, 3);
        }
        break;
      }
      case 'crash': {
        if (Math.random() < 0.15) {
          const hp = this.headPos();
          const a = w.time * 6;
          w.glows.emit(hp.clone().add(new THREE.Vector3(Math.cos(a) * 0.7, 0.5, Math.sin(a) * 0.7)), new THREE.Vector3(0, 0.3, 0), 0xffe14a, 0.5, 0.18);
        }
        if (this.t >= CRASH_STUN) this.endAttack();
        break;
      }
      case 'dead': {
        const k = Math.min(1, this.t / 900);
        this.rig.body.rotation.z = easeOut(k) * 1.45;
        this.rig.root.position.y = -Math.max(0, (this.t - 2200) / 1000) * 1.6;
        if (this.t > 2200) {
          const s = 1 - Math.min(1, (this.t - 2200) / 1000) * 0.6;
          this.rig.root.scale.setScalar(s);
          if (Math.random() < 0.6) w.glows.emit(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.3, (Math.random() - 0.5) * 3)), new THREE.Vector3(0, 1.4, 0), DISCO_COLORS[Math.floor(Math.random() * 8)], 0.7, 0.1);
        }
        if (this.t > 3200) this.remove();
        break;
      }
    }

    if (this.state !== 'charge' && this.state !== 'spawn') {
      this.pos.addScaledVector(this.vel, dtS);
      w.collide(this.pos, this.radius);
    }
    this.pos.addScaledVector(this.kb, dtS);
    this.kb.multiplyScalar(Math.exp(-8 * dtS));
    w.collide(this.pos, this.radius);
    this.rig.root.position.x = this.pos.x;
    this.rig.root.position.z = this.pos.z;
    this.rig.root.rotation.y = this.facing;

    this.hitFlash = Math.max(0, this.hitFlash - dtS * 8);
    this.flash.amount.value = this.hitFlash > 0.01 ? Math.min(0.32, this.hitFlash * 0.5) : 0;
    this.flinch = Math.max(0, this.flinch - dtS * 5);
    if (!this.state.endsWith('Windup') && this.state !== 'dead') this.eyeMat.color.setHex(0x6ff3ff).multiplyScalar(5);

    this.animate(dtS);
    this.updateDisco(dtS);
  }

  private headPos(): THREE.Vector3 {
    return this.rig.j('head').getWorldPosition(new THREE.Vector3());
  }

  private begin(s: State): void {
    this.state = s;
    this.t = 0;
  }

  private endAttack(): void {
    this.state = 'walk';
    this.t = 0;
    this.cooldown = 1300 + Math.random() * 1200;
    this.releaseToken();
  }

  private doStomp(): void {
    const w = this.world;
    const c = this.pos.clone().setY(0.05);
    w.rings.spawn(c, PAL.danger, 0.4, STOMP_R + 0.6, 0.4, 0.22, 0.2, 3);
    w.rings.spawn(c, 0xffffff, 0.3, STOMP_R, 0.25, 0.3, 0.5, 2.6);
    w.puffs.dustRing(c, 26, 1.0, 0x5a5070, 7);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 8;
      w.sparks.emit(c.clone().setY(0.1), new THREE.Vector3(Math.sin(a) * sp, 2 + Math.random() * 5, Math.cos(a) * sp), DISCO_COLORS[i % DISCO_COLORS.length], 0.6, 0.045);
    }
    w.shake.add(1);
    w.hitstop(70);
    const d = w.heroPos().distanceTo(this.pos);
    if (d < STOMP_R + 0.3) w.heroHit(18, this.pos);
  }

  private turnTo(target: number, dt: number, k: number): void {
    let d = target - this.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.facing += d * (1 - Math.exp(-k * dt));
  }

  /** Retire le Discosaure de la scène sans passer par sa mort (préchauffage des shaders). */
  discard(): void {
    this.remove();
  }

  private remove(): void {
    this.removed = true;
    const s = this.world.scene;
    s.remove(this.rig.root, this.stompTele.mesh, this.chargeTele.mesh, this.floorSpots, this.wallSpots, this.beams);
  }

  // ─── Boule et taches de lumière ───────────────────────────────────────────────

  private updateDisco(dt: number): void {
    const w = this.world;
    this.ballSpin += dt * (this.state === 'charge' ? 3.5 : 1.1);
    this.ballPivot.rotation.y = this.ballSpin;
    const rm = fxFlags.reducedMotion;
    // réduction des mouvements : ni scintillement des facettes, ni lasers, ni taches qui balaient/clignotent
    if (!rm) this.spotSpin = this.ballSpin;
    this.glints.visible = !rm;
    (this.glints.material as THREE.ShaderMaterial).uniforms.uTime.value = w.time;
    const targetFade = this.ballBroken || this.state === 'spawn' ? 0 : 1;
    this.spotFade += (targetFade - this.spotFade) * (1 - Math.exp(-(this.ballBroken ? 12 : 3) * dt));
    const c = this.ballWorld();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const WALL_Z = -14.15;
    const EDGE_Z = -5;
    const FAR_EDGE = -11.6;
    for (let i = 0; i < this.spotDirs.length; i++) {
      const sd = this.spotDirs[i];
      const az = sd.az + this.spotSpin;
      const ce = Math.cos(sd.el);
      const d = new THREE.Vector3(Math.sin(az) * ce, Math.sin(sd.el), Math.cos(az) * ce);
      let floorY = 0;
      let t = (floorY - c.y) / d.y;
      p.copy(c).addScaledVector(d, t);
      if (p.z < EDGE_Z && p.z > FAR_EDGE) {
        floorY = -1.0;
        t = (floorY - c.y) / d.y;
        p.copy(c).addScaledVector(d, t);
      }
      let onWall = false;
      if (p.z < WALL_Z && d.z < 0) {
        t = (WALL_Z - c.z) / d.z;
        p.copy(c).addScaledVector(d, t);
        onWall = true;
      }
      const flick = rm ? 0.85 : 0.75 + 0.25 * Math.sin(w.time * 5 + i);
      const size = (0.55 + 0.25 * (i % 3)) * this.spotFade * flick;
      if (!onWall) {
        // ellipse étirée dans la direction du rayon (incidence rasante)
        const stretch = Math.min(2.6, 1 / Math.max(0.3, -d.y));
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), az);
        s.set(size, 1, size * stretch);
        m.compose(p.setY(floorY + 0.03), q, s);
        this.floorSpots.setMatrixAt(i, m);
        this.wallSpots.setMatrixAt(i, zero);
      } else {
        q.identity();
        s.set(size * 1.4, size * 1.4, 1);
        m.compose(p.setZ(WALL_Z + 0.05), q, s);
        this.wallSpots.setMatrixAt(i, m);
        this.floorSpots.setMatrixAt(i, zero);
      }
      if (i % 3 === 0) {
        if (this.spotFade > 0.02 && !rm) {
          const len = c.distanceTo(p);
          q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
          s.set(this.spotFade, len, this.spotFade);
          m.compose(c, q, s);
          this.beams.setMatrixAt(i / 3, m);
        } else this.beams.setMatrixAt(i / 3, zero);
      }
    }
    this.beams.visible = this.spotFade > 0.02 && !rm;
    this.beams.instanceMatrix.needsUpdate = true;
    this.floorSpots.instanceMatrix.needsUpdate = true;
    this.wallSpots.instanceMatrix.needsUpdate = true;
  }

  // ─── Animation ────────────────────────────────────────────────────────────────

  private animate(dt: number): void {
    const time = this.world.time;
    const sp = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / WALK_SPEED);
    let pose: Pose;
    let k = 9;
    switch (this.state) {
      case 'stompWindup':
        pose = keyed(
          [
            [0, idle(time)],
            [STOMP_WINDUP * 0.6, REAR, easeOut],
            [STOMP_WINDUP, rear(1)],
          ],
          this.t,
        );
        k = 10;
        break;
      case 'stomp':
        pose = STOMP;
        k = 40;
        break;
      case 'stompRecover':
        pose = keyed(
          [
            [0, STOMP],
            [STOMP_RECOVER * 0.5, STOMP],
            [STOMP_RECOVER, idle(time)],
          ],
          this.t,
        );
        break;
      case 'chargeWindup':
        pose = paw(time, this.t / CHARGE_WINDUP);
        k = 12;
        break;
      case 'charge':
        this.walkPhase += dt * Math.PI * 2 * 3.2;
        pose = run(this.walkPhase);
        k = 20;
        break;
      case 'crash':
        pose = dizzy(time);
        k = 10;
        break;
      case 'dead':
        pose = DEAD;
        k = 6;
        break;
      default: {
        if (sp > 0.1) {
          this.walkPhase += dt * Math.PI * 2 * 0.85 * sp;
          pose = walk(this.walkPhase);
          // pas lourds : petite secousse à chaque appui
          const step = Math.floor(this.walkPhase / Math.PI);
          if (step !== this.lastStep) {
            this.lastStep = step;
            this.world.shake.add(0.22);
            const foot = this.pos.clone().add(new THREE.Vector3(Math.cos(this.facing) * (step % 2 ? 0.8 : -0.8), 0, -Math.sin(this.facing) * (step % 2 ? 0.8 : -0.8)));
            this.world.puffs.dustRing(foot, 6, 0.4, 0x5a5070, 1.6);
          }
        } else pose = idle(time);
      }
    }
    if (this.flinch > 0) {
      const f = this.flinch;
      const add = (j: string, x: number) => {
        const r = pose.rot[j] ?? [0, 0, 0];
        pose.rot[j] = [r[0] + x * f, r[1], r[2]];
      };
      add('pelvis', -6);
      add('neck', -14);
      add('head', -10);
      add('jaw', 20);
    }
    // queue : balancement secondaire
    const tw = Math.sin(time * 1.8);
    for (let i = 0; i < 4; i++) {
      const r = pose.rot[`tail${i}`] ?? [0, 0, 0];
      pose.rot[`tail${i}`] = [r[0], r[1] + tw * (6 + i * 4) * (this.state === 'charge' ? 0.3 : 1), r[2]];
    }
    this.rig.apply(pose, dt, k);
  }
}

// ─── Poses ────────────────────────────────────────────────────────────────────

function idle(t: number): Pose {
  const b = Math.sin(t * 1.6);
  return {
    rot: {
      pelvis: [4 + b * 1.5, 0, 0],
      chest: [2, 0, 0],
      neck: [-8 - b * 3, Math.sin(t * 0.7) * 8, 0],
      head: [6 + b * 2, Math.sin(t * 0.7) * 6, 0],
      jaw: [6 + Math.max(0, Math.sin(t * 0.9)) * 8, 0, 0],
      arm_L: [30 + b * 6, 0, 10],
      arm_R: [30 - b * 6, 0, -10],
      fore_L: [-20, 0, 0],
      fore_R: [-20, 0, 0],
      hip_L: [-8, 0, 4],
      hip_R: [6, 0, -4],
      knee_L: [-4, 0, 0],
      ankle_L: [12, 0, 0],
      ankle_R: [-6, 0, 0],
      tail0: [8 + b * 2, 0, 0],
      tail1: [4, 0, 0],
      tail2: [-4, 0, 0],
      tail3: [-8, 0, 0],
    },
    root: [0, -0.04 + b * 0.03, 0],
    scale: [1 + b * 0.015, 1 - b * 0.012, 1 + b * 0.015],
  };
}

function walk(ph: number): Pose {
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  return {
    rot: {
      pelvis: [8, 6 * s, 4 * s],
      chest: [0, -6 * s, 0],
      neck: [-6, 4 * s, 0],
      head: [4, 4 * s, 0],
      jaw: [8, 0, 0],
      arm_L: [30 + 14 * s, 0, 10],
      arm_R: [30 - 14 * s, 0, -10],
      fore_L: [-24, 0, 0],
      fore_R: [-24, 0, 0],
      hip_L: [-26 * s, 0, 3],
      knee_L: [10 * Math.max(0, c), 0, 0],
      ankle_L: [26 * s - 10 * Math.max(0, c), 0, 0],
      hip_R: [26 * s, 0, -3],
      knee_R: [10 * Math.max(0, -c), 0, 0],
      ankle_R: [-26 * s - 10 * Math.max(0, -c), 0, 0],
      tail0: [10, -10 * s, 0],
      tail1: [4, -8 * s, 0],
      tail2: [-4, -6 * s, 0],
      tail3: [-6, -4 * s, 0],
    },
    root: [0, -0.06 + 0.12 * Math.abs(c), 0],
  };
}

function run(ph: number): Pose {
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  return {
    rot: {
      pelvis: [20, 4 * s, 0],
      chest: [8, 0, 0],
      neck: [16, 0, 0],
      head: [10, 0, 0],
      jaw: [26, 0, 0],
      arm_L: [70, 0, 10],
      arm_R: [70, 0, -10],
      hip_L: [-44 * s, 0, 3],
      knee_L: [20 * Math.max(0, c), 0, 0],
      ankle_L: [40 * s, 0, 0],
      hip_R: [44 * s, 0, -3],
      knee_R: [20 * Math.max(0, -c), 0, 0],
      ankle_R: [-40 * s, 0, 0],
      tail0: [-6, 0, 0],
      tail1: [-4, 0, 0],
      tail2: [-2, 0, 0],
      tail3: [0, 0, 0],
    },
    root: [0, -0.12 + 0.2 * Math.abs(c), 0],
    scale: [0.95, 1, 1.08],
  };
}

function rear(k: number): Pose {
  return {
    rot: {
      pelvis: [-26 - 4 * k, 0, 0],
      chest: [-10, 0, 0],
      neck: [-28, 0, 0],
      head: [-16, 0, 0],
      jaw: [42, 0, 0],
      arm_L: [-50, 0, 30],
      arm_R: [-50, 0, -30],
      fore_L: [-40, 0, 0],
      fore_R: [-40, 0, 0],
      hip_L: [10, 0, 6],
      knee_L: [10, 0, 0],
      ankle_L: [6, 0, 0],
      hip_R: [-70, 0, -6],
      knee_R: [-20, 0, 0],
      ankle_R: [60, 0, 0],
      tail0: [26, 0, 0],
      tail1: [12, 0, 0],
      tail2: [4, 0, 0],
      tail3: [0, 0, 0],
    },
    root: [0, 0.25 + 0.05 * k, -0.3],
    scale: [0.96, 1.06, 0.96],
  };
}
const REAR = rear(0);

const STOMP: Pose = {
  rot: {
    pelvis: [16, 0, 0],
    chest: [6, 0, 0],
    neck: [14, 0, 0],
    head: [12, 0, 0],
    jaw: [30, 0, 0],
    arm_L: [60, 0, 20],
    arm_R: [60, 0, -20],
    hip_L: [10, 0, 8],
    knee_L: [10, 0, 0],
    ankle_L: [-10, 0, 0],
    hip_R: [-26, 0, -8],
    knee_R: [16, 0, 0],
    ankle_R: [10, 0, 0],
    tail0: [-10, 0, 0],
    tail1: [-6, 0, 0],
  },
  root: [0, -0.32, 0.25],
  scale: [1.12, 0.86, 1.12],
};

function paw(t: number, k: number): Pose {
  const s = Math.sin(t * 16);
  return {
    rot: {
      pelvis: [18 + k * 6, 0, 0],
      chest: [6, 0, 0],
      neck: [22, 0, 0],
      head: [12, 0, 0],
      jaw: [12 + k * 18, 0, 0],
      arm_L: [50, 0, 14],
      arm_R: [50, 0, -14],
      hip_L: [-20, 0, 4],
      knee_L: [16, 0, 0],
      hip_R: [10 + s * 18, 0, -4],
      knee_R: [10, 0, 0],
      ankle_R: [-s * 20, 0, 0],
      tail0: [-14, 0, 0],
      tail1: [-8, 0, 0],
    },
    root: [0, -0.2, -0.3 * k],
    scale: [1.04, 0.95, 1.04],
  };
}

function dizzy(t: number): Pose {
  return {
    rot: {
      pelvis: [-6, 0, Math.sin(t * 3) * 5],
      chest: [0, 0, 0],
      neck: [-10, Math.sin(t * 5) * 20, Math.sin(t * 4) * 10],
      head: [-6, Math.sin(t * 5 + 1) * 14, 0],
      jaw: [24, 0, 0],
      arm_L: [10, 0, 30],
      arm_R: [10, 0, -30],
      hip_L: [-10, 0, 8],
      hip_R: [10, 0, -8],
      tail0: [4, 0, 0],
    },
    root: [0, -0.15, 0],
  };
}

const DEAD: Pose = {
  rot: {
    pelvis: [0, 0, 0],
    neck: [-30, 0, 20],
    head: [-20, 0, 10],
    jaw: [50, 0, 0],
    arm_L: [-60, 0, 50],
    arm_R: [-60, 0, -50],
    hip_L: [-40, 0, 10],
    hip_R: [-10, 0, -10],
    knee_L: [30, 0, 0],
    tail0: [20, 0, 0],
    tail1: [10, 0, 0],
  },
  root: [0, 0.4, 0],
};

