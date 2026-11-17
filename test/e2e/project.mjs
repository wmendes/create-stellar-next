// End-to-end: run the built CLI in a temp directory, install the generated project and run its check.
// Usage: npm run build && npm run test:e2e
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const bin = fileURLToPath(new URL("../../dist/bin.js", import.meta.url));
const TOOL_NAME = "create-stellar-next";
const variants = [
  { name: "tailwind", args: [] },
  { name: "style-none", args: ["--style", "none"] },
];

function run(command, args, cwd) {
  console.log(`\n$ ${[command, ...args].join(" ")}   (in ${cwd})`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: true });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited ${result.status}`);
}

function capture(args, cwd) {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Hash of every file outside node_modules and .next, to prove a step changed nothing. */
function treeHash(dir) {
  const hash = createHash("sha256");
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else hash.update(relative(dir, full).split(sep).join("/")).update(readFileSync(full));
    }
  };
  walk(dir);
  return hash.digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const work = mkdtempSync(join(tmpdir(), "csn-e2e-"));
let failed = false;
try {
  for (const variant of variants) {
    console.log(`\n=== ${variant.name} ===`);
    const app = `app-${variant.name}`;
    const created = capture([app, "--contracts", "none", "--yes", "--json", ...variant.args], work);
    assert(
      created.status === 0,
      `create exited ${created.status}: ${created.stdout}${created.stderr}`,
    );
    const output = JSON.parse(created.stdout);
    assert(output.errors.length === 0, "create reported errors");
    const root = join(work, app);

    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert(!(TOOL_NAME in deps), "INV-01: the generated project depends on the tool");

    assert(existsSync(join(root, "node_modules", "next")), "create did not install dependencies");
    run("npm", ["run", "check"], root);

    const before = treeHash(root);
    const dry = capture([app, "--contracts", "none", "--yes", "--dry-run", ...variant.args], work);
    assert(dry.status === 0, `dry run exited ${dry.status}: ${dry.stderr}`);
    assert(treeHash(root) === before, "INV-09: --dry-run changed the project");
    const again = capture([app, "--contracts", "none", "--yes", ...variant.args], work);
    assert(again.status === 0, `second create exited ${again.status}: ${again.stderr}`);
    assert(treeHash(root) === before, "a second create changed the project");
    console.log(`\n✓ ${variant.name}`);
  }
} catch (error) {
  failed = true;
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
