// Secret scan (SPEC §8.2, INV-04): fails if any file holds something shaped like a Stellar secret key.
// Usage: node test/secret-scan.mjs            scans every file git tracks in this repository
//        node test/secret-scan.mjs <dir>      scans every file under <dir>, skipping dependencies and build output
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SECRET_KEY = /\bS[A-Z2-7]{55}\b/;
const SKIP = new Set(["node_modules", ".next", "target", ".git"]);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return [];
    const full = join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

const target = process.argv[2];
const files = target
  ? walk(target)
  : execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);

const hits = [];
for (const file of files) {
  if (statSync(file).size > 5_000_000) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (SECRET_KEY.test(line))
      hits.push(`${(target ? relative(target, file) : file).split(sep).join("/")}:${i + 1}`);
  });
}
if (hits.length > 0) {
  console.error(
    `✗ Secret-shaped strings found (S + 55 base32 characters). Remove them:\n  ${hits.join("\n  ")}`,
  );
  process.exit(1);
}
console.log(`✓ No secret-shaped strings in ${files.length} files.`);
