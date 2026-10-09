/**
 * Entrées du navigateur, sans gameplay : clavier (KeyboardEvent.code : ZQSD sur AZERTY = WASD sur
 * QWERTY sans double jeu de touches, plus les flèches), souris (visée + clic), manette (Gamepad API)
 * et tactile (joystick virtuel + boutons, Pointer Events). Les appuis sont mémorisés jusqu'à leur
 * lecture par la scène (`read`), qui les transmet à la simulation.
 */

export interface RawInput {
  /** Déplacement demandé (norme ≤ 1), axes écran (x droite, y bas). */
  readonly moveX: number;
  readonly moveY: number;
  /** Pointeur souris en coordonnées normalisées (−1..1), ou `null` s'il n'a pas bougé. */
  readonly pointer: { readonly x: number; readonly y: number } | null;
  /** Angle de visée du stick droit (axes écran), ou `null`. */
  readonly stickAim: number | null;
  readonly attack: boolean;
  readonly dash: boolean;
  readonly special: boolean;
  readonly specialHeld: boolean;
  readonly coffee: boolean;
  /** L'appui d'attaque vient du tactile (aide à la visée). */
  readonly touchAttack: boolean;
  readonly toggleStats: boolean;
  readonly toggleReducedMotion: boolean;
}

const MOVE_KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
} as const;

const STICK_DEADZONE = 0.22;
const JOY_RADIUS = 56;

export interface TouchElements {
  readonly zone: HTMLElement;
  readonly base: HTMLElement;
  readonly knob: HTMLElement;
  readonly attack: HTMLElement;
  readonly dash: HTMLElement;
  readonly special: HTMLElement;
}

export class Input {
  public readonly touch: boolean;
  private readonly keys = new Set<string>();
  private pointer: { x: number; y: number } | null = null;
  private attack = false;
  private dash = false;
  private special = false;
  private coffee = false;
  private touchAttack = false;
  private touchSpecialHeld = false;
  private stats = false;
  private reduced = false;
  private joyX = 0;
  private joyY = 0;
  private joyId: number | null = null;
  private joyOx = 0;
  private joyOy = 0;
  private padPrev: boolean[] = [];
  private readonly cleanups: (() => void)[] = [];

  /** `surface` : conteneur du canvas (les événements du canvas y remontent, il survit aux changements de vue). */
  public constructor(
    private readonly surface: HTMLElement,
    touchEls: TouchElements | null,
  ) {
    this.touch =
      matchMedia('(pointer: coarse)').matches || 'ontouchstart' in document.documentElement;
    this.listen(document, 'keydown', (e) => {
      const k = e as KeyboardEvent;
      if (k.repeat) return;
      this.keys.add(k.code);
      switch (k.code) {
        case 'Space':
        case 'ShiftLeft':
        case 'ShiftRight':
          this.dash = true;
          k.preventDefault();
          break;
        case 'KeyJ':
        case 'Enter':
          this.attack = true;
          break;
        case 'KeyF':
          this.special = true;
          break;
        case 'KeyR':
          this.coffee = true;
          break;
        case 'F3':
          this.stats = true;
          k.preventDefault();
          break;
        case 'KeyM':
          this.reduced = true;
          break;
        default:
          if (k.code.startsWith('Arrow')) k.preventDefault();
      }
    });
    this.listen(document, 'keyup', (e) => this.keys.delete((e as KeyboardEvent).code));
    this.listen(globalWindow(), 'blur', () => {
      this.keys.clear();
    });
    this.listen(surface, 'pointermove', (e) => {
      const p = e as PointerEvent;
      if (p.pointerType === 'mouse') this.setPointer(p);
    });
    this.listen(surface, 'pointerdown', (e) => {
      const p = e as PointerEvent;
      if (p.pointerType === 'mouse' && p.button === 0) {
        this.setPointer(p);
        this.attack = true;
      }
    });
    this.listen(surface, 'contextmenu', (e) => {
      e.preventDefault();
    });
    if (this.touch && touchEls) this.setupTouch(touchEls);
  }

  private listen(target: EventTarget, type: string, fn: (e: Event) => void): void {
    target.addEventListener(type, fn);
    this.cleanups.push(() => {
      target.removeEventListener(type, fn);
    });
  }

  private setPointer(e: PointerEvent): void {
    const r = this.surface.getBoundingClientRect();
    this.pointer = {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: -((e.clientY - r.top) / r.height) * 2 + 1,
    };
  }

  private setupTouch(t: TouchElements): void {
    document.body.classList.add('touch');
    this.listen(t.zone, 'pointerdown', (e) => {
      const p = e as PointerEvent;
      this.joyId = p.pointerId;
      this.joyOx = p.clientX;
      this.joyOy = p.clientY;
      t.zone.setPointerCapture(p.pointerId);
      t.base.style.left = `${String(p.clientX)}px`;
      t.base.style.top = `${String(p.clientY)}px`;
      t.base.classList.add('on');
      t.knob.style.transform = 'translate(-50%, -50%)';
    });
    this.listen(t.zone, 'pointermove', (e) => {
      const p = e as PointerEvent;
      if (p.pointerId !== this.joyId) return;
      let dx = p.clientX - this.joyOx;
      let dy = p.clientY - this.joyOy;
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) {
        dx = (dx / len) * JOY_RADIUS;
        dy = (dy / len) * JOY_RADIUS;
      }
      this.joyX = dx / JOY_RADIUS;
      this.joyY = dy / JOY_RADIUS;
      t.knob.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
    });
    const end = (e: Event): void => {
      if ((e as PointerEvent).pointerId !== this.joyId) return;
      this.joyId = null;
      this.joyX = 0;
      this.joyY = 0;
      t.base.classList.remove('on');
    };
    this.listen(t.zone, 'pointerup', end);
    this.listen(t.zone, 'pointercancel', end);
    const button = (el: HTMLElement, down: () => void, up?: () => void): void => {
      this.listen(el, 'pointerdown', (e) => {
        e.preventDefault();
        down();
        el.classList.add('down');
      });
      const release = (): void => {
        el.classList.remove('down');
        up?.();
      };
      this.listen(el, 'pointerup', release);
      this.listen(el, 'pointercancel', release);
    };
    button(t.attack, () => {
      this.attack = true;
      this.touchAttack = true;
    });
    button(t.dash, () => (this.dash = true));
    button(
      t.special,
      () => {
        this.special = true;
        this.touchSpecialHeld = true;
      },
      () => (this.touchSpecialHeld = false),
    );
  }

  private pad(): { mx: number; my: number; aim: number | null; buttons: boolean[] } | null {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const gp = pads.find((p) => p !== null) ?? null;
    if (!gp) return null;
    const ax = (i: number): number => gp.axes[i] ?? 0;
    let mx = ax(0);
    let my = ax(1);
    if (Math.hypot(mx, my) < STICK_DEADZONE) {
      mx = 0;
      my = 0;
    }
    const rx = ax(2);
    const ry = ax(3);
    const aim = Math.hypot(rx, ry) > 0.35 ? Math.atan2(ry, rx) : null;
    return { mx, my, aim, buttons: gp.buttons.map((b) => b.pressed) };
  }

  /** Lit l'état de la frame et vide les appuis mémorisés. */
  public read(): RawInput {
    const k = this.keys;
    const has = (codes: readonly string[]): boolean => codes.some((c) => k.has(c));
    let mx = (has(MOVE_KEYS.right) ? 1 : 0) - (has(MOVE_KEYS.left) ? 1 : 0);
    let my = (has(MOVE_KEYS.down) ? 1 : 0) - (has(MOVE_KEYS.up) ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
    } else if (Math.hypot(this.joyX, this.joyY) > 0.12) {
      mx = this.joyX;
      my = this.joyY;
    }
    let stickAim: number | null = null;
    let padSpecialHeld = false;
    const pad = this.pad();
    if (pad) {
      if (mx === 0 && my === 0) {
        mx = pad.mx;
        my = pad.my;
      }
      stickAim = pad.aim;
      const pressed = (i: number): boolean =>
        (pad.buttons[i] ?? false) && !(this.padPrev[i] ?? false);
      // A : frappe, B ou gâchette droite : dash, Y : sifflet (maintenu = préavis), X : café.
      if (pressed(0)) this.attack = true;
      if (pressed(1) || pressed(7)) this.dash = true;
      if (pressed(3)) this.special = true;
      if (pressed(2)) this.coffee = true;
      padSpecialHeld = pad.buttons[3] ?? false;
      this.padPrev = pad.buttons;
    }
    const out: RawInput = {
      moveX: mx,
      moveY: my,
      pointer: this.pointer,
      stickAim,
      attack: this.attack,
      dash: this.dash,
      special: this.special,
      specialHeld: k.has('KeyF') || this.touchSpecialHeld || padSpecialHeld,
      coffee: this.coffee,
      touchAttack: this.touchAttack,
      toggleStats: this.stats,
      toggleReducedMotion: this.reduced,
    };
    this.attack = false;
    this.dash = false;
    this.special = false;
    this.coffee = false;
    this.touchAttack = false;
    this.stats = false;
    this.reduced = false;
    return out;
  }

  /** Appuis simulés (captures automatisées, tests de bout en bout). */
  public press(what: 'attack' | 'dash' | 'special' | 'coffee'): void {
    if (what === 'attack') this.attack = true;
    else if (what === 'dash') this.dash = true;
    else if (what === 'special') this.special = true;
    else this.coffee = true;
  }

  public dispose(): void {
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
  }
}

/** La fenêtre comme cible d'événements (la règle ESLint interdit le global `window` ailleurs). */
function globalWindow(): EventTarget {
  return document.defaultView ?? document;
}
