import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CliEnv, main } from "../../src/cli.ts";
import { type ComposeContext, compose } from "../../src/lib/compose.ts";
import { modulesFor } from "../../src/modules/index.ts";
import { type FakeRunner, fakeRunner } from "./fake-runner.ts";

const ctx = (wallet: string): ComposeContext => ({
  projectName: "my-app",
  network: "testnet",
  style: "none",
  contracts: "none",
  wallet,
});
const filesFor = (wallet: string) =>
  new Map(compose(modulesFor(ctx(wallet)), ctx(wallet)).files.map((f) => [f.path, f.content]));
const INTERFACE = ["connect", "disconnect", "getAddress", "signTransaction"];

describe.each([
  ["wallets-kit", "@creit.tech/stellar-wallets-kit", "2.8.0"],
  ["extension", "@stellar/varial-sdk", "7.0.0"],
])("--wallet %s", (wallet, pkgName, version) => {
  const files = filesFor(wallet);

  it("writes lib/wallet/index.ts exporting the shared interface", () => {
    const lib = files.get("lib/wallet/index.ts") ?? "";
    for (const fn of INTERFACE) expect(lib).toMatch(new RegExp(`export async function ${fn}\\(`));
    expect(lib).toContain(pkgName);
  });

  it("adds a connect button that uses only the interface", () => {
    const button = files.get("components/connect-wallet.tsx") ?? "";
    expect(button).toContain('"use client"');
    expect(button).toContain('from "@/lib/wallet"');
    expect(button).toContain('data-testid="connect-wallet"');
    expect(button).not.toContain(pkgName);
  });

  it("pins the library", () => {
    const pkg = JSON.parse(files.get("package.json") ?? "{}") as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies[pkgName]).toBe(version);
  });

  it("leaves the home page alone", () => {
    expect(files.get("app/page.tsx")).toBe(filesFor("none").get("app/page.tsx"));
  });
});

describe("wallet commands", () => {
  let cwd: string;
  let app: string;
  let fake: FakeRunner;
  const env = (dir: string): CliEnv => ({
    cwd: dir,
    createRunner: (o) => fake.factory(o),
    nodeVersion: "24.18.1",
  });
  const read = (f: string) => readFileSync(join(app, f), "utf8");

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "csn-wallet-"));
    app = join(cwd, "app");
    fake = fakeRunner();
    expect((await main(["app", "--yes", "--contracts", "none"], env(cwd))).exitCode).toBe(0);
    fake = fakeRunner();
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it.each([
    ["create", ["p", "--yes", "--contracts", "none", "--wallet", "passkeys"]],
    ["add", ["add", "wallet", "--wallet", "passkeys"]],
  ])(
    "%s rejects --wallet passkeys, which is not in v0 (DEC-025), with exit 2",
    async (_label, argv) => {
      const r = await main(argv as string[], env(argv[0] === "add" ? app : cwd));
      expect(r.exitCode).toBe(2);
      expect(r.stderr).toContain("wallets-kit");
      expect(existsSync(join(cwd, "p"))).toBe(false);
    },
  );

  it("add wallet needs --wallet", async () => {
    const r = await main(["add", "wallet"], env(app));
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain("--wallet");
  });

  it("adds a wallet, installs it, and changes nothing the second time", async () => {
    const r = await main(["add", "wallet", "--wallet", "extension"], env(app));
    expect(r.exitCode, r.stderr).toBe(0);
    expect(fake.calls.map((c) => [c.command, ...c.args].join(" "))).toEqual(["npm install"]);
    const before = [read("lib/wallet/index.ts"), read("package.json"), read("AGENTS.md")];
    expect((await main(["add", "wallet", "--wallet", "extension"], env(app))).exitCode).toBe(0);
    expect([read("lib/wallet/index.ts"), read("package.json"), read("AGENTS.md")]).toEqual(before);
  });

  it("swaps the adapter for another wallet without touching pages or the button", async () => {
    await main(["add", "wallet", "--wallet", "extension"], env(app));
    const page = read("app/page.tsx");
    const button = read("components/connect-wallet.tsx");
    const r = await main(["add", "wallet", "--wallet", "wallets-kit"], env(app));
    expect(r.exitCode, r.stderr).toBe(0);
    expect(read("lib/wallet/index.ts")).toContain("@creit.tech/stellar-wallets-kit");
    expect(read("app/page.tsx")).toBe(page);
    expect(read("components/connect-wallet.tsx")).toBe(button);
    expect(existsSync(join(app, ".npmrc"))).toBe(false);
    expect(read("AGENTS.md")).toContain("Stellar Wallets Kit");
    expect(read("AGENTS.md")).not.toContain("Varial");
  });

  it("refuses to replace an edited adapter without --force", async () => {
    await main(["add", "wallet", "--wallet", "extension"], env(app));
    await writeFile(join(app, "lib/wallet/index.ts"), `${read("lib/wallet/index.ts")}// mine\n`);
    const r = await main(["add", "wallet", "--wallet", "wallets-kit"], env(app));
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("lib/wallet/index.ts");
  });
});
