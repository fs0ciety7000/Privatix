/**
 * Services du loot au hub (DOM pur, jamais three), branchés dans `HUB_SERVICES` :
 * - **DPD (Josiane)** : casiers du Vestiaire (24, +12 par rang), Paquetage, Outil de départ et
 *   Dotations d'outil (Pièces), polissage d'un affixe, remise à niveau (plafond d'ilvl +3), cadenas,
 *   réforme en Ferraille, conversion Ferraille → Pièce (une fois par Shift) ;
 * - **PACO (Béné)** : réaffûtage d'un affixe (choix parmi 3 tirages, coût croissant) et archives des
 *   Plans de Patrimoine (codex).
 * Toutes les opérations sont les fonctions pures de `src/systems/loot` ; chaque succès passe par
 * `ctx.commit` (sauvegarde) puis `ctx.refresh` (panneau reconstruit sur place). GDD § 9 bis.7.
 */
import type { SlotId } from '@/config/loot';
import { LEGENDARIES, SCRAP, TOOL_UNLOCKS, TOOLS, VESTIAIRE } from '@/config/loot';
import type { AffixRoll, ItemInstance, VestiaireError } from '@/systems/loot';
import {
  ackScrappedNotice,
  convertToPieces,
  describeAffix,
  itemName,
  polish,
  raiseCap,
  raiseCapCost,
  reforge,
  reforgeCost,
  reforgeOptions,
  scrapFromVestiaire,
  scrapValue,
  setPaquetage,
  setStartTool,
  slotOf,
  toggleLock,
  unlockTool,
  vestiaireCapacity,
  paquetageSize,
} from '@/systems/loot';
import type { MetaState } from '@/systems/meta/MetaState';
import { createRng } from '@/utils/rng';
import type { HubServiceContext, HubServicePanel } from '@/ui/hub/services';
import { button, el, itemCard, rarityColor, slotIcon } from '@/ui/loot/lootUi';

/** Messages des refus (`VestiaireError`), dans la voix des guichets. */
const REFUS: Readonly<Record<VestiaireError, string>> = {
  'unknown-item': 'Objet introuvable dans les casiers.',
  locked: 'Casier cadenassé : retire le cadenas d’abord.',
  ferraille: 'Pas assez de Ferraille.',
  pieces: 'Pas assez de Pièces détachées.',
  max: 'Déjà au maximum.',
  full: 'Vestiaire plein.',
  'too-many': 'Paquetage complet.',
  'slot-taken': 'Un objet de cet emplacement est déjà au Paquetage.',
  'already-done': 'Déjà fait pendant ce Shift.',
  requirement: 'Conditions non remplies.',
  invalid: 'Opération refusée.',
};

/** État d'affichage des panneaux (survit aux rafraîchissements, pas à la page). */
const state = {
  dpdTab: 'casiers' as 'casiers' | 'paquetage' | 'atelier',
  dpdSel: null as string | null,
  pacoTab: 'relances' as 'relances' | 'archives',
  pacoSel: null as string | null,
  pacoAffix: -1,
  msg: '',
};

/** Applique une opération du Vestiaire : succès → sauvegarde et rafraîchissement ; refus → message. */
function run(
  ctx: HubServiceContext,
  res: { ok: true; meta: MetaState } | { ok: false; reason: VestiaireError },
  okMsg: string,
): void {
  if (res.ok) {
    state.msg = okMsg;
    ctx.commit(res.meta);
  } else state.msg = REFUS[res.reason];
  ctx.refresh();
}

function tabs<T extends string>(
  panel: HTMLElement,
  current: T,
  list: readonly (readonly [T, string])[],
  pick: (t: T) => void,
): void {
  const row = el('div', 'px-row loot-tabs', panel);
  for (const [id, label] of list) {
    const b = button(row, label, 'px-seg loot-tab', () => {
      pick(id);
    });
    b.setAttribute('aria-pressed', String(id === current));
  }
}

function money(panel: HTMLElement, meta: MetaState): void {
  const bar = el('div', 'loot-money', panel);
  const cell = (label: string, value: string, cls: string): void => {
    const c = el('div', `loot-money-cell ${cls}`, bar);
    el('b', '', c, value);
    el('span', '', c, label);
  };
  cell('Ferraille', String(meta.loot.ferraille), 'is-scrap');
  cell('Pièces', String(meta.pieces), 'is-pieces');
  cell('Casiers', `${String(meta.loot.vestiaire.length)}/${String(vestiaireCapacity(meta))}`, '');
  cell(
    'Paquetage',
    `${String(meta.loot.paquetage.length)}/${String(paquetageSize(meta))}`,
    'is-pack',
  );
}

function message(panel: HTMLElement): void {
  const p = el('p', 'loot-msg', panel, state.msg);
  p.setAttribute('role', 'status');
  if (!state.msg) p.hidden = true;
  state.msg = '';
}

/** Mini-casier (grille du Vestiaire) : pictogramme, nom coloré, marques Paquetage et cadenas. */
function locker(
  grid: HTMLElement,
  item: ItemInstance | null,
  meta: MetaState,
  selected: boolean,
  onPick: () => void,
): void {
  const b = el('button', 'px-btn loot-locker', grid);
  b.type = 'button';
  if (!item) {
    b.classList.add('is-empty');
    b.disabled = true;
    b.setAttribute('aria-label', 'Casier vide');
    return;
  }
  b.style.setProperty('--rar', rarityColor(item.rarity));
  b.setAttribute('aria-pressed', String(selected));
  slotIcon(slotOf(item) ?? 'outil', b, 20);
  el('span', 'loot-locker-name', b, itemName(item));
  const marks = el('span', 'loot-locker-marks', b);
  if (meta.loot.paquetage.includes(item.uid)) el('i', 'is-pack', marks, 'P');
  if (item.locked) el('i', 'is-lock', marks, 'Cad.');
  b.addEventListener('click', onPick);
}

// ─── DPD (Josiane) ────────────────────────────────────────────────────────────

function togglePaquetage(meta: MetaState, item: ItemInstance): MetaState | VestiaireError {
  const current = meta.loot.paquetage;
  let next: string[];
  if (current.includes(item.uid)) next = current.filter((u) => u !== item.uid);
  else {
    const slot: SlotId | undefined = slotOf(item);
    // Un objet par emplacement : il remplace celui du même emplacement, sinon le plus ancien.
    next = current.filter((u) => {
      const other = meta.loot.vestiaire.find((i) => i.uid === u);
      return other ? slotOf(other) !== slot : false;
    });
    next.push(item.uid);
    while (next.length > paquetageSize(meta)) next.shift();
  }
  const res = setPaquetage(meta, next);
  return res.ok ? res.meta : res.reason;
}

function buildDpd(panel: HTMLElement, ctx: HubServiceContext): void {
  const meta = ctx.meta;
  el(
    'p',
    'px-sub',
    panel,
    '« Ta dotation, je la range. Ce qui est réformé, je le réforme. Proprement. »',
  );
  if (meta.loot.scrappedOnLoad > 0) {
    el(
      'p',
      'loot-msg',
      panel,
      `Service technique : ${String(meta.loot.scrappedOnLoad)} objet(s) hors norme réformé(s) en Ferraille.`,
    );
    ctx.commit(ackScrappedNotice(meta));
  }
  money(panel, meta);
  tabs(
    panel,
    state.dpdTab,
    [
      ['casiers', 'Casiers'],
      ['paquetage', 'Paquetage et Outils'],
      ['atelier', 'Atelier'],
    ],
    (t) => {
      state.dpdTab = t;
      ctx.refresh();
    },
  );
  message(panel);
  if (state.dpdTab === 'casiers') dpdLockers(panel, ctx);
  else if (state.dpdTab === 'paquetage') dpdPaquetage(panel, ctx);
  else dpdAtelier(panel, ctx);
}

function dpdLockers(panel: HTMLElement, ctx: HubServiceContext): void {
  const meta = ctx.meta;
  const items = meta.loot.vestiaire;
  const wrap = el('div', 'loot-vestiaire', panel);
  const grid = el('div', 'loot-lockers', wrap);
  const cap = vestiaireCapacity(meta);
  if (!items.some((i) => i.uid === state.dpdSel)) state.dpdSel = items[0]?.uid ?? null;
  for (let i = 0; i < cap; i += 1) {
    const it = items[i] ?? null;
    locker(grid, it, meta, it?.uid === state.dpdSel, () => {
      state.dpdSel = it?.uid ?? null;
      ctx.refresh();
    });
  }
  const detail = el('div', 'loot-detail', wrap);
  const sel = items.find((i) => i.uid === state.dpdSel);
  if (!sel) {
    el(
      'p',
      'loot-meta',
      detail,
      'Casiers vides. Ramène des pièces de tes Shifts : 1 à la mort, 2 en cas de victoire.',
    );
    return;
  }
  itemCard(detail, sel, { flavor: true });
  const acts = el('div', 'loot-actions loot-actions--wrap', detail);
  const inPack = meta.loot.paquetage.includes(sel.uid);
  button(
    acts,
    inPack ? 'Retirer du Paquetage' : 'Mettre au Paquetage',
    'px-btn--primary loot-act',
    () => {
      const next = togglePaquetage(meta, sel);
      if (typeof next === 'string') {
        state.msg = REFUS[next];
        ctx.refresh();
      } else run(ctx, { ok: true, meta: next }, inPack ? 'Retiré du Paquetage.' : 'Au Paquetage.');
    },
  );
  button(acts, sel.locked ? 'Ôter le cadenas' : 'Cadenas', 'loot-act', () => {
    run(ctx, toggleLock(meta, sel.uid), sel.locked ? 'Cadenas ôté.' : 'Casier cadenassé.');
  });
  const raise = button(
    acts,
    `Remise à niveau · ilvl +${String(SCRAP.RAISE_STEP)} · ${String(raiseCapCost(sel))} Fer.`,
    'loot-act',
    () => {
      run(ctx, raiseCap(meta, sel.uid), 'Plafond relevé.');
    },
  );
  raise.disabled = meta.loot.ferraille < raiseCapCost(sel) || sel.ilvl >= 30;
  const scrap = button(
    acts,
    `Réformer · +${String(scrapValue(sel))} Fer.`,
    'px-btn--ghost loot-act',
    () => {
      run(ctx, scrapFromVestiaire(meta, sel.uid), 'Réformé en Ferraille.');
    },
  );
  scrap.disabled = sel.locked;
  if (sel.affixes.length > 0) {
    el('div', 'px-label', detail, `Polissage · ${String(SCRAP.POLISH_COST)} Ferraille par affixe`);
    const list = el('div', 'loot-affix-rows', detail);
    sel.affixes.forEach((a, i) => {
      const row = el('div', 'loot-affix-row', list);
      el('span', '', row, describeAffix(a, sel.ilvl));
      el('i', 'loot-q', row, `q ${a.q.toFixed(2).replace('.', ',')}`);
      const b = button(row, 'Polir', 'loot-act loot-act--small', () => {
        run(ctx, polish(meta, sel.uid, i), 'Affixe poli (+0,10).');
      });
      b.disabled = a.q >= 1 || meta.loot.ferraille < SCRAP.POLISH_COST;
    });
  }
}

function dpdPaquetage(panel: HTMLElement, ctx: HubServiceContext): void {
  const meta = ctx.meta;
  el(
    'div',
    'px-label',
    panel,
    `Paquetage : ${String(paquetageSize(meta))} pièce(s) emportée(s) au départ`,
  );
  const pack = el('div', 'loot-pack', panel);
  const packed = meta.loot.paquetage
    .map((u) => meta.loot.vestiaire.find((i) => i.uid === u))
    .filter((i): i is ItemInstance => i !== undefined);
  if (packed.length === 0)
    el('p', 'loot-meta', pack, 'Rien au Paquetage : choisis une pièce dans les Casiers.');
  for (const it of packed) itemCard(pack, it, { details: false });
  el('div', 'px-label', panel, 'Outil de départ (si le Paquetage n’en contient pas)');
  const tools = el('div', 'px-row loot-tools', panel);
  for (const id of meta.loot.unlockedTools) {
    const t = TOOLS[id];
    const b = button(tools, t?.label ?? id, 'px-seg', () => {
      run(ctx, setStartTool(meta, id), `Outil de départ : ${t?.label ?? id}.`);
    });
    b.setAttribute('aria-pressed', String(meta.loot.startTool === id));
  }
  el('div', 'px-label', panel, 'Dotations d’outil (Pièces détachées)');
  const list = el('div', 'loot-unlocks', panel);
  for (const u of TOOL_UNLOCKS) {
    if (meta.loot.unlockedTools.includes(u.toolId)) continue;
    const row = el('div', 'loot-unlock', list);
    el('b', '', row, TOOLS[u.toolId]?.label ?? u.toolId);
    const req: string[] = [];
    if (u.boss1Kills) req.push(`${String(u.boss1Kills)} victoire(s) sur l’Auditeur`);
    if (u.boss2Kills) req.push('Boss 2 vaincu');
    if (u.quest) req.push('quête de la DPD');
    el('span', 'loot-meta', row, req.length > 0 ? req.join(' · ') : 'Sans condition');
    const b = button(row, `${String(u.pieces)} Pièces`, 'loot-act loot-act--small', () => {
      run(ctx, unlockTool(meta, u.toolId), `Dotation obtenue : ${TOOLS[u.toolId]?.label ?? ''}.`);
    });
    b.disabled = meta.pieces < u.pieces;
  }
}

function dpdAtelier(panel: HTMLElement, ctx: HubServiceContext): void {
  const meta = ctx.meta;
  el(
    'p',
    'px-sub',
    panel,
    `Bon de réforme : ${String(SCRAP.PIECE_RATE)} Ferraille → 1 Pièce détachée, une fois par Shift. Casiers : ${String(VESTIAIRE.CAPACITY)}, +${String(VESTIAIRE.CAPACITY_PER_RANK)} par rang de « Casier personnel ».`,
  );
  const done = meta.loot.lastPieceConversion === meta.stats.shifts;
  const b = button(
    panel,
    done ? 'Bon de réforme déjà utilisé' : `Convertir ${String(SCRAP.PIECE_RATE)} Ferraille`,
    'px-btn--primary',
    () => {
      run(ctx, convertToPieces(meta), '+1 Pièce détachée.');
    },
  );
  b.disabled = done || meta.loot.ferraille < SCRAP.PIECE_RATE;
}

// ─── PACO (Béné) ──────────────────────────────────────────────────────────────

/** Graine des trois tirages d'un réaffûtage : fixée par l'objet et ses relances (pas de « reroll »). */
function reforgeSeed(item: ItemInstance, affix: number): number {
  let h = 2166136261;
  for (const c of item.uid) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h ^ (item.rerolls * 7919 + affix * 104729)) >>> 0;
}

function buildPaco(panel: HTMLElement, ctx: HubServiceContext): void {
  const meta = ctx.meta;
  el(
    'p',
    'px-sub',
    panel,
    '« Un affixe qui ne te va pas, c’est un voyageur sans train. Je te propose trois bus de remplacement. »',
  );
  money(panel, meta);
  tabs(
    panel,
    state.pacoTab,
    [
      ['relances', 'Relances'],
      ['archives', 'Archives des Plans'],
    ],
    (t) => {
      state.pacoTab = t;
      ctx.refresh();
    },
  );
  message(panel);
  if (state.pacoTab === 'archives') {
    const list = el('div', 'loot-codex', panel);
    for (const l of LEGENDARIES) {
      const known = meta.loot.codex.includes(l.id);
      const row = el('div', `loot-codex-row${known ? '' : ' is-unknown'}`, list);
      el('b', '', row, known ? l.name : 'Plan non archivé');
      el('span', 'loot-meta', row, known ? l.powerText : '« Le Patrimoine se mérite. » — Béné');
    }
    return;
  }
  const items = meta.loot.vestiaire.filter((i) => i.affixes.length > 0);
  const wrap = el('div', 'loot-vestiaire', panel);
  const grid = el('div', 'loot-lockers', wrap);
  if (!items.some((i) => i.uid === state.pacoSel)) {
    state.pacoSel = items[0]?.uid ?? null;
    state.pacoAffix = -1;
  }
  for (const it of items)
    locker(grid, it, meta, it.uid === state.pacoSel, () => {
      state.pacoSel = it.uid;
      state.pacoAffix = -1;
      ctx.refresh();
    });
  const detail = el('div', 'loot-detail', wrap);
  const sel = items.find((i) => i.uid === state.pacoSel);
  if (!sel) {
    el('p', 'loot-meta', detail, 'Aucun objet à affixes au Vestiaire.');
    return;
  }
  itemCard(detail, sel, { details: false });
  const cost = reforgeCost(sel);
  el('div', 'px-label', detail, `Réaffûtage · ${String(cost)} Ferraille (+6 par relance)`);
  const rows = el('div', 'loot-affix-rows', detail);
  sel.affixes.forEach((a, i) => {
    const row = el('div', 'loot-affix-row', rows);
    el('span', '', row, describeAffix(a, sel.ilvl));
    const b = button(row, 'Réaffûter', 'loot-act loot-act--small', () => {
      state.pacoAffix = i;
      ctx.refresh();
    });
    b.disabled = meta.loot.ferraille < cost;
  });
  const idx = state.pacoAffix;
  if (idx < 0 || !sel.affixes[idx]) return;
  const options: AffixRoll[] = reforgeOptions(sel, idx, createRng(reforgeSeed(sel, idx)));
  el('div', 'px-label', detail, 'Trois bus de remplacement');
  const cards = el('div', 'px-cards loot-reforge', detail);
  for (const o of options) {
    const c = el('button', 'px-card', cards);
    c.type = 'button';
    el('b', '', c, describeAffix(o, sel.ilvl));
    el('span', '', c, `Qualité ${o.q.toFixed(2).replace('.', ',')}`);
    c.addEventListener('click', () => {
      state.pacoAffix = -1;
      run(ctx, reforge(meta, sel.uid, idx, o), 'Affixe réaffûté.');
    });
  }
  button(detail, 'Garder l’affixe actuel', 'px-btn--ghost', () => {
    state.pacoAffix = -1;
    ctx.refresh();
  });
}

export const DPD_SERVICE: HubServicePanel = {
  title: 'Josiane · DPD — Vestiaire et casiers',
  build: buildDpd,
};

export const PACO_SERVICE: HubServicePanel = {
  title: 'Béné · PACO — Relances et archives',
  build: buildPaco,
};
