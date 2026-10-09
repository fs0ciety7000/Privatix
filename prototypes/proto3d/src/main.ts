import './style.css';
import * as THREE from 'three';
import { buildLevel, type Level } from './level';
import { Hero } from './hero';
import { Consultant } from './consultant';
import { Bursts, DamageNumbers, Ghosts, Puffs, Rings, Shake, Smear, Sparks } from './fx';
import { Input } from './input';
import { cardHtml, LOOT_TABLE, LootDrop, RARITY, slotIcon, STARTER, type Item, type Slot } from './loot';
import { Post } from './post';
import { outlineUniforms, PAL } from './toon';
import type { Foe, HitInfo, HitShape, World } from './types';
import { Discosaure } from './discosaure';

const params = new URLSearchParams(location.search);
const FIXED = params.has('fixed');
const CAM_OFFSET = new THREE.Vector3(0, 10.9, 12.3);

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} manquant`);
  return e as T;
}

class Game implements World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly post: Post;
  readonly level: Level;
  readonly hero: Hero;
  readonly input: Input;
  enemies: Foe[] = [];
  readonly discoEnv: THREE.Texture;
  get bounds() {
    return this.level.bounds;
  }
  readonly sparks = new Sparks(900);
  readonly puffs = new Puffs(400, false);
  readonly glows = new Puffs(300, true);
  readonly ghosts = new Ghosts();
  readonly rings = new Rings();
  readonly bursts = new Bursts(12);
  readonly dmg: DamageNumbers;
  readonly shake = new Shake();
  readonly heroSmear = new Smear(0xfff6d8, 0xff8a1a);
  readonly enemySmears = [new Smear(0xffd3ec, PAL.danger), new Smear(0xffd3ec, PAL.danger), new Smear(0xffd3ec, PAL.danger)];
  time = 0;
  private freeze = 0;
  private timeScale = 1;
  private slowT = 0;
  private hurtVignette = 0;
  private tokens = new Set<number>();
  private camTarget = new THREE.Vector3();
  private sun: THREE.DirectionalLight;
  private drops: LootDrop[] = [];
  private lootLights: THREE.PointLight[] = [];
  private dropCount = 0;
  private equipped: Record<Slot, Item> = { ...STARTER };
  private waveTimer = -1;
  private wave = 0;
  private sparkTimer = 2;
  private sparkFlash = 0;
  private combo = 0;
  private comboT = 0;
  private dust: THREE.Points;
  private aimPoint = new THREE.Vector3();
  private hasAim = false;
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private nearDrop: LootDrop | null = null;
  private frames = 0;
  private fpsT = 0;
  private fps = 60;
  demoAim: THREE.Vector3 | null = null;
  demoMove = new THREE.Vector2();
  frozenEnemies = false;
  autoWaves = true;
  private camZoom = 1;

  // UI
  private ui = {
    hp: el<HTMLDivElement>('hp-fill'),
    hpGhost: el<HTMLDivElement>('hp-ghost'),
    hpText: el<HTMLSpanElement>('hp-text'),
    dash: el<HTMLDivElement>('dash-pips'),
    card: el<HTMLDivElement>('lootcard'),
    toast: el<HTMLDivElement>('toast'),
    slots: el<HTMLDivElement>('slots'),
    combo: el<HTMLDivElement>('combo'),
    wave: el<HTMLDivElement>('wave'),
    fps: el<HTMLDivElement>('fps'),
    use: el<HTMLButtonElement>('btn-use'),
    boss: el<HTMLDivElement>('bossbar'),
    bossFill: el<HTMLDivElement>('boss-fill'),
  };
  private hpGhostV = 100;
  private toastT = 0;

  constructor() {
    const app = el<HTMLDivElement>('app');
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    app.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0a0818);
    this.scene.fog = new THREE.FogExp2(0x120c2a, 0.017);

    this.camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 120);

    // Lumières : ciel nocturne, lune froide (seule lumière à ombres), lampes chaudes du décor
    this.scene.add(new THREE.HemisphereLight(0x5a5ad0, 0x2a1438, 0.7));
    this.sun = new THREE.DirectionalLight(0xa8b8ff, 1.9);
    this.sun.position.set(-8, 20, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -22;
    sc.right = 22;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 1;
    sc.far = 60;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.sun.target.position.set(0, 0, -2);

    this.discoEnv = makeDiscoEnv(this.renderer);
    this.level = buildLevel(this.scene);
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 7, 1.6);
      l.position.set(0, -10, 0);
      this.scene.add(l);
      this.lootLights.push(l);
    }

    this.scene.add(this.sparks.mesh, this.puffs.points, this.glows.points, this.ghosts.group, this.rings.group, this.bursts.group, this.heroSmear.mesh);
    for (const s of this.enemySmears) this.scene.add(s.mesh);

    this.dmg = new DamageNumbers(el('dmg-layer'));
    this.input = new Input(this.renderer.domElement, el('ui'));

    this.hero = new Hero(this);
    this.hero.pos.set(0, 0, 2.5);
    this.hero.facing = Math.PI;
    this.scene.add(this.hero.rig.root);
    this.camTarget.copy(this.hero.pos);

    this.dust = this.makeDust();
    this.scene.add(this.dust);

    this.post = new Post(this.renderer, this.scene, this.camera, window.innerWidth, window.innerHeight, pr > 1.5 ? 2 : 4);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderSlots();
    this.spawnWave();
  }

  // ─── World ─────────────────────────────────────────────────────────────────────

  hitstop(ms: number): void {
    this.freeze = Math.max(this.freeze, ms);
  }

  slowmo(scale: number, ms: number): void {
    this.timeScale = scale;
    this.slowT = ms;
  }

  heroPos(): THREE.Vector3 {
    return this.hero.pos;
  }

  heroHit(damage: number, from: THREE.Vector3): boolean {
    const ok = this.hero.takeHit(damage, from);
    if (ok) {
      this.shake.add(0.55);
      this.hurtVignette = 1;
      this.hitstop(70);
      this.bursts.spawn(this.hero.pos.clone().setY(1.1), 0xff3ea5, 2.2, 0.16, 3);
      this.sparks.burst(this.hero.pos.clone().setY(1.1), this.hero.pos.clone().sub(from).setY(0).normalize(), 14, 0xff3ea5, 8, 1.2, 0.35, 0.035, 3);
    }
    return ok;
  }

  requestToken(id: number): boolean {
    if (this.tokens.has(id)) return true;
    if (this.tokens.size >= 2) return false;
    this.tokens.add(id);
    return true;
  }

  releaseToken(id: number): void {
    this.tokens.delete(id);
  }

  collide(p: THREE.Vector3, r: number): void {
    const b = this.level.bounds;
    p.x = THREE.MathUtils.clamp(p.x, b.minX + r, b.maxX - r);
    p.z = THREE.MathUtils.clamp(p.z, b.minZ + r, b.maxZ - r);
    for (const c of this.level.colliders) {
      if (c.kind === 'circle') {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + r;
        if (d < min && d > 1e-5) {
          p.x = c.x + (dx / d) * min;
          p.z = c.z + (dz / d) * min;
        }
      } else {
        const cx = THREE.MathUtils.clamp(p.x, c.x - c.hx, c.x + c.hx);
        const cz = THREE.MathUtils.clamp(p.z, c.z - c.hz, c.z + c.hz);
        const dx = p.x - cx;
        const dz = p.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < r) {
          if (d > 1e-5) {
            p.x = cx + (dx / d) * r;
            p.z = cz + (dz / d) * r;
          } else {
            // à l'intérieur : sortir par l'axe le plus proche
            const ox = c.hx + r - Math.abs(p.x - c.x);
            const oz = c.hz + r - Math.abs(p.z - c.z);
            if (ox < oz) p.x += Math.sign(p.x - c.x || 1) * ox;
            else p.z += Math.sign(p.z - c.z || 1) * oz;
          }
        }
      }
    }
  }

  strike(shape: HitShape, hit: HitInfo): number {
    let n = 0;
    const fwd = new THREE.Vector3(Math.sin(shape.angle), 0, Math.cos(shape.angle));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    for (const e of this.enemies) {
      if (!e.alive || e.spawning) continue;
      const rel = e.pos.clone().sub(shape.origin).setY(0);
      const dist = rel.length();
      let ok = false;
      if (shape.kind === 'arc') {
        if (dist <= shape.radius + e.radius) {
          const a = Math.atan2(rel.x, rel.z);
          let da = Math.abs(a - shape.angle);
          while (da > Math.PI) da = Math.abs(da - Math.PI * 2);
          ok = dist < 0.6 || da <= shape.spread / 2 + Math.atan(e.radius / Math.max(dist, 0.01));
        }
      } else {
        const x = rel.dot(fwd);
        const y = rel.dot(side);
        ok = x >= shape.near - e.radius && x <= shape.far + e.radius && Math.abs(y) <= shape.half + e.radius;
      }
      if (ok) {
        e.hit(hit, this.hero.pos);
        n++;
      }
    }
    if (n > 0) {
      this.combo += n;
      this.comboT = 2.2;
      this.ui.combo.textContent = `${this.combo} COUPS`;
      this.ui.combo.classList.remove('pop');
      void this.ui.combo.offsetWidth;
      this.ui.combo.classList.add('pop');
      if (this.enemies.every((e) => !e.alive)) this.slowmo(0.25, 450);
    }
    return n;
  }

  onEnemyDeath(pos: THREE.Vector3): void {
    if (this.dropCount < LOOT_TABLE.length) {
      const item = LOOT_TABLE[this.dropCount++];
      this.dropItem(item, pos);
    }
  }

  dropItem(item: Item, pos: THREE.Vector3): LootDrop {
    const to = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0, 0.8 + Math.random() * 0.5));
    this.collide(to, 0.6);
    const light = this.lootLights.find((l) => l.intensity === 0) ?? null;
    const d = new LootDrop(item, pos, to, light);
    d.attach(this.scene);
    this.drops.push(d);
    return d;
  }

  // ─── Vagues ───────────────────────────────────────────────────────────────────

  private spawnWave(): void {
    this.wave++;
    const n = 3;
    const hp = this.hero.pos;
    const b = this.level.bounds;
    if (this.wave % 2 === 0) {
      const p = new THREE.Vector3(THREE.MathUtils.clamp(hp.x + (hp.x > 0 ? -5 : 5), b.minX + 3, b.maxX - 3), 0, THREE.MathUtils.clamp(hp.z - 3, b.minZ + 2, b.maxZ - 2));
      this.enemies.push(new Discosaure(this, p));
      this.ui.wave.textContent = `QUAI 3 · VAGUE ${this.wave} · ÉLITE`;
      return;
    }
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i - (n - 1) / 2) * 1.05 + (Math.random() - 0.5) * 0.3;
      const p = new THREE.Vector3(hp.x + Math.sin(a) * 6, 0, hp.z + Math.cos(a) * 5);
      p.x = THREE.MathUtils.clamp(p.x, b.minX + 1.5, b.maxX - 1.5);
      p.z = THREE.MathUtils.clamp(p.z, b.minZ + 1, b.maxZ - 1);
      this.collide(p, 0.5);
      this.enemies.push(new Consultant(this, p));
    }
    this.ui.wave.textContent = `QUAI 3 · VAGUE ${this.wave}`;
  }

  // ─── Ambiance ─────────────────────────────────────────────────────────────────

  private makeDust(): THREE.Points {
    const N = 650;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = 0.2 + Math.random() * 5.5;
      pos[i * 3 + 2] = -10 + Math.random() * 20;
      seed[i] = Math.random() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const lamps = this.level.lamps.map((l) => l.clone());
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uLamps: { value: lamps }, uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime; uniform vec3 uLamps[4]; uniform float uScale;
        varying float vB; varying float vWarm;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.21 + aSeed) * 0.8 + uTime * 0.12;
          p.y += sin(uTime * 0.33 + aSeed * 1.7) * 0.4;
          p.z += cos(uTime * 0.17 + aSeed * 2.3) * 0.6;
          p.x = mod(p.x + 20.0, 40.0) - 20.0;
          float b = 0.0;
          for (int i = 0; i < 4; i++) {
            vec3 L = uLamps[i];
            float h = L.y - p.y;
            float r = 0.5 + max(h, 0.0) * 0.6;
            float d = length(p.xz - L.xz);
            b += smoothstep(r, r * 0.3, d) * step(0.0, h);
          }
          vB = 0.12 + b * 1.4;
          vWarm = clamp(b, 0.0, 1.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.045 + fract(aSeed) * 0.04) * uScale / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        varying float vB; varying float vWarm;
        void main(){
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = 1.0 - smoothstep(0.3, 1.0, d);
          vec3 c = mix(vec3(0.45, 0.55, 1.0), vec3(1.0, 0.75, 0.45), vWarm) * vB;
          gl_FragColor = vec4(c * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(g, mat);
    p.frustumCulled = false;
    return p;
  }

  private catenarySpark(): void {
    const x = this.camTarget.x + (Math.random() - 0.5) * 16;
    const p = new THREE.Vector3(x, this.level.wireY - 0.04, this.level.wireZ);
    for (let i = 0; i < 34; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 5, -Math.random() * 2 + 1, (Math.random() - 0.5) * 3);
      this.sparks.emit(p, v, i % 2 ? 0xbfefff : 0xffd27a, 0.6 + Math.random() * 0.7, 0.03, 9.8, 0.6, true);
    }
    this.bursts.spawn(p, 0xbfefff, 1.6, 0.12, 4);
    this.level.sparkLight.position.copy(p);
    this.sparkFlash = 1;
  }

  // ─── Butin ────────────────────────────────────────────────────────────────────

  private equip(item: Item): void {
    this.equipped[item.slot] = item;
    this.hero.equip(item.slot, item.variant);
    const a = item.apply;
    if (a.armor) this.hero.armor += a.armor;
    if (a.hp) {
      this.hero.maxHp += a.hp;
      this.hero.hp = this.hero.maxHp;
    }
    if (a.dmg) this.hero.dmgBonus += a.dmg;
    if (a.speed) this.hero.speedMul += a.speed;
    const col = RARITY[item.rarity].color;
    const p = this.hero.pos.clone().setY(1.2);
    this.rings.spawn(this.hero.pos, col, 0.3, 3.2, 0.5, 0.2, 0.3, 2.6);
    this.bursts.spawn(p.clone().setY(1.6), col, 3.4, 0.25, 3);
    for (let i = 0; i < 40; i++) {
      const a2 = Math.random() * Math.PI * 2;
      this.glows.emit(p.clone().add(new THREE.Vector3(Math.sin(a2) * 0.5, Math.random() * 0.8 - 0.4, Math.cos(a2) * 0.5)), new THREE.Vector3(Math.sin(a2) * 2, 2 + Math.random() * 3, Math.cos(a2) * 2), col, 0.8 + Math.random() * 0.5, 0.12, { drag: 2.5, grav: -1 });
    }
    this.shake.add(0.3);
    this.toast(`<span style="color:${RARITY[item.rarity].css}">${item.name}</span> équipé !`);
    this.renderSlots(item.slot);
  }

  private toast(html: string): void {
    this.ui.toast.innerHTML = html;
    this.ui.toast.classList.remove('show');
    void this.ui.toast.offsetWidth;
    this.ui.toast.classList.add('show');
    this.toastT = 2.4;
  }

  private renderSlots(flash?: Slot): void {
    const order: Slot[] = ['casque', 'gilet', 'cle'];
    this.ui.slots.innerHTML = order
      .map((s) => {
        const it = this.equipped[s];
        const r = RARITY[it.rarity];
        return `<div class="slot ${flash === s ? 'flash' : ''}" style="--rc:${r.css}"><div class="slot-ic">${slotIcon(s, s === 'casque' && it.rarity === 'commun' ? '#ffa419' : s === 'gilet' && it.rarity === 'commun' ? '#ff6a12' : r.css)}</div><div class="slot-t"><div class="slot-r" style="color:${r.css}">${r.label}</div><div class="slot-n">${it.name}</div></div></div>`;
      })
      .join('');
  }

  // ─── Boucle ───────────────────────────────────────────────────────────────────

  private prCap = 2;
  private slowFor = 0;

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.prCap);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // en portrait / écran étroit : on recule pour garder la lisibilité
    this.camera.fov = w / h < 1.2 ? 42 : 30;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h, pr);
    outlineUniforms.uRes.value.set(w * pr, h * pr);
    this.sparks.setAspect(w / h);
    const scale = (h * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.puffs.mat.uniforms.uScale.value = scale;
    this.glows.mat.uniforms.uScale.value = scale;
    (this.dust.material as THREE.ShaderMaterial).uniforms.uScale.value = scale;
  }

  step(realDt: number): void {
    // Hitstop et ralenti
    let dt = realDt;
    if (this.freeze > 0) {
      this.freeze -= realDt * 1000;
      dt = 0;
    } else if (this.slowT > 0) {
      this.slowT -= realDt * 1000;
      dt *= this.timeScale;
      if (this.slowT <= 0) this.timeScale = 1;
    }
    this.time += dt;

    // Entrées
    const move = this.input.move();
    if (this.demoMove.lengthSq() > 0) move.copy(this.demoMove);
    if (this.input.mouseActive) {
      this.raycaster.setFromCamera(this.input.mouseNdc, this.camera);
      this.hasAim = this.raycaster.ray.intersectPlane(this.ground, this.aimPoint) !== null;
    }
    let aim: THREE.Vector3 | null = this.demoAim ?? (this.hasAim ? this.aimPoint : null);
    const attack = this.input.consumeAttack();
    if (this.input.touch && attack) {
      // tactile : visée automatique sur l'ennemi le plus proche
      let best: Foe | null = null;
      let bd = 4.5;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = e.pos.distanceTo(this.hero.pos);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      aim = best ? best.pos.clone() : null;
    }
    const intent = { move, aim, attack, dash: this.input.consumeDash() };
    const interact = this.input.consumeInteract();

    if (dt > 0) {
      this.hero.update(dt, intent);
      for (const e of this.enemies) if (!this.frozenEnemies || !e.alive) e.update(dt);
      // le corps d'une élite repousse le héros (sauf pendant le dash)
      for (const e of this.enemies) {
        if (!e.elite || !e.alive || this.hero.state === 'dash') continue;
        const d = this.hero.pos.clone().sub(e.pos).setY(0);
        const l = d.length();
        const min = e.radius + 0.42;
        if (l < min) {
          if (l < 1e-4) d.set(0, 0, 1);
          this.hero.pos.copy(e.pos).addScaledVector(d.normalize(), min).setY(0);
          this.collide(this.hero.pos, 0.42);
          this.hero.rig.root.position.copy(this.hero.pos);
        }
      }
      // séparation douce entre ennemis
      for (let i = 0; i < this.enemies.length; i++)
        for (let j = i + 1; j < this.enemies.length; j++) {
          const a = this.enemies[i];
          const b = this.enemies[j];
          if (!a.alive || !b.alive) continue;
          const d = a.pos.clone().sub(b.pos).setY(0);
          const l = d.length();
          const min = (a.radius + b.radius) * 1.05;
          if (l < min && l > 1e-4) {
            d.multiplyScalar(((min - l) / l) * 0.5);
            a.pos.add(d);
            b.pos.sub(d);
          }
        }
      this.enemies = this.enemies.filter((e) => !e.removed);
      // vague suivante
      if (this.autoWaves && this.enemies.every((e) => !e.alive) && this.waveTimer < 0) this.waveTimer = 3.2;
      if (this.waveTimer >= 0) {
        this.waveTimer -= dt;
        if (this.waveTimer < 0) this.spawnWave();
      }
      // étincelles de caténaire
      this.sparkTimer -= dt;
      if (this.sparkTimer <= 0) {
        this.sparkTimer = 2.5 + Math.random() * 4;
        this.catenarySpark();
      }
    } else {
      // pendant le hitstop, le héros garde sa pose mais accepte les entrées (tampon)
      if (intent.attack) this.input.press('attack');
      if (intent.dash) this.input.press('dash');
    }

    // Butin
    this.nearDrop = null;
    let nd = 1.9;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const done = d.update(dt, this.time, this.hero.pos, (p) => {
        this.rings.spawn(p, RARITY[d.item.rarity].color, 0.2, 2.2, 0.5, 0.2, 0.3, 2.4);
        this.puffs.dustRing(p, 8, 0.3, 0x5a5070, 2);
        this.bursts.spawn(p.clone().setY(0.6), RARITY[d.item.rarity].color, 2.4, 0.2, 3);
      });
      if (done) {
        d.detach(this.scene);
        this.drops.splice(i, 1);
        this.equip(d.item);
        continue;
      }
      if (d.readyToPick) {
        const dist = d.pos.distanceTo(this.hero.pos);
        if (dist < nd) {
          nd = dist;
          this.nearDrop = d;
        }
      }
    }
    if (this.nearDrop && interact) this.nearDrop.take();
    this.updateCard();

    // FX (gelés pendant le hitstop, sauf secousse et nombres)
    this.sparks.update(dt);
    this.puffs.update(dt);
    this.glows.update(dt);
    this.ghosts.update(dt);
    this.rings.update(dt);
    this.bursts.update(dt, this.camera);
    this.heroSmear.update(dt);
    for (const s of this.enemySmears) s.update(dt);
    this.shake.update(realDt);
    this.level.update(this.time, dt);
    this.sparkFlash = Math.max(0, this.sparkFlash - realDt * 7);
    this.level.sparkLight.intensity = this.sparkFlash > 0 ? this.sparkFlash * (30 + Math.random() * 30) : 0;
    (this.dust.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    this.hurtVignette = Math.max(0, this.hurtVignette - realDt * 2.2);

    // Caméra : suit le héros avec une avance vers la visée
    const lead = new THREE.Vector3();
    if (aim) lead.copy(aim).sub(this.hero.pos).setY(0).clampLength(0, 3).multiplyScalar(0.3);
    const target = this.hero.pos.clone().add(lead);
    // une élite à l'écran : la caméra recule et cadre le duel
    const elite = this.enemies.find((e) => e.elite && e.alive);
    this.camZoom += ((elite ? 1.22 : 1) - this.camZoom) * (1 - Math.exp(-2.5 * realDt));
    if (elite) target.lerp(elite.pos, 0.3);
    target.x = THREE.MathUtils.clamp(target.x, -9.5, 9.5);
    target.z = THREE.MathUtils.clamp(target.z, -1.2, 4.2);
    this.camTarget.lerp(target, 1 - Math.exp(-5 * realDt));
    this.camera.position.copy(this.camTarget).addScaledVector(CAM_OFFSET, this.camZoom).add(this.shake.offset);
    this.camera.lookAt(this.camTarget.x + this.shake.offset.x * 0.5, 0.6, this.camTarget.z - 2.5);
    for (const e of this.enemies) e.faceCamera(this.camera);

    // HUD
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dmg.update(realDt, this.camera, w, h);
    this.updateHud(realDt);

    this.post.render(this.time, this.hurtVignette);

    this.frames++;
    this.fpsT += realDt;
    if (this.fpsT >= 0.5) {
      this.fps = this.frames / this.fpsT;
      this.frames = 0;
      this.fpsT = 0;
      this.ui.fps.textContent = `${Math.round(this.fps)} fps · ×${this.renderer.getPixelRatio().toFixed(2)}`;
      // résolution adaptative : si l'on reste sous 50 fps, on baisse le pixel ratio par paliers
      if (!FIXED && this.time > 3) {
        this.slowFor = this.fps < 50 ? this.slowFor + 0.5 : 0;
        if (this.slowFor >= 2 && this.renderer.getPixelRatio() > 1) {
          this.prCap = Math.max(1, this.renderer.getPixelRatio() - 0.25);
          this.slowFor = 0;
          this.resize();
        }
      }
    }
  }

  private updateCard(): void {
    const d = this.nearDrop;
    const card = this.ui.card;
    if (!d) {
      card.classList.remove('show');
      this.ui.use.classList.remove('show');
      return;
    }
    if (card.dataset.item !== d.item.id) {
      card.dataset.item = d.item.id;
      card.innerHTML = cardHtml(d.item, this.equipped[d.item.slot], this.input.touch);
      card.style.setProperty('--rc', RARITY[d.item.rarity].css);
    }
    card.classList.add('show');
    this.ui.use.classList.add('show');
    const v = d.pos.clone().setY(1.6).project(this.camera);
    const w = window.innerWidth;
    const h = window.innerHeight;
    let x = (v.x * 0.5 + 0.5) * w + 70;
    let y = (-v.y * 0.5 + 0.5) * h - 160;
    const cw = card.offsetWidth || 300;
    const ch = card.offsetHeight || 300;
    if (x + cw > w - 12) x = (v.x * 0.5 + 0.5) * w - cw - 70;
    x = Math.max(12, Math.min(w - cw - 12, x));
    y = Math.max(12, Math.min(h - ch - 12, y));
    card.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
  }

  private updateHud(dt: number): void {
    const hp = this.hero.hp / this.hero.maxHp;
    this.ui.hp.style.width = `${(hp * 100).toFixed(1)}%`;
    this.hpGhostV += (hp * 100 - this.hpGhostV) * Math.min(1, dt * 3);
    if (this.hpGhostV < hp * 100) this.hpGhostV = hp * 100;
    this.ui.hpGhost.style.width = `${this.hpGhostV.toFixed(1)}%`;
    this.ui.hpText.textContent = `${Math.ceil(this.hero.hp)} / ${this.hero.maxHp}`;
    const pips = this.ui.dash.children;
    for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < this.hero.dashCharges);
    const elite = this.enemies.find((e) => e.elite && e.alive);
    this.ui.boss.classList.toggle('show', !!elite);
    if (elite) this.ui.bossFill.style.width = `${((elite.hp / elite.maxHp) * 100).toFixed(1)}%`;
    this.comboT -= dt;
    if (this.comboT <= 0 && this.combo > 0) {
      this.combo = 0;
      this.ui.combo.classList.remove('pop');
      this.ui.combo.textContent = '';
    }
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.ui.toast.classList.remove('show');
    }
  }

  // ─── API de démonstration (captures automatisées) ──────────────────────────────

  demoApi() {
    return {
      teleport: (x: number, z: number, facing?: number) => {
        this.hero.pos.set(x, 0, z);
        if (facing !== undefined) this.hero.facing = facing;
        this.camTarget.copy(this.hero.pos);
      },
      aim: (x: number, z: number) => (this.demoAim = new THREE.Vector3(x, 0, z)),
      move: (x: number, y: number) => this.demoMove.set(x, y),
      attack: () => this.input.press('attack'),
      dash: () => this.input.press('dash'),
      interact: () => this.input.press('interact'),
      freezeEnemies: (v: boolean) => (this.frozenEnemies = v),
      autoWaves: (v: boolean) => (this.autoWaves = v),
      placeEnemy: (i: number, x: number, z: number) => this.enemies[i]?.place(x, z),
      spawnDisco: (x: number, z: number) => {
        const d = new Discosaure(this, new THREE.Vector3(x, 0, z));
        this.enemies.push(d);
        return this.enemies.length - 1;
      },
      discoDo: (kind: 'stomp' | 'charge') => {
        for (const e of this.enemies) if (e instanceof Discosaure) e.force(kind);
      },
      clearEnemies: () => {
        for (const e of this.enemies) if (e.alive) e.hit({ damage: 9999, knockback: 0, stun: 0, heavy: false, crit: false }, this.hero.pos);
      },
      killEnemy: (i: number) => {
        const e = this.enemies[i];
        if (e) e.hit({ damage: 999, knockback: 1, stun: 0, heavy: true, crit: false }, this.hero.pos);
      },
      enemies: () => this.enemies.map((e) => ({ name: e.name, alive: e.alive, x: e.pos.x, z: e.pos.z, hp: e.hp })),
      hero: () => ({ x: this.hero.pos.x, z: this.hero.pos.z, hp: this.hero.hp, state: this.hero.state, helmet: this.hero.helmetKind, ...this.hero.attackInfo }),
      drops: () => this.drops.map((d) => ({ id: d.item.id, x: d.pos.x, z: d.pos.z, ready: d.readyToPick })),
      fps: () => this.fps,
      sparkNow: () => this.catenarySpark(),
    };
  }
}

/** Environnement réfléchi par la boule à facettes : panneaux de couleurs saturées dans le noir. */
function makeDiscoEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x05030c);
  const cols = [0xff3ea5, 0x6ff3ff, 0xffe14a, 0xb05cff, 0x5dff8a, 0xff8a2a, 0xffffff, 0x3a8cff, 0xffb35c];
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 40; i++) {
    const c = new THREE.Color(cols[i % cols.length]).multiplyScalar(i % 5 === 0 ? 3.5 : 1.5);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c }));
    const d = new THREE.Vector3().randomDirection();
    d.y = Math.abs(d.y) * 0.9 - 0.15;
    m.position.copy(d.normalize().multiplyScalar(8));
    m.scale.set(1 + Math.random() * 2.5, 0.6 + Math.random() * 1.5, 1 + Math.random() * 2.5);
    m.lookAt(0, 0, 0);
    env.add(m);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x2a1a4a) }));
  floor.position.y = -4;
  env.add(floor);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.015);
  pm.dispose();
  return rt.texture;
}

const game = new Game();
if (params.has('demo')) (window as unknown as { __proto3d: unknown }).__proto3d = game.demoApi();

let last = performance.now();
function loop(now: number): void {
  const dt = FIXED ? 1 / 60 : Math.min(1 / 30, Math.max(0, (now - last) / 1000));
  last = now;
  game.step(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
el('loading').classList.add('hide');
