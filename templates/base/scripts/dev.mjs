// Starts the Next.js dev server, plus the contract watcher when this project has contracts.
// Plain Node: read it, change it, or run `next dev` yourself.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

// Find the project's own binaries even when this script is run without `npm run`.
const env = {
  ...process.env,
  PATH: `${join("node_modules", ".bin")}${delimiter}${process.env.PATH}`,
};

const children = [];
const stop = () => {
  for (const child of children) child.kill();
};

const next = spawn("next", ["dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env,
});
children.push(next);
next.on("error", (error) => {
  console.error(
    `✗ Could not start next dev (${error.message}). Run your package manager's install (npm install), then rerun.`,
  );
  stop();
  process.exit(1);
});
next.on("exit", (code) => {
  stop();
  process.exit(code ?? 0);
});

if (existsSync("contracts/Cargo.toml") && existsSync("scripts/watch-contracts.mjs")) {
  children.push(
    spawn(process.execPath, ["scripts/watch-contracts.mjs"], { stdio: "inherit", env }),
  );
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
