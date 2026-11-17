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

Raven is a hosted MCP server for Stellar documentation, network data and ecosystem research, at
`https://raven.stellar.org/mcp`. It is read-only: it cannot sign or submit transactions.

- If you have Raven's tools (named `stellar-raven`, possibly listed by name only until you load them),
  use them to verify Stellar facts before your code depends on them: SDK and CLI behaviour, RPC
  methods, protocol limits, contract and asset IDs, SEPs. For this project's own scripts and versions,
  its guides above still come first.
- If you do not, tell the user once, early, that Raven is not installed and suggest adding it, then
  carry on with this project's guides. In Claude Code:
  `claude mcp add --transport http stellar-raven https://raven.stellar.org/mcp`, then sign in through
  the browser when asked. Other agents: add it as an HTTP MCP server with that URL.

## Rules

1. Use testnet unless the user names another network.
2. Never write a secret key to a file. Use Stellar CLI identities by name.
3. Never deploy to mainnet without the user's explicit confirmation in the current task.
4. {{RULE_GENERATED}}
5. Do not use `stellar contract bindings typescript` or `@stellar/stellar-base`.
6. Run `check` before reporting a task as done.

<!-- END:stellar-agent-rules -->
