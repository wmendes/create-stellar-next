# create-stellar-next: v0 documentation

Nov 12, 2026 · @Wlademyr Mendes

## Overview

`create-stellar-next` generates a plain Next.js app, a Rust contracts workspace, and typed contract clients, then gets out of the way. It is a generator, not a framework: the output has no runtime dependency on this tool.

This document is the v0 specification. Nothing is published yet, and `create-stellar-next` is a working name.

Design principles:

- **Plain code.** Everything generated is ordinary source you own and can edit or delete.
- **Stock tools.** Contracts are built and deployed with the Stellar CLI. Clients come from the JavaScript SDK generator. No custom build system.
- **Testnet first.** A new project works without Docker or a local network.
- **Everything optional.** Wallets, contracts, local network, registry and declarative environments are each a flag.
- **Agent first.** Every command runs without a terminal prompt, prints JSON on request, and the project explains itself in `AGENTS.md`.

## Quickstart

Four commands take you from nothing to a page that calls a contract on testnet.

```bash
npx create-stellar-next my-app
cd my-app
npm run setup     # creates and funds a testnet identity, builds, deploys, generates the client
npm run dev       # Next.js on http://localhost:3000
```

The same thing without prompts, for scripts and agents:

```bash
npx create-stellar-next my-app --yes --contracts hello-world --wallet none --json
```

`--yes` accepts the defaults: testnet, the hello-world contract, no wallet, no registry, no declarative environments.

## Prerequisites

Only Node.js is always required. Everything else is needed only for the option that uses it.

| Requirement | Needed when | Notes |
| --- | --- | --- |
| Node.js 22+ | Always | Minimum for the current `@stellar/stellar-sdk` |
| Rust and the Stellar CLI | `--contracts` is not `none` | Verified against `stellar-cli` 28.1.0 |
| Docker | `--local` | Runs the Quickstart image through `stellar container start` |
| `stellar-registry-cli` | `--registry` | Installed separately with cargo |

`npx create-stellar-next doctor` reports which of these are missing and prints the install command for each.

## CLI reference

The CLI has three commands: `create` (the default), `add`, and `doctor`.

### create

```bash
npx create-stellar-next <dir> [flags]
```

Every prompt has a flag. With a flag set, its prompt is skipped.

| Flag | Values | Default | Effect |
| --- | --- | --- | --- |
| `--contracts` | `hello-world`, `none`, or a contract ID | `hello-world` | Adds a `contracts/` workspace, or only a typed client for an existing contract |
| `--wallet` | `none`, `wallets-kit`, `extension`, `passkeys` | `none` | Copies the chosen wallet adapter into `lib/wallet/` |
| `--network` | `testnet`, `mainnet` | `testnet` | Sets the network values in `.env` |
| `--local` | boolean | off | Adds a local network script and a `local` network option |
| `--registry` | boolean | off | Adds registry publish and deploy scripts |
| `--envs` | boolean | off | Adds declarative environments in `stellar.envs.toml` |
| `--style` | `tailwind`, `none` | `tailwind` | Styling for the example page |
| `--package-manager` | `npm`, `pnpm`, `yarn`, `bun` | detected | Used for install and script docs |

### add

`add` applies one module to an existing Next.js project, including one not created by this tool.

```bash
npx create-stellar-next add wallet --wallet wallets-kit
npx create-stellar-next add contract <contract-id-or-path>
npx create-stellar-next add local
npx create-stellar-next add registry
npx create-stellar-next add envs
```

`add` is idempotent: running it twice makes no further changes. It refuses to overwrite a file you edited unless `--force` is passed.

### doctor

`doctor` checks Node, Rust, the Stellar CLI, Docker (only with `--local`), and whether the configured identity exists and is funded.

### Flags on every command

| Flag | Effect |
| --- | --- |
| `--yes` | Accept defaults, never prompt |
| `--json` | Print one JSON object: files written, commands to run next, and errors |
| `--dry-run` | List what would change and write nothing |
| `--force` | Allow overwriting edited files |

Exit codes: `0` success, `1` failure, `2` invalid arguments, `3` missing prerequisite.

## Generated project

The default project is a standard Next.js App Router app with two extra folders: `contracts/` and `packages/`.

```text
my-app/
├── app/                  # Next.js App Router pages
├── lib/
│   ├── stellar.ts        # network config read from .env
│   ├── contracts.ts      # one exported client per contract
│   └── wallet/           # only with --wallet
├── contracts/            # Rust workspace from `stellar contract init`
├── packages/             # generated typed clients, do not edit
├── scripts/              # small Node scripts behind the npm scripts
├── .env.example
├── AGENTS.md
└── package.json
```

File locations and script names are fixed across all projects. Stack choices inside them are yours.

| Script | What it runs |
| --- | --- |
| `npm run setup` | Identity, build, deploy and client generation in one pass |
| `npm run dev` | Next.js dev server, plus contract watch when contracts are present |
| `npm run contracts:build` | `stellar contract build` |
| `npm run contracts:test` | `cargo test` in `contracts/` |
| `npm run contracts:deploy` | `stellar contract deploy` to the network in `.env` |
| `npm run contracts:bindings` | The JavaScript SDK client generator, into `packages/` |
| `npm run check` | Typecheck, lint, contract tests and `next build` |

Configuration lives in `.env` only:

```bash
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_ACCOUNT=dev            # name of a Stellar CLI identity, never a secret key
```

Deployed contract IDs are stored as Stellar CLI aliases, so no ID needs to be copied by hand.

## Contract workflow

Every contract script is a thin wrapper over a stock command, so you can run the underlying command yourself at any time.

1. Create and fund an identity. `setup` does this once.

   ```bash
   stellar keys generate dev --network testnet --fund
   ```
2. Build.

   ```bash
   stellar contract build
   ```
3. Deploy and record an alias.

   ```bash
   stellar contract deploy \
     --wasm target/wasm32v1-none/release/hello_world.wasm \
     --source-account dev \
     --network testnet \
     --alias hello_world
   ```
4. Generate the typed client.

   ```bash
   npx @stellar/stellar-sdk generate \
     --contract-id $(stellar contract alias show hello_world --network testnet) \
     --output-dir packages/hello_world
   ```
5. Import it from `lib/contracts.ts` and call it from a page.

Clients are generated with the SDK generator, not `stellar contract bindings typescript`. The Stellar docs mark that CLI command as deprecated because it targets an older SDK major version.

In `npm run dev`, a watcher reruns steps 2 to 4 when a file under `contracts/` changes. The watcher is a plain Node script in `scripts/` that you can read and edit.

## Networks

Testnet is the default, so a new project needs no Docker and no local node.

| Network | How to select | What you need |
| --- | --- | --- |
| Testnet | Default | Nothing extra. Identities are funded with `--fund` |
| Local | `--local` or `add local` | Docker. Adds `npm run network:start`, which runs `stellar container start local` |
| Mainnet | `--network mainnet` | An RPC URL from a provider, set in `.env`. No default mainnet RPC is shipped |

Switching network is a change to `.env`, followed by `npm run contracts:deploy` and `npm run contracts:bindings`.

Mainnet deploys require `--confirm-mainnet` on the deploy script. Without it the script prints the command it would run and exits.

## Wallets

No wallet is installed unless you choose one. The default page reads from the contract and needs no wallet.

| Option | What is added | Notes |
| --- | --- | --- |
| `none` | Nothing | Default |
| `wallets-kit` | Stellar Wallets Kit and a connect button | Multi-wallet. Version 2 is distributed on JSR, not npm |
| `extension` | One browser extension wallet SDK and a `useWallet` hook | Smallest footprint. Package name is an open decision, see the last section |
| `passkeys` | Smart account kit with passkey sign-in | Smart wallets, no extension needed |

Every option writes the same small interface to `lib/wallet/index.ts`: `connect`, `disconnect`, `getAddress`, `signTransaction`. Pages depend on that interface, so changing wallets later means rerunning `add wallet`, not rewriting pages.

## Opt-in modules

The registry and declarative environments are off by default and each is enabled by one flag, at creation or later with `add`.

### Registry: `--registry`

`--registry` adds scripts that wrap the existing Stellar registry CLI for publishing Wasm and deploying named, versioned contracts.

- Adds `npm run registry:publish` and `npm run registry:deploy`, which call `stellar registry`.
- Requires `stellar-registry-cli`. `doctor` checks for it once the flag is on.
- Does not change `contracts:deploy`. Direct deploys keep working alongside registry deploys.

### Declarative environments: `--envs`

`--envs` adds one file, `stellar.envs.toml`, that describes each environment, and a script that applies it.

```toml
[testnet]
network = "testnet"
accounts = ["dev"]

[testnet.contracts.hello_world]
source = "contracts/hello-world"

[production]
network = "mainnet"

[production.contracts.hello_world]
id = "C..."          # use an already deployed contract
```

- `npm run envs:apply -- testnet` creates missing identities, builds, deploys what is not deployed, regenerates clients, and writes `.env`.
- It prints every stock command before running it. `--dry-run` prints the plan only.
- It never starts a local network or Docker by itself. A `local` environment needs `--local` too.
- Without the flag, nothing reads this file and `.env` stays the only configuration.

Whether this file should accept Scaffold Stellar's `environments.toml` format unchanged is an open decision.

## Building with agents

The tool assumes an AI agent is often the one running it, so every project ships the context and the checks an agent needs.

- **`AGENTS.md` at the project root.** It lists the layout, the exact scripts, the conventions, and the rules below. `stellar contract init` also writes an `AGENTS.md` for the contracts workspace, and the root file links to it.
- **No prompts required.** `--yes` and explicit flags cover every choice. `--json` returns files written, next commands, and structured errors.
- **One check.** `npm run check` is the definition of done: typecheck, lint, contract tests, production build.
- **`doctor --json`.** Each failed check names the missing piece and the command that fixes it.
- **Version-matched docs.** The package ships its docs in `node_modules/create-stellar-next/docs/`, and the site publishes `llms.txt`.
- **Upstream context.** `AGENTS.md` points to `stellar skill` for CLI conventions and to the JavaScript SDK `llms.txt`.
- **Generated code is marked.** Files under `packages/` start with a header naming the script that regenerates them.

Rules written into `AGENTS.md`:

1. Use testnet unless the user names another network.
2. Never write a secret key to a file. Refer to Stellar CLI identities by name.
3. Never deploy to mainnet without the user's explicit confirmation in the current task.
4. Do not edit `packages/`. Change the contract and run `npm run contracts:bindings`.
5. Do not use `stellar contract bindings typescript` or import `@stellar/stellar-base`. Both are outdated.
6. Run `npm run check` before reporting a task as done.

Before each release, a fixed set of tasks is run through coding agents in CI, for example "add a counter contract and a page that increments it". The pass rate is published with the release.

## Coming from Scaffold Stellar

Every Scaffold Stellar feature has an equivalent here, but most are opt-in and run as visible stock commands.

| Scaffold Stellar | Here | Default |
| --- | --- | --- |
| `stellar scaffold init` | `npx create-stellar-next` | On |
| `stellar scaffold upgrade` | `add contract <path>` on an existing workspace | On request |
| `stellar scaffold build` | `contracts:build` and `contracts:bindings` | On |
| `stellar scaffold watch` | Watcher inside `npm run dev` | On with contracts |
| `environments.toml` | `stellar.envs.toml` with `--envs` | Off |
| `stellar registry` | `registry:*` scripts with `--registry` | Off |
| Local network in development | `--local` | Off |
| Vite and React frontend | Next.js App Router | On |
| Rust CLI plugins installed with cargo | One Node package run with `npx` | On |

Not covered in v0: setting contract metadata from `Cargo.toml` at build time, and starting a project from the OpenZeppelin Wizard.

## v0 scope and open decisions

v0 is done when the Quickstart works end to end on testnet and `npm run check` passes on a fresh project on macOS, Linux and Windows.

In v0:

- `create` with all flags in the CLI reference
- `add wallet`, `add contract`, `add local`, `add registry`, `add envs`
- `doctor`
- `AGENTS.md`, `--json`, `--dry-run`, and the agent task suite in CI

Not in v0:

- Frameworks other than Next.js
- A hosted template gallery or example apps beyond hello-world
- An MCP server. The CLI is the interface for agents
- Contract metadata injection and OpenZeppelin Wizard import

Open decisions:

- [ ] Final name and the GitHub organization that owns it
- [ ] Package for the `extension` wallet option. Sources disagree between Freighter and `@stellar/varial-sdk`
- [ ] Whether `stellar.envs.toml` accepts Scaffold Stellar's `environments.toml` format unchanged
- [ ] License. Apache-2.0 is assumed
- [ ] Whether the Stellar docs Tools page lists this beside Scaffold Stellar or in its place

## Sources

- [Scaffold Stellar, Stellar docs](https://developers.stellar.org/docs/tools/scaffold-stellar)
- [stellar-scaffold-cli README, v0.0.21](https://docs.rs/crate/stellar-scaffold-cli/0.0.21/source/README.md)
- [Hello World frontend: generate an NPM package](https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world-frontend#generate-an-npm-package-for-the-hello-world-contract)
- [Deploy to testnet](https://developers.stellar.org/docs/build/smart-contracts/getting-started/deploy-to-testnet#deploy)
- [Stellar CLI manual: container start](https://developers.stellar.org/docs/tools/cli/stellar-cli#stellar-container-start)
- [Stellar CLI cookbook: keys](https://developers.stellar.org/docs/tools/cli/cookbook/stellar-keys)
- [Stellar CLI for Agents](https://developers.stellar.org/docs/tools/cli/agent-cli)
- [Stellar CLI agent skills and AGENTS.md](https://developers.stellar.org/docs/tools/cli/agent-cli/skills#project-context-agents-md)
- [JavaScript SDK llms.txt](https://stellar.github.io/js-stellar-sdk/llms.txt)
