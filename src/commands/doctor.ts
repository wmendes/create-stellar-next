import type { DoctorCheck } from "../lib/compose.ts";
import { type ProjectInfo, readProject } from "../lib/project.ts";
import type { Runner } from "../lib/runner.ts";
import { detectModules } from "../lib/detect.ts";

export interface CheckResult {
  id: string;
  description: string;
  status: "ok" | "failed" | "skipped";
  detail: string;
  fix?: string;
}

const resolve = <T>(value: T | ((p: ProjectInfo) => T), p: ProjectInfo): T =>
  typeof value === "function" ? (value as (p: ProjectInfo) => T)(p) : value;

export async function doctor(
  root: string,
  runner: Runner,
  environment?: Record<string, string | undefined>,
): Promise<CheckResult[]> {
  const project = readProject(root, environment);
  const checks: DoctorCheck[] = [];
  for (const m of detectModules(project)) {
    for (const c of m.doctor ?? []) if (!checks.some((x) => x.id === c.id)) checks.push(c);
  }

  const results: CheckResult[] = [];
  for (const check of checks) {
    if (check.when && !check.when(project)) continue;
    const fix = resolve(check.fix, project);
    const prior = check.after && results.find((r) => r.id === check.after);
    if (prior && prior.status !== "ok") {
      results.push({
        id: check.id,
        description: check.description,
        status: "skipped",
        detail: `skipped because "${check.after}" did not pass`,
      });
      continue;
    }
    const run = await runner.run({
      command: check.command,
      args: resolve(check.args, project),
      cwd: root,
    });
    const problem = run.ok
      ? check.verify?.(run.stdout)
      : (run.error?.message.split("\n")[0] ?? "the check could not run");
    results.push(
      problem === undefined
        ? {
            id: check.id,
            description: check.description,
            status: "ok",
            detail: check.summary?.(run.stdout) ?? run.stdout.trim().split("\n")[0] ?? "",
          }
        : { id: check.id, description: check.description, status: "failed", detail: problem, fix },
    );
  }
  return results;
}
