// Runs every check this project has. Passing it is the definition of done.
// Plain Node: read it, change it, or run each command yourself.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const steps = [
  { name: "Typecheck", command: "next typegen && tsc --noEmit" },
  { name: "Lint", command: "eslint" },
];
if (existsSync("contracts/Cargo.toml")) {
  steps.push({ name: "Contract tests", command: "cargo test", cwd: "contracts" });
}
steps.push({ name: "Build", command: "next build" });

for (const step of steps) {
  const where = step.cwd ? ` (in ${step.cwd}/)` : "";
  console.log(`\n> ${step.name}: ${step.command}${where}`);
  const result = spawnSync(step.command, { stdio: "inherit", shell: true, cwd: step.cwd });
  if (result.status !== 0) {
    console.error(
      `\n✗ ${step.name} failed. Fix the errors above, then run the check script again.`,
    );
    process.exit(result.status ?? 1);
  }
}
console.log("\n✓ All checks passed.");
