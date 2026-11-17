import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connection } from "next/server";
import { Suspense } from "react";
import { stellar } from "@/lib/stellar";
import { Client as Staking } from "@/packages/staking/dist/index.js";

function client(): Staking {
  return new Staking({
    contractId: readFileSync(join(process.cwd(), "deployment.txt"), "utf8").trim(),
    networkPassphrase: stellar.networkPassphrase,
    rpcUrl: stellar.rpcUrl ?? "",
  });
}

async function Amounts({ searchParams }: { searchParams: Promise<{ address?: string }> }) {
  await connection();
  const { address } = await searchParams;
  const { result: total } = await client().total_staked();
  const mine = address ? (await client().staked({ user: address })).result : undefined;
  return (
    <>
      <p>
        Total staked (stroops): <span data-testid="total-staked">{String(total)}</span>
      </p>
      {mine !== undefined && (
        <p>
          Staked by {address} (stroops): <span data-testid="staked-amount">{String(mine)}</span>
        </p>
      )}
    </>
  );
}

export default function StakingPage({
  searchParams,
}: {
  searchParams: Promise<{ address?: string }>;
}) {
  return (
    <main>
      <h1>Staking</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Amounts searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
