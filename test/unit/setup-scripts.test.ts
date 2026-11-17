import { existsSync, readFileSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./project-harness.ts";

/** The generated project's setup scripts, run against stub binaries (see project-harness.ts). */

let h: Harness;
beforeEach(async () => {
  h = await createHarness();
});
afterEach(async () => {
  await h.cleanup();
});

const ids = () => JSON.parse(readFileSync(join(h.root, "packages/contract-ids.json"), "utf8"));

describe("setup", () => {
  it("creates the identity, builds, deploys with a project-scoped alias and generates the client", () => {
    const r = h.script("setup.mjs");
    expect(r.status, r.out).toBe(0);
    expect(h.calls()).toEqual([
      "stellar keys address dev",
      "stellar keys generate dev --network testnet --fund",
      "stellar contract build --manifest-path contracts/Cargo.toml",
      "stellar contract info hash --contract-id my-app-hello_world --network testnet",
      "stellar contract deploy --wasm contracts/target/wasm32v1-none/release/hello_world.wasm --source-account dev --network testnet --alias my-app-hello_world",
      "stellar contract alias show my-app-hello_world --network testnet",
      "npx @stellar/stellar-sdk generate --wasm contracts/target/wasm32v1-none/release/hello_world.wasm --output-dir packages/hello_world --contract-name hello_world --overwrite",
      "npx tsc -p packages/hello_world/tsconfig.json",
    ]);
    expect(existsSync(join(h.root, "packages/hello_world/dist/index.js"))).toBe(true);
    expect(ids()).toEqual({
      testnet: { hello_world: { alias: "my-app-hello_world", id: `C${"1".padStart(55, "A")}` } },
    });
    expect(existsSync(join(h.root, "packages/hello_world/src/index.ts"))).toBe(true);
  });

  it("prints every command before running it (INV-14)", () => {
    const r = h.script("setup.mjs");
    expect(r.out).toContain("$ stellar keys generate dev --network testnet --fund");
    expect(r.out).toContain("$ npx @stellar/stellar-sdk generate");
  });

  it("changes nothing when run a second time (INV-10)", () => {
    expect(h.script("setup.mjs").status).toBe(0);
    const before = h.tree();
    const r = h.script("setup.mjs");
    expect(r.status, r.out).toBe(0);
    expect(r.out).toMatch(/unchanged/);
    expect(h.calls().filter((c) => c.startsWith("stellar contract deploy"))).toHaveLength(1);
    expect(h.calls().filter((c) => c.startsWith("stellar keys generate"))).toHaveLength(1);
    expect(h.tree()).toBe(before);
  });

  it("records the ID without redeploying when the contract is live but contract-ids.json is missing", async () => {
    expect(h.script("setup.mjs").status).toBe(0);
    await rm(join(h.root, "packages/contract-ids.json"));
    const r = h.script("setup.mjs");
    expect(r.status, r.out).toBe(0);
    expect(h.calls().filter((c) => c.startsWith("stellar contract deploy"))).toHaveLength(1);
    expect(ids().testnet.hello_world.id).toBe(`C${"1".padStart(55, "A")}`);
  });

  it("redeploys when the contract changed", () => {
    h.script("setup.mjs");
    const r = h.script("setup.mjs", [], { STUB_WASM: "wasm-v2" });
    expect(r.status, r.out).toBe(0);
    expect(h.calls().filter((c) => c.startsWith("stellar contract deploy"))).toHaveLength(2);
    expect(ids().testnet.hello_world.id).toBe(`C${"2".padStart(55, "A")}`);
  });

  it("redeploys when the network lost the contract, such as after a testnet reset", () => {
    h.script("setup.mjs");
    const r = h.script("setup.mjs", [], { STUB_RESET: "1" });
    expect(r.status, r.out).toBe(0);
    expect(h.calls().filter((c) => c.startsWith("stellar contract deploy"))).toHaveLength(2);
  });

  it("refuses a STELLAR_ACCOUNT that looks like a secret key, without running anything (INV-04)", async () => {
    const secret = `S${"A".repeat(55)}`;
    const env = readFileSync(join(h.root, ".env"), "utf8").replace(
      /STELLAR_ACCOUNT=.*/,
      `STELLAR_ACCOUNT=${secret}`,
    );
    await writeFile(join(h.root, ".env"), env);
    const r = h.script("setup.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("identity name");
    expect(r.out).not.toContain(secret);
    expect(h.calls()).toEqual([]);
  });
});

describe("mainnet (INV-03)", () => {
  beforeEach(async () => {
    const env = readFileSync(join(h.root, ".env"), "utf8")
      .replace("NEXT_PUBLIC_STELLAR_NETWORK=testnet", "NEXT_PUBLIC_STELLAR_NETWORK=mainnet")
      .replace(
        /NEXT_PUBLIC_STELLAR_RPC_URL=.*/,
        "NEXT_PUBLIC_STELLAR_RPC_URL=https://rpc.example.invalid",
      );
    await writeFile(join(h.root, ".env"), env);
  });

  it.each(["setup.mjs", "deploy.mjs"])(
    "%s prints the deploy command and exits 1 without --confirm-mainnet",
    async (name) => {
      // An existing identity, so setup gets as far as the deploy step.
      await h.setState({ keys: ["dev"], deployed: {} });
      const r = h.script(name);
      expect(r.status).toBe(1);
      expect(r.out).toContain("--confirm-mainnet");
      expect(r.out).toContain("stellar contract deploy");
      expect(h.calls().filter((c) => c.startsWith("stellar contract deploy"))).toEqual([]);
      expect(h.calls().filter((c) => c.startsWith("stellar keys generate"))).toEqual([]);
    },
  );

  it("never generates or funds an identity on mainnet", () => {
    const r = h.script("setup.mjs", ["--confirm-mainnet"]);
    expect(r.status).toBe(1);
    expect(r.out).toContain("stellar keys");
    expect(h.calls().filter((c) => c.startsWith("stellar keys generate"))).toEqual([]);
  });

  it("deploys with --confirm-mainnet, using the RPC URL and passphrase from .env", async () => {
    await h.setState({ keys: ["dev"], deployed: {} });
    const r = h.script("deploy.mjs", ["--confirm-mainnet"]);
    expect(r.status, r.out).toBe(0);
    const deploy = h.calls().find((c) => c.startsWith("stellar contract deploy")) ?? "";
    expect(deploy).toContain("--rpc-url https://rpc.example.invalid");
    expect(deploy).toContain("--network-passphrase Public Global Stellar Network ; September 2015");
  });
});

describe("contracts:bindings", () => {
  it("tells you to build first when no Wasm exists", () => {
    const r = h.script("bindings.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("contracts:build");
  });
});

describe("generated client header (T-503)", () => {
  const HEADER = "// Generated by the contracts:bindings script";

  it("starts every generated code file with a header naming the script that regenerates it", () => {
    expect(h.script("setup.mjs").status).toBe(0);
    for (const f of ["packages/hello_world/src/index.ts", "packages/hello_world/dist/index.js"]) {
      expect(readFileSync(join(h.root, f), "utf8").startsWith(HEADER), f).toBe(true);
    }
  });

  it("survives regeneration without being duplicated", () => {
    h.script("setup.mjs");
    expect(h.script("bindings.mjs").status).toBe(0);
    const text = readFileSync(join(h.root, "packages/hello_world/src/index.ts"), "utf8");
    expect(text.split(HEADER).length - 1).toBe(1);
  });
});
