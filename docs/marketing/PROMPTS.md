# Visuels marketing — prompts Nano Banana

Prompts envoyés à la génération d'images Gemini (Nano Banana) par `tools/marketing/nanobanana.mjs`. Ils sont rédigés en anglais pour le modèle ; chaque entrée a un résumé en français et la liste des images de référence passées dans la requête. La source exécutable est `lot1/jobs.json` : ce document en est la copie lisible, à tenir synchronisée.

## Règles communes

- Style : rendu toon 3D de nos modèles (figurines, cel shading, contours encrés, contre-jours colorés), jamais photoréaliste.
- Palette « Néon & Ballast » (`docs/DESIGN_SYSTEM.md` § 2) : nuit violette `#0A0818`, orange héros `#FF7A1A`, néon magenta `#FF3EA5`, turquoise ennemi `#19C3B1`, cyan `#6FF3FF`, jaune mobilisation `#FFD200`.
- Titre : « PRIVATIX » en capitales très grasses façon Arial Black, espacées, néon blanc-rose à halo magenta et ombre dure encrée (logotype du site, `site/public/artbook/presskit/privatix-logo-fond.png`).
- Personnages : uniquement nos designs, passés en référence (≤ 5 portraits par requête). Elio Di Rupo et Jean-Cul Lurcke : nos caricatures toon bon enfant, dignes, jamais photoréalistes ni dégradées. Aucune photo de personne réelle.
- SNCB : nom et logo autorisés (droits du porteur du projet), utilisés sobrement comme service public défendu. Aucune autre marque.

## Lot 1 (exploratoire)

### `logo-a-neon-cle`

- **Modèle** : `gemini-nano-banana-2.1` · **Format** : 1:1, 2K
- **Résumé** : Wordmark néon magenta du site + emblème : la clé à tire-fond orange posée en diagonale sur un tronçon de rail et de ballast, étincelle-éclair jaune ; la clé fêle une lettre néon (le cheminot casse le néon corporate).
- **Références** :
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `site/public/bestiaire/hero.webp`

```text
Video game logo for "PRIVATIX", a stylized 3D toon hack-and-slash roguelite set in a Belgian train station at night. Square composition, centered, on a deep violet-night background (#0A0818, never pure black) with a faint violet halo.

WORDMARK: the single word PRIVATIX in heavy geometric sans-serif capitals (Arial Black weight, wide letter-spacing), exactly matching the lettering of the first reference image: white-pink neon tube letters with a hot magenta glow (#FF3EA5) and a hard dark ink drop shadow. Spelling must be exactly P-R-I-V-A-T-I-X.

EMBLEM above or behind the wordmark: an old heavy railway track wrench (a long T-handled socket wrench used to tighten rail spikes, as held by the orange hero in the third reference) laid diagonally across a short section of railway track on ballast stones, painted in the hero's high-visibility orange (#FF7A1A) with a thick dark ink outline (#14101A), cel-shaded like a painted figurine. A small yellow union lightning bolt (#FFD200) sparks where the wrench hits the rail. The orange wrench slightly cracks one magenta neon letter: the worker breaks the corporate neon.

Style: clean vector-like toon rendering, bold 2 px ink outlines, hard cel shading, readable at small size, no extra text, no other logos, no watermark, no gradients mesh, no photorealism. Use the colour palette of the second reference (orange hero, magenta neon, cyan rim light #6FF3FF accents, violet night).
```

### `logo-b-plaque-ballast`

- **Modèle** : `gemini-nano-banana-2.1` · **Format** : 1:1, 2K
- **Résumé** : Plaque émaillée / pin's syndical inclinée sur ballast et rails ; PRIVATIX en néon magenta à moitié éteint ; clé orange et éclair jaune croisés derrière, écharpe rouge nouée sur le manche.
- **Références** :
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `site/public/bestiaire/hero.webp`

```text
Video game logo badge for "PRIVATIX" (stylized 3D toon roguelite, railway workers versus consultants). Square, centered, deep violet-night background (#0A0818).

Design: a chunky enamel railway station sign / union pin badge, slightly tilted, with a thick dark ink outline (#14101A) and a hard drop shadow, sitting on a bed of grey ballast stones and two converging steel rails. On the sign, the word PRIVATIX in heavy geometric sans-serif capitals (Arial Black weight, wide letter-spacing), spelled exactly P-R-I-V-A-T-I-X, glowing as magenta neon (#FF3EA5) like the first reference image, but half of the neon tubes are flickering off. Crossed behind the sign: the orange railway track wrench (long T-handled socket wrench, hero orange #FF7A1A) and a yellow lightning bolt (#FFD200). A small red union scarf (#E0302A) is knotted around the wrench handle.

Style: cel-shaded toon figurine look, bold ink outlines, flat lighting with a cyan rim light (#6FF3FF), clean shapes readable as an icon, no additional words, no other logos, no watermark, no photorealism.
```

### `logo-c-pro-wordmark-rail`

- **Modèle** : `gemini-3-pro-image` · **Format** : 1:1, 2K
- **Résumé** : Version Pro, typographique : le V devient deux rails en perspective, la barre du A une traverse ; la clé à tire-fond souligne le mot, étincelle jaune.
- **Références** :
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `site/public/bestiaire/hero.webp`

```text
Professional video game title logo, square format, centered on a deep violet-night background (#0A0818, with a soft violet vignette, never pure black).

Main element: the wordmark PRIVATIX (exactly eight letters: P R I V A T I X) in very heavy geometric sans-serif capitals, Arial Black style, generous letter-spacing, built as glowing white-pink neon tubes with a magenta glow (#FF3EA5) and a hard dark ink drop shadow (#14101A), matching the first reference image. The letter V is replaced by two railway rails converging in perspective, sitting on ballast stones; the crossbar of the A is a railway sleeper. Under the wordmark, a heavy orange railway track wrench (T-handled socket wrench, hero orange #FF7A1A, ink outline, as carried by the hero in the third reference) lies horizontally like an underline, with a small yellow lightning spark (#FFD200) at its tip.

Typography must be crisp, perfectly spelled, evenly kerned. Toon cel-shaded rendering, bold outlines, clean and iconic, readable at 64 px. No tagline, no other text, no other logos, no watermark.
```

### `logo-d-pro-embleme`

- **Modèle** : `gemini-3-pro-image` · **Format** : 1:1, 2K
- **Résumé** : Version Pro, bloc emblème + wordmark : médaille ronde (casque orange, clé croisée avec un rail, éclair), PRIVATIX néon dessous, filet cyan et sous-titre « HACK 'N' SLASH FERROVIAIRE ».
- **Références** :
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `site/public/bestiaire/hero.webp`

```text
Video game logo lock-up, square, centered on a deep violet-night background (#0A0818).

Top: a round emblem like a railway workers' union medal: a dark violet disc with a thick hero-orange ring (#FF7A1A) and dark ink outline (#14101A); inside, an orange worker's hard hat (like the hero in the third reference) above a railway track wrench crossed with a short rail section, and a yellow lightning bolt (#FFD200) between them. Cel-shaded toon, bold outlines.

Below: the wordmark PRIVATIX (exactly P R I V A T I X) in very heavy geometric sans-serif capitals, Arial Black style, wide letter-spacing, glowing white-pink neon with a magenta halo (#FF3EA5) and a hard ink drop shadow, matching the first reference image exactly in letter shapes.

Under the wordmark, a thin cyan line (#6FF3FF) and small spaced capitals: HACK 'N' SLASH FERROVIAIRE (spelled exactly). Crisp typography, balanced composition, readable at small size, no other text, no other logos, no watermark, no photorealism.
```

### `affiche-a-key-art`

- **Modèle** : `gemini-nano-banana-2.1` · **Format** : 2:3, 2K
- **Résumé** : Key art vertical : héros au premier plan, clé en garde ; quais de Mons avec panneau SNCB à moitié recouvert d'autocollants Privatix ; Passerelle « Calatrava » au néon ; silhouettes géantes du Discosaure, de Di Rupo (caricature toon bon enfant) et de Lurcke ; nuée de consultants turquoise. Titre, « Le rail n'est pas à vendre. », crédit studio et plateformes.
- **Références** :
  - `site/public/bestiaire/hero.webp`
  - `site/public/bestiaire/dirupo.webp`
  - `site/public/bestiaire/discosaure.webp`
  - `site/public/bestiaire/lurcke.webp`
  - `site/public/bestiaire/consultant.webp`
  - `site/public/artbook/planches/decor-passerelle-1200.webp`
  - `site/public/artbook/planches/decor-quais-1200.webp`
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `docs/references/sncb_logo.png`
  - `site/public/artbook/planches/da-palette-1200.webp`

```text
Official key art poster for the video game PRIVATIX, portrait 2:3, in the exact stylized 3D toon style of the reference character renders: chunky low-poly figurines, cel shading, bold dark ink outlines, colored rim lights. Not photorealistic.

FOREGROUND (lower half, low camera angle, heroic): the railway worker hero from the first reference, identical design: orange hard hat, orange high-visibility vest, red scarf, navy work trousers, brown moustache, holding his long T-handled railway track wrench with both hands, ready to fight, lit by warm orange light. Determined but friendly expression.

MIDGROUND: the platforms of Mons railway station at night, ballast, rails and a blue-and-white SNCB sign (use the SNCB logo from the reference, small and clean, on a platform sign) half covered by violet Privatix stickers. Behind, the great white arched footbridge nicknamed "le Calatrava" (sixth reference: white ribs, glass roof) glowing with magenta and cyan neon.

BACKGROUND (upper part, as big dark silhouettes with magenta rim light against the neon sky, toon style matching references): three bosses: the Discosaure (purple dinosaur with a mirror disco ball on its back, discosaure reference), the friendly caricature in navy suit with big burgundy bow tie and brown quiff waving (dirupo reference, toon figurine, dignified), and the bald director in navy suit with blue tie holding up a pen (lurcke reference). Around them, a swarm of small turquoise consultants (#19C3B1) in suits holding slides and laptops, pouring towards the hero.

TEXT: at the top, the title PRIVATIX (exactly P R I V A T I X) in heavy Arial Black style capitals, wide spacing, white-pink neon with magenta glow, matching the Privatix logo reference. Under it, small: "Le rail n'est pas à vendre." At the very bottom, small clean white text on two lines: "Développé par OCC MONS Studios" and "PC · Mac · Linux · Navigateur". Spell every word exactly as written, with French accents.

Palette: violet night (#0A0818), hero orange (#FF7A1A), magenta neon (#FF3EA5), turquoise enemies (#19C3B1), cyan rim (#6FF3FF). Strong readable silhouettes, cinematic poster composition, no other logos or brands, no watermark.
```

### `affiche-b-pro-key-art`

- **Modèle** : `gemini-3-pro-image` · **Format** : 2:3, 2K
- **Résumé** : Même brief en Nano Banana Pro (meilleur rendu du texte) : héros clé sur l'épaule, marée de consultants, Passerelle au néon, trois silhouettes de boss (Di Rupo sur l'estrade du tapis rouge), bande de crédits en bas.
- **Références** :
  - `site/public/bestiaire/hero.webp`
  - `site/public/bestiaire/dirupo.webp`
  - `site/public/bestiaire/discosaure.webp`
  - `site/public/bestiaire/lurcke.webp`
  - `site/public/bestiaire/consultant.webp`
  - `site/public/artbook/planches/decor-passerelle-1200.webp`
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `docs/references/sncb_logo.png`
  - `site/public/artbook/planches/da-palette-1200.webp`

```text
Official video game poster, portrait 2:3, title PRIVATIX. Render everything in the same stylized 3D toon figurine style as the character reference images (cel shading, bold ink outlines, coloured rim lights, chunky proportions). Never photorealistic.

Composition, bottom to top:
1. Foreground, centre, three-quarter view from slightly below: the railway worker hero exactly as in the first reference (orange hard hat, orange hi-vis vest, red scarf, navy trousers, moustache), raising his long T-handled railway track wrench over his shoulder, standing on rails and ballast. Warm orange key light.
2. Behind him, a tide of small turquoise consultants (#19C3B1) in suits with laptops and slide boards, rushing across the platform.
3. Mid-distance: the white ribbed arches and glass roof of the Mons station footbridge "le Calatrava" (sixth reference), at night, outlined with magenta (#FF3EA5) and cyan (#6FF3FF) neon. A small blue-and-white SNCB sign (SNCB logo reference) on a platform pillar, the public service being defended.
4. Upper third: three huge boss silhouettes against a violet sky, rim-lit in magenta, recognisable by shape: the purple Discosaure with a mirror disco ball on its back (left), the cheerful toon caricature with burgundy bow tie and brown quiff waving from a red-carpet podium (centre, dirupo reference, friendly and dignified), the bald smiling director in navy suit raising a pen (right, lurcke reference).

Typography (must be perfectly spelled, French accents included):
- Top: PRIVATIX in very heavy Arial Black style capitals, wide letter-spacing, white-pink neon tubes with magenta glow and hard ink shadow, matching the logo reference.
- Under the title, smaller, white: « Le rail n'est pas à vendre. »
- Bottom band on dark violet: "Développé par OCC MONS Studios" and below, smaller: "PC · Mac · Linux · Navigateur".
No other text, no other brands, no watermark. Palette: violet night #0A0818, hero orange #FF7A1A, magenta #FF3EA5, turquoise #19C3B1, cyan #6FF3FF.
```

### `banniere-16x9`

- **Modèle** : `gemini-nano-banana-2.1` · **Format** : 16:9, 2K
- **Résumé** : Bannière horizontale : quais de nuit, héros à gauche en plein coup de clé qui envoie valser deux consultants, foule de consultants, Passerelle au néon avec le Discosaure dessus, panneau SNCB qui se libère de son autocollant ; seul texte : PRIVATIX à droite ; marges de recadrage.
- **Références** :
  - `site/public/bestiaire/hero.webp`
  - `site/public/bestiaire/discosaure.webp`
  - `site/public/bestiaire/consultant.webp`
  - `site/public/artbook/planches/decor-passerelle-1200.webp`
  - `site/public/artbook/planches/decor-quais-1200.webp`
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `docs/references/sncb_logo.png`
  - `site/public/artbook/planches/da-palette-1200.webp`

```text
Wide 16:9 key art banner for the video game PRIVATIX, for a website header and store page. Stylized 3D toon figurine rendering exactly like the character references: chunky low-poly shapes, cel shading, bold ink outlines, coloured rim lights. Not photorealistic.

Scene: Mons railway station platforms at night, seen from a low wide angle along the rails. Left third: the railway worker hero from the first reference (orange hard hat, orange hi-vis vest, red scarf, navy trousers, moustache) mid-swing with his long T-handled railway track wrench, orange smear trail, sending two turquoise consultants (#19C3B1, consultant reference) flying with slides scattering like paper. Centre and right: a crowd of turquoise consultants advancing, and in the distance the white ribbed arches of the footbridge "le Calatrava" glowing with magenta and cyan neon, with the silhouette of the purple Discosaure and its mirror disco ball on top of the bridge. A blue-and-white SNCB sign on a pillar (SNCB logo reference, small) peeling off a violet sticker.

Text: only the word PRIVATIX (exactly P R I V A T I X), in heavy Arial Black style neon capitals with magenta glow as in the logo reference, placed in the right third with breathing room. No other text. Keep the left 10 % and right 10 % free of important details (safe crop margins). Palette: violet night #0A0818, hero orange #FF7A1A, magenta #FF3EA5, turquoise #19C3B1, cyan #6FF3FF. No other brands, no watermark.
```
