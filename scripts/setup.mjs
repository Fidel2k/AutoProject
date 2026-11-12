import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
const probe = spawnSync("uv", ["--version"], { stdio: "ignore" });
if (probe.error || probe.status !== 0) {
  console.error("uv is not available. In PowerShell run: py -m pip install uv");
  console.error("Then reopen VS Code and run npm run install:all again.");
  process.exit(1);
}
if (!existsSync("backend/.env")) {
  copyFileSync("backend/.env.example", "backend/.env");
  console.log("Created backend/.env. Existing settings are never overwritten.");
}
console.log(
  "After setup: npm run dev (MySQL) or npm run dev:demo (SQLite preview).",
);
