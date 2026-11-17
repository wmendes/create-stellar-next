import { describe, expect, it } from "vitest";
import { detectPackageManager, installCommand, runCommand } from "../../src/lib/package-manager.ts";

describe("detectPackageManager", () => {
  it.each([
    ["npm/11.16.0 node/v24.18.1 darwin arm64 workspaces/false", "npm"],
    ["pnpm/11.21.0 npm/? node/v24.18.1 darwin arm64", "pnpm"],
    ["yarn/1.22.22 npm/? node/v24.18.1 darwin arm64", "yarn"],
    ["bun/1.4.2 npm/? node/v24.18.1 darwin arm64", "bun"],
    [undefined, "npm"],
    ["deno/2.0.0", "npm"],
  ])("%j → %s", (agent, pm) => {
    expect(detectPackageManager(agent)).toBe(pm);
  });
});

describe("commands", () => {
  it("uses each manager's own form", () => {
    expect(installCommand("yarn")).toBe("yarn install");
    expect(runCommand("npm", "dev")).toBe("npm run dev");
    expect(runCommand("bun", "dev")).toBe("bun run dev");
    expect(runCommand("pnpm", "dev")).toBe("pnpm dev");
    expect(runCommand("yarn", "dev")).toBe("yarn dev");
  });
});
