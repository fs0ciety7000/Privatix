/**
 * Loot pendant le Shift, en DOM (jamais three) : carte de comparaison à l'approche d'un objet au sol
 * (« Bon de dotation » : fiche, ▲ / ▼, résumés Frappe et Tenue, actions avec anneau de maintien) et
 * bandeau du HUD des emplacements portés (6 pictogrammes à la couleur de la rareté, 4 cases de sac).
 * Mouvement : GSAP, réduit à rien en « Réduction des mouvements ». Contrôles : clavier (E, maintien E,
 * maintien X), manette (LB, maintien LB, maintien RB) et tactile (boutons de la carte).
 */
import { gsap } from 'gsap';
import type { SlotId } from '@/config/loot';
import { SLOT_LABELS, SLOTS } from '@/config/loot';
import type { EquippedItems, ItemInstance, LoadoutComparison } from '@/systems/loot';
import { itemName } from '@/systems/loot';
import { button, comparisonBlock, el, itemCard, rarityColor, slotIcon } from '@/ui/loot/lootUi';

export type LootActionId = 'equip' | 'bag' | 'scrap';

/** Ce que la carte montre (préparé par la scène à partir de la sim). */
export interface NearItemView {
  readonly id: number;
  readonly item: ItemInstance;
  readonly compare: LoadoutComparison;
  /** Objet porté au même emplacement (ou `null`). */
  readonly current: ItemInstance | null;
  readonly r: number;
  /** Hors combat : ramassable. */
  readonly canTake: boolean;
  readonly hold: { readonly action: 'bag' | 'scrap'; readonly progress: number } | null;
  readonly bagFull: boolean;
  /** Dotation : « un objet au choix ». */
  readonly choice: boolean;
  /** Position écran (px) de l'objet. */
  readonly x: number;
  readonly y: number;
  /** Version de l'équipement (reconstruit la carte quand il change). */
  readonly version: number;
}

const CARD_GAP = 56;

export class CompareCard {
  private readonly root: HTMLDivElement;
  private shownKey = '';
  private bagBtn: HTMLButtonElement | null = null;
  private scrapBtn: HTMLButtonElement | null = null;
  public reducedMotion = false;

  public constructor(
    host: HTMLElement,
    private readonly onAction: (a: LootActionId) => void,
    private readonly touch: boolean,
  ) {
    this.root = el('div', 'loot-near', host);
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Bon de dotation');
  }

  public update(v: NearItemView | null, viewW: number, viewH: number): void {
    if (!v) {
      if (!this.root.hidden) this.root.hidden = true;
      this.shownKey = '';
      return;
    }
    const key = `${String(v.id)}|${String(v.version)}|${String(v.canTake)}|${String(v.bagFull)}`;
    if (key !== this.shownKey) {
      const fresh = !this.shownKey.startsWith(`${String(v.id)}|`);
      this.shownKey = key;
      this.build(v);
      this.root.hidden = false;
      if (fresh && !this.reducedMotion)
        gsap.fromTo(
          this.root,
          { opacity: 0, scale: 0.92 },
          { opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(1.6)' },
        );
      else gsap.set(this.root, { opacity: 1, scale: 1 });
    }
    // Anneau de maintien (Sac, Démonter).
    const hold = v.hold;
    this.bagBtn?.style.setProperty(
      '--hold',
      hold?.action === 'bag' ? hold.progress.toFixed(2) : '0',
    );
    this.scrapBtn?.style.setProperty(
      '--hold',
      hold?.action === 'scrap' ? hold.progress.toFixed(2) : '0',
    );
    // À côté de l'objet, du côté qui laisse le plus de place, sans sortir de l'écran.
    const w = this.root.offsetWidth || 300;
    const h = this.root.offsetHeight || 240;
    const right = v.x < viewW * 0.58;
    let left = right ? v.x + CARD_GAP : v.x - CARD_GAP - w;
    let top = v.y - h * 0.6;
    left = Math.max(12, Math.min(viewW - w - 12, left));
    top = Math.max(64, Math.min(viewH - h - 12, top));
    this.root.style.transform = `translate(${left.toFixed(0)}px, ${top.toFixed(0)}px)`;
  }

  private build(v: NearItemView): void {
    const root = this.root;
    root.replaceChildren();
    root.style.setProperty('--rar', rarityColor(v.item.rarity));
    root.dataset.rarity = v.item.rarity;
    el('div', 'loot-near-tag', root, v.choice ? 'Dotation · un objet au choix' : 'Bon de dotation');
    itemCard(root, v.item, { r: v.r, flavor: true });
    if (v.current) {
      const cur = el('div', 'loot-current', root);
      el('span', '', cur, 'Porté : ');
      const b = el('b', '', cur, itemName(v.current));
      b.style.color = rarityColor(v.current.rarity);
    } else el('div', 'loot-current', root, 'Emplacement libre');
    comparisonBlock(root, v.compare);
    const actions = el('div', 'loot-actions', root);
    if (!v.canTake) {
      el('p', 'loot-lock', actions, 'Combat en cours : ramassage après la salle.');
      this.bagBtn = null;
      this.scrapBtn = null;
      return;
    }
    const equip = button(actions, '', 'px-btn--primary loot-act', () => {
      this.onAction('equip');
    });
    this.keyed(equip, this.touch ? '' : 'E', 'Équiper');
    this.bagBtn = button(actions, '', 'loot-act loot-hold', () => {
      this.onAction('bag');
    });
    this.keyed(this.bagBtn, this.touch ? '' : 'maintenir E', v.bagFull ? 'Sac plein' : 'Au sac');
    this.bagBtn.disabled = v.bagFull;
    this.scrapBtn = button(actions, '', 'px-btn--ghost loot-act loot-hold', () => {
      this.onAction('scrap');
    });
    this.keyed(this.scrapBtn, this.touch ? '' : 'maintenir X', 'Démonter');
  }

  private keyed(b: HTMLButtonElement, key: string, label: string): void {
    if (key) el('kbd', '', b, key);
    b.append(label);
  }

  public dispose(): void {
    gsap.killTweensOf(this.root);
    this.root.remove();
  }
}

/** Bandeau du HUD : 6 emplacements portés et 4 cases de sac ; un toucher ouvre l'écran Tenue. */
export class GearStrip {
  private readonly root: HTMLButtonElement;
  private readonly cells = new Map<SlotId, HTMLSpanElement>();
  private readonly bag: HTMLSpanElement[] = [];
  private key = '';

  public constructor(host: HTMLElement, onOpen: () => void) {
    this.root = el('button', 'loot-strip', host);
    this.root.type = 'button';
    this.root.setAttribute('aria-label', 'Tenue et sac (I ou Tab)');
    this.root.addEventListener('click', onOpen);
    const slots = el('span', 'loot-strip-slots', this.root);
    for (const s of SLOTS) {
      const c = el('span', 'loot-slot', slots);
      c.title = SLOT_LABELS[s];
      slotIcon(s, c, 18);
      this.cells.set(s, c);
    }
    const bag = el('span', 'loot-strip-bag', this.root);
    for (let i = 0; i < 4; i += 1) this.bag.push(el('span', 'loot-bagdot', bag));
    el('kbd', 'loot-strip-key', this.root, 'I');
  }

  public update(equipped: EquippedItems, bag: readonly (ItemInstance | null)[]): void {
    const key =
      SLOTS.map((s) => `${equipped[s]?.uid ?? '-'}:${equipped[s]?.rarity ?? ''}`).join(',') +
      bag.map((b) => b?.rarity ?? '-').join(',');
    if (key === this.key) return;
    this.key = key;
    for (const s of SLOTS) {
      const c = this.cells.get(s);
      const it = equipped[s];
      if (!c) continue;
      c.classList.toggle('is-empty', !it);
      c.style.setProperty('--rar', it ? rarityColor(it.rarity) : 'transparent');
      c.title = it ? `${SLOT_LABELS[s]} : ${itemName(it)}` : `${SLOT_LABELS[s]} : libre`;
    }
    this.bag.forEach((d, i) => {
      const it = bag[i] ?? null;
      d.classList.toggle('is-full', it !== null);
      d.style.setProperty('--rar', it ? rarityColor(it.rarity) : 'transparent');
    });
  }

  public setVisible(on: boolean): void {
    this.root.hidden = !on;
  }

  public dispose(): void {
    this.root.remove();
  }
}
