import type { Module } from "../lib/compose.ts";
import type { ProjectInfo } from "../lib/project.ts";

/** Which wallet library a project's lib/wallet/index.ts uses. */
const uses = (library: string) => (p: ProjectInfo) =>
  p.read("lib/wallet/index.ts")?.includes(library) ?? false;

const button = "`components/connect-wallet.tsx`: a connect button that uses only `lib/wallet`";

/** Stellar Wallets Kit v2 from npm (SPEC Q-19, DEC-023). */
export const walletsKit: Module = {
  id: "wallet-wallets-kit",
  group: "wallet",
  templates: ["wallet-ui", "wallet-wallets-kit"],
  dependencies: { "@creit.tech/stellar-wallets-kit": "2.8.0" },
  detect: uses("@creit.tech/stellar-wallets-kit"),
  layout: [
    "`lib/wallet/`: `connect`, `disconnect`, `getAddress`, `signTransaction` through Stellar Wallets Kit",
    button,
  ],
};

/** The Varial browser extension (formerly Freighter) through @stellar/varial-sdk (SPEC V-09). */
export const walletExtension: Module = {
  id: "wallet-extension",
  group: "wallet",
  templates: ["wallet-ui", "wallet-extension"],
  dependencies: { "@stellar/varial-sdk": "7.0.0" },
  detect: uses("@stellar/varial-sdk"),
  layout: [
    "`lib/wallet/`: `connect`, `disconnect`, `getAddress`, `signTransaction` through the Varial extension (`@stellar/varial-sdk`)",
    button,
  ],
};

export const WALLETS: Record<string, Module> = {
  "wallets-kit": walletsKit,
  extension: walletExtension,
};
