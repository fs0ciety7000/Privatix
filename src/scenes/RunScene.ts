import Phaser from 'phaser';
import type { EnemyKind, ShiftId } from '@/config/balance';
import {
  BURNOUT,
  COFFEE,
  ENEMY_RULES,
  MOBILISATION,
  REST,
  REWARDS,
  SCALING,
  SHIFT,
  SHOP,
} from '@/config/balance';
import { Css, Depth, FONT, RegistryKeys, SceneKeys, TILE } from '@/config/constants';
import { metaSave } from '@/platform/save';
import { AttackTokens } from '@/systems/combat/AttackTokens';
import { enemyScale } from '@/systems/combat/damage';
import type { OwnedAvantage } from '@/systems/meta/Avantages';
import { AVANTAGES_BY_ID, FAMILIES, offerAvantages, RARITIES } from '@/systems/meta/Avantages';
import type { RunState } from '@/systems/meta/RunState';
import {
  applyResult,
  createRun,
  earnPs,
  enterRoom,
  finishRun,
  heal,
  maxEnergy,
  refreshMods,
} from '@/systems/meta/RunState';
import type { HudSnapshot } from '@/systems/meta/session';
import { getMeta, pushNotice, setMeta } from '@/systems/meta/session';
import { parseRoom, spawnableTiles } from '@/systems/procedural/RoomLayout';
import type { DoorChoice } from '@/systems/procedural/ShiftPlan';
import {
  BOSS_ROOM,
  clockLabel,
  doorsFor,
  REST_ROOM,
  roomIndex,
  roomRng,
  templateFor,
} from '@/systems/procedural/ShiftPlan';
import type { Wave } from '@/systems/procedural/Waves';
import { shouldSendNextWave, wavesFor } from '@/systems/procedural/Waves';
import type { Rng } from '@/utils/rng';
import { createRng, randInt } from '@/utils/rng';
import type { CombatWorld, HitSource } from '@/entities/CombatWorld';
import type { Enemy } from '@/entities/Enemy';
import { Auditeur } from '@/entities/enemies/Auditeur';
import { BorneAutomatique } from '@/entities/enemies/BorneAutomatique';
import { ConsultantJunior } from '@/entities/enemies/ConsultantJunior';
import { DroneOptimetre } from '@/entities/enemies/DroneOptimetre';
import { ManagerKpi } from '@/entities/enemies/ManagerKpi';
import type { HazardSpec } from '@/entities/Hazard';
import { Hazard } from '@/entities/Hazard';
import type { PickupKind } from '@/entities/Pickup';
import { Pickup } from '@/entities/Pickup';
import { NO_INTENT, Player } from '@/entities/Player';
import type { ProjectileSpec } from '@/entities/Projectile';
import { Projectile } from '@/entities/Projectile';
import { Room } from '@/entities/Room';
import { Atmosphere } from '@/fx/Atmosphere';
import { GameFeel } from '@/fx/GameFeel';
import { Controls } from '@/ui/Controls';
import type { UIScene } from '@/scenes/UIScene';

/** Éclairs lumineux associés aux VFX. */
const VFX_LIGHT: Readonly<
  Record<string, { color: number; radius: number; intensity: number; ms: number }>
> = {
  'vfx-hit': { color: 0xffd9a0, radius: 60, intensity: 1.4, ms: 120 },
  'vfx-slam': { color: 0xffb347, radius: 110, intensity: 2, ms: 220 },
  'vfx-explosion': { color: 0xff8a3a, radius: 140, intensity: 2.4, ms: 380 },
  'vfx-shockwave': { color: 0xffe08a, radius: 120, intensity: 2, ms: 320 },
  'vfx-spawn-privatix': { color: 0x19c3b1, radius: 70, intensity: 1.6, ms: 400 },
  'vfx-poof': { color: 0x19c3b1, radius: 50, intensity: 1, ms: 250 },
  'vfx-slash-e': { color: 0xffe2a8, radius: 50, intensity: 0.8, ms: 90 },
};

export interface RunSceneData {
  readonly shift: ShiftId;
  readonly seed: number;
}

interface Interactable {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly action: () => void;
  used: boolean;
}

const ROOM_TYPE_LABEL: Readonly<Record<string, string>> = {
  combat: 'Quais & Voies',
  elite: 'Salle Élite',
  tresor: 'Machine à café abandonnée',
  boutique: 'Friterie de Raymonde',
  repos: 'Salle des pauses',
  boss: "L'Auditeur des Quais",
};

/**
 * Un Shift complet : une seule scène qui reconstruit chaque salle derrière un fondu (docs/ARCHITECTURE.md).
 * Implémente `CombatWorld` pour les entités ; publie un instantané du HUD dans le registry.
 */
export class RunScene extends Phaser.Scene implements CombatWorld {
  public feel!: GameFeel;
  private atmo!: Atmosphere;
  public rng!: Rng;
  public run!: RunState;
  public player!: Player;
  public tokens!: AttackTokens;
  public room!: Room;
  private controls!: Controls;
  private readonly enemies: Enemy[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly hazards: Hazard[] = [];
  private readonly pickups: Pickup[] = [];
  private readonly interactables: Interactable[] = [];
  private gameTime = 0;
  private waves: Wave[] = [];
  private waveIndex = 0;
  private waveSize = 0;
  private killedInWave = 0;
  private pendingSpawns = 0;
  private firstWaveAt = 0;
  private cleared = false;
  private transitioning = false;
  private modal = false;
  private afterModal = false;
  private ended = false;
  private currentDoor: DoorChoice = { room: 1, type: 'combat', reward: 'avantage' };
  private boss: Auditeur | null = null;
  private prompt!: Phaser.GameObjects.Text;
  private shiftId: ShiftId = 'matin';

  public constructor() {
    super(SceneKeys.Run);
  }

  public init(data: RunSceneData): void {
    this.shiftId = data.shift;
    this.run = createRun(getMeta(this.registry), data.shift, data.seed);
    this.rng = createRng(data.seed ^ 0x9e3779b9);
    this.gameTime = 0;
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.hazards.length = 0;
    this.pickups.length = 0;
    this.interactables.length = 0;
    this.modal = false;
    this.ended = false;
    this.roomColliders.length = 0;
    this.roomObjects.length = 0;
    this.transitioning = false;
    this.boss = null;
  }

  public create(): void {
    this.tokens = new AttackTokens({
      melee: ENEMY_RULES.MAX_MELEE_TOKENS,
      ranged: ENEMY_RULES.MAX_RANGED_TOKENS,
    });
    this.feel = new GameFeel(this);
    this.controls = new Controls(this);
    this.prompt = this.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '8px',
        color: Css.quaiYellow,
        stroke: Css.outline,
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setResolution(2)
      .setDepth(Depth.Text)
      .setVisible(false);

    // Physique : héros et ennemis contre le décor ; jamais de collision héros ↔ ennemis (overlap logique).
    this.buildRoom({ room: 1, type: 'combat', reward: 'avantage' });
    this.player = new Player(this, this.room.playerSpawn.x, this.room.playerSpawn.y);
    this.atmo = new Atmosphere(this, 'quais');
    this.atmo.lightRoom(this.room);
    this.atmo.lit(this.player);
    this.atmo.attachHero(this.player);
    this.player.onDeath = () => {
      this.endShift('mort');
    };
    this.attachRoomColliders();
    this.setupCamera();
    this.player.play('player-spawn');

    this.scene.launch(SceneKeys.UI, { mode: 'run' });
    this.scene.bringToTop(SceneKeys.UI);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.feel.destroy();
      this.atmo.destroy();
      this.registry.set(RegistryKeys.Hud, null);
    });
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.startRoomContent();
  }

  // ─── CombatWorld ───────────────────────────────────────────────────────────

  public get stage(): Phaser.Scene {
    return this;
  }

  public now(): number {
    return this.gameTime;
  }

  public livingEnemies(): readonly Enemy[] {
    return this.enemies.filter((e) => e.active && !e.isDead);
  }

  public activeProjectiles(): readonly Projectile[] {
    return this.projectiles.filter((p) => p.active);
  }

  public damagePlayer(amount: number, source: HitSource): boolean {
    if (this.transitioning || this.ended) return false;
    return this.player.receiveHit(amount, source);
  }

  public onEnemyDamaged(enemy: Enemy, amount: number, crit: boolean): void {
    this.run.mobilisation.onDamageDealt(amount);
    this.feel.damageNumber(enemy.x, enemy.y - enemy.height * 0.6, amount, { crit });
    this.feel.sparksAt(enemy.x, enemy.y - 18, crit ? 8 : 4);
    this.vfx('vfx-hit', enemy.x, enemy.y - 18, { scale: crit ? 1.5 : 1 });
  }

  public onEnemyKilled(enemy: Enemy): void {
    const run = this.run;
    const elite = enemy.kind === 'manager';
    run.kills += 1;
    this.killedInWave += 1;
    run.mobilisation.add(MOBILISATION.PER_KILL + (elite ? MOBILISATION.ELITE_KILL_BONUS : 0));
    run.burnout.add(elite ? BURNOUT.PER_ELITE_KILL : BURNOUT.PER_KILL);
    if (run.mods.killHeal > 0) heal(run, run.mods.killHeal);
    const tickets = Math.round(enemy.stats.tickets * (this.shiftId === 'apres-midi' ? 1.2 : 1));
    run.tickets += tickets;
    if (enemy.kind !== 'auditeur')
      this.feel.floatText(enemy.x, enemy.y - 40, `+${String(tickets)} tickets`, Css.danger, 700);
    const grainChance = elite ? REWARDS.GRAIN_ELITE_CHANCE : REWARDS.GRAIN_KILL_CHANCE;
    if (this.rng() < grainChance) this.dropPickup(enemy.x, enemy.y, 'grains', 1, false);
    this.feel.shake(2, 100);
    if (enemy === this.boss) this.onBossDefeated();
  }

  public spawnEnemy(kind: EnemyKind, x: number, y: number, immediate = false): Enemy | null {
    if (this.livingEnemies().length >= ENEMY_RULES.MAX_ALIVE) return null;
    const scale = enemyScale(roomIndex(this.run.room), this.run.shift, SCALING);
    let enemy: Enemy;
    switch (kind) {
      case 'borne':
        enemy = new BorneAutomatique(this, x, y, scale);
        break;
      case 'drone':
        enemy = new DroneOptimetre(this, x, y, scale);
        break;
      case 'manager':
        enemy = new ManagerKpi(this, x, y, scale);
        break;
      case 'auditeur':
        enemy = new Auditeur(this, x, y, scale);
        break;
      default:
        enemy = new ConsultantJunior(this, x, y, scale);
    }
    enemy.start(immediate);
    this.atmo.lit(enemy);
    this.enemies.push(enemy);
    return enemy;
  }

  public spawnProjectile(spec: ProjectileSpec): void {
    let p = this.projectiles.find((q) => !q.active);
    if (!p) {
      p = new Projectile(this);
      this.add.existing(p);
      this.physics.add.existing(p);
      this.projectiles.push(p);
    }
    p.fire(spec);
  }

  public spawnHazard(spec: HazardSpec): Hazard {
    const h = new Hazard(this, spec);
    this.hazards.push(h);
    return h;
  }

  public vfx(
    animKey: string,
    x: number,
    y: number,
    opts: {
      rotation?: number;
      flipX?: boolean;
      flipY?: boolean;
      scale?: number;
      depth?: number;
    } = {},
  ): void {
    if (!this.anims.exists(animKey)) return;
    const s = this.add
      .sprite(x, y, '__DEFAULT')
      .setRotation(opts.rotation ?? 0)
      .setFlip(opts.flipX ?? false, opts.flipY ?? false)
      .setScale(opts.scale ?? 1)
      .setDepth(opts.depth ?? Depth.Vfx);
    s.play(animKey);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      s.destroy();
    });
    // Les effets lumineux éclairent le décor autour d'eux (Dead Cells).
    const glow = VFX_LIGHT[animKey];
    if (glow)
      this.atmo.flash(x, y, glow.color, glow.radius * (opts.scale ?? 1), glow.intensity, glow.ms);
  }

  // ─── Salles ────────────────────────────────────────────────────────────────

  private buildRoom(door: DoorChoice): void {
    this.currentDoor = door;
    enterRoom(this.run, door.room, door.type);
    const layout = parseRoom(templateFor(this.run.seed, door.room, door.type));
    this.room = new Room(this, layout);
    this.cleared = false;
    this.waves = [];
    this.waveIndex = 0;
    this.killedInWave = 0;
    this.waveSize = 0;
    this.pendingSpawns = 0;
    this.tokens.clear();
    const next = door.room + 1;
    const choices =
      door.type === 'boss'
        ? []
        : doorsFor(this.run.seed, next, {
            shopSeen: this.run.shopSeen,
            elites: this.run.elites,
            tresorSeen: this.run.tresorSeen,
            previousType: door.type,
          });
    this.room.setDoors(choices);
  }

  private readonly roomColliders: Phaser.Physics.Arcade.Collider[] = [];

  private attachRoomColliders(): void {
    for (const c of this.roomColliders) c.destroy();
    this.roomColliders.length = 0;
    this.roomColliders.push(
      this.physics.add.collider(this.player, this.room.layer),
      this.physics.add.collider(this.enemies, this.room.layer),
      this.physics.add.collider(this.projectiles, this.room.layer, (obj) => {
        if (obj instanceof Projectile) {
          this.feel.sparksAt(obj.x, obj.y, 2);
          obj.kill();
        }
      }),
    );
  }

  private setupCamera(): void {
    this.room.fitCamera(this.cameras.main, this.player);
  }

  private startRoomContent(): void {
    const run = this.run;
    const door = this.currentDoor;
    const title = ROOM_TYPE_LABEL[door.type] ?? 'Quais & Voies';
    pushNotice(this.registry, `${clockLabel(run.shift.startHour, run.minutes)} · ${title}`);
    switch (door.type) {
      case 'combat':
      case 'elite': {
        const extraDrones = run.shift.extraDronesPerWave;
        this.waves = wavesFor(
          {
            r: roomIndex(door.room),
            elite: door.type === 'elite',
            budgetMult: run.shift.budgetMult,
            extraDronesPerWave: extraDrones,
          },
          roomRng(run.seed, door.room, 2),
        );
        this.time.delayedCall(700, () => {
          this.sendWave();
        });
        break;
      }
      case 'boss': {
        const at = this.room.bossSpawn;
        this.time.delayedCall(600, () => {
          const boss = this.spawnEnemy('auditeur', at.x, at.y, true);
          this.boss = boss instanceof Auditeur ? boss : null;
          this.feel.slowmo(0.3, 900, 300);
          this.feel.shake(4, 300);
          pushNotice(
            this.registry,
            "L'AUDITEUR DES QUAIS — « Vous avez mis 4 minutes 12. Je le note. »",
            Css.danger,
          );
        });
        break;
      }
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

  private sendWave(): void {
    const wave = this.waves[this.waveIndex];
    if (!wave) return;
    this.waveIndex += 1;
    this.waveSize = wave.length;
    this.killedInWave = 0;
    const spawnTile = {
      tx: Math.floor(this.player.x / TILE),
      ty: Math.floor(this.player.y / TILE),
    };
    const tiles = spawnableTiles(this.room.layout, spawnTile, ENEMY_RULES.SPAWN_MIN_DIST_PX / TILE);
    wave.forEach((kind, i) => {
      this.pendingSpawns += 1;
      this.time.delayedCall(i * ENEMY_RULES.SPAWN_STAGGER_MS, () => {
        this.pendingSpawns -= 1;
        if (this.ended) return;
        const tile = tiles[Math.floor(this.rng() * tiles.length)] ?? spawnTile;
        this.spawnEnemy(kind, tile.tx * TILE + TILE / 2, tile.ty * TILE + TILE / 2);
      });
    });
  }

  private updateWaves(): void {
    if (this.cleared || this.currentDoor.type === 'boss') return;
    if (this.currentDoor.type !== 'combat' && this.currentDoor.type !== 'elite') return;
    if (this.pendingSpawns > 0 || this.gameTime < this.firstWaveAt) return;
    const alive = this.livingEnemies().length;
    if (this.waveIndex < this.waves.length) {
      if (shouldSendNextWave(alive, this.waveSize, this.killedInWave)) this.sendWave();
      return;
    }
    if (alive === 0 && this.waves.length > 0) this.clearRoom(true);
  }

  /** Salle nettoyée : ralenti, carillon, récompense, portes au vert. */
  private clearRoom(withFanfare: boolean): void {
    if (this.cleared) return;
    this.cleared = true;
    const run = this.run;
    const door = this.currentDoor;
    if (withFanfare) {
      this.feel.slowmo(0.25, 450, 250);
      this.feel.shake(3, 150);
      run.burnout.add(BURNOUT.PER_ROOM_CLEARED);
      const ps = earnPs(
        run,
        door.type === 'elite' ? REWARDS.PS_ELITE_ROOM : REWARDS.PS_PER_COMBAT_ROOM,
      );
      pushNotice(this.registry, `Salle nettoyée · +${String(ps)} PS`, Css.quaiYellow);
      if (door.reward) {
        const c = this.room.layout.playerSpawn;
        const x = Math.min(this.room.widthPx - 48, Math.max(48, this.room.widthPx / 2));
        const y = Math.min(c.ty * TILE - 48, this.room.heightPx / 2);
        this.time.delayedCall(500, () => {
          this.dropReward(door.reward ?? 'tickets', x, y);
        });
      }
    }
    this.room.openDoors();
  }

  private dropReward(kind: PickupKind, x: number, y: number): void {
    let amount = 1;
    if (kind === 'tickets')
      amount = randInt(this.rng, REWARDS.TICKETS_REWARD[0], REWARDS.TICKETS_REWARD[1]);
    if (kind === 'ps') amount = REWARDS.PS_REWARD;
    if (kind === 'grains') amount = REWARDS.GRAINS_REWARD;
    this.dropPickup(x, y, kind, amount, true);
    this.vfx('vfx-explosion', x, y - 6, { scale: 0.5 });
  }

  private dropPickup(x: number, y: number, kind: PickupKind, amount: number, label: boolean): void {
    this.pickups.push(new Pickup(this, x, y, kind, amount, label));
  }

  private collect(p: Pickup): void {
    if (p.collected) return;
    p.collected = true;
    const run = this.run;
    const feel = this.feel;
    switch (p.kind) {
      case 'avantage':
        this.offerAvantage();
        break;
      case 'gobelet':
        if (run.gobelets < COFFEE.MAX) {
          run.gobelets += 1;
          feel.floatText(p.x, p.y - 40, '+1 Gobelet', Css.quaiYellow);
        } else {
          heal(run, Math.round(maxEnergy(run) * REWARDS.COFFEE_OVERFLOW_HEAL));
          feel.floatText(p.x, p.y - 40, 'Stock plein : soin 25 %', Css.quaiYellow);
        }
        break;
      case 'tickets':
        run.tickets += p.amount;
        feel.floatText(p.x, p.y - 40, `+${String(p.amount)} Tickets`, Css.danger);
        break;
      case 'ps': {
        const ps = earnPs(run, p.amount);
        feel.floatText(p.x, p.y - 40, `+${String(ps)} PS`, Css.hero);
        break;
      }
      case 'grains':
        run.grainsEarned += p.amount;
        feel.floatText(
          p.x,
          p.y - 40,
          `+${String(p.amount)} Grain${p.amount > 1 ? 's' : ''}`,
          Css.quaiYellow,
        );
        break;
      case 'cornet':
        heal(run, Math.round(maxEnergy(run) * SHOP.CORNET_HEAL));
        break;
    }
    feel.sparksAt(p.x, p.y, 6);
    p.destroy();
  }

  private get ui(): UIScene {
    return this.scene.get(SceneKeys.UI) as UIScene;
  }

  private setModal(on: boolean): void {
    this.modal = on;
    if (on) {
      this.physics.world.pause();
      this.anims.pauseAll();
    } else {
      this.physics.world.resume();
      this.anims.resumeAll();
    }
  }

  /** Radio d'un collègue : choisir 1 Avantage parmi 3 d'une même famille. */
  private offerAvantage(onDone?: () => void): void {
    const run = this.run;
    const rng = roomRng(run.seed, run.room, 7 + run.avantages.length);
    const offer = offerAvantages(rng, run.avantages, 3, run.loadout.rareShift + run.room);
    if (offer.options.length === 0) {
      run.tickets += 50;
      onDone?.();
      return;
    }
    this.setModal(true);
    this.ui.openChoice(
      `${offer.family.colleague.toUpperCase()} À LA RADIO · ${offer.family.name}`,
      offer.options.map((o) => {
        const def = AVANTAGES_BY_ID.get(o.id);
        const rarity = RARITIES[o.rarity];
        return {
          title: `${def?.name ?? o.id} (${rarity.label})`,
          desc: def?.describe(rarity.mult) ?? '',
          color: rarity.color,
        };
      }),
      (index) => {
        const chosen = offer.options[index];
        if (chosen) this.grantAvantage(chosen);
        this.setModal(false);
        onDone?.();
      },
    );
  }

  private grantAvantage(a: OwnedAvantage): void {
    const run = this.run;
    const before = maxEnergy(run);
    run.avantages.push(a);
    refreshMods(run);
    const gained = maxEnergy(run) - before;
    if (gained > 0) heal(run, gained);
    const def = AVANTAGES_BY_ID.get(a.id);
    const family = def ? FAMILIES[def.family] : null;
    pushNotice(
      this.registry,
      `Avantage acquis : ${def?.name ?? a.id}${family ? ` (${family.colleague})` : ''}`,
      Css.quaiYellow,
    );
  }

  private setupTresor(): void {
    const at = this.room.markPositions('reward')[0] ?? this.room.playerSpawn;
    const locker = this.rng() < 0.4;
    this.addInteractable(
      at.x,
      at.y,
      locker ? 'Consigne à bagages' : 'Machine à café abandonnée',
      () => {
        const run = this.run;
        if (locker) {
          run.grainsEarned += 3;
          run.tickets += 30;
          this.feel.floatText(at.x, at.y - 40, '+3 Grains · +30 Tickets', Css.quaiYellow, 1200);
          this.clearRoom(false);
          return;
        }
        this.setModal(true);
        this.ui.openChoice(
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
            this.setModal(false);
            this.clearRoom(false);
          },
        );
      },
    );
  }

  private setupShop(): void {
    const stands = this.room.markPositions('stand');
    const items: { label: string; price: number; buy: () => void }[] = [
      {
        label: 'Gobelet',
        price: SHOP.GOBELET,
        buy: () => {
          if (this.run.gobelets < COFFEE.MAX) this.run.gobelets += 1;
          else heal(this.run, Math.round(maxEnergy(this.run) * REWARDS.COFFEE_OVERFLOW_HEAL));
        },
      },
      {
        label: 'Cornet de frites (soin 40 %)',
        price: SHOP.CORNET,
        buy: () => heal(this.run, Math.round(maxEnergy(this.run) * SHOP.CORNET_HEAL)),
      },
      {
        label: 'Avantage acquis',
        price: SHOP.AVANTAGE,
        buy: () => {
          this.offerAvantage();
        },
      },
    ];
    pushNotice(this.registry, 'Raymonde : « Une fricadelle ? Non ? Alors un café, chef. »');
    stands.forEach((at, i) => {
      const item = items[i];
      if (!item) return;
      const it = this.addInteractable(
        at.x,
        at.y,
        `${item.label} — ${String(item.price)} Tickets`,
        () => {
          if (this.run.tickets < item.price) {
            this.feel.floatText(at.x, at.y - 40, 'Pas assez de Tickets', Css.danger, 900);
            it.used = false;
            return;
          }
          this.run.tickets -= item.price;
          this.feel.floatText(at.x, at.y - 40, 'Merci chef !', Css.quaiYellow, 900);
          item.buy();
        },
      );
      const stand = this.add
        .rectangle(at.x, at.y - 4, 22, 14, 0xffd200)
        .setStrokeStyle(1, 0x14101a)
        .setDepth(at.y);
      this.trackRoomObject(stand);
    });
  }

  private setupRest(): void {
    const at = this.room.markPositions('coffee')[0] ?? this.room.playerSpawn;
    const machine = this.add
      .rectangle(at.x, at.y - 6, 14, 20, 0x6b3e26)
      .setStrokeStyle(1, 0x14101a)
      .setDepth(at.y);
    this.trackRoomObject(machine);
    pushNotice(
      this.registry,
      'Salle des pauses — « La pause n’est pas du temps de travail effectif. »',
    );
    this.addInteractable(at.x, at.y, 'Prendre sa pause', () => {
      this.setModal(true);
      const run = this.run;
      this.ui.openChoice(
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
          this.setModal(false);
          this.clearRoom(false);
        },
      );
    });
  }

  private readonly roomObjects: Phaser.GameObjects.GameObject[] = [];

  private trackRoomObject(o: Phaser.GameObjects.GameObject): void {
    this.roomObjects.push(o);
  }

  private addInteractable(x: number, y: number, label: string, action: () => void): Interactable {
    const it: Interactable = { x, y, label, action, used: false };
    this.interactables.push(it);
    return it;
  }

  /** Franchit une porte : fondu, reconstruction de la salle, nouvelle vague. */
  private goThrough(door: DoorChoice): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.clearRoomObjects();
      this.room.destroy();
      this.buildRoom(door);
      this.atmo.setLook(door.type === 'boss' ? 'boss' : 'quais');
      this.atmo.lightRoom(this.room);
      this.attachRoomColliders();
      const spawn = this.room.playerSpawn;
      this.player.setPosition(spawn.x, spawn.y);
      this.player.body.reset(spawn.x, spawn.y);
      this.setupCamera();
      this.cameras.main.fadeIn(260, 0, 0, 0);
      this.transitioning = false;
      this.startRoomContent();
      if (door.room === REST_ROOM || door.room === BOSS_ROOM) this.saveProgressHint();
    });
  }

  private saveProgressHint(): void {
    if (this.currentDoor.type === 'boss')
      pushNotice(this.registry, 'Écran rouge : SIGNATURE IMMINENTE', Css.danger);
  }

  private clearRoomObjects(): void {
    for (const e of this.enemies) e.destroy();
    this.enemies.length = 0;
    for (const p of this.projectiles) p.kill();
    for (const h of this.hazards) h.finish();
    this.hazards.length = 0;
    for (const p of this.pickups) p.destroy();
    this.pickups.length = 0;
    for (const o of this.roomObjects) o.destroy();
    this.roomObjects.length = 0;
    this.interactables.length = 0;
    this.boss = null;
  }

  private onBossDefeated(): void {
    const run = this.run;
    earnPs(run, REWARDS.PS_BOSS1);
    run.grainsEarned += REWARDS.GRAINS_BOSS1;
    this.feel.slowmo(0.2, 1500, 600);
    pushNotice(this.registry, '« … Le train de 7h12, il existe encore ? »', Css.quaiYellow);
    this.time.delayedCall(2600, () => {
      this.endShift('victoire');
    });
  }

  private endShift(end: 'victoire' | 'mort'): void {
    if (this.ended) return;
    this.ended = true;
    const result = finishRun(this.run, end);
    const meta = applyResult(getMeta(this.registry), result);
    setMeta(this.registry, meta);
    metaSave.save(meta);
    this.registry.set(RegistryKeys.LastResult, result);
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop(SceneKeys.UI);
      this.scene.start(SceneKeys.Results);
    });
  }

  // ─── Boucle ────────────────────────────────────────────────────────────────

  public override update(_time: number, delta: number): void {
    const real = Math.min(delta, 50);
    if (this.modal || this.ended) {
      // On vide les appuis pendant la fenêtre : la touche qui la ferme ne doit pas agir en jeu.
      this.controls.read(this.player, [], this.cameras.main);
      this.publishHud();
      this.afterModal = true;
      return;
    }
    const input = this.controls.read(this.player, this.livingEnemies(), this.cameras.main);
    if (this.afterModal) {
      this.afterModal = false;
      this.publishHud();
      return;
    }
    if (this.cheats) this.updateCheats();
    if (input.pause) {
      this.scene.launch(SceneKeys.Pause, { seed: this.run.seed, avantages: this.run.avantages });
      this.scene.bringToTop(SceneKeys.Pause);
      this.scene.pause();
      return;
    }
    this.atmo.update(real);
    const dt = this.feel.step(real);
    if (dt <= 0) {
      this.publishHud();
      return;
    }
    this.gameTime += dt;
    this.player.tick(dt, this.transitioning ? NO_INTENT : input);
    for (const e of this.enemies) if (e.active) e.tick(dt);
    for (let i = this.enemies.length - 1; i >= 0; i -= 1)
      if (!this.enemies[i]?.active) this.enemies.splice(i, 1);
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.tick(dt);
      const c = p.hitCircle;
      const hb = this.player.hurtCircle;
      if (Math.hypot(c.x - hb.x, c.y - hb.y) <= c.r + hb.r) {
        if (this.player.isInvulnerable()) {
          if (this.player.inPerfectWindow())
            this.player.receiveHit(p.damage, { x: p.x, y: p.y, name: p.owner });
          continue;
        }
        if (this.damagePlayer(p.damage, { x: p.x, y: p.y, name: p.owner, knockbackPx: 12 }))
          p.kill();
      }
    }
    for (const h of this.hazards) h.update(dt);
    for (let i = this.hazards.length - 1; i >= 0; i -= 1)
      if (this.hazards[i]?.done) this.hazards.splice(i, 1);

    // Ramassage au contact.
    for (const p of this.pickups) {
      if (!p.collected && Math.hypot(p.x - this.player.x, p.y - this.player.y) < 14)
        this.collect(p);
    }
    for (let i = this.pickups.length - 1; i >= 0; i -= 1)
      if (this.pickups[i]?.collected) this.pickups.splice(i, 1);

    this.updateWaves();
    this.updatePrompts(input.interact);

    if (!this.transitioning && this.cleared && !this.player.isDead) {
      const door = this.room.doorAt(this.player.x, this.player.y);
      if (door) this.goThrough(door);
    }
    this.publishHud();
  }

  /** Raccourcis de test, actifs seulement en dev avec `?cheat` : K tue tout, G invincible, B salle du boss, N salle suivante (ou un Avantage si la salle n'est pas nettoyée). */
  private readonly cheats =
    import.meta.env.DEV && new URLSearchParams(location.search).has('cheat');
  private cheatKeys: Record<string, Phaser.Input.Keyboard.Key> | null = null;

  private updateCheats(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.cheatKeys ??= kb.addKeys('K,G,B,N', false) as Record<string, Phaser.Input.Keyboard.Key>;
    const k = this.cheatKeys;
    const just = (name: string): boolean => {
      const key = k[name];
      return key !== undefined && Phaser.Input.Keyboard.JustDown(key);
    };
    if (just('K')) {
      console.info(`[cheat] K ${String(this.livingEnemies().length)}`);
      for (const e of this.livingEnemies()) e.debugKill();
    }
    if (just('G')) this.godMode = !this.godMode;
    if (just('N') && !this.cleared) this.offerAvantage();
    if (this.godMode) this.run.energy = maxEnergy(this.run);
    if (just('B')) this.goThrough({ room: BOSS_ROOM, type: 'boss', reward: null });
    if (just('N') && this.cleared) {
      const door = doorsFor(this.run.seed, this.run.room + 1, {
        shopSeen: this.run.shopSeen,
        elites: this.run.elites,
        tresorSeen: this.run.tresorSeen,
        previousType: this.currentDoor.type,
      })[0];
      if (door) this.goThrough(door);
    }
  }

  private godMode = false;

  private updatePrompts(interactPressed: boolean): void {
    let shown = false;
    for (const it of this.interactables) {
      if (it.used) continue;
      if (Math.hypot(it.x - this.player.x, it.y - this.player.y) > 26) continue;
      shown = true;
      this.prompt
        .setText(`[E] ${it.label}`)
        .setPosition(it.x, it.y - 44)
        .setVisible(true);
      if (interactPressed) {
        it.used = true;
        it.action();
      }
      break;
    }
    if (!shown && this.cleared) {
      const near = this.room.nearestDoor(this.player.x, this.player.y, 40);
      if (near) {
        shown = true;
        this.prompt
          .setText('Entrer')
          .setPosition(near.x, near.y + 18)
          .setVisible(true);
      }
    }
    if (!shown) this.prompt.setVisible(false);
  }

  private publishHud(): void {
    const run = this.run;
    const boss = this.boss && !this.boss.isDead && this.boss.active ? this.boss : null;
    const snap: HudSnapshot = {
      energy: Math.ceil(run.energy),
      maxEnergy: maxEnergy(run),
      burnout: run.burnout.value,
      burnoutFloor: run.burnout.floor,
      burnoutTier: run.burnout.tier.label,
      meltdownMs: run.burnout.meltdownRemainingMs,
      mobilisation: run.mobilisation.value,
      dashCharges: run.dash.available,
      dashMax: run.dash.max,
      dashProgress: run.dash.progress,
      gobelets: run.gobelets,
      tickets: run.tickets,
      ps: run.psEarned,
      clock: clockLabel(run.shift.startHour, run.minutes),
      delay: run.delayMinutes,
      room: Math.min(run.room, SHIFT.BIOME1_ROOMS + 2),
      roomLabel: ROOM_TYPE_LABEL[this.currentDoor.type] ?? '',
      enemiesLeft: this.livingEnemies().length,
      boss: boss ? { name: "L'Auditeur des Quais", hp: boss.hp, maxHp: boss.maxHp } : null,
      shield: this.player.hasShield,
    };
    this.registry.set(RegistryKeys.Hud, snap);
  }
}
