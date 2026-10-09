import type { EnemyKind, RewardKind } from '@/config/balance';
import {
  BURNOUT,
  COFFEE,
  ENEMY_NAMES,
  ENVIRONMENT,
  FURET,
  REST,
  REWARDS,
  SCALING,
  SHOP,
} from '@/config/balance';
import { TILE } from '@/config/constants';
import type { OwnedAvantage } from '@/systems/meta/Avantages';
import { AVANTAGES_BY_ID, FAMILIES, offerAvantages, RARITIES } from '@/systems/meta/Avantages';
import type { ShiftEnd, ShiftResult } from '@/systems/meta/RunState';
import {
  earnPs,
  enterBiome,
  enterRoom,
  finishRun,
  heal,
  maxEnergy,
  refreshMods,
} from '@/systems/meta/RunState';
import type { DoorChoice, RoomType } from '@/systems/procedural/ShiftPlan';
import {
  BIOME_COUNT,
  BOSS_ROOM,
  biomeOf,
  biomeRoomCount,
  bossRoomOf,
  clockLabel,
  doorsFor,
  firstRoomOf,
  localRoom,
  REST_ROOM,
  roomIndex,
  roomRng,
  templateFor,
} from '@/systems/procedural/ShiftPlan';
import type { BiomeIndex, RoomTemplateId } from '@/systems/procedural/roomTemplates';
import type { Wave } from '@/systems/procedural/Waves';
import { budgetFor, wavesFor } from '@/systems/procedural/Waves';
import { randInt } from '@/utils/rng';
import type { BiomeDef } from '@/sim/biomes';
import { BIOMES } from '@/sim/biomes';
import type { EnemySim, PhasedEnemy } from '@/sim/enemies/EnemySim';
import type { TextTone } from '@/sim/events';
import type { PickupKind, PickupSim } from '@/sim/Pickups';
import { makePickup, PICKUP_RADIUS } from '@/sim/Pickups';
import { WaveDirector } from '@/sim/WaveDirector';
import type { World } from '@/sim/World';

/** Libellé des types de salle (bandeau, HUD, portes), comme la version Phaser. */
export const ROOM_TYPE_LABEL: Readonly<Record<RoomType, string>> = {
  combat: 'Quais & Voies',
  elite: 'Salle Élite',
  gardee: 'Salle gardée',
  tresor: 'Machine à café abandonnée',
  boutique: 'Friterie de Raymonde',
  repos: 'Salle des pauses',
  boss: "L'Auditeur des Quais",
};

/** Libellé d'un type de salle dans son biome (le combat et le boss changent de nom). */
export function roomTypeLabel(type: RoomType, room: number): string {
  const biome = BIOMES[biomeOf(room)];
  switch (type) {
    case 'combat':
      return biome.combatLabel;
    case 'boss':
      return biome.boss.name;
    case 'gardee':
      return biome.gardee?.label ?? ROOM_TYPE_LABEL.gardee;
    default:
      return ROOM_TYPE_LABEL[type];
  }
}

/** Fondu de sortie d'une salle (version Phaser : 220 ms) avant la reconstruction. */
export const DOOR_FADE_MS = 220;
/** Délai entre la mort du dernier boss et la fin du Shift (version Phaser : 2,6 s). */
const VICTORY_DELAY_MS = 2600;
/** Délai entre deux répliques de défaite d'un boss. */
const DEFEAT_LINE_GAP_MS = 1500;
const BOSS_SPAWN_DELAY_MS = 600;
const REWARD_DROP_DELAY_MS = 500;
/** Distance d'interaction (u) et d'affichage de l'invite de porte. */
const INTERACT_RANGE = 26;
const DOOR_PROMPT_RANGE = 40;

/** Porte de sortie d'une salle : emplacement du gabarit et choix proposé (ou murée). */
export interface DoorState {
  /** Bord gauche, haut de la rangée de la porte et largeur (u). */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly choice: DoorChoice | null;
}

export interface Interactable {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly label: string;
  /** Étal, machine à café, socle : la vue y pose son objet. */
  readonly prop: 'stand' | 'coffee' | 'locker' | 'machine';
  used: boolean;
  readonly action: () => void;
}

export interface ChoiceOption {
  readonly title: string;
  readonly desc: string;
  /** Couleur CSS du titre (rareté). */
  readonly color?: string;
  /** Famille d'Avantage (couleur du liseré), ou absent. */
  readonly accent?: number;
}

/** Fenêtre de choix (radio d'un collègue, machine à café, salle des pauses) : le jeu est en pause. */
export interface PendingChoice {
  readonly title: string;
  readonly options: readonly ChoiceOption[];
}

/** Invite contextuelle (« [E] Prendre sa pause », « Entrer »). */
export interface Prompt {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly door: boolean;
}

/** Ennemi de fin de biome ou de Salle gardée (barre de boss, musique). */
export type BossSim = EnemySim & PhasedEnemy;

// ─── Points d'extension (loot, statistiques) ─────────────────────────────────

export interface KillInfo {
  readonly kind: EnemyKind;
  readonly x: number;
  readonly y: number;
  readonly room: number;
  readonly roomType: RoomType;
  readonly biome: BiomeIndex;
  /** Élite, ennemi majeur ou boss. */
  readonly heavy: boolean;
}

export interface RoomInfo {
  readonly room: number;
  readonly roomType: RoomType;
  readonly biome: BiomeIndex;
  /** Récompense annoncée par la porte (ou `null`). */
  readonly reward: RewardKind | null;
  /** Point de la salle où la récompense est posée (u). */
  readonly x: number;
  readonly y: number;
}

export interface BossInfo {
  readonly kind: EnemyKind;
  readonly biome: BiomeIndex;
  /** Dernier boss du Shift (victoire). */
  readonly final: boolean;
  readonly x: number;
  readonly y: number;
}

/**
 * Crochets du Shift pour les systèmes greffés (loot : drops, butin d'élite et de boss, porte
 * « Dotation »). Tous facultatifs ; appelés après le traitement standard.
 */
export interface RunHooks {
  /** Un ennemi est mort (Mobilisation, Burnout, Tickets et Grains déjà comptés). */
  onEnemyKilled?(info: KillInfo): void;
  /** Salle nettoyée (combat, Élite, Salle gardée, boss). */
  onRoomCleared?(info: RoomInfo): void;
  /** Un boss est vaincu (avant la transition de biome ou la victoire). */
  onBossDefeated?(info: BossInfo): void;
  /**
   * Récompense de porte au moment de la poser : renvoyer `true` si le crochet la prend en charge
   * (le directeur ne pose alors rien).
   */
  onReward?(info: RoomInfo): boolean;
}

interface Timer {
  readonly at: number;
  readonly fn: () => void;
}

/**
 * Flux d'un Shift complet (port pur de `scenes/RunScene.ts`, étendu aux trois biomes du GDD § 3) :
 * construction de chaque salle depuis son gabarit, portes qui annoncent la récompense, vagues,
 * Salles gardées (Fluidifieur, Discosaure), récompenses, Avantages, Friterie, Salle des pauses, salle
 * café, boss de chaque biome (Auditeur des Quais, Elio Di Rupo, Gontran Vanderslide), transitions
 * de biome, mort et victoire. Environnement : rafales de vent sur la Passerelle, cloisons mobiles dans
 * le BAG. Tout passe par le temps de la simulation : même graine et mêmes intentions = même Shift. La
 * scène ne fait qu'afficher (fondus, fenêtres DOM) et répondre aux choix (`choose`).
 */
export class RunDirector {
  public readonly waves: WaveDirector;
  public door: DoorChoice = { room: 1, type: 'combat', reward: 'avantage' };
  public doors: DoorState[] = [];
  public cleared = false;
  public readonly interactables: Interactable[] = [];
  public choice: PendingChoice | null = null;
  public prompt: Prompt | null = null;
  /** Boss de fin de biome en cours. */
  public boss: BossSim | null = null;
  /** Ennemi majeur de la Salle gardée en cours. */
  public guardian: BossSim | null = null;
  public result: ShiftResult | null = null;
  /** Porte franchie, en attente de la fin du fondu. */
  public leaving: DoorChoice | null = null;
  /** Invincibilité (raccourci de test G). */
  public godMode = false;
  /** Crochets des systèmes greffés (loot) : `addHooks`. */
  public readonly hooks: RunHooks[] = [];
  /** Rafale de vent en cours (biome 2) : direction (−1 ou 1) ou 0 ; annonce à venir. */
  public wind = 0;
  public windWarn = 0;
  private resolver: ((index: number) => void) | null = null;
  private timers: Timer[] = [];
  private nextInteractId = 1;
  private escortsLeft: number[] = [];
  private nextGustAt = 0;
  private gustEndAt = 0;
  private nextPartitionAt = 0;

  public constructor(
    private readonly world: World,
    /** Vagues et flux du Shift actifs (faux dans les tests qui placent leurs ennemis à la main). */
    public enabled: boolean,
  ) {
    this.waves = new WaveDirector(world, () => {
      this.clearRoom(true);
    });
  }

  public addHooks(h: RunHooks): void {
    this.hooks.push(h);
  }

  public get ended(): boolean {
    return this.result !== null;
  }

  /** Sortie de salle ou fin du Shift : le héros ne reçoit plus de coups ni d'ordres. */
  public get frozen(): boolean {
    return this.leaving !== null || this.result !== null;
  }

  /** Biome de la salle en cours (0 Quais & Voies, 1 Passerelle, 2 Hall & BAG). */
  public get biome(): BiomeIndex {
    return biomeOf(this.door.room);
  }

  public get biomeDef(): BiomeDef {
    return BIOMES[this.biome];
  }

  /** Position dans le biome (HUD : « salle 3/8 »). */
  public get localRoom(): number {
    return localRoom(this.door.room);
  }

  public get biomeRooms(): number {
    return biomeRoomCount(this.door.room);
  }

  public get roomLabel(): string {
    return roomTypeLabel(this.door.type, this.door.room);
  }

  public get clock(): string {
    const run = this.world.run;
    return clockLabel(run.shift.startHour, run.minutes);
  }

  /** Lance le Shift : salle 1 (combat facile qui donne un Avantage), ou le gabarit imposé. */
  public start(template?: RoomTemplateId): void {
    this.buildRoom({ room: 1, type: 'combat', reward: 'avantage' }, template);
    this.startRoomContent();
  }

  // ─── Minuteries (temps de la simulation) ───────────────────────────────────

  private after(ms: number, fn: () => void): void {
    this.timers.push({ at: this.world.now() + ms, fn });
  }

  public update(): void {
    const now = this.world.now();
    if (this.timers.length > 0) {
      const due = this.timers.filter((t) => t.at <= now);
      if (due.length > 0) {
        this.timers = this.timers.filter((t) => t.at > now);
        for (const t of due) t.fn();
      }
    }
    if (this.godMode) this.world.run.energy = maxEnergy(this.world.run);
    if (!this.enabled || this.result) return;
    this.waves.update();
    this.updateEscorts();
    this.updateEnvironment();
    this.collectPickups();
    this.updatePrompts();
    const hero = this.world.hero;
    if (this.leaving === null && this.cleared && !hero.isDead) {
      const door = this.doorAt(hero.body.x, hero.body.y);
      if (door) this.goThrough(door);
    }
  }

  // ─── Salles ────────────────────────────────────────────────────────────────

  private buildRoom(door: DoorChoice, template?: RoomTemplateId): void {
    const run = this.world.run;
    const newBiome = biomeOf(door.room) !== biomeOf(this.door.room) || door.room === 1;
    if (newBiome && door.room > 1) enterBiome(run);
    this.door = door;
    enterRoom(run, door.room, door.type);
    this.world.loadRoom(template ?? templateFor(run.seed, door.room, door.type));
    this.cleared = false;
    this.boss = null;
    this.guardian = null;
    this.escortsLeft = [];
    this.interactables.length = 0;
    this.prompt = null;
    this.timers = [];
    this.wind = 0;
    this.windWarn = 0;
    this.waves.stop();
    this.doors = assignDoors(this.world.arena.layout.doors, this.exitsOf(door));
    this.world.emit({ type: 'roomEntered', room: door.room, roomType: door.type });
    if (newBiome) {
      const def = BIOMES[biomeOf(door.room)];
      this.world.emit({
        type: 'biomeEntered',
        biome: def.index,
        name: def.name,
        tagline: def.tagline,
      });
    }
  }

  /** Portes de sortie : salle suivante du biome, ou première salle du biome suivant après le boss. */
  private exitsOf(door: DoorChoice): DoorChoice[] {
    const run = this.world.run;
    if (door.type === 'boss') {
      const next = biomeOf(door.room) + 1;
      return next < BIOME_COUNT
        ? [{ room: firstRoomOf(next), type: 'combat', reward: 'avantage' }]
        : [];
    }
    return doorsFor(run.seed, door.room + 1, {
      shopSeen: run.shopSeen,
      elites: run.elites,
      tresorSeen: run.tresorSeen,
      previousType: door.type,
      gardeeSeen: run.gardeeSeen,
    });
  }

  private waveContext(elite: boolean): Parameters<typeof wavesFor>[0] {
    const run = this.world.run;
    const door = this.door;
    const shares = SCALING.SHARES_BY_BIOME[this.biome];
    const nightFuret = run.shift.id === 'nuit' ? FURET.ELITE_SHARE_NIGHT : FURET.ELITE_SHARE;
    // Biome 1 : le Furet putride remplace le Manager KPI dans 40 % des salles Élite (60 % la Nuit).
    const eliteKind: EnemyKind =
      this.biome === 0 && roomRng(run.seed, door.room, 5)() < nightFuret ? 'furet' : 'manager';
    return {
      r: roomIndex(door.room),
      elite,
      budgetMult: run.shift.budgetMult,
      extraDronesPerWave: run.shift.extraDronesPerWave,
      eliteKind,
      shares,
    };
  }

  private startRoomContent(): void {
    const door = this.door;
    const run = this.world.run;
    if (localRoom(door.room) === 1 && door.room > 1) this.notice(this.biomeDef.announce, 'gold');
    else this.notice(`${this.clock} · ${this.roomLabel}`, 'info');
    if (!this.enabled) return;
    this.nextGustAt = this.world.now() + 4000;
    this.nextPartitionAt = this.world.now() + 6000;
    switch (door.type) {
      case 'combat':
      case 'elite':
        this.waves.start(
          wavesFor(this.waveContext(door.type === 'elite'), roomRng(run.seed, door.room, 2)),
          roomRng(run.seed, door.room, 3),
        );
        break;
      case 'gardee':
        this.setupGardee();
        break;
      case 'boss':
        this.after(BOSS_SPAWN_DELAY_MS, () => {
          this.spawnBoss();
        });
        break;
      case 'tresor':
        this.setupTresor();
        break;
      case 'boutique':
        this.setupShop();
        this.clearRoom(false);
        break;
      case 'repos':
        this.setupRest();
        break;
    }
  }

  private spawnBoss(): void {
    const def = this.biomeDef.boss;
    const at = this.world.arena.bossSpawn;
    const boss = this.world.spawnEnemy(def.kind, at.x, at.y, true);
    this.boss = boss && isPhased(boss) ? boss : null;
    this.world.time.slowmo(0.3, 900, 300);
    this.world.emit({ type: 'shake', px: 4, ms: 300 });
    this.world.emit({
      type: 'bossIntro',
      kind: def.kind,
      name: def.name,
      title: def.title,
      line: def.intro.text,
      fictive: def.intro.fictive,
    });
    if (def.kind === 'auditeur')
      this.notice("L'AUDITEUR DES QUAIS — « Vous avez mis 4 minutes 12. Je le note. »", 'danger');
  }

  /** Salle gardée : l'ennemi majeur seul, puis de petites escortes à ses seuils de PV. */
  private setupGardee(): void {
    const g = this.biomeDef.gardee;
    if (!g) {
      this.clearRoom(false);
      return;
    }
    const run = this.world.run;
    this.waves.start([[g.kind]], roomRng(run.seed, this.door.room, 3), this.world.arena.bossSpawn);
    this.escortsLeft = [...SCALING.GARDEE_ESCORT_AT];
    this.world.emit({
      type: 'bossIntro',
      kind: g.kind,
      name: g.intro.speaker,
      title: g.label,
      line: g.intro.text,
      fictive: g.intro.fictive,
    });
  }

  private updateEscorts(): void {
    if (this.door.type !== 'gardee') return;
    if (!this.guardian) {
      const kind = this.biomeDef.gardee?.kind;
      const g = this.world.enemies.find((e) => e.kind === kind && !e.isDead);
      if (g && isPhased(g)) this.guardian = g;
      return;
    }
    const g = this.guardian;
    if (g.isDead) return;
    const next = this.escortsLeft[0];
    if (next === undefined || g.hp > g.maxHp * next) return;
    this.escortsLeft.shift();
    const ctx = this.waveContext(false);
    const budget = Math.max(2, Math.round((budgetFor(ctx) * SCALING.GARDEE_ESCORT_BUDGET) / 2));
    const escort: Wave = wavesFor(
      { ...ctx, r: Math.max(1, ctx.r) },
      roomRng(this.world.run.seed, this.door.room, 9),
    )
      .flat()
      .filter((k) => k !== 'manager' && k !== 'furet')
      .slice(0, Math.max(2, Math.round(budget / 1.5)));
    this.waves.addEscort(escort);
    this.notice('Renforts : l’escorte monte sur la piste', 'danger');
  }

  /** Salle nettoyée : ralenti, récompense, portes au vert. */
  public clearRoom(withFanfare: boolean): void {
    if (this.cleared) return;
    this.cleared = true;
    const run = this.world.run;
    const door = this.door;
    const arena = this.world.arena;
    const spawn = arena.layout.playerSpawn;
    const x = Math.min(arena.widthPx - 48, Math.max(48, arena.widthPx / 2));
    const y = Math.min(spawn.ty * TILE - 48, arena.heightPx / 2);
    const info: RoomInfo = {
      room: door.room,
      roomType: door.type,
      biome: this.biome,
      reward: door.reward,
      x,
      y,
    };
    if (withFanfare) {
      this.world.time.slowmo(0.25, 450, 250);
      this.world.emit({ type: 'shake', px: 3, ms: 150 });
      run.burnout.add(BURNOUT.PER_ROOM_CLEARED);
      let base: number = REWARDS.PS_PER_COMBAT_ROOM;
      if (door.type === 'elite') base = REWARDS.PS_ELITE_ROOM;
      if (door.type === 'gardee') {
        base = REWARDS.PS_GARDEE;
        this.world.hero.addBurnout(REWARDS.BURNOUT_GARDEE);
      }
      const ps = earnPs(run, base);
      this.notice(`Salle nettoyée · +${String(ps)} PS`, 'gold');
      const reward = door.reward;
      if (reward) {
        this.after(REWARD_DROP_DELAY_MS, () => {
          if (this.hooks.some((h) => h.onReward?.(info) === true)) return;
          this.dropReward(reward, x, y);
        });
      }
    }
    this.world.emit({ type: 'roomCleared', room: door.room });
    for (const h of this.hooks) h.onRoomCleared?.(info);
  }

  /** Porte ouverte sous le héros (il touche le rideau), ou `null`. */
  public doorAt(x: number, y: number): DoorChoice | null {
    if (!this.cleared) return null;
    for (const d of this.doors) {
      if (!d.choice) continue;
      if (x >= d.x && x <= d.x + d.width && y <= d.y + TILE + 10 && y >= d.y) return d.choice;
    }
    return null;
  }

  /** Franchit une porte : fondu (temps de sim), puis reconstruction de la salle. */
  public goThrough(door: DoorChoice): void {
    if (this.leaving !== null || this.result) return;
    this.leaving = door;
    this.prompt = null;
    this.world.emit({ type: 'doorTaken', room: door.room });
    this.after(DOOR_FADE_MS, () => {
      this.leaving = null;
      this.buildRoom(door);
      this.startRoomContent();
      if (door.type === 'boss')
        this.notice(
          this.biome === 1
            ? 'Écran doré : INAUGURATION IMMINENTE'
            : 'Écran rouge : SIGNATURE IMMINENTE',
          'danger',
        );
    });
  }

  // ─── Environnement (biomes 2 et 3) ─────────────────────────────────────────

  private updateEnvironment(): void {
    const type = this.door.type;
    if (this.cleared || !(type === 'combat' || type === 'elite' || type === 'gardee')) {
      this.wind = 0;
      this.windWarn = 0;
      return;
    }
    const now = this.world.now();
    if (this.biome === 1) {
      // Rafales : annoncées 1 s avant (feuilles « PROVISOIRE v14 »), 2 s de poussée latérale.
      if (
        this.wind === 0 &&
        this.windWarn === 0 &&
        now >= this.nextGustAt - ENVIRONMENT.WIND_WARN_MS
      ) {
        this.windWarn = this.world.rng() < 0.5 ? -1 : 1;
        this.world.emit({ type: 'fx', name: 'gustWarn', x: 0, y: 0, value: this.windWarn });
      }
      if (this.windWarn !== 0 && now >= this.nextGustAt) {
        this.wind = this.windWarn;
        this.windWarn = 0;
        this.gustEndAt = now + ENVIRONMENT.WIND_MS;
        this.world.emit({ type: 'fx', name: 'gust', x: 0, y: 0, value: this.wind });
      }
      if (this.wind !== 0) {
        this.world.pushHero((this.wind * ENVIRONMENT.WIND_PUSH) / 60, 0);
        if (now >= this.gustEndAt) {
          this.wind = 0;
          const [lo, hi] = ENVIRONMENT.WIND_PERIOD_MS;
          this.nextGustAt = now + randInt(this.world.rng, lo, hi);
        }
      }
    } else if (this.biome === 2 && type !== 'gardee' && now >= this.nextPartitionAt) {
      // Cloison mobile : une bande de deux tuiles balayée à travers la salle.
      this.nextPartitionAt = now + ENVIRONMENT.PARTITION_PERIOD_MS;
      const arena = this.world.arena;
      const h = this.world.hero.body;
      const rows = Math.floor(arena.heightPx / TILE);
      const ty = Math.max(2, Math.min(rows - 3, Math.floor(h.y / TILE) - 1));
      this.world.spawnHazard({
        kind: 'band',
        x0: TILE,
        x1: arena.widthPx - TILE,
        y: ty * TILE,
        height: TILE * 2,
        telegraphMs: ENVIRONMENT.PARTITION_TELEGRAPH_MS,
        damage: ENVIRONMENT.PARTITION_DAMAGE,
        owner: 'Une cloison mobile',
        speed: ENVIRONMENT.PARTITION_SPEED,
        skin: 'cloison',
      });
    }
  }

  // ─── Récompenses ───────────────────────────────────────────────────────────

  private dropReward(kind: PickupKind, x: number, y: number): void {
    const rng = this.world.rng;
    let amount = 1;
    if (kind === 'tickets')
      amount = randInt(rng, REWARDS.TICKETS_REWARD[0], REWARDS.TICKETS_REWARD[1]);
    if (kind === 'ps') amount = REWARDS.PS_REWARD;
    if (kind === 'grains') amount = REWARDS.GRAINS_REWARD;
    this.dropPickup(x, y, kind, amount, true);
    this.world.emit({ type: 'explosion', x, y, scale: 0.5 });
  }

  public dropPickup(x: number, y: number, kind: PickupKind, amount: number, label: boolean): void {
    this.world.pickups.push(makePickup(x, y, kind, amount, label));
  }

  private collectPickups(): void {
    const h = this.world.hero.body;
    if (this.world.hero.isDead) return;
    for (const p of this.world.pickups) {
      if (!p.collected && Math.hypot(p.x - h.x, p.y - h.y) < PICKUP_RADIUS) this.collect(p);
    }
    const list = this.world.pickups;
    for (let i = list.length - 1; i >= 0; i -= 1) if (list[i]?.collected) list.splice(i, 1);
  }

  private collect(p: PickupSim): void {
    if (p.collected) return;
    p.collected = true;
    const run = this.world.run;
    let text = '';
    switch (p.kind) {
      case 'avantage':
        this.offerAvantage();
        break;
      case 'gobelet':
        if (run.gobelets < COFFEE.MAX) {
          run.gobelets += 1;
          text = '+1 Gobelet';
        } else {
          heal(run, Math.round(maxEnergy(run) * REWARDS.COFFEE_OVERFLOW_HEAL));
          text = 'Stock plein : soin 25 %';
        }
        break;
      case 'tickets':
        run.tickets += p.amount;
        text = `+${String(p.amount)} Tickets`;
        break;
      case 'ps':
        text = `+${String(earnPs(run, p.amount))} PS`;
        break;
      case 'grains':
        run.grainsEarned += p.amount;
        text = `+${String(p.amount)} Grain${p.amount > 1 ? 's' : ''}`;
        break;
      case 'cornet':
        heal(run, Math.round(maxEnergy(run) * SHOP.CORNET_HEAL));
        text = 'Cornet de frites';
        break;
    }
    this.world.emit({ type: 'pickup', kind: p.kind, x: p.x, y: p.y, text });
  }

  // ─── Fenêtres de choix ─────────────────────────────────────────────────────

  private openChoice(
    title: string,
    options: readonly ChoiceOption[],
    resolve: (index: number) => void,
  ): void {
    this.choice = { title, options };
    this.resolver = resolve;
  }

  /** Réponse de l'UI à la fenêtre ouverte (index de l'option). */
  public choose(index: number): void {
    const resolve = this.resolver;
    if (!this.choice || !resolve) return;
    const count = this.choice.options.length;
    this.choice = null;
    this.resolver = null;
    resolve(Math.max(0, Math.min(count - 1, index)));
  }

  /** Radio d'un collègue : choisir 1 Avantage parmi 3 d'une même famille. */
  public offerAvantage(onDone?: () => void): void {
    const run = this.world.run;
    const rng = roomRng(run.seed, run.room, 7 + run.avantages.length);
    const offer = offerAvantages(rng, run.avantages, 3, run.loadout.rareShift + run.room);
    if (offer.options.length === 0) {
      run.tickets += 50;
      onDone?.();
      return;
    }
    this.openChoice(
      `${offer.family.colleague.toUpperCase()} À LA RADIO · ${offer.family.name}`,
      offer.options.map((o) => {
        const def = AVANTAGES_BY_ID.get(o.id);
        const rarity = RARITIES[o.rarity];
        const family = def ? FAMILIES[def.family] : offer.family;
        return {
          title: `${def?.name ?? o.id} (${rarity.label})`,
          desc: def?.describe(rarity.mult) ?? '',
          color: rarity.color,
          accent: family.color,
        };
      }),
      (index) => {
        const chosen = offer.options[index];
        if (chosen) this.grantAvantage(chosen);
        onDone?.();
      },
    );
  }

  private grantAvantage(a: OwnedAvantage): void {
    const run = this.world.run;
    const before = maxEnergy(run);
    run.avantages.push(a);
    refreshMods(run);
    const gained = maxEnergy(run) - before;
    if (gained > 0) heal(run, gained);
    const def = AVANTAGES_BY_ID.get(a.id);
    const family = def ? FAMILIES[def.family] : null;
    this.notice(
      `Avantage acquis : ${def?.name ?? a.id}${family ? ` (${family.colleague})` : ''}`,
      'gold',
    );
  }

  // ─── Salles calmes ─────────────────────────────────────────────────────────

  private addInteractable(
    x: number,
    y: number,
    label: string,
    prop: Interactable['prop'],
    action: () => void,
  ): Interactable {
    const it: Interactable = { id: this.nextInteractId++, x, y, label, prop, used: false, action };
    this.interactables.push(it);
    return it;
  }

  private setupTresor(): void {
    const at = this.world.arena.marks('reward')[0] ?? this.world.arena.playerSpawn;
    const locker = this.world.rng() < 0.4;
    this.addInteractable(
      at.x,
      at.y,
      locker ? 'Consigne à bagages' : 'Machine à café abandonnée',
      locker ? 'locker' : 'machine',
      () => {
        const run = this.world.run;
        if (locker) {
          run.grainsEarned += 3;
          run.tickets += 30;
          this.text(at.x, at.y, '+3 Grains · +30 Tickets', 'gold');
          this.clearRoom(false);
          return;
        }
        this.openChoice(
          'MACHINE À CAFÉ ABANDONNÉE',
          [
            { title: 'Un café serré', desc: 'Soin de 25 % de l’Énergie max.' },
            {
              title: 'Un gobelet à emporter',
              desc: '+1 Gobelet (soin de 25 % si le stock est plein).',
            },
          ],
          (i) => {
            if (i === 0) heal(run, Math.round(maxEnergy(run) * REWARDS.TRESOR_HEAL));
            else if (run.gobelets < COFFEE.MAX) run.gobelets += 1;
            else heal(run, Math.round(maxEnergy(run) * REWARDS.COFFEE_OVERFLOW_HEAL));
            this.clearRoom(false);
          },
        );
      },
    );
  }

  private setupShop(): void {
    const run = this.world.run;
    const items: { label: string; price: number; buy: () => void }[] = [
      {
        label: 'Gobelet',
        price: SHOP.GOBELET,
        buy: () => {
          if (run.gobelets < COFFEE.MAX) run.gobelets += 1;
          else heal(run, Math.round(maxEnergy(run) * REWARDS.COFFEE_OVERFLOW_HEAL));
        },
      },
      {
        label: 'Cornet de frites (soin 40 %)',
        price: SHOP.CORNET,
        buy: () => heal(run, Math.round(maxEnergy(run) * SHOP.CORNET_HEAL)),
      },
      {
        label: 'Avantage acquis',
        price: SHOP.AVANTAGE,
        buy: () => {
          this.offerAvantage();
        },
      },
    ];
    this.notice('Raymonde : « Une fricadelle ? Non ? Alors un café, chef. »', 'info');
    this.world.arena.marks('stand').forEach((at, i) => {
      const item = items[i];
      if (!item) return;
      const it = this.addInteractable(
        at.x,
        at.y,
        `${item.label} — ${String(item.price)} Tickets`,
        'stand',
        () => {
          if (run.tickets < item.price) {
            this.text(at.x, at.y, 'Pas assez de Tickets', 'danger');
            it.used = false;
            return;
          }
          run.tickets -= item.price;
          this.text(at.x, at.y, 'Merci chef !', 'gold');
          item.buy();
        },
      );
    });
  }

  private setupRest(): void {
    const at = this.world.arena.marks('coffee')[0] ?? this.world.arena.playerSpawn;
    this.notice(this.biomeDef.restNotice, 'info');
    this.addInteractable(at.x, at.y, 'Prendre sa pause', 'coffee', () => {
      const run = this.world.run;
      this.openChoice(
        'SALLE DES PAUSES',
        [
          { title: 'Pause réglementaire', desc: 'Soin de 40 % et −50 Burnout.' },
          { title: 'Formation continue', desc: 'Un Avantage acquis monte d’un cran de rareté.' },
        ],
        (i) => {
          if (i === 0) {
            heal(run, Math.round(maxEnergy(run) * REST.HEAL_FRACTION));
            run.burnout.add(REST.BURNOUT);
          } else {
            const idx = run.avantages.findIndex((a) => a.rarity !== 'statutaire');
            const a = run.avantages[idx];
            if (a) {
              run.avantages[idx] = {
                id: a.id,
                rarity: a.rarity === 'standard' ? 'anciennete' : 'statutaire',
              };
              refreshMods(run);
            } else heal(run, Math.round(maxEnergy(run) * REST.HEAL_FRACTION));
          }
          this.clearRoom(false);
        },
      );
    });
  }

  private updatePrompts(): void {
    const h = this.world.hero.body;
    const interact = this.world.consumeInteract();
    this.prompt = null;
    if (this.leaving !== null) return;
    for (const it of this.interactables) {
      if (it.used) continue;
      if (Math.hypot(it.x - h.x, it.y - h.y) > INTERACT_RANGE) continue;
      this.prompt = { x: it.x, y: it.y, label: it.label, door: false };
      if (interact) {
        it.used = true;
        it.action();
      }
      return;
    }
    if (!this.cleared) return;
    let best: DoorState | null = null;
    let bestD = DOOR_PROMPT_RANGE;
    for (const d of this.doors) {
      if (!d.choice) continue;
      const dist = Math.hypot(d.x + d.width / 2 - h.x, d.y + TILE - h.y);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    if (best?.choice)
      this.prompt = {
        x: best.x + best.width / 2,
        y: best.y + TILE,
        label: `Entrer · ${doorLabel(best.choice)}`,
        door: true,
      };
  }

  // ─── Combat ────────────────────────────────────────────────────────────────

  /** Un ennemi est mort (appelé par le monde après Mobilisation, Burnout, tickets). */
  public onEnemyKilled(kind: EnemyKind, x: number, y: number, heavy = false): void {
    this.waves.onKilled();
    const chance = heavy ? REWARDS.GRAIN_ELITE_CHANCE : REWARDS.GRAIN_KILL_CHANCE;
    if (this.enabled && this.world.rng() < chance) this.dropPickup(x, y, 'grains', 1, false);
    const info: KillInfo = {
      kind,
      x,
      y,
      room: this.door.room,
      roomType: this.door.type,
      biome: this.biome,
      heavy,
    };
    for (const h of this.hooks) h.onEnemyKilled?.(info);
    // Boss ou ennemi majeur vaincu : ses zones encore armées disparaissent (rien ne blesse après).
    if (heavy) {
      const owner = ENEMY_NAMES[kind];
      for (const z of this.world.hazards) if (z.spec.owner === owner) z.finish();
    }
    if (this.boss?.isDead && kind === this.boss.kind) this.onBossDefeated(this.boss);
  }

  private onBossDefeated(boss: BossSim): void {
    const run = this.world.run;
    const biome = this.biome;
    const def = this.biomeDef.boss;
    const final = this.door.room === bossRoomOf(BIOME_COUNT - 1) || biome === BIOME_COUNT - 1;
    run.bossesDefeated += 1;
    earnPs(run, def.ps);
    run.grainsEarned += def.grains;
    this.world.time.slowmo(0.2, 1500, 600);
    def.defeat.forEach((line, i) => {
      this.after(400 + i * DEFEAT_LINE_GAP_MS, () => {
        this.world.emit({ type: 'bossLine', ...line });
      });
    });
    if (def.kind === 'auditeur') this.notice('« … Le train de 7h12, il existe encore ? »', 'gold');
    for (const h of this.hooks)
      h.onBossDefeated?.({ kind: def.kind, biome, final, x: boss.body.x, y: boss.body.y });
    this.boss = null;
    if (final || !this.enabled) {
      this.after(VICTORY_DELAY_MS + def.defeat.length * 400, () => {
        this.endShift('victoire');
      });
      return;
    }
    // Le biome suivant s'ouvre : la porte du fond mène plus haut dans la gare.
    const next = BIOMES[(biome + 1) as BiomeIndex];
    this.after(VICTORY_DELAY_MS, () => {
      this.clearRoom(false);
      this.notice(`Porte ouverte · ${next.name}`, 'gold');
    });
  }

  public onHeroDied(): void {
    this.endShift('mort');
  }

  public endShift(end: ShiftEnd): void {
    if (this.result) return;
    this.result = finishRun(this.world.run, end);
    this.choice = null;
    this.resolver = null;
    this.world.emit({ type: 'shiftEnded', end });
  }

  // ─── Raccourcis de test (?cheat) ───────────────────────────────────────────

  /** K : élimine tous les ennemis. */
  public cheatKillAll(): number {
    const living = this.world.livingEnemies().filter((e) => e.isHittable() || e.hidden);
    for (const e of living) e.debugKill();
    return living.length;
  }

  /** N : salle suivante (ou un Avantage si la salle n'est pas nettoyée). */
  public cheatNext(): void {
    if (!this.cleared) {
      this.offerAvantage();
      return;
    }
    const door = this.doors.find((d) => d.choice)?.choice;
    if (door) this.goThrough(door);
  }

  /** B : salle du boss du biome en cours. */
  public cheatBoss(): void {
    const room = bossRoomOf(this.biome);
    this.goThrough({ room, type: 'boss', reward: null });
  }

  /** Salle gardée du biome en cours (outil de capture). */
  public cheatGardee(): void {
    const n = biomeRoomCount(this.door.room);
    this.goThrough({ room: firstRoomOf(this.biome) + n - 1, type: 'gardee', reward: null });
  }

  /** Première salle d'un biome (outil de capture). */
  public cheatBiome(biome: number): void {
    const b = Math.max(0, Math.min(BIOME_COUNT - 1, biome));
    this.goThrough({ room: firstRoomOf(b), type: 'combat', reward: 'avantage' });
  }

  // ─── Utilitaires ───────────────────────────────────────────────────────────

  private notice(text: string, tone: TextTone): void {
    this.world.emit({ type: 'notice', text, tone });
  }

  private text(x: number, y: number, text: string, tone: TextTone): void {
    this.world.emit({ type: 'text', x, y, text, tone });
  }
}

function isPhased(e: EnemySim): e is BossSim {
  return 'phase' in e && typeof (e as { phase?: unknown }).phase === 'number';
}

/** Texte d'une porte : type de salle et récompense annoncée. */
export function doorLabel(choice: DoorChoice): string {
  const reward = choice.reward ? ` · ${REWARD_LABEL[choice.reward]}` : '';
  return `${roomTypeLabel(choice.type, choice.room)}${reward}`;
}

const REWARD_LABEL: Readonly<Record<NonNullable<DoorChoice['reward']>, string>> = {
  avantage: 'Avantage',
  gobelet: 'Gobelet',
  tickets: 'Tickets',
  ps: 'PS',
  grains: 'Grains',
};

/**
 * Affecte les portes proposées aux emplacements du gabarit (port de `Room.setDoors`) : une porte au
 * centre, deux aux extrémités, sinon dans l'ordre. Les autres emplacements restent murés.
 */
export function assignDoors(
  slots: readonly { readonly tx: number; readonly ty: number; readonly width: number }[],
  choices: readonly DoorChoice[],
): DoorState[] {
  const used: number[] =
    choices.length === 1
      ? [Math.floor((slots.length - 1) / 2)]
      : choices.length === 2 && slots.length >= 3
        ? [0, slots.length - 1]
        : choices.map((_, i) => i);
  return slots.map((s, slotIndex) => {
    const i = used.indexOf(slotIndex);
    return {
      x: s.tx * TILE,
      y: s.ty * TILE,
      width: s.width * TILE,
      choice: i >= 0 ? (choices[i] ?? null) : null,
    };
  });
}

/** Salle des pauses et boss du biome 1 : indices de salle particuliers (utiles aux tests et à l'UI). */
export const SPECIAL_ROOMS = {
  REST_ROOM,
  BOSS_ROOM,
  LAST_COMBAT: REST_ROOM - 1,
} as const;
