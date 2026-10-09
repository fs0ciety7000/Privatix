/**
 * Simulateur d'exploration sans Phaser, fidèle à GameScene/DialogueScene : il sert aux tests de bout en bout
 * du contenu (tests/act1.test.ts). Chaque déplacement vérifie que la cible est accessible à pied dans l'état courant.
 */
import { BALANCE } from '@/config/balance';
import { DIALOGUES } from '@/data/dialogues';
import { MAPS } from '@/data/maps';
import { OCC_CODE, OCC_ENTRANCE } from '@/data/story';
import type { VendingButton } from '@/data/story';
import type { CharacterId, DialogueDef, MapDefinition, MapId } from '@/data/types';
import type { GameState } from '@/systems/GameState';
import { activeTimeModifiers, spawnPosition } from '@/systems/GameState';
import { neighbor } from '@/systems/movement/GridMovement';
import { firstMatching } from '@/systems/story/Conditions';
import {
  advance,
  choose,
  contextOf,
  currentNode,
  startDialogue,
  visibleChoices,
} from '@/systems/story/DialogueRunner';
import { applyLayoff, LAYOFF_DIALOGUE } from '@/systems/story/Layoff';
import { advanceTime } from '@/systems/time/FatigueClock';
import { matchesCode } from '@/systems/vending/VendingCode';
import type { PlacedMarker } from '@/systems/world/WorldMap';
import { buildWorldMap, isMarkerVisible, reachableTiles } from '@/systems/world/WorldMap';

const dialogues = DIALOGUES as Readonly<Record<string, DialogueDef>>;

/** Choisit un choix de dialogue d'après les libellés proposés ; par défaut, le premier. */
export type ChoicePolicy = (
  labels: readonly string[],
  dialogueId: string,
  nodeId: string,
) => number;

export const firstChoice: ChoicePolicy = () => 0;

export interface SimLog {
  readonly dialogues: string[];
  readonly notices: string[];
  readonly texts: string[];
}

export function newLog(): SimLog {
  return { dialogues: [], notices: [], texts: [] };
}

const OCC_KEYPAD_PRESSES: readonly VendingButton[] = (
  Object.keys(OCC_CODE) as VendingButton[]
).flatMap((b) => Array<VendingButton>(OCC_CODE[b]).fill(b));

/** Joue un dialogue jusqu'au bout (puis clavier, téléportation, dialogues d'arrivée, Mise à pied). */
export function playDialogue(
  state: GameState,
  dialogueId: string,
  log: SimLog,
  policy: ChoicePolicy = firstChoice,
): GameState {
  const def = dialogues[dialogueId];
  if (!def) throw new Error(`Dialogue inconnu : ${dialogueId}`);
  log.dialogues.push(dialogueId);
  const mapBefore = state.position.mapId;
  let keypad = false;

  let step = startDialogue(def, state);
  for (let guard = 0; step.nodeId !== null; guard += 1) {
    if (guard > 200) throw new Error(`Dialogue ${dialogueId} : boucle infinie ?`);
    log.notices.push(...step.notices);
    keypad ||= step.actions.some((a) => a.kind === 'keypad');
    const nodeId = step.nodeId;
    log.texts.push(currentNode(def, nodeId).text);
    const choices = visibleChoices(def, nodeId, step.state);
    step =
      choices.length > 0
        ? choose(
            def,
            nodeId,
            step.state,
            policy(
              choices.map((c) => c.label),
              dialogueId,
              nodeId,
            ),
          )
        : advance(def, nodeId, step.state);
  }
  log.notices.push(...step.notices);
  keypad ||= step.actions.some((a) => a.kind === 'keypad');

  let next = step.state;
  if (keypad && matchesCode(OCC_KEYPAD_PRESSES, OCC_CODE)) {
    next = { ...next, position: spawnPosition(OCC_ENTRANCE.map, OCC_ENTRANCE.spawn) };
  }
  if (next.time.fatigue >= BALANCE.fatigue.MAX) {
    return playDialogue(applyLayoff(next), LAYOFF_DIALOGUE, log, policy);
  }
  return next.position.mapId !== mapBefore ? arrive(next, log, policy) : next;
}

/** Arrivée sur la carte de `state.position` : joue l'éventuel dialogue d'arrivée. */
export function arrive(
  state: GameState,
  log: SimLog,
  policy: ChoicePolicy = firstChoice,
): GameState {
  const def: MapDefinition = MAPS[state.position.mapId];
  const enter = firstMatching(def.onEnter, contextOf(state));
  return enter ? playDialogue(state, enter.dialogue, log, policy) : state;
}

function markersOf(state: GameState): readonly PlacedMarker[] {
  return buildWorldMap(MAPS[state.position.mapId]).markers;
}

function reachable(state: GameState): Set<string> {
  const map = buildWorldMap(MAPS[state.position.mapId]);
  return reachableTiles(map, state.position.tileX, state.position.tileY, contextOf(state));
}

/** Se place devant un PNJ (ou objet) visible et accessible, puis interagit. */
export function talkTo(
  state: GameState,
  target: { readonly character?: CharacterId; readonly prop?: string; readonly marker?: string },
  log: SimLog,
  policy: ChoicePolicy = firstChoice,
): GameState {
  const ctx = contextOf(state);
  const marker = markersOf(state).find(
    (m) =>
      isMarkerVisible(m, ctx) &&
      (target.marker === undefined || m.char === target.marker) &&
      ((m.def.kind === 'npc' && m.def.character === target.character) ||
        (m.def.kind === 'prop' && m.def.id === target.prop)),
  );
  const what = target.character ?? target.prop ?? '?';
  if (!marker || (marker.def.kind !== 'npc' && marker.def.kind !== 'prop')) {
    throw new Error(`« ${what} » absent ou invisible sur ${state.position.mapId}`);
  }
  const reach = reachable(state);
  const spot = (['up', 'down', 'left', 'right'] as const)
    .map((dir) => ({ dir, tile: neighbor(marker.tileX, marker.tileY, dir) }))
    .find(({ tile }) => reach.has(`${String(tile.tileX)},${String(tile.tileY)}`));
  if (!spot) throw new Error(`« ${what} » inaccessible à pied sur ${state.position.mapId}`);

  const facing = ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[spot.dir];
  const placed: GameState = { ...state, position: { ...state.position, ...spot.tile, facing } };
  const interaction = firstMatching(marker.def.interactions, contextOf(placed));
  if (!interaction) throw new Error(`« ${what} » n'a aucune interaction disponible`);
  return playDialogue(placed, interaction.dialogue, log, policy);
}

/** Marche jusqu'au portail vers `to` (accessible), paie le changement de zone, arrive. */
export function walkTo(
  state: GameState,
  to: MapId,
  log: SimLog,
  policy: ChoicePolicy = firstChoice,
): GameState {
  const reach = reachable(state);
  const portal = markersOf(state).find(
    (m) =>
      m.def.kind === 'portal' &&
      m.def.to === to &&
      reach.has(`${String(m.tileX)},${String(m.tileY)}`),
  );
  if (portal?.def.kind !== 'portal') {
    throw new Error(`Aucun portail accessible de ${state.position.mapId} vers ${to}`);
  }
  const moved: GameState = {
    ...state,
    time: advanceTime(state.time, BALANCE.clock.COST_MIN.zoneChange, activeTimeModifiers(state))
      .state,
    position: spawnPosition(portal.def.to, portal.def.spawn),
  };
  return arrive(moved, log, policy);
}

/** Choisit le premier choix dont le libellé contient l'un des mots donnés (insensible à la casse), sinon le premier. */
export function preferChoices(...words: readonly string[]): ChoicePolicy {
  return (labels) => {
    const index = labels.findIndex((l) =>
      words.some((w) => l.toLowerCase().includes(w.toLowerCase())),
    );
    return Math.max(0, index);
  };
}
