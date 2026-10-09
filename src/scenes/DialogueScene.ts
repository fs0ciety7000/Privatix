import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, INPUT_GRACE_MS, SceneKeys } from '@/config/constants';
import { COLORS, toCss } from '@/config/colors';
import { CHARACTERS } from '@/data/characters';
import { DIALOGUES } from '@/data/dialogues';
import { OBJECTIVES, OBJECTIVES_DONE_TEXT } from '@/data/objectives';
import { OCC_CODE, OCC_ENTRANCE } from '@/data/story';
import type { VendingButton } from '@/data/story';
import type { DialogueChoice, DialogueDef, EncounterId } from '@/data/types';
import { browserStorage } from '@/platform/storage';
import type { GameState } from '@/systems/GameState';
import { spawnPosition } from '@/systems/GameState';
import { SaveManager } from '@/systems/save/SaveManager';
import type { DialogueStep } from '@/systems/story/DialogueRunner';
import {
  advance,
  choose,
  contextOf,
  currentNode,
  startDialogue,
  visibleChoices,
} from '@/systems/story/DialogueRunner';
import { currentObjective } from '@/systems/story/Objectives';
import { interpolate, textTokens } from '@/systems/story/TextTokens';
import { MAX_PRESSES, matchesCode, summarizePresses } from '@/systems/vending/VendingCode';
import type { DialogueSceneData } from '@/scenes/GameScene';
import type { BattleResumeData, BattleSceneData } from '@/scenes/BattleScene';
import { isBattleResume } from '@/scenes/battleResume';
import { getGameState, pushNotice, updateGameState } from '@/utils/registry';

const BOX = { x: 16, y: 372, w: 928, h: 152 } as const;
const TEXT = { x: 40, y: 400, w: 880 } as const;
const CHARS_PER_SECOND = 45;
const CHOICE_ROW = 40;

type Mode = 'text' | 'choices' | 'keypad';

/**
 * Dialogue : overlay qui met GameScene en pause (UX § 3.4).
 * Affiche les nœuds lettre par lettre, propose les choix, applique les étapes du DialogueRunner au GameState,
 * exécute les actions de scène (sauvegarde, clavier du distributeur), puis rend la main à GameScene.
 */
export class DialogueScene extends Phaser.Scene {
  private def!: DialogueDef;
  private nodeId: string | null = null;
  private mode: Mode = 'text';
  private pendingKeypad = false;
  /** Combat annoncé par le nœud affiché : il se joue quand le joueur valide ce nœud. */
  private pendingBattle: EncounterId | null = null;
  private acceptInputAt = 0;

  private box!: Phaser.GameObjects.Rectangle;
  private nameTab!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private indicator!: Phaser.GameObjects.Text;
  private choiceObjects: Phaser.GameObjects.GameObject[] = [];
  private choices: readonly DialogueChoice[] = [];
  private selected = 0;

  private fullText = '';
  private shownChars = 0;
  private typing: Phaser.Time.TimerEvent | null = null;

  private presses: VendingButton[] = [];
  private keypadObjects: Phaser.GameObjects.GameObject[] = [];
  private keypadScreen: Phaser.GameObjects.Text | null = null;

  public constructor() {
    super(SceneKeys.Dialogue);
  }

  public create(data: DialogueSceneData): void {
    const def = (DIALOGUES as Readonly<Record<string, DialogueDef>>)[data.dialogueId];
    if (!def) throw new Error(`Dialogue inconnu : ${data.dialogueId}`);
    this.def = def;
    this.mode = 'text';
    this.pendingKeypad = false;
    this.pendingBattle = null;
    this.choiceObjects = [];
    this.keypadObjects = [];
    this.keypadScreen = null;
    this.presses = [];
    this.typing = null;
    this.acceptInputAt = this.time.now + INPUT_GRACE_MS;

    this.box = this.add.rectangle(BOX.x, BOX.y, BOX.w, BOX.h, COLORS.sncb.panel, 0.96).setOrigin(0);
    this.nameTab = this.add.text(BOX.x + 16, BOX.y - 30, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      padding: { x: 10, y: 5 },
    });
    this.body = this.add.text(TEXT.x, TEXT.y, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      lineSpacing: 8,
      wordWrap: { width: TEXT.w, useAdvancedWrap: true },
    });
    this.indicator = this.add.text(BOX.x + BOX.w - 28, BOX.y + BOX.h - 30, '▼', {
      fontFamily: 'monospace',
      fontSize: '16px',
    });
    this.tweens.add({ targets: this.indicator, alpha: 0.2, duration: 250, yoyo: true, repeat: -1 });

    this.setupInput();
    this.events.on(Phaser.Scenes.Events.RESUME, this.onBattleEnd, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, this.onBattleEnd, this);
    });
    this.applyStep(startDialogue(this.def, getGameState(this.registry)));
  }

  // -------------------------------------------------------------------------
  // Déroulement
  // -------------------------------------------------------------------------

  private applyStep(step: DialogueStep): void {
    updateGameState(this.registry, () => step.state);
    for (const notice of step.notices) pushNotice(this.registry, notice);
    for (const action of step.actions) {
      if (action.kind === 'save') this.save(step.state);
      if (action.kind === 'keypad') this.pendingKeypad = true;
      if (action.kind === 'battle') this.pendingBattle = action.encounter;
    }
    this.nodeId = step.nodeId;
    if (this.nodeId === null) {
      this.finish();
      return;
    }
    this.showNode();
  }

  private showNode(): void {
    if (this.nodeId === null) return;
    const state = getGameState(this.registry);
    const node = currentNode(this.def, this.nodeId);
    const tokens = this.tokens(state);
    const speaker = CHARACTERS[node.speaker];
    const theme = speaker.theme === 'occ' ? COLORS.occ : COLORS.sncb;

    this.box.setFillStyle(theme.panel, 0.96).setStrokeStyle(2, theme.accent);
    const name = interpolate(speaker.name, tokens);
    this.nameTab
      .setText(name)
      .setVisible(name.length > 0)
      .setColor(toCss(theme.bgDeep))
      .setBackgroundColor(toCss(theme.accent));
    this.body.setColor(toCss(theme.text));
    this.indicator.setColor(toCss(theme.accent)).setVisible(false);

    this.clearChoices();
    this.choices = visibleChoices(this.def, this.nodeId, state);
    this.mode = 'text';
    this.startTyping(interpolate(node.text, tokens));
  }

  /** Mise en page calculée avant l'animation : un mot ne saute jamais de ligne pendant l'écriture. */
  private startTyping(text: string): void {
    this.fullText = this.body.getWrappedText(text).join('\n');
    this.shownChars = 0;
    this.body.setText('');
    this.typing?.remove();
    this.typing = this.time.addEvent({
      delay: 1000 / CHARS_PER_SECOND,
      loop: true,
      callback: () => {
        this.shownChars += 1;
        this.body.setText(this.fullText.slice(0, this.shownChars));
        if (this.shownChars >= this.fullText.length) this.endTyping();
      },
    });
  }

  private endTyping(): void {
    this.typing?.remove();
    this.typing = null;
    this.body.setText(this.fullText);
    if (this.choices.length > 0) {
      this.showChoices();
    } else {
      this.indicator
        .setText(this.nodeId !== null && currentNode(this.def, this.nodeId).next ? '▼' : '■')
        .setVisible(true);
    }
  }

  private confirm(): void {
    if (this.time.now < this.acceptInputAt || this.nodeId === null) return;
    if (this.mode === 'keypad') return;
    if (this.typing) {
      this.endTyping();
      return;
    }
    if (this.mode === 'choices') {
      this.pick(this.selected);
      return;
    }
    if (this.pendingBattle) {
      this.startBattle(this.pendingBattle);
      return;
    }
    this.applyStep(advance(this.def, this.nodeId, getGameState(this.registry)));
  }

  private pick(index: number): void {
    if (this.nodeId === null || this.mode !== 'choices' || !this.choices[index]) return;
    this.applyStep(choose(this.def, this.nodeId, getGameState(this.registry), index));
  }

  private finish(): void {
    this.typing?.remove();
    this.typing = null;
    if (this.pendingKeypad) {
      this.pendingKeypad = false;
      this.openKeypad();
      return;
    }
    this.close();
  }

  private close(resumeData?: BattleResumeData): void {
    this.events.off(Phaser.Scenes.Events.RESUME, this.onBattleEnd, this);
    this.scene.resume(SceneKeys.Game, resumeData);
    this.scene.stop();
  }

  private startBattle(encounterId: EncounterId): void {
    this.pendingBattle = null;
    const data: BattleSceneData = { encounterId, caller: SceneKeys.Dialogue };
    this.scene.pause();
    this.scene.launch(SceneKeys.Battle, data);
  }

  /** Retour du combat : victoire ou fuite → le dialogue continue ; défaite → il s'interrompt (Mise à pied). */
  private onBattleEnd(_sys: Phaser.Scenes.Systems, data?: unknown): void {
    this.acceptInputAt = this.time.now + INPUT_GRACE_MS;
    if (isBattleResume(data) && data.battleOutcome === 'defeat') {
      this.close(data);
      return;
    }
    if (this.nodeId !== null)
      this.applyStep(advance(this.def, this.nodeId, getGameState(this.registry)));
  }

  // -------------------------------------------------------------------------
  // Choix
  // -------------------------------------------------------------------------

  private showChoices(): void {
    this.mode = 'choices';
    this.selected = 0;
    const width = 420;
    const x = GAME_WIDTH - width - 16;
    const y = BOX.y - 16 - this.choices.length * CHOICE_ROW;
    const panel = this.add
      .rectangle(x, y, width, this.choices.length * CHOICE_ROW + 8, COLORS.sncb.bgDeep, 0.96)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.sncb.accent);
    this.choiceObjects.push(panel);
    this.choices.forEach((choice, i) => {
      const label = this.add
        .text(
          x + 16,
          y + 8 + i * CHOICE_ROW,
          `${String(i + 1)}. ${interpolate(choice.label, this.tokens(getGameState(this.registry)))}`,
          {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: toCss(COLORS.sncb.text),
            fixedWidth: width - 32,
            padding: { y: 8 },
          },
        )
        .setInteractive({ useHandCursor: true });
      label.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        this.select(i);
      });
      label.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        this.select(i);
        this.pick(i);
      });
      this.choiceObjects.push(label);
    });
    this.select(0);
  }

  private select(index: number): void {
    const count = this.choices.length;
    if (count === 0) return;
    this.selected = (index + count) % count;
    this.choiceObjects.slice(1).forEach((o, i) => {
      if (o instanceof Phaser.GameObjects.Text) {
        o.setColor(toCss(i === this.selected ? COLORS.sncb.accent : COLORS.sncb.text));
        o.setBackgroundColor(i === this.selected ? toCss(COLORS.sncb.panel) : 'transparent');
      }
    });
  }

  private clearChoices(): void {
    for (const o of this.choiceObjects) o.destroy();
    this.choiceObjects = [];
    this.choices = [];
  }

  // -------------------------------------------------------------------------
  // Clavier du distributeur « HORS SERVICE »
  // -------------------------------------------------------------------------

  private openKeypad(): void {
    this.mode = 'keypad';
    this.nodeId = 'keypad';
    this.presses = [];
    this.clearChoices();
    this.box.setVisible(false);
    this.nameTab.setVisible(false);
    this.body.setVisible(false);
    this.indicator.setVisible(false);
    this.acceptInputAt = this.time.now + INPUT_GRACE_MS;

    const cx = GAME_WIDTH / 2;
    const panel = this.add
      .rectangle(cx, GAME_HEIGHT / 2, 520, 300, 0x2a2f3a, 0.98)
      .setStrokeStyle(3, 0x9aa1ad);
    const title = this.add
      .text(cx, GAME_HEIGHT / 2 - 125, 'DISTRIBUTEUR — HORS SERVICE', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ff8080',
      })
      .setOrigin(0.5);
    this.keypadScreen = this.add
      .text(cx, GAME_HEIGHT / 2 - 80, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#5bd17a',
        backgroundColor: '#05080f',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5);
    const help = this.add
      .text(
        cx,
        GAME_HEIGHT / 2 + 115,
        '1/2/3 : boissons · Retour : effacer · Entrée : valider · Échap : partir',
        {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#9fb0c6',
        },
      )
      .setOrigin(0.5);
    this.keypadObjects.push(panel, title, this.keypadScreen, help);

    const buttons: readonly [string, () => void][] = [
      [
        '1 Expresso',
        () => {
          this.press('expresso');
        },
      ],
      [
        '2 Lungo',
        () => {
          this.press('lungo');
        },
      ],
      [
        '3 Sucre +',
        () => {
          this.press('sucre');
        },
      ],
      [
        'Effacer',
        () => {
          this.erase();
        },
      ],
      [
        'Valider',
        () => {
          this.validateKeypad();
        },
      ],
      [
        'Partir',
        () => {
          this.closeKeypad(false);
        },
      ],
    ];
    buttons.forEach(([label, action], i) => {
      const bx = cx - 160 + (i % 3) * 160;
      const by = GAME_HEIGHT / 2 - 10 + Math.floor(i / 3) * 70;
      const button = this.add
        .text(bx, by, label, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#101828',
          backgroundColor: i < 3 ? '#f2a541' : '#d0d4da',
          fixedWidth: 140,
          align: 'center',
          padding: { y: 16 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, action);
      this.keypadObjects.push(button);
    });
    this.refreshKeypad();
  }

  private press(button: VendingButton): void {
    if (this.mode !== 'keypad' || this.time.now < this.acceptInputAt) return;
    this.presses.push(button);
    if (this.presses.length >= MAX_PRESSES) this.validateKeypad();
    else this.refreshKeypad();
  }

  private erase(): void {
    if (this.mode !== 'keypad') return;
    this.presses = [];
    this.refreshKeypad();
  }

  private refreshKeypad(): void {
    this.keypadScreen?.setText(
      this.presses.length === 0 ? 'Choisissez votre boisson' : summarizePresses(this.presses),
    );
  }

  private validateKeypad(): void {
    if (this.mode !== 'keypad' || this.time.now < this.acceptInputAt) return;
    this.closeKeypad(matchesCode(this.presses, OCC_CODE));
  }

  private closeKeypad(success: boolean): void {
    if (this.mode !== 'keypad') return;
    if (success) {
      updateGameState(this.registry, (s) => ({
        ...s,
        position: spawnPosition(OCC_ENTRANCE.map, OCC_ENTRANCE.spawn),
      }));
      pushNotice(this.registry, 'Boisson indisponible pour raison de circulation.');
      pushNotice(this.registry, 'Le mur pivote…');
    } else if (this.presses.length > 0) {
      pushNotice(this.registry, 'Boisson indisponible.');
    }
    for (const o of this.keypadObjects) o.destroy();
    this.keypadObjects = [];
    this.close();
  }

  // -------------------------------------------------------------------------
  // Divers
  // -------------------------------------------------------------------------

  private tokens(state: GameState): Readonly<Record<string, string>> {
    const objective = currentObjective(OBJECTIVES, contextOf(state));
    return textTokens(state, objective?.text ?? OBJECTIVES_DONE_TEXT);
  }

  private save(state: GameState): void {
    const ok = new SaveManager(browserStorage()).save('slot-1', state);
    pushNotice(
      this.registry,
      ok ? 'Partie sauvegardée' : 'Sauvegarde impossible (stockage du navigateur indisponible)',
    );
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    for (const event of ['keydown-E', 'keydown-SPACE', 'keydown-ENTER']) {
      kb?.on(event, () => {
        if (this.mode === 'keypad') this.validateKeypad();
        else this.confirm();
      });
    }
    for (const event of ['keydown-UP', 'keydown-Z', 'keydown-W'])
      kb?.on(event, () => {
        this.select(this.selected - 1);
      });
    for (const event of ['keydown-DOWN', 'keydown-S'])
      kb?.on(event, () => {
        this.select(this.selected + 1);
      });
    const digits: readonly [string, number][] = [
      ['ONE', 0],
      ['TWO', 1],
      ['THREE', 2],
      ['FOUR', 3],
    ];
    for (const [key, index] of digits) {
      kb?.on(`keydown-${key}`, () => {
        const button = (['expresso', 'lungo', 'sucre'] as const)[index];
        if (this.mode !== 'keypad') this.pick(index);
        else if (button) this.press(button);
      });
    }
    kb?.on('keydown-BACKSPACE', () => {
      this.erase();
    });
    kb?.on('keydown-ESC', () => {
      if (this.mode === 'keypad') this.closeKeypad(false);
    });
    this.box.setInteractive();
    this.box.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (this.mode === 'text') this.confirm();
    });
  }
}
