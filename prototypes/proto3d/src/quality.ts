// Presets de qualité (Bas / Moyen / Haut) et réglage « Réduction des mouvements ».
// Choix au démarrage : ?q=low|med|high > choix manuel mémorisé (F2) > détection du GPU
// (WEBGL_debug_renderer_info), puis micro-benchmark des premières secondes qui peut descendre d'un cran.
import type * as THREE from 'three';

export type QualityLevel = 'low' | 'med' | 'high';
export const LEVELS: QualityLevel[] = ['low', 'med', 'high'];

export interface Preset {
  label: string;
  /** plafond du pixel ratio */
  prCap: number;
  /** plancher de la résolution adaptative */
  prMin: number;
  /** échantillons MSAA (0 = aucun) ; réduit à 2 si DPR > 1,5 */
  msaa: number;
  fxaa: boolean;
  /** 0 = pas de shadow map (ombres « blob » sous les personnages) */
  shadowSize: number;
  /** échelle de la résolution du bloom (1 = d'origine, 0,5 = demi) */
  bloomScale: number;
  /** null = toutes les lampes réelles ; sinon nombre de slots dynamiques (+ lampe frontale) */
  dynLights: number | null;
  /** densité des particules (0..1) */
  particles: number;
}

export const PRESETS: Record<QualityLevel, Preset> = {
  high: { label: 'HAUT', prCap: 2, prMin: 1, msaa: 4, fxaa: false, shadowSize: 2048, bloomScale: 1, dynLights: null, particles: 1 },
  med: { label: 'MOYEN', prCap: 1.5, prMin: 1, msaa: 0, fxaa: true, shadowSize: 1024, bloomScale: 0.5, dynLights: 3, particles: 0.7 },
  low: { label: 'BAS', prCap: 1, prMin: 0.75, msaa: 0, fxaa: false, shadowSize: 0, bloomScale: 0.25, dynLights: 1, particles: 0.45 },
};

const params = new URLSearchParams(location.search);

function store(key: string, v: string | null): void {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* stockage indisponible : réglage non mémorisé */
  }
}

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseLevel(v: string | null): QualityLevel | null {
  if (!v) return null;
  const k = v.toLowerCase();
  if (k === 'low' || k === 'bas' || k === 'l') return 'low';
  if (k === 'med' || k === 'medium' || k === 'moyen' || k === 'm') return 'med';
  if (k === 'high' || k === 'haut' || k === 'h') return 'high';
  return null;
}

/** Nom du GPU (non masqué si possible) et estimation de sa classe. */
export function detectGpu(renderer: THREE.WebGLRenderer): { name: string; guess: QualityLevel; why: string } {
  const gl = renderer.getContext();
  let name = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch {
    name = '';
  }
  const n = name.toLowerCase();
  const mobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820);
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(n)) return { name, guess: 'low', why: 'rendu logiciel' };
  if (mobile || /mali|adreno|powervr|apple gpu|videocore|tegra/.test(n)) return { name, guess: 'low', why: 'mobile' };
  if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc\(tm\) a|arc a\d/.test(n)) return { name, guess: 'high', why: 'GPU dédié' };
  if (/apple m\d/.test(n)) return { name, guess: 'high', why: 'Apple Silicon' };
  if (/intel|iris|uhd|hd graphics|radeon\(tm\) graphics|radeon graphics|vega \d/.test(n)) return { name, guess: 'med', why: 'GPU intégré' };
  return { name, guess: 'med', why: 'GPU inconnu' };
}

export class Settings {
  level: QualityLevel;
  /** 'url' et 'manual' figent le preset ; 'auto' autorise la descente automatique. */
  source: 'url' | 'manual' | 'auto';
  reducedMotion: boolean;
  /** vrai si la réduction vient du système (prefers-reduced-motion) et non d'un choix explicite. */
  rmFromSystem: boolean;
  /** le joueur a choisi lui-même (F4 ou ?rm=) : on ne suit plus le réglage système. */
  rmExplicit: boolean;
  gpu = '';
  why = '';

  constructor(guess: () => { name: string; guess: QualityLevel; why: string }) {
    const fromUrl = parseLevel(params.get('q'));
    const saved = parseLevel(load('privatix3d.q'));
    if (fromUrl) {
      this.level = fromUrl;
      this.source = 'url';
    } else if (saved) {
      this.level = saved;
      this.source = 'manual';
    } else {
      this.level = 'med';
      this.source = 'auto';
    }
    const g = guess();
    this.gpu = g.name;
    this.why = g.why;
    if (this.source === 'auto') this.level = g.guess;

    const rmUrl = params.get('rm');
    const rmSaved = load('privatix3d.rm');
    const sys = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.rmExplicit = rmUrl !== null || rmSaved !== null;
    if (rmUrl !== null) {
      this.reducedMotion = rmUrl !== '0' && rmUrl !== 'false';
      this.rmFromSystem = false;
    } else if (rmSaved !== null) {
      this.reducedMotion = rmSaved === '1';
      this.rmFromSystem = false;
    } else {
      this.reducedMotion = sys;
      this.rmFromSystem = sys;
    }
  }

  get preset(): Preset {
    return PRESETS[this.level];
  }

  /** F2 : Bas → Moyen → Haut → Bas… (mémorisé). */
  cycle(): QualityLevel {
    this.level = LEVELS[(LEVELS.indexOf(this.level) + 1) % LEVELS.length];
    this.source = 'manual';
    store('privatix3d.q', this.level);
    return this.level;
  }

  /** Descente automatique d'un cran (jamais mémorisée). */
  stepDown(): boolean {
    if (this.source !== 'auto' || this.level === 'low') return false;
    this.level = LEVELS[LEVELS.indexOf(this.level) - 1];
    return true;
  }

  toggleReducedMotion(): boolean {
    this.reducedMotion = !this.reducedMotion;
    this.rmFromSystem = false;
    this.rmExplicit = true;
    store('privatix3d.rm', this.reducedMotion ? '1' : '0');
    return this.reducedMotion;
  }
}

/** Réglages lus par les effets (instance unique, renseignée par main.ts). */
export const fxFlags = {
  /** Réduction des mouvements : pas de clignotement, de lasers, de stroboscope ni de scintillement. */
  reducedMotion: false,
  /** Densité des particules (0..1). */
  particles: 1,
  /** Échelle des tremblements d'écran. */
  shake: 1,
};
