// Release check (G7): pack the CLI with `npm pack`, install the tarball in a temp directory, and run
// the contract-loop end-to-end test against that installed copy. Nothing is published.
// Usage: npm run build && npm run test:pack   (same requirements as test:e2e:contracts)
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../..", import.meta.url));
const work = mkdtempSync(join(tmpdir(), "csn-pack-"));
const shell = process.platform === "win32";

function run(command, args, cwd, env = process.env) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const r = spawnSync(command, args, { cwd, env, stdio: "inherit", shell });
  if (r.status !== 0) throw new Error(`${command} ${args.join(" ")} exited ${r.status}`);
}

let failed = false;
try {
  run("npm", ["pack", "--pack-destination", work], repo);
  const tarball = readdirSync(work).find((f) => f.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack wrote no tarball");
  const install = join(work, "install");
  run("npm", ["init", "-y"], work);
  run(
    "npm",
    ["install", "--prefix", install, "--no-audit", "--no-fund", join(work, tarball)],
    work,
  );
  const cli = join(install, "node_modules", "create-stellar-next", "dist", "bin.js");
  run(process.execPath, [cli, "--version"], work);
  run(process.execPath, [join(repo, "test", "e2e", "contracts.mjs")], repo, {
    ...process.env,
    E2E_CLI: cli,
  });
  console.log(`\n✓ The packed tarball (${tarball}) passes the contract-loop end-to-end test.`);
} catch (error) {
  failed = true;
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
