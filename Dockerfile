# syntax=docker/dockerfile:1
# Privatix - image de production pour Coolify (privatix.fs0ciety.org).
# Builds statiques dans Node, servis par nginx. Port exposé : 80.
# Arborescence servie :
#   /        site vitrine (site/)
#   /jouer/  le jeu (dist racine : index.html Phaser classique, play3d.html Three.js)
#   /3d/     le prototype 3D (prototypes/proto3d)
# L'ancien /play3d.html redirige (301) vers /jouer/play3d.html (nginx.conf).

############################
# Étape 1 : build du jeu
############################
FROM node:22-alpine AS build
WORKDIR /app

# Dépendances d'abord (cache Docker tant que le lockfile ne change pas)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Sources puis build (typecheck + vite build)
COPY . .
RUN npm run build

############################
# Étape 1 bis : prototype 3D (Three.js)
############################
FROM node:22-alpine AS proto3d
WORKDIR /proto
COPY prototypes/proto3d/package.json prototypes/proto3d/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY prototypes/proto3d/ ./
RUN npm run build

############################
# Étape 1 ter : site vitrine
############################
FROM node:22-alpine AS site
WORKDIR /site
COPY site/package.json site/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY site/ ./
# `npm run build` écrit d'abord public/releases.json (instantané des GitHub Releases, repli du site
# quand l'API ne répond pas côté visiteur ; liste vide si l'API échoue, sans casser le build).
# SOURCE_COMMIT (fourni par Coolify) invalide le cache Docker de cette étape à chaque déploiement,
# pour que l'instantané soit repris à chaque fois. Le conteneur le rafraîchit aussi au démarrage.
ARG SOURCE_COMMIT=
RUN echo "site @ ${SOURCE_COMMIT:-local}" && npm run build

############################
# Étape 2 : service statique
############################
FROM nginx:stable-alpine AS runtime

# Configuration du site (remplace la conf par défaut)
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Rafraîchit l'instantané des releases au démarrage du conteneur (sans bloquer nginx)
COPY --chmod=755 docker/40-privatix-releases.sh /docker-entrypoint.d/40-privatix-releases.sh

# Site à la racine, jeu sous /jouer/, prototype sous /3d/
COPY --from=site /site/dist /usr/share/nginx/html
COPY --from=build /app/dist /usr/share/nginx/html/jouer
COPY --from=proto3d /proto/dist /usr/share/nginx/html/3d

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
