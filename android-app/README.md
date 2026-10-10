# Privatix Android (tablette, Capacitor)

Ce dossier emballe le jeu web 3D (`play3d.html`) dans une application Android pensée pour
tablette en paysage. Comme `desktop/`, il ne touche pas au jeu : il recopie le build Vite déjà
construit (`dist/`) et le sert dans la WebView système via [Capacitor](https://capacitorjs.com) 8.

Le dossier s'appelle `android-app/` (et pas `mobile/`) : il ne produit qu'Android, le jeu tourne
déjà sur téléphone dans le navigateur, et le nom fait pendant à `desktop/`.

## Contenu

| Chemin | Rôle |
|---|---|
| `capacitor.config.json` | appId `org.fs0ciety.privatix`, nom « Privatix », webDir `www/`, schéma `https://localhost` |
| `scripts/prepare-web.mjs` | remplit `www/` depuis `../dist` : `play3d.html` devient `index.html` ; la version 2D Phaser (bundle `main`, chunk `phaser`, `assets/`) n'est pas embarquée |
| `scripts/make-resources.mjs` | régénère icônes adaptatives et splash depuis `docs/marketing/officiel/logo/icone/` (ImageMagick) |
| `android/` | projet Gradle généré par `cap add android`, versionné ; `build/`, `app/src/main/assets/public/` et `capacitor-cordova-android-plugins/` sont régénérés et ignorés |
| `android/app/src/main/java/.../MainActivity.java` | plein écran immersif, écran maintenu allumé, bouton retour = Échap |
| `android/app/build.gradle` | versionName / versionCode dérivés de la version, signature lue depuis l'environnement |

`www/` et `node_modules/` sont ignorés par git.

## Construire en local

Prérequis : Node 22+, JDK 21, SDK Android avec `platforms;android-36` et `build-tools;36.0.0`
(Android Studio, ou les *command-line tools* et `sdkmanager`). Indiquer le SDK par `ANDROID_HOME`
ou `android/local.properties` (`sdk.dir=/chemin/du/sdk`, fichier non versionné).

```bash
npm ci && npm run build          # à la racine : le jeu web -> dist/
cd android-app
npm ci
npm run sync                     # prepare-web (dist -> www) + cap sync android
npm run apk:debug                # android/app/build/outputs/apk/debug/app-debug.apk (clé de debug locale)
npm run apk:release              # .../apk/release/app-release-unsigned.apk, ou app-release.apk si signé
npm run open                     # ouvre le projet dans Android Studio
```

Le premier build télécharge Gradle 8.14 et les dépendances Maven (Google, Maven Central). Un
APK de debug s'installe pour tester, mais ne peut pas être mis à jour par l'APK de release (clés
différentes) : désinstaller entre les deux, ce qui efface la sauvegarde.

### Version

`versionName` = version de `android-app/package.json` (la CI la fixe avec `npm version`, comme
pour `desktop/`), surchargeable par `-PprivatixVersion=1.2.3` ou `PRIVATIX_VERSION`.
`versionCode` = majeur × 10000 + mineur × 100 + correctif (0.2.0 → 200, 1.2.3 → 10203). Mineur et
correctif doivent rester sous 100. Android refuse d'installer une version dont le `versionCode`
est inférieur à celui déjà installé.

## Signature

Une application Android est identifiée par son appId **et** sa clé de signature : toutes les
mises à jour doivent être signées par la même clé, sinon Android refuse de les installer par-dessus
(il faut désinstaller, ce qui efface la sauvegarde). La clé de release doit donc être unique,
conservée hors du dépôt, et sauvegardée.

Créer la clé (une seule fois, sur une machine de confiance) :

```bash
keytool -genkeypair -v -keystore privatix-release.jks -storetype PKCS12 \
  -alias privatix -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Privatix, O=OCC MONS Studios, C=BE"
base64 -w0 privatix-release.jks > privatix-release.jks.b64   # macOS : base64 -i privatix-release.jks
```

Secrets GitHub (*Settings* → *Secrets and variables* → *Actions*) :

| Secret | Valeur |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contenu de `privatix-release.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | `privatix` (l'alias choisi) |
| `ANDROID_KEY_PASSWORD` | mot de passe de la clé (identique au précédent pour un PKCS12) |

En local, Gradle lit `ANDROID_KEYSTORE_FILE` (chemin du `.jks`), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` et `ANDROID_KEY_PASSWORD`. Sans `ANDROID_KEYSTORE_FILE`, `assembleRelease`
produit un APK non signé ; avec `PRIVATIX_REQUIRE_SIGNING=1` (posé par la CI), l'absence d'une
variable fait échouer le build au lieu de produire un APK signé par une autre clé.

## CI (job `android` de `.github/workflows/desktop.yml`)

Même déclencheur que le bureau (tag `v*` ou *Run workflow* avec `version`). Le job vérifie les
secrets, construit le jeu, synchronise Capacitor, lance `assembleRelease`, vérifie l'APK
(`aapt dump badging`, `apksigner verify`) et le publie sous deux noms dans la même release :
`Privatix-x.y.z-android.apk` et le nom stable `Privatix-Android.apk`
(`releases/latest/download/Privatix-Android.apk`). `SHA256SUMS.txt` et l'attestation de
provenance couvrent l'APK.

- **Release** (tag ou `version`) : secrets absents → le job échoue avec un message explicite, et la
  release entière n'est pas créée (le job `release` attend `build` et `android`).
- **Run sans version** : sans secrets, un APK non signé (`Privatix-x.y.z-android-unsigned.apk`) est
  produit comme simple artefact de test ; il n'est jamais publié, et le site l'ignore.

## Installer sur une tablette

1. Télécharger `Privatix-Android.apk` sur la tablette (site, page GitHub Releases) ou le copier.
2. L'ouvrir : Android propose d'autoriser l'installation d'applications inconnues pour le
   navigateur ou le gestionnaire de fichiers (*Paramètres* → *Applications* → *Accès spécial* →
   *Installer des applications inconnues*). Autoriser cette source, revenir, *Installer*.
3. Play Protect peut avertir d'une application inconnue : *Plus d'infos* → *Installer quand même*.

Depuis un ordinateur : `adb install -r Privatix-Android.apk` (débogage USB activé). Vérifier
l'empreinte : `sha256sum Privatix-Android.apk`, à comparer avec `SHA256SUMS.txt`.

## Ce que fait l'app

- **Paysage verrouillé** (`sensorLandscape`, les deux sens) et `resizeableActivity` pour le
  multi-fenêtre. `android:appCategory="game"` : sur Android 16+, les jeux restent exemptés de
  l'obligation d'accepter toutes les orientations sur grand écran.
- **Plein écran immersif** : barres système masquées ; un glissement depuis le bord les fait
  réapparaître un instant. Dessin sous l'encoche (`shortEdges`).
- **Écran maintenu allumé** tant que le jeu est au premier plan.
- **Bouton / geste retour** : transmis au jeu comme la touche Échap (pause, fermeture d'un menu)
  au lieu de quitter en pleine partie. On quitte par le bouton d'accueil.
- **Commandes tactiles** : celles du jeu web (joystick à gauche, boutons à droite), agrandies de
  25 % sur grand écran (≥ 1000 × 700 px CSS) ; les raccourcis clavier de l'écran titre sont masqués
  sur écran tactile. Un clavier ou une manette Bluetooth fonctionnent aussi.
- **Audio** : la WebView de Capacitor autorise la lecture sans geste
  (`setMediaPlaybackRequiresUserGesture(false)`) ; le jeu attend de toute façon le premier toucher
  pour démarrer son `AudioContext`. La musique (WebM/OGG via `HTMLAudioElement`) est servie par le
  serveur local de Capacitor, qui gère les requêtes `Range` ; les médias sont stockés non
  compressés dans l'APK.
- **Sauvegarde** : `localStorage` de l'origine `https://localhost`, dans les données de l'app.
  Elle survit aux mises à jour, est effacée à la désinstallation, et n'est pas partagée avec le
  navigateur. Ne pas changer `appId`, `server.hostname` ni `server.androidScheme` : l'origine
  changerait et la sauvegarde serait perdue. `allowBackup` laisse Android la restaurer sur un
  nouvel appareil.
- **Aucune requête réseau externe** : tout le jeu (≈ 28 Mo : GLB, audio, bundle) est dans l'APK.

## Mettre à jour Capacitor ou régénérer le projet

`npx cap sync android` suffit après un changement de `capacitor.config.json` ou du jeu. Le projet
`android/` est versionné et modifié à la main (manifeste, thème, `MainActivity`, `build.gradle`) :
en cas de régénération (`rm -rf android && npx cap add android`), reporter ces modifications puis
relancer `npm run resources` pour les icônes.

## Limites connues

- **Poids** : APK de release ≈ 29 Mo (debug ≈ 35 Mo). Pas encore d'AAB ni de Play Store.
- **Performance** : dépend de la WebView système (*Android System WebView*, mise à jour par le
  Play Store) et du GPU. Le jeu choisit la qualité « moyen » sur écran tactile ; le menu Options
  permet « bas » sur les tablettes d'entrée de gamme. WebGL 2 (OpenGL ES 3.0) est exigé : le
  manifeste le déclare.
- **Android 7 minimum** (minSdk 24), cible Android 16 (targetSdk 36, au-dessus du minimum exigé
  par Google Play). Sans WebView récente (Chrome 100+ conseillé), le jeu peut refuser de démarrer.
- **Téléphones** : l'APK s'y installe et fonctionne en paysage, mais l'interface est réglée pour
  tablette ; sur téléphone, le navigateur reste conseillé.
- Le bouton retour ne quitte pas l'app (choix de jeu) ; la mise en arrière-plan coupe le son via
  l'API Page Visibility du jeu.
