import type { QuaiScene } from '@/scenes3d/QuaiScene';

/**
 * Outil de pilotage de l'entrée 3D pour les captures automatisées (Playwright). Chargé uniquement en
 * dev avec `?demo` : absent du build de production.
 */
export function installDemoApi(scene: QuaiScene): void {
  const api = {
    hero: () => {
      const h = scene.simWorld.hero;
      return {
        x: h.body.x,
        y: h.body.y,
        state: h.state,
        combo: h.combo,
        energy: scene.simWorld.run.energy,
      };
    },
    enemies: () =>
      scene.simWorld.enemies.map((e) => ({
        id: e.id,
        x: e.body.x,
        y: e.body.y,
        hp: e.hp,
        state: e.state,
      })),
    kills: () => scene.simWorld.run.kills,
    teleport: (x: number, y: number) => {
      const b = scene.simWorld.hero.body;
      b.x = x;
      b.y = y;
      b.prevX = x;
      b.prevY = y;
    },
    move: (x: number, y: number) => {
      scene.override = { ...scene.override, moveX: x, moveY: y };
    },
    aim: (angle: number | null) => {
      const { aim: _old, ...rest } = scene.override;
      scene.override = angle === null ? rest : { ...rest, aim: angle };
    },
    release: () => {
      scene.override = {};
    },
    press: (what: 'attack' | 'dash' | 'special' | 'coffee') => {
      scene.controls.press(what);
    },
    spawn: (dx: number, dy: number, immediate = true) => {
      const h = scene.simWorld.hero.body;
      return scene.simWorld.spawnEnemy('consultant', h.x + dx, h.y + dy, immediate)?.id ?? -1;
    },
    waves: (on: boolean) => {
      scene.simWorld.director.enabled = on;
    },
    clear: () => {
      for (const e of scene.simWorld.enemies) e.debugKill();
    },
    stats: () => scene.gameView.stats(),
    advance: (ms: number) => {
      scene.fastForward(ms);
    },
    restart: () => {
      scene.restart();
    },
  };
  Object.assign(document.defaultView ?? {}, { __privatix3d: api });
}
