import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { main } from "../../src/cli.ts";
import { TOOL_NAME } from "../../src/name.ts";

const pkg = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as {
	name: string;
	version: string;
};

describe("cli --version", () => {
	it("prints the package version and exits 0", async () => {
		const result = await main(["--version"]);
		expect(result).toEqual({
			exitCode: 0,
			stdout: `${pkg.version}\n`,
			stderr: "",
		});
	});

	it("accepts -v as a short form", async () => {
		expect((await main(["-v"])).stdout).toBe(`${pkg.version}\n`);
	});
});

describe("cli --help", () => {
	it("prints usage naming every accepted flag and exits 0", async () => {
		const result = await main(["--help"]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain(`Usage: ${TOOL_NAME}`);
		expect(result.stdout).toContain("--version");
		expect(result.stdout).toContain("--help");
	});
});

describe("cli argument errors", () => {
	it("exits 2 on an unknown flag and names the fix", async () => {
		const result = await main(["--no-such-flag"]);
		expect(result.exitCode).toBe(2);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("--no-such-flag");
		expect(result.stderr).toContain(`${TOOL_NAME} --help`);
	});
});

describe("tool name", () => {
	it("is held in one constant that matches package.json", () => {
		expect(TOOL_NAME).toBe(pkg.name);
	});
});
