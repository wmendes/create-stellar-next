// Shared steps behind `setup`, `contracts:deploy` and `contracts:bindings`.
// Plain Node: every step prints the stock command it runs, so you can run it yourself.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PASSPHRASES = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
  local: "Standalone Network ; February 2017",
};
const WASM_DIR = "contracts/target/wasm32v1-none/release";
const IDS_FILE = "packages/contract-ids.json";
const SECRET_KEY = /^S[A-Z2-7]{55}$/;

export class StepError extends Error {}

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

const LOCAL_RPC = "http://localhost:8000/rpc";

/** Settings for one network and deployer, checked before anything runs. */
export function configFor({ network, account, rpcUrl }) {
  if (!(network in PASSPHRASES)) {
    throw new StepError(`The network is "${network ?? ""}". Use testnet, local or mainnet.`);
  }
  if (!account) {
    throw new StepError(
      "No deploying account. Set STELLAR_ACCOUNT in .env to a Stellar CLI identity name, such as dev.",
    );
  }
  if (SECRET_KEY.test(account)) {
    throw new StepError(
      "The account looks like a secret key. Remove it from your files now, and use an identity name instead, such as dev. Import a key into the Stellar CLI with `stellar keys add <name>`.",
    );
  }
  if (network === "mainnet" && !rpcUrl) {
    throw new StepError("No mainnet RPC URL. Set your mainnet RPC provider's URL.");
  }
  const networkArgs =
    network === "mainnet"
      ? ["--rpc-url", rpcUrl, "--network-passphrase", PASSPHRASES.mainnet]
      : ["--network", network];
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  // Aliases are global to the Stellar CLI, so they carry the project name. Dots are not allowed.
  const project = String(pkg.name).replace(/[^A-Za-z0-9_-]/g, "-");
  const defaultRpc = { testnet: "https://soroban-testnet.stellar.org", local: LOCAL_RPC };
  return { network, account, networkArgs, project, rpcUrl: rpcUrl || defaultRpc[network] };
}

/** Network settings from .env (environment variables win). */
export function loadConfig() {
  const env = { ...readEnvFile(".env"), ...process.env };
  return configFor({
    network: env.NEXT_PUBLIC_STELLAR_NETWORK,
    account: env.STELLAR_ACCOUNT,
    rpcUrl: env.NEXT_PUBLIC_STELLAR_RPC_URL,
  });
}

/** Set keys in .env, keeping every other line as it is. */
export function updateEnv(values) {
  let text = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    text = pattern.test(text)
      ? text.replace(pattern, line)
      : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`;
  }
  if (!existsSync(".env") || readFileSync(".env", "utf8") !== text) writeFileSync(".env", text);
}

export function deployArgsFor(config, contract) {
  return deployArgs(config, contract, `${config.project}-${contract.name}`);
}

/** Record an already deployed contract's ID for a network, without deploying. */
export function recordExisting(network, name, id) {
  recordId(network, name, { alias: "", id });
}

function shown(command, args) {
  return [command, ...args].map((a) => (/[\s"]/.test(a) ? `"${a}"` : a)).join(" ");
}

/** Print the command, then run it. Returns trimmed stdout when `capture` is set. */
export function run(command, args, { capture = false, allowFailure = false } = {}) {
  console.log(`$ ${shown(command, args)}`);
  const windows = process.platform === "win32";
  const result = spawnSync(windows ? shown(command, args) : command, windows ? [] : args, {
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    shell: windows,
  });
  if (result.error?.code === "ENOENT") {
    throw new StepError(
      `\`${command}\` was not found. Run \`stellar --version\` and \`npx --version\` to check your setup.`,
    );
  }
  if (result.status !== 0) {
    if (allowFailure) return undefined;
    if (capture) process.stderr.write(result.stderr ?? "");
    throw new StepError(
      `\`${shown(command, args)}\` failed. Fix the error above, then run this script again.`,
    );
  }
  return capture ? result.stdout.trim() : "";
}

/** Contracts in contracts/contracts/*, as { crate, name, wasm }. */
export function listContracts() {
  const dir = "contracts/contracts";
  if (!existsSync(dir))
    throw new StepError("No contracts/ workspace. Run `stellar contract init contracts` first.");
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, "Cargo.toml")))
    .map((e) => {
      const toml = readFileSync(join(dir, e.name, "Cargo.toml"), "utf8");
      const crate = /^\s*name\s*=\s*"([^"]+)"/m.exec(toml)?.[1] ?? e.name;
      const name = crate.replace(/-/g, "_");
      return { crate, name, wasm: `${WASM_DIR}/${name}.wasm` };
    })
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

export function ensureIdentity({ account, network }) {
  if (
    run("stellar", ["keys", "address", account], { capture: true, allowFailure: true }) !==
    undefined
  )
    return;
  if (network === "mainnet") {
    throw new StepError(
      `No Stellar CLI identity named "${account}". On mainnet, create or import one yourself with \`stellar keys generate ${account}\` or \`stellar keys add ${account}\`, and fund it.`,
    );
  }
  run("stellar", ["keys", "generate", account, "--network", network, "--fund"]);
}

export function build() {
  run("stellar", ["contract", "build", "--manifest-path", "contracts/Cargo.toml"]);
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function deployArgs(config, contract, alias) {
  return [
    "contract",
    "deploy",
    "--wasm",
    contract.wasm,
    "--source-account",
    config.account,
    ...config.networkArgs,
    "--alias",
    alias,
  ];
}

/** Deploy one contract. With `onlyIfChanged`, skip it when the network already runs this exact Wasm. */
export function deploy(config, contract, { onlyIfChanged, confirmMainnet }) {
  const alias = `${config.project}-${contract.name}`;
  if (!existsSync(contract.wasm))
    throw new StepError(`${contract.wasm} is missing. Run the contracts:build script first.`);
  if (onlyIfChanged) {
    const deployed = run(
      "stellar",
      ["contract", "info", "hash", "--contract-id", alias, ...config.networkArgs],
      {
        capture: true,
        allowFailure: true,
      },
    );
    if (deployed === sha256(contract.wasm)) {
      console.log(`✓ ${contract.name} is unchanged on ${config.network}, skipping deploy.`);
      recordId(config.network, contract.name, { alias, id: aliasId(config, alias) });
      return;
    }
  }
  if (config.network === "mainnet" && !confirmMainnet) {
    throw new StepError(
      `Refusing to deploy to mainnet without confirmation. This would run:\n  ${shown("stellar", deployArgs(config, contract, alias))}\nRerun with --confirm-mainnet only if the user asked for a mainnet deploy in this task.`,
    );
  }
  run("stellar", deployArgs(config, contract, alias));
  recordId(config.network, contract.name, { alias, id: aliasId(config, alias) });
}

function aliasId(config, alias) {
  return run("stellar", ["contract", "alias", "show", alias, ...config.networkArgs], {
    capture: true,
  });
}

function recordId(network, name, entry) {
  const ids = existsSync(IDS_FILE) ? JSON.parse(readFileSync(IDS_FILE, "utf8")) : {};
  ids[network] = { ...ids[network], [name]: entry };
  const sorted = Object.fromEntries(
    Object.keys(ids)
      .sort()
      .map((n) => [
        n,
        Object.fromEntries(
          Object.keys(ids[n])
            .sort()
            .map((k) => [k, ids[n][k]]),
        ),
      ]),
  );
  const text = `${JSON.stringify(sorted, null, 2)}\n`;
  mkdirSync("packages", { recursive: true });
  if (!existsSync(IDS_FILE) || readFileSync(IDS_FILE, "utf8") !== text)
    writeFileSync(IDS_FILE, text);
}

const HEADER_TEXT =
  "Generated by the contracts:bindings script (npx @stellar/stellar-sdk generate). Do not edit this file: regenerate it with that script.";

/** Mark every generated code file in a client package, once. */
function stampHeader(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") stampHeader(path);
      continue;
    }
    const header = /\.(ts|js|mjs|cjs)$/.test(entry.name)
      ? `// ${HEADER_TEXT}\n`
      : entry.name === "README.md"
        ? `<!-- ${HEADER_TEXT} -->\n\n`
        : undefined;
    if (!header) continue;
    const text = readFileSync(path, "utf8");
    if (!text.startsWith(header)) writeFileSync(path, header + text);
  }
}

/**
 * Generate the typed client from the local Wasm with the SDK's generator, then compile it with this
 * project's TypeScript, as the Stellar docs do, so the app imports plain JavaScript from dist/.
 */
export function bindings(contract) {
  if (!existsSync(contract.wasm)) {
    throw new StepError(`${contract.wasm} is missing. Run the contracts:build script first.`);
  }
  const out = `packages/${contract.name}`;
  run("npx", [
    "@stellar/stellar-sdk",
    "generate",
    "--wasm",
    contract.wasm,
    "--output-dir",
    out,
    "--contract-name",
    contract.name,
    "--overwrite",
  ]);
  run("npx", ["tsc", "-p", `${out}/tsconfig.json`]);
  stampHeader(out);
}

/** Run a script's steps and turn a StepError into a message and exit code 1. */
export function main(steps) {
  try {
    steps();
  } catch (error) {
    if (!(error instanceof StepError)) throw error;
    console.error(`\n✗ ${error.message}`);
    process.exit(1);
  }
}
