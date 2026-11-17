import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** What the tool can learn about a project from its files. Read-only. */
export interface ProjectInfo {
  root: string;
  /** False outside a project (no package.json). */
  exists: boolean;
  scripts: Record<string, string>;
  /** Keys from .env, overridden by the same keys in the environment (as the scripts and Next.js do). */
  env: Record<string, string>;
  /** Read a project file, or undefined when it does not exist. */
  read(path: string): string | undefined;
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

export function readProject(
  root: string,
  environment: Record<string, string | undefined> = process.env,
): ProjectInfo {
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
  // Only the keys the tool reads, so unrelated shell variables never look like configuration.
  for (const [key, value] of Object.entries(environment)) {
    if (value !== undefined && /^(NEXT_PUBLIC_STELLAR_|STELLAR_ACCOUNT$)/.test(key))
      env[key] = value;
  }
  const read = (path: string) => {
    const file = join(root, path);
    return existsSync(file) ? readFileSync(file, "utf8") : undefined;
  };
  return { root, exists, scripts, env, read };
}
