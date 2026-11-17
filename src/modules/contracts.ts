import type { Module } from "../lib/compose.ts";

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
      command: "stellar --version",
      fix: "Install the Stellar CLI: https://developers.stellar.org/docs/tools/cli/install-cli",
    },
    {
      id: "cargo",
      description: "Rust and cargo",
      command: "cargo --version",
      fix: "Install Rust with rustup: https://rustup.rs",
    },
    {
      id: "wasm32v1-none",
      description: "The wasm32v1-none Rust target (Rust 1.84 or newer)",
      command: "rustup target list --installed",
      fix: "Run `rustup target add wasm32v1-none`",
    },
  ],
};
