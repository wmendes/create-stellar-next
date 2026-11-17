import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = fileURLToPath(new URL("../../src/", import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : e.name.endsWith(".ts")
        ? [join(dir, e.name)]
        : [],
  );
}

const files = sources(src).map((full) => ({
  path: relative(src, full).split(sep).join("/"),
  text: readFileSync(full, "utf8"),
}));

describe("boundaries (SPEC §3.5)", () => {
  it("B-1: only lib/runner.ts starts processes", () => {
    const offenders = files
      .filter((f) => /from "node:child_process"|require\("child_process"\)/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual(["lib/runner.ts"]);
  });

  it("B-7: src never imports from test/ or bench/", () => {
    const offenders = files
      .filter((f) => /from "(\.\.\/)+(test|bench)\//.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
