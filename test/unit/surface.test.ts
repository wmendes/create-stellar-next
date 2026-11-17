import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv } from "ajv";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CliEnv, main, type PromptFn } from "../../src/cli.ts";
import { TOOL_NAME } from "../../src/name.ts";
import { fakeRunner } from "./fake-runner.ts";

const schema = JSON.parse(
  readFileSync(new URL("../../schemas/output.schema.json", import.meta.url), "utf8"),
) as object;
const validate = new Ajv({ allErrors: true }).compile(schema);

let cwd: string;
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "csn-surface-"));
});
afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

const neverPrompt: PromptFn = () => {
  throw new Error("prompted when it must not");
};
const run = (argv: string[], env: Partial<CliEnv> = {}) =>
  main(argv, {
    cwd,
    isTTY: false,
    prompt: neverPrompt,
    nodeVersion: "24.18.1",
    createRunner: fakeRunner().factory,
    ...env,
  });

interface Output {
  schemaVersion: number;
  files: { path: string; action: string }[];
  next: string[];
  errors: { code: string; message: string; fix: string }[];
}

function json(stdout: string): Output {
  const value = JSON.parse(stdout) as Output;
  expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
  return value;
}

describe("--json", () => {
  it("prints exactly one schema-valid object on success, with no errors", async () => {
    const r = await run(["my-app", "--contracts", "none", "--json"]);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout.trim().split("\n").length).toBe(1);
    const out = json(r.stdout);
    expect(out.errors).toEqual([]);
    expect(out.files.find((f) => f.path === "app/page.tsx")?.action).toBe("create");
    expect(out.schemaVersion).toBe(2);
    expect(out.next).toEqual(["cd my-app", "npm run dev"]);
  });

  it("reports a failed install as COMMAND_FAILED with exit 1 and the retry steps", async () => {
    const r = await run(["my-app", "--contracts", "none", "--json"], {
      createRunner: fakeRunner({ fail: () => true }).factory,
    });
    expect(r.exitCode).toBe(1);
    const out = json(r.stdout);
    expect(out.errors[0]?.code).toBe("COMMAND_FAILED");
    expect(out.next).toEqual(["cd my-app", "npm install", "npm run dev"]);
  });

  it.each([
    [["my-app", "--network", "futurenet", "--json"], 2, "INVALID_ARGUMENT"],
    [["my-app", "--no-such-flag", "--json"], 2, "INVALID_ARGUMENT"],
    [["--json"], 2, "INVALID_ARGUMENT"],
    [["my-app", "--envs", "--json"], 1, "NOT_BUILT"],
    [["my-app", "--registry", "--json"], 2, "INVALID_ARGUMENT"],
    [["my-app", "--wallet", "passkeys", "--json"], 2, "INVALID_ARGUMENT"],
  ])("reports %j as JSON with exit %i and code %s", async (argv, exitCode, code) => {
    const r = await run(argv);
    expect(r.exitCode).toBe(exitCode);
    expect(r.stderr).toBe("");
    const out = json(r.stdout);
    expect(out.errors.map((e) => e.code)).toEqual([code]);
    expect(out.errors[0]?.fix.length).toBeGreaterThan(0);
  });

  it("reports edited files as EDITED_FILES with exit 1", async () => {
    await run(["my-app", "--contracts", "none"]);
    await writeFile(join(cwd, "my-app/app/page.tsx"), "// mine\n");
    const r = await run(["my-app", "--contracts", "none", "--style", "none", "--json"]);
    expect(r.exitCode).toBe(1);
    const out = json(r.stdout);
    expect(out.errors[0]?.code).toBe("EDITED_FILES");
    expect(out.files.find((f) => f.path === "app/page.tsx")?.action).toBe("conflict");
  });
});

describe("--dry-run", () => {
  it("prints the plan and writes nothing (INV-09)", async () => {
    const r = await run(["my-app", "--contracts", "none", "--dry-run"]);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(r.stdout).toContain("Dry run");
    expect(r.stdout).toContain("create app/page.tsx");
    expect(existsSync(join(cwd, "my-app"))).toBe(false);
  });

  it("with --json lists the planned actions", async () => {
    const r = await run(["my-app", "--contracts", "none", "--dry-run", "--json"]);
    expect(json(r.stdout).files.every((f) => f.action === "create")).toBe(true);
    expect(existsSync(join(cwd, "my-app"))).toBe(false);
  });

  it("on an edited project reports the conflict and changes nothing", async () => {
    await run(["my-app", "--contracts", "none"]);
    await writeFile(join(cwd, "my-app/app/page.tsx"), "// mine\n");
    const before = await readFile(join(cwd, "my-app/.create-stellar-next.json"), "utf8");
    const r = await run(["my-app", "--contracts", "none", "--style", "none", "--dry-run"]);
    expect(r.exitCode).toBe(1);
    expect(await readFile(join(cwd, "my-app/app/page.tsx"), "utf8")).toBe("// mine\n");
    expect(await readFile(join(cwd, "my-app/.create-stellar-next.json"), "utf8")).toBe(before);
  });
});

describe("missing prerequisite", () => {
  it("exits 3 when Node is older than 22.12.0, names the fix and writes nothing", async () => {
    const r = await run(["my-app", "--contracts", "none"], { nodeVersion: "22.11.0" });
    expect(r.exitCode).toBe(3);
    expect(r.stderr).toContain("22.12.0");
    expect(r.stderr).toContain("nodejs.org");
    expect(existsSync(join(cwd, "my-app"))).toBe(false);
  });

  it("reports it as MISSING_PREREQUISITE with --json", async () => {
    const r = await run(["my-app", "--contracts", "none", "--json"], { nodeVersion: "20.9.0" });
    expect(r.exitCode).toBe(3);
    expect(json(r.stdout).errors[0]?.code).toBe("MISSING_PREREQUISITE");
  });
});

describe("prompts (INV-06)", () => {
  it("asks for <dir> on a TTY when it is missing, then creates the app", async () => {
    let asked = "";
    const prompt: PromptFn = async (q) => {
      asked = q.message;
      return "from-prompt";
    };
    const r = await run(["--contracts", "none"], { isTTY: true, prompt });
    expect(asked).not.toBe("");
    expect(r.exitCode, r.stderr).toBe(0);
    expect(existsSync(join(cwd, "from-prompt/package.json"))).toBe(true);
  });

  it("validates the answer as a project name", async () => {
    let check: ((v: string | undefined) => string | undefined) | undefined;
    const prompt: PromptFn = async (q) => {
      check = q.validate;
      return "ok-name";
    };
    await run(["--contracts", "none"], { isTTY: true, prompt });
    expect(check?.("Bad Name")).toMatch(/lowercase/);
    expect(check?.("")).toBeDefined();
    expect(check?.("good-name")).toBeUndefined();
  });

  it("exits 1 and writes nothing when the prompt is cancelled", async () => {
    const r = await run(["--contracts", "none"], { isTTY: true, prompt: async () => undefined });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("Cancelled");
  });

  it.each([
    ["--yes on a TTY", ["--contracts", "none", "--yes"], true],
    ["--json on a TTY", ["--contracts", "none", "--json"], true],
    ["no TTY", ["--contracts", "none"], false],
  ])("never prompts with %s, and exits 2 for the missing <dir>", async (_label, argv, isTTY) => {
    const r = await run(argv as string[], { isTTY: isTTY as boolean });
    expect(r.exitCode).toBe(2);
  });
});

describe("the built entry point with stdin closed", () => {
  const bin = fileURLToPath(new URL("../../src/bin.ts", import.meta.url));

  it.each([[[]], [["--json"]]])("exits 2 promptly for %j instead of waiting for input", (args) => {
    const r = spawnSync(process.execPath, [bin, ...(args as string[])], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
      encoding: "utf8",
    });
    expect(r.error, "did not time out").toBeUndefined();
    expect(r.status).toBe(2);
    expect(`${r.stdout}${r.stderr}`).toContain("<dir>");
  });

  it("mentions the help command on argument errors", () => {
    const r = spawnSync(process.execPath, [bin, "x", "--network", "nope"], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    expect(r.stderr).toContain(`${TOOL_NAME} --help`);
  });
});
