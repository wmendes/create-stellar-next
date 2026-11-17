import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("repository AGENTS.md (T-504)", () => {
  const agents = read("AGENTS.md");

  it("points to CLAUDE.md and docs/SPEC.md and states no rule of its own", () => {
    expect(agents).toContain("CLAUDE.md");
    expect(agents).toContain("docs/SPEC.md");
    expect(agents).not.toMatch(/^\s*\d+\. /m);
    expect(agents.split("\n").length).toBeLessThan(20);
  });
});

describe("docs/llms.txt", () => {
  const llms = read("docs/llms.txt");
  const guides = readdirSync(new URL("../../templates/", import.meta.url), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .flatMap((d) => {
      const dir = new URL(`../../templates/${d.name}/docs/stellar/`, import.meta.url);
      return existsSync(dir)
        ? readdirSync(dir).map((f) => `templates/${d.name}/docs/stellar/${f}`)
        : [];
    });

  it("follows the llms.txt shape: a title, a summary, then link lists", () => {
    expect(llms).toMatch(/^# .+\n\n> .+/);
    expect(llms).toMatch(/^## /m);
  });

  it("links every bundled guide, and every link exists", () => {
    for (const g of guides) expect(llms, g).toContain(`(${g})`);
    for (const m of llms.matchAll(/\]\(([^)]+)\)/g)) {
      const target = m[1] as string;
      if (!target.startsWith("http"))
        expect(existsSync(new URL(`../../${target}`, import.meta.url)), target).toBe(true);
    }
  });

  it("ships in the package with the sources log, while the spec and reference docs do not", () => {
    const files = (JSON.parse(read("package.json")) as { files: string[] }).files;
    expect(files).toEqual(
      expect.arrayContaining(["docs/llms.txt", "docs/SOURCES.md", "templates"]),
    );
    expect(files.some((f) => f.includes("SPEC") || f.includes("reference"))).toBe(false);
  });
});
