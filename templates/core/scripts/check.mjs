// Runs every check this project has. Passing it is the definition of done.
// Plain Node: read it, change it, or run each command yourself.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { delimiter, join } from "node:path";

// Find the project's own binaries even when this script is run without `npm run`.
const env = {
  ...process.env,
  PATH: `${join("node_modules", ".bin")}${delimiter}${process.env.PATH}`,
};

// Projects with lib/contracts.ts need their generated clients before they can typecheck.
const packages = existsSync("packages")
  ? readdirSync("packages", { withFileTypes: true }).filter((e) => e.isDirectory())
  : [];
const clientsMissing =
  packages.length === 0 ||
  packages.some((e) => !existsSync(`packages/${e.name}/dist/index.js`)) ||
  (existsSync("contracts/Cargo.toml") && !existsSync("packages/contract-ids.json"));
if (existsSync("lib/contracts.ts") && clientsMissing) {
  console.error(
    "✗ The generated contract clients in packages/ are missing. Run the setup script first (npm run setup).",
  );
  process.exit(1);
}

const steps = [
  { name: "Typecheck", command: "next typegen && tsc --noEmit" },
  { name: "Lint", command: 'eslint --ignore-pattern "packages/**"' },
];
if (existsSync("contracts/Cargo.toml")) {
  steps.push({ name: "Contract tests", command: "cargo test", cwd: "contracts" });
}
steps.push({ name: "Build", command: "next build" });

for (const step of steps) {
  const where = step.cwd ? ` (in ${step.cwd}/)` : "";
  console.log(`\n> ${step.name}: ${step.command}${where}`);
  const result = spawnSync(step.command, { stdio: "inherit", shell: true, cwd: step.cwd, env });
  if (result.status !== 0) {
    console.error(
      `\n✗ ${step.name} failed. Fix the errors above, then run the check script again.`,
    );
    process.exit(result.status ?? 1);
  }
}
console.log("\n✓ All checks passed.");
