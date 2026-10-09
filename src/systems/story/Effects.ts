import { BALANCE } from '@/config/balance';
import type { DialogueEffect, EncounterId, MapId } from '@/data/types';
import type { GameState } from '@/systems/GameState';
import { activeTimeModifiers, spawnPosition } from '@/systems/GameState';
import type { ClockResult, RestResult } from '@/systems/time/FatigueClock';
import {
  addFatigue,
  advanceTime,
  drinkOccCoffee,
  shiftIndexAt,
  sleepUntilCap,
  startNextAct,
  takeNap,
} from '@/systems/time/FatigueClock';
import { clamp } from '@/utils/math';

/**
 * Effets des dialogues appliqués au GameState (pur, immuable).
 * Ce qui demande la scène (sauvegarde sur disque, clavier du distributeur) est renvoyé en `actions`.
 */
export type SceneAction =
  | { readonly kind: 'save' }
  | { readonly kind: 'keypad' }
  /** Combat : la scène le joue (BattleScene) puis applique le résultat (src/systems/party/Party.ts). */
  | { readonly kind: 'battle'; readonly encounter: EncounterId };

export interface EffectResult {
  readonly state: GameState;
  /** Messages courts à afficher en bandeau (« Victoire contre … », « Déjà pris pendant cette pause »). */
  readonly notices: readonly string[];
  readonly actions: readonly SceneAction[];
}

const REST_REFUSALS = {
  'already-used': 'Déjà fait pendant cette pause.',
  'no-bed': 'Pas de lit de camp ici.',
} as const;

function withTime(state: GameState, result: ClockResult): GameState {
  return { ...state, time: result.state };
}

function applyRest(state: GameState, rest: 'coffee' | 'nap' | 'sleep'): EffectResult {
  let result: RestResult;
  if (rest === 'coffee')
    result = drinkOccCoffee(state.time, state.occMachineLevel, activeTimeModifiers(state));
  else if (rest === 'nap') result = takeNap(state.time);
  else result = sleepUntilCap(state.time);

  if (!result.ok) return { state, notices: [REST_REFUSALS[result.reason]], actions: [] };

  const before = Math.floor(state.time.fatigue);
  let next = withTime(state, result);
  if (rest === 'sleep') {
    // Dormir : PV/PE au maximum et fin du buff de Tasse de Relève (GDD § 3.2).
    next = {
      ...next,
      player: { ...next.player, hp: next.player.maxHp, energy: next.player.maxEnergy },
      drink: null,
    };
  }
  const labels = {
    coffee: 'Café de la Vieille Dame',
    nap: 'Sieste',
    sleep: 'Nuit sur le lit de camp',
  } as const;
  return {
    state: next,
    notices: [
      `${labels[rest]} : Fatigue ${String(before)} → ${String(Math.floor(next.time.fatigue))}`,
    ],
    actions: [],
  };
}

function teleport(state: GameState, map: MapId, spawn: string): GameState {
  return { ...state, position: spawnPosition(map, spawn) };
}

/** Applique un effet de dialogue. */
export function applyEffect(state: GameState, effect: DialogueEffect): EffectResult {
  const none = (next: GameState, ...notices: string[]): EffectResult => ({
    state: next,
    notices,
    actions: [],
  });

  switch (effect.kind) {
    case 'flag':
      return none({ ...state, flags: { ...state.flags, [effect.flag]: effect.value ?? true } });
    case 'moral': {
      const moral = clamp(state.moral + effect.delta, 0, BALANCE.moral.MAX);
      const sign = effect.delta >= 0 ? '+' : '';
      return none({ ...state, moral }, `Moral ${sign}${String(effect.delta)}`);
    }
    case 'tickets': {
      const sign = effect.delta >= 0 ? '+' : '';
      return none(
        { ...state, tickets: Math.max(0, state.tickets + effect.delta) },
        `${sign}${String(effect.delta)} T`,
      );
    }
    case 'fatigue':
      return none(withTime(state, addFatigue(state.time, effect.delta)));
    case 'time':
      return none(
        withTime(state, advanceTime(state.time, effect.minutes, activeTimeModifiers(state))),
      );
    case 'rest':
      return applyRest(state, effect.rest);
    case 'drink': {
      let next: GameState = {
        ...state,
        // L'acte N se joue pendant la pause d'index N − 1 (matin, après-midi, nuit du lundi) : une boisson
        // choisie avant le début de cette pause (prologue de 4h47) vaut pour elle, pas pour la nuit qui s'achève.
        drink: {
          id: effect.drink,
          shiftIndex: Math.max(shiftIndexAt(state.time.totalMinutes), state.time.act - 1),
        },
      };
      if (effect.drink === 'ristretto') {
        next = withTime(next, addFatigue(next.time, -BALANCE.fatigue.recovery.RISTRETTO));
      }
      return none(next);
    }
    case 'heal':
      return none(
        {
          ...state,
          player: { ...state.player, hp: state.player.maxHp, energy: state.player.maxEnergy },
          allies: {},
        },
        'PV et PE restaurés',
      );
    case 'gobelets': {
      const shiftIndex = shiftIndexAt(state.time.totalMinutes);
      if (state.gobeletsShiftIndex === shiftIndex)
        return none(state, 'Gobelets déjà remplis pendant cette pause.');
      const count = BALANCE.economy.GOBELETS_PER_PAUSE[state.occMachineLevel - 1] ?? 1;
      return none(
        { ...state, gobelets: Math.max(state.gobelets, count), gobeletsShiftIndex: shiftIndex },
        `Gobelets de l'OCC : ${String(Math.max(state.gobelets, count))}`,
      );
    }
    case 'save':
      return { state, notices: [], actions: [{ kind: 'save' }] };
    case 'battle':
      return { state, notices: [], actions: [{ kind: 'battle', encounter: effect.encounter }] };
    case 'teleport':
      return none(teleport(state, effect.map, effect.spawn));
    case 'nextAct':
      if (state.time.act === 3) return none(state);
      return none(
        { ...withTime(state, startNextAct(state.time)), drink: null },
        'Relève : la pause change',
      );
    case 'keypad':
      return { state, notices: [], actions: [{ kind: 'keypad' }] };
  }
}

/** Applique une liste d'effets dans l'ordre. */
export function applyEffects(
  state: GameState,
  effects: readonly DialogueEffect[] | undefined,
): EffectResult {
  let current = state;
  const notices: string[] = [];
  const actions: SceneAction[] = [];
  for (const effect of effects ?? []) {
    const result = applyEffect(current, effect);
    current = result.state;
    notices.push(...result.notices);
    actions.push(...result.actions);
  }
  return { state: current, notices, actions };
}
