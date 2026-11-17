# Changelog

## Unreleased: v0

First version. Not published.

### Commands

- `create-stellar-next <dir>`: a Next.js App Router project with the hello-world contract workspace,
  a contract-ID client (`--contracts <id>`), or no contracts (`--contracts none`); optional wallet
  (`--wallet wallets-kit` or `extension`), local network (`--local`), declarative environments
  (`--envs`) and styling (`--style`).
- `add contract`, `add contract <id>`, `add local`, `add wallet --wallet <option>`, `add envs`: apply one
  module to an existing project, including one this tool did not create.
- `doctor`: check Node, the Stellar CLI, Rust and its target, Docker (with `--local`), and the
  configured identity and its funding.
- `--yes`, `--json`, `--dry-run`, `--force` on every command; JSON schemas in `schemas/`.

### Generated projects

- Scripts: `setup`, `dev` (with a contract watcher), `check`, `contracts:build`, `contracts:test`,
  `contracts:deploy`, `contracts:bindings`, `contracts:watch`, `network:start`, `network:stop`,
  `envs:apply`.
- Constructor arguments for deploys: `constructor.json` beside a contract, or `args` in `stellar.envs.toml`;
  `asset:native` resolves to the network's XLM contract.
- `AGENTS.md`, `CLAUDE.md`, and guides in `docs/stellar/`, including outdated Stellar patterns and their
  replacements.

### Not in v0

- The contract registry and the passkeys wallet option (dropped 2026-11-17).
- Reading Scaffold Stellar's `scaffold.yml` or `environments.toml`.
