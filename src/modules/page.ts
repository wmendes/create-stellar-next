import type { Module } from "../lib/compose.ts";

/** Home page with no contract call. One of the two page modules owns app/page.tsx. */
export const pagePlain: Module = { id: "page-plain", templates: ["page-plain"] };

/** Home page that reads the hello_world contract through lib/contracts.ts, with no wallet. */
export const pageHello: Module = { id: "page-hello", templates: ["page-hello"] };
