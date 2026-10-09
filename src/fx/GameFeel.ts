import Phaser from 'phaser';
import { FEEL } from '@/config/balance';
import { Css, Depth, FONT } from '@/config/constants';

/**
 * « Juice » centralisé (claude.md, Règle 1) : hitstop, ralenti, secousses, flash, zoom, particules,
 * nombres de dégâts. RunScene lui demande le delta de jeu de chaque frame (`step`).
 */
export class GameFeel {
  private hitstopLeft = 0;
  private slowScale = 1;
  private slowLeft = 0;
  private slowEase = 0;
  private easeLeft = 0;
  private easeTotal = 0;
  private easeFrom = 1;
  private shakePx = 0;
  private shakeLeft = 0;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly papers: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly vignette: Phaser.GameObjects.Image;
  private paused = false;

  public constructor(private readonly scene: Phaser.Scene) {
    this.sparks = scene.add
      .particles(0, 0, 'spark', {
        speed: { min: 60, max: 160 },
        lifespan: { min: 120, max: 260 },
        scale: { start: 1, end: 0 },
        tint: [0xffc040, 0xff7a1a, 0xffffff],
        emitting: false,
      })
      .setDepth(Depth.Vfx);
    this.papers = scene.add
      .particles(0, 0, 'paper', {
        speed: { min: 30, max: 110 },
        angle: { min: 200, max: 340 },
        gravityY: 260,
        lifespan: 600,
        rotate: { min: 0, max: 360 },
        alpha: { start: 1, end: 0 },
        tint: [0xf4f6f8, 0x19c3b1, 0x9fb0c6],
        emitting: false,
      })
      .setDepth(Depth.Vfx);
    this.dust = scene.add
      .particles(0, 0, 'px', {
        speed: { min: 8, max: 30 },
        lifespan: 300,
        alpha: { start: 0.7, end: 0 },
        tint: 0xc8b8a0,
        emitting: false,
      })
      .setDepth(Depth.Decal);
    this.vignette = scene.add
      .image(0, 0, 'vignette')
      .setOrigin(0)
      .setScrollFactor(0)
      .setDisplaySize(scene.scale.width, scene.scale.height)
      .setTint(0xff3ea5)
      .setAlpha(0)
      .setDepth(Depth.Overlay);
  }

  /** Échelle de temps courante (hitstop = 0). */
  public get timeScale(): number {
    return this.hitstopLeft > 0 ? 0 : this.slowScale;
  }

  /**
   * À appeler une fois par frame avec le delta réel : renvoie le delta de jeu (0 pendant le hitstop,
   * réduit pendant le ralenti) et synchronise la physique, les animations et les tweens.
   */
  public step(realDelta: number): number {
    if (this.hitstopLeft > 0) {
      this.hitstopLeft = Math.max(0, this.hitstopLeft - realDelta);
      if (this.hitstopLeft === 0) this.resume();
      else return 0;
    }
    if (this.slowLeft > 0) {
      this.slowLeft = Math.max(0, this.slowLeft - realDelta);
      if (this.slowLeft === 0) {
        // Retour progressif au temps normal (ease-out, en temps réel).
        this.easeTotal = this.slowEase;
        this.easeLeft = this.slowEase;
        this.easeFrom = this.slowScale;
        if (this.easeTotal <= 0) this.applyScale(1);
      }
    } else if (this.easeLeft > 0) {
      this.easeLeft = Math.max(0, this.easeLeft - realDelta);
      const p = 1 - this.easeLeft / this.easeTotal;
      this.applyScale(this.easeFrom + (1 - this.easeFrom) * Math.sin((p * Math.PI) / 2));
    }
    if (this.shakeLeft > 0) this.shakeLeft = Math.max(0, this.shakeLeft - realDelta);
    return realDelta * this.slowScale;
  }

  /** Gel de l'action (les hitstops se combinent au maximum, pas en somme). */
  public hitstop(ms: number): void {
    if (ms <= 0) return;
    this.hitstopLeft = Math.max(this.hitstopLeft, ms);
    if (!this.paused) {
      this.paused = true;
      this.scene.physics.world.pause();
      this.scene.anims.pauseAll();
    }
  }

  /** Ralenti : `scale` (0..1) pendant `ms` (temps réel), puis retour en `easeMs`. */
  public slowmo(scale: number, ms: number, easeMs = 0): void {
    this.slowLeft = Math.max(this.slowLeft, ms);
    this.slowEase = easeMs;
    this.easeLeft = 0;
    this.applyScale(Math.min(this.slowScale, scale));
  }

  /** Secousse en pixels logiques. Les secousses se combinent au maximum. */
  public shake(px: number, ms: number): void {
    if (px < this.shakePx && this.shakeLeft > 0) return;
    this.shakePx = px;
    this.shakeLeft = ms;
    this.scene.cameras.main.shake(ms, px * FEEL.SHAKE_PX_TO_INTENSITY, true);
  }

  public zoomPunch(zoom: number, ms: number): void {
    const cam = this.scene.cameras.main;
    cam.zoomTo(
      zoom,
      ms / 2,
      'Sine.easeOut',
      true,
      (_c: Phaser.Cameras.Scene2D.Camera, p: number) => {
        if (p >= 1) cam.zoomTo(1, ms / 2, 'Sine.easeIn', true);
      },
    );
  }

  /** Flash blanc (Phaser 4 : tint + mode FILL ; `clearTint` remet le mode MULTIPLY). */
  public flash(target: Phaser.GameObjects.Sprite, ms: number, color = 0xffffff): void {
    target.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(ms, () => {
      if (target.active) target.clearTint();
    });
  }

  /**
   * Squash & stretch (Celeste) : déformation brève puis retour élastique. Le pivot étant aux pieds,
   * le personnage reste posé au sol. Seule exception à la règle « pas d'échelle non entière ».
   */
  public squash(target: Phaser.GameObjects.Sprite, sx: number, sy: number, ms = 140): void {
    const base = target.getData('baseScale') as number | undefined;
    const scale = base ?? target.scaleY;
    if (base === undefined) target.setData('baseScale', scale);
    // On n'arrête que le squash précédent (pas les autres tweens, ex. le fondu de mort).
    (target.getData('squashTween') as Phaser.Tweens.Tween | undefined)?.stop();
    target.setScale(scale * sx, scale * sy);
    const tween = this.scene.tweens.add({
      targets: target,
      scaleX: scale,
      scaleY: scale,
      duration: ms,
      ease: 'Back.easeOut',
    });
    target.setData('squashTween', tween);
  }

  /** Image rémanente (traînée du dash, Dead Cells / Celeste) : copie de la frame, teintée, qui s'efface. */
  public afterimage(source: Phaser.GameObjects.Sprite, color: number, ms = 220): void {
    const ghost = this.scene.add
      .image(source.x, source.y, source.texture.key, source.frame.name)
      .setOrigin(source.originX, source.originY)
      .setFlip(source.flipX, source.flipY)
      .setScale(source.scaleX, source.scaleY)
      .setDepth(source.depth - 1)
      .setTint(color)
      .setTintMode(Phaser.TintModes.FILL)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.55);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: ms,
      ease: 'Quad.easeOut',
      onComplete: () => {
        ghost.destroy();
      },
    });
  }

  public sparksAt(x: number, y: number, count: number): void {
    this.sparks.explode(count, x, y);
  }

  public papersAt(x: number, y: number, count: number): void {
    this.papers.explode(count, x, y);
  }

  public dustAt(x: number, y: number, count = 3): void {
    this.dust.explode(count, x, y);
  }

  /** Vignette colorée plein écran (héros touché : magenta 30 % pendant 250 ms). */
  public vignettePulse(alpha: number, ms: number, color = 0xff3ea5): void {
    this.vignette.setTint(color).setAlpha(alpha);
    this.scene.tweens.add({ targets: this.vignette, alpha: 0, duration: ms, ease: 'Quad.easeIn' });
  }

  /** Nombre de dégâts : police 8 px, monte de 16 px en 500 ms. */
  public damageNumber(
    x: number,
    y: number,
    amount: number,
    opts: { crit?: boolean; hero?: boolean } = {},
  ): void {
    const text = this.texts.find((t) => !t.active) ?? this.newText();
    const color = opts.hero ? Css.danger : opts.crit ? Css.quaiYellow : Css.white;
    text
      .setActive(true)
      .setVisible(true)
      .setPosition(x + Phaser.Math.Between(-4, 4), y)
      .setText(opts.crit ? `${String(amount)}!` : String(amount))
      .setColor(color)
      .setScale(opts.crit ? 1.5 : 1)
      .setAlpha(1);
    this.scene.tweens.add({
      targets: text,
      y: y - FEEL.DAMAGE_TEXT_RISE_PX,
      alpha: { from: 1, to: 0 },
      ease: 'Quad.easeOut',
      duration: FEEL.DAMAGE_TEXT_MS,
      onComplete: () => text.setActive(false).setVisible(false),
    });
  }

  /** Texte flottant libre (« +15 min », « EN GRÈVE », « +1 Gobelet »). */
  public floatText(x: number, y: number, label: string, color: string = Css.white, ms = 800): void {
    const text = this.texts.find((t) => !t.active) ?? this.newText();
    text
      .setActive(true)
      .setVisible(true)
      .setPosition(x, y)
      .setText(label)
      .setColor(color)
      .setScale(1)
      .setAlpha(1);
    this.scene.tweens.add({
      targets: text,
      y: y - 14,
      alpha: { from: 1, to: 0 },
      duration: ms,
      ease: 'Quad.easeOut',
      onComplete: () => text.setActive(false).setVisible(false),
    });
  }

  /**
   * À l'arrêt de la scène : le gestionnaire d'animations est global (Phaser 4), on le remet donc
   * toujours à l'échelle 1 et en lecture, même si la physique de la scène est déjà détruite.
   */
  public destroy(): void {
    this.paused = false;
    this.scene.anims.resumeAll();
    this.scene.anims.globalTimeScale = 1;
  }

  private newText(): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '8px',
        color: Css.white,
        stroke: Css.outline,
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setResolution(2)
      .setDepth(Depth.Text);
    this.texts.push(t);
    return t;
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.scene.physics.world.resume();
    this.scene.anims.resumeAll();
  }

  private applyScale(scale: number): void {
    this.slowScale = scale;
    // Arcade : timeScale inversé (2 = deux fois plus lent).
    const world = this.scene.physics.world as Phaser.Physics.Arcade.World | null;
    if (world) world.timeScale = 1 / Math.max(0.05, scale);
    this.scene.anims.globalTimeScale = scale;
    this.scene.tweens.timeScale = scale;
  }
}
