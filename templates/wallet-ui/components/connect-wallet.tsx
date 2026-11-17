"use client";

import { useEffect, useState } from "react";
import { connect, disconnect, getAddress } from "@/lib/wallet";

/** A connect button. It uses only lib/wallet, so changing wallets never changes this file. */
export function ConnectWallet() {
  const [address, setAddress] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    getAddress().then(setAddress, () => setAddress(undefined));
  }, []);

  async function toggle() {
    setError(undefined);
    try {
      if (address) {
        await disconnect();
        setAddress(undefined);
      } else {
        setAddress(await connect());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <button type="button" data-testid="connect-wallet" onClick={toggle}>
        {address ? `Disconnect ${address.slice(0, 4)}…${address.slice(-4)}` : "Connect wallet"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
