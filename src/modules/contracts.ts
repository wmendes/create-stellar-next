import type { Module } from "../lib/compose.ts";
import type { ProjectInfo } from "../lib/project.ts";

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

/** The Stellar CLI's network flags for the network in .env, as the generated scripts use them. */
function networkArgs(p: ProjectInfo): string[] {
  const network = p.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";
  return network === "mainnet"
    ? [
        "--rpc-url",
        p.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "",
        "--network-passphrase",
        MAINNET_PASSPHRASE,
      ]
    : ["--network", network];
}

/** The hello-world contract workspace, created by the stock `stellar contract init` (SPEC §3.4). */
export const contracts: Module = {
  id: "contracts",
  templates: ["contracts"],
  requires: ["stellar", "cargo"],
  next: ["setup"],
  dependencies: { "@stellar/stellar-sdk": "17.4.0" },
  env: [
    {
      key: "STELLAR_ACCOUNT",
      comment:
        "Stellar CLI identity that deploys contracts: a name, never a secret key. `stellar keys ls` lists yours.",
      value: () => "dev",
    },
  ],
  commands: () => [
    {
      command: "stellar",
      args: ["contract", "init", "contracts"],
      fix: "Run `stellar contract init contracts` in the project to create the contract workspace.",
    },
  ],
  scripts: {
    setup: {
      command: "node scripts/setup.mjs",
      description:
        "Identity, build, deploy and client generation. Safe to rerun: unchanged contracts are not redeployed",
    },
    "contracts:build": {
      command: "stellar contract build --manifest-path contracts/Cargo.toml",
      description: "Build every contract to `contracts/target/wasm32v1-none/release/`",
    },
    "contracts:test": {
      command: "cargo test --manifest-path contracts/Cargo.toml",
      description: "Run the contracts' Rust unit tests",
    },
    "contracts:deploy": {
      command: "node scripts/deploy.mjs",
      description:
        "Build, then deploy every contract to the network in `.env`. Mainnet needs `-- --confirm-mainnet`",
    },
    "contracts:bindings": {
      command: "node scripts/bindings.mjs",
      description: "Regenerate the typed clients in `packages/` with the SDK generator",
    },
  },
  layout: [
    "`contracts/`: Rust contract workspace from `stellar contract init`. Read `contracts/AGENTS.md` before changing a contract",
    "`packages/`: generated typed clients and `contract-ids.json`. Do not edit",
    "`lib/contracts.ts`: one client per contract, configured from `.env`",
  ],
  doctor: [
    {
      id: "stellar",
      description: "Stellar CLI",
      command: "stellar",
      args: ["--version"],
      fix: "Install the Stellar CLI: https://developers.stellar.org/docs/tools/cli/install-cli",
    },
    {
      id: "cargo",
      description: "Rust and cargo",
      command: "cargo",
      args: ["--version"],
      fix: "Install Rust with rustup: https://rustup.rs",
    },
    {
      id: "wasm32v1-none",
      description: "The wasm32v1-none Rust target (Rust 1.84 or newer)",
      command: "rustup",
      args: ["target", "list", "--installed"],
      verify: (out) =>
        out.split(/\s+/).includes("wasm32v1-none") ? undefined : "the target is not installed",
      summary: () => "installed",
      fix: "Run `rustup target add wasm32v1-none`",
    },
    {
      id: "identity",
      description: "The Stellar CLI identity named in STELLAR_ACCOUNT",
      command: "stellar",
      when: (p) => p.exists && Boolean(p.env.STELLAR_ACCOUNT),
      args: (p) => ["keys", "address", p.env.STELLAR_ACCOUNT ?? ""],
      fix: (p) =>
        p.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
          ? `Create or import it yourself: \`stellar keys generate ${p.env.STELLAR_ACCOUNT}\` or \`stellar keys add ${p.env.STELLAR_ACCOUNT}\``
          : "Run the setup script, which creates and funds it",
    },
    {
      id: "identity-funded",
      description: "That identity's account exists on the network in .env",
      command: "stellar",
      after: "identity",
      when: (p) => p.exists && Boolean(p.env.STELLAR_ACCOUNT),
      args: (p) => [
        "ledger",
        "entry",
        "fetch",
        "account",
        "--account",
        p.env.STELLAR_ACCOUNT ?? "",
        ...networkArgs(p),
      ],
      verify: (out) => {
        try {
          const entries = (JSON.parse(out) as { entries?: unknown[] }).entries ?? [];
          return entries.length > 0 ? undefined : "the account is not funded";
        } catch {
          return "unexpected output from the Stellar CLI";
        }
      },
      summary: (out) => {
        const stroops = /"balance":"(\d+)"/.exec(out)?.[1];
        return stroops ? `balance ${(Number(stroops) / 1e7).toFixed(2)} XLM` : "funded";
      },
      fix: (p) =>
        p.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
          ? "Fund it by sending XLM from an existing mainnet account"
          : `Run \`stellar keys fund ${p.env.STELLAR_ACCOUNT} --network ${p.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet"}\``,
    },
  ],
};
