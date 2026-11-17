import type { Module } from "../lib/compose.ts";
import { MIN_NODE, olderThan } from "../lib/versions.ts";

/**
 * The Stellar layer every project has: network settings, the check script and the agent guide.
 * `create` writes it with the scaffold; `add` brings it into a project that lacks it.
 */
export const core: Module = {
  id: "core",
  templates: ["core"],
  scripts: {
    typecheck: {
      command: "next typegen && tsc --noEmit",
      description: "Generate route types, then run the TypeScript compiler",
    },
    check: {
      command: "node scripts/check.mjs",
      description:
        "Typecheck, lint, contract tests when `contracts/` exists, and `next build`. The definition of done",
    },
  },
  layout: [
    "`lib/stellar.ts`: network settings, read from `.env`",
    "`scripts/`: plain Node scripts behind the npm scripts",
    "`.env`: configuration. `.env.example` lists every key. Identity names only, never secret keys",
    "`docs/stellar/`: guides for this project. Start with `docs/stellar/README.md`",
  ],
  env: [
    {
      key: "NEXT_PUBLIC_STELLAR_NETWORK",
      comment: "Stellar network: testnet, mainnet or local.",
      value: (ctx) => ctx.network,
    },
    {
      key: "NEXT_PUBLIC_STELLAR_RPC_URL",
      comment:
        "Stellar RPC endpoint for that network. No mainnet default is shipped: set your provider's URL.",
      value: (ctx) => (ctx.network === "testnet" ? "https://soroban-testnet.stellar.org" : ""),
    },
  ],
  detect: (project) => project.read("lib/stellar.ts") !== undefined,
  doctor: [
    {
      id: "node",
      description: "Node.js 22.12.0 or newer",
      command: "node",
      args: ["--version"],
      verify: (out) => (olderThan(out.trim(), MIN_NODE) ? `found ${out.trim()}` : undefined),
      fix: "Install Node.js 22.12.0 or newer from https://nodejs.org",
    },
  ],
};
