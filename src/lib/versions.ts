/** The oldest Node.js the generated projects and this tool support: the Stellar SDK's floor. */
export const MIN_NODE = "22.12.0";

/** True when `version` (with or without a leading "v") is older than `minimum`. */
export function olderThan(version: string, minimum: string): boolean {
  const a = version.replace(/^v/, "").split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (Number.isNaN(x)) return true;
    if (x !== y) return x < y;
  }
  return false;
}
