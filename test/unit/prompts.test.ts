import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CliEnv, type ConfirmFn, main, type PromptFn, type SelectFn } from "../../src/cli.ts";
import { fakeRunner } from "./fake-runner.ts";

/** Interactive create (T-107): every choice without a flag is asked on a TTY. */

let cwd: string;
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "csn-prompts-"));
});
afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

/** Scripted answers by question key; records which questions were asked. */
function scripted(answers: Record<string, string | boolean | undefined>) {
  const asked: string[] = [];
  const pick = (message: string) => {
    const key = Object.keys(answers).find((k) => message.toLowerCase().includes(k));
    asked.push(key ?? message);
    return key === undefined ? undefined : answers[key];
  };
  const prompt: PromptFn = async (q) => pick(q.message) as string | undefined;
  const select: SelectFn = async (q) => {
    const answer = pick(q.message);
    if (answer !== undefined) expect(q.options.map((o) => o.value)).toContain(answer);
    return answer as string | undefined;
  };
  const confirm: ConfirmFn = async (q) => pick(q.message) as boolean | undefined;
  return { asked, env: { prompt, select, confirm } };
}

const run = (argv: string[], extra: Partial<CliEnv>) =>
  main(argv, {
    cwd,
    isTTY: true,
    nodeVersion: "24.18.1",
    createRunner: fakeRunner().factory,
    ...extra,
  });

const read = (f: string) => readFileSync(join(cwd, "app", f), "utf8");

describe("create on a TTY without flags", () => {
  it("asks for contracts, wallet, local network, environments and styling, and applies the answers", async () => {
    const s = scripted({
      contracts: "hello-world",
      wallet: "extension",
      "local network": true,
      environments: true,
      styl: "none",
    });
    const r = await run(["app"], s.env);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(s.asked).toEqual(["contracts", "wallet", "local network", "environments", "styl"]);
    expect(read("lib/wallet/index.ts")).toContain("@stellar/varial-sdk");
    expect(JSON.parse(read("package.json")).scripts["network:start"]).toBeDefined();
    expect(existsSync(join(cwd, "app/stellar.envs.toml"))).toBe(true);
    expect(read("app/globals.css")).not.toContain("tailwind");
  });

  it("does not ask about environments when no contract workspace is chosen", async () => {
    const s = scripted({
      contracts: "none",
      wallet: "none",
      "local network": false,
      styl: "tailwind",
    });
    const r = await run(["app"], s.env);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(s.asked).not.toContain("environments");
  });

  it("asks for the contract ID when that option is chosen, and validates it", async () => {
    const id = `C${"B".repeat(55)}`;
    let validate: ((v: string | undefined) => string | undefined) | undefined;
    const s = scripted({ contracts: "id", wallet: "none", "local network": false, styl: "none" });
    const prompt: PromptFn = async (q) => {
      validate = q.validate;
      s.asked.push("contract id");
      return id;
    };
    const r = await run(["app"], { ...s.env, prompt });
    expect(r.exitCode, r.stderr).toBe(0);
    expect(s.asked).toContain("contract id");
    expect(validate?.("nope")).toBeDefined();
    expect(validate?.(id)).toBeUndefined();
    expect(read(".env")).toContain(`NEXT_PUBLIC_STELLAR_CONTRACT_ID=${id}`);
  });

  it("skips the questions whose flags were given", async () => {
    const s = scripted({ "local network": false, environments: false });
    const r = await run(
      ["app", "--contracts", "hello-world", "--wallet", "none", "--style", "none"],
      s.env,
    );
    expect(r.exitCode, r.stderr).toBe(0);
    expect(s.asked).toEqual(["local network", "environments"]);
  });

  it("treats --envs as choosing the contract workspace, without asking", async () => {
    const s = scripted({ wallet: "none", "local network": false, styl: "none" });
    const r = await run(["app", "--envs"], s.env);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(s.asked).not.toContain("contracts");
    expect(s.asked).not.toContain("environments");
  });

  it("exits 1 and writes nothing when a question is cancelled", async () => {
    const s = scripted({ contracts: "hello-world" });
    const r = await run(["app"], s.env);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("Cancelled");
    expect(existsSync(join(cwd, "app"))).toBe(false);
  });

  it.each([
    ["--yes", ["app", "--yes"], true],
    ["--json", ["app", "--json"], true],
    ["no TTY", ["app"], false],
  ])("asks nothing with %s", async (_label, argv, isTTY) => {
    const s = scripted({});
    const r = await run(argv as string[], { ...s.env, isTTY: isTTY as boolean });
    expect(r.exitCode, `${r.stdout}${r.stderr}`).toBe(0);
    expect(s.asked).toEqual([]);
  });
});
