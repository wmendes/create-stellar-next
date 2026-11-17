import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import { create, projectNameError } from "./commands/create.ts";
import {
  detectPackageManager,
  PACKAGE_MANAGERS,
  type PackageManager,
} from "./lib/package-manager.ts";
import { TOOL_NAME } from "./name.ts";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CliEnv {
  cwd?: string;
  /** npm_config_user_agent, used to detect the package manager. */
  userAgent?: string;
}

/** Exit codes fixed by SPEC §5.2. */
export const ExitCode = {
  Success: 0,
  Failure: 1,
  InvalidArguments: 2,
  MissingPrerequisite: 3,
} as const;

const USAGE = `Usage: ${TOOL_NAME} <dir> [options]

Create a Next.js app with a Stellar contract workflow in <dir>.

Options:
  --contracts <value>        hello-world | none | <contract id>  (default: hello-world)
  --wallet <value>           none | wallets-kit | extension | passkeys  (default: none)
  --network <value>          testnet | mainnet  (default: testnet)
  --local                    Add a local network (Docker)
  --registry                 Add Stellar registry scripts
  --envs                     Add declarative environments (stellar.envs.toml)
  --style <value>            tailwind | none  (default: tailwind)
  --package-manager <value>  npm | pnpm | yarn | bun  (default: detected)
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

const ok = (stdout: string): CliResult => ({ exitCode: ExitCode.Success, stdout, stderr: "" });

function invalid(message: string): CliResult {
  return {
    exitCode: ExitCode.InvalidArguments,
    stdout: "",
    stderr: `${message}\nRun \`${TOOL_NAME} --help\` to see the accepted arguments.\n`,
  };
}

function failure(message: string, fix: string): CliResult {
  return { exitCode: ExitCode.Failure, stdout: "", stderr: `${message}\n${fix}\n` };
}

export async function main(argv: readonly string[], env: CliEnv = {}): Promise<CliResult> {
  const cwd = env.cwd ?? process.cwd();
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : String(error));
  }
  const { values, positionals } = parsed;

  if (values.help) return ok(USAGE);
  if (values.version) return ok(`${packageVersion()}\n`);

  if (positionals.length === 0)
    return invalid("Missing <dir>: the directory to create the app in.");
  if (positionals.length > 1) {
    return invalid(`Expected one directory, got ${positionals.length}: ${positionals.join(" ")}.`);
  }
  const dir = positionals[0] as string;

  for (const [flag, allowed] of Object.entries(CHOICES)) {
    const value = values[flag as keyof typeof CHOICES];
    if (value !== undefined && !(allowed as readonly string[]).includes(value)) {
      return invalid(`--${flag} must be one of: ${allowed.join(", ")}. Got "${value}".`);
    }
  }

  const name = basename(resolve(cwd, dir));
  const nameError = projectNameError(name);
  if (nameError) {
    return invalid(
      `The project name "${name}", taken from <dir>, ${nameError}. Choose another <dir>.`,
    );
  }

  // Options from later milestones fail plainly instead of half-working.
  const contracts = values.contracts ?? "hello-world";
  if (contracts !== "none") {
    return failure(
      `--contracts ${contracts} is not built yet.`,
      "Use --contracts none for now; contract support arrives in milestone M2.",
    );
  }
  if ((values.wallet ?? "none") !== "none") {
    return failure(`--wallet ${values.wallet} is not built yet.`, "Use --wallet none for now.");
  }
  for (const flag of ["local", "registry", "envs"] as const) {
    if (values[flag]) return failure(`--${flag} is not built yet.`, `Run again without --${flag}.`);
  }

  const packageManager =
    (values["package-manager"] as PackageManager | undefined) ??
    detectPackageManager(env.userAgent);
  const result = await create({
    dir,
    cwd,
    network: (values.network ?? "testnet") as "testnet" | "mainnet",
    style: (values.style ?? "tailwind") as "tailwind" | "none",
    packageManager,
    force: values.force ?? false,
    dryRun: false,
  });
  if (!result.ok) {
    return failure(result.error?.message ?? "Create failed.", result.error?.fix ?? "");
  }
  const written = result.files.filter((f) => f.action !== "unchanged").length;
  return ok(
    `Created ${name} in ${result.root} (${written} files written).\n\nNext:\n${result.next
      .map((c) => `  ${c}`)
      .join("\n")}\n`,
  );
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
      force: { type: "boolean" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });
}
