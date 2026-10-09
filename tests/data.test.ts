import { describe, expect, it } from 'vitest';
import { DIALOGUES } from '@/data/dialogues';
import { MAPS } from '@/data/maps';
import { OBJECTIVES } from '@/data/objectives';
import { LAYOFF_RETURN, NEW_GAME_START, OCC_ENTRANCE } from '@/data/story';
import type {
  Condition,
  DialogueDef,
  DialogueEffect,
  Interaction,
  MapDefinition,
  MapId,
  StoryFlag,
} from '@/data/types';
import type { ConditionContext } from '@/systems/story/Conditions';
import { neighbor } from '@/systems/movement/GridMovement';
import { buildWorldMap, findSpawn, isBlocked, reachableTiles } from '@/systems/world/WorldMap';

/**
 * Test de cohérence des données : il protège le contenu (cartes, dialogues, objectifs) contre
 * les références cassées et les cartes impraticables. Il doit rester vert à chaque ajout de contenu.
 */

const maps = Object.values(MAPS) as MapDefinition[];
const dialogues = DIALOGUES as Readonly<Record<string, DialogueDef>>;
const mapIds = Object.keys(MAPS) as MapId[];

function allInteractions(): { where: string; interaction: Interaction }[] {
  const list: { where: string; interaction: Interaction }[] = [];
  for (const map of maps) {
    for (const i of map.onEnter ?? []) list.push({ where: `${map.id} (onEnter)`, interaction: i });
    for (const [char, marker] of Object.entries(map.markers)) {
      if (marker.kind === 'npc' || marker.kind === 'prop' || marker.kind === 'trigger') {
        for (const i of marker.interactions)
          list.push({ where: `${map.id} « ${char} »`, interaction: i });
      }
    }
  }
  return list;
}

function allEffects(): { where: string; effect: DialogueEffect }[] {
  const list: { where: string; effect: DialogueEffect }[] = [];
  for (const [id, d] of Object.entries(dialogues)) {
    for (const [nodeId, node] of Object.entries(d.nodes)) {
      for (const e of node.effects ?? []) list.push({ where: `${id}.${nodeId}`, effect: e });
      for (const c of node.choices ?? []) {
        for (const e of c.effects ?? [])
          list.push({ where: `${id}.${nodeId} [${c.label}]`, effect: e });
      }
    }
  }
  return list;
}

function allConditions(): Condition[] {
  const list: Condition[] = allInteractions().flatMap(({ interaction }) =>
    interaction.when ? [interaction.when] : [],
  );
  for (const map of maps) {
    for (const marker of Object.values(map.markers)) {
      if ((marker.kind === 'npc' || marker.kind === 'prop') && marker.visibleWhen)
        list.push(marker.visibleWhen);
    }
  }
  for (const d of Object.values(dialogues)) {
    for (const node of Object.values(d.nodes)) {
      for (const c of node.choices ?? []) if (c.when) list.push(c.when);
    }
  }
  for (const o of OBJECTIVES) list.push(o.doneWhen);
  return list;
}

function spawnExists(map: MapId, spawn: string): boolean {
  return findSpawn(buildWorldMap(MAPS[map]), spawn) !== null;
}

describe('cartes', () => {
  it.each(maps.map((m) => [m.id, m] as const))(
    '%s se construit (lignes régulières, caractères connus)',
    (id, def) => {
      expect(MAPS[id].id).toBe(id);
      expect(() => buildWorldMap(def)).not.toThrow();
    },
  );

  it.each(maps.map((m) => [m.id, m] as const))(
    '%s : chaque marqueur déclaré est utilisé',
    (_id, def) => {
      const used = new Map<string, number>();
      for (const row of def.rows) for (const c of row) used.set(c, (used.get(c) ?? 0) + 1);
      for (const [char, marker] of Object.entries(def.markers)) {
        expect(used.get(char) ?? 0, `marqueur « ${char} » absent de la grille`).toBeGreaterThan(0);
        if (marker.kind !== 'portal')
          expect(used.get(char), `marqueur « ${char} » utilisé plusieurs fois`).toBe(1);
      }
    },
  );

  it.each(maps.map((m) => [m.id, m] as const))(
    '%s : points d’arrivée uniques et portails valides',
    (_id, def) => {
      const spawns = Object.values(def.markers).flatMap((m) => (m.kind === 'spawn' ? [m.id] : []));
      expect(spawns.length).toBeGreaterThan(0);
      expect(new Set(spawns).size).toBe(spawns.length);
      for (const m of Object.values(def.markers)) {
        if (m.kind !== 'portal') continue;
        expect(mapIds, `portail vers une carte inconnue : ${m.to}`).toContain(m.to);
        expect(spawnExists(m.to, m.spawn), `${m.to} n’a pas de point « ${m.spawn} »`).toBe(true);
      }
    },
  );

  it('les points de départ, de retour et l’entrée de l’OCC existent', () => {
    for (const p of [NEW_GAME_START, LAYOFF_RETURN, OCC_ENTRANCE]) {
      expect(spawnExists(p.map, p.spawn), `${p.map}/${p.spawn}`).toBe(true);
    }
  });

  // Praticabilité : depuis chaque point d'arrivée, tous les portails et tous les PNJ/objets sont accessibles,
  // aussi bien en début d'histoire (aucun drapeau) qu'en fin d'acte (tous les drapeaux).
  const contexts: [string, ConditionContext][] = [
    ['début d’acte', { flags: {}, act: 1 }],
    ['fin d’acte', { flags: new Proxy({}, { get: () => true }), act: 1 }],
  ];
  for (const [label, ctx] of contexts) {
    it.each(maps.map((m) => [m.id, m] as const))(`%s est praticable (${label})`, (_id, def) => {
      const map = buildWorldMap(def);
      for (const spawn of map.markers.filter((m) => m.def.kind === 'spawn')) {
        const reach = reachableTiles(map, spawn.tileX, spawn.tileY, ctx);
        for (const target of map.markers) {
          const where = `« ${target.char} » (${String(target.tileX)}, ${String(target.tileY)}) depuis « ${spawn.char} »`;
          if (target.def.kind === 'portal') {
            expect(
              reach.has(`${String(target.tileX)},${String(target.tileY)}`),
              `portail ${where} inaccessible`,
            ).toBe(true);
          }
          if (target.def.kind === 'npc' || target.def.kind === 'prop') {
            const blocking = target.def.kind === 'npc' || target.def.blocking;
            const adjacent = (['up', 'down', 'left', 'right'] as const).some((dir) => {
              const n = neighbor(target.tileX, target.tileY, dir);
              return reach.has(`${String(n.tileX)},${String(n.tileY)}`);
            });
            const onTile =
              !blocking && reach.has(`${String(target.tileX)},${String(target.tileY)}`);
            expect(adjacent || onTile, `${target.def.kind} ${where} inaccessible`).toBe(true);
          }
        }
        expect(
          isBlocked(map, spawn.tileX, spawn.tileY, ctx),
          `point d’arrivée « ${spawn.char} » bloqué`,
        ).toBe(false);
      }
    });
  }
});

describe('dialogues', () => {
  it('chaque interaction pointe vers un dialogue existant', () => {
    for (const { where, interaction } of allInteractions()) {
      expect(dialogues[interaction.dialogue], `${where} → ${interaction.dialogue}`).toBeDefined();
    }
  });

  it.each(Object.entries(dialogues))('%s : nœuds reliés, tous atteignables', (id, d) => {
    expect(d.nodes[d.start], `${id} : nœud de départ « ${d.start} » absent`).toBeDefined();
    const reached = new Set<string>();
    const queue = [d.start];
    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (nodeId === undefined || reached.has(nodeId)) continue;
      reached.add(nodeId);
      const node = d.nodes[nodeId];
      expect(node, `${id} : nœud « ${nodeId} » absent`).toBeDefined();
      if (!node) continue;
      expect(
        node.next !== undefined && (node.choices?.length ?? 0) > 0,
        `${id}.${nodeId} : next ET choices`,
      ).toBe(false);
      if (node.next) queue.push(node.next);
      for (const c of node.choices ?? []) if (c.next) queue.push(c.next);
    }
    expect(
      [...Object.keys(d.nodes)].filter((n) => !reached.has(n)),
      `${id} : nœuds orphelins`,
    ).toEqual([]);
  });

  it('les téléportations visent des cartes et des points existants', () => {
    for (const { where, effect } of allEffects()) {
      if (effect.kind === 'teleport')
        expect(spawnExists(effect.map, effect.spawn), where).toBe(true);
    }
  });

  it('le dialogue système de Mise à pied existe', () => {
    expect(dialogues['mise-a-pied']).toBeDefined();
  });
});

describe('progression', () => {
  it('chaque drapeau attendu à vrai peut être posé par un effet', () => {
    const settable = new Set<StoryFlag>();
    for (const { effect } of allEffects()) {
      if (effect.kind === 'flag' && effect.value !== false) settable.add(effect.flag);
    }
    for (const condition of allConditions()) {
      for (const [flag, value] of Object.entries(condition.flags ?? {})) {
        if (value)
          expect(settable.has(flag as StoryFlag), `drapeau « ${flag} » jamais posé`).toBe(true);
      }
    }
  });

  it('il y a au moins un objectif', () => {
    expect(OBJECTIVES.length).toBeGreaterThan(0);
  });
});
