import { describe, expect, it } from 'vitest';
import { SIM_DT_MS } from '@/sim/clock/FixedClock';
import type { HubAction } from '@/sim/hub/HubSim';
import { HUB_DOOR_FADE_MS, HubSim } from '@/sim/hub/HubSim';
import { HUB_LAYOUTS } from '@/sim/hub/layout';
import type { HubStationId } from '@/sim/hub/stations';
import {
  HUB_DOORS,
  HUB_NPCS,
  HUB_STATIONS,
  HUB_STATIONS_BY_ID,
  NPC_LINES,
} from '@/sim/hub/stations';
import type { PlayerIntent } from '@/sim/intent';
import { NO_INTENT } from '@/sim/intent';
import { META_SAVE_SCHEMA, newMeta, rankOf } from '@/systems/meta/MetaState';
import type { MetaState } from '@/systems/meta/MetaState';
import type { ShiftResult } from '@/systems/meta/RunState';
import { settleShift } from '@/systems/meta/settle';
import { startLootRun } from '@/systems/loot';
import { reachableFrom } from '@/systems/procedural/RoomLayout';
import type { KeyValueStorage } from '@/systems/save/SaveManager';
import { SaveManager } from '@/systems/save/SaveManager';
import { TILE } from '@/config/constants';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

function step(hub: HubSim, ms: number, intent: PlayerIntent = NO_INTENT): void {
  const n = Math.max(1, Math.round(ms / SIM_DT_MS));
  for (let i = 0; i < n; i += 1) {
    hub.queueIntent(intent);
    hub.snapshot();
    hub.step(SIM_DT_MS);
  }
}

function teleport(hub: HubSim, x: number, y: number): void {
  const b = hub.world.hero.body;
  b.x = x;
  b.y = y;
  b.prevX = x;
  b.prevY = y;
}

function interactAt(hub: HubSim, id: HubStationId): HubAction[] {
  const s = HUB_STATIONS_BY_ID.get(id);
  if (!s) throw new Error(id);
  if (hub.zone !== s.zone) hub.enterZone(s.zone, null);
  hub.drainActions();
  teleport(hub, s.at.x, s.at.y);
  step(hub, SIM_DT_MS, { ...NO_INTENT, interact: true });
  return hub.drainActions();
}

const result = (over: Partial<ShiftResult> = {}): ShiftResult => ({
  end: 'mort',
  shift: 'matin',
  room: 4,
  clock: 90,
  psEarned: 37,
  grainsEarned: 2,
  kills: 21,
  avantages: 3,
  cause: 'Consultant Junior',
  ...over,
});

describe('Hub 3D : plan', () => {
  it('chaque station et chaque porte est atteignable depuis l’arrivée de sa zone', () => {
    for (const zone of ['co', 'cour'] as const) {
      const layout = HUB_LAYOUTS[zone];
      const reach = reachableFrom(layout, layout.playerSpawn);
      for (const s of HUB_STATIONS.filter((st) => st.zone === zone)) {
        const key = `${String(Math.floor(s.at.x / TILE))},${String(Math.floor(s.at.y / TILE))}`;
        expect(reach.has(key), `${s.id} en ${key}`).toBe(true);
      }
      for (const d of HUB_DOORS.filter((door) => door.zone === zone)) {
        const ty = Math.floor((d.at.y - d.side * 24) / TILE);
        const key = `${String(Math.floor(d.at.x / TILE))},${String(ty)}`;
        expect(reach.has(key), `${d.id} en ${key}`).toBe(true);
      }
    }
  });

  it('tous les PNJ du canon ont leur marque dans le gabarit de leur zone', () => {
    for (const npc of HUB_NPCS) {
      const marks = HUB_LAYOUTS[npc.zone].marks.filter((m) => m.kind === 'npc');
      expect(
        marks.some((m) => m.char === npc.char),
        npc.id,
      ).toBe(true);
    }
    expect(HUB_LAYOUTS.cour.marks.some((m) => m.kind === 'dummy')).toBe(true);
  });
});

describe('Hub 3D : interactions', () => {
  it('le héros démarre au sas du Centre Opérationnel, sans invite', () => {
    const hub = new HubSim({ meta: newMeta(), seed: 1 });
    expect(hub.zone).toBe('co');
    expect(hub.prompt).toBeNull();
  });

  it('Marcel et le panneau de liège ouvrent le Tableau des revendications', () => {
    const hub = new HubSim({ meta: newMeta(), seed: 1 });
    const a = interactAt(hub, 'marcel');
    expect(a.map((x) => x.type)).toEqual(['talk', 'tableau']);
    expect(interactAt(hub, 'tableau').map((x) => x.type)).toEqual(['tableau']);
    expect(hub.prompt?.label).toContain('Tableau des revendications');
  });

  it('Yasmina ouvre le roulement, Josiane la DPD, Béné le PACO', () => {
    const hub = new HubSim({ meta: newMeta(), seed: 1 });
    expect(interactAt(hub, 'yasmina').map((x) => x.type)).toEqual(['roulement']);
    expect(interactAt(hub, 'bene').map((x) => x.type)).toEqual(['talk', 'paco']);
    expect(interactAt(hub, 'josiane').map((x) => x.type)).toEqual(['talk', 'dpd']);
    expect(interactAt(hub, 'casiers').map((x) => x.type)).toEqual(['dpd']);
  });

  it('les répliques suivent le LORE : la première réagit à la mort, puis les génériques', () => {
    const hub = new HubSim({ meta: newMeta(), seed: 1, fromResult: 'mort' });
    const first = interactAt(hub, 'kevin')[0];
    expect(first?.type === 'talk' && first.text).toBe(NPC_LINES.kevin.death);
    const second = interactAt(hub, 'kevin')[0];
    expect(second?.type === 'talk' && second.text).toBe(NPC_LINES.kevin.generic[0]);
    const fresh = new HubSim({ meta: newMeta(), seed: 1 });
    const g = interactAt(fresh, 'rudy')[0];
    expect(g?.type === 'talk' && g.text).toBe(NPC_LINES.rudy.generic[0]);
  });

  it('le mur synoptique affiche les statistiques sauvegardées', () => {
    const meta: MetaState = {
      ...newMeta(),
      stats: { shifts: 7, deaths: 5, bossKills: 2, bestRoom: 10, totalKills: 300 },
    };
    const hub = new HubSim({ meta, seed: 1 });
    const a = interactAt(hub, 'synoptique')[0];
    expect(a?.type).toBe('read');
    expect(a?.type === 'read' && a.text).toContain('Shifts assurés : 7');
  });

  it('la porte vitrée mène à la Cour (fondu), le mannequin y attend, la porte du bas ramène', () => {
    const hub = new HubSim({ meta: newMeta(), seed: 1 });
    const door = HUB_DOORS.find((d) => d.id === 'vers-cour');
    if (!door) throw new Error('porte');
    teleport(hub, door.at.x, door.at.y + 40);
    hub.drainActions();
    step(hub, 400, { ...NO_INTENT, moveY: -1 });
    expect(hub.frozen || hub.zone === 'cour').toBe(true);
    step(hub, HUB_DOOR_FADE_MS + 50);
    expect(hub.zone).toBe('cour');
    expect(hub.dummy).not.toBeNull();
    expect(hub.drainActions().some((a) => a.type === 'zone' && a.zone === 'cour')).toBe(true);
    const back = HUB_DOORS.find((d) => d.id === 'vers-co');
    if (!back) throw new Error('porte');
    teleport(hub, back.at.x, back.at.y - 40);
    step(hub, 400, { ...NO_INTENT, moveY: 1 });
    step(hub, HUB_DOOR_FADE_MS + 50);
    expect(hub.zone).toBe('co');
    expect(hub.dummy).toBeNull();
  });

  it('le mannequin encaisse sans mourir et mesure le DPS', () => {
    const hub = new HubSim({ meta: newMeta(), seed: 1 });
    hub.enterZone('cour', null);
    const dummy = hub.dummy;
    if (!dummy) throw new Error('mannequin');
    teleport(hub, dummy.body.x, dummy.body.y + 22);
    for (let i = 0; i < 12; i += 1)
      step(hub, 250, { ...NO_INTENT, attack: true, aim: -Math.PI / 2 });
    expect(dummy.total).toBeGreaterThan(0);
    expect(dummy.isDead).toBe(false);
    expect(dummy.hp).toBe(dummy.maxHp);
    expect(dummy.dps).toBeGreaterThan(0);
  });

  it('le côté ouvert de la Cour lance le Shift avec le roulement choisi', () => {
    const meta = { ...newMeta(), upgrades: { tableau: 2 } };
    const hub = new HubSim({ meta, seed: 1 });
    expect(hub.setShift('nuit')).toBe(true);
    hub.enterZone('cour', null);
    const exit = HUB_DOORS.find((d) => d.id === 'depart');
    if (!exit) throw new Error('porte');
    teleport(hub, exit.at.x, exit.at.y + 40);
    hub.drainActions();
    step(hub, 500, { ...NO_INTENT, moveY: -1 });
    expect(hub.drainActions()).toContainEqual({ type: 'depart', shift: 'nuit' });
    expect(hub.frozen).toBe(true);
  });

  it('le roulement verrouillé est refusé sans « Tableau de service »', () => {
    const hub = new HubSim({ meta: newMeta(), seed: 1 });
    expect(hub.unlockedShifts).toEqual(['matin']);
    expect(hub.setShift('apres-midi')).toBe(false);
    expect(hub.shift).toBe('matin');
  });
});

describe('Hub 3D : achats et sauvegarde', () => {
  it('un achat débite les PS, monte le rang et marque la méta à sauvegarder', () => {
    const hub = new HubSim({ meta: { ...newMeta(), ps: 100 }, seed: 1 });
    const r = hub.buy('anciennete');
    expect(r.ok).toBe(true);
    expect(hub.meta.ps).toBe(70);
    expect(rankOf(hub.meta, 'anciennete')).toBe(1);
    expect(hub.dirty).toBe(true);
    expect(hub.buy('mutuelle')).toEqual({ ok: false, reason: 'ps' });
    expect(hub.meta.ps).toBe(70);
  });

  it('fin de Shift → sauvegarde → rechargement → achat → rechargement : PS et rangs conservés', () => {
    const storage = memoryStorage();
    const save = new SaveManager(storage, META_SAVE_SCHEMA);
    const after = settleShift({ ...newMeta(), ps: 10 }, result()).meta;
    expect(after.ps).toBe(47);
    expect(after.grains).toBe(2);
    expect(after.stats).toMatchObject({ shifts: 1, deaths: 1, bestRoom: 4, totalKills: 21 });
    expect(save.save(after)).toBe(true);

    const loaded = save.load();
    if (!loaded.ok) throw new Error(loaded.reason);
    const hub = new HubSim({ meta: loaded.data.state, seed: 2, fromResult: 'mort' });
    expect(hub.buy('anciennete').ok).toBe(true);
    save.save(hub.meta);

    const again = save.load();
    if (!again.ok) throw new Error(again.reason);
    expect(again.data.state.ps).toBe(17);
    expect(rankOf(again.data.state, 'anciennete')).toBe(1);
    expect(again.data.state.loot).toEqual(newMeta().loot);
  });

  it('une sauvegarde v1 (version Phaser) est migrée puis réglée par le Shift 3D', () => {
    const storage = memoryStorage();
    storage.setItem(
      'privatix.meta',
      JSON.stringify({
        savedAt: '2026-01-01T00:00:00.000Z',
        state: {
          version: 1,
          ps: 120,
          grains: 4,
          upgrades: { anciennete: 1 },
          stats: { shifts: 3, deaths: 2, bossKills: 1, bestRoom: 10, totalKills: 90 },
        },
      }),
    );
    const save = new SaveManager(storage, META_SAVE_SCHEMA);
    const loaded = save.load();
    if (!loaded.ok) throw new Error(loaded.reason);
    expect(loaded.data.state.version).toBe(2);
    expect(loaded.data.state.pieces).toBe(3);
    const settled = settleShift(loaded.data.state, result({ end: 'victoire', room: 10 })).meta;
    expect(settled.ps).toBe(157);
    expect(settled.stats.bossKills).toBe(2);
    save.save(settled);
    const again = save.load();
    expect(again.ok && again.data.state.ps).toBe(157);
  });

  it('le crochet loot ne fait jamais perdre les PS (consigne refusée → rien gardé)', () => {
    const meta = newMeta();
    const s = settleShift(meta, result(), null);
    expect(s.meta.loot).toEqual(meta.loot);
    expect(s.lootError).toBeNull();
    const start = startLootRun(meta);
    const bad = settleShift(meta, result(), {
      outcome: 'mort',
      loadout: start.loadout,
      run: start.run,
      pity: start.pity,
      keep: ['it-999999'],
    });
    expect(bad.lootError).toBe('unknown-item');
    expect(bad.meta.ps).toBe(37);
    expect(bad.meta.stats.shifts).toBe(1);
  });
});
