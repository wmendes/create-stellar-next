import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRunner, findExecutable, formatCommand, redact } from "../../src/lib/runner.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "csn-runner-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const node = process.execPath;
// Shaped like a Stellar secret key (S + 55 base32 characters). Not a real key.
const FAKE_SECRET = `S${"A".repeat(55)}`;

function runner(dryRun = false) {
  const lines: string[] = [];
  const output: string[] = [];
  const r = createRunner({
    dryRun,
    log: (line) => lines.push(line),
    echo: (chunk) => output.push(chunk),
  });
  return { r, lines, output };
}

describe("formatCommand", () => {
  it("quotes arguments that contain spaces or quotes", () => {
    expect(formatCommand("stellar", ["keys", "generate", "dev"])).toBe("stellar keys generate dev");
    expect(formatCommand("node", ["-e", "console.log('hi there')"])).toBe(
      `node -e "console.log('hi there')"`,
    );
  });
});

describe("redact", () => {
  it("hides anything shaped like a Stellar secret key (INV-04)", () => {
    expect(redact(`--secret ${FAKE_SECRET} done`)).toBe("--secret S…[redacted] done");
    expect(redact("GBBTICKA4RQZSSWUP5SWXZHEZP7XQPXLSUNKEJBFHFJ4MJXX5FXOL3BV")).toContain("GBBT");
  });
});

describe("run", () => {
  it("logs the exact command, runs it and captures output", async () => {
    const { r, lines, output } = runner();
    const result = await r.run({
      command: node,
      args: ["-e", "process.stdout.write('ok')"],
      cwd: dir,
    });
    expect(result.ok).toBe(true);
    expect(result.stdout).toBe("ok");
    expect(lines[0]).toBe(`$ ${formatCommand(node, ["-e", "process.stdout.write('ok')"])}`);
    expect(output.join("")).toContain("ok");
  });

  it("redacts secret-shaped arguments in the log line", async () => {
    const { r, lines } = runner();
    await r.run({ command: node, args: ["-e", "0", FAKE_SECRET], cwd: dir });
    expect(lines.join("\n")).not.toContain(FAKE_SECRET);
  });

  it("on a dry run logs the command and does not execute it (INV-09)", async () => {
    const { r, lines } = runner(true);
    const marker = join(dir, "ran");
    const result = await r.run({
      command: node,
      args: ["-e", `require('fs').writeFileSync(${JSON.stringify(marker)}, '')`],
      cwd: dir,
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(existsSync(marker)).toBe(false);
    expect(lines[0]).toMatch(/^\(dry run\) \$ /);
  });

  it("maps a non-zero exit to COMMAND_FAILED naming the command, the code and the fix", async () => {
    const { r } = runner();
    const result = await r.run({
      command: node,
      args: ["-e", "console.error('boom'); process.exit(4)"],
      cwd: dir,
      fix: "Run `npm install` in my-app.",
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(4);
    expect(result.error?.code).toBe("COMMAND_FAILED");
    expect(result.error?.message).toContain("exited with code 4");
    expect(result.error?.message).toContain("boom");
    expect(result.error?.fix).toBe("Run `npm install` in my-app.");
  });

  it("gives a default fix when the caller has none", async () => {
    const { r } = runner();
    const result = await r.run({ command: node, args: ["-e", "process.exit(1)"], cwd: dir });
    expect(result.error?.fix).toMatch(/Run the command above/);
  });

  it("maps a missing binary to MISSING_PREREQUISITE with an install hint", async () => {
    const { r } = runner();
    const result = await r.run({
      command: "stellar",
      args: ["--version"],
      cwd: dir,
      env: { PATH: dir },
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("MISSING_PREREQUISITE");
    expect(result.error?.message).toContain("stellar");
    expect(result.error?.fix).toContain("developers.stellar.org");
  });

  it("names an unknown missing binary plainly", async () => {
    const { r } = runner();
    const result = await r.run({ command: "no-such-tool-xyz", args: [], cwd: dir });
    expect(result.error?.code).toBe("MISSING_PREREQUISITE");
    expect(result.error?.fix).toContain("no-such-tool-xyz");
  });
});

describe("findExecutable", () => {
  it("finds a .cmd shim on Windows through PATHEXT", async () => {
    const bin = join(dir, "bin");
    await mkdir(bin);
    await writeFile(join(bin, "npm.cmd"), "@echo off\n");
    const found = findExecutable("npm", { PATH: bin, PATHEXT: ".COM;.EXE;.BAT;.CMD" }, "win32");
    expect(found?.toLowerCase()).toBe(join(bin, "npm.cmd").toLowerCase());
  });

  it("returns undefined when the binary is not on PATH", () => {
    expect(findExecutable("stellar", { PATH: dir }, process.platform)).toBeUndefined();
  });

  it("searches every PATH entry in order", async () => {
    const a = join(dir, "a");
    const b = join(dir, "b");
    await mkdir(a);
    await mkdir(b);
    await writeFile(join(b, "tool"), "#!/bin/sh\n", { mode: 0o755 });
    expect(findExecutable("tool", { PATH: [a, b].join(delimiter) }, "linux")).toBe(join(b, "tool"));
  });
});
