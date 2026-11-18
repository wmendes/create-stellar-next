import { spawn } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import type { ToolError } from "./errors.ts";

/**
 * The one way this tool runs external commands (B-1): stellar, cargo, docker, npx and package
 * managers. It logs each command exactly, honours --dry-run, and turns failures into errors that
 * name the cause and the fix (INV-12, INV-14).
 */

export interface RunSpec {
  command: string;
  args: string[];
  cwd: string;
  /** Extra environment variables, merged over process.env. */
  env?: Record<string, string | undefined>;
  /** What to tell the user if the command fails. */
  fix?: string;
}

export interface RunError extends ToolError {
  code: "COMMAND_FAILED" | "MISSING_PREREQUISITE";
}

export interface RunResult {
  ok: boolean;
  /** True when --dry-run prevented the command from running. */
  skipped?: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: RunError;
}

export interface RunnerOptions {
  dryRun: boolean;
  /** Receives one line per command, before it runs. */
  log?: (line: string) => void;
  /** Receives the command's output as it arrives, with secret-shaped strings redacted. */
  echo?: (chunk: string) => void;
  platform?: NodeJS.Platform;
}

export interface Runner {
  run(spec: RunSpec): Promise<RunResult>;
  /** True when the command is on PATH. Lets a command check prerequisites before writing anything. */
  available(command: string): boolean;
}

/** Where to get a prerequisite. Keys are binary names. */
export const INSTALL_HINTS: Record<string, string> = {
  stellar: "Install the Stellar CLI: https://developers.stellar.org/docs/tools/cli/install-cli",
  cargo: "Install Rust with rustup: https://rustup.rs",
  rustup: "Install Rust with rustup: https://rustup.rs",
  docker: "Install Docker and start it: https://docs.docker.com/get-started/get-docker/",
  node: "Install Node.js 22.12.0 or newer: https://nodejs.org",
  npm: "npm comes with Node.js: https://nodejs.org",
  npx: "npx comes with Node.js: https://nodejs.org",
  pnpm: "Install pnpm: https://pnpm.io/installation, or choose another --package-manager",
  yarn: "Install Yarn: https://yarnpkg.com/getting-started/install, or choose another --package-manager",
  bun: "Install Bun: https://bun.sh, or choose another --package-manager",
};

// A Stellar secret key is S followed by 55 base32 characters.
const SECRET_KEY = /\bS[A-Z2-7]{55}\b/g;

export function redact(text: string): string {
  return text.replace(SECRET_KEY, "S…[redacted]");
}

export function formatCommand(command: string, args: readonly string[]): string {
  const quote = (arg: string) => {
    if (arg !== "" && !/[\s"'$`\\]/.test(arg)) return arg;
    return arg.includes('"') ? `'${arg.replace(/'/g, `'\\''`)}'` : `"${arg}"`;
  };
  return redact([command, ...args].map(quote).join(" "));
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isExecutable(path: string, platform: NodeJS.Platform): boolean {
  if (!isFile(path)) return false;
  if (platform === "win32") return true;
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a command on PATH the way the shell would, including PATHEXT on Windows. */
export function findExecutable(
  name: string,
  env: Record<string, string | undefined>,
  platform: NodeJS.Platform,
): string | undefined {
  // Windows runs a file from PATH only by appending a PATHEXT extension, unless the name already
  // has one. Node ships an extensionless `npm` shell script beside `npm.cmd`; it must not match.
  const pathext = (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").map((e) => e.toLowerCase());
  const hasExtension = pathext.some((e) => e !== "" && name.toLowerCase().endsWith(e));
  const extensions = platform === "win32" ? (hasExtension ? [""] : pathext) : [""];
  const candidates = (base: string) => extensions.map((ext) => base + ext);
  if (isAbsolute(name) || name.includes("/") || name.includes("\\")) {
    return candidates(name).find((c) => isExecutable(c, platform));
  }
  const path = env.PATH ?? env.Path ?? "";
  for (const dir of path.split(platform === "win32" ? ";" : delimiter)) {
    if (dir === "") continue;
    const found = candidates(join(dir, name)).find((c) => isExecutable(c, platform));
    if (found) return found;
  }
  return undefined;
}

function quoteForCmd(arg: string): string {
  return /[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg;
}

function tail(text: string, lines = 20): string {
  return text.trimEnd().split("\n").slice(-lines).join("\n");
}

function missing(command: string): RunResult {
  return {
    ok: false,
    exitCode: null,
    stdout: "",
    stderr: "",
    error: {
      code: "MISSING_PREREQUISITE",
      message: `\`${command}\` was not found on PATH.`,
      fix: INSTALL_HINTS[command] ?? `Install \`${command}\` and make sure it is on PATH.`,
    },
  };
}

export function createRunner(options: RunnerOptions): Runner {
  const platform = options.platform ?? process.platform;
  return {
    available(command) {
      return findExecutable(command, process.env, platform) !== undefined;
    },
    async run(spec) {
      const env = { ...process.env, ...spec.env };
      const shown = formatCommand(spec.command, spec.args);
      const resolved = findExecutable(spec.command, env, platform);
      if (resolved === undefined) return missing(spec.command);
      if (options.dryRun) {
        options.log?.(`(dry run) $ ${shown}`);
        return { ok: true, skipped: true, exitCode: null, stdout: "", stderr: "" };
      }
      options.log?.(`$ ${shown}`);

      // Node refuses to spawn .cmd and .bat files without a shell (CVE-2024-27980).
      const viaShell = platform === "win32" && /\.(cmd|bat)$/i.test(resolved);
      const child = viaShell
        ? spawn(`"${resolved}"`, spec.args.map(quoteForCmd), {
            cwd: spec.cwd,
            env,
            shell: true,
            windowsHide: true,
          })
        : spawn(resolved, spec.args, { cwd: spec.cwd, env, windowsHide: true });

      let stdout = "";
      let stderr = "";
      child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
        stdout += chunk;
        options.echo?.(redact(chunk));
      });
      child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
        stderr += chunk;
        options.echo?.(redact(chunk));
      });

      const exitCode = await new Promise<number | null>((resolveExit, reject) => {
        child.on("error", reject);
        child.on("close", (code) => resolveExit(code));
      }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return "missing" as const;
        throw error;
      });
      if (exitCode === "missing") return missing(spec.command);
      if (exitCode === 0) return { ok: true, exitCode, stdout, stderr };

      const detail = redact(tail(stderr || stdout));
      return {
        ok: false,
        exitCode,
        stdout,
        stderr,
        error: {
          code: "COMMAND_FAILED",
          message: `\`${shown}\` exited with code ${exitCode}.${detail ? `\n${detail}` : ""}`,
          fix:
            spec.fix ??
            "Run the command above yourself to see the full output, then fix the cause.",
        },
      };
    },
  };
}
