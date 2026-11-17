// Rebuilds, redeploys and regenerates clients when a contract changes. Started by the dev script.
// Never deploys to mainnet. Unchanged contracts are not redeployed.
import { realpathSync, watch } from "node:fs";
import { bindings, build, deploy, listContracts, loadConfig, StepError } from "./stellar.mjs";

const RELEVANT = /(\.rs|Cargo\.toml)$/;

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(`✗ Contract watcher not started: ${message(error)}`);
  process.exit(1);
}
if (config.network === "mainnet") {
  console.log(
    "Contract watcher is off on mainnet. Deploy with the contracts:deploy script and --confirm-mainnet, only when the user asks for it.",
  );
  process.exit(0);
}

let running = false;
let again = false;
let timer;

function rebuild() {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    const current = loadConfig(); // .env may have changed since the watcher started
    if (current.network === "mainnet") {
      throw new StepError("The network is now mainnet. The watcher never deploys to mainnet.");
    }
    build();
    for (const contract of listContracts()) {
      deploy(current, contract, { onlyIfChanged: true, confirmMainnet: false });
      bindings(contract);
    }
    console.log("✓ Contracts rebuilt, deployed and regenerated. Still watching contracts/.");
  } catch (error) {
    console.error(`✗ ${message(error)}\nStill watching contracts/.`);
  } finally {
    running = false;
    if (again) {
      again = false;
      rebuild();
    }
  }
}

// Watch the canonical path. On Windows, a path reached through an 8.3 short name
// (C:\Users\RUNNER~1\...) makes Node's watcher abort, because the events report the long name.
const contractsDir = realpathSync.native("contracts");
watch(contractsDir, { recursive: true }, (_event, file) => {
  const path = String(file ?? "").replace(/\\/g, "/");
  if (!RELEVANT.test(path) || path.split("/").includes("target")) return;
  clearTimeout(timer);
  timer = setTimeout(rebuild, 300);
});
console.log("Watching contracts/ for changes to .rs and Cargo.toml files.");
