/**
 * Menus DOM de l'entrée 3D (jamais three) : écran titre, pause, options, fenêtres de choix, écran des
 * départs, fondu de salle, invite contextuelle et barre du boss. Mouvement : GSAP (bibliothèque choisie
 * par le porteur, comme le site), réduit à rien en « Réduction des mouvements ». Navigation au clavier
 * (flèches, Entrée, chiffres, Échap), à la souris et au toucher.
 */
import { gsap } from 'gsap';
import type { ShiftResult } from '@/systems/meta/RunState';

export type QualityChoice = 'bas' | 'moyen' | 'haut';

export interface OptionsState {
  readonly quality: QualityChoice;
  readonly reducedMotion: boolean;
}

/** Réglages du son affichés dans les options (fournis par `src/audio`, sans dépendance). */
export interface AudioOptionValues {
  readonly master: number;
  readonly music: number;
  readonly sfx: number;
  readonly muted: boolean;
  readonly reduceRepetitive: boolean;
}

/** Branchement du son dans les options : lecture et écriture immédiate. */
export interface AudioOptionsHook {
  readonly get: () => AudioOptionValues;
  readonly set: (next: Partial<AudioOptionValues>) => void;
}

export interface ChoiceView {
  readonly title: string;
  readonly options: readonly {
    readonly title: string;
    readonly desc: string;
    readonly color?: string;
    readonly accent?: number;
  }[];
}

export interface PauseInfo {
  readonly seed: string;
  readonly avantages: readonly string[];
}

/** Écran titre : « Reprendre son poste » et « Effacer la progression » si une sauvegarde existe. */
export interface TitleOptions {
  readonly hasSave: boolean;
  /** Résumé de la sauvegarde (« 120 PS · 7 Shifts »), affiché sous le bouton de reprise. */
  readonly saveSummary?: string;
  readonly onNew: () => void;
  readonly onResume: () => void;
  readonly onErase: () => void;
  readonly onOptions: () => void;
}

/** Totaux sauvegardés, affichés sur l'écran des départs. */
export interface SavedTotals {
  readonly ps: number;
  readonly grains: number;
  readonly saved: boolean;
}

/** Butin du Shift sur l'écran des départs (loot) : noms colorés par rareté. */
export interface ResultsLoot {
  readonly found: number;
  /** Meilleur objet trouvé (« Dernier objet trouvé » de Rudy). */
  readonly best: { readonly name: string; readonly color: string } | null;
  readonly kept: readonly { readonly name: string; readonly color: string }[];
  readonly ferraille: number;
  /** Refus de la consigne (Vestiaire plein…), affiché tel quel. */
  readonly error: string | null;
}

type Screen = 'none' | 'title' | 'pause' | 'options' | 'choice' | 'results' | 'panel';

/** Barre d'un boss ou d'un ennemi majeur. */
export interface BossBarInfo {
  readonly name: string;
  readonly ratio: number;
  readonly phase: number;
  /** Nombre de phases (3 pour les boss, 2 pour les ennemis majeurs). */
  readonly phases?: number;
  /** Ennemi majeur (Salle gardée) : barre dorée. */
  readonly major?: boolean;
}

/** Entrée en scène d'un boss : nom, titre, réplique (fictive : personne réelle, LORE § 1.4). */
export interface BossIntroView {
  readonly name: string;
  readonly title: string;
  readonly line: string;
  readonly fictive: boolean;
}

/** Réplique en sous-titre. */
export interface LineView {
  readonly speaker: string;
  readonly text: string;
  readonly fictive: boolean;
}

/** Mention affichée à côté de toute réplique prêtée à une personne réelle. */
export const FICTIVE_TAG = 'réplique fictive';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

function button(
  parent: HTMLElement,
  label: string,
  cls: string,
  onClick: () => void,
): HTMLButtonElement {
  const b = el('button', `px-btn ${cls}`, parent, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export class Menus {
  private readonly layer: HTMLDivElement;
  private readonly fader: HTMLDivElement;
  private readonly promptEl: HTMLButtonElement;
  private readonly boss: HTMLDivElement;
  private readonly bossFill: HTMLDivElement;
  private readonly bossPhase: HTMLDivElement;
  private readonly bossName: HTMLDivElement;
  private readonly intro: HTMLDivElement;
  private readonly captions: HTMLDivElement;
  private introTimer: gsap.core.Tween | null = null;
  private readonly pauseBtn: HTMLButtonElement;
  private screen: Screen = 'none';
  /** Boutons navigables de l'écran courant et sélection clavier. */
  private focusables: HTMLElement[] = [];
  private sel = 0;
  private onEscape: (() => void) | null = null;
  private onDigit: ((i: number) => void) | null = null;
  private reduced = false;
  private promptKey = '';
  private readonly keyHandler: (e: KeyboardEvent) => void;

  public constructor(
    private readonly host: HTMLElement,
    private readonly onPromptTap: () => void,
    onPauseTap: () => void,
  ) {
    // Temps réel pour les menus : pas de « lissage du retard » (une frame lente ne ralentit pas l'UI).
    gsap.ticker.lagSmoothing(0);
    this.fader = el('div', 'px-fade', host);
    this.layer = el('div', 'px-layer px-scrim', host);
    this.layer.hidden = true;
    this.promptEl = el('button', 'px-prompt', host);
    this.promptEl.type = 'button';
    this.promptEl.hidden = true;
    this.promptEl.addEventListener('click', () => {
      this.onPromptTap();
    });
    this.boss = el('div', 'px-boss', host);
    this.boss.hidden = true;
    this.bossName = el('div', 'px-boss-name', this.boss);
    const bar = el('div', 'px-boss-bar', this.boss);
    this.bossFill = el('div', 'px-boss-fill', bar);
    this.bossPhase = el('div', 'px-boss-phase', this.boss);
    this.intro = el('div', 'px-intro', host);
    this.intro.hidden = true;
    this.intro.setAttribute('role', 'status');
    this.captions = el('div', 'px-captions', host);
    this.captions.setAttribute('aria-live', 'polite');
    this.pauseBtn = el('button', 'px-pause-btn', host, 'II');
    this.pauseBtn.type = 'button';
    this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.pauseBtn.hidden = true;
    this.pauseBtn.addEventListener('click', onPauseTap);
    this.keyHandler = (e) => {
      this.onKey(e);
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  public set reducedMotion(on: boolean) {
    this.reduced = on;
  }

  /** Un menu bloque le jeu (titre, pause, options, choix, résultats). */
  public get open(): boolean {
    return this.screen !== 'none';
  }

  public get current(): Screen {
    return this.screen;
  }

  /** Bouton pause visible pendant la partie (utile au tactile). */
  public showPauseButton(on: boolean): void {
    this.pauseBtn.hidden = !on;
  }

  // ─── Écrans ────────────────────────────────────────────────────────────────

  private mount(screen: Screen, build: (layer: HTMLDivElement) => HTMLElement): void {
    this.screen = screen;
    this.layer.replaceChildren();
    this.layer.hidden = false;
    this.layer.classList.toggle('px-scrim', true);
    this.onEscape = null;
    this.onDigit = null;
    const panel = build(this.layer);
    this.focusables = [...panel.querySelectorAll<HTMLElement>('.px-btn, .px-card')].filter(
      (b) => !b.classList.contains('px-seg'),
    );
    this.sel = 0;
    this.highlight();
    if (this.reduced) gsap.set(panel, { opacity: 1, y: 0 });
    else
      gsap.fromTo(
        panel,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'expo.out' },
      );
    const cards = panel.querySelectorAll('.px-card');
    if (cards.length > 0 && !this.reduced)
      gsap.fromTo(
        cards,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.7)', stagger: 0.07, delay: 0.08 },
      );
  }

  public close(): void {
    this.screen = 'none';
    this.layer.hidden = true;
    this.layer.replaceChildren();
    this.focusables = [];
    this.onEscape = null;
    this.onDigit = null;
  }

  public showTitle(o: TitleOptions): void {
    this.mount('title', (layer) => {
      const box = el('div', 'px-stack', layer);
      box.style.width = 'min(520px, 100%)';
      el('h1', 'px-logo', box, 'PRIVATIX');
      el(
        'p',
        'px-tagline',
        box,
        'Gare de Mons, 6 h du matin. Le rail est à vendre. Le 7h12 n’arrivera pas.',
      );
      if (o.hasSave) {
        button(box, 'Reprendre son poste', 'px-btn--primary', o.onResume);
        if (o.saveSummary) el('p', 'px-sub px-save', box, o.saveSummary);
      } else button(box, 'Prendre son service', 'px-btn--primary', o.onNew);
      button(box, 'Options', '', o.onOptions);
      if (o.hasSave) button(box, 'Effacer la progression', 'px-btn--ghost', o.onErase);
      const help = el('div', 'px-help', box);
      help.innerHTML =
        '<kbd>ZQSD</kbd> bouger · <kbd>Clic</kbd>/<kbd>J</kbd> frapper · <kbd>Espace</kbd> dash · ' +
        '<kbd>F</kbd> sifflet (maintenir : préavis) · <kbd>R</kbd> café · <kbd>E</kbd> interagir · <kbd>I</kbd> tenue · <kbd>Échap</kbd> pause';
      return box;
    });
  }

  /** Confirmation (Oui / Non) ; Échap répond non. */
  public showConfirm(
    title: string,
    text: string,
    yes: string,
    onYes: () => void,
    onNo: () => void,
  ): void {
    this.mount('panel', (layer) => {
      const panel = el('div', 'px-panel px-panel--danger', layer);
      el('h2', 'px-title', panel, title);
      el('p', 'px-sub', panel, text);
      const stack = el('div', 'px-stack', panel);
      button(stack, 'Non, garder', 'px-btn--primary', onNo);
      button(stack, yes, 'px-btn--ghost', onYes);
      this.onEscape = onNo;
      return panel;
    });
  }

  /**
   * Panneau libre (services du hub : Tableau des revendications, roulement, DPD, PACO) avec la même
   * navigation (flèches, Entrée, Échap) et la même entrée animée que les autres écrans. `animate`
   * à faux pour un rafraîchissement sur place (après un achat).
   */
  public showPanel(
    build: (layer: HTMLDivElement) => HTMLElement,
    onEscape: (() => void) | null,
    animate = true,
    keepSelection = false,
  ): void {
    const sel = this.sel;
    const was = this.reduced;
    if (!animate) this.reduced = true;
    this.mount('panel', build);
    this.reduced = was;
    this.onEscape = onEscape;
    if (keepSelection && this.focusables.length > 0) {
      this.sel = Math.min(sel, this.focusables.length - 1);
      this.highlight();
    }
  }

  public showPause(
    info: PauseInfo,
    onResume: () => void,
    onOptions: () => void,
    onAbandon: () => void,
  ): void {
    this.mount('pause', (layer) => {
      const panel = el('div', 'px-panel', layer);
      el('h2', 'px-title', panel, 'Pause');
      el(
        'p',
        'px-sub',
        panel,
        `« Ce n’est pas du temps de travail effectif. » · Graine ${info.seed}`,
      );
      const list = el('div', 'px-sub', panel);
      if (info.avantages.length === 0) list.textContent = 'Aucun Avantage acquis pour l’instant.';
      else for (const a of info.avantages) el('div', '', list, `• ${a}`);
      const stack = el('div', 'px-stack', panel);
      button(stack, 'Reprendre (Échap)', 'px-btn--primary', onResume);
      button(stack, 'Options', '', onOptions);
      button(stack, 'Abandonner le Shift', 'px-btn--ghost', onAbandon);
      this.onEscape = onResume;
      return panel;
    });
  }

  public showOptions(
    state: OptionsState,
    onChange: (next: OptionsState) => void,
    onBack: () => void,
    audio?: AudioOptionsHook,
  ): void {
    this.mount('options', (layer) => {
      const panel = el('div', 'px-panel', layer);
      el('h2', 'px-title', panel, 'Options');
      const stack = el('div', 'px-stack', panel);
      el('div', 'px-label', stack, 'Qualité graphique');
      const row = el('div', 'px-row', stack);
      for (const q of ['bas', 'moyen', 'haut'] as const) {
        const b = button(row, q, 'px-seg', () => {
          onChange({ ...state, quality: q });
        });
        b.setAttribute('aria-pressed', String(state.quality === q));
      }
      el('div', 'px-label', stack, 'Accessibilité');
      const rm = button(
        stack,
        `Réduction des mouvements : ${state.reducedMotion ? 'oui' : 'non'}`,
        '',
        () => {
          onChange({ ...state, reducedMotion: !state.reducedMotion });
        },
      );
      rm.setAttribute('aria-pressed', String(state.reducedMotion));
      el(
        'p',
        'px-sub',
        stack,
        'Aucun clignotement, secousses divisées par deux, pas de zoom sur le coup 3.',
      );
      if (audio) this.audioOptions(stack, audio);
      button(stack, 'Retour', 'px-btn--primary', onBack);
      this.onEscape = onBack;
      return panel;
    });
  }

  /** Section « Son » des options : volumes (maître, musique, effets), coupure, sons répétitifs. */
  private audioOptions(stack: HTMLElement, audio: AudioOptionsHook): void {
    el('div', 'px-label', stack, 'Son');
    const sliders: [keyof AudioOptionValues, string][] = [
      ['master', 'Volume général'],
      ['music', 'Musique'],
      ['sfx', 'Effets'],
    ];
    for (const [key, label] of sliders) {
      const row = el('label', 'px-range', stack);
      el('span', '', row, label);
      const input = el('input', '', row);
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.step = '5';
      const value = el('output', '', row);
      const sync = (): void => {
        const v = Number(audio.get()[key]);
        input.value = String(Math.round(v * 100));
        value.textContent = `${String(Math.round(v * 100))} %`;
      };
      sync();
      input.addEventListener('input', () => {
        audio.set({ [key]: Number(input.value) / 100 });
        sync();
      });
    }
    const toggle = (key: 'muted' | 'reduceRepetitive', label: string): void => {
      const b = button(stack, '', '', () => {
        audio.set({ [key]: !audio.get()[key] });
        sync();
      });
      const sync = (): void => {
        const on = audio.get()[key];
        b.textContent = `${label} : ${on ? 'oui' : 'non'}`;
        b.setAttribute('aria-pressed', String(on));
      };
      sync();
    };
    toggle('muted', 'Couper le son');
    toggle('reduceRepetitive', 'Réduire les sons répétitifs');
  }

  /** Fenêtre de choix (Avantages, machine à café, salle des pauses) : touches 1 à 3 ou clic. */
  public showChoice(choice: ChoiceView, onPick: (index: number) => void): void {
    this.mount('choice', (layer) => {
      const panel = el('div', 'px-panel px-panel--wide', layer);
      el('h2', 'px-title', panel, choice.title);
      el('p', 'px-sub', panel, 'Choisir une option (1, 2, 3 ou clic).');
      const cards = el('div', 'px-cards', panel);
      choice.options.forEach((o, i) => {
        const c = el('button', 'px-card', cards);
        c.type = 'button';
        if (o.accent !== undefined)
          c.style.setProperty('--rc', `#${o.accent.toString(16).padStart(6, '0')}`);
        if (o.color) c.style.setProperty('--tc', o.color);
        el('b', '', c, o.title);
        el('span', '', c, o.desc);
        el('span', 'px-key', c, `[${String(i + 1)}]`);
        c.addEventListener('click', () => {
          onPick(i);
        });
      });
      this.onDigit = (i) => {
        if (i < choice.options.length) onPick(i);
      };
      return panel;
    });
  }

  /** Écran des départs (port de `ResultsScene`). */
  public showResults(
    result: ShiftResult,
    clock: string,
    totals: SavedTotals,
    onContinue: () => void,
    loot: ResultsLoot | null = null,
  ): void {
    this.mount('results', (layer) => {
      const won = result.end === 'victoire';
      const panel = el('div', `px-panel ${won ? '' : 'px-panel--danger'}`, layer);
      el('h2', 'px-title', panel, 'Départs — Gare de Mons');
      el(
        'div',
        `px-status ${won ? 'px-status--ok' : 'px-status--ko'}`,
        panel,
        won ? 'À L’HEURE — SHIFT TENU' : 'SUPPRIMÉ',
      );
      const table = el('table', 'px-board', panel);
      const rows: [string, string][] = [
        ['Fin de service', won ? clock : `anticipée à ${clock}`],
        ['Cause', won ? 'L’Auditeur des Quais est rentré chez lui' : (result.cause ?? 'Fatigue')],
        ['Salle atteinte', `${String(result.room)} / 10`],
        ['Ennemis renvoyés', String(result.kills)],
        ['Avantages acquis', String(result.avantages)],
        ['Points de Syndicalisme', `+${String(result.psEarned)}`],
        ['Grains de café', `+${String(result.grainsEarned)}`],
      ];
      for (const [k, v] of rows) {
        const tr = el('tr', '', table);
        el('td', '', tr, k);
        el('td', '', tr, v);
      }
      if (loot) {
        const colored = (k: string, items: readonly { name: string; color: string }[]): void => {
          const tr = el('tr', 'px-board-loot', table);
          el('td', '', tr, k);
          const td = el('td', '', tr);
          if (items.length === 0) td.textContent = '—';
          items.forEach((it, i) => {
            if (i > 0) td.append(', ');
            const b = el('b', '', td, it.name);
            b.style.color = it.color;
          });
        };
        const tr = el('tr', '', table);
        el('td', '', tr, 'Objets trouvés');
        el('td', '', tr, String(loot.found));
        if (loot.best) colored('Plus belle trouvaille', [loot.best]);
        colored('Ramené au Vestiaire', loot.kept);
        const fe = el('tr', '', table);
        el('td', '', fe, 'Ferraille');
        el('td', '', fe, `+${String(loot.ferraille)}`);
        if (loot.error) el('p', 'px-sub', panel, `Consigne refusée (${loot.error}) : rien gardé.`);
      }
      el(
        'p',
        'px-sub',
        panel,
        totals.saved
          ? `Acquis, sauvegardé : ${String(totals.ps)} PS et ${String(totals.grains)} Grains au total. Les collègues t’attendent à l’OCC.`
          : `Acquis : ${String(totals.ps)} PS et ${String(totals.grains)} Grains au total (stockage du navigateur indisponible : progression non sauvegardée).`,
      );
      button(panel, 'Retour à l’OCC (Entrée)', 'px-btn--primary', onContinue);
      if (!this.reduced)
        gsap.fromTo(
          table.querySelectorAll('tr'),
          { opacity: 0, x: -12 },
          { opacity: 1, x: 0, duration: 0.25, stagger: 0.06, delay: 0.2, ease: 'expo.out' },
        );
      return panel;
    });
  }

  // ─── Fondu, invite, boss ───────────────────────────────────────────────────

  /** Fondu au noir (`to` = 1) ou retour (`to` = 0), en temps réel. */
  public fade(to: number, ms: number): void {
    gsap.killTweensOf(this.fader);
    if (this.reduced || ms <= 0) gsap.set(this.fader, { opacity: to });
    else gsap.to(this.fader, { opacity: to, duration: ms / 1000, ease: 'power2.inOut' });
  }

  /** Invite contextuelle au-dessus d'un objet (coordonnées écran), ou `null` pour la cacher. */
  public setPrompt(label: string | null, x: number, y: number, keyHint: boolean): void {
    if (label === null) {
      this.promptEl.hidden = true;
      this.promptKey = '';
      return;
    }
    const key = `${label}|${String(keyHint)}`;
    if (key !== this.promptKey) {
      this.promptKey = key;
      this.promptEl.innerHTML = '';
      if (keyHint) el('kbd', '', this.promptEl, 'E');
      this.promptEl.append(label);
    }
    this.promptEl.hidden = false;
    this.promptEl.style.left = `${x.toFixed(0)}px`;
    this.promptEl.style.top = `${y.toFixed(0)}px`;
  }

  public setBoss(info: BossBarInfo | null): void {
    if (!info) {
      this.boss.hidden = true;
      return;
    }
    this.boss.hidden = false;
    this.boss.classList.toggle('is-major', info.major === true);
    if (this.bossName.textContent !== info.name) this.bossName.textContent = info.name;
    this.bossFill.style.transform = `scaleX(${Math.max(0, Math.min(1, info.ratio)).toFixed(3)})`;
    const phase = `Phase ${String(info.phase)} / ${String(info.phases ?? 3)}`;
    if (this.bossPhase.textContent !== phase) this.bossPhase.textContent = phase;
  }

  /**
   * Carte d'entrée en scène d'un boss (nom, titre, réplique), quelques secondes, sans bloquer le jeu.
   * Une réplique prêtée à une personne réelle porte la mention « réplique fictive ».
   */
  public showBossIntro(v: BossIntroView, seconds = 3.2): void {
    const box = this.intro;
    box.innerHTML = '';
    el('div', 'px-intro-name', box, v.name);
    el('div', 'px-intro-title', box, v.title);
    const q = el('div', 'px-intro-line', box, `« ${v.line} »`);
    if (v.fictive) el('span', 'px-fictive', q, FICTIVE_TAG);
    box.hidden = false;
    gsap.killTweensOf(box);
    if (this.reduced) gsap.set(box, { opacity: 1, y: 0 });
    else
      gsap.fromTo(
        box,
        { opacity: 0, y: -16 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
      );
    this.introTimer?.kill();
    // Minuteries sur l'horloge de GSAP (et non `setTimeout`) : le mode capture la pilote image par image.
    this.introTimer = gsap.delayedCall(seconds, () => {
      this.introTimer = null;
      if (this.reduced) {
        box.hidden = true;
        return;
      }
      gsap.to(box, {
        opacity: 0,
        duration: 0.4,
        onComplete: () => {
          box.hidden = true;
        },
      });
    });
  }

  /** Réplique en sous-titre (au plus trois à l'écran) ; « réplique fictive » si c'est le cas. */
  public showLine(v: LineView, seconds = 3.6): void {
    const row = el('div', 'px-caption', this.captions);
    el('span', 'px-caption-who', row, v.speaker);
    el('span', 'px-caption-text', row, v.text);
    if (v.fictive) el('span', 'px-fictive', row, FICTIVE_TAG);
    while (this.captions.children.length > 3) this.captions.firstElementChild?.remove();
    if (!this.reduced) gsap.fromTo(row, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25 });
    gsap.delayedCall(seconds, () => {
      if (this.reduced) {
        row.remove();
        return;
      }
      gsap.to(row, {
        opacity: 0,
        duration: 0.35,
        onComplete: () => {
          row.remove();
        },
      });
    });
  }

  /** Efface la carte d'intro et les sous-titres (changement d'écran). */
  public clearCaptions(): void {
    this.introTimer?.kill();
    this.introTimer = null;
    this.intro.hidden = true;
    this.captions.innerHTML = '';
  }

  // ─── Clavier ───────────────────────────────────────────────────────────────

  private highlight(): void {
    this.focusables.forEach((b, i) => b.classList.toggle('is-sel', i === this.sel));
  }

  private onKey(e: KeyboardEvent): void {
    if (this.screen === 'none' || e.repeat) return;
    // Un curseur focalisé garde ses flèches (réglage du volume au clavier).
    if (e.target instanceof HTMLInputElement && e.code.startsWith('Arrow')) return;
    const n = this.focusables.length;
    switch (e.code) {
      case 'ArrowDown':
      case 'ArrowRight':
      case 'KeyS':
      case 'KeyD':
        if (n > 0) this.sel = (this.sel + 1) % n;
        this.highlight();
        e.preventDefault();
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
      case 'KeyW':
      case 'KeyA':
        if (n > 0) this.sel = (this.sel - 1 + n) % n;
        this.highlight();
        e.preventDefault();
        break;
      case 'Enter':
      case 'Space':
        if (
          document.activeElement instanceof HTMLButtonElement &&
          document.activeElement !== document.body
        ) {
          // Le bouton focalisé (Tab) reçoit son propre clic natif.
          if (this.focusables.includes(document.activeElement)) return;
        }
        this.focusables[this.sel]?.click();
        e.preventDefault();
        break;
      case 'Escape':
        this.onEscape?.();
        e.preventDefault();
        break;
      default:
        if (/^Digit[1-9]$/.test(e.code) && this.onDigit) {
          this.onDigit(Number(e.code.slice(5)) - 1);
          e.preventDefault();
        }
    }
  }

  public dispose(): void {
    document.removeEventListener('keydown', this.keyHandler);
    gsap.killTweensOf(this.fader);
    this.layer.remove();
    this.fader.remove();
    this.promptEl.remove();
    this.boss.remove();
    this.introTimer?.kill();
    this.intro.remove();
    this.captions.remove();
    this.pauseBtn.remove();
  }

  public get root(): HTMLElement {
    return this.host;
  }
}
