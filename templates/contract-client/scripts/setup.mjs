// Generates the typed client for the contract in NEXT_PUBLIC_STELLAR_CONTRACT_ID, from the network,
// with the SDK's generator, then compiles it. Safe to rerun. Never edit packages/ by hand.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// The generator's names for the networks in .env.
const GENERATOR_NETWORK = { testnet: "testnet", mainnet: "mainnet", local: "localnet" };
const OUT = "packages/contract";

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function readEnv() {
  const values = {};
  if (existsSync(".env")) {
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
  return { ...values, ...process.env };
}

function run(command, args) {
  const shown = [command, ...args].join(" ");
  console.log(`$ ${shown}`);
  const windows = process.platform === "win32";
  const result = spawnSync(windows ? shown : command, windows ? [] : args, {
    stdio: "inherit",
    shell: windows,
  });
  if (result.status !== 0)
    fail(`\`${shown}\` failed. Fix the error above, then run this script again.`);
}

const env = readEnv();
const id = env.NEXT_PUBLIC_STELLAR_CONTRACT_ID;
const network = GENERATOR_NETWORK[env.NEXT_PUBLIC_STELLAR_NETWORK];
const rpcUrl = env.NEXT_PUBLIC_STELLAR_RPC_URL;
if (!id) fail("NEXT_PUBLIC_STELLAR_CONTRACT_ID is not set. Add the contract ID to .env.");
if (!network)
  fail("NEXT_PUBLIC_STELLAR_NETWORK must be testnet, local or mainnet. Set it in .env.");
if (!rpcUrl) fail("NEXT_PUBLIC_STELLAR_RPC_URL is not set. Add your RPC provider's URL to .env.");

run("npx", [
  "@stellar/stellar-sdk",
  "generate",
  "--contract-id",
  id,
  "--network",
  network,
  "--rpc-url",
  rpcUrl,
  ...(network === "localnet" ? ["--allow-http"] : []),
  "--output-dir",
  OUT,
  "--contract-name",
  "contract",
  "--overwrite",
]);
run("npx", ["tsc", "-p", `${OUT}/tsconfig.json`]);
console.log("\n✓ Client generated in packages/contract. Use it through lib/contracts.ts.");
