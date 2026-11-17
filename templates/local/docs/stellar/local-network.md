# Local network

A private Stellar network in Docker, through the Stellar CLI's `stellar container` commands.

```bash
npm run network:start
```

Then set `NEXT_PUBLIC_STELLAR_NETWORK=local` and `NEXT_PUBLIC_STELLAR_RPC_URL=http://localhost:8000/rpc`
in `.env`. In a project with contracts, run `npm run setup`: it funds the identity from the local
network's faucet and deploys there.

`npm run network:stop` stops it. Its state is lost: run `npm run setup` again after the next start.
Docker must be installed and running.
