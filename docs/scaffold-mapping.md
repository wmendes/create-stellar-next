# Scaffold Stellar configuration and `stellar.envs.toml`

Written for T-403 on 2026-11-17. Input for `REPORT.md` (deviations and open decisions).

## What Scaffold Stellar uses today

The plan expected Scaffold Stellar's `environments.toml`. A project made today with `stellar scaffold init` has **no `environments.toml`**. It has `scaffold.yml`, `version: 2`, in YAML. Checked twice on 2026-11-17: with the plugin 0.0.25 (template download only), then with the latest release, 0.0.34 (`stellar scaffold init <dir> --yes -p npm`, which completed). Both wrote the same file, except that 0.0.34 adds `project.package-manager`:

- `project.contracts-dir`, `project.clients-dir`, `project.package-manager` (0.0.34)
- `networks.<name>`: `accounts` (the first signs deploys), optional `rpc-url`, `rpc-headers`, `extends`, `allow-deploy`
- `contracts.<name>.networks.<network>`: `type: workspace` with `source: <crate package name>`, constructor `args` with `${account.<name>}` interpolation, and `after-deploy` method calls; or `type: contract` with `source: <contract ID>`

The older `environments.toml` is still accepted by 0.0.34 for projects that have one. Its help says `build --network` is "ignored by projects using environments.toml", and `watch` "monitor[s] contracts and environments.toml". New projects do not get it. Its field layout could not be checked: Raven has no page on it, and the docs.rs README is outside the allowed sources for Stellar facts (SPEC §0.3).

Versions: `stellar-scaffold` 0.0.34 (commit 92865100), built against Stellar CLI 28.1.0, installed by the human on 2026-11-17. A new project pins Rust 1.93.0 in its `rust-toolchain.toml`. Scaffold 0.0.34 also has `doctor` and `config` (validates `scaffold.yml`) commands.

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
| `project.package-manager` | Detected from the lockfile, or `--package-manager` at create | Not needed |
| Contract-first nesting (contract → networks) | Environment-first nesting (environment → contracts) | Yes, mechanically |

## Decision

It does not map cleanly. Constructor arguments, after-deploy calls, network inheritance, RPC headers and custom directories have no v0 equivalent. Reading the file would also need a YAML parser in every generated project. Following Q-09's default ("also accept it if it maps cleanly"), no reader is built. Recorded as DEC-027.

A migration would be by hand, using the table above. The fields that do map cover the common case: accounts, RPC URL, workspace contracts and already deployed contracts.
