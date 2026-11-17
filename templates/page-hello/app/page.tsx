import { connection } from "next/server";
import { Suspense } from "react";
import { helloWorld } from "@/lib/contracts";
import { stellar } from "@/lib/stellar";

async function readGreeting(): Promise<{ greeting: string } | { error: string }> {
  try {
    const { result } = await helloWorld().hello({ to: "Stellar" });
    return { greeting: result.join(" ") };
  } catch (error) {
    // Some network errors arrive with an empty message; fall back to their text, and say where we called.
    const reason = (error instanceof Error && error.message) || String(error) || "unknown error";
    return { error: `${reason} (RPC: ${stellar.rpcUrl ?? "not set"})` };
  }
}

async function Greeting() {
  // Call the contract when a request arrives, not while `next build` prerenders the page.
  await connection();
  const outcome = await readGreeting();
  if ("error" in outcome) {
    return <p data-testid="greeting-error">Could not call the contract: {outcome.error}</p>;
  }
  return <p data-testid="greeting">{outcome.greeting}</p>;
}

export default function Home() {
  return (
    <main>
      <h1>Stellar app</h1>
      <p>
        Network: <code>{stellar.network}</code>
      </p>
      <p>
        The <code>hello_world</code> contract says:
      </p>
      <Suspense fallback={<p>Calling the contract…</p>}>
        <Greeting />
      </Suspense>
      <p>
        Edit <code>app/page.tsx</code> to change this page, or <code>contracts/</code> to change the
        contract.
      </p>
    </main>
  );
}
