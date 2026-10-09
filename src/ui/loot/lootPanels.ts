/**
 * Panneaux du loot en DOM (jamais three), montés par `Menus.showPanel` (même navigation clavier,
 * manette par la croix, toucher, mêmes tokens) : écran « Tenue » (touche I ou Tab : 6 emplacements,
 * sac de 4 cases, total des stats ; éditable hors combat seulement) et écran « Consigne » de fin de
 * Shift (objets ramenés au Vestiaire, le reste part en Ferraille).
 */
import { gsap } from 'gsap';
import { GEAR_STATS, SLOT_LABELS, SLOTS } from '@/config/loot';
import type { EquipmentModifiers, EquippedItems, ItemInstance } from '@/systems/loot';
import {
  compareInLoadout,
  effectiveHpEstimate,
  formatStat,
  GEAR_STAT_IDS,
  itemName,
  legendaryName,
  powerRatio,
  scrapValue,
} from '@/systems/loot';
import type { Menus } from '@/ui/menus/Menus';
import { button, comparisonBlock, el, itemCard, rarityColor, slotIcon } from '@/ui/loot/lootUi';
import { HERO } from '@/config/balance';

export interface TenueView {
  readonly equipped: EquippedItems;
  readonly bag: readonly (ItemInstance | null)[];
  readonly mods: EquipmentModifiers;
  readonly r: number;
  readonly editable: boolean;
  readonly ferraille: number;
}

export interface TenueActions {
  readonly equipBag: (index: number) => void;
  readonly scrapBag: (index: number) => void;
  readonly close: () => void;
}

/** Écran « Tenue » : équipé, sac, total des stats. `refresh` : reconstruit sur place. */
export function showTenue(
  menus: Menus,
  v: TenueView,
  actions: TenueActions,
  refresh = false,
): void {
  menus.showPanel(
    (layer) => {
      const panel = el('div', 'px-panel px-panel--wide loot-tenue', layer);
      el('h2', 'px-title', panel, 'Tenue · Sac de service');
      el(
        'p',
        'px-sub',
        panel,
        v.editable
          ? '« Une tenue propre, c’est une tenue réglementaire. » Équiper ou démonter le contenu du sac.'
          : 'Combat en cours : la tenue est consultable, pas modifiable.',
      );
      const grid = el('div', 'loot-tenue-grid', panel);
      const worn = el('section', 'loot-tenue-worn', grid);
      el('div', 'px-label', worn, 'Équipé');
      const slots = el('div', 'loot-slots', worn);
      for (const s of SLOTS) {
        const it = v.equipped[s];
        if (it) itemCard(slots, it, { r: v.r, details: true });
        else {
          const empty = el('div', 'loot-card loot-card--empty', slots);
          const head = el('div', 'loot-card-head', empty);
          slotIcon(s, head);
          el('span', 'loot-meta', head, `${SLOT_LABELS[s]} : libre`);
        }
      }
      const side = el('section', 'loot-tenue-side', grid);
      el('div', 'px-label', side, 'Sac (4 cases)');
      const bag = el('div', 'loot-bag', side);
      v.bag.forEach((it, i) => {
        const cell = el('div', 'loot-bag-cell', bag);
        if (!it) {
          el('span', 'loot-meta', cell, 'Case vide');
          return;
        }
        itemCard(cell, it, { r: v.r, details: false });
        comparisonBlock(cell, compareInLoadout(v.equipped, it, { r: v.r }));
        const row = el('div', 'loot-actions', cell);
        const eq = button(row, 'Équiper', 'px-btn--primary loot-act', () => {
          actions.equipBag(i);
        });
        eq.disabled = !v.editable;
        eq.setAttribute('aria-label', `Équiper ${itemName(it)}`);
        const sc = button(
          row,
          `Démonter · +${String(scrapValue(it))}`,
          'px-btn--ghost loot-act',
          () => {
            actions.scrapBag(i);
          },
        );
        sc.disabled = !v.editable;
        sc.setAttribute('aria-label', `Démonter ${itemName(it)} en Ferraille`);
      });
      el('div', 'px-label', side, 'Total de la tenue');
      const totals = el('ul', 'loot-totals', side);
      const line = (label: string, value: string): void => {
        const li = el('li', '', totals);
        el('span', '', li, label);
        el('b', '', li, value);
      };
      line('Frappe (DPS estimé)', `×${powerRatio(v.mods).toFixed(2).replace('.', ',')}`);
      line(
        'Tenue (Énergie effective)',
        `×${(effectiveHpEstimate(v.mods) / HERO.MAX_ENERGY).toFixed(2).replace('.', ',')}`,
      );
      for (const k of GEAR_STAT_IDS) {
        const value = v.mods.stats[k];
        if (Math.abs(value) < 1e-9) continue;
        line(GEAR_STATS[k].label, formatStat(k, value));
      }
      for (const l of v.mods.legendaries) line('Patrimoine', legendaryName(l.id));
      line('Ferraille du Shift', String(v.ferraille));
      button(panel, 'Fermer (Échap, I)', 'px-btn--primary loot-close', actions.close);
      return panel;
    },
    actions.close,
    !refresh,
    refresh,
  );
}

export interface ConsigneView {
  readonly outcome: 'mort' | 'victoire';
  readonly candidates: readonly ItemInstance[];
  readonly limit: number;
  readonly preselect: readonly string[];
  /** Pièces du Paquetage, qui rentrent d'office au Vestiaire. */
  readonly paquetage: readonly ItemInstance[];
  readonly ferrailleEarned: number;
  readonly reducedMotion: boolean;
}

/**
 * Écran « Consigne » : on choisit les objets ramenés au Vestiaire (1 à la mort, 2 en victoire) ;
 * le reste affiche sa Ferraille. Présélection : l'objet de plus haute rareté.
 */
export function showConsigne(
  menus: Menus,
  v: ConsigneView,
  onConfirm: (keep: string[]) => void,
): void {
  const keep = new Set(v.preselect.slice(0, v.limit));
  const render = (refresh: boolean): void => {
    menus.showPanel(
      (layer) => {
        const panel = el('div', 'px-panel px-panel--wide loot-consigne', layer);
        el('h2', 'px-title', panel, 'Consigne · Vestiaire de la DPD');
        el(
          'p',
          'px-sub',
          panel,
          `Josiane : « Tu me ramènes ${v.limit > 1 ? `${String(v.limit)} pièces` : 'une pièce'}, pas une de plus. Le reste, c’est de la Ferraille. »`,
        );
        const cards = el('div', 'loot-consigne-cards', panel);
        for (const it of v.candidates) {
          const on = keep.has(it.uid);
          const c = el('button', 'px-card loot-pick', cards);
          c.type = 'button';
          c.setAttribute('aria-pressed', String(on));
          c.style.setProperty('--rc', on ? rarityColor(it.rarity) : 'var(--px-line)');
          itemCard(c, it, { details: true });
          el(
            'span',
            'loot-pick-state',
            c,
            on ? 'Ramené au Vestiaire' : `→ +${String(scrapValue(it))} Ferraille`,
          );
          c.addEventListener('click', () => {
            if (keep.has(it.uid)) keep.delete(it.uid);
            else {
              if (keep.size >= v.limit) {
                const first = [...keep][0];
                if (first !== undefined) keep.delete(first);
              }
              keep.add(it.uid);
            }
            render(true);
          });
        }
        if (v.candidates.length === 0)
          el('p', 'loot-meta', cards, 'Aucun objet à consigner : rien trouvé pendant ce Shift.');
        if (v.paquetage.length > 0)
          el(
            'p',
            'px-sub',
            panel,
            `Paquetage (rentre d’office) : ${v.paquetage.map((i) => itemName(i)).join(', ')}.`,
          );
        const scrap =
          v.candidates.filter((i) => !keep.has(i.uid)).reduce((s, i) => s + scrapValue(i), 0) +
          v.ferrailleEarned;
        el(
          'p',
          'loot-consigne-sum',
          panel,
          `${String(keep.size)} / ${String(v.limit)} au Vestiaire · +${String(scrap)} Ferraille`,
        );
        const go = button(panel, 'Valider la consigne', 'px-btn--primary', () => {
          onConfirm([...keep]);
        });
        go.setAttribute('aria-label', 'Valider la consigne et voir les départs');
        if (!refresh && !v.reducedMotion)
          gsap.fromTo(
            cards.querySelectorAll('.loot-pick'),
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.25, stagger: 0.05, ease: 'expo.out' },
          );
        return panel;
      },
      null,
      !refresh,
      refresh,
    );
  };
  render(false);
}
