import type { RunnerOptions, RunResult, RunSpec, Runner } from "../../src/lib/runner.ts";

export interface FakeRunner {
  factory: (options: RunnerOptions) => Runner;
  calls: RunSpec[];
  dryRuns: boolean[];
}

/** A runner that records commands instead of running them. */
export function fakeRunner(
  options: { missing?: string[]; fail?: (spec: RunSpec) => boolean } = {},
): FakeRunner {
  const calls: RunSpec[] = [];
  const dryRuns: boolean[] = [];
  const factory = (runnerOptions: RunnerOptions): Runner => {
    dryRuns.push(runnerOptions.dryRun);
    return {
      available: (command) => !(options.missing ?? []).includes(command),
      async run(spec): Promise<RunResult> {
        calls.push(spec);
        if (runnerOptions.dryRun)
          return { ok: true, skipped: true, exitCode: null, stdout: "", stderr: "" };
        if (options.fail?.(spec)) {
          return {
            ok: false,
            exitCode: 1,
            stdout: "",
            stderr: "",
            error: {
              code: "COMMAND_FAILED",
              message: `\`${spec.command} ${spec.args.join(" ")}\` exited with code 1.`,
              fix: spec.fix ?? "Run the command above yourself.",
            },
          };
        }
        return { ok: true, exitCode: 0, stdout: "", stderr: "" };
      },
    };
  };
  return { factory, calls, dryRuns };
}
