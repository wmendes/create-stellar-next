import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli.ts";
import { MANIFEST_FILE, readManifest } from "../../src/lib/manifest.ts";
import { TOOL_NAME } from "../../src/name.ts";

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "csn-create-"));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

const run = (...argv: string[]) => main(argv, { cwd });

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

  it("prints the next commands to run", async () => {
    const result = await run("my-app", "--contracts", "none");
    expect(result.stdout).toContain("cd my-app");
    expect(result.stdout).toContain("npm install");
    expect(result.stdout).toContain("npm run dev");
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
    expect(result.stdout).toContain("pnpm install");
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
