import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ComposeContext, compose } from "../../src/lib/compose.ts";
import { modulesFor } from "../../src/modules/index.ts";

/**
 * Runs the generated project's setup scripts against stub `stellar` and `npx` binaries that
 * record every call and imitate the real CLIs closely enough to test idempotency and guards.
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
} else if (name === "npx" && args[0] === "tsc") {
  const dist = path.join(path.dirname(opt("-p")), "dist");
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, "index.js"), "export {};\n");
} else if (name === "npx") {
  const out = opt("--output-dir");
  fs.mkdirSync(path.join(out, "src"), { recursive: true });
  const wasm = fs.readFileSync(opt("--wasm"), "utf8");
  fs.writeFileSync(path.join(out, "src", "index.ts"), "// generated from " + wasm + "\n");
}
`;

let root: string;
let stubs: string;
let log: string;

async function writeStub(binary: string): Promise<void> {
  const js = join(stubs, `${binary}.js`);
  await writeFile(js, STUB);
  if (process.platform === "win32") {
    await writeFile(join(stubs, `${binary}.cmd`), `@node "%~dp0${binary}.js" %*\r\n`);
  } else {
    await writeFile(join(stubs, binary), `#!/bin/sh\nexec node "${js}" "$@"\n`);
    chmodSync(join(stubs, binary), 0o755);
  }
}

beforeEach(async () => {
  const work = await mkdtemp(join(tmpdir(), "csn-setup-"));
  root = join(work, "my-app");
  stubs = join(work, "stubs");
  log = join(work, "calls.jsonl");
  await mkdir(stubs);
  await writeStub("stellar");
  await writeStub("npx");
  const ctx: ComposeContext = {
    projectName: "my-app",
    network: "testnet",
    style: "none",
    contracts: "hello-world",
  };
  for (const f of compose(modulesFor(ctx), ctx).files) {
    await mkdir(join(root, f.path, ".."), { recursive: true });
    await writeFile(join(root, f.path), f.content);
  }
  // What `stellar contract init contracts` would have written.
  await mkdir(join(root, "contracts/contracts/hello-world"), { recursive: true });
  await writeFile(join(root, "contracts/Cargo.toml"), "[workspace]\n");
  await writeFile(
    join(root, "contracts/contracts/hello-world/Cargo.toml"),
    '[package]\nname = "hello-world"\nversion = "0.0.0"\n',
  );
});

afterEach(async () => {
  await rm(join(root, ".."), { recursive: true, force: true });
});

function script(name: string, args: string[] = [], env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [join("scripts", name), ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${stubs}${delimiter}${process.env.PATH}`,
      STUB_STATE: join(root, "..", "state.json"),
      STUB_LOG: log,
      ...env,
    },
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

function calls(): string[] {
  if (!existsSync(log)) return [];
  return readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .map((line) => (JSON.parse(line) as string[]).join(" "));
}

function tree(): string {
  const hash = createHash("sha256");
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else hash.update(relative(root, full).split(sep).join("/")).update(readFileSync(full));
    }
  };
  walk(root);
  return hash.digest("hex");
}

const ids = () => JSON.parse(readFileSync(join(root, "packages/contract-ids.json"), "utf8"));

describe("setup", () => {
  it("creates the identity, builds, deploys with a project-scoped alias and generates the client", () => {
    const r = script("setup.mjs");
    expect(r.status, r.out).toBe(0);
    expect(calls()).toEqual([
      "stellar keys address dev",
      "stellar keys generate dev --network testnet --fund",
      "stellar contract build --manifest-path contracts/Cargo.toml",
      "stellar contract info hash --contract-id my-app-hello_world --network testnet",
      "stellar contract deploy --wasm contracts/target/wasm32v1-none/release/hello_world.wasm --source-account dev --network testnet --alias my-app-hello_world",
      "stellar contract alias show my-app-hello_world --network testnet",
      "npx @stellar/stellar-sdk generate --wasm contracts/target/wasm32v1-none/release/hello_world.wasm --output-dir packages/hello_world --contract-name hello_world --overwrite",
      "npx tsc -p packages/hello_world/tsconfig.json",
    ]);
    expect(existsSync(join(root, "packages/hello_world/dist/index.js"))).toBe(true);
    expect(ids()).toEqual({
      testnet: { hello_world: { alias: "my-app-hello_world", id: `C${"1".padStart(55, "A")}` } },
    });
    expect(existsSync(join(root, "packages/hello_world/src/index.ts"))).toBe(true);
  });

  it("prints every command before running it (INV-14)", () => {
    const r = script("setup.mjs");
    expect(r.out).toContain("$ stellar keys generate dev --network testnet --fund");
    expect(r.out).toContain("$ npx @stellar/stellar-sdk generate");
  });

  it("changes nothing when run a second time (INV-10)", () => {
    expect(script("setup.mjs").status).toBe(0);
    const before = tree();
    const r = script("setup.mjs");
    expect(r.status, r.out).toBe(0);
    expect(r.out).toMatch(/unchanged/);
    expect(calls().filter((c) => c.startsWith("stellar contract deploy"))).toHaveLength(1);
    expect(calls().filter((c) => c.startsWith("stellar keys generate"))).toHaveLength(1);
    expect(tree()).toBe(before);
  });

  it("records the ID without redeploying when the contract is live but contract-ids.json is missing", async () => {
    expect(script("setup.mjs").status).toBe(0);
    await rm(join(root, "packages/contract-ids.json"));
    const r = script("setup.mjs");
    expect(r.status, r.out).toBe(0);
    expect(calls().filter((c) => c.startsWith("stellar contract deploy"))).toHaveLength(1);
    expect(ids().testnet.hello_world.id).toBe(`C${"1".padStart(55, "A")}`);
  });

  it("redeploys when the contract changed", () => {
    script("setup.mjs");
    const r = script("setup.mjs", [], { STUB_WASM: "wasm-v2" });
    expect(r.status, r.out).toBe(0);
    expect(calls().filter((c) => c.startsWith("stellar contract deploy"))).toHaveLength(2);
    expect(ids().testnet.hello_world.id).toBe(`C${"2".padStart(55, "A")}`);
  });

  it("redeploys when the network lost the contract, such as after a testnet reset", () => {
    script("setup.mjs");
    const r = script("setup.mjs", [], { STUB_RESET: "1" });
    expect(r.status, r.out).toBe(0);
    expect(calls().filter((c) => c.startsWith("stellar contract deploy"))).toHaveLength(2);
  });

  it("refuses a STELLAR_ACCOUNT that looks like a secret key, without running anything (INV-04)", async () => {
    const secret = `S${"A".repeat(55)}`;
    const env = readFileSync(join(root, ".env"), "utf8").replace(
      /STELLAR_ACCOUNT=.*/,
      `STELLAR_ACCOUNT=${secret}`,
    );
    await writeFile(join(root, ".env"), env);
    const r = script("setup.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("identity name");
    expect(r.out).not.toContain(secret);
    expect(calls()).toEqual([]);
  });
});

describe("mainnet (INV-03)", () => {
  beforeEach(async () => {
    const env = readFileSync(join(root, ".env"), "utf8")
      .replace("NEXT_PUBLIC_STELLAR_NETWORK=testnet", "NEXT_PUBLIC_STELLAR_NETWORK=mainnet")
      .replace(
        /NEXT_PUBLIC_STELLAR_RPC_URL=.*/,
        "NEXT_PUBLIC_STELLAR_RPC_URL=https://rpc.example.invalid",
      );
    await writeFile(join(root, ".env"), env);
    await writeStub("stellar");
  });

  it.each(["setup.mjs", "deploy.mjs"])(
    "%s prints the deploy command and exits 1 without --confirm-mainnet",
    async (name) => {
      // An existing identity, so setup gets as far as the deploy step.
      await writeFile(
        join(root, "..", "state.json"),
        JSON.stringify({ keys: ["dev"], deployed: {} }),
      );
      const r = script(name);
      expect(r.status).toBe(1);
      expect(r.out).toContain("--confirm-mainnet");
      expect(r.out).toContain("stellar contract deploy");
      expect(calls().filter((c) => c.startsWith("stellar contract deploy"))).toEqual([]);
      expect(calls().filter((c) => c.startsWith("stellar keys generate"))).toEqual([]);
    },
  );

  it("never generates or funds an identity on mainnet", () => {
    const r = script("setup.mjs", ["--confirm-mainnet"]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("stellar keys");
    expect(calls().filter((c) => c.startsWith("stellar keys generate"))).toEqual([]);
  });

  it("deploys with --confirm-mainnet, using the RPC URL and passphrase from .env", async () => {
    await writeFile(
      join(root, "..", "state.json"),
      JSON.stringify({ keys: ["dev"], deployed: {} }),
    );
    const r = script("deploy.mjs", ["--confirm-mainnet"]);
    expect(r.status, r.out).toBe(0);
    const deploy = calls().find((c) => c.startsWith("stellar contract deploy")) ?? "";
    expect(deploy).toContain("--rpc-url https://rpc.example.invalid");
    expect(deploy).toContain("--network-passphrase Public Global Stellar Network ; September 2015");
  });
});

describe("contracts:bindings", () => {
  it("tells you to build first when no Wasm exists", () => {
    const r = script("bindings.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("contracts:build");
  });
});
