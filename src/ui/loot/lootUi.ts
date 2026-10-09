/**
 * Briques DOM du loot (jamais three) : fiche d'objet (nom coloré par rareté, palier, implicite,
 * affixes, pouvoir Patrimoine, saveur), pictogrammes d'emplacement (SVG en ligne, lisibles à 1×) et
 * lignes de comparaison ▲ / ▼ / =. Partagées par la carte de comparaison, l'écran Tenue, la
 * consigne de fin de Shift et les services du hub (DPD, PACO). Tokens : menus.css + loot.css.
 */
import type { ItemRarity, SlotId } from '@/config/loot';
import {
  GEAR_STATS,
  ITEM_RARITIES,
  ITEMS_BY_ID,
  LEGENDARIES_BY_ID,
  SETS_BY_ID,
  SLOT_LABELS,
} from '@/config/loot';
import type { ItemInstance, LoadoutComparison } from '@/systems/loot';
import {
  calibreOf,
  describeAffix,
  effectiveIlvl,
  formatStat,
  implicitValue,
  itemName,
  tierOf,
} from '@/systems/loot';

export function el<K extends keyof HTMLElementTagNameMap>(
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

export function button(
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

/** Couleur CSS d'une rareté (faisceau et nom). */
export function rarityColor(rarity: ItemRarity): string {
  return ITEM_RARITIES[rarity].color;
}

export function slotOfItem(item: ItemInstance): SlotId {
  return ITEMS_BY_ID.get(item.defId)?.slot ?? 'outil';
}

/** Pictogrammes 24×24 des emplacements (traits simples, couleur courante). */
const SLOT_ICON: Readonly<Record<SlotId, string>> = {
  outil: '<path d="M5 19 L15 9" stroke-width="3.2"/><path d="M13 5 h7 v4 h-7 z" stroke-width="2"/>',
  casque:
    '<path d="M4 16 a8 8 0 0 1 16 0 z" stroke-width="2.2"/><path d="M2.5 16.5 h19" stroke-width="2.6"/>',
  gilet:
    '<path d="M7 4 l-3 4 v12 h6 v-9 h4 v9 h6 v-12 l-3 -4 h-3 l-1 3 h-2 l-1 -3 z" stroke-width="2"/><path d="M4 14 h16" stroke-width="2"/>',
  gants:
    '<path d="M7 21 v-8 l-2 -4 l2 -1 l2 3 v-7 h2 v6 v-7 h2 v7 v-6 h2 v8 l1 -2 l2 1 l-3 6 v4 z" stroke-width="1.6"/>',
  chaussures:
    '<path d="M4 7 h6 v7 l9 2 a2 2 0 0 1 1 3 h-16 z" stroke-width="2"/><path d="M4 19 h16" stroke-width="2"/>',
  insigne:
    '<circle cx="12" cy="11" r="6" stroke-width="2.2"/><path d="M9 16 l-2 6 l5 -2 l5 2 l-2 -6" stroke-width="1.8"/>',
};

/** Pictogramme SVG d'un emplacement (`aria-hidden`, le libellé est porté par le parent). */
export function slotIcon(slot: SlotId, parent: HTMLElement, size = 22): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = SLOT_ICON[slot];
  svg.classList.add('loot-icon');
  parent.appendChild(svg);
  return svg;
}

/** Ligne d'en-tête : « Homologué · Gants · ilvl 7 (palier I) ». */
export function itemMeta(item: ItemInstance, r?: number): string {
  const ilvl = effectiveIlvl(item.ilvl, r);
  const capped = ilvl < item.ilvl ? ` (plafonné, ${String(item.ilvl)})` : '';
  const tier = ['I', 'II', 'III'][tierOf(ilvl)] ?? 'I';
  return `${ITEM_RARITIES[item.rarity].label} · ${SLOT_LABELS[slotOfItem(item)]} · ilvl ${String(ilvl)}${capped} · palier ${tier}`;
}

/** Ligne de l'implicite (« Calibre ×1,07 », « Dégâts subis −5 % »). */
export function implicitLine(item: ItemInstance, r?: number): string {
  const def = ITEMS_BY_ID.get(item.defId);
  if (!def) return '';
  const ilvl = effectiveIlvl(item.ilvl, r);
  if (def.implicit.kind === 'calibre')
    return `Calibre ×${calibreOf(ilvl).toFixed(2).replace('.', ',')}`;
  const v = implicitValue(def.implicit, item.implicitQ, ilvl);
  return `${GEAR_STATS[def.implicit.stat].label} ${formatStat(def.implicit.stat, v)}`;
}

export interface CardOptions {
  /** Indice de salle (ilvl effectif) ; absent : sans plafond (Vestiaire). */
  readonly r?: number;
  /** Affiche la saveur. */
  readonly flavor?: boolean;
  /** Affiche les affixes (sinon nom et en-tête seulement). */
  readonly details?: boolean;
}

/** Fiche d'objet : nom coloré, en-tête, implicite, affixes, Patrimoine, Attelage, saveur. */
export function itemCard(
  parent: HTMLElement,
  item: ItemInstance,
  o: CardOptions = {},
): HTMLElement {
  const card = el('div', 'loot-card', parent);
  card.dataset.rarity = item.rarity;
  card.style.setProperty('--rar', rarityColor(item.rarity));
  const head = el('div', 'loot-card-head', card);
  slotIcon(slotOfItem(item), head);
  const names = el('div', 'loot-card-names', head);
  el('b', 'loot-name', names, itemName(item));
  el('span', 'loot-meta', names, itemMeta(item, o.r));
  if (o.details === false) return card;
  el('div', 'loot-implicit', card, implicitLine(item, o.r));
  const ilvl = effectiveIlvl(item.ilvl, o.r);
  if (item.affixes.length > 0) {
    const list = el('ul', 'loot-affixes', card);
    for (const a of item.affixes) el('li', '', list, describeAffix(a, ilvl));
  }
  const legendary = item.legendaryId ? LEGENDARIES_BY_ID.get(item.legendaryId) : undefined;
  if (legendary) {
    el('p', 'loot-power', card, legendary.powerText);
    el('p', 'loot-drawback', card, `Contrepartie : ${legendary.drawbackText}`);
  }
  const set = item.setId ? SETS_BY_ID.get(item.setId) : undefined;
  if (set) el('p', 'loot-set', card, `Attelage : ${set.name}`);
  if (o.flavor) {
    const flavor = legendary?.flavor ?? ITEMS_BY_ID.get(item.defId)?.flavor;
    if (flavor) el('p', 'loot-flavor', card, `« ${flavor} »`);
  }
  return card;
}

/** Pourcentage signé lisible (« +6 % », « −3 % », « = »). */
export function signedPct(v: number): string {
  if (Math.abs(v) < 0.005) return '0 %';
  const s = v > 0 ? '+' : '−';
  return `${s}${String(Math.round(Math.abs(v) * 100))} %`;
}

/** Lignes ▲ / ▼ / = et résumés « Frappe » et « Tenue » d'une comparaison. */
export function comparisonBlock(parent: HTMLElement, cmp: LoadoutComparison): HTMLElement {
  const box = el('div', 'loot-compare', parent);
  const sums = el('div', 'loot-sums', box);
  const sum = (label: string, v: number): void => {
    const s = el('div', 'loot-sum', sums);
    s.dataset.dir = Math.abs(v) < 0.005 ? 'same' : v > 0 ? 'up' : 'down';
    el('span', '', s, label);
    el('b', '', s, `${Math.abs(v) < 0.005 ? '=' : v > 0 ? '▲' : '▼'} ${signedPct(v)}`);
  };
  sum('Frappe ≈', cmp.frappe);
  sum('Tenue ≈', cmp.tenue);
  if (cmp.deltas.length > 0) {
    const list = el('ul', 'loot-deltas', box);
    for (const d of cmp.deltas) {
      const li = el('li', '', list);
      li.dataset.dir = d.direction;
      el('i', '', li, d.arrow);
      el('span', '', li, d.label);
      el('b', '', li, d.stat === 'calibre' ? d.text : d.direction === 'same' ? '=' : d.text);
    }
  }
  if (cmp.setProgress) {
    const set = SETS_BY_ID.get(cmp.setProgress.setId);
    el(
      'p',
      'loot-set',
      box,
      `Attelage ${set?.name ?? ''} : ${String(cmp.setProgress.count)}/${String(cmp.setProgress.total)}`,
    );
  }
  return box;
}
