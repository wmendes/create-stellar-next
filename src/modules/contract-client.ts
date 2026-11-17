import type { Module } from "../lib/compose.ts";

/** A typed client for an already deployed contract, with no Rust workspace (`--contracts <id>`). */
export const contractClient: Module = {
  id: "contract-client",
  templates: ["contract-client"],
  dependencies: { "@stellar/stellar-sdk": "17.4.0" },
  env: [
    {
      key: "NEXT_PUBLIC_STELLAR_CONTRACT_ID",
      comment: "The deployed contract this app talks to, on the network above.",
      value: (ctx) => ctx.contracts,
    },
  ],
  next: ["setup"],
  detect: (project) => "NEXT_PUBLIC_STELLAR_CONTRACT_ID" in project.env,
  scripts: {
    setup: {
      command: "node scripts/setup.mjs",
      description:
        "Generate the typed client for `NEXT_PUBLIC_STELLAR_CONTRACT_ID` from the network, then compile it",
    },
    "contracts:bindings": {
      command: "node scripts/setup.mjs",
      description: "Same as `setup`: regenerate the client in `packages/contract`",
    },
  },
  layout: [
    "`packages/contract/`: generated typed client for the contract in `.env`. Do not edit",
    "`lib/contracts.ts`: `contract()` returns that client, configured from `.env`",
  ],
};
