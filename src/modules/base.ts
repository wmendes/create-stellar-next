import type { Module } from "../lib/compose.ts";

/** Versions are those create-next-app 16.4.6 resolved on 2026-11-17 (docs/SOURCES.md). */
export const base: Module = {
  id: "base",
  templates: ["base"],
  scripts: {
    dev: {
      command: "node scripts/dev.mjs",
      description:
        "Next.js dev server on http://localhost:3000, plus the contract watcher when `contracts/` exists",
    },
    build: { command: "next build", description: "Production build" },
    start: { command: "next start", description: "Serve the production build" },
    lint: { command: "eslint", description: "ESLint with the Next.js rules" },
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
    "`app/`: Next.js App Router pages",
    "`lib/stellar.ts`: network settings, read from `.env`",
    "`scripts/`: plain Node scripts behind the npm scripts",
    "`.env`: configuration. `.env.example` lists every key. Identity names only, never secret keys",
  ],
  dependencies: { next: "16.4.6", react: "19.3.0", "react-dom": "19.3.0" },
  devDependencies: {
    "@types/node": "22.20.5",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    eslint: "9.39.5",
    "eslint-config-next": "16.4.6",
    typescript: "5.9.3",
  },
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
  doctor: [
    {
      id: "node",
      description: "Node.js 22.12.0 or newer",
      command: "node --version",
      fix: "Install Node.js 22.12.0 or newer from https://nodejs.org",
    },
  ],
};
