# create-stellar-next

A Node CLI that generates a plain Next.js App Router app with a Stellar contract workflow: a Rust
contract workspace from the Stellar CLI, typed clients from the JavaScript SDK's generator, and
testnet by default. The generated project is ordinary code with no runtime dependency on this tool.

**Status: v0, not published.** `create-stellar-next` is a working name. Nothing is on npm, so the
commands below run from a local build or a packed tarball (see [Development](#development)).

## Quickstart

```bash
create-stellar-next my-app      # writes the app, runs `stellar contract init`, installs
cd my-app
npm run setup                   # identity, build, deploy to testnet, typed client
npm run dev                     # http://localhost:3000 shows the contract's reply
```

Run in a terminal, `create` asks about contracts, network, wallet, local network, environments,
styling and package manager, skipping any choice you give as a flag. With `--yes`, `--json` or no terminal it asks nothing and uses
the defaults.

`setup` creates and funds a testnet identity named `dev` in your Stellar CLI config, builds the
hello-world contract, deploys it, and generates its client. Run it again at any time: contracts that
did not change are not redeployed.

## Requirements

| Needed | When |
|---|---|
| Node.js 22.12.0 or newer | Always |
| Rust (with the `wasm32v1-none` target) and the Stellar CLI | With contracts (the default) |
| Docker | Only with `--local` |

`create-stellar-next doctor` checks these, plus the identity in `.env` and its funding, and prints the
command that fixes each problem. It exits 3 when a check fails.

Tested on macOS (arm64) with Node 24.18.1, Rust 1.95.0, Stellar CLI 30.0.1, `@stellar/stellar-sdk`
17.4.0 and Next.js 16.4.6, against testnet and a local network. CI (`.github/workflows/ci.yml`) runs on Linux and Windows;
macOS is checked locally, not in CI, for now.

## Commands

```bash
create-stellar-next <dir> [options]           # create a project
create-stellar-next add <module> [options]    # contract | local | wallet | envs
create-stellar-next doctor [--json]           # check prerequisites and the project
```

| Option | Values | Default |
|---|---|---|
| `--contracts` | `hello-world`, `none`, or a deployed contract ID (`C…`) | `hello-world` |
| `--wallet` | `none`, `wallets-kit`, `extension` | `none` |
| `--network` | `testnet`, `mainnet` | `testnet` |
| `--local` | add `network:start` and `network:stop` for a local network in Docker | off |
| `--envs` | add `stellar.envs.toml` and `envs:apply` (needs `--contracts hello-world`) | off |
| `--style` | `tailwind`, `none` | `tailwind` |
| `--package-manager` | `npm`, `pnpm`, `yarn`, `bun` | detected |
| `--yes` | accept defaults, never prompt (implied without a terminal) | |
| `--json` | print one JSON object: `schemas/output.schema.json` (`doctor`: `schemas/doctor.schema.json`) | |
| `--dry-run` | print the plan, write and run nothing | |
| `--force` | overwrite files you edited | |

Exit codes: `0` success, `1` failure, `2` invalid arguments, `3` missing prerequisite. Every error names
its cause and the command that fixes it.

`add` works in projects this tool did not create, such as a fresh `create-next-app` app. It merges into
`package.json`, `.env` and `AGENTS.md` instead of overwriting them, refuses to replace a file you edited
unless you pass `--force`, and changes nothing when run twice.

## The generated project

```text
my-app/
├── app/                 Next.js App Router
├── lib/stellar.ts       network settings from .env
├── lib/contracts.ts     one typed client per contract
├── lib/wallet/          only with --wallet: connect, disconnect, getAddress, signTransaction
├── contracts/           Rust workspace from `stellar contract init`
├── packages/            generated clients and contract-ids.json (do not edit)
├── scripts/             the plain Node scripts behind the npm scripts
├── docs/stellar/        guides for this project, matching its versions
├── AGENTS.md            the project's guide for coding agents; CLAUDE.md imports it
└── .env                 configuration: identity names only, never secret keys
```

| Script | What it does |
|---|---|
| `setup` | Identity, build, deploy (only what changed), typed clients |
| `dev` | Next.js dev server, plus a watcher that rebuilds, redeploys and regenerates when a contract changes |
| `check` | Typecheck, lint, contract tests and `next build`: the definition of done |
| `contracts:build`, `contracts:test` | `stellar contract build`, `cargo test` |
| `contracts:deploy` | Deploy again; mainnet needs `-- --confirm-mainnet` |
| `contracts:bindings` | Regenerate clients with `npx @stellar/stellar-sdk generate` |

Every script prints the stock command it runs, so you can run it yourself.

## Built for coding agents

Each project carries an `AGENTS.md` with its layout, scripts and rules: use testnet unless told
otherwise, never write a secret key to a file, never deploy to mainnet without explicit confirmation,
never edit `packages/`, avoid two outdated Stellar patterns, and run `check` before reporting done. The
guides in `docs/stellar/` include a table of outdated Stellar patterns and their replacements. Every
command takes flags instead of prompts, and `--json` gives machine-readable output.

## Coming from Scaffold Stellar

See [docs/migrating-from-scaffold-stellar.md](docs/migrating-from-scaffold-stellar.md).

## Development

```bash
npm ci
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e              # generate, install and check projects (about a minute)
npm run test:e2e:contracts    # the full contract loop in a browser; needs Docker or E2E_NETWORK=testnet
npm run test:docs             # every CLI command the docs name exists; needs the Stellar CLI
node dist/bin.js my-app       # run the CLI from the build
```

How to work on this repository: `AGENTS.md`, then `CLAUDE.md` and `docs/SPEC.md`. Every external fact
the tool relies on is logged with its source in `docs/SOURCES.md`.

## License

Apache-2.0. See [LICENSE](LICENSE).
