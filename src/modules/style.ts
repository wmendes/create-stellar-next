import type { Module } from "../lib/compose.ts";

export const styleTailwind: Module = {
  id: "style-tailwind",
  templates: ["style-tailwind"],
  devDependencies: { "@tailwindcss/turbopack": "4.3.3", tailwindcss: "4.3.3" },
};

export const styleNone: Module = {
  id: "style-none",
  templates: ["style-none"],
};
