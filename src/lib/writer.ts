import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { TOOL_NAME } from "../name.ts";
import type { ToolError } from "./errors.ts";
import {
  hashContent,
  MANIFEST_FILE,
  type Manifest,
  readManifest,
  serializeManifest,
  writeManifest,
} from "./manifest.ts";

export interface FileSpec {
  /** Project-relative POSIX path. */
  path: string;
  content: string;
}

export type WriteAction = "create" | "update" | "unchanged" | "conflict";

export interface PlannedWrite {
  path: string;
  action: WriteAction;
  content: string;
}

export interface WritePlan {
  writes: PlannedWrite[];
  manifest: Manifest;
}

export interface WriteResult {
  ok: boolean;
  actions: { path: string; action: WriteAction }[];
  error?: ToolError;
}

/** Throws on a path that is empty, absolute, Windows-style or escapes the target directory. */
export function normalizeProjectPath(path: string): string {
  if (path === "" || path.includes("\\") || /^[A-Za-z]:/.test(path) || path.includes("\0")) {
    throw new Error(`invalid path ${JSON.stringify(path)}: use a relative POSIX path`);
  }
  if (path.startsWith("/")) {
    throw new Error(`path ${JSON.stringify(path)} is outside the target directory`);
  }
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) {
        throw new Error(`path ${JSON.stringify(path)} is outside the target directory`);
      }
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  if (parts.length === 0) throw new Error(`invalid path ${JSON.stringify(path)}`);
  return parts.join("/");
}

async function readIfExists(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * Decide what to do with each file. Reads the disk and the manifest; writes nothing.
 *
 * - absent → create
 * - present with the same bytes → unchanged
 * - present and still matching the hash the tool recorded → update
 * - anything else present → conflict, or update with `force`
 */
export async function planWrites(
  root: string,
  files: readonly FileSpec[],
  options: {
    force: boolean;
    /** Paths whose content was already merged with the user's version: never a conflict. */
    merged?: ReadonlySet<string>;
  },
): Promise<WritePlan> {
  const seen = new Set<string>();
  const normalized = files.map((file) => {
    const path = normalizeProjectPath(file.path);
    if (path === MANIFEST_FILE) throw new Error(`${MANIFEST_FILE} is reserved for the tool`);
    if (seen.has(path)) throw new Error(`${path} appears twice in one plan`);
    seen.add(path);
    return { path, content: file.content };
  });

  const manifest = await readManifest(root);
  const next: Manifest = { version: 1, files: { ...manifest.files } };
  const writes: PlannedWrite[] = [];

  for (const { path, content } of normalized) {
    const target = hashContent(content);
    const existing = await readIfExists(join(root, path));
    let action: WriteAction;
    if (existing === undefined) action = "create";
    else if (hashContent(existing) === target) action = "unchanged";
    else if (
      manifest.files[path] === hashContent(existing) ||
      options.force ||
      options.merged?.has(path)
    )
      action = "update";
    else action = "conflict";
    if (action !== "conflict") next.files[path] = target;
    writes.push({ path, action, content });
  }

  writes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { writes, manifest: next };
}

/** Apply a plan. Writes nothing on a dry run or when any file conflicts. */
export async function applyPlan(
  root: string,
  plan: WritePlan,
  options: { dryRun: boolean },
): Promise<WriteResult> {
  const actions = plan.writes.map(({ path, action }) => ({ path, action }));
  const conflicts = plan.writes.filter((w) => w.action === "conflict").map((w) => w.path);
  if (conflicts.length > 0) {
    return {
      ok: false,
      actions,
      error: {
        code: "EDITED_FILES",
        message: `These files were changed since ${TOOL_NAME} wrote them, or were not written by it: ${conflicts.join(", ")}. Nothing was written.`,
        fix: "Keep your edits and skip this step, or rerun the same command with --force to overwrite them.",
      },
    };
  }
  if (options.dryRun) return { ok: true, actions };

  for (const write of plan.writes) {
    if (write.action === "create" || write.action === "update") {
      const file = join(root, write.path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, write.content);
    }
  }
  const current = await readIfExists(join(root, MANIFEST_FILE));
  if (current?.toString("utf8") !== serializeManifest(plan.manifest)) {
    await mkdir(root, { recursive: true });
    await writeManifest(root, plan.manifest);
  }
  return { ok: true, actions };
}
