import { core } from "../modules/core.ts";
import { contracts } from "../modules/contracts.ts";
import { ALL_MODULES } from "../modules/index.ts";
import type { Module } from "./compose.ts";
import type { ProjectInfo } from "./project.ts";

/** The modules a project uses, judged from its files. Outside a project: what a default create needs. */
export function detectModules(project: ProjectInfo): Module[] {
  if (!project.exists) return [core, contracts];
  return ALL_MODULES.filter((m) => {
    if (m.detect) return m.detect(project);
    const scripts = Object.keys(m.scripts ?? {});
    return scripts.length > 0 && scripts.every((s) => s in project.scripts);
  });
}
