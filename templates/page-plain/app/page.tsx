import { stellar } from "@/lib/stellar";

export default function Home() {
  return (
    <main>
      <h1>Stellar app</h1>
      <p>
        Network: <code>{stellar.network}</code>
      </p>
      <p>
        RPC: <code>{stellar.rpcUrl ?? "not set. Add NEXT_PUBLIC_STELLAR_RPC_URL to .env"}</code>
      </p>
      <p>
        Edit <code>app/page.tsx</code> to get started.
      </p>
    </main>
  );
}
