import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, INPUT_GRACE_MS, SceneKeys } from '@/config/constants';
import type { SceneKey } from '@/config/constants';
import { COLORS, toCss } from '@/config/colors';
import { ENCOUNTERS, ITEMS, SKILLS } from '@/data/combat';
import type { ItemId, SkillId, TargetMode } from '@/data/combat';
import type { EncounterId, StatusId } from '@/data/types';
import {
  act,
  availableActions,
  computeRewards,
  currentActor,
  legalTargets,
  startBattle,
  targetMode,
} from '@/systems/combat/CombatEngine';
import type {
  BattleAction,
  BattleEvent,
  BattleRewards,
  BattleState,
  BattleStep,
  Combatant,
} from '@/systems/combat/types';
import { applyBattleReport, buildBattleSetup, reportFromBattle } from '@/systems/party/Party';
import { fatigueTier } from '@/systems/time/FatigueClock';
import { characterTextureKey } from '@/ui/PlaceholderTextures';
import { getGameState, pushNotice, updateGameState } from '@/utils/registry';

export interface BattleSceneData {
  readonly encounterId: EncounterId;
  /** Scène à reprendre à la fin (Game pour une rencontre sur la carte, Dialogue pour un combat scénarisé). */
  readonly caller: SceneKey;
  /** Clé du groupe visible vaincu (rencontre sur la carte), pour le faire disparaître. */
  readonly markerKey?: string;
}

/** Données transmises à la scène appelante par `scene.resume(caller, data)`. */
export interface BattleResumeData {
  readonly battleOutcome: 'victory' | 'defeat' | 'fled';
}

const SPRITE_SCALE = 3;
const ENEMY_X = [200, 330, 140, 270] as const;
const ENEMY_Y = [250, 290, 330, 370] as const;
const PARTY_X = [700, 800, 880] as const;
const PARTY_Y = [250, 300, 350] as const;
const PANEL_Y = 392;
const STEP_MS = 520;
const QUICK_MS = 220;

const STATUS_TAGS: Readonly<Record<StatusId, string>> = {
  cafeine: 'CAF',
  syndique: 'SYN',
  demotive: 'DÉM',
  bloque: 'BLQ',
  burnout: 'B-O',
  confusion: 'CNF',
  sommeil: 'ZZZ',
};

type MenuMode = 'idle' | 'main' | 'skills' | 'items' | 'target' | 'end';

interface FighterView {
  readonly sprite: Phaser.GameObjects.Image;
  readonly name: Phaser.GameObjects.Text;
  readonly bar: Phaser.GameObjects.Graphics;
  readonly tags: Phaser.GameObjects.Text;
  readonly cursor: Phaser.GameObjects.Text;
  hp: number;
  maxHp: number;
}

interface MenuEntry {
  readonly label: string;
  readonly enabled: boolean;
  readonly hint?: string;
  readonly run: () => void;
}

/**
 * Combat au tour par tour (GDD § 5) : vue de côté, ennemis à gauche, équipe à droite (UX § 3.3).
 * Toute la règle est dans `CombatEngine` ; la scène rejoue les événements renvoyés, puis demande une action
 * au membre de l'équipe dont c'est le tour. À la fin, le résultat est appliqué au GameState (`Party.ts`).
 */
export class BattleScene extends Phaser.Scene {
  private setup!: BattleSceneData;
  private battle!: BattleState;
  private views = new Map<string, FighterView>();
  private mode: MenuMode = 'idle';
  private entries: MenuEntry[] = [];
  private entryObjects: Phaser.GameObjects.Text[] = [];
  private selected = 0;
  private targets: string[] = [];
  private pendingAction: ((targetId?: string) => BattleAction) | null = null;
  private logText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private orderText!: Phaser.GameObjects.Text;
  private partyText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private acceptInputAt = 0;
  private rewards: BattleRewards | null = null;

  public constructor() {
    super(SceneKeys.Battle);
  }

  public create(data: BattleSceneData): void {
    this.setup = data;
    this.views = new Map();
    this.mode = 'idle';
    this.entries = [];
    this.entryObjects = [];
    this.targets = [];
    this.pendingAction = null;
    this.rewards = null;
    this.acceptInputAt = this.time.now + INPUT_GRACE_MS;

    this.drawBackdrop();
    this.roundText = this.text(16, 12, '', 16, COLORS.sncb.accent).setFontStyle('bold');
    this.orderText = this.text(16, 36, '', 13, COLORS.sncb.textMuted);
    this.logText = this.text(GAME_WIDTH / 2, 70, '', 17, COLORS.sncb.text)
      .setOrigin(0.5, 0)
      .setBackgroundColor(toCss(COLORS.sncb.bgDeep))
      .setPadding(12, 6, 12, 6);
    this.add
      .rectangle(0, PANEL_Y, GAME_WIDTH, GAME_HEIGHT - PANEL_Y, COLORS.sncb.bgDeep, 0.97)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.sncb.border);
    this.partyText = this.text(20, PANEL_Y + 14, '', 15, COLORS.sncb.text).setLineSpacing(10);
    this.helpText = this.text(
      GAME_WIDTH - 16,
      GAME_HEIGHT - 10,
      '',
      12,
      COLORS.sncb.textMuted,
    ).setOrigin(1, 1);

    this.setupInput();
    const step = startBattle(
      buildBattleSetup(getGameState(this.registry), data.encounterId),
      Math.random,
    );
    this.battle = step.state;
    this.createFighters(step.state);
    this.say(`Combat : ${ENCOUNTERS[data.encounterId].name}`);
    this.time.delayedCall(700, () => {
      this.play(step);
    });
  }

  // -------------------------------------------------------------------------
  // Décor et combattants
  // -------------------------------------------------------------------------

  private drawBackdrop(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0b1f3a).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x123c73).fillRect(0, 120, GAME_WIDTH, 110);
    g.fillStyle(0x9aa3b2).fillRect(0, 230, GAME_WIDTH, PANEL_Y - 230);
    g.fillStyle(0xffd200).fillRect(0, 232, GAME_WIDTH, 4);
    for (let x = 0; x < GAME_WIDTH; x += 64) g.fillStyle(0x8a93a3).fillRect(x + 20, 300, 6, 6);
  }

  private createFighters(state: BattleState): void {
    for (const c of state.combatants) this.ensureView(c, state);
  }

  private slotOf(c: Combatant, state: BattleState): { x: number; y: number } {
    const side = state.combatants.filter((o) => o.side === c.side);
    const i = Math.max(
      0,
      side.findIndex((o) => o.id === c.id),
    );
    if (c.side === 'enemy')
      return { x: ENEMY_X[i % ENEMY_X.length] ?? 200, y: ENEMY_Y[i % ENEMY_Y.length] ?? 300 };
    return { x: PARTY_X[i % PARTY_X.length] ?? 760, y: PARTY_Y[i % PARTY_Y.length] ?? 300 };
  }

  private ensureView(c: Combatant, state: BattleState): FighterView {
    const existing = this.views.get(c.id);
    if (existing) return existing;
    const { x, y } = this.slotOf(c, state);
    const sprite = this.add
      .image(x, y, characterTextureKey(c.sprite, c.side === 'enemy' ? 'right' : 'left'))
      .setOrigin(0.5, 1)
      .setScale(SPRITE_SCALE)
      .setDepth(y)
      .setInteractive({ useHandCursor: true });
    sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.pickTarget(c.id);
    });
    const name = this.text(x, y - 98, c.name, 12, COLORS.sncb.text)
      .setOrigin(0.5, 1)
      .setStroke('#101828', 3)
      .setDepth(1000);
    const bar = this.add.graphics({ x: x - 30, y: y - 94 }).setDepth(1000);
    const tags = this.text(x, y + 4, '', 11, COLORS.occ.accent)
      .setOrigin(0.5, 0)
      .setDepth(1000);
    const cursor = this.text(x, y - 128, '▼', 22, COLORS.sncb.accent)
      .setOrigin(0.5, 1)
      .setVisible(false)
      .setDepth(1001);
    this.tweens.add({ targets: cursor, y: y - 122, duration: 300, yoyo: true, repeat: -1 });
    const view: FighterView = { sprite, name, bar, tags, cursor, hp: c.hp, maxHp: c.maxHp };
    this.views.set(c.id, view);
    this.drawBar(view, c.side);
    this.refreshTags(c);
    if (c.ko) sprite.setAlpha(0.25);
    return view;
  }

  private drawBar(view: FighterView, side: 'party' | 'enemy'): void {
    const w = 60;
    const ratio = view.maxHp > 0 ? Phaser.Math.Clamp(view.hp / view.maxHp, 0, 1) : 0;
    view.bar.clear();
    view.bar.fillStyle(COLORS.gauge.hpBg).fillRect(0, 0, w, 6);
    view.bar
      .fillStyle(side === 'enemy' ? COLORS.semantic.danger : COLORS.gauge.hp)
      .fillRect(0, 0, Math.round(w * ratio), 6);
    view.bar.lineStyle(1, 0x101828).strokeRect(0, 0, w, 6);
  }

  private refreshTags(c: Combatant): void {
    const view = this.views.get(c.id);
    view?.tags.setText(c.statuses.map((s) => STATUS_TAGS[s.id]).join(' '));
  }

  private combatant(id: string): Combatant | undefined {
    return this.battle.combatants.find((c) => c.id === id);
  }

  // -------------------------------------------------------------------------
  // Rejeu des événements
  // -------------------------------------------------------------------------

  /** Rejoue les événements d'une étape, puis passe la main au joueur (ou termine le combat). */
  private play(step: BattleStep): void {
    this.mode = 'idle';
    this.clearMenu();
    const previous = this.battle;
    this.battle = step.state;
    for (const c of step.state.combatants) this.ensureView(c, step.state);
    // Les PV affichés partent de l'état précédent et suivent les événements.
    for (const c of previous.combatants) {
      const v = this.views.get(c.id);
      if (v) {
        v.hp = c.hp;
        v.maxHp = c.maxHp;
      }
    }
    const queue = [...step.events];
    const next = (): void => {
      const event = queue.shift();
      if (!event) {
        this.syncAll();
        this.afterEvents();
        return;
      }
      const delay = this.showEvent(event);
      this.time.delayedCall(delay, next);
    };
    next();
  }

  private showEvent(e: BattleEvent): number {
    const name = (id: string): string => this.combatant(id)?.name ?? id;
    switch (e.kind) {
      case 'roundStart':
        this.roundText.setText(`Manche ${String(e.round)}`);
        this.orderText.setText(`Ordre : ${e.order.map(name).join(' › ')}`);
        return QUICK_MS;
      case 'turnStart':
        this.highlight(e.actorId);
        return 0;
      case 'skipTurn':
        this.say(
          `${name(e.actorId)} passe son tour (${e.reason === 'bloque' ? 'Bloqué' : 'Sommeil'})`,
        );
        return STEP_MS;
      case 'action':
        this.say(e.label);
        this.lunge(e.actorId);
        return STEP_MS;
      case 'miss':
        this.floatText(e.targetId, 'Raté', COLORS.sncb.textMuted);
        return QUICK_MS;
      case 'damage': {
        const v = this.views.get(e.targetId);
        if (v) {
          v.hp = Math.max(0, v.hp - e.amount);
          this.drawBar(v, this.combatant(e.targetId)?.side ?? 'enemy');
          this.cameras.main.shake(e.critical ? 160 : 80, e.critical ? 0.008 : 0.003);
          this.tweens.add({ targets: v.sprite, alpha: 0.3, duration: 60, yoyo: true, repeat: 1 });
        }
        const suffix = e.critical ? ' !' : e.weakness ? ' ×2' : '';
        this.floatText(
          e.targetId,
          `-${String(e.amount)}${suffix}`,
          e.critical ? COLORS.sncb.accent : COLORS.semantic.dangerText,
        );
        return QUICK_MS + 120;
      }
      case 'heal': {
        const v = this.views.get(e.targetId);
        if (v) {
          v.hp = Math.min(v.maxHp, v.hp + e.amount);
          this.drawBar(v, this.combatant(e.targetId)?.side ?? 'party');
        }
        this.floatText(e.targetId, `+${String(e.amount)}`, COLORS.semantic.success);
        return QUICK_MS;
      }
      case 'pe':
        this.floatText(e.targetId, `+${String(e.amount)} PE`, COLORS.gauge.pe);
        return QUICK_MS;
      case 'status':
        this.floatText(
          e.targetId,
          e.applied ? STATUS_TAGS[e.status] : 'Résiste',
          e.applied ? COLORS.occ.accent : COLORS.sncb.textMuted,
        );
        return QUICK_MS;
      case 'statusEnd':
        return 0;
      case 'ko': {
        const v = this.views.get(e.targetId);
        if (v) this.tweens.add({ targets: v.sprite, alpha: 0.25, duration: 300 });
        this.say(
          `${name(e.targetId)} : ${this.combatant(e.targetId)?.side === 'party' ? 'en arrêt maladie' : 'hors service'}`,
        );
        return STEP_MS;
      }
      case 'fatigue':
        this.say(
          `Fatigue d'équipe : ${String(Math.floor(e.value))} (${e.delta >= 0 ? '+' : ''}${String(e.delta)})`,
        );
        return QUICK_MS;
      case 'summon':
        this.say(`Renfort : ${name(e.combatantId)}`);
        return STEP_MS;
      case 'flee':
        this.say(e.success ? 'Fuite réussie !' : 'Fuite ratée : l’équipe perd la manche');
        return STEP_MS;
      case 'message':
        this.say(e.text);
        return STEP_MS;
      case 'end':
        return 0;
    }
  }

  private syncAll(): void {
    for (const c of this.battle.combatants) {
      const v = this.ensureView(c, this.battle);
      v.hp = c.hp;
      v.maxHp = c.maxHp;
      this.drawBar(v, c.side);
      this.refreshTags(c);
      v.sprite.setAlpha(c.ko ? 0.25 : 1);
    }
    this.refreshPartyPanel();
  }

  private afterEvents(): void {
    if (this.battle.outcome) {
      this.finish();
      return;
    }
    const actor = currentActor(this.battle);
    if (!actor) return;
    this.highlight(actor.id);
    this.openMainMenu(actor);
  }

  // -------------------------------------------------------------------------
  // Menus
  // -------------------------------------------------------------------------

  private openMainMenu(actor: Combatant): void {
    const avail = availableActions(this.battle);
    this.say(`À ${actor.name} de jouer`);
    this.showMenu('main', [
      {
        label: 'Attaquer',
        enabled: true,
        run: () => {
          this.chooseTarget('attack');
        },
      },
      {
        label: 'Compétences',
        enabled: avail.skills.length > 0,
        run: () => {
          this.openSkills();
        },
      },
      {
        label: 'Objets',
        enabled: avail.items.some((i) => i.usable),
        run: () => {
          this.openItems();
        },
      },
      {
        label: `Café (${String(this.battle.gobelets)})`,
        enabled: avail.cafe,
        hint: 'Gobelet de l’OCC : Fatigue −20 et Caféiné',
        run: () => {
          this.submit({ kind: 'cafe' });
        },
      },
      {
        label: 'Défendre',
        enabled: true,
        hint: 'Dégâts reçus ×0,5, PE doublés au tour suivant',
        run: () => {
          this.submit({ kind: 'defend' });
        },
      },
      {
        label: 'Fuir',
        enabled: avail.flee,
        hint: 'Impossible dans ce combat',
        run: () => {
          this.submit({ kind: 'flee' });
        },
      },
    ]);
  }

  private openSkills(): void {
    const avail = availableActions(this.battle);
    this.showMenu(
      'skills',
      avail.skills.map((s) => {
        const def = SKILLS[s.id];
        return {
          label: `${def.name} · ${String(def.peCost)} PE`,
          enabled: s.usable,
          hint: s.usable ? def.description : (s.reason ?? def.description),
          run: () => {
            this.chooseTarget('skill', s.id);
          },
        };
      }),
    );
  }

  private openItems(): void {
    const avail = availableActions(this.battle);
    this.showMenu(
      'items',
      avail.items.map((i) => ({
        label: `${ITEMS[i.id].name} ×${String(i.count)}`,
        enabled: i.usable,
        hint: ITEMS[i.id].description,
        run: () => {
          this.chooseTarget('item', i.id);
        },
      })),
    );
  }

  private chooseTarget(kind: 'attack' | 'skill' | 'item', id?: SkillId | ItemId): void {
    const mode: TargetMode | 'none' = targetMode(this.battle, kind, id);
    const build = (targetId?: string): BattleAction => {
      if (kind === 'attack') return { kind: 'attack', targetId: targetId ?? '' };
      if (kind === 'skill')
        return { kind: 'skill', skillId: id as SkillId, ...(targetId ? { targetId } : {}) };
      return { kind: 'item', itemId: id as ItemId, ...(targetId ? { targetId } : {}) };
    };
    if (mode === 'none' || mode === 'self' || mode === 'all-enemies' || mode === 'all-allies') {
      this.submit(build());
      return;
    }
    this.targets = [...legalTargets(this.battle, mode)];
    if (this.targets.length === 0) return;
    this.pendingAction = build;
    this.clearMenu();
    this.mode = 'target';
    this.selected = 0;
    this.say(mode === 'enemy' ? 'Choisir un ennemi' : 'Choisir un allié');
    this.helpText.setText('Gauche/Droite : cible · Entrée : valider · Échap : retour');
    this.showTargetCursor();
  }

  private showTargetCursor(): void {
    for (const [id, v] of this.views)
      v.cursor.setVisible(this.mode === 'target' && id === this.targets[this.selected]);
  }

  private pickTarget(id: string): void {
    if (this.mode !== 'target' || !this.pendingAction || !this.targets.includes(id)) return;
    this.submit(this.pendingAction(id));
  }

  private submit(action: BattleAction): void {
    if (this.time.now < this.acceptInputAt) return;
    this.pendingAction = null;
    this.targets = [];
    this.showTargetCursor();
    this.play(act(this.battle, action, Math.random));
  }

  private showMenu(mode: MenuMode, entries: MenuEntry[]): void {
    this.clearMenu();
    this.mode = mode;
    this.entries = entries;
    this.selected = Math.max(
      0,
      entries.findIndex((e) => e.enabled),
    );
    const grid = mode === 'main';
    const x0 = grid ? 470 : 470;
    entries.forEach((entry, i) => {
      const col = grid ? i % 2 : 0;
      const row = grid ? Math.floor(i / 2) : i;
      const t = this.text(
        x0 + col * 236,
        PANEL_Y + 14 + row * 40,
        entry.label,
        16,
        COLORS.sncb.text,
      )
        .setFixedSize(grid ? 224 : 470, 34)
        .setPadding(10, 7, 10, 7)
        .setInteractive({ useHandCursor: true });
      t.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        this.select(i);
      });
      t.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        this.select(i);
        this.confirm();
      });
      this.entryObjects.push(t);
    });
    this.helpText.setText(
      mode === 'main'
        ? 'Flèches : choisir · Entrée : valider'
        : 'Flèches : choisir · Entrée : valider · Échap : retour',
    );
    this.select(this.selected);
  }

  private clearMenu(): void {
    for (const o of this.entryObjects) o.destroy();
    this.entryObjects = [];
    this.entries = [];
  }

  private select(index: number): void {
    if (this.mode === 'target') {
      const n = this.targets.length;
      this.selected = ((index % n) + n) % n;
      this.showTargetCursor();
      return;
    }
    const n = this.entries.length;
    if (n === 0) return;
    this.selected = ((index % n) + n) % n;
    this.entryObjects.forEach((o, i) => {
      const entry = this.entries[i];
      const active = i === this.selected;
      o.setColor(
        toCss(
          !entry?.enabled
            ? COLORS.sncb.textMuted
            : active
              ? COLORS.sncb.boardText
              : COLORS.sncb.text,
        ),
      );
      o.setBackgroundColor(
        active && entry?.enabled ? toCss(COLORS.sncb.boardBg) : toCss(COLORS.sncb.panel),
      );
    });
    const hint = this.entries[this.selected]?.hint;
    if (hint) this.say(hint);
  }

  private move(dx: number, dy: number): void {
    if (this.mode === 'target') {
      this.select(this.selected + (dx !== 0 ? dx : dy));
      return;
    }
    if (this.mode === 'main') this.select(this.selected + dx + dy * 2);
    else if (this.mode === 'skills' || this.mode === 'items') this.select(this.selected + dy);
  }

  private confirm(): void {
    if (this.time.now < this.acceptInputAt) return;
    if (this.mode === 'end') {
      this.leave();
      return;
    }
    if (this.mode === 'target') {
      const id = this.targets[this.selected];
      if (id) this.pickTarget(id);
      return;
    }
    const entry = this.entries[this.selected];
    if (entry?.enabled) entry.run();
  }

  private back(): void {
    if (this.mode === 'skills' || this.mode === 'items' || this.mode === 'target') {
      this.pendingAction = null;
      this.targets = [];
      this.showTargetCursor();
      const actor = currentActor(this.battle);
      if (actor) this.openMainMenu(actor);
    }
  }

  // -------------------------------------------------------------------------
  // Fin du combat
  // -------------------------------------------------------------------------

  private finish(): void {
    this.mode = 'end';
    this.clearMenu();
    for (const v of this.views.values()) v.cursor.setVisible(false);
    const outcome = this.battle.outcome;
    if (outcome === 'victory') this.rewards = computeRewards(this.battle, Math.random);
    const lines =
      outcome === 'victory'
        ? [
            `Victoire !`,
            `+${String(this.rewards?.xp ?? 0)} XP · +${String(this.rewards?.tickets ?? 0)} T${(this.rewards?.coffeeBeans ?? 0) > 0 ? ` · +${String(this.rewards?.coffeeBeans ?? 0)} Grains` : ''}`,
          ]
        : outcome === 'fled'
          ? ['Repli stratégique.', 'Pas de récompense, +5 Fatigue.']
          : ['Défaite…', 'Mise à pied : retour à la case départ.'];
    const panel = this.add
      .rectangle(GAME_WIDTH / 2, 200, 520, 130, COLORS.sncb.bgDeep, 0.96)
      .setStrokeStyle(3, outcome === 'defeat' ? COLORS.semantic.danger : COLORS.sncb.accent)
      .setDepth(2000);
    const title = this.text(
      GAME_WIDTH / 2,
      160,
      lines[0] ?? '',
      28,
      outcome === 'defeat' ? COLORS.semantic.dangerText : COLORS.sncb.accent,
    )
      .setOrigin(0.5)
      .setFontStyle('bold')
      .setDepth(2001);
    const detail = this.text(GAME_WIDTH / 2, 215, lines[1] ?? '', 16, COLORS.sncb.text)
      .setOrigin(0.5)
      .setDepth(2001);
    void panel;
    void title;
    void detail;
    this.say('Entrée ou toucher pour continuer');
    this.helpText.setText('Entrée : continuer');
    this.acceptInputAt = this.time.now + 600;
  }

  /** Applique le résultat au GameState puis rend la main à la scène appelante. */
  private leave(): void {
    if (!this.battle.outcome) return;
    const outcome = this.battle.outcome;
    const report = reportFromBattle(this.battle, this.rewards);
    let notices: readonly string[] = [];
    updateGameState(this.registry, (state) => {
      const applied = applyBattleReport(state, report, this.setup.markerKey);
      notices = applied.notices;
      return applied.state;
    });
    for (const n of notices) pushNotice(this.registry, n);
    const resume: BattleResumeData = { battleOutcome: outcome };
    this.scene.stop();
    this.scene.resume(this.setup.caller, resume);
  }

  // -------------------------------------------------------------------------
  // Petits outils d'affichage
  // -------------------------------------------------------------------------

  private refreshPartyPanel(): void {
    const tier = fatigueTier(this.battle.fatigue);
    const rows = this.battle.combatants
      .filter((c) => c.side === 'party')
      .map(
        (c) =>
          `${c.name.padEnd(10).slice(0, 10)} PV ${String(c.hp).padStart(3)}/${String(c.maxHp)}  PE ${String(c.pe).padStart(2)}/${String(c.maxPe)}${c.ko ? '  K.O.' : ''}`,
      );
    this.partyText.setText(
      [
        ...rows,
        `Fatigue ${String(Math.floor(this.battle.fatigue))} (${tier.label}) · Gobelets ${String(this.battle.gobelets)}`,
      ].join('\n'),
    );
  }

  private highlight(id: string): void {
    for (const [cid, v] of this.views)
      v.name.setColor(toCss(cid === id ? COLORS.sncb.accent : COLORS.sncb.text));
  }

  private lunge(id: string): void {
    const v = this.views.get(id);
    const c = this.combatant(id);
    if (!v || !c) return;
    const dx = c.side === 'enemy' ? 24 : -24;
    this.tweens.add({ targets: v.sprite, x: v.sprite.x + dx, duration: 110, yoyo: true });
  }

  private floatText(id: string, text: string, color: number): void {
    const v = this.views.get(id);
    if (!v) return;
    const t = this.text(v.sprite.x, v.sprite.y - 80, text, 20, color)
      .setOrigin(0.5)
      .setStroke('#101828', 4)
      .setFontStyle('bold')
      .setDepth(1500);
    this.tweens.add({
      targets: t,
      y: t.y - 36,
      alpha: 0,
      duration: 900,
      onComplete: () => {
        t.destroy();
      },
    });
  }

  private say(text: string): void {
    this.logText.setText(text);
  }

  private text(
    x: number,
    y: number,
    text: string,
    size: number,
    color: number,
  ): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: `${String(size)}px`,
      color: toCss(color),
    });
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    const on = (keys: readonly string[], fn: () => void): void => {
      for (const k of keys) kb?.on(`keydown-${k}`, fn);
    };
    on(['LEFT', 'Q', 'A'], () => {
      this.move(-1, 0);
    });
    on(['RIGHT', 'D'], () => {
      this.move(1, 0);
    });
    on(['UP', 'Z', 'W'], () => {
      this.move(0, -1);
    });
    on(['DOWN', 'S'], () => {
      this.move(0, 1);
    });
    on(['ENTER', 'SPACE', 'E'], () => {
      this.confirm();
    });
    on(['ESC', 'BACKSPACE', 'X'], () => {
      this.back();
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      if (this.mode === 'end') this.confirm();
    });
  }
}
