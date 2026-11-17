import type { Module } from "../lib/compose.ts";

/** The hello-world contract workspace, created by the stock `stellar contract init` (SPEC §3.4). */
export const contracts: Module = {
  id: "contracts",
  templates: [],
  requires: ["stellar", "cargo"],
  commands: () => [
    {
      command: "stellar",
      args: ["contract", "init", "contracts"],
      fix: "Run `stellar contract init contracts` in the project to create the contract workspace.",
    },
  ],
  scripts: {
    "contracts:build": {
      command: "stellar contract build --manifest-path contracts/Cargo.toml",
      description: "Build every contract to `contracts/target/wasm32v1-none/release/`",
    },
    "contracts:test": {
      command: "cargo test --manifest-path contracts/Cargo.toml",
      description: "Run the contracts' Rust unit tests",
    },
  },
  layout: [
    "`contracts/`: Rust contract workspace from `stellar contract init`. Read `contracts/AGENTS.md` before changing a contract",
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
