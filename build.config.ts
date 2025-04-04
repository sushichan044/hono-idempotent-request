import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  declaration: true,
  entries: [
    "src/index.ts",
    "src/brand/index.ts",
    "src/server-specification/index.ts",
    "src/storage/index.ts",
    "src/types.ts",
  ],
  outDir: "dist",
  rollup: {
    esbuild: {
      minifySyntax: true,
    },
  },
});
