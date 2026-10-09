# PRIVATIX — Game Design Document

> **Version** : 1.0 (Phase 1, consolidée) · **Rôle** : Game Designer · **Moteur** : Phaser 4.2 + TypeScript 5.9 + Vite 7
> **Références croisées** : `STORY_AND_LORE.md` (noms, lieux, dialogues : il fait foi sur le récit), `ARCHITECTURE.md` (implémentation), document UX/UI (écrans, HUD, contrôles).
> **Règle de priorité** : pour tout **chiffre d'équilibrage** (Fatigue, Moral, PE, Tickets, PV, formules), **ce GDD fait foi**. Toutes les valeurs de l'annexe sont transposées telles quelles dans `src/config/balance.ts`.
> Tous les personnages, entreprises et documents sont fictifs.

---

## 1. Fiche d'identité

| Élément | Décision |
|---|---|
| **Titre** | Privatix |
| **Genre** | RPG 2D au tour par tour, exploration en vue de dessus (tuiles 16 px), combats en vue de côté |
| **Plateforme** | Web (navigateur), desktop et mobile (paysage), résolution logique 960×540 |
| **Durée** | 3 à 5 h (chemin critique ≈ 4 h ; 100 % ≈ 5 h) |
| **Public** | Ados et adultes (12+), joueurs de RPG « courts » ; clins d'œil pour navetteurs, cheminots et Montois |
| **Ton** | **Gameplay sérieux, lore satirique.** Le monde est absurde, les personnages ne le sont pas. |
| **Langue** | Français (textes centralisés pour une traduction ultérieure) |

**Pitch (3 lignes)**
1. Mons, lundi 4h47 : Léon (ou Léa), agent·e de gare en 3x8, apprend que le train de 7h12 de sa grand-mère est supprimé « pour optimisation ».
2. Derrière un distributeur « HORS SERVICE », l'OCC (Operation Coffee Center) réunit les cheminots qui refusent le Plan Horizon Rentabilité 2030 de Privatix Rail Solutions.
3. Trois pauses — Matin, Après-midi, Nuit — pour rallier les collègues, réunir les preuves et empêcher la signature de la cession au BAG, mardi à 5h00.

**Piliers de design**

| # | Pilier | Ce que ça veut dire en jeu | Ce qu'on s'interdit |
|---|---|---|---|
| 1 | **Le temps est une ressource** | Horloge 3x8 + Fatigue partagée : chaque combat, chaque détour, chaque sieste a un coût. Le boss se joue à 5h00, fatigué. | Le grind gratuit, sans conséquence |
| 2 | **La solidarité est une mécanique** | Le Moral collectif fait les fins, la résistance aux statuts et les critiques. On recrute, on aide, on ne laisse personne sur le quai. | Le héros solitaire tout-puissant |
| 3 | **Le terrain bat le PowerPoint** | Chaque ennemi a une faiblesse « concrète » (Question concrète, Ponctualité réelle, Le Règlement, le Café de l'OCC). Lire l'ennemi > frapper fort. | Les combats « spam attaque » |
| 4 | **Lisible et testable** | Règles = fonctions pures + constantes dans `balance.ts` + données JSON/TS ; RNG injecté. Combats courts (1 à 3 min). | Les valeurs magiques dans les scènes |

## 2. Boucles de jeu

### 2.1 Boucle principale (core loop)

```
        ┌──────────────────── OCC (hub) ────────────────────┐
        │ Sauvegarde · Soin complet · Café gratuit (1×/pause)│
        │ Tasse de Relève · Améliorations · Équipe · Moral   │
        └───────────────┬───────────────────────────────────┘
                        ▼
      Sortie en zone (Gare / Ville / BAG) — la pause en cours
      fixe les ennemis, les PNJ, les boutiques et les primes
                        ▼
      Explorer → Combattre → Tickets, XP, Grains, matériaux
      Quêtes principales et secondaires → Moral
                        ▼
      La Fatigue monte (horloge + combats) → DÉCISION :
      pousser (malus croissants)  OU  rentrer à l'OCC (temps)
                        ▼
      Retour OCC → récupérer, améliorer, sauvegarder → repartir
```

| Échelle | Durée réelle | Décisions du joueur |
|---|---|---|
| **Micro — combat** | 1 à 3 min | PE, statuts, ordre des tours, faiblesses, palier de Fatigue |
| **Méso — sortie** | 10 à 20 min | Jusqu'où pousser avant de rentrer ; quelles quêtes avant la relève |
| **Macro — acte (= 1 pause)** | 1 h à 1 h 45 | Recrutements, upgrades, quêtes secondaires (Moral), préparation de l'acte suivant |

### 2.2 Boucle de session (joueur mobile, 20 à 40 min)

`Charger à la Vieille Dame → Tableau des missions (objectif + heure) → 1 à 2 sorties (5 à 8 combats, 1 étape de quête) → retour OCC → café / upgrade → sauvegarde → quitter.`
Sauvegarde automatique à chaque entrée à l'OCC et à chaque changement d'acte ; manuelle à la machine (1 emplacement auto + 3 manuels).

## 3. Le monde et les zones

Toute l'aventure tient en **une journée de roulement** : du lundi 4h47 au mardi 7h12. **Un acte = une pause** (voir §10).

### 3.1 Zone 1 — Gare de Mons & Calatrava (hub, ~80×50 tuiles)

| Sous-zone | Contenu gameplay | PNJ / points d'intérêt |
|---|---|---|
| **Quais & Passerelle** | Tutoriel, rencontres visibles, chariots à pousser, voies électrifiées (dégâts), portiques à badge, barrières « Travaux Infrabel » (Kevin, Acte II) | Josiane (quai 2), Rudy (passerelle), banc de Marcel, pigeon Matricule 4412, écran des départs = journal de quêtes, voie 4 (Fantôme) |
| **Hall / Passage commercial** | Boutique (kiosque), guichet de Béné (« file éternelle » : donjon secondaire), chantier « Corner Expérience Voyageur » | Béné, distributeurs (Expresso), voyageurs à renseigner, carte des vins de 1994 |
| **Salle des pauses** | Pointeuse (salaire de pause), ragots-indices, défense du micro-ondes (Acte II) | Fatou (Acte II), tableau des roulements, tablier du wagon-bar |
| **Couloir technique → OCC** | Distributeur « HORS SERVICE » : code **7-1-2**, puis **2-2-4-7** après la trahison | Entrée du hub |

### 3.2 L'OCC — le hub

| Service | Effet | Limite |
|---|---|---|
| **Machine à café « la Vieille Dame »** | Sauvegarde + soin complet (PV, PE, K.O. relevés) | Illimité |
| **Café gratuit** | Fatigue −30 / −45 / −60 selon le niveau de la machine | **1× par pause** |
| **Gobelets de l'OCC** | Remplit les Gobelets (consommable de combat, §9) | 1 / 2 / 3 par pause selon le niveau |
| **Canapé — Sieste** | Fatigue −40, horloge +2 h | 1× par pause |
| **Lit de camp — Dormir** | Fatigue 0, PV/PE max ; l'horloge saute à la **butée de relève** (§4.6) ; le buff de Tasse de Relève prend fin | 1× par pause ; indisponible en Acte III |
| **Tasse de Relève** | Choix d'une boisson-buff au début de chaque pause (§4.5) | 1× par pause |
| **Comptoir (Béné)** | Achat d'équipement (Tickets) ; troc de matériaux | Ouvert dès l'Acte I |
| **Établi (Kevin)** | Amélioration de la clé de tirefond (§8.4) | Dès l'Acte II |
| **Casier du Fantôme** | Marchand légendaire (§9.2) | Si quête du Wagon-Bar terminée |
| **Tableau de liège** | Missions, Notes de service, jauge de **Moral** ; composition de l'équipe (2 collègues max, §7.1) | — |

Après le raid de fin d'Acte II, l'OCC est dévastée : la machine retombe au niveau 1 jusqu'à ce que Kevin la redresse (quête courte, coût nul) ; les améliorations achetées sont conservées.

### 3.3 Zone 2 — Passage du Centre & Grand-Place (ville, ~100×70 tuiles)

| Secteur | Contenu gameplay | PNJ / points d'intérêt |
|---|---|---|
| **Rue de la Gare** | Transition, premiers Managers KPI « en visite terrain » | Affiches satiriques (Note de service) |
| **Passage du Centre** | Zone commerce ; mini-donjon **Synergia Partners** (3 salles, Fragment 1) | **Raymonde** (friterie : consommables), rumeurs |
| **Grand-Place** | Événement du **Doudou** (combat du Dragon Gonflable Sponsorisé, Fragment 2) ; foule qui bloque sans le Brassard | **Papy Roger** (lore, quête du Lumeçon), singe de bronze (« Caresse du Singe » : crit +5 pendant 3 combats, 1×/pause) |

### 3.4 Zone 3 — BAG de Mons (donjon final, 4 niveaux ~40×30 + Salle du Conseil)

| Étage | Mécanique | Ennemis | Points clés |
|---|---|---|---|
| **RDC — Accueil** | Infiltration : caméras (cône de vision ; repéré = combat forcé, patrouille ×1,25 PV), puzzle du badge visiteur (3 services) | Agents de Sécurité Externalisés, Hôtesse Holographique | Badge visiteur requis |
| **1er — Open-Space** | Labyrinthe à cloisons mobiles (interrupteur « Réorganisation ») ; **Power Nap Zone** : Dormir = Fatigue 0, horloge **+2 h** (1 seule fois) | Meutes de Consultants, Post-it Vivants | Le dilemme du 3x8 : dormir ou arriver à l'heure |
| **2e — Salle « Synergie »** | **Mini-boss : Comité d'Alignement** ; porte de service (Jean-Mi s'il a été épargné : évite 2 combats) | Coachs Agiles, Photocopieuse Possédée (détour) | Rédemption de Jean-Mi |
| **3e — Bureau du Directeur** | Palier : dernier point de sauvegarde (machine « premium », café payant), **point de non-retour** | — | Boss à **5h00** |
| **Salle du Conseil** (attenante) | Phases 2 et 3 du boss | — | Diffusion du PHR-2030 |

## 4. Mécanique signature : horloge 3x8 et Fatigue

### 4.1 L'horloge de service

- On stocke `minuteDuJour` (0–1439) et `jour` (0 = lundi, 1 = mardi). Trois pauses : **Matin 06:00–13:59**, **Après-midi 14:00–21:59**, **Nuit 22:00–05:59**.
- **Un acte = une pause** : Acte I = Matin (démarre en prologue à 4h47), Acte II = Après-midi, Acte III = Nuit (boss à 5h00).
- **Écoulement** : en exploration, **1 minute in-game toutes les 8 secondes réelles** (`CLOCK_MIN_PER_REAL_SEC = 0.125`, remplace la valeur provisoire de l'architecture). L'horloge est **figée** en menu, en dialogue et pendant les combats.
- **Coûts en temps fixes** : combat terminé +10 min ; changement de zone +5 min ; voyage rapide radio (Yasmina) +15 min ; sieste +2 h ; café OCC +10 min.
- Les événements principaux d'un acte ne se déclenchent que pendant sa pause ; certains événements optionnels ont une **fenêtre horaire** (ex. le Fantôme n'apparaît voie 4 qu'après 18h00 ; le kiosque ferme à 21h00).

### 4.2 La jauge de Fatigue (0–100, partagée par toute l'équipe)

Une seule barre, un seul état sauvegardé. `fatigue = clamp(fatigue + delta, 0, 100)` après chaque modification.

**Ce qui l'augmente**

| Source | Valeur | Constante |
|---|---|---|
| Temps (par heure in-game) | Matin **+2** · Après-midi **+3** · Nuit **+5** | `FATIGUE_PER_HOUR` |
| Heures sup' (au-delà de la butée) | taux de la pause **×1,5** | `OVERTIME_FATIGUE_MULT` |
| Combat terminé | **+2**, +1 par tranche de 3 manches | `FATIGUE_COMBAT_BASE`, `FATIGUE_PER_3_ROUNDS` |
| Fuite réussie | **+5** | `FATIGUE_FLEE` |
| Contrecoup de Caféiné · Cornet de frites · « Front commun » | **+5** · **+5** · **+20** | `CAFFEINE_CRASH`, `items`, `skills` |
| Combat de boss final | **+1 par manche** (« l'aube se lève ») | `BOSS_FATIGUE_PER_ROUND` |

Les gains liés au temps sont multipliés par l'équipement et les buffs (Thermos ×0,8 ; Lungo ×0,75 ; cumul multiplicatif, plancher ×0,5).

**Ce qui la réduit**

| Moyen | Effet | Limite / coût |
|---|---|---|
| **Café gratuit de l'OCC** | −30 (niv. 1) / −45 (niv. 2) / −60 (niv. 3) ; Matin : −10 de plus | 1× par pause, +10 min |
| **Tasse de Relève** (14h00) | −30 + buff de boisson | Automatique à la relève |
| **Veillée d'armes** (22h00) | −50 + buff de boisson (+ −10 si le Fantôme sert « la maison ») | Une fois, avant l'Acte III |
| **Sieste** (canapé OCC) | −40 | 1× par pause, horloge +2 h |
| **Dormir** (lit de camp OCC) | Fatigue = 0 | 1× par pause, l'horloge saute à la butée |
| **Power Nap Zone** (BAG, 1er) | Fatigue = 0, PV/PE max | 1× ; horloge +2 h |
| **Gobelet de l'OCC** (combat) | −20 + Caféiné | Selon le stock |
| **Expresso / Double lungo** | −15 / −30 | 15 T / 40 T (×1,5 la nuit au distributeur) |
| **Café premium** (palier du 3e, BAG) | −20 | 45 T, 3 max |
| Compétences | Ristretto −10 ; Pause réglementaire (Fatou) −5 | PE |

### 4.3 Paliers de Fatigue (seuils canon)

| Palier | Fatigue | Précision | Dégâts infligés | Initiative | Régén. PE / tour | Critique | Spécial |
|---|---|---|---|---|---|---|---|
| **Frais** | 0–39 | +5 | ×1,00 | ×1,00 | +3 | +0 | — |
| **Fatigué** | 40–69 | 0 | ×0,95 | ×0,95 | +2 | +0 | — |
| **Épuisé** | 70–89 | −10 | ×0,85 | ×0,85 | +1 | **+5** | Statut Burn-out : durée +1 |
| **Burn-out** | 90–99 | −20 | ×0,75 | ×0,70 | 0 | **+10** | Résistance aux statuts −20 ; Burn-out : durée +1 |
| **Effondré** | 100 | — | — | — | — | — | Voir ci-dessous |

- Le bonus de critique des paliers hauts est voulu : « l'énergie du désespoir » rend le combat à 5h00 tendu mais pas injouable.
- **Effondré en combat** : toute l'équipe saute sa prochaine action (micro-sieste), puis Fatigue = 90.
- **Effondré hors combat** : malaise → traité comme une **Mise à pied** (§5.8).
- Le palier « Burn-out » (jauge) et le statut « Burn-out » (§5.6) sont distincts ; le palier aggrave le statut.
- Implémentation : `fatigueTier(f)` renvoie une ligne de `BALANCE.fatigue.tiers` ; aucune autre logique ne lit la Fatigue brute.

### 4.4 Effets de la pause en cours

| | **Matin (Acte I)** | **Après-midi (Acte II)** | **Nuit (Acte III)** |
|---|---|---|---|
| Fatigue / heure | +2 | +3 | +5 |
| Bonus de pause du héros | « Vigilance » : précision +5 ; café OCC −10 de plus | « Endurance » : Défense ×1,10 ; boutiques et quêtes de voyageurs ouvertes | « Prime de nuit » : critique +10, XP ×1,25, Tickets ×1,5 |
| Ennemis (gare / ville) | Consultants, Managers KPI | Groupes plus grands, Coachs Agiles | Génériques : Bornes, Agents de sécurité, Photocopieuses, Post-it Vivants |
| Ennemis (BAG) | — | — | **Toute la hiérarchie fait des heures sup' pour la signature** |
| Densité | 3–4 groupes / zone, 1–3 ennemis | 2–3 groupes, 2–4 ennemis | 1–2 groupes, 1–3 ennemis (BAG : rencontres scénarisées) |
| Stats ennemies | ×1,0 | ×1,1 | ×1,2 |
| Comportement | Bloqué +15 % de chance | « Réunionite » : +10 % Démotivé | IA agressive (80 % attaque) |
| Récompenses | XP ×1,0 · T ×1,0 | XP ×1,0 · T ×1,2 | XP ×1,25 · T ×1,5 |

### 4.5 Tasse de Relève (buff de pause)

Au début de chaque pause (et à la veillée d'armes), le joueur choisit **une** boisson. Le buff dure jusqu'à la fin de la pause ou jusqu'à « Dormir ».

| Boisson | Effet | Disponibilité |
|---|---|---|
| **Ristretto** | Fatigue −10 ; Caféiné (2 tours) au début de chaque combat | Toujours |
| **Lungo** | PV max +10 % ; gain de Fatigue horaire ×0,75 | Toujours |
| **Cappuccino** | Défense +10 % ; résistance au Sommeil +30 | Toujours |
| **Chocolat chaud** | Soin 3 % PV max au début de chaque tour ; immunité Démotivé | Toujours |
| **Le Noir de la Vieille Dame** | Syndiqué (2 tours) au début de chaque combat ; Moral +5 (une fois par pause) | Machine niv. 3 |

### 4.6 Butée de relève et heures sup'

- Chaque acte a une **butée** : 13h45 (Acte I), 21h45 (Acte II). Si l'horloge l'atteint avant l'événement de fin d'acte, elle s'arrête et le HUD affiche **« HEURES SUP' »** : la Fatigue continue de monter au taux de la pause ×1,5, sans jamais faire passer à la pause suivante.
- L'événement de fin d'acte fait sauter l'horloge à la relève (14h00, 22h00) et déclenche la Tasse de Relève.

### 4.7 L'assaut de 5h00 (Acte III)

- L'Acte III démarre à **22h00** après la veillée (Fatigue −50). Il n'y a **pas d'OCC** au BAG : la Fatigue doit être gérée avec les Gobelets, la Power Nap Zone et le café premium.
- Budget de référence : 7 h de nuit = **+35** ; ~10 combats = **+25** ; départ ≈ 10 → **arrivée au boss ≈ 65–75 (Épuisé)**. C'est le défi voulu.
- **Arrivée en avance** : en entrant dans le Bureau du Directeur, l'équipe se cache jusqu'à 5h00 ; l'attente compte au taux ×0,5.
- **Arrivée en retard** : le compteur de signature démarre à **10 − 1 par tranche de 30 min de retard** (minimum 6). Vanderslide « relit le contrat », ce qu'il n'avait jamais fait.
- Pendant le combat final, +1 Fatigue par manche : le joueur peut glisser vers Burn-out.

## 5. Système de combat au tour par tour

### 5.1 Déroulement

1. **Début de manche** : calcul de l'initiative de chaque combattant, tri décroissant (frise d'initiative du HUD).
2. Chaque combattant agit une fois. **Début de son tour** : régénération de PE (héros), décompte et effets des statuts.
3. **Fin de manche** : vérification victoire / défaite ; boss final : le compteur de signature descend de 1.
4. L'initiative est recalculée à chaque manche (Fatigue et statuts changent l'ordre).

Équipe : 1 à 3 personnages (héros + 2 collègues max). Ennemis : 1 à 4 (3 affichés + renfort en file).

### 5.2 Actions

| Action | Coût | Effet |
|---|---|---|
| **Attaquer** | 0 PE | Puissance 100 sur une cible |
| **Compétences** | X PE (parfois + Fatigue) | §8.3 et §7.2 |
| **Objets** | 0 PE | Consommable de l'inventaire commun ou objet-clé (Preuve, Le Règlement) |
| **Café ☕** | 0 PE | Raccourci : boit un **Gobelet de l'OCC** (−20 Fatigue + Caféiné). Grisé si le stock est vide |
| **Défendre** | 0 PE | Dégâts reçus ×0,5 jusqu'au prochain tour ; régénération de PE doublée au tour suivant |
| **Fuir** | 0 PE | Tentative d'équipe, 1 par manche. Impossible contre élites et boss |

### 5.3 Formules (constantes : voir l'annexe)

```
INITIATIVE  = floor(Vit × multInitPalier × 1.25 si Caféiné × 0.8 si Décalage) + randInt(0, 5)
              égalité : camp du joueur d'abord ; ennemis : multInitPalier = 1
TOUCHER %   = clamp(90 + (Vit_att − Vit_déf) + précPalier + précPause + précStatuts − esquive_déf, 30, 99)
              Caféiné +10 ; Décalage −10 ; esquive Consultant Junior 15 ; soins et soutiens touchent toujours
CRITIQUE %  = héros : min(50, 5 + floor(MoralEffectif / 10) + critPalier + critPause + critÉquipement) ; ennemi : 5
              MoralEffectif = Moral collectif, −30 si le personnage est Démotivé (plancher 0) ; multCrit = 1.5
DÉGÂTS      brut   = Force_att × 2 × (puissance / 100) − Déf_cible × 1 × (1 − ignoreDéf)
            dégâts = max(1, floor(max(1, brut) × variance × multCrit × multPalier × multDémotivé
                                  × multDéfendre × multBouclier × multFaiblesse))
              variance = 0.9 + rng() × 0.2 ; multPalier : camp du joueur uniquement ; Démotivé 0.75
              Défendre 0.5 ; Bouclier « Réunion d'alignement » 0.5 ; Faiblesse 2 (Question concrète sur Consultant…)
              Déf_cible × 1.3 si Syndiquée, × 0.7 si « Tarif réduit »
SOIN        = floor(PVmax_cible × pourcentage)  (sans variance ni critique)
STATUT %    = clamp(chanceBase − résistance_cible, 5, 95)
              résistance héros = min(50, floor(MoralEffectif / 2)) + équipement − 20 si palier Burn-out
              résistance ennemis : normal 10 · élite 30 · boss 50
FUITE %     = clamp(50 + (Vit_moy_équipe − Vit_moy_ennemis) × 3, 10, 90)
              réussite : ni XP ni Tickets, +5 Fatigue ; échec : l'équipe perd le reste de la manche
```

### 5.4 Exemples chiffrés (cas de test Vitest)

| # | Situation | Calcul | Résultat |
|---|---|---|---|
| 1 | Léa niv. 4 (Force 16 + clé rouillée +4 = 20) attaque un Consultant Junior niv. 4 (Déf 7). Fatigue 45 (Fatigué), variance 1,0, pas de critique | `20×2×1 − 7 = 33` → `floor(33 × 0.95)` | **31** (2 coups pour 54 PV) |
| 2 | Même cible, **Question concrète** (puissance 110, ×2 sur Consultant) | `20×2×1.1 − 7 = 37` → `37 × 2 × 0.95 = 70.3` | **70** (K.O., invocation annulée) |
| 3 | Léa niv. 17, Force 42 + clé Mk2 +18 = 60, **Préavis de grève** (puissance 200, ignore 50 % Déf) sur un Manager KPI niv. 17 de nuit (Déf 36 × 1,2 = 43), Fatigue 75, critique | `60×2×2 − 43×0.5 = 218.5` → `218.5 × 1.5 × 0.85` | **278** |
| 4 | Chance de critique du cas 3 : Moral 55, nuit, palier Épuisé | `5 + floor(55/10) + 10 + 5` | **25 %** |
| 5 | Toucher : Vit 32 contre 24, Épuisé (−10) | `90 + 8 − 10` | **88 %** |
| 6 | Consultant niv. 10 (Force 26) frappe le héros niv. 10 (Déf 21 + Veste d'hiver 14 = 35) qui **défend** | `26×2 − 35 = 17` → `floor(17 × 0.5)` | **8** |
| 7 | Défense écrasante : Force 5 contre Déf 30 | brut négatif | **1** (minimum) |
| 8 | Fuite : Vit moyenne 10 contre 20 | `50 − 30` | **20 %** |
| 9 | Statut : Sommeil (base 80) sur un héros, Moral 40, sans bonus | `80 − 20` | **60 %** (0 % s'il est Caféiné) |

### 5.5 PV, PE et K.O.

- **PV à 0** : « En arrêt maladie » (K.O.). Relevé par objet (Tract syndical) ou compétence ; sinon revient avec 1 PV après le combat.
- **PE** : régénération au début de chaque tour selon le palier (+3 / +2 / +1 / 0), doublée après « Défendre ». Pas de PE pour les ennemis : ils ont des **temps de recharge** et une IA à poids (ex. 60 % attaque / 40 % compétence disponible).

### 5.6 Statuts (7)

Règles communes : pas de cumul (réappliquer remet la durée à neuf) ; décompte au début du tour du porteur.

| Statut | Type | Durée | Effet | Sources typiques |
|---|---|---|---|---|
| **Caféiné** | Bonus | 3 tours | Vit ×1,25, précision +10, **immunité Sommeil** (et le retire). À la fin : +5 Fatigue | Gobelet, Double lungo, Ristretto |
| **Syndiqué** | Bonus | 3 tours | Déf ×1,3 ; immunité Démotivé, Bloqué et Confusion (les retire) | Grève du zèle, Tract syndical |
| **Démotivé** | Malus | 3 tours | Dégâts ×0,75 ; MoralEffectif −30 (crit et résistance). Finir un combat Démotivé : Moral collectif −1 | Coach Agile, Benchmark |
| **Bloqué** | Malus | 1 tour | Passe son tour (paperasse), puis **1 tour d'immunité** | Formulaire, Le Règlement (2 tours sur RH) |
| **Burn-out** | Malus | 3 tours | −6 % PV max au début de chaque tour ; +1 tour si palier Épuisé ou pire | Reporting hebdo, Photocopieuse |
| **Confusion** | Malus | 2 tours | 40 % de chance que l'action vise une cible aléatoire (alliés compris ; un soin peut soigner un ennemi) | Tempête de Post-it, Team building |
| **Sommeil** | Malus | ≤ 2 tours | Passe ses tours ; réveillé dès qu'il subit des dégâts. **Impossible si Caféiné** | Réunion d'alignement (Manager KPI) |

Effet spécial (hors statuts) : **Décalage** (« Changement de roulement la veille », Réorganisateur RH) : 3 tours, perte du bonus de pause, précision −10, initiative ×0,8, et le prochain tour est repoussé en fin de manche.

### 5.7 Récompenses

```
XP_ennemi      = round(6 × niv^1.5 + 10) × multType × multPauseXP      multType : normal 1 · élite 2.5 · boss 6
Tickets_ennemi = (3 × niv + randInt(0, niv)) × multTypeT × multPauseT  multTypeT : normal 1 · élite 3
Grains         = 20 % de chance de 1 à 3 Grains par combat ; élites 100 % (3 à 5)
Matériaux      = Post-it 40 % · Agrafeuse 25 % · Clé USB « Confidentiel » 8 % (élite 50 %)
```
L'XP est versée en entier à chaque membre vivant de l'équipe.

### 5.8 Défaite : la « Mise à pied »

- Actes I–II : pas de game over. Retour à l'OCC, **−25 % des Tickets**, Fatigue fixée à 50, horloge +2 h (plafonnée à la butée), **Moral −5**.
- Acte III : retour à la dernière sauvegarde du BAG (Accueil, palier du 2e, palier du 3e), même pénalité de Moral.
- **Compteur de signature à 0** : cinématique « Contrat signé », reprise au début du combat final (Fatigue et objets d'entrée restaurés, pas de pénalité).

## 6. Ennemis

### 6.1 Formules de stats et archétypes

```
PV = (20 + 12×niv) × mPV   Force = (6 + 2×niv) × mFor   Déf = (4 + 1.3×niv) × mDéf   Vit = (8 + niv) × mVit
puis × multiplicateur de pause (×1,0 / ×1,1 / ×1,2), arrondi inférieur
```

Coefficients [mPV, mFor, mDéf, mVit] et résistance aux statuts : **Consultant Junior** (rapide, invocateur) 0,8 / 1,0 / 0,8 / 1,3, rés. 10 · **Manager KPI** (tank, buffer) 1,4 / 0,9 / 1,4 / 0,8, rés. 10 · **Coach Agile** (soutien, désordre) 0,9 / 0,7 / 1,0 / 1,1, rés. 10 · **Réorganisateur RH** (élite, contrôle) 2,5 / 1,1 / 1,2 / 1,0, rés. 30 · **Boss** 1,0 / 1,3 / 1,3 / 1,0 (PV par phase, §6.6), rés. 50.

### 6.2 Stats de référence par acte (avant multiplicateur de pause)

| Ennemi | Acte (niv.) | PV | Force | Déf | Vit | XP | Tickets (moy.) |
|---|---|---|---|---|---|---|---|
| Consultant Junior | I (4) | 54 | 14 | 7 | 15 | 58 | 14 |
| | II (10) | 112 | 26 | 13 | 23 | 200 | 35 |
| | III (17) | 179 | 40 | 20 | 32 | 431 | 59 |
| Manager KPI | I (4) | 95 | 12 | 12 | 9 | 58 | 14 |
| | II (10) | 196 | 23 | 23 | 14 | 200 | 35 |
| | III (17) | 313 | 36 | 36 | 20 | 431 | 59 |
| Coach Agile | I (4) | 61 | 9 | 9 | 13 | 58 | 14 |
| | II (10) | 126 | 18 | 17 | 19 | 200 | 35 |
| | III (17) | 201 | 28 | 26 | 27 | 431 | 59 |
| **Manager KPI « Auditeur des quais »** (mini-boss Acte I) | I (7) | 291 | 19 | 18 | 12 | 303 | 100 + 10 Grains |
| **Dragon Gonflable Sponsorisé** (Doudou) | II (11) | 334 | 30 | 16 | 17 | 572 | 120 + 5 Grains |
| **Réorganisateur RH** (raid OCC) | II (13) | 440 | 35 | 25 | 21 | 728 | 200 + 10 Grains |
| **Réorganisateur RH** (Comité d'Alignement) | III (18) | 590 | 46 | 32 | 26 | 1 171 | 250 + 10 Grains |

### 6.3 Les trois types de managers

| Ennemi | Capacités | Faiblesse |
|---|---|---|
| **Consultant Junior « Slide-Ninja »** (fragile, esquive 15) | *Je loop un junior* : encore debout après 3 manches → invoque 1 Consultant (1×). *Tempête de Post-it* (recharge 3) : 3 coups de puissance 35 sur cibles aléatoires, Confusion 35 %. *Synergie* (recharge 3) : soigne 25 % PV d'un ennemi | ***Question concrète*** : dégâts ×2, invocation annulée définitivement |
| **Manager KPI « Le Tableur »** (tank, buffer) | *Réunion d'alignement* (1er tour, recharge 5) : **bouclier** ennemi (dégâts reçus ×0,5, 2 tours) + **Sommeil** de zone (base 80 %) sauf Caféinés. *Tableau croisé dynamique* : puissance 60 + 15 par ennemi debout. *Reporting hebdo* (toutes les 3 manches) : puissance 140 sur l'équipe, touche toujours, Burn-out 25 %. Passif : Force +5 %/manche (max +50 %) | **Café de l'OCC** (Gobelet : Caféiné = immunité Sommeil) ; ***Ponctualité réelle*** : brise le bouclier, ×1,5 sur lui |
| **Coach Agile « Le Facilitateur »** (soutien, désordre) | *Team building obligatoire* (recharge 4) : Confusion de zone (base 50 %). *Post-it rouge* : puissance 60 + Démotivé (base 60 %). *Rétro positive* (recharge 3) : soigne 20 % PV de tous les ennemis. *Atelier Post-it* (1×) : invoque 2 Post-it Vivants | Syndiqué (immunise contre la Confusion) ; fragile : à cibler en premier |

Variantes du Consultant : **Senior** (PV et Force ×1,3, invoque dès la 2e manche) ; **Stagiaire en Stratégie** (stats ×0,6, 30 % de chance de passer son tour « à chercher le Wi-Fi »).

### 6.4 Élite : le Réorganisateur RH

Classeur « Roulements 2027 PROVISOIRE v14 », chaise à roulettes.
- *Changement de roulement la veille* (recharge 4) : inflige **Décalage** (§5.6) à un héros pour 3 tours.
- *Classeur v14* : puissance 130, Bloqué 30 %.
- *Chaise à roulettes* : esquive +25 pendant 1 tour.
- **Faiblesse** : objet-clé **Le Règlement** (« Article 47, alinéa 3 ») → **Bloqué 2 tours** garanti (ignore l'immunité).
- Apparitions : 3e vague du **raid sur l'OCC** (fin Acte II) ; chef du **Comité d'Alignement** (Acte III : + 2 Consultants Junior + 1 Coach Agile).

### 6.5 Ennemis génériques

| Ennemi | Où / quand | Archétype | Capacité |
|---|---|---|---|
| Borne Automatique Rebelle | Gare, tutoriel + nuit | Contrôle (niv. 1–8) | « Paiement refusé » : Bloqué 40 % |
| Agent de Sécurité Externalisé | Gare la nuit, BAG RDC | Tank | « Vous n'avez pas le bon badge » : provoque |
| Hôtesse Holographique | BAG RDC | Soutien | « Bienvenue chez nous » : Confusion 40 % |
| Dragon Gonflable Sponsorisé | Doudou (événement) | Élite | « Coup de queue gonflable » (zone) ; chaque manche, la foule donne +5 % de dégâts à l'équipe (max +25 %) |
| Post-it Vivant | Partout (invoqué) | Rapide, 20 PV × acte | Explose à la mort : Confusion 20 % |
| Photocopieuse Possédée | Gare la nuit, BAG 2e | Contrôle | « Bourrage papier » : Bloqué zone 35 % ; « Toner » : Burn-out 30 % |

### 6.6 Boss final : Gontran Vanderslide (niv. 20)

Directeur de la Transformation et de l'Excellence Opérationnelle (baskets blanches, oreillette, tasse « World's Best Disruptor », trottinette de fonction). Base : Force 59, Déf 39, Vit 28, résistance 50, XP 3 280 (non utile : fin de jeu).

**Compteur de signature** (affiché au-dessus du boss) : démarre à **10** (moins le retard, §4.7), descend de 1 à chaque fin de manche. **À 0 : défaite** (« Contrat signé »).

| Phase | Lieu | PV | Capacités | Déclencheur suivant |
|---|---|---|---|---|
| **1 — « Méga-Deck 2030 »** | Bureau du Directeur | 1 000 | *Slide 1/412* (puissance 110) ; *Benchmark international* (puissance 80 zone, Démotivé 40 %) ; *Je loop un junior* (invoque 1 Consultant, recharge 4) ; *Tempête de Post-it* (3×45, Confusion 35 %) | PV à 0 |
| **2 — « Conseil d'Administration en visio »** | Salle du Conseil | 1 200 + **2 Clauses-tentacules** (200 PV, Déf 30 chacune) | *Clause de non-concurrence* (scelle une compétence 3 tours) ; *Plan social optimisé* (puissance 160 zone) ; *Réduction des coûts* (recharge 3 : Moral collectif −3, retire les bonus) ; *Clause d'urgence* : tant qu'une Clause vit, le compteur perd 1 de plus toutes les 3 manches. Voix off d'Hubert Rentabilis, caméra éteinte | PV à 0 → si **Moral < 40** : phase 3, sinon victoire |
| **3 — « L'Optimiseur Absolu »** | Salle du Conseil (fusion avec la photocopieuse) | 900 | *Photocopie du personnel* (copie la dernière compétence utilisée par un héros) ; *Bourrage papier* (Bloqué zone 50 %) ; *Recto-verso* (agit 2 fois par manche) | PV à 0 → victoire |

**Armes du joueur**
- **« Mais concrètement, sur le terrain, ça donne quoi ? »** : commande spéciale (héros), **1 usage par combat**, puissance 250, **critique garanti**.
- **Les 3 Preuves** (fragments du PHR-2030, objets de combat) : chacune **repousse le compteur de 3 tours** et donne **Moral +5** ; 1 seule Preuve par manche.

**Réglage visé** : équipe niv. 19–20, Fatigue d'entrée ≈ 70, dégâts d'équipe ≈ 250 à 300 par manche → phases 1 + 2 ≈ 9 à 10 manches (avec les Clauses). Sans Preuve, le compteur est trop juste ; avec 2 Preuves, confortable ; la phase 3 exige les 3 Preuves. *À valider en playtest.*

## 7. Alliés et Moral collectif

### 7.1 L'équipe de terrain

- **Actes I–II** : le héros + **jusqu'à 2 collègues** choisis à l'OCC parmi les recrutés (Acte I : 1 seul slot jusqu'au recrutement du 2e allié).
- **Acte III** : le héros + **Josiane** (permanente) + 1 slot libre.
- Les collègues ont le **niveau du héros** (XP partagée), les mêmes formules de stats avec leurs coefficients, et 2 slots d'équipement (Tenue, Accessoire) ; leur « outil » est fixe.

### 7.2 Rôles gameplay

| Allié | Rôle | PV | For | Déf | Vit | Compétence 1 | Compétence 2 (Acte II+) | Hors combat |
|---|---|---|---|---|---|---|---|---|
| **Marcel « Pépé Rail » Lhoir** | Mentor (non combattant) | — | — | — | — | Passif *Coup de sifflet d'antan* : initiative ×1,1 au 1er tour de chaque combat | — | Donneur de quêtes principal |
| **Josiane Delhaye** | Tank | ×1,3 | ×0,8 | ×1,4 | ×0,8 | *Contrôle des titres* (6 PE) : provocation 2 tours, dégâts reçus ×0,8 | *C'est dans le cœur* (12 PE) : soin 25 % équipe + Syndiqué sur elle | Compagne de l'Acte III |
| **Rudy Courtois** | Contrôle | ×1,0 | ×0,9 | ×1,0 | ×1,2 | *Fermeture des portes* (7 PE) : puissance 80 + Bloqué 50 % | *Départ immédiat* (18 PE) : expulse un ennemi non élite sous 30 % PV (XP ×0,5) | — |
| **Béné Wautier** | Debuffs | ×0,9 | ×0,8 | ×0,9 | ×1,1 | *File d'attente* (8 PE) : la cible joue en dernier + Bloqué 35 % | *Tarif réduit* (8 PE) : Déf cible ×0,7, 3 tours | Comptoir ; détient **Le Règlement** (2 usages/combat si elle est dans l'équipe) |
| **Yasmina Benali** | Tactique | ×0,85 | ×1,0 | ×0,85 | ×1,15 | *Voie d'attente* (6 PE) : un allié rejoue juste après elle | *Incident de circulation* (14 PE) : puissance 90 sur tous | **Voyage rapide** par radio (+15 min) |
| **Kevin « Kéké » Lambot** | DPS | ×1,1 | ×1,3 | ×1,0 | ×0,9 | *Coupure de caténaire* (12 PE) : puissance 180, ignore 25 % Déf | *Rafistolage* (5 PE) : retire Bloqué et Confusion d'un allié | Établi (clé de tirefond), barrières Infrabel, badge visiteur |
| **Fatou Ndiaye** | Soin | ×0,9 | ×0,6 | ×1,0 | ×1,0 | *Pause réglementaire* (10 PE) : soin 25 % équipe, Fatigue −5 | *Ergonomie* (6 PE) : retire tous les malus d'un allié | Gère la sauvegarde à la machine |
| **Fantôme du Wagon-Bar** | Secret | — | — | — | — | Invocation *Service à la place* : 1× par combat, soin 40 % équipe + Caféiné équipe | — | Marchand légendaire |

Coefficients appliqués à la base et à la croissance du héros (§8.1). Jean-Mi n'est pas combattant : barista de l'OCC (vend des Expresso à −20 % jusqu'à la trahison).

### 7.3 Jauge de Moral collectif (0–100)

Valeur de départ : **10**. La jauge est visible à partir de la fin de l'Acte I (elle est comptée dès le début).

| Source | Variation |
|---|---|
| Recruter un allié (Josiane, Rudy, Béné en Acte I ; Yasmina, Kevin, Fatou en Acte II) | +5 chacun |
| Victoire contre l'Auditeur des quais (fin Acte I) | +5 |
| Chaque fragment du PHR-2030 obtenu | +2 |
| Jean-Mi : livré / épargné, puis rédemption en Acte III | +5 / −10 puis +15 |
| Quêtes du Wagon-Bar disparu (Fantôme) et du Combat du Lumeçon (Papy Roger) | +10 chacune |
| Quêtes de voyageurs / Rumeurs de Raymonde | +3 chacune |
| Note de service trouvée | +1 (12 au total ; +3 bonus pour la collection complète) |
| Crin porte-bonheur (Doudou) | +2 |
| Noir de la Vieille Dame | +5 (1× par pause) |
| Preuve utilisée contre le boss | +5 |
| *Réduction des coûts* (boss phase 2) | −3 |
| Mise à pied | −5 |
| Finir un combat avec un héros Démotivé | −1 |

**Chemin critique sans détour ≈ 56** : la bonne fin exige au moins une quête secondaire ou des Preuves bien utilisées.

**Effets du Moral** (40–59 « Mobilisés » : aucun effet spécial)

| Seuil | Effet |
|---|---|
| Toujours | Critique +1 par tranche de 10 ; résistance aux statuts = Moral / 2 (max 50) |
| **< 40** | « Résignés » : le boss final déclenche la **phase 3** (vérifié à la fin de la phase 2) |
| **≥ 60** | « Solidaires » : la **bonne fin** est possible (si la phase pilote est refusée) |
| ≥ 80 | « Grève générale » : au combat final, Syndiqué sur toute l'équipe au 1er tour |

## 8. Progression

### 8.1 Niveaux et XP (1 à 20)

```
xpPourNiveauSuivant(L) = round(40 × L^1.5)    (L = 1..19, total ≈ 26 855 XP)
```

| Niveau | XP → suivant | PV | PE | Force | Déf | Vit |
|---|---|---|---|---|---|---|
| 1 | 40 | 60 | 20 | 10 | 8 | 10 |
| 4 | 320 | 96 | 29 | 16 | 12 | 13 |
| 7 | 741 | 132 | 38 | 22 | 17 | 16 |
| 10 | 1 265 | 168 | 47 | 28 | 21 | 19 |
| 14 | 2 095 | 216 | 59 | 36 | 27 | 23 |
| 17 | 2 804 | 252 | 68 | 42 | 32 | 26 |
| 20 | — | 288 | 77 | 48 | 36 | 29 |

Formule : `stat(L) = floor(base + croissance × (L − 1)) × coefAllié`, puis `+ Σ bonus d'équipement`. Héros : PV 60 (+12) · PE 20 (+3) · Force 10 (+2) · Déf 8 (+1,5) · Vit 10 (+1).
Paliers attendus : **Acte I niv. 1→7**, **Acte II niv. 7→14**, **Acte III niv. 14→20**. Quêtes : 50 / 150 / 300 XP selon l'acte. Le Moral n'est pas une stat individuelle : c'est la jauge collective.

### 8.2 Équipement (3 slots)

- **Tenue** (Déf, PV) : une par acte, en boutique (§9.2). **Outil** (Force, critique) : la **clé de tirefond** du héros, améliorée par Kevin (§8.4).
- **Accessoire** (Vit, Fatigue, résistance, critique) : choix latéral, pas de progression linéaire. Les collègues n'ont que Tenue et Accessoire.

### 8.3 Compétences du héros (3 par acte, 9 au total)

| Acte | Niv. | Compétence | Coût | Effet |
|---|---|---|---|---|
| I | 2 | **Question concrète** | 5 PE | Puissance 110 ; ×2 sur Consultants et annule leur invocation |
| I | 4 | **Ponctualité réelle** | 8 PE | Puissance 100 ; brise les boucliers (×1,5 sur un Manager KPI) |
| I | 6 | **Pause syndicale** | 8 PE | Soigne 30 % des PV max d'un allié |
| II | 8 | **Grève du zèle** | 12 PE | Syndiqué sur toute l'équipe (3 tours) |
| II | 10 | **Ristretto** | 10 PE | Caféiné sur soi + Fatigue −10 (le contrecoup reste) |
| II | 12 | **Aiguillage** | 14 PE | Puissance 90 sur tous les ennemis |
| III | 15 | **Préavis de grève** | 20 PE | Puissance 200, ignore 50 % de la Déf |
| III | 17 | **Assemblée générale** | 25 PE | Soigne 40 % des PV max de l'équipe, retire les malus |
| III | 20 | **Front commun** | 35 PE + 20 Fatigue | Puissance 300 sur tous, 1× par combat |

Données : `{ id, cost, fatigueCost, power, target: 'one'|'all'|'self'|'ally'|'team', status?, statusChance?, healPct?, ignoreDef?, weakTo?, breaksShield?, oncePerBattle? }` ; un seul résolveur générique.

### 8.4 La clé de tirefond (améliorée par Kevin, établi de l'OCC)

| Rang | Nom | Bonus | Coût | Disponible |
|---|---|---|---|---|
| 0 | Clé de tirefond rouillée | Force +4 | — | Départ |
| 1 | Clé de tirefond graissée | Force +10 | 150 T + 5 Agrafeuses | Acte II (Kevin recruté) |
| 2 | Clé de tirefond renforcée | Force +18, critique +5 | 450 T + 12 Agrafeuses + 2 Clés USB | Acte II, après le Doudou |
| 3 | Clé de tirefond « 7h12 » | Force +28, critique +10, Question concrète ×2,5 | 1 000 T + 20 Agrafeuses + 5 Clés USB + Crin porte-bonheur | Acte III (veillée d'armes) |

### 8.5 La machine de l'OCC (Grains de café)

| Niveau | Coût | Café gratuit | Gobelets / pause | Bonus |
|---|---|---|---|---|
| 1 | — | −30 Fatigue | 1 | Sauvegarde + soin complet |
| 2 | 15 Grains + 150 T | −45 Fatigue | 2 | Le café soigne aussi les K.O. hors OCC au prochain retour |
| 3 | 40 Grains + 500 T | −60 Fatigue | 3 | Caféiné au 1er tour du combat suivant ; débloque le **Noir de la Vieille Dame** |

Grains attendus : ≈ 20 à la fin de l'Acte I, ≈ 60 à la fin de l'Acte II (niv. 3 atteignable avant l'Acte III si le joueur fait les élites et les coffres).

## 9. Économie et objets

### 9.1 Monnaie et ressources

| Ressource | Rôle | Sources |
|---|---|---|
| **Tickets (T)** | Monnaie : titres de transport compostés, devenus la monnaie du marché parallèle de la gare | Combats, boss, quêtes (50 / 150 / 300 T), **pointeuse** (salaire de fin de pause : 30 × acte T si l'on a pointé en début de pause) |
| **Grains de café** | Amélioration de la machine uniquement (ce n'est **pas** une monnaie) | Combats (20 %), élites, coffres, quêtes |
| **Post-it** | Troc chez le Fantôme | Butin |
| **Agrafeuses**, **Clés USB « Confidentiel »** | Améliorations de la clé de tirefond | Butin (Clés USB surtout sur élites) |

Gains cumulés attendus : fin Acte I ≈ 700 T · fin Acte II ≈ 2 500 T · fin Acte III ≈ 5 000 T. Règle : un soin ≈ les gains d'un combat ; une tenue d'acte ≈ 15 à 25 combats.

### 9.2 Table des objets

**Consommables** (inventaire commun, max 9 par objet ; « nuit » = prix ×1,5 au distributeur)

| Objet | Vendeur | Prix | Effet |
|---|---|---|---|
| Expresso | Kiosque, distributeur, Jean-Mi | 15 T | Fatigue −15, PE +5 |
| Double lungo | Kiosque | 40 T | Fatigue −30 + Caféiné |
| Gobelet de l'OCC | Machine (gratuit, stock limité) | — | Fatigue −20 + Caféiné (action « Café ☕ ») |
| Gaufre de Liège | Kiosque | 20 T | +40 PV à un allié |
| Fricadelle | Raymonde | 30 T | +90 PV à un allié |
| Cornet de frites | Raymonde | 45 T | +60 PV à toute l'équipe, Fatigue +5 |
| Sauce andalouse | Raymonde | 35 T | Force ×1,25 pendant 3 tours (un allié) |
| Formulaire en triple exemplaire | Kiosque | 30 T | Bloqué sur un ennemi (base 60 %) |
| Tract syndical | Comptoir (Béné) | 50 T | Retire les malus + Syndiqué 2 tours ; relève un K.O. à 25 % PV |
| Croque-monsieur fantôme | Fantôme | 120 T + 5 Post-it | Relève tous les K.O. + soin 50 % équipe |
| Café premium | Machine du BAG (3e) | 45 T | Fatigue −20 (3 max) |

**Équipements**

| Objet | Slot | Prix | Effet | Acte |
|---|---|---|---|---|
| Gilet orange haute visibilité | Tenue | 120 T | Déf +6, PV +20 | I |
| Veste d'hiver SNCB | Tenue | 400 T | Déf +14, PV +50 | II |
| Uniforme de chef de gare | Tenue | 900 T | Déf +24, PV +90, résistance +10 | III |
| Thermos de l'OCC | Accessoire | 200 T | Fatigue horaire ×0,8 | I |
| Montre de chef de gare | Accessoire | 180 T | Vit +5, initiative +5 % | I |
| Badge syndical | Accessoire | 250 T | Syndiqué 2 tours au début du combat | II |
| Brassard du Lumeçon | Accessoire | Quête Papy Roger | Vit +3, résistance +10 | II |
| Crin porte-bonheur | Accessoire | Doudou | Critique +5 (et matériau de la clé rang 3) | II |
| Tablier du Wagon-Bar | Accessoire | Fantôme (300 T) | Soins reçus ×1,2, Gobelets −25 au lieu de −20 | II |

**Objets-clés**

| Objet | Obtention | Usage |
|---|---|---|
| **Fragment 1 « Preuve » — Phase 1 : Dématérialisation** | Synergia Partners (Passage du Centre) | Objet de combat contre Vanderslide : compteur +3, Moral +5 (1 usage) |
| **Fragment 2 « Preuve » — Phase 2 : Externalisation** | Clé USB dans le Dragon Gonflable (Doudou) | Idem |
| **Fragment 3 « Preuve » — Phase 3 : Cession** | Archives du hall, avec Béné (procès-verbal) | Idem |
| **Le Règlement** | Béné (Acte II) | En combat, réutilisable : Réorganisateur RH Bloqué 2 tours garanti ; autres ennemis Bloqué 1 tour (base 40 %). 1 usage/combat (2 avec Béné) |
| **Badge visiteur** | Fabriqué par Kevin avec les 3 fragments (fin Acte II) | Accès au BAG ; puzzle de validation de l'Accueil |
| Brassard de bénévole | Papy Roger (chemin critique) | Traverser la foule du Doudou |

**Le Fantôme du Wagon-Bar** (marchand légendaire, §7.2) accepte Tickets **et** Post-it : Croque-monsieur fantôme, Tablier du Wagon-Bar, « Carte des vins 1994 » (accessoire, PE max +15) ; +1 Gobelet par pause tant qu'il est à l'OCC.

## 10. Structure, rythme et quêtes

### 10.1 Les trois actes

| Acte | Pause / horloge | Zone | Durée | Niveaux | Combats | Temps forts | Boss |
|---|---|---|---|---|---|---|---|
| **I — « Le 7h12 n'est pas venu »** | Matin, 4h47 → 14h00 | Gare | ~1 h | 1 → 7 | ~18 | Borne (tutoriel), imprimante, Consultant, OCC (7-1-2), Tasse de Relève, « Trois tasses, trois collègues » | **Manager KPI « Auditeur des quais »** (tutoriel bouclier / Sommeil / Caféiné) |
| **II — « Pour raison de circulation »** | Après-midi, 14h00 → 22h00 | Ville + gare | ~1 h 45 | 7 → 14 | ~30 | 3 sabotages (Yasmina, Kevin, Fatou), 3 fragments, Raymonde, Papy Roger, Doudou, la fuite | **Dragon Gonflable** (mi-acte) ; **raid sur l'OCC** : 2 vagues + **Réorganisateur RH** ; trahison de Jean-Mi |
| **III — « Terminus BAG »** | Nuit, 22h00 → 5h00 | BAG | ~1 h 15 | 14 → 20 | ~12 | Veillée d'armes, infiltration, Power Nap Zone, rédemption éventuelle, non-retour | **Comité d'Alignement** ; **Gontran Vanderslide** à 5h00 |
| Épilogue | Mardi 7h12 | Quai 2 | ~5 min | — | — | Diffusion du PHR-2030, fin | — |

Courbe de difficulté : Acte I apprend une faiblesse par ennemi ; Acte II mélange les types (groupes de 2–4) ; Acte III combine tout sous Fatigue haute.

### 10.2 Quêtes principales (fil rouge affiché sur l'écran des départs)

**Acte I** : P1 *Trouver le dossier* (3 slides à l'imprimante) → P2 *Trois tasses, trois collègues* (Josiane, Rudy, Béné) → P3 *L'audit des quais* (mini-boss).
**Acte II** : P4 *Les chantiers d'optimisation* (3 sabotages, ordre libre → Yasmina, Kevin, Fatou) → P5 *Le Dossier Privatix* (3 fragments) → P6 *Défendre l'OCC* (raid, choix Jean-Mi, code 2-2-4-7).
**Acte III** : P7 *Terminus BAG* (atteindre le Bureau du Directeur) → P8 *Le 7h12* (vaincre Vanderslide, choix de la phase pilote).

### 10.3 Quêtes secondaires

| Quête | Acte | Mécanique | Récompense |
|---|---|---|---|
| **Le Wagon-Bar disparu** | I–II | 3 indices : carte des vins 1994 (hall), tablier (salle des pauses), odeur de croque-monsieur (voie 4, **après 18h00**) | Fantôme (marchand + invocation), Moral +10 |
| **Le Combat du Lumeçon** (Papy Roger) | II | Retrouver 4 souvenirs du Doudou (casquette, médaille, photo, ticket de 1987) dans la ville | Brassard du Lumeçon, Moral +10, 150 XP |
| **Le Doudou** (crin) | II | Pendant le combat du Dragon, action contextuelle « Toucher le crin » (1 tour) | Crin porte-bonheur, Moral +2 |
| **Les rumeurs de Raymonde** | II | Livrer 3 cornets aux informateurs avant 21h00 | Moral +3, recette (Sauce andalouse ×3), indices |
| **Quêtes de voyageurs** (×4) | I–II | Courtes (valise orpheline, escalator, voyageur perdu, file éternelle) | Moral +3, 50–150 T |
| **Matricule 4412** | I–III | Nourrir le pigeon 1× par pause | Note de service n° 7 |
| **La Caresse du Singe** | II | Interaction Grand-Place | Critique +5 pendant 3 combats, 1× par pause |
| **Les 12 Notes de service** | I–III | Collectibles (voir ci-dessous) | Moral +1 chacune, +3 à 12/12, archives bonus après le générique |

**Répartition des Notes de service** : n° 1–2 Quais & Passerelle · n° 3–4 Hall · n° 5 Salle des pauses · n° 6 Couloir technique · n° 7 pigeon Matricule 4412 · n° 8 Passage du Centre · n° 9–10 Grand-Place · n° 11 casier de Jean-Mi (Acte II) · n° 12 Bureau du Directeur (BAG). Textes : voir `STORY_AND_LORE.md`.

### 10.4 Conditions de victoire et de défaite

| Situation | Résultat |
|---|---|
| Vanderslide vaincu avant la fin du compteur | Choix final : refuser ou accepter la « phase pilote » |
| Équipe K.O. ou Fatigue 100 hors combat | Mise à pied (§5.8) : Actes I–II retour OCC (−25 % T, Fatigue 50) ; Acte III dernière sauvegarde du BAG ; Moral −5 |
| Compteur de signature à 0 | « Contrat signé » : reprise au début du combat final |
| Repéré par une caméra du BAG | Pas une défaite : combat forcé contre une patrouille renforcée |

### 10.5 Les deux fins

| Fin | Condition | Conséquences |
|---|---|---|
| **Bonne — « Le 7h12 est à l'heure »** | **Refuser** la phase pilote **ET Moral ≥ 60** | Le PHR-2030 est diffusé par le système d'annonces ; le 7h12 est rétabli ; post-générique « Plan Horizon 2040 » |
| **Mitigée — « Phase pilote »** | **Accepter**, ou refuser avec **Moral < 60** | Commission de réflexion ; Privatix récupère l'OCC ; le 7h12 revient en bus de substitution. « Cette fin peut être améliorée. Comme le service. » |

Le Moral est affiché avant le choix final (« Les collègues sont-ils à leur poste ? ») : le joueur sait ce qu'il risque.

## 11. Contrôles (résumé — détail dans le document UX/UI)

| Action | Clavier (AZERTY / QWERTY, via `KeyboardEvent.code`) | Tactile |
|---|---|---|
| Se déplacer | **ZQSD** / **WASD** (mêmes touches physiques) ou flèches | D-pad virtuel (moitié gauche) |
| Valider / interagir | Entrée, Espace, E | Bouton A / toucher l'option |
| Annuler / retour | Échap, Retour arrière, X | Bouton B |
| Menu pause | Échap (exploration), Tab | Bouton Menu |
| Inventaire | I | Menu → Classeur de service |
| Courir | Maj (maintenir) | Double appui sur le D-pad |

En combat, menus et dialogues, le D-pad disparaît : on touche directement les actions et les cibles (≥ 96×96 px logiques). Remappage complet dans les options.

## 12. Hors périmètre (v1) / idées pour plus tard (v2)

- **New Game+ « Plan Horizon 2040 »** (ennemis ×1,3, nouvelle phase du boss, Moral de départ 0) et **mode « Grève du zèle »** (Fatigue ×1,5, pas de café gratuit).
- Cycle libre multi-jours (roulements tournants, badge de service), autres gares et lignes, mini-jeu du Lumeçon, puzzle du roulement géant au BAG.
- Raymonde et Papy Roger en combattants invités ; décor de l'OCC qui évolue avec le Moral ; succès ; manette avancée.
- Traductions néerlandaise et anglaise ; coopération locale à 2 joueurs (non prévue techniquement en v1).

## 13. Annexe — constantes d'équilibrage (`src/config/balance.ts`)

Transposition directe des sections 4 à 9 ; toute modification d'équilibrage se fait ici, jamais dans une scène.

> **Le fichier `src/config/balance.ts` fait foi.** Il reprend ce bloc avec trois adaptations : les clés de pause sont `morning` / `afternoon` / `night` (vocabulaire unique du code), les identifiants de paliers sont en minuscules (`frais`, `burn-out`…) et portent un `label` affichable, et `BOSS_MINUTE` est exprimé en minutes absolues depuis lundi 00:00 (`1740` = mardi 5h00), comme toute l'horloge. Toute modification d'équilibrage se fait dans le code, puis ce bloc est mis à jour.

```ts
// src/config/balance.ts — source unique des chiffres d'équilibrage (GDD §4 à §9).
export type Pause = 'MATIN' | 'APREM' | 'NUIT';

export const BALANCE = {
  clock: {
    CLOCK_MIN_PER_REAL_SEC: 0.125, // 1 min in-game toutes les 8 s réelles (exploration)
    PAUSE_START: { MATIN: 360, APREM: 840, NUIT: 1320 }, BOSS_MINUTE: 300, // mardi 5h00
    ACT_START_MINUTE: { 1: 287, 2: 840, 3: 1320 }, OVERTIME_CAP: { 1: 825, 2: 1305 }, // 4h47/14h/22h ; butées 13h45/21h45
    COST_MIN: { combat: 10, zoneChange: 5, fastTravel: 15, nap: 120, occCoffee: 10, bagNap: 120 },
  },
  fatigue: {
    MAX: 100, START: 20, OVERTIME_MULT: 1.5, TIME_MULT_FLOOR: 0.5, PER_HOUR: { MATIN: 2, APREM: 3, NUIT: 5 },
    COMBAT_BASE: 2, PER_3_ROUNDS: 1, FLEE: 5, CAFFEINE_CRASH: 5, BOSS_PER_ROUND: 1, COLLAPSE_RESET: 90, DEFEAT_SET: 50,
    tiers: [
      { id: 'FRAIS', min: 0, max: 39, acc: 5, dmg: 1.0, init: 1.0, peRegen: 3, crit: 0, statusRes: 0, burnoutExtra: 0 },
      { id: 'FATIGUE', min: 40, max: 69, acc: 0, dmg: 0.95, init: 0.95, peRegen: 2, crit: 0, statusRes: 0, burnoutExtra: 0 },
      { id: 'EPUISE', min: 70, max: 89, acc: -10, dmg: 0.85, init: 0.85, peRegen: 1, crit: 5, statusRes: 0, burnoutExtra: 1 },
      { id: 'BURNOUT', min: 90, max: 99, acc: -20, dmg: 0.75, init: 0.7, peRegen: 0, crit: 10, statusRes: -20, burnoutExtra: 1 },
      { id: 'EFFONDRE', min: 100, max: 100, acc: -20, dmg: 0.75, init: 0.7, peRegen: 0, crit: 0, statusRes: -20, burnoutExtra: 1 },
    ],
    recovery: { OCC_COFFEE: [30, 45, 60], MORNING_COFFEE_BONUS: 10, RELEVE_14H: 30, VEILLEE_22H: 50, GHOST_HOUSE_BONUS: 10, NAP: 40, GOBELET: 20, PREMIUM_COFFEE: 20, PREMIUM_COFFEE_MAX: 3 },
    timeMult: { thermos: 0.8, lungo: 0.75 },
  },
  pause: {
    MATIN: { enemyStatMult: 1.0, xpMult: 1.0, ticketMult: 1.0, critBonus: 0, accBonus: 5, defMult: 1.0, groups: [3, 4], groupSize: [1, 3], aiAttackWeight: 0.6 },
    APREM: { enemyStatMult: 1.1, xpMult: 1.0, ticketMult: 1.2, critBonus: 0, accBonus: 0, defMult: 1.1, groups: [2, 3], groupSize: [2, 4], aiAttackWeight: 0.6 },
    NUIT: { enemyStatMult: 1.2, xpMult: 1.25, ticketMult: 1.5, critBonus: 10, accBonus: 0, defMult: 1.0, groups: [1, 2], groupSize: [1, 3], aiAttackWeight: 0.8 },
  },
  combat: {
    INIT_RANDOM: 5, BASE_HIT: 90, HIT_MIN: 30, HIT_MAX: 99, CRIT_BASE: 5, CRIT_CAP: 50, CRIT_MULT: 1.5, CRIT_PER_MORAL: 10,
    ATK_MULT: 2, DEF_MULT: 1, VARIANCE_MIN: 0.9, VARIANCE_RANGE: 0.2, DEFEND_MULT: 0.5, SHIELD_MULT: 0.5, WEAKNESS_MULT: 2,
    SYNDIQUE_DEF: 1.3, TARIF_REDUIT_DEF: 0.7, FLEE_BASE: 50, FLEE_PER_SPEED: 3, FLEE_MIN: 10, FLEE_MAX: 90,
    STATUS_CHANCE_MIN: 5, STATUS_CHANCE_MAX: 95, HERO_RES_CAP: 50, ENEMY_RES: { normal: 10, elite: 30, boss: 50 }, DODGE: { consultant: 15 },
  },
  status: {
    CAFEINE: { turns: 3, speedMult: 1.25, acc: 10, sleepImmune: true }, SYNDIQUE: { turns: 3, defMult: 1.3 },
    DEMOTIVE: { turns: 3, dmgMult: 0.75, moralPenalty: 30 }, BLOQUE: { turns: 1, immunityTurns: 1 },
    BURNOUT: { turns: 3, hpLossPct: 0.06 }, CONFUSION: { turns: 2, misdirectChance: 0.4 },
    SOMMEIL: { maxTurns: 2, wakeOnDamage: true }, DECALAGE: { turns: 3, acc: -10, initMult: 0.8 },
  },
  progression: {
    MAX_LEVEL: 20, XP_BASE: 40, XP_EXP: 1.5,
    HERO: { hp: [60, 12], pe: [20, 3], force: [10, 2], def: [8, 1.5], speed: [10, 1] },
    ALLY_COEF: { // [pv, force, déf, vit]
      josiane: [1.3, 0.8, 1.4, 0.8], rudy: [1.0, 0.9, 1.0, 1.2], bene: [0.9, 0.8, 0.9, 1.1],
      yasmina: [0.85, 1.0, 0.85, 1.15], kevin: [1.1, 1.3, 1.0, 0.9], fatou: [0.9, 0.6, 1.0, 1.0],
    },
    QUEST_XP: { 1: 50, 2: 150, 3: 300 },
  },
  enemies: {
    STAT_FORMULA: { hp: [20, 12], force: [6, 2], def: [4, 1.3], speed: [8, 1] },
    ARCHETYPES: { // [pv, force, déf, vit]
      consultant: [0.8, 1.0, 0.8, 1.3], managerKpi: [1.4, 0.9, 1.4, 0.8], coachAgile: [0.9, 0.7, 1.0, 1.1],
      reorganisateurRh: [2.5, 1.1, 1.2, 1.0], boss: [1.0, 1.3, 1.3, 1.0],
    },
    XP: { base: 10, coef: 6, exp: 1.5, typeMult: { normal: 1, elite: 2.5, boss: 6 } },
    TICKETS: { perLevel: 3, eliteMult: 3 },
    REFERENCE_LEVEL: { 1: 4, 2: 10, 3: 17 },
    CONSULTANT_SUMMON_ROUND: 3, MANAGER_FORCE_PER_ROUND: 0.05, MANAGER_FORCE_CAP: 0.5, REPORTING_EVERY: 3,
  },
  boss: {
    LEVEL: 20, SIGNATURE_COUNTER: 10, SIGNATURE_MIN_IF_LATE: 6, LATE_STEP_MIN: 30,
    PROOF_PUSHBACK: 3, PROOF_MORAL: 5, PHASE_HP: [1000, 1200, 900],
    CLAUSE_HP: 200, CLAUSE_DEF: 30, CLAUSE_EXTRA_TICK_EVERY: 3,
    PHASE3_MORAL_BELOW: 40, CONCRETE_QUESTION_POWER: 250, COST_CUTTING_MORAL: -3, EARLY_WAIT_FATIGUE_MULT: 0.5,
  },
  moral: {
    START: 10, MAX: 100, GOOD_ENDING_MIN: 60, GENERAL_STRIKE_MIN: 80,
    gains: {
      recruitAlly: 5, actOneBoss: 5, fragment: 2, jeanMiDelivered: 5, jeanMiSpared: -10, jeanMiRedemption: 15,
      ghostQuest: 10, lumeconQuest: 10, sideQuest: 3, serviceNote: 1, allNotesBonus: 3, crinPorteBonheur: 2,
      noirVieilleDame: 5, defeat: -5, endDemotivated: -1,
    },
  },
  economy: {
    DEFEAT_TICKET_LOSS: 0.25, NIGHT_VENDING_MULT: 1.5, PAYROLL_PER_ACT: 30, STACK_MAX: 9,
    BEANS_DROP_CHANCE: 0.2, BEANS_DROP: [1, 3], ELITE_BEANS: [3, 5],
    DROPS: { postIt: 0.4, agrafeuse: 0.25, cleUsb: 0.08, cleUsbElite: 0.5 },
    MACHINE_UPGRADES: [{ level: 2, beans: 15, tickets: 150 }, { level: 3, beans: 40, tickets: 500 }], GOBELETS_PER_PAUSE: [1, 2, 3],
    TIREFOND: [
      { rank: 0, force: 4, crit: 0, tickets: 0, agrafeuses: 0, cleUsb: 0 },
      { rank: 1, force: 10, crit: 0, tickets: 150, agrafeuses: 5, cleUsb: 0 },
      { rank: 2, force: 18, crit: 5, tickets: 450, agrafeuses: 12, cleUsb: 2 },
      { rank: 3, force: 28, crit: 10, tickets: 1000, agrafeuses: 20, cleUsb: 5 },
    ],
  },
} as const;
```
