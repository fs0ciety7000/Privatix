import type { EnemyKind } from '@/config/balance';
import type { Game3D } from '@/scenes3d/Game3D';
import type { HubDoorId, HubStationId } from '@/sim/hub/stations';
import { HUB_DOORS, HUB_STATIONS_BY_ID } from '@/sim/hub/stations';

/**
 * Outil de pilotage de l'entrée 3D pour les captures automatisées (Playwright). Chargé uniquement en
 * dev avec `?demo` : absent du build de production.
 */
export function installDemoApi(game: Game3D): void {
  const api = {
    state: () => ({
      phase: game.state,
      menu: game.menuScreen,
      room: game.simWorld.run.room,
      roomType: game.simWorld.director.door.type,
      cleared: game.simWorld.director.cleared,
      choice: game.simWorld.director.choice?.title ?? null,
      doors: game.simWorld.director.doors
        .filter((d) => d.choice)
        .map((d) => ({
          x: d.x + d.width / 2,
          y: d.y,
          type: d.choice?.type,
          reward: d.choice?.reward,
        })),
      boss: game.simWorld.director.boss
        ? { hp: game.simWorld.director.boss.hp, phase: game.simWorld.director.boss.phase }
        : null,
      result: game.simWorld.director.result,
      kills: game.simWorld.run.kills,
    }),
    start: () => {
      game.startRun();
    },
    hero: () => {
      const h = game.simWorld.hero;
      return {
        x: h.body.x,
        y: h.body.y,
        state: h.state,
        combo: h.combo,
        energy: game.simWorld.run.energy,
      };
    },
    enemies: () =>
      game.simWorld.enemies.map((e) => ({
        id: e.id,
        kind: e.kind,
        x: e.body.x,
        y: e.body.y,
        hp: e.hp,
        state: e.state,
      })),
    hazards: () => game.simWorld.hazards.map((h) => ({ kind: h.spec.kind, progress: h.progress })),
    projectiles: () => game.simWorld.projectiles.active().length,
    /** Va jusqu'au premier objet utilisable de la salle et interagit (repos, café, Friterie). */
    useProp: () => {
      const it = game.simWorld.director.interactables.find((i) => !i.used);
      if (!it) return null;
      const b = game.simWorld.hero.body;
      b.x = it.x;
      b.y = it.y + 10;
      b.prevX = b.x;
      b.prevY = b.y;
      game.controls.press('interact');
      return it.label;
    },
    teleport: (x: number, y: number) => {
      const b = game.simWorld.hero.body;
      b.x = x;
      b.y = y;
      b.prevX = x;
      b.prevY = y;
    },
    move: (x: number, y: number) => {
      game.override = { ...game.override, moveX: x, moveY: y };
    },
    aim: (angle: number | null) => {
      const { aim: _old, ...rest } = game.override;
      game.override = angle === null ? rest : { ...rest, aim: angle };
    },
    release: () => {
      game.override = {};
    },
    press: (what: 'attack' | 'dash' | 'special' | 'coffee' | 'interact') => {
      game.controls.press(what);
    },
    spawn: (kind: EnemyKind, dx: number, dy: number) => game.spawnNear(kind, dx, dy),
    waves: (on: boolean) => {
      game.simWorld.director.enabled = on;
    },
    cheat: (key: 'K' | 'G' | 'N' | 'B') => {
      game.cheat(key);
    },
    choose: (i: number) => {
      game.choose(i);
    },
    stats: () => game.gameView.stats(),
    /** Progression (méta) courante. */
    progress: () => {
      const m = game.progress;
      return { ps: m.ps, grains: m.grains, pieces: m.pieces, upgrades: m.upgrades, stats: m.stats };
    },
    /** État du hub (phase `hub`), sinon `null`. */
    hub: () => {
      const h = game.hubController;
      if (!h) return null;
      return {
        zone: h.sim.zone,
        shift: h.sim.shift,
        prompt: h.sim.prompt?.label ?? null,
        frozen: h.sim.frozen,
        dummy: h.sim.dummy ? { dps: h.sim.dummy.dps, total: h.sim.dummy.total } : null,
      };
    },
    /** Place le héros devant une station du hub (changement de zone direct si besoin). */
    hubGoto: (id: HubStationId) => {
      const h = game.hubController;
      const s = HUB_STATIONS_BY_ID.get(id);
      if (!h || !s) return false;
      if (h.sim.zone !== s.zone) h.sim.enterZone(s.zone, null);
      const b = game.simWorld.hero.body;
      b.x = s.at.x;
      b.y = s.at.y;
      b.prevX = b.x;
      b.prevY = b.y;
      return true;
    },
    /** Place le héros à 40 u d'une porte du hub (il suffit ensuite de marcher vers elle). */
    hubDoor: (id: HubDoorId) => {
      const h = game.hubController;
      const d = HUB_DOORS.find((x) => x.id === id);
      if (!h || !d) return false;
      if (h.sim.zone !== d.zone) h.sim.enterZone(d.zone, null);
      const b = game.simWorld.hero.body;
      b.x = d.at.x;
      b.y = d.at.y - d.side * 40;
      b.prevX = b.x;
      b.prevY = b.y;
      return true;
    },
    advance: (ms: number) => {
      game.fastForward(ms);
    },
  };
  Object.assign(document.defaultView ?? {}, { __privatix3d: api });
}
