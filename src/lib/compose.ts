import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { FileSpec } from "./writer.ts";

export interface ComposeContext {
  projectName: string;
  network: "testnet" | "mainnet";
  style: "tailwind" | "none";
  contracts: "hello-world" | "none";
}

/** An external command a module runs after its files are written, through the runner (B-1). */
export interface CommandSpec {
  command: string;
  args: string[];
  /** What to tell the user if it fails. */
  fix: string;
}

export interface ScriptSpec {
  command: string;
  /** One line for the generated AGENTS.md. */
  description: string;
}

export interface EnvKey {
  key: string;
  value: (ctx: ComposeContext) => string;
  comment: string;
}

/** A prerequisite `doctor` checks (T-301). Data only until then. */
export interface DoctorCheck {
  id: string;
  description: string;
  command: string;
  fix: string;
}

/** A module is data plus files (SPEC §3.2). `create` and `add` both use these definitions (B-2). */
export interface Module {
  id: string;
  /** Directories under templates/ copied as-is, after renames and token replacement. */
  templates: string[];
  /** Files computed from the context, for the rare file that cannot be a plain template. */
  files?: (ctx: ComposeContext) => FileSpec[];
  scripts?: Record<string, ScriptSpec>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  env?: EnvKey[];
  doctor?: DoctorCheck[];
  /** Binaries that must be on PATH before anything is written. */
  requires?: string[];
  /** Commands run in the project, in order, after the files are written. */
  commands?: (ctx: ComposeContext) => CommandSpec[];
  /** Lines for the Layout section of the generated AGENTS.md. */
  layout?: string[];
}

export interface Composition {
  files: FileSpec[];
  scripts: Record<string, ScriptSpec>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  env: EnvKey[];
  doctor: DoctorCheck[];
  requires: string[];
  commands: CommandSpec[];
}

export const TEMPLATES_DIR = fileURLToPath(new URL("../../templates/", import.meta.url));

/** npm drops files named .gitignore from packages, so templates store them under this name. */
const RENAMES: Record<string, string> = { _gitignore: ".gitignore" };

const NODE_ENGINE = ">=22.12.0";

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

export function loadTemplate(name: string): FileSpec[] {
  const dir = join(TEMPLATES_DIR, name);
  return listFiles(dir).map((full) => {
    const parts = relative(dir, full).split(sep);
    const last = parts.pop() as string;
    parts.push(RENAMES[last] ?? last);
    return { path: parts.join("/"), content: readFileSync(full, "utf8") };
  });
}

function mergeRecord<T>(
  target: Record<string, T>,
  owners: Record<string, string>,
  source: Record<string, T> | undefined,
  moduleId: string,
  what: string,
  same: (a: T, b: T) => boolean = (a, b) => a === b,
): void {
  for (const [key, value] of Object.entries(source ?? {})) {
    const existing = target[key];
    if (existing !== undefined && !same(existing, value)) {
      throw new Error(`${what} "${key}" is defined by both ${owners[key]} and ${moduleId}`);
    }
    target[key] = value;
    owners[key] ??= moduleId;
  }
}

function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

function renderEnv(env: EnvKey[], ctx: ComposeContext): string {
  const lines = [
    "# Configuration for this app. Next.js loads it from .env.",
    "# Never put a secret key here: refer to Stellar CLI identities by name.",
  ];
  for (const key of env) lines.push("", `# ${key.comment}`, `${key.key}=${key.value(ctx)}`);
  return `${lines.join("\n")}\n`;
}

function renderScripts(scripts: Record<string, ScriptSpec>): string {
  return Object.entries(scripts)
    .map(([name, s]) => `- \`${name}\`: ${s.description}`)
    .join("\n");
}

function replaceTokens(content: string, tokens: Record<string, string>, path: string): string {
  return content.replace(/\{\{([A-Z_]+)\}\}/g, (match, name: string) => {
    const value = tokens[name];
    if (value === undefined) throw new Error(`unknown token ${match} in template ${path}`);
    return value;
  });
}

/** Turn a list of modules into the files of a project. Pure apart from reading templates/. */
export function compose(modules: readonly Module[], ctx: ComposeContext): Composition {
  const scripts: Record<string, ScriptSpec> = {};
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};
  const owners = { scripts: {}, dependencies: {}, devDependencies: {}, files: {}, env: {} };
  const env: EnvKey[] = [];
  const doctor: DoctorCheck[] = [];
  const requires: string[] = [];
  const commands: CommandSpec[] = [];
  const layout: string[] = [];
  const raw: FileSpec[] = [];
  const fileOwners: Record<string, string> = owners.files;

  for (const m of modules) {
    // A script has one owner, even when two modules would agree on its command.
    mergeRecord(scripts, owners.scripts, m.scripts, m.id, "script", () => false);
    mergeRecord(dependencies, owners.dependencies, m.dependencies, m.id, "dependency");
    mergeRecord(devDependencies, owners.devDependencies, m.devDependencies, m.id, "devDependency");
    for (const key of m.env ?? []) {
      if (env.some((e) => e.key === key.key))
        throw new Error(`env key "${key.key}" is defined twice (${m.id})`);
      env.push(key);
    }
    doctor.push(...(m.doctor ?? []));
    for (const r of m.requires ?? []) if (!requires.includes(r)) requires.push(r);
    commands.push(...(m.commands?.(ctx) ?? []));
    layout.push(...(m.layout ?? []));
    const files = [...m.templates.flatMap(loadTemplate), ...(m.files?.(ctx) ?? [])];
    for (const f of files) {
      if (fileOwners[f.path] !== undefined) {
        throw new Error(`file "${f.path}" is written by both ${fileOwners[f.path]} and ${m.id}`);
      }
      fileOwners[f.path] = m.id;
      raw.push(f);
    }
  }

  const tokens = {
    SCRIPTS: renderScripts(scripts),
    LAYOUT: layout.map((line) => `- ${line}`).join("\n"),
  };
  const files = raw.map((f) => ({
    path: f.path,
    content: replaceTokens(f.content, tokens, f.path),
  }));

  const pkg = {
    name: ctx.projectName,
    version: "0.1.0",
    private: true,
    scripts: Object.fromEntries(Object.entries(scripts).map(([k, s]) => [k, s.command])),
    dependencies: sortKeys(dependencies),
    devDependencies: sortKeys(devDependencies),
    engines: { node: NODE_ENGINE },
  };
  const envText = renderEnv(env, ctx);
  files.push(
    { path: "package.json", content: `${JSON.stringify(pkg, null, 2)}\n` },
    { path: ".env.example", content: envText },
    { path: ".env", content: envText },
  );
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, scripts, dependencies, devDependencies, env, doctor, requires, commands };
}
