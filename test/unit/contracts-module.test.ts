import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli.ts";
import { type ComposeContext, compose } from "../../src/lib/compose.ts";
import { modulesFor } from "../../src/modules/index.ts";
import { type FakeRunner, fakeRunner } from "./fake-runner.ts";

const ctx: ComposeContext = {
  projectName: "my-app",
  network: "testnet",
  style: "tailwind",
  contracts: "hello-world",
};

describe("contracts module (hello-world)", () => {
  const modules = modulesFor(ctx);
  const out = compose(modules, ctx);
  const files = new Map(out.files.map((f) => [f.path, f.content]));
  const pkg = JSON.parse(files.get("package.json") ?? "{}") as { scripts: Record<string, string> };

  it("adds build and test scripts that run the stock tools from the project root", () => {
    expect(pkg.scripts["contracts:build"]).toBe(
      "stellar contract build --manifest-path contracts/Cargo.toml",
    );
    expect(pkg.scripts["contracts:test"]).toBe("cargo test --manifest-path contracts/Cargo.toml");
  });

  it("runs stellar contract init into contracts/ after writing", () => {
    expect(out.commands).toEqual([
      expect.objectContaining({ command: "stellar", args: ["contract", "init", "contracts"] }),
    ]);
  });

  it("points the root AGENTS.md at contracts/AGENTS.md and lists the contract scripts", () => {
    const agents = files.get("AGENTS.md") ?? "";
    expect(agents).toContain("contracts/AGENTS.md");
    expect(agents).toContain("`contracts:build`");
    expect(agents).toContain("`contracts:test`");
    expect(agents.split("\n").length).toBeLessThan(80);
  });

  it("declares doctor checks for the Stellar CLI, cargo and the wasm32v1-none target", () => {
    expect(out.doctor.map((d) => d.id)).toEqual(
      expect.arrayContaining(["node", "stellar", "cargo", "wasm32v1-none"]),
    );
  });
});

describe("--contracts none", () => {
  const out = compose(modulesFor({ ...ctx, contracts: "none" }), { ...ctx, contracts: "none" });
  const files = new Map(out.files.map((f) => [f.path, f.content]));

  it("adds no contract scripts, commands or AGENTS.md pointer", () => {
    expect(files.get("package.json")).not.toContain("contracts:");
    expect(out.commands).toEqual([]);
    expect(files.get("AGENTS.md")).not.toContain("contracts/AGENTS.md");
  });
});

describe("create --contracts hello-world", () => {
  let cwd: string;
  let fake: FakeRunner;
  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "csn-contracts-"));
    fake = fakeRunner();
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });
  const run = (...argv: string[]) =>
    main(argv, { cwd, createRunner: fake.factory, nodeVersion: "24.18.1" });

  it("is the default, and runs init and then install in the project", async () => {
    const r = await run("my-app", "--yes");
    expect(r.exitCode, r.stderr).toBe(0);
    expect(fake.calls.map((c) => [c.command, ...c.args].join(" "))).toEqual([
      "stellar contract init contracts",
      "npm install",
    ]);
    expect(fake.calls.every((c) => c.cwd === join(cwd, "my-app"))).toBe(true);
    const pkg = await readFile(join(cwd, "my-app/package.json"), "utf8");
    expect(pkg).toContain("contracts:build");
  });

  it.each(["stellar", "cargo"])(
    "exits 3 before writing anything when %s is missing",
    async (missing) => {
      fake = fakeRunner({ missing: [missing] });
      const r = await run("my-app", "--yes");
      expect(r.exitCode).toBe(3);
      expect(r.stderr).toContain(missing);
      expect(existsSync(join(cwd, "my-app"))).toBe(false);
      expect(fake.calls).toEqual([]);
    },
  );

  it("stops with exit 1 and the retry command when init fails, without installing", async () => {
    fake = fakeRunner({ fail: (spec) => spec.command === "stellar" });
    const r = await run("my-app", "--yes");
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("stellar contract init contracts");
    expect(fake.calls.map((c) => c.command)).toEqual(["stellar"]);
  });

  it("plans init and install on --dry-run without running them", async () => {
    const r = await run("my-app", "--yes", "--dry-run");
    expect(r.exitCode, r.stderr).toBe(0);
    expect(fake.dryRuns).toEqual([true]);
    expect(existsSync(join(cwd, "my-app"))).toBe(false);
  });
});

describe("home page (T-204)", () => {
  const page = (contracts: "hello-world" | "none") => {
    const c = { ...ctx, contracts };
    return compose(modulesFor(c), c).files.find((f) => f.path === "app/page.tsx")?.content ?? "";
  };

  it("calls the hello_world contract at request time, with no wallet, when contracts exist", () => {
    const content = page("hello-world");
    expect(content).toContain('from "@/lib/contracts"');
    expect(content).toContain("await connection()");
    expect(content).toContain('data-testid="greeting"');
    expect(content).not.toMatch(/wallet/i);
  });

  it("makes no contract call without contracts", () => {
    expect(page("none")).not.toContain("@/lib/contracts");
  });
});
