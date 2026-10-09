// Calage du temps des clips GLB sur les timings de la simulation (règle 1 : l'animation est mise à
// l'échelle sur les durées de `balance.ts`, jamais l'inverse). Fonctions pures, testées dans
// tests/glbModels.test.ts.

/**
 * Temps du clip (s) pour un coup de la sim à `tMs` depuis son début, par morceaux :
 * [0, startup] de la sim → [0, active] du clip, puis [startup, startup + rest] → [active, durée].
 * Le frame actif du clip (événement `active` du manifeste) tombe donc sur le premier frame actif de
 * la sim, quelle que soit la vitesse d'attaque.
 */
export function alignedClipTime(
  tMs: number,
  startupMs: number,
  restMs: number,
  activeS: number,
  durationS: number,
): number {
  if (tMs < startupMs) return (Math.max(0, tMs) / Math.max(1, startupMs)) * activeS;
  return activeS + Math.min(1, (tMs - startupMs) / Math.max(1, restMs)) * (durationS - activeS);
}

/**
 * Temps du clip d'attaque d'un ennemi pendant l'armé : `progress` (0..1, `windupProgress` de la sim)
 * × instant actif du clip × `reach` (part de l'armé jouée, 1 = jusqu'au frame actif). La sim passe en
 * `attack` à la fin du télégraphe : c'est l'instant du frame actif.
 */
export function windupClipTime(progress: number, activeS: number, reach = 1): number {
  return Math.min(1, Math.max(0, progress)) * activeS * reach;
}
