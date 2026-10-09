# tools/elevenlabs — production audio avec ElevenLabs

Pipeline de génération de l'OST, des bruitages, des dialogues VF, des ambiances et des éléments du trailer, décrits dans `docs/audio/AUDIO_BIBLE.md`.

| Fichier | Rôle |
|---|---|
| `catalogue/*.mjs` | **Source unique** : voix (`voices.mjs`), répliques (`lines.mjs`), bruitages et ambiances (`sfx.mjs`), OST (`music.mjs`), trailer (`trailer.mjs`). |
| `build-manifest.mjs` | Écrit `manifest.json` et les listes de la bible (sections `AUTO`) ; `--check` vérifie qu'ils sont à jour et que chaque `SfxId` du jeu a son prompt. |
| `manifest.json` | Un asset par entrée (type, prompt, paramètres d'API, sortie, prises, post-production). **Généré : ne pas éditer à la main.** |
| `generate.mjs` | Appelle l'API, reprend sans regénérer, limite le débit, estime le coût, convertit en OGG / WebM (ffmpeg). |
| `temoins.mjs` | Lot **témoin** sans clé : extraits rendus par le moteur du jeu (synthèse), pas par ElevenLabs. |
| `integrate.md` | Plan de branchement des fichiers dans `src/audio` (chargeur d'échantillons + repli sur la synthèse). |
| `out/` | Sortie par défaut (ignorée par git). |

Prérequis : Node ≥ 22 (fetch natif, aucune dépendance), `/usr/bin/ffmpeg` (libvorbis, libopus), `unzip` (stems). Pour `temoins.mjs` : les dépendances du projet (Vite) et Playwright (Chromium).

## État (9 octobre 2026)

- **Voix arrêtées** (dans le manifeste, champ `voiceId` des assets `voice-design`, prioritaires sur `out/state/voices.json`) : Léon `Ql8Hq7echfwTF90Fec6K`, Yasmina `ROy6nWoXjRMqzkdFdAkB`, l'Invité d'honneur `BHaCuTcypMPA9jhksYPX`, Jean-Cul Lurcke `MAZdzkb78f8SA7DNBT41` (voix de bibliothèque « Nico »). Le workspace est à **3/3 voix personnalisées** : les autres voix ne peuvent pas encore être créées ; leurs répliques sont ignorées (message « Sans voix arrêtée »).
- **Déjà validés, exclus de la génération** (`status: validé`) : SFX `impact`, `whistle`, `dash`, `loot4` (generation_id dans le manifeste) et la réplique de référence de Lurcke `vo.lurcke.boss.05`.
- **Clé** : `ELEVENLABS_API_KEY` uniquement depuis l'environnement, jamais dans le dépôt. Elle arrive dans une prochaine session.
- **Aucune production en lot** avant la validation finale des répliques et des prompts par le porteur du projet.

## Démarrage

```sh
# 1. Estimer (aucun appel réseau)
node tools/elevenlabs/generate.mjs --dry-run              # production complète + rappel du lot d'écoute
node tools/elevenlabs/generate.mjs --dry-run --samples    # lot d'écoute seul

# 2. Lot d'écoute : 10 voix clés (3 aperçus chacune), 2 répliques par voix clé, 4 bruitages × 2 prises,
#    2 extraits musicaux de 20 s
export ELEVENLABS_API_KEY=…
node tools/elevenlabs/generate.mjs --samples

# 3. Choisir les voix à l'écoute des aperçus (out/voices/<voix>/apercu_1..3.mp3), puis recréer
#    celles à changer : supprimer leur entrée dans out/state/voices.json et relancer avec --pick
node tools/elevenlabs/generate.mjs --type voice-design --pick marcel=2,invite=3

# 4. Production, par lots
node tools/elevenlabs/generate.mjs --type voice-design,tts
node tools/elevenlabs/generate.mjs --only 'sfx.*'
node tools/elevenlabs/generate.mjs --only 'ost.05-*'      # mix complet puis séparation en stems
node tools/elevenlabs/generate.mjs --only 'trailer.*'
```

**Voix** : par défaut, Voice Design ne produit que les **aperçus** (aucune voix créée : le workspace est plein) ; quand un emplacement est libre, on choisit puis on relance avec `--pick voix=n --create-voices`.

## Options de `generate.mjs`

| Option | Effet |
|---|---|
| `--dry-run` | Estimation (caractères, secondes, crédits, dollars) et arrêt. |
| `--samples` | Seulement les assets `sample: true` (le lot d'écoute) ; prises réduites (`sampleTakes`). |
| `--only a,b` / `--type t` | Filtre par identifiant (préfixe avec `*` : `vo.marcel.*`) ou par type. |
| `--out dir` · `--format ogg\|webm\|both` | Dossier et format final (OGG Vorbis q5 par défaut ; WebM Opus 96 kb/s). Le MP3 brut reste dans `raw/`. |
| `--takes n` | Plafonne le nombre de prises. |
| `--concurrency n` · `--interval ms` | Débit : 2 requêtes simultanées et 600 ms entre deux départs par défaut ; 429, 409 et 5xx sont réessayés (en-tête `Retry-After`, sinon attente exponentielle, 5 essais). |
| `--tts-model id` · `--music-model id` | Force un modèle (`eleven_v4`, `eleven_multilingual_v2` ; `music_v1`, `music_v2_5`). Les balises d'émotion sont retirées pour les modèles qui ne les comprennent pas. |
| `--pick voix=n` · `--create-voices` | Choix de l'aperçu de Voice Design ; création de la voix (sinon : aperçus seuls). |
| `--include-validated` | Reprend aussi les assets `validé` (bruitages et réplique déjà retenus). |
| `--force` · `--yes` | Régénère l'existant ; supprime la pause de 5 s avant la dépense. |

Variables : `ELEVENLABS_API_KEY` (obligatoire hors `--dry-run`), `ELEVENLABS_BASE_URL` (serveur de résidence des données, ou serveur factice de test), `ELEVENLABS_VOICE_<VOIX>` (impose un `voice_id`, ex. `ELEVENLABS_VOICE_MARCEL`).

**Reprise** : un fichier final présent n'est jamais régénéré ; un MP3 brut présent est seulement reconverti ; les voix créées sont mémorisées dans `out/state/voices.json`. Relancer après une coupure reprend là où ça s'est arrêté.

## Schéma d'un asset (`manifest.json`)

```jsonc
{
  "id": "vo.marcel.hub.01",          // unique ; préfixes : voice., vo., sfx., amb., amb1., ost., trailer.
  "type": "tts",                      // voice-design | tts | sfx | music | stem-split
  "sample": true,                     // fait partie du lot d'écoute
  "voice": "marcel",                  // tts et voice-design : clé de voix
  "status": "validé",                 // facultatif : validé | bloquée (exclus) ; voice-design : sauvegardée + voiceId
  "out": "dialogues/marcel/marcel.hub.01",  // chemin de sortie sans extension (_t1, _t2… par prise)
  "takes": 2, "sampleTakes": 1,       // prises (graines différentes)
  "params": { … },                    // corps envoyé tel quel à l'API (seed incrémentée par prise)
  "post": { "loudnorm": -18, "trim": true, "radio": true },  // post-production ffmpeg
  "meta": { "ctx": "…", "emo": "…", "src": "jeu", "fictive": true }  // pour la bible et l'intégration
}
```

Post-production (`post`) : `trim` (coupe les silences), `hp` / `lp` (filtres, Hz), `peak` (normalisation en crête, dBFS), `loudnorm` (LUFS), `radio`, `pa` (haut-parleur de quai), `visio`, `room` (`wagon`, `podium`), `pitch` (demi-tons + chorus), `loop` (pas de fondu), `music` (pas de fondu ni de coupe). Types particuliers : `voice-design` (`select`, `labels`, `name`), `stem-split` (`from`, `fromTake`), `music` avec `fallback` (corps de repli si le plan de composition est refusé).

## API (vérifiée le 9 octobre 2026)

Base `https://api.elevenlabs.io`, en-tête `xi-api-key`. Documentation consultée : `elevenlabs.io/docs/api-reference/{text-to-speech/convert, text-to-voice/design, text-to-voice/create, text-to-sound-effects/convert, music/compose, music/separate-stems}.md`, `elevenlabs.io/docs/overview/models.md`, `elevenlabs.io/pricing/api`.

| Type | Requête |
|---|---|
| voice-design | `POST /v1/text-to-voice/design` (`voice_description`, `model_id` `eleven_ttv_v3`, `text` 100–1 000 car.) → 3 `previews` (`generated_voice_id`, `audio_base_64`) ; puis `POST /v1/text-to-voice` (`voice_name`, `voice_description`, `generated_voice_id`, `labels`) → `voice_id` |
| tts | `POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128` (`text`, `model_id` `eleven_v3`, `language_code` `fr`, `voice_settings`, `seed`) |
| sfx | `POST /v1/sound-generation?output_format=mp3_44100_128` (`text`, `duration_seconds` 0,5–30, `prompt_influence`, `loop`, `model_id` `eleven_text_to_sound_v2`) |
| music | `POST /v1/music?output_format=mp3_44100_128` (`prompt` + `music_length_ms` + `force_instrumental`, ou `composition_plan` ; `model_id` `music_v2`) |
| stem-split | `POST /v1/music/stem-separation` (multipart, champ `file`) → ZIP |

**Hypothèses** (à confirmer au premier appel réel) : le plan de composition `chunks` est accepté par `music_v2` (sinon repli automatique `music_v1` + prompt) ; le contenu du ZIP de stems (noms et nombre de pistes) n'est pas documenté ; le coût de Voice Design et des séparations n'est pas publié.

## Coût estimé (sortie de `--dry-run`, tarifs « pay as you go »)

| Lot | Appels | TTS | Voice Design | Bruitages | Musique | Coût |
|---|---|---|---|---|---|---|
| Lot d'écoute (tel que défini) | 40 | 1 401 car. | 6 714 car. (10 voix) | 12,4 s | 40 s | ≈ 0,80 $ (≈ 8 600 crédits hors musique) |
| Lot d'écoute faisable (4 voix arrêtées) | 24 | 474 car. | 3 903 car. (aperçus) | 12,4 s | 40 s | ≈ 0,50 $ (≈ 4 900 crédits) |
| Production avec les 4 voix arrêtées | 477 | 8 947 car. | aperçus facultatifs | 646 s | 49,4 min | ≈ 10,20 $ (≈ 34 800 crédits hors aperçus et musique) + 7 séparations |
| Production complète | 760 | 24 870 car. | 12 507 car. (19 voix) | 646 s | 49,4 min | ≈ 11,70 $ (≈ 63 200 crédits hors musique) + 7 séparations |

## Tester sans clé

Un serveur factice qui répond du MP3 (et du JSON pour Voice Design) suffit : `ELEVENLABS_API_KEY=x ELEVENLABS_BASE_URL=http://127.0.0.1:<port> node tools/elevenlabs/generate.mjs --samples --yes --out /tmp/essai`. Le lot témoin synthétique : `node tools/elevenlabs/temoins.mjs <dossier>`.
