import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type ComposeContext, compose, type Module } from "../../src/lib/compose.ts";
import { MANIFEST_FILE } from "../../src/lib/manifest.ts";
import { ALL_MODULES, modulesFor } from "../../src/modules/index.ts";
import { TOOL_NAME } from "../../src/name.ts";

const ctx: ComposeContext = {
  projectName: "my-app",
  network: "testnet",
  style: "tailwind",
  contracts: "none",
};

function files(context: ComposeContext): Map<string, string> {
  const result = compose(modulesFor(context), context);
  return new Map(result.files.map((f) => [f.path, f.content]));
}

function pkgOf(out: Map<string, string>) {
  return JSON.parse(out.get("package.json") ?? "null") as {
    name: string;
    private: boolean;
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    engines: { node: string };
  };
}

describe("base module with tailwind on testnet", () => {
  const out = files(ctx);

  it("writes the base layout", () => {
    for (const path of [
      "app/layout.tsx",
      "app/page.tsx",
      "app/globals.css",
      "lib/stellar.ts",
      "scripts/check.mjs",
      ".env.example",
      ".env",
      ".gitignore",
      "AGENTS.md",
      "CLAUDE.md",
      "package.json",
      "tsconfig.json",
      "next.config.ts",
      "eslint.config.mjs",
    ]) {
      expect(out.has(path), path).toBe(true);
    }
  });

  it("writes package.json with the project name, the fixed scripts and pinned versions", () => {
    const pkg = pkgOf(out);
    expect(pkg.name).toBe("my-app");
    expect(pkg.private).toBe(true);
    expect(Object.keys(pkg.scripts)).toEqual(
      expect.arrayContaining(["dev", "build", "start", "lint", "typecheck", "check"]),
    );
    expect(pkg.scripts.check).toBe("node scripts/check.mjs");
    expect(pkg.dependencies.next).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\d+\.\d+\.\d+$/);
    for (const v of [...Object.values(pkg.dependencies), ...Object.values(pkg.devDependencies)]) {
      expect(v, "every version is exact").toMatch(/^\d+\.\d+\.\d+$/);
    }
    expect(pkg.engines.node).toBe(">=22.12.0");
  });

  it("targets testnet in both .env files, and they are identical", () => {
    const env = out.get(".env.example") ?? "";
    expect(env).toContain("NEXT_PUBLIC_STELLAR_NETWORK=testnet\n");
    expect(env).toContain("NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org\n");
    expect(out.get(".env")).toBe(env);
  });

  it("keeps .env.example out of the ignore rules", () => {
    const ignore = out.get(".gitignore") ?? "";
    expect(ignore).toContain(".env*");
    expect(ignore).toContain("!.env.example");
  });

  it("writes CLAUDE.md as one line importing AGENTS.md", () => {
    expect(out.get("CLAUDE.md")).toBe("@AGENTS.md\n");
  });

  it("writes an AGENTS.md under 80 lines with the six rules and every script", () => {
    const agents = out.get("AGENTS.md") ?? "";
    expect(agents.split("\n").length).toBeLessThan(80);
    for (const rule of [
      "Use testnet unless the user names another network.",
      "Never write a secret key to a file. Use Stellar CLI identities by name.",
      "Never deploy to mainnet without the user's explicit confirmation in the current task.",
      "Do not use `stellar contract bindings typescript` or `@stellar/stellar-base`.",
      "before reporting a task as done",
    ]) {
      expect(agents).toContain(rule);
    }
    for (const script of Object.keys(pkgOf(out).scripts)) {
      expect(agents, script).toContain(`\`${script}\``);
    }
  });

  it("uses Tailwind", () => {
    expect(out.get("app/globals.css")).toContain('@import "tailwindcss"');
    expect(out.get("next.config.ts")).toContain("@tailwindcss/turbopack");
  });

  it("leaves no unreplaced token in any file", () => {
    for (const [path, content] of out) expect(content, path).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it("does not mention or depend on the tool in any file it writes (B-4, INV-01)", () => {
    const pkg = pkgOf(out);
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })).not.toContain(TOOL_NAME);
    for (const [path, content] of out) expect(content, path).not.toContain(TOOL_NAME);
    expect(out.has(MANIFEST_FILE)).toBe(false);
  });

  it("writes no wallet, local network, registry or envs file (INV-05)", () => {
    for (const path of out.keys()) {
      expect(path).not.toMatch(/^lib\/wallet\/|stellar\.envs\.toml|environments\.toml/);
    }
    const scripts = Object.keys(pkgOf(out).scripts);
    expect(scripts.filter((s) => /^(network|registry|envs):/.test(s))).toEqual([]);
  });
});

describe("--style none", () => {
  const out = files({ ...ctx, style: "none" });

  it("omits Tailwind entirely", () => {
    const pkg = pkgOf(out);
    expect(Object.keys(pkg.devDependencies).filter((d) => d.includes("tailwind"))).toEqual([]);
    expect(out.get("app/globals.css")).not.toContain("tailwind");
    expect(out.get("next.config.ts")).not.toContain("tailwind");
  });
});

describe("--network mainnet", () => {
  const out = files({ ...ctx, network: "mainnet" });

  it("ships no mainnet RPC URL (INV-02)", () => {
    const env = out.get(".env.example") ?? "";
    expect(env).toContain("NEXT_PUBLIC_STELLAR_NETWORK=mainnet\n");
    expect(env).toContain("NEXT_PUBLIC_STELLAR_RPC_URL=\n");
  });
});

describe("compose rules", () => {
  const a: Module = { id: "a", templates: [], scripts: { x: { command: "x", description: "x" } } };

  it("refuses two modules that define the same script", () => {
    expect(() => compose([a, { ...a, id: "b" }], ctx)).toThrow(/script "x".*a.*b/);
  });

  it("refuses two modules that write the same file", () => {
    const m = (id: string): Module => ({
      id,
      templates: [],
      files: () => [{ path: "f", content: "" }],
    });
    expect(() => compose([m("a"), m("b")], ctx)).toThrow(/"f".*a.*b/);
  });

  it("refuses two modules that pin the same dependency to different versions", () => {
    const m = (id: string, v: string): Module => ({ id, templates: [], dependencies: { p: v } });
    expect(() => compose([m("a", "1.0.0"), m("b", "2.0.0")], ctx)).toThrow(/"p"/);
  });
});

describe("templates", () => {
  it("has no template directory that no module uses", () => {
    const used = new Set(ALL_MODULES.flatMap((m) => m.templates));
    const dirs = readdirSync(new URL("../../templates/", import.meta.url), { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => d.name);
    expect(dirs.filter((d) => !used.has(d))).toEqual([]);
  });

  it("typechecks templates against the same versions the generated project installs", () => {
    // The in-place typecheck (templates/tsconfig.json) resolves these from the repository root.
    const typecheckedAgainst = [
      "next",
      "react",
      "react-dom",
      "@types/react",
      "@types/react-dom",
      "@types/node",
      "@stellar/stellar-sdk",
      "@stellar/varial-sdk",
      "@creit.tech/stellar-wallets-kit",
    ];
    const root = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as {
      devDependencies: Record<string, string>;
    };
    const declared = Object.assign(
      {},
      ...ALL_MODULES.map((m) => ({ ...m.dependencies, ...m.devDependencies })),
    ) as Record<string, string>;
    for (const name of typecheckedAgainst) {
      expect(declared[name], `a module declares ${name}`).toBeDefined();
      expect(root.devDependencies[name], name).toBe(declared[name]);
    }
  });
});
