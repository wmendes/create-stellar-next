# Hello-world flow, run by hand on testnet

Run on 2026-11-17 for T-004, on macOS arm64 with Stellar CLI 30.0.1, Rust 1.95.0, Node 24.18.1 and `@stellar/stellar-sdk` 17.4.0. It follows the official pages [Deploy to testnet](https://developers.stellar.org/docs/build/smart-contracts/getting-started/deploy-to-testnet#deploy) and [Hello World frontend](https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world-frontend#generate-an-npm-package-for-the-hello-world-contract). Every step succeeded.

One change from the docs: every `stellar` command took `--config-dir <dir>` pointing at a fresh, throwaway directory. The development machine's global config already had a testnet alias named `hello_world`, and `deploy --alias` overwrites an alias without asking. The commands below omit the flag. See "Findings".

## Commands

```bash
# 1. Create the contract workspace
stellar contract init soroban-hello-world
cd soroban-hello-world

# 2. Build and test
stellar contract build
#    → target/wasm32v1-none/release/hello_world.wasm (676 bytes optimised), exports: hello
cargo test
#    → 1 passed

# 3. Create and fund a testnet identity. Referred to by name only
stellar keys generate csn-handrun --network testnet --fund
#    → ✅ Account csn-handrun funded on "Test SDF Network ; September 2015"

# 4. Deploy with an alias
stellar contract deploy \
  --wasm target/wasm32v1-none/release/hello_world.wasm \
  --source-account csn-handrun \
  --network testnet \
  --alias hello_world
#    → ✅ Deployed! CCBLJDK7TPTHPTHOOSL2ILQR57D3RFONESQAC6OPLQ4XJGDCLACUPNMO

# 5. Call it from the CLI
stellar contract invoke --id hello_world --source-account csn-handrun --network testnet -- hello --to RPC
#    → ["Hello","RPC"]  (simulated: the CLI detects a read-only call and does not send it)

# 6. Generate the typed client with the SDK generator
npx @stellar/stellar-sdk generate \
  --network testnet \
  --contract-id $(stellar contract alias show hello_world --network testnet) \
  --output-dir packages/hello_world

# 7. Build the generated package
cd packages/hello_world && npm install && npm run build && cd ../..
```

```js
// 8. call.mjs: call the contract from a script
import { Client } from './packages/hello_world/dist/index.js';
const contract = new Client({
  contractId: process.env.CONTRACT_ID,
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
});
const { result } = await contract.hello({ to: 'Devs!' });
console.log(result.join(' '));
```

```bash
CONTRACT_ID=$(stellar contract alias show hello_world --network testnet) node call.mjs
#    → Hello Devs!
```

## Findings for later tasks

1. **Aliases and identities are global by default.** They live in `~/.config/stellar` unless `--config-dir` is given. A `setup` that deploys with `--alias hello_world` would silently replace an alias of that name from another project. See SPEC Q-20.
2. **`stellar contract init` writes `AGENTS.md` at the workspace root.** It also writes `.gitignore`, `Cargo.toml`, `README.md`, and `contracts/hello-world/` with `Cargo.toml`, `Makefile`, `src/lib.rs` and `src/test.rs`.
3. **`stellar contract alias show` prints an info line on stderr and the ID alone on stdout**, so `$(…)` captures just the ID.
4. **The generated package is named `contract`** unless `--contract-name` is passed. It is TypeScript source with a `build` script (`tsc`) and must be built before plain Node can import it. Its dependencies are `@stellar/stellar-sdk ^17.4.0` and `buffer 6.0.3`.
5. **Generator options that matter for `setup` and `dev`:** `--overwrite` is required to regenerate into an existing directory; `--allow-http` is needed for the local network's `http://localhost:8000/rpc`; `--wasm <path>` generates from a local file without a deploy.
6. **The client takes the contract ID, passphrase and RPC URL at construction.** The generator stores none of them in the package, so `lib/contracts.ts` must supply them.
