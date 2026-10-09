import type { EnemyKind } from '@/config/balance';
import type { Game3D } from '@/scenes3d/Game3D';

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
