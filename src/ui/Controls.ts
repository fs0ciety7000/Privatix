import Phaser from 'phaser';
import { RegistryKeys } from '@/config/constants';
import type { TouchState } from '@/systems/meta/session';
import { NO_TOUCH } from '@/systems/meta/session';
import { angleDiff } from '@/utils/math';
import type { PlayerIntent } from '@/entities/Player';

const K = Phaser.Input.Keyboard.KeyCodes;

export interface FrameInput extends PlayerIntent {
  readonly interact: boolean;
  readonly pause: boolean;
}

interface Target {
  readonly x: number;
  readonly y: number;
}

/** Aide à la visée tactile / manette : cible la plus proche dans un cône de 60°, à 140 px. */
const AUTO_AIM_DEG = 60;
const AUTO_AIM_RANGE = 140;
const STICK_DEADZONE = 0.2;
const AIM_STICK_THRESHOLD = 0.35;

/**
 * Lecture des commandes (clavier + souris, manette, tactile) en une intention par frame.
 * ZQSD et WASD fonctionnent sans réglage (les deux jeux de touches sont lus).
 */
export class Controls {
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key>;
  private lastTouch: TouchState = NO_TOUCH;
  private mouseAimAt = -Infinity;
  private lastPointer = { x: 0, y: 0 };
  private leftWasDown = false;
  private rightWasDown = false;
  private padPrev: Record<string, boolean> = {};
  private lastMoveAngle = Math.PI / 2;
  private readonly touchMode: boolean;

  public constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Clavier indisponible');
    this.keys = kb.addKeys(
      {
        up: K.Z,
        up2: K.W,
        up3: K.UP,
        left: K.Q,
        left2: K.A,
        left3: K.LEFT,
        down: K.S,
        down2: K.DOWN,
        right: K.D,
        right2: K.RIGHT,
        dash: K.SPACE,
        dash2: K.SHIFT,
        special: K.F,
        coffee: K.R,
        interact: K.E,
        enter: K.ENTER,
        pause: K.ESC,
        pause2: K.P,
        attack: K.J,
      },
      true,
      false,
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.touchMode = scene.sys.game.device.input.touch;
    this.lastTouch = (scene.registry.get(RegistryKeys.Touch) as TouchState | undefined) ?? NO_TOUCH;
  }

  private down(...names: string[]): boolean {
    return names.some((n) => this.keys[n]?.isDown === true);
  }

  private pressed(...names: string[]): boolean {
    return names.some((n) => {
      const key = this.keys[n];
      return key !== undefined && Phaser.Input.Keyboard.JustDown(key);
    });
  }

  /** Lit l'intention de la frame. `from` = position du héros, `targets` = ennemis vivants (aide à la visée). */
  public read(
    from: Target,
    targets: readonly Target[],
    camera: Phaser.Cameras.Scene2D.Camera,
  ): FrameInput {
    let mx = 0;
    let my = 0;
    if (this.down('up', 'up2', 'up3')) my -= 1;
    if (this.down('down', 'down2')) my += 1;
    if (this.down('left', 'left2', 'left3')) mx -= 1;
    if (this.down('right', 'right2')) mx += 1;

    let attack = this.pressed('attack');
    let dash = this.pressed('dash', 'dash2');
    let special = this.pressed('special');
    let coffee = this.pressed('coffee');
    let interact = this.pressed('interact', 'enter');
    let pause = this.pressed('pause', 'pause2');
    let specialHeld = this.down('special');

    // Souris : clic gauche = attaque, clic droit = spéciale (maintien = Préavis).
    const pointer = this.scene.input.activePointer;
    const isMouse = !pointer.wasTouch;
    if (isMouse) {
      const left = pointer.leftButtonDown();
      const right = pointer.rightButtonDown();
      if (left && !this.leftWasDown) attack = true;
      if (right && !this.rightWasDown) special = true;
      specialHeld ||= right;
      this.leftWasDown = left;
      this.rightWasDown = right;
      if (pointer.x !== this.lastPointer.x || pointer.y !== this.lastPointer.y || left || right) {
        this.mouseAimAt = this.scene.time.now;
        this.lastPointer = { x: pointer.x, y: pointer.y };
      }
    }

    // Manette.
    let aimStick: number | null = null;
    const pad = this.scene.input.gamepad?.getPad(0);
    if (pad?.connected) {
      const lx = pad.leftStick.x;
      const ly = pad.leftStick.y;
      if (Math.hypot(lx, ly) > STICK_DEADZONE) {
        mx += lx;
        my += ly;
      }
      if (Math.hypot(pad.rightStick.x, pad.rightStick.y) > AIM_STICK_THRESHOLD) {
        aimStick = Math.atan2(pad.rightStick.y, pad.rightStick.x);
      }
      const edge = (name: string, value: boolean): boolean => {
        const was = this.padPrev[name] ?? false;
        this.padPrev[name] = value;
        return value && !was;
      };
      attack ||= edge('x', pad.X);
      dash ||= edge('a', pad.A) || edge('rb', pad.R1 > 0.5);
      special ||= edge('b', pad.B);
      specialHeld ||= pad.B;
      coffee ||= edge('y', pad.Y);
      interact ||= edge('lb', pad.L1 > 0.5);
      // Bouton « menu » de la disposition standard.
      pause ||= edge('start', pad.buttons[9]?.pressed === true);
    }

    // Tactile : compteurs publiés par l'UIScene.
    const touch =
      (this.scene.registry.get(RegistryKeys.Touch) as TouchState | undefined) ?? NO_TOUCH;
    if (touch !== this.lastTouch) {
      attack ||= touch.attack !== this.lastTouch.attack;
      dash ||= touch.dash !== this.lastTouch.dash;
      special ||= touch.special !== this.lastTouch.special;
      coffee ||= touch.coffee !== this.lastTouch.coffee;
      interact ||= touch.interact !== this.lastTouch.interact;
      this.lastTouch = touch;
    }
    specialHeld ||= touch.specialHeld;
    if (touch.moveX !== 0 || touch.moveY !== 0) {
      mx += touch.moveX;
      my += touch.moveY;
    }

    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    if (len > 0.01) this.lastMoveAngle = Math.atan2(my, mx);

    // Visée : souris récente > stick droit > aide à la visée sur la direction de déplacement.
    let aim: number;
    const mouseRecent = isMouse && !this.touchMode && this.scene.time.now - this.mouseAimAt < 4000;
    if (aimStick !== null) aim = aimStick;
    else if (mouseRecent) {
      const world = camera.getWorldPoint(pointer.x, pointer.y);
      aim = Math.atan2(world.y - (from.y - 10), world.x - from.x);
    } else aim = this.autoAim(from, targets, this.lastMoveAngle);

    return {
      moveX: mx,
      moveY: my,
      aim,
      attack,
      dash,
      special,
      coffee,
      specialHeld,
      interact,
      pause,
    };
  }

  private autoAim(from: Target, targets: readonly Target[], base: number): number {
    let best: number | null = null;
    let bestScore = Infinity;
    for (const t of targets) {
      const d = Math.hypot(t.x - from.x, t.y - from.y);
      if (d > AUTO_AIM_RANGE) continue;
      const a = Math.atan2(t.y - from.y, t.x - from.x);
      const off = Math.abs(angleDiff(base, a));
      if (off > (AUTO_AIM_DEG * Math.PI) / 180) continue;
      const score = d + off * 60;
      if (score < bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return best ?? base;
  }
}
