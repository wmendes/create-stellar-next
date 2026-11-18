// Applies one environment from stellar.envs.toml: creates missing identities, builds, deploys what
// changed, regenerates clients, and points .env at that environment.
// Usage: npm run envs:apply -- <environment> [--dry-run] [--confirm-mainnet]
// Every step is a stock command, printed before it runs. --dry-run prints the plan and runs nothing.
import { existsSync, readFileSync } from "node:fs";
import { parse } from "smol-toml";
import {
  bindings,
  build,
  configFor,
  deploy,
  deployArgsFor,
  ensureIdentity,
  listContracts,
  main,
  recordExisting,
  StepError,
  updateEnv,
} from "./stellar.mjs";

const FILE = "stellar.envs.toml";

function readEnvironments() {
  if (!existsSync(FILE))
    throw new StepError(`${FILE} is missing. Add one, or run \`add envs\` again.`);
  try {
    return parse(readFileSync(FILE, "utf8"));
  } catch (error) {
    throw new StepError(
      `${FILE} is not valid TOML: ${error instanceof Error ? error.message : error}`,
    );
  }
}

function resolve(name, env) {
  const accounts = Array.isArray(env.accounts) ? env.accounts.map(String) : [];
  const config = configFor({ network: env.network, account: accounts[0], rpcUrl: env.rpc_url });
  const available = listContracts();
  const contracts = Object.entries(env.contracts ?? {}).map(([key, spec]) => {
    if (spec.id) return { key, id: String(spec.id) };
    const crate = String(spec.source ?? "")
      .replace(/\/$/, "")
      .split("/")
      .pop();
    const contract = available.find((c) => c.crate === crate || c.name === key);
    if (!contract) {
      throw new StepError(
        `[${name}.contracts.${key}] names source "${spec.source}", which is not a contract in contracts/contracts/.`,
      );
    }
    const args = spec.args && typeof spec.args === "object" ? spec.args : undefined;
    return { key, contract, args };
  });
  return { config, accounts, contracts };
}

function printPlan(name, { config, accounts, contracts }) {
  const lines = [`Plan for environment "${name}" on ${config.network}:`];
  for (const account of accounts) {
    lines.push(
      config.network === "mainnet"
        ? `  identity ${account} must already exist and be funded (never created on mainnet)`
        : `  $ stellar keys generate ${account} --network ${config.network} --fund   (only if ${account} does not exist)`,
    );
  }
  lines.push("  $ stellar contract build --manifest-path contracts/Cargo.toml");
  for (const c of contracts) {
    if (c.id) {
      lines.push(`  use ${c.key} = ${c.id}   (already deployed, no deploy)`);
      continue;
    }
    lines.push(
      `  $ stellar ${deployArgsFor(config, c.contract, c.args ?? undefined).join(" ")}   (only if the network does not already run this Wasm)`,
    );
  }
  for (const c of contracts) {
    const contract = c.contract ?? listContracts().find((x) => x.name === c.key);
    if (!contract) continue;
    lines.push(
      `  $ npx @stellar/stellar-sdk generate --wasm ${contract.wasm} --output-dir packages/${contract.name} --contract-name ${contract.name} --overwrite`,
      `  $ npx tsc -p packages/${contract.name}/tsconfig.json`,
    );
  }
  lines.push(
    `  set .env: NEXT_PUBLIC_STELLAR_NETWORK=${config.network}, NEXT_PUBLIC_STELLAR_RPC_URL=${config.rpcUrl}, STELLAR_ACCOUNT=${config.account}`,
  );
  console.log(lines.join("\n"));
}

main(() => {
  const args = process.argv.slice(2);
  const name = args.find((a) => !a.startsWith("--"));
  const environments = readEnvironments();
  const known = Object.keys(environments).join(", ");
  if (!name)
    throw new StepError(
      `Name an environment: npm run envs:apply -- <environment>. Known: ${known}.`,
    );
  const env = environments[name];
  if (!env || typeof env !== "object")
    throw new StepError(`No environment "${name}" in ${FILE}. Known: ${known}.`);
  const plan = resolve(name, env);
  if (args.includes("--dry-run")) {
    printPlan(name, plan);
    return;
  }

  const { config, accounts, contracts } = plan;
  for (const account of accounts) ensureIdentity({ account, network: config.network });
  build();
  for (const c of contracts) {
    if (c.id) recordExisting(config.network, c.key, c.id);
    else
      deploy(config, c.contract, {
        onlyIfChanged: true,
        confirmMainnet: args.includes("--confirm-mainnet"),
        args: c.args,
      });
  }
  for (const contract of listContracts()) {
    if (contracts.some((c) => c.key === contract.name || c.contract === contract))
      bindings(contract);
  }
  updateEnv({
    NEXT_PUBLIC_STELLAR_NETWORK: config.network,
    NEXT_PUBLIC_STELLAR_RPC_URL: config.rpcUrl,
    STELLAR_ACCOUNT: config.account,
  });
  console.log(`\n✓ Environment "${name}" applied. .env now points at ${config.network}.`);
});
