# PRIVATIX — Game Design Document (Hack 'n' Slash / Roguelite)
> **Version** : 2.1 (passage en 3D temps réel, loot d'équipement, Elio Di Rupo boss obligatoire du biome 2 ; la v2.0 avait acté le pivot temps réel) · **Rôle** : Game Designer
> **Moteur** : **migration vers Three.js en cours** (rendu 3D temps réel, toon avec contours, interface en DOM ; simulation 2D pure à pas fixe de 60 Hz dans le plan du sol). Voir `ARCHITECTURE.md` et le prototype `prototypes/proto3d`. Le jeu **Phaser 4.2.1** (Arcade Physics, `fps: 60`, `fixedStep: true`) reste jouable **en sursis** jusqu'à la bascule. TypeScript 5.9 strict, Vite 7 et Vitest 4 ne changent pas.
> **Références croisées** : `LORE.md` (récit, noms), `ARCHITECTURE.md` (implémentation), `docs/proposals/revue-3d-loot/` (direction artistique 3D, loot d'équipement).
> **Règle de priorité** : pour tout **chiffre d'équilibrage** (dégâts, timings, Burnout, économie, scaling), **ce GDD fait foi**. L'annexe A est recopiée telle quelle dans `src/config/balance.ts`.
> **Unités** : distances en **px logiques mesurés dans le plan du sol**, avec **30 px = 1 m** en 3D (une tuile de 16 px ≈ 0,53 m ; le héros court à 150 px/s, soit 5 m/s). Durées en **ms** (et en frames à 60 fps : 1 f ≈ 16,7 ms), vitesses en **px/s**. Tous les chiffres en px restent valables tels quels : la 3D ne change que le rendu. Toutes les valeurs sont des **valeurs de départ pour le playtest**.
> **Mentions héritées** : les tailles de sprite (« Frame »), les icônes en pixels, la résolution **640×360** et le pixel art décrivent le **jeu Phaser en sursis**. Elles sont signalées *(hérité Phaser)* et ne s'appliquent plus au rendu 3D.

---

**Sommaire** : 1 Identité · 2 Boucle · 3 Génération · 4 Contrôles · 5 Combat · 6 Énergie & Burnout · 7 Stats · 8 Game feel · 9 Progression de run · 9 bis Loot & Équipement · 10 Méta · 11 Hub · 12 Accessibilité · 13 Périmètre · 14 Annexe A `BALANCE` · 15 Annexe B post-MVP.

## 1. Fiche d'identité
| Élément | Valeur |
|---|---|
| Titre | **Privatix** |
| Genre | Hack 'n' Slash **roguelite** en vue de dessus, temps réel |
| Pitch | Privatix Rail Solutions veut signer la cession de la ligne, de la gare et du café de la salle des pauses « à la fin du service ». Léon (ou Léa), agent·e en 3x8, prend sa **clé à tire-fond** et remonte la gare à contre-courant, des quais jusqu'au bureau où Gontran Vanderslide tient le stylo. Chaque tentative est un **Shift**. |
| Justification de la boucle | Le **Sondage éternel** : Privatix n'arrive jamais à trouver un créneau, la signature est sans cesse reprogrammée « à la fin de votre service ». Pas de magie, pas de boucle temporelle. |
| Ton | **Satirique dans les noms, sérieux dans les règles.** La satire vise le management, le conseil et la logique de privatisation ; jamais une personne réelle, un parti, une marque, les voyageurs ou les cheminots de terrain, **hors des trois exceptions autorisées** par le porteur du projet (SNCB, « Calatrava », caricature d'Elio Di Rupo : cadre au LORE §1.4). |
| Plateformes | **Web desktop** (Chrome, Firefox, Safari, Edge récents) et **mobile en paysage** (Android milieu de gamme, iOS Safari). Portrait : écran « Tournez votre téléphone ». |
| Rendu et caméra | **3D temps réel** à la résolution native (DPR plafonné à 1,5 sur mobile, résolution dynamique sous 55 fps). Caméra **perspective à FOV vertical de 30°**, inclinée de **52°**, sans lacet (les voies restent horizontales à l'écran), à **24 m** de la cible en combat (hub 20 m, boss 32 m, mobile ×0,9). Champ visible ≈ 23 × 16 m au sol. *(Hérité Phaser : résolution logique 640×360, mise à l'échelle entière, `pixelArt: true`, champ de 40×22,5 tuiles de 16 px.)* |
| Cible de performance | **60 fps** constants, 24 ennemis actifs + 64 projectiles + particules, sur Android milieu de gamme. |
| Durée | Shift complet **25 à 30 min** ; Shift raté **8 à 15 min** ; MVP (biome 1 + boss 1) **9 à 12 min**. |
| Public | 16 ans et plus. Joueurs de *roguelites* d'action (cœur), joueurs occasionnels belges et francophones attirés par la satire (périphérie, servis par le mode « Congé maladie »). Sessions courtes, souvent le soir ou dans le train. |
| Langue | Français (Belgique) d'abord. Textes externalisés pour la traduction (NL, EN en v2). |
| Direction artistique | **3D toon avec contours**, nom de travail « **Néon & Ballast** » : figurines low-poly à silhouettes franches, ombrage en 3 tons à décalage de teinte, contour sombre, liseré néon, gares sombres où la lumière forme des flaques. Références *Death's Door*, *Tunic*, *Ravenswatch*, avec la dramaturgie de **Hades** (voir § 1.3). L'équipement porté se voit sur le héros (§ 9 bis). |

### 1.1 Les 4 piliers
| # | Pilier | Ce que ça veut dire en jeu | Test de conception |
|---|---|---|---|
| 1 | **Chaque coup se sent** | Hitstop, screenshake, flashs, sons de métal sur rail, knockback qui plaque contre les quais. Le combo de la clé doit être bon **avec des rectangles** avant l'art. | Un testeur reconnaît les yeux fermés (au son) un coup 3 qui touche. |
| 2 | **Lire, esquiver, punir** | Tout ce qui blesse est **magenta** `#FF3EA5` et télégraphié (≥ 400 ms pour un ennemi de base, ≥ 800 ms pour un boss). Chaque attaque ennemie a une fenêtre de punition. | Aucune mort « injuste » : chaque coup reçu est attribuable à un télégraphe visible. |
| 3 | **Plus fort, plus fragile** | Le **Burnout** monte quand on encaisse, dashe et boit du café ; il augmente les dégâts **et** la fragilité. L'horloge du 3x8 l'empêche de redescendre sous un plancher. | Les joueurs débattent : « rester frais » ou « jouer au bord ». |
| 4 | **La solidarité comme progression** | Les collègues de l'OCC envoient des **Avantages acquis** par radio pendant le run et font avancer l'histoire entre les runs. Mourir n'est jamais une perte sèche. | Chaque retour à l'OCC apporte au moins une ressource gardée **et** une réplique nouvelle. |

### 1.2 Références
| Référence | Ce qu'on prend | Ce qu'on ne prend pas |
|---|---|---|
| **Hades** | **Direction artistique** : contrastes dramatiques (ombres profondes violettes, lumières saturées), encrage BD des formes, liseré coloré fort, silhouettes héroïques très lisibles, décors sombres ponctués de flaques de lumière et de rais de lumière, interface ornée. **Gameplay** : portes annonçant la récompense, bénédictions par familles (ici les collègues), hub vivant aux dialogues réactifs, Pacte (ici le Plan d'Économies), mode Dieu (ici « Congé maladie »). | La caméra isométrique à 45° (nos voies restent horizontales à l'écran), une armurerie pléthorique (6 types d'Outil au plus, § 9 bis). |
| **Hyper Light Drifter** | Lisibilité, dash nerveux, vides mortels, silences (biome 2). | La difficulté opaque, l'absence de texte, son rendu rétro plat. |
| **Dead Cells** | **Juice** (impacts lumineux, bloom, animation très fluide avec *smears*), cancel de recovery, hitstop généreux, élites à affixes, butin à raretés et à affixes, ressources de run convertibles en méta. | La plateforme ; le pixel art (abandonné avec le passage en 3D). |
| **Celeste** | **Direction artistique** : palette vive à décalage de teinte (ombres froides, lumières chaudes), squash & stretch, traînées au dash, particules d'ambiance, élément secondaire animé (ici l'**écharpe syndicale rouge** du héros), lisibilité parfaite. | La plateforme de précision. |
| *Death's Door*, *Tunic*, *Ravenswatch* | **Direction artistique 3D** : cel-shading lisible, contours, figurines à silhouettes franches, caméra plongeante. | Les puzzles d'exploration. |
| Enter the Gungeon | Densité de projectiles saturés et lisibles. | Le *bullet hell* : on reste un jeu de mêlée. |

### 1.3 Direction artistique : 3D toon temps réel (« Néon & Ballast »)
Le porteur du projet a tranché : le jeu passe en **3D temps réel** avec un **rendu toon à contours**, au lieu du pixel art. Le format 640×360 rendait les personnages minuscules (≈ 28 px de haut), les détails illisibles et l'équipement visible impossible (une feuille de sprites par pièce, par rareté et par direction). La 3D toon est produisible par du code, sert le pilier 2 (« Lire, esquiver, punir ») et montre le loot sur le héros. Détail complet : `docs/proposals/revue-3d-loot/art_director.md` ; démonstration jouable : `prototypes/proto3d`.

| Couche | Ce qu'on fait |
|---|---|
| **Personnages** | Figurines low-poly « héroïques » : héros de 2,0 m casque compris, tête et casque = 1/4 de la hauteur, mains et pieds ×1,3. Visages en décalques simples (pas de réalisme). Chaque archétype se reconnaît **en noir plein à 64 px** (planche de silhouettes = critère d'acceptation). Le héros : casque rond jaune, gilet évasé, **écharpe syndicale rouge** qui flotte, jamais masquée. |
| **Ombrage** | Rampe toon de **3 tons** à **décalage de teinte** (l'ombre tire vers la couleur d'ombre de la zone, jamais vers le noir), couleurs prises dans un **atlas de palette** (aucune texture peinte). **Rim light** néon par zone (cyan aux quais, ambre à l'OCC, rouge dans l'arène). |
| **Contours** | Acteurs et loot : coque inversée, épaisseur constante à l'écran (2 px en 1080p, 1,5 px sur mobile) ; `#14101A` pour le héros et les PNJ, turquoise très sombre `#06302C` pour les ennemis, **magenta** pendant leurs télégraphes. Décor : encrage cuit à la génération. |
| **Valeurs** | Règle des **3 étages** : décor 10 à 45 % de luminance, acteurs 45 à 85 % (jamais plus sombres que le sol éclairé derrière eux), émissifs au-dessus de 100 % (HDR, donc bloom). |
| **Lumière et post-process** | Lumière majoritairement cuite, **6 lumières dynamiques au plus** par salle sur mobile (lampe frontale du héros, impacts, lanterne de boss). **Un seul passage** fusionné : tone mapping AgX, bloom à seuil HDR, **LUT par zone et par roulement**, vignette (magenta quand le héros est touché), aberration chromatique en impulsion seulement. Pas de SSAO. |
| **Télégraphes** | **Décalques au sol non éclairés**, magenta HDR, au-dessus de tout : le contour apparaît en entier, puis se **remplit** pendant le windup (le joueur lit le *quand* en plus du *où*). Jamais assombris par la Nuit ni par la LUT. Chevron magenta au bord de l'écran pour une menace hors champ. |
| **Juice** | Traînées d'arme en ruban, impacts en étoile SDF et étincelles instanciées, hitstop qui gèle la simulation mais fait trembler le mesh touché, rémanences de dash (cyan, or sur dash parfait), dissolution turquoise des ennemis vaincus, secousses en translation avec un roulis de 0,6° au plus. |
| **Équipement** | Chaque pièce est un `.glb` attaché à un os du squelette ; la **rareté est une variante de matériau** du même mesh (§ 9 bis). |

**Apport de Hades, conservé** : ombres très profondes (violet nuit `#2A2148` aux quais, brun prune `#3A1E22` à l'OCC, jamais de noir pur), liseré coloré marqué, proportions héroïques, décors **sombres** où la lumière forme des **flaques** et des **rais**. **Couleurs canoniques conservées** : héros orange `#FF7A1A`, ennemis turquoise `#19C3B1`, danger magenta `#FF3EA5` (réservé), violet Privatix `#6B3FA0`, liseré cyan des quais `#6FF3FF`, écharpe `#E0302A`.

Ambiances : **Quais** bleu-gris froid et lampes à sodium en flaques, **arène du boss** alarme rouge pulsée, **OCC** salle de supervision bleu ardoise éclairée par le mur synoptique, avec des îlots chauds de tungstène sur les pupitres.

*(Hérité Phaser, en sursis : pipeline pixel art `tools/render3d/` → sprites, `tools/pixelart/`, normal maps `_n.png`, `src/fx/Atmosphere.ts`, et `docs/PIXEL_ART_GUIDE.md`. Ces outils ne servent plus à la production de l'art 3D.)*

### 1.4 Vocabulaire du jeu (canon)
**Shift** = un run · **Roulement** = Matin / Après-midi / Nuit · **Énergie** = la vie (100) · **Burnout** = jauge 0–100 puissance/fragilité, à 100 **Pétage de plombs** · **Mobilisation** = jauge 0–100 du Coup de sifflet · **Gobelet** = charge de soin (« boire un café ») · **Tickets** = monnaie du run · **Avantage acquis** = amélioration envoyée par radio par un collègue (7 familles) · **Motion commune** = Avantage en duo · **Réglage d'outil** (ex-« Réglage de clé ») = amélioration d'arme du run · **Équipement** = objet porté dans l'un des 6 emplacements (Outil, Casque, Gilet, Gants, Chaussures, Insigne), de rareté **Réforme**, **Réglementaire**, **Homologué**, **Hors-série** ou **Patrimoine** (§ 9 bis) · **Ferraille** = monnaie méta tirée du démontage d'équipement · **Paquetage** = pièces consignées au Vestiaire de la DPD et emportées au départ · **PS** (Points de Syndicalisme), **Grains** (de café), **Pièces** (détachées), **Tasses** = monnaies méta · **Preuve** = fragment du plan PHR-2032 (« en main » pendant le run, « archivée » à l'OCC).

## 2. Boucle roguelite
### 2.1 Schéma
```
 ┌──────────────────────────── OCC (hub) ─────────────────────────────┐
 │ Tableau des revendications (PS) · Vieille Dame (Grains)            │
 │ DPD : Vestiaire de Josiane (Paquetage, Ferraille, Dotations d'outil)│
 │ PACO : Béné (relances) · RTS : échanges · Tasses / Souvenirs · Plan│
 └──────┬─────────────────────────────────────────────────────────────┘
        │ choix : Tasse de Relève + Paquetage + Outil de départ + Souvenir
        ▼
  Cour intérieure ─► couloir technique                    ── horloge 06:00 (Matin)
        ▼
  BIOME 1 — Quais & Voies   : 8 salles ─► Salle des pauses ─► BOSS 1 L'Auditeur des Quais
        ▼  escalator                (élite majeur possible : Furet putride)
  BIOME 2 — La Passerelle   : 7 salles ─► Salle gardée : le Fluidifieur ─► Salle des pauses
                              ─► BOSS 2 L'Invité d'honneur (Elio Di Rupo, inauguration « Mons 2032 »)
        ▼  descente vers le hall + badge visiteur
  BIOME 3 — Hall & BAG      : 9 salles (dont Salle gardée : le Discosaure) ─► Palier du 3e
                              ─► BOSS FINAL Gontran Vanderslide
        │                                                         │
        │ Énergie à 0 (« Mise à pied »)                           │ Vanderslide vaincu (« Shift tenu »)
        ▼                                                         ▼
  Écran de résultats « Fin de service anticipée à 11 h 30 »   Résultats + scène + Sondage  
        │   GARDÉ : PS, Grains, Tasses, Pièces, Ferraille,        │ « signature reprogrammée »
        │           Preuves rapportées, Notes de service,         │
        │           1 objet consigné (2 en cas de victoire),      │
        │           Paquetage, Plans de Patrimoine                │
        │   PERDU : Tickets, Avantages, Motions, Réglages,        │
        │           Gobelets, Preuves non rapportées ;            │
        │           équipement non consigné → Ferraille           │
        └──────────────────────► retour à l'OCC (salle de repos, Fatou) ◄┘
```

### 2.2 Déroulé d'un Shift
| Étape | Lieu | Durée | Ce que fait le joueur |
|---|---|---|---|
| 1 | **OCC** | 1–3 min (libre) | Dépense PS / Grains / Pièces / Ferraille, parle aux collègues, offre des Tasses, choisit Tasse de Relève, Souvenir, **Paquetage** et type d'**Outil** de départ au Vestiaire (le dernier Paquetage est mémorisé). |
| 2 | **Tableau des roulements** (Yasmina) | 10 s | Voit le roulement imposé du Shift, active (ou non) des clauses du Plan d'Économies. Valide « Prendre son poste ». |
| 3 | **Couloir technique** | 10–15 s | Salle de transition sans ennemi : Rudy annonce la reprogrammation de la signature. Le côté ouvert de la Cour intérieure s'éloigne derrière le héros. |
| 4 | **Salles du biome** | 45–70 s (combat), 20–40 s (calme) | Nettoie la salle, ramasse la récompense annoncée et le **butin** tombé (équiper, mettre au sac ou démonter, § 9 bis), choisit une porte parmi 2 ou 3. |
| 5 | **Salle des pauses** | 20–40 s | Choix : « Pause réglementaire » (soin 40 % + −50 Burnout) **ou** « Formation continue » (monte la rareté d'un Avantage). |
| 6 | **Boss** | 2 / 2,5 / 4 min | Arène unique. Victoire : transition scénarisée vers le biome suivant. |
| 7 | **Résultats** | 15 s | Récapitulatif : PS, Grains, Pièces, kills, « Retard cumulé », cause de la mort sous forme de train supprimé. Puis écran **« Consigne »** (15 s au plus) : on choisit l'objet ramené au Vestiaire, le reste part en Ferraille. |

### 2.3 Les roulements (3x8)
Le roulement est **imposé en rotation** : Matin → Après-midi → Nuit → Matin… Avant le premier kill du Boss 1 (arrivée de Yasmina), tous les Shifts sont du **Matin**. Le roulement change la lumière, les ennemis et le gain de PS.

| Roulement | Horloge de départ | Lumière | Effets de jeu | Multiplicateur de PS |
|---|---|---|---|---|
| **Matin** | 06:00 | Néons froids, brouillard bas | Brouillard : visibilité des projectiles réduite au-delà de 200 px (alpha 70 %) dans le biome 1 ; **+1 Drone par vague** (r ≥ 2). | **×1,00** |
| **Après-midi** | 14:00 | Orangé à travers les arcs | **Foules de voyageurs** neutres (2 à 4 par salle, 6 PNJ maximum, obstacles mobiles à 40 px/s qu'il ne faut pas frapper : toucher un voyageur = −5 Tickets) ; PV ennemis **+10 %** ; Tickets **+20 %**. | **×1,15** |
| **Nuit** | 22:00 | Bleu profond, caténaires qui grésillent | Budget de menace **−15 %** mais **+1 élite garantie** par biome ; dégâts ennemis **+15 %**, vitesse ennemie **+10 %** ; **halo de lumière de 160 px** autour du héros (au-delà, ennemis visibles seulement par leurs télégraphes magenta) ; plancher de Burnout **×1,5** ; Wagon-Bar fantôme à 15 % (au lieu de 5 %). | **×1,35** |

### 2.4 Horloge du Shift
- L'horloge avance de **30 min à l'entrée de chaque salle comptée** (les 25 salles des biomes et les 3 arènes de boss : 28 salles comptées, soit **13 h 30** entre la salle 1 et le boss final). Les **Salles des pauses ne font pas avancer l'horloge** (« la pause n'est pas du temps de travail effectif »).
- Après 8 h de service, le HUD affiche **« HEURES SUP »** en rouge à côté de l'horloge (gag ; aucun effet mécanique supplémentaire).
- L'horloge sert de **plancher au Burnout** (§6.4) et à la satire de fin de Shift (« Fin de service anticipée à 11 h 30 »).

### 2.5 Mort et victoire
| | **Mort** (« Mise à pied ») | **Victoire** (« Shift tenu ») |
|---|---|---|
| Déclencheur | Énergie à 0 (après la Mutuelle si on l'a) | Vanderslide vaincu (MVP : L'Auditeur des Quais vaincu) |
| Séquence | Anim `death` 1 500 ms, ralenti ×0,4, fondu au noir, écran des départs : « Shift 37 — **SUPPRIMÉ** — cause : Consultant Junior » | Coup final, scène, Hubert Rentabilis « On reprogramme », Sondage |
| PS | **100 % gardés** (c'est un acquis) + « Prime d'ancienneté » **+2 PS par salle comptée atteinte** | 100 % + **« Fin de service » +50 PS** |
| Grains | 100 % gardés | **×2** sur les Grains du run |
| Pièces, Tasses, Notes de service | gardées | gardées |
| Preuves en main | **Gardées si on les a « rapportées »** : une Preuve ramassée est archivée au retour, vivant ou mort (consigne de Béné), **sauf** si on meurt dans la salle même où on l'a ramassée | archivées |
| Équipement | **1 objet consigné** au choix (équipé ou au sac) ; le Paquetage revient intact ; le reste part en **Ferraille** (100 %) | **2 objets consignés** ; idem |
| Perdus | Tickets, Avantages acquis, Motions communes, Réglages d'outil, Gobelets, Mobilisation, séquelles | idem (le run se termine) |
| Retour | Salle de repos de nuit de Fatou (pupitre RCCA) : « Arrêt de travail de 0 jour. Bienvenue. » | OCC, dialogues de victoire prioritaires |

## 3. Génération des Shifts (vue design)
### 3.1 Les biomes
| Biome | Salles générées | Fin de biome | Gabarits (tuiles 16 px ≈ 0,53 m) | Danger signature | Ennemis | Élite typique / ennemi majeur |
|---|---|---|---|---|---|---|
| **1 — Quais & Voies** | **8** | Salle des pauses + **Boss 1 L'Auditeur des Quais** | Quai simple 40×24, Double voie 52×30, Faisceau 52×30, Abri de quai 40×22, Passage sous voies 60×14 | **Rames** qui passent (tuent les non-élites, 40 % d'Énergie max au héros), rames à quai qui partent (murs mobiles), caténaire tombée, ballast (−15 % vitesse) | Consultant Junior, Borne Automatique, Drone Optimètre ; Agent de sécurité la Nuit (v1) | Manager KPI ; **Furet putride** (élite majeur, v1 : 40 % des salles Élite, 60 % la Nuit) |
| **2 — La Passerelle** (v1) | **8**, dont la **Salle gardée du Fluidifieur** en salle 8 | Salle des pauses + **Boss 2 L'Invité d'honneur** (Elio Di Rupo) au belvédère, inauguration « Mons 2032 » | Tablier 64×14, Nœud sous l'arc 40×32, Verrière 40×24, Escalators 40×22, Belvédère 52×30 | **Vent** (rafales de 2 s toutes les 6–8 s), **vides** (héros : −10 % Énergie et retour au bord ; non-élites : éliminés), dalles fissurées | Drones dominants, Consultants, Bornes sur îlots, premiers Certifiés | Coach Agile ; **le Fluidifieur** (élite majeur, Salle gardée garantie) |
| **3 — Hall & BAG** (v2) | **9** | Palier du 3e + **Boss final Gontran Vanderslide** | Hall historique 52×30, Open-space 52×30, Réunion 40×22, Accueil 40×24, Archives 40×24, Couloir d'étage 60×14 | **Cloisons mobiles** (toutes les 10 s), portiques à badge, photocopieuses-tourelles, écrans de visio (buff ennemi +25 %) | Tous, Agents de sécurité, Pense-bête | Manager KPI + Coach Agile ; **le Discosaure** (mini-boss, Salle gardée garantie, v2) |

Taille minimale d'une salle : **40×22 tuiles** (≈ 21 × 12 m ; *hérité Phaser : un écran de 640×352*). En 3D, le champ visible (≈ 23 × 16 m) fait légèrement défiler les grandes salles, comme dans Hades ; les portées des tireurs sont à relire en playtest. Taille maximale : **64×40** (hors arène finale). Caméra : `startFollow` lerp **0,12**, deadzone **32×24 px**, décalage vers la visée **24 px**.

### 3.2 Indice de salle `r`
Chaque salle **comptée** reçoit un indice `r` qui pilote le scaling, l'horloge et les gains :

| Biome | Salles | Indices `r` | Boss |
|---|---|---|---|
| 1 | 1 à 8 | r = 1 … 8 | r = 9 |
| 2 | 1 à 8 | r = 10 … 17 | r = 18 |
| 3 | 1 à 9 | r = 19 … 27 | r = 28 |

La Salle des pauses porte l'indice de la salle précédente et ne l'incrémente pas.

### 3.3 Types de salles
| Type | Signal sur la porte | Contenu | Récompense | Fréquence (par biome) |
|---|---|---|---|---|
| **Combat** | Portrait du collègue ou pictogramme de ressource | 2 ou 3 vagues (budget §3.6) | Celle annoncée par la porte | ~55 % (4 à 5 salles) |
| **Élite** | Cadre violet Privatix + cravate | 1 élite + escorte (budget ×1,6) | **16 PS** ou, au premier passage du biome, une **Preuve en main** ; butin d'élite (§ 9 bis) | **1 garantie** (position 5 à 7), **2 maximum** |
| **Salle gardée** (v1) | Cadre **doré** + pictogramme de l'ennemi majeur, `EXTRA 2000 → SALLE GARDÉE — RETARD +20` | Un ennemi majeur seul, petites vagues d'escorte (budget ×0,6) à ses seuils de PV | **20 PS**, **−15 Burnout**, butin de mini-boss (2 objets dont 1 Homologué au moins) ; Preuve n° 2 au 1er kill du Fluidifieur | Biome 2 : **le Fluidifieur**, salle 8, fixe · Biome 3 : **le Discosaure**, position 5 à 7, garantie |
| **Café / trésor** | Tasse fumante | Machine à café abandonnée (soin 25 % **ou** +1 Gobelet) **ou** consigne à bagages (3 Grains + 30 Tickets, 10 % de chances d'une Note de service) | Sans combat | 1 garantie, 2 maximum |
| **Boutique** | Cornet de frites | **Friterie de Raymonde** (§9.6). 5 % (Nuit 15 %) : **Wagon-Bar fantôme** (objets d'Acquis historique) | Achat en Tickets | **1 garantie** (position 3 à 6) |
| **Événement** | « ! » sur un panneau de travaux | Rencontre à choix (§3.9) | Variable | 1 garantie, 2 maximum |
| **Repos** | Banc + thermos | Salle des pauses (§2.2) | Au choix | **Fixe**, avant chaque boss |
| **Boss** | Écran rouge « SIGNATURE » (biome 2 : « INAUGURATION ») | Arène unique | PS, Pièces, Tasse, butin de boss ; Preuve n° 1 au 1er kill du Boss 1 | 1 |

### 3.4 Règles de génération
1. **Graphe en couches** (déterministe par graine, flux séparés `graph:`, `reward:`, `template:`) : couche 0 = salle 1, puis une couche par profondeur de largeur **1 à 3** (variation de ±1 au plus d'une couche à l'autre), puis Repos, puis Boss. Arêtes **sans croisement** : chaque salle a **2 ou 3 portes** (1 seule pour la dernière salle avant le Repos). Pas de retour en arrière.
2. **Salle 1** : toujours un Combat **facile** (budget −25 %, 2 vagues) qui donne un **Avantage acquis** (ancrer le build tôt).
3. **Boutique** : exactement 1, en position 3 à 6.
4. **Élite** : au moins 1 en position 5 à 7, au plus 2, **jamais 2 d'affilée** sur un même chemin. **Salles gardées** : dans le biome 2, la **couche 8 a une largeur de 1** et contient la Salle gardée du Fluidifieur (elle remplace l'élite garantie ; une Élite facultative reste possible en 5 à 6) ; dans le biome 3, la Salle gardée du Discosaure remplace l'élite garantie en position 5 à 7. Dans le biome 1, la salle Élite tire le Manager KPI (60 %) ou le Furet putride (40 %, 60 % la Nuit).
5. **Café / trésor** : au moins 1 accessible sur tout chemin.
6. **Événement** : au moins 1 accessible sur tout chemin.
7. **Jamais 3 Combats consécutifs à récompense de ressource** (Tickets, Grains, PS) sur un même chemin : la 3e est forcée en Avantage ou Réglage.
8. **Portes sœurs** : deux portes issues d'une même salle n'annoncent jamais la même récompense (sauf pool épuisé).
9. **Gabarits** : sac mélangé **sans remise** par type et par biome ; un gabarit ne revient pas dans le même Shift tant que le pool en contient d'autres.
10. **Validation** : tout nœud atteignable, une boutique, un boss en dernier ; en cas d'échec, on régénère avec `deriveSeed(seed, 'retry:n')` (8 essais maximum).
11. **Graine** affichée (`XX-XXX-XX`) dans la pause et les résultats, saisissable au menu (« Shift imposé »). Un Shift à graine saisie ne donne **pas** de Preuve inédite (anti-triche narrative), mais donne les PS normalement.

### 3.5 Portes annonçant la récompense
- Biome 1 : **portiques de quai** surmontés d'un **mini-écran des départs**. Format : `IC 0712 → AVANTAGE : JOSIANE — À L'HEURE` ; `L 4211 → ÉLITE — RETARD +5`. Feu **rouge** tant que la salle n'est pas nettoyée, puis feu **vert** et « ding-dong ».
- Biome 2 : écran au-dessus des **escalators** ; un escalator « en panne » peut cacher une porte secrète vers une salle Café.
- Biome 3 : lecteur de badge des **portes vitrées** (rouge, puis « bip vert »).
- L'icône (mini-écran en `CanvasTexture` ; *hérité Phaser : 16×16 lisible à 1×*) est toujours lisible : portrait du collègue (Avantage), clé (Réglage), gobelet, ticket, poing levé (PS), grain, cravate (Élite), cornet (Boutique), « ! » (Événement).
- Porte **« Dotation »** : `IC 0712 → DOTATION : GANTS — HOMOLOGUÉ` (emplacement et rareté minimale annoncés).
- Interaction : approcher (≤ 24 px) affiche le détail dans une info-bulle ; **E** / A / toucher la porte pour entrer.

### 3.6 Budget de menace et vagues
```
Budget(r)      = round((6 + 1.6 × r) × M_type × M_roulement × M_plan)
M_type         = 0.75 (salle 1) · 1.0 (Combat) · 1.6 (Élite, coût de l'élite inclus)
M_roulement    = 1.0 (Matin, Après-midi) · 0.85 (Nuit)
Vagues         = 2 si r ≤ 5, sinon 3
Répartition    = 2 vagues : 55 % / 45 % · 3 vagues : 40 % / 35 % / 25 %
Vague suivante = quand ≤ 2 ennemis vivants OU 70 % du budget de la vague tué
Plafond        = 24 ennemis vivants simultanément (l'excédent passe à la vague suivante)
Élite          = apparaît au début de la vague 2 (salle Élite)
```

| Archétype | Coût | Disponible à partir de | Part dans le biome 1 |
|---|---|---|---|
| Consultant Junior | **1** | r = 1 | 60 % |
| Drone Optimètre | **1,5** | r = 1 | 15 % (Matin : 25 %) |
| Borne Automatique | **2** | r = 2 | 25 % (au plus 3 par vague) |
| Manager KPI (élite) | **8** | r = 5 (salle Élite) | — |
| Agent de sécurité (v1) | 3 | r = 6 (Nuit) | — |
| Coach Agile (v1, élite) | 7 | r = 12 | — |
| Certifié (v1) | coût ×2,5 | r = 10 | — |

**Exemples (Matin, sans Plan)** :

| Salle | r | Budget | Vagues | Composition type |
|---|---|---|---|---|
| Salle 1 (facile) | 1 | round(7,6 × 0,75) = **6** | 2 | V1 : 2 Juniors + 1 Drone · V2 : 2 Juniors |
| Combat | 4 | **12** | 2 | V1 : 3 Juniors + 1 Borne + 1 Drone (6,5) · V2 : 3 Juniors + 1 Borne (5) |
| Élite | 6 | round(15,6 × 1,6) = **25** | 3 | V1 : 4 Juniors + 1 Borne + 1 Drone · V2 : Manager KPI + 2 Juniors · V3 : 3 Juniors + 1 Borne |
| Combat | 8 | **19** | 3 | 8 / 7 / 4 points |
| Combat (biome 3) | 27 | **49** | 3 | 20 / 17 / 12 points |

- **Apparitions diégétiques** télégraphiées **600 ms** (cercle au sol magenta qui se remplit) : les consultants descendent d'une rame ou d'un escalator, les drones tombent de la verrière, les bornes se déplient d'une trappe. Invulnérables pendant le télégraphe, inactifs **400 ms** après. Jamais à moins de **96 px** (6 tuiles) du héros ni de la porte d'entrée. Les apparitions d'une vague sont décalées de **150 ms** chacune.
- **Salle nettoyée** : slow-mo, carillon, portes au vert, récompense posée sur le socle, **−10 Burnout**. Les autocollants Privatix qui recouvrent la signalétique SNCB de la salle se décollent et tombent, et le logo SNCB réapparaît (motif « signalétique libérée », LORE §1.4).

### 3.7 Scaling (formules du canon)
```
PV(r)      = PV_base  × (1 + 0.08 × (r − 1)) × S_pv  × P_pv
Dégâts(r)  = Dmg_base × (1 + 0.05 × (r − 1)) × S_dmg × P_dmg
Vitesse(r) = Vit_base × (1 + 0.01 × (r − 1)) × S_vit          // plafond ×1,15 (hors Nuit)
S_*        = modificateurs de roulement (§2.3) ; P_* = clauses du Plan d'Économies (§10.6)
Boss       = PV et dégâts fixes par boss (pas de r), multipliés par S_* et P_*
```

| r | PV Junior | Dégâts Junior (coup) | PV Borne | PV Drone |
|---|---|---|---|---|
| 1 | 30 | 8 | 50 | 15 |
| 5 | 40 | 10 | 66 | 20 |
| 8 | 47 | 11 | 78 | 23 |
| 15 | 64 | 14 | 106 | 32 |
| 27 | 92 | 18 | 154 | 46 |

**Équilibre visé** : sans aucun Avantage, un Junior meurt en **3 coups** en salle 1 et en **5 à 8 coups** en salle 27. La courbe des Avantages et Réglages (≈ ×2,5 à ×3 de DPS en fin de Shift) doit maintenir un **time-to-kill de 2 à 3 coups** sur les ennemis de base.

### 3.8 Récompenses de porte (tirage)
| Récompense | Contenu | Poids (sans loot) | Poids (avec le loot, lot Loot 1) |
|---|---|---|---|
| **Avantage acquis** (portrait du collègue) | Choix parmi **3** Avantages d'une même famille | **40** | **34** |
| **Dotation** (pictogramme d'emplacement) | Choix de **1 objet parmi 2**, de 2 emplacements différents, rareté minimale annoncée (Réglementaire au moins) | — | **12** |
| **Tickets** | 40 à 60 (Après-midi +20 %) | **16** | **14** |
| **Réglage d'outil** | Choix parmi **2** Réglages | **14** | **12** |
| **Gobelet** | +1 Gobelet (ou soin 25 % si stock plein) | **12** | **12** |
| **PS** (« Tract ») | **8 PS** | **10** | **9** |
| **Grains** | **3 Grains** | **8** | **7** |

Le loot se paie en **moins de portes d'Avantage**, pas en Avantages plus faibles : la sensation des Avantages est conservée (budget de puissance au § 9 bis).

Règles : pas de Gobelet si le joueur a 4 Gobelets **et** plus de 80 % d'Énergie (re-tirage) ; la famille d'un Avantage annoncé est tirée parmi les 7, pondérée **×2** pour les familles déjà possédées (Hades-like : on creuse son build), **×0,5** après 3 portes consécutives de la même famille.

### 3.9 Événements (pool)
| Événement | Biomes | MVP | Choix | Effet |
|---|---|---|---|---|
| **Le banc de Marcel** | 1 | **oui** | S'asseoir 60 s (musique calme, caméra qui recule) | Soin 15 %, −20 Burnout, réplique inédite de Marcel au retour. |
| **Le voyageur égaré** | 1, 2 | **oui** | L'accompagner (escorte de 30 s sous 1 vague) / L'orienter vite | Escorte réussie : 1 Tasse (1re fois) sinon 10 Grains. Orientation : rien. |
| **Note de service n° X** | tous | **oui** | Signer l'accusé / La déchirer | Signer : +60 Tickets mais « Bureau propre » (pas de Gobelet pendant 3 salles). Déchirer : combat surprise (budget ×1,2), puis la Note est ajoutée à la collection. |
| **Grève du zèle** | 1, 3 | v1 | Accepter | Salle-défi chronométrée (60 s, aucun coup encaissé autorisé plus de 3 fois). Réussite : PS ×3 de la salle (9) + 1 Réglage. |
| **Le Fantôme du Wagon-Bar** | 1 (Nuit) | v1 | « Et pour monsieur-dame, ce sera ? » | Ouvre le Wagon-Bar ; avance la quête. |
| **Matricule 4412** (pigeon) | 2 | v1 | Partager son croissant (−15 Tickets) / Ignorer | 3e partage cumulé : une Note de service. |
| **Objets trouvés** | 1, 2, 3 | v1 | Choisir 1 colis parmi 3 (silhouette d'emplacement visible, rareté cachée) | 1 objet au moins Réglementaire. Gag : « Merci de signaler tout colis suspect. » |
| **Réunion surprise** | 2, 3 | v1 | Y assister (survivre 45 s dans une salle qui rétrécit) / Décliner | Survie : Avantage de rareté +1. Déclin : +1 vague à la salle suivante. |

## 4. Contrôles
### 4.1 Principes
- **Clavier/souris : les attaques (Frappe, dash-attaque, Coup de sifflet orienté) visent le curseur ; le dash suit la direction de déplacement** (ou la visée si aucune touche de déplacement n'est enfoncée). On esquive dans un sens, on frappe dans un autre.
- La direction d'une attaque est **verrouillée au début de son startup**. Aucune rotation pendant l'active et la recovery.
- Les touches sont lues par **position physique** (`KeyboardEvent.code`) : `KeyW/KeyA/KeyS/KeyD` donnent **ZQSD en AZERTY** et WASD en QWERTY sans réglage. Les libellés affichés viennent de `navigator.keyboard.getLayoutMap()` si l'API existe, sinon « ZQSD ». Les flèches marchent toujours.
- Le corps du héros prend la direction de visée **quantifiée en 4 secteurs** (`down`, `up`, `side` + `flipX`) ; le VFX de slash est orienté en 8 directions ; la hitbox utilise l'angle **continu**.
- Diagonales normalisées (pas de bonus de vitesse).

### 4.2 Clavier + souris
| Action | Touche principale | Alternative |
|---|---|---|
| Déplacement | ZQSD / WASD (physiques) | Flèches |
| **Frappe** (combo) | **Clic gauche** (maintien = combo automatique, même cadence) | J |
| **Dash « Retard SNCB »** | **Espace** | Shift gauche |
| **Coup de sifflet** (tap) / **Préavis de grève** (maintien 600 ms) | **Clic droit** | F |
| **Café** (boire un Gobelet) | **R** | — |
| Interagir (porte, PNJ, récompense) | **E** | — |
| Carte du Shift / détail du build | **Tab** (maintien) | — |
| Pause | **Échap** | P |

E, R, F, J, Espace, Tab et Échap sont à la même place en AZERTY et en QWERTY. Tout est **réassignable** (§12).

### 4.3 Manette (disposition Xbox ; PlayStation entre parenthèses)
| Action | Bouton |
|---|---|
| Déplacement | Stick gauche (zone morte **0,20**, courbe linéaire au-delà) |
| Visée | Stick droit si inclinaison > **0,35**, sinon direction du stick gauche, sinon dernière direction |
| Frappe | **X (□)** ou RB (R1) |
| Dash | **A (×)** ou LB (L1) |
| Coup de sifflet / Préavis | **Y (△)** (maintien = Préavis) ou RT (R2) |
| Café | **B (○)** |
| Interagir | **A (×)** à ≤ 24 px d'un interactible hors combat (sinon A = dash) |
| Carte / Pause | View / Menu |

**Aide à la visée** (manette et tactile seulement, réglable §12) : si un ennemi est dans un cône de **±20°** autour de la visée et à **≤ 120 px**, la visée se cale sur le plus proche. Aucune aide à la souris.

### 4.4 Tactile (paysage, minimal mais complet)
| Élément | Position | Taille (px logiques) | Comportement |
|---|---|---|---|
| Joystick virtuel flottant | Moitié gauche, apparaît sous le doigt | Rayon **48 px**, zone morte 15 % | Déplacement analogique |
| Bouton Frappe | Bas droite | **56 px** (le plus gros) | Tap = coup, maintien = combo auto |
| Bouton Dash | Au-dessus-gauche de Frappe | 44 px | Dash dans la direction du joystick |
| Bouton Sifflet | Au-dessus de Frappe | 44 px, anneau = jauge de Mobilisation | Tap / maintien 600 ms |
| Gobelet | Icône du HUD (haut gauche) | 32 px | Toucher = boire |
| Pause | Haut droite | 24 px | |

**Visée tactile** : auto-cible de l'ennemi le plus proche à **≤ 140 px** dans un cône de **±60°** autour de la direction du joystick ; sinon la direction du joystick ; sinon la dernière direction. Les boutons sont repositionnables et leur opacité réglable (30 à 100 %).

### 4.5 Buffer et priorités
| Règle | Valeur |
|---|---|
| Buffer d'input (Frappe, Dash, Sifflet) | **150 ms** ; un seul input gardé par action, le plus récent |
| Priorité si plusieurs inputs valides sur la même frame | **Dash > Sifflet > Frappe > Café** |
| Input pendant un hitstop | Bufferisé, servi à la première frame après le hitstop (le hitstop n'use pas la fenêtre de 150 ms) |
| Input pendant `hurt` | Le buffer est **vidé** à l'entrée de `hurt` (pas d'attaque fantôme) |
| Café | Non bufferisé (action volontaire) |
| Maintien du clic gauche | Équivaut à un appui toutes les frames : le combo s'enchaîne au chain point |

## 5. Combat
### 5.1 Actions du MVP
**Frappe** (combo de 3 coups, sans ressource) · **Dash « Retard SNCB »** (2 charges) · **Coup de sifflet / Préavis de grève** (Mobilisation 50 / 100) · **Café** (Gobelets, 2 au départ, 4 max). Post-MVP : Serrage lourd, Lanterne, Appel radio (Annexe B).

### 5.2 Frappe : combo de 3 coups à la clé à tire-fond
| Coup | Nom | Startup | Active | Recovery | Total | Hitbox | Dégâts | Knockback | Hitstop | Pas en avant |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Serrage** (balayage horizontal) | **90 ms** (5 f) | **60 ms** (4 f) | **160 ms** (10 f) | 310 ms | **Arc** rayon **38 px**, ouverture **100°**, centré sur la visée | **12** | 18 px en 100 ms | **50 ms** | 6 px |
| 2 | **Desserrage** (revers) | **80 ms** (5 f) | **60 ms** (4 f) | **170 ms** (10 f) | 310 ms | **Arc** rayon **40 px**, ouverture **120°** | **12** | 18 px en 100 ms | **50 ms** | 6 px |
| 3 | **Tire-fond** (frappe verticale au sol) | **200 ms** (12 f) | **80 ms** (5 f) | **320 ms** (19 f) | 600 ms | **Rectangle orienté 56×28 px** (de +8 à +64 px devant) **+ cercle d'impact** rayon 20 px à +56 px | **30** | 64 px en 160 ms + **stun 250 ms** | **110 ms** | 12 px |

> Le nom « Serrage » du coup 1 désigne le geste ; l'attaque chargée post-MVP s'appelle « Serrage » dans l'Annexe B et prendra le libellé « Serrage lourd » en jeu pour éviter l'ambiguïté.

**Règles du combo**
- Pendant startup et active, le héros avance à **25 %** de sa vitesse (plus le « pas en avant » fixe) ; immobile pendant la recovery.
- **Chain point** : l'input suivant part au plus tôt **80 ms après le début de la recovery**. La fenêtre reste ouverte jusqu'à **150 ms après la fin de la recovery**. Au-delà, le combo repart au coup 1.
- Combo complet enchaîné : (90+60+80) + (80+60+80) + 600 = **1 050 ms pour 54 dégâts ≈ 51 DPS** de base (hors hitstop et critiques).
- Une cible n'est touchée **qu'une fois par coup** (ensemble d'identifiants vidé à chaque swing).
- **Hitstop multi-cibles** : +10 ms par cible au-delà de la première, plafond **+30 ms**.
- **Critique « Prime de nuit »** : **5 %** de base, **×1,75**.
- **Plaqué contre le quai** : une cible repoussée qui heurte un mur à plus de **150 px/s** prend **+5 dégâts** et un **stun de 300 ms**.
- Le coup 3 **détruit les projectiles** ennemis qu'il touche (tickets, billes).
- Dégâts minimaux : **1** après toutes les réductions.

**Animations recalées sur ces timings** (*hérité Phaser* : durées par frame de sprite, frame active en gras, index base 0 ; en 3D, les actions d'armature reprennent les mêmes jalons en ms) :

| Anim | Frames | Durées (ms) | Total | Frame active |
|---|---|---|---|---|
| `player-attack1-{dir}` | 5 | 50, 40, **60**, 70, 90 | 310 | 2 |
| `player-attack2-{dir}` | 5 | 40, 40, **60**, 80, 90 | 310 | 2 |
| `player-attack3-{dir}` | 7 | 90, 70, 40, **80**, 100, 100, 120 | 600 | 3 (+ `vfx_slam`) |

**Hitboxes** (requêtes géométriques manuelles sur les frames actives, pas de body physique) :
- Origine : **centre du corps du héros, 10 px au-dessus des pieds**.
- **Arc** : cible touchée si `dist ≤ R + r_cible` **et** `|angle(cible) − angle_visée| ≤ ouverture/2 + atan(r_cible / dist)`.
- **Rectangle orienté** : centre de la cible dans le repère local du coup (x vers l'avant) ; touchée si `|x − cx| ≤ w/2 + r_cible` et `|y| ≤ h/2 + r_cible`.
- **Knockback** : impulsion à décélération linéaire, `v0 = 2d/t`, `décél = v0/t` (18 px en 100 ms : v0 = 360 px/s, décél = 3 600 px/s²). Multiplié par la **masse** de la cible (§7.2).

### 5.3 Annulations
| Depuis | Vers Dash | Vers Sifflet | Vers Frappe suivante |
|---|---|---|---|
| Startup coup 1 / 2 | **oui** | oui | non |
| Startup coup 3 | oui pendant les **120 premières ms**, ensuite non (engagé) | non | non |
| Active (tous coups) | **jamais** | jamais | non |
| Recovery (tous coups) | **oui, à tout moment** | oui | oui après le chain point (80 ms) |
| Dash | non | non | dash-attaque (§5.5) |
| Sifflet (startup) | non | — | non |
| Café (avant la gorgée, 400 ms) | oui (Gobelet conservé) | non | non |

Après un dash-cancel, le combo **reprend au coup suivant** (si on était au coup 2, on repart sur le 3). C'est la technique de base du joueur expert, voulue.

### 5.4 Dash « Retard SNCB »
| Paramètre | Valeur |
|---|---|
| Distance | **72 px** |
| Durée | **140 ms** (8 f) ≈ 514 px/s constant, ease-out sur les 3 dernières frames |
| I-frames | **0 à 120 ms** (les 20 dernières ms sont vulnérables) |
| Charges | **2** |
| Recharge | **750 ms par charge**, une à la fois, à partir de la fin du dernier dash |
| Délai minimal entre deux dashs | **200 ms** (début à début) |
| Collisions | Traverse **ennemis et projectiles** ; bloqué par les murs ; franchit les **trous et voies ≤ 64 px** |
| Contrôle | Direction verrouillée au départ ; aucune attaque pendant le dash, mais l'input est bufferisé |
| Burnout | **+2** par dash |
| Anim `player-dash-{dir}` | 5 frames : 30, 30, 30, 30, 20 ms = **140 ms** ; i-frames sur les frames 0–3 |

**Dash-attaque « Attaque de correspondance »**
- Frappe pressée pendant le dash ou **dans les 120 ms** qui suivent : estoc.
- **Rectangle orienté 64×20 px**, startup **60 ms**, active **80 ms**, recovery **200 ms**, **18 dégâts**, knockback **30 px**, hitstop 60 ms.
- Le combo reprend ensuite au **coup 2**.

**Dash parfait « Retard indépendant de notre volonté »**
- Condition : une hitbox ennemie (coup ou projectile) chevauche la hurtbox du héros pendant les **80 premières ms** du dash.
- Effets : `timeScale` **0,6 pendant 200 ms**, **+0,5 charge** de dash rendue, **−6 Burnout**, **+5 Mobilisation**. Un seul dash parfait par dash.

**Le gag (feedback)**
- À chaque dash, un **afficheur LED jaune de quai** (texte DOM ; *hérité Phaser : police pixel 8 px*) monte du point de départ : **« +5 min »** (12 px en 600 ms, fondu sur les 200 dernières ms).
- Dash parfait : LED **rouge** clignotante **« +15 min »** et carillon de gare.
- Le cumul alimente la statistique de fin de Shift **« Retard cumulé : 3 h 12 min »** (aucun effet mécanique), suivie de *« Nous vous prions de nous excuser pour la gêne occasionnée. »*

### 5.5 Coup de sifflet / Préavis de grève
**Jauge Mobilisation (0–100)** — conservée d'une salle à l'autre, **sans décroissance**, remise à 0 en début de Shift (sauf méta §10.2).

| Source | Gain |
|---|---|
| Dégâts infligés | **+1 par tranche de 4 dégâts** (cumul fractionnaire conservé) |
| Kill | **+6** (élite : +20) |
| Coup encaissé | **+10** (la colère syndicale) |
| Dash parfait | **+5** |

**Tap : Coup de sifflet (coût 50)**

| Paramètre | Valeur |
|---|---|
| Startup | **150 ms** (sifflet à la bouche, **i-frames**) |
| Active | **100 ms** |
| Recovery | **250 ms** |
| Zone | **Cercle de rayon 72 px** centré sur le héros |
| Dégâts | **25** |
| Effet | Stun **« En grève » 1,2 s** (l'ennemi s'assoit et brandit une pancarte) + knockback 40 px vers l'extérieur |
| Projectiles | **Détruits** dans la zone |
| Cooldown interne | **4 s** (partagé avec le Préavis) |
| Élites | Stun réduit à **0,4 s** ; boss : pas de stun, dégâts seulement |

**Maintien 600 ms : Préavis de grève (coût 100, jauge pleine)**
- Le maintien de 600 ms **est** le préavis : héros **ralenti à 50 %**, **non invulnérable**, cercle de télégraphe orange qui se remplit au sol.
- Relâché avant 600 ms : Coup de sifflet normal (si la jauge ≥ 50).
- Effet : **rayon 120 px**, **60 dégâts**, **stun 2,5 s** (élites 0,8 s), knockback 64 px, **marquage « Piquet » 4 s** (+15 % de dégâts subis).
- Active **120 ms** (i-frames pendant l'active), recovery **400 ms**, cooldown 4 s.

**Animation** : `player-special-down` (12 frames) sert aux deux :
- **Sifflet** : lecture à partir de la frame 2 ; frames 2–3 = 150 ms (startup), frame 4 = 100 ms (active), frames 5–7 = 250 ms (recovery), frames 8–11 sautées.
- **Préavis** : frames 0–3 en boucle pendant le maintien (600 ms, `vfx_charge`), frame 4 = 120 ms (active, `vfx_shockwave` mis à l'échelle ×2,1), frames 5–11 = 400 ms.
- `vfx_shockwave` (rayon utile 56 px) est agrandi **×1,3** pour le sifflet.

### 5.6 Café (boire un Gobelet)
| Paramètre | Valeur |
|---|---|
| Stock | **2 Gobelets au départ, 4 maximum** |
| Durée | **600 ms** ; la « gorgée » (application de l'effet) a lieu à **400 ms** |
| Mobilité | Déplacement à **50 %** pendant l'animation |
| Interruption | Dash possible : avant 400 ms le Gobelet est **conservé** ; après, il est consommé et l'effet appliqué |
| Soin | **30 % de l'Énergie max**, modulé par le palier de Burnout (100 / 100 / 75 / 50 %) |
| Burnout | **+20** (après le soin) |
| Caféine | **+15 % de vitesse d'attaque pendant 6 s** (toutes les durées de la Frappe ×0,87) ; ne se cumule pas, la durée est rafraîchie |
| Interdit | Pendant le **Pétage de plombs**, en l'air (dash), pendant un stun |
| Anim | MVP : `idle` + VFX de vapeur + icône Gobelet au-dessus de la tête ; v1 : `player-drink-down` (8 frames) |

Le café soigne mais rapproche du Burnout : c'est la tension centrale du jeu.

### 5.7 Règles défensives du héros
| Règle | Valeur |
|---|---|
| Invulnérabilité après un coup reçu | **600 ms** (clignotement toutes les 60 ms) |
| Knockback subi | **24 px** en 120 ms |
| Anim `hurt` | 240 ms (60, 80, 100), non annulable sauf par dash après 120 ms |
| Contact avec un ennemi | **Aucun dégât de contact** : seules les attaques font mal (lisibilité) ; ennemis et héros se chevauchent en `overlap`, pas en `collide` |
| Rame (biome 1) | **40 % de l'Énergie max**, ignore les réductions de dégâts (esquivable par les i-frames du dash), knockback ×3 |
| Chute dans un vide (biome 2) | **−10 % de l'Énergie max**, retour au dernier bord sûr en 500 ms |
| 0 Énergie | Fin du Shift, sauf **Mutuelle** (§10.2) |

## 6. Énergie & Burnout (mécanique signature)
Deux barres liées, sous le portrait du héros :
- **Énergie** : la vie. **100** de base (méta : jusqu'à 130).
- **Burnout** : 0 à 100. **Plus il est haut, plus on frappe fort, plus on est fragile.** À 100 : Pétage de plombs.

### 6.1 Ce qui fait monter le Burnout
| Source | Gain |
|---|---|
| Dégâts encaissés | **+0,6 × dégâts subis** (un coup de 8 donne +5, arrondi au plus proche) |
| Dash | **+2** par dash |
| Gobelet bu | **+20** |
| Fatigue de fond | le **plancher** (§6.4) remonte avec l'horloge |

### 6.2 Ce qui le fait descendre
| Source | Effet |
|---|---|
| Récupération passive | **−3/s** après **3 s** sans encaisser de coup ni dasher |
| Kill (« défoulement ») | **−1** (élite −10) |
| Dash parfait | **−6** |
| Salle nettoyée | **−10** |
| Salle des pauses, « Pause réglementaire » | **−50** |
| Événement « Le banc de Marcel » | −20 |

Le Burnout ne descend **jamais sous le plancher**.

### 6.3 Paliers
| Burnout | État (HUD) | Dégâts infligés | Vitesse (déplacement et attaque) | Critique | Dégâts subis | Soin du Gobelet | Signe visuel |
|---|---|---|---|---|---|---|---|
| 0–29 | **Frais** | +0 % | +0 % | +0 pt | +0 % | 100 % | barre verte |
| 30–59 | **Sous pression** | **+10 %** | +5 % | +0 pt | +0 % | 100 % | barre jaune |
| 60–89 | **Au bord** | **+25 %** | +10 % | **+10 pts** | **+15 %** | 75 % | barre orange, vapeur légère du casque |
| 90–99 | **Au bout du rouleau** | **+35 %** | +10 % | **+15 pts** | **+25 %** | 50 % | barre rouge pulsante, battement de cœur |
| **100** | **Pétage de plombs** | voir §6.5 | | | | | |

Les paliers s'appliquent **immédiatement** (pas d'hystérésis) ; le HUD annonce chaque changement de palier par un court texte (« SOUS PRESSION ») au-dessus du héros pendant 600 ms.

### 6.4 Plancher « Fatigue de fond » (le 3x8)
```
heures(r)   = 0.5 × (r − 1)                      // horloge : +30 min par salle comptée
Plancher(r) = 3 × heures(r) × K_roulement        // K = 1 (Matin, Après-midi), 1.5 (Nuit)
```

| Moment | r | Heures écoulées | Plancher Matin / Après-midi | Plancher Nuit |
|---|---|---|---|---|
| Salle 1 | 1 | 0 h | 0 | 0 |
| Boss 1 | 9 | 4 h | **12** | 18 |
| Fin d'un 3x8 (8 h) | 17 | 8 h | 24 | 36 |
| Boss 2 | 18 | 8 h 30 | **25,5** | 38,3 |
| Boss final | 28 | 13 h 30 | **40,5** | **60,8** |

> Adaptation au canon : le GDD combat initial utilisait 5 Burnout par heure sur un Shift de 16 salles. Le canon fixe 28 salles comptées à 30 min ; le coefficient passe à **3 par heure** pour conserver les cibles de fin de Shift (≈ 40 de jour, ≈ 60 de nuit).

Conséquence : plus le service avance, plus on vit « Sous pression » par défaut, et plus le Pétage de plombs est proche. On gagne en puissance, on perd en marge.

### 6.5 Pétage de plombs
| Élément | Valeur |
|---|---|
| Déclenchement | **Automatique** quand le Burnout atteint 100 |
| Durée | **8 s** ; la jauge se vide visuellement de 100 à 0 |
| Bonus | **+50 % de dégâts**, **+25 % de vitesse d'attaque** (toutes les durées de Frappe ×0,8), **recharge du dash ×2** (375 ms), les **coups 1 et 2 étourdissent 150 ms** |
| Contreparties | **+50 % de dégâts subis**, **Gobelet impossible**, critiques bloqués au taux de base (les paliers ne s'appliquent plus) |
| Fin : « Arrêt maladie » | Burnout fixé à **max(plancher, 30)** |
| Séquelle | **−8 Énergie max** jusqu'à la fin du Shift (cumulable ; l'Énergie max ne descend jamais sous **50** ; l'Énergie courante est plafonnée au nouveau max) |
| Pendant un boss | Identique (aucune exception) |
| Feedback | Teinte rouge plein écran à 15 %, musique +10 % de tempo, vapeur du casque, cri « J'EN AI MARRE ! » (texte) |

### 6.6 Diagramme d'états
```
                  dégâts reçus, dash, Gobelet
     ┌────────┐  ─────────────────────────►  ┌───────────────┐  ──►  ┌──────────┐  ──►  ┌─────────────────────┐
     │ FRAIS  │                              │ SOUS PRESSION │       │ AU BORD  │       │ AU BOUT DU ROULEAU  │
     │ 0–29   │  ◄─────────────────────────  │ 30–59         │  ◄──  │ 60–89    │  ◄──  │ 90–99               │
     └────────┘   repos −3/s, kills, salle   └───────────────┘       └──────────┘       └──────────┬──────────┘
         ▲            (jamais sous le plancher)                                                    │ = 100
         │                                                                                         ▼
         │                                                                        ┌──────────────────────────────┐
         │                                                                        │ PÉTAGE DE PLOMBS (8 s)       │
         └──────── Burnout = max(plancher, 30) + séquelle −8 Énergie max ◄──────── │ +50 % dégâts / +50 % subis   │
                         (« Arrêt maladie »)                                      └──────────────────────────────┘
```

### 6.7 Interactions avec le café (exemples chiffrés)
| Situation | Énergie | Burnout avant | Gobelet | Résultat |
|---|---|---|---|---|
| Début de Shift, 40/100 Énergie | 40 | 10 | soin 30 % × 100 % = **+30** | 70 Énergie, Burnout **30** (passe « Sous pression ») + Caféine |
| Boss 1, 35/100, Burnout 65 | 35 | 65 | soin 30 % × **75 %** = **+22,5** | 57,5 Énergie, Burnout **85** (au bord du Pétage) |
| Burnout 85, on boit | — | 85 | — | Burnout **100** → **Pétage de plombs immédiat** (le soin est appliqué avant) |
| Pétage en cours | — | — | refusé | Icône Gobelet barrée, son « badge refusé » |

**Règle d'or de lisibilité** : la barre de Burnout affiche en **fantôme** l'effet du prochain Gobelet (+20) dès qu'on survole l'icône ou qu'on maintient R pendant 200 ms.

## 7. Stats
> **Rendu 3D** : les lignes « Frame » (taille de sprite) et les durées par frame d'animation sont *héritées du jeu Phaser*. En 3D, seules les **hurtbox** (cercles au sol, en px du plan du sol) et les **timings en ms** font foi ; les animations sont des actions d'armature calées sur ces timings.
>
> **Ennemis majeurs placés** (un par biome, plus un boss) :
>
> | Biome | Ennemi majeur (élite ou mini-boss) | Boss |
> |---|---|---|
> | 1 — Quais & Voies | **Furet putride** (élite majeur, salle Élite ; antre au coin poubelles de la Cour intérieure du BAG) | **L'Auditeur des Quais** (§ 7.7) |
> | 2 — La Passerelle | **Le Fluidifieur** (élite majeur, ancien Boss 2, Salle gardée fixe en salle 8 ; § 7.10) | **L'Invité d'honneur, Elio Di Rupo** (§ 7.8), **obligatoire** |
> | 3 — Hall & BAG | **Le Discosaure** (mini-boss, Salle gardée garantie, 2e étage du BAG ; § 7.10) | **Gontran Vanderslide** (§ 7.9) |

### 7.1 Le héros (base, sans méta)
| Stat | Valeur |
|---|---|
| Énergie max | **100** |
| Vitesse | **150 px/s** (accélération 1 800 px/s², décélération 2 400 px/s²) |
| Frame / silhouette | 48×48 / ≈ 18×28 px, pivot aux pieds (origine `(0.5, 0.9167)`) |
| Corps de collision (décor) | rectangle **12×8 px** aux pieds |
| Hurtbox (dégâts) | cercle de **8 px** de rayon, centré **12 px** au-dessus des pieds |
| Dégâts | Frappe 12 / 12 / 30, dash-attaque 18, Sifflet 25, Préavis 60 |
| Critique | 5 %, ×1,75 |
| Dash | 2 charges, 72 px, recharge 750 ms |
| Mobilisation | 0 au départ, max 100 |
| Gobelets | 2 (max 4) |
| Invulnérabilité après coup | 600 ms |
| Ralentissement ballast | −15 % |

### 7.2 Règles communes aux ennemis
- **Grammaire d'IA** : `spawn → idle → chase/position → windup (télégraphe) → attack → recover (fenêtre de punition) → …`, plus `stagger` (si la poise est épuisée) et `dead`.
- **Télégraphes** : contour puis remplissage **magenta** `#FF3EA5` pour toute zone qui blesse ; corps ennemis en **turquoise** `#19C3B1` ; durées minimales : base **400 ms**, élite **700 ms**, boss **800 ms**.
- **Jetons d'attaque** : au plus **2 ennemis de mêlée** et **2 tireurs** en `windup`/`attack` simultanément (les élites et boss ont leur propre jeton).
- **Séparation** : force douce de **200 px/s²** entre ennemis (pas de collider dur entre eux) ; collider dur contre les murs.
- **Poise** : chaque coup reçu retire sa valeur de dégâts à la poise ; à 0, `stagger` 220 ms et la poise se recharge en 2 s.
- **Masse** : multiplie le knockback reçu (×1 standard).
- **Mort** : `vfx_poof` (slides turquoise), drop de **2 à 4 Tickets** (Junior 2, Drone 2, Borne 4 ; élite 15), 3 % de chances d'un Grain.
- **Ennemi projeté sur une voie active / dans un vide** : mort instantanée (non-élites).

### 7.3 Consultant Junior (mêlée rapide)
| Stat | Valeur (r = 1, Matin) |
|---|---|
| Frame / hurtbox | 32×32 / cercle 8 px |
| PV / poise | **30** / 10 |
| Vitesse | **85 px/s** (strafe 60 px/s) |
| Masse | ×1,0 |
| Aggro | **220 px**, toute la salle après 2 s |
| Coût de budget | 1 |

| État | Durée / règle |
|---|---|
| `approche` | Strafe en arc à **64–80 px** du héros, jamais en ligne droite ; prend un jeton pour attaquer |
| **Coup de diaporama** (≤ 32 px) | Télégraphe **450 ms** (reflet blanc sur le laptop puis contour magenta) → arc **90°**, portée **28 px**, **8 dégâts**, knockback 24 px → recovery **600 ms** |
| **Quick win** (64–120 px) | Télégraphe **450 ms** (ajuste sa cravate, ligne magenta de 96 px au sol) → ruée de **96 px en 240 ms** (400 px/s), hitbox capsule largeur 16 px, **10 dégâts**, ne peut pas tourner → recovery **800 ms** « essoufflé » (dos tourné, **+25 % de dégâts subis**) ; cooldown individuel **4 s** |
| Cadence | 1 attaque toutes les **≈ 1,4 s** (jeton compris) |
| Faiblesses | Frappé pendant la recovery : stun 400 ms. Ne change pas de direction pendant la ruée. Projeté sur une voie ou dans un vide : mort. |
| Anim `consultant-attack-{dir}` | 6 frames recalées 150, 150, 150, **40**, 60, 100 ms (télégraphe = frames 0–2) |

Répliques : « On va challenger ça en mode agile ! » · « C'est un quick win, ça ! » · (mort) « Je vous envoie un récap… »

### 7.4 Borne Automatique (tourelle à tickets)
| Stat | Valeur (r = 1, Matin) |
|---|---|
| Frame / hurtbox | 32×32 / cercle 10 px |
| PV / poise | **50** / ∞ (jamais en `stagger`, sauf stun) |
| Blindage | Arc frontal de 90° : **−50 %** de dégâts ; arc arrière de 90° : **×2** |
| Vitesse | 0 ; **repli** à 30 px/s sur 32 px si le héros est à moins de 32 px (cooldown 3 s) |
| Masse | ∞ (aucun knockback) |
| Aggro | Toute la salle, ligne de vue requise |
| Coût de budget | 2 (3 par vague maximum) |

| Attaque | Télégraphe | Effet | Cadence |
|---|---|---|---|
| `déploiement` | 800 ms (invulnérable) | Se déplie d'une trappe | — |
| `visée` | — | Rotation **90°/s** vers le héros | continue |
| **Salve de tickets** | **500 ms** : écran « IMPRESSION… », fente magenta | Éventail de **3 tickets à ±15°**, **140 px/s**, hitbox 6×6 (sprite 16×16), durée de vie 2,5 s, **7 dégâts** | toutes les **2,2 s** (rechargement 1,2 s) |
| **Ticket de caisse continu** (r ≥ 6) | **800 ms** : ligne de visée magenta de 1 px | Ruban-laser de 6 px de large traversant la salle pendant **1,5 s**, rotation 20°/s vers le héros, **10 dégâts** au contact (puis i-frames du héros) | cooldown **8 s**, remplace une salve |

Faiblesses : le Coup de sifflet l'affiche **« HORS SERVICE »** (stun 2 s, blindage désactivé) ; le coup 3 et le dash-attaque détruisent ses tickets ; dos exposé. Épave persistante (`wreck`) après la mort : couverture basse pour le reste de la salle.
Répliques (voix de gare synthétique) : « Veuillez insérer votre dignité. » · « Votre transaction a été optimisée. »

### 7.5 Drone Optimètre (distance mobile, marquage)
| Stat | Valeur (r = 1, Matin) |
|---|---|
| Frame / hurtbox | 32×32 / cercle 7 px ; ombre 8 px sous le drone |
| PV / poise | **15** / 5 |
| Vitesse | **110 px/s** ; vole au-dessus des voies et des vides, bloqué par les murs |
| Masse | ×0,6 (knockback ×1,7) |
| Aggro | Toute la salle |
| Coût de budget | 1,5 |

| Comportement | Règle |
|---|---|
| `survol` | Orbite à **96 px** du héros, sens aléatoire, change de sens toutes les 3–5 s |
| **Scan** (marquage) | Cône de **60°**, portée **128 px**, balayage de **1 s** (cône magenta translucide). Si le héros y reste **300 ms cumulées** : **« Signalé » 5 s** = **+25 % de dégâts subis** et les Bornes tirent 25 % plus vite sur lui. Cooldown 7 s, un seul Signalement actif. |
| **Tir de billes** | Télégraphe **400 ms** (antenne magenta clignotante), 1 bille 4×4 à **180 px/s**, **5 dégâts** ; toutes les **2,4 s** |
| **Plongeon** (seulement sur un héros Signalé) | Télégraphe **480 ms** (ligne magenta de 120 px), plongeon de **120 px en 300 ms**, **9 dégâts** ; puis **700 ms au sol** (vulnérable, +50 % de dégâts subis) |
| `fuite` | Si le héros est à moins de 48 px : s'éloigne à 150 px/s pendant 600 ms |
| Faiblesses | Le Coup de sifflet le fait **tomber au sol 1,2 s** (cible facile) ; fragile ; dans le biome 2, les ombres des arcs lui font perdre la cible |
| Anim `drone-attack` | 8 frames : 120 ×4 (visée, tir à la fin de la frame 3 pour le Tir) puis 60 ×4 (plongeon, actives 4–7) |

Répliques (haut-parleur) : « Votre productivité est en cours d'évaluation. » · « Merci de sourire, vous êtes filmé à des fins de qualité. »

### 7.6 Élite : Manager KPI « Le Tableur »
| Stat | Valeur (r = 6, Matin, déjà mis à l'échelle) |
|---|---|
| Frame / hurtbox | 48×48 / cercle 13 px ; aura `vfx_elite-aura` |
| PV | **220** en base (r = 6 : **308**) |
| Posture « Costume trois-pièces » | **Non interrompu** par les coups 1 et 2 (le Sifflet ne l'étourdit que 0,4 s, le Préavis 0,8 s) ; casse après **50 dégâts reçus en 3 s** → stun **« Burn-out du manager » 1,5 s**, **+25 % de dégâts subis** ; la posture se reforme 6 s après |
| Vitesse | **60 px/s** |
| Masse | ×0,5 |
| Coût de budget | 8 |
| Récompense | +20 Mobilisation, 15 Tickets, −10 Burnout |

| Pattern | Télégraphe | Effet | Fréquence |
|---|---|---|---|
| `positionnement` | — | Reste à **120–180 px** du héros, derrière ses troupes | continu |
| **Coup de tablette** (héros à ≤ 36 px) | **700 ms** (tablette levée, arc magenta) | Arc 120°, portée 40 px, **12 dégâts**, knockback 40 px | cooldown 2 s |
| **Réunion d'alignement** | **1 000 ms** (il frappe dans ses mains, cercle de 96 px qui se remplit) | Boucliers violets sur les alliés à ≤ 96 px : **−50 % de dégâts reçus pendant 4 s** | toutes les **12 s** |
| **Chronométrage** | **800 ms** (cercle-chrono de 32 px sous le héros) | Zone 3 s : **ralenti −40 %**, 4 dégâts à l'activation | toutes les **5 s** |
| **Reporting hebdo** (signature) | **1 200 ms** (sol quadrillé, ligne de progression) | Anneau de barres qui s'étend de 0 à **160 px en 800 ms**, épaisseur 12 px, **14 dégâts** ; se traverse au dash | toutes les **20 s** (premier à 8 s) |

Faiblesse : frappé pendant le télégraphe de la Réunion d'alignement (mains jointes), il l'**annule**, est étourdi **0,8 s** et tous les boucliers actifs tombent. Une rame le traverse à pleins dégâts (40 % de ses PV max).
Répliques : « Vous êtes à 63 % de l'objectif. De vie. » · « Ce qui ne se mesure pas n'existe pas. Vous, par exemple. »

### 7.7 Boss 1 : L'Auditeur des Quais (aux commandes de la Borne Totale 3000)
| Élément | Valeur |
|---|---|
| Frame / hurtbox | **96×96** / cercle **28 px** ; pas de knockback, pas de stun hors fenêtres prévues |
| PV | **1 400** (×S_pv du roulement et du Plan ; pas de scaling `r`) |
| Arène | Quai 2 / voie / quai 3, **56×32 tuiles** (896×512 px) : 2 bandes de quai reliées par 2 passages planchéiés au-dessus de la **voie centrale**, une **voie de bordure** le long du quai 3, un grand **écran des départs** au fond (horloge diégétique des rames), 4 chariots à bagages |
| Vitesse | 50 px/s (P1), 60 (P2), 75 (P3) |
| Délai entre deux patterns | **1 600 ms** (P1), 1 300 ms (P2), 1 100 ms (P3) |
| Introduction | « Vous avez mis 4 minutes 12 pour arriver jusqu'ici. Je le note. » (overlay BossIntro, 2,5 s, passable) |
| Durée cible | **2 min** (1 min 30 à 3 min) |

| Phase | Seuil | Pattern | Télégraphe | Effet | Fréquence / règles |
|---|---|---|---|---|---|
| **1 — « Audit bienveillant »** | 100 → 60 % | **Bras-barrières** (`attack-sweep`) | **900 ms** (bras levés, demi-cercle magenta) | Arc **180°** devant lui, rayon **88 px**, **16 dégâts**, knockback 48 px ; recovery **500 ms** (fenêtre de punition) | si héros ≤ 96 px |
| | | **Chronométrage ×3** | **800 ms** chacun, espacés de 400 ms | 3 cercles de 32 px posés sous le héros : **6 dégâts** + ralenti −40 % 3 s | toutes les 9 s |
| | | **Graphique en barres** | **1 000 ms** (3 lignes magenta au sol en éventail ±25°) | Barres qui jaillissent le long de 3 lignes de **300 px** en 600 ms, largeur 16 px, **14 dégâts** | toutes les 7 s |
| | | **Bouclier d'alignement** | 600 ms (bulle qui se forme) | Bulle violette **invulnérable** 8 s maximum. **Se brise** si un **chariot à bagages** (frappé par le coup 3 ou le dash-attaque, projeté à 300 px/s) le touche, ou si une **rame régulière** (voie de bordure, toutes les 20 s) passe à ≤ 48 px. Brisé : **stun 3 s**, +25 % de dégâts subis. Non brisé en 8 s : il regagne **3 %** de ses PV (« audit validé ») | à 80 % et à 65 % de PV |
| Transition | 60 % | `phase` (1,2 s, invulnérable) | — | Blindage arraché, écrans rouges ; 2 chariots réapparaissent | — |
| **2 — « Plan de transport optimisé »** | 60 → 25 % | **Commande des rames** | **3 000 ms** triples : l'écran affiche « VOIE 3 — PASSAGE DANS 3… 2… 1 », signal vert → orange → rouge, rails qui vibrent, klaxon à 1 200 ms | Une rame traverse la voie choisie : **40 % de l'Énergie max** au héros, tue les adds, **150 dégâts au boss** s'il est sur la voie (il suit le héros : l'attirer sur la voie est la bonne idée) | toutes les **14 s** |
| | | **Barrage de tickets** (`attack-barrage`) | **800 ms** (écran magenta) | 4 cycles : éventail de **5 tickets à ±40°**, 150 px/s, **7 dégâts** | toutes les 8 s |
| | | **Renforts** | 600 ms (portes de rame) | **2 Consultants Juniors** (r = 9) descendent d'une rame à quai, 4 vivants maximum | toutes les **25 s** |
| | | **Reporting hebdo géant** | **1 200 ms** | Anneau de 0 à **280 px** en 1 200 ms, épaisseur 16 px, **18 dégâts** ; se traverse au dash | toutes les 18 s |
| **3 — « Objectif non atteint »** | < 25 % | Tous les patterns précédents | ×0,83 (jamais < 700 ms) | Vitesse d'exécution ×1,2 ; rames toutes les **10 s** | — |
| | | **« Contrôle ! »** (`attack-stamp`) | **1 100 ms** (cercle de 48 px qui suit le héros) + **300 ms** figé | Saut : **22 dégâts** au centre + onde de 0 à 96 px, **10 dégâts** | toutes les 6 s |
| | | **Lignes de KPI** | 700 ms (il s'accroupit, flèche magenta) | Dash d'un quai à l'autre (300 px en 500 ms, **16 dégâts** au passage) laissant une traînée de 3 s (**6 dégâts / 0,5 s**) | toutes les 8 s |

- **Défaite** : le chronomètre s'arrête sur **7:12**. « … Le train de 7h12, il existe encore ? » Slow-mo 0,25 pendant 1,2 s, explosion `vfx_explosion-big`.
- **Récompenses** : 1er kill : **Preuve n° 1 « Fermeture des guichets »**, **3 Pièces**, **1 Tasse**, **25 PS**, 5 Grains. Kills suivants : 25 PS, 1 Pièce, 5 Grains.
- **DPS attendu** : ≈ 80 DPS à ce stade (Avantages ≈ ×1,6) ; uptime ≈ 25 % → ≈ 1 min 45.

### 7.8 Boss 2 : L'Invité d'honneur, Elio Di Rupo (v1, version design)
Caricature satirique autorisée d'une personnalité réelle. **Cadre obligatoire : LORE §1.4 (exception 3) et §7.5** : vaincu, jamais tué ; aucune réplique présentée comme une citation réelle ; aucune humiliation, aucun parti, logo ni slogan ; il ne travaille pas pour Privatix. Il **remplace le Fluidifieur comme Boss 2** et reprend son budget (PV, durée, récompenses). Le Fluidifieur devient l'élite majeur du biome 2 (§ 7.10). Valeurs détaillées d'origine : `docs/proposals/revue-3d-loot/game_designer.md` §11.3, recalées ici sur le budget du Boss 2.

| Élément | Valeur |
|---|---|
| Hurtbox | cercle **18 px** ; pas de knockback, pas de stun hors fenêtres prévues |
| PV | **2 000** (fixe, ×S_pv et P_pv) |
| Arène | **Belvédère de la Passerelle** transformé en tribune pour l'inauguration de « **Mons 2032 : la Gare Expérience** », ≈ **52×30 tuiles** : estrade, pupitre à micro, plaque voilée, rangée de chaises pliantes de la claque, ruban rouge. Vent faible (rafales toutes les 10 s), vides sur les deux longs côtés |
| Vitesse | 55 px/s (P1), 60 (P2), 70 (P3) |
| Délai entre deux patterns | **1 500 ms** (P1), 1 250 ms (P2), 1 050 ms (P3) |
| Introduction | « Mesdames, messieurs, chers amis… et vous, au fond, en gilet orange. » (overlay BossIntro, 2,5 s, passable) |
| Durée cible | **2 min 30** (2 à 3 min 30) |

| Phase | Seuil | Pattern | Télégraphe | Effet | Fréquence / règles |
|---|---|---|---|---|---|
| **1 — « Le Discours inaugural »** | 100 → 60 % | **Nœud papillon boomerang** | **900 ms** (il ajuste son nœud, ligne courbe magenta aller-retour) | Projectile cercle r 8, 220 px aller, retour à 260 px/s, **12 dégâts** à l'aller et au retour ; **600 ms** sans nœud ensuite (punition) | toutes les 6 s |
| | | **« Et j'ajouterai… »** (ondes de discours) | **1 000 ms** (il monte au pupitre) | Pendant 4 s, un **anneau** par seconde de 0 à 200 px, épaisseur 12 px, avec une **brèche de 40°** (« pause pour applaudissements ») qui tourne à 45°/s ; **10 dégâts** par anneau, se traverse au dash. Immobile : dans son **dos**, +25 % de dégâts | toutes les 14 s |
| | | **La claque** | — | 3 Consultants assis applaudissent : chacun ajoute **+4 px** d'épaisseur et **+2 dégâts** aux anneaux. Un coup les fait se rasseoir, penauds, jusqu'à la phase suivante | permanent |
| | | **Promesses** | **1 500 ms** (5 bulles dorées à contour magenta qui se remplit) | 5 cercles r 24 qui éclatent en cercle r 40 : **14 dégâts** (« promesse non tenue ») ; une bulle frappée avant d'éclater disparaît : « **promesse tenue** », +5 Mobilisation, −3 Burnout | toutes les 10 s |
| Transition | 60 % | `phase` (1,5 s, invulnérable) | — | « Je serai bref. » (il ne l'est pas) ; la claque se relève | — |
| **2 — « La Première Pierre »** | 60 → 25 % | **Premières pierres** | **1 100 ms** (cercles magenta sous le héros et autour) | 4 cercles r 28, **16 dégâts** ; les pierres restent **6 s** comme obstacles, puis s'effritent (« reporté ») | toutes les 9 s |
| | | **Pose solennelle** | 700 ms (il s'agenouille, truelle levée) | Pose une pierre devant lui : cercle r 40, **18 dégâts** ; **900 ms** penché, dos exposé (**fenêtre principale** de la phase) | toutes les 7 s |
| | | Discours, Promesses, Nœud papillon | | Comme en P1 | |
| Transition | 25 % | `phase` (1,5 s, invulnérable) | — | « Permettez-moi une parenthèse. » Le ruban se tend autour de l'arène | — |
| **3 — « Le Ruban »** | < 25 % | **Ruban d'enceinte** | **1 200 ms** (le ruban magenta se tend entre les poteaux) | Le ruban ceinture l'arène et la **resserre** jusqu'à un rayon de 200 px en 20 s ; contact : **8 dégâts** et entrave (ralenti 50 % pendant 1 s) | continu |
| | | **Couper le ruban** (faiblesse) | — | Un **coup final** ou une **dash-attaque** sur un segment tendu, ou un **dash parfait** à travers : « **Inauguration ratée** », il est **étourdi 3 s**, +25 % de dégâts subis, et le ruban se relâche de 120 px | une fois toutes les 12 s |
| | | **Ciseaux d'inauguration** | **1 100 ms** (les lames s'ouvrent, rectangle magenta) | Rectangle orienté **240×24**, **22 dégâts** ; les lames claquent dans le vide, l'effet est comique et non violent ; recovery **900 ms** | toutes les 7 s |
| | | Tous les patterns précédents | ×0,85 (jamais < 800 ms) | | |

| Mécanique | Interaction |
|---|---|
| **Burnout** | Pendant les ondes de discours, la récupération passive du héros est **×2** (on décroche) ; les promesses tenues rendent −3 Burnout |
| **Coup de sifflet** | « **Rappel au règlement** » : pendant les ondes de discours, le Sifflet l'**interrompt** (étourdi **2 s**). Le reste du temps : dégâts seulement |
| **Préavis de grève** | « **Concertation sociale** » : il pose le micro et négocie, **aucune attaque pendant 4 s**, marqué Piquet (+15 %) |
| **Dash** | Anneaux, pierres et ciseaux se traversent au dash ; le ruban ne se traverse qu'en **dash parfait** (qui le coupe) |

- **Défaite** : « Temps de parole épuisé ». Le drap glisse de la plaque, il lit « Privatix Rail Solutions — Phase 3 : Cession », redresse son nœud papillon : « Je n'inaugure pas une fermeture. » Il tend les ciseaux au héros et descend de l'estrade. Confettis, fanfare, aucune animation de mort ni de souffrance. La passerelle, fermée « pour cérémonie », est rouverte : descente vers le hall.
- **Récompenses** : 1er kill : **4 Pièces**, **1 Tasse**, **40 PS**, 8 Grains, objet de collection « **Ciseaux d'inauguration** » (archivé par Béné), butin de boss avec **Hors-série garanti** et **Plan du Patrimoine L13 « Ruban inaugural »** (§ 9 bis). Kills suivants : 40 PS, 1 Pièce, 8 Grains, butin de boss (3 objets au moins Homologués, ilvl 21).
- **DPS attendu** : ≈ 110 DPS à ce stade (Avantages et équipement ≈ ×2,2) ; uptime ≈ 30 % (fenêtres de discours, pose solennelle, ruban coupé) → ≈ 1 min 30 de dégâts utiles sur 2 min 30.
- **Repli** : un nom et un modèle fictifs (« Le Bourgmestre au nœud papillon ») restent activables par un drapeau de configuration si l'autorisation tombe ou pour une distribution hors de Belgique.

### 7.9 Boss final : Gontran Vanderslide (v2, version design)
| Élément | Valeur |
|---|---|
| Frame / PV | P1 **64×64** (trottinette, 3 directions) puis P2–P3 **128×128** / **1 800 / 1 600 / 1 200 PV** |
| Arène | Bureau du Directeur (44×28) puis, après « Réorganisation », Salle du Conseil (**64×36**) avec mur de visio et photocopieuse monumentale |
| Jauge de signature | Se remplit en **7 min** au total, en temps réel ; pleine = contrat signé = défaite. **×1,5** tant qu'une Clause vit (P2). |
| Preuves en main | Chaque Preuve (0 à 3) s'active sur un **pupitre-projecteur** : jauge **−25 %**, boss étourdi **3 s** ; une fois par phase. |
| P1 « Méga-Deck 2032 » | Lignes de bullet points qui balaient la salle (un trou par ligne) ; téléportation par balayage d'écran ; piliers-graphiques ; « Je vous mets en copie » (2 Consultants) ; tempête de Pense-bête. **Le grand écran affiche le titre de la slide suivante 1 s avant** : c'est le télégraphe. |
| P2 « Conseil d'Administration en visio » | 4 **Clauses-tentacules** (200 PV chacune) : *Non-concurrence* (bloque le Sifflet 5 s), *Plan social optimisé* (écrasement de zone), *Vous êtes en mute* (bloque le dash 3 s). Voix off d'Hubert Rentabilis. |
| P3 « L'Optimiseur Absolu » | *Copie conforme* : une photocopie du joueur **rejoue ses 3 dernières secondes** ; *Bourrage papier* (immobilise 1 s) ; *Recto-verso* (chaque attaque dupliquée en miroir, ligne de pliure en pointillé). |
| Coup final | Sous 5 % : invite unique **« Mais concrètement, sur le terrain, ça donne quoi ? »** ; un seul coup, critique garanti, ralenti, silence. |
| Récompenses | 60 PS, 5 Pièces (1er kill), 12 Grains, Tasse ; « Shift tenu » +50 PS |

### 7.10 Ennemis post-MVP (rappel design)
**Agent de Sécurité Externalisé** (Tank, 90 PV, coût 3) : Bouclier-badge frontal (100 % bloqué), charge « Contrôle d'accès » de 48 px (télégraphe 700 ms), ouverture 1 s ; le Sifflet lui fait baisser le bouclier · **Pense-bête Vivant** (Essaim invoqué, 5 PV, coût 0) : Se colle : −10 % de vitesse par Pense-bête (3 max) ; décollé par un dash · **Coach Agile « Le Facilitateur »** (Élite invocateur, 140 PV, coût 7) : Kite à 112 px, 4 Pense-bête toutes les 8 s, *Team building* (attire et inverse les commandes 1,5 s), *Rétro positive* (soin 20 %, canalisation 2 s interrompable) · **Certifié (affixe)** (Variante, ×2,5 PV, coût ×2,5) : ISO (armure), En copie (se dédouble), Prioritaire (vitesse ×1,4), Senior Partner (explose en zone).

**Ennemis majeurs (v1/v2, version design ; valeurs à équilibrer ; lore : LORE §6.8, §6.9, §7.2 ; détail : `docs/proposals/revue-3d-loot/game_designer.md` §11)**

Élites et mini-boss suivent `PV(r)` et `Dégâts(r)` (§ 3.7) ; télégraphes ≥ **700 ms** ; pas de knockback.

| Ennemi | Type | Biome | Rôle et lecture |
|---|---|---|---|
| **Le Furet putride** | Élite majeur (PV de base 200, coût 8) ; rencontre optionnelle depuis le hub | 1 (salle Élite : 40 %, 60 % la Nuit ; passage sous voies, couloir technique) + son antre, le coin poubelles de la Cour intérieure du BAG | Contrôle de zone : nuages d'odeur (Burnout +, volutes magenta), roulades de sacs bleus (projectiles rebondissants), plongée sous plaque d'égout (pavés qui se soulèvent 600 ms avant), vol d'un Gobelet (rendu s'il est frappé). Vaincu : s'endort dans un conteneur. |
| **Le Fluidifieur** (ancien Boss 2) | Élite majeur (PV de base **480**, soit ≈ 1 090 à r = 17), Salle gardée | 2 (salle 8, fixe : le nœud sous le grand arc, ≈ 48×30 tuiles, bords sur le vide, vent constant) | Régisseur de l'inauguration. *Phase 1 « Mobilité interne »* : Glissade de mobilité (charge en chaise à roulettes portée par le vent, 2 rebonds, télégraphe 900 ms, 14 dégâts) ; Changement de roulement la veille (damier de dalles marquées, télégraphe 1 500 ms, qui s'ouvrent sur le vide 4 s) ; Congé en cours de validation (classeur lent : s'il touche, un Avantage est « suspendu » jusqu'à 3 coups sur le classeur). *Phase 2 « Plan de transformation »* (sous 50 %) : Organigramme (2 Consultants reliés par des lanyards tournent en roue) ; Mutation d'office (ligne **magenta** de 1 000 ms, puis échange de positions). **Faiblesse « Le Règlement »** : 3 pages volent dans le vent ; les 3 attrapées, le prochain Sifflet devient « Article 47, alinéa 3 » : étourdi **4 s**, **×2 dégâts**. Sifflet ordinaire : étourdi 0,6 s. Durée visée 60 à 90 s. 1er kill : **Preuve n° 2 « Suppression des accompagnateurs »**, 1 Pièce. |
| **Le Discosaure** | Mini-boss (PV de base **560**, soit ≈ 1 600 à r = 24), Salle gardée | 3 (position 5 à 7, « Afterwork de transformation », 2e étage du BAG ; élite rare dans le hall) | Tank rythmique : Facettes (taches de lumière en orbite, contour puis remplissage magenta), éclats qui marquent le héros, piétinements sur les temps forts de la musique (le rythme est le télégraphe), Coup de queue en arrière, Charge vers un mur, Lasers stroboscopiques en phase 2. Casser la boule (dos exposé après un piétinement ou une charge) éteint la salle et l'étourdit. « Sous les projecteurs » : taches **blanches** inoffensives qui donnent +10 % de dégâts et +2 Burnout/s. En « Réduction des mouvements » : ni clignotement ni stroboscope (§ 12). 1er kill : Plan du Patrimoine L12 « Boule à facettes de poche ». |

## 8. Game feel
### 8.1 Tableau par événement
*Hérité Phaser : `camera.shake(durée, intensité)` avec `intensité = px / 640`.* En 3D, une secousse de **1 px** du tableau vaut un déplacement de caméra de 1/640 de la largeur de l'écran, plus un roulis de 0,15° par px (0,6° au plus) ; le zoom punch devient un rapprochement de la caméra. Les secousses **se combinent au maximum, pas en somme**. Le hitstop **gèle l'animation et la vélocité du héros et des cibles touchées seulement** ; le reste du monde continue.

| Événement | Hitstop | Shake | Flash | Particules | Son (pitch ±8 %) | Autres |
|---|---|---|---|---|---|---|
| Coup 1 / 2 touche | **50 ms** | 1 px, 60 ms | blanc 60 ms sur la cible | 4 étincelles orange | « clang » léger métal sur rail | — |
| Coup 3 touche | **110 ms** | **3 px, 120 ms** | blanc 80 ms | 8 étincelles + anneau de poussière (`vfx_slam`) | « BONG » métal sur rail | zoom punch ×1,02 pendant 100 ms |
| Critique | +30 ms | 4 px, 140 ms | blanc 80 ms | +4 étincelles jaunes | « ting » aigu superposé | nombre jaune avec « ! » |
| Dash-attaque touche | 60 ms | 2 px, 80 ms | blanc 60 ms | traînée d'étincelles | « schlack » | — |
| Plaqué contre le quai | +20 ms | 2 px, 100 ms | — | éclats de béton | « thud » | — |
| Kill | (celui du coup) | 2 px, 100 ms | — | 12 feuilles de papier / boulons, retombée 600 ms | froissement + « ka-ching » de facture | corps en fondu 400 ms |
| **Dernier kill de la salle** | 0 | 3 px, 150 ms | — | confettis de tickets | **carillon de gare** « ding-dong » | **slow-mo `timeScale` 0,25 pendant 450 ms réels**, retour à 1 en 250 ms (ease-out), zoom ×1,06, puis récompense |
| Héros touché | **80 ms** | **4 px, 180 ms** | blanc 60 ms puis clignotement 60 ms | 3 éclats magenta | « ouf » + bip de badge refusé | vignette rouge 30 % pendant 250 ms |
| Dash | 0 | 0 | — | 3 rémanences cyan (45 ms d'écart, fondu 180 ms), poussière | « whoosh » | LED jaune « +5 min » |
| Dash parfait | 0 | 1 px, 60 ms | contour blanc du héros 100 ms | rémanences rouges | carillon | `timeScale` 0,6 pendant 200 ms, LED rouge « +15 min » |
| Coup de sifflet | 0 | 5 px, 250 ms | anneau blanc | onde de choc ×1,3 | **sifflet strident** | pancartes « EN GRÈVE » au-dessus des ennemis |
| Préavis de grève | 0 | 7 px, 350 ms | plein écran blanc 20 % pendant 50 ms | onde ×2,1 + tracts | trompette + mégaphone | — |
| Gobelet bu | 0 | 0 | vert 100 ms | vapeur | « slurp » + soupir | nombre vert |
| Pétage de plombs | 0 | 6 px, 300 ms | rouge 15 % continu | vapeur du casque | cri + musique +10 % de tempo | — |
| Projectile détruit | 0 | 0 | — | 3 confettis de ticket | « pfff » de papier | — |
| Rame qui passe | 0 | 6 px pendant le passage | — | ballast projeté | klaxon, roulement | — |
| Changement de phase de boss | 300 ms (global) | 8 px, 400 ms | blanc 100 ms | débris | annonce de quai distordue | barre de PV du boss qui clignote |

### 8.2 Nombres de dégâts
- Texte DOM net (taille équivalente à 8 px logiques de l'ancien rendu, contour sombre), ancré à une position du monde ; *hérité Phaser : police pixel 8 px*.
- Montée de **16 px en 500 ms**, fondu sur les 200 dernières ms, décalage horizontal aléatoire **±6 px**.
- Les dégâts sur une même cible dans une fenêtre de **150 ms** fusionnent en un nombre qui grossit (×1,25 max).
- Couleurs : **blanc** normal, **jaune** critique, **rouge** dégâts subis par le héros, **vert** soin, **gris** « RÉSISTÉ » (blindage, bouclier). Désactivables (§12).
- Pool de 64 nombres ; au-delà, le plus ancien est recyclé.

## 9. Progression de run (perdue à la mort)
Récompenses de salle : voir §3.8. Voir §3.8 pour les poids. Après le dernier kill, la récompense apparaît sur le **socle** de la salle ; on la prend avec **E**. Les portes ne s'ouvrent qu'une fois la récompense prise (anti-oubli), sauf Tickets et Grains (ramassés automatiquement).

### 9.2 Avantages acquis
Un Avantage arrive **par radio** (portrait + réplique de 2 s). Choix parmi **3** d'une même famille. Chaque action du MVP a un **emplacement** (Frappe, Dash, Sifflet, Café) : un seul Avantage par emplacement (le nouveau remplace l'ancien, avec confirmation) ; les **passifs** sont illimités.

**Raretés**

| Rareté | Probabilité de base | Multiplicateur de valeur | Bordure |
|---|---|---|---|
| **Standard** | 70 % | ×1 | grise |
| **Ancienneté** | 22 % | ×1,5 | bleue |
| **Statutaire** | 7 % | ×2 | violette |
| **Acquis historique** | 1 % (requiert 2 familles) | effet unique | or |

Chaque salle comptée franchie fait passer **1 point** de Standard vers Ancienneté (plafond +20). Les paliers de rareté s'appliquent aux nombres en gras ci-dessous.

**Les 7 familles (valeurs Standard)**

| Collègue / famille | Thème | Avantage 1 | Avantage 2 | Avantage 3 |
|---|---|---|---|---|
| **Josiane** — *Contrôle des titres* | Défense, renvoi | **Titre non valable** (Frappe) : les coups 1 et 2 **renvoient** les projectiles vers leur tireur (**×1,5** dégâts) | **Correspondance ratée** (Dash) : le dash **détruit** les projectiles traversés, **+3** Mobilisation par projectile | **Gilet pare-coups** (passif) : **−10 %** de dégâts subis pendant la recovery des attaques |
| **Rudy** — *Coup de sifflet* | Étourdissement, onde | **Fermeture des portes** (Dash) : le dash laisse une onde qui étourdit **0,8 s** (rayon 32 px) | **Piquet de grève** (Sifflet) : laisse une zone de **72 px pendant 4 s** qui ralentit de **40 %** | **Aiguillage dévié** (passif) : knockback **+50 %**, Plaqué contre le quai **5 → 20** dégâts |
| **Béné** — *Guichet* | Malus (Amende, Vulnérable, Ralenti) | **Amende forfaitaire** (Frappe) : les coups appliquent **3 dégâts/s pendant 4 s**, jusqu'à 3 cumuls | **Majoration** (passif) : ennemis sous Amende : **+20 %** de dégâts du coup 3 | **File d'attente** (Sifflet) : ennemis touchés **ralentis de 50 % pendant 3 s** après le stun |
| **Yasmina** — *Régulation* | Mobilité, ralenti | **Rattrapage horaire** (passif) : **+1 charge** de dash (Statutaire : et recharge −20 %) | **Voie d'attente** (Dash) : un dash parfait crée une bulle de **48 px** où les ennemis sont ralentis de **60 % pendant 2 s** | **Régulation du trafic** (Frappe) : dash-attaque **+50 %** de dégâts et +16 px de portée |
| **Kevin** — *Caténaire* | Électricité en chaîne | **Caténaire 3 kV** (Dash) : traînée électrique de 72 px pendant **1,5 s**, **6 dégâts / 0,5 s** | **Coupure de caténaire** (Frappe) : le coup 3 déclenche un arc vers **3** cibles à ≤ 80 px, **10 dégâts** chacune | **Surtension** (Sifflet) : électrocute les cibles, **8 dégâts** qui rebondissent 2 fois |
| **Fatou** — *Prévention* | Soin, bouclier | **Pause légale** (passif) : toutes les **90 s**, un bouclier absorbe un coup | **Hydratation** (Café) : Gobelet **+15 %** de soin et **+10** Burnout au lieu de +20 | **Visite médicale** (passif) : **+2 Énergie** à chaque salle nettoyée |
| **Marcel** — *D'antan* | Critiques, second souffle | **Heures sup** (passif) : **+4 pts de critique par tranche de 10 Burnout au-dessus de 30** (max +28) | **Prime de pénibilité** (passif) : **+15 %** de dégâts tant que l'Énergie est sous 50 % | **De mon temps** (Frappe) : **+40 %** de dégâts critiques sous 30 % d'Énergie |

**Acquis historique (exemple)** : *Ne laisse personne sur le quai* (Fatou + Marcel) : la première fois que l'Énergie tombe sous 20 % dans un biome, Burnout −40 et 2 s d'invulnérabilité.

### 9.3 Motions communes (duos)
Proposées à la place d'un Avantage (12 % de chances) dès que les prérequis des deux collègues sont possédés ; à partir du biome 2 (MVP : désactivées, sauf pour les tests).

| Motion | Duo | Prérequis | Effet |
|---|---|---|---|
| **Signal électrifié** | Kevin + Rudy | Un Avantage Sifflet de Rudy + un de Kevin | Le Sifflet électrocute toutes les cibles : **15 dégâts** + chaîne de 3 rebonds |
| **Grève générale** | Rudy + Béné | Piquet de grève + Amende forfaitaire | Le Sifflet applique **3 cumuls d'Amende** |
| **Service minimum** | Yasmina + Marcel | Rattrapage horaire + Heures sup | Pendant le Pétage de plombs, chaque dash déclenche un mini-sifflet (**40 px, 12 dégâts**) |

### 9.4 Réglages d'outil (ex-« Réglages de clé »)
Choix parmi **2**, 3 rangs chacun (un même Réglage reproposé monte d'un rang). Valeurs données pour la **Clé à tire-fond** ; avec un autre Outil (§ 9 bis), « coup 3 » se lit « **coup final** » et « coups 1–2 » se lit « **coups rapides** » de cet Outil.

| Réglage | Rang 1 | Rang 2 | Rang 3 |
|---|---|---|---|
| **Clé dynamométrique** | Coup 3 : **30 → 42** dégâts | Rectangle **56 → 68 px** | Stun 250 → **500 ms** |
| **Manche gainé** | Vitesse d'attaque **+8 %** | +16 % | +24 % |
| **Mâchoire élargie** | Arcs des coups 1–2 : rayon **+4 px** | ouverture **+20°** | +4 px supplémentaires |
| **Contrepoids** | Knockback **+25 %** | Coup 2 étourdit **150 ms** | +25 % supplémentaires |
| **Clé graissée** | Chain point **80 → 60 ms** | Dash-attaque **18 → 26** | Fenêtre de dash-attaque **120 → 180 ms** |

### 9.5 Gobelets, Tickets, Preuves en main
- **Gobelets** : 2 au départ, 4 au maximum ; +1 par récompense Gobelet, salle Café, Friterie.
- **Tickets** : 2 à 4 par kill (élite 15), récompense de porte 40–60, consigne 30. Ordre de grandeur : **≈ 180 à 250 Tickets par biome**.
- **Preuves en main** : n° 1 au 1er kill de l'Auditeur, **n° 2 au 1er kill du Fluidifieur** (Salle gardée du biome 2), n° 3 par l'événement des Archives (LORE J11) ; aussi aux élites (1re salle Élite d'un biome, si la Preuve du biome n'est pas encore archivée) ; archivées au retour à l'OCC (§2.5).

### 9.6 Friterie de Raymonde (boutique, prix en Tickets)
| Article | Prix | Stock |
|---|---|---|
| **Gobelet** | **60** | 2 |
| **Cornet de frites** (soin 40 %, sans Burnout) | **80** | 1 |
| **Avantage acquis** (choix de 3, famille au choix parmi 2) | **120** | 1 |
| **Réglage d'outil** | **150** | 1 |
| **Mitraillette** (sandwich : +10 Énergie max pour le Shift) | **100** | 1 |
| **Fricadelle mystère** (récompense aléatoire, 10 % d'Acquis historique) | **90** | 1 |
| **Recours** (relance des portes de la salle suivante) | **50** | 1 |
| **Équipement d'occasion** (1 objet Homologué au moins, emballé dans un cornet) | **140** | 1 |

Prix ×0,8 avec le Souvenir « Tampon Numéro suivant ». Wagon-Bar fantôme : 3 Acquis historiques à **250** Tickets, et 1 objet **Patrimoine** à **300** Tickets (avec le loot).

## 9 bis. Loot & Équipement
Synthèse de la proposition retenue : `docs/proposals/revue-3d-loot/game_designer.md` (affixes un par un, légendaires, Attelages, modèles de données, tests). En cas d'écart, **ce paragraphe fait foi** pour les noms, les gestionnaires du hub et les chiffres qu'il donne ; la proposition fait foi pour le détail qu'il ne reprend pas.

### 9 bis.1 Modèle : hybride « Vestiaire de la DPD »
On trouve l'équipement **pendant le Shift** (comme Hades et Dead Cells) et on en **consigne** une partie au Vestiaire : **1 objet** à la mort, **2** en cas de victoire (+1 avec la revendication « Consigne élargie »). Tout le reste part en **Ferraille** (100 % de sa valeur ; 50 % pour un objet laissé au sol en quittant une salle). Au départ, le **Paquetage** emporte **1 pièce** consignée (3 au plus après revendications) ; il n'est jamais perdu.

**Garde-fou principal** : un objet du Vestiaire garde ses affixes et son pouvoir, mais son niveau est plafonné par la salle : `ilvl_effectif = min(ilvl, r + 3)`. Le Vestiaire transporte un **build**, pas des chiffres.

### 9 bis.2 Emplacements (6, tous visibles en 3D)
| Emplacement | Rôle | Implicite (palier I / II / III) |
|---|---|---|
| **Outil** (arme) | Moveset, dégâts de base | *Calibre* : dégâts de base ×(1 + 0,012 × (ilvl − 1)), soit ×1,00 à ×1,35 |
| **Casque** | Dégâts subis, Burnout, halo de Nuit | Chantier : dégâts subis −3 / −5 / −7 % · Antibruit · Lampe frontale |
| **Gilet haute visibilité** | Énergie max, Burnout | Classe 2 : +5 / +10 / +15 Énergie max · Signaleur · Parka de nuit |
| **Gants** | Vitesse d'attaque, critique, électricité | Manutention : vitesse d'attaque +3 / +5 / +7 % · Isolants · Mitaines de quai |
| **Chaussures de sécurité** | Vitesse, dash | Coquées : vitesse +3 / +5 / +7 % · Bottes de voie · Baskets de sécurité |
| **Insigne** | Sifflet, Café, familles d'Avantages | Badge syndical : Mobilisation +5 / +8 / +12 % · Sifflet en laiton · Thermos cabossé · Montre de service |

L'**écharpe syndicale rouge** n'est jamais masquée. Les **Souvenirs** restent à part (ils viennent des collègues et ne se lootent pas).

### 9 bis.3 Raretés
| Rareté | Couleur (faisceau et nom) | Affixes aléatoires | Matériau 3D | Poids de base (ennemi) |
|---|---|---|---|---|
| **Réforme** | Gris acier `#8A929A` | 1 | Usé, rayé | 60 |
| **Réglementaire** | Blanc cassé `#F2EEE3` | 2 | Propre, neuf | 30 |
| **Homologué** | Bleu signal `#3F8CFF` | 3 | Liserés bleus, tampon « HOMOLOGUÉ » | 8,5 |
| **Hors-série** | Violet `#A86BFF` (émissif, pulsé) | 4 | Coutures émissives | 1,3 |
| **Patrimoine** (légendaire) | Cuivre `#FF8C2B`, reflets or | 3 + **pouvoir légendaire** fixe | Laiton et cuivre gravés, poussière dorée | 0,2 |

Aucune rareté n'utilise le magenta (danger), le turquoise (ennemis) ni le jaune `#FFD23F` (danger en palette daltonisme). Le violet Hors-série est clair et émissif, à distinguer du violet Privatix désaturé. Patrimoine plafonné à **6 % par objet** (hors garanties et pitié).

### 9 bis.4 Affixes, légendaires, Outils
- **34 affixes** (16 préfixes, 18 suffixes) en **3 paliers** liés aux biomes : I (ilvl 1–9), II (10–18), III (19–30). Valeur = `lerp(min, max, q)` ; c'est la qualité `q ∈ [0, 1]` qui est sauvegardée, pas la valeur. MVP du loot : **20 affixes**.
- **13 Patrimoines**, chacun avec une contrepartie lisible (aucun « +X % » brut) : L1 à L11 de la proposition, **L12 « Boule à facettes de poche »** (Discosaure) et **L13 « Ruban inaugural »** (Boss 2, ex-« Nœud papillon de cérémonie » de la proposition). Premier drop : le **Plan** est archivé chez Béné (PACO).
- **4 Attelages** (sets de 3 ou 4 pièces Hors-série).
- **6 types d'Outil**, mêmes primitives de touche (arcs, rectangles orientés, cercles) et règles du § 5.3 : Clé à tire-fond (51 DPS, référence, au départ), Masse de voie (52), Pied-de-biche (≈ 49), Lanterne de signalisation (44, finisher à 112 px), Pelle à ballast (44, foules), Perche isolante (44,5, allonge, v2). DPS de base visé : 44 à 52.

### 9 bis.5 Sources et volume
`ilvl = clamp(r + B_source + B_roulement, 1, 30)` avec `B_source` = 0 (ennemi, caisse), +1 (Dotation, casier), +2 (élite, Salle gardée), +3 (boss) et `B_roulement` = 0 / +1 / +2 (Matin / Après-midi / Nuit).

| Source | Objets | Rareté minimale |
|---|---|---|
| Ennemi de base | Junior et Drone 3 %, Borne 5 %, Agent de sécurité 6 % | — |
| Caisse à outils (25 % des salles de combat, 3 coups) | 1 | — |
| Porte **Dotation** (§ 3.8) | 1 au choix parmi 2 | Réglementaire |
| Casier (salle Café / trésor, 3e option) | 1 | Réglementaire |
| Élite, Furet putride | 1, +25 % d'un second | Réglementaire |
| Salle gardée (Fluidifieur, Discosaure) | 2 | 1 Homologué au moins |
| Boss 1 / Boss 2 / final | 2 / 3 / 3 ; au 1er kill, 1 **Hors-série** garanti | Homologué |
| Friterie / Wagon-Bar | 1 à 140 Tickets / 1 Patrimoine à 300 | Homologué / Patrimoine |

**Volume visé** : ≈ **8 objets par biome** (6 à 10), ≈ 25 par Shift complet. **Protection contre la malchance** : sac mélangé des 6 emplacements (sans remise), « Réclamation » (après 5 objets sous Homologué, le suivant est Homologué au moins), ancienneté du butin méta (+0,15 pt de Patrimoine par objet, plafond +8, remise à 0 au drop), Patrimoine garanti au 3e kill du Boss 1 si aucun n'est encore tombé. Premier Patrimoine attendu vers la **4e à 6e run**. Un Shift à graine saisie gèle la pitié méta.

### 9 bis.6 Lecture et inventaire
- **Au sol** : faisceau vertical coloré par rareté (Réglementaire 24 px, Homologué 48, Hors-série 72 et pulsé, Patrimoine 128 avec carillon cuivré et mini slow-mo de 150 ms, coupé en « Réduction des mouvements »). Les objets **ne se ramassent pas pendant le combat**.
- **Comparaison sans menu** à ≤ 24 px : lignes ▲ / ▼ / = et deux résumés, « **Frappe** ≈ +x % » et « **Tenue** ≈ ±x % ».
- **Actions** : Équiper (E / A), Mettre au sac (maintien E / X, 400 ms), Démonter (maintien F / Y, 500 ms). **Sac de 4 cases**. Écran « Tenue » (Tab) éditable hors combat seulement.

### 9 bis.7 Hub : qui gère quoi
| Pupitre / lieu | PNJ | Service loot |
|---|---|---|
| **DPD** — casiers et mannequin de la Cour intérieure | **Josiane** | **Vestiaire** (24 casiers, +12 par rang), mannequin qui porte le Paquetage en 3D, choix du **Paquetage** et de l'Outil de départ, écran de **consigne**, **réforme** (démontage en Ferraille), **polissage** (`q` +0,10 : 8 Ferraille), **remise à niveau** (plafond d'ilvl +3 : 15 Ferraille + 1 par niveau), **Dotations d'outil** (§ 10.4), conversion **Ferraille → Pièces** sur bon de réforme (25 → 1, une fois par Shift) |
| **PACO** | **Béné** | **Relances** : réaffûtage d'un affixe (choix parmi 3 tirages : 12 Ferraille, +6 par relance déjà faite sur l'objet) ; archives des **Plans** de Patrimoine (codex) |
| **RTS** | Yasmina, Kevin | **Rien sur l'équipement** : le RTS ne gère que le matériel roulant (Kevin fournit les Pièces récupérées sur le matériel réformé et tient les échanges de matériel, § 10.4) |
| **TLI & AIT** | Rudy | Annonce des drops Patrimoine, ligne « Dernier objet trouvé » sur l'écran des départs (narratif) |

### 9 bis.8 Budget de puissance et garde-fous
La cible du § 3.7 (≈ ×3 de DPS en fin de Shift, TTK de 2 à 3 coups) se répartit ainsi ; **le scaling des ennemis ne bouge pas**.

| Moment | Avantages + Réglages | Équipement | Produit |
|---|---|---|---|
| Boss 1 (r = 9) | ×1,35 | ×1,20 | ×1,62 |
| Boss 2 (r = 18) | ×1,65 | ×1,35 | ×2,23 |
| Fin de Shift (r = 27) | ×2,0 | ×1,45 | ×2,9 |

Garde-fous : ilvl effectif ; Paquetage limité ; « +% dégâts » de l'équipement dans le **même seau additif** que les Avantages et la méta ; **plafonds par stat** appliqués en dernier (dégâts subis −30 %, critique 50 %, vitesse d'attaque +25 %, vitesse +20 %, recharge du dash −35 %, Mobilisation +50 %, plancher de Burnout −40 %, Gobelet +15 Burnout au moins) ; paliers liés aux biomes, jamais au temps de jeu ; le Plan d'Économies donne de la rareté, jamais de l'ilvl ; la Ferraille n'achète que de la manipulation d'objets ; test de simulation en CI (meilleure tenue ≤ ×1,65). Le mode « Congé maladie » est indépendant de l'équipement.

### 9 bis.9 Renommages entraînés
« Réglage de clé » → **Réglage d'outil** (§ 9.4) · revendication « Chaussures de sécurité » → **Formation au déplacement d'urgence** (§ 10.2) · « Montages de clé » de Kevin → **Dotations d'outil** de la DPD (§ 10.4) · l'action « Lanterne » de l'annexe B devient l'Outil **Lanterne de signalisation**.

## 10. Méta-progression à l'OCC (gardée)
### 10.1 Monnaies et gains
| Source | PS | Grains | Pièces | Tasses |
|---|---|---|---|---|
| Salle de combat nettoyée | **3** | — | — | — |
| Salle Élite | **16** | 30 % : 1 | — | — |
| Salle gardée (Fluidifieur, Discosaure) | **20** | 2 | 1er kill : 1 | — |
| Récompense « Tract » / « Grains » | 8 | 3 | — | — |
| Consigne (Café / trésor) | — | 3 | — | — |
| Kill d'ennemi | — | 3 % : 1 | — | — |
| Boss 1 / 2 / final | **25 / 40 / 60** | 5 / 8 / 12 | 1er kill **3 / 4 / 5**, ensuite 1 / 1 / 2 | 1er kill : 1 |
| Shift tenu (« Fin de service ») | **+50** | Grains ×2 | — | — |
| Mort (« Prime d'ancienneté ») | **+2 par salle comptée** | — | — | — |
| Événements | 0 à 9 | 0 à 10 | — | Voyageur égaré : 1 |
| Multiplicateur | Roulement ×1 / ×1,15 / ×1,35 · Plan d'Économies +6 % par point | | | |

**Ferraille** (loot, § 9 bis) : démontage Réforme 1 · Réglementaire 3 · Homologué 6 · Hors-série 15 · Patrimoine 40, +floor(ilvl / 10). Gain attendu : 15 à 25 par run du MVP, 50 à 70 par Shift complet. Elle n'achète que de la manipulation d'objets (DPD, PACO) et ne se convertit qu'en Pièces, une fois par Shift.

**Ordres de grandeur (Matin, sans Plan)** : mort au Boss 1 **≈ 55 PS** ; mort au Boss 2 **≈ 145 PS** ; Shift complet **≈ 300 PS** (les Salles gardées remplacent l'élite garantie : +4 PS chacune). MVP (biome 1 seul) : défaite ≈ 55 PS, victoire sur le Boss 1 ≈ **130 PS**.

### 10.2 Tableau des revendications (Marcel, en PS)
| # | Branche | Revendication | Effet par rang | Rangs | Coûts (PS) | Total |
|---|---|---|---|---|---|---|
| 1 | Endurance | **Ancienneté** | +10 Énergie max | 3 | 30 / 60 / 120 | 210 |
| 2 | Endurance | **Thermos personnel** | +1 Gobelet au départ (plafond 4) | 2 | 50 / 150 | 200 |
| 3 | Endurance | **Comité d'hygiène** | Gobelet : soin +5 pts (30 → 35 → 40 %) | 2 | 80 / 180 | 260 |
| 4 | Endurance | **Local syndical** | Récupération passive du Burnout +0,5/s | 2 | 70 / 160 | 230 |
| 5 | Endurance | **Mutuelle** (« Ne laisse personne sur le quai ») | À 0 Énergie, on se relève avec 40 % (rang 2 : 60 %), 1 fois par Shift | 2 | 150 / 400 | 550 |
| 6 | Métier | **Clé chromée** | +5 % de dégâts de base | 4 | 50 / 100 / 150 / 250 | 550 |
| 7 | Métier | **Formation sécurité** | +3 pts de critique | 3 | 40 / 80 / 160 | 280 |
| 8 | Métier | **Sifflet réglementaire** | +25 Mobilisation au début de chaque biome | 2 | 60 / 140 | 200 |
| 9 | Métier | **Formation au déplacement d'urgence** (ex-« Chaussures de sécurité », renommée pour l'emplacement d'équipement) | +1 charge de dash | 1 | 200 | 200 |
| 10 | Solidarité | **Formation continue** | +1 **Recours** (relance des portes ou d'un choix d'Avantage) par Shift | 3 | 40 / 90 / 180 | 310 |
| 11 | Solidarité | **Délégué de terrain** | +5 pts de rareté (pris sur Standard) | 3 | 60 / 120 / 240 | 420 |
| 12 | Solidarité | **Caisse de grève** | +40 Tickets au départ | 3 | 40 / 80 / 160 | 280 |
| 13 | Solidarité | **Radio de service** | La 1re porte d'Avantage de chaque biome laisse choisir la famille | 1 | 120 | 120 |
| 14 | Solidarité | **Pétition** | Choix d'Avantage de 3 → **4** options | 1 | 300 | 300 |
| 15 | Vestiaire (loot) | **Casier personnel** | +12 casiers au Vestiaire | 2 | 100 / 200 | 300 |
| 16 | Vestiaire (loot) | **Paquetage** | +1 pièce de Paquetage (1 → 3) | 2 | 150 / 350 | 500 |
| 17 | Vestiaire (loot) | **Consigne élargie** | +1 objet ramené en fin de Shift | 1 | 250 | 250 |
| | | | | | **Total** | **5 160 PS** (4 110 sans le loot) |

Pré-requis : un rang de la branche ouvre la ligne suivante de la même branche ; la Mutuelle, la Pétition et la Consigne élargie demandent **3 kills du Boss 1**. Réinitialisation gratuite chez Fatou.
**Temps pour tout débloquer** : moyenne de carrière ≈ 110 PS par Shift → **≈ 37 Shifts (35 à 45)** sans le loot, **≈ 47 Shifts** avec la branche Vestiaire, soit **10 à 17 h** de jeu.

### 10.3 La Vieille Dame : Tasses de Relève (en Grains)
Une Tasse de Relève est choisie avant chaque Shift (buff de départ).

| Tasse | Déblocage | Rang 1 | Rang 2 (20 Grains) | Rang 3 (45 Grains) |
|---|---|---|---|---|
| **Expresso** | Départ | +6 % de dégâts | +9 % | +12 % |
| **Café long** | Départ | +10 Énergie max | +15 | +20 |
| **Ristretto** | 15 Grains | +5 % de vitesse, recharge du dash −10 % | +8 %, −15 % | +10 %, −20 % |
| **Cappuccino** | 25 Grains | +1 Gobelet au départ | + soin du Gobelet +5 pts | + soin +10 pts |
| **Café de nuit** | 40 Grains | +1 Avantage Standard au départ, **Burnout de départ +15** | Ancienneté, +10 | Statutaire, +5 |
| *Double Expresso* (Jean-Mi, tant qu'il est là) | Gratuit | +12 % de dégâts et +10 Burnout de départ | — | — |

Total Tasses : **405 Grains** (≈ 12 Grains par Shift en moyenne → **≈ 30 Shifts**). Les **rénovations de l'OCC** (Fantôme, v2) coûtent 15 à 80 Grains (≈ 300 au total).

### 10.4 DPD de Josiane : Dotations d'outil (en Pièces ; ex-« Montages de clé » du RTS)
Le **RTS ne gère que le matériel roulant** : Kevin récupère les **Pièces détachées** sur le matériel roulant réformé et tient les **échanges de matériel** (Grains ↔ PS ↔ Pièces, taux 3:1), mais il ne touche plus à l'équipement du héros. L'équipement personnel, outil compris, relève de la **DPD** (Josiane), qui gère la dotation des agents. Une Dotation d'outil **ajoute un type ou une base d'Outil au pool de loot** et au choix d'Outil de départ : c'est une progression **horizontale** (de nouvelles façons de jouer, pas des chiffres).

| Dotation d'outil | Déblocage | Ce qu'elle ajoute (détail : § 9 bis et proposition §4) |
|---|---|---|
| **Clé à tire-fond** (du grand-père) | Départ | Combo 12 / 12 / 30 (référence, 51 DPS) ; le coup 3 détruit les projectiles |
| **Masse de voie** | 1er kill Boss 1 + 2 Pièces | Combo 20 / 42, brise les postures (×1,5), pas d'interruption pendant l'active du coup 2 |
| **Clé à cliquet** (ex-« Clé recalibrée ») | 1er kill Boss 1 + 2 Pièces | Base de Clé à combo **rapide de 4 coups** 10 / 10 / 10 / 24, startups −20 %, arcs −4 px |
| **Pied-de-biche** | 3 Pièces | Combo 8 / 8 / 9 / 20, critique de base 12 %, le coup 4 ignore le blindage frontal |
| **Lanterne de signalisation** | 1er kill Boss 2 + 3 Pièces | Finisher en faisceau à 112 px qui éblouit ; halo de Nuit +60 px |
| **Clé de Relève** | 1er kill Boss 2 + 3 Pièces | Base de Clé dont le coup 3 pose une **flaque de café chaud** (24 px, 3 s) : ennemis 4 dégâts / 0,5 s, héros +1 Énergie / 0,5 s |
| **Pelle à ballast** | 4 Pièces | Balayages larges, gerbe de ballast qui ralentit ; meilleure contre les foules |
| **Perche isolante** (v2) | Quête de la DPD + 4 Pièces | Allonge de 72 px, finisher radial électrique |
| **Clé du Wagon-Bar** (secret) | Quête du Fantôme | Devient le **Patrimoine L2** : le startup du coup 1 est une parade de 200 ms qui renvoie les projectiles |

Total : **21 Pièces** (≈ 12 aux premiers kills, puis 1–2 par Shift victorieux au-delà du Boss 1, plus la conversion de Ferraille) → **≈ 15 à 20 Shifts**. Les anciens rangs 2 et 3 des Montages sont remplacés par l'équipement (affixes, Réglages d'outil).

### 10.5 Tasses et Souvenirs
Offrir une **Tasse** à un collègue fait monter la relation (3 niveaux). Niveau 1 : **Souvenir** (un équipé par Shift). Niveau 2 : scène personnelle. Niveau 3 : Motion commune ajoutée au pool + réplique de « serment ».

Souvenirs : **Thermos de Josiane** (Josiane) : +1 Gobelet · **Sifflet de Rudy** (Rudy) : Le 1er dash de chaque salle étourdit 0,8 s (rayon 32 px) · **Tampon « Numéro suivant »** (Béné) : Friterie −20 % · **Casque radio** (Yasmina) : Choix d'Avantages à 4 options · **Pince à caténaire** (Kevin) : +15 % de dégâts électriques · **Fiole de prévention** (Fatou) : Soin de 10 % à l'entrée de chaque biome · **Casquette de conducteur** (Marcel) : Avantages « D'antan » ×2 sur les portes · **Carte des vins de 1994** (Fantôme) : Wagon-Bar ×2 plus fréquent.

### 10.6 Plan d'Économies (difficulté optionnelle)
Débloqué après le **premier Shift tenu** (MVP : après la 1re victoire sur le Boss 1). Chaque rang ajoute des **points** ; chaque point donne **+6 % de PS**. Primes cosmétiques à 8, 16 et 24 points.

| Clause | Effet par rang | Rangs | Points / rang |
|---|---|---|---|
| **Effectif réduit** | Budget de menace +15 % | 3 | 1 |
| **Externalisation** | PV ennemis +15 % | 3 | 1 |
| **Objectifs trimestriels** | Dégâts ennemis +10 % | 3 | 1 |
| **Consultants seniors** | Élites : +1 affixe Certifié | 2 | 2 |
| **Gobelet consigné** | −1 Gobelet au départ | 2 | 1 |
| **Ponctualité exigée** | Chrono par biome 12 / 10 / 8 min ; dépassé : Burnout bloqué au palier « Au bord » au minimum | 3 | 1 |
| **Réduction de la prime de nuit** | Plancher de Burnout ×1,25 par rang | 2 | 2 |
| **Éclairage basse consommation** | Halo de 200 px dans tous les roulements | 1 | 2 |
| **Open space** | Salles 15 % plus petites | 1 | 1 |
| **Suppression des pauses** | La Salle des pauses devient un Combat | 1 | 3 |
| | | **Maximum** | **28 points (+168 % de PS)** |

## 11. Hub OCC (vue gameplay)
L'OCC est le **centre opérationnel** de la gare (LORE §3), au rez-de-chaussée arrière du BAG. Le hub, explorable à pied avec les contrôles de combat actifs (pas de dégâts), comprend **cinq lieux** : le **sas** (arrivée, distributeur pivotant), la **salle de repos de nuit**, la **salle des opérations** (rangée de pupitres face au mur d'écrans, coin café de la Vieille Dame), la **Salle photocopieuse** et la **Cour intérieure** (départ du Shift). Chaque service est rattaché au pupitre d'une fonction réelle du centre opérationnel.

**La Cour intérieure** (référence : photos du lieu réel) : cour pavée en U, avec de la mousse entre les pavés et de vieilles traces de peinture rouge et bleue au sol ; bâtiments de cinq étages en brique jaune, style années 50, sur un soubassement gris strié de coulures ; une cage d'escalier vitrée (l'escalier condamné vers les étages Privatix) ; climatiseurs en façade, une gaine de ventilation, des palettes, de petits panneaux bleus sur piquets et deux voitures de service garées ; ciel gris. Dans un angle, le **coin poubelles** : pignon de brique sombre au toit bâché déchiré, six conteneurs verts à couvercle jaune qui débordent, un tas de sacs bleus : c'est l'antre du **Furet putride**. Le côté ouvert de la cour mène au couloir technique et au Shift.

En 3D (DA § 2.11), la salle des opérations se lit comme une **salle de supervision** : pénombre bleu ardoise, **mur synoptique** émissif cyan et vert (voies, cantons, trains en temps réel ; le dernier train « supprimé » rappelle la cause de la mort), pupitres à îlots de lumière tungstène. Chaque PNJ est signalé par une flaque de lumière chaude ; l'icône d'interaction est un décalque au sol **blanc et or**, jamais magenta. Caméra du hub à 20 m.

| Lieu | Pupitre / station | PNJ | Service | Disponible |
|---|---|---|---|---|
| Salle Photocopieuse | Tableau des revendications | Marcel (**Permanence conduite**) | Achats en PS (§10.2), « Cahier de revendications » de la vraie fin | Départ (**MVP**) |
| Salle des opérations | Coin café | Vieille Dame + Jean-Mi (puis Fatou) | Tasse de Relève (§10.3) | Départ (**MVP** : Expresso, Café long) |
| Salle des opérations | **TLI & AIT** + écran des départs | Rudy | Annonce du Shift, statistiques, historique des Shifts « comme des trains » | Départ (**MVP**) |
| Salle de repos de nuit | **RCCA** | Fatou | Réapparition, soins, réinitialisation gratuite du Tableau | 2e Shift (v1) |
| Salle des opérations | **RTS** (matériel roulant) | Kevin | **Matériel roulant uniquement** : échanges de matériel Grains ↔ PS ↔ Pièces (taux 3:1), source des Pièces (matériel réformé). Aucun service d'équipement | 1er kill Boss 1 (v1) |
| Salle des opérations | **RTS** (régulation) | Yasmina | Roulement imposé, Plan d'Économies, défis | 1er kill Boss 1 (**MVP** pour le Plan après victoire) |
| Salle des opérations | **PACO** | Béné | Recours (« bus de remplacement »), **relances d'équipement** (réaffûtage d'un affixe, § 9 bis.7), correspondance directe vers le biome 2 (raccourci, après le 1er kill du Boss 2), archives (Preuves, Notes, **Plans de Patrimoine**, codex « Le Règlement ») | 3e Shift (v1) |
| Cour intérieure | **DPD** : casiers + mannequins | Josiane | **Vestiaire** (casiers, Paquetage, Outil de départ, consigne, réforme en Ferraille, polissage, remise à niveau, conversion Ferraille → Pièces), **Dotations d'outil** (§ 10.4), mannequin de formation (DPS affiché, essai des Outils), Souvenirs contre Tasses | Départ (Vestiaire : avec le lot Loot 1) |
| Cour intérieure | Coin des palettes (wagon-bar reconstitué) | Fantôme | Rénovations, marchand légendaire | Quête (v2) |
| Cour intérieure | Coin poubelles (antre du Furet) | Furet putride | Rencontre optionnelle (couvercle qui bouge) : combat sans Mise à pied, gains de Grains et objets **Réforme** « retrouvés dans les poubelles du BAG » (LORE §6.8) | Après le 1er kill du Boss 1 (v1) |

**Déroulé entre deux runs** : (1) réapparition dans la salle de repos de nuit, écran de gains (la consigne a été faite à l'écran de résultats) ; (2) au plus **1 réplique avec bulle par PNJ**, choisie dans l'ordre Essentielle > Réactive (dernier run : lieu de la mort, tueur, boss) > Relation > Remplissage, jamais rejouée ; (3) dépenses libres ; (4) Tableau des roulements ; (5) Cour intérieure puis couloir technique. Temps cible entre deux runs : **< 90 s** pour un joueur pressé (toutes les stations sont à moins de 6 s de marche de la sortie de la Cour).

## 12. Accessibilité et options
| Option | Valeurs | Défaut |
|---|---|---|
| **Intensité du screenshake** | 0 à 100 % (pas de 25) ; 0 % coupe aussi le zoom punch | 100 % |
| **Flashs** | Normaux / Atténués (flash blanc → contour, plein écran désactivé) | Normaux |
| **Hitstop** | 100 % / 50 % | 100 % |
| **Aide à la visée** (manette, tactile) | Désactivée / Légère (±20°, 120 px) / Forte (±45°, 160 px) | Légère |
| **Attaque automatique** | Maintien = combo en boucle (tous supports) | Activée |
| **Préavis en bascule** | Le maintien de 600 ms devient deux appuis | Désactivé |
| **Mode « Congé maladie »** (assisté) | Résistance aux dégâts **+20 %**, puis **+2 % par mort** (max **80 %**) ; mention discrète sur l'écran de résultats, aucune pénalité de progression | Désactivé |
| **Temps partiel thérapeutique** | Vitesse globale du jeu 100 / 90 / 80 / 70 % | 100 % |
| **Télégraphes renforcés** | Contour épaissi de 1 → 2 px + motif hachuré (daltonisme) | Désactivé |
| **Palette daltonisme** | Magenta des dangers remplaçable par jaune `#FFD23F` ou blanc | Magenta |
| **Nombres de dégâts** | Tous / Critiques seulement / Aucun | Tous |
| **Sous-titres des annonces et répliques** | Taille 8 / 12 / 16 px, fond opaque | 8 px, fond |
| **Réassignation** | Toutes les actions, clavier, souris et manette ; boutons tactiles déplaçables | — |
| **Pause automatique** | Sur perte de focus (onglet, appel) | Activée |
| **Réduction des mouvements** | **Coupe toutes les lumières clignotantes** : boule à facettes du Discosaure (les Facettes deviennent des taches fixes au contour régulier, les éclats ne balaient plus), lasers (lignes fixes qui tournent, sans stroboscope), stroboscopes, néons qui grésillent, gyrophares de l'arène, scintillements (faisceaux de loot sans pulsation, étincelles des caténaires adoucies). **Réduit les tremblements** : screenshake plafonné à 25 %, roulis de caméra et zoom punch coupés, tremblement du mesh au hitstop supprimé. Supprime aussi rémanences, slow-mo (dont le mini slow-mo des Patrimoines) et parallaxe. Les télégraphes gardent leur remplissage (information de jeu), sans pulsation. | **Suit `prefers-reduced-motion`** : activée d'office si le système la demande, modifiable ensuite |

## 13. Périmètre et critères d'acceptation
### 13.1 Périmètre par version
| Contenu | **MVP** (première version jouable) | **v1** | **v2** |
|---|---|---|---|
| Rendu | 3D toon Three.js (migration en cours, `prototypes/proto3d`) ; le jeu Phaser reste jouable en sursis jusqu'à la bascule | — | — |
| Biomes | **Biome 1 complet** : 8 salles générées + Salle des pauses + Boss 1 ; ≥ **10 gabarits** ASCII (6 Combat/Élite, 1 Café, 1 Boutique, 1 Événement, 1 Repos) + arène | Biome 2 + Salle gardée du Fluidifieur + **Boss 2 L'Invité d'honneur** (obligatoire), gabarits Tiled | Biome 3 + Salle gardée du Discosaure + boss final, vraie fin, mode Plan Horizon 2040 |
| Actions | Frappe, Dash (+ dash-attaque, dash parfait), Sifflet / Préavis, Café | Anim `drink` | Serrage lourd, Lanterne, Appel radio |
| Ennemis | Consultant Junior, Borne Automatique, Drone Optimètre, Manager KPI | Agent de sécurité, Pense-bête, Coach Agile, Certifiés, **Furet putride**, **le Fluidifieur** (élite majeur) | Hôtesse holographique, **Discosaure** |
| Loot | **Loot 1** : 6 emplacements (1 base chacun), Clé, Masse, Pied-de-biche, 5 raretés, 20 affixes, 4 Patrimoines (L1, L6, L8, L10), sac de 4, carte de comparaison, consigne de 1, Vestiaire de 24, Ferraille, porte Dotation | **Loot 2** : 3 bases par emplacement, Lanterne, Pelle, 34 affixes, Patrimoines L2 à L5, L7, L9, L11, L13, Attelages, polissage, remise à niveau, relances, « Objets trouvés », revendications du Vestiaire | **Loot 3** : Perche isolante, Attelage de caténaire, L12, Wagon-Bar Patrimoine, codex complet |
| Run | 7 familles × 3 Avantages, 3 raretés + Acquis historique (1), 5 Réglages, Friterie, 3 événements, Gobelets, Tickets | Motions communes, Wagon-Bar, 7 événements | — |
| Méta | Hub minimal : Marcel (Tableau, entrées 1, 2, 6, 7, 9, 12), Vieille Dame (Expresso, Café long), Rudy (stats), Josiane (Vestiaire, avec Loot 1), Plan d'Économies (3 clauses) après la 1re victoire ; sauvegarde locale | Tableau complet, 5 Tasses, Dotations d'outil, Souvenirs, Béné, Fatou, Yasmina, Kevin | Rénovations, Fantôme, quêtes, 250 répliques |
| Roulements | Matin seulement | Matin / Après-midi / Nuit | — |
| Fin du MVP | Boss 1 vaincu = « Shift tenu (version démo) » : +50 PS, Preuve n° 1 archivée, retour à l'OCC | | |

### 13.2 Critères d'acceptation du MVP (testables)
**Combat (Vitest + vérification manuelle à 0,25×)**
1. Le combo 1→2→3 inflige **12 / 12 / 30** (sans modificateur) ; le coup 2 ne part pas avant **80 ms** de recovery du coup 1 ; après **150 ms** de recovery terminée sans input, le combo repart au coup 1.
2. Un dash pressé pendant l'**active** n'est pas exécuté avant la fin de l'active ; pendant le startup du coup 3 il l'est jusqu'à **120 ms**, plus après.
3. Le dash parcourt **72 ± 1 px** en **140 ms** ; un projectile qui touche le héros entre 0 et 120 ms n'inflige aucun dégât ; à 130 ms il en inflige.
4. Deux dashs consécutifs vident les charges ; la 1re charge revient **750 ms** après la fin du 2e dash.
5. Un dash parfait (hitbox chevauchante dans les 80 premières ms) donne **−6 Burnout, +5 Mobilisation, +0,5 charge** et affiche « +15 min ».
6. Sifflet impossible sous **50** de Mobilisation ; il retire 50, touche tout dans **72 px**, étourdit **1,2 s** ; maintien ≥ **600 ms** à 100 : Préavis (rayon 120, 60 dégâts).
7. Un Gobelet à 100 Énergie max soigne **30** (Frais), **22,5** (Au bord), **15** (Au bout du rouleau) et ajoute **+20** Burnout ; refusé en Pétage de plombs.
8. Burnout à 100 : Pétage de **8 s** ; à la fin, Burnout = **max(plancher, 30)** et Énergie max **−8** (jamais < 50).
9. Plancher : à r = 9 (Boss 1, Matin), le Burnout ne descend pas sous **12**.
10. Dégâts d'un Junior à r = 1 : **8** ; à r = 8 : **11** ; PV à r = 8 : **47** (arrondi au plus proche).

**Génération (Vitest, 500 graines)**
11. Même graine → même biome (types, récompenses, gabarits, vagues).
12. Exactement **8** salles avant le Repos, puis Repos, puis Boss ; **1** boutique (position 3–6) ; ≥ 1 Élite en 5–7 ; jamais 2 Élites consécutives ; ≥ 1 Café/trésor et ≥ 1 Événement atteignables sur **tout** chemin.
13. Deux portes sœurs n'annoncent jamais la même récompense (sauf pool épuisé) ; la récompense obtenue est **celle annoncée**.
14. Aucune apparition à moins de **96 px** du héros ou de la porte ; jamais plus de **24** ennemis vivants.

**Jeu complet (navigateur)**
15. Un Shift MVP complet se joue de bout en bout (OCC → 8 salles → Repos → Boss 1 → Résultats → OCC) sans erreur console, en **9 à 15 min** pour un testeur moyen.
16. À la mort, les PS gagnés + **2 par salle** sont crédités, Tickets/Avantages/Gobelets perdus ; la sauvegarde survit à un rechargement.
17. **60 fps** stables avec 24 ennemis + 64 projectiles sur Android milieu de gamme ; compteurs (corps, écouteurs, objets) **stables après 30 transitions de salle** et 3 Shifts consécutifs.
18. Jouable intégralement au **clavier/souris**, à la **manette** et au **tactile** paysage ; ZQSD fonctionne sur AZERTY sans réglage.
19. Toutes les attaques ennemies ont un télégraphe **magenta** d'au moins **400 ms** (élite 700, boss 800), vérifié par une table de données testée.
20. Options du §12 « screenshake 0 % », « Congé maladie », « Attaque automatique » et « **Réduction des mouvements** » opérationnelles ; avec `prefers-reduced-motion: reduce`, la Réduction des mouvements est active au premier lancement et aucun élément ne clignote à plus de 3 Hz.

## 14. Annexe A : constantes d'équilibrage (`src/config/balance.ts`)
Durées en ms, distances en px logiques, vitesses en px/s, pourcentages en fractions (0,10 = +10 %).

```ts
export const BALANCE = {
  player: {
    energyMax: 100, energyMaxFloor: 50, speed: 150, accel: 1800, decel: 2400,
    hurtRadius: 8, hurtOffsetY: 12, iframesOnHitMs: 600, hurtMs: 240, knockbackTakenPx: 24,
    critChance: 0.05, critMult: 1.75, ballastSlow: 0.15, trainDamagePct: 0.4, voidDamagePct: 0.1,
  },
  input: { bufferMs: 150, gamepadDeadzone: 0.2, aimStickThreshold: 0.35, aimAssistDeg: 20, aimAssistRangePx: 120, touchAutoAimDeg: 60, touchAutoAimRangePx: 140 },
  strike: {
    chainPointMs: 80, comboResetMs: 150, moveFactor: 0.25, coup3CancelableStartupMs: 120, originOffsetY: 10,
    multiTargetHitstopMs: 10, multiTargetHitstopCapMs: 30, wallSlamSpeed: 150, wallSlamDamage: 5, wallSlamStunMs: 300, minDamage: 1,
    hits: [
      { id: 'serrage', startupMs: 90, activeMs: 60, recoveryMs: 160, shape: 'arc', radius: 38, arcDeg: 100, damage: 12, knockbackPx: 18, knockbackMs: 100, hitstopMs: 50, stepPx: 6, stunMs: 0 },
      { id: 'desserrage', startupMs: 80, activeMs: 60, recoveryMs: 170, shape: 'arc', radius: 40, arcDeg: 120, damage: 12, knockbackPx: 18, knockbackMs: 100, hitstopMs: 50, stepPx: 6, stunMs: 0 },
      { id: 'tire-fond', startupMs: 200, activeMs: 80, recoveryMs: 320, shape: 'rect', rectW: 56, rectH: 28, rectStartPx: 8, impactRadius: 20, impactOffsetPx: 56, damage: 30, knockbackPx: 64, knockbackMs: 160, hitstopMs: 110, stepPx: 12, stunMs: 250 },
    ],
  },
  dash: {
    distancePx: 72, durationMs: 140, iframesMs: 120, charges: 2, rechargeMs: 750, minIntervalMs: 200, gapCrossPx: 64, burnout: 2,
    attack: { windowMs: 120, rectW: 64, rectH: 20, startupMs: 60, activeMs: 80, recoveryMs: 200, damage: 18, knockbackPx: 30, hitstopMs: 60, resumeCombo: 2 },
    perfect: { windowMs: 80, timeScale: 0.6, slowMs: 200, chargeRefund: 0.5, burnout: -6, mobilisation: 5 },
    ledMinutes: 5, ledMinutesPerfect: 15,
  },
  whistle: {
    mobilisationMax: 100, gainPerDamage: 0.25, gainKill: 6, gainEliteKill: 20, gainHitTaken: 10, gainPerfectDash: 5, cooldownMs: 4000,
    sifflet: { cost: 50, startupMs: 150, activeMs: 100, recoveryMs: 250, radius: 72, damage: 25, stunMs: 1200, eliteStunMs: 400, knockbackPx: 40 },
    preavis: { cost: 100, holdMs: 600, holdSpeedFactor: 0.5, activeMs: 120, recoveryMs: 400, radius: 120, damage: 60, stunMs: 2500, eliteStunMs: 800, knockbackPx: 64, piquetMs: 4000, piquetDamageTaken: 0.15 },
  },
  coffee: { startCups: 2, maxCups: 4, drinkMs: 600, sipAtMs: 400, moveFactor: 0.5, healPct: 0.3, burnout: 20, caffeineMs: 6000, caffeineAttackSpeed: 0.15 },
  burnout: {
    max: 100, perDamageTaken: 0.6, perDash: 2, perCup: 20, passiveDecayPerS: 3, passiveDelayMs: 3000,
    perKill: -1, perEliteKill: -10, perRoomCleared: -10, restRoom: -50, marcelBench: -20,
    floorPerHour: 3, nightFloorMult: 1.5, hoursPerRoom: 0.5,
    tiers: [
      { id: 'frais', min: 0, damage: 0, speed: 0, crit: 0, damageTaken: 0, cupHeal: 1 },
      { id: 'sous-pression', min: 30, damage: 0.1, speed: 0.05, crit: 0, damageTaken: 0, cupHeal: 1 },
      { id: 'au-bord', min: 60, damage: 0.25, speed: 0.1, crit: 0.1, damageTaken: 0.15, cupHeal: 0.75 },
      { id: 'bout-du-rouleau', min: 90, damage: 0.35, speed: 0.1, crit: 0.15, damageTaken: 0.25, cupHeal: 0.5 },
    ],
    meltdown: { durationMs: 8000, damage: 0.5, attackSpeed: 0.25, dashRechargeMult: 2, stunMs: 150, damageTaken: 0.5, resetMin: 30, maxEnergyPenalty: 8 },
  },
  enemies: {
    common: { spawnTelegraphMs: 600, spawnIdleMs: 400, spawnMinDistPx: 96, spawnStaggerMs: 150, separationAccel: 200, meleeTokens: 2, rangedTokens: 2, poiseRegenMs: 2000, staggerMs: 220, minTelegraphMs: 400, eliteMinTelegraphMs: 700, bossMinTelegraphMs: 800 },
    consultant: { hp: 30, poise: 10, speed: 85, strafeSpeed: 60, mass: 1, hurtRadius: 8, aggroPx: 220, aggroAllAfterMs: 2000, cost: 1, tickets: 2,
      diaporama: { rangePx: 32, telegraphMs: 450, arcDeg: 90, reachPx: 28, damage: 8, knockbackPx: 24, recoveryMs: 600 },
      quickWin: { minPx: 64, maxPx: 120, telegraphMs: 450, distancePx: 96, durationMs: 240, widthPx: 16, damage: 10, recoveryMs: 800, recoveryDamageTaken: 0.25, cooldownMs: 4000 } },
    borne: { hp: 50, speed: 0, retreatSpeed: 30, retreatPx: 32, mass: 0, hurtRadius: 10, frontArmor: 0.5, backMult: 2, cost: 2, maxPerWave: 3, minRoom: 2, tickets: 4, deployMs: 800, turnDegPerS: 90,
      salve: { telegraphMs: 500, count: 3, spreadDeg: 15, speed: 140, lifeMs: 2500, hitbox: 6, damage: 7, reloadMs: 1200, periodMs: 2200 },
      laser: { minRoom: 6, telegraphMs: 800, durationMs: 1500, widthPx: 6, turnDegPerS: 20, damage: 10, cooldownMs: 8000 },
      outOfOrderMs: 2000 },
    drone: { hp: 15, poise: 5, speed: 110, mass: 0.6, hurtRadius: 7, orbitPx: 96, cost: 1.5, tickets: 2,
      scan: { coneDeg: 60, rangePx: 128, sweepMs: 1000, markAfterMs: 300, markMs: 5000, markDamageTaken: 0.25, cooldownMs: 7000 },
      shot: { telegraphMs: 400, speed: 180, hitbox: 4, damage: 5, periodMs: 2400 },
      dive: { telegraphMs: 480, distancePx: 120, durationMs: 300, damage: 9, groundedMs: 700, groundedDamageTaken: 0.5 },
      fleeBelowPx: 48, fleeSpeed: 150, fleeMs: 600, whistleGroundedMs: 1200 },
    managerKpi: { hp: 220, speed: 60, mass: 0.5, hurtRadius: 13, cost: 8, tickets: 15, keepDistance: [120, 180],
      posture: { breakDamage: 50, windowMs: 3000, stunMs: 1500, stunDamageTaken: 0.25, reformMs: 6000 },
      tablet: { rangePx: 36, telegraphMs: 700, arcDeg: 120, reachPx: 40, damage: 12, knockbackPx: 40, cooldownMs: 2000 },
      alignment: { telegraphMs: 1000, radiusPx: 96, shieldReduction: 0.5, shieldMs: 4000, periodMs: 12000, interruptStunMs: 800 },
      stopwatch: { telegraphMs: 800, radiusPx: 32, slow: 0.4, zoneMs: 3000, damage: 4, periodMs: 5000 },
      reporting: { telegraphMs: 1200, maxRadiusPx: 160, expandMs: 800, thicknessPx: 12, damage: 14, periodMs: 20000, firstAtMs: 8000 } },
    auditeur: { hp: 1400, hurtRadius: 28, speeds: [50, 60, 75], patternGapMs: [1600, 1300, 1100], phaseThresholds: [0.6, 0.25], phaseTransitionMs: 1200, p3SpeedMult: 1.2,
      sweep: { telegraphMs: 900, arcDeg: 180, radiusPx: 88, damage: 16, knockbackPx: 48, recoveryMs: 500 },
      stopwatch: { count: 3, telegraphMs: 800, gapMs: 400, radiusPx: 32, damage: 6, periodMs: 9000 },
      bars: { telegraphMs: 1000, lines: 3, spreadDeg: 25, lengthPx: 300, travelMs: 600, widthPx: 16, damage: 14, periodMs: 7000 },
      shield: { atHpPct: [0.8, 0.65], maxMs: 8000, cartSpeed: 300, trainRangePx: 48, brokenStunMs: 3000, brokenDamageTaken: 0.25, expireHealPct: 0.03 },
      trains: { telegraphMs: 3000, hornAtMs: 1200, playerDamagePct: 0.4, bossDamage: 150, periodMsP2: 14000, periodMsP3: 10000, ambientPeriodMsP1: 20000 },
      barrage: { telegraphMs: 800, cycles: 4, count: 5, spreadDeg: 40, speed: 150, damage: 7, periodMs: 8000 },
      reinforcements: { count: 2, maxAlive: 4, periodMs: 25000, room: 9 },
      bigReporting: { telegraphMs: 1200, maxRadiusPx: 280, expandMs: 1200, thicknessPx: 16, damage: 18, periodMs: 18000 },
      stamp: { telegraphMs: 1100, lockMs: 300, radiusPx: 48, damage: 22, waveRadiusPx: 96, waveDamage: 10, periodMs: 6000 },
      kpiLines: { telegraphMs: 700, distancePx: 300, durationMs: 500, damage: 16, trailMs: 3000, trailTickMs: 500, trailDamage: 6, periodMs: 8000 } },
  },
  scaling: {
    hpPerRoom: 0.08, damagePerRoom: 0.05, speedPerRoom: 0.01, speedCap: 1.15, roomsCounted: 28,
    budgetBase: 6, budgetPerRoom: 1.6, firstRoomBudget: 0.75, eliteBudget: 1.6, nightBudget: 0.85,
    twoWavesUntilRoom: 5, waveSplit2: [0.55, 0.45], waveSplit3: [0.4, 0.35, 0.25], nextWaveAlive: 2, nextWaveKilledPct: 0.7, maxAlive: 24,
  },
  shifts: {
    matin: { startHour: 6, psMult: 1, hpMult: 1, damageMult: 1, speedMult: 1, floorMult: 1, extraDronesPerWave: 1, lightRadiusPx: 0 },
    apresMidi: { startHour: 14, psMult: 1.15, hpMult: 1.1, damageMult: 1, speedMult: 1, floorMult: 1, ticketMult: 1.2, crowd: [2, 4] },
    nuit: { startHour: 22, psMult: 1.35, hpMult: 1, damageMult: 1.15, speedMult: 1.1, floorMult: 1.5, budgetMult: 0.85, extraElites: 1, lightRadiusPx: 160, wagonBarChance: 0.15 },
  },
  economy: {
    rewardWeights: { avantage: 40, tickets: 16, reglage: 14, gobelet: 12, ps: 10, grains: 8 },
    // Avec le lot Loot 1 (§ 3.8, § 9 bis) : { avantage: 34, dotation: 12, tickets: 14, reglage: 12, gobelet: 12, ps: 9, grains: 7 }
    // et les nouvelles sections LOOT, GEAR_CAPS, WEAPONS, SCRAP, VESTIAIRE (proposition game_designer.md §8.1).
    rarity: { standard: 0.7, anciennete: 0.22, statutaire: 0.07, historique: 0.01, shiftPerRoom: 0.01, shiftCap: 0.2, valueMult: [1, 1.5, 2] },
    ps: { combatRoom: 3, eliteRoom: 16, tract: 8, bosses: [25, 40, 60], shiftHeld: 50, deathPerRoom: 2, planPerPoint: 0.06 },
    grains: { reward: 3, locker: 3, killChance: 0.03, eliteChance: 0.3, bosses: [5, 8, 12], victoryMult: 2 },
    pieces: { firstKill: [3, 4, 5], repeatKill: [1, 1, 2] },
    tickets: { perKill: { consultant: 2, drone: 2, borne: 4, elite: 15 }, reward: [40, 60], locker: 30 },
    friterie: { gobelet: 60, cornet: 80, avantage: 120, reglage: 150, mitraillette: 100, fricadelle: 90, recours: 50, wagonBar: 250, discountSouvenir: 0.8 },
  },
} as const;
```

## 15. Annexe B : actions post-MVP (v2, débloquées par Dotations d'outil et Avantages)
| Action | Entrée | Principe | Valeurs de départ |
|---|---|---|---|
| **Serrage lourd** (attaque chargée) | Maintien de la Frappe ≥ 400 ms | Frappe circulaire (Clé à tire-fond) ou **Onde de rail** rectiligne (Clé à cliquet) ; brise les postures et les blindages | Charge 400–1 000 ms, rayon 56 px, 40 → 70 dégâts selon la charge, stun 600 ms, anim `attack-heavy` (9 frames) |
| **Lanterne** (projectile récupérable ; *remplacée par l'Outil Lanterne de signalisation, § 9 bis*) | Touche Q (A en AZERTY physique) / LT | Lancer de la lanterne de signalisation, qui reste au sol jusqu'à ce qu'on la ramasse (ou rappel automatique après 6 s) ; abat un Drone en un coup, surcharge la caténaire | 220 px/s, portée 160 px, 20 dégâts, 1 charge |
| **Appel radio** (super) | Clic molette / LB+RB | Le collègue dont on possède le plus d'Avantages intervient (Josiane tient le quai, Kevin coupe la caténaire…) | Jauge propre 0–100 remplie à +1 par tranche de 6 dégâts ; effet de 4 s propre à chaque famille |

Ces actions occuperont chacune un **emplacement d'Avantage** supplémentaire ; les Avantages des 7 familles recevront une variante pour chacune (ex. « File d'attente » : le Serrage lourd gèle 1,5 s ; « Voie d'attente » : la Lanterne crée une bulle de ralenti).
