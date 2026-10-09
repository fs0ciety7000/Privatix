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
      biome: game.simWorld.director.biome,
      localRoom: game.simWorld.director.localRoom,
      boss: game.simWorld.director.boss
        ? {
            kind: game.simWorld.director.boss.kind,
            hp: game.simWorld.director.boss.hp,
            maxHp: game.simWorld.director.boss.maxHp,
            phase: game.simWorld.director.boss.phase,
            state: game.simWorld.director.boss.state,
          }
        : null,
      guardian: game.simWorld.director.guardian
        ? {
            kind: game.simWorld.director.guardian.kind,
            hp: game.simWorld.director.guardian.hp,
            phase: game.simWorld.director.guardian.phase,
          }
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
    /** Salle gardée du biome en cours, ou première salle d'un biome (captures). */
    gardee: () => {
      game.simWorld.director.cheatGardee();
    },
    biome: (b: number) => {
      game.simWorld.director.cheatBiome(b);
    },
    /** Force une attaque d'un ennemi (captures des télégraphes). */
    attack: (id: number, attack: string) => {
      game.simWorld.enemies.find((e) => e.id === id)?.debugAttack(attack);
    },
    /** Met les PV d'un ennemi à une fraction (phases des boss, captures). */
    hurt: (id: number, ratio: number) => {
      const e = game.simWorld.enemies.find((x) => x.id === id);
      if (!e) return;
      const target = Math.max(1, Math.round(e.maxHp * ratio));
      e.takeHit({
        amount: Math.max(1, e.hp - target),
        crit: false,
        fromX: e.body.x,
        fromY: e.body.y + 30,
        knockbackAngle: 0,
        knockbackPx: 0,
        knockbackMs: 0,
        stunMs: 0,
        slow: 0,
        slowMs: 0,
        vulnerable: 0,
        meltdownStun: false,
        heavy: false,
      });
    },
    mobilisation: (v: number) => {
      game.simWorld.run.mobilisation.add(v);
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
    /** Point logique (u) projeté à l'écran (px CSS) : cadrage des gros plans. */
    screen: (x: number, y: number, height = 1) => game.gameView.toScreen(x, y, height),
    /** Équipement du héros GLB (agent loot) : pose / retire une pièce du manifeste. */
    equip: (slot: 'casque' | 'gilet' | 'outil', id: string | null) => {
      const eq = game.gameView.heroEquipment;
      if (!eq) return null;
      if (id === null) eq.detach(slot);
      else eq.attach(slot, id);
      return eq.equipped;
    },
    advance: (ms: number) => {
      game.fastForward(ms);
    },
  };
  Object.assign(document.defaultView ?? {}, { __privatix3d: api });
}
