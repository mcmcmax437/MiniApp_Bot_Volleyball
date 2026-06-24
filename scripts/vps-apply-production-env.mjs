/**
 * On the VPS: apply production MySQL settings from VPS_MYSQL_* into .env
 * so Prisma, PM2, and the API use the volleyball user (not local-dev root).
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env in", process.cwd());
  process.exit(1);
}

function parseEnv(text) {
  const vars = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

function setLine(lines, key, value) {
  const prefix = `${key}=`;
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(prefix) || line.trim().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  return next;
}

const raw = fs.readFileSync(envPath, "utf8");
const vars = parseEnv(raw);
let lines = raw.split(/\r?\n/);

const mysqlUser = vars.VPS_MYSQL_USER || vars.MYSQL_USER;
const mysqlPassword = vars.VPS_MYSQL_PASSWORD || vars.MYSQL_PASSWORD;
const mysqlDatabase = vars.VPS_MYSQL_DATABASE || vars.MYSQL_DATABASE;

if (!mysqlUser || !mysqlPassword || !mysqlDatabase) {
  console.error("Missing MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE (or VPS_MYSQL_*) in .env");
  process.exit(1);
}

// Build DATABASE_URL from the resolved MySQL credentials (api expects it).
const dbPort = vars.VPS_MYSQL_PORT || vars.LOCAL_DB_PORT || "3306";
const databaseUrl =
  vars.DATABASE_URL ||
  `mysql://${mysqlUser}:${encodeURIComponent(mysqlPassword)}@127.0.0.1:${dbPort}/${mysqlDatabase}`;

lines = setLine(lines, "MYSQL_USER", mysqlUser);
lines = setLine(lines, "MYSQL_PASSWORD", mysqlPassword);
lines = setLine(lines, "MYSQL_DATABASE", mysqlDatabase);
lines = setLine(lines, "MYSQL_HOST", "127.0.0.1");
lines = setLine(lines, "DATABASE_URL", databaseUrl);
lines = setLine(lines, "NODE_ENV", "production");

// Deploy-only MySQL user (used by vps-update.sh to CREATE DATABASE IF NOT EXISTS).
// Forwarded from VPS_MYSQL_DEPLOY_* in the source .env, or left blank if not set.
const deployUser = vars.VPS_MYSQL_DEPLOY_USER || vars.MYSQL_DEPLOY_USER || "";
const deployPassword = vars.VPS_MYSQL_DEPLOY_PASSWORD || vars.MYSQL_DEPLOY_PASSWORD || "";
lines = setLine(lines, "MYSQL_DEPLOY_USER", deployUser);
lines = setLine(lines, "MYSQL_DEPLOY_PASSWORD", deployPassword);

if (vars.PUBLIC_URL && !vars.CORS_ORIGINS) {
  lines = setLine(lines, "CORS_ORIGINS", vars.PUBLIC_URL);
}

fs.writeFileSync(
  envPath,
  `${lines.filter((l, i, a) => !(i === a.length - 1 && l === "")).join("\n")}\n`,
);
console.log(`Production .env applied (MySQL user: ${mysqlUser}, host: 127.0.0.1)`);