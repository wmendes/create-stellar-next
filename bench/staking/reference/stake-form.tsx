"use client";

import { type FormEvent, useState } from "react";
import { stellar } from "@/lib/stellar";
import { getAddress, signTransaction } from "@/lib/wallet";
import { Client as Staking } from "@/packages/staking/dist/index.js";

export function StakeForm({ contractId }: { contractId: string }) {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const address = await getAddress();
      if (!address) throw new Error("Connect a wallet first.");
      const client = new Staking({
        contractId,
        networkPassphrase: stellar.networkPassphrase,
        rpcUrl: stellar.rpcUrl ?? "",
        publicKey: address,
        signTransaction: async (xdr: string) => ({ signedTxXdr: await signTransaction(xdr) }),
      });
      const tx = await client.stake({ user: address, amount: BigInt(amount) });
      await tx.signAndSend();
      setStatus("Staked.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <form onSubmit={submit}>
      <input
        data-testid="stake-amount"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount in stroops"
      />
      <button type="submit" data-testid="stake-submit">
        Stake
      </button>
      {status ? <p>{status}</p> : null}
    </form>
  );
}
