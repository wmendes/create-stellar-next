/** Network settings for this app, read from .env. Change the network there, not here. */

const PASSPHRASES = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
  local: "Standalone Network ; February 2017",
} as const;

export type StellarNetwork = keyof typeof PASSPHRASES;

function readNetwork(value: string | undefined): StellarNetwork {
  if (value !== undefined && Object.hasOwn(PASSPHRASES, value)) return value as StellarNetwork;
  throw new Error(
    `NEXT_PUBLIC_STELLAR_NETWORK is ${JSON.stringify(value)}. Set it in .env to one of: ${Object.keys(PASSPHRASES).join(", ")}. .env.example lists every key.`,
  );
}

// Next.js inlines NEXT_PUBLIC_ variables only when they are read by their full name.
const network = readNetwork(process.env.NEXT_PUBLIC_STELLAR_NETWORK);

export const stellar = {
  network,
  networkPassphrase: PASSPHRASES[network],
  rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL || undefined,
} as const;
