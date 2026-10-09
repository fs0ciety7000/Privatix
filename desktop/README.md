# Privatix Desktop (Electron)

Ce dossier emballe le build web de Privatix dans une application de bureau autonome
pour Windows, macOS et Linux. Il ne touche pas au jeu : il recopie un build Vite déjà
construit (`dist/`) et le sert dans une fenêtre Electron.

## Pourquoi Electron (et pas Tauri)

| Critère | Electron | Tauri | Neutralinojs / NW.js |
|---|---|---|---|
| Moteur de rendu | Chromium embarqué, **le même partout** | Webview système : WebView2 (Chromium) sous Windows, **WKWebView** sous macOS, **WebKitGTK** sous Linux | Neutralino : webview système, comme Tauri. NW.js : Chromium embarqué, comme Electron |
| WebGL / perf | ANGLE + GPU process Chromium, identique au Chrome de test. Flags contrôlables : `force_high_performance_gpu`, `ignore-gpu-blocklist`, `enable-gpu-rasterization`, `disable-frame-rate-limit`, `disable-gpu-vsync` | Pas de flags GPU portables. WebKitGTK : WebGL souvent lent ou désactivé selon la distribution et le pilote (rendu DMABUF, compositing). Safari/WKWebView : WebGL 2 correct mais comportement différent de Chrome | NW.js : mêmes leviers qu'Electron, mais écosystème plus petit. Neutralino : mêmes limites que Tauri |
| Poids | Environ 120 Mo (AppImage), 80 à 100 Mo (installeur Windows) | 5 à 15 Mo | Neutralino : environ 2 Mo. NW.js : comparable à Electron |
| Sécurité | Bonne si configurée : `contextIsolation`, `sandbox`, CSP, navigation bloquée (tout est fait ici). Chromium patché à chaque version mineure | Très bonne par défaut (API Rust, permissions explicites), surface plus petite | NW.js mélange Node et DOM dans le même contexte par défaut, moins sûr |
| Maintenance | JS pur, aucune toolchain native. Une majeure toutes les 8 semaines, à suivre | Toolchain Rust + dépendances système (webkit2gtk) pour builder | NW.js : peu d'outillage de packaging. Neutralino : projet plus confidentiel |

**Conclusion** : l'intuition est confirmée. Pour un jeu WebGL dont la priorité est la
fluidité, Electron l'emporte. Il embarque son Chromium, donc on obtient le même rendu
qu'en navigateur sur toutes les plateformes, et on peut forcer le GPU dédié et contourner
la blocklist GPU. Tauri serait pertinent pour une petite app sans 3D ou si la taille du
téléchargement primait. Sous Linux et macOS, son webview WebKit est justement le maillon
faible pour Three.js.

## Construire en local

Prérequis : Node 22 ou plus récent.

```bash
# 1. Construire le(s) jeu(x) web
npm run build                                  # à la racine  -> dist/
(cd prototypes/proto3d && npm ci && npm run build)   # proto 3D -> prototypes/proto3d/dist/

# 2. App de bureau
cd desktop
npm ci
npm start              # lance l'app depuis les sources
npm run start:debug    # idem avec DevTools (F12) et fps non limités
npm run pack           # dossier non packagé : dist/linux-unpacked/ (ou win-unpacked, mac)
npm run dist:linux     # AppImage : dist/Privatix-<version>-linux-x86_64.AppImage
npm run dist:win       # sous Windows : installeur NSIS + exécutable portable
npm run dist:mac       # sous macOS : .dmg x64 et arm64
npm run smoke          # test sans interface (sous Linux sans écran : xvfb-run -a npm run smoke)
```

Chaque commande `start`, `pack` ou `dist:*` exécute d'abord `assemble` : `prepare-app`, qui copie les
builds dans `desktop/app/`, puis `icon`, qui génère `build/icon.png`. Les dossiers `app/`,
`build/`, `dist/` et `node_modules/` sont ignorés par git.

On peut construire pour Windows depuis Linux, mais cela demande Wine. Pour macOS, il faut
un Mac. Le plus simple est de passer par la CI.

## Récupérer les exécutables (GitHub Actions)

Le workflow `.github/workflows/desktop.yml` se lance :
- **à la main** : onglet *Actions*, workflow *Desktop*, bouton *Run workflow*. Deux champs
  optionnels permettent de choisir le contenu embarqué (voir plus bas) ;
- **automatiquement** quand on pousse un tag `v*` (ex. `git tag v0.2.0 && git push --tags`).
  La version de l'app reprend alors celle du tag.

Une fois le run terminé, ouvre sa page et descends jusqu'à la section **Artifacts** :

| Artefact | Contenu |
|---|---|
| `privatix-desktop-windows` | `Privatix-x.y.z-setup-x64.exe` (installeur) et `Privatix-x.y.z-portable-x64.exe` (sans installation) |
| `privatix-desktop-macos` | `Privatix-x.y.z-mac-x64.dmg` (Intel) et `Privatix-x.y.z-mac-arm64.dmg` (Apple Silicon) |
| `privatix-desktop-linux` | `Privatix-x.y.z-linux-x86_64.AppImage` |

Les artefacts sont conservés 30 jours. Le job Linux lance aussi le smoke test sous écran
virtuel.

## Changer le contenu embarqué

Le fichier `content.config.json` définit ce qui est embarqué :

```json
{ "main": "../dist", "extras": { "3d": "../prototypes/proto3d/dist" } }
```

- `main` est servi à `app://game/` : c'est ce qui s'ouvre au lancement ;
- chaque entrée d'`extras` est servie à `app://game/<clé>/`.

Dans l'app, **Ctrl+1** ouvre le jeu principal et **Ctrl+2** le premier extra (ici la 3D).
L'option `--entry=3d` démarre directement sur la 3D.

Pour **faire de la 3D le jeu principal**, il suffit d'éditer `content.config.json`.
On peut aussi passer par une surcharge ponctuelle :

```bash
PRIVATIX_MAIN=../prototypes/proto3d/dist PRIVATIX_EXTRAS=none npm run dist:linux
node scripts/prepare-app.mjs --main ../prototypes/proto3d/dist --extra phaser=../dist
```

En CI, les champs *main* et *extras* du bouton *Run workflow* jouent le même rôle.
Contraintes : chaque build doit contenir un `index.html` et utiliser des chemins relatifs
(`base: './'` dans Vite, déjà le cas pour les deux projets).

## Ce que fait l'app

- **Fenêtre** 16:9 redimensionnable (80 % de l'écran au premier lancement). Taille,
  position et mode plein écran sont mémorisés. **F11** bascule le plein écran
  (Ctrl+Cmd+F sur Mac). Il n'y a pas de barre de menu.
- **Protocole `app://game/`** à la place de `file://` : chemins relatifs, `fetch()`,
  modules ES et Web Audio fonctionnent comme sur un serveur web.
- **Sauvegardes** : le `localStorage` est persistant et lié à l'origine `app://game`. Il est
  stocké dans le dossier de données de l'app (`%APPDATA%\Privatix`,
  `~/Library/Application Support/Privatix`, `~/.config/Privatix`). Les sauvegardes du site
  web ne sont pas reprises.
- **Sécurité** : `contextIsolation`, `sandbox`, `nodeIntegration` désactivé, aucun preload.
  Une CSP stricte (`script-src 'self'`, sans `eval`) est envoyée en en-tête. Toute navigation
  hors de `app://game`, les popups, les `<webview>` et toute requête http(s)/ws sortante
  sont bloqués. Seules les permissions plein écran et pointer lock sont accordées.
- **GPU** : `force_high_performance_gpu`, `ignore-gpu-blocklist`, `enable-gpu-rasterization`
  et `enable-zero-copy` sont actifs. La page n'est pas ralentie quand la fenêtre perd le
  focus, et WebGL n'est pas bloqué après un crash GPU.

### Options de lancement

| Option | Variable d'env | Effet |
|---|---|---|
| `--debug` | `PRIVATIX_DEBUG=1` | DevTools (F12, Ctrl+Shift+I), Ctrl+R, infos GPU dans le terminal |
| `--unlimited-fps` | `PRIVATIX_UNLIMITED_FPS=1` | `disable-frame-rate-limit` + `disable-gpu-vsync` (pour mesurer, pas pour jouer) |
| `--safe-gpu` | `PRIVATIX_SAFE_GPU=1` | retire les flags GPU agressifs si un pilote plante |
| `--entry=<clé>` | `PRIVATIX_ENTRY` | démarre sur un extra (`3d`) |
| `--fullscreen` / `--windowed` | | force le mode au démarrage |

Exemple sous Windows : `Privatix-portable.exe --debug --unlimited-fps`.

## « Ça lag sur la machine du boulot » (portable à double GPU)

- **macOS** : `force_high_performance_gpu` bascule réellement sur le GPU dédié.
- **Windows** : Chromium transmet la préférence haute performance, mais le pilote ou
  Windows a le dernier mot. Si besoin, va dans *Paramètres > Système > Écran > Graphiques*,
  ajoute `Privatix.exe` et choisis **Hautes performances**. Ou, sur NVIDIA : panneau NVIDIA,
  *Paramètres 3D*, *Paramètres du programme*.
- **Linux** : sur Optimus, lancer avec `prime-run` ou `DRI_PRIME=1`.
- Pour vérifier : `--debug` affiche le GPU utilisé (`[gpu] ...`). On peut aussi taper
  `chrome://gpu` dans un onglet DevTools.
- Le prototype 3D demande déjà `powerPreference: 'high-performance'` à Three.js.
- Sur un GPU intégré, Electron n'est pas magique : la marge viendra surtout du jeu
  (résolution interne ou `pixelRatio` plafonné, MSAA, post-process). Electron garantit
  seulement qu'on n'est ni bridé par la blocklist ni sur le mauvais GPU.

## Limites connues

- **Pas de signature de code.**
  - **Windows** : SmartScreen affiche « Windows a protégé votre ordinateur ». Clique sur
    *Informations complémentaires* puis *Exécuter quand même*.
  - **macOS** : Gatekeeper refuse d'ouvrir l'app (« endommagée » ou « développeur non
    identifié »). Fais clic droit, *Ouvrir*. Si ça ne suffit pas :
    `xattr -cr /Applications/Privatix.app`. Pour supprimer ces alertes, il faut un compte
    Apple Developer (signature + notarisation) et un certificat Authenticode côté Windows.
- **Linux AppImage** : sur Ubuntu 24.04 et plus, AppArmor peut bloquer le sandbox Chromium.
  Lancer avec `--no-sandbox`, ou installer un profil AppArmor. Sur certaines distributions,
  il faut aussi `libfuse2` pour exécuter une AppImage.
- **Pas de mise à jour automatique** (pas d'electron-updater) : on retélécharge chaque
  nouvelle version.
- **Taille** : environ 120 Mo, à cause du Chromium embarqué. C'est le prix de la
  constance du rendu WebGL.
- `npm audit` signale des vulnérabilités « moderate » dans la chaîne d'outils
  d'electron-builder (`sprintf-js` via `global-agent`). Elles ne servent qu'au build et
  ne sont pas embarquées dans l'app.
- Electron publie une version majeure toutes les 8 semaines et ne maintient que les trois
  dernières. Pense à monter `electron` (version épinglée dans `package.json`) au moins
  tous les 4 à 6 mois.
