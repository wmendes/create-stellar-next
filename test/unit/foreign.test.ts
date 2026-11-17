import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CliEnv, main } from "../../src/cli.ts";
import { type FakeRunner, fakeRunner } from "./fake-runner.ts";

/** A project shaped like create-next-app 16.4.6's output (see docs/SOURCES.md). */
const NEXT_BLOCK =
  "<!-- BEGIN:nextjs-agent-rules -->\n\n## This is NOT the Next.js you know\n\n<!-- END:nextjs-agent-rules -->\n";

let app: string;
let fake: FakeRunner;
const env = (): CliEnv => ({
  cwd: app,
  createRunner: (o) => fake.factory(o),
  nodeVersion: "24.18.1",
});
const read = (f: string) => readFileSync(join(app, f), "utf8");
const pkg = () => JSON.parse(read("package.json")) as { scripts: Record<string, string> };

beforeEach(async () => {
  app = await mkdtemp(join(tmpdir(), "csn-foreign-"));
  fake = fakeRunner();
  await writeFile(
    join(app, "package.json"),
    `${JSON.stringify(
      {
        name: "their-app",
        version: "0.1.0",
        private: true,
        scripts: { dev: "next dev", build: "next build", start: "next start", lint: "eslint" },
        dependencies: { next: "16.4.6", react: "19.3.0", "react-dom": "19.3.0" },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(join(app, "AGENTS.md"), NEXT_BLOCK);
  await writeFile(join(app, ".gitignore"), "/node_modules\n.env*\n");
  await mkdir(join(app, "app"));
  await writeFile(join(app, "app/page.tsx"), "export default function Page() { return null; }\n");
});
afterEach(async () => {
  await rm(app, { recursive: true, force: true });
});

describe("add in a project the tool did not create", () => {
  it("brings in the Stellar core with the first module, leaving their files alone", async () => {
    const page = read("app/page.tsx");
    const r = await main(["add", "local"], env());
    expect(r.exitCode, r.stderr).toBe(0);
    expect(existsSync(join(app, "lib/stellar.ts"))).toBe(true);
    expect(existsSync(join(app, "scripts/check.mjs"))).toBe(true);
    expect(pkg().scripts).toMatchObject({
      dev: "next dev",
      check: "node scripts/check.mjs",
      "network:start": "stellar container start local",
    });
    expect(read(".env")).toContain("NEXT_PUBLIC_STELLAR_NETWORK=testnet");
    expect(read("app/page.tsx")).toBe(page);
    expect(read(".gitignore")).toBe("/node_modules\n.env*\n");
  });

  it("keeps Next's AGENTS.md block and appends its own", async () => {
    await main(["add", "local"], env());
    const agents = read("AGENTS.md");
    expect(agents.startsWith(NEXT_BLOCK)).toBe(true);
    expect(agents).toContain("<!-- BEGIN:stellar-agent-rules -->");
    expect(agents).toContain("`check`");
    expect(agents).not.toContain("`build`");
  });

  it("writes CLAUDE.md only when the project has none", async () => {
    await main(["add", "local"], env());
    expect(read("CLAUDE.md")).toBe("@AGENTS.md\n");
    await writeFile(join(app, "CLAUDE.md"), "Our own instructions.\n");
    expect((await main(["add", "contract"], env())).exitCode).toBe(0);
    expect(read("CLAUDE.md")).toBe("Our own instructions.\n");
  });

  it("adds contracts with a contracts:watch script and leaves their dev script alone", async () => {
    const r = await main(["add", "contract"], env());
    expect(r.exitCode, r.stderr).toBe(0);
    expect(pkg().scripts.dev).toBe("next dev");
    expect(pkg().scripts["contracts:watch"]).toBe("node scripts/watch-contracts.mjs");
    expect(existsSync(join(app, "lib/contracts.ts"))).toBe(true);
  });

  it("changes nothing the second time", async () => {
    await main(["add", "contract"], env());
    await main(["add", "wallet", "--wallet", "extension"], env());
    const files = [
      "package.json",
      "AGENTS.md",
      ".env",
      "lib/stellar.ts",
      ".create-stellar-next.json",
    ];
    const before = files.map(read);
    expect((await main(["add", "contract"], env())).exitCode).toBe(0);
    expect((await main(["add", "wallet", "--wallet", "extension"], env())).exitCode).toBe(0);
    expect(files.map(read)).toEqual(before);
  });
});
