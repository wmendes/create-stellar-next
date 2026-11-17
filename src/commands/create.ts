import { basename, resolve } from "node:path";
import type { ComposeContext } from "../lib/compose.ts";
import { compose } from "../lib/compose.ts";
import type { ToolError } from "../lib/errors.ts";
import { installCommand, type PackageManager, runCommand } from "../lib/package-manager.ts";
import { INSTALL_HINTS, type Runner } from "../lib/runner.ts";
import { applyPlan, planWrites, type WriteAction } from "../lib/writer.ts";
import { modulesFor } from "../modules/index.ts";

export interface CreateOptions {
  dir: string;
  cwd: string;
  network: ComposeContext["network"];
  style: ComposeContext["style"];
  contracts: ComposeContext["contracts"];
  local: boolean;
  packageManager: PackageManager;
  force: boolean;
  dryRun: boolean;
  runner: Runner;
}

export interface CreateError extends ToolError {
  code: "EDITED_FILES" | "MISSING_PREREQUISITE" | "COMMAND_FAILED";
}

export interface CreateResult {
  ok: boolean;
  root: string;
  files: { path: string; action: WriteAction }[];
  next: string[];
  error?: CreateError;
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
  const pm = options.packageManager;
  const cd = options.dir === "." ? [] : [`cd ${options.dir}`];
  let after: string[] = [runCommand(pm, "dev")];
  const allSteps = () => [...cd, installCommand(pm), ...after];

  const ctx: ComposeContext = {
    projectName: basename(root),
    network: options.network,
    style: options.style,
    contracts: options.contracts,
    local: options.local,
  };
  const { files, requires, commands, next: setupScripts } = compose(modulesFor(ctx), ctx);
  after = [...setupScripts.map((s) => runCommand(pm, s)), runCommand(pm, "dev")];

  // Check every binary before writing, so a missing one leaves nothing behind.
  const needed = [...new Set([...requires, ...commands.map((c) => c.command), pm])];
  const absent = needed.filter((binary) => !options.runner.available(binary));
  if (absent.length > 0) {
    return {
      ok: false,
      root,
      files: [],
      next: [],
      error: {
        code: "MISSING_PREREQUISITE",
        message: `${absent.map((b) => `\`${b}\``).join(", ")} not found on PATH. Nothing was written.`,
        fix: absent
          .map((b) => INSTALL_HINTS[b] ?? `Install \`${b}\` and make sure it is on PATH.`)
          .join("\n"),
      },
    };
  }

  const plan = await planWrites(root, files, { force: options.force });
  const written = await applyPlan(root, plan, { dryRun: options.dryRun });
  if (!written.ok) {
    return {
      ok: false,
      root,
      files: written.actions,
      next: [],
      error: written.error && { ...written.error, code: "EDITED_FILES" },
    };
  }

  for (const command of commands) {
    const result = await options.runner.run({ ...command, cwd: root });
    if (!result.ok) {
      return { ok: false, root, files: written.actions, next: [], error: result.error };
    }
  }

  const install = await options.runner.run({
    command: pm,
    args: ["install"],
    cwd: root,
    fix: `Run \`${installCommand(pm)}\` in ${options.dir} to finish.`,
  });
  if (!install.ok) {
    return { ok: false, root, files: written.actions, next: allSteps(), error: install.error };
  }
  const next = options.dryRun ? allSteps() : [...cd, ...after];
  return { ok: true, root, files: written.actions, next };
}
