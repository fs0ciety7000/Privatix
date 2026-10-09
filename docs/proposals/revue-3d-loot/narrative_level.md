# PRIVATIX — Proposition Narrative & Level Design (passage 3D + loot d'équipements)

> Auteur : Narrative & Level Designer (équipe 2). Statut : **proposition**, aucun fichier du repo modifié.
> Sources lues : `docs/LORE.md`, `docs/GDD.md` (§1, §3, §9 à §11), `src/scenes/HubScene.ts`, `src/systems/procedural/` (`roomTemplates.ts`, `ShiftPlan.ts`).
> Hypothèse de travail : 3D temps réel stylisée, caméra isométrique fixe, équipement visible sur le héros.
> **Révision 2** (corrections de l'utilisateur, appliquées dans `docs/LORE.md` et `docs/GDD.md`) : SNCB (nom et logo), « Calatrava » et Elio Di Rupo sont des exceptions autorisées par le porteur ; l'OCC est le **centre opérationnel** (pupitres PACO, RTS, TLI & AIT, RCCA, Permanence conduite, DPD) au rez-de-chaussée arrière du BAG ; plus d'atelier ni de vestiaire ; nouveaux ennemis : Furet putride, Discosaure, Elio Di Rupo (§5).

---

## 0. Intention en une page

1. **Le loot doit servir le thème, pas le contredire.** Le jeu raconte la solidarité (« le build, c'est l'équipe ») ; un loot « je deviens surpuissant tout seul » trahirait ça. Règle : **chaque objet a une provenance collective** (la régie, un collègue parti, le patrimoine de la gare, ou une saisie chez Privatix). On ne trouve jamais un objet « neutre » : on hérite, on récupère ou on confisque.
2. **Les Avantages acquis restent la source principale de puissance du run** (la radio des collègues). L'équipement est la couche persistante et visible : il habille le héros et oriente le build, sans remplacer les collègues. Ordre de grandeur proposé au Game Designer : ~60 % de la puissance vient des Avantages et Réglages, ~40 % de l'équipement.
3. **La 3D sert la lisibilité avant le spectacle.** Trois hauteurs au maximum, une caméra qui ne tourne jamais, des dangers télégraphiés par la lumière et le son. Tout ce que la 3D ajoute (trains, caténaires, néons) devient une **règle de jeu lisible**, jamais un décor qui gêne.
4. **L'écharpe syndicale rouge est l'invariant visuel du héros.** Quel que soit l'équipement, elle reste visible et flotte au vent. C'est la silhouette du jeu.

---

## 1. Le loot dans le lore

### 1.1 D'où vient l'équipement ? Quatre provenances

| Provenance | Ce que c'est dans le lore | Où on le trouve | Ton |
|---|---|---|---|
| **Le magasin de la régie** | Le PHR-2032 a vidé le magasin général de la gare : tout le matériel en stock a été déclaré « réformé » pour être revendu au kilo par Privatix. Les cheminots le récupèrent avant la benne : casques, chasubles, gants, clés. | Casiers de service, consignes, bennes « Matériel réformé — Ne pas récupérer » (on récupère). | « On ne jette pas un casque qui marche. On jette le plan qui veut le jeter. » |
| **Les objets des collègues partis** | Retraités, mutés « en temps réel », postes supprimés : ils ont laissé des affaires dans leur casier, avec leur nom au marqueur. Porter l'objet d'un collègue, c'est le faire voyager encore un peu. | Casiers nominatifs, armoires de poste, salles de pause. Objets toujours **gravés** d'un prénom ou d'une date. | Le cœur sous la blague : chaque objet raconte un départ. |
| **Les prototypes Privatix confisqués** | Privatix équipe ses « ambassadeurs de mobilité » de gadgets hors de prix : gants tactiles, casque à réalité augmentée, baskets « disruptives ». Les ennemis vaincus les « oublient en réunion » ; les colis de livraison sont interceptés. Le matériel est puissant, mais livré avec des **Conditions générales** (un malus). | Sacoches des consultants, colis Privatix, bureaux du BAG, élites. | Satire de la tech managériale : ça marche, mais il y a toujours une clause en petits caractères. |
| **Le patrimoine de la gare** | Les objets qui ont une histoire : la dernière lanterne de l'ancienne lampisterie de la gare, la veste du wagon-bar, le chronomètre de l'Auditeur arrêté sur 7:12. Privatix veut vendre le patrimoine avec la gare ; le héros le met à l'abri en le portant. | Boss (garanti au 1er kill), Wagon-Bar du Fantôme, événements rares. | Épique et tendre : on porte une mémoire. |

**Pourquoi des ennemis « lâchent » du matériel alors qu'ils ne meurent pas ?** (règle « vaincus, pas morts ») : le consultant qui « part en réunion » laisse tomber sa sacoche ; la Borne qui s'éteint crache un dernier objet par sa fente, comme un ticket ; le Drone Optimètre en fin de course largue son colis de livraison sous un petit parachute violet ; le Manager KPI abandonne son « kit de pilotage ». **On ne fouille jamais un corps** : on ramasse ce qui est tombé.

### 1.2 Les 5 raretés

Le code des raretés est **le code des lanternes de Marcel** : en 1987, à la Permanence conduite, Marcel classait le matériel récupéré en y collant une bande de ruban adhésif de couleur, comme on règle les lanternes de signalisation (celles qui éclairent aujourd'hui l'OCC). La couleur du faisceau de loot est la couleur de cette bande.

| # | Rareté | Couleur (proposition) | Justification dans le lore | Règle de jeu suggérée |
|---|---|---|---|---|
| 1 | **Réformé** | Gris ballast `#8A8F98` (lanterne éteinte) | Matériel sorti de l'inventaire par le PHR-2032, cabossé mais honnête. « Réformé, pas mort. » | Stats de base, 0 ou 1 affixe. |
| 2 | **Réglementaire** | Vert voie libre `#3FCF6E` | Matériel conforme au Règlement, encore sous scellé du magasin. Le vert du signal « voie libre ». | 1 à 2 affixes. |
| 3 | **Ancienneté** | Bleu lanterne `#4A8CFF` | Objets de collègues partis, patinés par les années ; même mot que la rareté bleue des Avantages : l'ancienneté, ça se transmet. | 2 à 3 affixes, dont 1 « de métier » lié à une famille de collègue. Gravure du nom affichée. |
| 4 | **Confisqué** | Violet Privatix `#9B5CFF`, **toujours hachuré de ruban de saisie** | Prototypes Privatix détournés. Violet parce que c'est leur couleur ; le ruban hachuré dit « c'est à nous maintenant ». | 3 affixes forts **+ 1 clause** (malus). Béné peut faire annuler la clause au pupitre PACO (« clause abusive », Le Règlement à l'appui). |
| 5 | **Patrimoine** | Or lanterne `#FFB84A` (flamme chaude) | Objets uniques avec une histoire ; Privatix veut les vendre avec la gare. Le doré chaud est celui des lanternes de l'OCC, la couleur du refuge. | Effet unique nommé. Un seul exemplaire par objet. |

**Notes de lisibilité (à valider avec la DA)** :
- Le canon réserve le **turquoise aux ennemis** et le **magenta au danger**. Aucune rareté n'utilise ces teintes ; le bleu d'Ancienneté doit rester un bleu profond, nettement distinct de la turquoise.
- Le **violet** Confisqué est volontairement la couleur de Privatix (c'est le message), mais il est toujours porté par un **motif hachuré** pour ne jamais être confondu avec un accent ennemi.
- Le nom **« Patrimoine »** évite la collision avec « Acquis historique » (rareté or des Avantages). Or = « ce qui a une histoire » dans les deux systèmes : cohérent sans être ambigu.
- Conséquence : la bordure **violette des Avantages « Statutaire »** entre en conflit avec Confisqué. Proposition : Statutaire passe à l'**orange chasuble** (« le statut, c'est la chasuble »). Décision DA et GDD.

### 1.3 Les emplacements et leur rôle

| Emplacement | Visible en 3D | Axe de jeu suggéré (pour le Game Designer) |
|---|---|---|
| **Arme (outil)** | Dans la main, change le jeu de coups | Archétype de combo (équilibré, lourd, allonge, rapide, distance) |
| **Casque** | Silhouette de la tête (la plus lisible en vue de dessus) | Résistances aux effets (marquage du Drone, Team building, Ralenti) |
| **Gilet** | Gros aplat de couleur du torse | Énergie max, réduction de dégâts |
| **Gants** | Mains, effets d'impact | Vitesse d'attaque, critique, dégâts électriques |
| **Chaussures** | Pieds, traînée de dash | Dash (charges, distance, effets), ballast |
| **Badge** | Clip sur la poitrine + lanyard qui **bipe** en couleur | Utilitaire : Mobilisation, économie, interactions avec les portiques à badge du biome 3 |

**Tenues et logo SNCB** (exception autorisée, LORE §1.4) : toutes les pièces de gilet non Confisquées portent le logo SNCB (B bleu dans une ellipse) au dos et sur la poitrine ; les pièces Confisquées portent celui de Privatix. En vue de dessus, le dos du gilet est la surface la plus visible : le logo devient un repère de silhouette.

**La clé du grand-père reste canon.** C'est l'arme de départ et le cœur du personnage. Les armes trouvées sont d'autres **outils** ; Kevin, au pupitre RTS, peut **monter les propriétés d'un outil sur la clé du grand-père** (c'est un Montage de clé, voir 1.6), pour qui veut garder la clé en main tout le Shift. Les Montages de clé du GDD §10.4 deviennent des archétypes d'arme débloqués, pas un système concurrent.

### 1.4 Trente objets, par emplacement

Format : **Nom** (rareté typique) : ligne d'ambiance.

#### Arme (outil)
1. **Clé à tire-fond de dotation 2003** (Réformé) : « Même modèle que celle du grand-père. En moins honnête. »
2. **Barre à mine du chantier de nuit** (Réglementaire, archétype lourd) : « Lente, lourde, définitive. Comme une décision prise sur le terrain. »
3. **Fanion de manœuvre** (Réglementaire, archétype rapide) : « Agité correctement, il arrête un train. Agité très fort, un consultant. »
4. **Perche isolante gravée « D. 1998-2021 »** (Ancienneté, archétype allonge) : « Trois mètres d'allonge. Personne n'a osé la reprendre depuis le pot de départ. »
5. **Télécommande de présentation à pointeur** (Confisqué, archétype distance) : « Saisie au 2e étage. Elle fait avancer les slides et reculer les gens. » *Clause : toutes les 12 s, elle « passe à la slide suivante » toute seule (tir involontaire).*

#### Casque
6. **Casque de chantier fendu** (Réformé) : « Fendu en 2014, réformé en 2023, porté depuis par principe. »
7. **Casquette d'accompagnateur** (Réglementaire) : « La visière est usée exactement là où on la touche pour dire bonjour. »
8. **Lampe frontale de la brigade de nuit** (Réglementaire) : « Éclaire là où les néons ne vont jamais : sous les quais. »
9. **Casque antibruit du dépôt, marqué « Gégé »** (Ancienneté) : « Coupe trente décibels d'annonces et cent pour cent des "on s'aligne". »
10. **Visière à réalité augmentée « Vision 2032 »** (Confisqué) : « Affiche les KPI de chaque ennemi au-dessus de sa tête. Et les tiens. En rouge. » *Clause : ton Burnout est visible des ennemis (les élites ciblent en priorité au-dessus de 70).*

#### Gilet
11. **Chasuble orange délavée** (Réformé) : « Haute visibilité, basse reconnaissance. »
12. **Gilet multipoches du chef de quai** (Réglementaire) : « Sept poches, sept sifflets de rechange. Rudy nie. »
13. **Veste de contrôle renforcée** (Réglementaire) : « Doublée aux épaules, là où tombent les sacs et les reproches. »
14. **Veste de conducteur doublée laine, matricule 3307** (Ancienneté) : « Le col sent encore le café de 4 h. Son conducteur est parti ; la veste, elle, roule toujours. »
15. **Gilet « Ambassadeur Mobilité »** (Confisqué) : « Il est violet. La haute visibilité est réservée à la direction. » *Clause : les Bornes te repèrent de plus loin.*

#### Gants
16. **Gants de manutention troués** (Réformé) : « Le trou du pouce est d'origine. Le reste aussi, à peu près. »
17. **Gants isolants de l'Infra** (Réglementaire) : « Testés à mille volts, puis à deux heures du matin, ce qui est pire. »
18. **Gants de soudeur du dépôt** (Réglementaire) : « Ignifugés. Cramés quand même. »
19. **Mitaines tricotées d'une guichetière partie en 2019** (Ancienneté) : « Pour taper un billet dans un guichet sans chauffage. Béné a reconnu la maille. »
20. **Gants tactiles « Sans Contact »** (Confisqué) : « Conçus pour valider une borne sans la toucher. Ils valident aussi les mâchoires. » *Clause : boire un Gobelet prend 30 % plus longtemps (« Veuillez retirer vos gants »).*

#### Chaussures
21. **Chaussures de sécurité ressemelées** (Réformé) : « Ressemelées trois fois. Le cuir est d'époque, la semelle est de la semaine. »
22. **Bottes de ballast** (Réglementaire) : « Ignorent le ballast. Pas le mal de dos. »
23. **Couvre-chaussures antidérapants** (Réglementaire) : « Pour le quai 3 quand il drache. Il drache toujours sur le quai 3. »
24. **Brodequins de l'aiguilleur du poste de nuit** (Ancienneté) : « Trente ans de nuit dans la même cabine. Elles connaissent le chemin. »
25. **Baskets blanches « Disrupt »** (Confisqué) : « Jamais portées sur un quai. Ça se voit. Ça se sent. » *Clause : sur le ballast, le dash glisse 20 % plus loin que prévu.*

#### Badge
26. **Badge d'accès périmé** (Réformé) : « Bipe orange. Personne ne sait ce que veut dire orange. »
27. **Carte de circulation du personnel** (Réglementaire) : « Permet de voyager partout. Encore faut-il qu'il y ait un train. »
28. **Insigne des vingt-cinq ans de service** (Ancienneté) : « Remis dans une enveloppe kraft, sans discours. Le discours, c'est toi. »
29. **Pin's du Comité d'hygiène 1992** (Ancienneté) : « Le comité n'existe plus. Le pin's tient bon. »
30. **Badge « Visiteur » de cabinet de conseil** (Confisqué) : « Valable une journée. Renouvelé tous les jours depuis 2019. » *Clause : les portiques à badge du biome 3 te laissent passer, mais préviennent un Agent de sécurité.*

> Règle d'écriture (guide de ton §1.4, principe 4) : en jeu, chaque objet affiche **1 ligne d'effet claire + 1 ligne de saveur** au maximum. Les noms de collègues partis sont fictifs et ne renvoient à personne.

### 1.5 Huit objets Patrimoine (légendaires)

| # | Objet | Emplacement | Source | Histoire | Effet (piste) |
|---|---|---|---|---|---|
| 1 | **Le Chronomètre arrêté** | Badge | **Auditeur des Quais, 1er kill garanti** | Il n'avait pas été arrêté depuis l'entrée en fonction de l'Auditeur. Il s'est figé sur 7:12, et son propriétaire l'a regardé pour la première fois. Il l'a posé sur le banc du quai en disant : « Gardez-le. Je n'ai plus besoin de savoir l'heure qu'il devrait être. » | Le premier coup reçu de chaque salle **arrête le temps des ennemis 0,712 s** autour du héros. |
| 2 | **Le Gilet sans manches « Taille unique »** | Gilet | **Fluidifieur, 1er kill garanti** | L'uniforme du Réorganisateur, étiquette intérieure : « S'adapte à tous les postes ». Il est resté accroché au dossier de la chaise à roulettes, au bord du vide, à battre au vent comme un drapeau blanc. Josiane le trouve affreux et refuse qu'on le lave avec le reste. | **« Mobilité interne »** : chaque dash « mute » le héros : +1 charge de dash, et le dash franchit un vide sans chute. |
| 3 | **L'Oreillette sans réseau** | Casque | **Vanderslide, 1er kill garanti** | Branchée depuis des années, elle n'a jamais transmis une seule phrase venue du terrain. Après la défaite de son propriétaire, elle grésille, puis capte enfin la radio de Yasmina. | Immunité au **marquage** et au **Team building** ; les ennemis proches perdent leurs **boucliers d'alignement**. Les lignes radio des collègues arrivent 1 salle plus tôt. |
| 4 | **La Dernière Lanterne** | Arme | Événement rare, biome 1 (voie 4, Nuit) | La dernière lanterne de l'ancienne lampisterie de la gare, fermée en 1987 ; Marcel l'a emportée à l'OCC le soir de la Vieille Dame. Il jure qu'elle brûle depuis 1987 sans qu'on l'ait jamais rechargée, « par habitude ». | Arme à trois feux : le coup 3 change la couleur. **Rouge** étourdit, **vert** accélère le héros, **blanc** éclaire (les Drones perdent leur cible). |
| 5 | **Les Moufles de l'hiver 1987** | Gants | Coffre « Armoire à pharmacie de la régie », biome 2 (rare) | Le soir où la cafetière a quitté la salle des pauses, un accompagnateur l'a portée encore brûlante jusqu'à l'OCC, à mains nues dans ces moufles. Il n'est plus là pour le raconter ; les moufles sentent encore le café. | Boire un Gobelet **brûle** les ennemis au contact pendant 3 s et rend +10 % de soin. |
| 6 | **La Veste blanche du wagon-bar** | Gilet | Quête du Fantôme (récompense finale) ou Wagon-Bar | La veste de service du grand-père du héros, avec une tache de croque-monsieur que personne n'a jamais eu le cœur de nettoyer. Le Fantôme la rend en disant : « Il l'a laissée au comptoir, la dernière nuit. Il savait que quelqu'un reviendrait. » | **« Tournée générale »** : une fois par biome, à 0 Énergie, le héros se relève à 30 % et tous les ennemis de la salle « prennent leur pause » 3 s. Cumulable avec la Mutuelle. |
| 7 | **Les Godillots de Dédé Cornil** | Chaussures | Caisse à outils de l'Infra, biome 1 (rare) | Poseur de voie pendant quarante ans, Dédé disait que le ballast l'avait adopté. Il a posé plus de tire-fond qu'il n'y a de slides dans le PHR-2032. Ses godillots ont été retrouvés rangés au cordeau dans une caisse à outils, lacets noués « pour le suivant ». | Le dash laisse une **traînée de ballast** (ennemis ralentis de 40 %) ; le ballast n'a plus d'effet sur le héros. |
| 8 | **Le Billet composté du sanglier** | Badge | Consigne à bagages, biome 2 ou 3 (rare) | C'est le titre de transport, composté en 2009, que Josiane a trouvé sur le sanglier du train de nuit. Elle l'a raccompagné jusqu'à la bonne gare, puis a gardé le billet. Quand le héros le porte, Josiane fait semblant de ne pas pleurer. | **« Titre valable »** : après avoir vaincu une Borne, les autres Bornes ne ciblent plus le héros pendant 3 s ; les projectiles renvoyés font +25 % de dégâts. |

**Dialogues réactifs** (priorité « Réactive » du §8.2 du LORE) : porter un objet Patrimoine ou un objet gravé d'un collègue déclenche toujours une réplique au retour. Exemples :
- MARCEL (Dernière Lanterne) : « De mon temps, on la remplissait à la main. Elle te reconnaît, on dirait. »
- JOSIANE (Billet du sanglier) : « Range ça bien. Ça, c'est pas dans le règlement, mais c'est dans le cœur. »
- KEVIN (Gilet « Taille unique ») : « Je le touche avec des gants. C'est pas nous, c'est l'autre boîte qui l'a cousu. »

### 1.6 Qui gère quoi au hub (révisé : pupitres du centre opérationnel)

Principe : chaque service est rattaché à la **fonction réelle** du pupitre. Le RTS gère le **matériel roulant** (pas l'équipement personnel) ; l'équipement du héros relève de la **DPD**, qui gère les agents de bord, leurs casiers et leur dotation.

| PNJ | Pupitre / lieu | Service lié au loot | Logique de poste | Réplique de service |
|---|---|---|---|---|
| **Josiane** | **DPD** — casiers et mannequin de la **Cour intérieure** | **Stockage** dans les casiers de la Cour (un casier par emplacement) ; **trois tenues enregistrées** ; **tenue de parade** ; **réforme** (recycler un objet en Pièces détachées, sur bon de réforme) ; le mannequin **porte une copie** de la tenue à essayer. Garde les Souvenirs (canon). | La DPD affecte les agents de bord, gère leur dotation et leurs casiers. | « Ta dotation, je la range. Ce qui est réformé, je le réforme. Proprement. » |
| **Kevin** | **RTS (matériel roulant)** — salle des opérations | **Montages de clé** (y compris « monter un outil sur la clé du grand-père ») ; **Renforcer** un objet avec des Pièces détachées ; **échanges de matériel** (Grains ↔ PS ↔ Pièces). | Le RTS compose les rames et gère les échanges de matériel ; les Pièces viennent du matériel roulant réformé. | « Je te compose la clé comme une rame : motrice devant, café derrière. » |
| **Yasmina** | **RTS (régulation)** | **Choix de la composition du Shift** : roulement, Plan d'Économies, et **sillon de dotation** (orienter le Shift vers un emplacement d'équipement, contre des Grains). | La régulation décide quel train part, quand et dans quelles conditions. | « Je te route vers des chaussures. Voie 3, correspondance assurée. » |
| **Béné** | **PACO** | **Recours** : relancer un affixe (le « bus de remplacement » de l'objet) ; **annuler la clause** d'un Confisqué (Le Règlement) ; liste des **objets saisis** par Privatix ; catalogue des objets dans Le Règlement. | Le PACO trouve une solution de remplacement quand le prévu ne marche pas. | « Une clause abusive ? Article 47. Annulée. Numéro suivant ! » |
| **Rudy** | **TLI & AIT** et écran des départs | **Annonce** les drops Patrimoine en run ; ligne « Dernier objet trouvé » sur l'écran des départs. | Les annonces en gare. | « Attention, attention… objet du patrimoine sur la voie. Je répète : du patrimoine. » |
| **Marcel** | **Permanence conduite** et **Salle photocopieuse** | **Mur des lanternes** au-dessus du Tableau des revendications : chaque objet Patrimoine trouvé rallume une lanterne et débloque une histoire. Nouvelle revendication proposée : **« Bagage accompagné »**. | La Permanence tient le dossier de carrière ; la photocopieuse imprime les revendications. | « Celle-là, je l'ai vue briller en 1987. Accroche-la. » |
| **Fatou** | **RCCA** — salle de repos de nuit | Lit les **clauses** des Confisqués et les commente (rôle narratif). | Le RCCA organise la prise en charge ; Fatou veille sur ce qui use le corps. | « Clause 4 : le porteur renonce à sa pause. Non. Je fais un signalement. » |
| **Le Fantôme** | Coin des palettes de la Cour (wagon-bar reconstitué) | Marchand d'objets **Patrimoine** (1 par visite). | — | « Et pour monsieur-dame, ce sera ? Un peu d'histoire, peut-être ? » |
| **Jean-Mi** | Sans pupitre (coin café) | Avant la révélation, il tient le **registre de dotation** « pour l'inventaire » : les ennemis **Briefés** résistent à l'élément de ton arme. | Il passe de pupitre en pupitre. | « Je note ta tenue. Pour le registre. *(Il range son téléphone.)* » |
| **Raymonde** (en run) | Friterie | Vend 1 objet « d'occasion » par passage, emballé dans un cornet de papier. | — | « Une paire de gants d'occasion, chéri. Avec ou sans sauce ? » |

### 1.7 Ce qui se passe à la mort (support narratif, mécanique à valider par le GD)

- **L'équipement porté est gardé** : les collègues ramènent le héros habillé par le couloir technique. C'est l'attente d'un joueur de jeu à loot.
- **Le butin non porté** voyage dans le **sac de service** : 2 objets rapatriés à la mort (+1 par rang de « Bagage accompagné »), tout en cas de victoire. Le reste est « ramassé par Privatix ».
- **La saisie** : si le héros tombe face à un boss, Privatix « saisit » un objet du sac. Au Shift suivant, un **élite Briefé** le porte, visible en 3D sur sa silhouette (la tenue de l'élite change). Le vaincre rend l'objet avec un niveau de plus (« Restitution avec intérêts »). Béné tient la liste des saisies au pupitre PACO.

---

## 2. Level design en 3D

### 2.1 Ce que la 3D permet, et les règles qui protègent la lisibilité

**Ce que la 3D apporte (et que le pixel art en vue de dessus faisait mal)**
- **Une verticalité vraie** : le quai est 1 m au-dessus de la voie, la passerelle 6 m au-dessus des quais. On le voit à l'ombre, à la tranche du quai et à la parallaxe.
- **Des dangers qui arrivent du hors-champ** : un train annoncé par son phare dans le brouillard avant d'être visible.
- **La lumière comme règle de jeu** : néons Privatix, lampes de quai, ombres des arcs, lanternes de l'OCC.
- **Des volumes destructibles et poussables** : chariots, panneaux, rayonnages, cloisons.
- **L'équipement lisible sur le corps** : casque, gilet, outil ; et sur les élites (objets saisis).

**Règles de lisibilité (non négociables)**
1. **Caméra isométrique fixe**, rotation 45°, plongée ~55°, focale longue (ou orthographique). **Elle ne tourne jamais en combat.** Seul un léger recul est permis dans les grandes salles, plus un rapprochement sur les moments de loot et de boss.
2. **Trois hauteurs au maximum par salle** : **−1** voie (≈ 1 m sous le quai), **0** quai (plan de combat principal), **+1** passerelle ou mezzanine (≈ 3 m). Les changements de niveau passent par des rampes, escaliers ou échelles lisibles, ou par la chute (sans dégât de chute : seulement une exposition).
3. **Occlusion** : tout ce qui se trouve au-dessus de +1 entre la caméra et le héros passe en dithering à 30 % (toits d'abri, verrière, poutres). Le héros et les ennemis gardent un liseré visible à travers les obstacles.
4. **Lecture de la hauteur** : ombres portées nettes à la verticale, ligne de sécurité jaune sur toutes les tranches de quai, arêtes éclairées, brouillard qui s'accumule dans les creux (les voies sont plus brumeuses que les quais).
5. **Code couleur canon conservé** : ennemis turquoise, tout ce qui blesse en magenta, accents violets Privatix, cheminots en orange, lumière chaude = refuge. Les faisceaux de loot n'empruntent jamais le magenta ni la turquoise.
6. **Tout danger d'environnement a un télégraphe en trois canaux** : lumière, son, marquage au sol magenta, pendant au moins 1,5 s (2,5 s pour les trains).
7. **Le loot n'apparaît jamais sur une voie active ni au bord d'un vide.** S'il y est projeté, il glisse vers le quai le plus proche.

### 2.2 Les systèmes d'environnement communs

| Système | Fonctionnement | Télégraphe | Ce que le joueur peut en faire |
|---|---|---|---|
| **Trains qui passent** | Une rame traverse une voie active en ~0,8 s. Canon : élimine les non-élites, retire 40 % d'Énergie max au héros. | **2,5 s** : le feu de signal de la voie passe au rouge (claquement), les rails vibrent et projettent des étincelles, un phare blanc perce le brouillard au bord de l'écran, l'annonce de Rudy est coupée, puis une bande magenta pulse sur la voie. | Projeter les ennemis sur la voie (canon : ils « partent en réunion ») ; dans le faisceau d'aiguillage, changer l'aiguille pour dévier la rame. |
| **Rames à quai qui partent** | Mur mobile : la rame démarre et emporte la ligne de couverture. | Portes qui bipent puis se ferment, sifflet. | Se cacher derrière contre les Bornes, puis bouger au départ. |
| **Caténaires qui étincellent** | Poteaux et fils au-dessus des voies. Cycle : un tronçon s'arc-boute vers le sol pendant 1 s. | Grésillement, étincelles qui tombent en pluie fine, cercle magenta au sol. | Frapper un poteau déclenche l'arc en avance sur les ennemis dessous (synergie famille Kevin). La **caténaire tombée** (canon) serpente au sol et électrifie une flaque. |
| **Éclairage dramatique** | Deux régimes : **néons Privatix** (blanc-violet, froids, bourdonnants) et **lampes de quai** (sodium ambré, chaudes). | — | Sous les **néons**, les Drones voient le héros de plus loin et les ennemis portent leur bouclier d'alignement. Les néons sont **destructibles** : les casser crée une zone d'ombre où les Drones perdent leur cible (canon). Les lampes de quai sont indestructibles : c'est le terrain des cheminots. |
| **Signalétique libérée** | La signalétique SNCB de chaque salle est couverte d'autocollants violets Privatix. | — | Quand la salle est nettoyée, les autocollants se décollent et tombent ; le logo SNCB bleu et blanc réapparaît. C'est le signal visuel d'une salle tenue (LORE §1.4, GDD §3.6). |
| **Brouillard bas** | Volume à hauteur de cheville, plus épais sur les voies. | — | Le Matin, il cache le ballast mais **jamais** les télégraphes, qui sont émissifs et passent au-dessus. |
| **Objets poussables** | Chariots à bagages « Ne pas pousser », bancs de flex office, chaises à roulettes. | — | Dash dedans : projectile lourd ; contre un quai, « plaqué contre le quai ». Le banc de Marcel est indestructible et sacré. |

**Roulements** : *Matin* brouillard dense et néons froids ; *Après-midi* soleil rasant, ombres longues, il drache sur le quai 3 ; *Nuit* bleu profond, les caténaires sont la principale source de lumière, les trains plus rares mais plus rapides.

### 2.3 Biome 1 — Quais & Voies

Les gabarits reprennent les intentions de `roomTemplates.ts` (`quai-1`, `quai-2`, `aiguillage`, `hall`) et du GDD §3.1 (Passage sous voies), en y ajoutant la hauteur.

**B1-A « Double voie » (dérivé de `quai-1`, 52×30)**
- *Disposition* : quai nord (0), voie 1 (−1), **quai central** (0) avec abri et bancs, voie 2 (−1), quai sud (0, arrivée du héros). Une **passerelle de service métallique** (+1) enjambe les deux voies à l'est, avec escaliers aux deux bouts.
- *Dangers* : trains alternés voie 1 / voie 2 (jamais simultanés) ; caténaire étincelante au-dessus de la voie 2 ; Bornes postées sur la passerelle (tir plongeant, dos exposé depuis l'escalier).
- *Loot* : récompense de salle sur le **chariot de service** du quai central ; **casier de service** dans l'abri (porte vitrée, se brise d'un coup) ; les objets lâchés sur les voies glissent vers le quai central.

**B1-B « Quai de l'abri » (dérivé de `quai-2`, 40×24)**
- *Disposition* : grand quai (0) sous un **abri à toit en dents de scie** (occlusion en dithering), une seule voie (−1) au nord, **quai de marchandises** surélevé (+1) à l'ouest avec un monte-charge. Le **banc de Marcel** est ici (événement « banc de Marcel »).
- *Dangers* : une **rame à quai** qui part au bout de 40 s et découvre une ligne de Bornes ; néons Privatix de l'abri « Expérience Quai » (destructibles) ; l'Après-midi, pluie et flaques conductrices près de la caténaire.
- *Loot* : récompense au pied de l'écran des départs ; **armoire à pharmacie de la régie** fixée au pilier de l'abri ; sur le quai de marchandises (+1), une **caisse à outils de l'Infra** accessible par le monte-charge (risque : Bornes en contrebas).

**B1-C « Faisceau d'aiguillage » (dérivé de `aiguillage`, 52×30)**
- *Disposition* : salle majoritairement à −1 (ballast, −15 % de vitesse), voies qui se croisent en diagonale, **îlots de quai** (0) comme refuges. Au nord-est, la **cabine de l'aiguilleur** (+1) sur pilotis, avec échelle. Deux **leviers d'aiguille** au sol.
- *Dangers* : un train toutes les 12 s sur l'un des deux itinéraires ; le **levier** (une frappe) change l'itinéraire : on peut envoyer la rame sur un groupe de consultants. Caténaire tombée qui serpente entre deux voies.
- *Loot* : la récompense apparaît **dans la cabine de l'aiguilleur** (il faut monter, donc quitter la sécurité des îlots) ; les **Brodequins de l'aiguilleur** (Ancienneté) y apparaissent plus souvent ; coffre « consigne » sur un îlot.

**B1-D « Passage sous voies » (GDD §3.1, 60×14)**
- *Disposition* : long couloir carrelé à 0, plafond bas (le seul endroit du biome sans brouillard), deux **escaliers** remontant vers les quais (portes de sortie), niches de service le long des murs. Les trains passent **au-dessus** : grondement, poussière qui tombe, néons qui vacillent (ambiance, sans dégâts).
- *Dangers* : **portiques de rentabilité** (canon : « accès facturé à la minute ») qui balaient le couloir d'un rideau laser violet (télégraphe 1,5 s) ; quand un train passe au-dessus, les néons s'éteignent 2 s (les Drones perdent leur cible, les Bornes tirent à l'aveugle).
- *Loot* : récompense au milieu du couloir, sous l'unique lampe de quai survivante ; **distributeur « HORS SERVICE »** dans une niche : le frapper 3 fois (clin d'œil au code de l'OCC) fait tomber un objet Réformé ou Réglementaire.

**Arène de l'Auditeur** (dérivée de `arene-auditeur`) : quai 2 / voie / quai 3 sous l'écran des départs géant ; en phase 2 « Plan de transport optimisé », la 3D montre les trains qu'il commande arriver depuis le fond de l'écran, leur phare comme télégraphe.

### 2.4 Biome 2 — La Passerelle

**B2-A « Tablier » (64×14)**
- *Disposition* : long ruban de passerelle à +1, garde-corps vitrés avec **brèches** (vides). En contrebas (−2, purement visuel et non accessible), les voies et les trains, vus comme des traînées de lumière : on mesure le vertige.
- *Dangers* : **rafales de vent** toutes les 6 à 8 s (canon), signalées par les feuilles « PROVISOIRE v14 » qui s'envolent dans la direction du souffle 1 s avant ; les brèches sont soulignées d'une lueur magenta au sol quand le vent souffle vers elles.
- *Loot* : au bout du tablier, sur le **banc face au vide** avec un gobelet encore tiède (détail canon) ; le banc est en retrait du bord, sur une zone sécurisée.

**B2-B « Nœud sous le grand arc » (40×32)**
- *Disposition* : plateforme centrale à +1 sous l'arc principal, quatre bras de passerelle, **dalles de verrière** au sol dont certaines sont fissurées. En dessous (0), une **passerelle de maintenance** accessible en tombant à travers une dalle brisée (−10 % d'Énergie, puis escalier de retour).
- *Dangers* : dalles fissurées qui cèdent après deux passages (craquement + toile d'araignée lumineuse) ; Drones nombreux, qui perdent leur cible dans les **ombres de l'arc** (bandes d'ombre qui tournent avec le roulement).
- *Loot* : une **nacelle de maintenance** suspendue sous l'arc : frapper le treuil la fait descendre au centre ; la récompense est dedans.

**B2-C « Escalators » (40×22)**
- *Disposition* : trois paliers en escalier (0, +½, +1) reliés par des **escalators** qui ne montent que vers le BAG (canon), en service un jour sur trois : en jeu, leur état alterne toutes les 15 s (panneaux « En service (aujourd'hui) » / « Hors service (demain) »).
- *Dangers* : un escalator en service est un tapis roulant qui pousse vers le haut ; les consultants en descendent par vagues (apparition diégétique) ; Bornes au palier supérieur.
- *Loot* : récompense au palier du milieu ; un **escalator « en panne »** cache une porte secrète vers un **casier de service** (canon GDD §3.5).

**B2-D « Verrière » (40×24)**
- *Disposition* : on marche **sur** la verrière (+1, passerelles de nettoyage) et **sous** elle (0) ; les deux niveaux sont reliés par deux échelles ; la verrière est transparente, on voit les ennemis de l'autre niveau.
- *Dangers* : panneaux de verre qui se fendent sous les coups lourds ; câbles de suspension qui vibrent ; un panneau Privatix envolé, coincé dans les câbles (canon), oscille et balaie une ligne.
- *Loot* : un **colis Privatix confisqué** coincé dans les câbles, au niveau +1 : le faire tomber d'un coup d'outil ; Matricule 4412 se pose parfois dessus.

### 2.5 Biome 3 — Hall & BAG

**B3-A « Hall historique » (52×30)**
- *Disposition* : grand volume en bois clair, **guichets bâchés** au nord (dont celui de Béné), **mezzanine** (+1) en fer à cheval avec garde-corps, le « Corner Expérience Voyageur » au centre (écran tactile et plante en plastique).
- *Dangers* : Bornes et Hôtesse holographique sur la mezzanine ; écrans « Valeurs » qui donnent +25 % aux ennemis dans leur cône de lumière (canon : écrans de visio) ; on peut les éteindre en frappant le projecteur.
- *Loot* : **derrière la bâche du guichet de Béné** (coffre spécial : « Guichet fermé », il s'ouvre avec le tampon si le Souvenir est équipé) ; la carte des vins de 1994 (quête du Fantôme) reste derrière un cadre.

**B3-B « Open-space » (52×30)**
- *Disposition* : plateau à 0, bureaux bas en îlots, **cloisons mobiles** (canon : toutes les 10 s), salles vitrées le long des murs, un **bureau surélevé de manager** (+½) avec vue sur tout le plateau.
- *Dangers* : les cloisons glissent sur des rails au plafond (télégraphe : bip + bande magenta sur leur trajectoire) et peuvent coincer le héros ; chaises à roulettes poussables ; écrans de KPI.
- *Loot* : sur le bureau du « Head of » vide (+½), un **colis Privatix confisqué** encore sous film ; tiroirs de bureau fouillables (Réformé, Tickets).

**B3-C « Archives » (40×24)**
- *Disposition* : **rayonnages mobiles** sur rails formant des allées, éclairage par lampes de bureau isolées (flaques de lumière dans le noir), une **galerie** (+1) le long du mur avec échelle de rayonnage. Salle-événement de la Preuve 3.
- *Dangers* : les rayonnages se referment (télégraphe : manivelle qui tourne seule + grincement + allée surlignée magenta) ; Pense-bête qui sortent des cartons.
- *Loot* : **carton d'archives « 1987 — NE PAS DÉTRUIRE »** au bout d'une allée qui se referme (il faut le prendre entre deux cycles) ; probabilité accrue d'objets Ancienneté (« dossiers du personnel »).

**B3-D « Couloir d'étage et ascenseurs » (60×14)**
- *Disposition* : couloir moquetté, portes vitrées à badge des deux côtés, **trois ascenseurs** au fond. Le **Palier du 3e** (repos) suit ce gabarit.
- *Dangers* : chaque ouverture d'ascenseur libère une vague (télégraphe : la flèche de l'étage s'allume, ding) ; photocopieuses-tourelles dans des alcôves ; **portiques à badge** qui bipent rouge et appellent un Agent de sécurité, sauf si le héros porte un badge adapté.
- *Loot* : dans la **salle de sieste « Power Nap Zone »** fermée à clé depuis son inauguration (canon) : l'ouvrir de force est un choix (alarme : une vague de plus) contre un coffre garanti.

### 2.6 Le hub OCC en 3D (révisé : centre opérationnel, BAG, Cour intérieure)

Le hub est l'OCC, **centre opérationnel** au rez-de-chaussée arrière du **BAG**, et ses alentours immédiats. Privatix occupe les étages au-dessus : on l'entend (réunions, roulettes de chaises), on la voit à travers la cage d'escalier vitrée, on ne la croise pas. Le canon détaillé est dans `docs/LORE.md` §3.1-3.2 et `docs/GDD.md` §11.

| Lieu | Contenu 3D | Stations |
|---|---|---|
| **Le sas** (arrivée) | Couloir bas, carrelage, le distributeur « HORS SERVICE » qui pivote (code 7-1-2, puis 2-2-4-7) ; boîte à badges. | Arrivée après la mort. |
| **La salle de repos de nuit** | Petite pièce sans fenêtre, canapé éventré, lit de camp, lumière tamisée. Contiguë au pupitre RCCA. | Fatou : réapparition, soins. |
| **La salle des opérations** | Grande salle basse, **rangée de pupitres en arc face à un mur d'écrans** (plan du réseau, trains en mouvement, caméras de quai). Fenêtres basses sur la Cour, à hauteur de pavés. Coin café avec la Vieille Dame sur son autel de traverses ; plaque des 7 commandements au-dessus. Lumière : écrans bleutés et lanternes chaudes de Marcel. | Pupitres PACO (Béné), RTS régulation (Yasmina) et matériel roulant (Kevin), TLI & AIT (Rudy), Permanence conduite (Marcel), coin café (Jean-Mi, puis Fatou). |
| **La Salle photocopieuse** | Petite pièce encombrée de ramettes, **photocopieuse de 1987** qui chauffe et clignote ; tout le mur est le Tableau des revendications en liège, avec les Preuves photocopiées, les fils rouges et, au-dessus, le **Mur des lanternes**. | Marcel : Tableau des revendications, Cahier de revendications. |
| **La Cour intérieure** (d'après les photos du lieu réel) | Cour pavée **en U**, mousse entre les pavés, vieilles traces de peinture **rouge et bleue** au sol ; bâtiments de **cinq étages en brique jaune** années 50 sur un **soubassement gris strié de coulures** ; **cage d'escalier vitrée** sur toute la hauteur (escalier condamné vers les étages Privatix, silhouettes de consultants derrière le verre) ; **climatiseurs** en façade, **gaine de ventilation** argentée ; **palettes** ; **petits panneaux bleus** sur piquets ; **deux voitures de service** ; ciel gris. Le 4e côté, ouvert, mène au couloir technique. | Josiane (DPD) : **casiers d'équipement** sous un auvent contre le soubassement, **mannequin** planté sur les traces de peinture ; le Fantôme sur les **palettes** au pied de la cage vitrée ; la sortie du Shift. |
| **Le coin poubelles** (angle de la Cour) | Pignon de **brique sombre** à fenêtre murée, **toit bâché déchiré** qui claque au vent, rustine de planche ; **six conteneurs verts à couvercle jaune** qui débordent ; **tas de sacs bleus** ; mousse et papiers. | Antre du **Furet putride** : rencontre optionnelle quand un couvercle se soulève. |

**Lumière et 3D** : la salle des opérations est le seul intérieur éclairé surtout par des **écrans** (bleu froid, lisible) tempérés par les lanternes ; la Cour donne le roulement (gris du Matin, orangé de l'Après-midi, Nuit éclairée par les fenêtres des étages Privatix, aux néons violets). Le contraste raconte la géographie : en bas, le service ; en haut, la cession.

**Circulation** : sas → salle des opérations → Cour → sortie, en ligne droite. Les stations d'équipement (casiers et mannequin de la DPD) sont dans la Cour, **sur le chemin de la sortie**, pour tenir l'objectif du GDD (< 90 s entre deux runs).

---

## 3. Mise en scène du loot

### 3.1 Le moment du drop, par rareté

| Rareté | Ralenti | Faisceau | Son (jingle diégétique) | Autre |
|---|---|---|---|---|
| **Réformé** | Aucun | Aucun ; reflet gris au sol | « Clac » de composteur | Nom affiché 1 s, petit. |
| **Réglementaire** | Aucun | Point lumineux vert, colonne de 0,5 m | « Ding » (première note du carillon de gare) | — |
| **Ancienneté** | Aucun | Colonne bleue de 1,5 m | « Ding-dong » (deux notes) | La gravure (« Gégé », « matricule 3307 ») s'affiche sous le nom. |
| **Confisqué** | Micro-gel de 120 ms | Colonne violette **hachurée** de 2 m, cercle de ruban de saisie au sol | Bip de borne + scotch arraché | Le colis ou la sacoche s'ouvre d'elle-même. |
| **Patrimoine** | **Ralenti à 30 % pendant 0,6 s**, seulement quand aucun ennemi n'est vivant ; sinon le drop est **différé** à la salle nettoyée | **Colonne or** qui perce le brouillard et le plafond, visible de toute la salle ; les poussières y scintillent | **Sifflet de la Vieille Dame** (canon : elle siffle avant les moments importants) puis carillon complet en quatre notes | Annonce de Rudy : « Attention, attention… objet du patrimoine sur la voie. Je répète : du patrimoine. » La caméra avance légèrement. Une réplique radio du collègue concerné suit. |

**Règles** :
- Pas de ralenti pendant un télégraphe de boss. Pas de jingle pendant une ligne radio scénarisée : le jingle attend.
- La hauteur du faisceau grandit avec la rareté : on reconnaît la rareté de loin, avant la couleur (accessibilité daltoniens). La forme sert de code aussi : point, colonne, colonne hachurée, colonne qui perce le plafond.
- Les ennemis lâchent leur butin de façon diégétique : la sacoche du consultant s'ouvre, la Borne crache l'objet par sa fente, le Drone largue un colis sous parachute violet, le Manager KPI laisse tomber sa tablette « kit de pilotage ».

**Le ramassage** : approcher affiche un **Bon de dotation** (fiche administrative avec flèches vertes et rouges de comparaison, 1 ligne d'effet + 1 ligne de saveur). Équiper déclenche une **animation d'habillage de 0,4 s**, annulable par un dash ; la pièce apparaît immédiatement sur le modèle 3D.

### 3.2 Les coffres thématiques

| Coffre | Où | Ouverture | Contenu | Note de mise en scène |
|---|---|---|---|---|
| **Casier de service** | Biomes 1 et 2 (abris, niches) | Une frappe sur le cadenas | 1 objet Réformé à Ancienneté (Ancienneté si le casier porte un nom) | La porte grince ; à l'intérieur, une photo ou un mot (« Bonne retraite, Gégé ») : lore en une ligne. |
| **Armoire à pharmacie de la régie** | Piliers de quai, salles de pause | Interaction | 1 Gobelet ou soin de 15 % **+** gants ou casque, avec une chance de **Moufles de l'hiver 1987** | Croix verte qui clignote, étiquette « Contrôlée le 03/1998 » ; Fatou la commente au retour. |
| **Colis Privatix confisqué** | Biome 2 (câbles), biome 3 (bureaux), largué par un Drone | **« Signature requise »** : maintenir l'interaction 1,5 s pendant qu'un Drone livreur arrive (mini-embuscade) | 1 objet **Confisqué garanti** | Film violet, étiquette « Fragile — Disruptif ». Le héros signe « Reprogrammé ». |
| **Caisse à outils de l'Infra** | Biome 1 (quai de marchandises, voies) | Cadenas « l'autre boîte » : 3 frappes | Arme ou gants ; chance de **Godillots de Dédé Cornil** | Kevin, à la radio : « C'est pas nous… ah si, celle-là c'est nous. » |
| **Consigne à bagages** (canon) | Salle Café / trésor | Interaction | Grains, Tickets, Note de service ; chance de **Billet composté du sanglier** | Inchangée, elle gagne seulement un emplacement d'objet. |
| **Chariot du wagon-bar** | Voie 4, Nuit (événement du Fantôme) | « Et pour monsieur-dame, ce sera ? » | Chance d'objet Patrimoine | Particules jaunes, odeur de croque-monsieur (canon). |
| **Faux coffre : Borne « Point Relais »** | Biomes 2 et 3, rare | Elle se déplie quand on s'approche | Petit ennemi (variante de la Borne) qui lâche un Confisqué une fois vaincue | Barks : « Votre colis est en cours d'acheminement. » / *(vaincue)* « Colis… livré… au voisin… » |

### 3.3 Le boss et son objet Patrimoine garanti au premier kill

Principe : au **premier kill** de chaque boss, l'objet Patrimoine est **l'objet du boss lui-même**, en plus de la Preuve canon. La scène de défaite existante devient la mise en scène du drop, sans réécriture lourde.

- **L'Auditeur des Quais → le Chronomètre arrêté.** Le chronomètre s'arrête sur **7:12** (canon). L'Auditeur le regarde, le décroche, le pose sur le banc du quai : « Gardez-le. Je n'ai plus besoin de savoir l'heure qu'il devrait être. » Sifflet de la Vieille Dame, colonne d'or au-dessus du banc. La Preuve n° 1 sort de sa tablette éteinte : deux récompenses, deux socles côte à côte.
- **Le Fluidifieur → le Gilet « Taille unique ».** La chaise roule vers le bord et s'arrête juste à temps (canon). Le gilet reste accroché au dossier et bat au vent ; la chaise est **sur une dalle sécurisée** (le loot ne touche jamais un vide). Rudy à la radio : « Attention, attention… il a laissé son gilet. Il a pas laissé de préavis. »
- **Gontran Vanderslide → l'Oreillette sans réseau.** À genoux, oreillette de travers (canon), il la retire : « Elle n'a jamais rien capté, de toute façon. » Elle grésille au sol, puis capte la voix de Yasmina. Colonne d'or dans la Salle du Conseil, **avant** l'enchaînement du retour et du saccage de l'OCC (J10) : le joueur ramasse avant la cinématique.
- **Kills suivants** : chance d'objet Patrimoine dans la table du boss, avec protection contre la malchance (« **Préavis** » : garanti après 5 kills sans Patrimoine, signalé par Béné : « Préavis déposé. Délai : un Shift. »).

---

## 4. Ce qui ne change pas, et ce qu'il faut mettre à jour dans le LORE

### 4.1 Canon intouchable

- **Le pitch et la boucle** : le 7h12 supprimé, le PHR-2032, la signature au BAG, le **Sondage éternel** comme justification de la boucle.
- **Tous les personnages, leurs arcs, leurs tics et leurs Souvenirs** : Marcel, Fatou, Kevin, Béné, Yasmina, Josiane, Rudy, Jean-Mi (trahison, choix moral, rédemption), le Fantôme, Raymonde, Matricule 4412, la grand-mère.
- **Les factions** (la SNCB est le service public défendu, LORE §1.4) : Privatix Rail Solutions, Synergia Partners, Hubert Rentabilis (jamais combattu), Vanderslide, « l'Infra » et « l'autre boîte », les cheminots, les **voyageurs neutres, jamais cibles et jamais source de loot**.
- **Les trois biomes, leurs boss et leurs Preuves** ; la vraie fin collective (défense de 90 s, pas de duel) ; l'épilogue à 7h12.
- **Le guide de ton et les interdits** (§1.4) : humour belge, satire du système et pas des gens, « vaincus, pas morts », aucune personne ni marque réelle **hors des trois exceptions autorisées** (SNCB, « Calatrava », Elio Di Rupo).
- **Le vocabulaire** : Shift, Énergie, Burnout, Gobelets, Tickets, Avantages acquis, Motions communes, PS, Grains, Pièces, Tasses, Souvenirs.
- **La clé à tire-fond du grand-père** comme arme de départ et objet du cœur ; **l'écharpe syndicale rouge** comme invariant visuel.
- **Les Avantages par radio** restent le cœur du build (thème de la solidarité).

### 4.2 Points du LORE (et du GDD) à mettre à jour

| # | Où | Problème ou ajout | Proposition |
|---|---|---|---|
| 1 | LORE §1.4 | ~~Renommer « Retard SNCB »~~ **Annulé** : le porteur du projet autorise le nom et le logo SNCB. | **Fait** : exception n° 1 ajoutée au §1.4 (dash, signalétique, trains, tenues, écran de titre, motif « signalétique libérée »). |
| 2 | LORE §1.4 | ~~Renommer « Calatrava »~~ **Annulé** : surnom autorisé par le porteur. | **Fait** : exception n° 2 au §1.4 (le surnom reste, l'architecte n'apparaît pas). |
| 3 | §1.4 Règles d'écriture | « Boîte de dialogue du hub en 640×360 logique » : référence au rendu pixel. | Exprimer la règle en lignes (2 lignes maximum), indépendamment de la résolution. |
| 4 | §1.4 Interdits | Ajout : aucun équipement de marque réelle (EPI, chaussures, électronique) ; le loot tombe des **sacoches et colis**, jamais d'un corps ; les voyageurs ne lâchent jamais rien. | Ajouter deux puces. |
| 5 | Nouveau §3.6 « La dotation » | Provenances du loot, code des lanternes et 5 raretés (Réformé, Réglementaire, Ancienneté, Confisqué, Patrimoine). | Reprendre §1.1 et §1.2 du présent document. |
| 6 | §3.1-3.2 OCC et hub | L'OCC devient le centre opérationnel au rez-de-chaussée arrière du BAG. | **Fait** : pupitres et rôles, sas, salle de repos de nuit, salle des opérations, Salle photocopieuse, Cour intérieure (photos), coin poubelles, cage d'escalier vitrée. **Reste à faire si le loot est validé** : casiers d'équipement de la DPD et Mur des lanternes dans le §3.2. |
| 7 | §3.5 Évolution de l'OCC | Pas de trace du loot. | Une lanterne dorée rallumée par objet Patrimoine ; néons violets du saccage à arracher pendant le « chantier ». |
| 8 | §4 Fiches PNJ | Services. | **Fait** : postes et services remappés sur les pupitres. **Reste à faire si le loot est validé** : services loot du tableau 1.6 ; pour Jean-Mi, le **registre de dotation** comme indice de trahison (J8). |
| 9 | §2.4 Jalons | J5 / J7 / J10. | Ajouter les objets Patrimoine garantis des trois boss ; nouveau jalon « Premier objet Patrimoine » (scène de Marcel au Mur des lanternes). |
| 10 | §6 Ennemis | Comportement de loot. | Ajouter pour chaque ennemi la façon de lâcher (sacoche, fente, parachute, kit) ; étendre l'affixe **Briefé** à l'équipement (résistance à l'élément de l'arme) ; ajouter la **Borne « Point Relais »** et les **élites porteurs d'objets saisis**. |
| 11 | §7 Boss | Défaites. | Intégrer les répliques de remise d'objet (§3.3 ci-dessus). |
| 12 | §8.3 Conditions de dialogue | Nouvelles conditions. | `equippedHeritage`, `lastLootRarity`, `itemSeized`, `wearsColleagueItem`, `confiscatedClauseActive`. |
| 13 | §9.1 Notes de service | Trois Notes à ajouter (ci-dessous). | N° 16 à 18. |
| 14 | §9.2 Glossaire | Termes manquants. | **Dotation** (« Ce qu'on te donne quand on ne peut plus te donner d'augmentation »), **Réformé** (« Encore utile, déjà inutile aux yeux du tableur »), **Patrimoine** (« Ce qu'on vend en dernier, parce qu'on ne sait pas l'estimer »), **Conditions générales** (« Le vrai contrat, en police 6 »). |
| 15 | GDD §9.2 Avantages | Bordure violette « Statutaire » en conflit avec Confisqué. | Passer Statutaire à l'**orange chasuble**. |
| 17 | LORE §6.8, §6.9, §7.5 ; GDD §3.9, §7.10, §11 | Nouveaux ennemis. | **Fait** : Furet putride, Discosaure, Elio Di Rupo « l'Invité d'honneur » (voir §5 ci-dessous). |
| 16 | GDD §1.3 et `PIXEL_ART_GUIDE.md` | Références pixel art (640×360, `pixelArt: true`, tuiles 16 px). | Hors périmètre narratif : à reprendre par la DA et la technique si la 3D est validée. Les tailles de salle en tuiles du GDD §3.1 restent utilisables comme mètres (1 tuile ≈ 0,5 m). |

**Trois nouvelles Notes de service (proposition)**

**N° 16 — « Dotation vestimentaire : rationalisation »** *(biome 1, casier de service)*
> Afin de fluidifier la gestion des stocks, la dotation vestimentaire est remplacée par un forfait « tenue responsable » de 0 €.
> Les agents sont invités à se vêtir de leur engagement.

**N° 17 — « Matériel réformé : destruction obligatoire »** *(biome 2, benne)*
> Tout matériel réformé sera détruit afin d'éviter qu'il ne continue de fonctionner.
> Toute récupération sera assimilée à une utilisation non autorisée d'un objet fonctionnel.

**N° 18 — « Colis non réclamés »** *(biome 3, colis Privatix)*
> Les équipements « Ambassadeur Mobilité » non distribués seront conservés au 2e étage dans l'attente d'ambassadeurs.
> Le recrutement des ambassadeurs est suspendu jusqu'à la fin de la phase pilote.

---

## 5. Les nouveaux ennemis majeurs (révision 2)

Le canon complet est dans le LORE (§6.8, §6.9, §7.5), avec la version design dans le GDD (§3.9, §7.10, §11). Voici leur place en level design 3D et dans le loot.

| Ennemi | Place dans l'histoire | Biome et arène 3D | Loot (si le système est validé) |
|---|---|---|---|
| **Le Furet putride** | « Solution de tri autonome » de Privatix, grossie aux sacs bleus depuis l'**externalisation du ramassage** ; hors organigramme, il sert de fouineur à l'Auditeur et suit l'odeur du café jusqu'à l'OCC. | Élite majeur du biome 1 (passage sous voies : il surgit des plaques d'égout) et **rencontre optionnelle dans le coin poubelles** de la Cour : arène plate et pavée, couvercles qui claquent (télégraphe), nuages d'odeur magenta, sacs bleus en projectiles. | Lâche ce qu'il a avalé : objets **Réformés** en grand nombre, chance d'un objet de collègue (« retrouvé dans les poubelles du BAG »). |
| **Le Discosaure** | Senior Partner fondateur de Synergia Partners ; il vend le même plan depuis l'époque des pistes de danse. Au-dessus des élites, Vanderslide l'admire. Ce qui est « fossile », c'est sa méthode, pas son âge. | Mini-boss du biome 3, « Afterwork de transformation » au 2e étage du BAG : néons éteints, seule la **boule à facettes** éclaire. En 3D, ses éclats balaient la salle comme des projecteurs (marquage) et le rythme de la musique sert de télégraphe aux piétinements. Casser la boule plonge la salle dans le noir. | Objet **Confisqué** garanti : la **Boule à facettes de lancement** (badge : les éclats marquent les ennemis au lieu du héros, clause : la musique ne s'arrête jamais). |
| **Elio Di Rupo, « l'Invité d'honneur »** (caricature autorisée) | Hors hiérarchie : seul participant du Sondage toujours « disponible », s'il y a un ruban à couper. Privatix l'invite à **inaugurer « Mons 2032 : la Gare Expérience »** pour donner une caution à la cession. Il a lu le discours, pas le dossier. | Boss optionnel du biome 2, événement « L'Inauguration » : le **belvédère de la Passerelle** en tribune (estrade, pupitre, plaque voilée, chaises pliantes de la claque), ruban rouge qui ceinture l'arène et se resserre. Silhouette lisible de très loin : nœud papillon bordeaux, mèche brune, costume bleu marine. | Objet **Patrimoine** au 1er kill : les **Ciseaux d'inauguration** (arme, archétype rapide : chaque coup 3 « coupe » une ligne droite ; saveur : « Ils n'ont jamais inauguré une fermeture »). |

**Défaite de l'Invité d'honneur** (le cadre satirique du LORE §1.4 s'applique) : le drap glisse de la plaque, il lit « Privatix Rail Solutions — Phase 3 : Cession », redresse son nœud papillon et dit (réplique inventée pour le jeu) : « Je n'inaugure pas une fermeture. » Il tend les ciseaux au héros et descend de l'estrade, digne : vaincu, pas humilié.

---

*Rien à signaler, sauf tout.*
