/**
 * Typed client for the already deployed contract in NEXT_PUBLIC_STELLAR_CONTRACT_ID.
 * packages/contract is generated from the network by the setup script: never edit it by hand.
 */
import { Client } from "@/packages/contract/dist/index.js";
import type { contract as sdk } from "@stellar/stellar-sdk";
import { stellar } from "@/lib/stellar";

/** Needed only for writes: the account that signs, and how to sign. See docs/stellar/contract-client.md. */
export interface Signer {
  publicKey: string;
  signTransaction: sdk.SignTransaction;
}

export function contract(signer?: Signer): Client {
  const contractId = process.env.NEXT_PUBLIC_STELLAR_CONTRACT_ID;
  if (!contractId) {
    throw new Error("NEXT_PUBLIC_STELLAR_CONTRACT_ID is not set. Add the contract ID to .env.");
  }
  if (!stellar.rpcUrl) {
    throw new Error("NEXT_PUBLIC_STELLAR_RPC_URL is not set. Add it to .env.");
  }
  return new Client({
    contractId,
    networkPassphrase: stellar.networkPassphrase,
    rpcUrl: stellar.rpcUrl,
    allowHttp: stellar.network === "local",
    ...signer,
  });
}
