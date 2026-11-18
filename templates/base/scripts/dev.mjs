// Starts the Next.js dev server, plus the contract watcher when this project has contracts.
// Plain Node: read it, change it, or run `next dev` yourself.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

// Find the project's own binaries (for the watcher's stellar and npx calls) without `npm run`.
const env = {
  ...process.env,
  PATH: `${join("node_modules", ".bin")}${delimiter}${process.env.PATH}`,
};

// Run Next.js's own entry point with Node: no shell, so it behaves the same on every OS.
const nextBin = join("node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextBin)) {
  console.error(
    "✗ Next.js is not installed in this project (node_modules/next is missing). Run your package manager's install (npm install), then rerun.",
  );
  process.exit(1);
}

const children = [];
const stop = () => {
  for (const child of children) child.kill();
};

const next = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
});
children.push(next);
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
