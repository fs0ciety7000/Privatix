import { gsap } from 'gsap';
import { SIM_DT_MS } from '@/sim/clock/FixedClock';
import type { ShiftId } from '@/config/balance';
import type { Game3D } from '@/scenes3d/Game3D';

/**
 * Mode capture du trailer (`play3d.html?demo&cheat&trailer&seed=N&aspect=16x9`, dev uniquement).
 *
 * La boucle `requestAnimationFrame` n'est pas lancée : chaque image est produite par
 * `__privatix3d.frame(w, h)`, qui joue un pas fixe de simulation, dessine, puis fait avancer du même
 * pas tout ce qui, d'ordinaire, suit le temps réel :
 * - GSAP (bandeaux, cartes d'intro, sous-titres, fondus) : racine pilotée par `gsap.updateRoot` ;
 * - animations et transitions CSS : mises en pause et positionnées à la main (`currentTime`) ;
 * - `Math.random` (particules, étincelles) : remplacé au démarrage par un générateur à graine
 *   (`seedRandom`, appelé par `main3d.ts`).
 * Le rendu est donc reproductible à l'image près, quel que soit le temps réel d'une image en rendu
 * logiciel. Le canvas WebGL garde son tampon (`preserveDrawingBuffer`) : `canvasData()` le lit.
 */
export function installTrailer(game: Game3D): void {
  game.trailer = true;
  gsap.ticker.remove(gsap.updateRoot);
  let gsapTime = gsap.ticker.time;
  const clocks = new WeakMap<Animation, number>();
  let width = innerWidth;
  let height = innerHeight;

  /** Pas de temps des animations CSS : chacune part de 0 à sa première image vue. */
  const stepCss = (dtMs: number): void => {
    for (const a of document.getAnimations()) {
      const t = (clocks.get(a) ?? 0) + dtMs;
      if (a.playState !== 'paused') a.pause();
      a.currentTime = t;
      clocks.set(a, t);
    }
  };

  const capture = {
    /** Une image : pas fixe, rendu, GSAP et CSS au même pas. Change la taille si besoin. */
    frame: (w = width, h = height, draw = true): string[] => {
      if (w !== width || h !== height) {
        width = w;
        height = h;
        game.resize(w, h);
      }
      game.captureEvents = [];
      game.captureFrame(draw);
      gsapTime += SIM_DT_MS / 1000;
      gsap.updateRoot(gsapTime);
      stepCss(SIM_DT_MS);
      // Événements de la sim pendant cette image (impacts, phases…) : le montage s'y cale.
      return game.captureEvents;
    },
    /** Plusieurs images sans lecture (prises de marge). */
    frames: (n: number): number => {
      for (let i = 0; i < n; i += 1) capture.frame();
      return n;
    },
    /** Avance de `n` images sans dessiner (mise en place d'un plan, même horloge que `frame`). */
    skip: (n: number): number => {
      for (let i = 0; i < n; i += 1) capture.frame(width, height, false);
      return n;
    },
    /** Héros intouchable (plans de combat : ni coup reçu ni vignette magenta). */
    untouchable: (on: boolean) => {
      game.simWorld.hero.untouchable = on;
    },
    /** Salle nettoyée avec sa fanfare (ralenti, carillon) : le « dernier kill » du plan 10. */
    clearRoom: () => {
      game.simWorld.director.clearRoom(true);
    },
    /** Dimensions de la salle courante (u) : placement du héros en bas d'arène. */
    arena: () => {
      const a = game.simWorld.arena;
      return { w: a.widthPx, h: a.heightPx, tile: a.tileSize };
    },
    /** Roulement du hub (`matin`, `soir`, `nuit`) pour l'éclairage de l'OCC, sans verrou. */
    hubShift: (shift: ShiftId): boolean => {
      const h = game.hubController;
      if (!h) return false;
      h.sim.shift = shift;
      return true;
    },
    /** Contenu du canvas WebGL (sans le HUD DOM). */
    canvasData: (type = 'image/png', quality = 0.95): string =>
      game.gameView.canvas.toDataURL(type, quality),
    /** Entre au hub (OCC) depuis l'écran titre, sans passer par le menu. */
    hubEnter: () => {
      game.enterHub();
    },
  };
  const w = (document.defaultView ?? {}) as { __privatix3d?: Record<string, unknown> };
  w.__privatix3d = Object.assign(w.__privatix3d ?? {}, capture);
}

/** Remplace `Math.random` par un générateur à graine (mulberry32) : particules reproductibles. */
export function seedRandom(seed: number): void {
  let a = seed >>> 0 || 1;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
