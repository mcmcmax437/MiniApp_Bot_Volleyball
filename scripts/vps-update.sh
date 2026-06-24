#!/usr/bin/env bash
# Runs ON the VPS after git pull. Called by GitHub Actions or manually.
set -euo pipefail

APP_DIR="${VPS_APP_DIR:-/usr/src/volleyball_miniApp/MiniApp_Bot_Volleyball}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env on the server."
  echo "Either copy your local .env here, or run:"
  echo "  scp .env ${VPS_USER:-root}@\${VPS_HOST}:$APP_DIR/.env"
  echo "See DEPLOY.md §3 for the first-time .env contents."
  exit 1
fi

if [[ ! -d .git ]]; then
  echo "Not a git repo. Run: bash scripts/vps-git-bootstrap.sh"
  exit 1
fi

echo "==> Pull $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> Apply production .env (VPS_MYSQL_* → MYSQL_*)"
node scripts/vps-apply-production-env.mjs

# Prisma (and some other tools) read .env only from the directory they run in.
# The repo-root .env is not auto-discovered when npm changes cwd into apps/api.
# Source it into the shell environment so all child processes (npm, prisma,
# nest build) inherit DATABASE_URL and friends.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

echo "==> Ensure MySQL database exists (idempotent)"
# The deploy user (MYSQL_DEPLOY_USER) has CREATE on *.*, so it can ensure the
# volleyball database exists before Prisma tries to migrate it. If the secret
# isn't set, we don't try (the manual `npm run deploy:vps -- setup` flow
# handles that case instead).
if [[ -n "${MYSQL_DEPLOY_USER:-}" && -n "${MYSQL_DEPLOY_PASSWORD:-}" ]]; then
  DB_NAME="${MYSQL_DATABASE:-volleyball}"
  if ! mysql \
      --user="$MYSQL_DEPLOY_USER" \
      --password="$MYSQL_DEPLOY_PASSWORD" \
      --host=127.0.0.1 \
      --execute "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"; then
    echo "Failed to ensure database '$DB_NAME' exists."
    echo "Check that MYSQL_DEPLOY_USER has CREATE on *.* (run DEPLOY.md §4 once)."
    exit 1
  fi
  echo "Database '$DB_NAME' present (or just created)."
else
  echo "MYSQL_DEPLOY_USER/PASSWORD not set — assuming DB already exists."
  echo "(See DEPLOY.md §4 for the one-time 'deploy' MySQL user setup.)"
fi

echo "==> Install dependencies"
npm ci

echo "==> Prisma + database"
npm run prisma:generate
npm run prisma:deploy

echo "==> Build API"
npm run build:api

echo "==> Build Mini App"
VITE_API_BASE=/api npm run build:web

# nginx (www-data) must traverse the project root to serve dist/
chmod o+rx "$APP_DIR"
chmod -R a+rX apps/mini-app/dist

mkdir -p apps/api/uploads

echo "==> Restart PM2"
pm2 startOrReload deploy/ecosystem.config.cjs
pm2 save

echo "==> Deploy done ($(git rev-parse --short HEAD))"