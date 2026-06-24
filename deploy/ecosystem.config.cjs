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
      },
      max_restarts: 15,
      restart_delay: 3000,
    },
  ],
};