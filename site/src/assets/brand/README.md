# Marque du studio : OCC Interactive, une division de CARDOR Media

Privatix est développé par **OCC Interactive** (https://interactive.cardormedia.com/), une division de
**CARDOR Media** (https://cardormedia.com/). Ces fichiers sont la propriété de CARDOR Media ; ils
sont servis localement par le site (aucun lien direct vers le site de la holding) et reproduits
selon la charte publique https://cardormedia.com/marque.

## Fichiers

| Fichier | Signe | Provenance |
|---|---|---|
| `interactive.svg` | « Le Dragon du Doudou », emblème d'OCC Interactive (deux tons : Acid `#C6FF3D`, Olive `#5B7A00`) | Copie conforme de `static/brand/interactive.svg` du site de la holding (dépôt `fs0ciety7000/mons-corp`, commit `4cb19e4`, 2026-10-10) |
| `cardor-monogram.svg` | « La roue » du Car d'Or, monogramme de CARDOR Media (Or `#D4A84B`, Bone `#EDE8DF`, Ember `#FF3B1F`) | Copie conforme de `static/brand/cardor-monogram.svg` (même dépôt, même commit) |
| `occ-interactive-wordmark.svg` | Mot-symbole « OCC / Interactive » du lockup « Division · horizontal » | Recomposé d'après la planche E de la charte (« OCC » en Geist Mono 0,3 em, interlettrage 0,5 em, couleur de la division ; « Interactive » en Instrument Serif romain), texte vectorisé |
| `cardor-media-wordmark.svg` | Mot-symbole « CARDOR *Media* » (« Media » toujours en italique Or) | Recomposé d'après le lockup « Holding · horizontal » de la charte, texte vectorisé |

Les mots-symboles sont vectorisés (contours) depuis Instrument Serif et Geist Mono, deux polices sous
SIL Open Font License, avec le crénage des polices (HarfBuzz) : le site n'embarque aucune police.
Leurs couleurs passent par `var(--wm-ink, #EDE8DF)` et `var(--wm-accent, …)` : inchangées en `<img>`.

## Règles de la charte appliquées

- **Zone de protection** : 2x autour du signe (x = un dixième de sa hauteur).
- **Tailles minimales** (écran) : Dragon 24 px, roue 16 px. Pied de page du site : Dragon 60 px, roue 17 px.
- **Lockup division** : signe haut de 1,5 S (S = corps de « Interactive »), écart signe-texte 0,4 S.
- **Interdits** : ne pas déformer ni pivoter, pas d'effets ni d'ombres (les anciens `drop-shadow`
  du logo du studio ont été retirés), pas de couleur hors charte, pas de fond chargé (fonds unis ou
  bandes sombres uniquement), pas d'emblème d'une autre division à côté d'OCC Interactive.
- **Graphie** : « OCC Interactive », « CARDOR Media », « une division de CARDOR Media ».

## Mouvement

`site/src/brand.ts` porte en TypeScript, sans framework, le strict nécessaire de
`src/lib/brand/emblem-motion.ts` et `src/lib/components/brand/Logo.svelte` du site de la holding
(documentés dans `docs/brand/emblem-motion.md` du dépôt `mons-corp`) :

- **Dragon** : révélation « démarrage en glitch » (facettes allumées par paliers aléatoires,
  cisaillement en `steps(5)`) au premier passage dans l'écran, puis le **glitch** signature (facettes
  qui sautent au pixel près, fantôme RVB magenta, recalage) au survol ou au focus du lockup ;
- **Roue** : un tour complet en 1,6 s, le noyau Ember « bat » (échelle 1,6 puis retour élastique),
  au survol ou au focus de la mention CARDOR Media.

Les courbes `cardor.out` et `cardor.snap` (CustomEase sur le site de la holding) sont recalculées
comme des Bézier cubiques, sans greffon supplémentaire. Le HTML affiche les `<img data-emblem>` ;
le module, chargé à part, les remplace par le SVG en ligne pour animer chaque facette. En
`prefers-reduced-motion: reduce`, le module n'est pas chargé : les logos restent statiques.
