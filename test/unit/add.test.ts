import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv } from "ajv";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CliEnv, main } from "../../src/cli.ts";
import { MANIFEST_FILE } from "../../src/lib/manifest.ts";
import { type FakeRunner, fakeRunner } from "./fake-runner.ts";

const validate = new Ajv().compile(
  JSON.parse(
    readFileSync(new URL("../../schemas/output.schema.json", import.meta.url), "utf8"),
  ) as object,
);
const ID = `C${"B".repeat(55)}`;

let cwd: string;
let app: string;
let fake: FakeRunner;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "csn-add-"));
  app = join(cwd, "app");
  fake = fakeRunner();
  const r = await main(["app", "--yes", "--contracts", "none"], env(cwd));
  expect(r.exitCode, r.stderr).toBe(0);
  fake = fakeRunner();
});
afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

function env(dir: string): CliEnv {
  return { cwd: dir, createRunner: (o) => fake.factory(o), nodeVersion: "24.18.1" };
}
const add = (...args: string[]) => main(["add", ...args], env(app));
const read = (f: string) => readFileSync(join(app, f), "utf8");
const pkg = () =>
  JSON.parse(read("package.json")) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
  };
const snapshot = () =>
  ["package.json", ".env", ".env.example", "AGENTS.md", MANIFEST_FILE].map((f) =>
    existsSync(join(app, f)) ? read(f) : null,
  );

describe("add local", () => {
  it("adds the network scripts and documents them, leaving .env on testnet (INV-02)", async () => {
    const r = await add("local", "--json");
    expect(r.exitCode, r.stdout).toBe(0);
    expect(validate(JSON.parse(r.stdout))).toBe(true);
    expect(pkg().scripts["network:start"]).toBe("stellar container start local");
    expect(pkg().scripts["network:stop"]).toBe("stellar container stop local");
    expect(read(".env")).toContain("NEXT_PUBLIC_STELLAR_NETWORK=testnet");
    expect(read("AGENTS.md")).toContain("`network:start`");
    expect(fake.calls).toEqual([]);
  });

  it("changes nothing the second time (INV-10)", async () => {
    await add("local");
    const before = snapshot();
    const r = await add("local");
    expect(r.exitCode, r.stderr).toBe(0);
    expect(snapshot()).toEqual(before);
  });

  it("keeps the user's edits to package.json, .env and AGENTS.md outside the tool's block", async () => {
    const p = pkg() as Record<string, unknown> & { dependencies: Record<string, string> };
    p.dependencies["left-pad"] = "1.3.0";
    await writeFile(join(app, "package.json"), `${JSON.stringify(p, null, 2)}\n`);
    await writeFile(join(app, ".env"), `${read(".env")}MY_KEY=mine\n`);
    await writeFile(
      join(app, "AGENTS.md"),
      `${read("AGENTS.md")}\n## Our team notes\nKeep this.\n`,
    );
    const r = await add("local");
    expect(r.exitCode, r.stderr).toBe(0);
    expect(pkg().dependencies["left-pad"]).toBe("1.3.0");
    expect(read(".env")).toContain("MY_KEY=mine");
    expect(read("AGENTS.md")).toContain("## Our team notes\nKeep this.");
    expect(read("AGENTS.md")).toContain("`network:start`");
  });

  it("refuses to replace a script the user defined differently, unless --force", async () => {
    const p = pkg();
    p.scripts["network:start"] = "docker compose up";
    await writeFile(join(app, "package.json"), `${JSON.stringify(p, null, 2)}\n`);
    const before = snapshot();
    const r = await add("local");
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("network:start");
    expect(r.stderr).toContain("--force");
    expect(snapshot()).toEqual(before);
    expect((await add("local", "--force")).exitCode).toBe(0);
    expect(pkg().scripts["network:start"]).toBe("stellar container start local");
  });

  it("refuses to rewrite the tool's AGENTS.md block after the user edited it, unless --force", async () => {
    await writeFile(
      join(app, "AGENTS.md"),
      read("AGENTS.md").replace("## Rules", "## Rules (ours)"),
    );
    const r = await add("local");
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("AGENTS.md");
    expect((await add("local", "--force")).exitCode).toBe(0);
  });

  it("writes nothing on --dry-run", async () => {
    const before = snapshot();
    const r = await add("local", "--dry-run");
    expect(r.exitCode, r.stderr).toBe(0);
    expect(snapshot()).toEqual(before);
  });
});

describe("add contract", () => {
  it("adds the hello-world workspace: init, scripts, lib/contracts.ts, the SDK and STELLAR_ACCOUNT", async () => {
    const r = await add("contract");
    expect(r.exitCode, r.stderr).toBe(0);
    expect(fake.calls.map((c) => [c.command, ...c.args].join(" "))).toEqual([
      "stellar contract init contracts",
      "npm install",
    ]);
    expect(pkg().scripts.setup).toBe("node scripts/setup.mjs");
    expect(pkg().dependencies["@stellar/stellar-sdk"]).toBe("17.4.0");
    expect(existsSync(join(app, "lib/contracts.ts"))).toBe(true);
    expect(read(".env")).toContain("STELLAR_ACCOUNT=dev");
    expect(read("AGENTS.md")).toContain("contracts/AGENTS.md");
    expect(r.stdout).toContain("npm run setup");
  });

  it("leaves the existing home page alone", async () => {
    const page = read("app/page.tsx");
    await add("contract");
    expect(read("app/page.tsx")).toBe(page);
  });

  it("changes nothing the second time", async () => {
    await add("contract");
    const before = snapshot();
    expect((await add("contract")).exitCode).toBe(0);
    expect(snapshot()).toEqual(before);
  });

  it("adds a typed client for a deployed contract with `add contract <id>`", async () => {
    const r = await add("contract", ID);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(read(".env")).toContain(`NEXT_PUBLIC_STELLAR_CONTRACT_ID=${ID}`);
    expect(read("lib/contracts.ts")).toContain("NEXT_PUBLIC_STELLAR_CONTRACT_ID");
    expect(fake.calls.map((c) => c.command)).toEqual(["npm"]);
  });

  it("refuses a second kind of contract setup in the same project", async () => {
    await add("contract");
    const r = await add("contract", ID);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain("already");
  });

  it("rejects something that is not a contract ID with exit 2", async () => {
    expect((await add("contract", "nope")).exitCode).toBe(2);
  });
});

describe("add, in sequence", () => {
  it("add local, then add contract, then both again changes nothing", async () => {
    expect((await add("local")).exitCode).toBe(0);
    expect((await add("contract")).exitCode).toBe(0);
    const before = snapshot();
    const again = await add("contract");
    expect(again.exitCode, again.stderr).toBe(0);
    expect((await add("local")).exitCode).toBe(0);
    expect(snapshot()).toEqual(before);
  });
});

describe("add, other cases", () => {
  it("exits 2 outside a project", async () => {
    const r = await main(["add", "local"], env(cwd));
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain("package.json");
  });

  it("add envs needs the contracts workspace first", async () => {
    const r = await add("envs");
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain("add contract");
  });

  it("add envs after add contract writes stellar.envs.toml and envs:apply, idempotently", async () => {
    expect((await add("contract")).exitCode).toBe(0);
    const r = await add("envs");
    expect(r.exitCode, r.stderr).toBe(0);
    expect(read("stellar.envs.toml")).toContain("[testnet]");
    expect(pkg().scripts["envs:apply"]).toBe("node scripts/envs.mjs");
    const before = snapshot();
    expect((await add("envs")).exitCode).toBe(0);
    expect(snapshot()).toEqual(before);
  });

  it.each([["database"], ["registry"]])("rejects add %s with exit 2", async (m) => {
    expect((await add(m)).exitCode).toBe(2);
  });
});

describe("create --local", () => {
  it("adds the network scripts at creation, and doctor will check Docker", async () => {
    const r = await main(["local-app", "--yes", "--contracts", "none", "--local"], env(cwd));
    expect(r.exitCode, r.stderr).toBe(0);
    const scripts = JSON.parse(readFileSync(join(cwd, "local-app/package.json"), "utf8")).scripts;
    expect(scripts["network:start"]).toBe("stellar container start local");
  });
});
