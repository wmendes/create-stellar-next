<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:stellar-agent-rules -->

# Agent guide

A Next.js App Router app with a Stellar contract workflow. All configuration is in `.env`.

## Layout

{{LAYOUT}}

## Scripts

{{SCRIPTS}}

## Docs

Read `docs/stellar/README.md` first: guides for this project's contracts, network and wallet, matching
its versions. Before using a Stellar API from memory, check `docs/stellar/outdated.md`. Run `stellar skill` for the Stellar CLI's own guide for agents, and check
`stellar <command> --help` before using a flag.

## Raven

Raven (`https://raven.stellar.org/mcp`) is a read-only MCP server for Stellar docs, network data and ecosystem research.

If its tools are available (`stellar-raven`: `search`, then `execute`), use them instead of memory at these moments:
- before writing code against a Stellar API (soroban-sdk, stellar-sdk, a CLI command) not already used in this project;
- for network facts (asset contract IDs, RPC and friendbot URLs, fees, limits), SEPs, tokens, wallets and ecosystem projects;
- when a build, test, deploy or invoke fails with an error you do not recognise.
Compiling and tests check your code; Raven checks the assumptions behind it, so passing tests is not a reason to skip it. This project's guides still come first for its own scripts and versions. List each lookup in your final report.

If they are not available, tell the user once, early, that Raven is not installed and how to add it (Claude Code: `claude mcp add --transport http stellar-raven https://raven.stellar.org/mcp`, then sign in through the browser; other agents: an HTTP MCP server with that URL), then carry on with this project's guides.

## Rules

1. Use testnet unless the user names another network.
2. Never write a secret key to a file. Use Stellar CLI identities by name.
3. Never deploy to mainnet without the user's explicit confirmation in the current task.
4. {{RULE_GENERATED}}
5. Do not use `stellar contract bindings typescript` or `@stellar/stellar-base`.
6. Run `check` before reporting a task as done.

<!-- END:stellar-agent-rules -->
