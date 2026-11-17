import type { ComposeContext, Module } from "../lib/compose.ts";
import { base } from "./base.ts";
import { contractClient } from "./contract-client.ts";
import { core } from "./core.ts";
import { contracts } from "./contracts.ts";
import { local } from "./local.ts";
import { WALLETS, walletExtension, walletsKit } from "./wallet.ts";
import { pageHello, pagePlain } from "./page.ts";
import { styleNone, styleTailwind } from "./style.ts";

export const ALL_MODULES: readonly Module[] = [
  base,
  core,
  styleTailwind,
  styleNone,
  pagePlain,
  pageHello,
  contracts,
  contractClient,
  local,
  walletsKit,
  walletExtension,
];

/** A contract address: C followed by 55 base32 characters. */
export const CONTRACT_ID = /^C[A-Z2-7]{55}$/;

/** The modules a `create` with these options uses, in order. */
export function modulesFor(ctx: ComposeContext): Module[] {
  const withContracts = ctx.contracts === "hello-world";
  return [
    base,
    core,
    ctx.style === "tailwind" ? styleTailwind : styleNone,
    withContracts ? pageHello : pagePlain,
    ...(withContracts ? [contracts] : []),
    ...(CONTRACT_ID.test(ctx.contracts) ? [contractClient] : []),
    ...(ctx.local ? [local] : []),
    ...(ctx.wallet && WALLETS[ctx.wallet] ? [WALLETS[ctx.wallet] as Module] : []),
  ];
}
