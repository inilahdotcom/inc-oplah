# ---- Install dependencies (Bun: monorepo memakai protokol workspace:* yang tidak dikenal npm) ----
FROM oven/bun:1.3.14 AS install
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --filter web --ignore-scripts

# ---- Build dengan Node (image glibc, cocok dengan binding native hasil install) ----
FROM node:22-slim AS build
WORKDIR /app
COPY --from=install /app ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# API diakses same-origin lewat proxy nginx, jadi cookie refresh tetap first-party.
ENV VITE_API_BASE_URL=/api/v1
WORKDIR /app/apps/web
RUN node_modules/.bin/tsc -b && node_modules/.bin/vite build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
