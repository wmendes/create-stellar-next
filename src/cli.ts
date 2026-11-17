import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { TOOL_NAME } from "./name.ts";

export interface CliResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

/** Exit codes fixed by SPEC §5.2. */
export const ExitCode = {
	Success: 0,
	Failure: 1,
	InvalidArguments: 2,
	MissingPrerequisite: 3,
} as const;

function packageVersion(): string {
	// src/cli.ts and dist/cli.js both sit one level below package.json.
	const pkg = JSON.parse(
		readFileSync(new URL("../package.json", import.meta.url), "utf8"),
	) as {
		version: string;
	};
	return pkg.version;
}

const USAGE = `Usage: ${TOOL_NAME} [options]

Options:
  -v, --version  Print the version
  -h, --help     Print this help
`;

export async function main(argv: readonly string[]): Promise<CliResult> {
	let values: { version?: boolean; help?: boolean };
	try {
		({ values } = parseArgs({
			args: [...argv],
			options: {
				version: { type: "boolean", short: "v" },
				help: { type: "boolean", short: "h" },
			},
			allowPositionals: true,
			strict: true,
		}));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			exitCode: ExitCode.InvalidArguments,
			stdout: "",
			stderr: `${message}\nRun \`${TOOL_NAME} --help\` to see the accepted flags.\n`,
		};
	}

	if (values.help) {
		return { exitCode: ExitCode.Success, stdout: USAGE, stderr: "" };
	}

	if (values.version) {
		return {
			exitCode: ExitCode.Success,
			stdout: `${packageVersion()}\n`,
			stderr: "",
		};
	}

	return {
		exitCode: ExitCode.Failure,
		stdout: "",
		stderr: `Nothing is implemented yet besides --version.\nRun \`${TOOL_NAME} --version\`.\n`,
	};
}
