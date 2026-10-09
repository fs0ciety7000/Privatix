import { BALANCE } from '@/config/balance';
import { LAYOFF_RETURN, NEW_GAME_START } from '@/data/story';
import type { GameState } from '@/systems/GameState';
import { spawnPosition } from '@/systems/GameState';
import { addFatigue, advanceTime } from '@/systems/time/FatigueClock';
import { clamp } from '@/utils/math';

/** Dialogue joué après une Mise à pied (le texte est dans les données). */
export const LAYOFF_DIALOGUE = 'mise-a-pied';

/**
 * « Mise à pied » (GDD § 5.8) : équipe K.O. ou Fatigue 100 hors combat.
 * Actes I–II : retour à l'OCC (ou au départ si elle n'est pas encore connue), −25 % des Tickets,
 * Fatigue fixée à 50, horloge +2 h (plafonnée à la butée), Moral −5.
 * Acte III (BAG, à venir) : même pénalité, retour à la dernière sauvegarde du BAG.
 */
export function applyLayoff(state: GameState): GameState {
  const back = state.flags['occ-decouverte'] === true ? LAYOFF_RETURN : NEW_GAME_START;
  const fatigueSet = addFatigue(state.time, BALANCE.fatigue.DEFEAT_SET - state.time.fatigue).state;
  const time = advanceTime(fatigueSet, BALANCE.clock.COST_MIN.nap, { accrueFatigue: false }).state;
  return {
    ...state,
    time,
    position: spawnPosition(back.map, back.spawn),
    tickets: Math.floor(state.tickets * (1 - BALANCE.economy.DEFEAT_TICKET_LOSS)),
    moral: clamp(state.moral + BALANCE.moral.gains.defeat, 0, BALANCE.moral.MAX),
  };
}
