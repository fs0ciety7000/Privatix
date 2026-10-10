import '@/ui/hud/hud3d.css';
import '@/ui/menus/menus.css';
import '@/ui/hub/hub.css';
import '@/ui/loot/loot.css';
import '@/ui/trailer.css';
import { browserStorage } from '@/platform/storage';
import { Game3D, storedQuality } from '@/scenes3d/Game3D';
import { Loop } from '@/engine/Loop';
import type { QualityId, ViewSettings } from '@/view/quality';
import { captureFraming, isQualityId, QUALITY } from '@/view/quality';
import { installModelLibrary, ModelLibrary } from '@/view/models/ModelLibrary';

/**
 * Entrée 3D (migration Three.js, jalon J4 : un Shift complet) : `play3d.html`. Elle coexiste avec le
 * jeu Phaser (`index.html`, en production jusqu'à la parité). Paramètres d'URL :
 *   ?q=bas|moyen|haut  preset de qualité      ?rm=1 / ?rm=0  réduction des mouvements
 *   ?safe              sans post-traitement   ?seed=N        graine du Shift
 *   ?procedural        personnages procéduraux (sans les GLB de public/models)
 *   ?cheat             (dev) K tue tout, G invincible, N salle suivante, B boss
 *   ?demo              (dev) outil de pilotage pour les captures automatisées
 *   ?trailer           (dev, avec ?demo) mode capture du trailer : HUD masqué, qualité haute, pixel
 *                      ratio 1, rendu image par image sur l'horloge de la sim (`scenes3d/trailer.ts`)
 *   ?aspect=16x9|3x2|1x1|9x16  (avec ?trailer) cadrage de la caméra par format
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
  const stored = storedQuality();
  if (stored) return stored;
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

/** Personnages préchargés avant le titre (un Shift complet) ; les autres se chargent à la demande. */
const PRELOAD_CHARACTERS = ['hero', 'consultant', 'borne', 'drone', 'manager', 'auditeur', 'furet'];
/** Ennemis majeurs et boss des biomes 2 et 3 : chargés en arrière-plan après le titre. */
const LATER_CHARACTERS = ['fluidifieur', 'dirupo', 'discosaure'];

/**
 * Précharge les GLB (public/models) avec une barre de progression dans l'écran de chargement. Un
 * manifeste ou un modèle en échec n'empêche pas de jouer : la fabrique retombe sur le procédural.
 */
async function preloadModels(loading: HTMLElement, lowDetail: boolean): Promise<void> {
  const bar = document.createElement('div');
  bar.className = 'loading-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', 'Chargement des personnages');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  const fill = document.createElement('div');
  bar.appendChild(fill);
  loading.appendChild(bar);
  const lib = await ModelLibrary.open(import.meta.env.BASE_URL, lowDetail);
  if (lib) {
    await lib.preload(PRELOAD_CHARACTERS, Object.keys(lib.manifest.items), (done, total) => {
      const pct = Math.round((100 * done) / total);
      fill.style.width = `${String(pct)}%`;
      bar.setAttribute('aria-valuenow', String(pct));
    });
  }
  installModelLibrary(lib);
  bar.remove();
  if (lib) for (const name of LATER_CHARACTERS) void lib.loadCharacter(name);
}

async function boot(): Promise<void> {
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
  const trailer = import.meta.env.DEV && params.has('demo') && params.has('trailer');
  if (trailer) {
    const { seedRandom } = await import('@/scenes3d/trailer');
    seedRandom(seed);
    document.body.classList.add('trailer');
  }
  const reducedMotion = trailer ? params.get('rm') === '1' : pickReducedMotion(params);
  document.body.classList.toggle('reduced-motion', reducedMotion);
  const quality = trailer ? 'haut' : pickQuality(params);
  const settings: ViewSettings = trailer
    ? {
        quality: {
          ...QUALITY.haut,
          pixelRatioCap: 1,
          dynamicResolution: false,
          // Réglages fins du rendu logiciel des captures (coût par image) : `?msaa=`, `?shadow=`.
          msaa: Number(params.get('msaa') ?? QUALITY.haut.msaa),
          shadowMapSize: Number(params.get('shadow') ?? QUALITY.haut.shadowMapSize),
          bloomScale: Number(params.get('bloom') ?? QUALITY.haut.bloomScale),
          fxaa: params.has('fxaa'),
        },
        reducedMotion,
        capture: captureFraming(params.get('aspect')),
      }
    : { quality: QUALITY[quality], reducedMotion };
  if (!params.has('procedural')) await preloadModels(loading, quality === 'bas');
  const scene = new Game3D(
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
    settings,
    params.has('safe'),
    seed,
    (on) => {
      document.body.classList.toggle('reduced-motion', on);
      browserStorage()?.setItem(REDUCED_KEY, on ? '1' : '0');
    },
    import.meta.env.DEV && params.has('cheat'),
  );
  addEventListener('resize', () => {
    scene.resize(innerWidth, innerHeight);
  });
  const loop = new Loop(
    (ms) => {
      scene.frame(ms);
    },
    (hidden) => {
      scene.setHidden(hidden);
    },
  );
  // Mode capture : pas de boucle temps réel, chaque image est demandée par `__privatix3d.frame`.
  if (!trailer) loop.start();
  loading.classList.add('hide');

  if (import.meta.env.DEV && params.has('demo')) {
    void import('@/scenes3d/demoApi').then(async (m) => {
      m.installDemoApi(scene);
      if (trailer) (await import('@/scenes3d/trailer')).installTrailer(scene);
    });
  }
}

void boot();
