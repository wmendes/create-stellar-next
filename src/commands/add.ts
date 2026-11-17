import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ComposeContext, compose, type Module } from "../lib/compose.ts";
import { detectModules } from "../lib/detect.ts";
import type { ToolError } from "../lib/errors.ts";
import { extractBlock, mergeAgents, mergeEnv, mergePackageJson } from "../lib/merge.ts";
import { installCommand, type PackageManager, runCommand } from "../lib/package-manager.ts";
import { readProject } from "../lib/project.ts";
import { INSTALL_HINTS, type Runner } from "../lib/runner.ts";
import { applyPlan, type FileSpec, planWrites, type WriteAction } from "../lib/writer.ts";
import { contractClient } from "../modules/contract-client.ts";
import { contracts } from "../modules/contracts.ts";
import { ALL_MODULES } from "../modules/index.ts";
import { local } from "../modules/local.ts";
import { WALLETS } from "../modules/wallet.ts";

export interface AddOptions {
  root: string;
  target: "local" | "contract" | "wallet";
  /** For `add wallet --wallet <option>`. */
  wallet?: string;
  /** For `add contract <id>`. */
  contractId?: string;
  packageManager: PackageManager;
  force: boolean;
  dryRun: boolean;
  runner: Runner;
}

export interface AddError extends ToolError {
  code: "INVALID_ARGUMENT" | "EDITED_FILES" | "MISSING_PREREQUISITE" | "COMMAND_FAILED";
}

export interface AddResult {
  ok: boolean;
  files: { path: string; action: WriteAction }[];
  next: string[];
  error?: AddError;
}

const GENERATED = new Set(["package.json", ".env", ".env.example"]);

function read(root: string, path: string): string | undefined {
  const file = join(root, path);
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

/** The package manager a project already uses, judged by its lockfile. */
export function lockfileManager(root: string): PackageManager | undefined {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "bun.lock")) || existsSync(join(root, "bun.lockb"))) return "bun";
  if (existsSync(join(root, "package-lock.json"))) return "npm";
  return undefined;
}

export async function add(options: AddOptions): Promise<AddResult> {
  const { root, force, runner } = options;
  const project = readProject(root);
  const detected = detectModules(project);
  const module: Module =
    options.target === "local"
      ? local
      : options.target === "wallet"
        ? (WALLETS[options.wallet ?? ""] as Module)
        : options.contractId
          ? contractClient
          : contracts;
  const other =
    module === contracts ? contractClient : module === contractClient ? contracts : undefined;
  if (other && detected.includes(other)) {
    return fail(
      "INVALID_ARGUMENT",
      "This project already has a different contract setup.",
      other === contracts
        ? "It has the contracts/ workspace from `add contract`. Add another contract inside contracts/ instead."
        : "It has a client for NEXT_PUBLIC_STELLAR_CONTRACT_ID. Change that key in .env instead.",
    );
  }

  const pkgText = read(root, "package.json") as string;
  const network = project.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const ctx: ComposeContext = {
    projectName: (JSON.parse(pkgText) as { name?: string }).name ?? "app",
    network,
    style: "none",
    contracts: options.contractId ?? (options.target === "contract" ? "hello-world" : "none"),
    local: options.target === "local",
    wallet: options.wallet,
  };
  const parts = compose([module], ctx);
  const pm = options.packageManager;

  const needed = [...new Set([...parts.requires, ...parts.commands.map((c) => c.command), pm])];
  const absent = needed.filter((b) => !runner.available(b));
  if (absent.length > 0) {
    return fail(
      "MISSING_PREREQUISITE",
      `${absent.map((b) => `\`${b}\``).join(", ")} not found on PATH. Nothing was written.`,
      absent.map((b) => INSTALL_HINTS[b] ?? `Install \`${b}\`.`).join("\n"),
    );
  }

  // The files users edit: merged, never overwritten.
  const pkg = mergePackageJson(pkgText, parts, force);
  const envText = (file: string) => mergeEnv(read(root, file) ?? "", parts.env, ctx);
  // Render in registry order, so the same modules always give the same AGENTS.md block.
  const canonical = (modules: Module[]) => ALL_MODULES.filter((m) => modules.includes(m));
  // A module replaces any other module of its group, such as one wallet for another.
  const kept = detected.filter((m) => !module.group || m.group !== module.group);
  const withModule = canonical([...kept, module]);
  const agentsOf = (modules: Module[]) =>
    compose(modules, ctx).files.find((f) => f.path === "AGENTS.md")?.content ?? "";
  const previous = extractBlock(agentsOf(canonical(detected))) ?? "";
  const nextFull = agentsOf(withModule);
  const agents = mergeAgents(
    read(root, "AGENTS.md"),
    previous,
    extractBlock(nextFull) ?? "",
    nextFull,
    force,
  );
  const conflicts = [...pkg.conflicts, ...agents.conflicts];
  if (conflicts.length > 0) {
    return fail(
      "EDITED_FILES",
      `Nothing was written. ${conflicts.join(". ")}.`,
      "Resolve these by hand, or rerun the same command with --force to replace them.",
    );
  }

  const merged: FileSpec[] = [
    { path: "package.json", content: pkg.content },
    { path: ".env", content: envText(".env") },
    { path: ".env.example", content: envText(".env.example") },
    { path: "AGENTS.md", content: agents.content },
  ].filter((f) => f.content !== "");
  const files = [...parts.files.filter((f) => !GENERATED.has(f.path)), ...merged];
  const plan = await planWrites(root, files, {
    force,
    merged: new Set(merged.map((f) => f.path)),
  });
  const written = await applyPlan(root, plan, { dryRun: options.dryRun });
  if (!written.ok) {
    return {
      ok: false,
      files: written.actions,
      next: [],
      error: written.error && { ...written.error, code: "EDITED_FILES" },
    };
  }

  for (const command of parts.commands) {
    const result = await runner.run({ ...command, cwd: root });
    if (!result.ok) return { ok: false, files: written.actions, next: [], error: result.error };
  }
  // Install only when dependencies changed; new scripts alone need no install.
  const deps = (text: string) => {
    const p = JSON.parse(text) as { dependencies?: object; devDependencies?: object };
    return JSON.stringify([p.dependencies ?? {}, p.devDependencies ?? {}]);
  };
  if (deps(pkgText) !== deps(pkg.content)) {
    const install = await runner.run({
      command: pm,
      args: ["install"],
      cwd: root,
      fix: `Run \`${installCommand(pm)}\` to finish.`,
    });
    if (!install.ok) {
      return {
        ok: false,
        files: written.actions,
        next: [installCommand(pm)],
        error: install.error,
      };
    }
  }

  const next = [
    ...(options.target === "local" ? [runCommand(pm, "network:start")] : []),
    ...parts.next.map((s) => runCommand(pm, s)),
  ];
  return { ok: true, files: written.actions, next };
}

function fail(code: AddError["code"], message: string, fix: string): AddResult {
  return { ok: false, files: [], next: [], error: { code, message, fix } };
}
