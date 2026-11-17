import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli.ts";
import { type ComposeContext, compose } from "../../src/lib/compose.ts";
import { modulesFor } from "../../src/modules/index.ts";
import { type FakeRunner, fakeRunner } from "./fake-runner.ts";
import { createHarness, type Harness } from "./project-harness.ts";

// Shaped like a contract address (C + 55 base32 characters). Not a real contract.
const ID = `C${"B".repeat(55)}`;
const ctx: ComposeContext = {
  projectName: "my-app",
  network: "testnet",
  style: "none",
  contracts: ID,
};

describe("compose with --contracts <id>", () => {
  const out = compose(modulesFor(ctx), ctx);
  const files = new Map(out.files.map((f) => [f.path, f.content]));
  const pkg = JSON.parse(files.get("package.json") ?? "{}") as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
  };

  it("writes a typed-client setup with no Rust workspace", () => {
    expect(files.get("lib/contracts.ts")).toContain("NEXT_PUBLIC_STELLAR_CONTRACT_ID");
    expect([...files.keys()].filter((p) => p.startsWith("contracts/"))).toEqual([]);
    expect(out.commands).toEqual([]);
    expect(out.requires).not.toContain("cargo");
    expect(pkg.scripts.setup).toBeDefined();
    expect(pkg.scripts["contracts:bindings"]).toBeDefined();
    expect(pkg.scripts["contracts:build"]).toBeUndefined();
    expect(pkg.dependencies["@stellar/stellar-sdk"]).toBe("17.4.0");
  });

  it("puts the contract ID in .env", () => {
    expect(files.get(".env")).toContain(`NEXT_PUBLIC_STELLAR_CONTRACT_ID=${ID}\n`);
  });

  it("keeps the plain home page", () => {
    expect(files.get("app/page.tsx")).not.toContain("@/lib/contracts");
  });
});

describe("create --contracts <id>", () => {
  let cwd: string;
  let fake: FakeRunner;
  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "csn-id-"));
    fake = fakeRunner();
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });
  const run = (...argv: string[]) =>
    main(argv, { cwd, createRunner: fake.factory, nodeVersion: "24.18.1" });

  it("installs only, needs no Rust or Stellar CLI, and lists setup as the next step", async () => {
    fake = fakeRunner({ missing: ["cargo", "stellar"] });
    const r = await run("my-app", "--yes", "--contracts", ID);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(fake.calls.map((c) => [c.command, ...c.args].join(" "))).toEqual(["npm install"]);
    expect(existsSync(join(cwd, "my-app/contracts"))).toBe(false);
    expect(r.stdout).toMatch(/npm run setup[\s\S]*npm run dev/);
  });

  it.each(["CABC", `G${"B".repeat(55)}`, `c${"b".repeat(55)}`])(
    "rejects %s as a contract ID with exit 2",
    async (bad) => {
      const r = await run("my-app", "--yes", "--contracts", bad);
      expect(r.exitCode).toBe(2);
      expect(r.stderr).toContain("--contracts");
      expect(existsSync(join(cwd, "my-app"))).toBe(false);
    },
  );
});

describe("create --contracts hello-world next steps", () => {
  it("lists setup before dev", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "csn-next-"));
    try {
      const r = await main(["my-app", "--yes", "--json"], {
        cwd,
        createRunner: fakeRunner().factory,
        nodeVersion: "24.18.1",
      });
      expect(JSON.parse(r.stdout).next).toEqual(["cd my-app", "npm run setup", "npm run dev"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe("setup for a contract ID", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness(ID);
  });
  afterEach(async () => {
    await h.cleanup();
  });

  it("generates the client from the network with the stock generator, then compiles it", () => {
    const r = h.script("setup.mjs");
    expect(r.status, r.out).toBe(0);
    expect(h.calls()).toEqual([
      `npx @stellar/stellar-sdk generate --contract-id ${ID} --network testnet --rpc-url https://soroban-testnet.stellar.org --output-dir packages/contract --contract-name contract --overwrite`,
      "npx tsc -p packages/contract/tsconfig.json",
    ]);
    expect(existsSync(join(h.root, "packages/contract/dist/index.js"))).toBe(true);
  });

  it("changes nothing when run twice", () => {
    h.script("setup.mjs");
    const before = h.tree();
    expect(h.script("setup.mjs").status).toBe(0);
    expect(h.tree()).toBe(before);
  });

  it("explains a network failure and exits 1", () => {
    const r = h.script("setup.mjs", [], { STUB_OFFLINE: "1" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("failed");
  });

  it("refuses to run without a contract ID in .env", () => {
    const env = readFileSync(join(h.root, ".env"), "utf8").replace(
      /NEXT_PUBLIC_STELLAR_CONTRACT_ID=.*/,
      "NEXT_PUBLIC_STELLAR_CONTRACT_ID=",
    );
    writeFileSync(join(h.root, ".env"), env);
    const r = h.script("setup.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("NEXT_PUBLIC_STELLAR_CONTRACT_ID");
    expect(h.calls()).toEqual([]);
  });
});
