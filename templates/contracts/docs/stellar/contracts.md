# Contracts

The Rust contracts live in `contracts/`, a workspace created by `stellar contract init`. Each contract
is a crate in `contracts/contracts/<name>/`. Read `contracts/AGENTS.md` for the contract side.

## The loop

1. Change the contract in `contracts/contracts/<name>/src/lib.rs`, and its tests in `src/test.rs`.
2. Run its tests: `npm run contracts:test`.
3. Run `npm run setup`. It builds, deploys the contracts whose Wasm changed, and regenerates the
   typed clients in `packages/`. Contracts that did not change are not redeployed.
4. Use the client from `lib/contracts.ts`.

`npm run dev` does steps 3 and 4 for you whenever a `.rs` or `Cargo.toml` file changes, through
`npm run contracts:watch`. It never deploys to mainnet.

| Script | What it runs |
|---|---|
| `npm run contracts:build` | `stellar contract build`, to `contracts/target/wasm32v1-none/release/` |
| `npm run contracts:test` | `cargo test` for the workspace |
| `npm run contracts:deploy` | Build, then deploy every contract again, always as a new instance |
| `npm run contracts:bindings` | Regenerate the clients in `packages/` from the built Wasm |

## Names and IDs

Deploys use Stellar CLI aliases named `<project>-<contract>`, such as `my-app-hello_world`. The setup
script copies each contract ID into `packages/contract-ids.json`, keyed by network, and
`lib/contracts.ts` reads it. Call a deployed contract from the command line by its alias:

```bash
stellar contract invoke --id my-app-hello_world --network testnet --source-account dev -- hello --to you
```

## Reading and writing from the app

A read is a simulation and needs no wallet:

```ts
import { helloWorld } from "@/lib/contracts";

const { result } = await helloWorld().hello({ to: "Stellar" });
```

A write must be signed. Pass the signer to the client, then sign and send the transaction:

```ts
const client = helloWorld({ publicKey: address, signTransaction });
const tx = await client.someWriteMethod({ /* args */ });
const { result } = await tx.signAndSend();
```

When the project has a wallet, the wallet guide in this folder (wallet.md) shows where `address` and
`signTransaction` come from.

## Adding a contract

```bash
stellar contract init contracts --name counter
npm run setup
```

The setup script then deploys `counter` and generates `packages/counter`. Add an exported client for it
in `lib/contracts.ts`, following `helloWorld`.

## Generated code

Never edit `packages/`. The clients there come from the JavaScript SDK's generator
(`npx @stellar/stellar-sdk generate`). Change the contract, then run `npm run contracts:bindings`.
