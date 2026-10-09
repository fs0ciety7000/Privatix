/**
 * Aléatoire pur et injectable (claude.md : « l'aléatoire est injecté »).
 * `createRng` fournit un générateur seedé (mulberry32) pour les tests et les simulations ;
 * le jeu peut passer directement `Math.random`, qui a la même signature.
 */

/** Générateur dans [0, 1[. Même forme que `Rng` du moteur de combat. */
export type Rng = () => number;

const MULBERRY_INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 4294967296;

/** Générateur seedé déterministe (mulberry32). Deux appels avec la même graine donnent la même suite. */
export function createRng(seed: number): Rng {
  let a = Math.trunc(seed) >>> 0;
  return () => {
    a = (a + MULBERRY_INCREMENT) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

/** Entier uniforme dans [min, max] (bornes incluses). */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Élément uniforme d'une liste, ou `undefined` si elle est vide. */
export function pick<T>(rng: Rng, list: readonly T[]): T | undefined {
  if (list.length === 0) return undefined;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

/** Vrai avec une probabilité `percent` (en points : 40 = 40 %). */
export function rollPercent(rng: Rng, percent: number): boolean {
  return rng() * 100 < percent;
}
