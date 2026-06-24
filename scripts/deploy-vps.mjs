/**
 * Deploy the Volleyball Mini App stack to a VPS over SSH (native Node + PM2 + nginx).
 *
 * Your VPS already has MySQL, nginx, Node, and PM2 — no Docker required.
 *
 * 1. Set DOMAIN, PUBLIC_URL, and VPS MySQL values in the repo-root `.env`.
 * 2. Point your domain DNS A/AAAA record at the VPS.
 * 3. Run: npm run deploy:vps
 *
 * Optional steps:
 *   npm run deploy:vps -- setup      # MySQL user + app directory only
 *   npm run deploy:vps -- app        # sync + build + PM2 (no nginx / no domain check)
 *   npm run deploy:vps -- sync       # upload sources (no build/restart)
 *   npm run deploy:vps -- nginx      # refresh nginx site config
 *   npm run deploy:vps -- ssl        # certbot --nginx (needs DOMAIN + DNS)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deployDir = path.join(rootDir, "deploy");
const envPath = path.join(rootDir, ".env");

const step = process.argv[2] || "all";
const sshTarget = process.env.VPS_SSH_TARGET?.trim() || "vps";
const appDir =
  process.env.VPS_APP_DIR?.trim() ||
  "/usr/src/volleyball-miniApp/MiniApp_Bot_Volleyball";

function loadEnvFile() {
  if (!fs.existsSync(envPath)) {
    console.error(
      "\nMissing .env in the project root.\n" +
        "  cp .env.example .env\n" +
        "  Then set BOT_TOKEN, JWT_SECRET, DOMAIN, PUBLIC_URL, and VPS MySQL values.\n",
    );
    process.exit(1);
  }

  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/** VPS credentials: VPS_MYSQL_* when local dev uses different MySQL settings. */
function vpsMysql(env) {
  return {
    user: env.VPS_MYSQL_USER?.trim() || env.MYSQL_USER?.trim(),
    password: env.VPS_MYSQL_PASSWORD?.trim() || env.MYSQL_PASSWORD?.trim(),
    database: env.VPS_MYSQL_DATABASE?.trim() || env.MYSQL_DATABASE?.trim(),
    port: env.VPS_MYSQL_PORT?.trim() || env.LOCAL_DB_PORT?.trim() || "3306",
  };
}

/** Build the `.env` written on the VPS (production overrides from repo-root `.env`). */
function buildServerEnv(source) {
  const mysql = vpsMysql(source);
  const publicUrl = source.PUBLIC_URL?.trim() || "";
  const domain = source.DOMAIN?.trim() || "";

  const databaseUrl =
    source.DATABASE_URL?.trim() ||
    `mysql://${mysql.user}:${encodeURIComponent(
      mysql.password ?? "",
    )}@127.0.0.1:${mysql.port}/${mysql.database}`;

  const server = {
    NODE_ENV: "production",
    PORT: source.PORT?.trim() || "4017",
    DATABASE_URL: databaseUrl,
    MYSQL_USER: mysql.user,
    MYSQL_PASSWORD: mysql.password,
    MYSQL_DATABASE: mysql.database,
    MYSQL_HOST: "127.0.0.1",
    JWT_SECRET: source.JWT_SECRET?.trim(),
    JWT_EXPIRES_IN: source.JWT_EXPIRES_IN?.trim() || "30d",
    BOT_TOKEN: source.BOT_TOKEN?.trim(),
    WEBAPP_URL: publicUrl,
    PUBLIC_URL: publicUrl,
    DOMAIN: domain,
    CORS_ORIGINS: source.CORS_ORIGINS?.trim() || publicUrl,
    DEFAULT_CITY: source.DEFAULT_CITY?.trim() || "Kyiv",
    DEFAULT_CITY_LAT: source.DEFAULT_CITY_LAT?.trim() || "50.4501",
    DEFAULT_CITY_LNG: source.DEFAULT_CITY_LNG?.trim() || "30.5234",
    VITE_API_BASE: source.VITE_API_BASE?.trim() || "/api",
  };

  return Object.fromEntries(
    Object.entries(server).filter(([, v]) => v != null && String(v).length > 0),
  );
}

function requireKeys(env, keys, label = ".env") {
  const missing = keys.filter((k) => !env[k]?.trim());
  if (missing.length) {
    console.error(`Missing required keys in ${label}: ${missing.join(", ")}`);
    process.exit(1);
  }
}

function prepareAppEnv(source) {
  requireKeys(source, ["BOT_TOKEN", "JWT_SECRET"]);
  const mysql = vpsMysql(source);
  requireKeys(
    { MYSQL_USER: mysql.user, MYSQL_PASSWORD: mysql.password, MYSQL_DATABASE: mysql.database },
    ["MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"],
    ".env (or VPS_MYSQL_* for VPS deploy)",
  );
  const env = buildServerEnv(source);
  if (!env.PUBLIC_URL || env.PUBLIC_URL.includes("REPLACE")) {
    env.PUBLIC_URL = "http://127.0.0.1";
    env.CORS_ORIGINS = env.PUBLIC_URL;
    env.WEBAPP_URL = env.PUBLIC_URL;
  }
  return env;
}

function validateProductionEnv(source) {
  requireKeys(source, ["BOT_TOKEN", "JWT_SECRET", "PUBLIC_URL", "DOMAIN"]);
  const mysql = vpsMysql(source);
  requireKeys(
    { MYSQL_USER: mysql.user, MYSQL_PASSWORD: mysql.password, MYSQL_DATABASE: mysql.database },
    ["MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"],
    ".env (or VPS_MYSQL_* for VPS deploy)",
  );

  const publicUrl = source.PUBLIC_URL.trim();
  const domain = source.DOMAIN.trim();

  if (!publicUrl.startsWith("https://")) {
    console.error("PUBLIC_URL in .env must start with https:// (Telegram Mini Apps require HTTPS).");
    process.exit(1);
  }
  if (domain === "localhost" || publicUrl.includes("ngrok")) {
    console.error("DOMAIN / PUBLIC_URL in .env still look like local dev. Set your real domain.");
    process.exit(1);
  }
  if (!publicUrl.includes(domain)) {
    console.warn(`Warning: PUBLIC_URL (${publicUrl}) does not contain DOMAIN (${domain}).`);
  }

  return buildServerEnv(source);
}

function ssh(command, { input } = {}) {
  const args = ["-o", "BatchMode=yes", sshTarget, command];
  const result = spawnSync("ssh", args, {
    encoding: "utf8",
    input,
    stdio: input ? ["pipe", "inherit", "inherit"] : "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function scp(local, remote) {
  const result = spawnSync("scp", ["-o", "BatchMode=yes", local, `${sshTarget}:${remote}`], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function renderTemplate(name, vars) {
  const templatePath = path.join(deployDir, name);
  let text = fs.readFileSync(templatePath, "utf8");
  for (const [key, value] of Object.entries(vars)) {
    text = text.replaceAll(`__${key}__`, value);
  }
  return text;
}

function writeRemoteFile(remotePath, content) {
  ssh(`mkdir -p "$(dirname '${remotePath}')"`);
  ssh(`cat > '${remotePath}'`, { input: content });
}

function syncSources() {
  const archive = path.join(deployDir, ".deploy-bundle.tgz");
  const excludes = [
    "node_modules",
    ".git",
    ".env",
    "dist",
    "deploy/.deploy-bundle.tgz",
    "apps/mini-app/dist",
    "apps/api/dist",
    "apps/api/uploads",
    ".localdb",
    "data",
    "caddy_data",
    "caddy_config",
  ];

  console.log("\n[pack] Packaging project...");
  if (fs.existsSync(archive)) fs.unlinkSync(archive);

  const tarArgs = ["-czf", archive, ...excludes.flatMap((e) => ["--exclude", e]), "-C", rootDir, "."];
  const tar = spawnSync("tar", tarArgs, { stdio: "inherit" });
  if (tar.status !== 0) {
    console.error("tar failed - install Git for Windows or use WSL tar.");
    process.exit(tar.status ?? 1);
  }

  console.log(`\n[upload] Uploading to ${sshTarget}:${appDir} ...`);
  ssh(`mkdir -p '${appDir}'`);
  scp(archive, `${appDir}/.deploy-bundle.tgz`);
  ssh(`cd '${appDir}' && tar xzf .deploy-bundle.tgz && rm -f .deploy-bundle.tgz`);
  fs.unlinkSync(archive);
}

function writeProductionEnvOnServer(env) {
  const lines = Object.entries(env)
    .filter(([, v]) => v != null && String(v).length > 0)
    .map(([k, v]) => `${k}=${v}`);
  writeRemoteFile(`${appDir}/.env`, `${lines.join("\n")}\n`);
}

function setupMysql(env) {
  console.log("\n[mysql] Ensuring MySQL database and app user...");
  const sql = renderTemplate("mysql-init.sql.template", {
    MYSQL_DATABASE: env.MYSQL_DATABASE,
    MYSQL_USER: env.MYSQL_USER,
    MYSQL_PASSWORD: env.MYSQL_PASSWORD,
  });
  const remoteSql = `/tmp/volleyball-mysql-init.sql`;
  writeRemoteFile(remoteSql, sql);
  ssh(`sudo mysql < '${remoteSql}' && rm -f '${remoteSql}'`);
}

function remoteBuildAndStart() {
  console.log("\n[build] Installing dependencies and building on VPS...");
  const script = [
    `set -e`,
    `cd '${appDir}'`,
    `npm ci`,
    `npm run prisma:generate`,
    `npm run prisma:deploy`,
    `npm run build:api`,
    `VITE_API_BASE=/api npm run build:web`,
    `mkdir -p apps/api/uploads`,
    `chmod o+rx '${appDir}'`,
    `chmod -R a+rX apps/mini-app/dist`,
    `pm2 startOrReload deploy/ecosystem.config.cjs`,
    `pm2 save`,
  ].join(" && ");

  ssh(script);
}

function configureNginx(env) {
  console.log("\n[nginx] Configuring nginx...");
  const conf = renderTemplate("nginx-site.conf.template", {
    DOMAIN: env.DOMAIN,
    APP_DIR: appDir,
  });
  const siteName = "volleyball";
  const available = `/etc/nginx/sites-available/${siteName}`;
  const enabled = `/etc/nginx/sites-enabled/${siteName}`;
  writeRemoteFile(`/tmp/${siteName}.conf`, conf);
  ssh(
    [
      `sudo mv /tmp/${siteName}.conf '${available}'`,
      `sudo ln -sf '${available}' '${enabled}'`,
      `sudo rm -f /etc/nginx/sites-enabled/default`,
      `sudo nginx -t`,
      `sudo systemctl reload nginx`,
    ].join(" && "),
  );
}

function configureSsl(env) {
  console.log("\n[ssl] Requesting HTTPS certificate (certbot)...");
  ssh(
    `command -v certbot >/dev/null 2>&1 || (sudo apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx)`,
  );
  ssh(
    `sudo certbot --nginx -d '${env.DOMAIN}' --non-interactive --agree-tos --register-unsafely-without-email --redirect`,
  );
}

function printDone(env) {
  console.log("\n[done] Deploy finished.\n");
  console.log(`  Mini App:  ${env.PUBLIC_URL}`);
  console.log(`  Health:    ${env.PUBLIC_URL.replace(/\/$/, "")}/api/v1/healthz`);
  console.log(`  API logs:  pm2 logs volleyball-api`);
  console.log("\nUpdate @BotFather -> Menu button -> Web App URL to match PUBLIC_URL.\n");
}

const sourceEnv = loadEnvFile();

console.log(`Target: ssh ${sshTarget}`);
console.log(`App dir: ${appDir}`);
console.log(`Env file: ${envPath}`);

switch (step) {
  case "setup": {
    const env = prepareAppEnv(sourceEnv);
    ssh(`mkdir -p '${appDir}'`);
    setupMysql(env);
    console.log("\n[done] MySQL user and database ready on the VPS.\n");
    break;
  }
  case "app": {
    const env = prepareAppEnv(sourceEnv);
    syncSources();
    writeProductionEnvOnServer(env);
    remoteBuildAndStart();
    console.log("\n[done] App built and running under PM2 (volleyball-api).");
    console.log("   Next: set DOMAIN + PUBLIC_URL in .env, then npm run deploy:vps\n");
    break;
  }
  case "sync": {
    const env = validateProductionEnv(sourceEnv);
    console.log(`Domain: ${env.DOMAIN}`);
    syncSources();
    writeProductionEnvOnServer(env);
    break;
  }
  case "build": {
    const env = validateProductionEnv(sourceEnv);
    console.log(`Domain: ${env.DOMAIN}`);
    writeProductionEnvOnServer(env);
    remoteBuildAndStart();
    break;
  }
  case "nginx": {
    const env = validateProductionEnv(sourceEnv);
    console.log(`Domain: ${env.DOMAIN}`);
    configureNginx(env);
    break;
  }
  case "ssl": {
    const env = validateProductionEnv(sourceEnv);
    console.log(`Domain: ${env.DOMAIN}`);
    configureNginx(env);
    configureSsl(env);
    break;
  }
  case "all":
  default: {
    const env = validateProductionEnv(sourceEnv);
    console.log(`Domain: ${env.DOMAIN}`);
    ssh(`mkdir -p '${appDir}'`);
    setupMysql(env);
    syncSources();
    writeProductionEnvOnServer(env);
    remoteBuildAndStart();
    configureNginx(env);
    console.log(
      "\n[info] HTTPS: run `npm run deploy:vps -- ssl` after DNS points to this server.\n",
    );
    printDone(env);
    break;
  }
}