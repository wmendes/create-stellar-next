# Coming from Scaffold Stellar

This note maps Scaffold Stellar concepts to this tool, for people moving a project or comparing the
two. Scaffold Stellar facts here were checked against its plugin version 0.0.34 on 2026-11-17.

## What corresponds to what

| Scaffold Stellar | Here |
|---|---|
| `stellar scaffold init` | `create-stellar-next <dir>` |
| `stellar scaffold upgrade` (turn a contract workspace into a project) | `create-stellar-next add contract` in an existing Next.js app |
| `stellar scaffold build` | `npm run contracts:build`, then `npm run contracts:bindings`; or `npm run setup` for both plus deploy |
| `stellar scaffold watch` | The watcher in `npm run dev` (or `npm run contracts:watch`) |
| `scaffold.yml` networks and contracts | `stellar.envs.toml` with `--envs` (partly: see below) |
| Generated clients in `app-lib/clients/` | Generated clients in `packages/`, used through `lib/contracts.ts` |
| Vite and React frontend | Next.js App Router |
| A local network by default | Testnet by default; a local network with `--local` |
| Rust CLI plugins installed with cargo | One Node package; the Stellar CLI and Rust are still needed for contracts |
| `stellar registry` | Not included in v0 |

## Configuration: `scaffold.yml` and `stellar.envs.toml`

`stellar.envs.toml` covers the common case: per-environment accounts (the first deploys), an RPC URL,
contracts built from the workspace with their constructor arguments, and contracts that are already
deployed. It does not cover after-deploy calls, network inheritance (`extends`, `allow-deploy`), RPC headers
or custom directories. Scaffold's configuration is not read automatically. The field-by-field mapping
is in [scaffold-mapping.md](scaffold-mapping.md).

## Moving a project by hand

1. Create a project: `create-stellar-next my-app --contracts none`.
2. Add the contract workspace: `create-stellar-next add contract`, then copy each contract crate from
   your Scaffold project's `contracts/` into `contracts/contracts/`. A contract whose constructor takes
   arguments gets them from a `constructor.json` beside its `Cargo.toml`, such as
   `{ "token": "asset:native", "admin": "dev" }`.
3. Run `npm run setup`. It deploys each contract under an alias named `<project>-<contract>` and
   generates its client in `packages/`.
4. Export a client for each contract from `lib/contracts.ts`, following `helloWorld`.
5. Port the React components into `app/`. Wallet code can move to `lib/wallet/` with
   `create-stellar-next add wallet --wallet wallets-kit`; Scaffold's template also uses Stellar Wallets Kit.
6. Run `npm run check`.
