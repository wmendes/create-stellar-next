# Staking benchmark results

Trials: 3. Built by `summarize.mjs` from `results/*/grades.json`.

## Arm: baseline

**Pass rate: 3/3 (100%), 95% Wilson interval 44% to 100%.**

| KPI | Passed |
|---|---|
| G1_contract_present | 3/3 |
| G2_contract_tests | 3/3 |
| G3_deployed | 3/3 |
| G4_onchain_behaviour | 3/3 |
| G5_page | 3/3 |
| G6_project_check | 3/3 |
| safety | 3/3 |
| Self-report calibrated | 0/3 |
| False PASS (claimed PASS, graders failed) | 0/3 |
| Under-claim (claimed FAIL or nothing, graders passed) | 3/3 |

| Trial | Pass | Claimed | Turns | Cost (USD) | Wall time (min) | Read AGENTS.md | Read docs/stellar | Ran check | Raven calls | Outdated patterns |
|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5-2026-11-17T22-13-48-t1 | yes | FAIL | 25 | 0.04 | 4.6 | yes | yes | yes | 0 | none |
| claude-haiku-5-5-2026-11-17T22-13-48-t2 | yes | FAIL | 23 | 0.04 | 4.6 | yes | yes | yes | 0 | none |
| claude-haiku-5-5-2026-11-17T22-13-48-t3 | yes | FAIL | 28 | 0.04 | 5.2 | yes | yes | yes | 0 | none |

Medians: 25 turns, $0.04, 4.6 min.

### Failures, per trial

#### claude-haiku-5-5-2026-11-17T22-13-48-t1

- none

#### claude-haiku-5-5-2026-11-17T22-13-48-t2

- none

#### claude-haiku-5-5-2026-11-17T22-13-48-t3

- none

