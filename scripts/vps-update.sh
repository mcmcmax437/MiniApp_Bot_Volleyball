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

# Allow the deploy to override the superadmin Telegram ID. The .env on the
# server is git-ignored and persists between deploys, so a stale value (e.g.
# from a previous superadmin account) would keep overriding the new one. We
# accept VPS_TELEGRAM_SUPERADMIN_ID from the CI environment and rewrite the
# .env line in place. This keeps the .env the single source of truth while
# letting us promote/demote the admin from GitHub Actions.
if [[ -n "${VPS_TELEGRAM_SUPERADMIN_ID:-}" ]]; then
  if grep -qE '^TELEGRAM_SUPERADMIN_ID=' .env; then
    # Value is restricted to digits at the CI side, so we don't need to
    # escape regex metachars here.
    sed -i.bak -E "s|^TELEGRAM_SUPERADMIN_ID=.*\$|TELEGRAM_SUPERADMIN_ID=${VPS_TELEGRAM_SUPERADMIN_ID}|" .env
    rm -f .env.bak
    echo "==> TELEGRAM_SUPERADMIN_ID set from VPS_TELEGRAM_SUPERADMIN_ID"
  else
    printf '\nTELEGRAM_SUPERADMIN_ID=%s\n' "$VPS_TELEGRAM_SUPERADMIN_ID" >> .env
    echo "==> TELEGRAM_SUPERADMIN_ID appended from VPS_TELEGRAM_SUPERADMIN_ID"
  fi
fi

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
# `set -a` exports every variable assignment, so a stray placeholder like
# `JWT_SECRET=<paste here>` would have made bash treat `<` as a redirect
# and abort the whole script. Detect that up front so we fail with a clear
# message instead of a cryptic parse error from line N.
if grep -qE '^[A-Z_][A-Z0-9_]*[[:space:]]*=' .env && \
   grep -qE '^[[:space:]]*[A-Z_][A-Z0-9_]*=<' .env; then
  echo "ERROR: .env contains an empty/placeholder value wrapped in <>."
  echo "Replace every 'KEY=<...>' line with a real value or an empty value (KEY=)."
  echo "Offending line(s):"
  grep -nE '^[[:space:]]*[A-Z_][A-Z0-9_]*=<' .env || true
  exit 2
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a

echo "==> Prisma + database"
npm run prisma:generate
# Apply schema to MySQL. If a migration file exists, use migrate deploy
# (preserves history). If no migrations folder exists yet (first deploy),
# fall back to `prisma db push` which creates tables directly from
# schema.prisma without writing a migration file. Once any migration
# exists, `migrate deploy` will run instead.
if [[ -d prisma/migrations ]] && [[ -n "$(ls -A prisma/migrations 2>/dev/null)" ]]; then
  echo "Applying Prisma migrations..."
  npm run prisma:deploy
else
  echo "No prisma/migrations yet — pushing schema directly (one-time bootstrap)."
  npm run db:push
fi

echo "==> Build API"
npm run build:api

echo "==> Build Mini App"
# Must include /api/v1 — the NestJS API uses `app.setGlobalPrefix('api/v1')`
# (see apps/api/src/main.ts). nginx proxies the full path through to port 4017.
VITE_API_BASE=/api/v1 npm run build:web

# nginx (www-data) must traverse the project root to serve dist/
chmod o+rx "$APP_DIR"
chmod -R a+rX apps/mini-app/dist

mkdir -p apps/api/uploads

echo "==> Restart PM2"
pm2 startOrReload deploy/ecosystem.config.cjs
pm2 save

echo "==> Deploy done ($(git rev-parse --short HEAD))"