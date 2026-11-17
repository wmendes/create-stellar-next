# Sources

Every external fact that was checked, and every piece of code or document that was copied in. A fact that is not in this file has not been checked: see the `[VERIFY: …]` items in `docs/SPEC.md` §6.3.

## Facts

| Date       | Fact | Value | Version | Source |
|------------|------|-------|---------|--------|
| 2026-11-17 | Node on the development machine | v24.18.1 | n/a | Installed binary: `node --version` |
| 2026-11-17 | npm on the development machine | 11.16.0 | n/a | Installed binary: `npm --version` |
| 2026-11-17 | pnpm on the development machine | 11.21.0 | n/a | Installed binary: `pnpm --version` |
| 2026-11-17 | yarn on the development machine | 1.22.22 | n/a | Installed binary: `yarn --version` |
| 2026-11-17 | bun on the development machine | 1.4.2 | n/a | Installed binary: `bun --version` |
| 2026-11-17 | rustc on the development machine | 1.95.0 (59807616e 2026-04-14) | n/a | Installed binary: `rustc --version` |
| 2026-11-17 | cargo on the development machine | 1.95.0 (f2d3ce0bd 2026-03-21) | n/a | Installed binary: `cargo --version` |
| 2026-11-17 | Rust targets installed | `aarch64-apple-darwin`, `wasm32v1-none` | rustc 1.95.0 | Installed tool: `rustup target list --installed` |
| 2026-11-17 | Stellar CLI on the development machine | 30.0.1 (f2a7b74175c34585f3b30a1abf42a2d41cbcc390) | n/a | Installed binary: `stellar --version` |
| 2026-11-17 | `stellar skill` exists as a command, described as "Print an AI-agent skill guide for using the Stellar CLI". Behaviour not checked | Present | Stellar CLI 30.0.1 | Installed binary: `stellar --help` |
| 2026-11-17 | `stellar container` exists as a command, described as "Start local networks in containers". Subcommands and behaviour not checked | Present | Stellar CLI 30.0.1 | Installed binary: `stellar --help` |
| 2026-11-17 | `stellar registry` is not a command or plugin on this machine | Absent | Stellar CLI 30.0.1 | Installed binary: `stellar --help`, `stellar plugin ls` |
| 2026-11-17 | Stellar CLI plugins installed | `scaffold`, `26.0.0.old` | Stellar CLI 30.0.1 | Installed binary: `stellar plugin ls` |
| 2026-11-17 | Docker on the development machine | Client 29.9.2 (build a82e528). Daemon not running | n/a | Installed binary: `docker --version`, `docker info` |
| 2026-11-17 | git and GitHub CLI on the development machine | git 2.54.0, gh 2.92.0 (logged in) | n/a | Installed binaries: `git --version`, `gh --version`, `gh auth status` |
| 2026-11-17 | Raven is reachable and lists these Stellar docs operations: `stellarDocs.search_docs`, `stellarDocs.search_sdk_cli_tools_docs`, `stellarDocs.search_doc_titles`, `stellarDocs.search_soroban_contract_docs`, `stellarDocs.search_wallet_dapp_docs`. These are search hits, which are cards and not evidence. No Stellar fact has been grounded yet | Reachable | n/a | Raven `search` (service `stellarDocs`), observed 2026-11-17 |
| 2026-11-17 | The v0 documentation states it was "verified against `stellar-cli` 28.1.0". This is the document's own statement, not rechecked | 28.1.0 | n/a | `docs/reference/v0-documentation.md`, Prerequisites table |
| 2026-11-17 | A second Stellar CLI binary in `~/.cargo/bin` | 28.1.0 (c0f4d0da891bbf214c08b8c5035ae6db80e9a3bd), shadowed on `PATH` by Homebrew's 30.0.1 | n/a | Installed binaries: `~/.cargo/bin/stellar --version`, `which stellar` |
| 2026-11-17 | Homebrew's current stable `stellar-cli` | 30.0.1 | n/a | Package manager: `brew info stellar-cli` |
| 2026-11-17 | Rust toolchains installed | `stable` (1.95.0), `1.95.0`, `1.93.0`; `1.95.0` has `wasm32v1-none` | n/a | Installed tool: `rustup toolchain list`, `rustup +1.95.0 target list --installed` |

## Copied code

No code has been copied. The two rows below are documents written by the project's author, copied in unchanged.

| Date       | Our path | Origin (URL + commit) | License | Task |
|------------|----------|-----------------------|---------|------|
| 2026-11-17 | `docs/reference/v0-documentation.md` | https://claude.ai/artifact/2xG6XVUVNmEoLYLf4ehFjU, revision 11, Markdown export, 15,024 bytes | Author's own document. Project licence is undecided (SPEC Q-06) | T-000 |
| 2026-11-17 | `docs/reference/generators-not-frameworks.md` | https://claude.ai/artifact/9zjx3cCCHLi7Vn9ujmbRVv, revision 11, Markdown export, 13,732 bytes | Author's own document. Project licence is undecided (SPEC Q-06) | T-000 |
