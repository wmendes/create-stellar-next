import { describe, expect, it } from "vitest";
import { type ComposeContext, compose } from "../../src/lib/compose.ts";
import { ALL_MODULES, modulesFor } from "../../src/modules/index.ts";
import { TOOL_NAME } from "../../src/name.ts";

/**
 * Docs test, offline part (G5): every script that AGENTS.md or the bundled docs name exists in that
 * project. test/docs-commands.mjs checks the CLI commands they name against the installed tools.
 */

const base: ComposeContext = {
  projectName: "my-app",
  network: "testnet",
  style: "none",
  contracts: "none",
};
const COMBOS: Record<string, ComposeContext> = {
  none: base,
  "hello-world": { ...base, contracts: "hello-world" },
  "contract id": { ...base, contracts: `C${"B".repeat(55)}` },
  everything: { ...base, contracts: "hello-world", local: true, wallet: "wallets-kit", envs: true },
  extension: { ...base, wallet: "extension" },
};
const ALL_SCRIPTS = new Set(ALL_MODULES.flatMap((m) => Object.keys(m.scripts ?? {})));

function docsOf(ctx: ComposeContext) {
  const out = compose(modulesFor(ctx), ctx);
  const files = new Map(out.files.map((f) => [f.path, f.content]));
  const docs = [...files].filter(([p]) => p === "AGENTS.md" || p.startsWith("docs/stellar/"));
  const scripts = Object.keys(JSON.parse(files.get("package.json") ?? "{}").scripts ?? {});
  return { files, docs, scripts };
}

describe.each(Object.entries(COMBOS))("docs for a %s project", (_name, ctx) => {
  const { files, docs, scripts } = docsOf(ctx);

  it("names only scripts the project has", () => {
    for (const [path, text] of docs) {
      const named = [
        ...[...text.matchAll(/`([a-z]+(?::[a-z]+)*)`/g)]
          .map((m) => m[1] as string)
          .filter((s) => ALL_SCRIPTS.has(s)),
        ...[...text.matchAll(/npm run ([a-z]+(?::[a-z]+)*)/g)].map((m) => m[1] as string),
      ];
      for (const s of named) expect(scripts, `${path} names \`${s}\``).toContain(s);
    }
  });

  it("links only to bundled docs that exist", () => {
    for (const [path, text] of docs) {
      for (const m of text.matchAll(/`(docs\/stellar\/[\w.-]+)`/g)) {
        expect(files.has(m[1] as string), `${path} links ${m[1]}`).toBe(true);
      }
    }
  });

  it("has a docs index listing every bundled doc", () => {
    const index = files.get("docs/stellar/README.md") ?? "";
    for (const [path] of docs.filter(
      ([p]) => p.startsWith("docs/stellar/") && p !== "docs/stellar/README.md",
    )) {
      expect(index, path).toContain(path.replace("docs/stellar/", ""));
    }
  });

  it("keeps AGENTS.md under 80 lines, with the six rules, the docs pointer and stellar skill (INV-15)", () => {
    const agents = files.get("AGENTS.md") ?? "";
    expect(agents.split("\n").length).toBeLessThan(80);
    const rules = agents.slice(agents.indexOf("## Rules")).match(/^\d+\. /gm) ?? [];
    expect(rules).toHaveLength(6);
    expect(agents).toContain("docs/stellar/README.md");
    expect(agents).toContain("stellar skill");
  });

  it("points agents at Raven: use it when present, suggest installing it when not (T-210)", () => {
    const agents = files.get("AGENTS.md") ?? "";
    const raven = agents.slice(agents.indexOf("## Raven"), agents.indexOf("## Rules"));
    expect(raven).toContain("https://raven.stellar.org/mcp");
    expect(raven).toMatch(/read-only/i);
    expect(raven).toMatch(/verify|check/i);
    expect(raven).toMatch(/tell the user/i);
    expect(raven).toContain(
      "claude mcp add --transport http stellar-raven https://raven.stellar.org/mcp",
    );
    expect(agents.indexOf("## Raven")).toBeLessThan(agents.indexOf("## Rules"));
  });

  it("says when Raven must be used, that passing tests do not replace it, and to report lookups (T-210)", () => {
    const agents = files.get("AGENTS.md") ?? "";
    const raven = agents.slice(agents.indexOf("## Raven"), agents.indexOf("## Rules"));
    // The moments that trigger a lookup, not just a general "verify facts".
    expect(raven).toMatch(/before writing code against a Stellar API/i);
    expect(raven).toMatch(/asset contract IDs/i);
    expect(raven).toMatch(/error you do not recognise/i);
    // Haiku skipped Raven because compiling and testing felt like verification.
    expect(raven).toMatch(/passing tests (is|are) not a reason to skip/i);
    expect(raven).toMatch(/final report/i);
  });

  it("never mentions the tool (B-4)", () => {
    for (const [path, text] of docs) expect(text, path).not.toContain(TOOL_NAME);
  });
});

describe("AGENTS.md rule 4", () => {
  it("keeps the spec's wording where contracts:bindings exists", () => {
    expect(docsOf(COMBOS["hello-world"] as ComposeContext).files.get("AGENTS.md")).toContain(
      "4. Do not edit `packages/`. Change the contract and run `contracts:bindings`.",
    );
  });
});

describe("outdated patterns (T-502)", () => {
  const ctx: ComposeContext = { ...base, contracts: "none" };
  const files = new Map(compose(modulesFor(ctx), ctx).files.map((f) => [f.path, f.content]));
  const guide = files.get("docs/stellar/outdated.md") ?? "";
  const rows = guide.split("\n").filter((l) => l.startsWith("| `"));

  it("ships in every project and is linked from AGENTS.md", () => {
    expect(guide).not.toBe("");
    expect(files.get("AGENTS.md")).toContain("docs/stellar/outdated.md");
  });

  it("pairs each outdated pattern with its replacement and a source", () => {
    expect(rows.length).toBeGreaterThanOrEqual(7);
    for (const row of rows) {
      const cells = row.split("|").map((c) => c.trim());
      expect(cells[2], row).toMatch(/`/);
      expect(cells[3], row).toMatch(/https:\/\/developers\.stellar\.org\/|installed:/);
    }
  });

  it("covers the two patterns AGENTS.md rule 5 forbids", () => {
    expect(guide).toContain("`stellar contract bindings typescript`");
    expect(guide).toContain("`@stellar/stellar-base`");
  });
});
