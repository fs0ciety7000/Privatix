import { describe, expect, it } from 'vitest';
import {
  isSolid,
  parseRoom,
  reachableFrom,
  spawnableTiles,
  tileAt,
} from '@/systems/procedural/RoomLayout';
import type { RoomTemplateId } from '@/systems/procedural/roomTemplates';
import { ROOM_TEMPLATES } from '@/systems/procedural/roomTemplates';

const IDS = Object.keys(ROOM_TEMPLATES) as RoomTemplateId[];

describe('gabarits de salles', () => {
  it.each(IDS)('%s : rectangulaire, fermé par des murs, avec une arrivée', (id) => {
    const room = parseRoom(id);
    expect(room.tiles).toHaveLength(ROOM_TEMPLATES[id].length + 1);
    for (let tx = 0; tx < room.width; tx += 1) {
      expect(isSolid(tileAt(room, tx, 0))).toBe(true);
      expect(isSolid(tileAt(room, tx, room.height - 1))).toBe(true);
    }
    for (let ty = 0; ty < room.height; ty += 1) {
      expect(isSolid(tileAt(room, 0, ty))).toBe(true);
      expect(isSolid(tileAt(room, room.width - 1, ty))).toBe(true);
    }
    expect(isSolid(tileAt(room, room.playerSpawn.tx, room.playerSpawn.ty))).toBe(false);
  });

  it.each(IDS)('%s : chaque porte est atteignable à pied depuis l’arrivée', (id) => {
    const room = parseRoom(id);
    const reach = reachableFrom(room, room.playerSpawn);
    expect(room.doors.length).toBeGreaterThan(0);
    for (const door of room.doors) {
      const below = `${String(door.tx)},${String(door.ty + 1)}`;
      expect(reach.has(below)).toBe(true);
    }
  });

  it('les salles de combat offrent des points d’apparition loin du héros', () => {
    for (const id of ['quai-1', 'quai-2', 'aiguillage', 'hall'] as const) {
      const room = parseRoom(id);
      expect(spawnableTiles(room, room.playerSpawn, 6).length).toBeGreaterThan(20);
    }
  });
});
