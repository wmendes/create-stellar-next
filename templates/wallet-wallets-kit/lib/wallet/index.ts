/**
 * Wallet connection through Stellar Wallets Kit (many wallets behind one modal).
 * Every wallet option exposes the same four functions, so pages never depend on the kit.
 */
import type { Networks } from "@creit.tech/stellar-wallets-kit/types";
import { stellar } from "@/lib/stellar";

type Kit = typeof import("@creit.tech/stellar-wallets-kit/sdk").StellarWalletsKit;
let ready: Promise<Kit> | undefined;

/** Load and start the kit on first use, in the browser only. */
function kit(): Promise<Kit> {
  ready ??= (async () => {
    const [{ StellarWalletsKit }, { defaultModules }] = await Promise.all([
      import("@creit.tech/stellar-wallets-kit/sdk"),
      import("@creit.tech/stellar-wallets-kit/modules/utils"),
    ]);
    StellarWalletsKit.init({
      modules: defaultModules(),
      network: stellar.networkPassphrase as Networks,
    });
    return StellarWalletsKit;
  })();
  return ready;
}

/** Ask the user to choose a wallet and connect it. Returns the account address. */
export async function connect(): Promise<string> {
  const { address } = await (await kit()).authModal();
  return address;
}

export async function disconnect(): Promise<void> {
  await (await kit()).disconnect();
}

/** The connected account's address, or undefined when no wallet is connected. */
export async function getAddress(): Promise<string | undefined> {
  try {
    return (await (await kit()).getAddress()).address;
  } catch {
    return undefined;
  }
}

/** Ask the wallet to sign a transaction (XDR, base64) and return the signed XDR. */
export async function signTransaction(xdr: string): Promise<string> {
  const { signedTxXdr } = await (await kit()).signTransaction(xdr, {
    networkPassphrase: stellar.networkPassphrase,
    address: await getAddress(),
  });
  return signedTxXdr;
}
