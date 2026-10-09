# syntax=docker/dockerfile:1
# Privatix - image de production pour Coolify (privatix.fs0ciety.org).
# Build statique dans Node, servi par nginx. Port exposé : 80.
# Le jeu est servi à la racine, le prototype 3D (prototypes/proto3d) sous /3d/.

############################
# Étape 1 : build
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
# Étape 2 : service statique
############################
FROM nginx:stable-alpine AS runtime

# Configuration du site (remplace la conf par défaut)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Fichiers du jeu
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=proto3d /proto/dist /usr/share/nginx/html/3d

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
