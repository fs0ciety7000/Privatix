import type { GameState } from '@/systems/GameState';
import { formatClock, shiftAt, shiftLabel } from '@/systems/time/FatigueClock';

/** Valeurs disponibles pour les jetons des textes de dialogue. */
export function textTokens(state: GameState, objective: string): Readonly<Record<string, string>> {
  return {
    prenom: state.player.name,
    objectif: objective,
    heure: formatClock(state.time.totalMinutes),
    pause: shiftLabel(shiftAt(state.time.totalMinutes)),
    fatigue: String(Math.floor(state.time.fatigue)),
    moral: String(Math.floor(state.moral)),
    tickets: String(state.tickets),
    gobelets: String(state.gobelets),
  };
}

/** Remplace les jetons `{nom}` connus ; laisse intacts les jetons inconnus (visible en test). */
export function interpolate(text: string, tokens: Readonly<Record<string, string>>): string {
  return text.replace(/\{([a-z]+)\}/g, (match, name: string) => tokens[name] ?? match);
}
