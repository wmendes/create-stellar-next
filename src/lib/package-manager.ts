export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/** npm, pnpm, yarn and bun all set npm_config_user_agent, e.g. "pnpm/10.0.0 npm/? node/v24". */
export function detectPackageManager(userAgent: string | undefined): PackageManager {
  const name = userAgent?.split("/")[0];
  return (PACKAGE_MANAGERS as readonly string[]).includes(name ?? "")
    ? (name as PackageManager)
    : "npm";
}

export function installCommand(pm: PackageManager): string {
  return `${pm} install`;
}

export function runCommand(pm: PackageManager, script: string): string {
  return pm === "npm" || pm === "bun" ? `${pm} run ${script}` : `${pm} ${script}`;
}
