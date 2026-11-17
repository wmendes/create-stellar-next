/**
 * Wallet connection through the Varial browser extension (formerly Freighter), with @stellar/varial-sdk.
 * Every wallet option exposes the same four functions, so pages never depend on the SDK.
 */
import { stellar } from "@/lib/stellar";

/** Load the SDK on first use, in the browser only. */
async function varial() {
  return (await import("@stellar/varial-sdk")).default;
}

/** The SDK returns errors instead of throwing them. */
function check<T extends { error?: { message: string } }>(result: T): T {
  if (result.error) throw new Error(`Varial: ${result.error.message}`);
  return result;
}

/** Ask Varial for access to the user's account. Returns the account address. */
export async function connect(): Promise<string> {
  const api = await varial();
  if (!check(await api.isConnected()).isConnected) {
    throw new Error(
      "Varial is not installed. Install it from https://varialwallet.com, then try again.",
    );
  }
  return check(await api.requestAccess()).address;
}

export async function disconnect(): Promise<void> {
  check(await (await varial()).disconnect());
}

/** The connected account's address, or undefined when the app has no access yet. */
export async function getAddress(): Promise<string | undefined> {
  const result = await (await varial()).getAddress();
  return result.error || !result.address ? undefined : result.address;
}

/** Ask Varial to sign a transaction (XDR, base64) and return the signed XDR. */
export async function signTransaction(xdr: string): Promise<string> {
  const api = await varial();
  const result = await api.signTransaction(xdr, {
    networkPassphrase: stellar.networkPassphrase,
    address: await getAddress(),
  });
  return check(result).signedTxXdr;
}
