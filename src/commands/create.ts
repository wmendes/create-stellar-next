import { basename, resolve } from "node:path";
import type { ComposeContext } from "../lib/compose.ts";
import { compose } from "../lib/compose.ts";
import type { ToolError } from "../lib/errors.ts";
import { installCommand, type PackageManager, runCommand } from "../lib/package-manager.ts";
import { applyPlan, planWrites, type WriteAction } from "../lib/writer.ts";
import { modulesFor } from "../modules/index.ts";

export interface CreateOptions {
  dir: string;
  cwd: string;
  network: ComposeContext["network"];
  style: ComposeContext["style"];
  packageManager: PackageManager;
  force: boolean;
  dryRun: boolean;
}

export interface CreateResult {
  ok: boolean;
  root: string;
  files: { path: string; action: WriteAction }[];
  next: string[];
  error?: ToolError;
}

// The pattern validate-npm-package-name enforces for new package names.
const NPM_NAME = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export function projectNameError(name: string): string | undefined {
  if (name.length === 0 || name.length > 214) return "must be 1 to 214 characters";
  if (!NPM_NAME.test(name)) {
    return "must be lowercase and use only letters, digits, '-', '.', '_' or '~'";
  }
  return undefined;
}

export async function create(options: CreateOptions): Promise<CreateResult> {
  const root = resolve(options.cwd, options.dir);
  const ctx: ComposeContext = {
    projectName: basename(root),
    network: options.network,
    style: options.style,
  };
  const { files } = compose(modulesFor(ctx), ctx);
  const plan = await planWrites(root, files, { force: options.force });
  const result = await applyPlan(root, plan, { dryRun: options.dryRun });
  const pm = options.packageManager;
  const next = [
    ...(options.dir === "." ? [] : [`cd ${options.dir}`]),
    installCommand(pm),
    runCommand(pm, "dev"),
  ];
  return { ok: result.ok, root, files: result.actions, next, error: result.error };
}
