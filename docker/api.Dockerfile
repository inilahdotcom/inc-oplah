# ---- Install dependencies (Bun: monorepo memakai protokol workspace:* yang tidak dikenal npm) ----
FROM oven/bun:1.3.14 AS install
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# --ignore-scripts: runtime JS Bun crash (SIGILL, "CPU lacks AVX support") di agent Jenkins
# saat menjalankan postinstall. Bun hanya mengunduh paket; script yang dibutuhkan
# (binding native bcrypt) dijalankan dengan Node di tahap berikut. Puppeteer memakai
# Chromium sistem, jadi postinstall-nya memang tidak perlu.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --filter api --ignore-scripts

# ---- Runtime Node ----
FROM node:22-bookworm-slim

# Chromium sistem untuk render PDF (puppeteer tidak mengunduh browser sendiri).
# Dipecah per kelompok paket supaya tiap layer < 100 MB: registry hb.inilahtv.com
# berada di belakang Cloudflare yang menolak upload > 100 MB per request (413).
# Paket chromium sendiri tetap ~120 MB gzip, jadi Jenkinsfile mem-push image ini
# dengan kompresi zstd (~96 MB, dicek 2026-09-29).
RUN apt-get update && apt-get install -y --no-install-recommends fonts-liberation fonts-noto-core openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y --no-install-recommends libgl1-mesa-dri && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y --no-install-recommends libgtk-3-0 && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y --no-install-recommends chromium-common \
     $(apt-cache depends chromium | awk '/Depends:/{print $2}' | grep -v -E '^<|^chromium$') \
  && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y --no-install-recommends chromium && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY --from=install /app ./
COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /app/apps/api
# Pengganti postinstall bcrypt yang dilewati --ignore-scripts.
RUN cd "$(readlink -f node_modules/bcrypt)" \
    && node ../@mapbox/node-pre-gyp/bin/node-pre-gyp install --fallback-to-build
RUN node_modules/.bin/prisma generate

EXPOSE 4000
# Terapkan migrasi ke DB eksternal, lalu jalankan server.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node_modules/.bin/tsx src/server.ts"]
