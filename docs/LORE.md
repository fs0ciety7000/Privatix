# PRIVATIX — Bible narrative et lore (Hack 'n' Slash / Roguelite)

> Vue de dessus, temps réel, roguelite à la Hades. **Gameplay sérieux, lore satirique.**
> Document de référence pour tous les textes du jeu : scénario, dialogues du hub, barks, fiches d'ennemis, boss, Notes de service, glossaire.
> En cas de doute sur un **nom, un lieu, un événement ou une réplique**, ce document fait foi. En cas de doute sur un **chiffre** (dégâts, durées, coûts), le GDD combat et le canon technique font foi.
> Tous les personnages, entreprises et documents sont **fictifs**. La satire vise le management, le conseil et la logique de privatisation, jamais une personne réelle, un parti, les voyageurs ou les cheminots de terrain.

**Conventions d'écriture du document**
- `HÉROS` = Léon ou Léa (prénom modifiable, `{prénom}` dans les répliques). Formulations épicènes autant que possible.
- `PERSONNAGE : réplique` ; didascalies entre astérisques ; `→` note un effet de jeu ; `[condition]` note une condition de déclenchement.
- Vocabulaire unifié : **Shift** (un run), **Énergie** (la vie), **Burnout**, **Pétage de plombs**, **Gobelets** (soins du run), **Tickets** (monnaie du run), **Avantages acquis**, **Motions communes**, **Réglages de clé**, **Preuves en main** / **Preuves archivées**, **Points de Syndicalisme (PS)**, **Tableau des revendications**, **Grains de café**, **Tasses**, **Souvenirs**, **Pièces détachées**, **Montages de clé**, **Notes de service**, **Plan d'Économies**.

---

## 1. Pitch, thèmes et ton

### 1.1 Pitch (version boîte)

Mons, 4h47, quai 2. L'écran des départs annonce que le **train de 7h12**, celui que la grand-mère du héros prend chaque mardi pour aller au marché depuis quarante ans, est supprimé. Motif affiché : « Optimisation ».

Le consortium **Privatix Rail Solutions** (« Le rail, en mieux. Pour vous. Pour nous surtout. ») s'apprête à signer la cession de la ligne, de la gare et même du café de la salle des pauses, en exécution du **Plan Horizon Rentabilité 2030 (PHR-2030)**. La signature est prévue « à la fin du service », au dernier étage du **BAG**, dont Privatix a pris les étages un par un.

Léon (ou Léa), agent·e polyvalent·e en 3x8 depuis neuf ans, prend la **clé à tire-fond** de son grand-père et remonte la gare à contre-courant : les **Quais & Voies**, la **Passerelle** que les navetteurs appellent « le Calatrava », puis le **Hall & BAG**, jusqu'au bureau où **Gontran Vanderslide** tient le stylo.

Chaque tentative est un **Shift**. Quand le héros tombe, les collègues le ramènent par le couloir technique jusqu'à l'**OCC**, le centre opérationnel de la gare, au rez-de-chaussée arrière du BAG : le seul étage que Privatix n'a pas encore pris, parce qu'on ne coupe pas un centre opérationnel sans arrêter les trains. Ses agents l'ont rebaptisé **« Operation Coffee Center »**. Et la signature est reportée, encore et encore : le **Sondage de Privatix** n'arrive jamais à trouver un créneau.

### 1.2 Pitch (version une ligne)

*Un cheminot en 3x8, une clé à tire-fond, une cafetière de 1987 et des collègues à la radio contre une armée de consultants qui veulent vendre la gare avant la fin du service.*

### 1.3 Thèmes

| Thème | Ce qu'on raconte | Comment le jeu le montre |
|---|---|---|
| **La satire du management** | Le langage creux (« synergie », « quick win », « scalable ») remplace la réalité du terrain. Ceux qui décident n'ont jamais pris le train. | Les ennemis attaquent avec des slides, des réunions, des KPI et des Pense-bête. Leur point faible commun : la question concrète. Le coup final du jeu est une question. |
| **La solidarité** | Personne ne gagne seul. Conducteur, guichetière, dispatcheuse et technicien de l'Infra boivent le même café. | Les **Avantages acquis** sont envoyés par radio par les collègues : le build, c'est l'équipe. La vraie fin est une **défense collective**, pas un duel. 7e commandement : « Tu ne laisseras aucun collègue sur le quai. » |
| **Le temps volé des 3x8** | Les horaires décalés grignotent les nuits, les week-ends, les familles. Le traître ne trahit pas pour l'argent : il veut un horaire de bureau. | L'horloge du Shift avance de 30 min par salle et nourrit le **Burnout** (plus fort, plus fragile). Le roulement Matin / Après-midi / Nuit est **imposé**, comme dans la vraie vie. |
| **Ce qui marchait** | Le 7h12, le wagon-bar, le guichet : des choses simples qu'on « améliore » jusqu'à les supprimer. | Fil rouge du 7h12, quête du Fantôme du Wagon-Bar, épilogue à 7h12 pile. |
| **La répétition absurde** | La bureaucratie tourne en rond : réunions reportées, plans reprogrammés, versions « v14 PROVISOIRE ». | La boucle roguelite elle-même est une satire : le **Sondage éternel** reprogramme la signature à chaque Shift. |

**La règle d'or du ton** : *le monde est absurde, les personnages ne le sont pas.* Les cheminots sont drôles parce qu'ils sont lucides, jamais parce qu'ils sont ridicules. Le gameplay est exigeant et lisible ; l'humour est dans le décor, les noms, les barks et les dialogues du hub.

### 1.4 Guide de ton

**Les cinq principes**
1. **Humour belge.** Autodérision, absurde à la Magritte, pince-sans-rire, tendresse. On préfère l'understatement (« Il y a un problème de logique, là ») à l'insulte. On rit *avec*, pas *contre*.
2. **Le jargon est une arme.** Les ennemis parlent franglais de cabinet (« challenger », « loop », « scalable », « quick win », « on s'aligne ») ; les alliés parlent jargon cheminot (sillon, roulement, voie d'attente, caténaire, tire-fond, ballast, préavis). Le contraste *est* la satire.
3. **Le cœur sous la blague.** Chaque scène drôle cache une vérité : la fatigue, la fierté du métier, la peur de disparaître. Au moins une réplique par scène importante doit toucher juste.
4. **Gameplay sérieux.** Tutoriels, descriptions d'Avantages et textes d'interface sont clairs. Un Avantage peut avoir un nom drôle ; sa description dit exactement ce qu'il fait (1 ligne d'effet + 1 ligne de saveur au maximum).
5. **Satire du consulting, pas des gens.** Le Consultant Junior est ridicule par ce qu'on lui fait faire, pas par ce qu'il est : il a 24 ans, une première mission et un manager qui lui demande un quick win. Même les ennemis ont droit à une réplique de défaite un peu humaine.

**Règles d'écriture**
- **Bulles courtes** : 2 lignes maximum (boîte de dialogue du hub en 640×360 logique). Un bark en run : **8 mots maximum**, lisible en 1,5 s pendant un combat.
- **Tics de langage** : au maximum **une fois par scène** et par personnage. Un tic répété devient une scie.
- **Le héros** reste sobre : phrases courtes, ironie sèche, jamais de tirade. Son choix récurrent : « … (soupir de fin de pause) ».
- **Belgicismes bienvenus**, avec parcimonie et compréhensibles par le contexte : « septante », « nonante », « une fois », « savoir » au sens de « pouvoir », « il drache », « fieu », « chicon », « dikkenek » (réservé à Raymonde).
- **Annonces de gare** : toujours coupées ou absurdes en fond sonore ; toujours claires quand elles portent une information de jeu.
- **Vaincus, pas morts** : un ennemi « part en réunion », « se met en mute », « s'effondre de honte » ou s'éteint (« HORS SERVICE »). Les automates se désactivent. Pas de sang, pas de cadavre.

**Interdits (non négociables)**
- **Aucune personne réelle** : ni dirigeant, ni ministre, ni syndicaliste, ni journaliste, ni célébrité, ni sosie reconnaissable. Aucun architecte nommé : on montre la passerelle, jamais son auteur.
- **Aucune marque réelle** : ni opérateur ferroviaire, ni gestionnaire d'infrastructure, ni marque de café, de capsules ou de logiciel. On détourne : « l'autre boîte », « l'Infra », « capsules premium », « machine à 47 recettes », « le Sondage ».
- **Aucun parti politique**, aucun slogan ou logo politique réel. La satire vise une logique (la rentabilité contre le service public), pas une formation.

**Exceptions explicitement autorisées par le porteur du projet** (il déclare en détenir les droits ; aucune autre exception sans son accord écrit) :
1. **« SNCB »**, uniquement dans le nom du dash **« Retard SNCB »**. On ne fait pas apparaître l'opérateur comme personnage ou faction : Privatix reste le seul adversaire.
2. **« Calatrava »**, surnom de la passerelle (« le Calatrava »). Le surnom est autorisé ; l'architecte lui-même n'apparaît toujours pas comme personnage.
3. **Elio Di Rupo**, personnalité politique belge et ancien bourgmestre de Mons, en **caricature satirique bon enfant**, comme boss optionnel (§7.5). Cadre obligatoire :
   - l'humour porte sur son **image publique** (nœud papillon bordeaux, lunettes sans monture, mèche brune, costume bleu marine, attachement à Mons) et sur la **posture politique** (grands discours, inaugurations, rubans) ;
   - **aucun crime ni délit** attribué, **aucune fausse citation** présentée comme réelle : toutes ses répliques sont des répliques de jeu, inventées et reconnaissables comme telles ;
   - **pas d'humiliation physique** ni de contenu dégradant ; pas de moquerie de l'âge, de la voix, de l'accent ou de la vie privée ;
   - **aucun parti, logo ou slogan** affiché : la règle sur les partis politiques reste entière ;
   - comme tous les ennemis, il est **vaincu, pas tué**, et sa scène de défaite lui laisse une sortie digne.
- **Pas de moquerie des voyageurs** : ils sont les victimes des « optimisations ». Fatigués, pressés, parfois râleurs, et ils ont toujours raison d'être fatigués. Les voyageurs neutres en run ne sont **jamais** des cibles.
- **Pas de moquerie des cheminots de terrain**, quel que soit leur métier. Même Jean-Mi est traité avec compassion. Seuls la hiérarchie complice, les consultants et le consortium sont ridicules.
- **Pas de blague** sur les accidents de personne, les agressions réelles du personnel ou les drames ferroviaires. Les rames qui traversent l'écran ne heurtent que des automates et des consultants qui « partent en réunion ».
- **Pas de clichés** sur l'origine, l'accent, le genre ou l'âge. L'humour vient du métier et de la situation.

**Test rapide avant validation d'un texte**
1. Un cheminot y reconnaîtrait-il son quotidien, et rirait-il ?
2. Un voyageur s'y sentirait-il respecté ?
3. Le joueur comprend-il ce qu'il doit faire ?
4. La blague vise-t-elle un système plutôt qu'une personne ?
Une seule réponse « non » : on réécrit.

---

## 2. Scénario

### 2.1 Situation initiale

**Le héros.** Léon ou Léa, agent·e polyvalent·e de gare (accueil, quais, renfort accompagnement), en 3x8 depuis neuf ans. Troisième génération de cheminots. Le grand-père tenait le **wagon-bar** de la ligne jusqu'à sa « disparition administrative » en 1996 ; il a laissé une clé à tire-fond d'époque, lourde, honnête, qui ne tombe jamais en panne. La grand-mère prend le 7h12 chaque mardi pour le marché ; elle dit bonjour au conducteur, et il lui répond.

**Le 7h12 supprimé.** Lundi, 4h47, fin de nuit. Troisième café. L'écran du quai 2 affiche : `IC 0712 — SUPPRIMÉ — Motif : Optimisation`. Rudy, le chef de quai, n'a jamais vu ce motif en vingt ans. Dans le bureau du sous-chef, une imprimante crache trois slides oubliées : **fermeture des guichets**, **suppression des accompagnateurs**, et une slide titrée **« Phase 3 : Cession »**.

**Le Plan Horizon Rentabilité 2030 (PHR-2030).** Un deck de 412 slides commandé par Privatix Rail Solutions et mis en musique par le cabinet **Synergia Partners**. Trois phases :
1. *Phase 1 — « Fluidification »* : fermer les guichets, remplacer les agents par des Bornes Automatiques, équiper les quais de Drones Optimètres « pour la qualité ».
2. *Phase 2 — « Responsabilisation »* : supprimer les accompagnateurs, réorganiser les roulements « en temps réel », externaliser la sécurité.
3. *Phase 3 — « Cession »* : céder la ligne, la gare, le BAG et la salle des pauses à Privatix pour un euro symbolique, « frais de traiteur inclus ».

Le plan n'a jamais été soumis à concertation. C'est sa faille : la **Preuve** que tout le jeu cherche à rendre inattaquable.

**La signature.** Elle doit avoir lieu « à la fin du service », au 3e étage du BAG, dans le bureau de **Gontran Vanderslide**, Directeur de la Transformation et de l'Excellence Opérationnelle. Le stylo est posé sur le Contrat de Concession. Le PDG de Privatix, **Hubert Rentabilis**, assistera en visio, caméra éteinte.

### 2.2 La boucle justifiée : le « Sondage éternel »

Pas de magie, pas de boucle temporelle : **de la bureaucratie**.

Privatix ne signe rien sans « aligner toutes les parties prenantes ». Pour chaque signature, un **Sondage** est envoyé : juristes, traiteur, photographe, Conseil d'administration, Hubert Rentabilis. Il manque toujours quelqu'un. Chaque fois que le héros tombe, *ou* chaque fois qu'il gagne, la date est reprogrammée « à la fin de votre prochain service ». Le traiteur est validé, le diaporama est validé, mais le créneau, jamais.

- **Quand le héros tombe** (« Mise à pied ») : les collègues le ramènent à l'OCC par le couloir technique. Pendant ce temps, Vanderslide ne peut pas signer : « Je ne signe pas un contrat de cession avec un incident voyageur en cours, ça fait mauvais genre dans le reporting. » Sondage relancé.
- **Quand le héros gagne** (« Shift tenu ») : Vanderslide est vaincu, la séance est levée « pour raisons d'agenda ». Hubert Rentabilis : « Bon. On reprogramme. Envoyez un Sondage. »
- **L'annonce de Rudy** ouvre chaque Shift, par l'écran des départs de l'OCC : « Attention, attention… la signature initialement prévue ce matin est reprogrammée à la fin de votre service. Privatix vous remercie pour votre flexibilité. »

Le Sondage a son propre petit fil comique : le nombre de participants « disponibles » change à chaque Shift sur l'écran de Rudy (`Sondage — Signature cession — 11 participants — 0 créneau commun`), et ses commentaires évoluent (« Le traiteur ne peut que le jeudi », « Le photographe est en séminaire », « Le stylo est en révision annuelle »).

**Pourquoi le héros se souvient-il ?** Parce qu'il n'y a rien à oublier : c'est le même roulement qui recommence, comme dans la vraie vie en 3x8. Les collègues aussi se souviennent ; les ennemis, eux, « repartent de zéro à chaque réunion » (et c'est précisément ce que les collègues leur reprochent). Seuls Vanderslide et Hubert Rentabilis gardent une mémoire : ils deviennent de plus en plus désespérés au fil des victoires.

### 2.3 Structure d'un Shift (rappel narratif)

| Étape | Lieu | Ce que raconte l'étape |
|---|---|---|
| Préparation | **OCC** | On parle aux collègues, on boit sa **Tasse de Relève**, on choisit son Montage et son Souvenir. Yasmina annonce le roulement. |
| Départ | **Cour intérieure, couloir technique** | Le héros traverse la Cour intérieure ; le couloir technique l'emmène vers les quais. Rudy fait l'annonce du Sondage. |
| Biome 1 | **Quais & Voies** (8 salles + Salle des pauses + Boss) | « Le 7h12 n'est pas venu. » On défend le terrain. Boss : **l'Auditeur des Quais**. |
| Biome 2 | **La Passerelle « Calatrava »** (8 salles + Salle des pauses + Boss) | « Le vent tourne. » On remonte la colonne vertébrale de la gare. Boss : **le Fluidifieur**. |
| Biome 3 | **Hall & BAG** (9 salles + Palier du 3e + Boss final) | « Terminus BAG. » On monte chez ceux qui décident. Boss final : **Gontran Vanderslide**. |
| Retour | **OCC** | Mort ou victoire, on rentre. Les collègues ont quelque chose de neuf à dire. |

L'horloge diégétique du Shift avance de **30 minutes par salle** : un Shift complet dure « une journée de travail et demie », ce que Fatou fait remarquer à chaque victoire (« Quatorze heures de service. Je fais un signalement. »).

### 2.4 Jalons narratifs, run après run

L'histoire avance par **trois fils** : **le Dossier** (les 3 Preuves du PHR-2030), **la Taupe** (Jean-Mi) et **l'Assemblée** (les relations, via les Tasses). Les jalons ci-dessous sont des **scènes Essentielles** (voir §8) : elles passent avant toute autre réplique.

| # | Condition de déclenchement | Scène / dialogue | Conséquence |
|---|---|---|---|
| J0 | Lancement de la partie | **Prologue, quai 2, 4h47.** Annonce coupée, Rudy : « Pas retardé. Supprimé. » Josiane envoie le héros au bureau du sous-chef. L'imprimante crache les 3 slides. Tutoriel jusqu'à une mort scriptée face à une marée de consultants. | Débloque la boucle. |
| J1 | Première mort (scriptée) | **Marcel ramène le héros.** Il compose 7-1-2 sur le distributeur. « Bienvenue dans le seul endroit de la gare qui ne ferme jamais. » Le héros boit la Vieille Dame sans grimacer. Jean-Mi l'inscrit au registre : « Stagiaire de la Cafetière ». | OCC débloquée, Tableau des revendications, Tasse de Relève de base. |
| J2 | Retour du Shift 1 | **Marcel explique le Sondage.** « Tant qu'ils trouvent pas de date, ils signent pas. Et tant qu'on les dérange, ils trouvent pas de date. » | Premier objectif affiché : « Atteindre le BAG ». |
| J3 | Retour du Shift 2 | **Fatou arrive** avec une trousse de secours et un formulaire « Arrêt de travail de 0 jour ». Elle rallume le pupitre RCCA et prend la garde de la Vieille Dame. | Salle de repos de nuit (réapparition, soins), améliorations des Tasses de Relève en Grains. |
| J4 | Retour du Shift 3 | **Béné arrive** avec son classeur, Le Règlement, sous le bras : « On m'a fermé le guichet. Je l'ai emporté. » Elle visse son hygiaphone sur le pupitre PACO, resté vacant. | Pupitre PACO (Recours, archives, codex). |
| J5 | Premier kill de l'Auditeur des Quais | Le chronomètre de l'Auditeur s'arrête sur **7:12**. « Le train de 7h12, il existe encore ? » **Preuve n° 1 « Fermeture des guichets »** en main. | Si elle est rapportée : Preuve archivée. **Kevin** et **Yasmina** rejoignent l'OCC au retour. |
| J6 | Première Preuve archivée | Béné ouvre une chemise cartonnée « DOSSIER — NE PAS PERDRE » et punaise la Preuve. Marcel : « Une. Il en faut trois. Et il faut qu'elles tiennent. » | Le **Cahier de revendications** apparaît à côté du Tableau (vraie fin, 1 case cochée). |
| J7 | Premier kill du Fluidifieur | « Personne ne lit jamais l'alinéa 3. » **Preuve n° 2 « Suppression des accompagnateurs »**. | Rudy découvre au retour que **les annonces de la gare sont pilotées depuis les étages du BAG**, juste au-dessus de son propre pupitre. Béné ouvre au pupitre PACO une « correspondance directe » vers la Passerelle (raccourci). |
| J8 | Shifts 4 à ~8, avant la 1re victoire | **Indices sur Jean-Mi** : notes « pour le registre », téléphone neuf, absences « en récup ». Les ennemis du Shift suivant portent l'affixe **« Briefé »**. | Les joueurs attentifs soupçonnent. |
| J9 | Premier kill du Fluidifieur ET passage à l'OCC | Le casier de Jean-Mi est entrouvert : **Note de service n° 11** (logo Privatix). | Indice ferme. Aucun personnage ne réagit encore (Fatou lève un sourcil). |
| J10 | **Première victoire sur Vanderslide** | Hubert Rentabilis : « On reprogramme. » Le héros rentre… **l'OCC a été envahie** : stickers « Propriété de Privatix », Vieille Dame renversée. **Combat-défense dans le hub** (3 vagues), puis le Fluidifieur revient, « simple formalité ». **Révélation de Jean-Mi.** | **Choix moral** (§2.5). Le code devient **2-2-4-7**. Plan d'Économies débloqué. Fin « mitigée » affichée (§2.7). |
| J11 | Run suivant la révélation | **Preuve n° 3 « Phase 3 : Cession »** : salle-événement garantie des **Archives du BAG**. Elle exige d'avoir **Le Règlement** (Béné, relation niveau 2) pour retrouver le procès-verbal d'absence de concertation. | Preuve 3 archivable. |
| J12 | Victoires 2 à 5 | **Les reprogrammations** : à chaque victoire, une nouvelle réplique d'Hubert, une nouvelle tentative de Vanderslide (phase pilote, comité de suivi, « charte des valeurs ») et une scène d'OCC qui fait avancer une relation. | Vanderslide gagne de nouvelles répliques ; sa phase 3 se durcit. |
| J13 | Les 4 conditions de la vraie fin cochées | Hubert : « La prochaine date est **définitive**. » Rudy : « Attention, attention… dernier Shift avant signature définitive. Tout le monde a pris sa pause ? » | Lance **le Shift du 7h12** (§2.6). |
| J14 | Vraie fin vue | Générique, puis post-générique « Plan Horizon 2040 ». | Mode **Plan Horizon 2040** ; les collègues commentent la victoire. |

**Fils secondaires persistants** (déclenchés en parallèle) :
- **Le Wagon-Bar disparu** : 3 indices en run (la carte des vins de 1994 dans le hall historique du biome 3 ; le tablier dans une consigne ; l'odeur de croque-monsieur sur la voie 4, roulement Nuit). Le Fantôme rejoint l'OCC et reconstruit son wagon-bar pièce par pièce. Il connaissait le grand-père du héros.
- **Matricule 4412**, le pigeon de la passerelle : nourri 3 fois, il ramène une Note de service ; nourri 12 fois, une plume (Souvenir cosmétique).
- **Le banc de Marcel** (quai 2) : chaque visite débloque une ligne inédite de Marcel sur l'OCC de 1987.

### 2.5 La trahison de Jean-Mi

**Qui.** Jean-Michel « Jean-Mi » Dufrasne, sous-chef de gare et barista attitré de l'OCC. Drôle, serviable, le meilleur café de Mons. Quinze ans de 3x8 : il dort l'après-midi volets fermés, voit sa fille le jeudi une semaine sur trois.

**Pourquoi.** Il ne veut pas d'argent. Il veut **un horaire de bureau**. Privatix lui a promis le poste de « Head of Coffee Experience », 9h-17h, des week-ends, et un badge qui bipe vert. En échange : le code de l'OCC et les roulements de l'équipe (c'est pour ça que les ennemis sont « Briefés » : ils connaissent le build du dernier Shift).

**La scène de révélation** (J10, OCC saccagée, après la défense) :
```text
MARCEL : Ils avaient le code. Le vrai. 7-1-2. Seuls les membres le connaissent.
YASMINA : Et ils savaient quels Avantages on t'envoyait. Quelqu'un leur passe nos roulements.
JEAN-MI : … Franchement, faut être réaliste.
JOSIANE : Jean-Mi ?
JEAN-MI : Quinze ans de 3x8, Josiane ! Ma fille, je la vois le jeudi, une semaine sur trois !
JEAN-MI : Ils m'ont promis neuf heures, dix-sept heures. Des week-ends. Un badge qui bipe vert !
MARCEL : Et nous ? On bipe de quelle couleur, nous ?
JEAN-MI : Vous ? Vous êtes un « coût de transition ». C'est écrit slide 212.
FATOU : Jean-Mi, ta fatigue est réelle. Ce que tu en as fait, non.
> [CHOIX MORAL] « Va-t'en. Mais tu sais où on est. » (Épargner) / « Le Conseil de la Cafetière décidera. » (Livrer)
MARCEL : *(redressant la Vieille Dame)* On change le code. Ce soir. Et on reste debout.
```

**Le nouveau code.** 2-2-4-7 : « L'heure où la Vieille Dame a servi son premier café. » Réponse dans le registre et sur la photo encadrée : 22h47, un soir d'hiver 1987.

### 2.6 La rédemption éventuelle

**Si Jean-Mi est épargné** :
1. Il quitte l'OCC. Son casier reste vide, sa tasse aussi. Fatou reprend la cafetière.
2. **Événement rare, biome 3, salle « Synergie »** : Jean-Mi en badge vert, dans une réunion qui dure depuis 2019. Il fait semblant de ne pas voir le héros. « On est en atelier. Je peux pas parler. Je suis… engagé. »
3. **Deuxième rencontre** : il a lu son contrat. CDD de trois mois « en remplacement d'une machine à capsules en panne », évolution possible « vers une machine neuve ». Il rend son badge au héros. → **Souvenir unique « Badge vert »** (une porte du BAG s'ouvre sans combat, 1 fois par Shift).
4. **Retour à l'OCC** : il se tient à l'entrée, n'ose pas entrer. Marcel : « T'attends quoi ? Le Sondage ? » Il reprend un tabouret au bout du comptoir, sans tablier. Sa relation recommence à zéro et se reconstruit à coups de Tasses ; il ne redevient barista qu'au niveau 3 (« Le Conseil de la Cafetière a délibéré. Ton tablier. »).

**Si Jean-Mi est livré au Conseil de la Cafetière** : il disparaît de l'histoire. On ne retrouve qu'une tasse, lavée, rangée à l'envers dans son casier. Personne n'en parle, sauf Fatou, une fois, tard : « On aurait pu le rattraper. Ou pas. On saura jamais. » La vraie fin reste accessible, mais son épilogue est plus amer.

### 2.7 La fin « mitigée » (chaque victoire avant la vraie fin)

Vanderslide vaincu propose un compromis : une **« phase pilote »**, une seule ligne privatisée, l'OCC « préservée et officialisée ». Rien n'est signé, mais rien n'est gagné. Écran final : **« Cette fin peut être améliorée. Comme le service. »** Le joueur comprend qu'il manque quelque chose ; le **Cahier de revendications** punaisé à côté du Tableau de Marcel le guide sans tout dire (cases à cocher aux libellés volontairement syndicaux : « Dossier complet », « Quorum atteint », « Question interne réglée », « Six reprogrammations obtenues »).

### 2.8 La vraie fin : « Le Shift du 7h12 »

**Conditions** (le Cahier de revendications) :
1. **Dossier complet** : les 3 Preuves archivées.
2. **Quorum atteint** : 6 collègues au niveau de relation 2 ou plus.
3. **Question interne réglée** : Jean-Mi épargné *et* racheté, ou livré.
4. **Six reprogrammations obtenues** : Vanderslide vaincu au moins 6 fois. À la 6e, Hubert lâche : « La prochaine date est définitive. »

**La veillée.** Avant le dernier Shift, scène unique à l'OCC : tout le monde est là, debout autour de la Vieille Dame. Rituel de la Tasse de Relève collective.
```text
MARCEL : Demain, fin de service, ils signent. Pour de vrai, cette fois.
KEVIN : Les étages du BAG, j'ai jamais eu le badge. C'est pas nous, c'est l'autre boîte.
YASMINA : Ce soir, Kevin, il n'y a plus d'autre boîte. Il y a ceux qui font rouler les trains et ceux qui les vendent.
BÉNÉ : Article 47, alinéa 3. Ils n'ont jamais respecté le préavis. Numéro suivant : eux.
FATOU : Tout le monde a fait sa pause légale ? On attaque en fin de nuit. C'est exactement ce qu'ils attendent.
MARCEL : Tasse de Relève, tout le monde. Rien à signaler…
TOUS : … sauf tout.
MARCEL : Bien reçu. On prend la voie.
```

**Le dernier Shift.** Les biomes sont normaux, mais chaque collègue intervient **en personne une fois** (un Appel radio gratuit et scénarisé) : Josiane tient le quai 2 contre une vague entière, Rudy siffle le départ d'une rame qui balaie une salle, Kevin coupe la caténaire du BAG, Béné bloque l'ascenseur avec Le Règlement, le Fantôme sert une tournée générale dans la Salle des pauses.

**Après Vanderslide.** Hubert Rentabilis **rallume enfin sa caméra**. On ne voit qu'un bureau vide et une plante verte ; sa voix, calme : « Bon. Signez sans lui. » Des **automates de signature** déferlent de tous les ascenseurs : horde finale.

**La défense.** Le héros doit **tenir 90 secondes** dans la Salle du Conseil pendant que Yasmina diffuse le PHR-2030 sur tous les écrans et toutes les annonces de la gare. La radio égrène les postes tenus : « Béné au hall. Rudy sur les quais. Kevin sur l'armoire. Josiane à la passerelle. Fatou à l'OCC. Marcel… Marcel, t'es où ? » — MARCEL : « Au banc du quai 2. Quelqu'un doit attendre le train. » Pas de boss : la solidarité est la mécanique.

**La diffusion.**
```text
ANNONCE : Mesdames et messieurs, votre attention s'il vous plaît. Pour une fois, lisez les écrans.
VOYAGEUSE : … Ils voulaient nous faire payer le quai à la minute ?
VOYAGEUR : Et fermer le guichet ? C'est la seule qui sait vendre un billet sans faire pleurer personne !
HUBERT RENTABILIS : … Bon. On en reparlera au prochain plan stratégique. *(Déconnexion.)*
VANDERSLIDE : Mon oreillette… n'a plus de réseau.
JOSIANE (radio) : Bienvenue sur le terrain.
```
Écran : **« Contrat de Concession : NON SIGNÉ. Sondage clôturé. »**

### 2.9 Épilogue — Quai 2, 7h12

Mardi. Le soleil traverse la passerelle. Les navetteurs lisent enfin les annonces. Privatix publie un communiqué de « repositionnement stratégique ».
```text
RUDY : Attention, attention… *(la voix tremble)* … le train de 7h12 à destination de… *(il respire)* … est à l'heure.
GRAND-MÈRE : Tu vois, {prénom} ? Il suffisait de demander gentiment.
HÉROS : … On a demandé très gentiment, mamy.
MARCEL : De mon temps, on appelait ça une victoire. Aujourd'hui aussi, tiens.
```
**Variantes cumulables :**
- **Jean-Mi racheté** : il sert le café du quai, gobelet tendu à la grand-mère. « Franchement… c'est bien d'être ici. » Pour la première fois, il ne dit pas « faut être réaliste ».
- **Jean-Mi livré** : sa tasse est posée sur le banc du quai 2, à l'endroit. Marcel la regarde longtemps.
- **Fantôme trouvé** : un wagon-bar est attelé en queue de rame. « Et pour madame, ce sera ? »
- **Matricule 4412 nourri 12 fois** : le pigeon monte dans le train, sans titre de transport. Josiane laisse passer : « Ça, c'est pas dans le règlement… »
- **L'OCC** devient « salle de pause conventionnée », sans QR code. La plaque des 7 commandements est vissée au mur, officiellement.

**Post-générique.** Un jeune homme en costume descend d'un train, une clé USB à la main. Étiquette : **« Plan Horizon 2040 »**. → Débloque le **mode Plan Horizon 2040** (Plan d'Économies au maximum, variantes de boss, répliques post-fin). Le jeu continue ; les collègues commentent la victoire, puis s'inquiètent du jeune homme.

---

## 3. L'OCC — le centre opérationnel (« Operation Coffee Center »)

### 3.1 Histoire

**Ce qu'est l'OCC.** Le centre opérationnel de la gare : la salle où l'on gère, en temps réel, tout ce qui fait qu'un train part, arrive ou est remplacé. On y travaille jour et nuit, en 3x8, devant un mur d'écrans et une rangée de pupitres. Chaque pupitre porte une fonction :

| Pupitre | Ce qu'il gère dans la vraie vie du rail | Tenu par |
|---|---|---|
| **PACO** | Bus de remplacement, correspondances | **Béné** |
| **RTS** | Régulation et gestion du matériel roulant (automotrices, locomotives, voitures), échanges de matériel | **Yasmina** (régulation) et **Kevin** (matériel roulant) |
| **TLI & AIT** | Annonces en gare | **Rudy** |
| **RCCA** | Prise en charge des voyageurs à mobilité réduite (PMR) | **Fatou** |
| **Permanence conduite** | Gestion des conducteurs | **Marcel** |
| **DPD** | Gestion des accompagnateurs de train | **Josiane** |

Jean-Mi, sous-chef de gare, n'a pas de pupitre : il passe de l'un à l'autre, le café à la main, et connaît donc les roulements de tout le monde (c'est ce qui rend sa trahison possible, §2.5).

**Hiver 1987.** Pour « maîtriser les coûts », la direction remplace la cafetière collective de la salle des pauses par un distributeur payant. Le soir même, Marcel, jeune conducteur de permanence, et une poignée d'accompagnateurs portent l'ancienne cafetière jusqu'à l'OCC et la posent entre deux pupitres, « parce que c'est le seul endroit de la gare qui ne ferme jamais ». À **22h47**, elle sert son premier café. On l'appelle aussitôt **la Vieille Dame**, et l'OCC devient, pour ceux qui y travaillent, l'**Operation Coffee Center**.

**Le BAG change de mains, l'OCC reste.** L'OCC occupe le rez-de-chaussée arrière du **BAG**, côté Cour intérieure. Privatix a pris les étages un par un, « en phase de transition », mais elle ne peut pas fermer le rez-de-chaussée : sans centre opérationnel, plus aucun train ne roule, et un réseau à l'arrêt se vend mal. Le PHR-2030 prévoit de remplacer l'OCC par « une IA prédictive, version bêta » (voir Yasmina) ; en attendant, Privatix a simplement **retiré l'OCC des nouveaux plans du bâtiment** (Note de service n° 6) et condamné l'escalier intérieur. Depuis, l'OCC est le lieu où l'on fait rouler les trains, où l'on se dit la vérité, où l'on prépare toutes les résistances et où l'on fait la sieste entre deux nuits.

**La Vieille Dame.** Cafetière d'origine, inox cabossé, posée sur un autel de traverses dans le coin café de la salle des opérations. Jamais détartrée : c'est ce qui lui donne son goût. Elle **siffle** avant chaque événement important (le joueur apprend vite à reconnaître ce sifflement : une scène Essentielle l'attend). Après le saccage, Kevin la redresse ; elle garde une bosse, que personne ne veut réparer.

**L'entrée.** Le couloir technique qui vient des quais débouche dans un **sas** au rez-de-chaussée du BAG. La porte officielle de l'OCC a été couverte de stickers Privatix « Local en transition » ; on entre par le sas, où trône un distributeur barré d'un « HORS SERVICE » au marqueur. Code : **7 × Expresso, 1 × Lungo, 2 × Sucre +** (7-1-2, en hommage au train de 7h12). L'écran affiche « Boisson indisponible pour raison de circulation » et le panneau du fond pivote. Après la trahison : **2-2-4-7**.

### 3.2 Géographie du hub et de ses alentours

Le hub s'étend sur le rez-de-chaussée arrière du BAG. Le joueur arrive par le **sas** (sud) et part prendre son poste par la **Cour intérieure** (nord), dont le côté ouvert mène aux quais. Éclairage : les écrans de la salle des opérations, des **lanternes de signalisation récupérées** (rouge, vert, blanc) accrochées par Marcel, et le ciel de la Cour selon le roulement.

**La Cour intérieure** (d'après le lieu réel) : une cour pavée **en U**, fermée sur trois côtés par des bâtiments de **cinq étages en brique jaune**, style années 50, aux fenêtres régulières à petits carreaux. Le rez-de-chaussée repose sur un **soubassement gris strié de coulures**, percé des fenêtres basses de l'OCC, qui donnent à hauteur de pavés. Au fond, une **cage d'escalier vitrée** monte sur toute la hauteur : c'est l'escalier vers les étages Privatix, condamné côté OCC ; à travers les vitres, on voit des consultants monter et descendre. Le pavage autobloquant est envahi de **mousse**, avec des touffes d'herbe le long des murs, une plaque d'égout au centre et de vieilles **traces de peinture rouge et bleue** au sol. Le long des façades : des **climatiseurs** accrochés au mur, une grosse **gaine de ventilation** argentée sur l'aile droite, des **palettes** de bois empilées, de **petits panneaux bleus** sur piquets et **deux voitures de service** garées. Le ciel est presque toujours **gris**. Le quatrième côté, ouvert, donne vers le couloir technique et les quais.

| # | Lieu | Station | PNJ | Ce qu'on y fait | Détails de décor |
|---|---|---|---|---|---|
| 1 | **Le sas** | Le distributeur pivotant | — | Arrivée après la mort ; animation de pivot | Sticker « HORS SERVICE » repassé au marqueur à chaque saison ; boîte à badges et téléphones « on les laisse ici » |
| 2 | **La salle de repos de nuit** (contiguë au pupitre RCCA) | Le canapé | **Fatou** | Point de réapparition (« Arrêt de travail de 0 jour. Bienvenue. »), soins, réinitialisation gratuite du Tableau | Canapé de première classe éventré, lit de camp, affiche « Pause légale : 15 min. Pause réelle : ? » |
| 3 | **La salle des opérations** (centre) | Le coin café de la Vieille Dame | **Jean-Mi** (barista), **Fatou** (gardienne) | **Tasse de Relève** du Shift ; améliorations des Tasses en Grains ; Double Expresso | Autel de traverses, registre des membres tenu à la main, photo encadrée « 22h47, 1987 », boîte à jurons « Optimisation » |
| 4 | **La salle des opérations** | Le pupitre RTS, côté régulation | **Yasmina** | Annonce du roulement du Shift ; **Plan d'Économies** ; défis | Mur d'écrans du réseau, grille de roulement couverte de flèches, radio à molettes |
| 5 | **La salle des opérations** | Le pupitre RTS, côté matériel roulant | **Kevin** | **Montages de clé** montés avec les Pièces détachées récupérées sur le matériel réformé ; **échanges de matériel** (Grains ↔ PS ↔ Pièces) | Classeur des numéros d'automotrices, pince à caténaire, rapport de trois pages « punaisé, enfin » |
| 6 | **La salle des opérations** | Le pupitre PACO | **Béné** | **Recours** (relances, « bus de remplacement ») ; **correspondances** (itinéraire direct vers la Passerelle après J7) ; **archives** des Preuves et Notes de service ; **Le Règlement** (codex des ennemis) | Hygiaphone récupéré de son guichet, tampon « Numéro suivant », ticket d'attente n° 001 coincé à jamais |
| 7 | **La salle des opérations** | Le pupitre TLI & AIT et l'écran des départs | **Rudy** | Statistiques et historique des Shifts présentés comme des trains ; annonce de début de Shift | Micro de la sonorisation, vieux tableau à palettes qui claque au-dessus de la porte de la Cour, ligne du Sondage en bas |
| 8 | **La salle des opérations** | Le pupitre de la Permanence conduite | **Marcel** | Accueil des retours, tenue du **Cahier de revendications** | Registre des conducteurs, sifflet de 1974, casquette accrochée à la lampe |
| 9 | **La Salle photocopieuse** (contiguë à la Permanence) | Le **Tableau des revendications** | **Marcel** | Dépense des **PS** (talents permanents) : chaque revendication obtenue est imprimée et punaisée ; le **Cahier de revendications** (vraie fin) y est affiché | Photocopieuse de 1987 qui imprime les tracts (et a imprimé les trois slides du prologue), panneau de liège géant, fils rouges, Preuves punaisées au fil de l'histoire |
| 10 | **La Cour intérieure** | Les casiers et le mannequin | **Josiane** (DPD) | **Casiers** des agents de bord (Souvenirs et, le cas échéant, équipement personnel) ; **mannequin de formation** (zone d'entraînement, dégâts affichés, essai des Montages) | Rangée de casiers en tôle sous un auvent, adossée au soubassement gris ; mannequin de formation sécurité en gilet orange planté sur les vieilles traces de peinture rouge et bleue (« c'est son marquage ») ; thermos posé sur un tabouret |
| 11 | **La Cour intérieure** | Le coin des palettes | **Le Fantôme** | **Rénovations** de l'OCC en Grains ; marchand légendaire | Au pied de la cage d'escalier vitrée, les palettes de bois : d'abord une simple pile (une photo de 1994, un tablier posé dessus), puis le comptoir du wagon-bar reconstruit pièce par pièce sur les palettes |
| 12 | **La Cour intérieure** | Le côté ouvert | — | Sortie vers le couloir technique et le Shift | Les deux voitures de service garées en épi ; les petits panneaux bleus disent « Réservé Permanence conduite » et « Réservé PACO — bus de remplacement » ; la gaine de ventilation ronronne ; on aperçoit la Passerelle au-dessus des toits |
| 13 | **La salle des opérations** | La plaque des 7 commandements | — | Lecture | Plaque de quai émaillée récupérée, gravée à la main, vissée au-dessus du coin café |
| 14 | **La cage d'escalier vitrée** | — | — | Décor : l'escalier vers les étages du BAG, porte du rez-de-chaussée sous scellés Privatix. Au fil des Shifts, des affiches « Phase de transition » se collent sur les vitres, étage par étage. | Ruban violet « Accès réservé — Phase de transition », silhouettes de consultants derrière le verre, bruits de réunion au-dessus |
| 15 | **La Cour intérieure** | Le coin poubelles | **Le Furet putride** (§6.8) | Rencontre optionnelle depuis le hub (voir §6.8) | Contre un vieux **pignon de brique sombre** à fenêtre murée, au toit abîmé (bâche déchirée qui claque au vent, planche de bois clouée en rustine) : six **conteneurs verts à couvercle jaune** qui débordent, couvercles entrouverts, et un gros **tas de sacs poubelle bleus**. Mousse entre les pavés, papiers qui traînent. Affichette scotchée sur un conteneur : « Collecte externalisée. Passage selon un roulement communiqué la veille. » |

### 3.3 Les 7 commandements

1. **Tu ne laisseras jamais la cafetière vide.** Qui prend la dernière tasse relance la suivante.
2. **Tu ne parleras pas de l'OCC en réunion.** Ni sur une messagerie interne, ni dans un mail avec la direction en copie cachée.
3. **Tu ne boiras point de déca.** Le déca est un café qui a renoncé.
4. **Tu respecteras la pause de ton collègue** comme la tienne : on ne réveille pas un 3x8 qui dort.
5. **Tu ne diras pas « optimisation »** sans mettre un Ticket dans la boîte à jurons.
6. **Tu laisseras ta tasse propre et ton ego au vestiaire.** Conducteur, guichetière ou technicien de l'Infra boivent le même café.
7. **Tu ne laisseras aucun collègue sur le quai.**

### 3.4 Règles de vie

- On entre en silence si quelqu'un dort sur le lit de camp (en jeu : si Fatou dort, la musique baisse et le héros marche plus lentement près du canapé).
- Les roulements s'échangent sur le tableau de liège, **jamais par mail**.
- Le registre des membres est tenu **à la main** (par Jean-Mi, puis par Béné après la trahison).
- Badges, téléphones de service et oreillettes restent dans la boîte à l'entrée.
- Toute réunion de l'OCC dure **le temps d'une tasse**. Pas une minute de plus.
- **Le rituel de la Tasse de Relève** : à chaque changement d'équipe, l'équipe sortante sert l'équipe entrante, debout, en silence. « **Rien à signaler, sauf tout.** » — « **Bien reçu, on prend la voie.** » En jeu, c'est l'écran de choix du buff de départ, et la phrase rituelle est la dernière réplique avant le sas.

**Les Tasses de Relève** (buff de départ, améliorées en Grains auprès de la Vieille Dame) :

| Tasse | Saveur | Effet (valeurs : GDD) |
|---|---|---|
| **Expresso** | « Court, serré, comme un roulement de Noël. » | + dégâts |
| **Café long** | « Pour les longues nuits et les longues réunions. » | + Énergie max |
| **Ristretto** | « Une gorgée, et t'es déjà sur le quai. » | + vitesse |
| **Cappuccino** | « La mousse, c'est une armure. » | + 1 Gobelet |
| **Café de nuit** | « Réservé aux 22h-6h et aux jours de deuil. » | + 1 Avantage acquis au départ |
| **Le Noir de la Vieille Dame** (Tasse ultime) | « Personne ne grimace deux fois. » | Combinaison de deux effets mineurs ; débloqué au dernier rang |
| **Double Expresso** (Jean-Mi, tant qu'il est là) | « Faut être réaliste : un, c'est pas assez. » | Bonus de Jean-Mi, cumulable ; disparaît à la révélation |

### 3.5 Évolution du lieu au fil des runs

| Étape | Déclencheur | État de l'OCC |
|---|---|---|
| **Effectif réduit** | Premier retour | Marcel, Jean-Mi, Josiane, Rudy. La moitié des pupitres sont éteints (PACO, RCCA et RTS « non pourvus »), la moitié des lanternes aussi, les palettes de la Cour attendent le Fantôme. |
| **L'équipe s'étoffe** | Shifts 2 à 3 | Fatou rallume le pupitre RCCA et installe la salle de repos de nuit (canapé, trousse) ; Béné rallume le pupitre PACO et y visse l'hygiaphone de son guichet. |
| **Le RTS reprend** | 1er kill du boss 1 | Yasmina et Kevin rallument les deux postes du pupitre RTS : le mur d'écrans affiche enfin tout le réseau, la radio grésille. |
| **Le Dossier** | Chaque Preuve archivée | Une Preuve de plus photocopiée et punaisée au Tableau de la Salle photocopieuse, reliée par des fils rouges ; la Vieille Dame siffle. |
| **Le saccage** | 1re victoire sur Vanderslide | Stickers violets « Propriété de Privatix Rail Solutions » partout, Vieille Dame renversée, lanternes brisées, registre arraché, écrans des pupitres basculés sur une mire « IA prédictive — bêta », QR code sur la plaque des commandements, casiers de la Cour forcés. Combat-défense dans le hub. |
| **Le chantier** | Shifts suivant le saccage | Les stickers partent un par un (un par retour, Josiane les décolle en grommelant) ; la Vieille Dame redressée garde sa bosse ; la plaque est nettoyée par Béné. |
| **Les rénovations** | Achats chez le Fantôme (Grains) | Guirlandes de lanternes rallumées dans la Cour, canapé neuf « de deuxième classe, faut pas exagérer », juke-box des annonces au pupitre TLI & AIT, mannequin avancé, auvent refait au-dessus des casiers, 2e emplacement de Souvenir, horloge de gare qui marche, bannière « OCC » brodée par Josiane, wagon-bar reconstitué. |
| **La veillée** | Conditions de la vraie fin | Toutes les lanternes allumées, tout le monde debout ; la musique se tait. |
| **Après la vraie fin** | Mode Plan Horizon 2040 | Plaque officielle « Salle de pause conventionnée » vissée sous la plaque des commandements ; le distributeur du sas reste en place quand même, « on sait jamais ». |

---

## 4. Les PNJ du hub

**Mécanique de relation (Tasses).** On offre une **Tasse** (ressource rare) à un collègue. Chaque collègue a **3 niveaux de relation** :
- **Niveau 1** : il ou elle offre son **Souvenir** (porte-bonheur, un équipé par Shift).
- **Niveau 2** : **scène personnelle** à l'OCC (compte pour le Quorum de la vraie fin).
- **Niveau 3** : réplique de **serment** et **Motion commune** débloquée dans le pool des Avantages (ou bonus équivalent pour les PNJ sans famille).

Les PNJ apparaissent selon les jalons du §2.4. Chaque fiche donne 3 répliques d'exemple : une **générique**, une **après une mort**, une **après une victoire**.

### 4.1 Marcel « Pépé Rail » Lhoir

- **Poste** : conducteur « officiellement retraité depuis 2011 », toujours là. Tient le pupitre de la **Permanence conduite** (gestion des conducteurs) « en attendant un remplaçant » depuis 2011. Fondateur de l'Operation Coffee Center en 1987.
- **Rôle narratif** : mentor bourru, sentimental en secret ; la **voix de la boucle** (il explique le Sondage, accueille chaque retour, tient le Cahier de revendications).
- **Service gameplay** : **Tableau des revendications** dans la Salle photocopieuse (talents permanents en PS : Endurance, Métier, Solidarité). Logique de poste : la Permanence conduite tient le dossier de carrière de chaque agent ; chaque revendication obtenue y est photocopiée et punaisée.
- **Personnalité** : raconte des histoires vraies à 70 %, n'a jamais pris un jour de maladie, garde un sifflet de 1974 dans sa poche de poitrine. Il a peur, sans le dire, que l'OCC meure avec lui.
- **Tic** : « De mon temps… » (la suite change toujours).
- **Famille d'Avantages acquis** : **D'antan** — critiques, dégâts lourds, second souffle sous faible Énergie (« De mon temps » : +dégâts critiques sous 30 % d'Énergie).
- **Souvenir** : **Casquette de conducteur** (les Avantages D'antan apparaissent plus souvent).
- **Répliques** :
  - *Générique* : « De mon temps, le retard, on l'appelait l'aventure. Maintenant, ils l'appellent un KPI. »
  - *Après une mort* : « Ça va, fieu ? T'as eu une aventure courte. Allez, une tasse et on y retourne. »
  - *Après une victoire* : « Ils ont reprogrammé ? Bien. Tant qu'ils reprogramment, on existe. »
- **Arc (Tasses)** : N1, il offre sa casquette (« Elle a vu passer plus de trains que toi de réunions »). N2, *le banc du quai 2* : il avoue qu'il attend encore le dernier train qu'il a conduit, le soir de sa retraite, parce que personne ne lui a dit au revoir sur le quai ; le héros reste assis avec lui. N3, serment : « Tant que je respire, la porte s'ouvre. » → Motion commune **« Coup de sifflet d'antan »** (avec Rudy).

### 4.2 Fatou Ndiaye

- **Poste** : conseillère en prévention (bien-être au travail), affectée au pupitre **RCCA** (prise en charge des voyageurs à mobilité réduite). Arrive au 3e retour (J3).
- **Rôle narratif** : la conscience de l'OCC ; celle qui dit que la fatigue est réelle, y compris celle de Jean-Mi.
- **Service gameplay** : **gardienne de la Vieille Dame** (améliorations des Tasses de Relève en Grains), **salle de repos de nuit** et point de réapparition, soins, réinitialisation du Tableau. Logique de poste : le RCCA organise l'assistance et l'accueil ; c'est elle qui organise aussi le retour du héros tombé. (Règle de ton : on ne fait jamais de blague sur les voyageurs PMR ; l'humour porte sur les procédures.) Reprend le service du café après la trahison.
- **Personnalité** : douce, scientifique, terrifiante quand on saute la pause légale. Tient des statistiques de Burnout « pour un rapport que personne ne lira, mais qui existera ».
- **Tic** : « Hydrate-toi. Au café, de préférence. »
- **Famille** : **Prévention** — soin, bouclier, régénération (« Pause légale » : toutes les 90 s, un bouclier absorbe un coup).
- **Souvenir** : **Fiole de prévention** (soin de 10 % à l'entrée de chaque biome).
- **Répliques** :
  - *Générique* : « Ton Burnout de fin de Shift était à 87. Je l'ai noté. En rouge. Avec un cœur, pour adoucir. »
  - *Après une mort* : « Arrêt de travail de zéro jour. Bienvenue. Tu avais deux Gobelets pleins, je précise. »
  - *Après une victoire* : « Quatorze heures de service sans pause réglementaire. Bravo. Je fais un signalement. »
- **Arc** : N1, la fiole (« Ce n'est pas un médicament, c'est un rappel »). N2, *le formulaire* : elle montre au héros la pile de signalements qu'elle a rédigés en douze ans, tous classés « pour information » ; elle décide de les lire à voix haute pendant la veillée finale. N3, serment : « Personne ne tombe sans que je le sache. » → Motion commune **« Pause syndicale »** (avec Josiane).

### 4.3 Kevin « Kéké » Lambot — technicien de l'Infra

- **Poste** : technicien caténaires « de l'Infra », l'autre maison qui partage les mêmes rails, détaché au pupitre **RTS, côté matériel roulant** (automotrices, locomotives, voitures, échanges de matériel). Arrive après le 1er kill du boss 1 (avant, il est « en intervention »).
- **Rôle narratif** : le bricoleur au grand cœur, la rivalité comique entre « les deux boîtes » qui se dissout dans la solidarité.
- **Service gameplay** : **pupitre RTS (matériel roulant)** — **Montages de clé** (Clé d'origine, Clé recalibrée, Clé de Relève, Clé du Wagon-Bar), montés avec les **Pièces détachées** qu'il récupère sur le matériel roulant réformé ; **échanges de matériel** (Grains ↔ PS ↔ Pièces, taux 3:1). Logique de poste : le RTS compose les rames et gère les échanges de matériel ; Kevin « compose » la clé du Shift comme une rame.
- **Personnalité** : gentil comme un pain, parle à ses outils, a écrit un rapport de trois pages sur un sous-traitant qui avait posé des câbles de guirlande sur une caténaire. Personne ne l'avait lu, jusqu'à ce que l'OCC le punaise.
- **Tic** : « C'est pas nous, c'est l'autre boîte. »
- **Famille** : **Caténaire** — électricité en chaîne (« Coupure de caténaire » : la dernière Frappe déclenche un arc sur 3 cibles).
- **Souvenir** : **Pince à caténaire** (+15 % de dégâts électriques).
- **Répliques** :
  - *Générique* : « J'ai recalibré ta clé. Elle tape plus fort, mais elle grince. Comme moi. »
  - *Après une mort* : « Tombé de la passerelle ? C'est pas nous, c'est l'autre boîte. Enfin… là, c'est un peu toi. »
  - *Après une victoire* : « Tu lui as coupé le courant, au Directeur ? Proprement ? Je suis fier. Je note ça dans un rapport. »
- **Arc** : N1, la pince. N2, *le rapport* : il découvre que son rapport punaisé est devenu une Preuve annexe du Dossier ; il pleure un peu, prétend que c'est la soudure. N3, serment : « Ce soir, il y a plus d'autre boîte. » → Motion commune **« Signal électrifié »** (avec Rudy : le Coup de sifflet électrocute).

### 4.4 Bénédicte « Béné » Wautier

- **Poste** : guichetière, dernier guichet ouvert de la gare, fermé par le PHR-2030. Arrive au 4e retour (J4) avec son guichet en pièces détachées et reprend le pupitre **PACO** (bus de remplacement, correspondances), resté vacant : « Un voyageur sans train, c'est un client de guichet. Je connais. »
- **Rôle narratif** : la mémoire administrative de la résistance ; détient **Le Règlement**, le vieux classeur du statut, clé de la Preuve 3 et de la faiblesse du Fluidifieur.
- **Service gameplay** : **pupitre PACO** — **Recours** (relance des portes ou d'un choix : le « bus de remplacement » du Shift) ; **correspondances** (raccourci vers la Passerelle après J7) ; **archives** (Preuves archivées, Notes de service) ; **Le Règlement** (codex des ennemis, fiches remplies avec les kills).
- **Personnalité** : pince-sans-rire, a survécu à quatre réformes tarifaires et à une borne qui lui a craché un ticket dans l'œil. Ne s'énerve jamais : elle tamponne.
- **Tic** : « Numéro suivant ! »
- **Famille** : **Guichet** — malus aux ennemis, Ralenti, Vulnérable (« File d'attente » : gèle l'ennemi frappé 1,5 s).
- **Souvenir** : **Tampon « Numéro suivant »** (−20 % à la Friterie et au Wagon-Bar).
- **Répliques** :
  - *Générique* : « Le Règlement, page 312 : un consultant n'a pas de titre de transport. Je dis ça, je dis rien. »
  - *Après une mort* : « Elle t'a imprimé, la borne ? On ne négocie pas avec ces machines-là. Numéro suivant ! »
  - *Après une victoire* : « J'ai archivé ta victoire. Classement : "Rare". Sous-classement : "À renouveler". »
- **Arc** : N1, le tampon. N2, *le dernier client* : elle raconte le dernier voyageur servi au guichet avant la fermeture, un enfant qui voulait un billet « pour aller voir la mer » ; elle lui a vendu, puis a pleuré dans les archives ; elle prête Le Règlement au héros (débloque la Preuve 3). N3, serment : « Tant que j'ai un tampon, il y a un guichet. » → Motion commune **« Article 47 »** (avec Yasmina).

### 4.5 Yasmina Benali

- **Poste** : régulatrice au pupitre **RTS, côté régulation**. Arrive après le 1er kill du boss 1.
- **Rôle narratif** : la stratège ; voit tout le réseau, parle en codes ; c'est sa voix à la radio pendant les runs et c'est elle qui diffuse le PHR-2030 dans la vraie fin.
- **Service gameplay** : **pupitre RTS (régulation)** — **tableau des roulements** (annonce Matin / Après-midi / Nuit), **Plan d'Économies** (difficulté optionnelle), défis. Logique de poste : la régulation décide quel train part, quand, et dans quelles conditions.
- **Personnalité** : calme olympien, pense en sillons et en correspondances, ne hausse jamais la voix (« Si je crie, des trains se percutent. »). Elle a vu une slide du PHR-2030 qui la remplace par « une IA prédictive, version bêta, qui pense que Mons est en Bavière ».
- **Tic** : « Je te mets en voie d'attente. »
- **Famille** : **Régulation** — mobilité, ralenti du temps, repositionnement (« Voie d'attente » : une bulle de temps ralenti).
- **Souvenir** : **Casque radio** (choix d'Avantages élargi à 4 options).
- **Répliques** :
  - *Générique* : « Roulement de Nuit. Moins de monde, plus de cadres. Je te mets le biome 1 en orange. »
  - *Après une mort* : « Incident voyageur sur ta ligne. Toi. Je te mets en voie d'attente, le temps de te recoller. »
  - *Après une victoire* : « Le Directeur est en voie d'attente. Définitive, j'espère. Je te mets tout le réseau en vert. »
- **Arc** : N1, le casque. N2, *la minute* : elle raconte la seule minute qu'elle n'a pas pu sauver, en douze ans, et le rapport qui l'en a blâmée ; le héros lui rappelle les 6 millions de minutes sauvées. N3, serment : « Quand je dis départ, tout le monde part. » → Motion commune **« Correspondance assurée »** (avec Kevin).

### 4.6 Josiane Delhaye

- **Poste** : accompagnatrice de train, 28 ans de maison, affectée au pupitre **DPD** (gestion des accompagnateurs de train), menacée par la « suppression des accompagnateurs » (Preuve 2) : le PHR-2030 supprime à la fois son métier et son pupitre.
- **Rôle narratif** : la figure maternelle et inflexible ; celle qui envoie le héros chercher la vérité au prologue.
- **Service gameplay** : dans la **Cour intérieure** — **mannequin de formation** (zone d'entraînement, test des Montages, dégâts affichés) ; **casiers** (équiper un Souvenir obtenu et, si l'équipement personnel est validé, la dotation du héros). Logique de poste : la DPD affecte les agents de bord, gère leurs casiers et leur dotation.
- **Personnalité** : a déjà expulsé un sanglier d'un train « avec politesse ». Connaît le prénom de tous les habitués du 7h12. Tricote pendant les pauses ; la bannière de l'OCC, c'est elle.
- **Tic** : « Ça, c'est pas dans le règlement, mais c'est dans le cœur. »
- **Famille** : **Contrôle des titres** — défense, renvoi, provocation (« Titre non valable » : la Frappe repousse et renvoie les projectiles).
- **Souvenir** : **Thermos de Josiane** (+1 Gobelet au départ).
- **Répliques** :
  - *Générique* : « Le consultant, tu lui as demandé son titre de transport ? Non ? Ben voilà. »
  - *Après une mort* : « Tu ne m'appelles jamais, à la radio. Ça, c'est pas dans le règlement, mais c'est dans le cœur. »
  - *Après une victoire* : « Mon sanglier de 2009 était plus coriace que ton directeur. Mais bravo, hein. »
- **Arc** : N1, le thermos. N2, *le sanglier* : la vraie histoire (le sanglier avait un ticket composté, elle l'a raccompagné jusqu'à la bonne gare) ; une histoire sur le service public plus que sur l'animal. N3, serment : « Je contrôle les billets. Ce soir, je contrôle un contrat. » → Motion commune **« Pause syndicale »** (avec Fatou).

### 4.7 Rudy Courtois

- **Poste** : chef de quai, originellement posté sur la passerelle, aujourd'hui au pupitre **TLI & AIT** (annonces en gare).
- **Rôle narratif** : le héraut ; il annonce le début de chaque Shift, le Sondage, et le 7h12 à l'heure dans l'épilogue. Découvre (J7) que ses propres annonces sont écrasées par une régie installée dans les étages du BAG.
- **Service gameplay** : **pupitre TLI & AIT et écran des départs** (annonce de début de Shift ; statistiques et historique des Shifts présentés comme des trains : `Shift 37 — SUPPRIMÉ — Cause : Consultant Junior`) ; annonces en off pendant les combats.
- **Personnalité** : théâtral, ponctuel jusqu'à l'obsession, vit pour son sifflet. Étiquette son yaourt dans le frigo (« Ce yaourt appartient à Rudy. Je sais compter. — Rudy »).
- **Tic** : « Attention, attention… » avant chaque phrase importante.
- **Famille** : **Coup de sifflet** — étourdissement, onde de choc (« Fermeture des portes » : le Dash laisse une onde qui étourdit 0,8 s).
- **Souvenir** : **Sifflet de Rudy** (le premier Dash de chaque salle étourdit).
- **Répliques** :
  - *Générique* : « Attention, attention… le Sondage propose jeudi. Le traiteur ne peut pas jeudi. On est tranquilles. »
  - *Après une mort* : « Attention, attention… on ne traverse pas les voies. Même pour frapper un consultant. *Surtout* pour frapper un consultant. »
  - *Après une victoire* : « Shift tenu, à l'heure, voie 1. Je l'ai affiché. En vert. J'ai pleuré un peu. En vert aussi. »
- **Arc** : N1, le sifflet (il en a un de rechange, puis un deuxième de rechange). N2, *la voix* : il avoue que la voix synthétique de la gare est enregistrée à partir de la sienne, achetée en 2014 ; c'est sa voix qui supprime les trains, et il ne le supporte plus. N3, serment : « La prochaine fois que ma voix annonce un train, il viendra. » → Motion commune **« Signal électrifié »** (avec Kevin) ou **« Coup de sifflet d'antan »** (avec Marcel).

### 4.8 Jean-Michel « Jean-Mi » Dufrasne

- **Poste** : sous-chef de gare, **barista** de l'OCC, gardien du registre. Sans pupitre attitré, il passe de l'un à l'autre : il connaît tous les roulements, ce qui rend sa trahison possible.
- **Rôle narratif** : la **taupe** (révélée à la 1re victoire), puis, peut-être, le **racheté** (§2.5-2.6).
- **Service gameplay** : sert la Tasse de Relève quotidienne et offre le **Double Expresso** (bonus de départ cumulable) tant qu'il est là. Après rachat : de retour au comptoir à son niveau 3.
- **Personnalité** : drôle, serviable, épuisé. Range trop vite son téléphone neuf. Prend des notes « pour le registre ». Absent certains retours (« J'étais en récup »).
- **Tic** : « Franchement, faut être réaliste… »
- **Famille** : **aucune famille propre**. Avant la révélation, il « booste » la famille la plus prise du Shift précédent… et c'est précisément celle que les ennemis connaissent (affixe **Briefé**).
- **Souvenir** : **Badge vert** (uniquement s'il est épargné et racheté : une porte du BAG s'ouvre sans combat, 1 fois par Shift).
- **Répliques** :
  - *Générique (avant révélation, Shift ≥ 6)* : « Franchement, faut être réaliste… tu crois vraiment qu'on va gagner ? Bon. Double expresso quand même. »
  - *Après une mort (avant révélation)* : « Encore les consultants ? Ils savaient où t'attendre, hein. Bizarre. *(Il range son téléphone.)* »
  - *Après une victoire (racheté)* : « T'as gagné. Moi, j'ai juste servi le café. Mais je l'ai servi ici. C'est déjà ça. »
- **Arc** : la relation est **figée** avant la révélation (les Tasses offertes sont acceptées « pour plus tard »). Après rachat : N1, le Badge vert ; N2, *le jeudi* : il raconte un jeudi avec sa fille, et comment l'OCC s'est arrangée pour lui donner tous les jeudis du mois ; N3, serment : « Faut être réaliste : je reste. » → retour derrière le comptoir, Double Expresso restauré.

### 4.9 Le Fantôme du Wagon-Bar

- **Poste** : ancien serveur du wagon-bar de la ligne, statut « poste supprimé » depuis 1996.
- **Rôle narratif** : la mémoire de « ce qui marchait » ; il connaissait le grand-père du héros. Il ne dit jamais s'il est vraiment un fantôme ou simplement quelqu'un que l'administration a oublié de radier.
- **Service gameplay** : en run, **boutique légendaire du Wagon-Bar** sur la voie 4 (rare, plus fréquente la Nuit). À l'OCC, une fois sa quête terminée : **rénovations** en Grains, depuis son comptoir de wagon-bar reconstruit sur les palettes de la Cour intérieure.
- **Personnalité** : mélancolique, élégant, sent le croque-monsieur, vouvoie tout le monde, y compris le pigeon.
- **Tic** : « Et pour monsieur-dame, ce sera ? »
- **Famille** : **aucune** ; il vend des Avantages d'**Acquis historique** (légendaires) toutes familles confondues.
- **Souvenir** : **Carte des vins de 1994** (le Wagon-Bar apparaît plus souvent).
- **Répliques** :
  - *Générique* : « Votre grand-père prenait un café noir et un croque sans fromage. Il disait que le fromage, c'était pour les jours de grève. »
  - *Après une mort* : « Et pour monsieur-dame, ce sera ? Un remontant ? La maison n'existe plus, donc c'est gratuit. »
  - *Après une victoire* : « Ce soir, la maison offre. Et la maison, ce soir, c'est vous. »
- **Arc** : N1, la carte des vins. N2, *la dernière tournée* : il raconte le dernier service du wagon-bar en 1996 ; le grand-père du héros était au comptoir et a payé la tournée de tout le train « pour que ça finisse bien ». N3, serment : « Tant qu'il y a un comptoir, il y a un service. » → déverrouille le Montage secret **Clé du Wagon-Bar** chez Kevin (elle tient comme un plateau de service).

### 4.10 Raymonde (la Friterie)

- **Poste** : friteuse ambulante. Soixante ans, tablier impeccable, mémoire d'éléphant. Sert les cheminots depuis l'ancienne gare. Ne vient **jamais** à l'OCC (« J'ai un commerce, moi ») : on la rencontre **en run**.
- **Rôle narratif** : l'oreille de la ville ; les consultants commandent chez elle « sans sauce, sans frites, juste la facture » et parlent trop. Ses rumeurs annoncent les élites et les événements du biome suivant.
- **Service gameplay** : **Friterie ambulante** (salle Boutique, garantie 1 fois par biome) : Gobelets, Avantages payants, Réglages de clé, en Tickets. Refuse le sans-contact « parce qu'on ne sait pas où ils vont, vos sous ».
- **Personnalité** : chaleureuse, cash, ardoise de prix « qui n'a pas changé depuis longtemps, par principe ».
- **Tic** : « Avec ou sans vérité, la sauce, chéri ? »
- **Famille** : **aucune** ; elle vend des Avantages de **toutes les familles** (« Je prends les commandes de tout le monde »).
- **Souvenir** : **Pique-frite en bois** (chaque Friterie propose un article de plus).
- **Répliques** :
  - *Générique* : « Les costumes mangent trois frites et demandent un justificatif. Le justificatif, c'est la frite, chéri. »
  - *Après une mort (première Friterie du Shift suivant)* : « Te revoilà ? T'as une mine de bus de substitution. Tiens, une fricadelle, c'est pour la maison. »
  - *Après une victoire* : « On m'a dit que le grand Directeur a mangé une clé. Moi, je dis rien. Je sers. »
- **Arc** : les Tasses se donnent **à la Friterie**, en run. N1, le pique-frite. N2, *l'ardoise* : elle montre l'ardoise des cheminots qui lui doivent de l'argent depuis 1987 et l'efface devant le héros (« Les vrais comptes, c'est entre nous. »). N3, serment : « Tant qu'il y a des frites, il y a des oreilles. » → la Friterie annonce désormais le boss du biome en cours (indice sur ses patterns, rumeur diégétique).

### 4.11 Personnages secondaires du hub

- **Matricule 4412** : pigeon de la passerelle, sans titre de transport. Peut être caressé à l'OCC. Ramène des Notes de service.
- **La grand-mère du héros** : n'apparaît qu'au prologue (par téléphone, message vocal du lundi soir : « Tu viens au marché mardi ? Je prends le 7h12, comme d'habitude. ») et à l'épilogue. C'est le cœur du jeu ; on ne la montre presque pas.

---

## 5. Les biomes (narratif)

Chaque biome est une **étape de la remontée** : du terrain (les quais) vers la décision (le bureau du Directeur). Plus on monte, plus c'est propre, et plus c'est inquiétant. Le **roulement** du Shift (Matin, Après-midi, Nuit) change la lumière et l'ambiance de chaque biome.

### 5.1 Biome 1 — Quais & Voies (« Le 7h12 n'est pas venu »)

- **Ambiance** : quais 1 à 4 et faisceau de voies, de 4h47 à l'aube. Brouillard bas, lampes à sodium, annonces dont la fin est toujours coupée (« Le train de 7h12 à destination de… »). Un « ding-dong » ponctue chaque salle nettoyée. Odeur de ballast mouillé et de café froid.
- **Histoire du lieu** : le cœur battant de la gare depuis plus d'un siècle. C'est ici que Marcel a conduit son premier train, que Josiane a fait descendre son sanglier, que la grand-mère dit bonjour au conducteur. Le **banc du quai 2** est le banc de Marcel ; la **voie 4**, désaffectée, est celle où stationnait le wagon-bar.
- **Ce que Privatix y a fait** : installé des **portiques de rentabilité** (accès au quai facturé à la minute), remplacé les panneaux d'information par des écrans « Expérience Quai », lâché des **Drones Optimètres** « pour la qualité de service », déployé des **Bornes Automatiques** à la place des agents d'accueil. Les rames sont pilotées par l'Auditeur depuis son tableau de bord.
- **Roulements** : *Matin* néons froids et brouillard (drones plus nombreux) ; *Après-midi* lumière orangée et foules de navetteurs à contourner ; *Nuit* bleu profond, caténaires qui grésillent, Agents de sécurité et Wagon-Bar plus fréquent.
- **Détails à placer dans le décor** :
  - Écrans des départs au-dessus des portes de salle : `IC 0712 → Avantage : Josiane — À L'HEURE` ; `L 4211 → Élite — RETARD +5`.
  - Affiche Privatix déchirée : « Votre quai, votre expérience. 0,12 €/minute. »
  - Abri de quai avec un horaire papier jauni de 1987 encore scotché.
  - Graffiti à la craie sur un pilier : « 7h12 — PRÉSENT ».
  - Le banc de Marcel, avec une plaque gravée au tournevis : « Réservé. — M. »
  - Sur la voie 4, la Nuit : particules jaunes et odeur de croque-monsieur.
  - Un chariot à bagages étiqueté « Propriété de Privatix — Ne pas pousser » (on le pousse).
  - Une poubelle « tri sélectif » à trois bacs : « Papier », « Plastique », « Agents ».

### 5.2 Biome 2 — La Passerelle « Calatrava » (« Le vent tourne »)

- **Ambiance** : la passerelle enjambe les voies « comme la colonne vertébrale d'un animal préhistorique ». C'est l'aube : grands arcs blancs, verrière, ciel rose-gris. Le vent hurle, le vide est partout sous les pieds. Le biome le plus silencieux, le plus beau, le plus froid.
- **Histoire du lieu** : les navetteurs l'appellent « la Cathédrale » ou « le Calatrava », selon qu'ils sont émus ou énervés par le budget. On ne nomme jamais son architecte : on montre l'architecture. Les escalators y marchent un jour sur trois ; ce sont presque des personnages. Rudy y était posté avant sa mutation « en temps réel ».
- **Ce que Privatix y a fait** : collé ses panneaux « **Mons 2030 : une gare, zéro guichet** » sur les arcs, installé un « parcours de mobilité fluide » (des escalators qui ne vont qu'à la montée, vers le BAG), et confié la réorganisation des roulements au **Fluidifieur**, qui règne sous le grand arc.
- **Roulements** : *Matin* brume sous la verrière, vides à peine visibles ; *Après-midi* ombres longues des arcs (les drones y perdent leur cible) ; *Nuit* verrière noire, les voies en contrebas éclairées par les rames qui passent.
- **Détails à placer dans le décor** :
  - Panneaux d'escalator : « En service (aujourd'hui) » / « Hors service (demain, après-demain) ».
  - Le pigeon **Matricule 4412** sur un garde-corps, avec une bague « 4412 » à la patte.
  - Feuilles volantes emportées par le vent : pages du classeur « Roulements 2027 — PROVISOIRE v14 ».
  - Un banc vide face au vide, avec un gobelet abandonné, encore tiède.
  - Graffiti sous un arc : « On voulait des trains. Ils nous ont donné une vue. »
  - Une borne « Votre avis compte » à quatre smileys, tous arrachés sauf le neutre.
  - Panneau Privatix envolé, coincé dans les câbles : « Moins de personnel, plus de sourires ».

### 5.3 Biome 3 — Hall & BAG (« Terminus BAG »)

- **Ambiance** : on redescend dans le hall historique (bois clair, guichets bâchés), puis on passe le portique du **BAG** côté hall, à l'opposé de la Cour intérieure où tourne l'OCC. Open-space, flex office, moquette grise, néons blancs, salles de réunion vitrées, écrans de KPI partout. Musique d'ascenseur qui se déforme en synthé agressif à chaque vague.
- **Histoire du lieu** : le hall a vu passer des générations de navetteurs ; le guichet de Béné y était le dernier ouvert. Le BAG abritait autrefois les services de la gare ; Privatix en a pris les étages, étage par étage, « en phase de transition ». Seul le rez-de-chaussée arrière, où tourne l'OCC, lui résiste (§3.1). Au 3e : le bureau du Directeur, et derrière une double porte capitonnée, la **Salle du Conseil**, reliée au système d'annonces de toute la gare.
- **Ce que Privatix y a fait** : remplacé les guichets par le « **Corner Expérience Voyageur** » (un écran tactile et une plante en plastique), installé des portiques à badge qui bipent rouge pour toute chasuble orange, une **Hôtesse holographique**, une salle de sieste « Power Nap Zone » fermée à clé depuis son inauguration, et une salle de réunion « **Synergie** » où une réunion dure depuis 2019.
- **Étages** : RDC (Hall, Accueil) → 1er (Open-space) → 2e (salle Synergie, **Archives** où dort la Preuve 3) → **Palier du 3e** (repos, machine à café « premium » à 30 Tickets le Gobelet) → Bureau du Directeur et Salle du Conseil.
- **Roulements** : *Matin* bureaux vides, écrans de veille qui affichent des KPI ; *Après-midi* réunions en cours partout (plus d'écrans de visio allumés) ; *Nuit* lumière de veille, néons qui clignotent, Agents de sécurité en patrouille.
- **Détails à placer dans le décor** :
  - Vidéo des « Valeurs » en boucle : Agilité, Excellence, Bienveillance, **RENTABILITÉ** (en plus gros).
  - Plantes en plastique qui « repoussent » au passage suivant.
  - Paperboard de la salle Synergie : des flèches qui ne mènent nulle part, et « ACTION : ??? » entouré trois fois.
  - Machine à café à 9 000 € qui affiche « Détartrage nécessaire » depuis son installation.
  - Trottinette électrique de fonction de Vanderslide : compteur « 0 km parcourus en train ».
  - Mur de diplômes de formations « leadership » d'un week-end.
  - Dans le hall historique : la **carte des vins de 1994** (quête du Wagon-Bar), glissée derrière un cadre.
  - Pense-bête collé sur l'ascenseur : « En maintenance. Comme vous. »

---

## 6. Les ennemis (fiches lore)

Les ennemis sont les **ressources** de Privatix : des gens payés pour ne pas savoir et des machines achetées pour ne pas répondre. Code visuel : ennemis turquoise, tout ce qui blesse le joueur en magenta, accents violet Privatix. Les **barks** (≤ 8 mots) s'affichent en bulle courte, au maximum un par ennemi toutes les 6 s, et jamais plus de deux à l'écran.

### 6.1 Consultant Junior « Slide-Ninja »

- **Qui** : 24 ans, première mission chez **Synergia Partners**, facturé un montant « non communiqué » par jour pour « apporter un regard neuf » sur un métier découvert lundi. Costume cintré trop court, baskets blanches, laptop sous le bras. Chasse en meute.
- **Motivation satirique** : décrocher un **quick win** pour sa revue annuelle. Il ne déteste personne : il a un framework.
- **En jeu** : mêlée rapide, ruée « Quick win » qui laisse une traînée de slides. Projeté sur une voie ou dans le vide, il « part en réunion ».
- **Barks** :
  - « On va challenger ça en mode agile ! »
  - « C'est un quick win, ça ! »
  - *(vaincu)* « Je vous envoie un récap… »

### 6.2 Borne Automatique

- **Qui** : une borne de vente trapue, écran fissuré, fente à pièces lumineuse. Elle a remplacé le guichet de Béné et n'a jamais accepté le bon moyen de paiement. Elle se déplie d'une trappe au sol.
- **Motivation satirique** : « autonomiser le voyageur », c'est-à-dire le laisser seul face à un écran.
- **En jeu** : tir à distance de tickets, ruban de « ticket de caisse continu » ; dos vulnérable. Vaincue, elle affiche « HORS SERVICE » et s'éteint en soupirant.
- **Barks** (voix synthétique de gare) :
  - « Veuillez insérer votre dignité. »
  - « Pièces de 2 € non acceptées. »
  - *(vaincue)* « Votre transaction a été optimisée. Elle n'existe plus. »

### 6.3 Drone Optimètre

- **Qui** : petit quadrirotor violet, un œil-objectif, une antenne KPI qui clignote. Acheté « pour la qualité de service », il mesure le temps que met un agent à sourire.
- **Motivation satirique** : ce qui n'est pas filmé n'a pas eu lieu.
- **En jeu** : vole au-dessus des voies et des vides, **marque** le joueur (il subit plus de dégâts et attire les ennemis). Perd sa cible dans les ombres des arcs.
- **Barks** (haut-parleur) :
  - « Votre productivité est en cours d'évaluation. »
  - « Souriez, vous êtes filmé pour la qualité. »
  - *(abattu)* « Évaluation… non… concluante… »

### 6.4 Manager KPI « Le Tableur » (élite)

- **Qui** : grand, chemise rentrée, chronomètre géant autour du cou, tablette brandie comme un sceptre, aura de graphiques. Il a chronométré les pauses pipi au centième et rêve d'un indicateur qui mesure les indicateurs.
- **Motivation satirique** : « Ce qui ne se mesure pas n'existe pas. » Le train avait 12 minutes de retard, mais l'indicateur est vert.
- **En jeu** : élite de soutien ; Réunion d'alignement (boucliers violets sur ses troupes), Chronométrage (zone de Ralenti), Reporting hebdo (vague circulaire de graphiques). Frappé pendant la Réunion d'alignement, il perd tous ses boucliers.
- **Barks** :
  - « Vous êtes à 63 % de l'objectif. De vie. »
  - « Votre ressenti n'est dans aucune colonne. »
  - *(vaincu)* « Impossible… mes indicateurs étaient verts… »

### 6.5 Agent de Sécurité Externalisé

- **Qui** : massif, gilet fluo d'un sous-traitant de sous-traitant, oreillette, badge géant tenu comme un bouclier. Payé au contrat, il ne sait pas où il est ni qui il protège. **C'est un travailleur précaire, pas un méchant** : ses répliques sont les plus humaines du bestiaire.
- **Motivation satirique** : finir sa vacation à 6h sans histoire.
- **En jeu** : tank lent, bouclier frontal ; vulnérable de dos et pendant l'ouverture. Le Coup de sifflet lui fait baisser le badge.
- **Barks** :
  - « Vous n'avez pas le bon badge. »
  - « Mon contrat finit à 6h, hein. »
  - *(vaincu, presque soulagé)* « C'est pas moi qui décide, monsieur. »

### 6.6 Pense-bête Vivant

- **Qui** : carré jaune (ou rouge) à petites pattes, flèche au marqueur. Une idée qu'on ne réalisera jamais, née d'un atelier et lâchée dans la nature. Invoqué en essaim par le Coach Agile.
- **Motivation satirique** : exister, ne serait-ce qu'une fois, en haut de la pile des priorités.
- **En jeu** : se colle au héros et le ralentit ; un Dash le décolle.
- **Barks** (écrits sur lui, pas dits) :
  - « À FAIRE : VOUS »
  - « URGENT (depuis 2019) »
  - *(décollé)* « Moi aussi j'ai été une priorité… »

### 6.7 Coach Agile « Le Facilitateur » (élite)

- **Qui** : sweat à capuche à slogan sous un blazer, chaussettes dépareillées, bloc de Pense-bête XXL, tableau blanc à roulettes, sourire permanent. Titre officiel : « Chief Happiness & Transformation Facilitator ».
- **Motivation satirique** : rendre la suppression des postes « inclusive et bienveillante ». Annonce les fermetures en atelier de briques en plastique.
- **En jeu** : élite invocateur qui fuit le contact ; Atelier Pense-bête, Team building obligatoire (attire et inverse les commandes), Rétro positive (soigne les ennemis, interrompable). Cible prioritaire.
- **Barks** :
  - « Il n'y a pas d'échec, que des apprentissages ! »
  - « On fait un tour de météo intérieure ? »
  - *(vaincu)* « Je… je ressens beaucoup de choses, là… »

**Annexe — Hôtesse holographique** (soutien du biome 3) : projection bleutée souriante qui grésille ; rend les ennemis invisibles 2 s ; s'éteint quand on frappe son projecteur. Barks : « Bienvenue chez nous, qui sommes vous. » / « Votre remarque sera traitée sous 6 à 18 mois. » / *(éteinte)* « Souhaitez-vous… remplir… une enquête… »

### 6.8 Le Furet putride (ennemi majeur)

- **Qui** : un furet énorme, pelage gris-jaune ébouriffé, collier violet Privatix avec un petit haut-parleur et un badge « Solution de tri autonome ». Il vit dans le **coin poubelles de la Cour intérieure** du BAG (§3.2), sous le pignon au toit bâché, entre les six conteneurs qui débordent et le tas de sacs bleus.
- **Origine** : quand Privatix a pris les étages du BAG, elle a **externalisé le ramassage des déchets** ; le prestataire passe « selon un roulement communiqué la veille », c'est-à-dire jamais. Pour « optimiser le tri à coût zéro », un consultant a eu une idée : un furet. Il s'est nourri des **sacs bleus**, des rapports déchiquetés qui tombent des étages par la gaine de ventilation et des petits fours décongelés du traiteur du Sondage (Note n° 13). Il a grandi. Beaucoup.
- **Place dans la hiérarchie** : **aucune, officiellement**. Il n'est sur aucun organigramme ; Privatix nie son existence (« Nous n'avons pas de furet. Nous avons une solution de tri. »). Dans les faits, l'Auditeur des Quais l'utilise comme fouineur : il **renifle les locaux non répertoriés** (Note n° 6) et suit l'odeur du marc de café jusqu'à l'OCC.
- **Biome** : sort de son antre par les plaques d'égout et les gaines techniques. **Élite majeur du biome 1** (passage sous voies, couloir technique), plus fréquent la Nuit ; **rencontre optionnelle depuis le hub** : quand le couvercle d'un conteneur se soulève tout seul dans la Cour, le héros peut aller voir (combat dans le coin poubelles, sans risque de Mise à pied : à zéro Énergie, Fatou vient le chercher en grommelant).
- **Ton** : le seul ennemi qui sent mauvais, et qui le sait. Pas méchant : mal nourri par un système qui ne vide plus ses poubelles. La satire vise l'externalisation, pas l'animal.
- **En jeu** : nuages d'odeur (zones qui font monter le Burnout, télégraphiées par des volutes magenta), roulades à travers le tas de sacs bleus (projectiles mous qui rebondissent), plongée sous une plaque d'égout et resurgissement (les pavés se soulèvent avant), vol d'un Gobelet (frappé, il le recrache).
- **Barks** (voix synthétique de son collier) :
  - « Tri en cours. Veuillez patienter. »
  - « Odeur de café détectée. Local non répertorié. »
  - *(vaincu)* « Tri… suspendu… » *Il éternue, se roule en boule dans un conteneur et s'endort. Josiane referme doucement le couvercle : « Ça, c'est pas dans le règlement, mais c'est dans le cœur. »*

### 6.9 Le Discosaure (ennemi majeur)

- **Qui** : un dinosaure massif en costume trois-pièces à larges revers, dont le dos porte, encastrée entre les écailles, une **boule à facettes disco** qui tourne en permanence et jette des éclats de lumière sur les murs. Il avance en rythme. On ne l'a jamais vu s'asseoir.
- **Origine** : **Senior Partner fondateur** de Synergia Partners. Il vend le même plan de restructuration depuis la soirée de lancement du cabinet, à l'époque des pistes de danse, et n'a fait que changer le logo de la couverture. La boule à facettes date de cette soirée ; il ne l'a jamais retirée, « parce que ça a toujours marché ».
- **Place dans la hiérarchie** : au-dessus des Coachs Agiles et des Managers KPI, en dessous de Vanderslide sur le papier ; en pratique, Vanderslide l'admire et lui demande son avis avant chaque Comité. Privatix le loue pour ses « soirées de lancement de transformation ».
- **Biome** : **élite majeur ou mini-boss du biome 3**, à l'« Afterwork de transformation » du 2e étage du BAG (open-space aux néons éteints, seule la boule éclaire). Peut apparaître en élite rare dans le hall.
- **Ton** : le Discosaure n'est pas vieux, il est **fossile** : c'est sa méthode qui l'est, pas son âge. Aucune blague sur l'âge (règle §1.4) ; l'humour porte sur le recyclage infini des mêmes recettes de conseil.
- **En jeu** : les éclats de la boule balaient la salle comme des projecteurs et **marquent** le héros (comme le Drone Optimètre) ; piétinements **en rythme** qui envoient des ondes de choc sur les temps forts de la musique (le rythme est le télégraphe) ; « Restructuration » : il fait tourner la salle en ronde forcée (attire et repousse). Casser la boule (dos exposé après un piétinement) éteint la salle et le désoriente.
- **Barks** :
  - « On a toujours fait comme ça. Et ça a toujours marché. Pour nous. »
  - « Restructurez avec moi ! Un, deux, un, deux ! »
  - *(vaincu)* *La boule s'arrête.* « … La musique… s'est arrêtée ? » *Il reste debout, immobile, à attendre qu'on la rallume.*

**Affixe narratif « Briefé »** (avant la révélation de Jean-Mi) : un ennemi Briefé porte un dossier sous le bras marqué du portrait du collègue dont la famille a été la plus prise au Shift précédent, et y résiste. Bark : « On a lu votre roulement. »

---

## 7. Les boss

### 7.1 Boss 1 — L'Auditeur des Quais (Manager KPI suprême)

- **Biographie satirique** : ancien Manager KPI promu après avoir prouvé, tableaux à l'appui, que les quais seraient « 38 % plus ponctuels sans trains ». Il a reçu de Privatix le pouvoir de **commander les rames** depuis sa tablette. Il ne regarde jamais l'heure qu'il est, seulement l'heure qu'il devrait être. Le chronomètre à son cou n'a pas été arrêté depuis son entrée en fonction.
- **Arène** : quai 2 / voie / quai 3, sous un écran des départs géant qui sert d'horloge à télégraphes.
- **Intro** :
```text
*Le chronomètre clique. L'écran affiche « AUDIT EN COURS ».*
AUDITEUR : Vous avez mis 4 minutes 12 pour arriver jusqu'ici. Je le note.
AUDITEUR : Le standard est de 47 secondes. Le standard est un objectif. L'objectif est un standard.
HÉROS : … (soupir de fin de pause)
AUDITEUR : Soupir non conforme. Audit bienveillant : début.
```
- **Répliques par phase** :
  - *Phase 1 « Audit bienveillant »* : « Restez dans le cercle, c'est pour la mesure. » / « Ce bouclier est un indicateur de confiance. »
  - *Phase 2 « Plan de transport optimisé »* : « Voie 3, passage dans trois… deux… un. » / « Ce train ne s'arrête pas. Il est rentable. »
  - *Phase 3 « Objectif non atteint »* : « Tout est en retard ! Même moi ! » / « Accélérez ! Le chrono ! LE CHRONO ! »
- **Défaite** : le chronomètre s'arrête sur **7:12**. Il le regarde, pour la première fois. « … Le train de 7h12, il existe encore ? » Il s'assied sur le banc du quai, tablette éteinte.
- **Victoire sur le joueur** : « Shift interrompu à {heure}. Taux de réussite : zéro. C'est un chiffre très propre. »
- **Récompense narrative** (1er kill) : **Preuve n° 1 « Fermeture des guichets »**.

### 7.2 Boss 2 — Le Réorganisateur RH, « le Fluidifieur »

- **Biographie satirique** : il ne déteste personne, il **fluidifie**. Il change les plannings la veille « pour responsabiliser les ressources » et appelle « mobilité » le fait d'envoyer quelqu'un travailler à l'autre bout de la province à 4h du matin. Gilet sans manches, lanyard couvert de badges, il glisse sur une chaise de bureau à roulettes portée par le vent et brandit le classeur « Roulements 2027 — PROVISOIRE v14 ». Il n'a jamais lu le Règlement : il a lu le résumé du résumé.
- **Arène** : le nœud central sous le grand arc de la passerelle ; vide tout autour, dalles de verrière, vent constant.
- **Intro** :
```text
*Une chaise à roulettes glisse dans le vent et s'arrête pile devant le héros.*
FLUIDIFIEUR : Ah ! Vous êtes en C ? Non non, vous êtes en S. Depuis ce matin.
FLUIDIFIEUR : Ce n'est pas un changement, c'est une opportunité de changement.
RUDY (radio) : Attention, attention… il a le classeur. Méfie-toi du classeur.
```
- **Répliques par phase** :
  - *Phase 1 « Mobilité interne »* : « Votre samedi est "en cours de validation". » / « Je vous mets sur une dalle plus… aérée. »
  - *Phase 2 « Plan de transformation »* : « Mutation d'office ! C'est pour votre carrière ! » / « L'organigramme, c'est moi. Et vous, vous êtes une case. »
  - *Si le joueur attrape les 3 pages du Règlement* : HÉROS : « Article 47, alinéa 3 : préavis de sept jours. » — FLUIDIFIEUR : « Il y a un alinéa 3 ?! »
- **Défaite** : « … Sept jours ? Personne ne lit jamais l'alinéa 3. » Sa chaise roule seule vers le bord et s'arrête, juste à temps. Il descend à pied.
- **Victoire sur le joueur** : « Voilà. Vous êtes en repos. Un repos non prévu, mais le planning s'adaptera. »
- **Récompense narrative** (1er kill) : **Preuve n° 2 « Suppression des accompagnateurs »**.

### 7.3 Boss final — Gontran Vanderslide

- **Titre** : Directeur de la Transformation et de l'Excellence Opérationnelle, région « Hainaut Optimisée », futur « Chief Railway Experience Officer » chez Privatix.
- **Biographie satirique** : costume trop ajusté, baskets blanches « pour faire startup », oreillette permanente, tasse « World's Best Disruptor », trottinette électrique de fonction. **N'a jamais pris le train.** Sincèrement convaincu que le rail serait parfait sans trains, sans voyageurs et sans cheminots. Sa prime dépend du nombre de lignes « rationalisées ». Il a fait toute sa carrière dans des salles sans fenêtre et il a peur du silence : c'est pour ça qu'il parle tout le temps. Il n'est pas le vrai pouvoir : Hubert Rentabilis l'évalue, lui aussi.
- **Arène** : phase 1 dans le **Bureau du Directeur** ; la cloison s'abat (« Réorganisation ») et l'arène devient la **Salle du Conseil** (table immense, mur de visio aux carrés noirs dont le carré « HR » d'Hubert, photocopieuse monumentale reliée aux annonces de la gare).
- **La jauge de signature** : en haut de l'écran, le stylo avance sur le Contrat de Concession (7 minutes au total). Pleine : contrat signé, défaite, scène satirique (« Félicitations, vous faites désormais partie de l'aventure Privatix. Votre badge vous sera envoyé par Sondage. »), retour à l'OCC.
- **Les Preuves** : chaque **Preuve en main** s'active sur un pupitre-projecteur ; elle fait reculer la jauge de 25 % et étourdit Vanderslide 3 s (« Slide 47 : ce n'est pas la mienne… »). Une fois par phase.
- **Intro** (premier combat) :
```text
VANDERSLIDE : Ah. L'équipe terrain. Entrez. Un café ? La machine fait 47 recettes. Personne ne sait l'allumer.
HÉROS : On vient arrêter la signature.
VANDERSLIDE : Arrêter ? Pour un 7h12 qui transporte quatorze personnes ? Quatorze ! Ce n'est même pas un chiffre significatif.
JOSIANE (radio) : Ces quatorze-là, ils ont un nom.
VANDERSLIDE : Pas dans le tableur. Je lance la présentation. Quatre cent douze slides. Il n'y a pas de pause prévue.
FATOU (radio) : Ça, monsieur, c'est illégal.
VANDERSLIDE : C'est agile.
```
- **Intros alternatives** (Shifts suivants, une par victoire) : « Encore vous ? J'ai pourtant envoyé un Sondage. » / « Cette fois, j'ai prévu une pause. Pour moi. » / « J'ai benchmarké votre clé. Au Japon, ils utilisent des tablettes. » / *(après 5 victoires, voix cassée)* « Je n'ai plus de slides. J'ai fait les 412. Il ne reste que moi. »
- **Phase 1 « Méga-Deck 2030 »** (le grand écran annonce chaque attaque par le titre de la slide suivante) :
  - « Slide 1 sur 412. Restez concentrés, c'est la plus courte. »
  - « Benchmark international ! Au Japon, ça marche ! »
  - « Je vous mets en copie. Et vous. Et vous. »
- **Phase 2 « Conseil d'Administration en visio »** (fusion avec le Contrat, Clauses-tentacules ; voix off d'Hubert) :
  - VANDERSLIDE : « Mesdames et messieurs du Conseil, vous m'entendez ? … Vous êtes en mute. »
  - HUBERT : « Gontran, on vous entend mal. On vous voit mal. On vous évalue bien. »
  - VANDERSLIDE : « Article premier : le personnel est un actif variable. Article deux : l'article premier n'est pas négociable ! »
  - *(Preuve activée)* HÉROS : « Ceci a été présenté au comité. Ceci n'a jamais été montré au terrain. »
- **Phase 3 « L'Optimiseur Absolu »** (fusion avec la photocopieuse ; la Copie conforme du héros rejoue ses 3 dernières secondes) :
  - « Si je ne peux pas vous convaincre, je vais vous dupliquer. »
  - « Recto. Verso. Recto. Verso. Sans pause. »
  - « Le seul train rentable, c'est celui qui ne part pas ! »
- **Coup final** : sous 5 % de ses points de vie, une invite unique s'affiche : **« Mais concrètement, sur le terrain, ça donne quoi ? »** Ralenti, silence, un seul coup, critique garanti.
```text
HÉROS : Mais concrètement, sur le terrain, ça donne quoi ?
VANDERSLIDE : … Concrètement ? Concrètement… *(long silence)* … je n'ai pas de slide pour ça.
```
- **Défaite** : à genoux, oreillette de travers. « Bon. Soyons adultes. Une phase pilote. Une seule ligne. » (fin mitigée, §2.7). Dans la vraie fin : « Mon oreillette… n'a plus de réseau. »
- **Victoire sur le joueur** (jauge pleine ou Énergie à zéro) : « Le planning est validé. Le diaporama est validé. Même le traiteur est validé ! » puis, le stylo levé : « … Ah. On me signale un conflit d'agenda. On reprogramme. »

### 7.4 Hubert Rentabilis — PDG de Privatix (jamais combattu)

- Présent uniquement en visio, **caméra éteinte** : un carré noir marqué « HR ». Voix calme, lente, celle de quelqu'un qui n'a jamais attendu un train. Il ne s'énerve jamais ; il **évalue**.
- **Rôle** : rappeler que Vanderslide n'est qu'un exécutant. La satire vise le système, pas un homme. On ne le combat jamais : on le **déconnecte**, en rendant la vérité publique.
- **Répliques de reprogrammation** (une nouvelle à chaque victoire) :
  1. « … Bon. On reprogramme. Envoyez un Sondage. »
  2. « Gontran, je vous rappelle que votre prime est indexée sur ce contrat. Pas sur votre dignité. »
  3. « Proposez-leur une phase pilote. Les gens adorent les pilotes. »
  4. « Nous allons créer une commission. Elle réfléchira à pourquoi vous échouez. »
  5. « Je commence à trouver ce dossier… peu scalable. »
  6. « La prochaine date est définitive. » *(déclenche la vraie fin si les autres conditions sont remplies)*
- **Vraie fin** : « Bon. Signez sans lui. » puis, après la diffusion : « … On en reparlera au prochain plan stratégique. » *(Déconnexion.)*

### 7.5 Boss optionnel — Elio Di Rupo, « l'Invité d'honneur »

> Caricature satirique d'une personnalité politique réelle, autorisée par le porteur du projet (§1.4, exception 3). Toutes les répliques ci-dessous sont **inventées pour le jeu** ; aucune n'est une citation réelle. Aucun parti, logo ni slogan.

- **Silhouette** : nœud papillon **bordeaux**, lunettes **sans monture**, mèche **brune** impeccable, costume **bleu marine**. Il tient une paire de **ciseaux d'inauguration** géants et un discours de quarante pages.
- **Ce qu'il fait dans l'histoire** : il ne travaille pas pour Privatix. Il est le seul participant du **Sondage** qui répond toujours « disponible », à condition qu'il y ait **un ruban à couper**. Pour donner une caution à la cession, Privatix organise sur la Passerelle l'**inauguration de « Mons 2030 : la Gare Expérience »** et l'invite à couper le ruban. Il n'a pas lu le dossier : il a lu le discours. Il défend la cérémonie, pas le contrat, avec l'énergie de quelqu'un qui a inauguré beaucoup de choses à Mons et compte bien continuer.
- **Place dans la hiérarchie des boss** : hors hiérarchie. **Boss optionnel du biome 2**, déclenché par l'événement **« L'Inauguration »** (porte surmontée d'un ruban rouge), disponible après le premier kill du Fluidifieur. Il ne remplace aucun boss canon et ne bloque aucune fin.
- **Arène** : le belvédère de la Passerelle, transformé en tribune : estrade, pupitre à micro, plaque d'inauguration voilée d'un drap, rangée de chaises pliantes occupées par des consultants qui applaudissent sur commande.
- **Intro** :
```text
*Un micro siffle. Un ruban rouge barre le belvédère d'un bout à l'autre.*
INVITÉ D'HONNEUR : Mesdames, messieurs, chers amis… et vous, au fond, en gilet orange.
INVITÉ D'HONNEUR : Nous sommes ici pour inaugurer l'avenir. Et l'avenir, je le dis souvent, ça s'inaugure.
RUDY (radio) : Attention, attention… il a quarante pages. Prévois des Gobelets.
HÉROS : … (soupir de fin de pause)
INVITÉ D'HONNEUR : Je vois que l'émotion vous gagne. Page deux.
```
- **Phases** :
  - *Phase 1 « Le Discours inaugural »* : les phrases se déroulent en ondes depuis le pupitre ; chaque « Et j'ajouterai… » relance une onde. Les consultants de la claque applaudissent et renforcent les ondes ; les faire taire les affaiblit. Répliques : « Je serai bref. » *(Il ne l'est pas.)* / « Permettez-moi une parenthèse. Elle durera le temps qu'il faudra. »
  - *Phase 2 « La Première Pierre »* : il pose des premières pierres de projets « qui verront le jour » ; elles tombent sur l'arène, deviennent obstacles, puis s'effritent (« reportés »). Répliques : « Cette pierre est la première d'une longue série. » / « Les travaux commenceront… bientôt. C'est un engagement. »
  - *Phase 3 « Le Ruban »* : le ruban rouge encercle l'arène et se resserre ; les ciseaux géants coupent en lignes droites, télégraphiées par l'ouverture des lames. Répliques : « Un ruban, c'est une promesse. Celle-là, je la coupe. » / « Mons mérite mieux ! » *(Il le pense.)*
- **Défaite** : le drap glisse de la plaque d'inauguration. Il lit, pour la première fois : **« Privatix Rail Solutions — Phase 3 : Cession »**. Long silence. Il redresse son nœud papillon.
```text
INVITÉ D'HONNEUR : … On m'avait parlé d'une inauguration.
INVITÉ D'HONNEUR : Je n'inaugure pas une fermeture.
*Il tend les ciseaux au héros, range ses quarante pages et descend de l'estrade.*
INVITÉ D'HONNEUR : Il doit bien y avoir, quelque part dans cette ville, quelque chose qui ouvre.
MARCEL (radio) : De mon temps, on inaugurait les gares. Pas leur vente.
```
- **Victoire sur le joueur** : « Je déclare ce Shift… clos. Applaudissez, applaudissez. Et rendez-vous à la prochaine inauguration. »
- **Récompense narrative** (1er kill) : les **Ciseaux d'inauguration** (objet de collection, archivé par Béné). La cérémonie annulée fait reculer le **Sondage** : au retour, l'écran de Rudy affiche « Participant d'honneur : indisponible ».

---

## 8. Système de dialogues à la Hades

### 8.1 Principe

Chaque retour à l'OCC doit donner **au moins une réplique neuve**. Les collègues commentent le Shift qui vient de se terminer, l'histoire qui avance et la relation qu'on construit. En run, ils parlent **par radio** (portrait en coin d'écran, une ligne, jamais pendant un télégraphe de boss).

### 8.2 Les quatre priorités

| Priorité | Contenu | Exemple de condition | Règle |
|---|---|---|---|
| **1. Essentielle** | Jalons du scénario (§2.4), révélation, fins | `bossKills[1] == 1`, `victories == 1` | Toujours jouée, avant tout le reste ; la Vieille Dame siffle pour l'annoncer. |
| **2. Réactive** | Ce qui vient de se passer au dernier Shift | `lastKiller == "borne"`, `lastDeathBiome == 2` | Jouée si aucune Essentielle n'est disponible pour ce PNJ. |
| **3. Relation** | Scènes et lignes liées aux Tasses | `relation.josiane >= 2` | Jouée si ni Essentielle ni Réactive. |
| **4. Remplissage** | Ambiance, blagues, lore, roulement | `roulement == "Nuit"` | Toujours disponible ; évite le silence. |

### 8.3 Conditions disponibles

- **Progression** : `runCount`, `victories`, `bossKills[1..3]`, `deepestBiome`, `evidenceArchived[1..3]`, `evidenceInHand`, `notesFound`.
- **Dernier Shift** : `lastResult` (mort / victoire), `lastDeathBiome`, `lastDeathRoom`, `lastKiller`, `lastDeathCause` (rame, vide, Pétage de plombs, jauge de signature), `lastRoulement`, `gobeletsUnused`, `burnoutAtDeath`, `perfectDashCount`, `retardCumule`, `topFamily` (famille d'Avantages la plus prise), `planEconomiesLevel`.
- **Histoire** : `flags` (`jeanMiRevealed`, `jeanMiSpared`, `jeanMiRedeemed`, `jeanMiDelivered`, `fantomeFound`, `occRaided`, `trueEndingSeen`), `relation[pnj]`, `pigeonFed`.
- **Contexte** : `roulement` à venir, PNJ présents, Souvenir équipé (un collègue remarque toujours qu'on porte le sien).

### 8.4 Règles de sélection

1. Chaque réplique porte un drapeau **« déjà dite »** ; on ne la rejoue jamais (sauf Remplissage marqué `repeatable`, au bout de 10 retours).
2. **Une seule bulle par PNJ et par retour** (le joueur peut relancer la conversation pour une ligne de Remplissage).
3. **Ordre de parole** : Marcel et Fatou d'abord (ils accueillent), puis le PNJ concerné par une Essentielle, puis les autres selon la proximité du héros.
4. **Anti-redondance** : si deux PNJ ont une Réactive sur le même fait (« tué par une rame »), seul le plus pertinent la dit ; l'autre passe en Relation ou Remplissage.
5. **Les répliques réactives s'éteignent** : une Réactive n'est éligible qu'au retour qui suit le fait.
6. **En run (radio)** : au maximum 1 ligne toutes les 3 salles hors événements ; jamais pendant un combat de boss sauf ligne scriptée ; priorité aux premières fois (premier dash parfait, premier Pétage de plombs, première Preuve en main).
7. **Volume cible** : ~25 répliques par PNJ principal au lancement (~250 au total), extension à 50 par PNJ ensuite.

### 8.5 Dix répliques contextuelles d'exemple

| # | PNJ | Moment | Condition | Réplique |
|---|---|---|---|---|
| 1 | Béné | OCC | `lastKiller == "borne"` | « Elle t'a imprimé ? Elle refuse aussi les pièces de 2 €. On ne négocie pas avec ces machines-là. » |
| 2 | Rudy | OCC | `lastDeathCause == "rame"` | « Attention, attention… on ne traverse pas les voies. Même pour frapper un consultant. » |
| 3 | Yasmina | Radio, en run | `perfectDashCount == 1` (premier dash parfait de la partie) | « Retard indépendant de ta volonté. Quinze minutes. Joli. Je l'inscris au registre des excuses. » |
| 4 | Fatou | Radio, en run | Burnout atteint 100 pour la première fois (Pétage de plombs) | « Ton Burnout est à cent. Respire. Frappe. Mais respire. On en parle à l'OCC. » |
| 5 | Fatou | OCC | `lastDeathCause == "petagePlombs"` | « Tu as pété un plomb et tu en as perdu huit d'Énergie max. Le corps note tout, même quand le roulement oublie. » |
| 6 | Kevin | OCC | `lastDeathBiome == 2` et `lastDeathCause == "vide"` | « Tombé de la passerelle ? C'est pas nous, c'est l'autre boîte. Enfin… là, c'est un peu toi, hein. » |
| 7 | Marcel | OCC | `lastKiller == "consultantJunior"` et `runCount <= 3` | « Battu par un gamin en baskets blanches ? De mon temps, ils avaient au moins des chaussures. » |
| 8 | Josiane | OCC | `topFamily != "josiane"` sur les 3 derniers Shifts | « Tu ne m'appelles jamais, à la radio. Ça, c'est pas dans le règlement, mais c'est dans le cœur. » |
| 9 | Rudy | Écran des départs | `retardCumule >= 180` (min) | « Attention, attention… retard cumulé : trois heures douze. Nous vous prions de nous excuser pour la gêne occasionnée. » |
| 10 | Marcel | OCC | `lastDeathCause == "signature"` (jauge pleine) | « Il a signé ? … Non. Regarde l'écran : "reprogrammé". Le Sondage est de notre côté, fieu. Pour l'instant. » |
| bonus | Jean-Mi | OCC | `runCount >= 6` et `!jeanMiRevealed` | « Ils t'attendaient, hein, au biome 2. Comme s'ils savaient. *(Il range son téléphone.)* Double expresso ? » |
| bonus | Fatou | OCC | `gobeletsUnused >= 2` à la mort | « Tu avais deux Gobelets pleins. Deux. Hydrate-toi. Au café, de préférence. » |

---

## 9. Notes de service et glossaire

### 9.1 Les 15 Notes de service (collectibles)

Objets de lore ramassés dans les consignes, les salles Café, les événements ou rapportés par Matricule 4412. Chaque Note s'épingle sur le liège de l'OCC (archives de Béné) ; les 15 débloquent l'écran « Archives » après le générique. En-tête en jeu : « NOTE DE SERVICE — Diffusion : tout le personnel — Confidentialité : relative ».

**N° 1 — « Ponctualité des retards »** *(biome 1)*
> Afin d'améliorer nos indicateurs, les retards inférieurs à 14 minutes seront désormais qualifiés d'« avances différées ».
> Les agents sont priés de ne plus utiliser le mot « retard », ni devant les voyageurs, ni entre eux.

**N° 2 — « Accès au quai : nouvelle tarification »** *(biome 1)*
> L'accès au quai est désormais facturé à la minute (0,12 €), afin de responsabiliser l'attente.
> Les voyageurs dont le train est supprimé bénéficient d'une minute offerte.

**N° 3 — « Escalators : nouveau régime »** *(biome 2)*
> Dans le cadre du plan sobriété, les escalators fonctionneront un jour sur trois, selon un roulement communiqué la veille.
> Les voyageurs à mobilité réduite sont invités à se signaler 48 h à l'avance auprès d'un guichet fermé.

**N° 4 — « Guichets : transformation de l'expérience »** *(biome 3, hall)*
> Le guichet physique est remplacé par un parcours client 100 % autonome. L'autonomie est obligatoire.
> Un agent sera présent pour expliquer aux voyageurs qu'il n'est plus là.

**N° 5 — « Sourire réglementaire »** *(biome 1, Drone Optimètre)*
> Le sourire est désormais un indicateur de performance, mesuré par drone en lumens.
> Un sourire inférieur à 3 lumens fera l'objet d'un entretien bienveillant.

**N° 6 — « Locaux non répertoriés »** *(couloir technique)*
> Tout local absent des plans est considéré comme inexistant. Il est donc interdit d'y entrer, puisqu'on ne peut pas y entrer.
> Toute personne surprise dans un local inexistant sera notée absente.

**N° 7 — « Volatiles et assimilés »** *(rapportée par Matricule 4412)*
> Les pigeons de la passerelle ne disposant d'aucun titre de transport valable, ils seront verbalisés à chaque passage.
> Le recouvrement est confié à un prestataire spécialisé en volatiles insolvables.

**N° 8 — « Mission d'accompagnement Synergia »** *(biome 1, consigne)*
> Le cabinet Synergia Partners réalisera un audit des métiers du rail. Durée : 3 jours. Coût : non communiqué.
> Merci de réserver le meilleur accueil à nos consultants, qui découvriront votre métier en même temps que vous le perdrez.

**N° 9 — « Usage du micro-ondes collectif »** *(Salle des pauses, biome 1)*
> Le micro-ondes sera accessible sur réservation, par créneaux de 47 secondes, via l'application interne (bientôt disponible).
> Les soupes devront être déclarées au préalable.

**N° 10 — « Bien-être au travail »** *(biome 3, open-space)*
> Une salle de sieste « Power Nap Zone » est inaugurée au BAG. Pour des raisons de sécurité, elle restera fermée à clé.
> Les agents en 3x8 peuvent consulter sa photo sur l'intranet pendant leur pause.

**N° 11 — « Recrutement : Head of Coffee Experience »** *(casier de Jean-Mi)*
> Privatix Rail Solutions recherche un profil passionné pour piloter l'expérience café. Horaire de bureau. Badge vert.
> Contrat à durée déterminée de 3 mois, en remplacement d'une machine en panne. Évolution possible vers une machine neuve.

**N° 12 — « Gestion du temps »** *(biome 3, archives)*
> Afin d'optimiser les plannings, la nuit sera désormais comptabilisée comme une après-midi longue.
> Les heures de nuit ne donnent plus droit à la prime de nuit, mais à la prime d'après-midi longue (à l'étude).

**N° 13 — « Planification des signatures »** *(biome 3, salle Synergie)* — inédite
> La signature de la cession est reprogrammée à la fin du prochain service, faute de créneau commun au Sondage.
> Le traiteur est maintenu. Les petits fours seront congelés puis décongelés autant de fois que nécessaire.

**N° 14 — « Mobilité interne fluide »** *(biome 2, page du classeur du Fluidifieur)* — inédite
> Tout agent peut désormais être muté la veille pour le lendemain, dans un esprit de flexibilité mutuelle.
> La mutualité de la flexibilité s'entend dans un seul sens.

**N° 15 — « Politique d'accès au café »** *(rare, Wagon-Bar fantôme)* — inédite
> Le café gratuit de la salle des pauses est remplacé par des capsules premium à 3,90 €, « pour valoriser le moment café ».
> Toute cafetière non référencée sera considérée comme un local inexistant (voir Note n° 6).

### 9.2 Glossaire satirique (20 termes)

1. **3x8** — Système horaire permettant à un être humain de vivre trois vies sans en réussir aucune. On dit « bonjour » à 22h et « bonne nuit » à 6h.
2. **Roulement** — Grille mystique qui décide de ta vie sociale six semaines à l'avance. Plus fiable que l'horoscope, moins négociable que la météo.
3. **Pause** — Droit sacré, durée légale, rarement prise en entier. Unité de mesure de la dignité cheminote.
4. **Pour raison de circulation** — Formule qui couvre tout, de la panne de signal à l'invasion de sauterelles. Signifie : « Nous ne savons pas, mais nous le disons avec assurance. »
5. **Optimisation** — Suppression, prononcée avec un sourire. Coûte un Ticket dans la boîte à jurons de l'OCC.
6. **KPI** — Chiffre qui mesure tout ce qui est facile à mesurer, pour ignorer tout ce qui compte. Se reproduit par tableaux croisés.
7. **Consultant** — Personne qui vous emprunte votre montre pour vous donner l'heure, puis vous facture la montre.
8. **diaporama** — Arme de destruction massive de l'attention. Une slide = une idée ; 412 slides = aucune.
9. **Synergie** — Moment où 1 + 1 = 0,7, présenté comme 2,4.
10. **Quick win** — Victoire rapide pour celui qui la présente, défaite lente pour ceux qui la subissent.
11. **Sondage** — Outil de démocratie participative grâce auquel onze personnes ne trouvent jamais de créneau commun. Seul allié involontaire de l'OCC.
12. **Phase pilote** — Privatisation qui n'ose pas encore dire son nom. Toujours « limitée », jamais terminée.
13. **Commission de réflexion** — Endroit où l'on range les problèmes pour qu'ils mûrissent jusqu'à pourrir.
14. **Flex office** — Organisation où chacun a droit à un bureau, à condition d'arriver avant tout le monde.
15. **Externalisation** — Faire faire par quelqu'un d'autre, plus loin, moins bien, pour plus cher, mais sur une autre ligne du budget.
16. **L'autre boîte** — Entité mythique responsable de toutes les pannes, quelle que soit la boîte où l'on travaille. Hymne officiel : « C'est pas nous, c'est l'autre boîte. »
17. **Mobilité interne** — Déménagement de ta vie décidé la veille par quelqu'un qui habite à côté de son bureau.
18. **Bus de substitution** — Train qui a renoncé à ses rêves. Arrive partout, sauf à la gare.
19. **Badge vert** — Talisman de l'horaire de bureau. Ouvre les portes, ferme les yeux.
20. **Le train de 7h12** — Symbole de tout ce qui marchait très bien jusqu'à ce que quelqu'un décide de l'améliorer.

---

*Fin du document. Toute nouvelle réplique passe le test du §1.4 avant intégration. Rien à signaler, sauf tout.*
