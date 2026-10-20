import { defineConfig } from "vitest/config";

// Root-level scripts and stacks only; each workspace package runs its own tests through turbo.
export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts", "stacks/*.test.ts"],
    passWithNoTests: true,
    // These tests spawn CLIs and Miniflare Workers, whose cold start exceeds the 5 s
    // default while turbo runs every package's typecheck alongside them.
    testTimeout: 30_000,
  },
});
