import { describe, expect, it } from 'vitest';
import { BURNOUT, DASH, HERO } from '@/config/balance';
import { LOOT_PICKUP, TOOLS } from '@/config/loot';
import { SIM_DT_MS } from '@/sim/clock/FixedClock';
import type { SimEvent } from '@/sim/events';
import type { PlayerIntent } from '@/sim/intent';
import { NO_INTENT } from '@/sim/intent';
import { Weapon } from '@/sim/Weapon';
import { World } from '@/sim/World';
import type { ItemInstance } from '@/systems/loot';
import { equip, scrapValue } from '@/systems/loot';
import { newMeta } from '@/systems/meta/MetaState';
import { maxEnergy } from '@/systems/meta/RunState';
import { settleShift } from '@/systems/meta/settle';

/** Joue `ms` de simulation ; les appuis de `intent` ne partent qu'au premier pas. */
function play(world: World, ms: number, intent: Partial<PlayerIntent> = {}): SimEvent[] {
  const events: SimEvent[] = [];
  world.queueIntent({ ...NO_INTENT, ...intent });
  const steps = Math.round(ms / SIM_DT_MS);
  for (let i = 0; i < steps; i += 1) {
    world.snapshot();
    world.step(SIM_DT_MS);
    events.push(...world.drainEvents());
    world.queueIntent({
      ...NO_INTENT,
      ...intent,
      attack: false,
      dash: false,
      special: false,
      coffee: false,
      interact: false,
    });
  }
  return events;
}

/** Salle calme, sans vagues, avec les drops branchés. */
function lootWorld(seed = 21): World {
  return new World({ seed, waves: false, loot: true, room: 'quai-1' });
}

let uid = 900;
function item(defId: string, extra: Partial<ItemInstance> = {}): ItemInstance {
  uid += 1;
  return {
    uid: `it-${String(uid).padStart(6, '0')}`,
    defId,
    rarity: 'homologue',
    ilvl: 5,
    implicitQ: 0.5,
    affixes: [],
    origin: { source: 'ennemi', shift: 1, room: 1 },
    rerolls: 0,
    locked: false,
    ...extra,
  };
}

/** Équipe directement un objet (tests des modificateurs). */
function wear(world: World, it: ItemInstance): void {
  world.loot.loadout = equip(world.loot.loadout, it).loadout;
  world.loot.applyGear();
}

/** Tue un Manager KPI (élite : 1 objet garanti) près du héros. */
function killElite(world: World): void {
  const h = world.hero.body;
  const e = world.spawnEnemy('manager', h.x + 40, h.y, true);
  if (!e) throw new Error('apparition refusée');
  e.debugKill();
  play(world, 100);
}

/** Amène le héros sur l'objet au sol le plus récent. */
function standOn(world: World): void {
  const g = world.loot.ground[world.loot.ground.length - 1];
  if (!g) throw new Error('aucun objet au sol');
  const b = world.hero.body;
  b.x = g.x;
  b.y = g.y;
  b.prevX = g.x;
  b.prevY = g.y;
  play(world, SIM_DT_MS);
}

describe('Loot 3D : départ et modificateurs', () => {
  it('le Shift démarre avec l’Outil de départ et un équipement neutre', () => {
    const w = lootWorld();
    expect(w.loot.loadout.equipped.outil?.defId).toBe('cle-tire-fond');
    expect(w.loot.mods.damage.baseMult).toBe(1);
    expect(w.loot.mods.attackSpeedMult).toBe(1);
    expect(w.hero.tool).toBe(TOOLS['cle-tire-fond']);
    expect(w.hero.outgoingMods().critChance).toBeCloseTo(HERO.CRIT_CHANCE);
  });

  it('les affixes s’appliquent au héros : dégâts, Énergie max, vitesse d’attaque, dégâts subis', () => {
    const w = lootWorld();
    const base = maxEnergy(w.run);
    const dmg = w.hero.outgoingMods().damageBonus;
    wear(w, item('gants-manutention', { affixes: [{ affixId: 'affute', q: 1 }] }));
    wear(w, item('gilet-classe2', { affixes: [{ affixId: 'du-depot', q: 1 }] }));
    expect(w.hero.outgoingMods().damageBonus).toBeGreaterThan(dmg);
    expect(maxEnergy(w.run)).toBeGreaterThan(base);
    expect(w.loot.mods.attackSpeedMult).toBeGreaterThan(1);
    // Le Casque de chantier réduit les dégâts subis.
    wear(w, item('casque-chantier'));
    const before = w.run.energy;
    w.hero.receiveHit(20, { x: w.hero.body.x + 10, y: w.hero.body.y, name: 'test' });
    expect(before - w.run.energy).toBeLessThan(20);
  });

  it('les Avantages gardent les bonus d’équipement (même seau additif)', () => {
    const w = lootWorld();
    wear(w, item('gilet-classe2', { affixes: [{ affixId: 'du-depot', q: 1 }] }));
    const withGear = maxEnergy(w.run);
    w.director.offerAvantage();
    w.director.choose(0);
    expect(maxEnergy(w.run)).toBeGreaterThanOrEqual(withGear);
  });
});

describe('Loot 3D : drops et ramassage', () => {
  it('une élite lâche un objet, éjecté à 24–48 px, avec son événement', () => {
    const w = lootWorld();
    const h = w.hero.body;
    const e = w.spawnEnemy('manager', h.x + 40, h.y, true);
    if (!e) throw new Error('apparition refusée');
    const ex = e.body.x;
    const ey = e.body.y;
    e.debugKill();
    const events = play(w, 100);
    const drop = events.find((ev) => ev.type === 'lootDropped');
    expect(drop).toBeDefined();
    expect(w.loot.ground.length).toBeGreaterThanOrEqual(1);
    const g = w.loot.ground[0];
    if (!g) return;
    const d = Math.hypot(g.x - ex, g.y - ey);
    expect(d).toBeLessThanOrEqual(LOOT_PICKUP.EJECT_MAX + 1);
    expect(g.item.rarity).not.toBe('reforme');
  });

  it('pas de ramassage tant qu’un ennemi vit ; appui E = équiper, l’ancien objet va au sac', () => {
    const w = lootWorld();
    killElite(w);
    const g = w.loot.ground[w.loot.ground.length - 1];
    if (!g) throw new Error('pas de drop');
    const h = w.hero.body;
    const guard = w.spawnEnemy('borne', h.x + 200, h.y - 100, true);
    standOn(w);
    expect(w.loot.near?.id).toBe(g.id);
    expect(w.loot.canTake).toBe(false);
    const n = w.loot.ground.length;
    play(w, SIM_DT_MS, { interact: true });
    expect(w.loot.ground).toHaveLength(n);
    guard?.debugKill();
    play(w, SIM_DT_MS);
    const before = w.loot.loadout.equipped;
    const events = play(w, SIM_DT_MS, { interact: true, interactHeld: false });
    expect(events.some((e) => e.type === 'lootTaken' && e.action === 'equip')).toBe(true);
    expect(events.some((e) => e.type === 'gearChanged')).toBe(true);
    expect(w.loot.ground.filter((x) => x.id === g.id)).toHaveLength(0);
    const slot = Object.entries(w.loot.loadout.equipped).find(([, v]) => v?.uid === g.item.uid);
    expect(slot).toBeDefined();
    const previous = slot ? before[slot[0] as keyof typeof before] : null;
    if (previous) expect(w.loot.loadout.bag.some((b) => b?.uid === previous.uid)).toBe(true);
  });

  it('maintien E 400 ms = au sac ; maintien Démonter 500 ms = Ferraille', () => {
    const w = lootWorld(5);
    killElite(w);
    standOn(w);
    const n = w.loot.ground.length;
    play(w, LOOT_PICKUP.BAG_HOLD_MS + 50, { interact: true, interactHeld: true });
    expect(w.loot.loadout.bag.filter((b) => b !== null)).toHaveLength(1);
    expect(w.loot.ground).toHaveLength(n - 1);

    w.loot.ground.length = 0;
    killElite(w);
    standOn(w);
    const m = w.loot.ground.length;
    const g = w.loot.ground[m - 1];
    if (!g) throw new Error('pas de drop');
    play(w, 300, { scrapHeld: true });
    expect(w.loot.ground).toHaveLength(m);
    play(w, 300, { scrapHeld: true });
    expect(w.loot.ground).toHaveLength(m - 1);
    expect(w.loot.ferraille).toBe(scrapValue(g.item));
  });

  it('Dotation : deux objets au choix, prendre l’un retire l’autre', () => {
    const w = lootWorld();
    const h = w.hero.body;
    w.loot.dropDotation(h.x, h.y - 40);
    play(w, SIM_DT_MS);
    expect(w.loot.ground).toHaveLength(2);
    const [a, b] = w.loot.ground;
    expect(a?.group).toBeGreaterThan(0);
    expect(a?.group).toBe(b?.group);
    expect(a?.item.rarity).not.toBe('reforme');
    standOn(w);
    play(w, SIM_DT_MS, { interact: true });
    expect(w.loot.ground).toHaveLength(0);
  });

  it('un objet laissé au sol en quittant la salle rend 50 % en Ferraille', () => {
    const w = lootWorld();
    killElite(w);
    const expected = w.loot.ground.reduce((sum, g) => sum + scrapValue(g.item, true), 0);
    expect(w.loot.ground.length).toBeGreaterThan(0);
    w.loadRoom('quai-2');
    w.emit({ type: 'roomEntered', room: 2, roomType: 'combat' });
    expect(w.loot.ground).toHaveLength(0);
    expect(w.loot.ferraille).toBe(expected);
  });

  it('les portes Dotation sont tirées au poids de REWARD_WEIGHTS_LOOT, déterministes', () => {
    let dotations = 0;
    let doors = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const w = new World({ seed });
      const again = new World({ seed });
      expect(w.director.doors.map((d) => d.choice?.reward)).toEqual(
        again.director.doors.map((d) => d.choice?.reward),
      );
      for (const d of w.director.doors) {
        if (!d.choice) continue;
        doors += 1;
        if (d.choice.reward === 'dotation') dotations += 1;
      }
    }
    expect(doors).toBeGreaterThan(0);
    // Salle 1 → 2 : jusqu'à 3 portes ; une Dotation au plus par salle.
    expect(dotations).toBeGreaterThan(0);
    expect(dotations).toBeLessThan(doors / 2);
  });

  it('le loot ne consomme jamais l’aléatoire du monde (rejeu identique avec ou sans drops)', () => {
    const a = new World({ seed: 77, waves: false, loot: true, room: 'quai-1' });
    const b = new World({ seed: 77, waves: false, loot: false, room: 'quai-1' });
    for (const w of [a, b]) {
      const h = w.hero.body;
      for (let i = 0; i < 6; i += 1) w.spawnEnemy('consultant', h.x + 30 + i * 4, h.y, true);
      play(w, 1200, { attack: true });
      for (const e of w.livingEnemies()) e.debugKill();
      play(w, 200);
    }
    expect(a.rng()).toBe(b.rng());
  });
});

describe('Loot 3D : Outils et légendaires', () => {
  it('Masse de voie : 2 coups, le coup final est un cercle devant le héros', () => {
    const w = lootWorld();
    wear(w, item('masse-voie', { rarity: 'reglementaire' }));
    expect(w.hero.tool.combo).toHaveLength(2);
    const finisher = w.hero.tool.combo[w.hero.tool.finisherIndex];
    expect(finisher?.shape.kind).toBe('circle');
    // Le cercle (r = 44, à 34 px devant) touche une cible de côté qu'un arc étroit raterait.
    const h = w.hero.body;
    const e = w.spawnEnemy('consultant', h.x + 34, h.y + 40, true);
    if (!e) throw new Error('apparition refusée');
    const weapon = new Weapon(w);
    weapon.begin();
    const shape = finisher?.shape;
    if (shape?.kind !== 'circle') throw new Error('forme inattendue');
    const report = weapon.sweep(
      { x: h.x, y: h.y },
      0,
      {
        shape,
        damage: 5,
        knockbackPx: 0,
        knockbackMs: 0,
        stunMs: 0,
        breaksProjectiles: false,
        finisher: true,
        combo: true,
      },
      { damageBonus: 0, critChance: 0, critMult: 1 },
    );
    expect(report.targets).toBe(1);
  });

  it('le combo suit l’Outil : la Masse boucle en 2 coups', () => {
    const w = lootWorld();
    wear(w, item('masse-voie', { rarity: 'reglementaire' }));
    const combos: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      play(w, SIM_DT_MS, { attack: true });
      combos.push(w.hero.combo);
      play(w, 700);
    }
    expect(Math.max(...combos)).toBeLessThanOrEqual(1);
  });

  it('Gilet Haute visibilité absolue : fenêtre de dash parfait ×2, charge rendue', () => {
    const w = lootWorld();
    wear(w, item('gilet-classe2', { rarity: 'patrimoine', legendaryId: 'gilet-haute-visibilite' }));
    expect(w.loot.perfectWindowMult).toBe(2);
    play(w, SIM_DT_MS, { dash: true });
    play(w, DASH.PERFECT_WINDOW_MS * 1.5);
    expect(w.hero.inPerfectWindow()).toBe(w.hero.state === 'dash');
  });

  it('Casque Cocotte-minute : Burnout bloqué à 99, pas de Pétage de plombs', () => {
    const w = lootWorld();
    wear(
      w,
      item('casque-chantier', { rarity: 'patrimoine', legendaryId: 'casque-cocotte-minute' }),
    );
    w.run.burnout.add(BURNOUT.MAX + 50);
    expect(w.run.burnout.value).toBe(99);
    expect(w.run.burnout.inMeltdown).toBe(false);
  });

  it('Carnet de revendications : +1 cumul par salle nettoyée sans boire', () => {
    const w = lootWorld();
    wear(w, item('badge-syndical', { rarity: 'patrimoine', legendaryId: 'carnet-revendications' }));
    const before = w.hero.outgoingMods().damageBonus;
    w.director.clearRoom(false);
    expect(w.loot.stacks.carnet).toBe(1);
    expect(w.hero.outgoingMods().damageBonus).toBeCloseTo(before + 0.04);
  });

  it('Ruban inaugural : la Promesse absorbe le premier coup de la salle', () => {
    const w = lootWorld();
    wear(w, item('badge-syndical', { rarity: 'patrimoine', legendaryId: 'ruban-inaugural' }));
    w.emit({ type: 'roomEntered', room: 1, roomType: 'combat' });
    expect(w.loot.stacks.promise).toBe(1);
    const before = w.run.energy;
    const h = w.hero.body;
    expect(w.hero.receiveHit(10, { x: h.x + 5, y: h.y, name: 'test' })).toBe(false);
    expect(w.run.energy).toBe(before);
    expect(w.loot.stacks.promise).toBe(0);
  });
});

describe('Loot 3D : fin de Shift et consigne', () => {
  it('la consigne range l’objet choisi au Vestiaire, le reste part en Ferraille', () => {
    const meta = newMeta();
    const w = new World({ seed: 3, waves: false, loot: true, room: 'quai-1', meta });
    killElite(w);
    standOn(w);
    play(w, SIM_DT_MS, { interact: true });
    w.director.endShift('mort');
    play(w, SIM_DT_MS);
    const result = w.director.result;
    if (!result) throw new Error('pas de bilan');
    const keep = w.loot.defaultKeep('mort');
    expect(keep).toHaveLength(1);
    const settled = settleShift(meta, result, w.loot.runEnd('mort', keep));
    expect(settled.lootError).toBeNull();
    expect(settled.meta.loot.vestiaire.map((i) => i.uid)).toEqual(keep);
    expect(settled.ferraille).toBeGreaterThan(0);
  });

  it('en victoire, le butin resté au sol est proposé à la consigne', () => {
    const w = lootWorld();
    killElite(w);
    const g = w.loot.ground[0];
    if (!g) throw new Error('pas de drop');
    w.director.endShift('victoire');
    expect(w.loot.carried.map((i) => i.uid)).toContain(g.item.uid);
    expect(w.loot.consignCandidates().map((i) => i.uid)).toContain(g.item.uid);
  });
});
