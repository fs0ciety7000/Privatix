import type { DialogueChoice, DialogueDef, DialogueNode } from '@/data/types';
import type { GameState } from '@/systems/GameState';
import type { ConditionContext } from '@/systems/story/Conditions';
import { evaluateCondition } from '@/systems/story/Conditions';
import type { SceneAction } from '@/systems/story/Effects';
import { applyEffects } from '@/systems/story/Effects';

/**
 * Déroulement d'un dialogue (pur). La scène affiche `node`, puis appelle `advance` (pas de choix)
 * ou `choose` (choix visibles), jusqu'à `ended`. Chaque étape renvoie le nouvel état du jeu,
 * les bandeaux à afficher et les actions de scène (sauvegarde, clavier du distributeur).
 */
export interface DialogueStep {
  readonly state: GameState;
  /** Nœud à afficher, ou `null` quand le dialogue est terminé. */
  readonly nodeId: string | null;
  readonly notices: readonly string[];
  readonly actions: readonly SceneAction[];
}

export function contextOf(state: GameState): ConditionContext {
  return {
    flags: state.flags,
    act: state.time.act,
    now: state.time.totalMinutes,
    defeated: state.defeatedEncounters,
  };
}

function nodeOf(def: DialogueDef, nodeId: string): DialogueNode {
  const node = def.nodes[nodeId];
  if (!node) throw new Error(`Nœud de dialogue « ${nodeId} » introuvable`);
  return node;
}

/** Entre dans un nœud : applique ses effets. `null` termine le dialogue. */
function enter(
  def: DialogueDef,
  state: GameState,
  nodeId: string | undefined,
  carried: Omit<DialogueStep, 'state' | 'nodeId'>,
): DialogueStep {
  if (nodeId === undefined) return { state, nodeId: null, ...carried };
  const result = applyEffects(state, nodeOf(def, nodeId).effects);
  return {
    state: result.state,
    nodeId,
    notices: [...carried.notices, ...result.notices],
    actions: [...carried.actions, ...result.actions],
  };
}

export function startDialogue(def: DialogueDef, state: GameState): DialogueStep {
  return enter(def, state, def.start, { notices: [], actions: [] });
}

export function currentNode(def: DialogueDef, nodeId: string): DialogueNode {
  return nodeOf(def, nodeId);
}

/** Choix proposés au joueur pour ce nœud (filtrés par leur condition). */
export function visibleChoices(
  def: DialogueDef,
  nodeId: string,
  state: GameState,
): readonly DialogueChoice[] {
  const ctx = contextOf(state);
  return (nodeOf(def, nodeId).choices ?? []).filter((c) => evaluateCondition(c.when, ctx));
}

/** Passe au nœud suivant d'un nœud sans choix (ou termine le dialogue). */
export function advance(def: DialogueDef, nodeId: string, state: GameState): DialogueStep {
  return enter(def, state, nodeOf(def, nodeId).next, { notices: [], actions: [] });
}

/** Choisit l'option `index` parmi `visibleChoices`, applique ses effets puis entre dans le nœud suivant. */
export function choose(
  def: DialogueDef,
  nodeId: string,
  state: GameState,
  index: number,
): DialogueStep {
  const choice = visibleChoices(def, nodeId, state)[index];
  if (!choice) throw new Error(`Choix ${String(index)} indisponible dans « ${nodeId} »`);
  const result = applyEffects(state, choice.effects);
  return enter(def, result.state, choice.next, {
    notices: result.notices,
    actions: result.actions,
  });
}
