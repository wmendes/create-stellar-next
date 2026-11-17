import {
	mkdtemp,
	readdir,
	readFile,
	rm,
	stat,
	writeFile,
	mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MANIFEST_FILE, readManifest } from "../../src/lib/manifest.ts";
import { applyPlan, planWrites, type FileSpec } from "../../src/lib/writer.ts";

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "csn-writer-"));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

/** Every file under root, with its content, sorted. Used to prove "nothing changed". */
async function snapshot(dir: string): Promise<Record<string, string>> {
	const out: Record<string, string> = {};
	async function walk(d: string): Promise<void> {
		for (const entry of await readdir(d, { withFileTypes: true })) {
			const full = join(d, entry.name);
			if (entry.isDirectory()) await walk(full);
			else
				out[relative(dir, full).split(sep).join("/")] = await readFile(
					full,
					"utf8",
				);
		}
	}
	await walk(dir);
	return Object.fromEntries(
		Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
	);
}

async function write(
	files: FileSpec[],
	opts: { force?: boolean; dryRun?: boolean } = {},
) {
	const plan = await planWrites(root, files, { force: opts.force ?? false });
	return applyPlan(root, plan, { dryRun: opts.dryRun ?? false });
}

const base: FileSpec[] = [
	{ path: "package.json", content: '{ "name": "app" }\n' },
	{ path: "lib/stellar.ts", content: "export const network = 'testnet';\n" },
];

describe("planWrites on an empty directory", () => {
	it("creates every file and records a hash for each in the manifest", async () => {
		const result = await write(base);
		expect(result.ok).toBe(true);
		expect(result.actions.map((a) => [a.path, a.action])).toEqual([
			["lib/stellar.ts", "create"],
			["package.json", "create"],
		]);
		expect(await readFile(join(root, "lib/stellar.ts"), "utf8")).toBe(
			base[1]?.content,
		);
		const manifest = await readManifest(root);
		expect(Object.keys(manifest.files).sort()).toEqual([
			"lib/stellar.ts",
			"package.json",
		]);
		expect(manifest.files["package.json"]).toMatch(/^sha256-[0-9a-f]{64}$/);
	});
});

describe("dry run", () => {
	it("returns the plan and writes nothing, not even the manifest", async () => {
		const result = await write(base, { dryRun: true });
		expect(result.ok).toBe(true);
		expect(result.actions.every((a) => a.action === "create")).toBe(true);
		expect(await readdir(root)).toEqual([]);
	});
});

describe("second run with the same plan", () => {
	it("reports every file unchanged and leaves the tree byte-identical", async () => {
		await write(base);
		const before = await snapshot(root);
		const result = await write(base);
		expect(result.actions.every((a) => a.action === "unchanged")).toBe(true);
		expect(await snapshot(root)).toEqual(before);
	});
});

describe("a file the tool wrote and the user did not edit", () => {
	it("is updated without --force when the template changes", async () => {
		await write(base);
		const changed: FileSpec[] = [
			base[0] as FileSpec,
			{ path: "lib/stellar.ts", content: "// v2\n" },
		];
		const result = await write(changed);
		expect(result.ok).toBe(true);
		expect(
			result.actions.find((a) => a.path === "lib/stellar.ts")?.action,
		).toBe("update");
		expect(await readFile(join(root, "lib/stellar.ts"), "utf8")).toBe(
			"// v2\n",
		);
		const manifest = await readManifest(root);
		const again = await write(changed);
		expect(again.actions.every((a) => a.action === "unchanged")).toBe(true);
		expect(await readManifest(root)).toEqual(manifest);
	});
});

describe("a file the user edited", () => {
	it("is refused without --force, and nothing at all is written", async () => {
		await write(base);
		await writeFile(join(root, "lib/stellar.ts"), "// my edit\n");
		const before = await snapshot(root);
		const changed: FileSpec[] = [
			{ path: "package.json", content: '{ "name": "app2" }\n' },
			{ path: "lib/stellar.ts", content: "// v2\n" },
			{ path: "lib/new.ts", content: "// new\n" },
		];
		const result = await write(changed);
		expect(result.ok).toBe(false);
		expect(
			result.actions.find((a) => a.path === "lib/stellar.ts")?.action,
		).toBe("conflict");
		expect(result.error?.message).toContain("lib/stellar.ts");
		expect(result.error?.fix).toContain("--force");
		expect(await snapshot(root)).toEqual(before);
	});

	it("is overwritten with --force", async () => {
		await write(base);
		await writeFile(join(root, "lib/stellar.ts"), "// my edit\n");
		const result = await write(
			[{ path: "lib/stellar.ts", content: "// v2\n" }],
			{ force: true },
		);
		expect(result.ok).toBe(true);
		expect(result.actions[0]?.action).toBe("update");
		expect(await readFile(join(root, "lib/stellar.ts"), "utf8")).toBe(
			"// v2\n",
		);
	});

	it("is left alone, with no conflict, when its content already equals the template", async () => {
		await write(base);
		await writeFile(join(root, "lib/stellar.ts"), "// v2\n");
		const result = await write([
			{ path: "lib/stellar.ts", content: "// v2\n" },
		]);
		expect(result.ok).toBe(true);
		expect(result.actions[0]?.action).toBe("unchanged");
	});
});

describe("a file that existed before the tool, with no manifest entry", () => {
	it("is a conflict without --force", async () => {
		await mkdir(join(root, "app"), { recursive: true });
		await writeFile(
			join(root, "app/page.tsx"),
			"export default function Page() {}\n",
		);
		const result = await write([
			{ path: "app/page.tsx", content: "// ours\n" },
		]);
		expect(result.ok).toBe(false);
		expect(result.actions[0]?.action).toBe("conflict");
	});
});

describe("paths", () => {
	it.each([
		"../escape.txt",
		"/etc/passwd",
		"a/../../escape.txt",
		"C:\\\\x.txt",
		"",
	])("rejects %j, which would leave the target directory", async (path) => {
		await expect(
			planWrites(root, [{ path, content: "x" }], { force: false }),
		).rejects.toThrow(/outside the target directory|invalid path/);
	});

	it("rejects writing the manifest file itself", async () => {
		await expect(
			planWrites(root, [{ path: MANIFEST_FILE, content: "{}" }], {
				force: false,
			}),
		).rejects.toThrow(/reserved/);
	});

	it("rejects the same path twice in one plan", async () => {
		await expect(
			planWrites(root, [base[0] as FileSpec, base[0] as FileSpec], {
				force: false,
			}),
		).rejects.toThrow(/twice/);
	});
});

describe("property: applying any plan twice changes nothing the second time", () => {
	// Small deterministic PRNG so failures reproduce.
	function rng(seed: number) {
		let s = seed >>> 0;
		return () => {
			s = (s * 1664525 + 1013904223) >>> 0;
			return s / 2 ** 32;
		};
	}

	it("holds for 50 random plans", async () => {
		const names = ["a.ts", "b/c.ts", "b/d.json", "e/f/g.md", "h.txt"];
		for (let seed = 1; seed <= 50; seed++) {
			const rand = rng(seed);
			const dir = await mkdtemp(join(tmpdir(), "csn-prop-"));
			try {
				const files = names
					.filter(() => rand() < 0.7)
					.map((path) => ({
						path,
						content: `seed ${seed} ${Math.floor(rand() * 1000)}\n`,
					}));
				await applyPlan(dir, await planWrites(dir, files, { force: false }), {
					dryRun: false,
				});
				const before = await snapshot(dir);
				const second = await applyPlan(
					dir,
					await planWrites(dir, files, { force: false }),
					{
						dryRun: false,
					},
				);
				expect(
					second.actions.every((a) => a.action === "unchanged"),
					`seed ${seed}`,
				).toBe(true);
				expect(await snapshot(dir), `seed ${seed}`).toEqual(before);
			} finally {
				await rm(dir, { recursive: true, force: true });
			}
		}
	});
});

describe("manifest", () => {
	it("is written with sorted keys so its bytes are stable", async () => {
		await write([...base].reverse());
		const text = await readFile(join(root, MANIFEST_FILE), "utf8");
		expect(text.indexOf('"lib/stellar.ts"')).toBeLessThan(
			text.indexOf('"package.json"'),
		);
		expect(text.endsWith("\n")).toBe(true);
		expect((await stat(join(root, MANIFEST_FILE))).isFile()).toBe(true);
	});

	it("reads as empty when absent", async () => {
		expect(await readManifest(root)).toEqual({ version: 1, files: {} });
	});
});
