import { BURNOUT, HERO, REWARD_WEIGHTS_LOOT } from '@/config/balance';
import { TILE } from '@/config/constants';
import type { DropSource, ItemRarity, SlotId } from '@/config/loot';
import { GEAR_CAPS, ITEMS_BY_ID, KILL_DROP_CHANCE, LOOT_PICKUP, RARITY_ORDER } from '@/config/loot';
import type {
  DotationAnnounce,
  DropContext,
  DropResult,
  EquipmentModifiers,
  GearLoadout,
  ItemInstance,
  LootPity,
  LootRunState,
  RunEnd,
} from '@/systems/loot';
import {
  announceDotation,
  clampBurnoutForGear,
  consignLimit,
  dotationOffer,
  dropsForKill,
  dropsForSource,
  equip,
  equipFromBag,
  equipmentModifiers,
  hasPower,
  itemName,
  loadoutItems,
  LOOT_SALT,
  powerParam,
  scrapValue,
  slotOf,
  startLootRun,
  stash,
  takeFromBag,
} from '@/systems/loot';
import { AVANTAGES_BY_ID } from '@/systems/meta/Avantages';
import type { FamilyId, HeroMods } from '@/systems/meta/Avantages';
import type { MetaState } from '@/systems/meta/MetaState';
import { heal, hoursElapsed, maxEnergy, refreshMods } from '@/systems/meta/RunState';
import type { ShiftEnd } from '@/systems/meta/RunState';
import type { DoorChoice } from '@/systems/procedural/ShiftPlan';
import { roomIndex, roomRng } from '@/systems/procedural/ShiftPlan';
import { isSolid } from '@/systems/procedural/RoomLayout';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import type { PlayerIntent } from '@/sim/intent';
import type { World } from '@/sim/World';
import { Weapon } from '@/sim/Weapon';

/** Objet d'équipement au sol : entité de la simulation (la vue le dessine, la sim l'applique). */
export interface GroundItem {
  readonly id: number;
  readonly item: ItemInstance;
  readonly x: number;
  readonly y: number;
  /** Point d'éjection (arc visuel de la vue). */
  readonly fromX: number;
  readonly fromY: number;
  /** Temps de sim du drop. */
  readonly at: number;
  /** Groupe d'une Dotation (« 1 au choix parmi 2 ») : prendre l'un retire les autres. 0 = aucun. */
  readonly group: number;
  readonly source: DropSource;
}

export type LootAction = 'equip' | 'bag' | 'scrap';

/** Ennemis « Salle gardée » et boss à venir (biomes 2 et 3), reconnus par leur nom de type. */
const GUARDED_KINDS: ReadonlySet<string> = new Set(['discosaure', 'fluidifieur']);
const BOSS_KINDS: ReadonlySet<string> = new Set(['auditeur', 'lurcke', 'boss2', 'boss3']);
const ELITE_KINDS: ReadonlySet<string> = new Set(['manager', 'furet']);

/** Tache de lumière de la Boule à facettes (L12). */
interface Spot {
  readonly x: number;
  readonly y: number;
  readonly until: number;
  nextTick: number;
}

interface Delayed {
  readonly at: number;
  readonly fn: () => void;
}

/** Récompenses de porte réellement branchées en 3D (le « Réglage d'outil » viendra plus tard). */
const DOOR_WEIGHTS = Object.entries(REWARD_WEIGHTS_LOOT).filter(([k]) => k !== 'reglage');
const DOTATION_CHANCE = REWARD_WEIGHTS_LOOT.dotation / DOOR_WEIGHTS.reduce((s, [, w]) => s + w, 0);

/**
 * Le loot pendant un Shift (pur, seedé) : équipement porté et sac de 4 cases, objets au sol,
 * drops (ennemis, élites, Salle gardée, boss, porte « Dotation »), ramassage (Interagir : équiper ;
 * maintien : sac ; Démonter maintenu : Ferraille), modificateurs d'équipement appliqués au héros et
 * pouvoirs Patrimoine. Les tirages passent par les flux de loot de `systems/loot` (jamais par
 * `world.rng`) : brancher le loot ne change aucun autre tirage du Shift.
 */
export class LootSim {
  public loadout: GearLoadout;
  public cursorRun: LootRunState;
  public pity: LootPity;
  /** Modificateurs de l'équipement porté (ilvl effectif de la salle courante). */
  public mods: EquipmentModifiers;
  public readonly ground: GroundItem[] = [];
  /** Objets tombés pendant le Shift (écran des départs). */
  public readonly found: ItemInstance[] = [];
  /** Objets du sol ramenés d'office en fin de Shift (butin du boss), proposés à la consigne. */
  public readonly carried: ItemInstance[] = [];
  /** Ferraille gagnée pendant le Shift (démontages, objets laissés au sol). */
  public ferraille = 0;
  /** Incrémenté à chaque changement d'équipement (vue, HUD). */
  public version = 0;
  /** Objet au sol le plus proche (carte de comparaison), ou `null`. */
  public near: GroundItem | null = null;
  /** Hors combat : les objets ne se ramassent pas tant qu'un ennemi vit. */
  public canTake = false;
  public outcome: ShiftEnd | null = null;
  private readonly meta: MetaState;
  private readonly enabled: boolean;
  private readonly announces = new Map<number, DotationAnnounce>();
  private nextId = 1;
  private nextGroup = 1;
  private holdId = -1;
  private holdSince = 0;
  private scrapId = -1;
  private scrapSince = 0;
  // Pouvoirs Patrimoine
  private readonly fxWeapon: Weapon;
  private delayed: Delayed[] = [];
  private spots: Spot[] = [];
  private carnetStacks = 0;
  private drankThisRoom = false;
  private cliquetStacks = 0;
  private hitThisLoop = false;
  private promise = 0;
  private promiseUsed = false;
  private valveAt = 0;
  private perfectBonusReady = false;

  public constructor(
    private readonly world: World,
    meta: MetaState,
    opts: { readonly enabled: boolean; readonly fixedSeed?: boolean },
  ) {
    this.meta = meta;
    this.enabled = opts.enabled;
    const start = startLootRun(meta, { fixedSeed: opts.fixedSeed === true });
    this.loadout = start.loadout;
    this.cursorRun = start.run;
    this.pity = start.pity;
    this.mods = equipmentModifiers(this.loadout.equipped, { r: roomIndex(world.run.room) });
    this.fxWeapon = new Weapon(world);
    world.run.modsHook = (base) => {
      this.foldInto(base);
    };
  }

  // ─── Lecture (vue, HUD, UI) ────────────────────────────────────────────────

  /** Indice de salle `r` (ilvl effectif). */
  public get r(): number {
    return roomIndex(this.world.run.room);
  }

  /** Progression du maintien en cours (0..1) et son action, pour l'anneau de la carte. */
  public get hold(): { readonly action: 'bag' | 'scrap'; readonly progress: number } | null {
    const now = this.world.now();
    const near = this.near;
    if (!near) return null;
    if (this.scrapId === near.id)
      return {
        action: 'scrap',
        progress: Math.min(1, (now - this.scrapSince) / LOOT_PICKUP.SCRAP_HOLD_MS),
      };
    if (this.holdId === near.id)
      return {
        action: 'bag',
        progress: Math.min(1, (now - this.holdSince) / LOOT_PICKUP.BAG_HOLD_MS),
      };
    return null;
  }

  /** Annonce de la porte Dotation menant à `room`, s'il y en a une. */
  public announceFor(room: number): DotationAnnounce | null {
    return this.announces.get(room) ?? null;
  }

  /** Cumuls des pouvoirs (HUD) : Carnet de revendications, Clé à cliquet perpétuel. */
  public get stacks(): {
    readonly carnet: number;
    readonly cliquet: number;
    readonly promise: number;
  } {
    return { carnet: this.carnetStacks, cliquet: this.cliquetStacks, promise: this.promise };
  }

  // ─── Modificateurs appliqués au héros ──────────────────────────────────────

  /**
   * Part de l'équipement dans le socle des modificateurs (`RunState.modsHook`) : même seau additif
   * que la méta et les Avantages. Le reste (multiplicateurs, Burnout, café) est lu par `HeroSim`.
   */
  private foldInto(base: HeroMods): void {
    const m = this.mods;
    base.damageBonus += m.damage.bonus;
    base.critChance += m.damage.critChanceBonus;
    base.critMult += m.damage.critMultBonus;
    base.knockbackMult *= m.damage.knockbackMult;
    base.maxEnergy += m.defense.maxEnergyBonus;
    base.speedBonus += m.movement.speedMult - 1;
    base.dashDistanceBonus += m.dash.distanceBonus;
    base.dashCharges += m.dash.chargesBonus;
    base.dashTrailDamage += m.dash.trailDamage;
    base.perfectDashWindowBonusMs += m.dash.perfectWindowBonusMs;
    base.whistleRadiusBonus += m.whistle.radiusBonus;
    base.whistleDamageBonus += m.whistle.damageMult - 1;
    base.coffeeHealBonus += m.coffee.healBonus;
  }

  /** Recalcule les modificateurs (équipement changé ou nouvelle salle) et les applique au Shift. */
  public applyGear(): void {
    const run = this.world.run;
    this.mods = equipmentModifiers(this.loadout.equipped, { r: this.r });
    const m = this.mods;
    run.mobilisation.gainMult = m.mobilisation.gainMult;
    run.mobilisation.damageGainMult = hasPower(m, 'boule-a-facettes')
      ? powerParam(m, 'boule-a-facettes', 'mobilisationFromDamageMult', 1)
      : 1;
    run.burnout.extraDecayPerS = run.loadout.burnoutDecayBonus + m.burnout.decayBonusPerS;
    run.burnout.decayMult = hasPower(m, 'cocotte-minute')
      ? powerParam(m, 'cocotte-minute', 'decayMult', 1)
      : 1;
    run.burnout.cap = clampBurnoutForGear(m, BURNOUT.MAX);
    run.burnout.setFloor(hoursElapsed(run), run.shift.floorMult * m.burnout.floorMult);
    const before = maxEnergy(run);
    refreshMods(run);
    const after = maxEnergy(run);
    if (after > before) heal(run, after - before);
    else run.energy = Math.min(run.energy, after);
    if (!hasPower(m, 'cliquet-perpetuel')) this.cliquetStacks = 0;
    if (!hasPower(m, 'carnet-revendications')) this.carnetStacks = 0;
    this.version += 1;
    this.world.emit({ type: 'gearChanged' });
  }

  /** Bonus additif de dégâts propre au moment (Burnout, Nuit, dash parfait, cumuls Patrimoine). */
  public damageBonusNow(): number {
    const m = this.mods;
    const run = this.world.run;
    let bonus = m.damage.perBurnout10 * Math.floor(run.burnout.value / 10);
    if (run.shift.id === 'nuit') bonus += m.damage.nightBonus;
    if (this.perfectBonusReady) bonus += m.damage.afterPerfectDashBonus;
    bonus += this.carnetStacks * powerParam(m, 'carnet-revendications', 'stackDamage');
    bonus += this.cliquetStacks * powerParam(m, 'cliquet-perpetuel', 'stackDamage');
    return bonus;
  }

  /** Chance de critique totale, plafonnée (`GEAR_CAPS.critChance` vaut pour toutes les sources). */
  public capCrit(total: number): number {
    return Math.min(GEAR_CAPS.critChance ?? 1, total);
  }

  // ─── Hooks appelés par le héros ────────────────────────────────────────────

  /** Un coup du combo commence ; `finisher` : coup final de l'Outil. */
  public onSwingStart(comboIndex: number): void {
    if (comboIndex === 0) this.hitThisLoop = false;
  }

  /** Le coup a porté : consomme le bonus « après un dash parfait ». */
  public onSwingHit(): void {
    this.perfectBonusReady = false;
  }

  /** Frames actives du coup final (Dernière Traverse, Clé à cliquet perpétuel). */
  public onFinisher(x: number, y: number, angle: number, damage: number): void {
    const m = this.mods;
    if (hasPower(m, 'cliquet-perpetuel') && !this.hitThisLoop) {
      const max = powerParam(m, 'cliquet-perpetuel', 'maxStacks', 5);
      this.cliquetStacks = Math.min(max, this.cliquetStacks + 1);
    }
    if (hasPower(m, 'derniere-traverse')) {
      const length = powerParam(m, 'derniere-traverse', 'riftLength', 120);
      const width = powerParam(m, 'derniere-traverse', 'riftWidth', 14);
      const delay = powerParam(m, 'derniere-traverse', 'riftDelayMs', 500);
      const mult = powerParam(m, 'derniere-traverse', 'riftDamageMult', 0.6);
      const slow = powerParam(m, 'derniere-traverse', 'slow', 0.4);
      const slowMs = powerParam(m, 'derniere-traverse', 'slowMs', 1500);
      this.world.emit({ type: 'gearFx', kind: 'rift', x, y, angle, size: length });
      this.later(delay, () => {
        this.fxWeapon.begin();
        this.fxWeapon.sweep(
          { x, y },
          angle,
          {
            shape: { kind: 'rect', from: 0, length, width, tipRadius: 0, tipAt: 0 },
            damage: Math.max(1, Math.round(damage * mult)),
            knockbackPx: 0,
            knockbackMs: 0,
            stunMs: 0,
            breaksProjectiles: false,
            finisher: false,
            combo: false,
            slow: { fraction: slow, ms: slowMs },
          },
          { damageBonus: 0, critChance: 0, critMult: 1 },
        );
        this.world.emit({ type: 'gearFx', kind: 'rift', x, y, angle, size: -length });
      });
    }
  }

  /** Coup reçu par le héros (avant les dégâts) : `true` si la Promesse du Ruban l'absorbe. */
  public absorbHit(): boolean {
    this.hitThisLoop = true;
    this.cliquetStacks = 0;
    if (this.promise > 0) {
      this.promise -= 1;
      this.promiseUsed = true;
      const h = this.world.hero.body;
      this.world.emit({ type: 'gearFx', kind: 'promise', x: h.x, y: h.y, angle: 0, size: 18 });
      this.world.emit({ type: 'text', x: h.x, y: h.y, text: 'PROMESSE', tone: 'info' });
      return true;
    }
    return false;
  }

  /** Coup encaissé (après les dégâts) : Mobilisation « de la colère ». */
  public onHitTaken(): void {
    const gain = this.mods.mobilisation.onHitTaken;
    if (gain > 0) this.world.run.mobilisation.add(gain);
  }

  /** Dash parfait : Haute visibilité (charge entière), Boule à facettes (taches), bonus de coup. */
  public onPerfectDash(x: number, y: number): void {
    const m = this.mods;
    if (m.damage.afterPerfectDashBonus > 0) this.perfectBonusReady = true;
    if (hasPower(m, 'haute-visibilite'))
      this.world.run.dash.refund(powerParam(m, 'haute-visibilite', 'chargeRefund', 1));
    if (hasPower(m, 'boule-a-facettes')) {
      const n = powerParam(m, 'boule-a-facettes', 'spots', 3);
      const ms = powerParam(m, 'boule-a-facettes', 'spotMs', 4000);
      const now = this.world.now();
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 + Math.PI / 2;
        const sx = x + Math.cos(a) * 28;
        const sy = y + Math.sin(a) * 28;
        this.spots.push({ x: sx, y: sy, until: now + ms, nextTick: now });
        this.world.emit({ type: 'gearFx', kind: 'spot', x: sx, y: sy, angle: 0, size: 20 });
      }
    }
  }

  /** Multiplicateur de la fenêtre de dash parfait (Haute visibilité : ×2). */
  public get perfectWindowMult(): number {
    return hasPower(this.mods, 'haute-visibilite')
      ? powerParam(this.mods, 'haute-visibilite', 'perfectWindowMult', 1)
      : 1;
  }

  /** Gorgée de Gobelet : Carnet de revendications (soin +2 % par cumul, cumuls consommés). */
  public onCupDrink(): number {
    this.drankThisRoom = true;
    if (this.carnetStacks <= 0) return 0;
    const per = powerParam(this.mods, 'carnet-revendications', 'healPerStack');
    const bonus = this.carnetStacks * per;
    this.carnetStacks = 0;
    return bonus;
  }

  /** Pétage de plombs : le Carnet perd ses cumuls. */
  public onMeltdown(): void {
    this.carnetStacks = 0;
  }

  // ─── Salles et fin de Shift (événements du monde) ──────────────────────────

  /**
   * Portes de la salle suivante : chaque porte de combat avec récompense peut devenir une porte
   * « Dotation » (une au plus), au poids de `REWARD_WEIGHTS_LOOT` (GDD § 3.8). Flux dédié (sel 998).
   */
  public dressDoors(choices: readonly DoorChoice[]): DoorChoice[] {
    if (!this.enabled) return [...choices];
    const seed = this.world.run.seed;
    let placed = false;
    return choices.map((c) => {
      if (placed || c.reward === null || (c.type !== 'combat' && c.type !== 'elite')) return c;
      const rng = roomRng(seed, c.room, LOOT_SALT - 2);
      if (rng() >= DOTATION_CHANCE) return c;
      placed = true;
      this.announces.set(c.room, announceDotation(seed, c.room, this.cursorRun.slotBag));
      return { ...c, reward: 'dotation' };
    });
  }

  public onRoomEntered(): void {
    // Objets laissés au sol en quittant la salle : 50 % de leur valeur en Ferraille (un par Dotation).
    const groups = new Set<number>();
    for (const g of this.ground) {
      if (g.group > 0) {
        if (groups.has(g.group)) continue;
        groups.add(g.group);
      }
      this.ferraille += scrapValue(g.item, true);
    }
    this.ground.length = 0;
    this.near = null;
    this.spots = [];
    this.delayed = [];
    this.drankThisRoom = false;
    this.promise = 0;
    this.promiseUsed = false;
    const run = this.world.run;
    const m = this.mods;
    if (run.roomType === 'combat' || run.roomType === 'elite' || run.roomType === 'boss') {
      if (m.mobilisation.onRoomEnter > 0) run.mobilisation.add(m.mobilisation.onRoomEnter);
      if (hasPower(m, 'ruban-inaugural'))
        this.promise = powerParam(m, 'ruban-inaugural', 'shieldsPerRoom', 1);
    }
    // L'ilvl effectif suit la salle : les modificateurs sont recalculés à chaque salle.
    this.applyGear();
  }

  public onRoomCleared(): void {
    const run = this.world.run;
    const m = this.mods;
    if (m.defense.energyOnRoomClear > 0) heal(run, m.defense.energyOnRoomClear);
    if (hasPower(m, 'carnet-revendications') && !this.drankThisRoom) {
      const max = powerParam(m, 'carnet-revendications', 'maxStacks', 8);
      this.carnetStacks = Math.min(max, this.carnetStacks + 1);
      const h = this.world.hero.body;
      this.world.emit({ type: 'text', x: h.x, y: h.y, text: 'REVENDICATION', tone: 'gold' });
    }
    if (this.promise > 0 && !this.promiseUsed && hasPower(m, 'ruban-inaugural')) {
      run.mobilisation.add(powerParam(m, 'ruban-inaugural', 'keptMobilisation', 15));
      const h = this.world.hero.body;
      this.world.emit({ type: 'gearFx', kind: 'promiseKept', x: h.x, y: h.y, angle: 0, size: 24 });
      this.world.emit({ type: 'text', x: h.x, y: h.y, text: 'PROMESSE TENUE', tone: 'gold' });
    }
    this.promise = 0;
  }

  /** Fin du Shift : le butin resté au sol est ramené en victoire (consigne), à 50 % sinon. */
  public onShiftEnded(end: ShiftEnd): void {
    this.outcome = end;
    for (const g of this.ground) {
      if (end === 'victoire' && g.group === 0) this.carried.push(g.item);
      else this.ferraille += scrapValue(g.item, true);
    }
    this.ground.length = 0;
    this.near = null;
  }

  // ─── Drops ─────────────────────────────────────────────────────────────────

  private dropContext(): DropContext {
    const run = this.world.run;
    const families = new Set<FamilyId>();
    for (const a of run.avantages) {
      const def = AVANTAGES_BY_ID.get(a.id);
      if (def) families.add(def.family);
    }
    return {
      seed: run.seed,
      room: run.room,
      shift: run.shift.id,
      shiftNumber: this.meta.stats.shifts + 1,
      unlockedTools: this.meta.loot.unlockedTools,
      codex: this.meta.loot.codex,
      worn: [...loadoutItems(this.loadout), ...this.ground.map((g) => g.item)],
      ownedFamilies: [...families],
      mvpAffixesOnly: true,
    };
  }

  private take(res: DropResult): readonly ItemInstance[] {
    this.cursorRun = res.run;
    this.pity = res.pity;
    return res.items;
  }

  /** Un ennemi est mort : butin selon son type (base, élite, Salle gardée, boss). */
  public onKill(enemy: EnemySim): void {
    if (!this.enabled) return;
    const kind: string = enemy.kind;
    const { x, y } = enemy.body;
    const ctx = this.dropContext();
    const cursor = { run: this.cursorRun, pity: this.pity };
    let items: readonly ItemInstance[];
    let source: DropSource;
    if (BOSS_KINDS.has(kind)) {
      const kills = this.meta.stats.bossKills;
      source = kills === 0 ? 'boss-premier' : 'boss';
      items = this.take(
        dropsForSource('boss', ctx, cursor, {
          bossNumber: 1,
          firstKill: kills === 0,
          boss1KillNumber: kills + 1,
        }),
      );
    } else if (GUARDED_KINDS.has(kind)) {
      source = 'gardee';
      items = this.take(dropsForSource('gardee', ctx, cursor));
    } else if (ELITE_KINDS.has(kind)) {
      source = 'elite';
      items = this.take(dropsForSource('elite', ctx, cursor));
    } else {
      // Type d'ennemi absent de la table (nouvel ennemi d'un autre biome) : aucun drop.
      if (!(kind in KILL_DROP_CHANCE)) return;
      source = 'ennemi';
      items = this.take(dropsForKill(enemy.kind, ctx, cursor));
    }
    items.forEach((item, i) => {
      this.place(item, x, y, source, 0, i);
    });
  }

  /** Récompense de salle « Dotation » : deux objets côte à côte, on n'en prend qu'un. */
  public dropDotation(x: number, y: number): void {
    if (!this.enabled) return;
    const room = this.world.run.room;
    const announce =
      this.announces.get(room) ??
      announceDotation(this.world.run.seed, room, this.cursorRun.slotBag);
    const items = this.take(
      dotationOffer(this.dropContext(), { run: this.cursorRun, pity: this.pity }, announce),
    );
    const group = this.nextGroup++;
    const n = items.length;
    items.forEach((item, i) => {
      const dx = (i - (n - 1) / 2) * LOOT_PICKUP.DOTATION_SPREAD;
      this.spawn(item, x + dx, y, x, y - 12, 'dotation', group);
    });
    this.world.emit({
      type: 'notice',
      text: 'Dotation de la DPD : un objet au choix',
      tone: 'gold',
    });
  }

  /** Objet tiré par une autre source (caisse, casier, événement) posé au sol. */
  public dropFrom(source: DropSource, x: number, y: number): void {
    if (!this.enabled) return;
    const items = this.take(
      dropsForSource(source, this.dropContext(), { run: this.cursorRun, pity: this.pity }),
    );
    items.forEach((item, i) => {
      this.place(item, x, y, source, 0, i);
    });
  }

  /** Éjection en arc à 24–48 px, sur une tuile praticable hors voie (sinon près du héros). */
  private place(
    item: ItemInstance,
    x: number,
    y: number,
    source: DropSource,
    group: number,
    index: number,
  ): void {
    const seq = this.nextId;
    const span = LOOT_PICKUP.EJECT_MAX - LOOT_PICKUP.EJECT_MIN;
    for (let k = 0; k < 8; k += 1) {
      // Angle d'or : dispersion déterministe sans consommer l'aléatoire du monde.
      const a = (seq + index + k) * 2.399963 + k * 0.7;
      const d = LOOT_PICKUP.EJECT_MIN + (((seq * 37 + k * 11) % 17) / 16) * span;
      const tx = x + Math.cos(a) * d;
      const ty = y + Math.sin(a) * d;
      if (this.safe(tx, ty)) {
        this.spawn(item, tx, ty, x, y, source, group);
        return;
      }
    }
    const h = this.world.hero.body;
    this.spawn(item, this.safe(x, y) ? x : h.x, this.safe(x, y) ? y : h.y, x, y, source, group);
  }

  /** Tuile praticable, hors rail, loin des bords. */
  private safe(x: number, y: number): boolean {
    const arena = this.world.arena;
    if (x < TILE || y < TILE * 2 || x > arena.widthPx - TILE || y > arena.heightPx - TILE)
      return false;
    const k = arena.kindAt(x, y);
    return !isSolid(k) && k !== 'rail';
  }

  private spawn(
    item: ItemInstance,
    x: number,
    y: number,
    fromX: number,
    fromY: number,
    source: DropSource,
    group: number,
  ): GroundItem {
    const g: GroundItem = {
      id: this.nextId++,
      item,
      x,
      y,
      fromX,
      fromY,
      at: this.world.now(),
      group,
      source,
    };
    this.ground.push(g);
    this.found.push(item);
    this.world.emit({
      type: 'lootDropped',
      id: g.id,
      x,
      y,
      fromX,
      fromY,
      rarity: item.rarity,
      rank: RARITY_ORDER.indexOf(item.rarity),
      slot: slotOf(item) ?? 'outil',
      name: itemName(item),
      quiet: this.world.livingEnemies().length === 0,
    });
    return g;
  }

  // ─── Ramassage ─────────────────────────────────────────────────────────────

  /**
   * Un pas : objet le plus proche, Interagir (appui = équiper, maintien 400 ms = sac), Démonter
   * maintenu 500 ms, pouvoirs à minuterie. Renvoie vrai si l'appui Interagir a été consommé ici.
   */
  public update(intent: PlayerIntent): boolean {
    this.tickPowers();
    const world = this.world;
    const hero = world.hero;
    this.near = null;
    if (hero.isDead || world.director.frozen || this.ground.length === 0) {
      this.holdId = -1;
      this.scrapId = -1;
      return false;
    }
    this.canTake = world.livingEnemies().length === 0;
    const h = hero.body;
    let best: number = LOOT_PICKUP.RANGE;
    for (const g of this.ground) {
      const d = Math.hypot(g.x - h.x, g.y - h.y);
      if (d <= best) {
        best = d;
        this.near = g;
      }
    }
    const near = this.near;
    if (!near || !this.canTake) {
      this.holdId = -1;
      this.scrapId = -1;
      return false;
    }
    const now = world.now();
    let consumed = false;
    if (intent.interact) {
      this.holdId = near.id;
      this.holdSince = now;
      consumed = true;
    }
    if (this.holdId === near.id) {
      if (intent.interactHeld) {
        if (now - this.holdSince >= LOOT_PICKUP.BAG_HOLD_MS) {
          this.holdId = -1;
          this.act('bag');
        }
      } else {
        this.holdId = -1;
        this.act('equip');
      }
    } else this.holdId = -1;
    if (intent.scrapHeld && this.near) {
      if (this.scrapId !== this.near.id) {
        this.scrapId = this.near.id;
        this.scrapSince = now;
      } else if (now - this.scrapSince >= LOOT_PICKUP.SCRAP_HOLD_MS) {
        this.scrapId = -1;
        this.act('scrap');
      }
    } else this.scrapId = -1;
    return consumed;
  }

  /** Action sur l'objet proche (bouton tactile de la carte, clavier, manette). */
  public act(action: LootAction): boolean {
    const g = this.near;
    if (!g || !this.canTake) return false;
    const item = g.item;
    if (action === 'equip') {
      const res = equip(this.loadout, item);
      this.loadout = res.loadout;
      this.removeGround(g);
      if (res.dropped) {
        const h = this.world.hero.body;
        this.spawn(res.dropped, h.x, h.y + 10, h.x, h.y, res.dropped.origin.source, 0);
        this.world.emit({
          type: 'text',
          x: h.x,
          y: h.y,
          text: 'Sac plein : posé au sol',
          tone: 'info',
        });
      }
      this.applyGear();
    } else if (action === 'bag') {
      const next = stash(this.loadout, item);
      if (!next) {
        const h = this.world.hero.body;
        this.world.emit({ type: 'text', x: h.x, y: h.y, text: 'Sac plein', tone: 'danger' });
        return false;
      }
      this.loadout = next;
      this.removeGround(g);
      this.version += 1;
    } else {
      const value = scrapValue(item);
      this.ferraille += value;
      this.removeGround(g);
      this.world.emit({
        type: 'text',
        x: g.x,
        y: g.y,
        text: `+${String(value)} Ferraille`,
        tone: 'info',
      });
    }
    this.world.emit({
      type: 'lootTaken',
      action,
      x: g.x,
      y: g.y,
      rarity: item.rarity,
      slot: slotOf(item) ?? 'outil',
      name: itemName(item),
    });
    this.near = null;
    return true;
  }

  private removeGround(g: GroundItem): void {
    for (let i = this.ground.length - 1; i >= 0; i -= 1) {
      const o = this.ground[i];
      if (o && (o === g || (g.group > 0 && o.group === g.group))) this.ground.splice(i, 1);
    }
  }

  // ─── Inventaire (écran Tenue, hors combat) ─────────────────────────────────

  /** L'inventaire est éditable : aucun ennemi vivant, Shift en cours. */
  public get editable(): boolean {
    return this.world.livingEnemies().length === 0 && !this.world.director.frozen;
  }

  /** Équipe l'objet de la case `index` du sac (l'objet remplacé prend sa case). */
  public equipBag(index: number): boolean {
    const item = this.loadout.bag[index];
    if (!this.editable || !item) return false;
    this.loadout = equipFromBag(this.loadout, index);
    this.applyGear();
    const h = this.world.hero.body;
    this.world.emit({
      type: 'lootTaken',
      action: 'equip',
      x: h.x,
      y: h.y,
      rarity: item.rarity,
      slot: slotOf(item) ?? 'outil',
      name: itemName(item),
    });
    return true;
  }

  /** Démonte l'objet de la case `index` du sac (Ferraille à 100 %). */
  public scrapBag(index: number): number {
    if (!this.editable) return 0;
    const res = takeFromBag(this.loadout, index);
    if (!res.item) return 0;
    this.loadout = res.loadout;
    const value = scrapValue(res.item);
    this.ferraille += value;
    this.version += 1;
    const h = this.world.hero.body;
    this.world.emit({
      type: 'lootTaken',
      action: 'scrap',
      x: h.x,
      y: h.y,
      rarity: res.item.rarity,
      slot: slotOf(res.item) ?? 'outil',
      name: itemName(res.item),
    });
    return value;
  }

  // ─── Fin de Shift (écran « Consigne ») ─────────────────────────────────────

  /** Objets proposés à la consigne : équipés, sac et butin ramené, hors Paquetage. */
  public consignCandidates(): ItemInstance[] {
    const paquetage = new Set(this.meta.loot.paquetage);
    const owned = new Set(this.meta.loot.vestiaire.map((i) => i.uid));
    return [...loadoutItems(this.loadout), ...this.carried].filter(
      (i) => !paquetage.has(i.uid) && !owned.has(i.uid),
    );
  }

  /** Nombre d'objets ramenés au Vestiaire (1 à la mort, 2 en victoire, +1 par revendication). */
  public consignLimit(end: ShiftEnd): number {
    return consignLimit(this.meta, end);
  }

  /** Présélection : les objets de plus haute rareté (puis ilvl). */
  public defaultKeep(end: ShiftEnd): string[] {
    return [...this.consignCandidates()]
      .sort(
        (a, b) =>
          RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || b.ilvl - a.ilvl,
      )
      .slice(0, this.consignLimit(end))
      .map((i) => i.uid);
  }

  /** Fin de Shift du loot, à passer à `settleShift` (objets ramenés du sol compris). */
  public runEnd(end: ShiftEnd, keep: readonly string[]): RunEnd {
    return {
      outcome: end,
      loadout: { ...this.loadout, bag: [...this.loadout.bag, ...this.carried] },
      run: this.cursorRun,
      pity: this.pity,
      keep,
      ferrailleEarned: this.ferraille,
    };
  }

  // ─── Minuteries des pouvoirs ───────────────────────────────────────────────

  private later(ms: number, fn: () => void): void {
    this.delayed.push({ at: this.world.now() + ms, fn });
  }

  private tickPowers(): void {
    const now = this.world.now();
    if (this.delayed.length > 0) {
      const due = this.delayed.filter((d) => d.at <= now);
      if (due.length > 0) {
        this.delayed = this.delayed.filter((d) => d.at > now);
        for (const d of due) d.fn();
      }
    }
    const m = this.mods;
    // Boule à facettes : taches de lumière qui blessent les ennemis toutes les 0,5 s.
    if (this.spots.length > 0) {
      const every = powerParam(m, 'boule-a-facettes', 'spotTickMs', 500);
      const dmg = powerParam(m, 'boule-a-facettes', 'spotDamage', 6);
      for (const s of this.spots) {
        if (now < s.nextTick || now > s.until) continue;
        s.nextTick = now + every;
        this.radial(s.x, s.y, 20, dmg, 0);
      }
      this.spots = this.spots.filter((s) => s.until > now);
    }
    // Casque Cocotte-minute : soupape au-dessus de 90 de Burnout, toutes les 2 s.
    if (hasPower(m, 'cocotte-minute')) {
      const run = this.world.run;
      const from = powerParam(m, 'cocotte-minute', 'valveFrom', 90);
      if (run.burnout.value >= from && now >= this.valveAt && !this.world.hero.isDead) {
        this.valveAt = now + powerParam(m, 'cocotte-minute', 'valveEveryMs', 2000);
        const h = this.world.hero.body;
        const radius = powerParam(m, 'cocotte-minute', 'valveRadius', 48);
        const damage = powerParam(m, 'cocotte-minute', 'valveDamage', 15) * m.damage.baseMult;
        this.radial(h.x, h.y, radius, damage, powerParam(m, 'cocotte-minute', 'valveKnockback'));
        this.world.emit({ type: 'gearFx', kind: 'valve', x: h.x, y: h.y, angle: 0, size: radius });
      }
    }
  }

  private radial(x: number, y: number, radius: number, damage: number, knockbackPx: number): void {
    this.fxWeapon.begin();
    this.fxWeapon.sweep(
      { x, y: y - HERO.ATTACK_ORIGIN_Y / 2 },
      0,
      {
        shape: { kind: 'radial', radius },
        damage: Math.max(1, Math.round(damage)),
        knockbackPx,
        knockbackMs: knockbackPx > 0 ? 120 : 0,
        stunMs: 0,
        breaksProjectiles: false,
        finisher: false,
        combo: false,
      },
      { damageBonus: 0, critChance: 0, critMult: 1 },
    );
  }
}

/** Emplacement d'un objet (aide pour l'UI), « outil » par défaut. */
export function itemSlot(item: ItemInstance): SlotId {
  return ITEMS_BY_ID.get(item.defId)?.slot ?? 'outil';
}

/** Rang de rareté (0 = Réforme … 4 = Patrimoine). */
export function rarityRank(rarity: ItemRarity): number {
  return RARITY_ORDER.indexOf(rarity);
}
