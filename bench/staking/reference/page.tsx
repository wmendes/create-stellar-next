import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConnectWallet } from "@/components/connect-wallet";
import { stellar } from "@/lib/stellar";
import { Client as Staking } from "@/packages/staking/dist/index.js";
import { StakeForm } from "./stake-form";

function contractId(): string {
  return readFileSync(join(process.cwd(), "deployment.txt"), "utf8").trim();
}

async function TotalStaked() {
  await connection();
  const client = new Staking({
    contractId: contractId(),
    networkPassphrase: stellar.networkPassphrase,
    rpcUrl: stellar.rpcUrl ?? "",
  });
  const { result } = await client.total_staked();
  return <span data-testid="total-staked">{String(result)}</span>;
}

export default function StakingPage() {
  return (
    <main>
      <h1>Staking</h1>
      <ConnectWallet />
      <p>
        Total staked (stroops):{" "}
        <Suspense fallback={<span>Loading…</span>}>
          <TotalStaked />
        </Suspense>
      </p>
      <StakeForm contractId={contractId()} />
    </main>
  );
}
