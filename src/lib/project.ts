import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** What the tool can learn about a project from its files. Read-only. */
export interface ProjectInfo {
  root: string;
  /** False outside a project (no package.json). */
  exists: boolean;
  scripts: Record<string, string>;
  /** Keys from .env, without process.env. */
  env: Record<string, string>;
}

/** Parse KEY=VALUE lines, ignoring comments and blank lines, like the generated scripts do. */
export function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1] as string] = (match[2] as string).replace(/^["']|["']$/g, "");
  }
  return values;
}

export function readProject(root: string): ProjectInfo {
  const pkgFile = join(root, "package.json");
  const exists = existsSync(pkgFile);
  let scripts: Record<string, string> = {};
  if (exists) {
    try {
      scripts =
        (JSON.parse(readFileSync(pkgFile, "utf8")) as { scripts?: Record<string, string> })
          .scripts ?? {};
    } catch {
      scripts = {};
    }
  }
  const envFile = join(root, ".env");
  const env = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
  return { root, exists, scripts, env };
}
