#!/usr/bin/env bash
# ONE-TIME on the VPS: clone into the app directory (keeps existing .env).
set -euo pipefail

APP_DIR="${VPS_APP_DIR:-/usr/src/volleyball_miniApp/MiniApp_Bot_Volleyball}"
REPO_URL="${VPS_REPO_URL:-https://github.com/mcmcmax437/MiniApp_Bot_Volleyball.git}"
BRANCH="${DEPLOY_BRANCH:-main}"

if [[ -d "$APP_DIR/.git" ]] && git -C "$APP_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  echo "Already a git repo at $APP_DIR"
  exec bash "$APP_DIR/scripts/vps-update.sh"
fi

ENV_BACKUP=""
if [[ -f "$APP_DIR/.env" ]]; then
  ENV_BACKUP="$(mktemp)"
  cp "$APP_DIR/.env" "$ENV_BACKUP"
  echo "Backed up existing .env"
fi

if [[ -d "$APP_DIR" ]]; then
  BACKUP_DIR="${APP_DIR}.bak.$(date +%s)"
  mv "$APP_DIR" "$BACKUP_DIR"
  echo "Moved old install to $BACKUP_DIR"
fi

echo "Cloning $REPO_URL ($BRANCH) -> $APP_DIR"
git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"

if [[ -n "$ENV_BACKUP" && -f "$ENV_BACKUP" ]]; then
  cp "$ENV_BACKUP" "$APP_DIR/.env"
  rm -f "$ENV_BACKUP"
  echo "Restored .env"
fi

chmod +x "$APP_DIR/scripts/vps-update.sh" 2>/dev/null || true
bash "$APP_DIR/scripts/vps-update.sh"