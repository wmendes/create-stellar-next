# The deployed contract

This project talks to one contract that is already deployed: its ID is
`NEXT_PUBLIC_STELLAR_CONTRACT_ID` in `.env`, on the network in `NEXT_PUBLIC_STELLAR_NETWORK`.

`npm run setup` fetches the contract's interface from the network and generates a typed client in
`packages/contract` with the JavaScript SDK's generator (`npx @stellar/stellar-sdk generate`). Run it
again after changing the ID or the network. `npm run contracts:bindings` does the same.

```ts
import { contract } from "@/lib/contracts";

// Reads are simulations and need no wallet. The method names come from the contract.
const client = contract();
```

A write must be signed. Pass a signer, then sign and send:

```ts
const tx = await contract({ publicKey: address, signTransaction }).someWriteMethod({ /* args */ });
const { result } = await tx.signAndSend();
```

Never edit `packages/`: regenerate it instead.
