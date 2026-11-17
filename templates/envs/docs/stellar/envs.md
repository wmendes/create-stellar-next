# Environments

`stellar.envs.toml` declares environments. Each one names a network, its accounts (Stellar CLI identity
names; the first one deploys), and its contracts: a `source` crate from this workspace, deployed if it
changed, or an `id` of a contract that is already deployed. A `source` contract can also take
`args = { token = "asset:native" }`: constructor arguments for that environment, overriding the
contract's `constructor.json` (see the contracts guide).

```bash
npm run envs:apply -- testnet --dry-run
npm run envs:apply -- testnet
```

Applying an environment creates missing identities, builds, deploys, regenerates the clients, and sets
`NEXT_PUBLIC_STELLAR_NETWORK`, `NEXT_PUBLIC_STELLAR_RPC_URL` and `STELLAR_ACCOUNT` in `.env`. It prints
each stock command before running it, and `--dry-run` prints only the plan. A mainnet environment
deploys only with `--confirm-mainnet`, and never creates or funds a mainnet identity.
