import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./project-harness.ts";

/** The generated project's `dev` script and contract watcher, run against stub binaries. */

let h: Harness;
let children: { kill: () => boolean }[] = [];

beforeEach(async () => {
  h = await createHarness();
  // A first setup, so the watcher starts from a deployed, generated state.
  await h.setState({ keys: ["dev"], deployed: {} });
  expect(h.script("setup.mjs").status).toBe(0);
});

afterEach(async () => {
  for (const c of children) c.kill();
  children = [];
  await h.cleanup();
});

async function until(check: () => boolean, ms = 15_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("timed out");
}

const count = (prefix: string) => h.calls().filter((c) => c.startsWith(prefix)).length;

function startWatcher(env: Record<string, string> = {}) {
  const child = h.start("watch-contracts.mjs", [], env);
  children.push(child);
  return child;
}

describe("contract watcher", () => {
  it("rebuilds, redeploys and regenerates when a contract source file changes", async () => {
    const watcher = startWatcher({ STUB_WASM: "wasm-v2" });
    await until(() => watcher.output().includes("Watching contracts/"));
    const builds = count("stellar contract build");
    await writeFile(join(h.root, "contracts/contracts/hello-world/src/lib.rs"), "// v2\n");
    await until(() => count("npx tsc") >= 2);
    expect(count("stellar contract build")).toBe(builds + 1);
    expect(count("stellar contract deploy")).toBe(2);
    const ids = JSON.parse(readFileSync(join(h.root, "packages/contract-ids.json"), "utf8"));
    expect(ids.testnet.hello_world.id).toBe(`C${"2".padStart(55, "A")}`);
  });

  it("ignores build output under contracts/target, so a build cannot trigger another", async () => {
    const watcher = startWatcher();
    await until(() => watcher.output().includes("Watching contracts/"));
    const builds = count("stellar contract build");
    await mkdir(join(h.root, "contracts/target/x"), { recursive: true });
    await writeFile(join(h.root, "contracts/target/x/out.rs"), "// build output\n");
    await new Promise((r) => setTimeout(r, 1500));
    expect(count("stellar contract build")).toBe(builds);
  });

  it("keeps watching after a failed step and says so", async () => {
    const watcher = startWatcher();
    await until(() => watcher.output().includes("Watching contracts/"));
    await writeFile(
      join(h.root, ".env"),
      "NEXT_PUBLIC_STELLAR_NETWORK=nowhere\nSTELLAR_ACCOUNT=dev\n",
    );
    await writeFile(join(h.root, "contracts/contracts/hello-world/src/lib.rs"), "// v3\n");
    await until(() => watcher.output().includes("✗"));
    expect(watcher.exitCode).toBeNull();
    expect(watcher.output()).toContain("Still watching");
  });

  it("stays off on mainnet and never deploys there (INV-03)", async () => {
    const env = readFileSync(join(h.root, ".env"), "utf8")
      .replace("NEXT_PUBLIC_STELLAR_NETWORK=testnet", "NEXT_PUBLIC_STELLAR_NETWORK=mainnet")
      .replace(
        /NEXT_PUBLIC_STELLAR_RPC_URL=.*/,
        "NEXT_PUBLIC_STELLAR_RPC_URL=https://rpc.example.invalid",
      );
    await writeFile(join(h.root, ".env"), env);
    const r = h.script("watch-contracts.mjs");
    expect(r.status).toBe(0);
    expect(r.out).toContain("off on mainnet");
    expect(count("stellar contract deploy")).toBe(1);
  });
});

describe("dev", () => {
  it("starts next dev and the watcher together", async () => {
    const dev = h.start("dev.mjs");
    children.push(dev);
    await until(() => h.calls().some((c) => c.startsWith("next dev")));
    await until(() => dev.output().includes("Watching contracts/"));
  });

  it("finds next in node_modules/.bin when run directly, without npm run", async () => {
    const { copyFile, rm } = await import("node:fs/promises");
    const bin = join(h.root, "node_modules/.bin");
    await mkdir(bin, { recursive: true });
    // Move the entry points off PATH; the .js they call stays where they expect it.
    for (const f of ["next", "next.js", "next.cmd"]) {
      await copyFile(join(h.stubs, f), join(bin, f)).catch(() => undefined);
    }
    for (const f of ["next", "next.cmd"]) await rm(join(h.stubs, f), { force: true });
    const dev = h.start("dev.mjs");
    children.push(dev);
    await until(() => h.calls().some((c) => c.startsWith("next dev")));
  });

  it("stops the watcher and explains when next cannot start", async () => {
    const { rm } = await import("node:fs/promises");
    for (const f of ["next", "next.cmd"]) await rm(join(h.stubs, f), { force: true });
    const dev = h.start("dev.mjs");
    children.push(dev);
    const code = await new Promise((resolve) => dev.on("exit", resolve));
    expect(code).not.toBe(0);
    expect(dev.output()).toContain("install");
  });

  it("starts only next dev when the project has no contracts", async () => {
    const { rm } = await import("node:fs/promises");
    await rm(join(h.root, "contracts"), { recursive: true });
    const dev = h.start("dev.mjs");
    children.push(dev);
    await until(() => h.calls().some((c) => c.startsWith("next dev")));
    await new Promise((r) => setTimeout(r, 500));
    expect(dev.output()).not.toContain("Watching contracts/");
  });
});
