# Visuels officiels — lot 2 (retours du porteur du projet)

Second lot, qui répond aux retours sur le [lot 1](../lot1/README.md) : polices des affiches jugées « horribles », gare de Mons pas assez fidèle, bannière à refaire avec la vraie gare et un Discosaure plus présent, logos à reprendre selon les directions A, D et A + D. **À valider par le porteur du projet.**

- Prompts complets (anglais) et résumés : [`../PROMPTS.md`](../PROMPTS.md#lot-2-retours-du-porteur-du-projet) ; sources exécutables : [`jobs.json`](jobs.json) (images) et [`compose.json`](compose.json) (typographie) ; usage de l'API par image : [`log.json`](log.json).
- Génération : `GEMINI_API_KEY=… node tools/marketing/nanobanana.mjs docs/marketing/lot2/jobs.json` (mêmes options qu'au lot 1 ; un job peut désormais passer `"tools": [{"type": "google_search"}]` à l'API, non utilisé dans ce lot).
- Composition : `node tools/marketing/compose/render.mjs docs/marketing/lot2/compose.json` (Playwright + Chromium ; `--png` garde aussi un PNG sans perte).
- Les `*.jpg` sont les originaux (API : JPEG 2K tel que livré ; compositions : JPEG qualité 92) ; les `*-1600.webp` sont les aperçus. Les images générées portent le filigrane invisible **SynthID**.

## Nouvelle méthode pour les affiches : key art sans texte + typographie composée

Le générateur ne produit plus aucun texte d'affiche. Il livre un **key art sans texte** qui laisse libres le haut (≈ 24 %, titre) et le bas (≈ 13 %, crédits). La typographie est composée en HTML/CSS par `tools/marketing/compose/` et rendue par Chromium : vraies polices, crénage exact, accents justes, et des gabarits réutilisables pour toutes les déclinaisons (formats réseaux, Steam, press kit).

- **Titre** : **Archivo Black** (OFL). C'est la grotesque géométrique très grasse la plus proche, sous licence libre, de l'Arial Black du logotype du site (`docs/DESIGN_SYSTEM.md` § 2.4), qu'on ne peut pas embarquer. Elle reçoit la recette néon du site (`.neon` de `site/src/styles/site.css`, état tenu de `neonIgnite`) : tube blanc-rose `#FFE3F3`, halo magenta `#FF3EA5`, ombre dure encrée `#14101A`, approche 0,1 em.
- **Accroche et crédits** : **Barlow** / **Barlow Condensed** (OFL). C'est une famille grotesque inspirée de la signalétique routière et ferroviaire : très lisible en petit, en capitales espacées comme les libellés du design system (approche 0,18 à 0,22 em), et son registre « panneau de quai » colle au décor. Le condensé gagne de la place dans la bande de crédits sans écraser les lettres.
- **Bande de crédits** : logo **OCC MONS Studios** (`site/src/assets/img/occ-mons-studios.webp`) + « Développé par / OCC MONS Studios » ; plateformes en texte sobre « PC ◆ Mac ◆ Linux ◆ Navigateur », séparées par de petits losanges orange héros ; logo SNCB monochrome blanc et discret, **sans mention à côté** (aucun partenariat n'est suggéré). Les polices et leurs licences sont dans `tools/marketing/compose/fonts/`.
- **Deux compositions** sur le meilleur key art (A) :
  - **« Marquise »** : titre centré comme l'enseigne d'un hall de gare, accroche en capitales entre deux filets orange, crédits en trois colonnes.
  - **« Manif »** : accroche sur une pancarte syndicale jaune encrée (contour + ombre dure, le geste « figurine » du design system), crédits centrés sur deux niveaux.

## Gare de Mons

Les **photos de référence fournies par le porteur du projet** (2 vues de la gare de Calatrava) ne sont pas versionnées : ce sont des photos de tiers et le dépôt est public. Elles n'ont pas pu être transmises comme fichiers : les traits clés en ont été relevés puis décrits dans les prompts. Ces traits sont l'anneau blanc en surplomb de l'entrée, les côtes d'acier rayonnant en éventail, la verrière bombée, l'escalier monumental entre deux escalators, la passerelle qui enjambe le faisceau de voies, et autour la ville de briques, le beffroi et les terrils au crépuscule. Le résultat est nettement plus fidèle qu'au lot 1 (arche générique). S'il faut aller plus loin, il reste deux leviers : relancer avec l'ancrage Google Search ou passer les photos comme références d'un job local non versionné.

## Fichiers

| Fichier | Modèle | Format | Références passées | Prompt (résumé) | Coût estimé |
|---|---|---|---|---|---|
| [`logo-a1-neon-recadre.jpg`](logo-a1-neon-recadre-1600.webp) | `gemini-3-pro-image` | 1:1, 2048 px | logotype du site, palette DA, clé (recadrage artbook), logo A du lot 1 | Wordmark néon dominant, emblème clé + rail réduit au-dessus, sans toucher les lettres | ≈ 0,14 $ |
| [`logo-a2-neon-souligne.jpg`](logo-a2-neon-souligne-1600.webp) | idem | idem | idem | La clé couchée sur un rail souligne le wordmark | ≈ 0,14 $ |
| [`logo-d1-medaille-cle.jpg`](logo-d1-medaille-cle-1600.webp) | idem | idem | logotype, palette, clé, logo D du lot 1 | Médaille : casque à lampe + deux vraies clés croisées + éclair ; wordmark ; pas de sous-titre | ≈ 0,14 $ |
| [`logo-d2-medaille-rail.jpg`](logo-d2-medaille-rail-1600.webp) | idem | idem | idem | Médaille : une clé plantée dans le rail, étincelles, écharpe rouge ; wordmark | ≈ 0,14 $ |
| [`logo-ad1-embleme-gauche.jpg`](logo-ad1-embleme-gauche-1600.webp) | idem | idem | logotype, palette, clé, logos A et D du lot 1 | Médaille compacte à gauche + wordmark à droite | ≈ 0,14 $ |
| [`logo-ad2-embleme-p.jpg`](logo-ad2-embleme-p-1600.webp) | idem | idem | idem | Médaille « P » néon traversé par la clé (icône) + wordmark | ≈ 0,14 $ |
| [`keyart-affiche-a.jpg`](keyart-affiche-a-1600.webp) | `gemini-3-pro-image` | 2:3, 1696 × 2528 | héros, Di Rupo, Lurcke, Discosaure, consultant, manager, auditeur, clé, palette, logo SNCB | Vue aérienne de la gare au crépuscule, héros sur les rails, consultants variés dans l'escalier, boss sur la passerelle ; sans texte | ≈ 0,16 $ |
| [`keyart-affiche-b.jpg`](keyart-affiche-b-1600.webp) | idem | idem | idem | Sur le tablier de la passerelle, tapis rouge de l'inauguration, héros de dos ; sans texte | ≈ 0,16 $ |
| [`keyart-banniere.jpg`](keyart-banniere-1600.webp) | idem | 16:9, 2752 × 1536 | héros, Discosaure, consultant, manager, auditeur, clé, palette, logo SNCB | Sous les côtes et l'anneau, coup de clé à gauche, Discosaure grand format à droite ; sans texte | ≈ 0,16 $ |
| [`affiche-composee-marquise.jpg`](affiche-composee-marquise-1600.webp) | composition (Chromium) | 2:3, 2048 × 3072 | key art A, logo OCC MONS Studios, logo SNCB | Gabarit `affiche-marquee.html` | 0 $ |
| [`affiche-composee-manif.jpg`](affiche-composee-manif-1600.webp) | composition (Chromium) | 2:3, 2048 × 3072 | idem | Gabarit `affiche-manif.html` | 0 $ |
| [`banniere-composee.jpg`](banniere-composee-1600.webp) | composition (Chromium) | 16:9, 2560 × 1440 | key art bannière, logos | Gabarit `banniere.html` (recadrage de 7,5 % qui retire un cadre translucide parasite sur les bords du key art) | 0 $ |

**Total estimé : ≈ 1,40 $** (9 images Pro, aucun refus, aucune relance). Calcul : ≈ 0,134 $ par image 2K en Pro, plus les entrées (≈ 36 000 jetons, dont 8 à 12 images de référence par key art) et le texte interne du modèle, d'après `log.json` et les tarifs publics. Le montant réel est sur la console de facturation Google.

## Avis de la direction artistique

| Visuel | Forces | Défauts | Verdict |
|---|---|---|---|
| Logo A1 | Le retour est appliqué : le néon redevient la star, la clé est enfin la vraie (T rouge, douille bleue) et ne casse plus le T. | Composition trop haute, beaucoup de vide en bas ; l'emblème perd l'idée « le cheminot casse le néon ». | Bon logotype de titre, à recentrer au détourage. |
| Logo A2 | Clé juste, très lisible en bandeau. | Le modèle a pris une police condensée à contour : on sort de l'Arial Black du site. | Écarté (police hors charte). |
| Logo D1 | Le plus propre : deux vraies clés croisées, casque à lampe du héros, médaille nette, aucun sous-titre. | Les deux clés font un peu « symbole générique » ; le wordmark est assez petit. | **Recommandé pour la direction D.** |
| Logo D2 | Récit plus fort (la clé plantée dans le rail, l'écharpe syndicale). | Le T dépasse de l'anneau, médaille moins compacte en icône. | Alternative. |
| Logo A + D 1 | Verrouillage horizontal utile (en-tête, signature e-mail). | Dans un carré, le mot est petit et la médaille trop chargée (rail en perspective). | À recomposer en 3:1 si retenu. |
| Logo A + D 2 | **Le meilleur système** : la médaille « P » traversée par la clé est une icône lisible à 48 px (favicon, appli, Steam), le wordmark néon reste fidèle au site. | Le P néon double un peu le wordmark sur le lockup complet. | **Recommandé** : icône = médaille P, logotype = wordmark seul ou lockup. |
| Key art A | Gare enfin reconnaissable (anneau, éventails, escalier entre escalators, faisceau de voies, beffroi, terrils) ; consultants variés (femmes, hommes, coiffures, lunettes, accessoires) ; héros juste ; zones de texte respectées. | Boss trop petits sur la passerelle ; le modèle a ajouté deux bannières « PRIVATIX » et une plaque « SNCB » malgré la consigne (texte diégétique, acceptable). | **Retenu** pour les affiches. |
| Key art B | Belle scène d'inauguration, boss et Discosaure bien présents, beaucoup d'énergie. | La passerelle vue de l'intérieur ressemble à un tunnel vitré générique : moins « Mons ». | Bonne base pour un visuel d'événement ou de biome. |
| Affiche « Marquise » | Hiérarchie claire, titre néon fidèle au site, bas d'affiche enfin propre (logo studio, plateformes, SNCB discret). | L'accroche frôle le Discosaure. | **Recommandée** (affiche principale). |
| Affiche « Manif » | Plus militante, la pancarte jaune donne le ton syndical et réveille la palette. | Le jaune concurrence un peu le néon. | Variante pour réseaux et print engagé. |
| Bannière | Le Discosaure est grand et présent, consultants variés, l'anneau de Calatrava cadre le titre, crédits discrets. | Une partie du titre passe sur les côtes (lisible grâce au voile) ; la gare vue d'en bas est moins identifiable qu'en vue aérienne. | **Retenue**, à valider. |

Aucun visuel n'est encore officiel : le choix et les corrections attendent la validation du porteur du projet.
