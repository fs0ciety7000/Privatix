# PRIVATIX — Bible narrative et lore

> RPG 2D au tour par tour (Phaser 3). **Gameplay sérieux, lore satirique.**
> Document de référence pour tous les textes du jeu : dialogues, descriptions, noms d'objets, Notes de service.
> Il respecte le canon validé par la direction créative. En cas de doute sur un chiffre d'équilibrage (Moral, Fatigue, PE, Tickets), le GDD fait foi ; en cas de doute sur un nom, un lieu ou un événement, ce document fait foi.
> Tous les personnages, entreprises et documents sont **fictifs**. La satire vise le management, le conseil et la logique de privatisation, jamais une personne réelle, un parti, les voyageurs ou les cheminots de terrain.

---

## 1. Pitch et thèmes

### 1.1 Pitch

Mons, lundi, 4h47. Léon (ou Léa), agent·e polyvalent·e de gare en 3x8 depuis neuf ans, finit sa nuit sur le quai 2 quand l'écran annonce que le **train de 7h12**, celui que sa grand-mère prend chaque mardi pour aller au marché, est supprimé. Motif affiché : « Optimisation ».

En remontant la piste, le héros tombe sur un PowerPoint oublié dans une imprimante : le **Plan Horizon Rentabilité 2030 (PHR-2030)**. Le consortium **Privatix Rail Solutions** (« Le rail, en mieux. Pour vous. Pour nous surtout. ») prépare, avec la complicité d'une partie de la hiérarchie, la cession de la ligne, de la gare et même du café de la salle des pauses. Signature prévue : mardi, **5h00**, au dernier étage du **BAG**.

Derrière une porte « Réservé au personnel », un distributeur « HORS SERVICE » cache l'**OCC (Operation Coffee Center)**, dernier bastion des cheminots qui refusent de devenir une ligne de coût. Trois pauses (Matin, Après-midi, Nuit), une clé de tirefond, une cafetière sacrée et une équipe de collègues : de quoi faire dérailler la privatisation… sans jamais rater sa pause.

### 1.2 Thèmes

| Thème | Ce qu'on raconte | Comment le jeu le montre |
|---|---|---|
| **La satire du management** | Le langage creux (« synergie », « quick win », « scalable ») remplace la réalité du terrain. Ceux qui décident n'ont jamais pris le train. | Les ennemis attaquent avec des slides, des réunions et des KPI. Leur faiblesse commune : la question concrète. |
| **La solidarité** | Personne ne gagne seul. Conducteur, guichetière, dispatcheuse et technicien Infrabel boivent le même café. | Jauge collective de **Moral** (0–100) qui décide de la fin ; recrutement des alliés ; 7e commandement : « Tu ne laisseras aucun collègue sur le quai. » |
| **Le temps volé des 3x8** | Les horaires décalés grignotent les nuits, les week-ends, les familles. Le traître ne trahit pas pour l'argent : il veut un horaire de bureau. | Mécanique de **Fatigue** partagée, cycle des pauses, boss affronté à 5h00 en fin de nuit, quand on est le plus épuisé. |
| **Ce qui marchait** | Le 7h12, le wagon-bar, le guichet : des choses simples qu'on « améliore » jusqu'à les supprimer. | Fil rouge du 7h12, quête du Fantôme du Wagon-Bar, épilogue à 7h12. |

**La règle d'or du ton** : le monde est absurde, les personnages ne le sont pas. Les cheminots sont drôles parce qu'ils sont lucides, jamais parce qu'ils sont ridicules. Le gameplay est exigeant ; l'humour est dans le décor, les noms et les dialogues.

---

## 2. Synopsis complet

**Chronologie** : tout se joue en une journée de roulement, du lundi 4h47 au mardi 7h12.

| Acte | Titre | Pause | Zone principale | Durée cible |
|---|---|---|---|---|
| I | « Le 7h12 n'est pas venu » | Matin | Gare de Mons & Calatrava | ~1 h |
| II | « Pour raison de circulation » | Après-midi | Passage du Centre & Grand-Place (+ retours gare) | ~1 h 45 |
| III | « Terminus BAG » | Nuit | BAG de Mons | ~1 h 15 |

### 2.1 Acte I — « Le 7h12 n'est pas venu » (pause du Matin)

1. **Quai 2, 4h47.** Fin de nuit. Le héros, troisième café à la main, entend l'annonce : le 7h12 est supprimé, motif « Optimisation ». Rudy et Josiane, collègues de quai, s'inquiètent. *(Tutoriel de déplacement et d'interaction.)*
2. **La Borne Automatique Rebelle.** Une borne de vente refuse les pièces de 2 € et agresse un voyageur. Premier combat, tutoriel des actions de base (Attaque, Défendre, Objet, PE).
3. **L'imprimante.** Dans le bureau du sous-chef (Jean-Mi, absent), l'imprimante crache trois slides du PHR-2030 : fermeture des guichets, suppression des accompagnateurs, « capsules premium à 3,90 € » à la place du café gratuit, et une slide titrée « Phase 3 : Cession ».
4. **Le Consultant Junior.** Un consultant vient récupérer « son » impression. Premier vrai combat contre un ennemi du management. Le héros gagne, mais finit sonné dans le couloir technique.
5. **La porte « Réservé au personnel ».** Marcel « Pépé Rail » Lhoir, conducteur « officiellement retraité depuis 2011 », le relève. Devant le distributeur « HORS SERVICE », il compose **7-1-2**. Le mur pivote : l'**OCC**.
6. **Le serment.** Découverte de la Vieille Dame, des 7 commandements, première **Tasse de Relève** (tutoriel de la machine à café : sauvegarde, soin, café gratuit 1× par pause). Le héros devient « Stagiaire de la Cafetière ». Jean-Mi, le barista, l'inscrit au registre.
7. **Les premiers alliés.** Marcel confie la quête « Trois tasses, trois collègues » : convaincre **Josiane** (quais), **Rudy** (passerelle) et **Béné** (dernier guichet ouvert). Chaque recrutement passe par une petite quête (voir 2.4).
8. **Fin d'acte — l'audit des quais.** Un mail interne annonce la « visite d'audit bienveillante » de Privatix. Un **Manager KPI** débarque sur le quai 2 pour chronométrer les agents. **Mini-boss** (tutoriel des boucliers, du Sommeil et de l'immunité Caféiné). Victoire : les rebelles entrent officiellement en résistance. Débloque la jauge **Moral**, la carte de la gare et la sortie vers la ville.

### 2.2 Acte II — « Pour raison de circulation » (pause de l'Après-midi)

Structure ouverte : le joueur circule entre la gare et la ville. Objectif principal : réunir les **3 fragments du PHR-2030** (le « Dossier Privatix ») et rallier l'OCC.

9. **Les chantiers d'optimisation (gare).** Trois sabotages au choix, dans l'ordre voulu :
   - **Quais** : empêcher l'installation des « portiques de rentabilité » qui facturent l'accès au quai à la minute → recrutement de **Yasmina** (Traffic Control), qui débloque le voyage rapide par radio.
   - **Hall** : bloquer la conversion des guichets en « Corner Expérience Voyageur » (un écran tactile et une plante en plastique) → recrutement de **Kevin** (Infrabel) après une quête de réconciliation SNCB/Infrabel ; il ouvre les barrières « Travaux Infrabel » et améliore la clé de tirefond.
   - **Salle des pauses** : défendre le micro-ondes historique contre une équipe de Change Management → recrutement de **Fatou** (prévention), qui devient la gardienne de la sauvegarde à l'OCC.
10. **Fragment 1 — Synergia Partners.** Dans une ancienne vitrine du Passage du Centre, un cabinet de conseil s'est installé. Mini-donjon de 3 salles (open-space miniature, salle de brainstorming, armoire à archives). Le fragment est dans un classeur nommé « NE PAS OUVRIR (sauf comité) ».
11. **La friterie de Raymonde.** Raymonde sait tout ce qui se dit en ville : les consultants commandent chez elle « sans sauce, sans frites, juste la facture ». Elle indique où sera la clé USB du plan complet : dans le Dragon Gonflable du Doudou.
12. **Papy Roger et le Lumeçon.** Sur la Grand-Place, Papy Roger raconte (à moitié faux) les grandes grèves et le combat du Doudou. Il confie le **Brassard de bénévole**, qui permet de traverser la foule.
13. **Fragment 2 — Le Doudou.** Le Doudou, la Grand-Place est noire de monde. Privatix a « sponsorisé » un **Dragon Gonflable** aux couleurs du consortium. Combat d'événement dans l'arène pendant que la foule chante. Toucher le crin du dragon donne l'objet « Crin porte-bonheur ». Dans la valve du dragon : la clé USB.
14. **Fragment 3 — Le Règlement.** Béné ressort de son guichet le vieux classeur du statut, **« Le Règlement »**. Quête dans les archives du hall : retrouver l'Article 47 alinéa 3 (préavis de 7 jours) et le procès-verbal qui prouve que la cession n'a jamais été soumise à concertation. Béné gagne la compétence « Le Règlement ».
15. **La fuite.** Chaque sabotage est désormais anticipé. Les consultants attendent les rebelles aux bons endroits, aux bonnes heures. Yasmina comprend : quelqu'un transmet les roulements de l'OCC.
16. **Fin d'acte — le raid sur l'OCC.** De retour à la gare, la porte est ouverte. Un **Réorganisateur RH** et ses consultants ont envahi l'OCC, collé des stickers « Propriété de Privatix Rail Solutions » partout et renversé la Vieille Dame. **Combat d'élite** (défense du QG en vagues, puis le Réorganisateur).
17. **La révélation.** Jean-Mi avoue : il a donné le code 7-1-2 contre la promesse d'un poste de « Head of Coffee Experience », en horaire 9h-17h, « avec un badge qui bipe vert ». **Choix moral** :
    - **Épargner** (« Va-t'en. Mais tu sais où on est. ») : Moral −10 immédiat, rédemption possible en Acte III.
    - **Livrer au Conseil de la Cafetière** : Moral +5, Jean-Mi disparaît de l'histoire.
    Le code est changé : le joueur reconstitue **2-2-4-7** (l'heure du premier café de la Vieille Dame, 22h47, voir 5.4).
18. **Le grand ralliement.** La clé USB révèle le lieu et l'heure : BAG, dernier étage, **mardi 5h00**, au changement de service. Les rebelles décrètent la « grève du zèle totale » : tous les trains de l'après-midi partent pile à l'heure, ce qui paralyse les algorithmes de Privatix, incapables de gérer la ponctualité. Kevin fabrique un badge visiteur du BAG à partir des trois fragments imprimés au dos.

### 2.3 Acte III — « Terminus BAG » (pause de Nuit)

19. **La veillée d'armes (OCC, 22h00).** Tasse de Relève collective : chaque allié boit, le joueur choisit sa boisson pour l'assaut (réduction de Fatigue avant la nuit). Si le Fantôme du Wagon-Bar a été trouvé, il sert la maison. **Josiane** devient compagne de combat permanente pour l'acte.
20. **Rez-de-chaussée — l'Accueil.** Infiltration : portiques à badge, caméras (repéré = combat forcé contre une patrouille renforcée), Hôtesse Holographique, Agents de Sécurité Externalisés. Puzzle : faire valider le badge visiteur par trois services qui se renvoient la responsabilité.
21. **1er étage — l'Open-Space.** Labyrinthe de flex office aux cloisons mobiles (interrupteur « Réorganisation »). Meutes de consultants, Post-it Vivants. La Power Nap Zone, fermée depuis son inauguration, cache un lit de camp (Dormir = Fatigue à 0, mais l'horloge avance).
22. **2e étage — Salle de réunion « Synergie ».** Une réunion qui dure depuis 2019. **Mini-boss : le Comité d'Alignement** (un Réorganisateur RH, deux Consultants Junior, un Coach Agile en soutien). Si Jean-Mi a été épargné, il réapparaît ici, en badge vert, et ouvre la porte de service : il a découvert que son « poste » est un CDD de trois mois en remplacement d'une machine en panne (rédemption, Moral +15, il rend son badge vert qui ouvre les ascenseurs). Sinon, détour par l'escalier de service et la Photocopieuse Possédée.
23. **Point de non-retour — palier du 3e étage, 4h50.** Avant la porte du Bureau du Directeur, un dernier point de sauvegarde (machine à café « premium », café à 4,50 T). Message explicite : « Au-delà de cette porte, pas de retour à l'OCC avant la fin. Tout le monde a pris sa pause ? »
24. **3e étage — Bureau du Directeur, 5h00.** **Boss final : Gontran Vanderslide**, en trois phases. Le compteur de signature du Contrat de Concession démarre à 10 tours.
    - **Phase 1 — « Méga-Deck 2030 »** (Bureau du Directeur) : 412 slides, aucune pause prévue.
    - **Phase 2 — « Conseil d'Administration en visio »** (Salle du Conseil, attenante) : Vanderslide fusionne avec le Contrat, clauses-tentacules ; **Hubert Rentabilis**, PDG de Privatix, assiste caméra éteinte (voix off).
    - **Phase 3 — « L'Optimiseur Absolu »** (uniquement si Moral < 40) : fusion avec la photocopieuse de la Salle du Conseil.
    - Armes du joueur : les **3 Preuves** (chaque fragment repousse le compteur de 3 tours) et la question « Mais concrètement, sur le terrain, ça donne quoi ? » (1 usage, critique garanti).
25. **Le choix final.** Vaincu, Vanderslide propose un compromis : une **« phase pilote »** (une seule ligne privatisée), l'OCC « préservée et officialisée », et pour le héros un poste en horaire de bureau, badge vert.
    - Refuser → Yasmina tente de diffuser le PHR-2030 sur tout le système d'annonces et d'affichage. La diffusion ne réussit que si l'OCC est assez soudée pour tenir tous les postes en même temps : **Moral ≥ 60**.
26. **Épilogue — Quai 2, 7h12.** Selon la fin obtenue (voir 2.6).

### 2.4 Quêtes secondaires

| Quête | Donneur / lieu | Acte | Résumé | Récompense |
|---|---|---|---|---|
| **Trois tasses, trois collègues** | Marcel / OCC | I | Recruter Josiane (retrouver son thermos volé par un Post-it Vivant), Rudy (réparer son sifflet, coincé dans un escalator), Béné (vider la file éternelle de son guichet : 5 voyageurs à renseigner). | 3 alliés, Moral +5 chacun |
| **Le Wagon-Bar disparu** | Indices dispersés | I–II | Une carte des vins de 1994 (hall), un tablier (salle des pauses), une odeur de croque-monsieur (voie 4, la nuit ou l'après-midi). Mène au **Fantôme du Wagon-Bar**. | Allié secret, marchand légendaire, Moral +10 |
| **C'est pas nous, c'est l'autre boîte** | Kevin / Quais | II | Prouver à Kevin et à un chef SNCB que la panne du quai 3 n'est la faute de personne, sauf du sous-traitant de Privatix. Dialogue en boucle jusqu'à la bonne preuve. | Kevin recruté, amélioration de la clé de tirefond |
| **Le micro-ondes de Thésée** | Fatou / Salle des pauses | II | Défendre le micro-ondes historique (3 vagues de Change Management) et retrouver sa notice d'origine. | Fatou recrutée, sauvegarde « confort » |
| **Le Combat du Lumeçon** | Papy Roger / Grand-Place | II | Retrouver ses 4 souvenirs du Doudou éparpillés (casquette, médaille, photo, ticket de 1987). | Brassard de bénévole, Moral +10 |
| **Les rumeurs de Raymonde** | Raymonde / Passage du Centre | II | Livrer 3 cornets aux bons informateurs (un chauffeur de bus, un étudiant, une vendeuse « À louer »). | Recette « sauce andalouse renforcée », indices |
| **La Caresse du Singe** | Grand-Place | II | Caresser de la main gauche le petit singe de bronze porte-bonheur. | Buff « Caresse du Singe » (+critique), 1× par pause |
| **Matricule 4412** | Passerelle | I–III | Nourrir le pigeon de la passerelle à chaque pause. Au troisième repas, il ramène une Note de service. | Note de service n° 7 |
| **Les Notes de service** | Partout | I–III | Collecter les 12 Notes de service absurdes (section 7). | Archives bonus après le générique |

### 2.5 Moral collectif et conditions des fins

Le **Moral** (0–100) est la jauge de cohésion de l'OCC. Il monte avec les recrutements, les quêtes secondaires, les victoires d'acte et les choix solidaires ; il baisse avec les défaites (« Mise à pied »), les choix égoïstes et le statut Démotivé prolongé. Valeurs exactes : voir le GDD.

| Fin | Condition exacte |
|---|---|
| **Bonne fin — « Le 7h12 est à l'heure »** | Le joueur **refuse la « phase pilote »** ET **Moral ≥ 60** au moment du choix. |
| **Fin mitigée — « Phase pilote »** | Le joueur **accepte la « phase pilote »**, OU il refuse mais **Moral < 60** (la diffusion échoue faute d'alliés à leur poste ; une « commission de réflexion » est créée et Privatix récupère l'OCC). |

**Défaites** : équipe K.O. = « Mise à pied » (retour à l'OCC, voir GDD). Compteur de signature à 0 = cinématique « Contrat signé » et reprise automatique au début du combat final.

### 2.6 Les deux fins

**Bonne fin — « Le 7h12 est à l'heure ».** Le PHR-2030 s'affiche sur chaque écran, des quais au Passage du Centre, et la voix du héros résonne sous la passerelle. Les navetteurs, pour une fois, lisent les annonces. Hubert Rentabilis coupe la visio ; Privatix annonce un « repositionnement stratégique ». À 7h12, le train entre en gare à l'heure, la grand-mère monte. L'OCC devient « salle de pause conventionnée », sans QR code. Si le Fantôme a été trouvé, un wagon-bar réapparaît sur la voie 4. Post-générique : un jeune homme en costume descend d'un train, une clé USB à la main, étiquette « Plan Horizon 2040 ».

**Fin mitigée — « Phase pilote ».** Le contrat n'est pas signé, mais une « commission de réflexion » est créée. L'OCC devient « l'Espace Café Collaboratif powered by Privatix », avec badge et QR code sur la Vieille Dame. Le héros est promu « Responsable Engagement Terrain » en horaire de bureau. Le 7h12 revient… en bus de substitution. Marcel, seul dans le couloir technique, compose 7-1-2 sur une machine débranchée. Écran final : « Cette fin peut être améliorée. Comme le service. »

---

## 3. Personnages

### 3.1 Le héros — Léon / Léa (prénom modifiable)

- **Poste** : agent·e polyvalent·e de gare (accueil, quais, renfort accompagnement), en 3x8 depuis 9 ans.
- **Origines** : troisième génération de cheminots. Le grand-père tenait le **wagon-bar** de la ligne avant sa « disparition administrative » en 1996. La grand-mère prend le 7h12 chaque mardi pour le marché, depuis quarante ans.
- **Arme** : la **clé de tirefond** de son grand-père, améliorable par Kevin (3 niveaux : « Clé d'origine », « Clé recalibrée », « Clé de Relève »).
- **Personnalité** : taiseux·se, fatigué·e, lucide. Connaît par cœur la voix synthétique de la gare et lui répond.
- **Tic** : choix de dialogue « … (soupir de fin de pause) ».
- **Arc** : d'une colère personnelle (le 7h12 de la grand-mère) à une colère collective : derrière chaque « optimisation », il y a un collègue, un voyageur, un quai vide.
- **Compétences signature** : « Question concrète » (x2 dégâts contre les consultants, annule leurs invocations), « Ponctualité réelle » (brise le bouclier des Managers KPI), « Mais concrètement, sur le terrain, ça donne quoi ? » (réservée au boss, 1 usage).

### 3.2 Les 8 alliés de l'OCC

| Nom | Poste | Personnalité | Tic de langage | Rôle gameplay | Recrutement |
|---|---|---|---|---|---|
| **Marcel « Pépé Rail » Lhoir** | Conducteur « retraité depuis 2011 », toujours là | Fondateur de l'OCC, mentor bourru, sentimental en secret | « De mon temps, le retard, on l'appelait l'aventure. » | Mentor, buffs de groupe (« Coup de sifflet d'antan » : +Initiative), donneur de quêtes principal | Acte I, couloir technique (scène 5), automatique |
| **Josiane Delhaye** | Accompagnatrice de train, 28 ans de maison | Maternelle, inflexible, a déjà expulsé un sanglier d'un train | « Ça, c'est pas dans le règlement, mais c'est dans le cœur. » | Tank (« Contrôle des titres » : provoque, réduit les dégâts reçus) ; compagne de combat permanente en Acte III | Acte I, quai 2, quête du thermos |
| **Rudy Courtois** | Chef de quai | Théâtral, ponctuel jusqu'à l'obsession, vit pour son sifflet | « Attention, attention… » avant chaque phrase | Contrôle (« Fermeture des portes » : étourdit ; « Départ immédiat » : expulse un ennemi faible) | Acte I, passerelle, quête du sifflet |
| **Bénédicte « Béné » Wautier** | Guichetière, dernier guichet ouvert | Pince-sans-rire, a survécu à 4 réformes tarifaires | « Numéro suivant ! » | Debuffs (« File d'attente » : l'ennemi perd son tour ; « Tarif réduit » : −DEF) ; détient **Le Règlement** | Acte I, hall, quête de la file éternelle |
| **Yasmina Benali** | Dispatcheuse au Traffic Control | Calme olympien, voit tout le réseau, parle en codes | « Je vous mets en voie d'attente. » | Tactique (manipule l'ordre des tours, « Incident de circulation » : dégâts de zone) ; **voyage rapide par radio** | Acte II, quais, sabotage des portiques |
| **Kevin « Kéké » Lambot** | Technicien caténaires chez Infrabel | Bricoleur, gentil comme un pain, rivalité comique avec la SNCB | « C'est pas nous, c'est l'autre boîte. » | DPS (« Coupure de caténaire » : gros dégâts électriques) ; améliore la clé de tirefond ; ouvre les barrières « Travaux Infrabel » | Acte II, hall, quête de réconciliation |
| **Fatou Ndiaye** | Conseillère en prévention (bien-être au travail) | Douce, scientifique, terrifiante quand on saute la pause légale | « Hydratez-vous. Au café, de préférence. » | Soin (« Pause réglementaire » : soin de groupe ; « Ergonomie » : purge des malus) ; **gère la sauvegarde à la machine à café de l'OCC** | Acte II, salle des pauses, défense du micro-ondes |
| **Le Fantôme du Wagon-Bar** | Ancien serveur du wagon-bar, statut : « poste supprimé » | Mélancolique, élégant, sent le croque-monsieur | « Et pour monsieur-dame, ce sera ? » | Allié secret : marchand légendaire, invocation « Service à la place » (soin + buff massif, 1× par combat) | Acte I–II, voie 4, quête du Wagon-Bar disparu (optionnelle) |

> Le Fantôme connaissait le grand-père du héros. Il ne dit jamais s'il est vraiment un fantôme ou simplement quelqu'un que l'administration a oublié de radier.

### 3.3 Les commerçants hors OCC

**Raymonde** — friterie du Passage du Centre. Soixante ans, tablier impeccable, mémoire d'éléphant. Elle sert les cheminots depuis l'ancienne gare et refuse les paiements sans contact « parce qu'on ne sait pas où ils vont, vos sous ». Marchande de consommables : **fricadelle** (soin moyen), **cornet de frites** (soin de groupe), **sauce andalouse** (bonus d'attaque). Source de rumeurs et d'indices.
- *Tic* : « Avec ou sans vérité, la sauce ? »
- *Réplique* : « Les costumes, ils commandent un petit cornet, ils mangent trois frites et ils me demandent un justificatif. Le justificatif, c'est la frite, chéri. »

**Papy Roger** — conducteur de locomotive retraité, installé sur un banc de la Grand-Place. Raconte les grandes grèves, le Doudou et des histoires vraies à 50 %. Donne la quête « Le Combat du Lumeçon » et le **Brassard de bénévole** ; ses récits débloquent des fiches de lore.
- *Tic* : « Et ça, c'est vrai. Enfin, presque. »
- *Réplique* : « En 87, on a arrêté un train avec une thermos et une chanson. La thermos, je l'ai encore. La chanson, je l'ai oubliée. »

### 3.4 Jean-Michel « Jean-Mi » Dufrasne — le traître

- **Poste** : sous-chef de gare, barista attitré de l'OCC, gardien du registre des membres.
- **Personnalité** : drôle, serviable, fait le meilleur café de Mons. Usé jusqu'à l'os par 15 ans de 3x8 : il dort l'après-midi volets fermés, rate les anniversaires de sa fille, ne sait plus quel jour on est.
- **Tic** : « Franchement, faut être réaliste… »
- **Motivation** : il ne veut pas l'argent, il veut **un horaire de bureau**. Privatix lui promet le titre de « Head of Coffee Experience », 9h-17h, « des week-ends » et un badge qui bipe vert.
- **Arc complet** :
  1. *Acte I* : allié apparent et attachant. Il intronise le héros, offre le « Double Expresso » (+PE à un allié). Indice discret : il prend toujours des notes pendant les réunions de l'OCC « pour le registre ».
  2. *Acte II, première moitié* : absent aux moments clés (« J'étais en récup »), consulte souvent un téléphone neuf. La Note de service n° 11, trouvée dans son casier, porte un logo Privatix.
  3. *Acte II, fin* : le raid sur l'OCC le démasque. Il avoue, en colère et en larmes. Choix moral du joueur.
  4. *Acte III, s'il est épargné* : il réapparaît en salle « Synergie », badge vert au cou, découvre que son poste est un CDD de 3 mois « en remplacement d'une machine à capsules en panne ». Il ouvre la porte de service et rend son badge. Dans l'épilogue de la bonne fin, il sert le café de 7h12, et pour la première fois il ne dit pas « faut être réaliste ».
  5. *S'il est livré* : il disparaît. On ne retrouve qu'une tasse rangée dans son casier, lavée, à l'envers.

### 3.5 Les antagonistes

#### Gontran Vanderslide — boss final
- **Poste** : Directeur de la Transformation et de l'Excellence Opérationnelle, région Hainaut « Optimisée », futur « Chief Railway Experience Officer » chez Privatix.
- **Apparence** : costume trop ajusté, baskets blanches « pour faire startup », oreillette Bluetooth permanente, tasse « World's Best Disruptor », trottinette électrique de fonction. N'a jamais pris le train.
- **Motivation satirique** : sincèrement convaincu que le rail serait parfait sans trains, sans voyageurs et sans cheminots. « Le seul train rentable, c'est celui qui ne part pas. » Sa prime dépend du nombre de lignes « rationalisées ».
- **Mécanique** : **compteur de signature de 10 tours** du Contrat de Concession. À 0 : contrat signé, défaite.
- **Phases et attaques** :
  - *Phase 1 « Méga-Deck 2030 »* : « Slide 1 sur 412 » (dégâts + Démotivé), « Effet de transition » (esquive), « Vision 2030 » (Confusion de zone), « Je vous mets en copie » (invoque un Consultant Junior).
  - *Phase 2 « Conseil d'Administration en visio »* : fusion avec le Contrat ; clauses-tentacules « Clause de non-concurrence » (scelle une compétence), « Plan social optimisé » (gros dégâts de zone), « Vous êtes en mute » (Bloqué sur un allié). Hubert Rentabilis intervient en voix off.
  - *Phase 3 « L'Optimiseur Absolu »* (seulement si Moral < 40) : fusion avec la photocopieuse ; « Copie conforme » (copie la dernière compétence du joueur), « Bourrage papier » (Bloqué de zone), « Recto-verso » (frappe deux fois).
- **Faiblesse** : « Mais concrètement, sur le terrain, ça donne quoi ? » (1 usage, critique garanti) et les **3 Preuves** (chacune repousse le compteur de 3 tours).
- **Répliques** : « Je ne privatise rien. J'ouvre des opportunités d'externalisation de la valeur ajoutée ferroviaire. » / « Vous ne pouvez pas m'arrêter. Le planning est validé. Le PowerPoint est validé. Même le traiteur est validé ! »

#### Hubert Rentabilis — PDG de Privatix Rail Solutions (jamais combattu)
- Présent uniquement en visio, **caméra éteinte**, pendant la phase 2 : un carré noir avec ses initiales « HR ». Sa voix est calme, lente, celle de quelqu'un qui n'a jamais attendu un train.
- **Rôle** : rappeler que Vanderslide n'est qu'un exécutant. La satire vise le système, pas un homme.
- **Répliques** : « Gontran, on vous entend mal. On vous voit mal. On vous évalue bien. » / Défaite : « … Bon. On en reparlera au prochain plan stratégique. »

#### Le Réorganisateur RH — élite / mini-boss (fin d'Acte II, Comité d'Alignement au BAG)
- **Apparence** : gilet sans manches, lanyard couvert de badges, glisse sur une chaise de bureau à roulettes, brandit le classeur « Roulements 2027 — PROVISOIRE v14 ».
- **Motivation satirique** : il ne déteste personne, il « fluidifie ». Il change les plannings la veille pour « responsabiliser les ressources ».
- **Attaques** : « Changement de roulement la veille » (inverse la pause active du héros pendant 3 tours et retarde son tour), « Congé en cours de validation » (annule un buff), « Mobilité interne » (échange la position de deux alliés dans l'ordre des tours).
- **Faiblesse** : objet / compétence « Le Règlement » : « Article 47, alinéa 3 : préavis de 7 jours. » → étourdi 2 tours.
- **Répliques** : « Vous étiez en C ? Non non, vous êtes en S. Votre samedi est "en cours de validation". » / « Ce n'est pas un changement, c'est une opportunité de changement. »

### 3.6 Les 3 types de managers

#### 1. Le Consultant Junior « Slide-Ninja »
- **Apparence** : costume slim bleu marine, baskets blanches, lunettes rondes, tablette sous le bras, latte d'avoine, badge « Synergia Partners ». Se déplace par deux ou trois.
- **Motivation satirique** : 24 ans, première mission, facturé 1 800 € par jour pour « apporter un regard neuf » sur un métier découvert lundi. Veut un « quick win » pour sa revue annuelle.
- **Comportement** : fragile mais esquive beaucoup ; s'il survit 3 tours, invoque un collègue (« Je loop un junior sur le sujet »).
- **Attaques** : « Tempête de Post-it » (multi-coups + Confusion), « Synergie » (soigne un ennemi), « Benchmark international » (dégâts au Moral : « Au Japon… »).
- **Faiblesse** : « Question concrète » (x2 dégâts, annule l'invocation).
- **Variantes** : Consultant Senior (plus résistant, plus cher), Stagiaire en Stratégie (perd son premier tour à chercher le Wi-Fi).
- **Répliques** : « On a benchmarké votre poste : en le supprimant, vous gagnez en temps libre. C'est win-win. » / « Je n'ai pas la réponse, mais j'ai un framework. »

#### 2. Le Manager KPI « Le Tableur »
- **Apparence** : chemise blanche manches retroussées, montre connectée, tableau de bord holographique flottant (camemberts rouges qui tournent). Seul ou escorté de consultants.
- **Motivation satirique** : ce qui n'est pas mesurable n'existe pas. A chronométré les pauses pipi au centième. Rêve d'un indicateur qui mesure les indicateurs.
- **Comportement** : tank / buffeur ; ouvre chaque combat par un bouclier ; renforce les ennemis tant qu'il est debout.
- **Attaques** : « Réunion d'alignement » (bouclier 2 tours + Sommeil de zone, sauf sur les personnages Caféinés), « Tableau croisé dynamique » (dégâts proportionnels au nombre d'alliés), « Reporting hebdo » (tous les 3 tours, attaque lourde inévitable).
- **Faiblesse** : le Café de l'OCC (immunise contre le Sommeil) ; « Ponctualité réelle » (brise le bouclier).
- **Répliques** : « Le train avait 12 minutes de retard, mais l'indicateur est vert. Donc objectivement, il était à l'heure. » / « Votre ressenti est intéressant. Il n'est dans aucune colonne. »

#### 3. Le Coach Agile « Le Facilitateur »
- **Apparence** : sweat à capuche sous un blazer, bonnet en été, marqueurs de couleur à la ceinture comme des munitions, sourire permanent.
- **Motivation satirique** : « Chief Happiness & Transformation Facilitator ». Veut rendre la suppression des postes « inclusive et bienveillante ». Annonce les fermetures en atelier de briques en plastique.
- **Attaques** : « Team building obligatoire » (Confusion : les alliés peuvent se frapper entre eux), « Post-it rouge » (Démotivé), « Rétro positive » (soigne les ennemis en listant leurs « points forts »).
- **Faiblesse** : « Pause réglementaire » de Fatou (purge la Confusion et le rend Bloqué 1 tour : il ne sait pas quoi faire d'une vraie pause).
- **Répliques** : « Il n'y a pas de mauvaise nouvelle, il n'y a que des nouvelles mal facilitées. » / « On fait un tour de météo ? Moi, je suis "ensoleillé avec des plans sociaux". »

### 3.7 Ennemis génériques

| Ennemi | Apparence | Motivation satirique | Attaques | Faiblesse | Répliques |
|---|---|---|---|---|---|
| **Borne Automatique Rebelle** | Borne de vente au fond d'écran bleu, fente à pièces qui crache des étincelles | Remplacer le guichet, sans jamais accepter le bon moyen de paiement | « Pièce refusée » (Bloqué), « Mise à jour en cours » (se soigne, passe son tour), « Ticket introuvable » | Attaques électriques de Kevin ; « Tarif réduit » de Béné | « Veuillez insérer un moyen de paiement que je n'accepte pas. » / « Votre transaction a été optimisée. Elle n'existe plus. » |
| **Agent de Sécurité Externalisé** | Gilet fluo d'une société inconnue, oreillette, badge plastifié « Prestataire » | Payé au contrat, ne sait pas où il est ni qui il protège | « Contrôle d'accès » (Bloqué), « Appel à la hiérarchie » (invoque un collègue), « Périmètre » | « Question concrète » (il ne connaît pas la réponse) ; dialogue : lui demander son nom | « Je suis là pour votre sécurité. Laquelle, je sais pas, c'est pas dans ma fiche. » / « Mon contrat finit à 6h. Après, faites ce que vous voulez. » |
| **Hôtesse Holographique** | Projection bleutée souriante qui grésille, mains jointes | Incarner « l'humain digitalisé » au prix d'un humain | « Enquête de satisfaction » (Démotivé), « Veuillez patienter » (Sommeil), « Accueil personnalisé » (Confusion) | Débranchement (interaction de Béné) ; attaques électriques | « Bienvenue chez nous, qui sommes vous. » / « Votre remarque sera traitée dans un délai de 6 à 18 mois. » |
| **Dragon Gonflable Sponsorisé** | Dragon de baudruche géant aux couleurs de Privatix, logo sur le flanc, valve dans la queue | Récupérer la fête populaire en « expérience de marque » | « Souffle publicitaire » (dégâts de zone), « Naming » (vole un buff), « Dégonflage stratégique » (esquive massive 1 tour) | Le crin (interaction : « Crin porte-bonheur ») ; objets perçants ; la foule chante = +Moral à chaque tour | « Le Doudou, présenté par Privatix Rail Solutions ! » / « Ce combat est sponsorisé. Votre défaite aussi. » |
| **Post-it Vivant** | Carré jaune (ou rouge) à petites pattes, flèche dessinée au marqueur | Être une idée qu'on ne réalisera jamais | « Collage » (Bloqué 1 tour), « Rappel » (frappe en fin de tour), « Essaim » (se multiplie) | Feu, café renversé (objet « Gobelet tiède »), dégâts de zone | « À FAIRE (un jour) » / « Moi aussi j'ai été une priorité, en 2019. » |
| **Photocopieuse Possédée** | Copieur industriel aux tiroirs béants, voyant « Bourrage » rouge clignotant | Reproduire les mêmes erreurs à l'infini, en couleur | « Bourrage papier » (Bloqué), « Toner » (aveugle : −précision), « Copie conforme » (copie la dernière action du joueur) | Kevin (« Coupure de caténaire ») ; objet « Le Règlement » (trop épais, elle s'étrangle) | « Erreur E-47. Veuillez contacter un responsable. Il n'y en a pas. » / « Recto. Verso. Recto. Verso. » |

---

## 4. Lieux

### 4.1 Zone 1 — Gare de Mons & Calatrava (hub, ~80 × 50 tuiles)

Une gare-cathédrale de verre et d'acier blanc, que les navetteurs appellent « la Cathédrale » ou « le Calatrava », selon qu'ils sont émus ou énervés par le budget. Courants d'air permanents, annonces dont la fin est toujours coupée, leitmotiv sonore « ding-dong ». **Matin** : néons froids, brouillard sur les voies. **Après-midi** : lumière orangée qui traverse les arcs. **Nuit** : bleu profond, quais déserts, bruits de caténaires.

#### Quais & Passerelle
La passerelle enjambe les voies comme la colonne vertébrale d'un animal préhistorique. Le vent s'y engouffre (malus de précision aux attaques à distance). Les quais 1 à 4 sont des couloirs étroits où les trains à l'arrêt font office de murs mobiles. Les escalators marchent un jour sur trois : ce sont presque des PNJ.
- **Ambiance** : attente, café qui refroidit, annonces qui s'excusent.
- **Interactifs** : écran des départs (journal de quêtes : « IC 4211 — Trouver le dossier — RETARD +∞ ») ; portiques de quai (badge agent) ; voies électrifiées (zones interdites) ; chariots à bagages à pousser (mini-puzzles) ; barrières « Travaux Infrabel » (Kevin).
- **Ce qu'on y trouve** : le banc où Marcel attend « un train qui n'existe plus » ; le pigeon **Matricule 4412** ; Josiane et son thermos ; Rudy et son sifflet ; la voie 4 et son odeur de croque-monsieur ; Notes de service n° 1 et 2.

#### Hall / Passage commercial
Sous les nervures d'acier, le hall hésite entre majesté et galerie marchande : boulangerie, presse, distributeurs, et le futur « Corner Expérience Voyageur » caché sous des bâches Privatix. Le guichet de Béné est le dernier ouvert ; une file éternelle y serpente.
- **Ambiance** : bruit de valises, odeur de viennoiserie, néon publicitaire « Mons 2030 : une gare, zéro guichet, 100 % digitale ».
- **Interactifs** : la Borne Automatique Rebelle ; le guichet de Béné (boutique d'équipement en Tickets) ; les bâches du Corner (sabotage d'Acte II) ; les archives du hall (quête du Règlement) ; sortie vers la ville.
- **Ce qu'on y trouve** : la carte des vins de 1994 (quête du Wagon-Bar) ; voyageurs à renseigner ; Notes de service n° 3 et 4.

#### Salle des pauses
Un local sans fenêtre, néons tremblants, frigo collectif couvert d'étiquettes passives-agressives (« Ce yaourt appartient à Rudy. Je sais compter. — Rudy »). Le micro-ondes date de l'ancienne gare et a survécu à trois déménagements : il est sacré. Tableau des roulements couvert de flèches (indique la pause en cours).
- **Ambiance** : ragots, soupe réchauffée, chaises dépareillées. C'est ici que les collègues parlent vrai.
- **Interactifs** : tableau des roulements (affiche la pause et la Fatigue) ; micro-ondes (défense en Acte II) ; casiers ; distributeur payant « capsules premium à 3,90 € ».
- **Ce qu'on y trouve** : Fatou, le tablier du wagon-bar, rumeurs-indices, Note de service n° 5.

#### Couloir technique → l'OCC
Sous la passerelle, un couloir de service sent l'huile et la poussière. Câbles, extincteurs périmés, une porte « Réservé au personnel — Accès interdit même au personnel ». Au bout, un vieux distributeur de boissons barré d'un « HORS SERVICE » écrit au marqueur.
- **Ambiance** : silence, gouttes, ronronnement d'un transformateur. Le seul endroit de la gare où on n'entend pas les annonces.
- **Interactifs** : le distributeur (saisie du code 7-1-2, puis 2-2-4-7) ; un panneau électrique (raccourci vers les quais, ouvert par Kevin).
- **Ce qu'on y trouve** : l'entrée de l'OCC ; un Post-it Vivant égaré (Acte I) ; Note de service n° 6.

### 4.2 Zone 2 — Passage du Centre & Grand-Place (ville, ~100 × 70 tuiles)

Pavés, façades de briques, vitrines dont la moitié sont « À louer ». La musique, une fanfare chiptune originale, accélère à mesure que le joueur rallie des alliés. Trois secteurs : rue de la Gare → Passage du Centre → Grand-Place.

#### Passage du Centre
Une galerie couverte au charme fatigué : verrière, carrelage ancien, échos. Lieu d'échanges clandestins (receleurs de capsules, informateurs). Dans une ancienne vitrine s'est installé le cabinet **Synergia Partners** : moquette grise, néon bleu, slogan « We disrupt. You adapt. ».
- **Ambiance** : pas qui résonnent, odeur de friture, rideaux métalliques à moitié baissés.
- **Interactifs** : mini-donjon Synergia Partners (3 salles, fragment 1) ; vitrines « À louer » (coffres cachés) ; trottinettes abandonnées (obstacles à pousser).
- **Ce qu'on y trouve** : la friterie de Raymonde ; Consultants en pause latte ; Note de service n° 8.

#### La friterie de Raymonde
Un comptoir carrelé, une vitrine embuée, une ardoise de prix écrite à la craie qui n'a pas changé depuis longtemps « par principe ». La radio passe des annonces de la gare (Raymonde a branché un scanner).
- **Ambiance** : chaleur, néon rose « FRITES », le seul endroit de la ville où on vous appelle « chéri ».
- **Interactifs** : boutique de consommables ; banc de repos (soin léger, pas de sauvegarde) ; quête « Les rumeurs de Raymonde ».
- **Ce qu'on y trouve** : fricadelle, cornet de frites, sauce andalouse, indices sur le Doudou.

#### Grand-Place
Grande place pavée, hôtel de ville, beffroi au loin. En Acte II, préparatifs puis fête du **Doudou** : barrières, banderoles, foule compacte qui bloque les passages sans le Brassard de bénévole. Les chemins entre les barrières changent selon la pause.
- **Ambiance** : liesse populaire, cloches, chants ; contraste violent avec les banderoles « Doudou présenté par Privatix ».
- **Interactifs** : le petit singe de bronze (buff « Caresse du Singe ») ; l'arène du Doudou (combat du Dragon Gonflable) ; le banc de Papy Roger ; affiches satiriques à arracher (Moral +1).
- **Ce qu'on y trouve** : Papy Roger, le Brassard, le fragment 2, Notes de service n° 9 et 10.

### 4.3 Zone 3 — BAG de Mons (donjon final, 4 étages ~40 × 30 + Salle du Conseil)

Le Bâtiment Administratif de la Gare : verre, béton, moquette grise. Plus on monte, plus c'est luxueux et absurde. La musique « corporate ambient » se corrompt d'étage en étage. On y entre de nuit : bureaux vides, écrans de veille qui affichent des KPI, ascenseurs « en maintenance ».

#### Rez-de-chaussée — Accueil
Marbre froid, plantes artificielles, vidéo des « Valeurs » en boucle (Agilité, Excellence, Bienveillance, Rentabilité — la dernière en plus gros). Les portiques bipent rouge pour toute chasuble orange.
- **Interactifs** : portiques à badge ; caméras à cône de vision (repéré = patrouille renforcée) ; borne « Prenez un ticket » ; Hôtesse Holographique.
- **Ce qu'on y trouve** : Agents de Sécurité Externalisés, le puzzle des trois services, un plan d'évacuation qui indique la porte de service du 2e.

#### 1er étage — Open-Space
Une mer de bureaux identiques où personne n'a de bureau. Des casques antibruit gisent comme des carcasses. Marcher sur une chaise « réservée » déclenche un combat. La **Power Nap Zone** est fermée à clé depuis son inauguration.
- **Interactifs** : interrupteur « Réorganisation » (cloisons mobiles) ; prises électriques disputées (recharge de PE) ; lit de camp caché (Dormir).
- **Ce qu'on y trouve** : meutes de Consultants, Post-it Vivants, coffres de bureaux vides (prime de nuit), Note de service n° 12.

#### 2e étage — Salle de réunion « Synergie »
Une table ovale de 14 mètres, un paperboard couvert de flèches qui ne mènent nulle part, une réunion commencée en 2019 que personne n'ose clôturer. Les participants sont figés en « on se met en mute ».
- **Interactifs** : bouton « Lever la séance » (déclenche le Comité d'Alignement) ; porte de service (Jean-Mi épargné) ; escalier de service (sinon).
- **Ce qu'on y trouve** : le Comité d'Alignement, Jean-Mi (selon le choix), la Photocopieuse Possédée (chemin alternatif).

#### 3e étage — Bureau du Directeur
Moquette épaisse qui absorbe les pas et la culpabilité. Baie vitrée sur le beffroi et, au loin, la passerelle blanche de la gare. Mur de diplômes de formations « leadership » d'un week-end. Machine à café à 9 000 € qui affiche « Détartrage nécessaire » depuis son installation. Sur le bureau, le stylo posé sur le Contrat de Concession.
- **Interactifs** : palier de sauvegarde (point de non-retour) ; la trottinette de fonction (inspectable : « 0 km parcourus en train ») ; arène de la phase 1.

#### Salle du Conseil (phases 2 et 3)
Derrière une double porte capitonnée : une table noire, douze écrans de visio aux caméras éteintes, et la photocopieuse reliée au système d'annonces de la gare. C'est d'ici que le PHR-2030 peut être diffusé.
- **Ambiance** : silence feutré, carrés noirs avec initiales, ronronnement du copieur. À 5h00, l'aube commence à rosir la baie vitrée.

---

## 5. L'OCC — Operation Coffee Center

### 5.1 Origine
Hiver 1987. Pour « maîtriser les coûts », la direction remplace la cafetière collective de la salle des pauses par un distributeur payant. Le soir même, Marcel, jeune conducteur, et une poignée d'accompagnateurs récupèrent l'ancienne cafetière et l'installent dans une **ancienne lampisterie** oubliée des plans, sous la passerelle. Le local survit à toutes les rénovations, y compris à la construction de la nouvelle gare : les architectes l'ont, de bonne foi, classé « local technique non conforme, ne pas toucher ». Depuis, l'OCC est le lieu où l'on se dit la vérité, où l'on s'échange les roulements et où se préparent toutes les résistances.

### 5.2 L'entrée
- Dans le couloir technique, une porte « **Réservé au personnel** — Accès interdit même au personnel ».
- Derrière, un distributeur barré d'un « **HORS SERVICE** » au marqueur. Le code se tape sur ses boutons : **7 × Expresso, 1 × Lungo, 2 × Sucre +** → **7-1-2**, en hommage au train de 7h12, symbole de tout ce qu'on supprime.
- L'écran affiche « Boisson indisponible pour raison de circulation ». Le mur pivote.
- **Après la trahison** (fin d'Acte II), le code devient **2-2-4-7**. Énigme : « L'heure où la Vieille Dame a servi son premier café. » Réponse : 22h47, le soir de 1987 (indice dans le registre de l'OCC et sur la photo encadrée).

### 5.3 La Vieille Dame
La cafetière d'origine, en inox cabossé, posée sur un autel de traverses. Jamais détartrée : on dit que c'est ce qui lui donne son goût. Elle siffle avant chaque événement important. En jeu, c'est la **machine à café de l'OCC** : point de sauvegarde (géré par Fatou), soin, et **café gratuit une fois par pause**. Elle s'améliore en 3 niveaux grâce aux **Grains de café** (ressource rare).

### 5.4 Les 7 commandements (gravés sur une plaque de quai récupérée)
1. **Tu ne laisseras jamais la cafetière vide.** Qui prend la dernière tasse relance la suivante.
2. **Tu ne parleras pas de l'OCC en réunion.** Ni sur une messagerie interne, ni dans un mail avec la direction en copie cachée.
3. **Tu ne boiras point de déca.** Le déca est un café qui a renoncé.
4. **Tu respecteras la pause de ton collègue** comme la tienne : on ne réveille pas un 3x8 qui dort.
5. **Tu ne diras pas « optimisation »** sans mettre un Ticket dans la boîte à jurons.
6. **Tu laisseras ta tasse propre et ton ego au vestiaire.** Conducteur, guichetière ou technicien Infrabel boivent le même café.
7. **Tu ne laisseras aucun collègue sur le quai.**

### 5.5 Le rituel de la Tasse de Relève
À chaque changement d'équipe (6h, 14h, 22h), l'équipe sortante sert le café à l'équipe entrante, debout, en silence, puis annonce : « **Rien à signaler, sauf tout.** » L'équipe entrante répond : « **Bien reçu, on prend la voie.** » Un nouveau membre est intronisé en buvant son premier café de la Vieille Dame sans grimacer. S'il grimace, il recommence le lendemain.

**En jeu** : au début de chaque pause, à l'OCC, le joueur choisit **une boisson** pour l'équipe. Le buff dure jusqu'à la fin de la pause ou jusqu'au prochain repos.

| Boisson | Effet narratif | Buff (valeurs : voir GDD) |
|---|---|---|
| **Ristretto** | « Court, serré, comme un roulement de Noël. » | Statut Caféiné au premier tour de chaque combat, −10 Fatigue |
| **Lungo** | « Pour les longues nuits et les longues réunions. » | +PV max, gain de Fatigue horaire réduit |
| **Cappuccino** | « La mousse, c'est une armure. » | +Défense, résistance au Sommeil |
| **Chocolat chaud** | « Réservé aux stagiaires et aux jours de deuil. » | Soin progressif, purge Démotivé |
| **Le Noir de la Vieille Dame** (débloqué au niveau 3 de la machine) | « Personne ne grimace deux fois. » | Statut Syndiqué en début de combat, Moral +5 |

### 5.6 Décor
Lampisterie voûtée en briques, éclairée par des lanternes de signalisation récupérées (rouge, vert, blanc). Au centre, la Vieille Dame sur son autel de traverses. Un mur de casiers de vestiaire customisés (un par membre, ouvrables en jeu, chacun avec un objet de lore). Un vieux tableau d'affichage à palettes qui annonce les missions (« Mission 3 — Départ immédiat — Voie : Hall »). Des fauteuils de première classe dépareillés, une carte du réseau couverte de punaises et de fils rouges, la boîte à jurons « Optimisation », un lit de camp, et dans un coin la photo encadrée du wagon-bar de 1994, un tablier accroché à côté.

### 5.7 Règles de vie
- On entre en silence si quelqu'un dort sur le lit de camp.
- Les roulements s'échangent sur le tableau de liège, jamais par mail.
- Le registre des membres est tenu à la main (par Jean-Mi, puis par Béné après la trahison).
- Les badges, téléphones de service et oreillettes restent dans la boîte à l'entrée.
- Toute réunion de l'OCC dure le temps d'une tasse. Pas une minute de plus.

### 5.8 Ce qui s'y passe
- **Sauvegarde** à la Vieille Dame (Fatou), **soin** complet et **café gratuit** 1× par pause.
- **Améliorations** : la machine (Grains de café), la clé de tirefond (Kevin), l'équipement (Béné, en Tickets), le marchand légendaire (Fantôme).
- **Dialogues de camp** : chaque allié a une ligne nouvelle à chaque pause et après chaque événement majeur.
- **Tableau des missions** : récapitule la quête principale et les quêtes secondaires.
- **Archives** : les Notes de service trouvées s'affichent sur le liège.
- **Dormir** : lit de camp (Fatigue à 0, l'horloge passe à la pause suivante).
- **Veillée d'armes** : scène unique avant l'Acte III, Tasse de Relève collective.
- **Après le raid** (fin d'Acte II) : l'OCC est dévastée ; elle se répare progressivement selon le Moral, et la Vieille Dame, redressée par Kevin, garde une bosse.

---

## 6. Dialogues clés

**Conventions** : `HÉROS` = Léon / Léa ; `{prénom}` = prénom choisi par le joueur. Les didascalies sont entre astérisques. `> [Choix]` = choix de dialogue du héros (les options séparées par `/`). Les effets de jeu sont notés `→`.

### D1 — Intro : quai 2, 4h47 (Acte I, scène 1)
```text
*Écran noir. Bruit de caténaires. Ding-dong.*
ANNONCE : Mesdames et messieurs, le train de 7h12 à destination de… est supprimé. Nous vous prions de nous excuser pour…
ANNONCE : … *(grésillement)*
HÉROS : … (troisième café, et toujours pas réveillé.)
RUDY : Attention, attention… {prénom} ! T'as vu l'écran ? Le 7h12. Pas retardé. Supprimé.
> [Choix] « Raison de circulation ? » / « Grève ? » / « … (soupir de fin de pause) »
RUDY : Non. Il y a écrit « Optimisation ». Vingt ans de quai, j'ai jamais vu ce motif-là. Ça sent le frein qui chauffe.
JOSIANE : *(arrivant avec un thermos)* Le 7h12, c'est celui de ta grand-mère, non ? Le mardi, le marché ?
HÉROS : Quarante ans qu'elle le prend. Elle dit bonjour au conducteur. Il lui répond.
JOSIANE : Ça, c'est pas dans le règlement, mais c'est dans le cœur. Va voir au bureau du sous-chef. L'imprimante crache des trucs bizarres depuis que les costumes sont venus.
RUDY : Attention, attention… et prends ta clé. Il y a une borne qui mord, dans le hall.
→ Objectif : « Comprendre pourquoi le 7h12 est supprimé ». Tutoriel de déplacement.
```

### D2 — Découverte de l'OCC (Acte I, scène 5)
```text
MARCEL : Tu tiens debout ? Le gamin en costume t'a pas raté. Il t'a frappé avec quoi ?
HÉROS : Un graphique en camembert.
MARCEL : Les pires. De mon temps, on se battait avec des horaires papier. Ça faisait mal, mais honnêtement.
MARCEL : Regarde bien, je le fais qu'une fois. Sept expresso. Un lungo. Deux sucres.
DISTRIBUTEUR : *Boisson indisponible pour raison de circulation.*
*(Le mur pivote dans un grincement. Lumières rouges, vertes, blanches.)*
MARCEL : Bienvenue à l'OCC. Operation Coffee Center. La dernière salle des pauses qu'ils ont pas trouvée.
> [Choix] « C'est… une secte ? » / « C'est un café clandestin ? » / « Il y a des croissants ? »
MARCEL : C'est une gare dans la gare. Ici on boit, on parle, et on laisse personne sur le quai.
MARCEL : *(désignant la cafetière fumante)* Elle, c'est la Vieille Dame. Bois. Et grimace pas.
HÉROS : *(boit)* …
MARCEL : Il a pas grimacé. Jean-Mi, inscris : Stagiaire de la Cafetière.
JEAN-MI : Franchement, faut être réaliste : tout le monde grimace la première fois. Mais bon. Bienvenue, l'ami.
→ Débloque l'OCC (hub). Le code 7-1-2 est ajouté au carnet.
```

### D3 — Tutoriel de la Tasse de Relève (Acte I, scène 6)
```text
FATOU : Avant toute chose : depuis quand tu n'as pas fait ta pause légale ?
> [Choix] « Hier ? » / « C'est quoi, une pause légale ? » / « Je fais du 3x8, je ne sais plus quel jour on est. »
FATOU : C'est bien ce que je pensais. Viens. Ici, la machine à café, c'est la vie : je note ta progression, je soigne tes bleus, et tu as droit à un café gratuit par pause. Un seul. Le deuxième, c'est de l'automédication.
MARCEL : Et à chaque changement d'équipe, on fait la Tasse de Relève. L'équipe qui sort sert ceux qui entrent. Debout. En silence.
JEAN-MI : Ristretto pour cogner, lungo pour tenir, cappuccino pour encaisser, chocolat pour les jours sans. Franchement, faut être réaliste : le déca, on n'en a pas.
MARCEL : *(tendant la tasse)* Rien à signaler…
> [Choix] « … sauf tout. » / « … à part qu'on supprime mon train. »
MARCEL : Bien reçu. On prend la voie.
→ Tutoriel : choix d'une boisson (buff jusqu'à la fin de la pause). Sauvegarde débloquée.
```

### D4 — Recrutement de Yasmina, Traffic Control (Acte II, scène 9)
```text
YASMINA : Je vous mets en voie d'attente. *(Elle termine un appel.)* Bon. Le stagiaire de Marcel. Qu'est-ce que tu veux ?
> [Choix] « Ils veulent fermer les quais. » / « On a besoin de toi. » / « La Vieille Dame te passe le bonjour. »
YASMINA : Je sais ce qu'ils veulent. D'ici, je vois tout le réseau. Les sillons qu'ils libèrent pour leurs trains « premium ». Les petites lignes qu'ils laissent mourir en vert pâle sur mon écran.
YASMINA : Ce que je ne sais pas, c'est si vous êtes sérieux. Des rebelles, j'en ai vu passer. Beaucoup de café, peu de résultats.
HÉROS : *(montre les slides du PHR-2030)*
YASMINA : … Slide 47. « Remplacement du Traffic Control par une IA prédictive, version bêta. » Un logiciel qui pense que Mons est en Bavière.
YASMINA : D'accord. Je suis avec vous. Une règle : quand je dis « voie d'attente », vous attendez. Quand je dis « départ », vous foncez.
→ Yasmina rejoint l'OCC. Moral +10. Voyage rapide par radio débloqué.
```

### D5 — Recrutement de Kevin, Infrabel (Acte II, scène 9)
```text
KEVIN : *(en haut d'une échelle)* Si c'est pour le quai 3, c'est pas nous, c'est l'autre boîte.
HÉROS : Je suis de l'autre boîte.
KEVIN : Ah. Alors c'est vous.
> [Choix] « C'est le sous-traitant de Privatix. » / « C'est ni toi ni moi. » / « On s'en fiche de qui c'est. »
KEVIN : *(descend, essuie ses mains)* Le sous-traitant… celui qui a mis des câbles de guirlande de Noël sur une caténaire ? J'ai fait un rapport. Trois pages. Personne l'a lu.
HÉROS : Nous, on l'a lu. Il est punaisé au mur de l'OCC.
KEVIN : … Vous avez punaisé mon rapport ? *(silence)* Personne a jamais punaisé mon rapport.
KEVIN : Bon. Montre-moi ta clé de tirefond. Elle est d'époque, elle. On va lui apprendre deux trois trucs.
→ Kevin rejoint l'OCC. Moral +10. Amélioration de la clé débloquée. Barrières « Travaux Infrabel » ouvertes.
```

### D6 — Rencontre ennemie type : Consultant Junior (hall)
```text
CONSULTANT JUNIOR : Bonjour ! Vous êtes… une ressource terrain ? Génial. Je fais un benchmark de votre valeur ajoutée.
HÉROS : Ma quoi ?
CONSULTANT JUNIOR : Votre value proposition. Au Japon, un agent gère douze quais avec une tablette. Vous, vous avez… un gilet orange et un thermos.
BÉNÉ : Numéro suivant !
CONSULTANT JUNIOR : Je ne suis pas dans la file, madame.
BÉNÉ : Tout le monde est dans la file. La file est éternelle.
CONSULTANT JUNIOR : Bon. On va devoir challenger votre poste. Je lance une slide de transition !
→ COMBAT. Indice tutoriel : « Question concrète » double les dégâts contre les consultants.
*(Victoire)*
CONSULTANT JUNIOR : Je… je vais faire un point avec mon manager… pour aligner les parties prenantes…
> [Choix] « Prends le train, ça te fera un retour terrain. » (Moral +1) / « Laisse le PowerPoint et va-t'en. » (+1 objet « Slide volée »)
```

### D7 — Mini-boss de fin d'Acte I : le Manager KPI audite les quais
```text
MANAGER KPI : *(chronomètre en main)* Agent {prénom}. Vous avez mis 47 secondes pour renseigner une dame âgée. Le standard est de 12.
HÉROS : Elle cherchait le quai de son petit-fils. Il était sur le mauvais.
MANAGER KPI : Votre ressenti est intéressant. Il n'est dans aucune colonne.
JOSIANE : Il y a une colonne pour « a évité qu'une dame de 80 ans prenne le train pour Lille » ?
MANAGER KPI : Pas encore. Je vais créer un indicateur. *(Il ouvre son tableau de bord.)* Réunion d'alignement. Maintenant. Deux heures. Personne ne sort.
→ COMBAT DE MINI-BOSS. Tutoriel : le bouclier, le Sommeil de zone, l'immunité Caféiné.
*(Si un personnage endormi est réveillé par un café)* FATOU (radio) : Hydratez-vous. Au café, de préférence.
*(Victoire)*
MANAGER KPI : Impossible… mes indicateurs étaient verts…
> [Choix] « Ils étaient verts parce que tu comptais pas les gens. » / « … (soupir de fin de pause) »
MARCEL (radio) : Bien joué. À partir de maintenant, c'est officiel : on est en résistance.
→ Fin de l'Acte I. Moral débloqué. Passage à la pause de l'Après-midi.
```

### D8 — Le Doudou : combat du Dragon Gonflable Sponsorisé (Acte II, scène 13)
```text
*(Grand-Place noire de monde. Cloches. La foule chante.)*
PAPY ROGER : Tu vois ce machin ? En 87, le dragon, il était en osier et en courage. Maintenant, il est en plastique et en contrat.
DRAGON GONFLABLE : *(haut-parleur intégré)* Le Doudou, présenté par Privatix Rail Solutions ! Scannez le QR code sur ma queue pour une réduction de 5 % sur votre prochaine indignation !
RAYMONDE : *(depuis la foule)* La clé USB est dans la valve, chéri ! Mes informateurs sont formels !
> [Choix] « On le dégonfle. » / « On attrape le crin d'abord. » / « Papy, une chanson ? »
PAPY ROGER : La chanson, je l'ai oubliée. Mais eux, ils la connaissent.
→ COMBAT D'ÉVÉNEMENT. Chaque tour, la foule chante : Moral +1. Toucher le crin : objet « Crin porte-bonheur ».
*(Victoire, le dragon s'effondre en sifflant)*
DRAGON GONFLABLE : Ce combat était sponsorisé… votre victoire… n'était pas… prévue au budget…
KEVIN : *(sortant la clé USB de la valve)* « PHR-2030 — VERSION COMPLÈTE — NE PAS DIFFUSER ». Bon. Ils sont pas doués pour nommer leurs fichiers.
→ Fragment 2 obtenu. Moral +10.
```

### D9 — Révélation de Jean-Mi (OCC dévastée, fin de l'Acte II)
```text
*(La Vieille Dame est renversée. Stickers « Propriété de Privatix Rail Solutions » partout.)*
MARCEL : Ils avaient le code. Le vrai. 7-1-2. Seuls les membres le connaissent.
YASMINA : Et ils savaient pour le Passage du Centre. Et pour la clé USB. Quelqu'un leur envoie nos roulements.
JEAN-MI : … Franchement, faut être réaliste.
JOSIANE : Jean-Mi ?
JEAN-MI : Quinze ans de 3x8, Josiane ! Quinze ans à dormir l'après-midi volets fermés ! Ma fille, je la vois le jeudi, une semaine sur trois ! Ils m'ont promis neuf heures, dix-sept heures. Des week-ends. Un badge qui bipe vert !
MARCEL : Et nous ? On bipe de quelle couleur, nous ?
JEAN-MI : Vous ? Vous êtes un « coût de transition ». C'est écrit slide 212.
FATOU : Jean-Mi, ta fatigue est réelle. Ce que tu en as fait, non.
> [CHOIX MORAL] « Va-t'en. Mais tu sais où on est, si tu changes d'avis. » (Épargner : Moral −10, rédemption possible) / « Le Conseil de la Cafetière décidera. » (Livrer : Moral +5, Jean-Mi disparaît)
MARCEL : *(redressant la Vieille Dame)* On change le code. Ce soir. Et on reste debout.
```

### D10 — Veillée d'armes à l'OCC (Acte III, scène 19)
```text
MARCEL : Demain, 5h00, changement de service. Ils signent au BAG, dernier étage.
KEVIN : Le BAG ? Le bâtiment avec les portiques ? J'ai jamais eu le badge, moi. C'est pas nous, c'est l'autre boîte.
YASMINA : Ce soir, Kevin, il n'y a plus d'autre boîte. Il y a ceux qui font rouler les trains et ceux qui les vendent.
FATOU : Avant que tout le monde se lève : vous avez tous fait votre pause légale ? On attaque en fin de nuit. Vous serez fatigués. C'est exactement ce qu'ils attendent.
BÉNÉ : J'ai relu le Règlement. Article 47, alinéa 3. Ils n'ont jamais respecté le préavis. *(Elle referme le classeur.)* Numéro suivant : eux.
FANTÔME DU WAGON-BAR : *(apparaissant derrière le comptoir, si recruté)* Et pour messieurs-dames, ce sera ? Ce soir, la maison offre. La maison n'existe plus, donc c'est encore plus gratuit.
JOSIANE : Je viens avec toi, {prénom}. Vingt-huit ans que je contrôle des billets. Ce soir, je contrôle un contrat.
MARCEL : Tasse de Relève, tout le monde. Rien à signaler…
TOUS : … sauf tout.
MARCEL : Bien reçu. On prend la voie.
> [Choix de boisson pour l'assaut] Ristretto / Lungo / Cappuccino / Chocolat chaud / Le Noir de la Vieille Dame (si débloqué)
→ Réduction de Fatigue avant l'assaut. Josiane rejoint l'équipe active pour l'Acte III.
```

### D11 — Accueil du BAG (Acte III, scène 20)
```text
HÔTESSE HOLOGRAPHIQUE : Bienvenue chez nous, qui sommes vous. Avez-vous rendez-vous avec la Transformation ?
HÉROS : On vient pour la signature.
HÔTESSE HOLOGRAPHIQUE : Excellent. Votre badge est rouge. Le rouge signifie « personnel opérationnel ». Le personnel opérationnel n'est pas autorisé dans les étages opérationnels.
JOSIANE : Il y a un problème de logique, là, madame l'hologramme.
HÔTESSE HOLOGRAPHIQUE : Votre remarque a été enregistrée et sera traitée dans un délai de 6 à 18 mois. Souhaitez-vous remplir une enquête de satisfaction ?
> [Choix] « Oui. » (combat contre l'Hôtesse) / « Non. » (elle appelle la sécurité) / « Je voudrais parler à un humain. » (bug : elle s'éteint 3 tours)
YASMINA (radio) : Caméras du hall en boucle pendant quatre-vingt-dix secondes. Départ.
```

### D12 — Discours de Gontran Vanderslide (Acte III, scène 24)
```text
*(Phase 1 — Bureau du Directeur, 5h00)*
VANDERSLIDE : Ah. L'équipe terrain. Entrez. Un café ? La machine fait 47 recettes. Personne ne sait l'allumer, mais elle pourrait.
HÉROS : On vient arrêter la signature.
VANDERSLIDE : Arrêter ? Vous défendez quoi ? Un micro-ondes ? Un 7h12 qui transporte quatorze personnes ? Quatorze ! Ça ne rentre même pas dans un chiffre significatif.
JOSIANE : Ces quatorze-là, ils ont un nom.
VANDERSLIDE : Pas dans le tableur. Le seul train rentable, c'est celui qui ne part pas. Zéro énergie, zéro personnel, zéro retard. Ponctualité : cent pour cent. Je lance la présentation. Quatre cent douze slides. Il n'y a pas de pause prévue.
FATOU (radio) : Ça, monsieur, c'est illégal.
VANDERSLIDE : C'est agile.
→ COMBAT, PHASE 1 « Méga-Deck 2030 ». Compteur de signature : 10.

*(Phase 2 — Salle du Conseil. Douze carrés noirs. Le Contrat s'enroule autour de Vanderslide.)*
VANDERSLIDE : Mesdames et messieurs du Conseil, vous m'entendez ? … Vous êtes en mute. … Toujours en mute.
HUBERT RENTABILIS (voix off, caméra éteinte) : Gontran, on vous entend mal. On vous voit mal. On vous évalue bien.
VANDERSLIDE : Article premier : le personnel est un actif variable. Article deux : l'article premier n'est pas négociable !
> [Objet] « Preuve n° 1/2/3 » → « Ceci a été présenté au comité. Ceci n'a jamais été montré au terrain. » (compteur +3)

*(Phase 3 — uniquement si Moral < 40. Vanderslide fusionne avec la photocopieuse.)*
VANDERSLIDE : Si je ne peux pas vous convaincre… je vais vous dupliquer. Une équipe terrain en copie conforme. Recto. Verso. Sans pause.
JOSIANE : Une copie, ça a jamais fait rouler un train.
> [Compétence] « Mais concrètement, sur le terrain, ça donne quoi ? »
VANDERSLIDE : … Concrètement ? Concrètement… *(long silence)* … je n'ai pas de slide pour ça.
→ Critique garanti.

*(Fin du combat. Vanderslide, à genoux, oreillette de travers.)*
VANDERSLIDE : Bon. Soyons adultes. Une phase pilote. Une seule ligne. Votre OCC préservée, officialisée même. Et toi, {prénom}, un poste. Horaire de bureau. Badge vert. Des week-ends.
> [CHOIX FINAL] « Diffuser le plan sur tous les écrans de la gare. » (Refuser) / « … Une phase pilote. D'accord. » (Accepter)
```

### D13 — Bonne fin : « Le 7h12 est à l'heure » (refus + Moral ≥ 60)
```text
HÉROS : Yasmina. Tu m'entends ?
YASMINA (radio) : Tout le monde est à son poste. Béné au hall. Rudy sur les quais. Kevin sur l'armoire électrique. Départ.
*(Sur chaque écran, des quais au Passage du Centre : « PLAN HORIZON RENTABILITÉ 2030 — Phase 3 : Cession ».)*
ANNONCE : Mesdames et messieurs, votre attention s'il vous plaît. Pour une fois, lisez les écrans.
VOYAGEUSE : … Ils voulaient nous faire payer le quai à la minute ?
VOYAGEUR : Et fermer le guichet de Béné ? C'est la seule qui sait vendre un billet sans faire pleurer personne !
HUBERT RENTABILIS (voix off) : … Bon. On en reparlera au prochain plan stratégique. *(Déconnexion.)*
VANDERSLIDE : Mon oreillette… n'a plus de réseau.
JOSIANE : Bienvenue sur le terrain.
→ Écran : « Contrat de Concession : NON SIGNÉ ». Transition vers l'épilogue de 7h12.
```

### D14 — Fin mitigée : « Phase pilote » (acceptation, ou refus avec Moral < 60)
```text
*(Variante refus avec Moral < 60.)*
YASMINA (radio) : Je n'ai personne au hall. Personne sur l'armoire. Je ne peux pas tout tenir seule… La diffusion échoue.
VANDERSLIDE : Vous voyez ? Sans organisation, pas de révolution. Je propose une commission de réflexion.
*(Six mois plus tard. Panneau lumineux : « Espace Café Collaboratif — powered by Privatix ». Un QR code est collé sur la Vieille Dame.)*
HÔTESSE HOLOGRAPHIQUE : Bienvenue dans votre Espace Café Collaboratif. Votre premier café est offert. Le second est à 3,90 T.
JOSIANE : Ça, c'est pas dans le règlement… et c'est plus dans le cœur non plus.
HÉROS : *(badge vert au cou, veste un peu trop grande)* Bonjour. Responsable Engagement Terrain. Je viens… recueillir vos retours.
BÉNÉ : Numéro suivant.
*(Couloir technique. Marcel, seul, devant une machine débranchée. Il tape : 7… 1… 2. Rien ne bouge.)*
MARCEL : … De mon temps, au moins, les machines répondaient.
→ Écran final : « Cette fin peut être améliorée. Comme le service. »
```

### D15 — Épilogue : quai 2, 7h12
```text
*(Version bonne fin. Mardi. Le soleil traverse la passerelle.)*
RUDY : Attention, attention… *(la voix tremble)* … le train de 7h12 à destination de… *(il respire)* … est à l'heure.
GRAND-MÈRE : Tu vois, {prénom} ? Il suffisait de demander gentiment.
HÉROS : … On a demandé très gentiment, mamy.
JEAN-MI : *(s'il a été épargné, tendant un gobelet)* Un café pour la route, madame. Offert. *(Il hésite.)* Franchement… c'est bien d'être ici.
FANTÔME DU WAGON-BAR : *(depuis un wagon-bar réapparu sur la voie 4, si recruté)* Et pour madame, ce sera ?
MARCEL : De mon temps, on appelait ça une victoire. Aujourd'hui aussi, tiens.
> [Choix] « (sourire de début de pause) » / « Quelqu'un a pensé à relancer la cafetière ? »
*(Post-générique : un jeune homme en costume descend du train, une clé USB à la main. Étiquette : « Plan Horizon 2040 ».)*

*(Version fin mitigée. Même quai, même heure. Un bus de substitution attend devant la gare.)*
ANNONCE : Le train de 7h12 est remplacé par un bus de substitution. Merci pour votre compréhension, désormais obligatoire.
GRAND-MÈRE : Ce n'est pas grave. Le bus aussi, il dit bonjour. *(Un temps.)* Enfin, il ne répond pas.
```

---

## 7. Les 12 Notes de service absurdes (collectibles)

Objets de lore ramassables. Chaque note s'épingle sur le liège de l'OCC ; les 12 débloquent l'écran bonus « Archives » après le générique. Format en jeu : en-tête « NOTE DE SERVICE — Diffusion : tout le personnel — Confidentialité : relative ».

**N° 1 — « Ponctualité des retards »** *(Quais, Acte I)*
> Afin d'améliorer nos indicateurs, les retards inférieurs à 14 minutes seront désormais qualifiés d'« avances différées ».
> Les agents sont priés de ne plus utiliser le mot « retard » devant les voyageurs, ni entre eux.

**N° 2 — « Escalators : nouveau régime »** *(Passerelle, Acte I)*
> Dans le cadre du plan sobriété, les escalators fonctionneront un jour sur trois, selon un roulement communiqué la veille.
> Les voyageurs à mobilité réduite sont invités à se signaler 48 h à l'avance auprès d'un guichet fermé.

**N° 3 — « Guichets : transformation de l'expérience »** *(Hall, Acte I)*
> Le guichet physique est remplacé par un parcours client 100 % autonome. L'autonomie est obligatoire.
> Un agent sera présent pour expliquer aux voyageurs qu'il n'est plus là.

**N° 4 — « Sourire réglementaire »** *(Hall, Acte II)*
> Le sourire est désormais un indicateur de performance, mesuré par la borne d'accueil en lumens.
> Un sourire inférieur à 3 lumens fera l'objet d'un entretien bienveillant.

**N° 5 — « Usage du micro-ondes collectif »** *(Salle des pauses, Acte I)*
> Le micro-ondes sera accessible sur réservation, par créneaux de 47 secondes, via l'application interne (bientôt disponible).
> Les soupes devront être déclarées au préalable.

**N° 6 — « Locaux non répertoriés »** *(Couloir technique, Acte I)*
> Tout local absent des plans est considéré comme inexistant. Il est donc interdit d'y entrer, puisqu'on ne peut pas y entrer.
> Toute personne surprise dans un local inexistant sera notée absente.

**N° 7 — « Volatiles et assimilés »** *(rapportée par Matricule 4412, Acte II)*
> Les pigeons de la passerelle ne disposant d'aucun titre de transport valable, ils seront verbalisés à chaque passage.
> Le recouvrement des amendes est confié à un prestataire spécialisé en volatiles insolvables.

**N° 8 — « Mission d'accompagnement Synergia »** *(Passage du Centre, Acte II)*
> Le cabinet Synergia Partners réalisera un audit des métiers du rail. Durée : 3 jours. Coût : non communiqué.
> Merci de réserver le meilleur accueil à nos consultants, qui découvriront votre métier en même temps que vous le perdrez.

**N° 9 — « Fête du Doudou : partenariat de marque »** *(Grand-Place, Acte II)*
> Cette année, le combat sera sponsorisé. Le dragon perdra comme d'habitude, mais dans le respect de la charte graphique.
> Le public est prié d'applaudir aux moments indiqués sur les écrans.

**N° 10 — « Bien-être au travail »** *(Grand-Place, Acte II)*
> Une salle de sieste « Power Nap Zone » sera inaugurée au BAG. Pour des raisons de sécurité, elle restera fermée à clé.
> Les agents en 3x8 peuvent consulter sa photo sur l'intranet pendant leur pause.

**N° 11 — « Recrutement : Head of Coffee Experience »** *(casier de Jean-Mi, Acte II)*
> Privatix Rail Solutions recherche un profil passionné pour piloter l'expérience café. Horaire de bureau. Badge vert.
> Contrat à durée déterminée de 3 mois, en remplacement d'une machine en panne. Évolution possible vers une machine neuve.

**N° 12 — « Gestion du temps »** *(Open-Space du BAG, Acte III)*
> Afin d'optimiser les plannings, la nuit sera désormais comptabilisée comme une après-midi longue.
> Les heures de nuit ne donnent donc plus droit à la prime de nuit, mais à la prime d'après-midi longue (à l'étude).

---

## 8. Glossaire satirique

1. **3x8** — Système horaire permettant à un être humain de vivre trois vies sans en réussir aucune. On dit « bonjour » à 22h et « bonne nuit » à 6h.
2. **Roulement** — Grille mystique qui décide de ta vie sociale six semaines à l'avance. Plus fiable que l'horoscope, moins négociable que la météo.
3. **Pause** — Droit sacré, durée légale, rarement prise en entier. Unité de mesure de la dignité cheminote.
4. **Pour raison de circulation** — Formule magique qui couvre tout, de la panne de signal à l'invasion de sauterelles. Signifie : « Nous ne savons pas, mais nous le disons avec assurance. »
5. **Optimisation** — Suppression, prononcée avec un sourire. Coûte un Ticket dans la boîte à jurons de l'OCC.
6. **KPI** — Chiffre qui mesure tout ce qui est facile à mesurer, pour ignorer tout ce qui compte. Se reproduit par tableaux croisés.
7. **Consultant** — Personne qui vous emprunte votre montre pour vous donner l'heure, puis vous facture la montre.
8. **PowerPoint** — Arme de destruction massive de l'attention. Une slide = une idée ; 412 slides = aucune.
9. **Synergie** — Moment où 1 + 1 = 0,7, présenté comme 2,4.
10. **Change Management** — Art d'annoncer une mauvaise nouvelle avec des post-its de couleur et un atelier de briques en plastique.
11. **Phase pilote** — Privatisation qui n'ose pas encore dire son nom. Toujours « limitée », jamais terminée.
12. **Commission de réflexion** — Endroit où l'on range les problèmes pour qu'ils mûrissent jusqu'à pourrir.
13. **Quick win** — Victoire rapide pour celui qui la présente, défaite lente pour ceux qui la subissent.
14. **Flex office** — Organisation où chacun a droit à un bureau, à condition d'arriver avant tout le monde.
15. **Externalisation** — Faire faire par quelqu'un d'autre, plus loin, moins bien, pour plus cher, mais sur une autre ligne du budget.
16. **Infrabel vs SNCB** — Couple séparé qui partage les mêmes rails et se renvoie les factures. Hymne officiel : « C'est pas nous, c'est l'autre boîte. »
17. **Traffic Control** — Lieu où une poignée de gens empêchent chaque jour l'apocalypse ferroviaire, puis se font reprocher la seule minute qu'ils n'ont pas pu sauver.
18. **Bus de substitution** — Train qui a renoncé à ses rêves. Arrive partout, sauf à la gare.
19. **Badge vert** — Talisman de l'horaire de bureau. Ouvre les portes, ferme les yeux.
20. **Le train de 7h12** — Symbole de tout ce qui marchait très bien jusqu'à ce que quelqu'un décide de l'améliorer.

---

## 9. Guide de ton pour les futurs textes

### 9.1 Les principes
1. **Le monde est absurde, les cheminots sont lucides.** L'humour naît du décalage entre la réalité du terrain et le langage du management. Les alliés ne sont jamais des bouffons : ils ont de l'esprit, pas des gags.
2. **Gameplay sérieux.** Les textes de tutoriel, d'interface et de règles sont clairs, sans blague qui brouille l'information. Une compétence peut avoir un nom drôle ; sa description dit exactement ce qu'elle fait.
3. **Humour belge.** Autodérision, absurde à la Magritte, pince-sans-rire, tendresse. On rit avec, pas contre. On préfère l'understatement (« Il y a un problème de logique, là ») à l'insulte.
4. **Le cœur sous la blague.** Chaque scène drôle a une vérité derrière : la fatigue, la fierté du métier, la peur de disparaître. Au moins une réplique par dialogue important doit toucher juste.
5. **Le jargon est une arme.** Les ennemis parlent en franglais de cabinet (« challenger », « loop », « scalable », « quick win ») ; les alliés parlent en jargon cheminot (sillon, roulement, voie d'attente, caténaire). Ce contraste fait la satire.

### 9.2 Règles d'écriture
- **Répliques courtes** : 2 lignes maximum par bulle (boîte de dialogue 960×540). Au-delà, couper en deux répliques.
- **Format** : `PERSONNAGE : réplique` ; didascalies entre astérisques ; choix du héros `> [Choix]`, 2 ou 3 options, dont souvent une « … (soupir de fin de pause) ».
- **Tics de langage** : chaque allié place son tic **au maximum une fois par scène**. Un tic répété devient une scie.
- **Le héros** reste sobre : phrases courtes, ironie sèche, jamais de tirade. Prénom libre, formulations épicènes autant que possible.
- **Belgicismes bienvenus**, avec parcimonie : « septante », « nonante », « une fois », « savoir » au sens de « pouvoir », « chicon », « drache ». Les rendre compréhensibles par le contexte.
- **Noms d'objets** : concrets et du quotidien (thermos, fricadelle, gobelet tiède, Le Règlement). Description d'objet = 1 ligne d'effet + 1 ligne de saveur.
- **Monnaie et ressources** : toujours « Tickets » (T) pour l'argent, « Grains de café » pour les améliorations, « PE » pour l'énergie. Jamais « PA », jamais « Grains » comme monnaie.
- **Annonces de gare** : toujours coupées ou absurdes en arrière-plan, toujours claires quand elles portent une information de quête.

### 9.3 Ce qu'on ne fait pas
- **Aucune personne réelle** : pas de dirigeant, ministre, syndicaliste, journaliste ou célébrité existant·e, ni de sosie reconnaissable. Privatix Rail Solutions, Synergia Partners, Vanderslide et Rentabilis sont fictifs.
- **Aucun parti politique nommé**, aucun logo ou slogan politique réel. La satire vise une logique (la rentabilité contre le service public), pas une formation.
- **Pas de moquerie des voyageurs** : ils sont les victimes des « optimisations », jamais la cible des blagues. Les navetteurs sont fatigués, pressés, parfois râleurs, et ont toujours raison d'être fatigués.
- **Pas de moquerie des cheminots de terrain**, quel que soit leur métier ou leur entreprise. Même Jean-Mi est traité avec compassion. Seuls la hiérarchie complice, les consultants et le consortium sont ridicules.
- **Pas de blague sur les accidents de personne**, les agressions réelles du personnel ou les drames ferroviaires.
- **Pas de clichés** sur les origines, l'accent, le genre ou l'âge des personnages ; l'humour vient du métier et de la situation.
- **Pas de reproduction de marques réelles** (logos, slogans, noms de produits) ; on détourne (« capsules premium », « machine à 47 recettes »).
- **Pas de violence gratuite** : les combats sont stylisés (slides, post-its, réunions, clés de tirefond) ; un ennemi vaincu fuit, s'effondre de honte ou « part en réunion », il ne meurt pas.

### 9.4 Test rapide avant validation d'un texte
1. Un cheminot y reconnaîtrait-il son quotidien et rirait-il ?
2. Un voyageur s'y sentirait-il respecté ?
3. Le joueur comprend-il ce qu'il doit faire ?
4. La blague vise-t-elle un système plutôt qu'une personne ?
Si une réponse est « non », on réécrit.
