# Scaffold Stellar configuration and `stellar.envs.toml`

Written for T-403 on 2026-11-17. Input for `REPORT.md` (deviations and open decisions).

## What Scaffold Stellar uses today

The plan expected Scaffold Stellar's `environments.toml`. The template that `stellar scaffold init` downloads today (the `stellar-scaffold/ui` repository at its current head, fetched on 2026-11-17 by the installed plugin, `stellar-scaffold` 0.0.25) has **no `environments.toml`**. It has `scaffold.yml`, `version: 2`, in YAML:

- `project.contracts-dir`, `project.clients-dir`
- `networks.<name>`: `accounts` (the first signs deploys), optional `rpc-url`, `rpc-headers`, `extends`, `allow-deploy`
- `contracts.<name>.networks.<network>`: `type: workspace` with `source: <crate package name>`, constructor `args` with `${account.<name>}` interpolation, and `after-deploy` method calls; or `type: contract` with `source: <contract ID>`

The older `environments.toml` format, which the v0 documentation and plan refer to (stellar-scaffold-cli 0.0.21), could not be checked: Raven has no page on it, and the docs.rs README is outside the allowed sources for Stellar facts (SPEC §0.3). It stays unverified.

The installed plugin is 0.0.25. The latest release on crates.io is 0.0.34 (`cargo search stellar-scaffold-cli`, 2026-11-17). Installing 0.0.34, even into the scratchpad, was blocked by the permission system. See SPEC Q-23.

## Field by field: `scaffold.yml` v2 to `stellar.envs.toml`

| `scaffold.yml` v2 | `stellar.envs.toml` | Maps? |
|---|---|---|
| A network name under `networks` (doubles as the environment) | A top-level table (the environment) with `network = "…"` | Yes. Each Scaffold network becomes one environment of the same name |
| `networks.<n>.accounts`, first account signs deploys | `accounts`, first account deploys | Yes, same meaning |
| `networks.<n>.rpc-url` | `rpc_url` | Yes |
| `networks.<n>.rpc-headers` (with `${env.…}`) | — | **No.** v0 has no RPC headers |
| `networks.<n>.extends`, `allow-deploy` | — | **No.** v0 has no inheritance; mainnet deploys need `--confirm-mainnet` instead of a file flag |
| Custom network names (for example `testnet-dev`) | Environment names are free, but `network` must be testnet, local or mainnet | Partly |
| `contracts.<c>.networks.<n>.type: workspace`, `source: <crate>` | `[env.contracts.<c>] source = "<path to crate>"` | Yes, crate name to path |
| `type: contract`, `source: <ID>` | `id = "<ID>"` | Yes |
| Constructor `args`, with `${account.…}` interpolation | — | **No.** v0 deploys without constructor arguments |
| `after-deploy` method calls | — | **No** |
| `project.contracts-dir`, `project.clients-dir` | Fixed: `contracts/`, `packages/` | **No.** v0 locations are fixed by design |
| Contract-first nesting (contract → networks) | Environment-first nesting (environment → contracts) | Yes, mechanically |

## Decision

It does not map cleanly. Constructor arguments, after-deploy calls, network inheritance, RPC headers and custom directories have no v0 equivalent. Reading the file would also need a YAML parser in every generated project. Following Q-09's default ("also accept it if it maps cleanly"), no reader is built. Recorded as DEC-027.

A migration would be by hand, using the table above. The fields that do map cover the common case: accounts, RPC URL, workspace contracts and already deployed contracts.
