# Visuels officiels — lot 1 (exploratoire)

Premier lot de propositions générées avec **Nano Banana** (génération d'images Gemini) à partir de nos références (portraits du bestiaire, planches de l'artbook, logotype du site, logo SNCB). **À valider par le porteur du projet** avant toute déclinaison (press kit, formats réseaux, Steam).

- Prompts complets (anglais) et résumés : [`../PROMPTS.md`](../PROMPTS.md) ; source exécutable : [`jobs.json`](jobs.json) ; usage de l'API par image : [`log.json`](log.json).
- Régénération : `GEMINI_API_KEY=… node tools/marketing/nanobanana.mjs docs/marketing/lot1/jobs.json` (une image déjà présente est sautée ; `--force` pour régénérer, `--only id` pour une seule, `--dry-run` pour vérifier sans appeler l'API).
- **Format** : l'API ne livre que du **JPEG** (`image/png` refusé en sortie). Les fichiers `*.jpg` sont les originaux 2K tels que livrés ; `*-1600.webp` sont les aperçus. Une conversion PNG n'ajouterait aucune qualité ; elle se fera, si besoin, au moment des déclinaisons.
- Toutes les images portent le filigrane invisible **SynthID** de Google.

| Fichier | Modèle | Format | Références passées | Prompt (résumé) | Coût estimé |
|---|---|---|---|---|---|
| [`logo-a-neon-cle.jpg`](logo-a-neon-cle-1600.webp) | `gemini-nano-banana-2.1` | 1:1, 2048 px | logotype du site, palette DA, portrait du héros | Wordmark néon magenta ; clé à tire-fond orange posée sur un tronçon de rail et de ballast, qui fêle le T du néon | ≈ 0,05 $ |
| [`logo-b-plaque-ballast.jpg`](logo-b-plaque-ballast-1600.webp) | `gemini-nano-banana-2.1` | 1:1, 2048 px | idem | Plaque émaillée sur ballast, néon à moitié éteint, clé et éclair croisés, écharpe rouge | ≈ 0,05 $ |
| [`logo-c-pro-wordmark-rail.jpg`](logo-c-pro-wordmark-rail-1600.webp) | `gemini-3-pro-image` (Pro) | 1:1, 2048 px | idem | Le V devient deux rails, la clé souligne le mot | ≈ 0,13 $ |
| [`logo-d-pro-embleme.jpg`](logo-d-pro-embleme-1600.webp) | `gemini-3-pro-image` (Pro) | 1:1, 2048 px | idem | Médaille (casque, outils croisés, éclair) + wordmark + « HACK 'N' SLASH FERROVIAIRE » | ≈ 0,13 $ |
| [`affiche-a-key-art.jpg`](affiche-a-key-art-1600.webp) | `gemini-nano-banana-2.1` | 2:3 | héros, Di Rupo, Discosaure, Lurcke, consultant, planches Passerelle et Quais, logotype, logo SNCB, palette DA | Héros au premier plan, quais de Mons, panneau SNCB couvert d'autocollants, Passerelle au néon, trois boss, nuée de consultants ; titre, accroche, crédit, plateformes | ≈ 0,06 $ |
| [`affiche-b-pro-key-art.jpg`](affiche-b-pro-key-art-1600.webp) | `gemini-3-pro-image` (Pro) | 2:3 | idem sans la planche Quais | Même brief, héros clé levée, Di Rupo à l'estrade de l'inauguration | ≈ 0,14 $ |
| [`banniere-16x9.jpg`](banniere-16x9-1600.webp) | `gemini-nano-banana-2.1` | 16:9 | héros, Discosaure, consultant, planches Passerelle et Quais, logotype, logo SNCB, palette DA | Coup de clé qui envoie valser deux consultants, foule, Passerelle au néon, Discosaure ; seul texte : PRIVATIX | ≈ 0,06 $ |

**Total estimé : ≈ 0,62 $** (7 images, aucun refus du filtre ; un premier appel rejeté en HTTP 400 pour le format PNG, non facturé). Estimation faite d'après les jetons de `log.json` et les tarifs publics (≈ 0,05 $ par image 2K en Nano Banana 2.1, ≈ 0,134 $ en Pro, entrées ≈ 0,01 $ au total) ; le montant réel est sur la console de facturation Google.

## Avis de la direction artistique

| Visuel | Forces | Défauts | Verdict |
|---|---|---|---|
| Logo A | Le concept le plus fort : l'outil du cheminot qui casse le néon de Privatix. Wordmark fidèle au site, palette juste. | Emblème trop gros par rapport au mot ; clé à tire-fond simplifiée (tube) ; illisible en favicon. | **Base recommandée**, à recadrer (mot plus grand, emblème réduit). |
| Logo B | Esprit pin's syndical, ballast et écharpe rouge bien présents. | Chargé (deux éclairs), la clé ressemble à une pioche, la moitié éteinte du néon rend « PRIVA » plus lisible que le titre. | Écarté. |
| Logo C (Pro) | Idée typographique originale, néon très propre. | Le mot est coupé en « PRI / ATIX » : le titre ne se lit plus. | Écarté tel quel ; l'idée du rail dans le V peut revenir en détail. |
| Logo D (Pro) | Mise en page la plus propre, typographie impeccable, déclinable (médaille seule = icône). | Les outils croisés sont des clés à molette génériques, pas la clé à tire-fond ; le sous-titre est une proposition, non validée. | **À retravailler** avec la vraie clé dans la médaille. |
| Affiche A | Brief complet : textes exacts (accents compris), panneau « MONS » + logo SNCB sous autocollants Privatix, caricatures fidèles à nos modèles et dignes, nuée turquoise lisible. | Les boss sont en couleurs pleines et pas en silhouettes ; le haut est chargé ; pose du héros reprise telle quelle du portrait. | **Meilleure affiche**, base pour le lot 2. |
| Affiche B (Pro) | Hiérarchie plus claire, bande de crédits élégante, Di Rupo à l'estrade (cohérent avec le lore). | Clé déformée (double T) ; la verrière évoque une grande gare générique plus que la Passerelle de Mons ; bandeau plus terne. | Second choix, à corriger. |
| Bannière | Dynamique, titre bien placé dans le tiers droit, logo SNCB correct, marges de recadrage respectées. | Consultants clonés et pas tout à fait notre modèle ; pont en arc générique ; Discosaure minuscule. | Bonne base, à affiner (Passerelle plus fidèle, Discosaure plus présent). |

Aucun visuel n'est encore officiel : le choix et les corrections attendent la validation du porteur du projet.
