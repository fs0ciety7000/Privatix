/**
 * UI DOM du hub 3D (jamais three) : barre des monnaies et du roulement, bulles de dialogue au-dessus des
 * PNJ, étiquette du mannequin (dégâts et DPS), bandeau de lieu, et les panneaux des services :
 * Tableau des revendications (Marcel), roulement (Yasmina), lecture, DPD et PACO (points d'entrée du
 * loot, `services.ts`). Les panneaux passent par `Menus.showPanel` : même navigation, mêmes tokens.
 */
import { gsap } from 'gsap';
import type { ShiftId } from '@/config/balance';
import type { MetaState, UpgradeId } from '@/systems/meta/MetaState';
import { nextCost, rankOf, UPGRADES } from '@/systems/meta/MetaState';
import type { Menus } from '@/ui/menus/Menus';
import type { HubServiceContext, HubServiceId, HubServices } from '@/ui/hub/services';
import { SERVICE_PREVIEW } from '@/ui/hub/services';

export interface HubBarInfo {
  readonly ps: number;
  readonly grains: number;
  readonly pieces: number;
  readonly shiftLabel: string;
  readonly place: string;
}

export interface RosterOption {
  readonly id: ShiftId;
  readonly label: string;
  readonly desc: string;
  readonly locked: boolean;
}

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

/** Durée d'une bulle de dialogue (s), selon la longueur de la réplique. */
function bubbleSeconds(text: string): number {
  return Math.min(7, 2.4 + text.length * 0.045);
}

export class HubUi {
  private readonly bar: HTMLDivElement;
  private readonly barPs: HTMLElement;
  private readonly barGrains: HTMLElement;
  private readonly barPieces: HTMLElement;
  private readonly barShift: HTMLElement;
  private readonly barPlace: HTMLElement;
  private readonly bubble: HTMLDivElement;
  /** Contenu animé (GSAP) ; le conteneur garde son placement en CSS. */
  private readonly bubbleIn: HTMLDivElement;
  private readonly toastIn: HTMLDivElement;
  private readonly bubbleName: HTMLElement;
  private readonly bubbleText: HTMLElement;
  private readonly dummy: HTMLDivElement;
  private readonly toastEl: HTMLDivElement;
  private bubbleLeft = 0;
  private lastPs = -1;
  private reduced = false;

  public constructor(
    host: HTMLElement,
    private readonly menus: Menus,
    private readonly services: HubServices,
  ) {
    this.bar = el('div', 'hub-bar', host);
    const money = el('div', 'hub-money', this.bar);
    const cell = (label: string, cls: string): HTMLElement => {
      const c = el('div', `hub-cell ${cls}`, money);
      const v = el('b', '', c, '0');
      el('span', '', c, label);
      return v;
    };
    this.barPs = cell('PS', 'hub-cell--ps');
    this.barGrains = cell('Grains', 'hub-cell--grains');
    this.barPieces = cell('Pièces', 'hub-cell--pieces');
    const where = el('div', 'hub-where', this.bar);
    this.barPlace = el('b', '', where, '');
    this.barShift = el('span', '', where, '');
    this.bubble = el('div', 'hub-bubble', host);
    this.bubble.hidden = true;
    this.bubbleIn = el('div', 'hub-bubble-in', this.bubble);
    this.bubbleName = el('b', '', this.bubbleIn);
    this.bubbleText = el('span', '', this.bubbleIn);
    this.dummy = el('div', 'hub-dummy', host);
    this.dummy.hidden = true;
    this.toastEl = el('div', 'hub-toast', host);
    this.toastEl.hidden = true;
    this.toastIn = el('div', 'hub-toast-in', this.toastEl);
    this.setVisible(false);
  }

  public set reducedMotion(on: boolean) {
    this.reduced = on;
  }

  public setVisible(on: boolean): void {
    this.bar.hidden = !on;
    if (!on) {
      this.bubble.hidden = true;
      this.dummy.hidden = true;
      this.toastEl.hidden = true;
    }
  }

  public setInfo(info: HubBarInfo): void {
    if (info.ps !== this.lastPs && this.lastPs >= 0 && !this.reduced)
      gsap.fromTo(this.barPs, { scale: 1.35 }, { scale: 1, duration: 0.4, ease: 'back.out(2)' });
    this.lastPs = info.ps;
    this.barPs.textContent = String(info.ps);
    this.barGrains.textContent = String(info.grains);
    this.barPieces.textContent = String(info.pieces);
    this.barPlace.textContent = info.place;
    this.barShift.textContent = `Roulement : ${info.shiftLabel}`;
  }

  /** Bandeau de lieu (entrée dans une zone). */
  public toast(text: string): void {
    this.toastIn.textContent = text;
    this.toastEl.hidden = false;
    gsap.killTweensOf(this.toastIn);
    gsap.set(this.toastIn, { opacity: 1, y: 0 });
    if (!this.reduced) gsap.from(this.toastIn, { y: -10, duration: 0.35, ease: 'expo.out' });
    gsap.to(this.toastIn, { opacity: 0, delay: 2.2, duration: this.reduced ? 0.01 : 0.5 });
  }

  /** Réplique d'un PNJ dans une bulle (suit la position écran donnée par `place`). */
  public say(speaker: string, text: string): void {
    this.bubbleName.textContent = speaker;
    this.bubbleText.textContent = `« ${text} »`;
    this.bubble.hidden = false;
    this.bubbleLeft = bubbleSeconds(text);
    gsap.killTweensOf(this.bubbleIn);
    gsap.set(this.bubbleIn, { scale: 1 });
    if (!this.reduced)
      gsap.from(this.bubbleIn, { scale: 0.85, duration: 0.25, ease: 'back.out(2)' });
  }

  /** Avance la bulle et la place au-dessus de son PNJ (coordonnées écran) ; `null` : on s'est éloigné. */
  public updateBubble(dt: number, at: { x: number; y: number } | null): void {
    if (this.bubble.hidden) return;
    this.bubbleLeft -= dt;
    if (this.bubbleLeft <= 0 || !at) {
      this.bubble.hidden = true;
      return;
    }
    this.bubble.style.left = `${at.x.toFixed(0)}px`;
    this.bubble.style.top = `${at.y.toFixed(0)}px`;
  }

  public get speaking(): boolean {
    return !this.bubble.hidden;
  }

  /** Étiquette du mannequin (coordonnées écran) ou `null`. */
  public setDummy(text: string | null, x: number, y: number): void {
    if (text === null) {
      this.dummy.hidden = true;
      return;
    }
    this.dummy.hidden = false;
    if (this.dummy.textContent !== text) this.dummy.textContent = text;
    this.dummy.style.left = `${x.toFixed(0)}px`;
    this.dummy.style.top = `${y.toFixed(0)}px`;
  }

  // ─── Panneaux ──────────────────────────────────────────────────────────────

  /**
   * Tableau des revendications (port de `HubScene.openRevendications`) : toutes les revendications
   * d'`UPGRADES`, rang, effet et coût ; un achat rafraîchit le panneau sur place.
   */
  public openTableau(
    meta: MetaState,
    onBuy: (id: UpgradeId) => MetaState | null,
    onClose: () => void,
    refresh = false,
    flash: UpgradeId | null = null,
  ): void {
    this.menus.showPanel(
      (layer) => {
        const panel = el('div', 'px-panel px-panel--wide hub-tableau', layer);
        el('h2', 'px-title', panel, 'Marcel · Tableau des revendications');
        const head = el('div', 'hub-tableau-head', panel);
        el(
          'p',
          'px-sub',
          head,
          '« Chaque PS, c’est un acquis, fieu. Chaque revendication obtenue est photocopiée et punaisée. »',
        );
        const ps = el('div', 'hub-tableau-ps', head);
        el('b', '', ps, String(meta.ps));
        el('span', '', ps, 'PS disponibles');
        const grid = el('div', 'hub-upgrades', panel);
        for (const u of UPGRADES) {
          const rank = rankOf(meta, u.id);
          const cost = nextCost(meta, u.id);
          const card = el('div', 'hub-upgrade', grid);
          card.dataset.upgrade = u.id;
          if (cost === null) card.classList.add('is-max');
          const top = el('div', 'hub-upgrade-top', card);
          el('b', '', top, u.name);
          const pips = el('span', 'hub-pips', top);
          for (let i = 0; i < u.costs.length; i += 1) el('i', i < rank ? 'on' : '', pips);
          el('span', 'hub-upgrade-effect', card, u.effect);
          const label =
            cost === null
              ? 'Acquis'
              : meta.ps >= cost
                ? `Revendiquer · ${String(cost)} PS`
                : `${String(cost)} PS`;
          const b = button(
            card,
            label,
            cost !== null && meta.ps >= cost ? 'px-btn--primary' : 'px-btn--ghost',
            () => {
              const next = onBuy(u.id);
              if (next) this.openTableau(next, onBuy, onClose, true, u.id);
            },
          );
          b.disabled = cost === null || meta.ps < cost;
          b.setAttribute('aria-label', `${u.name} : ${label}`);
          if (flash === u.id && !this.reduced)
            gsap.fromTo(
              card,
              { boxShadow: '0 0 0 3px #ffd200, 0 0 32px #ffd200' },
              { boxShadow: '0 0 0 0 transparent', duration: 0.9 },
            );
        }
        button(panel, 'Fermer (Échap)', 'hub-close', onClose);
        return panel;
      },
      onClose,
      !refresh,
      refresh,
    );
  }

  /** Tableau des roulements (Yasmina). */
  public openRoster(
    current: ShiftId,
    options: readonly RosterOption[],
    onPick: (id: ShiftId) => void,
    onClose: () => void,
  ): void {
    this.menus.showPanel((layer) => {
      const panel = el('div', 'px-panel px-panel--wide', layer);
      el('h2', 'px-title', panel, 'Yasmina · Tableau des roulements');
      el(
        'p',
        'px-sub',
        panel,
        '« Quand je dis départ, tout le monde part. Choisis ton roulement, je te mets en voie. »',
      );
      const cards = el('div', 'px-cards', panel);
      for (const o of options) {
        const c = el('button', 'px-card', cards);
        c.type = 'button';
        c.dataset.shift = o.id;
        c.disabled = o.locked;
        if (o.locked) c.classList.add('is-locked');
        if (o.id === current) c.style.setProperty('--rc', 'var(--px-gold)');
        el('b', '', c, `${o.label}${o.id === current ? ' (choisi)' : ''}`);
        el('span', '', c, o.desc);
        c.addEventListener('click', () => {
          if (!o.locked) onPick(o.id);
        });
      }
      button(panel, 'Fermer (Échap)', 'hub-close', onClose);
      return panel;
    }, onClose);
  }

  /** Texte à lire (mur synoptique, affichette). */
  public openRead(title: string, text: string, onClose: () => void): void {
    this.menus.showPanel((layer) => {
      const panel = el('div', 'px-panel', layer);
      el('h2', 'px-title', panel, title);
      el('p', 'hub-read', panel, text);
      button(panel, 'Fermer (Échap)', 'px-btn--primary', onClose);
      return panel;
    }, onClose);
  }

  /**
   * Service du loot (DPD ou PACO). Branché par `HUB_SERVICES` ; sinon panneau d'attente qui décrit
   * le service. `ctx.refresh` reconstruit le panneau sur place.
   */
  public openService(
    id: HubServiceId,
    ctx: Omit<HubServiceContext, 'refresh'>,
    refresh = false,
  ): void {
    const service = this.services[id];
    const preview = SERVICE_PREVIEW[id];
    const full: HubServiceContext = {
      ...ctx,
      refresh: () => {
        this.openService(id, ctx, true);
      },
    };
    this.menus.showPanel(
      (layer) => {
        const panel = el('div', 'px-panel px-panel--wide hub-service', layer);
        panel.dataset.service = id;
        el('h2', 'px-title', panel, service?.title ?? preview.title);
        if (service) service.build(panel, full);
        else {
          el('p', 'px-sub', panel, preview.quote);
          el('div', 'px-label', panel, 'Service en cours d’installation');
          const list = el('ul', 'hub-preview', panel);
          for (const it of preview.items) el('li', '', list, it);
        }
        button(panel, 'Fermer (Échap)', 'hub-close', ctx.close);
        return panel;
      },
      ctx.close,
      !refresh,
      refresh,
    );
  }

  /** Pause du hub : reprendre, options, retour au titre. */
  public openPause(onResume: () => void, onOptions: () => void, onTitle: () => void): void {
    this.menus.showPanel((layer) => {
      const panel = el('div', 'px-panel', layer);
      el('h2', 'px-title', panel, 'OCC · Pause');
      el(
        'p',
        'px-sub',
        panel,
        '« Toute réunion de l’OCC dure le temps d’une tasse. » La progression est sauvegardée.',
      );
      const stack = el('div', 'px-stack', panel);
      button(stack, 'Reprendre (Échap)', 'px-btn--primary', onResume);
      button(stack, 'Options', '', onOptions);
      button(stack, 'Retour au titre', 'px-btn--ghost', onTitle);
      return panel;
    }, onResume);
  }

  public dispose(): void {
    gsap.killTweensOf([this.barPs, this.toastIn, this.bubbleIn]);
    this.bar.remove();
    this.bubble.remove();
    this.dummy.remove();
    this.toastEl.remove();
  }
}
