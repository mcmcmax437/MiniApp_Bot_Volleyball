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

# Install deps BEFORE exporting the production .env into the shell.
# vps-apply-production-env.mjs writes NODE_ENV=production into .env, and
# if that variable is in the shell environment, `npm ci` skips
# devDependencies — which means @nestjs/cli, typescript, etc. wouldn't be
# installed, so `nest build` would fail with "nest: not found".
echo "==> Install dependencies (devDependencies included)"
npm ci --include=dev

# Prisma and Nest both need DATABASE_URL etc. The repo-root .env isn't
# auto-discovered when npm changes cwd into apps/api, so source it into
# the shell environment now that `npm ci` has finished.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

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