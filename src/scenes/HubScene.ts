import Phaser from 'phaser';
import type { EnemyKind, ShiftId } from '@/config/balance';
import { SHIFTS } from '@/config/balance';
import { NPCS, originOf, sheetOf } from '@/config/assets';
import { Css, Depth, FONT, SceneKeys } from '@/config/constants';
import { metaSave } from '@/platform/save';
import { AttackTokens } from '@/systems/combat/AttackTokens';
import type { UpgradeId } from '@/systems/meta/MetaState';
import { buyUpgrade, loadoutOf, nextCost, rankOf, UPGRADES } from '@/systems/meta/MetaState';
import type { RunState } from '@/systems/meta/RunState';
import { createRun } from '@/systems/meta/RunState';
import { getMeta, pushNotice, setMeta } from '@/systems/meta/session';
import { parseRoom } from '@/systems/procedural/RoomLayout';
import type { Rng } from '@/utils/rng';
import { createRng } from '@/utils/rng';
import type { CombatWorld, HitSource } from '@/entities/CombatWorld';
import type { Enemy } from '@/entities/Enemy';
import { TrainingDummy } from '@/entities/enemies/TrainingDummy';
import type { HazardSpec } from '@/entities/Hazard';
import { Hazard } from '@/entities/Hazard';
import { Player } from '@/entities/Player';
import type { Projectile, ProjectileSpec } from '@/entities/Projectile';
import { Room } from '@/entities/Room';
import { Atmosphere } from '@/fx/Atmosphere';
import { GameFeel } from '@/fx/GameFeel';
import { Controls } from '@/ui/Controls';
import type { UIScene } from '@/scenes/UIScene';

export interface HubData {
  readonly fromResult?: 'victoire' | 'mort';
}

interface Npc {
  readonly char: keyof typeof NPCS;
  readonly x: number;
  readonly y: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  talks: number;
}

/** Répliques des PNJ (docs/LORE.md § 4) : générique, après une mort, après une victoire. */
const LINES: Readonly<
  Record<keyof typeof NPCS, { generic: readonly string[]; death: string; victory: string }>
> = {
  M: {
    generic: [
      'De mon temps, le retard, on l’appelait l’aventure. Maintenant, ils l’appellent un KPI.',
      'Le Tableau des revendications, fieu. Chaque PS, c’est un acquis.',
    ],
    death: 'Ça va, fieu ? T’as eu une aventure courte. Allez, une tasse et on y retourne.',
    victory: 'Ils ont reprogrammé ? Bien. Tant qu’ils reprogramment, on existe.',
  },
  F: {
    generic: [
      'Hydrate-toi. Au café, de préférence.',
      'Ton Burnout de fin de Shift était à 87. Je l’ai noté. En rouge. Avec un cœur, pour adoucir.',
    ],
    death: 'Arrêt de travail de zéro jour. Bienvenue. Tu avais deux Gobelets pleins, je précise.',
    victory: 'Quatorze heures de service sans pause réglementaire. Bravo. Je fais un signalement.',
  },
  Y: {
    generic: ['Roulement du jour affiché. Je te mets le biome 1 en orange.'],
    death:
      'Incident voyageur sur ta ligne. Toi. Je te mets en voie d’attente, le temps de te recoller.',
    victory: 'L’Auditeur est en voie d’attente. Définitive, j’espère.',
  },
  K: {
    generic: [
      'J’ai recalibré ta clé. Elle tape plus fort, mais elle grince. Comme moi.',
      'C’est pas nous, c’est l’autre boîte.',
    ],
    death:
      'Tombé sur les voies ? C’est pas nous, c’est l’autre boîte. Enfin… là, c’est un peu toi.',
    victory: 'Tu lui as coupé le courant ? Proprement ? Je note ça dans un rapport.',
  },
  N: {
    generic: [
      'Le Règlement, page 312 : un consultant n’a pas de titre de transport. Je dis ça, je dis rien.',
      'Numéro suivant !',
    ],
    death: 'Elle t’a imprimé, la borne ? On ne négocie pas avec ces machines-là. Numéro suivant !',
    victory: 'J’ai archivé ta victoire. Classement : « Rare ». Sous-classement : « À renouveler ».',
  },
  J: {
    generic: [
      'Le mannequin, là-bas. Tape dedans, il ne porte pas plainte.',
      'Titre de transport, s’il vous plaît. Ah, c’est toi.',
    ],
    death: 'On remonte dans le train. Toujours.',
    victory: 'Contrôle réussi. Billet composté.',
  },
  U: {
    generic: [
      'Attention au départ ! … Pardon, l’habitude.',
      'Un coup de sifflet bien placé, ça vaut tous les diaporama.',
    ],
    death: 'Le Shift est supprimé. Le suivant est annoncé à l’heure. On y croit.',
    victory: 'Shift tenu ! J’ai fait claquer l’écran des départs pour toi.',
  },
};

/**
 * L'OCC (Operation Coffee Center) : le hub souterrain où l'on revient après chaque Shift.
 * On y dépense les PS au Tableau des revendications (Marcel), on choisit son roulement (Yasmina),
 * on teste sa clé sur le mannequin, puis on « prend son poste » par la porte du couloir technique.
 */
export class HubScene extends Phaser.Scene implements CombatWorld {
  public feel!: GameFeel;
  private atmo!: Atmosphere;
  public rng!: Rng;
  public run!: RunState;
  public player!: Player;
  public tokens!: AttackTokens;
  public room!: Room;
  private controls!: Controls;
  private readonly dummies: Enemy[] = [];
  private readonly hazards: Hazard[] = [];
  private readonly npcs: Npc[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private gameTime = 0;
  private modal = false;
  private leaving = false;
  private afterModal = false;
  private shift: ShiftId = 'matin';
  private fromResult: HubData['fromResult'];

  public constructor() {
    super(SceneKeys.Hub);
  }

  public init(data: HubData): void {
    this.fromResult = data.fromResult;
    this.dummies.length = 0;
    this.hazards.length = 0;
    this.npcs.length = 0;
    this.modal = false;
    this.leaving = false;
    this.gameTime = 0;
  }

  public get stage(): Phaser.Scene {
    return this;
  }

  public create(): void {
    const meta = getMeta(this.registry);
    this.run = createRun(meta, 'matin', 1);
    this.rng = createRng(Date.now() >>> 0);
    this.tokens = new AttackTokens({ melee: 0, ranged: 0 });
    this.feel = new GameFeel(this);
    this.controls = new Controls(this);
    this.room = new Room(this, parseRoom('occ'), 'tiles_occ');
    this.room.setDoors([{ room: 1, type: 'combat', reward: null }], ['PRENDRE SON POSTE']);
    this.room.openDoors();
    const spawn = this.room.playerSpawn;
    this.player = new Player(this, spawn.x, spawn.y);
    this.player.peaceful = true;
    this.atmo = new Atmosphere(this, 'occ');
    this.atmo.lightRoom(this.room);
    this.atmo.lit(this.player);
    this.atmo.attachHero(this.player);
    this.physics.add.collider(this.player, this.room.layer);
    this.room.fitCamera(this.cameras.main, this.player);

    for (const m of this.room.markPositions('npc')) {
      const char = m.char as keyof typeof NPCS;
      const npc = NPCS[char];
      const key = `${npc.id}-idle`;
      const sprite = this.add
        .sprite(m.x, m.y + 8, sheetOf(key))
        .setOrigin(...originOf(key))
        .setDepth(m.y + 8);
      if (this.anims.exists(key)) sprite.play({ key, startFrame: Math.floor(Math.random() * 4) });
      this.add
        .image(m.x, m.y + 8, 'shadow_s')
        .setAlpha(0.5)
        .setDepth(Depth.Shadow);
      this.add
        .text(m.x, m.y - 22, npc.name, {
          fontFamily: FONT,
          fontSize: '8px',
          color: Css.white,
          stroke: Css.outline,
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(Depth.Text);
      this.npcs.push({ char, x: m.x, y: m.y, sprite, talks: 0 });
    }
    for (const d of this.room.markPositions('dummy')) {
      const dummy = new TrainingDummy(this, d.x, d.y + 8);
      dummy.start(true);
      this.atmo.lit(dummy);
      this.dummies.push(dummy);
    }
    const coffee = this.room.markPositions('coffee')[0];
    if (coffee) {
      const machine = this.add
        .sprite(coffee.x, coffee.y + 8, sheetOf('vieille-dame-idle'))
        .setOrigin(0.5, 1)
        .setDepth(coffee.y + 8);
      machine.setLighting(true);
      this.atmo.addGlow(coffee.x, coffee.y, 0xffb35c, 60, 0.12);
      if (this.anims.exists('vieille-dame-idle')) machine.play('vieille-dame-idle');
      else if (this.textures.exists('prop_vieille-dame')) machine.setTexture('prop_vieille-dame');
    }
    this.physics.add.collider(this.dummies, this.room.layer);

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

    this.scene.launch(SceneKeys.UI, { mode: 'hub' });
    this.scene.bringToTop(SceneKeys.UI);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.feel.destroy();
    });
    this.cameras.main.fadeIn(500, 0, 0, 0);
    const welcome =
      this.fromResult === 'mort'
        ? 'Fatou : « Arrêt de travail de 0 jour. Bienvenue. »'
        : this.fromResult === 'victoire'
          ? 'Rudy : « Shift tenu ! » — l’OCC est en fête.'
          : 'L’OCC — Operation Coffee Center. Parle aux collègues (E), puis prends ton poste (porte en haut à droite).';
    this.time.delayedCall(300, () => {
      pushNotice(this.registry, welcome, Css.quaiYellow);
    });
  }

  // ─── CombatWorld (version paisible) ────────────────────────────────────────

  public now(): number {
    return this.gameTime;
  }

  public livingEnemies(): readonly Enemy[] {
    return this.dummies.filter((d) => d.active);
  }

  public activeProjectiles(): readonly Projectile[] {
    return [];
  }

  public damagePlayer(_amount: number, _source: HitSource): boolean {
    return false;
  }

  public onEnemyDamaged(enemy: Enemy, amount: number, crit: boolean): void {
    this.feel.damageNumber(enemy.x, enemy.y - 20, amount, { crit });
    this.feel.sparksAt(enemy.x, enemy.y - 10, crit ? 8 : 4);
    this.vfx('vfx-hit', enemy.x, enemy.y - 12);
  }

  public onEnemyKilled(): void {
    // Le mannequin ne meurt jamais.
  }

  public spawnEnemy(_kind: EnemyKind, _x: number, _y: number): Enemy | null {
    return null;
  }

  public spawnProjectile(_spec: ProjectileSpec): void {
    // Pas de projectile à l'OCC.
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
  }

  // ─── Interactions ──────────────────────────────────────────────────────────

  private get ui(): UIScene {
    return this.scene.get(SceneKeys.UI) as UIScene;
  }

  private talk(npc: Npc): void {
    const lines = LINES[npc.char];
    npc.sprite.setFlipX(this.player.x < npc.x);
    if (npc.char === 'M') {
      this.openRevendications(0);
      return;
    }
    if (npc.char === 'Y') {
      this.openRoster();
      return;
    }
    let line: string;
    if (npc.talks === 0 && this.fromResult === 'mort') line = lines.death;
    else if (npc.talks === 0 && this.fromResult === 'victoire') line = lines.victory;
    else line = lines.generic[npc.talks % lines.generic.length] ?? '';
    npc.talks += 1;
    pushNotice(this.registry, `${NPCS[npc.char].name} : « ${line} »`);
  }

  /** Tableau des revendications (Marcel) : 4 revendications par page. */
  private openRevendications(page: number): void {
    const perPage = 3;
    const pages = Math.ceil(UPGRADES.length / perPage);
    const slice = UPGRADES.slice(page * perPage, page * perPage + perPage);
    const meta = getMeta(this.registry);
    this.modal = true;
    const options = [
      ...slice.map((u) => {
        const rank = rankOf(meta, u.id);
        const cost = nextCost(meta, u.id);
        return {
          title: `${u.name} ${String(rank)}/${String(u.costs.length)}`,
          desc: `${u.effect}\n\n${cost === null ? 'Acquis au maximum.' : `Coût : ${String(cost)} PS`}`,
          color: cost !== null && meta.ps >= cost ? Css.quaiYellow : Css.white,
          disabled: cost === null || meta.ps < cost,
        };
      }),
      {
        title: page + 1 < pages ? 'Page suivante' : 'Retour au début',
        desc: `Page ${String(page + 1)}/${String(pages)}`,
      },
      { title: 'Fermer', desc: 'Retour à l’OCC.' },
    ];
    this.ui.openChoice(
      `MARCEL · TABLEAU DES REVENDICATIONS — ${String(meta.ps)} PS`,
      options,
      (i) => {
        if (i < slice.length) {
          const up = slice[i];
          if (up) this.buy(up.id);
          this.openRevendications(page);
          return;
        }
        if (i === slice.length) {
          this.openRevendications((page + 1) % pages);
          return;
        }
        this.modal = false;
      },
      true,
    );
  }

  private buy(id: UpgradeId): void {
    const result = buyUpgrade(getMeta(this.registry), id);
    if (!result.ok) return;
    setMeta(this.registry, result.meta);
    metaSave.save(result.meta);
    this.run = createRun(result.meta, 'matin', 1);
    this.feel.sparksAt(this.player.x, this.player.y - 20, 10);
    pushNotice(
      this.registry,
      'Marcel : « Revendication obtenue. C’est un acquis, fieu. »',
      Css.quaiYellow,
    );
  }

  /** Tableau des roulements (Yasmina) : choix du Shift selon les déblocages. */
  private openRoster(): void {
    const unlocked = loadoutOf(getMeta(this.registry)).shiftsUnlocked;
    const ids: ShiftId[] = ['matin', 'apres-midi', 'nuit'];
    this.modal = true;
    this.ui.openChoice(
      'YASMINA · TABLEAU DES ROULEMENTS',
      ids.map((id, i) => {
        const s = SHIFTS[id];
        const locked = i >= unlocked;
        return {
          title: `${s.label}${id === this.shift ? ' (choisi)' : ''}`,
          desc: locked
            ? 'Verrouillé : revendication « Tableau de service » chez Marcel.'
            : `Départ ${String(s.startHour)} h · PS ×${String(s.psMult).replace('.', ',')}${s.hpMult > 1 ? ' · PV ennemis +10 %' : ''}${s.damageMult > 1 ? ' · dégâts ennemis +15 %' : ''}`,
          disabled: locked,
        };
      }),
      (i) => {
        this.shift = ids[i] ?? 'matin';
        this.modal = false;
        pushNotice(
          this.registry,
          `Yasmina : « Roulement du ${SHIFTS[this.shift].label} validé. Je te mets en voie. »`,
        );
      },
    );
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop(SceneKeys.UI);
      this.scene.start(SceneKeys.Run, { shift: this.shift, seed });
    });
  }

  public override update(_time: number, delta: number): void {
    const real = Math.min(delta, 50);
    const input = this.controls.read(this.player, this.livingEnemies(), this.cameras.main);
    // La touche qui ferme une fenêtre (Échap, Entrée) ne doit pas agir en jeu à la frame suivante.
    if (this.modal || this.ui.isModalOpen) {
      this.afterModal = true;
      return;
    }
    if (this.afterModal) {
      this.afterModal = false;
      return;
    }
    if (input.pause) {
      this.scene.stop(SceneKeys.UI);
      this.scene.start(SceneKeys.MainMenu);
      return;
    }
    this.atmo.update(real);
    const dt = this.feel.step(real);
    if (dt <= 0) return;
    this.gameTime += dt;
    this.player.tick(dt, input);
    for (const d of this.dummies) d.tick(dt);
    for (const h of this.hazards) h.update(dt);

    let shown = false;
    for (const npc of this.npcs) {
      if (Math.hypot(npc.x - this.player.x, npc.y + 8 - this.player.y) > 28) continue;
      shown = true;
      const verb =
        npc.char === 'M'
          ? 'Tableau des revendications'
          : npc.char === 'Y'
            ? 'Choisir le roulement'
            : 'Parler';
      this.prompt
        .setText(`[E] ${verb}`)
        .setPosition(npc.x, npc.y - 30)
        .setVisible(true);
      if (input.interact) this.talk(npc);
      break;
    }
    if (!shown) this.prompt.setVisible(false);
    const door = this.room.nearestDoor(this.player.x, this.player.y, 40);
    if (door && !shown) {
      this.prompt
        .setText(`Prendre son poste — Shift du ${SHIFTS[this.shift].label}`)
        .setPosition(door.x, door.y + 22)
        .setVisible(true);
    }
    if (this.room.doorAt(this.player.x, this.player.y)) this.leave();
  }
}
