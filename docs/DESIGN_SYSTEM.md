# PRIVATIX — Design system « Néon & Ballast »

> **Rôle** : Web design / intégration · **Statut** : v1, appliqué au site vitrine (`site/`).
> **Sources** : interface du jeu (`src/ui/hud/hud3d.css`, `prototypes/proto3d/src/style.css`, `prototypes/proto3d/index.html`), direction artistique 3D (`docs/proposals/revue-3d-loot/art_director.md`), GDD § 1.3 (couleurs canoniques) et § 9 bis.3 (raretés), LORE § 1.4 (ton).
> **Implémentation de référence** : `site/src/styles/tokens.css` (tokens), `site/src/styles/components.css` (composants), `site/src/motion.ts` (mouvement GSAP).
> **Règle de priorité** : le GDD fait foi sur les couleurs canoniques et les raretés. Ce document fait foi sur leur usage dans les interfaces DOM (site, HUD, menus, inventaire).

**Sommaire** : 1 Principes · 2 Tokens · 3 Composants · 4 Mouvement (GSAP) · 5 Accessibilité · 6 Ton éditorial · 7 Réutilisation dans le jeu · 8 Licences.

---

## 1. Principes

| # | Principe | En pratique |
|---|---|---|
| 1 | **La nuit, jamais le noir** | Fonds violet nuit (`--px-night` `#0A0818`). Aucune ombre ni aucun fond en noir pur : les ombres tirent vers le violet (`#2A2148`) ou le prune (`#3A1E22`), comme dans le rendu toon. |
| 2 | **Encré comme une figurine** | Tout élément d'interface a un **contour encré de 2 px** (`--px-ink` `#14101A`), un **liseré coloré** (outline de 2 px, souvent rentré de 6 px) et une **ombre portée dure** (`0 4px 0`), sans flou. C'est le geste « BD » de Hades appliqué au DOM. |
| 3 | **Chaque couleur a un rôle** | Orange héros = l'action du joueur. Turquoise = Privatix et ses ennemis. Magenta = néon Privatix et danger, **jamais** une action positive. Cyan = information, focus, dash. Couleurs de rareté = uniquement le butin. |
| 4 | **Les néons sont des émissifs** | Une lueur (`text-shadow`, `box-shadow` flou) signale une source de lumière : titre néon (artbook), nom d'élite, objet rare. Le logo, lui, ne brille pas (§ 2.9). Deux émissifs au plus par écran, sinon plus rien ne brille. |
| 5 | **Lisible d'abord** | Contrastes AA au minimum (AAA pour le texte courant), focus toujours visible, mouvement réductible et aucun clignotement en mouvement réduit. Comme dans le jeu : si ce n'est pas lisible, ce n'est pas juste. |

---

## 2. Tokens

Tous les tokens sont des propriétés CSS sur `:root` (`site/src/styles/tokens.css`). Préfixe `--px-` pour les couleurs de marque, `--rar-` pour les raretés.

### 2.1 Couleurs canoniques

| Token | Valeur | Rôle | Usage |
|---|---|---|---|
| `--px-ink` | `#14101A` | Contour | Bordures de tous les composants, texte sur fond orange |
| `--px-hero` | `#FF7A1A` | Orange haute visibilité du héros | **Action principale** (bouton primaire), jauge d'Énergie |
| `--px-hero-hi` / `--px-hero-lo` | `#FFB04A` / `#D9481A` | Rampe de l'orange | Dégradés du bouton primaire et de la jauge |
| `--px-scarf` | `#E0302A` | Écharpe syndicale | Accent rare (illustration), jamais pour une erreur |
| `--px-enemy` | `#19C3B1` | Turquoise ennemi / Privatix | Bestiaire, badges « Ennemi », étapes du Shift |
| `--px-enemy-ink` | `#06302C` | Contour ennemi | Contour d'une figure ennemie |
| `--px-danger` | `#FF3EA5` | Magenta | **Néons Privatix** (titres néon) et **danger** (télégraphes, badge « Boss »). Jamais sur un bouton d'action. |
| `--px-violet` | `#6B3FA0` | Violet Privatix (désaturé) | Halos de fond, autocollants Privatix |
| `--px-violet-hi` | `#B05CFF` | Liseré d'élite | Cartes d'élite, FAQ |
| `--px-rim` | `#6FF3FF` | Liseré cyan des quais | **Focus**, liens, liseré du bouton secondaire, puces de dash |
| `--px-gold` | `#FFD200` | Mobilisation | Jauge de Mobilisation, Coup de sifflet |
| `--px-sodium` | `#FFB347` | Lampes à sodium | Encart d'avertissement |
| `--px-tungsten` | `#FFC27A` | Pupitres de l'OCC | Tout ce qui parle de l'OCC (pupitres, chaleur humaine) |

### 2.2 Fonds et texte

| Token | Valeur | Contraste sur `--px-night` | Usage |
|---|---|---|---|
| `--px-night` | `#0A0818` | — | Fond de page (fond du jeu) |
| `--px-night-2` | `#120D24` | — | Sections alternées, fond des médias |
| `--px-panel` | `rgba(16, 11, 30, .82)` | — | Panneaux (emplacements, encarts, FAQ) |
| `--px-panel-top` → `--px-panel-bottom` | `rgba(30,20,52,.96)` → `rgba(12,8,24,.96)` | — | Dégradé des cartes d'objet |
| `--px-text` | `#FFFFFF` | 19,8:1 | Titres, texte fort |
| `--px-text-soft` | `#DCD8EF` | 14,2:1 | Texte courant |
| `--px-text-mute` | `#A9A3C8` | 8,3:1 | Métadonnées, dates, notes |
| `--px-label` | `#FFD9B8` | 15:1 | Libellés de jauge (ÉNERGIE, BURNOUT) |
| `--px-cream` / `--px-perk` / `--px-up` | `#FFF3C8` / `#FFE7A8` / `#7DFF9A` | > 12:1 | Combo, effet d'objet, statistique en hausse |

### 2.3 Raretés d'équipement (GDD § 9 bis.3)

| Rareté | Token | Valeur | Remarque |
|---|---|---|---|
| Réforme | `--rar-reforme` | `#8A929A` | Gris acier, usé |
| Réglementaire | `--rar-reglementaire` | `#F2EEE3` | Blanc cassé |
| Homologué | `--rar-homologue` | `#3F8CFF` | Bleu signal |
| Hors-série | `--rar-hors-serie` | `#A86BFF` | Violet clair émissif (à distinguer du violet Privatix) |
| Patrimoine | `--rar-patrimoine` | `#FF8C2B` | Cuivre, reflets or, seul badge à pastille lumineuse |

Aucune rareté n'utilise le magenta, le turquoise ni le jaune `#FFD23F` (réservés). Un composant à couleur variable lit la propriété **`--rc`** (« rarity color »), comme les cartes et emplacements du prototype.

### 2.4 Typographie

Aucune police n'est téléchargée : on reprend les piles du jeu, rendues par le système (zéro requête, zéro saut de mise en page).

| Token | Pile | Usage |
|---|---|---|
| `--font-display` | `'Arial Black', 'Helvetica Neue', Arial, system-ui, sans-serif`, graisse **900** | Titres, libellés en capitales, boutons |
| `--font-text` | `'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif` | Texte courant, valeurs de jauge |
| `--font-mono` | `ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace` | Code des pupitres (PACO, RTS), noms de fichiers, mesures F3 |

| Token | Taille | Usage |
|---|---|---|
| `--fs-2xs` | 11 px | Libellé de rareté, `kbd`, kicker de carte |
| `--fs-xs` / `--fs-sm` | 12 / 14 px | Métadonnées / texte de carte |
| `--fs-base` / `--fs-md` | 16 / 18 px | Texte courant / chapeau |
| `--fs-lg` | 22 px | Nom d'objet, combo |
| `--fs-xl` / `--fs-2xl` | `clamp(24 → 36 px)` / `clamp(32 → 56 px)` | Titres de section |
| `--fs-display` | `clamp(44 → 112 px)` | Échelle du logo du hero (largeur max. 5,4 × `--fs-display`), titre « ARTBOOK » |

Espacement des lettres : `--tracking-label` 0,12 em (ÉNERGIE), `--tracking-title` 0,18 em (PRIVATIX), `--tracking-wide` 0,22 em (nom d'élite, surtitres). Les libellés en capitales sont **toujours** espacés ; le texte courant ne l'est jamais.

### 2.5 Espacements, rayons, ombres

- **Espacements** (grille de 4 px) : `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 24 · `--sp-6` 32 · `--sp-7` 48 · `--sp-8` 64 · `--sp-9` 96 px. Gouttière `--gutter` : `clamp(16px, 4vw, 40px)` (16 px à 360 px de large). Largeur utile `--maxw` 1180 px.
- **Rayons** : `--r-xs` 2 px (jauges), `--r-sm` 4 px (emplacements, boutons, `kbd`), `--r-md` 6 px (cartes d'objet), `--r-lg` 10 px (médias), `--r-pill`. Jamais de grands arrondis : la figurine est taillée, pas moulée.
- **Bordure** : `--bd` = `2px solid var(--px-ink)`.
- **Ombres dures** : `--sh-drop` `0 4px 0 rgba(0,0,0,.45)` (boutons, emplacements), `--sh-card` `0 8px 0` (cartes), `--sh-text` `0 2px 0 #000`.
- **Inclinaison** : `--skew` `skewX(-12deg)` pour les jauges, `-20deg` pour les puces de dash.

### 2.6 Lueurs néon

| Token | Valeur | Usage |
|---|---|---|
| `--glow-magenta` | `0 0 14px #FF3EA5, 0 0 2px #FF3EA5, 0 2px 0 #000` | Titre néon, nom d'élite (repris de `#title b` du prototype) |
| `--glow-cyan` | `0 0 10px #6FF3FF, 0 0 2px #6FF3FF` | Survol d'un lien |
| `--glow-orange` | `0 0 10px #FF8A1A, 0 3px 0 #14101A` | Combo, devise (« Satirique dans les noms… ») |
| `--glow-box-cyan` | `0 0 8px #6FF3FF` | Puce de dash active |
| `--glow-box-rarity` | `0 0 34px color-mix(--rc 45 %)` | Carte d'objet au survol (repris de `.card` du prototype) |

### 2.7 États

| État | Règle |
|---|---|
| Survol | Monte de 2 à 4 px et allume la lueur de sa couleur (`--btn-line` ou `--rc`). Jamais de changement de couleur de fond seul. |
| Focus clavier | `:focus-visible` : `--focus-ring` (`3px solid --px-rim`), `--focus-offset` 3 px. Toujours visible, y compris sur fond orange. |
| Pression | `translateY(var(--press-y))` (3 px) et `scale(.98)`, ombre réduite : le bouton s'enfonce comme le bouton tactile du jeu (`.down`). |
| Désactivé | `aria-disabled="true"` ou `:disabled` : `--disabled-opacity` 0,45, désaturé, sans pointeur. |
| Courant | Liseré gauche orange (`.dl-file--current`) : l'élément recommandé pour vous. |

### 2.8 Mouvement

| Token CSS | Valeur | GSAP (`DUR`, `EASE` de `site/src/motion.ts`) | Usage |
|---|---|---|---|
| `--dur-instant` | 80 ms | `DUR.instant` 0,08 | Retour de pression |
| `--dur-fast` | 150 ms | `DUR.fast` 0,15 | Survol de bouton, lien |
| `--dur-base` | 250 ms | `DUR.base` 0,25 | Carte, accordéon |
| `--dur-slow` | 600 ms | `DUR.slow` 0,6 | Révélation au scroll, zoom de vignette |
| `--dur-xslow` | 1 200 ms | `DUR.xslow` 1,2 | Compteur, remplissage de jauge |
| `--ease-ballast` | `cubic-bezier(.16, 1, .3, 1)` | `EASE.ballast` = `expo.out` | Entrée lourde qui se pose : défaut des révélations |
| `--ease-coup` | `cubic-bezier(.34, 1.56, .64, 1)` | `EASE.coup` = `back.out(1.7)` | Impact, pop, survol de bouton |
| `--ease-rail` | `cubic-bezier(.65, 0, .35, 1)` | `EASE.rail` = `power2.inOut` | Glissement continu, parallax |
| `--ease-neon` | `steps(1, end)` | `EASE.neon` = `steps(1)` | Allumage tout ou rien d'un tube |
| — | — | `EASE.sifflet` = `elastic.out(1, .5)` | Réservé au Coup de sifflet (un seul usage par écran) |

En `prefers-reduced-motion: reduce`, tous les `--dur-*` valent 0 ms (transitions CSS coupées) et `motion.ts` n'anime rien (§ 4.3).

### 2.9 Logo

Le site utilise le **logo mono blanc officiel** fourni par le porteur du projet : [`docs/marketing/officiel/logo/privatix-logo-mono-blanc.svg`](marketing/officiel/logo/privatix-logo-mono-blanc.svg) (emblème clé à tire-fond + rail au-dessus du mot PRIVATIX, tout blanc, vectoriel). Plus de néon sur le logo : ni lueur, ni allumage, ni clignotement.

| Emplacement | Fichier | Règle |
|---|---|---|
| Hero (`h1`) | `site/src/assets/img/privatix-logo-mono-blanc.svg` : logo complet, viewBox resserré sur l'encre (marge 24 unités) | Aligné à gauche sur le texte du hero ; largeur `min(100 %, 5,4 × --fs-display)` (≈ 240 px sur mobile, 605 px sur grand écran) ; `alt="PRIVATIX"` ; ombre portée douce (`drop-shadow`) pour la lisibilité sur la vidéo ; entrée en simple fondu (`heroIntro`, § 4.2). |
| En-tête (index, artbook) | `site/src/assets/img/privatix-wordmark-mono-blanc.svg` : le mot seul, recadré du même SVG (même tracé, sans l'emblème) | Hauteur 22 px. Le logo complet à la hauteur de l'en-tête donnerait des lettres de 10 px : illisible. |
| Press kit | `site/public/artbook/presskit/logo/privatix-logo-mono-blanc.svg` et `-mono-noir.svg`, copies exactes des fichiers officiels | Le blanc sur fond sombre, le noir sur fond clair ; les PNG couleur (lockups) restent disponibles. |

- **Jamais** recoloré, déformé, ni augmenté d'une lueur ; pas de version « néon » du logo sur le site.
- Les copies du site sont produites par `node tools/marketing/sync-site.mjs` (recadrage par viewBox, aucune retouche du tracé).
- Favicons et icônes d'application : inchangés (icône officielle `docs/marketing/officiel/logo/icone/`).

---

## 3. Composants

Classes de `site/src/styles/components.css`. Chaque composant est autonome : il ne dépend que des tokens.

### 3.1 Bouton — `.btn`

| Variante | Classe | Aspect | Usage |
|---|---|---|---|
| **Primaire** | `.btn.btn--primary` | Dégradé radial orange (`--px-hero-hi` → `--px-hero` → `#B4400F`), texte encre, liseré orange décalé de 2 px | **Une seule action principale par écran** : « Jouer », « Télécharger pour Windows ». |
| **Secondaire** | `.btn.btn--secondary` | Panneau sombre, liseré cyan | Action d'appoint : « Télécharger », « Fermer ». |
| Grand | `+ .btn--lg` | 60 px de haut, texte 18 px | Hero, téléchargement mis en avant. |

Anatomie : icône SVG de 20 px (`aria-hidden`), libellé en capitales (`--font-display` 900), sous-libellé facultatif en `<small>` (police de texte, casse normale : « Gratuit · aucune installation », taille et nom du fichier). Cible tactile de 48 px au moins. Un lien qui navigue reste un `<a class="btn">` ; une action reste un `<button>`.

```html
<a class="btn btn--primary btn--lg" href="./jouer/play3d.html">
  <svg aria-hidden="true">…</svg>
  <span>Jouer dans le navigateur<small>Gratuit · aucune installation</small></span>
</a>
```

### 3.2 Carte — `.card`

Reprise de la **carte d'objet** du prototype : dégradé de panneau, contour encré, liseré `--rc` rentré de 6 px, ombre de 8 px.

- Parties : `.card__kicker` (surtitre en capitales, couleur `--rc`), `.card__title` (titre 22 px avec halo `--rc`), `.card__body`, `.card__flavor` (italique, séparé d'un filet : réplique ou texte de saveur), `.card__icon` (pictogramme 40 px en haut à droite, lueur `--rc`).
- Variantes de couleur : `.card--enemy` (turquoise), `.card--boss` (violet d'élite), ou `style="--rc: …"` (rareté, orange héros, tungstène).
- `.card--interactive` : monte de 4 px et s'illumine au survol et au focus interne.
- Règle : une carte = un sujet ; une réplique au plus dans `.card__flavor` (≤ 2 lignes, LORE § 1.4).

### 3.3 Badge de rareté — `.badge`

Petit cartouche reprenant l'**emplacement d'équipement** du HUD : liseré gauche de 4 px, losange de couleur, libellé en capitales.

- Raretés : `.badge--reforme`, `--reglementaire`, `--homologue`, `--hors-serie`, `--patrimoine` (seul à pastille lumineuse).
- Rôles du bestiaire : `.badge--enemy` (turquoise), `.badge--elite` (violet), `.badge--boss` (magenta : un boss **est** un danger).
- Le libellé est toujours écrit en toutes lettres : la couleur n'est jamais la seule information.

### 3.4 Encart — `.callout`

Panneau à liseré gauche coloré et pictogramme, pour une information à ne pas manquer.

- `.callout--info` (cyan) : explication, conseil.
- `.callout--warning` (sodium) : avertissement non bloquant (applications non signées, SmartScreen, Gatekeeper).
- Pas de variante « erreur » rouge : l'écharpe rouge et le magenta ont déjà un sens. Une erreur s'écrit en clair dans un encart d'avertissement.

### 3.5 Éléments de HUD

- **Jauge** `.gauge` (`--energy`, `--burnout`, `--mob`) : piste `--px-track`, inclinée de −12°, remplissage par `--fill` (0 à 1). Libellé `.gauge-label` en capitales avec valeur en police de texte à droite.
- **Puces** `.pips > i.on` : charges de dash, cyan lumineux quand disponibles.
- **Touche** `kbd` : bordure claire, bas épaissi de 3 px, comme dans l'aide du jeu.

---

## 4. Mouvement (GSAP)

### 4.1 Bibliothèque

- **GSAP 3.15.0**, version **exacte** (`site/package.json`), installée par npm et **bundlée par Vite** : aucun CDN.
- Seuls le cœur (`gsap`) et **ScrollTrigger** sont importés. Les autres plugins (SplitText, Flip, MotionPath…) sont gratuits mais ne s'importent que le jour où un preset en a besoin.
- Le module `site/src/motion.ts` est chargé **à part** (`import()` dynamique, `requestIdleCallback`) : il ne bloque ni le premier rendu ni le LCP.

### 4.2 Presets (`site/src/motion.ts`)

| Preset | Fonction | Comportement | Règles |
|---|---|---|---|
| **Entrée du hero** | `heroIntro(root)` | Timeline : le logo monte d'un simple fondu (`opacity .2 → 1`, 6 px, `EASE.ballast`, `DUR.slow`), puis les boutons font un pop d'impact (`scale .94 → 1`, `EASE.coup`). | Rien n'est masqué : le contenu du hero est déjà peint et compte pour le LCP. |
| **Révélation au scroll** | `reveal(elements)` | `ScrollTrigger.batch`, une fois : `y 24 → 0`, opacité 0 → 1, `DUR.slow`, `EASE.ballast`, décalage 80 ms. | L'état masqué n'est posé que par JS et seulement **sous la ligne de flottaison** : sans JS, tout est visible. |
| **Allumage néon** | `neonIgnite(el)` (titres néon, plus jamais le logo) | Coupures nettes (`EASE.neon`) : 15 % → 100 % → 30 % → 100 % → 55 % → 100 %, en 0,4 s. | Une fois, à l'apparition. |
| **Allumage des portraits** | `portraitIgnite(images)` | Portraits 3D (bestiaire, équipement, collègues) : `scale 1.1 → 1`, luminosité 25 % → 100 %, `DUR.xslow`, `EASE.ballast`, par lot au scroll, décalage 120 ms ; propriétés rendues au CSS à la fin (survol). | Sous la ligne de flottaison seulement ; rien en mouvement réduit. |
| **Néon fatigué** | `neonFlicker(el)` | Micro-coupure de 0,15 s toutes les 6 à 12 s. | Un seul élément par page. Désactivé en mouvement réduit. |
| **Survol** | CSS (tokens) | Boutons : monte de 2 px, `--ease-coup`, `--dur-fast`. Cartes : monte de 4 px, lueur `--rc`, `--ease-ballast`, `--dur-base`. | En CSS pour rester instantané ; GSAP n'est pas nécessaire. |
| **Compteur** | `countUp(el)` | `data-count="30"` : défile de 0 à 30 en `DUR.xslow` quand visible. | La valeur finale est déjà dans le HTML. |
| **Jauge** | `fillGauge(el)` | `scaleX 0 → 1` depuis la gauche, `EASE.ballast`. | Décoratif uniquement. |
| **Parallax léger** | `parallax(media, trigger, 12)` | Le média du hero glisse de 12 % pendant que la page défile (`scrub: 0.4`). | 15 % au plus, un seul calque. |

### 4.3 Accessibilité du mouvement

Toute animation passe par `gsap.matchMedia()` :

```ts
const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', () => { /* presets */ });
mm.add('(prefers-reduced-motion: reduce)', () => {
  gsap.set('[data-reveal], [data-neon]', { clearProps: 'opacity,visibility,transform' });
});
```

- En mouvement réduit : **aucune** révélation, aucun parallax, aucun compteur animé et **aucun clignotement** ; la vidéo du hero ne démarre pas (l'affiche fixe reste) ; les transitions CSS tombent à 0 ms par les tokens.
- Le changement de préférence en cours de visite est suivi (matchMedia réverte les animations).
- Jamais plus de 3 flashs par seconde, même en mouvement complet (critère WCAG 2.3.1) : `neonIgnite` en fait 3 en 0,4 s, une seule fois.

---

## 5. Accessibilité

- **Contrastes** : texte courant ≥ 7:1 (AAA) sur `--px-night` ; texte sur bouton primaire (encre sur orange) ≈ 7:1 ; liens cyan ≈ 15:1.
- **Focus** : anneau cyan de 3 px sur tout élément interactif ; lien d'évitement « Aller au contenu ».
- **Structure** : un `h1` (le logo, `alt="PRIVATIX"`), un `h2` par section, listes sémantiques (`role="list"` quand le style retire les puces), `aria-live="polite"` sur la zone de téléchargement mise à jour par JS.
- **Images** : texte alternatif descriptif pour les captures, `alt=""` pour les décorations ; dimensions déclarées (pas de décalage de mise en page), `loading="lazy"` hors du premier écran.
- **Couleur** : jamais seule porteuse de sens (raretés et rôles écrits en toutes lettres).
- **Responsive** : dès 360 px de large, sans défilement horizontal ; cibles tactiles ≥ 48 px.

---

## 6. Ton éditorial

Le ton du jeu (LORE § 1.4) s'applique à toute interface : **satirique dans les noms, sérieux dans les règles**.

- Humour belge, pince-sans-rire ; on rit avec les cheminots, jamais contre eux ni contre les voyageurs.
- Les textes d'action sont clairs (« Jouer dans le navigateur », « Télécharger pour Windows ») ; la blague va dans le sous-titre ou la saveur.
- Ennemis « partent en réunion », jamais « meurent ». La SNCB est le service public que l'on défend ; Elio Di Rupo est une caricature bon enfant, toujours signalée comme telle, sans citation réelle.

---

## 7. Réutilisation dans le jeu

L'UI DOM de l'entrée 3D (`src/ui/hud/`, puis les menus, l'inventaire et le Vestiaire) **pourra réutiliser** ces tokens et ces presets sans rien changer au rendu actuel :

- `hud3d.css` déclare déjà `--ink`, `--hero`, `--enemy`, `--danger`, `--rim`, `--gold`, `--panel`, `--font`, `--text` : ce sont les mêmes valeurs que `--px-*` et `--font-*`. Une migration consisterait à importer `tokens.css` et à aliaser les anciens noms.
- Les cartes d'objet, emplacements et badges de rareté du jeu suivent déjà l'anatomie du § 3 (propriété `--rc`). Le jeu doit passer des raretés du prototype (Commun, Rare, Épique, Légendaire) aux cinq raretés canoniques du § 2.3.
- Les presets de `motion.ts` (révélation, pop d'impact, néon, compteur) conviennent aux menus et à l'inventaire. **Exception** : tout ce qui suit le temps de la simulation (hitstop, ralenti, nombres de dégâts) reste piloté par la boucle du jeu, pas par GSAP.
- La réduction des mouvements du jeu (touche **M**, `?rm=1`, `body.reduced-motion`) doit alimenter le même `gsap.matchMedia()` (condition supplémentaire sur la classe), pour qu'un seul réglage coupe tout.

Ce document ne modifie pas le jeu : l'adoption se fera dans un lot dédié.

---

## 8. Licences

- **GSAP 3.15.0** (GreenSock, aujourd'hui Webflow) : « Standard "no charge" license » (`https://gsap.com/standard-license`), mentionnée dans `node_modules/gsap/README.md` et l'en-tête des fichiers (« Copyright 2008-2026, GreenSock. All rights reserved. Subject to the terms at https://gsap.com/standard-license »). Gratuite, y compris pour un usage commercial et pour tous les plugins (ScrollTrigger, SplitText…). Ce n'est **pas** une licence open source : elle interdit notamment d'utiliser GSAP dans un outil qui concurrence les constructeurs visuels d'animations de Webflow, ce qui ne concerne pas Privatix.
- **Polices** : aucune police embarquée (polices système).
- **Studio : OCC Interactive, une division de CARDOR Media** : emblème « Le Dragon du Doudou », monogramme « La roue » et mots-symboles, propriété de CARDOR Media, servis localement depuis `site/src/assets/brand/` (provenance, charte et règles d'usage dans `site/src/assets/brand/README.md`, charte publique https://cardormedia.com/marque). Les mots-symboles sont vectorisés (Instrument Serif et Geist Mono, OFL) : le site n'embarque toujours aucune police. Le mouvement des emblèmes (`site/src/brand.ts`) est porté du site de la holding et n'est jamais joué en mouvement réduit.
- **SNCB** : nom et logo autorisés par le porteur du projet (LORE § 1.4), uniquement comme service public défendu.
