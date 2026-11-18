// Harness for the staking-events benchmark (see README.md).
// Usage:
//   node bench/staking-events/run.mjs --starter ours|scaffold [--trials 1] [--budget 3] [--mcp raven|none]
// Needs: npm run build (the CLI), the Stellar CLI with the Scaffold Stellar plugin, cargo, Claude Code
// logged in, testnet access.
import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  createWriteStream,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("../..", import.meta.url));
const cli = join(repo, "dist/bin.js");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const MODEL = flag("--model", "claude-haiku-5-5");
const BUDGET = flag("--budget", "3");
const TRIALS = Number(flag("--trials", "1"));
// Starter: this tool ("ours") or Scaffold Stellar ("scaffold"), each with its defaults.
const STARTER = flag("--starter", "");
if (!["ours", "scaffold"].includes(STARTER)) throw new Error("--starter must be ours or scaffold");
const WALL_MS = 45 * 60_000;
// Arm: "none" (no MCP servers, the baseline) or "raven" (only the Stellar Raven MCP server).
const MCP = flag("--mcp", "raven");
if (!["none", "raven"].includes(MCP)) throw new Error(`--mcp must be none or raven, not ${MCP}`);
const ARM = MCP === "raven" ? "raven" : "baseline";
// Optional label for a change outside the prompt (for example the generated AGENTS.md wording), so
// the summary does not pool runs made on different CLI builds.
const LABEL = flag("--label", "");
// Same name and URL as the developer's own entry, so Claude Code reuses its stored OAuth sign-in.
const RAVEN_CONFIG = JSON.stringify({
  mcpServers: { "stellar-raven": { type: "http", url: "https://raven.stellar.org/mcp" } },
});

/** Claude Code flags that keep the user's own setup out of the trial. */
function claudeArgs(prompt, budget) {
  return [
    ...(MCP === "raven" ? ["--mcp-config", RAVEN_CONFIG] : []),
    "-p",
    prompt,
    "--model",
    MODEL,
    "--output-format",
    "stream-json",
    "--verbose",
    "--max-budget-usd",
    String(budget),
    "--permission-mode",
    "bypassPermissions",
    "--setting-sources",
    "project,local",
    "--strict-mcp-config",
    "--no-session-persistence",
  ];
}

function runClaude(cwd, env, prompt, budget, transcriptPath) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("claude", claudeArgs(prompt, budget), {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out = createWriteStream(transcriptPath);
    child.stdout.pipe(out);
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    const timer = setTimeout(() => child.kill("SIGTERM"), WALL_MS);
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      out.end(() =>
        resolve({
          code,
          signal,
          wallMs: Date.now() - started,
          timedOut: signal === "SIGTERM",
          stderr,
        }),
      );
    });
  });
}

function sh(command, cmdArgs, cwd, env) {
  const r = spawnSync(command, cmdArgs, { cwd, env, encoding: "utf8", timeout: 900_000 });
  if (r.status !== 0)
    throw new Error(`${command} ${cmdArgs.join(" ")} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
}

const prompt = readFileSync(join(here, "prompt.md"), "utf8");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
for (let n = 1; n <= TRIALS; n++) {
  const id = `${MODEL}-${STARTER}-${ARM}${LABEL ? `-${LABEL}` : ""}-${stamp}-t${n}`;
  const results = join(here, "results", id);
  mkdirSync(results, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "csn-bench-"));
  const project = join(work, "staking-app");
  // The agent's own Stellar CLI config: no access to the developer's identities or aliases.
  const env = { ...process.env, XDG_CONFIG_HOME: join(work, "stellar-config") };
  console.log(`\n=== trial ${n}/${TRIALS}: ${id} (${work})`);

  if (STARTER === "ours") sh(process.execPath, [cli, "staking-app", "--yes"], work, env);
  else sh("stellar", ["scaffold", "init", "staking-app", "--yes", "-p", "npm"], work, env);
  sh("git", ["init", "-q"], project, env);
  sh("git", ["add", "-A"], project, env);
  sh(
    "git",
    [
      "-c",
      "user.name=bench",
      "-c",
      "user.email=bench@example.invalid",
      "commit",
      "-q",
      "--allow-empty", // Scaffold Stellar already commits its template
      "-m",
      "baseline",
    ],
    project,
    env,
  );

  const transcript = join(results, "transcript.jsonl");
  const run = await runClaude(project, env, prompt, BUDGET, transcript);
  console.log(
    `agent finished: exit ${run.code}${run.timedOut ? " (wall-clock limit)" : ""}, ${Math.round(run.wallMs / 1000)} s`,
  );

  spawnSync("git", ["add", "-A"], { cwd: project });
  const diff = spawnSync("git", ["diff", "--cached", "--", ".", ":(exclude)package-lock.json"], {
    cwd: project,
    encoding: "utf8",
    maxBuffer: 50_000_000,
  }).stdout;
  writeFileSync(join(work, "final.diff"), diff);
  cpSync(join(work, "final.diff"), join(results, "final.diff"));

  spawnSync(
    process.execPath,
    [join(here, "grade.mjs"), project, transcript, join(results, "grades.json")],
    { stdio: "inherit" },
  );
  writeFileSync(
    join(results, "run.json"),
    `${JSON.stringify({ id, model: MODEL, starter: STARTER, arm: ARM, label: LABEL || undefined, cliCommit: spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repo, encoding: "utf8" }).stdout.trim(), budgetUsd: Number(BUDGET), wallMs: run.wallMs, exitCode: run.code, timedOut: run.timedOut, workDir: work }, null, 2)}\n`,
  );
}

spawnSync(process.execPath, [join(repo, "test/secret-scan.mjs"), join(here, "results")], {
  stdio: "inherit",
});
spawnSync(process.execPath, [join(here, "summarize.mjs")], { stdio: "inherit" });
