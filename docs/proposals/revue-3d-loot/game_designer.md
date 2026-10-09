# PRIVATIX : système de loot et d'équipement (proposition du Game Designer)

> **Statut** : proposition à valider par l'équipe (programmeur gameplay, 3D/tech-art, UX, producteur). Aucun fichier du repo n'est modifié.
> **Sources lues** : `docs/GDD.md` (v2.0, en entier), `src/config/balance.ts`, `src/systems/meta/{Avantages,MetaState,RunState,session}.ts`, `src/entities/Weapon.ts`, `src/systems/combat/{damage,geometry}.ts`, `src/systems/save/SaveManager.ts`, `src/utils/rng.ts`, `src/systems/procedural/ShiftPlan.ts`.
> **Retour utilisateur traité** : « Plutôt de la 3D, du loot d'équipements. » → le héros porte et montre ses équipements en 3D temps réel, chaque Shift génère du butin à rareté et à affixes, et une part de ce butin survit à la run.
> **Canon (correction de l'utilisateur)** : l'**OCC** est le **Centre Opérationnel**, avec ses fonctions temps réel : PACO, RTS, TLI & AIT, RCCA, permanence conduite, DPD. Le **RTS** assure la régulation et la gestion du **matériel roulant** (automotrices, locomotives, voitures, échanges de matériel). Il **ne gère pas** l'équipement du héros. Dans ce document, le **Vestiaire** et l'**Atelier** (ancien « Établi de Kevin » : Montages, réaffûtage, déblocage des Outils) dépendent d'un **gestionnaire d'équipement du hub**, un rôle neutre. L'agent narration attribue les lieux et les PNJ.
> **Unités** : on garde les px logiques du GDD pour toute la géométrie de combat. En 3D, la convention proposée est **16 px = 1 m** (1 tuile = 1 m), les calculs de touche restant dans le **plan du sol (x, z)**. Toutes les formes (arcs, rectangles orientés, cercles) de `geometry.ts` restent valables telles quelles.

---

## 0. Résumé en 10 décisions

1. **Modèle hybride « Vestiaire de l'OCC »** : on trouve l'équipement pendant le Shift (comme Hades / Dead Cells) et on en **consigne 1 pièce (2 en cas de victoire)** au Vestiaire. Le reste part à la **Ferraille**, une ressource gardée. Le reste du loot n'est jamais perdu sec.
2. **La persistance apporte de l'identité, pas de la puissance brute.** Un objet du Vestiaire garde ses affixes, leur qualité et son pouvoir légendaire, mais son niveau effectif est **plafonné par la salle courante** (`ilvl effectif = min(ilvl, r + 3)`). C'est le garde-fou principal contre le power creep.
3. **6 emplacements visibles en 3D** : Outil (arme), Casque, Gilet haute visibilité, Gants, Chaussures de sécurité, Insigne. L'**écharpe syndicale rouge** n'est jamais masquée, c'est la signature de la silhouette.
4. **5 raretés** : Réforme (gris), Réglementaire (blanc), Homologué (bleu), Hors-série (violet), **Patrimoine** (cuivre, légendaire). Aucune ne prend le **magenta** (danger) ni le **turquoise** (corps ennemis).
5. **34 affixes** (16 préfixes, 18 suffixes) répartis en **3 paliers** qui suivent les biomes (ilvl 1–9, 10–18, 19+). **11 légendaires** qui changent la façon de jouer. **4 Attelages** (sets).
6. **6 types d'Outil**, chacun avec son moveset en arcs, rectangles et cercles : Clé à tire-fond, Masse de voie, Pied-de-biche, Lanterne de signalisation, Pelle à ballast, Perche isolante.
7. **Environ 8 objets par biome** : ennemis, caisses à outils, nouvelle porte **« Dotation »** qui annonce l'emplacement et la rareté minimale, casiers, élites, boss. La protection contre la malchance combine un **sac mélangé d'emplacements**, un compteur Homologué et un compteur Patrimoine persistant.
8. **Inventaire court** : 6 équipés + **sac de 4 cases** pendant le Shift, et **24 casiers** au Vestiaire (extensibles). La comparaison se lit **sans menu** : une carte flottante avec flèches ▲▼ et deux résumés, « Frappe » et « Tenue ».
9. **Système pur `src/systems/loot/`**, seedé par flux dédié (`roomRng(seed, room, 1000 + n)`). Les affixes sont sauvegardés en **qualité normalisée `q`** et pas en valeurs, si bien qu'un patch d'équilibrage s'applique aux objets déjà sauvegardés. **MetaState passe en v2** avec une migration.
10. **Budget de puissance réparti** : la cible du GDD (≈ ×3 de DPS en fin de Shift, TTK de 2 à 3 coups) devient **Avantages + Réglages ≈ ×2,0** et **Équipement ≈ ×1,5**. Les dégâts en % de l'équipement vont dans le **même seau additif** que les Avantages, des plafonds s'appliquent par stat, et un test de simulation en CI vérifie le tout.

---

## 1. Le modèle : hybride « Vestiaire de l'OCC »

### 1.1 Les trois options comparées

| Critère | ARPG persistant (à la Diablo) | Loot limité à la run (à la Hades / Dead Cells) | **Hybride Vestiaire (retenu)** |
|---|---|---|---|
| Surprise à chaque drop | Forte, mais s'émousse quand l'équipement est « fini » | Forte à chaque run | **Forte à chaque run**, et un drop rare peut aussi servir aux runs suivantes |
| Build-crafting | Lent, sur des dizaines d'heures | Rapide, éphémère | **Rapide pendant la run, plus une colonne vertébrale persistante (1 à 3 pièces)** |
| Compatibilité avec la boucle roguelite (§2 du GDD) | Mauvaise : la run devient une ferme et la tension de la mort disparaît | Parfaite | **Bonne** : la run reste la vraie unité, la mort coûte le build mais pas tout |
| Équilibrage (TTK de 2 à 3 coups, §3.7) | Très difficile, la puissance s'accumule sans fin | Facile | **Maîtrisé** grâce au plafond d'ilvl effectif, au Paquetage limité et aux plafonds par stat |
| Pilier 4 « Mourir n'est jamais une perte sèche » | Oui | Non, en dehors des PS | **Oui** : objet consigné, Ferraille, Plans de légendaires archivés |
| Réponse au retour utilisateur (« loot d'équipements ») | Oui | Partielle (impression d'éphémère) | **Oui** : on collectionne, on garde ses favoris, on les voit sur le héros |

### 1.2 La boucle

```
OCC ─ Vestiaire : choisir le Paquetage (1 à 3 pièces consignées) + l'Outil de départ
  │
  ▼
SHIFT : drops (ennemis, caisses, portes « Dotation », casiers, élites, boss)
  │   → équiper / mettre au sac (4) / démonter (Ferraille)
  │   → les objets du Paquetage montent en puissance avec la salle (ilvl effectif = min(ilvl, r+3))
  ▼
FIN DE SHIFT (mort ou victoire)
  │   CONSIGNE : on choisit 1 objet (2 en cas de victoire, +1 avec la revendication « Consigne élargie »)
  │   parmi les équipés et le sac → il rejoint le Vestiaire
  │   TOUT LE RESTE → Ferraille (100 % de la valeur, automatique)
  │   Première découverte d'un légendaire → son « Plan » est archivé chez Béné (codex + pool débloqué)
  ▼
OCC : Atelier du hub (Ferraille : réaffûtage, polissage, remise à niveau) → Shift suivant
```

### 1.3 Ce qui est gardé et ce qui est perdu (complète le §2.5 du GDD)

| | Mort (« Mise à pied ») | Victoire (« Shift tenu ») |
|---|---|---|
| Objets consignés | **1** au choix | **2** au choix |
| Objets du Paquetage | Reviennent au Vestiaire, **intacts** | idem |
| Reste de l'équipement et du sac | Ferraille (100 %) | Ferraille (100 %) |
| Objets laissés au sol en quittant une salle | Ferraille (**50 %**, ramassée par le « service de nettoyage ») | idem |
| Plans de légendaires découverts | Archivés | Archivés |

> **Pourquoi le Paquetage n'est jamais perdu** : il est déjà normalisé par l'ilvl effectif, donc sa perte n'apporterait que de la frustration sans rien gagner en équilibrage. La tension de la run vient du build trouvé pendant le Shift.

---

## 2. Les emplacements

Chaque emplacement possède un **implicite**, une stat fixe propre à la base et qui grandit avec le palier. Il reçoit ensuite des affixes aléatoires selon la rareté. **Rôles** : l'Outil donne le moveset, le Casque et le Gilet la survie et le Burnout, les Gants l'attaque, les Chaussures la mobilité et le Dash, l'Insigne l'utilitaire (Sifflet, Café, Avantages).

### 2.1 Tableau des emplacements

| Emplacement | Thème cheminot | Ce qu'il modifie surtout | Bases (ItemDef) et implicite par palier I / II / III | Lecture 3D sur le héros |
|---|---|---|---|---|
| **Outil** (arme) | Outillage de voie | Moveset (§4), dégâts de base, coup final, dash-attaque | 6 types (§4) ; implicite **Calibre** : dégâts de base ×(1 + 0,012 × (ilvl − 1)), soit ×1,00 à ×1,35 | Tenu en main, silhouette propre à chaque type, traînée de smear colorée par la rareté |
| **Casque / EPI** | Casque de chantier, antibruit, lampe frontale | Dégâts subis, Burnout reçu, halo de Nuit, Sifflet | **Casque de chantier** : dégâts subis −3 / −5 / −7 % · **Casque antibruit** : durée des ralentis et étourdissements subis −15 / −20 / −25 % · **Casque à lampe frontale** : halo de Nuit +24 / +32 / +40 px | Volume au-dessus de la tête (+4 px au plus, pour garder une silhouette lisible) ; la lampe frontale est une vraie lumière dynamique |
| **Gilet haute visibilité** | Gilet classe 2, gilet de signaleur, parka de nuit | Énergie max, plancher et gain de Burnout, Pétage | **Gilet classe 2** : +5 / +10 / +15 Énergie max · **Gilet de signaleur** : +2 / +3 / +4 Mobilisation par coup encaissé · **Parka de nuit** : plancher de Burnout −5 / −8 / −12 % | Bandes réfléchissantes qui **accrochent les lumières** de la scène (matériau rétro-réfléchissant) ; couleur orange ou jaune sécurité ; l'écharpe passe **par-dessus** |
| **Gants** | Gants de manutention, gants isolants, mitaines de quai | Vitesse d'attaque, critique, knockback, électricité | **Manutention** : vitesse d'attaque +3 / +5 / +7 % · **Isolants** : dégâts électriques +10 / +15 / +20 % · **Mitaines de quai** : +2 / +3 / +4 pts de critique | Mains plus massives ; étincelles émissives sur les gants isolants |
| **Chaussures de sécurité** | Coquées, bottes de voie, baskets de sécurité | Vitesse, dash (distance, recharge, dash parfait), ballast | **Coquées** : vitesse +3 / +5 / +7 % · **Bottes de voie** : ralenti du ballast ignoré, vitesse +2 / +3 / +4 % · **Baskets de sécurité** : recharge du dash −4 / −6 / −8 % | Traînées de dash teintées par la paire portée ; poussière de ballast |
| **Insigne** (accessoire) | Badge syndical, sifflet en laiton, thermos cabossé, montre de service | Mobilisation, Sifflet, Café, familles d'Avantages, économie | **Badge syndical** : Mobilisation gagnée +5 / +8 / +12 % · **Sifflet en laiton** : rayon du Sifflet +4 / +6 / +8 px · **Thermos cabossé** : soin du Gobelet +2 / +3 / +4 pts · **Montre de service** : Caféine +0,5 / +1 / +1,5 s | Pin's sur la poitrine, thermos à la ceinture, sifflet au cou : petit objet émissif visible |

### 2.2 Règles d'emplacement
- **Un seul objet par emplacement.** Le sac (§6.2) sert de réserve.
- Les **Souvenirs** (§10.5 du GDD) **restent à part** : ils viennent de la relation avec les collègues et ne se lootent pas. Aucun Insigne ne reprend leur nom.
- **Conflits de nom à régler dans le GDD** : la revendication méta « Chaussures de sécurité » (+1 charge de dash) devient **« Formation au déplacement d'urgence »**. Le « Réglage de clé » devient **« Réglage d'outil »** et s'applique au coup final et aux coups rapides de n'importe quel Outil (§4.3).

---

## 3. Rareté, affixes, légendaires, Attelages

### 3.1 Les 5 raretés

| Rareté | Couleur (faisceau et texte) | Affixes aléatoires | Matériau 3D | Poids de base (ennemi) |
|---|---|---|---|---|
| **Réforme** | Gris acier `#8A929A` | 1 | Usé, rayé, rouille légère | 60 |
| **Réglementaire** | Blanc cassé `#F2EEE3` | 2 | Propre, neuf | 30 |
| **Homologué** | Bleu signal `#3F8CFF` | 3 | Liserés bleus, tampon « HOMOLOGUÉ » | 8,5 |
| **Hors-série** | Violet `#A86BFF` | 4 (2 préfixes et 2 suffixes) | Coutures émissives violettes | 1,3 |
| **Patrimoine** (légendaire) | Cuivre `#FF8C2B` | 3, plus le **pouvoir légendaire** fixe | Laiton et cuivre gravés, particules de poussière dorée | 0,2 |

- **Contraintes de lisibilité (piliers 2 et 4 du GDD)** : aucune rareté n'utilise le magenta `#FF3EA5` (danger), le turquoise `#19C3B1` (corps ennemis) ni le jaune `#FFD23F` (danger en palette daltonisme). Le violet des boucliers du Manager KPI est désaturé, alors que le violet Hors-série est émissif et pulse.
- **Noms** : `[Base] [Préfixe] [de Suffixe]`, par exemple « Gants de manutention **affûtés** **de la Relève** ». Un Patrimoine porte un **nom propre** fictif (« Le Démonte-tout »).

### 3.2 Paliers d'affixes et item level

| Palier | ilvl | Correspond à | Remarque |
|---|---|---|---|
| **I** | 1 à 9 | Biome 1 | |
| **II** | 10 à 18 | Biome 2, élites tardives et boss du biome 1 | Le boss 1 (r = 9, +3) donne de l'ilvl 12, donc du palier II : c'est le **pic de récompense** |
| **III** | 19 à 30 | Biome 3, boss 2 | |

- **Valeur d'un affixe** : `valeur = arrondi_au_pas(lerp(min_palier, max_palier, q))`, avec `q ∈ [0, 1]` tiré uniformément et quantifié au centième. C'est **`q` qui est sauvegardé**, pas la valeur.
- **Exclusivité** : un même `group` d'affixe ne peut pas apparaître deux fois sur un objet. Un objet porte au plus 2 préfixes et 2 suffixes.

### 3.3 Mots-clés (tags) des affixes
`[Frappe]` `[Coup final]` `[Dash]` `[Sifflet]` `[Café]` `[Burnout]` `[Mobilisation]` `[Défense]` `[Mobilité]` `[Élec]` `[Contrôle]` `[Nuit]` `[Économie]`. Les tags servent au **loot ciblé** (§5.6) et aux filtres du Vestiaire.

### 3.4 Préfixes (16)

| # | Préfixe | Emplacements | Palier I | Palier II | Palier III | Tags | Effet et interactions |
|---|---|---|---|---|---|---|---|
| P1 | **Affûté** | Outil, Gants | +3–5 % | +6–8 % | +9–12 % | Frappe | Dégâts de Frappe, dans le **seau additif** `damageBonus` |
| P2 | **Équilibré** | Outil, Gants | +3–4 % | +5–6 % | +7–9 % | Frappe | Vitesse d'attaque (startup, active et recovery ×1/(1+x)) ; se cumule avec la Caféine |
| P3 | **Bien serré** | Outil | +8–12 % | +13–18 % | +19–25 % | Coup final | Dégâts du **coup final** du combo (coup 3 de la clé, coup 2 de la masse…) |
| P4 | **Méticuleux** | Outil, Gants, Casque | +2–3 pts | +4–5 pts | +6–7 pts | Frappe | Chance de critique « Prime de nuit » |
| P5 | **Lourd** | Outil, Gants | +10–15 % | +16–25 % | +26–35 % | Frappe | Multiplicateur critique (×1,75 de base) |
| P6 | **Sous tension** | Gants, Gilet | +0,6–0,8 % | +0,9–1,2 % | +1,3–1,6 % | Burnout | Dégâts **par tranche de 10 de Burnout** (jusqu'à +16 % à 100) ; pousse à « jouer au bord » |
| P7 | **Militant** | Insigne, Outil | +8–12 % | +13–18 % | +19–25 % | Mobilisation | Mobilisation gagnée, toutes sources |
| P8 | **En correspondance** | Chaussures, Outil | +15–20 % | +21–30 % | +31–40 % | Dash | Dégâts de la **dash-attaque** |
| P9 | **Percutant** | Outil, Gants | +10–15 % kb · +3–4 | +16–25 % · +5–7 | +26–35 % · +8–10 | Contrôle | Knockback, et dégâts du **Plaqué contre le quai** |
| P10 | **Électrifié** | Outil, Gants | 6–8 dégâts | 9–12 | 13–16 | Élec | Le coup final lance un **arc** vers 1 cible à ≤ 80 px (avec Coupure de caténaire : +1 cible) |
| P11 | **Verbalisant** | Outil | 10–15 % | 16–22 % | 23–30 % | Contrôle | Chance d'**Amende** (3 dégâts/s pendant 4 s, 3 cumuls) à chaque coup, avec la mécanique de Béné |
| P12 | **Strident** | Insigne, Casque | +6–8 px | +9–12 px | +13–16 px | Sifflet | Rayon du Coup de sifflet et du Préavis (plafond +24 px au total) |
| P13 | **Retentissant** | Insigne | +15–20 % | +21–30 % | +31–40 % | Sifflet | Dégâts du Sifflet et du Préavis |
| P14 | **Corsé** | Insigne, Gilet | +3–4 pts | +5–6 pts | +7–8 pts | Café | Soin du Gobelet (30 % → 33–38 %), toujours modulé par le palier de Burnout |
| P15 | **Décaféiné** | Insigne | −3 | −4 | −5 | Café, Burnout | Burnout d'un Gobelet (+20 → +15 au mieux) |
| P16 | **Serré** | Insigne, Gants | +1 s / +2 % | +1,5 s / +3 % | +2 s / +4 % | Café | Durée de la Caféine et bonus de vitesse d'attaque de la Caféine (+15 % → +19 %) |

### 3.5 Suffixes (18)

| # | Suffixe | Emplacements | Palier I | Palier II | Palier III | Tags | Effet et interactions |
|---|---|---|---|---|---|---|---|
| S1 | **du Dépôt** | Gilet, Casque | +4–6 | +7–10 | +11–15 | Défense | Énergie max |
| S2 | **du Quai** | Casque, Gilet | −2–3 % | −4–5 % | −6–7 % | Défense | Dégâts subis (réduction **multiplicative après** le malus de palier de Burnout) ; plafond équipement −30 % |
| S3 | **de Sang-froid** | Casque, Gilet | −6–8 % | −9–12 % | −13–16 % | Burnout | Burnout gagné en **encaissant** (0,6 × dégâts) |
| S4 | **de la Relève** | Gilet, Casque | +0,2–0,3/s | +0,4–0,5/s | +0,6–0,8/s | Burnout | Récupération passive du Burnout (−3/s de base) |
| S5 | **d'Ancienneté** | Gilet, Casque | −5–8 % | −9–12 % | −13–16 % | Burnout | **Plancher** du 3x8 (multiplicatif) ; plafond −40 % |
| S6 | **de l'Arrêt maladie** | Gilet | −1 | −2 | −3 | Burnout | Séquelle du Pétage de plombs (−8 Énergie max → −5 au mieux) |
| S7 | **du Coup de sang** | Gants, Casque | +0,5 s | +1 s | +1,5 s | Burnout | Durée du **Pétage de plombs** (8 s → 9,5 s au plus) |
| S8 | **de l'Aiguilleur** | Chaussures | +2–3 % | +4–5 % | +6–7 % | Mobilité | Vitesse de déplacement ; plafond équipement +20 % |
| S9 | **de Correspondance** | Chaussures | −5–7 % | −8–10 % | −11–14 % | Dash | Recharge du dash (750 ms) ; plafond −35 % |
| S10 | **du Ballast** | Chaussures | +4–6 px | +7–9 px | +10–12 px | Dash | Distance du dash (72 px) ; plafond +24 px pour garder la règle des « trous ≤ 64 px » lisible |
| S11 | **de Ponctualité** | Chaussures, Casque | +10–15 ms | +16–20 ms | +21–30 ms | Dash | Fenêtre du **dash parfait** (80 ms) ; plafond +40 ms |
| S12 | **du Contre-pied** | Chaussures | +20 % | +30 % | +40 % | Dash | Après un **dash parfait**, le prochain coup dans les 1,5 s inflige ce bonus |
| S13 | **du Piquet** | Insigne | +5 | +8 | +12 | Mobilisation | Mobilisation à l'**entrée** de chaque salle de combat |
| S14 | **de la Colère** | Gilet, Casque | +2 | +3 | +4 | Mobilisation | Mobilisation par **coup encaissé** (+10 de base) |
| S15 | **de Solidarité** (7 variantes : *de Josiane*, *de Rudy*, *de Béné*, *de Yasmina*, *de Kevin*, *de Fatou*, *de Marcel*) | Insigne | +8–10 % | +11–14 % | +15–18 % | Tag de la famille | Valeur des **Avantages de cette famille** (multiplie le `mult` de rareté). La famille est tirée avec l'affixe |
| S16 | **de Nuit** | Casque | +4–6 % · +16 px | +7–9 % · +24 px | +10–12 % · +32 px | Nuit | Dégâts infligés **pendant le roulement de Nuit** et halo de lumière |
| S17 | **de Fin de service** | Gilet | +1 | +2 | +3 | Défense | Énergie rendue à chaque salle nettoyée (cumulable avec la Visite médicale de Fatou) |
| S18 | **du Délégué** | Insigne, Gilet | +8–12 % | +13–18 % | +19–25 % | Économie | Tickets ramassés (n'affecte **pas** les PS ni les Grains, pour protéger la méta) |

> **Total : 34 affixes** (16 préfixes et 18 suffixes, dont S15 décliné en 7 familles). Le MVP du loot n'en utilise que **20** : P1–P8, P12–P14, S1–S5, S8, S9, S11, S13.

### 3.6 Plafonds globaux (appliqués après le cumul méta, équipement et Avantages)

| Stat | Plafond (part de l'équipement seul) | Raison |
|---|---|---|
| Réduction des dégâts subis | −30 % | Préserver « Plus fort, plus fragile » |
| Chance de critique (toutes sources) | 50 % | Sinon Heures sup + Méticuleux rendent les critiques permanents |
| Vitesse d'attaque (équipement) | +25 % | La Caféine et le Pétage s'y ajoutent ; les timings de télégraphe restent punissables |
| Vitesse de déplacement (équipement) | +20 % | Lisibilité de la caméra (deadzone 32×24) |
| Recharge du dash | −35 % | Les i-frames ne doivent pas devenir permanentes |
| Mobilisation gagnée | +50 % | Un Sifflet ou un Préavis toutes les 4 s au mieux (cooldown inchangé) |
| Plancher de Burnout | −40 % | Le 3x8 reste une horloge réelle |
| Burnout du Gobelet | +15 au minimum | Le café doit garder sa tension (§5.6 du GDD) |

### 3.7 Légendaires « Patrimoine » (11)

Ils ont tous un **avantage qui change le jeu** et une **contrepartie lisible**. Ils ne roulent pas de chiffres sur leur pouvoir (seul l'ilvl agit sur les 3 affixes et l'implicite). Leur premier drop archive le **Plan** chez Béné (codex, pool).

| # | Nom | Emplacement | Pouvoir | Contrepartie | Mécanique visée |
|---|---|---|---|---|---|
| L1 | **Clé à cliquet perpétuel** | Outil (Clé) | Le combo **ne se réinitialise plus** (pas de fenêtre de 150 ms) ; chaque boucle complète sans être touché donne **+6 % de dégâts** (5 cumuls au plus, +30 %), tous perdus au premier coup reçu | Chain point 80 → 100 ms | Frappe, jeu propre |
| L2 | **Clé du Wagon-Bar** (secret, quête du Fantôme) | Outil (Clé) | Le startup du coup 1 devient une **parade de 200 ms** qui renvoie les projectiles ×1,5 et étourdit la mêlée 600 ms ; parade réussie : +10 Mobilisation | Coup 1 −25 % de dégâts | Reprend le Montage secret du §10.4 du GDD |
| L3 | **La Dernière Traverse** | Outil (Masse) | Le coup final laisse une **faille** (rectangle orienté 120×14 px vers l'avant) qui éclate **500 ms** plus tard pour 60 % des dégâts du coup, avec un ralenti de 40 % pendant 1,5 s. Télégraphe **orange** (jamais magenta) | Vitesse d'attaque de la masse −10 % | Zone, contrôle |
| L4 | **Le Démonte-tout** | Outil (Pied-de-biche) | Le coup 4 « démonte » : une **Borne** est HORS SERVICE 3 s et perd son blindage frontal pour la salle ; un **Drone** reste au sol 2 s ; une **élite** voit sa posture cassée (une fois toutes les 10 s par cible) ; un **boss** prend +50 % du coup 4 | Coups 1 à 3 : −10 % | Contre de chaque archétype |
| L5 | **Feu rouge** | Outil (Lanterne) | Les ennemis pris dans le faisceau du coup 3 sont « **à l'arrêt** » : aucun **nouveau télégraphe** pendant 1,5 s (élites 0,5 s ; boss immunisés mais prennent +25 %) | Halo de Nuit −40 px | Pilier « Lire, esquiver, punir » inversé |
| L6 | **Casque Cocotte-minute** | Casque | Le **Pétage de plombs ne se déclenche plus** : le Burnout est bloqué à 99. Au-dessus de 90, une **soupape** part toutes les 2 s (onde de 48 px, 15 dégâts × Calibre, knockback 24 px) | Récupération passive du Burnout −50 % ; dégâts subis « Au bout du rouleau » +25 → +35 % | Burnout : jouer au bord en permanence, sans séquelle |
| L7 | **Gilet du Comité de grève** | Gilet | Jauge de Mobilisation **0–200**. Au-dessus de 100, on peut enchaîner **deux Préavis** (le second ignore le cooldown de 4 s). À 200, le maintien déclenche la **Grève générale** : rayon 160 px, stun 3 s (élites 1 s), Piquet 6 s | Mobilisation gagnée −20 % | Mobilisation, Sifflet |
| L8 | **Bottes du Dernier Train** | Chaussures | Le dash devient une **glissade sur rail** : 144 px en 220 ms, i-frames sur toute la durée, 20 dégâts × Calibre aux ennemis traversés (rectangle de 16 px de large), recharge 1 200 ms ; un dash parfait rend la charge et place le combo sur le **coup final** | **1 seule charge**, sans bonus de charges | Dash : de l'esquive à l'attaque |
| L9 | **Thermos inépuisable** | Insigne | Les Gobelets deviennent un **thermos de 25 gorgées par Gobelet**. **Maintenir R** boit en continu (1 gorgée / 100 ms : soin de 1 % de l'Énergie max × palier, +0,6 Burnout) en se déplaçant à 70 % ; Caféine pendant qu'on boit et 3 s après | Impossible de boire pendant 1 s après un coup reçu | Café : dosage fin du Burnout |
| L10 | **Carnet de revendications** | Insigne | Chaque salle nettoyée **sans boire** donne une **Revendication** : +4 % de dégâts, 8 cumuls au plus. Boire **consomme** tous les cumuls et soigne +2 % par cumul | Les cumuls disparaissent aussi au Pétage de plombs | Café contre Burnout, risque |
| L11 | **Gilet Haute visibilité absolue** | Gilet | Fenêtre de **dash parfait ×2**, et un dash parfait rend une **charge entière** (au lieu de 0,5) | On est **toujours « Signalé »** : +10 % de dégâts subis en permanence et les Bornes tirent 25 % plus vite | Dash parfait, prise de risque |

### 3.8 Attelages (sets)

- Les pièces d'Attelage tombent en **Hors-série**, avec un affixe fixe d'Attelage et 3 affixes aléatoires.
- **Aimant d'attelage** : si l'on porte déjà une pièce d'un Attelage, le poids de ses autres pièces est **×3** dans les tirages de base de l'emplacement.
- Le Vestiaire permet de garder une pièce d'une run à l'autre.

| Attelage | Pièces | 2 pièces | 3 pièces | 4 pièces |
|---|---|---|---|---|
| **Tenue de Nuit** | Casque à lampe frontale, Parka de nuit, Bottes de voie, Mitaines | Halo +40 px ; +5 % de dégâts la Nuit | Plancher de Nuit ×1,5 → ×1,25 | Ennemis **hors du halo** : +25 % de dégâts subis (« attaque surprise ») |
| **Paquetage du Délégué** | Badge syndical, Gilet de signaleur, Casque antibruit | +15 Mobilisation à l'entrée de chaque salle | Le Préavis coûte 80 | — |
| **Équipement de caténaire** | Perche isolante, Gants isolants, Baskets de sécurité | Le dash laisse une traînée électrique (4 dégâts / 0,5 s) | Les arcs électriques ont +1 rebond et ralentissent de 20 % pendant 1 s | — |
| **Bleu de travail du Dépôt** | Casque de chantier, Gilet classe 2, Gants de manutention, Chaussures coquées | Dégâts subis −5 % | +1 Gobelet maximum (4 → 5) | Bouclier « Pause légale » toutes les 45 s (comme Fatou ; avec son Avantage, le délai le plus court l'emporte) |

---

## 4. Les Outils (armes)

### 4.1 Principes communs
- Les hitboxes restent celles de `HitShape` (arc ; rectangle orienté avec cercle d'impact facultatif), plus `radial` (cercle centré sur le héros), déjà prévu dans `SwingSpec`. **Aucune nouvelle primitive géométrique.**
- L'origine reste le centre du corps, 10 px au-dessus des pieds, dans le plan du sol.
- **DPS mono-cible de base visé : 44 à 52** (la clé, référence, fait 51). Chaque Outil compense un DPS plus bas par la zone, la portée ou la sécurité.
- Les règles du §5.3 du GDD s'appliquent à tous : chain point à 80 ms, fenêtre de 150 ms, cancel par dash pendant la recovery, coup final engagé après 120 ms de startup.
- Chaque Outil désigne un **coup final** (cible de « Bien serré », « Électrifié », Coupure de caténaire, Guichet fermé) et un **coup rapide** (cible des Réglages d'outil).

### 4.2 Les 6 types

**1. Clé à tire-fond** (équilibrée, référence, disponible au départ)

| Coup | Startup / Active / Recovery (ms) | Forme | Dégâts | Knockback / stun |
|---|---|---|---|---|
| 1 Serrage | 90 / 60 / 160 | Arc r 38, 100° | 12 | 18 px |
| 2 Desserrage | 80 / 60 / 170 | Arc r 40, 120° | 12 | 18 px |
| 3 Tire-fond (final) | 200 / 80 / 320 | Rectangle 56×28 depuis +8, impact r 20 à +56 | 30 | 64 px, stun 250 ms |

Combo enchaîné en 1 050 ms pour 54 dégâts, soit **51 DPS**. Dash-attaque : estoc, rectangle 64×20, 18 dégâts. **Trait** : le coup 3 détruit les projectiles.

**2. Masse de voie** (lente, lourde, brise les postures ; à débloquer à l'Atelier du hub : 1er kill du Boss 1 et 2 Pièces)

| Coup | S / A / R (ms) | Forme | Dégâts | Knockback / stun |
|---|---|---|---|---|
| 1 Balancier | 180 / 80 / 260 | Arc r 46, 150° | 20 | 36 px |
| 2 Bourrage (final) | 340 / 100 / 420 | Cercle r 44 centré à +34 px | 42 | 72 px, stun 400 ms |

Combo enchaîné en 1 200 ms pour 62 dégâts, soit **52 DPS**. Dash-attaque : « Coup de bélier », rectangle 48×28, 26 dégâts, recovery 280 ms. **Traits** : posture ennemie usée ×1,5 (le Manager KPI casse en 2 Bourrages) ; **pas d'interruption** par un coup reçu pendant l'active du coup 2 (les dégâts sont tout de même subis). Contrepartie : startups longues, déplacement à 15 % pendant l'attaque.

**3. Pied-de-biche** (rapide, critique, anti-blindage ; 3 Pièces)

| Coup | S / A / R (ms) | Forme | Dégâts | Knockback / stun |
|---|---|---|---|---|
| 1, 2, 3 Crochet | 60 / 40 / 120 | Arc r 32, 80° | 8 / 8 / 9 | 10 px |
| 4 Levier (final) | 140 / 60 / 260 | Rectangle 44×16 depuis 0 | 20 | **−24 px** (attire la cible), stun 200 ms |

Combo enchaîné en 1 000 ms pour 45 dégâts. Avec un critique de base de **12 %** (au lieu de 5 %), on obtient **≈ 49 DPS**. Dash-attaque : glissade basse, rectangle 56×14, 14 dégâts, qui renverse un Drone. **Traits** : le coup 4 **ignore le blindage frontal** de la Borne et brise le bouclier d'alignement d'un allié du Manager. Contrepartie : portée courte et knockback faible, donc on reste au contact.

**4. Lanterne de signalisation** (mi-distance, contrôle, Nuit ; à débloquer au 1er kill du Boss 2 et 3 Pièces ; remplace l'action « Lanterne » de l'Annexe B)

| Coup | S / A / R (ms) | Forme | Dégâts | Effet |
|---|---|---|---|---|
| 1 Balancement | 70 / 50 / 150 | Arc r 34, 100° | 10 | — |
| 2 Revers | 70 / 50 / 150 | Arc r 34, 100° | 10 | — |
| 3 Signal d'arrêt (final) | 220 / 80 / 300 | **Arc étroit r 112, 30°** (faisceau) | 24 | Ébloui : ralenti 40 % pendant 1,2 s ; un Drone tombe 1,2 s |

Combo enchaîné en 1 000 ms pour 44 dégâts, soit **44 DPS**, et un finisher à 112 px. Dash-attaque : « Coup de phare », arc r 64, 60°, 16 dégâts. **Traits** : halo de Nuit +60 px ; révèle les ennemis hors du halo touchés par le faisceau pendant 3 s.

**5. Pelle à ballast** (balayage large, contrôle de foule ; 4 Pièces)

| Coup | S / A / R (ms) | Forme | Dégâts | Effet |
|---|---|---|---|---|
| 1 et 2 Ratissage | 100 / 70 / 200 | Arc r 42, 160° | 14 / 14 | 24 px |
| 3 Pelletée (final) | 180 / 80 / 320 | Arc r 88, 50° (gerbe de ballast) | 20 | Ralenti « ballast » 30 % pendant 2 s, 40 px de knockback |

Combo enchaîné en 1 080 ms pour 48 dégâts, soit **44 DPS** mono-cible et le meilleur outil contre les foules. Dash-attaque : « Coup de plat », cercle r 28 à +24 px, 16 dégâts. **Trait** : knockback ×1,25 (synergie avec Plaqué contre le quai et l'Aiguillage dévié de Rudy).

**6. Perche isolante** (allonge, électricité ; quête de l'Atelier, à partir de la v2)

| Coup | S / A / R (ms) | Forme | Dégâts | Effet |
|---|---|---|---|---|
| 1 et 2 Estoc | 110 / 60 / 180 | Rectangle 64×12 depuis +8 | 13 / 13 | 20 px |
| 3 Mise à la terre (final) | 240 / 90 / 360 | **Radial r 56** centré sur le héros | 27 | Stun 200 ms, dégâts **électriques** |

Combo enchaîné en 1 190 ms pour 53 dégâts, soit **44,5 DPS**, avec une allonge de 72 px. Dash-attaque : « Perche à la caténaire », rectangle 80×10, 16 dégâts. **Traits** : tous les dégâts électriques +15 % ; les arcs de Kevin ont +1 rebond.

### 4.3 Conséquences sur l'existant
- **`COMBO`** (balance.ts) devient `WEAPONS.cle.combo` ; `Weapon.sweep()` reçoit la `SwingSpec` de l'Outil équipé (la signature ne change pas).
- **Combo de longueur variable** : `attackTiming.ts` et la machine à états du Player lisent `combo.length` (2 à 4 coups) au lieu de supposer 3. Le dash-cancel reprend toujours au coup suivant.
- **Réglages d'outil** (anciens Réglages de clé) génériques :

  | Réglage | Effet |
  |---|---|
  | Clé dynamométrique | Coup final +40 % |
  | Manche gainé | Vitesse d'attaque +8 % par rang |
  | Mâchoire élargie | Arcs +4 px de rayon ; rectangles +8 px de longueur |
  | Contrepoids | Knockback |
  | Clé graissée | Chain point et dash-attaque |

- **Montages** (désormais à l'**Atelier du hub**) : l'Atelier **débloque les types d'Outil** dans le pool de loot (Pièces), ce qui donne une progression **horizontale**. La « Clé recalibrée » devient une base de Clé « à cliquet » (combo de 4 coups) ; la « Clé du Wagon-Bar » devient le légendaire L2.
- **Outil de départ** : chaque Shift commence avec un Outil **Réforme sans affixe** du type choisi au Vestiaire, sauf si le Paquetage contient un Outil.

---

## 5. Sources de drop, taux, item level, malchance, recyclage

### 5.1 Item level

```
ilvl = clamp(r + B_source + B_roulement, 1, 30)
B_source    = 0 (ennemi, caisse) · +1 (porte Dotation, casier) · +2 (élite) · +3 (boss)
B_roulement = 0 (Matin) · +1 (Après-midi) · +2 (Nuit)
ilvl_effectif(objet, r) = min(objet.ilvl, r + 3)     // Paquetage du Vestiaire : « monte en grade » avec la salle
palier(ilvl) = I si ≤ 9, II si ≤ 18, III sinon
```

| Moment (Matin) | r | Ennemi | Dotation | Élite | Boss |
|---|---|---|---|---|---|
| Salle 1 | 1 | 1 (I) | 2 (I) | — | — |
| Salle 6 | 6 | 6 (I) | 7 (I) | 8 (I) | — |
| Boss 1 | 9 | — | — | — | **12 (II)** |
| Biome 2, salle 4 | 13 | 13 (II) | 14 (II) | 15 (II) | — |
| Boss 2 | 18 | — | — | — | **21 (III)** |
| Boss final | 28 | — | — | — | 30 (III) |

### 5.2 Sources et taux

| Source | Déclencheur | Nombre d'objets | Rareté minimale | Remarque |
|---|---|---|---|---|
| **Ennemi de base** | Mort | Junior 3 %, Drone 3 %, Borne **5 %**, Agent de sécurité 6 % | — | ≈ 75 kills dans le biome 1, donc ≈ 2,5 objets |
| **Caisse à outils** (décor cassable) | 25 % des salles de combat | 1 | — | 3 coups pour la casser ; pas de combat ; ≈ 1,2 par biome |
| **Porte « Dotation »** (nouvelle récompense) | Récompense annoncée | **Choix de 1 parmi 2**, de 2 emplacements différents | Réglementaire | L'écran annonce l'**emplacement** et la **rareté minimale** : `IC 0712 → DOTATION : GANTS — HOMOLOGUÉ` |
| **Casier de vestiaire** (salle Café / trésor) | Troisième option à côté du soin et de la consigne | 1 | Réglementaire | ≈ 0,6 par biome |
| **Élite** | Mort de l'élite | 1, puis 25 % de chance d'un second | Réglementaire | Élite de Nuit garantie, donc +1 objet la Nuit |
| **Boss** | Victoire | Boss 1 : **2** · Boss 2 : **3** · Final : **3** | Homologué | Au 1er kill, l'un d'eux est **Hors-série garanti** |
| **Friterie de Raymonde** | Achat | 1 objet Homologué à **140 Tickets** (stock 1) | Homologué | Wagon-Bar : 1 Patrimoine à **300 Tickets** |
| **Événement « Objets trouvés »** (nouveau, biomes 1 à 3) | Choix | 1 colis parmi 3 (silhouettes d'emplacement visibles, rareté cachée) | Réglementaire | Gag : « Merci de signaler tout colis suspect » |

**Volume visé** : **≈ 8 objets par biome** (6 à 10), soit une décision de loot toutes les 1,2 salles environ. Shift complet : ≈ 25 objets. Les poids des portes passent de `avantage 40, tickets 16, reglage 14, gobelet 12, ps 10, grains 8` à **`avantage 34, dotation 12, tickets 14, reglage 12, gobelet 12, ps 9, grains 7`** (total 100). Le loot prend environ 15 % de la place des Avantages (§8).

### 5.3 Poids de rareté par source (base, r = 1, Matin)

| Source | Réforme | Réglementaire | Homologué | Hors-série | Patrimoine |
|---|---|---|---|---|---|
| Ennemi | 60 | 30 | 8,5 | 1,3 | 0,2 |
| Caisse à outils | 50 | 35 | 12 | 2,6 | 0,4 |
| Porte Dotation (par option) | — | 62 | 30 | 7 | 1 |
| Casier | — | 55 | 33 | 10 | 2 |
| Élite | — | 45 | 40 | 12,5 | 2,5 |
| Boss (par objet) | — | — | 70 | 25 | 5 |
| Boss, objet garanti du 1er kill | — | — | — | 90 | 10 |

**Décalages**, toujours pris sur la rareté la plus basse disponible :
- **Avancement** : +0,3 pt par r, réparti 0,20 / 0,08 / 0,02 vers Homologué, Hors-série et Patrimoine (à r = 27 : +5,2 / +2,1 / +0,5).
- **Nuit** : +3 pts (2 / 0,8 / 0,2).
- **Plan d'Économies** : +0,3 pt de Hors-série par point de Plan (maximum +8,4 à 28 points). **Aucun** bonus d'ilvl, pour ne pas faire du Plan une ferme de puissance.
- Le Patrimoine est **plafonné à 6 % par objet**, sauf pour l'objet garanti du boss et la pitié.

### 5.4 Protection contre la malchance

| Mécanisme | Règle | Portée |
|---|---|---|
| **Sac mélangé d'emplacements** | L'emplacement est tiré **sans remise** dans un sac de 6 ; on le remplit à nouveau quand il est vide. C'est la même logique que les gabarits (§3.4.9 du GDD). Garantit qu'on voit les 6 emplacements en 6 drops | Run |
| **Sac de types d'Outil** | Les types d'Outil débloqués sont tirés sans remise | Run |
| **Réclamation** (Homologué) | Après **5 objets d'affilée** sous Homologué, le suivant est au moins Homologué | Run |
| **Ancienneté du butin** (Patrimoine) | +0,15 pt de Patrimoine par objet non Patrimoine, remis à 0 au drop, plafond +8 pts | **Méta** (sauvegardée) |
| **Prime de bienvenue** | Si aucun Patrimoine n'est tombé avant le **3e kill du Boss 1**, l'objet garanti de ce kill est un Patrimoine | Méta, une fois |
| **Pas de doublon de légendaire** | Un Patrimoine déjà équipé ou dans le sac est exclu du tirage | Run |
| **Shift imposé** (graine saisie) | La pitié méta est **gelée** (ni lue ni écrite) pour garder le Shift reproductible | — |

**Attendu** : environ 0,16 Patrimoine par run de biome 1 sans pitié ; **un premier Patrimoine vers la 4e à 6e run** ; en fin de méta, environ 1 Patrimoine par Shift complet de 3 biomes.

### 5.5 Recyclage : Ferraille (pièces détachées)

- **Démonter** un objet, pendant le Shift ou au Vestiaire, donne de la **Ferraille**. C'est une monnaie méta, gardée comme les PS. Les **Pièces** du GDD restent la monnaie rare des boss.

| Rareté | Réforme | Réglementaire | Homologué | Hors-série | Patrimoine |
|---|---|---|---|---|---|
| Ferraille | 1 | 3 | 6 | 15 | 40 |
| Bonus d'ilvl | +floor(ilvl / 10) | | | | |

- **Gain attendu** : 15 à 25 Ferraille par run du MVP, 50 à 70 par Shift complet.
- **Dépenses** à l'**Atelier du hub** (gestionnaire d'équipement) :

| Action | Effet | Coût |
|---|---|---|
| **Réaffûtage** | Retire un affixe ; on choisit son remplaçant parmi 3 tirages du même type (préfixe ou suffixe) | 12 Ferraille, +6 par réaffûtage déjà fait sur l'objet |
| **Polissage** | `q` d'un affixe +0,10 (maximum 1,0) | 8 Ferraille |
| **Remise à niveau** | Plafond d'ilvl de l'objet +3 (maximum 30) | 15 Ferraille + 1 par niveau visé |
| **Conversion chez Béné** | 25 Ferraille → 1 Pièce | Une fois par Shift (les Pièces restent rares) |

### 5.6 Loot ciblé par la radio (léger)
Quand un objet tire ses affixes, les affixes dont un tag correspond à une famille d'Avantage **possédée dans la run** ont un poids **×1,5**. Par exemple, avec 2 Avantages de Rudy, les affixes Sifflet sortent plus souvent. Le build reste cohérent sans devenir déterministe.

---

## 6. UX

### 6.1 Lecture au sol
- **Faisceau vertical** coloré par rareté, émissif, non éclairé, visible grâce au bloom :

  | Rareté | Faisceau |
  |---|---|
  | Réforme | Aucun, seulement un contour gris |
  | Réglementaire | 24 px |
  | Homologué | 48 px |
  | Hors-série | 72 px, pulsation à 1 Hz |
  | Patrimoine | 128 px, éclat de lumière et **carillon de gare cuivré** ; un Patrimoine qui tombe pendant un combat déclenche un **mini slow-mo de 150 ms** (désactivable par « Réduction des mouvements ») |

- **Pictogramme d'emplacement** (16×16, lisible à 1×) en haut du faisceau.
- **Étiquette** (nom coloré) affichée à ≤ 48 px, ou pour tous les objets en **maintenant Alt** (clavier) ou **LB** (manette) : « Montrer le butin ».
- **Placement du drop** : l'objet est éjecté en arc et se pose à **24–48 px** de l'ennemi, sur une tuile praticable **hors voie active et hors vide**. Sinon, il va sur la tuile sûre la plus proche.
- **Pendant le combat** : les objets **ne se ramassent pas**, pour éviter un échange accidentel en plein dash, mais ils restent visibles. **Salle nettoyée** : les faisceaux s'intensifient et les portes attendent comme pour la récompense annoncée.

### 6.2 Ramassage, comparaison, inventaire
- **S'approcher à ≤ 24 px** affiche la **carte de comparaison**, sans aucune touche :
  - en-tête : nom coloré, rareté, ilvl, palier, pictogramme ;
  - lignes d'affixes avec **▲ vert `#5BD17A` / ▼ rouge `#E8505B` / = gris** par rapport à l'objet équipé (formes doublées pour le daltonisme) ;
  - **deux résumés** : « **Frappe** ≈ +6 % » (DPS estimé sur le moveset actuel) et « **Tenue** ≈ −3 % » (Énergie effective estimée) ;
  - pouvoir légendaire en cuivre, progression d'Attelage « 2/4 ».
- **Actions sur un objet au sol** :

  | Action | Clavier | Manette | Tactile |
  |---|---|---|---|
  | **Équiper** (l'ancien objet va au sac, ou au sol si le sac est plein) | E | A | Bouton contextuel 56 px qui remplace Frappe hors combat |
  | **Mettre au sac** | Maintien E 400 ms | Maintien X 400 ms | Bouton « Sac » 44 px |
  | **Démonter** | Maintien F 500 ms | Maintien Y 500 ms | Bouton « Démonter » 44 px, avec anneau de maintien |

- **Sac de service : 4 cases.** Pourquoi 4 :
  - le rythme du GDD (45–70 s par salle) ne laisse pas de place à la gestion d'inventaire ;
  - 4 cases tiennent en **une ligne** d'icônes de 32 px sur mobile ;
  - 4 cases suffisent pour garder 1 ou 2 pièces de rechange (Attelage en cours, pièce de Nuit) ;
  - la contrainte **force des décisions**, qui sont le cœur du loot.
- **Écran Équipement** : **Tab**, ou l'icône de sac du HUD en tactile, ouvre l'onglet « Tenue ». Il présente le **héros 3D en rotation**, les 6 emplacements, les 4 cases du sac et le total des stats. Il est **éditable hors combat seulement**. En combat, il reste **consultable** sans pause, comme la carte actuelle. Manette : croix pour naviguer, A équiper, Y démonter (maintien), LB/RB pour passer d'un emplacement à l'autre.
- **Fin de Shift : écran « Consigne »**. Toutes les pièces (équipées et sac) sont alignées. On en sélectionne 1 (ou 2), avec le bouton « Ramener au Vestiaire » ; le reste affiche « → +37 Ferraille ». Délai : **15 s** au plus, présélection automatique de l'objet de plus haute rareté.

### 6.3 Vestiaire au hub (nouvelle station de l'OCC, près du couloir technique)
- **Lieu** : rangée de **casiers métalliques** et un **mannequin** qui porte le Paquetage en 3D. Le Vestiaire est tenu par le **gestionnaire d'équipement du hub** ; l'agent narration choisit le PNJ et l'emplacement. Josiane garde le mannequin de formation (§11 du GDD).
- **Disposition** :

  | Zone | Contenu |
  |---|---|
  | Gauche | Héros 3D en rotation (stick droit ou glisser) |
  | Centre | 6 emplacements de Paquetage, dont 1 à 3 actifs, plus le sélecteur de **type d'Outil de départ** |
  | Droite | Grille de **24 casiers** (6×4), avec filtres (emplacement, rareté, tag, Attelage), tri et **cadenas** (protège du démontage) |
  | Bas | Ferraille, bouton « Atelier », bouton « Archives » (codex des Plans : silhouettes pour les Patrimoines inconnus) |

- **Objectif** : moins de 30 s. Le **dernier Paquetage est mémorisé**, et « Prendre son poste » sans passer au Vestiaire réutilise le même.
- **Nouvelles revendications** (Tableau, en PS) :

  | Revendication | Effet | Coût |
  |---|---|---|
  | **Casier personnel** | +12 casiers par rang, 2 rangs | 100 / 200 PS |
  | **Paquetage** | +1 pièce de Paquetage par rang (1 → 3), 2 rangs | 150 / 350 PS |
  | **Consigne élargie** | +1 objet ramené | 250 PS ; demande 3 kills du Boss 1 |

---

## 7. Modèles de données (TypeScript) : `src/systems/loot/`

Système **pur** (sans Phaser), avec un aléatoire injecté (`Rng` de `src/utils/rng.ts`) et des valeurs dans `balance.ts`, sur le modèle de `Avantages.ts`. Seuls les types sont donnés ici ; les fonctions sont décrites sans implémentation.

### 7.1 Types

```ts
// src/systems/loot/types.ts
import type { FamilyId, HeroMods } from '@/systems/meta/Avantages';
import type { AttackStep } from '@/config/balance';

export type SlotId = 'outil' | 'casque' | 'gilet' | 'gants' | 'chaussures' | 'insigne';
export type ItemRarity = 'reforme' | 'reglementaire' | 'homologue' | 'hors-serie' | 'patrimoine';
export type WeaponType = 'cle' | 'masse' | 'pied-de-biche' | 'lanterne' | 'pelle' | 'perche';
export type DropSource = 'ennemi' | 'caisse' | 'dotation' | 'casier' | 'elite' | 'boss' | 'boss-premier' | 'friterie' | 'evenement';
export type AffixTag = 'frappe' | 'coup-final' | 'dash' | 'sifflet' | 'cafe' | 'burnout'
  | 'mobilisation' | 'defense' | 'mobilite' | 'elec' | 'controle' | 'nuit' | 'economie';
export type TierIndex = 0 | 1 | 2;

/** Stats que l'équipement peut modifier : HeroMods existants + nouvelles clés propres au loot. */
export interface GearMods extends HeroMods {
  attackSpeed: number; damageTakenReduction: number; burnoutOnHitMult: number; burnoutFloorMult: number;
  burnoutDecayBonus: number; meltdownMsBonus: number; meltdownPenaltyDelta: number;
  mobilisationGainMult: number; mobilisationOnRoomEnter: number; mobilisationOnHitTaken: number;
  coffeeBurnoutDelta: number; caffeineMsBonus: number; caffeineAttackSpeedBonus: number;
  finisherDamageMult: number; dashAttackDamageMult: number; dashRechargeMult: number;
  perfectDashNextHitBonus: number; whistleRadiusBonus: number; whistleDamageBonus: number;
  nightDamageBonus: number; lightRadiusBonus: number; energyOnRoomClear: number; ticketsMult: number;
  familyMult: Partial<Record<FamilyId, number>>;
}
export type GearStat = Exclude<keyof GearMods, 'familyMult'>;

export interface AffixTier {
  readonly min: number;
  readonly max: number;
  /** Pas d'arrondi (1 pour les px et l'Énergie, 0.01 pour les %). */
  readonly step: number;
}

export interface AffixDef {
  readonly id: string;                       // 'affute', 'de-la-releve'…
  readonly kind: 'prefix' | 'suffix';
  readonly label: string;                    // « affûté », « de la Relève »
  readonly group: string;                    // exclusivité sur un même objet
  readonly slots: readonly SlotId[];
  readonly tags: readonly AffixTag[];
  readonly weight: number;
  readonly stat: GearStat | 'familyMult';
  readonly op: 'add' | 'mult' | 'max';
  readonly tiers: readonly [AffixTier, AffixTier, AffixTier];
  /** S15 « de Solidarité » : la famille est tirée avec l'affixe. */
  readonly rollsFamily?: boolean;
  readonly describe: (value: number, family?: FamilyId) => string;
}

export interface ImplicitDef {
  readonly stat: GearStat;
  readonly op: 'add' | 'mult';
  readonly tiers: readonly [AffixTier, AffixTier, AffixTier];
}

export interface WeaponDef {
  readonly type: WeaponType;
  readonly combo: readonly AttackStep[];    // 2 à 4 coups
  readonly finisherIndex: number;
  readonly dashAttack: AttackStep;
  readonly baseCrit?: number;
  readonly traits: readonly WeaponTrait[];  // 'casse-projectiles' | 'anti-blindage' | 'posture-x1.5' | …
}
export type WeaponTrait = 'casse-projectiles' | 'anti-blindage' | 'posture-x1.5' | 'armure-final'
  | 'halo-nuit' | 'electrique' | 'knockback-x1.25';

export interface ItemDef {
  readonly id: string;                      // 'gants-manutention', 'cle-tire-fond'…
  readonly slot: SlotId;
  readonly name: string;                    // « Gants de manutention »
  readonly implicit: ImplicitDef;
  readonly weapon?: WeaponDef;              // seulement pour slot === 'outil'
  readonly dropWeight: number;
  readonly minIlvl: number;
  /** Débloqué par l'Atelier du hub (types d'Outil) ou par une quête. */
  readonly unlock?: 'depart' | `etabli:${WeaponType}` | `quete:${string}`;
  readonly meshId: string;                  // référence 3D (tech-art)
}

export type LegendaryPowerId = 'cliquet-perpetuel' | 'parade-wagon-bar' | 'derniere-traverse'
  | 'demonte-tout' | 'feu-rouge' | 'cocotte-minute' | 'comite-de-greve' | 'dernier-train'
  | 'thermos-inepuisable' | 'carnet-revendications' | 'haute-visibilite';

export interface LegendaryDef {
  readonly id: string;
  readonly baseId: string;                  // ItemDef imposée
  readonly name: string;
  readonly power: LegendaryPowerId;         // interprété par le gameplay (switch exhaustif)
  readonly drawback: Partial<GearMods>;     // contrepartie chiffrée quand elle est exprimable en mods
  readonly flavor: string;
}

export interface SetDef {
  readonly id: string;
  readonly name: string;
  readonly pieces: readonly string[];       // ItemDef ids
  readonly bonuses: readonly { readonly count: number; readonly mods: Partial<GearMods>; readonly special?: string }[];
}

/** Un affixe tiré : seule la qualité normalisée est sauvegardée. */
export interface AffixRoll {
  readonly affixId: string;
  readonly q: number;                       // [0, 1], au centième
  readonly family?: FamilyId;
}

export interface ItemInstance {
  readonly uid: string;                     // 'it-000123' (compteur méta, pas d'aléatoire)
  readonly defId: string;
  readonly rarity: ItemRarity;
  readonly ilvl: number;                    // plafond de puissance (1–30)
  readonly implicitQ: number;
  readonly affixes: readonly AffixRoll[];
  readonly legendaryId?: string;
  readonly setId?: string;
  readonly origin: { readonly source: DropSource; readonly shift: number; readonly room: number };
  readonly rerolls: number;                 // coût croissant du réaffûtage
  readonly locked: boolean;
}

/** Équipement d'une run (dans RunState). */
export interface GearLoadout {
  readonly equipped: Readonly<Record<SlotId, ItemInstance | null>>;
  readonly bag: readonly (ItemInstance | null)[]; // longueur 4
}

/** Compteurs de tirage d'une run. */
export interface LootRunState {
  slotBag: SlotId[];
  weaponBag: WeaponType[];
  sinceHomologue: number;
  dropIndexByRoom: Record<number, number>;
}

/** Ajout à MetaState (v2). */
export interface MetaLoot {
  readonly ferraille: number;
  readonly vestiaire: readonly ItemInstance[];
  readonly capacity: number;                // 24 + 12 × rang « Casier personnel »
  readonly paquetage: readonly string[];    // uids, longueur ≤ rang « Paquetage » + 1
  readonly startWeapon: WeaponType;
  readonly unlockedWeapons: readonly WeaponType[];
  readonly codex: readonly string[];        // Plans de Patrimoine découverts
  readonly pityPatrimoine: number;          // points (0–8)
  readonly welcomePatrimoineDone: boolean;
  readonly nextUid: number;
}
```

`MetaState` v2 devient `{ version: 2, ps, grains, pieces, upgrades, stats, loot: MetaLoot }`. Les **Pièces** sont aussi à ajouter, car le GDD les prévoit mais `MetaState` v1 ne les a pas.

### 7.2 Modules et fonctions (sans code)

| Fichier | Fonctions | Rôle |
|---|---|---|
| `catalog/items.ts`, `catalog/affixes.ts`, `catalog/legendaries.ts`, `catalog/sets.ts`, `catalog/weapons.ts` | Tables `ITEMS`, `AFFIXES`, `LEGENDARIES`, `SETS`, `WEAPONS` et index `*_BY_ID` | Données pures (les chiffres viennent de `balance.ts` → `LOOT`) |
| `ilvl.ts` | `itemLevel(r, source, shiftId)` · `tierOf(ilvl)` · `effectiveIlvl(item, r)` | Formules du §5.1 |
| `rarity.ts` | `rarityWeights(source, ctx)` · `rollItemRarity(rng, source, ctx)` · `applyPity(weights, pity)` | Tables du §5.3, décalages, plafond à 6 %, Réclamation et Ancienneté du butin |
| `roll.ts` | `drawSlot(rng, run)` (sac mélangé) · `pickBase(rng, slot, unlocked, ilvl, worn)` (aimant d'attelage) · `rollAffixes(rng, def, rarity, tagBias)` · **`rollItem(rng, ctx): { item, run, pity }`** | Pipeline complet, qui renvoie de **nouveaux** compteurs sans muter l'entrée |
| `values.ts` | `affixValue(affixDef, roll, ilvl)` · `implicitValue(item, r)` · `describeItem(item, r): string[]` | `lerp` puis arrondi au pas, au palier de l'ilvl **effectif** |
| `mods.ts` | `gearMods(loadout, r): Partial<GearMods>` · `setBonuses(loadout)` · `applyCaps(mods)` | Agrégation, puis plafonds du §3.6 en fin de chaîne |
| `equip.ts` | `equip(loadout, item)` → `{ loadout, displaced }` · `stash(loadout, item)` · `takeFromBag(loadout, index)` · `scrapValue(item)` | Opérations immuables |
| `compare.ts` | `compareItems(candidate, current, ctx): StatDelta[]` · `dpsEstimate(mods, weapon)` · `effectiveHpEstimate(mods)` | Carte de comparaison et résumés « Frappe » et « Tenue » |
| `drops.ts` | `killDropChance(kind)` · `dropsForKill(seed, room, kind, ctx)` · `dropsForSource(seed, room, source, ctx)` | Flux seedé : `roomRng(seed, room, 1000 + dropIndex)` ; le **compteur par salle** rend chaque tirage indépendant de l'ordre des autres systèmes (portes, gabarits) |
| `vestiaire.ts` | `consign(meta, run, uids)` · `buildPaquetage(meta)` · `reforge(meta, uid, affixIndex, rng)` · `polish(...)` · `raiseCap(...)` · `scrapFromVestiaire(...)` · `convertToPieces(meta)` | Toutes les dépenses vérifient les coûts et renvoient `{ ok, meta } \| { ok: false, reason }` comme `buyUpgrade` |
| `serialize.ts` | `isItemInstance(v)` · `sanitizeLoot(raw): { loot, scrapped }` · `migrateMetaV1toV2(raw)` | Robustesse des sauvegardes |

**Intégration** :
- `RunState.refreshMods()` suit l'ordre **méta → équipement → Avantages → `applyCaps`**.
- Le multiplicateur de famille (S15) agit sur le `mult` passé à `AvantageDef.apply`.
- `Weapon.sweep()` reste inchangée et reçoit la `SwingSpec` de `WEAPONS[type].combo[i]`, mise à l'échelle par le Calibre.
- Les pouvoirs légendaires sont des **hooks** nommés (`onComboLoop`, `onFinisher`, `onDashStart`, `onPerfectDash`, `onCupHold`, `onRoomCleared`, `onBurnoutReach`) appelés par le Player ou la RunScene et résolus par un `switch` exhaustif sur `LegendaryPowerId`.

### 7.3 Sauvegarde et migration

- **Schéma** : `metaSave` passe en `version: 2` avec `migrations: { 1: migrateMetaV1toV2 }`.
- **Migration v1 → v2** : garde `ps`, `grains`, `upgrades` et `stats`, puis ajoute `pieces: 0` et `loot` par défaut (`ferraille: 0`, `vestiaire: []`, `capacity: 24`, `paquetage: []`, `startWeapon: 'cle'`, `unlockedWeapons: ['cle']`, `codex: []`, `pityPatrimoine: 0`, `welcomePatrimoineDone: false`, `nextUid: 1`). **Rattrapage** : si `stats.bossKills ≥ 1`, la Masse est débloquée et `pieces` est crédité de la valeur du 1er kill (3), parce que v1 n'a jamais compté les Pièces.
- **Tolérance** : `SaveManager.validate` rejette aujourd'hui **toute** la sauvegarde au moindre écart. On ajoute un `sanitizeLoot()` **avant** la validation. Un objet dont la `defId`, un `affixId` ou un `legendaryId` est inconnu (contenu retiré par un patch) est **converti en Ferraille** au lieu de corrompre la méta, et la scène du hub affiche une notice (« 2 objets réformés par le service technique »). `q` est ramené dans [0, 1], et l'ilvl est borné à [1, 30].
- **Pourquoi sauvegarder `q` et pas la valeur** : un rééquilibrage des tables (balance.ts) s'applique aux objets existants sans migration, et les sauvegardes restent petites (≈ 120 octets par objet, 48 objets ≈ 6 Ko).
- **Run en cours** : elle n'est pas sauvegardée aujourd'hui (MVP). Si la reprise de run arrive plus tard, `GearLoadout` et `LootRunState` se sérialisent avec les mêmes validateurs.

### 7.4 Tests Vitest (`tests/loot.test.ts`, `tests/lootBalance.test.ts`)

1. **Déterminisme** : sur 1 000 graines, même `(seed, room, source, ctx)` → même `ItemInstance` (égalité profonde).
2. **Indépendance des flux** : les tirages de loot ne changent ni les portes ni les gabarits d'une graine (régression avec `procedural.test.ts`).
3. **Distribution des raretés** : 100 000 tirages par source, à ±0,5 pt de la table du §5.3 ; plafond Patrimoine de 6 % respecté.
4. **Structure** : nombre d'affixes conforme à la rareté ; au plus 2 préfixes et 2 suffixes ; aucun doublon de `group` ; chaque affixe est légal pour son emplacement ; un Patrimoine a son `baseId` imposé.
5. **Valeurs** : toujours dans `[min, max]` du palier, arrondies au pas ; bascules de palier exactes à ilvl 9/10 et 18/19.
6. **ilvl** : `itemLevel` correspond au tableau du §5.1 ; `effectiveIlvl` plafonne un objet ilvl 25 à 4 en salle 1 et le libère à r = 22.
7. **Pitié** : 5 objets sous Homologué, puis le 6e est au moins Homologué ; Ancienneté du butin +0,15 par objet, remise à 0 et plafond à 8 ; Prime de bienvenue au 3e kill du Boss 1 ; pitié gelée en Shift imposé.
8. **Sac d'emplacements** : en 6 tirages consécutifs, les 6 emplacements sortent une fois chacun.
9. **Plafonds** : 6 objets « du Quai » de palier III au maximum restent à −30 % ; même vérification pour le critique, la vitesse et la recharge du dash (§3.6).
10. **Budget de puissance (simulation)** : avec 1 000 tenues tirées à r = 9 et r = 27, `dpsEstimate` médian **×1,15–1,25** à r = 9 et **×1,35–1,50** à r = 27 ; la meilleure tenue possible reste **≤ ×1,65** (garde-fou du §8).
11. **Outils** : tableau piloté par les données, DPS mono-cible de chaque `WeaponDef` dans [44, 52] ; chaque forme est un `arc`, un `rect` ou un `radial` ; télégraphes héros jamais magenta (vérification de la table des couleurs de FX).
12. **Équiper, sac, démonter** : l'échange d'objets conserve l'objet déplacé ; avec le sac plein, l'objet tombe au sol ; les valeurs de Ferraille sont conformes au §5.5.
13. **Consigne** : 1 objet à la mort, 2 en victoire, +1 avec la revendication ; le reste est converti à 100 % ; les objets du Paquetage sont rendus intacts.
14. **Sérialisation** : aller-retour JSON identique ; la migration v1 → v2 préserve PS, Grains, rangs et stats ; un `affixId` inconnu est converti en Ferraille sans rejeter la sauvegarde ; une version 3 donne `too-new`.
15. **Légendaires** : le `switch` sur `LegendaryPowerId` est exhaustif (le test échoue si un pouvoir n'est pas géré) ; Cocotte-minute bloque bien le Burnout à 99 sans Pétage.

---

## 8. Impact sur l'équilibrage (`balance.ts`) et garde-fous

### 8.1 Nouvelles sections

| Section | Contenu |
|---|---|
| `LOOT` | Chances de drop par ennemi ; poids de rareté par source (§5.3) ; décalages (r, Nuit, Plan) ; `PATRIMOINE_CAP: 0.06` ; `B_SOURCE` et `B_ROULEMENT` ; `TIER_FROM: [1, 10, 19]` ; `EFFECTIVE_ILVL_SLACK: 3` ; pitié (`RECLAMATION_AFTER: 5`, `PITY_STEP: 0.15`, `PITY_CAP: 8`) ; `BAG_SIZE: 4` ; `GROUND_SCRAP_RATIO: 0.5` |
| `GEAR_CAPS` | Plafonds du §3.6 |
| `WEAPONS` | 6 `WeaponDef` ; **`COMBO` et `DASH_ATTACK` deviennent `WEAPONS.cle`** (alias conservés le temps de la transition) ; `CALIBRE_PER_ILVL: 0.012` |
| `SCRAP` | Valeurs du §5.5, coûts de l'Atelier du hub, conversion 25:1 |
| `VESTIAIRE` | Capacité 24 (+12/rang), Paquetage 1 (+1/rang), consigne 1 / 2, coûts en PS |
| `REWARD_WEIGHTS` | `avantage 34, dotation 12, tickets 14, (reglage 12), gobelet 12, ps 9, grains 7` ; `RewardKind` reçoit `'dotation'` |
| `SHOP` | `EQUIPEMENT: 140`, `WAGON_BAR_PATRIMOINE: 300` |

### 8.2 Répartition du budget de puissance

| Moment | Cible totale du GDD | Avant (Avantages + Réglages + méta) | **Après : Avantages + Réglages** | **Après : équipement** | Produit |
|---|---|---|---|---|---|
| Boss 1 (r = 9) | ≈ ×1,6 (80 DPS) | ×1,6 | **×1,35** | **×1,20** | ×1,62 |
| Boss 2 (r = 18) | ≈ ×2,2 | ×2,2 | ×1,65 | ×1,35 | ×2,23 |
| Fin de Shift (r = 27) | ≈ ×3 (TTK 2–3 coups) | ×2,5–3 | **×2,0** | **×1,45** | ×2,9 |

- **Leviers** : la baisse des Avantages passe par **moins de portes** (poids 40 → 34) et pas par une baisse de leurs valeurs, ce qui garde leur sensation. Les Réglages passent de 14 à 12. **Le scaling des ennemis (§3.7) ne bouge pas** : le TTK reste l'ancre.
- **Méta inchangée** (Clé chromée +20 %, Expresso +12 %). Elle entre dans le même seau additif, donc son poids relatif baisse un peu à mesure que l'équipement monte, et c'est voulu.

### 8.3 Garde-fous contre le power creep

1. **Plafond d'ilvl effectif** (`min(ilvl, r + 3)`) : le Vestiaire transporte un **build**, pas des chiffres. Un objet parfait ne rend pas la salle 1 triviale.
2. **Paquetage limité** à 1 pièce, 3 au maximum après investissement. Les 3 à 5 autres emplacements sont toujours trouvés pendant le Shift.
3. **Seau additif unique** pour les « +% dégâts » (Burnout, Avantages, méta, équipement : `damageBonus` de `Player.outgoingMods`). Seuls le critique, Vulnérable/Piquet et le Pétage restent multiplicatifs, comme aujourd'hui.
4. **Plafonds par stat** (§3.6) appliqués en dernier (`applyCaps`).
5. **Paliers liés aux biomes** et pas au nombre de runs : aucune stat ne grandit avec le temps de jeu seul.
6. **Légendaires en sidegrade** : chaque pouvoir a une contrepartie, aucun n'est un « +X % » brut.
7. **Plan d'Économies** : il donne de la rareté, jamais de l'ilvl. **Délégué de terrain** ne s'applique qu'aux Avantages, pas au loot, pour éviter un double bonus méta.
8. **Économie séparée** : la Ferraille n'achète **que** de la manipulation d'objets. Elle ne se convertit qu'en Pièces, une fois par Shift. « du Délégué » ne touche que les Tickets.
9. **Test de simulation en CI** (§7.4, test 10) : toute modification d'une table qui fait passer la meilleure tenue au-dessus de ×1,65, ou la médiane hors de sa fourchette, casse la CI.
10. **Mode « Congé maladie »** : inchangé, et indépendant de l'équipement (pas d'objets « faciles »).

### 8.4 Télémétrie de playtest
- Taux de remplacement par emplacement.
- Rareté portée au boss 1.
- Part des runs avec Patrimoine.
- Choix de consigne (quel emplacement).
- Ferraille dépensée et stockée.
- TTK médian d'un Junior à r = 1, 9 et 27 (cible 3, puis 2 à 3 coups).

---

## 9. Découpage proposé

| Lot | Contenu | Dépendances |
|---|---|---|
| **Loot 1 (avec le MVP biome 1)** | Système pur et tests ; 6 emplacements, 1 base par emplacement ; Outils **Clé, Masse, Pied-de-biche** ; 4 raretés et Patrimoine ; **20 affixes** ; **4 légendaires** (L1, L6, L8, L10) ; sac de 4 ; carte de comparaison ; consigne de 1 ; Vestiaire de 24 ; Ferraille et démontage ; porte Dotation ; MetaState v2 | Rendu 3D des pièces (le tech-art fournit `meshId`) |
| **Loot 2 (v1)** | 3 bases par emplacement ; Lanterne et Pelle ; 34 affixes ; L2–L5, L7, L9, L11 ; Attelages ; Atelier du hub (réaffûtage, polissage, remise à niveau) ; événement « Objets trouvés » ; revendications du Vestiaire | Biome 2 |
| **Loot 3 (v2)** | Perche isolante et Attelage de caténaire ; Wagon-Bar Patrimoine ; codex complet | Biome 3 |

---

## 10. Points d'attention pour l'équipe

- **Noms réels** : selon l'utilisateur, il détient les droits pour **SNCB** (le dash « Retard SNCB » reste) et pour **Calatrava**. La caricature d'**Elio Di Rupo** (§11) fait exception à la règle « jamais une personne réelle » du §1 du GDD. Il faut mettre à jour cette règle et archiver l'autorisation écrite (voir §11.4). En dehors de ces trois cas, aucun nom de ce document ne renvoie à une personne ni à une marque réelle.
- **3D** :
  - chaque `ItemDef.meshId` doit avoir sa variante de matériau par rareté (5 matériaux partagés et non 5 × N modèles) ;
  - les ennemis gardent leur turquoise ;
  - les faisceaux et les effets du héros n'utilisent jamais le magenta ;
  - les hurtboxes et hitboxes restent dans le plan du sol, si bien que le loot n'a aucun impact sur `geometry.ts`.
- **Rythme du hub** : le Vestiaire ajoute une étape. La mémorisation du Paquetage et la présélection de la consigne tiennent la cible du GDD d'**un passage entre deux runs en moins de 90 s**.

---

## 11. Nouveaux ennemis majeurs

> Ajout demandé par l'utilisateur. Les règles du GDD s'appliquent à toutes ces attaques :
> - tout ce qui blesse est **magenta `#FF3EA5`** et télégraphié pendant au moins **700 ms** pour une élite ou un mini-boss, **800 ms** pour un boss ;
> - chaque attaque laisse une **fenêtre de punition** ;
> - les zones sont des **arcs, cercles, anneaux et rectangles orientés dans le plan du sol** ;
> - les modèles sont en 3D, mais les hurtboxes restent des cercles au sol.
>
> **Scaling** : l'élite et le mini-boss suivent `PV(r)` et `Dégâts(r)` du §3.7, comme le Manager KPI. Le boss a des valeurs **fixes**, comme l'Auditeur. Tous les chiffres sont des **valeurs de base** pour le playtest.

### 11.0 Nouveau type de salle : « Salle gardée » (mini-boss)
- **Disponibilité** : à partir du biome 2.
- **Place** : elle remplace la salle Élite garantie (positions 5 à 7) avec **35 %** de chances, et reste au plus 1 par biome.
- **Porte** : cadre doré et pictogramme du mini-boss sur l'écran des départs, par exemple `EXTRA 2000 → SALLE GARDÉE — RETARD +20`.
- **Contenu** : le mini-boss seul, plus de petites vagues d'escorte (budget ×0,6) aux seuils de PV.
- **Récompense** : butin du §11.1.6, 20 PS et −15 Burnout.

### 11.1 Le Discosaure (mini-boss, biome 2 « La Passerelle », puis élite rare du biome 3)

**Fiche.**
- **Lore** : animatronique géant de la soirée d'entreprise « Afterwork de la Transformation » de Privatix, annulée faute de créneau (le Sondage éternel). Il a été oublié sous la verrière de la passerelle et tourne encore en boucle.
- **Physique** : dinosaure massif, avec une **boule à facettes** de 1 m enchâssée dans le dos.
- **Pourquoi la passerelle** : la lumière de la verrière et le vide donnent aux taches lumineuses un vrai enjeu de placement.
- **Combat visé** : 45 à 70 s. Pas de knockback, et étourdi seulement dans ses fenêtres.

#### 11.1.1 Stats (format `balance.ts`)
```ts
export const DISCOSAURE = {
  hp: 560,            // r = 13 : ≈ 1 100 PV
  speed: 70,
  hurtRadius: 22,
  hurtOffsetY: 24,
  mass: 0,
  cost: 0,            // salle gardée : hors budget
  tickets: 40,
  superArmor: true,
  /** Dos (boule à facettes) : arc arrière de 90°, dégâts ×1,5. */
  BACK_ARC_DEG: 90, BACK_MULT: 1.5,
  PHASE_AT: [0.5] as const,
  PATTERN_GAP_MS: [1400, 1100] as const,
  /** Facettes : taches de lumière en orbite autour de lui. */
  SPOTS: { count: 6, countP2: 10, radius: 20, orbitMin: 64, orbitMax: 160, turnDegPerS: 25, turnDegPerSP2: 40,
           armMs: 800, tickMs: 500, damage: 3, lifeMs: 6000, periodMs: 9000 },
  /** « Sous les projecteurs » : taches blanches inoffensives. */
  LIMELIGHT: { count: 3, radius: 24, burnoutPerS: 2, damageBonus: 0.1 },
  TAIL: { telegraphMs: 800, arcDeg: 180, radiusPx: 72, damage: 12, knockbackPx: 48, recoveryMs: 700 },
  STOMP: { telegraphMs: 900, radiusPx: 56, damage: 14, waveMaxPx: 140, waveExpandMs: 700, waveThickness: 12, waveDamage: 8, recoveryMs: 600 },
  CHARGE: { telegraphMs: 1000, distancePx: 240, durationMs: 600, widthPx: 40, damage: 14, dizzyMs: 1200, dizzyDamageTaken: 0.25 },
  LASERS: { telegraphMs: 1000, count: 4, lengthPx: 300, widthPx: 8, turnDegPerS: 30, durationMs: 3000, damage: 6, cooldownMs: 12000 },
  WHISTLE_FREEZE_MS: 3000, PREAVIS_BLACKOUT_MS: 5000, STUN_WHISTLE_MS: 600, STUN_PREAVIS_MS: 1200,
} as const satisfies EnemyStats & Record<string, unknown>;
```

#### 11.1.2 Attaques

| Attaque | Télégraphe | Zone au sol | Effet | Récupération et punition |
|---|---|---|---|---|
| **Facettes** (signature) | 800 ms : les taches apparaissent en **contour** coloré, puis se remplissent de **magenta** | 6 **cercles r 20** en orbite entre 64 et 160 px, rotation 25°/s, durée 6 s | 3 dégâts (×r) toutes les 0,5 s dans une tache | Pas de récupération (pattern de fond, toutes les 9 s). Ses autres attaques passent pendant ce temps |
| **Coup de queue** | 800 ms : la queue se lève, **demi-cercle arrière** magenta | **Arc r 72, 180°**, orienté vers l'arrière (contre les joueurs qui tournent autour) | 12 dégâts, knockback 48 px | **700 ms** immobile, le dos (boule) est exposé, donc ×1,5 |
| **Piétinement de piste** | 900 ms : il lève les deux pattes, cercle plein, puis anneau | **Cercle r 56** centré sur lui, puis **anneau** de 0 à 140 px en 700 ms, épaisseur 12 | 14 dégâts au centre, 8 dans l'anneau (se traverse au dash) | 600 ms |
| **Charge de fin de soirée** | 1 000 ms : il gratte le sol, **rectangle** magenta de 240×40 | **Rectangle orienté 240×40** | 14 dégâts. S'il percute un mur : **étourdi 1 200 ms**, +25 % de dégâts subis | **Fenêtre principale** : on l'attire contre un mur. Sur la passerelle, une rambarde suffit, il ne tombe pas dans le vide |
| **Lasers stroboscopiques** (phase 2) | 1 000 ms : 4 lignes de visée magenta de 1 px | 4 **rectangles 300×8** en croix, rotation 30°/s, durée 3 s | 6 dégâts au contact (puis i-frames) | Il est immobile pendant les 3 s : on frappe le dos en suivant la rotation |

- **Phase 2 « Boule en surchauffe »** (sous 50 % de PV) : 10 facettes à 40°/s, Lasers ajoutés, délai entre deux patterns de 1 100 ms. Au seuil de 50 %, 3 Consultants Juniors montent sur la piste en escorte.

#### 11.1.3 Interactions avec les mécaniques signature

| Mécanique | Interaction |
|---|---|
| **Burnout** | « **Sous les projecteurs** » : 3 taches **blanches** (non magenta) n'infligent rien, mais tant qu'on se tient dedans on prend **+2 Burnout/s et +10 % de dégâts**. C'est un choix de risque volontaire, qui illustre le pilier « Plus fort, plus fragile » |
| **Coup de sifflet** | « **La musique s'arrête** » : les Facettes **se figent** pendant 3 s ; le boss n'est étourdi que 0,6 s |
| **Préavis de grève** | « **Coupure de courant** » : la boule s'éteint **5 s** (plus aucune tache), il est étourdi 1,2 s et marqué Piquet |
| **Dash** | Les taches et l'anneau du Piétinement se traversent avec les i-frames. Un **dash parfait** sur la Charge le fait trébucher : étourdi 1 200 ms même sans mur |

#### 11.1.4 Butin
- **Chaque victoire** : **2 objets**, dont au moins un **Homologué**, et 25 % de Hors-série pour le second (ilvl r + 2).
- **1er kill** : un Hors-série garanti, et le Plan du légendaire **L12 « Boule à facettes de poche »** (Insigne) :
  - **Effet** : chaque **dash parfait** pose 3 taches de lumière **orange** (alliées) pendant 4 s, qui infligent 6 dégâts toutes les 0,5 s aux ennemis ;
  - **Contrepartie** : Mobilisation gagnée par les dégâts −15 %.

### 11.2 Le Furet putride (élite, biome 1 « Quais & Voies », et biome 2)

**Fiche.**
- **Lore** : la « solution de dératisation externalisée » de Privatix. Un furet géant lâché dans les caniveaux techniques pour chasser les rats, devenu ingérable, qui sent si fort que les annonces de quai ont dû être sous-titrées.
- **Place** : élite **alternative au Manager KPI** à partir de r = 5. Il est tiré à 40 % dans la salle Élite (Manager 60 %).
- **Combat** : rapide, fuyant, et il se faufile **sous les quais**. C'est un contrepoint au Manager, qui reste immobile.

#### 11.2.1 Stats
```ts
export const FURET = {
  hp: 200,            // r = 5 : 264 PV ; r = 8 : 312
  speed: 120,
  hurtRadius: 12,
  hurtOffsetY: 10,
  mass: 0.7,
  cost: 8,
  tickets: 15,
  superArmor: false,  // le « poil hérissé » ne protège que pendant le Bond
  PHASE_AT: [0.3] as const,           // « Acculé »
  FRENZY_SPEED_MULT: 1.25,
  BITE: { rangePx: 36, telegraphMs: 700, arcDeg: 70, reachPx: 36, damage: 9, knockbackPx: 20, recoveryMs: 600 },
  POUNCE: { minPx: 80, maxPx: 160, telegraphMs: 750, distancePx: 140, durationMs: 350, landRadiusPx: 28, damage: 11,
            recoveryMs: 900, recoveryDamageTaken: 0.25, cooldownMs: 5000 },
  STINK: { telegraphMs: 800, radiusPx: 48, radiusFrenzyPx: 64, lifeMs: 6000, driftSpeed: 12, maxClouds: 3,
           burnoutPerS: 6, blocksCalmDecay: true, periodMs: 7000 },
  BURROW: { telegraphMs: 600, hiddenMinMs: 1500, hiddenMaxMs: 3000, trailSpeed: 160, emergeRadiusPx: 32,
            emergeTelegraphMs: 700, damage: 12, recoveryMs: 800, cooldownMs: 10000 },
  WHISTLE_STUN_MS: 1200, WHISTLE_CLEAR_RADIUS_BONUS: 24,
} as const satisfies EnemyStats & Record<string, unknown>;
```

#### 11.2.2 Attaques

| Attaque | Télégraphe | Zone au sol | Effet | Récupération et punition |
|---|---|---|---|---|
| **Morsure** (≤ 36 px) | 700 ms : babines retroussées, **arc** magenta | **Arc r 36, 70°** | 9 dégâts, knockback 20 px | 600 ms |
| **Bond** (80–160 px) | 750 ms : il se ramasse, **ligne magenta de 140 px** et **cercle r 28** à l'arrivée | Trajectoire, puis **cercle r 28** à l'atterrissage | 11 dégâts. Le poil hérissé le rend **non interruptible** pendant le bond | **900 ms** sur le flanc, +25 % de dégâts subis : **fenêtre principale** |
| **Nuage de puanteur** | 800 ms : il se secoue, **cercle hachuré magenta** r 48 qui se remplit | **Cercle r 48** (r 64 en phase « Acculé »), dérive à 12 px/s, dure 6 s, 3 au plus | **Aucun dégât**, mais **+6 Burnout/s** et la récupération passive est **bloquée** dans le nuage | Pendant qu'il se secoue (800 ms), il est immobile et punissable |
| **Se faufile sous les quais** | 600 ms : il plonge sous le bord du quai | **Invulnérable** et invisible 1,5 à 3 s ; une **traînée de poussière en pointillés magenta** suit sa position sous le quai | Il ressort sous le héros : **cercle r 32** télégraphié **700 ms**, 12 dégâts | **800 ms** hors du trou, étourdi par la lumière |

- **Phase « Acculé »** (sous 30 % de PV) : vitesse ×1,25, nuages plus grands, Se faufiler revient toutes les 7 s.
- **Rames** : comme pour le Manager, une rame lui inflige 40 % de ses PV max. Il évite les voies **sauf** quand il se faufile, ce qui permet de l'attirer sous une voie juste avant le passage d'une rame.

#### 11.2.3 Interactions avec les mécaniques signature

| Mécanique | Interaction |
|---|---|
| **Burnout** | Les nuages sont la **menace principale** : ils ne font pas de dégâts mais poussent vers le Pétage de plombs. À sa mort, « **Bol d'air** » : tous les nuages disparaissent et l'on gagne **−10 Burnout** en plus des −10 d'une élite |
| **Coup de sifflet** | Il déteste le bruit : stun **1,2 s** au lieu des 0,4 s d'une élite. S'il est sous le quai, il est **débusqué** sur place et étourdi. Le sifflet **disperse les nuages** dans son rayon +24 px |
| **Préavis de grève** | Disperse **tous** les nuages de la salle |
| **Dash** | Un **dash parfait** sur le Bond le retourne sur le dos : étourdi 1 s. Traverser un nuage en dash limite l'exposition, mais chaque dash coûte quand même +2 Burnout |

#### 11.2.4 Butin
- **Chaque victoire** : le butin d'élite du §5.2, soit 1 objet au moins Réglementaire, plus 25 % de chances d'un second. Il rapporte aussi 20 de Mobilisation, 15 Tickets et −20 Burnout (−10 d'élite et −10 de Bol d'air).
- **Emplacement biaisé** : le sac mélangé favorise **Gants** et **Casque** (poids ×2).
- **1er kill** : 1 objet Homologué garanti. Clin d'œil : sa base s'appelle « Gants du dératiseur », une variante des Gants de manutention à l'odeur tenace.

### 11.3 Elio Di Rupo (ennemi du jeu : boss du biome 3 « Hall & BAG », v2)

#### 11.3.1 Principes de traitement : satire bon enfant
- **C'est un ennemi à part entière**, combattu comme un boss, avec des assets générés à partir de ses traits (caricature). Le jeu ne lui prête cependant **aucune position politique** qu'il n'aurait pas : ni soutien à la privatisation, ni rôle chez Privatix. C'est le moyen le plus sûr de garder la satire défendable. La satire vise son **image publique** : nœud papillon, sens de la formule, longs discours, promesses, inaugurations, attachement à Mons.
- **Situation** : il est venu **inaugurer la nouvelle gare** et ne lâchera pas le micro avant d'avoir coupé le ruban. Le héros doit « **obtenir la parole** » pour passer.
- **Ressorts comiques** : le combat est un **duel oratoire**. Il est **vaincu, jamais tué** : à 0 PV, son « **temps de parole est épuisé** ». Il coupe enfin le ruban sous les confettis, déclare la gare « inaugurée… provisoirement », serre la main du héros et sort en saluant. Aucune animation de mort ni de souffrance.
- **Interdits** :
  - pas de blague sur l'accent, les origines, l'orientation sexuelle ou la vie privée ;
  - pas de corruption ou de scandale inventé ;
  - pas de citation fabriquée présentée comme réelle (toutes ses répliques sont **fictives et marquées comme telles**) ;
  - pas de logo de parti.
- **Lieu** : le **Hall d'inauguration**, un hall historique en travaux, avec pupitre, ruban tendu entre deux poteaux et rangées de chaises. L'arène mesure 52×30 tuiles.
- **Accès** : une **porte « RUBAN »** (cadre tricolore et ciseaux) remplace la salle Élite du biome 3 une fois que le Boss 2 a été vaincu au moins une fois. Ce combat vise **2 min 30** et ne remplace pas le boss final. Je le propose **optionnel**, mais il peut devenir un passage **obligatoire** (par exemple à la place de la salle Élite du biome 3) si l'équipe le veut central.

#### 11.3.2 Stats
```ts
export const DI_RUPO = {
  hp: 3200,           // fixe (pas de r), × S_* et P_*
  speed: 55,
  hurtRadius: 18,
  hurtOffsetY: 22,
  mass: 0,
  cost: 0,
  tickets: 60,
  superArmor: true,
  SPEEDS: [55, 60, 70] as const,
  PATTERN_GAP_MS: [1500, 1250, 1050] as const,
  PHASE_AT: [0.6, 0.25] as const,
  PHASE_TRANSITION_MS: 1500,          // invulnérable : « Je serai bref. »
  P3_TELEGRAPH_MULT: 0.85,            // jamais < 800 ms
  BOWTIE: { telegraphMs: 900, outPx: 220, speed: 260, radiusPx: 8, damage: 12, recoveryMs: 600 },
  PROMISES: { count: 5, telegraphMs: 1500, bubbleRadiusPx: 24, burstRadiusPx: 40, damage: 14,
              keptMobilisation: 5, keptBurnout: -3, periodMs: 10000 },
  BALLOTS: { telegraphMs: 800, count: 12, onHero: 3, radiusPx: 16, damage: 8, periodMs: 8000 },
  SPEECH: { telegraphMs: 1000, durationMs: 4000, ringEveryMs: 1000, ringMaxPx: 200, ringExpandMs: 1000,
            ringThickness: 12, ringGapDeg: 40, gapTurnDegPerS: 45, damage: 10, backDamageTaken: 0.25,
            heroCalmDecayMult: 2, interruptStunMs: 2000 },
  MOTIONS: { telegraphMs: 1000, lanes: 3, laneLengthPx: 400, laneWidthPx: 24, damage: 16, recoveryMs: 800, periodMs: 9000 },
  RIBBON: { telegraphMs: 1200, lengthPx: 600, widthPx: 10, advanceSpeed: 30, damage: 12, rootSlow: 0.5, rootMs: 1000,
            cutStunMs: 3000, cutDamageTaken: 0.25, periodMs: 18000 },
  SCISSORS: { telegraphMs: 1100, arcDeg: 160, radiusPx: 96, damage: 22, recoveryMs: 900, periodMs: 7000 },
  PREAVIS_TALKS_MS: 4000,             // « Concertation sociale »
} as const satisfies EnemyStats & Record<string, unknown>;
```

#### 11.3.3 Attaques

| Attaque | Télégraphe | Zone au sol | Effet | Récupération et punition |
|---|---|---|---|---|
| **Nœud papillon boomerang** | 900 ms : il ajuste son nœud, **ligne magenta courbe** aller-retour | Projectile **cercle r 8**, 220 px à l'aller et retour à 260 px/s | 12 dégâts à l'aller et au retour | **600 ms** sans nœud : il le rattrape, la garde baissée |
| **Promesses** | 1 500 ms : 5 bulles dorées se posent, chacune avec un **contour magenta qui se remplit** | 5 **cercles r 24**, qui éclatent en **cercle r 40** | 14 dégâts à l'éclatement (« promesse non tenue ») | Frapper une bulle avant qu'elle éclate la fait disparaître : « **promesse tenue** », +5 Mobilisation et −3 Burnout |
| **Pluie de bulletins** | 800 ms par marqueur : 12 cercles magenta, dont 3 sous le héros | 12 **cercles r 16** | 8 dégâts par bulletin (papier qui virevolte) | Il compte les voix pendant 700 ms, immobile |
| **Grand discours** (phase 2) | 1 000 ms : il monte au **pupitre**, « Mesdames et Messieurs… » | Pendant 4 s, un **anneau** toutes les secondes, de 0 à 200 px, épaisseur 12, avec une **brèche de 40°** (« pause pour applaudissements ») qui tourne à 45°/s | 10 dégâts par anneau. On passe par la brèche ou au **dash** | Immobile pendant 4 s ; dans le **dos**, +25 % de dégâts |
| **Motions de procédure** | 1 000 ms : 3 **couloirs** magenta parallèles de 400×24 | 3 **rectangles orientés** 400×24 | 16 dégâts : des piles de motions s'abattent le long des couloirs | 800 ms |
| **Ruban d'inauguration** (signature, phase 2 et 3) | 1 200 ms : deux poteaux se plantent, **ruban magenta** tendu entre eux | **Rectangle 600×10** qui avance vers le héros à 30 px/s | 12 dégâts au contact et **entrave** (ralenti 50 % pendant 1 s) | **Couper le ruban** avec un **coup final** ou une **dash-attaque** donne « **Inauguration ratée** » : il est **étourdi 3 s**, avec +25 % de dégâts subis. C'est la fenêtre principale, sur le modèle du chariot de l'Auditeur |
| **Ciseaux d'inauguration** (phase 3) | 1 100 ms : il brandit des ciseaux géants, **demi-cercle** magenta | **Arc r 96, 160°** | 22 dégâts. Les ciseaux claquent dans le vide, l'effet est comique et non violent | 900 ms |

#### 11.3.4 Phases

| Phase | PV | Patterns | Réplique (fictive) |
|---|---|---|---|
| **1 « La première pierre »** | 100 → 60 % | Nœud papillon, Promesses, Bulletins | « Je vous ai compris. Enfin, je vous comprendrai après le discours. » |
| Transition | 60 % | 1,5 s, invulnérable | « Je serai bref. » (il ne l'est pas) |
| **2 « Le grand discours »** | 60 → 25 % | Grand discours, Motions, Ruban, plus la phase 1 | « Et pour conclure… premièrement… » |
| **3 « Inauguration officielle »** | < 25 % | Tout, avec des télégraphes ×0,85 (jamais sous 800 ms), deux Rubans croisés et les Ciseaux | « Cette gare sera inaugurée. Aujourd'hui, ou à une date ultérieure. » |
| **Défaite** | 0 % | « Temps de parole épuisé » : il coupe le ruban, sous les confettis et une fanfare, puis sort en saluant | « Merci. On se reverra à la prochaine inauguration ! » |

#### 11.3.5 Interactions avec les mécaniques signature

| Mécanique | Interaction |
|---|---|
| **Burnout** | Pendant le **Grand discours**, la récupération passive du héros est **×2** : on décroche, ce qui sert à préparer un Pétage contrôlé. Les **promesses tenues** rendent −3 Burnout |
| **Coup de sifflet** | « **Rappel au règlement** » : pendant le Grand discours, le sifflet l'**interrompt**, et il est étourdi **2 s**. Le reste du temps, comme pour un boss : dégâts seulement, sans stun |
| **Préavis de grève** | « **Concertation sociale** » : il pose le micro et négocie. Aucune attaque pendant **4 s**, il est marqué Piquet (+15 %) |
| **Dash** | Les anneaux, bulletins et motions se traversent au dash. Le **ruban ne se traverse pas** (entrave), sauf avec un **dash parfait**, qui le fait passer dessous et le **coupe** : étourdi 3 s, comme une coupe à la Frappe |

#### 11.3.6 Butin
- **Chaque victoire** :
  - **3 objets** au moins Homologués (ilvl r + 3, donc palier III) ;
  - 40 PS, 8 Grains, 1 Pièce.
- **1er kill** :
  - un Hors-série garanti, 1 Tasse et 3 Pièces ;
  - le Plan du légendaire **L13 « Nœud papillon de cérémonie »** (Insigne) :
    - **Effet** : au début de chaque salle de combat, on reçoit une **Promesse**, un bouclier qui absorbe un coup. Si elle n'a pas servi à la fin de la salle : « **promesse tenue** », +15 Mobilisation ;
    - **Contrepartie** : Énergie max −10.

### 11.4 Intégration et précautions
- **`EnemyKind`** reçoit `'discosaure' | 'furet' | 'diRupo'`, ajoutés à `ENEMY_STATS` et `ENEMY_NAMES`. `RoomType` reçoit `'gardee'`.
- **Test** : le test de « table des télégraphes » du §13.2.19 du GDD s'étend à ces trois ennemis, avec au moins 700 ms (élite et mini-boss) et 800 ms (boss).
- **Lisibilité** :
  - les taches **blanches** « Sous les projecteurs » et les taches **orange** de L12 ne sont jamais magenta ;
  - le nuage du Furet porte un **contour magenta hachuré** parce qu'il nuit, même sans infliger de dégâts ;
  - en mode « Réduction des mouvements », les Facettes ne clignotent pas (stroboscope désactivé : **risque photosensible**, les lasers deviennent des lignes fixes qui tournent).
- **Personne réelle (Elio Di Rupo)** :
  - l'utilisateur affirme avoir les droits, mais je ne peux pas le vérifier. Je recommande d'**archiver l'autorisation écrite** (droit à l'image et au nom) dans le dépôt de la production, hors du repo public ;
  - la **règle du §1 du GDD** (« jamais une personne réelle ») doit être amendée explicitement pour ce cas ;
  - garder un **nom et un modèle de repli** fictifs (« Le Bourgmestre au nœud papillon ») activables par un drapeau de configuration, au cas où l'autorisation tomberait ou pour une distribution hors de Belgique.
