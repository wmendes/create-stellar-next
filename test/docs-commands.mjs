// Docs test, tool part (G5): every Stellar CLI, cargo and npx command that a generated AGENTS.md or a
// bundled guide names must exist in the installed tools. Each is checked by asking it for --help.
// The offline part (script names, links, AGENTS.md shape) is test/unit/docs.test.ts.
// Usage: npm run build && npm run test:docs   (needs the Stellar CLI and cargo on PATH)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const { compose } = await import(new URL("../dist/lib/compose.js", import.meta.url));
const { modulesFor } = await import(new URL("../dist/modules/index.js", import.meta.url));

const base = { projectName: "my-app", network: "testnet", style: "none", contracts: "none" };
const combos = [
  base,
  { ...base, contracts: "hello-world", local: true, wallet: "wallets-kit", envs: true },
  { ...base, contracts: `C${"B".repeat(55)}`, wallet: "extension" },
];

/** Commands written in docs: fenced code lines and inline code that start with a known tool. */
function commandsIn(text) {
  const found = [];
  for (const block of text.matchAll(/```(?:bash|sh)\n([\s\S]*?)```/g)) {
    for (const line of block[1].split("\n")) if (line.trim()) found.push(line.trim());
  }
  for (const m of text.matchAll(/`([^`\n]+)`/g)) found.push(m[1].trim());
  return found.filter((c) => /^(stellar|cargo|npx) /.test(c) || c === "stellar skill");
}

/** The part of a command that names it: the words before the first flag, placeholder or value. */
function helpProbe(command) {
  const words = command.split(/\s+/);
  const probe = [];
  for (const w of words) {
    if (w.startsWith("-") || w.startsWith("<") || (w.includes("/") && !w.startsWith("@"))) break;
    probe.push(w);
  }
  return [...probe, "--help"];
}

const seen = new Map();
for (const ctx of combos) {
  for (const f of compose(modulesFor(ctx), ctx).files) {
    if (f.path !== "AGENTS.md" && !f.path.startsWith("docs/stellar/")) continue;
    for (const c of commandsIn(f.content)) if (!seen.has(c)) seen.set(c, f.path);
  }
}

const repo = fileURLToPath(new URL("..", import.meta.url));
let failed = 0;
for (const [command, file] of seen) {
  const [bin, ...args] = helpProbe(command);
  const runArgs = bin === "npx" ? ["--no-install", ...args] : args;
  const r = spawnSync(bin, runArgs, {
    cwd: repo,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${[bin, ...runArgs].join(" ")}   (${file}: ${command})`);
}
console.log(
  failed === 0
    ? `\n✓ All ${seen.size} commands exist.`
    : `\n✗ ${failed} of ${seen.size} commands failed.`,
);
process.exit(failed === 0 ? 0 : 1);
