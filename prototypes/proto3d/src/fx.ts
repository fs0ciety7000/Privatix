// Effets : étincelles étirées, poussières, smears de coups, fantômes de dash, télégraphes au sol,
// ondes de choc, éclairs d'impact, nombres de dégâts.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ─── Étincelles (quads étirés le long de la vitesse, additifs) ──────────────────

const SPARK_VS = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec4 iColor;
attribute float iSize;
uniform float uStreak;
uniform float uAspect;
varying vec4 vColor;
varying vec2 vUv;
void main() {
  vColor = iColor;
  vUv = position.xy;
  vec4 p0 = projectionMatrix * viewMatrix * vec4(iPos, 1.0);
  vec4 p1 = projectionMatrix * viewMatrix * vec4(iPos - iVel * uStreak, 1.0);
  vec2 s0 = p0.xy / p0.w;
  vec2 s1 = p1.xy / max(p1.w, 0.001);
  vec2 d = s0 - s1;
  d.x *= uAspect;
  float len = length(d);
  float w = iSize * projectionMatrix[1][1] / p0.w;
  vec2 dir = len > 1e-5 ? d / len : vec2(0.0, 1.0);
  len = max(len, w * 1.6);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 ndc = vec2(s0.x * uAspect, s0.y) - dir * len * position.y + nrm * position.x * w * (1.0 - position.y * 0.6);
  ndc.x /= uAspect;
  gl_Position = vec4(ndc, p0.z / p0.w, 1.0);
  if (iColor.a <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const SPARK_FS = /* glsl */ `
varying vec4 vColor;
varying vec2 vUv;
void main() {
  float a = (1.0 - vUv.x * vUv.x) * (1.0 - vUv.y);
  gl_FragColor = vec4(vColor.rgb * a * vColor.a, 1.0);
}`;

interface SparkP {
  p: THREE.Vector3;
  v: THREE.Vector3;
  c: THREE.Color;
  life: number;
  max: number;
  size: number;
  grav: number;
  drag: number;
  bounce: boolean;
}

export class Sparks {
  readonly mesh: THREE.Mesh;
  private ps: SparkP[] = [];
  private iPos: THREE.InstancedBufferAttribute;
  private iVel: THREE.InstancedBufferAttribute;
  private iColor: THREE.InstancedBufferAttribute;
  private iSize: THREE.InstancedBufferAttribute;
  private mat: THREE.ShaderMaterial;
  private next = 0;

  constructor(private readonly cap = 700) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.iVel = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.iColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.iSize = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    for (const a of [this.iPos, this.iVel, this.iColor, this.iSize]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.iPos);
    g.setAttribute('iVel', this.iVel);
    g.setAttribute('iColor', this.iColor);
    g.setAttribute('iSize', this.iSize);
    g.instanceCount = cap;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VS,
      fragmentShader: SPARK_FS,
      uniforms: { uStreak: { value: 0.045 }, uAspect: { value: 16 / 9 } },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    for (let i = 0; i < cap; i++) {
      this.ps.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), life: 0, max: 1, size: 0.03, grav: 0, drag: 0, bounce: false });
    }
  }

  setAspect(a: number): void {
    this.mat.uniforms.uAspect.value = a;
  }

  emit(pos: THREE.Vector3, vel: THREE.Vector3, color: THREE.Color | number, life: number, size: number, grav = 9, drag = 1.5, bounce = true): void {
    const s = this.ps[this.next];
    this.next = (this.next + 1) % this.cap;
    s.p.copy(pos);
    s.v.copy(vel);
    if (typeof color === 'number') s.c.setHex(color);
    else s.c.copy(color);
    s.life = life;
    s.max = life;
    s.size = size;
    s.grav = grav;
    s.drag = drag;
    s.bounce = bounce;
  }

  /** Gerbe d'étincelles orientée (dir dans le plan XZ, en éventail). */
  burst(pos: THREE.Vector3, dir: THREE.Vector3, n: number, color: number, speed = 8, spread = 1.2, life = 0.45, size = 0.035, up = 3): void {
    const base = Math.atan2(dir.x, dir.z);
    for (let i = 0; i < n; i++) {
      const a = base + (Math.random() - 0.5) * spread * 2;
      const sp = speed * (0.35 + Math.random() * 0.9);
      const v = new THREE.Vector3(Math.sin(a) * sp, up * (0.3 + Math.random() * 1.2), Math.cos(a) * sp);
      this.emit(pos, v, color, life * (0.5 + Math.random() * 0.8), size * (0.6 + Math.random() * 0.8));
    }
  }

  update(dt: number): void {
    const P = this.iPos.array as Float32Array;
    const V = this.iVel.array as Float32Array;
    const C = this.iColor.array as Float32Array;
    const S = this.iSize.array as Float32Array;
    for (let i = 0; i < this.cap; i++) {
      const s = this.ps[i];
      if (s.life > 0) {
        s.life -= dt;
        s.v.y -= s.grav * dt;
        s.v.multiplyScalar(Math.max(0, 1 - s.drag * dt));
        s.p.addScaledVector(s.v, dt);
        if (s.bounce && s.p.y < 0.02 && s.v.y < 0) {
          s.p.y = 0.02;
          s.v.y *= -0.35;
          s.v.x *= 0.6;
          s.v.z *= 0.6;
        }
      }
      const a = s.life > 0 ? Math.min(1, (s.life / s.max) * 1.6) : 0;
      P[i * 3] = s.p.x;
      P[i * 3 + 1] = s.p.y;
      P[i * 3 + 2] = s.p.z;
      V[i * 3] = s.v.x;
      V[i * 3 + 1] = s.v.y;
      V[i * 3 + 2] = s.v.z;
      C[i * 4] = s.c.r;
      C[i * 4 + 1] = s.c.g;
      C[i * 4 + 2] = s.c.b;
      C[i * 4 + 3] = a;
      S[i] = s.size;
    }
    this.iPos.needsUpdate = true;
    this.iVel.needsUpdate = true;
    this.iColor.needsUpdate = true;
    this.iSize.needsUpdate = true;
  }
}

// ─── Particules rondes / carrées (poussière, papiers, braises) ──────────────────

const PTS_VS = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
attribute float aShape;
uniform float uScale;
varying vec4 vColor;
varying float vShape;
void main() {
  vColor = aColor;
  vShape = aShape;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aColor.a <= 0.0 ? 0.0 : aSize * uScale / -mv.z;
}`;

const PTS_FS = /* glsl */ `
varying vec4 vColor;
varying float vShape;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = vShape > 0.5 ? step(max(abs(c.x), abs(c.y)) * 2.0, 0.8) : (1.0 - smoothstep(0.2, 1.0, d));
  if (a <= 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`;

interface PtP {
  p: THREE.Vector3;
  v: THREE.Vector3;
  c: THREE.Color;
  life: number;
  max: number;
  size: number;
  grow: number;
  grav: number;
  drag: number;
  alpha: number;
  shape: number;
}

export class Puffs {
  readonly points: THREE.Points;
  private ps: PtP[] = [];
  private pos: THREE.BufferAttribute;
  private col: THREE.BufferAttribute;
  private size: THREE.BufferAttribute;
  private shape: THREE.BufferAttribute;
  readonly mat: THREE.ShaderMaterial;
  private next = 0;

  constructor(private readonly cap: number, additive: boolean) {
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(cap * 3), 3);
    this.col = new THREE.BufferAttribute(new Float32Array(cap * 4), 4);
    this.size = new THREE.BufferAttribute(new Float32Array(cap), 1);
    this.shape = new THREE.BufferAttribute(new Float32Array(cap), 1);
    for (const a of [this.pos, this.col, this.size, this.shape]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('aColor', this.col);
    g.setAttribute('aSize', this.size);
    g.setAttribute('aShape', this.shape);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PTS_VS,
      fragmentShader: PTS_FS,
      uniforms: { uScale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 11 : 9;
    for (let i = 0; i < cap; i++) {
      this.ps.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), life: 0, max: 1, size: 0.1, grow: 0, grav: 0, drag: 0, alpha: 1, shape: 0 });
    }
  }

  emit(pos: THREE.Vector3, vel: THREE.Vector3, color: number | THREE.Color, life: number, size: number, o: { grow?: number; grav?: number; drag?: number; alpha?: number; shape?: number } = {}): void {
    const s = this.ps[this.next];
    this.next = (this.next + 1) % this.cap;
    s.p.copy(pos);
    s.v.copy(vel);
    if (typeof color === 'number') s.c.setHex(color);
    else s.c.copy(color);
    s.life = life;
    s.max = life;
    s.size = size;
    s.grow = o.grow ?? 0;
    s.grav = o.grav ?? 0;
    s.drag = o.drag ?? 1;
    s.alpha = o.alpha ?? 1;
    s.shape = o.shape ?? 0;
  }

  dustRing(pos: THREE.Vector3, n: number, radius: number, color = 0x6a6080, speed = 2.5): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const p = new THREE.Vector3(pos.x + Math.sin(a) * radius, 0.15, pos.z + Math.cos(a) * radius);
      const v = new THREE.Vector3(Math.sin(a) * speed, 0.4 + Math.random() * 0.8, Math.cos(a) * speed);
      this.emit(p, v, color, 0.5 + Math.random() * 0.4, 0.35 + Math.random() * 0.3, { grow: 0.9, drag: 4, alpha: 0.55 });
    }
  }

  update(dt: number): void {
    const P = this.pos.array as Float32Array;
    const C = this.col.array as Float32Array;
    const S = this.size.array as Float32Array;
    const H = this.shape.array as Float32Array;
    for (let i = 0; i < this.cap; i++) {
      const s = this.ps[i];
      if (s.life > 0) {
        s.life -= dt;
        s.v.y -= s.grav * dt;
        s.v.multiplyScalar(Math.max(0, 1 - s.drag * dt));
        s.p.addScaledVector(s.v, dt);
        s.size += s.grow * dt;
        if (s.p.y < 0.03 && s.v.y < 0) {
          s.p.y = 0.03;
          s.v.set(0, 0, 0);
        }
      }
      const k = s.life > 0 ? s.life / s.max : 0;
      P[i * 3] = s.p.x;
      P[i * 3 + 1] = s.p.y;
      P[i * 3 + 2] = s.p.z;
      C[i * 4] = s.c.r;
      C[i * 4 + 1] = s.c.g;
      C[i * 4 + 2] = s.c.b;
      C[i * 4 + 3] = s.life > 0 ? s.alpha * Math.min(1, k * 2.5) : 0;
      S[i] = s.size;
      H[i] = s.shape;
    }
    this.pos.needsUpdate = true;
    this.col.needsUpdate = true;
    this.size.needsUpdate = true;
    this.shape.needsUpdate = true;
  }
}

// ─── Smear de coup (arc lumineux qui balaie) ───────────────────────────────────

const SMEAR_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const SMEAR_FS = /* glsl */ `
uniform float uHead;
uniform float uFade;
uniform vec3 uCore;
uniform vec3 uEdge;
uniform float uTail;
varying vec2 vUv;
void main() {
  float a = vUv.x;
  float r = vUv.y;
  if (a > uHead) discard;
  float tail = smoothstep(uHead - uTail, uHead, a);
  float edge = smoothstep(0.0, 0.55, r) * (1.0 - smoothstep(0.9, 1.0, r));
  float core = smoothstep(0.62, 0.86, r) * (1.0 - smoothstep(0.9, 1.0, r));
  vec3 col = mix(uEdge, uCore, core);
  float alpha = edge * tail * uFade;
  // Liseré sombre côté intérieur (encrage BD)
  gl_FragColor = vec4(col * alpha, alpha);
}`;

export class Smear {
  readonly mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private t = 0;
  private dur = 0.1;
  private hold = 0.12;
  private active = false;
  private readonly N = 40;

  constructor(core: number, edge: number) {
    this.geo = new THREE.BufferGeometry();
    const n = this.N;
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 1) * 2 * 3), 3));
    const uv = new Float32Array((n + 1) * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      uv[i * 4] = i / n;
      uv[i * 4 + 1] = 0;
      uv[i * 4 + 2] = i / n;
      uv[i * 4 + 3] = 1;
      if (i < n) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SMEAR_VS,
      fragmentShader: SMEAR_FS,
      uniforms: {
        uHead: { value: 0 },
        uFade: { value: 0 },
        uTail: { value: 0.9 },
        uCore: { value: new THREE.Color(core).multiplyScalar(3.2) },
        uEdge: { value: new THREE.Color(edge).multiplyScalar(1.6) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 12;
  }

  /**
   * Arc autour de `center` : p(ψ) = center + R (cos ψ·u + sin ψ·v), de ψ0 à ψ1 (degrés),
   * rayons rIn → rOut. `dur` = durée du balayage (s).
   */
  fire(center: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, psi0: number, psi1: number, rIn: number, rOut: number, dur: number, hold = 0.12, colors?: { core: number; edge: number }): void {
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    for (let i = 0; i <= this.N; i++) {
      const psi = THREE.MathUtils.degToRad(psi0 + ((psi1 - psi0) * i) / this.N);
      const c = Math.cos(psi);
      const s = Math.sin(psi);
      // léger évasement : le bord extérieur s'allonge vers la tête
      const k = 0.85 + 0.15 * (i / this.N);
      for (let j = 0; j < 2; j++) {
        const r = j === 0 ? rIn : rOut * k;
        const o = (i * 2 + j) * 3;
        P[o] = center.x + r * (c * u.x + s * v.x);
        P[o + 1] = center.y + r * (c * u.y + s * v.y);
        P[o + 2] = center.z + r * (c * u.z + s * v.z);
      }
    }
    pos.needsUpdate = true;
    this.geo.computeBoundingSphere();
    if (colors) {
      (this.mat.uniforms.uCore.value as THREE.Color).setHex(colors.core).multiplyScalar(3.2);
      (this.mat.uniforms.uEdge.value as THREE.Color).setHex(colors.edge).multiplyScalar(1.6);
    }
    this.t = 0;
    this.dur = dur;
    this.hold = hold;
    this.active = true;
    this.mesh.visible = true;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.t += dt;
    const head = Math.min(1, this.t / this.dur);
    const fade = this.t < this.dur ? 1 : Math.max(0, 1 - (this.t - this.dur) / this.hold);
    this.mat.uniforms.uHead.value = head;
    this.mat.uniforms.uFade.value = fade;
    this.mat.uniforms.uTail.value = 0.55 + 0.45 * head;
    if (fade <= 0) {
      this.active = false;
      this.mesh.visible = false;
    }
  }
}

// ─── Fantômes de dash (silhouette figée, fresnel cyan additif) ──────────────────

const GHOST_VS = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const GHOST_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = 1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float a = (0.18 + pow(f, 1.6) * 1.1) * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`;

export class Ghosts {
  readonly group = new THREE.Group();
  private items: Array<{ mesh: THREE.Mesh; life: number; max: number; mat: THREE.ShaderMaterial }> = [];

  spawn(source: THREE.Object3D, color: number, life = 0.28): void {
    source.updateWorldMatrix(true, true);
    const geos: THREE.BufferGeometry[] = [];
    source.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.outline && !o.userData.noGhost && o.visible && isVisibleChain(o)) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', o.geometry.getAttribute('position').clone());
        const n = o.geometry.getAttribute('normal');
        if (!n) return;
        g.setAttribute('normal', n.clone());
        if (o.geometry.index) g.setIndex(o.geometry.index.clone());
        const ng = g.index ? g.toNonIndexed() : g;
        ng.applyMatrix4(o.matrixWorld);
        geos.push(ng);
      }
    });
    if (geos.length === 0) return;
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) return;
    const mat = new THREE.ShaderMaterial({
      vertexShader: GHOST_VS,
      fragmentShader: GHOST_FS,
      uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(2.2) }, uAlpha: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.renderOrder = 8;
    this.group.add(mesh);
    this.items.push({ mesh, life, max: life, mat });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      it.mat.uniforms.uAlpha.value = Math.max(0, it.life / it.max);
      if (it.life <= 0) {
        this.group.remove(it.mesh);
        it.mesh.geometry.dispose();
        it.mat.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}

function isVisibleChain(o: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = o;
  while (p) {
    if (!p.visible) return false;
    p = p.parent;
  }
  return true;
}

// ─── Décalques au sol : télégraphes (rectangle), anneaux (onde de choc, apparition) ─

const DECAL_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const RECT_FS = /* glsl */ `
uniform float uProgress;
uniform float uAlpha;
uniform float uTime;
uniform vec3 uColor;
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  vec2 p = vUv * uSize;
  float bw = 0.06;
  float border = 1.0 - step(bw, min(min(p.x, uSize.x - p.x), min(p.y, uSize.y - p.y)));
  float fill = step(vUv.y, uProgress);
  float stripes = step(0.5, fract((p.x + p.y) * 2.2 - uTime * 2.0));
  float front = smoothstep(0.08, 0.0, abs(vUv.y - uProgress)) * step(vUv.y, uProgress + 0.001);
  float a = border * 0.95 + fill * (0.16 + stripes * 0.12) + front * 0.9;
  gl_FragColor = vec4(uColor * a * uAlpha, a * uAlpha);
}`;

const RING_FS = /* glsl */ `
uniform float uAlpha;
uniform float uWidth;
uniform vec3 uColor;
uniform float uFill;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float ring = smoothstep(1.0 - uWidth, 1.0 - uWidth * 0.4, r) * (1.0 - smoothstep(0.97, 1.0, r));
  float fill = (1.0 - smoothstep(0.0, 1.0, r)) * uFill;
  float a = (ring + fill) * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`;

export class Telegraph {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;

  constructor(w: number, l: number, color: number) {
    const g = new THREE.PlaneGeometry(w, l);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, l / 2);
    // uv.y = 0 près de l'attaquant (z = 0), 1 au bout
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, pos.getZ(i) / l);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: DECAL_VS,
      fragmentShader: RECT_FS,
      uniforms: {
        uProgress: { value: 0 },
        uAlpha: { value: 0 },
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color).multiplyScalar(2.2) },
        uSize: { value: new THREE.Vector2(w, l) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.position.y = 0.03;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
  }
}

export class Rings {
  readonly group = new THREE.Group();
  private items: Array<{ mesh: THREE.Mesh; mat: THREE.ShaderMaterial; t: number; dur: number; r0: number; r1: number }> = [];
  private geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);

  spawn(pos: THREE.Vector3, color: number, r0: number, r1: number, dur: number, width = 0.25, fill = 0.25, intensity = 2): void {
    const mat = new THREE.ShaderMaterial({
      vertexShader: DECAL_VS,
      fragmentShader: RING_FS,
      uniforms: {
        uAlpha: { value: 1 },
        uWidth: { value: width },
        uFill: { value: fill },
        uColor: { value: new THREE.Color(color).multiplyScalar(intensity) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.position.set(pos.x, Math.max(0.035, pos.y), pos.z);
    mesh.renderOrder = 6;
    this.group.add(mesh);
    this.items.push({ mesh, mat, t: 0, dur, r0, r1 });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = Math.min(1, it.t / it.dur);
      const e = 1 - (1 - k) * (1 - k);
      const r = it.r0 + (it.r1 - it.r0) * e;
      it.mesh.scale.set(r, 1, r);
      it.mat.uniforms.uAlpha.value = 1 - k;
      if (k >= 1) {
        this.group.remove(it.mesh);
        it.mat.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}

// ─── Éclair d'impact (étoile billboard) ─────────────────────────────────────────

const BURST_FS = /* glsl */ `
uniform float uT;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float ang = atan(p.y, p.x);
  float rays = pow(abs(cos(ang * 4.0 + 0.4)), 18.0) * (1.0 - smoothstep(0.0, 1.0, r));
  float core = 1.0 - smoothstep(0.0, 0.35 + uT * 0.3, r);
  float ring = smoothstep(0.75 * uT, 0.85 * uT + 0.05, r) * (1.0 - smoothstep(0.85 * uT + 0.05, 0.95 * uT + 0.1, r));
  float a = (core * 1.3 + rays * 1.2 + ring * 0.8) * (1.0 - uT);
  gl_FragColor = vec4(uColor * a, a);
}`;

export class Bursts {
  readonly group = new THREE.Group();
  private pool: Array<{ mesh: THREE.Mesh; mat: THREE.ShaderMaterial; t: number; dur: number; size: number }> = [];

  constructor(n = 10) {
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: DECAL_VS,
        fragmentShader: BURST_FS,
        uniforms: { uT: { value: 1 }, uColor: { value: new THREE.Color(1, 1, 1) } },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 20;
      this.group.add(mesh);
      this.pool.push({ mesh, mat, t: 1, dur: 1, size: 1 });
    }
  }

  spawn(pos: THREE.Vector3, color: number, size: number, dur = 0.16, intensity = 3): void {
    const it = this.pool.find((p) => !p.mesh.visible) ?? this.pool[0];
    it.mesh.position.copy(pos);
    it.mesh.rotation.z = Math.random() * Math.PI;
    it.t = 0;
    it.dur = dur;
    it.size = size;
    (it.mat.uniforms.uColor.value as THREE.Color).setHex(color).multiplyScalar(intensity * 0.5);
    it.mesh.visible = true;
  }

  update(dt: number, cam: THREE.Camera): void {
    for (const it of this.pool) {
      if (!it.mesh.visible) continue;
      it.t += dt;
      const k = Math.min(1, it.t / it.dur);
      it.mat.uniforms.uT.value = k;
      it.mesh.quaternion.copy(cam.quaternion);
      const s = it.size * (0.6 + 0.6 * k);
      it.mesh.scale.set(s, s, s);
      if (k >= 1) it.mesh.visible = false;
    }
  }
}

// ─── Nombres de dégâts (DOM) ────────────────────────────────────────────────────

export class DamageNumbers {
  private pool: Array<{ el: HTMLDivElement; pos: THREE.Vector3; t: number; vx: number; alive: boolean }> = [];
  private v = new THREE.Vector3();

  constructor(host: HTMLElement) {
    for (let i = 0; i < 32; i++) {
      const el = document.createElement('div');
      el.className = 'dmg';
      el.style.display = 'none';
      host.appendChild(el);
      this.pool.push({ el, pos: new THREE.Vector3(), t: 0, vx: 0, alive: false });
    }
  }

  spawn(pos: THREE.Vector3, text: string, kind: 'normal' | 'big' | 'crit' | 'hurt'): void {
    const it = this.pool.find((p) => !p.alive) ?? this.pool[0];
    it.alive = true;
    it.t = 0;
    it.pos.copy(pos);
    it.vx = (Math.random() - 0.5) * 1.2;
    it.el.textContent = text;
    it.el.className = `dmg dmg-${kind}`;
    it.el.style.display = 'block';
  }

  update(dt: number, cam: THREE.Camera, w: number, h: number): void {
    for (const it of this.pool) {
      if (!it.alive) continue;
      it.t += dt;
      const k = it.t / 0.9;
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
}

// ─── Secousse caméra (trauma) ───────────────────────────────────────────────────

export class Shake {
  trauma = 0;
  private t = 0;
  readonly offset = new THREE.Vector3();

  add(amount: number): void {
    this.trauma = Math.min(1, Math.max(this.trauma, amount));
  }

  update(dt: number): void {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 2.2);
    const s = this.trauma * this.trauma * 0.55;
    const t = this.t * 38;
    this.offset.set(Math.sin(t * 1.13) * s + Math.sin(t * 2.7) * s * 0.4, Math.sin(t * 1.71 + 1.3) * s * 0.6, Math.cos(t * 1.37 + 0.7) * s);
  }
}

// ─── Télégraphe circulaire (piétinement) ────────────────────────────────────────

const DISC_FS = /* glsl */ `
uniform float uProgress;
uniform float uAlpha;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  if (r > 1.0) discard;
  float border = smoothstep(0.93, 0.97, r);
  float fill = step(r, uProgress);
  float front = smoothstep(0.06, 0.0, abs(r - uProgress)) * step(r, uProgress + 0.001);
  float ang = atan(p.y, p.x);
  float stripes = step(0.5, fract(ang * 3.0 + r * 3.0 - uTime * 1.5));
  float a = border * 0.95 + fill * (0.14 + stripes * 0.1) + front * 0.9;
  gl_FragColor = vec4(uColor * a * uAlpha, a * uAlpha);
}`;

export class DiscTelegraph {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;

  constructor(radius: number, color: number) {
    const g = new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: DECAL_VS,
      fragmentShader: DISC_FS,
      uniforms: { uProgress: { value: 0 }, uAlpha: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(color).multiplyScalar(2.2) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.position.y = 0.035;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
  }
}
