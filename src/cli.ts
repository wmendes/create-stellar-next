import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { add, lockfileManager } from "./commands/add.ts";
import { create, projectNameError } from "./commands/create.ts";
import type { ToolError } from "./lib/errors.ts";
import {
  detectPackageManager,
  PACKAGE_MANAGERS,
  type PackageManager,
} from "./lib/package-manager.ts";
import { createRunner, type Runner, type RunnerOptions } from "./lib/runner.ts";
import type { WriteAction } from "./lib/writer.ts";
import { core } from "./modules/core.ts";
import { CONTRACT_ID } from "./modules/index.ts";
import { doctor } from "./commands/doctor.ts";
import { MIN_NODE, olderThan } from "./lib/versions.ts";
import { TOOL_NAME } from "./name.ts";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface PromptQuestion {
  message: string;
  placeholder?: string;
  validate?: (value: string | undefined) => string | undefined;
}

/** Resolves to the answer, or undefined when the user cancels. */
export type PromptFn = (question: PromptQuestion) => Promise<string | undefined>;

export interface CliEnv {
  cwd?: string;
  /** npm_config_user_agent, used to detect the package manager. */
  userAgent?: string;
  /** True only when both stdin and stdout are terminals. Without a TTY the CLI acts as if --yes was passed. */
  isTTY?: boolean;
  prompt?: PromptFn;
  /** The running Node version, without the leading "v". */
  nodeVersion?: string;
  /** Builds the command runner. Tests pass a fake; the default runs real commands. */
  createRunner?: (options: RunnerOptions) => Runner;
  /** Environment variables; defaults to process.env. */
  environment?: Record<string, string | undefined>;
  /** Live progress for humans: each command line and its output. Never used with --json. */
  echo?: (text: string) => void;
}

/** Version of schemas/output.schema.json that --json output follows. */
export const OUTPUT_SCHEMA_VERSION = 2;

/** Exit codes fixed by SPEC §5.2. */
export const ExitCode = {
  Success: 0,
  Failure: 1,
  InvalidArguments: 2,
  MissingPrerequisite: 3,
} as const;

/** The error codes in schemas/output.schema.json. */
type ErrorCode =
  | "COMMAND_FAILED"
  | "INVALID_ARGUMENT"
  | "NOT_BUILT"
  | "EDITED_FILES"
  | "MISSING_PREREQUISITE"
  | "CANCELLED"
  | "INTERNAL";

interface CliError extends ToolError {
  code: ErrorCode;
}

/** What a command did. Rendered as text, or as the one JSON object of SPEC §5.3. */
interface Outcome {
  exitCode: number;
  files: { path: string; action: WriteAction }[];
  next: string[];
  errors: CliError[];
  /** Human summary printed above the next steps on success. */
  summary?: string;
  dryRun?: boolean;
}

const HELP = `Run \`${TOOL_NAME} --help\` to see the accepted arguments.`;

const USAGE = `Usage: ${TOOL_NAME} <dir> [options]
       ${TOOL_NAME} doctor [--json]

Create a Next.js app with a Stellar contract workflow in <dir>, or check this machine and
the project in the current directory with doctor (exit 3 when a check fails).

Options:
  --contracts <value>        hello-world | none | <contract id>  (default: hello-world)
  --wallet <value>           none | wallets-kit | extension | passkeys  (default: none)
  --network <value>          testnet | mainnet  (default: testnet)
  --local                    Add a local network (Docker)
  --registry                 Add Stellar registry scripts
  --envs                     Add declarative environments (stellar.envs.toml)
  --style <value>            tailwind | none  (default: tailwind)
  --package-manager <value>  npm | pnpm | yarn | bun  (default: detected)
  --yes                      Accept defaults and never prompt (implied without a TTY)
  --json                     Print one JSON object: files, next, errors (implies --yes)
  --dry-run                  Print the plan and write nothing
  --force                    Overwrite files you edited
  -v, --version              Print the version
  -h, --help                 Print this help
`;

const CHOICES = {
  wallet: ["none", "wallets-kit", "extension", "passkeys"],
  network: ["testnet", "mainnet"],
  style: ["tailwind", "none"],
  "package-manager": PACKAGE_MANAGERS,
} as const;

function packageVersion(): string {
  // src/cli.ts and dist/cli.js both sit one level below package.json.
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  return pkg.version;
}

function fail(exitCode: number, code: ErrorCode, message: string, fix: string): Outcome {
  return { exitCode, files: [], next: [], errors: [{ code, message, fix }] };
}

const invalid = (message: string) =>
  fail(ExitCode.InvalidArguments, "INVALID_ARGUMENT", message, HELP);

function render(outcome: Outcome, json: boolean): CliResult {
  if (json) {
    const { files, next, errors } = outcome;
    return {
      exitCode: outcome.exitCode,
      stdout: `${JSON.stringify({ schemaVersion: OUTPUT_SCHEMA_VERSION, files, next, errors })}\n`,
      stderr: "",
    };
  }
  if (outcome.errors.length > 0) {
    const stderr = outcome.errors.map((e) => `${e.message}\n${e.fix}\n`).join("");
    const plan = outcome.dryRun ? planText(outcome) : "";
    return { exitCode: outcome.exitCode, stdout: plan, stderr };
  }
  const steps = outcome.next.map((c) => `  ${c}`).join("\n");
  const plan = outcome.dryRun ? planText(outcome) : "";
  return {
    exitCode: outcome.exitCode,
    stdout: `${plan}${outcome.summary ?? ""}\n\nNext:\n${steps}\n`,
    stderr: "",
  };
}

function planText(outcome: Outcome): string {
  const lines = outcome.files.map((f) => `  ${f.action} ${f.path}`).join("\n");
  return `Dry run: nothing was written. Planned changes:\n${lines}\n\n`;
}

export async function main(argv: readonly string[], env: CliEnv = {}): Promise<CliResult> {
  // --json is honoured even when the rest of the arguments do not parse.
  const json = argv.includes("--json");
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    return render(invalid(error instanceof Error ? error.message : String(error)), json);
  }
  const { values } = parsed;
  if (values.help) return { exitCode: 0, stdout: USAGE, stderr: "" };
  if (values.version) return { exitCode: 0, stdout: `${packageVersion()}\n`, stderr: "" };
  if (parsed.positionals[0] === "doctor") return runDoctor(parsed, env, json);
  if (parsed.positionals[0] === "add") return render(await runAdd(parsed, env), json);
  return render(await runCreate(parsed, env, json), json);
}

async function runCreate(
  { values, positionals }: ReturnType<typeof parse>,
  env: CliEnv,
  json: boolean,
): Promise<Outcome> {
  const cwd = env.cwd ?? process.cwd();
  const interactive = (env.isTTY ?? false) && !values.yes && !json;

  for (const [flag, allowed] of Object.entries(CHOICES)) {
    const value = values[flag as keyof typeof CHOICES];
    if (value !== undefined && !(allowed as readonly string[]).includes(value)) {
      return invalid(`--${flag} must be one of: ${allowed.join(", ")}. Got "${value}".`);
    }
  }
  if (positionals.length > 1) {
    return invalid(`Expected one directory, got ${positionals.length}: ${positionals.join(" ")}.`);
  }

  const missingDir =
    "Missing <dir>: the directory to create the app in. Pass it as the first argument.";
  const canPrompt = interactive && env.prompt !== undefined;
  if (positionals[0] === undefined && !canPrompt) return invalid(missingDir);

  // Options from later milestones fail plainly instead of half-working.
  const contracts = values.contracts ?? "hello-world";
  if (contracts !== "none" && contracts !== "hello-world" && !CONTRACT_ID.test(contracts)) {
    return invalid(
      `--contracts must be hello-world, none, or a contract ID (C followed by 55 characters). Got "${contracts}".`,
    );
  }
  if (values.wallet === "passkeys") return passkeysNotBuilt();
  for (const flag of ["registry", "envs"] as const) {
    if (values[flag]) {
      return fail(
        ExitCode.Failure,
        "NOT_BUILT",
        `--${flag} is not built yet.`,
        `Run again without --${flag}.`,
      );
    }
  }

  const nodeVersion = env.nodeVersion ?? process.versions.node;
  if (olderThan(nodeVersion, MIN_NODE)) {
    const nodeFix = core.doctor?.find((d) => d.id === "node")?.fix;
    const fix = typeof nodeFix === "string" ? nodeFix : `Install Node.js ${MIN_NODE}+`;
    return fail(
      ExitCode.MissingPrerequisite,
      "MISSING_PREREQUISITE",
      `Node.js ${nodeVersion} is too old: ${MIN_NODE} or newer is required.`,
      fix,
    );
  }

  let dir = positionals[0];
  if (dir === undefined && canPrompt && env.prompt) {
    const answer = await env.prompt({
      message: "Where should the app be created?",
      placeholder: "my-app",
      validate: (value) => {
        if (!value) return "Enter a directory name.";
        const problem = projectNameError(basename(value));
        return problem ? `The project name ${problem}.` : undefined;
      },
    });
    if (answer === undefined) {
      return fail(
        ExitCode.Failure,
        "CANCELLED",
        "Cancelled. Nothing was written.",
        "Run the command again.",
      );
    }
    dir = answer;
  }
  if (dir === undefined) return invalid(missingDir);

  const name = basename(resolve(cwd, dir));
  const nameError = projectNameError(name);
  if (nameError) {
    return invalid(
      `The project name "${name}", taken from <dir>, ${nameError}. Choose another <dir>.`,
    );
  }

  const packageManager =
    (values["package-manager"] as PackageManager | undefined) ??
    detectPackageManager(env.userAgent);
  const dryRun = values["dry-run"] ?? false;
  const echo = json ? undefined : env.echo;
  const runner = (env.createRunner ?? createRunner)({
    dryRun,
    log: echo && ((line) => echo(`${line}\n`)),
    echo,
  });
  const result = await create({
    dir,
    cwd,
    network: (values.network ?? "testnet") as "testnet" | "mainnet",
    style: (values.style ?? "tailwind") as "tailwind" | "none",
    contracts,
    local: values.local ?? false,
    wallet: values.wallet ?? "none",
    packageManager,
    force: values.force ?? false,
    dryRun,
    runner,
  });
  if (!result.ok) {
    const error = result.error ?? { code: "INTERNAL", message: "Create failed.", fix: HELP };
    return {
      exitCode:
        error.code === "MISSING_PREREQUISITE" ? ExitCode.MissingPrerequisite : ExitCode.Failure,
      files: result.files,
      next: result.next,
      errors: [error],
      dryRun,
    };
  }
  const written = result.files.filter((f) => f.action !== "unchanged").length;
  return {
    exitCode: ExitCode.Success,
    files: result.files,
    next: result.next,
    errors: [],
    dryRun,
    summary: dryRun
      ? `Would create ${name} in ${result.root} (${written} files).`
      : `Created ${name} in ${result.root} (${written} files written).`,
  };
}

const ADD_TARGETS = ["contract", "local", "wallet", "registry", "envs"];

async function runAdd(
  { values, positionals }: ReturnType<typeof parse>,
  env: CliEnv,
): Promise<Outcome> {
  const [, target, arg, ...rest] = positionals;
  if (target === undefined || !ADD_TARGETS.includes(target)) {
    return invalid(`add needs one of: ${ADD_TARGETS.join(", ")}. Got "${target ?? ""}".`);
  }
  if (target === "wallet") {
    if (values.wallet === undefined || values.wallet === "none") {
      return invalid("add wallet needs --wallet wallets-kit or --wallet extension.");
    }
    if (values.wallet === "passkeys") return passkeysNotBuilt();
  }
  if (target === "registry" || target === "envs") {
    return fail(
      ExitCode.Failure,
      "NOT_BUILT",
      `add ${target} is not built yet.`,
      "Use add contract or add local for now.",
    );
  }
  if (rest.length > 0 || (target !== "contract" && arg !== undefined)) {
    return invalid(
      `Unexpected arguments after add ${target}: ${[arg, ...rest].filter(Boolean).join(" ")}.`,
    );
  }
  if (target === "contract" && arg !== undefined && !CONTRACT_ID.test(arg)) {
    return invalid(
      `add contract takes nothing, or a contract ID (C followed by 55 characters). Got "${arg}".`,
    );
  }
  const root = env.cwd ?? process.cwd();
  if (!existsSync(join(root, "package.json"))) {
    return invalid(
      `No package.json in ${root}. Run add inside a Next.js project, or create one with \`${TOOL_NAME} <dir>\`.`,
    );
  }
  const dryRun = values["dry-run"] ?? false;
  const echo = env.echo;
  const runner = (env.createRunner ?? createRunner)({
    dryRun,
    log: echo && ((line) => echo(`${line}\n`)),
    echo,
  });
  const packageManager =
    (values["package-manager"] as PackageManager | undefined) ??
    lockfileManager(root) ??
    detectPackageManager(env.userAgent);
  const result = await add({
    root,
    target: target as "contract" | "local" | "wallet",
    wallet: values.wallet,
    contractId: arg,
    packageManager,
    force: values.force ?? false,
    dryRun,
    runner,
  });
  if (!result.ok) {
    const error = result.error ?? { code: "INTERNAL" as const, message: "add failed.", fix: HELP };
    const exitCode =
      error.code === "MISSING_PREREQUISITE"
        ? ExitCode.MissingPrerequisite
        : error.code === "INVALID_ARGUMENT"
          ? ExitCode.InvalidArguments
          : ExitCode.Failure;
    return { exitCode, files: result.files, next: result.next, errors: [error], dryRun };
  }
  const changed = result.files.filter((f) => f.action !== "unchanged").length;
  return {
    exitCode: ExitCode.Success,
    files: result.files,
    next: result.next,
    errors: [],
    dryRun,
    summary: dryRun
      ? `Would add ${target} (${changed} files).`
      : changed === 0
        ? `${target} is already added. Nothing changed.`
        : `Added ${target} (${changed} files changed).`,
  };
}

function passkeysNotBuilt(): Outcome {
  return fail(
    ExitCode.Failure,
    "NOT_BUILT",
    "--wallet passkeys is not built yet: passkey smart wallets need a relayer API key from a third-party service, which is waiting on a decision (SPEC Q-22).",
    "Use --wallet wallets-kit or --wallet extension for now.",
  );
}

/** Version of schemas/doctor.schema.json that `doctor --json` follows. */
export const DOCTOR_SCHEMA_VERSION = 1;

async function runDoctor(
  { positionals }: ReturnType<typeof parse>,
  env: CliEnv,
  json: boolean,
): Promise<CliResult> {
  if (positionals.length > 1) {
    const message = `doctor takes no arguments, got: ${positionals.slice(1).join(" ")}.`;
    const errors = [{ code: "INVALID_ARGUMENT", message, fix: HELP }];
    return json
      ? {
          exitCode: 2,
          stdout: `${JSON.stringify({ schemaVersion: DOCTOR_SCHEMA_VERSION, checks: [], errors })}\n`,
          stderr: "",
        }
      : { exitCode: 2, stdout: "", stderr: `${message}\n${HELP}\n` };
  }
  const runner = (env.createRunner ?? createRunner)({ dryRun: false });
  const checks = await doctor(env.cwd ?? process.cwd(), runner, env.environment);
  const failed = checks.filter((c) => c.status === "failed");
  const exitCode = failed.length > 0 ? ExitCode.MissingPrerequisite : ExitCode.Success;
  if (json) {
    const errors = failed.map((c) => ({
      code: "MISSING_PREREQUISITE",
      message: `${c.description}: ${c.detail}`,
      fix: c.fix ?? HELP,
    }));
    return {
      exitCode,
      stdout: `${JSON.stringify({ schemaVersion: DOCTOR_SCHEMA_VERSION, checks, errors })}\n`,
      stderr: "",
    };
  }
  const lines = checks.map((c) => {
    if (c.status === "ok") return `✓ ${c.description}${c.detail ? ` (${c.detail})` : ""}`;
    if (c.status === "skipped") return `- ${c.description}: ${c.detail}`;
    return `✗ ${c.description}: ${c.detail}\n    Fix: ${c.fix}`;
  });
  const summary =
    failed.length === 0
      ? "All checks passed."
      : `${failed.length} check(s) failed. Fix them, then run doctor again.`;
  return { exitCode, stdout: `${lines.join("\n")}\n\n${summary}\n`, stderr: "" };
}

function parse(argv: readonly string[]) {
  return parseArgs({
    args: [...argv],
    options: {
      contracts: { type: "string" },
      wallet: { type: "string" },
      network: { type: "string" },
      local: { type: "boolean" },
      registry: { type: "boolean" },
      envs: { type: "boolean" },
      style: { type: "string" },
      "package-manager": { type: "string" },
      yes: { type: "boolean", short: "y" },
      json: { type: "boolean" },
      "dry-run": { type: "boolean" },
      force: { type: "boolean" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });
}
