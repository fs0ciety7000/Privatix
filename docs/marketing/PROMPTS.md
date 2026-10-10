# Visuels marketing — prompts Nano Banana

Prompts envoyés à la génération d'images Gemini (Nano Banana) par `tools/marketing/nanobanana.mjs`. Ils sont rédigés en anglais pour le modèle ; chaque entrée a un résumé en français et la liste des images de référence passées dans la requête. Les sources exécutables sont `lot1/jobs.json` et `lot2/jobs.json` : ce document en est la copie lisible, à tenir synchronisée.

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

## Lot 2 (retours du porteur du projet)

Le texte des affiches et de la bannière n'est plus demandé au modèle : les key arts sont générés **sans texte** puis composés en HTML/CSS (`tools/marketing/compose/`, voir `lot2/README.md`). La gare de Mons est décrite d'après les photos de référence fournies par le porteur du projet (non versionnées, non transmises à l'API). La clé à tire-fond est passée en référence par un recadrage de la planche du héros (`lot2/refs/cle-tire-fond.webp`).

### `logo-a1-neon-recadre`

- **Modèle** : `gemini-3-pro-image` · **Format** : 1:1, 2K
- **Résumé** : Direction A recadrée : wordmark néon dominant (≈ 85 % de la largeur), emblème réduit au-dessus (clé à tire-fond posée sur un tronçon de rail et de ballast, petite étincelle), qui ne touche plus aucune lettre.
- **Références** :
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `docs/marketing/lot2/refs/cle-tire-fond.webp`
  - `docs/marketing/lot1/logo-a-neon-cle.jpg`

```text
Video game title logo for PRIVATIX (stylized 3D toon hack-and-slash roguelite, railway workers versus consultants in a Belgian station). This is a re-crop of the concept in the fourth reference image, with the balance reversed.

WORDMARK: the single word PRIVATIX (exactly eight letters P-R-I-V-A-T-I-X, nothing else), very heavy geometric sans-serif capitals in the style of Arial Black, wide letter-spacing (about 0.15 em), built as white-pink neon tube letters (#FFE3F3 core) with a hot magenta glow (#FF3EA5) and a hard dark ink drop shadow straight down, exactly matching the lettering of the first reference image. Crisp, perfectly spelled, evenly kerned, every letter fully intact and unbroken. The wordmark is now the dominant element: it spans about 85 % of the image width, centred slightly below the middle.

EMBLEM, much smaller (about one third of the wordmark width), sitting above the wordmark and NOT touching or cracking any letter: the orange-handled railway track wrench laid diagonally across a short section of rail on a few ballast stones, with a tiny yellow spark (#FFD200) where the socket meets the rail. THE TOOL is the hero's real railway track wrench (French: clé à tire-fond), shown in the third reference image: a long straight light-steel shaft; at one end a short RED cylindrical crossbar handle mounted perpendicular to the shaft, forming a T; at the other end a chunky blue-grey cylindrical socket with a flat disc tip. It is NOT an adjustable wrench, NOT a spanner, NOT a pickaxe, NOT a hammer. Here the shaft is painted hero orange (#FF7A1A) with the red T handle and the blue-grey socket.

Style: clean toon cel-shaded rendering like a painted figurine, bold dark ink outlines (#14101A), hard shading, cyan rim light accents (#6FF3FF), palette of the second reference. Square composition on a deep violet-night background (#0A0818 with a soft violet vignette, never pure black). Readable at small size. No other text, no tagline, no subtitle, no other logos, no watermark, no photorealism.
```

### `logo-a2-neon-souligne`

- **Modèle** : `gemini-3-pro-image` · **Format** : 1:1, 2K
- **Résumé** : Direction A, variante : la clé à tire-fond couchée sur un rail souligne le wordmark, groupe compact sous le mot.
- **Références** :
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `docs/marketing/lot2/refs/cle-tire-fond.webp`
  - `docs/marketing/lot1/logo-a-neon-cle.jpg`

```text
Video game title logo for PRIVATIX (stylized 3D toon roguelite, railway workers versus consultants). Variant of the concept in the fourth reference image with the wordmark as the hero element.

WORDMARK: the single word PRIVATIX (exactly eight letters P-R-I-V-A-T-I-X, nothing else), very heavy geometric sans-serif capitals in the style of Arial Black, wide letter-spacing (about 0.15 em), built as white-pink neon tube letters (#FFE3F3 core) with a hot magenta glow (#FF3EA5) and a hard dark ink drop shadow straight down, exactly matching the lettering of the first reference image. Crisp, perfectly spelled, evenly kerned, every letter fully intact and unbroken. The wordmark fills about 88 % of the image width, centred.

Under the wordmark, like a heavy underline slightly narrower than the word, the railway track wrench lies horizontally on a single short steel rail resting on a thin bed of ballast stones; a small yellow spark (#FFD200) at the socket end. THE TOOL is the hero's real railway track wrench (French: clé à tire-fond), shown in the third reference image: a long straight light-steel shaft; at one end a short RED cylindrical crossbar handle mounted perpendicular to the shaft, forming a T; at the other end a chunky blue-grey cylindrical socket with a flat disc tip. It is NOT an adjustable wrench, NOT a spanner, NOT a pickaxe, NOT a hammer. Small and compact: the whole underline group is less than one quarter of the wordmark height above it. Nothing overlaps or breaks the letters.

Style: clean toon cel-shaded rendering like a painted figurine, bold dark ink outlines (#14101A), hard shading, cyan rim light accents (#6FF3FF), palette of the second reference. Square composition on a deep violet-night background (#0A0818 with a soft violet vignette, never pure black). Readable at small size. No other text, no tagline, no subtitle, no other logos, no watermark, no photorealism.
```

### `logo-d1-medaille-cle`

- **Modèle** : `gemini-3-pro-image` · **Format** : 1:1, 2K
- **Résumé** : Direction D retravaillée : médaille syndicale (anneau orange) avec le casque à lampe au-dessus de deux vraies clés à tire-fond croisées et d'un éclair ; wordmark néon dessous ; aucun sous-titre.
- **Références** :
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `docs/marketing/lot2/refs/cle-tire-fond.webp`
  - `docs/marketing/lot1/logo-d-pro-embleme.jpg`

```text
Video game logo lock-up for PRIVATIX, rebuilding the layout of the fourth reference image (round medal above a neon wordmark) with the correct tool and without any subtitle.

TOP: a round railway workers' union medal: dark violet disc (#2A2148) with a thick hero-orange ring (#FF7A1A) and dark ink outline; inside, the orange worker's hard hat with its small round headlamp (as worn by the hero in the third reference) above TWO railway track wrenches crossed in an X, and a small yellow lightning bolt (#FFD200) at the crossing. THE TOOL is the hero's real railway track wrench (French: clé à tire-fond), shown in the third reference image: a long straight light-steel shaft; at one end a short RED cylindrical crossbar handle mounted perpendicular to the shaft, forming a T; at the other end a chunky blue-grey cylindrical socket with a flat disc tip. It is NOT an adjustable wrench, NOT a spanner, NOT a pickaxe, NOT a hammer. Draw both wrenches exactly like that: steel shaft, red T crossbar handle at the top ends, blue-grey sockets at the bottom ends.

BELOW: WORDMARK: the single word PRIVATIX (exactly eight letters P-R-I-V-A-T-I-X, nothing else), very heavy geometric sans-serif capitals in the style of Arial Black, wide letter-spacing (about 0.15 em), built as white-pink neon tube letters (#FFE3F3 core) with a hot magenta glow (#FF3EA5) and a hard dark ink drop shadow straight down, exactly matching the lettering of the first reference image. Crisp, perfectly spelled, evenly kerned, every letter fully intact and unbroken.

Nothing below the wordmark: no line, no tagline.

Style: clean toon cel-shaded rendering like a painted figurine, bold dark ink outlines (#14101A), hard shading, cyan rim light accents (#6FF3FF), palette of the second reference. Square composition on a deep violet-night background (#0A0818 with a soft violet vignette, never pure black). Readable at small size. No other text, no tagline, no subtitle, no other logos, no watermark, no photorealism.
```

### `logo-d2-medaille-rail`

- **Modèle** : `gemini-3-pro-image` · **Format** : 1:1, 2K
- **Résumé** : Direction D, variante : une seule clé plantée verticalement dans un tronçon de rail, étincelles, écharpe rouge nouée sous l'anneau ; wordmark néon dessous.
- **Références** :
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `docs/marketing/lot2/refs/cle-tire-fond.webp`
  - `docs/marketing/lot1/logo-d-pro-embleme.jpg`

```text
Video game logo lock-up for PRIVATIX: a union-medal emblem above a neon wordmark, in the spirit of the fourth reference image but redesigned, without any subtitle.

TOP: a round enamel medal with a thick hero-orange ring (#FF7A1A), dark ink outline and a small red scarf ribbon (#E0302A) knotted at the bottom of the ring. Inside, on a dark violet disc: a single railway track wrench standing vertically, red T handle at the top, socket planted on a short horizontal steel rail with two sleepers and a few ballast stones, two small yellow lightning sparks (#FFD200) on each side of the socket. THE TOOL is the hero's real railway track wrench (French: clé à tire-fond), shown in the third reference image: a long straight light-steel shaft; at one end a short RED cylindrical crossbar handle mounted perpendicular to the shaft, forming a T; at the other end a chunky blue-grey cylindrical socket with a flat disc tip. It is NOT an adjustable wrench, NOT a spanner, NOT a pickaxe, NOT a hammer.

BELOW: WORDMARK: the single word PRIVATIX (exactly eight letters P-R-I-V-A-T-I-X, nothing else), very heavy geometric sans-serif capitals in the style of Arial Black, wide letter-spacing (about 0.15 em), built as white-pink neon tube letters (#FFE3F3 core) with a hot magenta glow (#FF3EA5) and a hard dark ink drop shadow straight down, exactly matching the lettering of the first reference image. Crisp, perfectly spelled, evenly kerned, every letter fully intact and unbroken.

Nothing below the wordmark.

Style: clean toon cel-shaded rendering like a painted figurine, bold dark ink outlines (#14101A), hard shading, cyan rim light accents (#6FF3FF), palette of the second reference. Square composition on a deep violet-night background (#0A0818 with a soft violet vignette, never pure black). Readable at small size. No other text, no tagline, no subtitle, no other logos, no watermark, no photorealism.
```

### `logo-ad1-embleme-gauche`

- **Modèle** : `gemini-3-pro-image` · **Format** : 1:1, 2K
- **Résumé** : Mélange A + D : médaille compacte (clé sur rail) à gauche du wordmark néon ; la médaille seule sert d'icône.
- **Références** :
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `docs/marketing/lot2/refs/cle-tire-fond.webp`
  - `docs/marketing/lot1/logo-a-neon-cle.jpg`
  - `docs/marketing/lot1/logo-d-pro-embleme.jpg`

```text
Horizontal-feeling video game logo lock-up for PRIVATIX combining the two concepts of the fourth and fifth reference images, composed inside a square canvas.

LEFT: a compact round emblem medal (about the height of the wordmark letters times 1.4): hero-orange ring (#FF7A1A), ink outline, dark violet disc, containing the railway track wrench laid diagonally across a short rail section, a tiny yellow spark (#FFD200). THE TOOL is the hero's real railway track wrench (French: clé à tire-fond), shown in the third reference image: a long straight light-steel shaft; at one end a short RED cylindrical crossbar handle mounted perpendicular to the shaft, forming a T; at the other end a chunky blue-grey cylindrical socket with a flat disc tip. It is NOT an adjustable wrench, NOT a spanner, NOT a pickaxe, NOT a hammer. The medal must work on its own as an app icon.

RIGHT, vertically centred on the medal: WORDMARK: the single word PRIVATIX (exactly eight letters P-R-I-V-A-T-I-X, nothing else), very heavy geometric sans-serif capitals in the style of Arial Black, wide letter-spacing (about 0.15 em), built as white-pink neon tube letters (#FFE3F3 core) with a hot magenta glow (#FF3EA5) and a hard dark ink drop shadow straight down, exactly matching the lettering of the first reference image. Crisp, perfectly spelled, evenly kerned, every letter fully intact and unbroken.

The medal and the wordmark together span about 90 % of the width, centred in the square, with the medal clearly separate from the letters. Nothing else.

Style: clean toon cel-shaded rendering like a painted figurine, bold dark ink outlines (#14101A), hard shading, cyan rim light accents (#6FF3FF), palette of the second reference. Square composition on a deep violet-night background (#0A0818 with a soft violet vignette, never pure black). Readable at small size. No other text, no tagline, no subtitle, no other logos, no watermark, no photorealism.
```

### `logo-ad2-embleme-p`

- **Modèle** : `gemini-3-pro-image` · **Format** : 1:1, 2K
- **Résumé** : Mélange A + D : médaille avec un P néon traversé par la clé à tire-fond (icône), wordmark néon dessous.
- **Références** :
  - `site/public/artbook/presskit/privatix-logo-fond.png`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `docs/marketing/lot2/refs/cle-tire-fond.webp`
  - `docs/marketing/lot1/logo-a-neon-cle.jpg`
  - `docs/marketing/lot1/logo-d-pro-embleme.jpg`

```text
Video game logo lock-up for PRIVATIX combining the concepts of the fourth and fifth reference images: emblem + neon wordmark, designed so the emblem alone becomes the game icon.

CENTRE TOP: a compact shield-shaped or round badge, hero-orange rim (#FF7A1A), dark ink outline, dark violet field, containing a bold white-pink neon letter P (same neon style as the wordmark) with the railway track wrench crossing behind it diagonally and a small yellow lightning spark (#FFD200). THE TOOL is the hero's real railway track wrench (French: clé à tire-fond), shown in the third reference image: a long straight light-steel shaft; at one end a short RED cylindrical crossbar handle mounted perpendicular to the shaft, forming a T; at the other end a chunky blue-grey cylindrical socket with a flat disc tip. It is NOT an adjustable wrench, NOT a spanner, NOT a pickaxe, NOT a hammer. Simple, bold, readable at 48 px.

BELOW, large: WORDMARK: the single word PRIVATIX (exactly eight letters P-R-I-V-A-T-I-X, nothing else), very heavy geometric sans-serif capitals in the style of Arial Black, wide letter-spacing (about 0.15 em), built as white-pink neon tube letters (#FFE3F3 core) with a hot magenta glow (#FF3EA5) and a hard dark ink drop shadow straight down, exactly matching the lettering of the first reference image. Crisp, perfectly spelled, evenly kerned, every letter fully intact and unbroken. The wordmark spans about 85 % of the width.

Nothing below the wordmark.

Style: clean toon cel-shaded rendering like a painted figurine, bold dark ink outlines (#14101A), hard shading, cyan rim light accents (#6FF3FF), palette of the second reference. Square composition on a deep violet-night background (#0A0818 with a soft violet vignette, never pure black). Readable at small size. No other text, no tagline, no subtitle, no other logos, no watermark, no photorealism.
```

### `keyart-affiche-a`

- **Modèle** : `gemini-3-pro-image` · **Format** : 2:3, 2K
- **Résumé** : Key art d'affiche sans texte : vue aérienne au crépuscule de la gare de Mons (anneau, côtes en éventail, escalier central entre escalators, faisceau de voies, beffroi, terrils) ; héros au premier plan sur les rails, consultants variés qui dévalent l'escalier, boss sur la passerelle et le Discosaure sur l'anneau ; haut et bas laissés libres pour la typographie.
- **Références** :
  - `site/public/bestiaire/hero.webp`
  - `site/public/bestiaire/dirupo.webp`
  - `site/public/bestiaire/lurcke.webp`
  - `site/public/bestiaire/discosaure.webp`
  - `site/public/bestiaire/consultant.webp`
  - `site/public/bestiaire/manager.webp`
  - `site/public/bestiaire/auditeur.webp`
  - `docs/marketing/lot2/refs/cle-tire-fond.webp`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `docs/references/sncb_logo.png`

```text
Official key art for the video game PRIVATIX, portrait 2:3, made to receive typography added later. Render everything in the stylized 3D toon figurine style of the character reference images: chunky low-poly shapes, cel shading, bold dark ink outlines (#14101A), coloured rim lights. Never photorealistic, no real people.

LAYOUT (very important): keep the TOP 24 % of the image as calm open dusk sky with only soft clouds and neon glow (the title goes there later), and the BOTTOM 13 % as dark ballast and track in shadow (the credits band goes there later). All characters and the station sit between these two zones.

SCENE: high three-quarter aerial view at dusk over the Mons station and its track field, the city lights of Mons around. THE STATION is the real Mons railway station designed by Santiago Calatrava; translate it faithfully into the toon style. Seen from the forecourt: a gigantic white oval RING arch tilted overhead like a halo, from which dozens of slender white steel ribs radiate in a wide fan down to a central spine, carrying a domed glass canopy between them; under it, a monumental straight central staircase climbs to the footbridge, flanked by escalators. Seen from the air: a very long white footbridge (passerelle) with a glazed roof runs straight across a wide field of many parallel tracks and long platforms with warm yellow lights; along both sides the white ribs fan out like wings or the spine of a prehistoric animal; the ring arch marks the entrance at one end. Around: the brick city of Mons, the baroque belfry tower on its hill, the dark slag-heap hills (terrils) on the horizon, a pink-orange sunset band. Do not draw a generic arched train shed or a simple arch bridge: the silhouette must be recognisable as the Mons passerelle with its ring and fanned ribs. Magenta and cyan Privatix neon strips have been bolted along the white ribs, violet Privatix banners hang from the ring arch.

FOREGROUND (lower middle, large, heroic low angle): the railway worker hero from the first reference, identical design (orange hard hat with small headlamp, orange hi-vis vest with white stripes, red scarf, navy work trousers, brown moustache), standing on the rails at the foot of the passerelle, wrench raised over his shoulder, warm orange light. The hero's tool is his railway track wrench as in the reference crop: long light-steel shaft, short RED crossbar handle forming a T at one end, chunky blue-grey socket at the other end. Not a hammer, not a pickaxe.

MIDGROUND: CONSULTANTS: a crowd of small turquoise enemies (#19C3B1 suits) based on the consultant, manager and auditor references, VARIED, never cloned: men and women, different heights and builds, different hairstyles and skin tones, some with glasses, holding laptops, tablets with charts, clipboards, coffee cups, slide boards; different poses (running, pointing, typing, shouting into phones). They pour down the monumental central staircase and along the platforms toward the hero.

UPPER MIDDLE (just below the empty title zone): BOSSES: the purple Discosaure (dinosaur with a mirror disco ball on its back, discosaure reference); the friendly toon caricature in navy suit with big burgundy bow tie and brown quiff (dirupo reference, dignified, good-natured, never grotesque); the bald smiling director in navy suit with blue tie holding up a pen (lurcke reference, same good-natured treatment). The Discosaure is perched on top of the white ring arch, the two suited figures stand on the glazed roof of the passerelle under a magenta spotlight, all clearly smaller than the hero in scale but imposing.

ABSOLUTELY NO TEXT anywhere in the image: no title, no letters, no words, no numbers, no signage text, no watermark. Only allowed graphic mark: the small blue-and-white SNCB logo (last reference) on one platform pillar sign, without any lettering next to it. No other brands.

Palette: violet dusk-to-night sky (#0A0818 to deep violet, warm orange glow on the horizon), hero orange #FF7A1A, magenta neon #FF3EA5 on Privatix elements, turquoise enemies #19C3B1, cyan rim light #6FF3FF, yellow sparks #FFD200.
```

### `keyart-affiche-b`

- **Modèle** : `gemini-3-pro-image` · **Format** : 2:3, 2K
- **Résumé** : Key art d'affiche sans texte : sur le tablier de la passerelle, tapis rouge de l'inauguration, côtes blanches au néon, héros de dos prêt à frapper, consultants variés, Di Rupo et Lurcke au ruban, Discosaure derrière.
- **Références** :
  - `site/public/bestiaire/hero.webp`
  - `site/public/bestiaire/dirupo.webp`
  - `site/public/bestiaire/lurcke.webp`
  - `site/public/bestiaire/discosaure.webp`
  - `site/public/bestiaire/consultant.webp`
  - `site/public/bestiaire/manager.webp`
  - `site/public/bestiaire/auditeur.webp`
  - `docs/marketing/lot2/refs/cle-tire-fond.webp`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `docs/references/sncb_logo.png`

```text
Official key art for the video game PRIVATIX, portrait 2:3, made to receive typography added later. Render everything in the stylized 3D toon figurine style of the character reference images: chunky low-poly shapes, cel shading, bold dark ink outlines (#14101A), coloured rim lights. Never photorealistic, no real people.

LAYOUT (very important): the TOP 24 % stays calm sky (title goes there later) and the BOTTOM 13 % stays dark platform floor (credits band later).

SCENE: on the deck of the Mons station passerelle at dusk, looking along the footbridge: white steel ribs fanning overhead on both sides, the domed glazed roof above, the track field visible far below through the glass floor panels and side openings, city lights beyond. THE STATION is the real Mons railway station designed by Santiago Calatrava; translate it faithfully into the toon style. Seen from the forecourt: a gigantic white oval RING arch tilted overhead like a halo, from which dozens of slender white steel ribs radiate in a wide fan down to a central spine, carrying a domed glass canopy between them; under it, a monumental straight central staircase climbs to the footbridge, flanked by escalators. Seen from the air: a very long white footbridge (passerelle) with a glazed roof runs straight across a wide field of many parallel tracks and long platforms with warm yellow lights; along both sides the white ribs fan out like wings or the spine of a prehistoric animal; the ring arch marks the entrance at one end. Around: the brick city of Mons, the baroque belfry tower on its hill, the dark slag-heap hills (terrils) on the horizon, a pink-orange sunset band. Do not draw a generic arched train shed or a simple arch bridge: the silhouette must be recognisable as the Mons passerelle with its ring and fanned ribs. Privatix has taken over the bridge for an inauguration: a red carpet runs down the middle of the deck, magenta and cyan neon tubes are bolted on the ribs.

FOREGROUND (lower third, centre-left, back three-quarter view turning toward us): the railway worker hero from the first reference (orange hard hat with headlamp, orange hi-vis vest, red scarf, navy trousers, moustache), feet planted on the red carpet, wrench held across his body ready to swing, orange rim light. The hero's tool is his railway track wrench as in the reference crop: long light-steel shaft, short RED crossbar handle forming a T at one end, chunky blue-grey socket at the other end. Not a hammer, not a pickaxe.

MIDGROUND: CONSULTANTS: a crowd of small turquoise enemies (#19C3B1 suits) based on the consultant, manager and auditor references, VARIED, never cloned: men and women, different heights and builds, different hairstyles and skin tones, some with glasses, holding laptops, tablets with charts, clipboards, coffee cups, slide boards; different poses (running, pointing, typing, shouting into phones). They rush toward the hero along the red carpet.

BACKGROUND, at the far end of the deck, large and lit in magenta: BOSSES: the purple Discosaure (dinosaur with a mirror disco ball on its back, discosaure reference); the friendly toon caricature in navy suit with big burgundy bow tie and brown quiff (dirupo reference, dignified, good-natured, never grotesque); the bald smiling director in navy suit with blue tie holding up a pen (lurcke reference, same good-natured treatment). The two suited figures stand behind a red-carpet podium with a ribbon to cut; the Discosaure towers behind them, its disco ball throwing light spots across the white ribs.

ABSOLUTELY NO TEXT anywhere in the image: no title, no letters, no words, no numbers, no signage text, no watermark. Only allowed graphic mark: the small blue-and-white SNCB logo (last reference) on one platform pillar sign, without any lettering next to it. No other brands.

Palette: violet dusk-to-night sky (#0A0818 to deep violet, warm orange glow on the horizon), hero orange #FF7A1A, magenta neon #FF3EA5 on Privatix elements, turquoise enemies #19C3B1, cyan rim light #6FF3FF, yellow sparks #FFD200.
```

### `keyart-banniere`

- **Modèle** : `gemini-3-pro-image` · **Format** : 16:9, 2K
- **Résumé** : Key art de bannière sans texte : vue basse à travers les voies, sous les côtes en éventail et l'anneau ; héros à gauche en plein coup de clé, consultants variés, Discosaure grand format sur la passerelle à droite ; tiers droit supérieur dégagé pour le titre.
- **Références** :
  - `site/public/bestiaire/hero.webp`
  - `site/public/bestiaire/discosaure.webp`
  - `site/public/bestiaire/consultant.webp`
  - `site/public/bestiaire/manager.webp`
  - `site/public/bestiaire/auditeur.webp`
  - `docs/marketing/lot2/refs/cle-tire-fond.webp`
  - `site/public/artbook/planches/da-palette-1200.webp`
  - `docs/references/sncb_logo.png`

```text
Wide 16:9 key art for the video game PRIVATIX (website header, store page), made to receive typography added later. Render everything in the stylized 3D toon figurine style of the character reference images: chunky low-poly shapes, cel shading, bold dark ink outlines (#14101A), coloured rim lights. Never photorealistic, no real people.

LAYOUT (very important): the RIGHT 40 % of the upper half must stay calm (dusk sky and soft glow, nothing busy) for the title added later; the BOTTOM 11 % stays dark track and ballast for a credits line. Keep the outer 6 % on left and right free of important details (safe crop).

SCENE: low wide-angle view across the tracks of Mons station at dusk. THE STATION is the real Mons railway station designed by Santiago Calatrava; translate it faithfully into the toon style. Seen from the forecourt: a gigantic white oval RING arch tilted overhead like a halo, from which dozens of slender white steel ribs radiate in a wide fan down to a central spine, carrying a domed glass canopy between them; under it, a monumental straight central staircase climbs to the footbridge, flanked by escalators. Seen from the air: a very long white footbridge (passerelle) with a glazed roof runs straight across a wide field of many parallel tracks and long platforms with warm yellow lights; along both sides the white ribs fan out like wings or the spine of a prehistoric animal; the ring arch marks the entrance at one end. Around: the brick city of Mons, the baroque belfry tower on its hill, the dark slag-heap hills (terrils) on the horizon, a pink-orange sunset band. Do not draw a generic arched train shed or a simple arch bridge: the silhouette must be recognisable as the Mons passerelle with its ring and fanned ribs. The passerelle crosses the whole image in the middle distance, white ribs fanning, ring arch on the right, city lights behind; Privatix magenta and cyan neon bolted on its ribs.

LEFT THIRD: the railway worker hero from the first reference (orange hard hat with headlamp, orange hi-vis vest, red scarf, navy trousers, moustache) mid-swing with his wrench, orange smear trail, sending two turquoise consultants flying with papers scattering. The hero's tool is his railway track wrench as in the reference crop: long light-steel shaft, short RED crossbar handle forming a T at one end, chunky blue-grey socket at the other end. Not a hammer, not a pickaxe.

CENTRE: CONSULTANTS: a crowd of small turquoise enemies (#19C3B1 suits) based on the consultant, manager and auditor references, VARIED, never cloned: men and women, different heights and builds, different hairstyles and skin tones, some with glasses, holding laptops, tablets with charts, clipboards, coffee cups, slide boards; different poses (running, pointing, typing, shouting into phones). They advance across the tracks toward the hero.

CENTRE-RIGHT, BIG AND PRESENT: the purple Discosaure (discosaure reference: purple dinosaur with a mirror disco ball on its back, roaring), at least one third of the image height, climbing over the passerelle railing, its disco ball scattering coloured light spots on the white ribs and the crowd.

ABSOLUTELY NO TEXT anywhere in the image: no title, no letters, no words, no numbers, no signage text, no watermark. Only allowed graphic mark: the small blue-and-white SNCB logo (last reference) on one platform pillar sign, without any lettering next to it. No other brands.

Palette: violet dusk-to-night sky (#0A0818 to deep violet, warm orange glow on the horizon), hero orange #FF7A1A, magenta neon #FF3EA5 on Privatix elements, turquoise enemies #19C3B1, cyan rim light #6FF3FF, yellow sparks #FFD200.
```
