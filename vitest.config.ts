import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/unit/**/*.test.ts"],
    // Several suites spawn the generated scripts as real processes; 5 s is too tight under load.
    testTimeout: 30_000,
  },
});
