import { defineConfig } from "tsup";

const common = {
  format: ["esm"] as const,
  target: "node20" as const,
  platform: "node" as const,
  outDir: "dist",
  splitting: false,
  sourcemap: true,
};

export default defineConfig([
  {
    // The CLI entry — keeps the shebang so `dist/index.js` is executable.
    ...common,
    entry: ["src/cli/index.ts"],
    clean: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    // The library entry for embedders (no shebang; ships types). → dist/lib.js
    ...common,
    entry: { lib: "src/lib.ts" },
    clean: false,
    dts: true,
  },
]);
