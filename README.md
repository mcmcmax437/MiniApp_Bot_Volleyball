# Volleyball Bot

A Telegram Mini App for organizing volleyball games: see available places, spots, timings, and who's hosting — all in one place. Replaces scattered group chats with a uniform, structured schedule.

## Stack

- **Backend** — NestJS (TypeScript) + Prisma + MySQL
- **Bot** — grammY (Telegram Bot API)
- **Mini App** — React + Vite + `@telegram-apps/sdk`
- **Scheduler** — `@nestjs/schedule` cron for user-configurable reminders
- **Deploy** — Docker Compose on a single VPS

## Project layout

```
apps/
  api/         NestJS service (REST API + bot + scheduler)
  mini-app/    React Telegram Mini App
prisma/        Prisma schema, migrations, seed
docker/        docker-compose.yml, Dockerfiles
```

## Quickstart (local)

1. Copy env: `cp .env.example .env` and fill `BOT_TOKEN` from `@BotFather`.
2. Bring everything up: `docker compose -f docker/docker-compose.yml up -d`.
3. Apply migrations and seed:
   ```bash
   npm install
   npm run prisma:migrate
   npm run prisma:seed
   ```
4. Open the API at `http://localhost:3000/api/v1/healthz`.

## Dev mode (no Docker)

```bash
# Terminal 1
npm run dev:api

# Terminal 2
npm run dev:web
```

Then visit the Mini App via the Telegram bot (`/start` in your bot chat).

## Deploy to a VPS

1. SSH into your VPS (Ubuntu 22.04+ recommended).
2. Install Docker + Docker Compose plugin.
3. Clone the repo, copy `.env.example` to `.env`, set `BOT_TOKEN`, `WEBAPP_URL`, `JWT_SECRET`, `DATABASE_URL`.
4. `docker compose -f docker/docker-compose.yml up -d --build`
5. Behind a reverse proxy (nginx/Caddy), point your domain at ports `80` (web) and `3000` (api) — or expose both via the proxy with path-based routing.
6. Register the Mini App URL with `@BotFather` (`/setdomain` and `/newapp`).

## Features (v1)

- Create, browse, join, leave volleyball games
- Map + list of venues (admin-curated + community submissions, auto-publish)
- Player profile with age, skill level, and city
- Skill-level matching
- Simple equal-split cost display
- User-configurable reminder offsets (default 24h + 2h + 30min)
