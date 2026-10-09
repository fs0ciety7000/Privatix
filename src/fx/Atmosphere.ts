import Phaser from 'phaser';
import { Depth, TILE } from '@/config/constants';
import type { Room } from '@/entities/Room';

/**
 * Direction artistique « pixel art moderne » (Dead Cells, Celeste) côté moteur :
 * éclairage dynamique (Phaser 4 Lighting), halos lumineux, bloom, étalonnage des couleurs,
 * vignette et poussières en suspension. Les sprites restent du pixel art ; la lumière fait le reste.
 *
 * Règle de lecture : les acteurs et le décor sont éclairés (`setLighting`), les émissifs
 * (VFX, télégraphes magenta, projectiles, écrans) ne le sont pas : ils restent saturés et le bloom les fait briller.
 */

export interface LookDef {
  /** Lumière ambiante (ce qui n'est éclairé par rien). */
  readonly ambient: number;
  /** Lampes du plafond : couleur, rayon, intensité, espacement en tuiles. */
  readonly lamp: {
    readonly color: number;
    readonly radius: number;
    readonly intensity: number;
    readonly every: number;
  };
  /** Néons d'accent posés sur les voies et les murs. */
  readonly accents: readonly number[];
  /** Lumière portée par le héros (lampe frontale du casque). */
  readonly hero: { readonly color: number; readonly radius: number; readonly intensity: number };
  /** Étalonnage : saturation, contraste, luminosité (0 = neutre). */
  readonly grade: {
    readonly saturate: number;
    readonly contrast: number;
    readonly brightness: number;
  };
  readonly bloom: { readonly threshold: number; readonly amount: number; readonly radius: number };
  readonly vignette: number;
  /** Poussières en suspension. */
  readonly motes: { readonly color: number; readonly count: number };
}

export const LOOKS = {
  /** Quais de nuit : bleu profond, néons froids, accents turquoise et magenta. */
  quais: {
    ambient: 0x5a6890,
    lamp: { color: 0xcfe8ff, radius: 140, intensity: 0.75, every: 7 },
    accents: [0x19c3b1, 0xff3ea5, 0xffd200],
    hero: { color: 0xffc58a, radius: 110, intensity: 0.45 },
    grade: { saturate: 0.25, contrast: 0.12, brightness: 0 },
    bloom: { threshold: 0.8, amount: 0.5, radius: 2 },
    vignette: 0.42,
    motes: { color: 0xbfe0ff, count: 40 },
  },
  /** Arène du boss : alarme rouge en plus. */
  boss: {
    ambient: 0x564c6c,
    lamp: { color: 0xffd8c8, radius: 150, intensity: 0.8, every: 8 },
    accents: [0xff3ea5, 0xe8505b, 0x19c3b1],
    hero: { color: 0xffc58a, radius: 96, intensity: 0.9 },
    grade: { saturate: 0.3, contrast: 0.16, brightness: 0 },
    bloom: { threshold: 0.78, amount: 0.6, radius: 2 },
    vignette: 0.5,
    motes: { color: 0xffb0c0, count: 50 },
  },
  /** L'OCC : brique chaude, lanternes de signalisation, café. */
  occ: {
    ambient: 0x7a5c48,
    lamp: { color: 0xffb35c, radius: 150, intensity: 0.8, every: 8 },
    accents: [0xe8505b, 0x5bd17a, 0xfff2d0],
    hero: { color: 0xffd9a8, radius: 100, intensity: 0.8 },
    grade: { saturate: 0.2, contrast: 0.1, brightness: 0.02 },
    bloom: { threshold: 0.8, amount: 0.45, radius: 2 },
    vignette: 0.45,
    motes: { color: 0xffd9a0, count: 30 },
  },
} as const satisfies Record<string, LookDef>;

export type LookId = keyof typeof LOOKS;

interface Flash {
  readonly light: Phaser.GameObjects.Light;
  left: number;
  readonly total: number;
  readonly intensity: number;
}

/** Petit hachage déterministe (placement des néons). */
function hash(x: number, y: number): number {
  return Math.imul((x * 73856093) ^ (y * 19349663), 2654435761) >>> 0;
}

export class Atmosphere {
  private readonly roomLights: Phaser.GameObjects.Light[] = [];
  private readonly glows: Phaser.GameObjects.GameObject[] = [];
  private readonly flashes: Flash[] = [];
  private heroLight: Phaser.GameObjects.Light | null = null;
  private heroTarget: { x: number; y: number } | null = null;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private flicker = 0;
  private look: LookDef;

  public constructor(
    private readonly scene: Phaser.Scene,
    lookId: LookId,
  ) {
    this.look = LOOKS[lookId];
    scene.lights.enable();
    scene.lights.setAmbientColor(this.look.ambient);
    this.setupCamera();
  }

  /** Étalonnage, bloom et vignette sur la caméra principale (filtres Phaser 4). */
  private setupCamera(): void {
    const cam = this.scene.cameras.main;
    const look = this.look;
    cam.filters.internal.clear();
    cam.filters.external.clear();
    const grade = cam.filters.internal.addColorMatrix();
    grade.colorMatrix.saturate(look.grade.saturate, true);
    grade.colorMatrix.contrast(look.grade.contrast, true);
    if (look.grade.brightness !== 0) grade.colorMatrix.brightness(1 + look.grade.brightness, true);
    // Bloom : seuil sur les zones claires, flou, puis ajout par-dessus l'image.
    const bloom = cam.filters.internal.addParallelFilters();
    bloom.top.addThreshold(look.bloom.threshold, 1);
    bloom.top.addBlur(0, look.bloom.radius, look.bloom.radius, 1, 0xffffff, 4);
    bloom.blend.blendMode = Phaser.BlendModes.ADD;
    bloom.blend.amount = look.bloom.amount;
    cam.filters.external.addVignette(0.5, 0.5, 0.62, look.vignette, 0x05040a);
  }

  public setLook(lookId: LookId): void {
    this.look = LOOKS[lookId];
    this.scene.lights.setAmbientColor(this.look.ambient);
    this.setupCamera();
    if (this.heroLight) {
      this.heroLight
        .setColor(this.look.hero.color)
        .setRadius(this.look.hero.radius)
        .setIntensity(this.look.hero.intensity);
    }
  }

  /** Éclaire une salle : décor éclairé, lampes au plafond, néons d'accent, halos visibles, poussières. */
  public lightRoom(room: Room): void {
    this.clearRoom();
    room.layer.setLighting(true);
    room.setPropsLighting(true);
    const look = this.look;
    const { width, height } = room.layout;
    const every = look.lamp.every;
    for (let ty = 3; ty < height - 1; ty += every - 2) {
      for (
        let tx = 3 + ((ty / (every - 2)) % 2) * Math.floor(every / 2);
        tx < width - 2;
        tx += every
      ) {
        const x = tx * TILE + TILE / 2;
        const y = ty * TILE + TILE / 2;
        if (!room.isWalkable(x, y)) continue;
        const accent =
          hash(tx, ty) % 5 === 0 ? look.accents[hash(ty, tx) % look.accents.length] : undefined;
        const color = accent ?? look.lamp.color;
        this.roomLights.push(
          this.scene.lights.addLight(x, y, look.lamp.radius, color, look.lamp.intensity, 40),
        );
        this.addGlow(x, y, color, 46, 0.07);
      }
    }
    // Néons le long des voies (quais) : rubans turquoise / magenta.
    for (const band of room.railBands) {
      for (let x = band.x0 + 48; x < band.x1 - 24; x += 160) {
        const color = look.accents[hash(x, band.y) % look.accents.length] ?? look.lamp.color;
        this.roomLights.push(
          this.scene.lights.addLight(x, band.y + band.height / 2, 90, color, 0.7, 30),
        );
        this.addGlow(x, band.y + band.height / 2, color, 36, 0.05);
      }
    }
    this.spawnMotes(room);
  }

  /** Halo visible (additif) : la lumière se voit dans l'air, pas seulement sur les surfaces. */
  public addGlow(
    x: number,
    y: number,
    color: number,
    radius: number,
    intensity: number,
  ): Phaser.GameObjects.PointLight {
    const glow = this.scene.add
      .pointlight(x, y, color, radius, intensity, 0.06)
      .setDepth(Depth.Above - 20);
    this.glows.push(glow);
    return glow;
  }

  private spawnMotes(room: Room): void {
    this.motes?.destroy();
    const look = this.look;
    this.motes = this.scene.add
      .particles(0, 0, 'px', {
        x: { min: 0, max: room.widthPx },
        y: { min: 0, max: room.heightPx },
        lifespan: { min: 4000, max: 9000 },
        speedX: { min: -6, max: 6 },
        speedY: { min: -10, max: -2 },
        scale: { min: 0.5, max: 1 },
        // Scintillement : apparaît, puis s'éteint au fil de la vie de la particule.
        alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) * 0.55 },
        tint: look.motes.color,
        blendMode: Phaser.BlendModes.ADD,
        frequency: 9000 / look.motes.count,
        maxParticles: look.motes.count,
        advance: 4000,
      })
      .setDepth(Depth.Above + 10);
  }

  /** Rend un objet sensible à l'éclairage dynamique. */
  public lit<T extends Phaser.GameObjects.Components.Lighting>(obj: T): T {
    obj.setLighting(true);
    return obj;
  }

  /** Lampe frontale du héros (suit la cible). */
  public attachHero(target: { x: number; y: number }): void {
    const h = this.look.hero;
    this.heroTarget = target;
    this.heroLight ??= this.scene.lights.addLight(
      target.x,
      target.y,
      h.radius,
      h.color,
      h.intensity,
      30,
    );
  }

  /** Éclair lumineux bref (impact, explosion, sifflet). */
  public flash(
    x: number,
    y: number,
    color: number,
    radius: number,
    intensity: number,
    ms: number,
  ): void {
    const light = this.scene.lights.addLight(x, y, radius, color, intensity, 24);
    this.flashes.push({ light, left: ms, total: ms, intensity });
  }

  public update(dtMs: number): void {
    if (this.heroLight && this.heroTarget)
      this.heroLight.setPosition(this.heroTarget.x, this.heroTarget.y - 14);
    // Néons qui grésillent : de temps en temps, une lampe vacille.
    this.flicker += dtMs;
    if (this.flicker > 120) {
      this.flicker = 0;
      const lamp = this.roomLights[Math.floor(Math.random() * this.roomLights.length)];
      if (lamp && Math.random() < 0.25) {
        const base = this.look.lamp.intensity;
        lamp.setIntensity(base * (0.35 + Math.random() * 0.4));
        this.scene.time.delayedCall(60 + Math.random() * 80, () => lamp.setIntensity(base));
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i -= 1) {
      const f = this.flashes[i];
      if (!f) continue;
      f.left -= dtMs;
      if (f.left <= 0) {
        this.scene.lights.removeLight(f.light);
        this.flashes.splice(i, 1);
      } else f.light.setIntensity(f.intensity * (f.left / f.total));
    }
  }

  private clearRoom(): void {
    for (const l of this.roomLights) this.scene.lights.removeLight(l);
    this.roomLights.length = 0;
    for (const g of this.glows) g.destroy();
    this.glows.length = 0;
    for (const f of this.flashes) this.scene.lights.removeLight(f.light);
    this.flashes.length = 0;
  }

  public destroy(): void {
    this.clearRoom();
    this.motes?.destroy();
    if (this.heroLight) this.scene.lights.removeLight(this.heroLight);
    this.heroLight = null;
  }
}
