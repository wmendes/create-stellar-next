import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { connection } from "next/server";
import { Suspense } from "react";
import { stellar } from "@/lib/stellar";
import { Client as Staking } from "@/packages/staking/dist/index.js";

const contractId = () => readFileSync(join(process.cwd(), "deployment.txt"), "utf8").trim();

function client(): Staking {
  return new Staking({
    contractId: contractId(),
    networkPassphrase: stellar.networkPassphrase,
    rpcUrl: stellar.rpcUrl ?? "",
  });
}

type Activity = { id: string; type: string; address: string; amount: string };

/** The contract's stake and unstake events still held by the RPC, newest first. */
async function recentEvents(limit: number): Promise<Activity[]> {
  const server = new rpc.Server(stellar.rpcUrl ?? "");
  const filters: rpc.Api.EventFilter[] = [{ type: "contract", contractIds: [contractId()] }];
  const { sequence } = await server.getLatestLedger();
  // A first call reports the oldest ledger the RPC still holds; page forward from there.
  const probe = await server.getEvents({ startLedger: sequence, filters, limit: 1 });
  const found: Activity[] = [];
  // Each request scans a bounded ledger window and may return no events with an advanced cursor, so
  // page until the cursor (a TOID: ledger in the high 32 bits) reaches the latest ledger.
  const cursorLedger = (cursor: string) =>
    Number(BigInt(cursor.split("-")[0] ?? "0") / BigInt(2 ** 32));
  let page = await server.getEvents({ startLedger: probe.oldestLedger, filters, limit: 100 });
  for (let i = 0; i < 100; i++) {
    for (const e of page.events) {
      const [name, user] = e.topic.map((t) => scValToNative(t));
      if (name !== "stake" && name !== "unstake") continue;
      found.push({
        id: e.id,
        type: name,
        address: String(user),
        amount: String(scValToNative(e.value)),
      });
    }
    if (page.events.length < 100 && cursorLedger(page.cursor) >= page.latestLedger) break;
    page = await server.getEvents({ cursor: page.cursor, filters, limit: 100 });
  }
  return found.reverse().slice(0, limit);
}

async function Amounts({ searchParams }: { searchParams: Promise<{ address?: string }> }) {
  await connection();
  const { address } = await searchParams;
  const [{ result: total }, mine, events] = await Promise.all([
    client().total_staked(),
    address
      ? client()
          .staked({ user: address })
          .then((r) => r.result)
      : undefined,
    recentEvents(10),
  ]);
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
      <h2>Recent activity</h2>
      <ul>
        {events.map((e) => (
          <li
            key={e.id}
            data-testid="event"
            data-type={e.type}
            data-address={e.address}
            data-amount={e.amount}
          >
            {e.type} {e.amount} by {e.address}
          </li>
        ))}
      </ul>
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
