/** PM2 process list — paths are relative to this file's parent (repo root on the VPS). */
const path = require("node:path");

const root = path.join(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "volleyball-api",
      cwd: root,
      script: "npm",
      args: "run start:prod -w @volleyball/api",
      env: {
        NODE_ENV: "production",
        // Port 4017 — chosen to never collide with anything else. The taxi
        // project on this VPS uses 3000. Mirror this in
        // deploy/nginx-site.conf.template (proxy_pass target).
        PORT: "4017",
        // Cap V8 heap so a leak triggers a clean PM2 restart instead of the
        // kernel OOM-killer (which previously left the process dead → nginx 502).
        NODE_OPTIONS: "--max-old-space-size=384",
      },
      autorestart: true,
      max_restarts: 40,
      min_uptime: "10s",
      restart_delay: 4000,
      exp_backoff_restart_delay: 2000,
      // Soft restart before the host OOMs the process (shared VPS with taxi + surgion).
      max_memory_restart: "450M",
      kill_timeout: 5000,
    },
  ],
};