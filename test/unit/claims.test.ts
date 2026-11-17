import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** SPEC §2: words the project may not use about itself, and claims that need evidence it lacks. */
const BANNED = [
  "secure",
  "audited",
  "production-ready",
  "guaranteed",
  "zero-downtime",
  "trustless",
  "scalable",
];
const PUBLIC = [
  "README.md",
  "CHANGELOG.md",
  "docs/migrating-from-scaffold-stellar.md",
  "docs/llms.txt",
  "REPORT.md",
];

describe.each(PUBLIC)("%s (claims policy, SPEC §2)", (path) => {
  const url = new URL(`../../${path}`, import.meta.url);

  it("exists", () => {
    expect(existsSync(url)).toBe(true);
  });

  it("uses none of the banned words", () => {
    const text = readFileSync(url, "utf8").toLowerCase();
    for (const word of BANNED) expect(text, word).not.toMatch(new RegExp(`\\b${word}\\b`));
  });

  it("does not claim results that need the benchmark or CI", () => {
    const text = readFileSync(url, "utf8");
    expect(text).not.toMatch(/works (on|across) (linux|windows)/i);
    expect(text).not.toMatch(/\b\d+(\.\d+)?% pass rate/i);
    expect(text).not.toMatch(/\bbetter than scaffold/i);
  });
});
