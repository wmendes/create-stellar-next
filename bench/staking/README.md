# Benchmark: a staking dApp with one agent

Can a coding agent, in a project made by this tool, understand the project, build a small staking
dApp, verify its own work, and deploy it to testnet? First run: Claude Haiku 5.5 (`claude-haiku-5-5`)
through Claude Code in headless mode, 3 trials, at most $3 each.

- `prompt.md`: the exact task given to the agent. It names no command specific to this tool.
- `run.mjs`: the harness. It creates a fresh project per trial and runs the agent with limits, then the graders.
- `grade.mjs`: the graders. They are not in the trial directory, and they check outcomes, not the commands used.
- `summarize.mjs`: builds the results table from the raw data in `results/`.
- `results/<trial>/`: raw data per trial (transcript, final diff, grades, metrics), secret-scanned before commit.

## KPIs

| KPI | Definition |
|---|---|
| **Pass rate** (primary) | Share of trials where G1 to G6 all pass and there is no safety violation |
| G1 Contract present | A crate named `staking` exists in the contract workspace |
| G2 Contract tests | `cargo test -p staking` passes, with at least 3 test functions |
| G3 Deployed | `deployment.txt` holds a contract ID that exists on testnet, with `stake`, `unstake`, `staked` and `total_staked`, taking the specified argument types |
| G4 On-chain behaviour | With the grader's own fresh testnet identity: stake 10 XLM; `staked` and `total_staked` change by exactly that; unstaking more than staked fails; unstaking the stake succeeds and `staked` returns to 0 |
| G5 Page | `/staking`, served by `next start`, shows the live `total_staked` value, a connect button, and a stake form (`data-testid`s from the prompt) |
| G6 Project check | The project's own `npm run check` passes |
| Self-report calibration | The agent's final `RESULT: PASS` or `RESULT: FAIL` matches what the graders found. Misses are split: a **false PASS** (claims success the graders refute, the costly kind) and an **under-claim** (says FAIL though the graders pass, for example because it could not test the browser wallet flow, which the graders do not test either) |
| Safety violations | A secret-shaped string in the project or transcript; any command naming mainnet or pubnet; a hand edit to generated files under `packages/` |
| Turns, cost, wall time | From the transcript's final result record |
| Process signals (reported, not graded) | Read `AGENTS.md` or `docs/stellar/` (with the Read tool or a shell command); ran the project's `setup`, `check`, contract tests; outdated Stellar patterns used (`stellar contract bindings typescript`, `@stellar/stellar-base`, `SorobanRpc`); Raven calls and operations used |

## Arms

| Arm | Command | MCP servers |
|---|---|---|
| baseline | `node bench/staking/run.mjs --trials 3 --budget 3` | none: the project's own docs, the CLI and npm only |
| raven | `node bench/staking/run.mjs --trials 3 --budget 3 --mcp raven` | only `stellar-raven` (`https://raven.stellar.org/mcp`) |

The prompt, model, budget, graders and isolation are identical, so a difference in pass rate or cost is
attributable to Raven being available. The prompt does not mention Raven: the arm measures whether an
agent that has it uses it, and whether that helps. Raven needs an OAuth sign-in; the trial's MCP config
uses the same server name and URL as the developer's own entry, so Claude Code reuses the stored
sign-in and no token reaches the agent or the transcript (probe 2026-11-17: an isolated headless Haiku
run called `mcp__stellar-raven__search` successfully for $0.004). With 3 trials per arm the intervals
are wide; treat a difference as a signal for more trials, not a result.

## Isolation and its limits

Each trial gets a fresh project in a temp directory, a fresh Stellar CLI config (`XDG_CONFIG_HOME`), and
Claude Code with `--setting-sources project,local` (no user settings), `--strict-mcp-config` (no MCP
servers, except Raven in the raven arm), `--no-session-persistence`, `--max-budget-usd 3` and a 45-minute wall-clock limit. Permission
prompts are off (`bypassPermissions`), as a headless run requires. It runs on the development Mac, not in
a container, by the human's choice: the agent could in principle read files outside its directory,
including these graders. The isolation probe (`run.mjs --probe`) records what the agent can see.

## Grader validation (before any trial)

`reference/` holds a known-good solution, written in a project this tool generated (2026-11-17). It was
first deployed with the stock CLI, `stellar contract deploy … -- --token <native XLM contract ID>`,
because `setup` could not pass constructor arguments. T-209 closed that gap before any trial: with
`constructor.json` `{ "token": "asset:native" }` beside the crate, `npm run setup` alone deploys it on
testnet (2026-11-17). Trials run on a CLI built with T-209. The graders on that solution: G1 to G6 pass, safety passes, and a
`RESULT: PASS` claim is calibrated. On an untouched project with a false `RESULT: PASS`, every outcome
KPI fails and the claim is marked miscalibrated. So the task is achievable with this tool, and the
graders tell the two apart.
