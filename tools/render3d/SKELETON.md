# Contrat de squelette des GLB (v1)

Ce contrat fixe ce que le jeu peut supposer de **tout** GLB produit par `export_glb.py` : repère,
noms d'os, sockets, matériaux, attributs et clips. L'interface `ActorView` du jeu s'appuie dessus.
Tout changement de nom d'os ou de socket est un **changement cassant** : il faut alors incrémenter
`version` dans `public/models/manifest.json`.

## 1. Repère, échelle, pivot

| Règle | Valeur |
|---|---|
| Unité | **1 unité = 1 m**. Le gameplay compte 30 px = 1 m (`PX_PER_UNIT = 30`, cf. `balance.ts`) : une distance `d` en px vaut `d / 30` unités. |
| Axe vertical | **+Y** (glTF / Three.js). |
| Avant du personnage | **+Z**. C'est la convention de Three.js (`Object3D.lookAt` oriente le +Z d'un objet vers la cible) et celle du prototype : `root.rotation.y = Math.atan2(dx, dz)` regarde vers `(dx, dz)`. |
| Droite du personnage | **−X** (sa gauche est en +X). Les os `_L` sont en +X, les os `_R` en −X. |
| Pivot | **Aux pieds** : l'origine de la scène et l'os `root` sont au sol, au centre de l'appui. |
| Orientation de repos des os | **Identité pour tous les os** (sockets compris) : le repère local de chaque os est celui du personnage. Un objet accroché à un socket garde donc l'orientation du personnage au repos. |

Les hauteurs de référence sont dans le manifeste (`height`, `radius`) : héros 2,0 m casque compris,
consultant 1,75 m, Di Rupo 2,6 m, Lurcke 2,8 m, Discosaure 3,6 m (5,5 m de long), furet 0,9 m (2,6 m de long).

## 2. Os standard des humanoïdes (18)

Héros, consultant, Di Rupo, et plus tard manager et PNJ, partagent ces noms : une pose ou un clip écrit
pour l'un s'applique aux autres, et un vêtement skinné se lie à n'importe lequel.

| Os | Parent | Équivalent courant | Rôle |
|---|---|---|---|
| `root` | — | root | Pieds. Porte la translation et l'échelle du corps (squash & stretch autour des pieds). |
| `pelvis` | `root` | hips | Bassin |
| `spine` | `pelvis` | spine | Ventre |
| `chest` | `spine` | chest / spine2 | Torse |
| `neck` | `chest` | neck | Cou |
| `head` | `neck` | head | Tête |
| `shoulder_L` / `shoulder_R` | `chest` | upperarm | Épaule + bras |
| `elbow_L` / `elbow_R` | `shoulder_*` | forearm | Avant-bras |
| `hand_L` / `hand_R` | `elbow_*` | hand | Main |
| `hip_L` / `hip_R` | `pelvis` | thigh | Cuisse |
| `knee_L` / `knee_R` | `hip_*` | calf | Mollet |
| `foot_L` / `foot_R` | `knee_*` | foot | Pied |

**Chaînes optionnelles** (os secondaires, toujours sous ces noms) : `scarf0..3` (écharpe du héros, sous `neck`),
`tie0..1` (cravate), `laptop` → `lid` (consultant), `jaw`, `brow_L/R`, `hair_front0..2` (mèche en chaîne),
`glasses`, `bowtie` (Di Rupo).

**Convention de pose** (sources Python `glb/chars/*.py`, comme `prototypes/proto3d/src/rig.ts`) : Euler
**YXZ** en degrés, dans le repère du personnage. Membre pendant : `x < 0` le porte vers l'avant, `z > 0` l'écarte
vers +X. Tronc et tête : `x > 0` penche vers l'avant, `y` tourne sur soi vers sa gauche.

## 3. Sockets d'équipement et de VFX

Les sockets sont des **os sans déformation** (`use_deform = False`), exportés comme nœuds du squelette. Ils
suivent l'animation. Positions données pour le héros, dans le repère de leur parent :

| Socket | Parent | Position | Usage |
|---|---|---|---|
| `socket_head` | `head` | (0, 0,25, 0) : bord du casque | Casques, casquette, lampe frontale (la lumière du jeu s'y accroche) |
| `socket_weapon_R` | `hand_R` | (0, 0, 0) : centre de la poigne | Outil principal (clé, masse, pince). Le manche part vers **+Z** |
| `socket_weapon_L` | `hand_L` | (0, 0, 0) | Objet en main gauche (lanterne, bouclier) |
| `socket_back` | `chest` | (0, 0,12, −0,22) | Dos : radio, thermos, sac |
| `socket_hip` | `pelvis` | (−0,24, 0, 0,02) : hanche droite | Ceinture : gobelet, sifflet |
| `socket_chest` | `chest` | (0, 0,12, 0,2) | Badges, écussons de rareté |
| `socket_vfx` | `chest` | (0, 0,05, 0) | Centre des VFX (étincelles d'impact, aura) |
| `socket_glove_L` / `socket_glove_R` | `hand_*` | (0, −0,04, 0) | Gants, manchettes |
| `socket_foot_L` / `socket_foot_R` | `foot_*` | (0, 0, 0) | Chaussures (deux demi-meshes) |

Le **gilet** n'utilise pas de socket : c'est un maillage skinné sur les mêmes os (voir § 5).

Sockets des autres modèles : Discosaure `socket_vfx` (centre de la boule), `socket_head`, `socket_jaw` ;
furet `socket_vfx`, `socket_head`, `socket_tail` (nuage de la bouffée), `socket_back` ; Di Rupo, en plus des
sockets humanoïdes, `socket_bowtie` et `socket_glasses` (éclat des lunettes) ; borne `socket_vfx`,
`socket_muzzle` (fente à tickets) ; drone `socket_vfx`, `socket_muzzle` (objectif).

## 4. Squelettes non humanoïdes

| Modèle | Os (hors sockets) |
|---|---|
| Discosaure (24) | `root`, `pelvis`, `chest`, `neck`, `head`, `jaw`, `hip/knee/ankle/toe_L/R`, `arm/fore_L/R`, `tail0..4`, `disco_ball` |
| Furet putride (31) | `root`, `spine0..6` (des hanches vers les épaules), `neck0..1`, `head`, `jaw`, `ear_L/R`, `tail0..4`, et pour `FL`, `FR`, `BL`, `BR` : `<patte>0`, `<patte>1`, `paw_<patte>` |
| Borne (7) | `root`, `body`, `head`, `slot`, `ticket`, `trap_L/R` (trappe au sol) |
| Drone (10) | `root`, `hover`, `body`, `eye`, `tape0..1`, `rotor_FL/FR/BL/BR` |
| Auditeur (20) | `root`, `pelvis`, `chest`, `hip/knee/foot_L/R`, `arm_L/R` (balayage, Y), `boom_L/R` (barrière, Z), `plate_L/R` (blindage, échelle 0 en phase 2), `cockpit`, `pilot`, `pilot_head`, `parm_L/R` ; sockets `socket_vfx`, `socket_screen`, `socket_pilot`, `socket_tip_L/R`, `socket_slot_L/R`, `socket_foot_L/R` |

Humanoïdes ajoutés (18 os du contrat + os secondaires) : manager (`tie0`, `chrono`, `tablet`, `glasses` ; sockets `socket_chrono`, `socket_tablet`), Fluidifieur (`chair`, `binder`, `lanyard` ; `socket_binder`), PNJ (`prop`, `prop_L`), Lurcke (`jaw`, `brow_L/R`, `glasses`, `earpiece`, `tie0..1`, `pen`, `binder` ; sockets `socket_glasses`, `socket_pen` (bec du stylo), `socket_tie` (bout de la cravate-fouet), `socket_binder`).

**Os pilotés à l'exécution** (`runtimeBones` dans le manifeste) : `disco_ball` et `rotor_*` ne sont **pas**
animés par les clips. Le jeu les fait tourner autour de Y (vitesse liée à l'état : la boule accélère pendant la
« piste de danse »). Retirer leurs pistes des clips n'est pas nécessaire : elles n'existent pas.

## 5. Maillage, matériaux, attributs

- **Un `SkinnedMesh` par personnage**, rigide par os : chaque pièce est pondérée à 100 % sur un seul os.
  Seule exception documentée : le corps et le cou du furet, et la mèche de Di Rupo, sont des tubes à poids
  répartis entre os voisins, pour une ondulation lisse.
- **Une primitive par type de matériau**, donc 1 à 3 appels de rendu, plus 1 pour le contour. Le jeu remplace
  les matériaux **d'après leur nom** :

| Nom | Shader côté jeu | `COLOR_0.rgb` | `COLOR_0.a` |
|---|---|---|---|
| `toon` | Toon à rampe 4 marches + liseré + flash (cf. `viewer/src/toon.js`) | couleur de base (linéaire) | part émissive (0 à 1, × 2,2) |
| `glow` | Émissif pur (non éclairé, bloom) | couleur | **masque télégraphe** : 1 = passe au magenta quand `uTelegraph > 0` (écran du laptop, écran de borne, LED) |
| `mirror` | Boule à facettes (reflets procéduraux en 3 tons, scintillement) | gris = **identifiant de facette** (0 à 1) | — |
| `glass` | Verre fresnel transparent (lunettes) | teinte | intensité du reflet en diagonale |

- **Attribut `_OUTLINE`** (vec3, lu par `GLTFLoader` sous le nom `_outline`) : normale lissée par pièce
  (sommets confondus moyennés, donc pas de trou aux arêtes vives) × largeur relative. `0` = pas de contour
  (décors fins : bandes, yeux, boutons). La coque inversée l'extrude en espace écran. Il est skinné comme
  `normal` (`objectNormal = _outline` avant `skinnormal_vertex`).
- **Couleurs du contour** dans le manifeste (`outline`) : `#14101A` pour le héros, `#06302C` pour les ennemis,
  magenta pendant un télégraphe (uniforme `uTelegraph`).
- Pas de texture, pas d'UV, pas de photo. Les GLB sont compressés en meshopt (`EXT_meshopt_compression` +
  `KHR_mesh_quantization`) : il faut `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)`.

## 6. Équipement

- **Rigide** (casques, outils) : `public/models/items/<objet>.glb`, mesh statique dont l'**origine est le
  socket** (`meta.socket` dans le manifeste). Accroche : `actor.getObjectByName(it.socket).add(item.scene)`.
  Les outils ont un nœud vide **`tip`** (bout de l'arme) pour la traînée et la hitbox visuelle.
- **Skinné** (gilets, `skinned: true`) : le GLB contient une armature aux **mêmes noms d'os** que le héros.
  Liaison au squelette du héros :

```ts
const src = SkeletonUtils.clone(vestGltf.scene);
src.traverse((o) => {
  if (!(o as THREE.SkinnedMesh).isSkinnedMesh) return;
  const m = o as THREE.SkinnedMesh;
  const bones = m.skeleton.bones.map((b) => hero.getObjectByName(b.name) as THREE.Bone);
  heroSkinnedMesh.parent!.add(m);                       // même parent que le corps
  m.bind(new THREE.Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix);
});
```

  On garde les `boneInverses` **du gilet** : la quantification meshopt y est intégrée.
- Le corps du héros est exporté **sans** casque, gilet ni outil (t-shirt et cheveux sous les pièces).
- Rareté (`rarity` 1 à 5) : variantes de forme ici ; les variantes de matériau (liseré, lueur) restent des
  uniformes du shader d'équipement (art_director § 3.3).

## 7. Clips

| Règle | Valeur |
|---|---|
| Noms | minuscules, mots séparés par `-` : `idle`, `run`, `walk`, `dash`, `hurt`, `death`, `spawn`, `stagger`, `attack1..3` (combo), `attack-<nom>` (attaque nommée : `attack-stomp`, `attack-bite`, `attack-bowtie`…), `<nom>-windup` si l'armé est séparé (`charge-windup`), états spéciaux (`war-dance`, `burrow`, `intro`, `defeat`, `fly`). |
| Directions | **Aucune** : pas de `_down/_up/_side`. Le jeu oriente le modèle (`root.rotation.y`). |
| Échantillonnage | 30 i/s, toutes les pistes de rotation des os (TRS du `root`), interpolation linéaire. |
| Boucle | `loop: true` dans le manifeste (`idle`, `run`, `walk`, `charge`, `stagger`, `war-dance`, `fly`) : première et dernière clé identiques. Les autres : `LoopOnce` + `clampWhenFinished`. |
| Durée | Nominale (issue des timings du prototype et du GDD). Le jeu **remet à l'échelle** sur `balance.ts` : `action.timeScale = clip.duration * 1000 / durationMs`. L'animation suit les timings, jamais l'inverse. |
| Événements | `clips.<nom>.events` dans le manifeste, en **ms depuis le début du clip** : `windup` (début du télégraphe), `active` (frame qui frappe), `recovery`, `land`, `glint` (éclat des lunettes), `hidden` (furet sous terre), `iframes_end`. |
| Déplacement | Sur place : la sim fait foi pour les déplacements. Les clips gardent seulement un petit décalage du `root` (≤ 0,35 m : fente d'attaque, recul de coup). Les morts d'animaux peuvent décaler le corps couché. |
| Visibilité | glTF n'anime pas la visibilité : une pièce qui disparaît est mise à l'échelle 0 (`bowtie` lancé en boomerang). |

## 8. Manifeste `public/models/manifest.json`

Par personnage : `file`, `kind` (`hero`, `enemy`, `elite`, `boss`), `height`, `radius`, `outline`, `rim`, `bones`,
`sockets`, `runtimeBones`, `triangles`, `clips` (durée, boucle, événements), `bytes` (compressé),
`bytesRaw` et `compression`. Par objet : `file`, `slot`, `socket` ou `skinned`, `tip`, `rarity`, `triangles`.
