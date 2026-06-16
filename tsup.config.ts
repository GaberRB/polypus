import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: true,
  // Keep the shebang and mark the output as executable-friendly.
  banner: {
    js: "#!/usr/bin/env node",
  },
});
