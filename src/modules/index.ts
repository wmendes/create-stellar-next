import type { ComposeContext, Module } from "../lib/compose.ts";
import { base } from "./base.ts";
import { contracts } from "./contracts.ts";
import { pageHello, pagePlain } from "./page.ts";
import { styleNone, styleTailwind } from "./style.ts";

export const ALL_MODULES: readonly Module[] = [
  base,
  styleTailwind,
  styleNone,
  pagePlain,
  pageHello,
  contracts,
];

/** The modules a `create` with these options uses, in order. */
export function modulesFor(ctx: ComposeContext): Module[] {
  const withContracts = ctx.contracts === "hello-world";
  return [
    base,
    ctx.style === "tailwind" ? styleTailwind : styleNone,
    withContracts ? pageHello : pagePlain,
    ...(withContracts ? [contracts] : []),
  ];
}
