import type { Module } from "../lib/compose.ts";

/** Declarative environments in stellar.envs.toml, applied with stock commands (`--envs`). */
export const envs: Module = {
  id: "envs",
  templates: ["envs"],
  devDependencies: { "smol-toml": "1.9.1" },
  scripts: {
    "envs:apply": {
      command: "node scripts/envs.mjs",
      description:
        "Apply an environment from `stellar.envs.toml`: `envs:apply -- testnet`. Prints each stock command first; `--dry-run` prints the plan only",
    },
  },
  layout: [
    "`stellar.envs.toml`: declarative environments (network, accounts, contracts) for `envs:apply`",
  ],
};
