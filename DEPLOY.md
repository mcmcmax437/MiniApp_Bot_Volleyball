# Volleyball Mini App — deployment

A Telegram Mini App for scheduling volleyball games. The API (NestJS) runs under
**PM2** on a bare Ubuntu VPS (no Docker). nginx serves the built SPA and
reverse-proxies `/api/*` to the API process. MySQL is the system service.

## Stack on the VPS

- **API + Bot**: NestJS compiled to `apps/api/dist`, started by PM2 as `volleyball-api` (the Telegram bot runs in the same process via `TelegramSender.onModuleInit`).
- **Mini App**: Vite-built static SPA, served by nginx from `apps/mini-app/dist`.
- **Reverse proxy**: nginx proxies `/api/*` → `127.0.0.1:4017` and serves the SPA at `/`. (Port 4017 — chosen to never collide with anything else. The taxi project on this VPS uses 3000.)
- **DB**: MySQL 8 (`volleyball` database, `volley` user).

## 1. Configure environment

```bash
cp .env.example .env
# then edit .env and fill in:
#   BOT_TOKEN          (from @BotFather)
#   JWT_SECRET         (openssl rand -hex 32)
#   DOMAIN             (e.g. volleyball.example.com)
#   PUBLIC_URL         (https://DOMAIN)
#   WEBAPP_URL         (= PUBLIC_URL)
#   CORS_ORIGINS       (= PUBLIC_URL)
#   VPS_MYSQL_*        (optional override for production DB credentials)
```

## 2. One-time server setup

On the VPS, install Node 20, MySQL, nginx, PM2, and git:

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install ca-certificates curl gnupg ufw nginx mysql-server git

# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs

# PM2 globally
sudo npm i -g pm2
```

Open the firewall:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 3. Clone the repo on the VPS

Use the bootstrap script. It clones the repo and runs the first build in one shot:

```bash
ssh vps
sudo mkdir -p /usr/src/volleyball_miniApp
sudo chown $USER /usr/src/volleyball_miniApp
bash -c "$(curl -fsSL https://raw.githubusercontent.com/mcmcmax437/MiniApp_Bot_Volleyball/main/scripts/vps-git-bootstrap.sh)"
```

> The script keeps an existing `.env` if one is present, but on a fresh VPS
> you'll need to create `/usr/src/volleyball_miniApp/MiniApp_Bot_Volleyball/.env`
> by hand (copy the one from your local machine) before the first deploy will
> succeed.

## 4. Create the MySQL user + database on the VPS (one-time)

This is the **only** step the CI/CD pipeline doesn't do — and it only needs to be run **once** per server (or when you change `VPS_MYSQL_*` credentials).

It uses the **same SSH key** the GitHub Action uses, plus `sudo mysql`, so you don't need the MySQL root password — `sudo` uses your Linux password.

```powershell
npm run deploy:vps -- setup
```

That command (`scripts/deploy-vps.mjs setup`) SSHes into your VPS, renders `deploy/mysql-init.sql.template` with your local `.env` values, and runs it via `sudo mysql`. It creates the `volleyball` database, the `volley` MySQL user, and grants `ALL` on the `volleyball` database only — so other apps on the same VPS (`taxi`, `medstuff_db`, …) are completely isolated.

If you ever change `VPS_MYSQL_PASSWORD` in `.env`, re-run `npm run deploy:vps -- setup` — the SQL template uses `CREATE USER IF NOT EXISTS` and `ALTER USER`, so it's safe to run multiple times.

> **Why does this step need to be manual?** It needs `sudo mysql` on the VPS, and we'd rather not put the MySQL root password into a GitHub secret. The deploy pipeline only needs to talk to MySQL *as the `volley` app user*, not as root.

## 5. Configure GitHub deploy (Option A — recommended)

**Normal workflow:** commit → `git push` → GitHub Actions SSHs to the VPS → `git pull` → build → PM2 restart.

1. On the VPS, make sure your public SSH key is in `~/.ssh/authorized_keys`. The Actions workflow reuses that key.

2. In the GitHub repo → **Settings → Secrets and variables → Actions**, add exactly **three** secrets (no more, no less):

   | Secret | Example |
   |--------|---------|
   | `VPS_HOST` | `173.242.52.16` |
   | `VPS_USER` | the user that owns `/usr/src/...` (e.g. `root` or your sudo user) |
   | `VPS_SSH_PRIVATE_KEY` | contents of the **private** key (the one matching the public key in the VPS's `~/.ssh/authorized_keys`) |

3. Push to `main`. The workflow `.github/workflows/deploy.yml` runs `scripts/vps-update.sh` on the server. Every deploy runs `prisma migrate deploy` (which creates/updates **tables** inside the existing `volleyball` database). Schema changes you push to GitHub show up on the server with zero manual work.

## 6. Configure nginx + HTTPS (Option A2 — manual from PC)

If you'd rather drive the deploy from your local machine, or you want to set up
nginx + SSL before the first push:

```bash
npm run deploy:vps         # upload + build (no nginx / no domain check)
npm run deploy:vps -- ssl  # configure nginx + Let's Encrypt cert
```

| Command | Purpose |
|---------|---------|
| `git push origin main` | **Preferred** — triggers GitHub deploy (see §4) |
| `npm run deploy:vps` | Manual fallback (tar upload from PC) |
| `npm run deploy:vps -- setup` | MySQL user + app directory only (first-time) |
| `npm run deploy:vps -- app` | Sync + build + PM2 (no nginx, no domain check) |
| `npm run deploy:vps -- nginx` | Refresh nginx site config |
| `npm run deploy:vps -- ssl` | Configure nginx + Let's Encrypt HTTPS |

In @BotFather → **Menu button → Web App URL**, point at `PUBLIC_URL`.

## 7. Backups

MySQL data lives in `/var/lib/mysql/volleyball` on the host:

```cron
0 3 * * * /usr/bin/mysqldump -u<user> -p<pass> volleyball | gzip > /backups/volleyball-$(date +\%F).sql.gz
```

Snapshot `/var/lib/mysql` and `/usr/src/volleyball_miniApp/MiniApp_Bot_Volleyball` via your VPS provider's snapshot feature for full recovery.

## 8. Rollback

PM2 keeps the previous build on disk if you `pm2 save` after every deploy.
The pipeline does not roll back automatically — to roll back manually on the VPS:

```bash
cd /usr/src/volleyball_miniApp/MiniApp_Bot_Volleyball
git log --oneline -5
git checkout <good-sha>
npm ci --legacy-peer-deps
npm run prisma:deploy
npm run build:api
VITE_API_BASE=/api npm run build:web
pm2 startOrReload deploy/ecosystem.config.cjs
```

> The pipeline also reverts the web SPA to whatever was in the previous
> successful CI run's commit — but git history is the long-term rollback
> source.

## How it works

- `npm run deploy:vps` packages the project source as a `.tar.gz` (excluding `node_modules`, `.env`, `dist/`), uploads it via SCP, then renders `deploy/nginx-site.conf.template` and `deploy/mysql-init.sql.template` and writes a fresh `.env` from your local one (with `VPS_MYSQL_*` overrides applied) to the VPS.
- `scripts/vps-update.sh` (called by the GitHub Action or manually) runs `git pull`, applies the env substitution, then `npm ci` → `prisma generate` → `prisma migrate deploy` → `npm run build:api` → `npm run build:web` → `pm2 startOrReload`. The `volleyball` database and `volley` user must already exist on the VPS — create them once with `npm run deploy:vps -- setup` (see §4).
- The Mini App is built with `VITE_API_BASE=/api` so the SPA hits `https://<your-domain>/api/v1/...`, which nginx proxies to the API process on port 4017.
- All runtime secrets (`BOT_TOKEN`, `JWT_SECRET`, etc.) live in the server's `.env` and never enter GitHub. Only SSH creds do.