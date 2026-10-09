/**
 * Points d'entrée des services du loot dans le hub 3D (jalon J6 → lots Loot) : la **DPD** de Josiane
 * (Vestiaire, casiers, Paquetage, Outil de départ, réforme, polissage, remise à niveau, Dotations
 * d'outil, conversion Ferraille → Pièces) et le **PACO** de Béné (relances d'affixes « bus de
 * remplacement », archives des Plans de Patrimoine). GDD § 9 bis.7 et § 11, LORE § 3.6.
 *
 * ─── Contrat pour l'agent loot ──────────────────────────────────────────────────────────────────
 * - Remplir `HUB_SERVICES.dpd` et `HUB_SERVICES.paco` avec un `HubServicePanel` (DOM pur, jamais
 *   three ; mêmes classes `px-*` que les menus). Tant qu'une entrée vaut `null`, le hub affiche un
 *   panneau d'attente qui décrit le service à venir.
 * - `build(panel, ctx)` reçoit le panneau vide (titre déjà posé) et le contexte :
 *   `ctx.meta` (méta courante, v2 : `meta.loot` = Vestiaire, Ferraille, Plans…), `ctx.commit(next)`
 *   (remplace la méta ; la scène sauvegarde aussitôt), `ctx.refresh()` (reconstruit le panneau sur
 *   place après un `commit`, sans animation) et `ctx.close()` (retour au hub).
 * - Les opérations elles-mêmes sont les fonctions pures de `src/systems/loot` (`scrapFromVestiaire`,
 *   `polish`, `raiseCap`, `setPaquetage`, `setStartTool`, `unlockTool`, `reforgeOptions`…).
 * - La fin de Shift du loot passe par `settleShift(meta, result, runEnd)` (src/systems/meta/settle.ts),
 *   déjà appelée par la scène : il suffira de lui fournir le `RunEnd` du Shift (écran « Consigne »).
 */
import type { MetaState } from '@/systems/meta/MetaState';

export type HubServiceId = 'dpd' | 'paco';

export interface HubServiceContext {
  readonly meta: MetaState;
  /** Remplace la méta (achat, réforme, relance) : la scène la sauvegarde. */
  commit(next: MetaState): void;
  /** Reconstruit le panneau sur place (méta à jour), sans animation d'entrée. */
  refresh(): void;
  /** Ferme le panneau et rend la main au hub. */
  close(): void;
}

export interface HubServicePanel {
  /** Titre du panneau (ex. « Josiane · DPD — Vestiaire »). */
  readonly title: string;
  build(panel: HTMLElement, ctx: HubServiceContext): void;
}

export type HubServices = Readonly<Record<HubServiceId, HubServicePanel | null>>;

/** Services branchés par le lot Loot (vides au jalon J6). */
export const HUB_SERVICES: HubServices = {
  dpd: null,
  paco: null,
};

/** Description des services à venir (panneau d'attente). */
export const SERVICE_PREVIEW: Readonly<
  Record<
    HubServiceId,
    { readonly title: string; readonly quote: string; readonly items: readonly string[] }
  >
> = {
  dpd: {
    title: 'Josiane · DPD — Vestiaire et casiers',
    quote: '« Ta dotation, je la range. Ce qui est réformé, je le réforme. Proprement. »',
    items: [
      'Vestiaire : casiers de l’équipement ramené des Shifts',
      'Paquetage : les pièces emportées au départ',
      'Outil de départ et Dotations d’outil (en Pièces)',
      'Réforme en Ferraille, polissage, remise à niveau',
      'Conversion Ferraille → Pièces détachées (une fois par Shift)',
    ],
  },
  paco: {
    title: 'Béné · PACO — Recours et relances',
    quote: '« Un voyageur sans train, c’est un client de guichet. Je connais. »',
    items: [
      'Relance d’un affixe d’objet (« bus de remplacement »)',
      'Recours : relance des portes ou d’un choix d’Avantage',
      'Archives : Plans de Patrimoine, Preuves, Notes de service',
      'Le Règlement : codex des ennemis',
    ],
  },
};
