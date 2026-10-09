import Phaser from 'phaser';
import {
  Colors,
  Css,
  Depth,
  FONT,
  GAME_HEIGHT,
  GAME_WIDTH,
  RegistryKeys,
  SceneKeys,
} from '@/config/constants';
import type { HudSnapshot, Notice, TouchState } from '@/systems/meta/session';
import { getMeta, isNotice, NO_TOUCH } from '@/systems/meta/session';

export interface ChoiceOption {
  readonly title: string;
  readonly desc: string;
  readonly color?: string;
  readonly disabled?: boolean;
}

export interface UISceneData {
  readonly mode: 'run' | 'hub';
}

const TEXT = {
  fontFamily: FONT,
  fontSize: '8px',
  color: Css.white,
  stroke: Css.outline,
  strokeThickness: 2,
} as const;

/**
 * Interface au-dessus du jeu : HUD (Énergie, Burnout, Mobilisation, dash, Gobelets, horloge 3x8),
 * bandeaux, fenêtres de choix (Avantages, pauses, Tableau des revendications) et commandes tactiles.
 * Lit l'instantané du HUD dans le registry à chaque frame (aucune logique de jeu ici).
 */
export class UIScene extends Phaser.Scene {
  private mode: 'run' | 'hub' = 'run';
  private hud!: Phaser.GameObjects.Graphics;
  private texts: Record<string, Phaser.GameObjects.Text> = {};
  private banner!: Phaser.GameObjects.Text;
  private bannerBg!: Phaser.GameObjects.Rectangle;
  private lastNoticeSeq = -1;
  private modal: Phaser.GameObjects.Container | null = null;
  private modalPick: ((i: number) => void) | null = null;
  private modalOptions: readonly ChoiceOption[] = [];
  private modalIndex = 0;
  private modalCards: Phaser.GameObjects.Rectangle[] = [];
  private touch: TouchState = NO_TOUCH;
  private stickBase: Phaser.GameObjects.Arc | null = null;
  private stickKnob: Phaser.GameObjects.Arc | null = null;
  private stickPointer: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private specialPointer: number | null = null;

  public constructor() {
    super(SceneKeys.UI);
  }

  public init(data: Partial<UISceneData>): void {
    this.mode = data.mode ?? 'run';
    this.modal = null;
    this.modalPick = null;
    this.texts = {};
    this.lastNoticeSeq = -1;
    this.touch = NO_TOUCH;
    this.stickPointer = null;
    this.specialPointer = null;
  }

  public create(): void {
    this.hud = this.add.graphics();
    const t = (key: string, x: number, y: number, originX = 0): void => {
      this.texts[key] = this.add.text(x, y, '', TEXT).setOrigin(originX, 0).setResolution(2);
    };
    if (this.mode === 'run') {
      t('energy', 136, 4);
      t('burnout', 136, 18);
      t('mob', 136, 32);
      t('clock', GAME_WIDTH - 10, 6, 1);
      t('delay', GAME_WIDTH - 10, 18, 1);
      t('room', GAME_WIDTH - 10, 30, 1);
      t('wallet', GAME_WIDTH - 10, 42, 1);
      t('boss', GAME_WIDTH / 2, GAME_HEIGHT - 30, 0.5);
      t('tier', 10, 60);
    } else {
      t('wallet', 10, GAME_HEIGHT - 16);
    }
    this.bannerBg = this.add
      .rectangle(GAME_WIDTH / 2, 66, 10, 14, Colors.night, 0.85)
      .setStrokeStyle(1, Colors.quaiYellow)
      .setVisible(false);
    this.banner = this.add
      .text(GAME_WIDTH / 2, 66, '', { ...TEXT, color: Css.white })
      .setOrigin(0.5)
      .setResolution(2)
      .setVisible(false);
    this.registry.events.on(Phaser.Data.Events.CHANGE_DATA, this.onRegistry, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(Phaser.Data.Events.CHANGE_DATA, this.onRegistry, this);
      this.registry.set(RegistryKeys.Touch, NO_TOUCH);
    });
    const notice: unknown = this.registry.get(RegistryKeys.Notice);
    if (isNotice(notice)) this.lastNoticeSeq = notice.seq;
    if (this.sys.game.device.input.touch) this.createTouchControls();
    this.setupModalKeys();
  }

  private onRegistry(_parent: unknown, key: string, value: unknown): void {
    if (key === RegistryKeys.Notice && isNotice(value)) this.showNotice(value);
  }

  private showNotice(n: Notice): void {
    if (n.seq === this.lastNoticeSeq || n.text === '') return;
    this.lastNoticeSeq = n.seq;
    this.banner
      .setText(n.text)
      .setColor(n.color ?? Css.white)
      .setVisible(true)
      .setAlpha(1);
    this.bannerBg
      .setSize(this.banner.width + 16, 16)
      .setVisible(true)
      .setAlpha(1);
    this.tweens.killTweensOf([this.banner, this.bannerBg]);
    this.tweens.add({
      targets: [this.banner, this.bannerBg],
      alpha: 0,
      delay: 2600,
      duration: 500,
    });
  }

  // ─── HUD ───────────────────────────────────────────────────────────────────

  public override update(): void {
    if (this.mode === 'hub') {
      const meta = getMeta(this.registry);
      this.texts.wallet?.setText(`PS ${String(meta.ps)} · Grains ${String(meta.grains)}`);
      return;
    }
    const snap = this.registry.get(RegistryKeys.Hud) as HudSnapshot | null;
    const g = this.hud;
    g.clear();
    if (!snap) return;
    const bar = (
      x: number,
      y: number,
      w: number,
      ratio: number,
      color: number,
      back = 0x1a2230,
    ): void => {
      g.fillStyle(Colors.outline, 1).fillRect(x - 1, y - 1, w + 2, 8);
      g.fillStyle(back, 1).fillRect(x, y, w, 6);
      g.fillStyle(color, 1).fillRect(x, y, Math.max(0, Math.round(w * Math.min(1, ratio))), 6);
      g.fillStyle(0xffffff, 0.25).fillRect(
        x,
        y,
        Math.max(0, Math.round(w * Math.min(1, ratio))),
        1,
      );
    };
    // Énergie
    bar(
      10,
      8,
      120,
      snap.energy / snap.maxEnergy,
      snap.energy / snap.maxEnergy < 0.3 ? Colors.danger : 0x5bd17a,
    );
    this.texts.energy?.setText(
      `ÉNERGIE ${String(snap.energy)}/${String(snap.maxEnergy)}${snap.shield ? ' · bouclier' : ''}`,
    );
    // Burnout (plancher en hachures sombres)
    const meltdown = snap.meltdownMs > 0;
    const burnRatio = meltdown ? snap.meltdownMs / 8000 : snap.burnout / 100;
    bar(
      10,
      22,
      120,
      burnRatio,
      meltdown ? Colors.danger : snap.burnout >= 60 ? 0xff7a1a : 0xc8a040,
    );
    if (snap.burnoutFloor > 0)
      g.fillStyle(0x000000, 0.45).fillRect(10, 22, Math.round(120 * (snap.burnoutFloor / 100)), 6);
    for (const mark of [30, 60, 90])
      g.fillStyle(Colors.outline, 1).fillRect(10 + Math.round(1.2 * mark), 22, 1, 6);
    this.texts.burnout
      ?.setText(`BURNOUT ${String(Math.round(snap.burnout))} · ${snap.burnoutTier}`)
      .setColor(meltdown ? Css.danger : Css.white);
    // Mobilisation (seuils 50 / 100)
    bar(
      10,
      36,
      120,
      snap.mobilisation / 100,
      snap.mobilisation >= 50 ? Colors.quaiYellow : 0x8a7a30,
    );
    g.fillStyle(Colors.outline, 1).fillRect(70, 36, 1, 6);
    this.texts.mob?.setText(
      `MOBILISATION ${String(Math.floor(snap.mobilisation))}${snap.mobilisation >= 100 ? ' · PRÉAVIS' : snap.mobilisation >= 50 ? ' · SIFFLET' : ''}`,
    );
    // Charges de dash et Gobelets
    for (let i = 0; i < snap.dashMax; i += 1) {
      const full = i < snap.dashCharges;
      const x = 10 + i * 12;
      g.fillStyle(Colors.outline, 1).fillRect(x - 1, 47, 10, 8);
      g.fillStyle(full ? 0x3fb8e8 : 0x1a2230, 1).fillRect(x, 48, 8, 6);
      if (!full && i === snap.dashCharges)
        g.fillStyle(0x3fb8e8, 0.6).fillRect(x, 48, Math.round(8 * snap.dashProgress), 6);
    }
    for (let i = 0; i < snap.gobelets; i += 1) {
      const x = 64 + i * 10;
      g.fillStyle(Colors.outline, 1).fillRect(x - 1, 46, 8, 9);
      g.fillStyle(0xf4f6f8, 1).fillRect(x, 47, 6, 7);
      g.fillStyle(0x8a5a3c, 1).fillRect(x, 48, 6, 2);
    }
    this.texts.tier?.setText('');
    // Horloge 3x8 (LED) et compteurs
    g.fillStyle(0x05080d, 0.9).fillRect(GAME_WIDTH - 64, 4, 56, 12);
    this.texts.clock?.setText(snap.clock).setColor('#ff5a3a');
    this.texts.delay
      ?.setText(snap.delay > 0 ? `Retard cumulé +${String(snap.delay)} min` : 'À l’heure')
      .setColor(Css.ballast);
    this.texts.room?.setText(
      `Salle ${String(snap.room)}/10 · ${snap.roomLabel}${snap.enemiesLeft > 0 ? ` · ${String(snap.enemiesLeft)} ennemis` : ''}`,
    );
    this.texts.wallet?.setText(`Tickets ${String(snap.tickets)} · PS +${String(snap.ps)}`);
    // Barre du boss
    if (snap.boss) {
      const w = 300;
      const x = GAME_WIDTH / 2 - w / 2;
      bar(x, GAME_HEIGHT - 18, w, snap.boss.hp / snap.boss.maxHp, Colors.danger);
      for (const k of [0.6, 0.25])
        g.fillStyle(0xffffff, 0.8).fillRect(x + Math.round(w * k), GAME_HEIGHT - 18, 1, 6);
      this.texts.boss?.setText(snap.boss.name.toUpperCase()).setVisible(true);
    } else this.texts.boss?.setVisible(false);
  }

  // ─── Fenêtre de choix ──────────────────────────────────────────────────────

  public get isModalOpen(): boolean {
    return this.modal !== null;
  }

  /** Ouvre une fenêtre de choix ; `onPick` reçoit l'index choisi (une seule fois). */
  public openChoice(
    title: string,
    options: readonly ChoiceOption[],
    onPick: (index: number) => void,
    cancellable = false,
  ): void {
    this.closeChoice();
    const container = this.add.container(0, 0).setDepth(Depth.Overlay);
    const dim = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05080d, 0.75)
      .setOrigin(0)
      .setInteractive();
    const head = this.add
      .text(GAME_WIDTH / 2, 40, title, { ...TEXT, fontSize: '10px', color: Css.quaiYellow })
      .setOrigin(0.5)
      .setResolution(2);
    container.add([dim, head]);
    const cardW = Math.min(180, (GAME_WIDTH - 40) / Math.max(1, options.length) - 10);
    const total = options.length * (cardW + 10) - 10;
    this.modalCards = [];
    options.forEach((opt, i) => {
      const x = GAME_WIDTH / 2 - total / 2 + i * (cardW + 10) + cardW / 2;
      const card = this.add
        .rectangle(x, 170, cardW, 170, 0x0b1f3a, 0.95)
        .setStrokeStyle(1, opt.disabled ? 0x444c58 : Colors.ballast)
        .setInteractive({ useHandCursor: !opt.disabled });
      const name = this.add
        .text(x, 96, `${String(i + 1)}. ${opt.title}`, {
          ...TEXT,
          color: opt.disabled ? '#667080' : (opt.color ?? Css.white),
          wordWrap: { width: cardW - 12 },
          align: 'center',
        })
        .setOrigin(0.5, 0)
        .setResolution(2);
      const desc = this.add
        .text(x, 130, opt.desc, {
          ...TEXT,
          color: opt.disabled ? '#667080' : Css.ballast,
          wordWrap: { width: cardW - 14 },
          align: 'center',
          lineSpacing: 2,
        })
        .setOrigin(0.5, 0)
        .setResolution(2);
      card.on(Phaser.Input.Events.POINTER_OVER, () => {
        this.highlight(i);
      });
      card.on(Phaser.Input.Events.POINTER_UP, () => {
        this.pick(i);
      });
      container.add([card, name, desc]);
      this.modalCards.push(card);
    });
    const hint = cancellable ? 'Échap : fermer' : '';
    container.add(
      this.add
        .text(
          GAME_WIDTH / 2,
          GAME_HEIGHT - 26,
          `Clic, toucher, 1-${String(options.length)} ou ←/→ + Entrée${hint ? ` · ${hint}` : ''}`,
          { ...TEXT, color: Css.ballast },
        )
        .setOrigin(0.5)
        .setResolution(2),
    );
    this.modal = container;
    this.modalPick = onPick;
    this.modalOptions = options;
    this.modalCancellable = cancellable;
    this.modalIndex = Math.max(
      0,
      options.findIndex((o) => !o.disabled),
    );
    this.highlight(this.modalIndex);
    // Le bouton tactile est masqué derrière la fenêtre.
    this.registry.set(RegistryKeys.Touch, NO_TOUCH);
  }

  private modalCancellable = false;

  private highlight(i: number): void {
    this.modalIndex = i;
    this.modalCards.forEach((c, k) =>
      c.setStrokeStyle(k === i ? 2 : 1, k === i ? Colors.quaiYellow : Colors.ballast),
    );
  }

  private pick(i: number): void {
    const opt = this.modalOptions[i];
    if (!this.modalPick || !opt || opt.disabled) return;
    const cb = this.modalPick;
    this.closeChoice();
    cb(i);
  }

  public closeChoice(): void {
    this.modal?.destroy();
    this.modal = null;
    this.modalPick = null;
    this.modalCards = [];
  }

  private setupModalKeys(): void {
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (!this.modal) return;
      const n = Number.parseInt(ev.key, 10);
      if (n >= 1 && n <= this.modalOptions.length) this.pick(n - 1);
      else if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D')
        this.highlight((this.modalIndex + 1) % this.modalOptions.length);
      else if (
        ev.key === 'ArrowLeft' ||
        ev.key === 'q' ||
        ev.key === 'a' ||
        ev.key === 'Q' ||
        ev.key === 'A'
      )
        this.highlight((this.modalIndex - 1 + this.modalOptions.length) % this.modalOptions.length);
      else if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'e' || ev.key === 'E')
        this.pick(this.modalIndex);
      else if (ev.key === 'Escape' && this.modalCancellable)
        this.pick(this.modalOptions.length - 1);
    });
  }

  // ─── Tactile ───────────────────────────────────────────────────────────────

  private publishTouch(patch: Partial<TouchState>): void {
    this.touch = { ...this.touch, ...patch };
    this.registry.set(RegistryKeys.Touch, this.touch);
  }

  private createTouchControls(): void {
    this.input.addPointer(2);
    const R = 28;
    const buttons: {
      key: 'attack' | 'dash' | 'special' | 'coffee' | 'interact';
      label: string;
      x: number;
      y: number;
      r: number;
      color: number;
    }[] = [
      {
        key: 'attack',
        label: 'FRAPPE',
        x: GAME_WIDTH - 52,
        y: GAME_HEIGHT - 52,
        r: R + 4,
        color: Colors.hero,
      },
      {
        key: 'dash',
        label: 'DASH',
        x: GAME_WIDTH - 118,
        y: GAME_HEIGHT - 34,
        r: R - 4,
        color: 0x3fb8e8,
      },
      {
        key: 'special',
        label: 'SIFFLET',
        x: GAME_WIDTH - 62,
        y: GAME_HEIGHT - 122,
        r: R - 6,
        color: Colors.quaiYellow,
      },
      {
        key: 'coffee',
        label: 'CAFÉ',
        x: GAME_WIDTH - 126,
        y: GAME_HEIGHT - 96,
        r: R - 10,
        color: 0x8a5a3c,
      },
      {
        key: 'interact',
        label: 'E',
        x: GAME_WIDTH - 20,
        y: GAME_HEIGHT - 128,
        r: 12,
        color: Colors.ballast,
      },
    ];
    for (const b of buttons) {
      const circle = this.add
        .circle(b.x, b.y, b.r, b.color, 0.28)
        .setStrokeStyle(1, b.color, 0.9)
        .setInteractive();
      this.add
        .text(b.x, b.y, b.label, { ...TEXT, fontSize: '8px' })
        .setOrigin(0.5)
        .setResolution(2);
      circle.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
        if (this.modal) return;
        circle.setFillStyle(b.color, 0.6);
        this.publishTouch({ [b.key]: this.touch[b.key] + 1 });
        if (b.key === 'special') {
          this.specialPointer = p.id;
          this.publishTouch({ specialHeld: true });
        }
      });
      const release = (p: Phaser.Input.Pointer): void => {
        circle.setFillStyle(b.color, 0.28);
        if (b.key === 'special' && this.specialPointer === p.id) {
          this.specialPointer = null;
          this.publishTouch({ specialHeld: false });
        }
      };
      circle.on(Phaser.Input.Events.POINTER_UP, release);
      circle.on(Phaser.Input.Events.POINTER_OUT, release);
    }
    // Joystick flottant sur la moitié gauche.
    this.stickBase = this.add
      .circle(0, 0, 26, 0xffffff, 0.12)
      .setStrokeStyle(1, 0xffffff, 0.4)
      .setVisible(false);
    this.stickKnob = this.add.circle(0, 0, 11, 0xffffff, 0.35).setVisible(false);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.modal || p.x > GAME_WIDTH * 0.45 || this.stickPointer !== null) return;
      this.stickPointer = p.id;
      this.stickOrigin = { x: p.x, y: p.y };
      this.stickBase?.setPosition(p.x, p.y).setVisible(true);
      this.stickKnob?.setPosition(p.x, p.y).setVisible(true);
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stickPointer) return;
      const dx = p.x - this.stickOrigin.x;
      const dy = p.y - this.stickOrigin.y;
      const len = Math.hypot(dx, dy);
      const max = 26;
      const k = len > max ? max / len : 1;
      this.stickKnob?.setPosition(this.stickOrigin.x + dx * k, this.stickOrigin.y + dy * k);
      const mag = Math.min(1, len / max);
      this.publishTouch(
        len < 4 ? { moveX: 0, moveY: 0 } : { moveX: (dx / len) * mag, moveY: (dy / len) * mag },
      );
    });
    const end = (p: Phaser.Input.Pointer): void => {
      if (p.id !== this.stickPointer) return;
      this.stickPointer = null;
      this.stickBase?.setVisible(false);
      this.stickKnob?.setVisible(false);
      this.publishTouch({ moveX: 0, moveY: 0 });
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, end);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, end);
  }
}
