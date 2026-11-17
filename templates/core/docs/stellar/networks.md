# Networks

The app reads its network from `.env`. Environment variables with the same names override `.env`, in
the scripts and in Next.js alike.

| Key | Meaning |
|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` (the default), `local` or `mainnet` |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | The RPC endpoint for that network |
| `STELLAR_ACCOUNT` | Projects with contracts only: the Stellar CLI identity that deploys. A name, never a secret key |

`lib/stellar.ts` turns these into `stellar.network`, `stellar.networkPassphrase` and `stellar.rpcUrl`.
Import it instead of hard-coding a network.

## Testnet

The default. The RPC endpoint is `https://soroban-testnet.stellar.org`. Accounts are funded for free:

```bash
stellar keys generate dev --network testnet --fund
stellar keys fund dev --network testnet
```

Testnet is reset from time to time. After a reset, run the setup script again: it redeploys whatever
the network no longer has.

## Local

A private network in Docker: set `NEXT_PUBLIC_STELLAR_NETWORK=local` and
`NEXT_PUBLIC_STELLAR_RPC_URL=http://localhost:8000/rpc`. Start it with:

```bash
stellar container start local
```

Its state is lost when it stops.

## Mainnet

No mainnet RPC URL is shipped: set your provider's URL in `.env`. Mainnet uses real funds. Never deploy
to it, or send a transaction on it, without the user's explicit confirmation in the current task.

## Switching network

Change `NEXT_PUBLIC_STELLAR_NETWORK` and `NEXT_PUBLIC_STELLAR_RPC_URL` in `.env`. In a project with
contracts, then run the setup script: it deploys the contracts on the new network if they are missing
there, and records their IDs per network in `packages/contract-ids.json`.
