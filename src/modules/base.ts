import type { Module } from "../lib/compose.ts";

/**
 * The Next.js scaffold `create` writes. Versions are those create-next-app 16.4.6 resolved on
 * 2026-11-17 (docs/SOURCES.md). `add` never applies it: a project the tool did not create keeps its own.
 */
export const base: Module = {
  id: "base",
  templates: ["base"],
  scripts: {
    dev: {
      command: "node scripts/dev.mjs",
      description:
        "Next.js dev server on http://localhost:3000, plus the contract watcher when `contracts/` exists",
    },
    build: { command: "next build", description: "Production build" },
    start: { command: "next start", description: "Serve the production build" },
    lint: { command: "eslint", description: "ESLint with the Next.js rules" },
  },
  layout: ["`app/`: Next.js App Router pages"],
  dependencies: { next: "16.4.6", react: "19.3.0", "react-dom": "19.3.0" },
  devDependencies: {
    "@types/node": "22.20.5",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    eslint: "9.39.5",
    "eslint-config-next": "16.4.6",
    typescript: "5.9.3",
  },
  // Projects `create` made carry scripts/dev.mjs; projects the tool did not create do not.
  detect: (project) => project.read("scripts/dev.mjs") !== undefined,
};
