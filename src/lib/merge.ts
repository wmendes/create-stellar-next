import type { ComposeContext, EnvKey, ScriptSpec } from "./compose.ts";
import { parseEnv } from "./project.ts";

/**
 * Merges for the files users edit all the time (package.json, .env, AGENTS.md): `add` changes only
 * what its module owns and keeps everything else as the user left it.
 */

export const BLOCK_START = "<!-- BEGIN:stellar-agent-rules -->";
export const BLOCK_END = "<!-- END:stellar-agent-rules -->";

export interface MergeResult {
  content: string;
  /** Human-readable conflicts. Empty when the merge is safe. */
  conflicts: string[];
}

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/** Add the module's scripts and dependencies. A dependency the user already has keeps their version. */
export function mergePackageJson(
  text: string,
  add: {
    scripts: Record<string, ScriptSpec>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  },
  force: boolean,
): MergeResult {
  const pkg = JSON.parse(text) as PackageJson;
  const conflicts: string[] = [];
  const scripts = { ...pkg.scripts };
  for (const [name, spec] of Object.entries(add.scripts)) {
    const current = scripts[name];
    if (current !== undefined && current !== spec.command && !force) {
      conflicts.push(
        `package.json script "${name}" is \`${current}\`; this module needs \`${spec.command}\``,
      );
    } else {
      scripts[name] = spec.command;
    }
  }
  pkg.scripts = scripts;
  for (const field of ["dependencies", "devDependencies"] as const) {
    const wanted = add[field];
    if (Object.keys(wanted).length === 0) continue;
    const other = field === "dependencies" ? pkg.devDependencies : pkg.dependencies;
    const deps = { ...pkg[field] };
    for (const [name, version] of Object.entries(wanted)) {
      if (deps[name] === undefined && other?.[name] === undefined) deps[name] = version;
    }
    pkg[field] = deps;
  }
  return { content: `${JSON.stringify(pkg, null, 2)}\n`, conflicts };
}

/** Append the keys the file lacks. Existing values are configuration and are never changed. */
export function mergeEnv(text: string, keys: EnvKey[], ctx: ComposeContext): string {
  const present = parseEnv(text);
  let out = text;
  for (const key of keys) {
    if (key.key in present) continue;
    if (out !== "" && !out.endsWith("\n")) out += "\n";
    out += `${out === "" ? "" : "\n"}# ${key.comment}\n${key.key}=${key.value(ctx)}\n`;
  }
  return out;
}

/** The tool's block in AGENTS.md, markers included, or undefined. */
export function extractBlock(text: string): string | undefined {
  const start = text.indexOf(BLOCK_START);
  const end = text.indexOf(BLOCK_END);
  if (start === -1 || end === -1 || end < start) return undefined;
  return text.slice(start, end + BLOCK_END.length);
}

/**
 * Replace the tool's block. `previous` is the block the tool would have written before this change:
 * a current block that matches neither it nor `next` was edited by the user.
 */
export function mergeAgents(
  text: string | undefined,
  previous: string,
  next: string,
  fullFile: string,
  force: boolean,
): MergeResult {
  if (text === undefined) return { content: fullFile, conflicts: [] };
  const current = extractBlock(text);
  if (current === undefined) {
    const sep = text.endsWith("\n") ? "\n" : "\n\n";
    return { content: `${text}${sep}${next}\n`, conflicts: [] };
  }
  if (current !== previous && current !== next && !force) {
    return {
      content: text,
      conflicts: [
        "AGENTS.md: the section between the stellar-agent-rules markers was edited. Move your notes outside the markers",
      ],
    };
  }
  return { content: text.replace(current, next), conflicts: [] };
}
