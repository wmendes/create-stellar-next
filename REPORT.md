# create-stellar-next: report

2026-11-17. Sections follow the order the plan sets (SPEC §9.4). Task, decision (DEC) and question (Q)
numbers refer to `docs/SPEC.md`.

## 1. Result

No benchmark ran, so none of the four proposed thresholds was met or missed: each is **not measured**.
The human skipped the benchmark milestone (M6) for now, with no agents, access or budget yet (Q-11), and
waived its gate for release preparation (DEC-032).

| Proposed threshold (Q-12: not yet confirmed) | Result |
|---|---|
| Arm A overall pass rate of at least 85% | Not measured |
| Arm A pass rate not lower than Arm B on the same agents | Not measured |
| Zero safety violations in Arm A | Not measured |
| Arm A time to first contract call under 10 minutes, excluding toolchain install | Not measured |

The tool itself is built through milestone M5, and its release checks pass on macOS: the packed tarball
passes the contract-loop end-to-end test (T-702). CI runs on Linux and Windows since the repository got
its remote; macOS was taken out of CI for now and is checked locally (DEC-036).

## 2. Part A: starter metrics for arms A, B and C

Not run. No measurements exist for time to first contract call, prerequisites, commands, install size,
generated surface or Docker independence. One input for a later run is recorded: Scaffold Stellar 0.0.34
(Arm B) generates a Vite and React project that pins Rust 1.93.0, and its configuration is `scaffold.yml`
v2 (`docs/scaffold-mapping.md`).

## 3. Part B: pass rates by arm and agent, then by task

Not run. No agent was named and no trial ran.

## 4. Ablation: A against A1 and A2

Not run.

## 5. Top failure categories per arm

Not run. There are no benchmark failures to categorise. The failures found while building the tool,
each caught by a real run and now covered by a test, are listed in section 7.

## 6. Safety violations

None to list: no agent trial ran. In the tool's own test runs the secret scan found no secret-shaped
string in the repository or in any generated project, and no command targeted mainnet. Mainnet deploys
need `--confirm-mainnet` in `setup`, `contracts:deploy` and `envs:apply`, and the contract watcher never
deploys there; tests cover each.

## 7. Deviations, open decisions and next steps

### What exists and how it was checked

| Area | Evidence |
|---|---|
| CLI: `create`, `add` (contract, local, wallet, envs), `doctor` | 254 unit tests; real runs against testnet and a local network |
| Generated project: `setup`, `dev` with contract watcher, `check`, contract scripts | Stub-driven script tests; real runs on testnet and a local network; a second `setup` leaves `git status` empty |
| Contract loop in a browser | `npm run test:e2e:contracts`: passed on a local network and on testnet (Playwright reads "Hello Stellar") |
| `add` in a project the tool did not create | Real `create-next-app` 16.4.6 project + `add contract` + `add wallet`, then `setup` and `check` passed |
| Wallets | Stellar Wallets Kit picker opens and Varial reports a missing extension, in a real browser |
| Agent layer | `AGENTS.md` under 80 lines; docs test: every named script exists, and 16 named CLI commands answer `--help` |
| Release | `npm pack` tarball installed and run through the contract loop (T-702); nothing published |
| Platforms | macOS arm64, locally. CI on Linux and Windows: the gates passed on both after two fixes (ignored fixtures, Windows watcher crash); the end-to-end jobs are still to run |

### Deviations from the plan

| Plan said | What happened | Record |
|---|---|---|
| `PROGRESS.md` and `docs/verified-facts.md` | Replaced by the spec's task board, decision log and `docs/SOURCES.md`, as `CLAUDE.md` requires | DEC-001, Q-02, Q-03 |
| Benchmark tasks T1–T10 | Renamed BT1–BT10, to avoid clashing with task numbers | DEC-002 |
| CI green at every gate | G0 to G5 were approved by the human with CI never run (no remote) | DEC-008, Q-05 |
| Stellar Wallets Kit "on JSR, not npm" | It is on both. JSR breaks `next build` (an undeclared npm-name import in a MetaMask dependency); the human chose npm | DEC-023, Q-19 |
| Extension wallet: Freighter or `@stellar/varial-sdk` | Same wallet: Varial is the renamed Freighter, so `@stellar/varial-sdk` | V-09, Q-08 |
| Wallet options include passkeys | Dropped by the human: they need a third-party relayer key and a server route, and do not fit the wallet interface | DEC-025, Q-22 |
| `--registry` module | Dropped by the human | DEC-025 |
| Accept Scaffold Stellar's `environments.toml` if it maps | Scaffold now uses `scaffold.yml` v2, which does not map cleanly; no reader; mapping documented | DEC-027 |
| Docs in `node_modules/create-stellar-next/docs/` (v0 documentation) | Copied into each project as `docs/stellar/`, since projects never depend on the tool | DEC-028, Q-21 |
| AGENTS.md rule 4 always names `contracts:bindings` | Per-module wording, because projects without contracts lack that script | DEC-028 |
| `--json` schema frozen at G1 | Version 2 added `COMMAND_FAILED`, approved by the human | DEC-013 |
| Contract IDs "are Stellar CLI aliases" | Still true, but aliases are global, so they are named `<project>-<contract>`, and IDs are copied into `packages/contract-ids.json` for the app | DEC-016, Q-20 |
| Benchmark (M6) before release preparation (M7) | M6 skipped for now; M7 done first | DEC-032 |
| Node 22 or newer | Node 22.12.0 or newer, the SDK's own floor | V-08 |

Problems found by real runs and fixed, each now covered by a test: Turbopack cannot import the generated
client's TypeScript source, so clients are compiled first (DEC-017); `setup` skipped recording IDs when
it skipped a deploy (DEC-017); `dev` and `check` failed outside `npm run` (DEC-018); the `AGENTS.md` block
depended on the order modules were added (DEC-022); `doctor` ignored environment overrides (DEC-022).

### Still open (SPEC §11)

| Question | Current default |
|---|---|
| Q-05: GitHub remote and CI | None yet; CI tasks T-006, T-105, T-207 stay blocked |
| Q-10: BT10's fake secret key in a committed prompt | Generate an unfunded key per trial; the committed prompt holds a placeholder |
| Q-11: benchmark agents, access, budget | Skipped for now |
| Q-12: the four thresholds | Reported as proposed |
| Q-14: platform coverage | macOS for development; benchmark containers would be Linux |
| Q-15: interface freeze schedule | As in SPEC §5.8 |
| Q-16: final name and owning organisation | `create-stellar-next`, held in one constant |
| Q-17: styling default | Tailwind, `--style none` to omit |
| Q-18: placement on the Stellar docs Tools page | Out of scope for this build |

### Recommended next steps

1. Create the GitHub remote and run CI, to cover Linux and Windows. That unblocks T-006, T-105 and T-207.
2. Decide the benchmark (Q-11, Q-12, Q-10): name the agents, supply access and a budget. Then build the
   harness and graders, review them, and run Part A before any paid trial.
3. Consider constructor arguments for deploys: their absence is the main gap against Scaffold Stellar's
   `scaffold.yml` (DEC-027).
4. Choose the final name (Q-16) before any publication.
