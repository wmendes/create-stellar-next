# Wallet

`lib/wallet/index.ts` gives every wallet option the same four functions. Pages and components use only
these, so changing the wallet library never changes them.

| Function | Returns |
|---|---|
| `connect()` | Asks the user to connect a wallet; resolves to the account address |
| `disconnect()` | Forgets the connection |
| `getAddress()` | The connected address, or `undefined` |
| `signTransaction(xdr)` | Asks the wallet to sign a transaction (base64 XDR); resolves to the signed XDR |

`components/connect-wallet.tsx` is a ready-made connect button. Add `<ConnectWallet />` to any page.
It is a client component, as is anything that calls these functions: they run in the browser only.

## Signing a contract call

The contract clients take a signer whose `signTransaction` returns `{ signedTxXdr }`:

```ts
"use client";
import { getAddress, signTransaction } from "@/lib/wallet";

const address = await getAddress();
if (!address) throw new Error("Connect a wallet first.");
const signer = {
  publicKey: address,
  signTransaction: async (xdr: string) => ({ signedTxXdr: await signTransaction(xdr) }),
};
```

Pass `signer` to a client from `lib/contracts.ts`, then call `signAndSend()` on the transaction. In
projects with contracts, the contracts guide in this folder (contracts.md) has the full example.
