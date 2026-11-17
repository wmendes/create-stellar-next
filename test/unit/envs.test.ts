import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli.ts";
import { type ComposeContext, compose } from "../../src/lib/compose.ts";
import { modulesFor } from "../../src/modules/index.ts";
import { fakeRunner } from "./fake-runner.ts";
import { createHarness, type Harness } from "./project-harness.ts";

const GOLDEN = new URL("../golden/envs-apply-dry-run.txt", import.meta.url);
const ctx: ComposeContext = {
  projectName: "my-app",
  network: "testnet",
  style: "none",
  contracts: "hello-world",
  envs: true,
};

describe("--envs", () => {
  const out = compose(modulesFor(ctx), ctx);
  const files = new Map(out.files.map((f) => [f.path, f.content]));
  const pkg = JSON.parse(files.get("package.json") ?? "{}") as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  it("adds stellar.envs.toml, the envs:apply script and a pinned TOML parser", () => {
    expect(files.get("stellar.envs.toml")).toContain("[testnet]");
    expect(pkg.scripts["envs:apply"]).toBe("node scripts/envs.mjs");
    expect(pkg.devDependencies["smol-toml"]).toBe("1.9.1");
  });

  it("declares no mainnet environment by default (INV-02)", () => {
    const toml = files.get("stellar.envs.toml") ?? "";
    expect(toml.split("\n").filter((l) => /^\s*network\s*=\s*"mainnet"/.test(l))).toEqual([]);
  });

  it("is refused without the hello-world contracts workspace", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "csn-envs-"));
    try {
      const r = await main(["app", "--yes", "--contracts", "none", "--envs"], {
        cwd,
        createRunner: fakeRunner().factory,
        nodeVersion: "24.18.1",
      });
      expect(r.exitCode).toBe(2);
      expect(r.stderr).toContain("--contracts hello-world");
      expect(existsSync(join(cwd, "app"))).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe("envs:apply", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness("hello-world", { envs: true });
  });
  afterEach(async () => {
    await h.cleanup();
  });
  const env = () => readFileSync(join(h.root, ".env"), "utf8");

  it("--dry-run prints the plan, matching the stored snapshot, and runs nothing (G4)", () => {
    const r = h.script("envs.mjs", ["testnet", "--dry-run"]);
    expect(r.status, r.out).toBe(0);
    expect(h.calls()).toEqual([]);
    expect(r.out).toBe(readFileSync(GOLDEN, "utf8"));
  });

  it("applies an environment: identity, build, deploy, clients, then .env", () => {
    const before = env();
    const r = h.script("envs.mjs", ["local"]);
    expect(r.status, r.out).toBe(0);
    expect(h.calls()).toContain("stellar keys generate dev --network local --fund");
    expect(h.calls()).toContain(
      "stellar contract deploy --wasm contracts/target/wasm32v1-none/release/hello_world.wasm --source-account dev --network local --alias my-app-hello_world",
    );
    expect(h.calls()).toContain("npx tsc -p packages/hello_world/tsconfig.json");
    expect(env()).toContain("NEXT_PUBLIC_STELLAR_NETWORK=local\n");
    expect(env()).toContain("NEXT_PUBLIC_STELLAR_RPC_URL=http://localhost:8000/rpc\n");
    expect(env()).not.toBe(before);
    const ids = JSON.parse(readFileSync(join(h.root, "packages/contract-ids.json"), "utf8"));
    expect(ids.local.hello_world.alias).toBe("my-app-hello_world");
  });

  it("prints every command before running it (INV-14)", () => {
    const r = h.script("envs.mjs", ["local"]);
    for (const call of h.calls())
      expect(r.out).toContain(`$ ${call.split(" ").slice(0, 3).join(" ")}`);
  });

  it("changes nothing when applied twice", () => {
    expect(h.script("envs.mjs", ["local"]).status).toBe(0);
    const before = h.tree();
    expect(h.script("envs.mjs", ["local"]).status).toBe(0);
    expect(h.tree()).toBe(before);
  });

  it("records a declared contract ID without deploying it", async () => {
    const id = `C${"D".repeat(55)}`;
    await writeFile(
      join(h.root, "stellar.envs.toml"),
      `[staging]\nnetwork = "testnet"\naccounts = ["dev"]\n\n[staging.contracts.hello_world]\nid = "${id}"\n`,
    );
    const r = h.script("envs.mjs", ["staging"]);
    expect(r.status, r.out).toBe(0);
    expect(h.calls().filter((c) => c.startsWith("stellar contract deploy"))).toEqual([]);
    const ids = JSON.parse(readFileSync(join(h.root, "packages/contract-ids.json"), "utf8"));
    expect(ids.testnet.hello_world.id).toBe(id);
  });

  it("refuses a mainnet deploy without --confirm-mainnet, and never creates a mainnet identity (INV-03)", async () => {
    await h.setState({ keys: ["dev"], deployed: {} });
    await writeFile(
      join(h.root, "stellar.envs.toml"),
      `[production]\nnetwork = "mainnet"\nrpc_url = "https://rpc.example.invalid"\naccounts = ["dev"]\n\n[production.contracts.hello_world]\nsource = "contracts/contracts/hello-world"\n`,
    );
    const r = h.script("envs.mjs", ["production"]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("--confirm-mainnet");
    expect(h.calls().filter((c) => /contract deploy|keys generate/.test(c))).toEqual([]);
  });

  it("names the environments it knows when given an unknown one", () => {
    const r = h.script("envs.mjs", ["staging"]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("testnet, local");
  });

  it("explains a TOML syntax error", async () => {
    await writeFile(join(h.root, "stellar.envs.toml"), "[testnet\n");
    const r = h.script("envs.mjs", ["testnet"]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("stellar.envs.toml");
  });

  it("says which environment to pass when given none", () => {
    const r = h.script("envs.mjs", []);
    expect(r.status).toBe(1);
    expect(r.out).toContain("envs:apply -- <environment>");
  });
});
