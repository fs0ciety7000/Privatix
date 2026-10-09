#!/bin/sh
# Rafraîchit /releases.json (instantané des GitHub Releases, repli du site vitrine) au démarrage du
# conteneur, en arrière-plan : nginx démarre sans attendre. En cas d'échec (réseau, limite de taux),
# l'instantané écrit au build reste en place. Le client normalise le JSON brut de l'API.
TARGET=/usr/share/nginx/html/releases.json
API="https://api.github.com/repos/fs0ciety7000/Privatix/releases?per_page=10"
(
  TMP="$(mktemp)" || exit 0
  if wget -q -T 10 -U privatix-site -O "$TMP" "$API" 2>/dev/null && head -c 1 "$TMP" | grep -q '\['; then
    chmod 644 "$TMP" && mv "$TMP" "$TARGET" && echo "[privatix] releases.json rafraîchi"
  else
    rm -f "$TMP"
    echo "[privatix] API GitHub injoignable : instantané du build conservé"
  fi
) &
exit 0
