// Projects with lib/contracts.ts import generated clients from packages/. Until the setup script has
// generated them, nothing that imports lib/contracts.ts can build. check and dev stop early with this.
import { existsSync, readdirSync } from "node:fs";

/** Exits with a clear message when lib/contracts.ts exists but its generated clients do not. */
export function requireGeneratedClients() {
  if (!existsSync("lib/contracts.ts")) return;
  const packages = existsSync("packages")
    ? readdirSync("packages", { withFileTypes: true }).filter((e) => e.isDirectory())
    : [];
  const missing =
    packages.length === 0 ||
    packages.some((e) => !existsSync(`packages/${e.name}/dist/index.js`)) ||
    (existsSync("contracts/Cargo.toml") && !existsSync("packages/contract-ids.json"));
  if (missing) {
    console.error(
      "✗ The generated contract clients in packages/ are missing. Run the setup script first: npm run setup",
    );
    process.exit(1);
  }
}
