# Privatix : jeu (Phaser) servi à la racine, prototype 3D (Three.js) sous /3d/.
# Build statique en deux étapes Node, puis nginx non root.

FROM node:22-alpine AS game
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS proto3d
WORKDIR /proto
COPY prototypes/proto3d/package.json prototypes/proto3d/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY prototypes/proto3d/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=game /app/dist /usr/share/nginx/html
COPY --from=proto3d /proto/dist /usr/share/nginx/html/3d
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
