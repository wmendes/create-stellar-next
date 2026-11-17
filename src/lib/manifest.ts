import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TOOL_NAME } from "../name.ts";

/** The only trace of the tool in a generated project. Nothing reads it at runtime (B-4). */
export const MANIFEST_FILE = `.${TOOL_NAME}.json`;

export interface Manifest {
	version: 1;
	/** Project-relative POSIX path → `sha256-<hex>` of the bytes the tool last wrote. */
	files: Record<string, string>;
}

export function hashContent(content: string | Uint8Array): string {
	return `sha256-${createHash("sha256").update(content).digest("hex")}`;
}

export async function readManifest(root: string): Promise<Manifest> {
	let text: string;
	try {
		text = await readFile(join(root, MANIFEST_FILE), "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			return { version: 1, files: {} };
		throw error;
	}
	const parsed = JSON.parse(text) as Partial<Manifest>;
	if (
		parsed.version !== 1 ||
		typeof parsed.files !== "object" ||
		parsed.files === null
	) {
		throw new Error(
			`${MANIFEST_FILE} has an unknown format. Delete it, then rerun with --force.`,
		);
	}
	return { version: 1, files: { ...parsed.files } };
}

export function serializeManifest(manifest: Manifest): string {
	const files = Object.fromEntries(
		Object.entries(manifest.files).sort(([a], [b]) =>
			a < b ? -1 : a > b ? 1 : 0,
		),
	);
	return `${JSON.stringify({ version: manifest.version, files }, null, 2)}\n`;
}

export async function writeManifest(
	root: string,
	manifest: Manifest,
): Promise<void> {
	await writeFile(join(root, MANIFEST_FILE), serializeManifest(manifest));
}
