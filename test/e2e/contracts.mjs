// End-to-end contract loop (G2): create → setup → setup again (no change) → check → the page shows
// the contract's response in a real browser.
// Usage: npm run build && npm run test:e2e:contracts
//   E2E_NETWORK=local    (default) a local network container; starts one with Docker if none answers
//   E2E_NETWORK=testnet  the public testnet
// A fresh Stellar CLI config per run (XDG_CONFIG_HOME) means a new funded identity and no stored secret.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const RPC = { local: "http://localhost:8000/rpc", testnet: "https://soroban-testnet.stellar.org" };
const network = process.env.E2E_NETWORK ?? "local";
if (!(network in RPC)) throw new Error(`E2E_NETWORK must be local or testnet, got ${network}`);
// E2E_CLI points at another build of the CLI, such as one installed from the packed tarball (T-702).
const bin = process.env.E2E_CLI ?? fileURLToPath(new URL("../../dist/bin.js", import.meta.url));
const scan = fileURLToPath(new URL("../secret-scan.mjs", import.meta.url));
const PORT = 3977;

const work = mkdtempSync(join(tmpdir(), "csn-contracts-e2e-"));
const root = join(work, "app");
const env = {
  ...process.env,
  XDG_CONFIG_HOME: join(work, "stellar-config"),
  // Environment variables win over .env, in the scripts and in Next.js alike.
  NEXT_PUBLIC_STELLAR_NETWORK: network,
  NEXT_PUBLIC_STELLAR_RPC_URL: RPC[network],
};

function run(command, args, cwd = root) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const r = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) throw new Error(`${command} ${args.join(" ")} exited ${r.status}`);
}

function capture(command, args, cwd = root) {
  return spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    shell: process.platform === "win32",
  }).stdout;
}

async function rpcHealthy() {
  try {
    const res = await fetch(RPC.local, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
    });
    return (await res.json()).result?.status === "healthy";
  } catch {
    return false;
  }
}

async function waitFor(check, what, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

let startedContainer = false;
let server;
let browser;
let failed = false;
try {
  if (network === "local" && !(await rpcHealthy())) {
    run("stellar", ["container", "start", "local"], work);
    startedContainer = true;
  }
  if (network === "local") await waitFor(rpcHealthy, "the local network RPC", 300_000);

  run(process.execPath, [bin, "app", "--yes"], work);
  run("npm", ["run", "setup"]);

  run("git", ["init", "-q"]);
  run("git", ["add", "-A"]);
  run("git", [
    "-c",
    "user.name=e2e",
    "-c",
    "user.email=e2e@example.invalid",
    "commit",
    "-qm",
    "after setup",
  ]);
  run("npm", ["run", "setup"]);
  const changes = capture("git", ["status", "--porcelain"]).trim();
  if (changes) throw new Error(`INV-10: a second setup changed the project:\n${changes}`);
  console.log("\n✓ A second setup left the project unchanged.");

  run("npm", ["run", "check"]);
  run(process.execPath, [scan, root], work);

  server = spawn(
    process.execPath,
    [join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(PORT)],
    {
      cwd: root,
      env,
      stdio: "inherit",
    },
  );
  await waitFor(
    () =>
      fetch(`http://localhost:${PORT}/`).then(
        () => true,
        () => false,
      ),
    "next start",
    60_000,
  );

  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  const greeting = page.getByTestId("greeting").or(page.getByTestId("greeting-error"));
  await greeting.waitFor({ timeout: 60_000 });
  const text = (await greeting.textContent())?.trim();
  if (text !== "Hello Stellar")
    throw new Error(`Expected the page to show "Hello Stellar", got "${text}"`);
  console.log(`\n✓ The page shows the contract's response on ${network}: ${text}`);
} catch (error) {
  failed = true;
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
} finally {
  await browser?.close();
  server?.kill();
  if (startedContainer) spawnSync("stellar", ["container", "stop", "local"], { stdio: "inherit" });
  rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
