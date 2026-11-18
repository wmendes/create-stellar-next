// Builds the results table for the staking benchmark from the raw data in results/.
// Usage: node bench/staking/summarize.mjs   (writes results/SUMMARY.md and prints it)
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("./results/", import.meta.url));
const trials = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "grades.json")))
  .map((d) => ({
    id: d.name,
    ...JSON.parse(readFileSync(join(dir, d.name, "grades.json"), "utf8")),
    run: existsSync(join(dir, d.name, "run.json"))
      ? JSON.parse(readFileSync(join(dir, d.name, "run.json"), "utf8"))
      : {},
  }));

/** 95% Wilson score interval for k successes out of n. */
function wilson(k, n) {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = k / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  const denom = 1 + (z * z) / n;
  return [Math.max(0, (centre - margin) / denom), Math.min(1, (centre + margin) / denom)];
}
const pct = (x) => `${Math.round(x * 100)}%`;
const median = (xs) => {
  const s = xs.filter((x) => typeof x === "number").sort((a, b) => a - b);
  return s.length === 0 ? undefined : s[Math.floor((s.length - 1) / 2)];
};

const n = trials.length;
const passes = trials.filter((t) => t.pass).length;
const [lo, hi] = wilson(passes, n);
const keys = [
  "G1_contract_present",
  "G2_contract_tests",
  "G3_deployed",
  "G4_onchain_behaviour",
  "G5_page",
  "G6_project_check",
  "safety",
];
const lines = [
  "# Staking benchmark results",
  "",
  `Trials: ${n}. Built by \`summarize.mjs\` from \`results/*/grades.json\`.`,
  "",
  `**Pass rate: ${passes}/${n} (${pct(n ? passes / n : 0)}), 95% Wilson interval ${pct(lo)} to ${pct(hi)}.**`,
  "",
  "| KPI | Passed |",
  "|---|---|",
  ...keys.map((k) => `| ${k} | ${trials.filter((t) => t.grades?.[k]?.pass).length}/${n} |`),
  `| Self-report calibrated | ${trials.filter((t) => t.selfReport?.calibrated).length}/${n} |`,
  "",
  "| Trial | Pass | Claimed | Turns | Cost (USD) | Wall time (min) | Read AGENTS.md | Read docs/stellar | Ran check | Outdated patterns |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...trials.map(
    (t) =>
      `| ${t.id} | ${t.pass ? "yes" : "no"} | ${t.selfReport?.claim} | ${t.metrics?.turns ?? "?"} | ${t.metrics?.costUsd?.toFixed?.(2) ?? "?"} | ${t.run?.wallMs ? (t.run.wallMs / 60000).toFixed(1) : "?"} | ${t.process?.readAgentsMd ? "yes" : "no"} | ${t.process?.readStellarDocs ? "yes" : "no"} | ${t.process?.ranCheck ? "yes" : "no"} | ${t.process?.outdatedPatterns?.join(", ") || "none"} |`,
  ),
  "",
  `Medians over all trials: ${median(trials.map((t) => t.metrics?.turns)) ?? "?"} turns, $${median(trials.map((t) => t.metrics?.costUsd))?.toFixed(2) ?? "?"}, ${((median(trials.map((t) => t.run?.wallMs)) ?? 0) / 60000).toFixed(1)} min.`,
  "",
  "## Failures, per trial",
  "",
  ...trials.flatMap((t) => [
    `### ${t.id}`,
    "",
    ...keys.filter((k) => !t.grades?.[k]?.pass).map((k) => `- ${k}: ${t.grades?.[k]?.detail}`),
    ...(t.pass ? ["- none"] : []),
    "",
  ]),
];
writeFileSync(join(dir, "SUMMARY.md"), `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
