import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./project-harness.ts";

/** Constructor arguments for deploys (T-209), through the stock `stellar contract deploy -- …`. */

const NATIVE = `C${"N".repeat(55)}`;
let h: Harness;
beforeEach(async () => {
  h = await createHarness("hello-world", { envs: true });
});
afterEach(async () => {
  await h.cleanup();
});

const deploys = () => h.calls().filter((c) => c.startsWith("stellar contract deploy"));
const argsFile = () => join(h.root, "contracts/contracts/hello-world/constructor.json");

describe("constructor.json", () => {
  it("passes its values after --, resolving asset: values on the deploy network", async () => {
    await writeFile(argsFile(), JSON.stringify({ token: "asset:native", admin: "dev", cap: 1000 }));
    const r = h.script("setup.mjs", [], { STUB_REQUIRE_ARGS: "1" });
    expect(r.status, r.out).toBe(0);
    expect(h.calls()).toContain("stellar contract id asset --asset native --network testnet");
    expect(deploys()[0]).toMatch(new RegExp(`-- --token ${NATIVE} --admin dev --cap 1000$`));
  });

  it("is used by contracts:deploy too", async () => {
    await writeFile(argsFile(), JSON.stringify({ token: "asset:native" }));
    const r = h.script("deploy.mjs", [], { STUB_REQUIRE_ARGS: "1" });
    expect(r.status, r.out).toBe(0);
    expect(deploys()[0]).toContain(`-- --token ${NATIVE}`);
  });

  it("says where the arguments go when a deploy fails without the file", () => {
    const r = h.script("setup.mjs", [], { STUB_REQUIRE_ARGS: "1" });
    expect(r.status).toBe(1);
    expect(r.out).toContain("contracts/contracts/hello-world/constructor.json");
  });

  it("explains a file that is not a JSON object", async () => {
    await writeFile(argsFile(), "[1, 2]");
    const r = h.script("setup.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("constructor.json");
    expect(deploys()).toEqual([]);
  });

  it("deploys exactly as before when a contract has no constructor arguments", () => {
    const r = h.script("setup.mjs");
    expect(r.status, r.out).toBe(0);
    expect(deploys()[0]).not.toContain(" -- ");
  });
});

describe("args in stellar.envs.toml", () => {
  it("overrides constructor.json for that environment, and shows in the dry-run plan", async () => {
    await writeFile(argsFile(), JSON.stringify({ token: "asset:native" }));
    await writeFile(
      join(h.root, "stellar.envs.toml"),
      '[testnet]\nnetwork = "testnet"\naccounts = ["dev"]\n\n[testnet.contracts.hello_world]\nsource = "contracts/contracts/hello-world"\nargs = { token = "CDIRECT", admin = "dev" }\n',
    );
    const plan = h.script("envs.mjs", ["testnet", "--dry-run"]);
    expect(plan.out).toContain("-- --token CDIRECT --admin dev");
    const r = h.script("envs.mjs", ["testnet"], { STUB_REQUIRE_ARGS: "1" });
    expect(r.status, r.out).toBe(0);
    expect(deploys()[0]).toMatch(/-- --token CDIRECT --admin dev$/);
  });
});

describe("docs", () => {
  it("the contracts guide documents constructor.json", async () => {
    const { compose } = await import("../../src/lib/compose.ts");
    const { modulesFor } = await import("../../src/modules/index.ts");
    const ctx = {
      projectName: "a",
      network: "testnet" as const,
      style: "none" as const,
      contracts: "hello-world",
    };
    const guide =
      compose(modulesFor(ctx), ctx).files.find((f) => f.path === "docs/stellar/contracts.md")
        ?.content ?? "";
    expect(guide).toContain("constructor.json");
    expect(guide).toContain("asset:native");
  });
});

void mkdir;
void readFileSync;
