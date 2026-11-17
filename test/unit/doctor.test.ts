import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv } from "ajv";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli.ts";
import type { RunSpec } from "../../src/lib/runner.ts";
import { fakeRunner } from "./fake-runner.ts";

const schema = JSON.parse(
  readFileSync(new URL("../../schemas/doctor.schema.json", import.meta.url), "utf8"),
) as object;
const validate = new Ajv({ allErrors: true }).compile(schema);

interface Report {
  schemaVersion: number;
  checks: { id: string; status: string; detail: string; fix?: string }[];
  errors: { code: string; message: string; fix: string }[];
}

const FUNDED = JSON.stringify({ entries: [{ key: {} }], latestLedger: 1 });
const UNFUNDED = JSON.stringify({ entries: [], latestLedger: 1 });

/** Stdout of a healthy machine, overridable per command. */
function healthy(overrides: Record<string, string> = {}) {
  return (spec: RunSpec): string | undefined => {
    const key = [spec.command, ...spec.args].join(" ");
    for (const [prefix, out] of Object.entries(overrides)) if (key.startsWith(prefix)) return out;
    if (key === "node --version") return "v24.18.1";
    if (key === "stellar --version") return "stellar 30.0.1 (abc)";
    if (key === "cargo --version") return "cargo 1.95.0";
    if (key === "rustup target list --installed") return "aarch64-apple-darwin\nwasm32v1-none\n";
    if (key.startsWith("stellar keys address")) return `G${"B".repeat(55)}`;
    if (key.startsWith("stellar ledger entry fetch account")) return FUNDED;
    return "";
  };
}

let cwd: string;
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "csn-doctor-"));
});
afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

async function project(...args: string[]) {
  const r = await main(["app", "--yes", ...args], {
    cwd,
    createRunner: fakeRunner().factory,
    nodeVersion: "24.18.1",
  });
  expect(r.exitCode, r.stderr).toBe(0);
  return join(cwd, "app");
}

async function doctor(dir: string, runner = fakeRunner({ stdout: healthy() }), json = true) {
  const r = await main(["doctor", ...(json ? ["--json"] : [])], {
    cwd: dir,
    createRunner: runner.factory,
  });
  const report = json ? (JSON.parse(r.stdout) as Report) : undefined;
  if (report) expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
  return { ...r, report, calls: runner.calls.map((c) => [c.command, ...c.args].join(" ")) };
}

const status = (report: Report | undefined) =>
  Object.fromEntries((report?.checks ?? []).map((c) => [c.id, c.status]));

describe("doctor outside a project", () => {
  it("checks what a default create needs, and exits 0 when all is well", async () => {
    const r = await doctor(cwd);
    expect(r.exitCode).toBe(0);
    expect(status(r.report)).toEqual({
      node: "ok",
      stellar: "ok",
      cargo: "ok",
      "wasm32v1-none": "ok",
    });
    expect(r.report?.errors).toEqual([]);
  });

  it("reports a removed prerequisite with exit 3 and the command that fixes it (G3)", async () => {
    const r = await doctor(cwd, fakeRunner({ stdout: healthy(), missing: ["stellar"] }));
    expect(r.exitCode).toBe(3);
    expect(status(r.report).stellar).toBe("failed");
    expect(r.report?.errors[0]?.code).toBe("MISSING_PREREQUISITE");
    expect(r.report?.errors[0]?.fix).toContain("developers.stellar.org/docs/tools/cli/install-cli");
  });

  it("fails an old Node", async () => {
    const r = await doctor(cwd, fakeRunner({ stdout: healthy({ "node --version": "v20.9.0" }) }));
    expect(r.exitCode).toBe(3);
    expect(r.report?.checks.find((c) => c.id === "node")?.detail).toContain("20.9.0");
  });

  it("fails a missing wasm32v1-none target with the rustup fix", async () => {
    const r = await doctor(
      cwd,
      fakeRunner({ stdout: healthy({ "rustup target list": "aarch64-apple-darwin\n" }) }),
    );
    expect(r.exitCode).toBe(3);
    expect(r.report?.checks.find((c) => c.id === "wasm32v1-none")?.fix).toBe(
      "Run `rustup target add wasm32v1-none`",
    );
  });

  it("prints a readable report without --json", async () => {
    const r = await doctor(cwd, fakeRunner({ stdout: healthy(), missing: ["cargo"] }), false);
    expect(r.exitCode).toBe(3);
    expect(r.stdout).toMatch(/✓ .*Node/);
    expect(r.stdout).toMatch(/✗ .*cargo/i);
    expect(r.stdout).toContain("rustup.rs");
  });
});

describe("doctor in a hello-world project", () => {
  it("also checks that the identity in .env exists and is funded on its network", async () => {
    const dir = await project();
    const r = await doctor(dir);
    expect(r.exitCode).toBe(0);
    expect(status(r.report)).toMatchObject({ identity: "ok", "identity-funded": "ok" });
    expect(r.calls).toContain("stellar keys address dev");
    expect(r.calls).toContain("stellar ledger entry fetch account --account dev --network testnet");
  });

  it("names the funding command when the identity is unfunded", async () => {
    const dir = await project();
    const r = await doctor(
      dir,
      fakeRunner({ stdout: healthy({ "stellar ledger entry fetch account": UNFUNDED }) }),
    );
    expect(r.exitCode).toBe(3);
    expect(r.report?.checks.find((c) => c.id === "identity-funded")?.fix).toBe(
      "Run `stellar keys fund dev --network testnet`",
    );
  });

  it("skips the funding check when the identity does not exist, and says how to create it", async () => {
    const dir = await project();
    const r = await doctor(
      dir,
      fakeRunner({ stdout: healthy(), fail: (s) => s.args.join(" ") === "keys address dev" }),
    );
    expect(r.exitCode).toBe(3);
    expect(status(r.report)).toMatchObject({ identity: "failed", "identity-funded": "skipped" });
    expect(r.report?.checks.find((c) => c.id === "identity")?.fix).toContain("setup");
  });
});

describe("doctor in other projects", () => {
  it("checks only Node for --contracts none", async () => {
    const dir = await project("--contracts", "none");
    expect(Object.keys(status((await doctor(dir)).report))).toEqual(["node"]);
  });

  it("checks only Node for --contracts <id>", async () => {
    const dir = await project("--contracts", `C${"B".repeat(55)}`);
    expect(Object.keys(status((await doctor(dir)).report))).toEqual(["node"]);
  });
});
