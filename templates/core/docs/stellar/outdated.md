# Outdated patterns

Stellar tooling changed quickly, and older examples (and older training data) use patterns that no
longer work or are deprecated. Use the right-hand column instead.

| Outdated | Use instead | Source |
|---|---|---|
| `stellar contract bindings typescript` | `npx @stellar/stellar-sdk generate` (here: the contracts:bindings script) | https://developers.stellar.org/docs/tools/cli/stellar-cli#stellar-contract-bindings-typescript |
| `@stellar/stellar-base` | `@stellar/stellar-sdk`, which includes it (also as `@stellar/stellar-sdk/base`) | installed: npm marks `@stellar/stellar-base` 15.0.0 deprecated, "rolled into @stellar/stellar-sdk" |
| `SorobanRpc.Server` | `rpc.Server` from `@stellar/stellar-sdk` | installed: `@stellar/stellar-sdk` 17.4.0 exports `rpc` and no `SorobanRpc` |
| `soroban` CLI commands, such as `soroban contract build` | The same commands under `stellar`, such as `stellar contract build` | https://developers.stellar.org/docs/networks/software-versions |
| `wasm32-unknown-unknown` target | `wasm32v1-none` (Rust 1.84 or newer), through `stellar contract build` | https://developers.stellar.org/docs/learn/fundamentals/contract-development/rust-dialect#limited-webassembly-features |
| `cargo build --target wasm32v1-none` for contracts | `stellar contract build`, which applies the settings the network needs | https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world#build-the-contract |
| `@stellar/freighter-api` | `@stellar/varial-sdk` (Freighter is now Varial) | https://developers.stellar.org/docs/build/guides/freighter/prompt-to-sign-tx |
| `stellar fee-stats` | `stellar fees stats` | installed: Stellar CLI 30.0.1 marks `fee-stats` deprecated |

Soroban-RPC is now called Stellar RPC (renamed in November 2024,
https://developers.stellar.org/docs/data/apis/rpc). It is the same service.
