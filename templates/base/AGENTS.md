<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent guide

A Next.js App Router app with a Stellar contract workflow. All configuration is in `.env`.

## Layout

{{LAYOUT}}

## Scripts

{{SCRIPTS}}

## Stellar CLI

Run `stellar skill` for the Stellar CLI's own guide for agents. Check `stellar <command> --help` before using a flag.

## Rules

1. Use testnet unless the user names another network.
2. Never write a secret key to a file. Use Stellar CLI identities by name.
3. Never deploy to mainnet without the user's explicit confirmation in the current task.
4. Do not edit `packages/`. Change the contract and run `contracts:bindings`.
5. Do not use `stellar contract bindings typescript` or `@stellar/stellar-base`.
6. Run `check` before reporting a task as done.
