import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { delimiter, join, relative, sep } from "node:path";
import { type ComposeContext, compose } from "../../src/lib/compose.ts";
import { modulesFor } from "../../src/modules/index.ts";

/**
 * A generated hello-world project wired to stub `stellar`, `npx` and `next` binaries that record
 * every call and imitate the real CLIs closely enough to test the project's scripts offline.
 */

const STUB = String.raw`
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const state = process.env.STUB_STATE;
const read = () => (fs.existsSync(state) ? JSON.parse(fs.readFileSync(state, "utf8")) : { keys: [], deployed: {} });
const save = (s) => fs.writeFileSync(state, JSON.stringify(s));
const name = path.basename(process.argv[1]).replace(/\.js$/, "");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.STUB_LOG, JSON.stringify([name, ...args]) + "\n");
const s = read();
const opt = (flag) => args[args.indexOf(flag) + 1];
const fail = (msg) => { process.stderr.write(msg + "\n"); process.exit(1); };
if (name === "stellar") {
  const cmd = args.slice(0, 2).join(" ");
  if (cmd === "keys address") { if (!s.keys.includes(args[2])) fail("identity not found"); process.stdout.write("G" + "B".repeat(55) + "\n"); }
  else if (cmd === "keys generate") { s.keys.push(args[2]); save(s); }
  else if (cmd === "contract build") {
    const dir = path.join("contracts", "target", "wasm32v1-none", "release");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "hello_world.wasm"), process.env.STUB_WASM || "wasm-v1");
  }
  else if (cmd === "contract deploy") {
    const wasm = fs.readFileSync(opt("--wasm"));
    s.count = (s.count || 0) + 1;
    const id = "C" + String(s.count).padStart(55, "A");
    s.deployed[opt("--alias")] = { id, hash: crypto.createHash("sha256").update(wasm).digest("hex") };
    save(s); process.stdout.write(id + "\n");
  }
  else if (args[0] === "contract" && args[1] === "info" && args[2] === "hash") {
    const d = s.deployed[opt("--contract-id")]; if (!d || process.env.STUB_RESET) fail("contract not found"); process.stdout.write(d.hash + "\n");
  }
  else if (cmd === "contract alias") { const d = s.deployed[args[3]]; if (!d) fail("alias not found"); process.stdout.write(d.id + "\n"); }
  else fail("stub: unexpected stellar " + args.join(" "));
} else if (name === "next") {
  setInterval(() => {}, 1000);
} else if (name === "npx" && args[0] === "tsc") {
  const dist = path.join(path.dirname(opt("-p")), "dist");
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, "index.js"), "export {};\n");
} else if (name === "npx") {
  const out = opt("--output-dir");
  fs.mkdirSync(path.join(out, "src"), { recursive: true });
  if (args.includes("--contract-id") && process.env.STUB_OFFLINE) fail("network unreachable");
  const wasm = args.includes("--contract-id") ? opt("--contract-id") : fs.readFileSync(opt("--wasm"), "utf8");
  fs.writeFileSync(path.join(out, "src", "index.ts"), "// generated from " + wasm + "\n");
}
`;

export interface Harness {
  root: string;
  /** Directory of stub binaries placed first on PATH. */
  stubs: string;
  /** Run a project script to completion. */
  script(
    name: string,
    args?: string[],
    env?: Record<string, string>,
  ): { status: number | null; out: string };
  /** Start a long-running project script. */
  start(
    name: string,
    args?: string[],
    env?: Record<string, string>,
  ): ChildProcess & { output: () => string };
  /** Every stub call so far, as "binary arg arg …". */
  calls(): string[];
  /** Content hash of the project tree. */
  tree(): string;
  /** Write the stub state, for example to pretend an identity already exists. */
  setState(state: object): Promise<void>;
  cleanup(): Promise<void>;
}

async function writeStub(stubs: string, binary: string): Promise<void> {
  const js = join(stubs, `${binary}.js`);
  await writeFile(js, STUB);
  if (process.platform === "win32") {
    await writeFile(join(stubs, `${binary}.cmd`), `@node "%~dp0${binary}.js" %*\r\n`);
  } else {
    await writeFile(join(stubs, binary), `#!/bin/sh\nexec node "${js}" "$@"\n`);
    chmodSync(join(stubs, binary), 0o755);
  }
}

async function initContracts(root: string): Promise<void> {
  await mkdir(join(root, "contracts/contracts/hello-world/src"), { recursive: true });
  await writeFile(join(root, "contracts/Cargo.toml"), "[workspace]\n");
  await writeFile(
    join(root, "contracts/contracts/hello-world/Cargo.toml"),
    '[package]\nname = "hello-world"\nversion = "0.0.0"\n',
  );
  await writeFile(join(root, "contracts/contracts/hello-world/src/lib.rs"), "// v1\n");
}

export async function createHarness(
  contracts: ComposeContext["contracts"] = "hello-world",
  extra: Partial<ComposeContext> = {},
): Promise<Harness> {
  const work = await mkdtemp(join(tmpdir(), "csn-harness-"));
  const root = join(work, "my-app");
  const stubs = join(work, "stubs");
  const log = join(work, "calls.jsonl");
  const stateFile = join(work, "state.json");
  await mkdir(stubs);
  for (const binary of ["stellar", "npx"]) await writeStub(stubs, binary);
  const ctx: ComposeContext = {
    projectName: "my-app",
    network: "testnet",
    style: "none",
    contracts,
    ...extra,
  };
  for (const f of compose(modulesFor(ctx), ctx).files) {
    await mkdir(join(root, f.path, ".."), { recursive: true });
    await writeFile(join(root, f.path), f.content);
  }
  // A stub Next.js at the entry point dev.mjs runs: it records the call and stays alive.
  await mkdir(join(root, "node_modules/next/dist/bin"), { recursive: true });
  await writeFile(join(root, "node_modules/next/dist/bin/next"), STUB);
  // Scripts that import packages need them; link this repository's copies instead of installing.
  if (extra.envs) {
    await symlink(
      fileURLToPath(new URL("../../node_modules/smol-toml", import.meta.url)),
      join(root, "node_modules/smol-toml"),
      "junction",
    );
  }
  // What `stellar contract init contracts` would have written.
  if (contracts === "hello-world") await initContracts(root);

  // Drop inherited node_modules/.bin entries (npm test adds this repository's), so only the
  // stubs and system tools answer.
  const inherited = (process.env.PATH ?? "")
    .split(delimiter)
    .filter((dir) => !/node_modules[\\/]\.bin/.test(dir))
    .join(delimiter);
  const env = (extra: Record<string, string>) => ({
    ...process.env,
    PATH: `${stubs}${delimiter}${inherited}`,
    STUB_STATE: stateFile,
    STUB_LOG: log,
    ...extra,
  });

  return {
    root,
    stubs,
    script(name, args = [], extra = {}) {
      const r = spawnSync(process.execPath, [join("scripts", name), ...args], {
        cwd: root,
        encoding: "utf8",
        env: env(extra),
      });
      return { status: r.status, out: `${r.stdout}${r.stderr}` };
    },
    start(name, args = [], extra = {}) {
      const child = spawn(process.execPath, [join("scripts", name), ...args], {
        cwd: root,
        env: env(extra),
      });
      let output = "";
      child.stdout?.on("data", (d) => {
        output += d;
      });
      child.stderr?.on("data", (d) => {
        output += d;
      });
      return Object.assign(child, { output: () => output });
    },
    calls() {
      if (!existsSync(log)) return [];
      return readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => (JSON.parse(line) as string[]).join(" "));
    },
    tree() {
      const hash = createHash("sha256");
      const walk = (dir: string) => {
        for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
          a.name < b.name ? -1 : 1,
        )) {
          if (e.name === "node_modules") continue;
          const full = join(dir, e.name);
          if (e.isDirectory()) walk(full);
          else hash.update(relative(root, full).split(sep).join("/")).update(readFileSync(full));
        }
      };
      walk(root);
      return hash.digest("hex");
    },
    async setState(state) {
      await writeFile(stateFile, JSON.stringify(state));
    },
    async cleanup() {
      await rm(work, { recursive: true, force: true });
    },
  };
}
