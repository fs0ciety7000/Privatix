// Entrées : clavier (ZQSD sur AZERTY = WASD sur QWERTY grâce à KeyboardEvent.code, + flèches),
// souris (visée + clic gauche), tactile (joystick virtuel + boutons).
import * as THREE from 'three';

export class Input {
  private keys = new Set<string>();
  readonly mouseNdc = new THREE.Vector2(0, 0);
  mouseActive = false;
  private attackPressed = false;
  private dashPressed = false;
  private interactPressed = false;
  readonly touch: boolean;
  private joy = new THREE.Vector2();
  private joyId: number | null = null;
  private joyOrigin = new THREE.Vector2();

  constructor(private readonly canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'ShiftLeft') {
        this.dashPressed = true;
        e.preventDefault();
      }
      if (e.code === 'KeyE' || e.code === 'KeyF') this.interactPressed = true;
      if (e.code === 'KeyJ' || e.code === 'Enter') this.attackPressed = true;
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        const r = canvas.getBoundingClientRect();
        this.mouseNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        this.mouseActive = true;
      }
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) {
        const r = canvas.getBoundingClientRect();
        this.mouseNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        this.mouseActive = true;
        this.attackPressed = true;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    if (this.touch) this.setupTouch(ui);
  }

  private setupTouch(ui: HTMLElement): void {
    document.body.classList.add('touch');
    const zone = ui.querySelector<HTMLElement>('#joyzone');
    const knob = ui.querySelector<HTMLElement>('#joyknob');
    const base = ui.querySelector<HTMLElement>('#joybase');
    if (!zone || !knob || !base) return;
    const R = 56;
    zone.addEventListener('pointerdown', (e) => {
      this.joyId = e.pointerId;
      this.joyOrigin.set(e.clientX, e.clientY);
      zone.setPointerCapture(e.pointerId);
      base.style.left = `${e.clientX}px`;
      base.style.top = `${e.clientY}px`;
      base.classList.add('on');
      knob.style.transform = 'translate(-50%, -50%)';
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyId) return;
      const d = new THREE.Vector2(e.clientX - this.joyOrigin.x, e.clientY - this.joyOrigin.y);
      if (d.length() > R) d.setLength(R);
      this.joy.set(d.x / R, d.y / R);
      knob.style.transform = `translate(calc(-50% + ${d.x}px), calc(-50% + ${d.y}px))`;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      this.joy.set(0, 0);
      base.classList.remove('on');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    const btn = (id: string, fn: () => void) => {
      const b = ui.querySelector<HTMLElement>(id);
      b?.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fn();
        b.classList.add('down');
      });
      b?.addEventListener('pointerup', () => b.classList.remove('down'));
      b?.addEventListener('pointercancel', () => b.classList.remove('down'));
    };
    btn('#btn-attack', () => (this.attackPressed = true));
    btn('#btn-dash', () => (this.dashPressed = true));
    btn('#btn-use', () => (this.interactPressed = true));
  }

  /** Direction de déplacement à l'écran (x droite, y bas), longueur ≤ 1. */
  move(): THREE.Vector2 {
    const v = new THREE.Vector2();
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) v.y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) v.y += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) v.x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) v.x += 1;
    if (v.lengthSq() > 0) v.normalize();
    else if (this.joy.lengthSq() > 0.02) v.copy(this.joy);
    return v;
  }

  consumeAttack(): boolean {
    const a = this.attackPressed;
    this.attackPressed = false;
    return a;
  }

  consumeDash(): boolean {
    const a = this.dashPressed;
    this.dashPressed = false;
    return a;
  }

  consumeInteract(): boolean {
    const a = this.interactPressed;
    this.interactPressed = false;
    return a;
  }

  /** Simulation (démo / tests automatisés). */
  press(what: 'attack' | 'dash' | 'interact'): void {
    if (what === 'attack') this.attackPressed = true;
    else if (what === 'dash') this.dashPressed = true;
    else this.interactPressed = true;
  }

  get canvasEl(): HTMLCanvasElement {
    return this.canvas;
  }
}
