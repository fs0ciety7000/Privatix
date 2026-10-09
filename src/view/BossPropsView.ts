// Accessoires des ennemis majeurs et des boss, lus dans la simulation (jamais modifiée) : ruban
// d'inauguration et nœud papillon d'Elio Di Rupo, pages du Règlement du Fluidifieur, taches de lumière
// et halo de la boule à facettes du Discosaure, traînée du Furet sous le quai. Tout ce qui blesse reste
// magenta ; les taches décoratives de la boule ne le sont jamais. Aucun clignotement en Réduction des
// mouvements (rotation lente et continue seulement).
import * as THREE from 'three';
import { DiRupoSim } from '@/sim/enemies/DiRupoSim';
import { DiscosaureSim } from '@/sim/enemies/DiscosaureSim';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import { FluidifieurSim } from '@/sim/enemies/FluidifieurSim';
import { FuretSim } from '@/sim/enemies/FuretSim';
import { DIRUPO } from '@/config/balance';
import { pxToM } from '@/sim/units';
import { Annulus } from '@/view/HazardViews';
import { glow, PAL, radialTexture, toon } from '@/view/materials/toon';

const POSTS = 10;
/** Couleurs des taches de la boule (jamais de magenta : réservé au danger). */
const DISCO_COLORS = [0xfff4d0, 0xffd27a, 0x8fd8ff, 0x9dffd0, 0xffffff, 0xc8b8ff];
const TRAIL_DOTS = 14;

export class BossPropsView {
  private readonly group = new THREE.Group();
  private readonly mats: THREE.Material[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  // Ruban d'inauguration.
  private readonly ribbon = new THREE.Group();
  private readonly ribbonBand: THREE.Mesh;
  private readonly ribbonGround: Annulus;
  private readonly posts: THREE.Group[] = [];
  // Nœud papillon en vol.
  private readonly bowtie = new THREE.Group();
  // Pages du Règlement.
  private readonly pages: THREE.Group[] = [];
  // Boule à facettes : halo et taches décoratives.
  private readonly disco = new THREE.Group();
  private readonly discoHalo: THREE.Sprite;
  private readonly discoSpots: THREE.Mesh[] = [];
  private discoSpin = 0;
  // Furet sous le quai.
  private readonly trail: THREE.Mesh[] = [];
  private readonly trailPts: THREE.Vector3[] = [];
  private trailT = 0;

  public constructor(
    scene: THREE.Scene,
    private readonly reducedMotion: boolean,
  ) {
    // ── Ruban : bande rouge satinée à hauteur de taille, poteaux dorés, liseré magenta au sol ──
    const bandGeo = this.geo(new THREE.CylinderGeometry(1, 1, 0.14, 120, 1, true));
    const red = this.mat(
      toon(0xd8202e, { emissive: 0x7a0010, emissiveIntensity: 0.6, rimStrength: 1, rim: 0xffd6d6 }),
    );
    red.side = THREE.DoubleSide;
    this.ribbonBand = new THREE.Mesh(bandGeo, red);
    this.ribbonBand.position.y = 0.95;
    this.ribbon.add(this.ribbonBand);
    const postGeo = this.geo(
      new THREE.CylinderGeometry(0.05, 0.07, 1.05, 10).translate(0, 0.52, 0),
    );
    const knobGeo = this.geo(new THREE.SphereGeometry(0.1, 12, 8));
    const baseGeo = this.geo(new THREE.CylinderGeometry(0.2, 0.24, 0.06, 14));
    const steel = this.mat(toon(0x2a3150, { rimStrength: 0.8 }));
    const gold = this.mat(glow(0xffc83a, 1.6));
    for (let i = 0; i < POSTS; i += 1) {
      const g = new THREE.Group();
      const p = new THREE.Mesh(postGeo, steel);
      const k = new THREE.Mesh(knobGeo, gold);
      k.position.y = 1.1;
      const b = new THREE.Mesh(baseGeo, steel);
      b.position.y = 0.03;
      g.add(p, k, b);
      this.posts.push(g);
      this.ribbon.add(g);
    }
    this.ribbonGround = new Annulus(pxToM(DIRUPO.RIBBON_START + 30));
    this.ribbon.add(this.ribbonGround.mesh);
    this.ribbon.visible = false;

    // ── Nœud papillon : deux ailes bordeaux et un nœud ──
    const wingGeo = this.geo(new THREE.ConeGeometry(0.22, 0.42, 4).rotateZ(Math.PI / 2));
    const bordeaux = this.mat(toon(0x7a1e2c, { rimStrength: 1, rim: 0xb23a4e }));
    const wingL = new THREE.Mesh(wingGeo, bordeaux);
    wingL.position.x = -0.22;
    const wingR = new THREE.Mesh(wingGeo, bordeaux);
    wingR.position.x = 0.22;
    wingR.rotation.z = Math.PI;
    const knot = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.1, 10, 8)), bordeaux);
    const edge = new THREE.Mesh(
      this.geo(new THREE.TorusGeometry(0.5, 0.025, 6, 24).rotateX(Math.PI / 2)),
      this.mat(glow(PAL.danger, 2.4)),
    );
    this.bowtie.add(wingL, wingR, knot, edge);
    this.bowtie.visible = false;

    // ── Pages du Règlement (3) : feuille blanche et halo doré ──
    const sheetGeo = this.geo(new THREE.PlaneGeometry(0.42, 0.56));
    const sheet = this.mat(
      new THREE.MeshBasicMaterial({ color: 0xfaf6ea, side: THREE.DoubleSide }),
    );
    const haloMat = this.mat(
      new THREE.SpriteMaterial({
        map: radialTexture(),
        color: new THREE.Color(0xffd200).multiplyScalar(1.5),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    for (let i = 0; i < 3; i += 1) {
      const g = new THREE.Group();
      const s = new THREE.Mesh(sheetGeo, sheet);
      s.name = 'sheet';
      const h = new THREE.Sprite(haloMat);
      h.scale.setScalar(1.3);
      g.add(s, h);
      g.visible = false;
      this.pages.push(g);
      this.group.add(g);
    }

    // ── Boule à facettes : halo lumineux et taches décoratives au sol ──
    this.discoHalo = new THREE.Sprite(
      this.mat(
        new THREE.SpriteMaterial({
          map: radialTexture(),
          color: new THREE.Color(0xdff6ff).multiplyScalar(1.25),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    this.discoHalo.scale.setScalar(2.3);
    this.disco.add(this.discoHalo);
    const spotGeo = this.geo(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
    for (let i = 0; i < 14; i += 1) {
      const m = new THREE.Mesh(
        spotGeo,
        this.mat(
          new THREE.MeshBasicMaterial({
            map: radialTexture(),
            color: new THREE.Color(
              DISCO_COLORS[i % DISCO_COLORS.length] ?? 0xffffff,
            ).multiplyScalar(0.9),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        ),
      );
      m.renderOrder = 3;
      this.discoSpots.push(m);
      this.disco.add(m);
    }
    this.disco.visible = false;

    // ── Traînée du Furet sous le quai : pointillés de poussière ──
    const dotGeo = this.geo(new THREE.CircleGeometry(0.12, 10).rotateX(-Math.PI / 2));
    const dotMat = this.mat(glow(0xc9b48a, 1.2, { transparent: true, opacity: 0.85 }));
    for (let i = 0; i < TRAIL_DOTS; i += 1) {
      const d = new THREE.Mesh(dotGeo, dotMat);
      d.visible = false;
      this.trail.push(d);
      this.group.add(d);
    }

    this.group.add(this.ribbon, this.bowtie, this.disco);
    scene.add(this.group);
  }

  private mat<T extends THREE.Material>(m: T): T {
    this.mats.push(m);
    return m;
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  public sync(enemies: readonly EnemySim[], time: number, dt: number): void {
    let rupo: DiRupoSim | null = null;
    let fluid: FluidifieurSim | null = null;
    let disco: DiscosaureSim | null = null;
    let furet: FuretSim | null = null;
    for (const e of enemies) {
      if (e instanceof DiRupoSim && !e.isDead) rupo = e;
      else if (e instanceof FluidifieurSim && !e.isDead) fluid = e;
      else if (e instanceof DiscosaureSim && !e.isDead) disco = e;
      else if (e instanceof FuretSim && !e.isDead) furet = e;
    }
    this.syncRupo(rupo, time);
    this.syncPages(fluid, time);
    this.syncDisco(disco, time, dt);
    this.syncTrail(furet, dt);
  }

  private syncRupo(boss: DiRupoSim | null, time: number): void {
    const r = boss?.ribbon ?? null;
    this.ribbon.visible = r !== null;
    if (r) {
      const R = pxToM(r.radius);
      const arm = 1 - r.armLeft / DIRUPO.RIBBON_TELEGRAPH_MS;
      this.ribbon.position.set(pxToM(r.cx), 0, pxToM(r.cy));
      this.ribbonBand.scale.set(R, Math.max(0.05, arm), R);
      this.ribbonBand.position.y = 0.95 * Math.max(0.2, arm);
      this.posts.forEach((p, i) => {
        const a = (i / POSTS) * Math.PI * 2;
        p.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
        p.scale.y = Math.max(0.05, Math.min(1, arm * 1.4));
      });
      // Liseré magenta au sol : le ruban blesse au contact.
      const pulse = this.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 6);
      this.ribbonGround.set(R, pxToM(DIRUPO.RIBBON_WIDTH) * 1.6, (r.armLeft > 0 ? arm : 1) * pulse);
    }
    const bt = boss?.bowtie ?? null;
    this.bowtie.visible = bt !== null;
    if (bt) {
      this.bowtie.position.set(pxToM(bt.x), 1.25, pxToM(bt.y + 20));
      this.bowtie.rotation.y = time * 14;
    }
  }

  private syncPages(fluid: FluidifieurSim | null, time: number): void {
    this.pages.forEach((g, i) => {
      const p = fluid?.pages[i];
      g.visible = p !== undefined && !p.taken;
      if (!p || p.taken) return;
      const flutter = this.reducedMotion ? 0.3 : 1;
      g.position.set(pxToM(p.x), 0.9 + Math.sin(time * 2 + p.seed) * 0.15 * flutter, pxToM(p.y));
      const s = g.getObjectByName('sheet');
      if (s) s.rotation.set(Math.sin(time * 3 + p.seed) * 0.6 * flutter, time * 1.5 + p.seed, 0.3);
    });
  }

  private syncDisco(d: DiscosaureSim | null, time: number, dt: number): void {
    const lit = d !== null && d.blackoutLeft <= 0 && d.materialized;
    this.disco.visible = lit;
    if (!d || !lit) return;
    const speed = (d.dancing ? 1.6 : 0.5) * (this.reducedMotion ? 0.4 : 1);
    this.discoSpin += dt * speed;
    const cx = pxToM(d.body.x);
    const cz = pxToM(d.body.y);
    this.discoHalo.position.set(cx, 2.15, cz + 0.2);
    // Halo stable en Réduction des mouvements ; sinon une respiration douce (jamais de clignotement).
    const breathe = this.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 2.4);
    this.discoHalo.scale.setScalar(2.3 * breathe);
    this.discoSpots.forEach((m, i) => {
      const ring = 1.6 + (i % 4) * 1.35;
      const a = this.discoSpin * (i % 2 === 0 ? 1 : -0.7) + i * 2.39;
      m.position.set(cx + Math.cos(a) * ring, 0.025, cz + Math.sin(a) * ring * 0.85);
      m.scale.setScalar(0.9 + (i % 3) * 0.25);
    });
  }

  private syncTrail(f: FuretSim | null, dt: number): void {
    const hidden = f?.burrowed ?? false;
    if (f && hidden) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.12;
        this.trailPts.push(new THREE.Vector3(pxToM(f.body.x), 0.03, pxToM(f.body.y)));
        if (this.trailPts.length > TRAIL_DOTS) this.trailPts.shift();
      }
    } else if (this.trailPts.length > 0) this.trailPts.length = 0;
    this.trail.forEach((d, i) => {
      const p = this.trailPts[i];
      d.visible = p !== undefined;
      if (p) d.position.copy(p);
    });
  }

  public clear(): void {
    this.ribbon.visible = false;
    this.bowtie.visible = false;
    this.disco.visible = false;
    for (const p of this.pages) p.visible = false;
    this.trailPts.length = 0;
    for (const d of this.trail) d.visible = false;
  }

  public dispose(): void {
    this.group.removeFromParent();
    this.ribbonGround.dispose();
    for (const m of this.mats) m.dispose();
    for (const g of this.geos) g.dispose();
  }
}
