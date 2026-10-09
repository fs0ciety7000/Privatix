import '@/ui/hud/hud3d.css';
import { browserStorage } from '@/platform/storage';
import { QuaiScene } from '@/scenes3d/QuaiScene';
import { Loop } from '@/engine/Loop';
import type { QualityId } from '@/view/quality';
import { isQualityId, QUALITY } from '@/view/quality';

/**
 * Entrée 3D (migration Three.js, jalons J1-J2) : `play3d.html`. Elle coexiste avec le jeu Phaser
 * (`index.html`, en production jusqu'à la parité). Paramètres d'URL :
 *   ?q=bas|moyen|haut  preset de qualité      ?rm=1 / ?rm=0  réduction des mouvements
 *   ?safe              sans post-traitement   ?seed=N        graine du Shift
 *   ?demo              (dev) outil de pilotage pour les captures automatisées
 */

const REDUCED_KEY = 'privatix.3d.reducedMotion';

function byId(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} manquant`);
  return e;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return c.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

function pickQuality(params: URLSearchParams): QualityId {
  const q = params.get('q');
  if (isQualityId(q)) return q;
  const coarse = matchMedia('(pointer: coarse)').matches;
  return coarse ? 'moyen' : 'haut';
}

function pickReducedMotion(params: URLSearchParams): boolean {
  const rm = params.get('rm');
  if (rm === '1') return true;
  if (rm === '0') return false;
  const stored = browserStorage()?.getItem(REDUCED_KEY) ?? null;
  if (stored !== null) return stored === '1';
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function boot(): void {
  const loading = byId('loading');
  if (!webglAvailable()) {
    loading.classList.add('error');
    loading.textContent =
      'WebGL 2 est indisponible sur cet appareil : la version 3D ne peut pas démarrer.';
    return;
  }
  const params = new URLSearchParams(location.search);
  const seedParam = Number(params.get('seed'));
  const seed =
    Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : Date.now() % 100_000;
  const reducedMotion = pickReducedMotion(params);
  document.body.classList.toggle('reduced-motion', reducedMotion);
  const scene = new QuaiScene(
    {
      app: byId('app'),
      ui: byId('ui'),
      floats: byId('dmg-layer'),
      touch: {
        zone: byId('joyzone'),
        base: byId('joybase'),
        knob: byId('joyknob'),
        attack: byId('btn-attack'),
        dash: byId('btn-dash'),
        special: byId('btn-special'),
      },
    },
    { quality: QUALITY[pickQuality(params)], reducedMotion },
    params.has('safe'),
    seed,
    (on) => {
      document.body.classList.toggle('reduced-motion', on);
      browserStorage()?.setItem(REDUCED_KEY, on ? '1' : '0');
    },
  );
  addEventListener('resize', () => {
    scene.resize(innerWidth, innerHeight);
  });
  const loop = new Loop(
    (ms) => {
      scene.frame(ms);
    },
    (hidden) => {
      scene.setPaused(hidden);
    },
  );
  loop.start();
  loading.classList.add('hide');

  if (import.meta.env.DEV && params.has('demo')) {
    void import('@/scenes3d/demoApi').then((m) => {
      m.installDemoApi(scene);
    });
  }
}

boot();
