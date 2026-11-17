import type { ComposeContext, Module } from "../lib/compose.ts";
import { base } from "./base.ts";
import { styleNone, styleTailwind } from "./style.ts";

export const ALL_MODULES: readonly Module[] = [base, styleTailwind, styleNone];

/** The modules a `create` with these options uses, in order. */
export function modulesFor(ctx: ComposeContext): Module[] {
  return [base, ctx.style === "tailwind" ? styleTailwind : styleNone];
}
