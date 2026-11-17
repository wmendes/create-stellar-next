import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli.ts";
import { MANIFEST_FILE, readManifest } from "../../src/lib/manifest.ts";
import { TOOL_NAME } from "../../src/name.ts";
import { type FakeRunner, fakeRunner } from "./fake-runner.ts";

let cwd: string;
let fake: FakeRunner;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "csn-create-"));
  fake = fakeRunner();
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

const run = (...argv: string[]) => main(argv, { cwd, createRunner: fake.factory });

describe("create my-app --contracts none --wallet none", () => {
  it("writes the base project, records every file in the manifest, and exits 0", async () => {
    const result = await run("my-app", "--contracts", "none", "--wallet", "none");
    expect(result.exitCode, result.stderr).toBe(0);
    const root = join(cwd, "my-app");
    for (const f of ["package.json", "app/page.tsx", "lib/stellar.ts", "AGENTS.md", ".env"]) {
      expect(existsSync(join(root, f)), f).toBe(true);
    }
    const manifest = await readManifest(root);
    expect(Object.keys(manifest.files)).toContain("app/page.tsx");
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    expect(pkg.name).toBe("my-app");
    expect(JSON.stringify(pkg)).not.toContain(TOOL_NAME);
  });

  it("installs dependencies in the project, then prints the next commands", async () => {
    const result = await run("my-app", "--contracts", "none");
    expect(fake.calls.map((c) => [c.command, ...c.args].join(" "))).toEqual(["npm install"]);
    expect(fake.calls[0]?.cwd).toBe(join(cwd, "my-app"));
    expect(result.stdout).toContain("cd my-app");
    expect(result.stdout).toContain("npm run dev");
    expect(result.stdout).not.toContain("npm install");
  });

  it("does not install on --dry-run", async () => {
    await run("my-app", "--contracts", "none", "--dry-run");
    expect(fake.dryRuns).toEqual([true]);
    expect(existsSync(join(cwd, "my-app"))).toBe(false);
  });

  it("exits 1 when the install fails, keeps the files and names the command to retry", async () => {
    fake = fakeRunner({ fail: () => true });
    const result = await run("my-app", "--contracts", "none");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Run `npm install` in my-app");
    expect(existsSync(join(cwd, "my-app/package.json"))).toBe(true);
  });

  it("exits 3 before writing anything when the package manager is missing", async () => {
    fake = fakeRunner({ missing: ["pnpm"] });
    const result = await run("my-app", "--contracts", "none", "--package-manager", "pnpm");
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("pnpm");
    expect(existsSync(join(cwd, "my-app"))).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it("defaults to testnet and Tailwind", async () => {
    await run("my-app", "--contracts", "none");
    const root = join(cwd, "my-app");
    expect(await readFile(join(root, ".env"), "utf8")).toContain(
      "NEXT_PUBLIC_STELLAR_NETWORK=testnet",
    );
    expect(await readFile(join(root, "app/globals.css"), "utf8")).toContain("tailwindcss");
  });

  it("honours --network mainnet and --style none", async () => {
    await run("my-app", "--contracts", "none", "--network", "mainnet", "--style", "none");
    const root = join(cwd, "my-app");
    expect(await readFile(join(root, ".env"), "utf8")).toContain("NEXT_PUBLIC_STELLAR_RPC_URL=\n");
    expect(await readFile(join(root, "app/globals.css"), "utf8")).not.toContain("tailwind");
  });

  it("uses the package manager named by --package-manager in the next steps", async () => {
    const result = await run("my-app", "--contracts", "none", "--package-manager", "pnpm");
    expect(fake.calls[0]?.command).toBe("pnpm");
    expect(result.stdout).toContain("pnpm dev");
  });

  it("changes nothing when run a second time", async () => {
    await run("my-app", "--contracts", "none");
    const before = await readFile(join(cwd, "my-app", MANIFEST_FILE), "utf8");
    const again = await run("my-app", "--contracts", "none");
    expect(again.exitCode, again.stderr).toBe(0);
    expect(await readFile(join(cwd, "my-app", MANIFEST_FILE), "utf8")).toBe(before);
  });

  it("refuses to overwrite a file the user edited, naming --force", async () => {
    await run("my-app", "--contracts", "none");
    await writeFile(join(cwd, "my-app", "app/page.tsx"), "// mine\n");
    const again = await run("my-app", "--contracts", "none", "--style", "none");
    expect(again.exitCode).toBe(1);
    expect(again.stderr).toContain("app/page.tsx");
    expect(again.stderr).toContain("--force");
  });

  it("writes into an existing empty directory", async () => {
    await mkdir(join(cwd, "empty"));
    const result = await run("empty", "--contracts", "none");
    expect(result.exitCode, result.stderr).toBe(0);
  });
});

describe("invalid arguments exit 2 and name the fix", () => {
  it.each([
    [[], "<dir>"],
    [["my-app", "--network", "futurenet"], "--network"],
    [["my-app", "--style", "bootstrap"], "--style"],
    [["my-app", "--wallet", "metamask"], "--wallet"],
    [["my-app", "--package-manager", "deno"], "--package-manager"],
    [["My App", "--contracts", "none"], "name"],
    [["a", "b", "--contracts", "none"], "one directory"],
  ])("%j", async (argv, mention) => {
    const result = await run(...argv);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(mention);
    expect(result.stderr).toContain(`${TOOL_NAME} --help`);
    expect(existsSync(join(cwd, "my-app"))).toBe(false);
  });
});

describe("options not built yet", () => {
  it.each([
    [["my-app"], "--contracts none"],
    [["my-app", "--contracts", "none", "--wallet", "wallets-kit"], "--wallet none"],
    [["my-app", "--contracts", "none", "--local"], "--local"],
  ])("%j fails with exit 1, writes nothing and says what works today", async (argv, works) => {
    const result = await run(...argv);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(works);
    expect(existsSync(join(cwd, "my-app"))).toBe(false);
  });
});
