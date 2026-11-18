# Staking benchmark results

Trials: 6. Built by `summarize.mjs` from `results/*/grades.json`.

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
| Self-report calibrated | 3/3 |
| False PASS (claimed PASS, graders failed) | 0/3 |
| Under-claim (claimed FAIL or nothing, graders passed) | 0/3 |

| Trial | Pass | Claimed | Turns | Cost (USD) | Wall time (min) | Read AGENTS.md | Read docs/stellar | Ran check | Raven calls | Outdated patterns |
|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5-baseline-v2-2026-11-17T22-53-02-t1 | yes | PASS | 19 | 0.03 | 4.1 | yes | yes | yes | 0 | none |
| claude-haiku-5-5-baseline-v2-2026-11-17T22-53-02-t2 | yes | PASS | 17 | 0.03 | 3.6 | yes | yes | yes | 0 | none |
| claude-haiku-5-5-baseline-v2-2026-11-17T22-53-02-t3 | yes | PASS | 26 | 0.04 | 3.8 | yes | yes | yes | 0 | none |

Medians: 19 turns, $0.03, 3.8 min.

### Failures, per trial

#### claude-haiku-5-5-baseline-v2-2026-11-17T22-53-02-t1

- none

#### claude-haiku-5-5-baseline-v2-2026-11-17T22-53-02-t2

- none

#### claude-haiku-5-5-baseline-v2-2026-11-17T22-53-02-t3

- none

## Arm: raven, raven-when

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
| Self-report calibrated | 3/3 |
| False PASS (claimed PASS, graders failed) | 0/3 |
| Under-claim (claimed FAIL or nothing, graders passed) | 0/3 |

| Trial | Pass | Claimed | Turns | Cost (USD) | Wall time (min) | Read AGENTS.md | Read docs/stellar | Ran check | Raven calls | Outdated patterns |
|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5-raven-v2-raven-when-2026-11-18T00-12-46-t1 | yes | PASS | 20 | 0.04 | 4.6 | yes | yes | yes | 3 | none |
| claude-haiku-5-5-raven-v2-raven-when-2026-11-18T00-12-46-t2 | yes | PASS | 26 | 0.04 | 6.6 | yes | yes | yes | 1 | none |
| claude-haiku-5-5-raven-v2-raven-when-2026-11-18T00-12-46-t3 | yes | PASS | 24 | 0.04 | 4.1 | yes | yes | yes | 2 | none |

Medians: 24 turns, $0.04, 4.6 min.

### Failures, per trial

#### claude-haiku-5-5-raven-v2-raven-when-2026-11-18T00-12-46-t1

- none

#### claude-haiku-5-5-raven-v2-raven-when-2026-11-18T00-12-46-t2

- none

#### claude-haiku-5-5-raven-v2-raven-when-2026-11-18T00-12-46-t3

- none

