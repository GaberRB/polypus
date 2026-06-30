import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Windows git worktree operations (swarm tests) need up to ~25s per test.
    testTimeout: 60_000,
  },
});
