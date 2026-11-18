# Staking-events benchmark results

Trials: 2. Built by `summarize.mjs` from `results/*/grades.json`.

## ours, raven

**Pass rate: 1/1 (100%), 95% Wilson interval 21% to 100%.**

| KPI | Passed |
|---|---|
| G1_contract_present | 1/1 |
| G2_contract_tests | 1/1 |
| G3_deployed | 1/1 |
| G4_onchain_behaviour | 1/1 |
| G5_page | 1/1 |
| G6_build | 1/1 |
| safety | 1/1 |
| Self-report calibrated | 1/1 |
| False PASS (claimed PASS, graders failed) | 0/1 |
| Under-claim (claimed FAIL or nothing, graders passed) | 0/1 |

| Trial | Pass | Claimed | Turns | Cost (USD) | Wall time (min) | Read agent docs | Raven calls | Deprecated events API |
|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5-ours-raven-2026-11-18T01-37-51-t1 | yes | PASS | 47 | 0.19 | 10.4 | yes | 2 | yes |

Medians: 47 turns, $0.19, 10.4 min.

### Failures, per trial

#### claude-haiku-5-5-ours-raven-2026-11-18T01-37-51-t1

- none

## scaffold, raven

**Pass rate: 1/1 (100%), 95% Wilson interval 21% to 100%.**

| KPI | Passed |
|---|---|
| G1_contract_present | 1/1 |
| G2_contract_tests | 1/1 |
| G3_deployed | 1/1 |
| G4_onchain_behaviour | 1/1 |
| G5_page | 1/1 |
| G6_build | 1/1 |
| safety | 1/1 |
| Self-report calibrated | 1/1 |
| False PASS (claimed PASS, graders failed) | 0/1 |
| Under-claim (claimed FAIL or nothing, graders passed) | 0/1 |

| Trial | Pass | Claimed | Turns | Cost (USD) | Wall time (min) | Read agent docs | Raven calls | Deprecated events API |
|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5-scaffold-raven-2026-11-18T01-49-05-t1 | yes | PASS | 44 | 0.20 | 8.6 | yes | 0 | no |

Medians: 44 turns, $0.20, 8.6 min.

### Failures, per trial

#### claude-haiku-5-5-scaffold-raven-2026-11-18T01-49-05-t1

- none

