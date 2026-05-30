import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["pnpm-lock.yaml", "CHANGELOG.md"],
    jsdoc: true,
    sortImports: true,
  },
  lint: {
    jsPlugins: ["vite-plus/oxlint-plugin"],
    categories: {
      correctness: "error",
      nursery: "error",
      perf: "error",
    },
    env: {
      node: true,
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
  },
  pack: {
    attw: { level: "error", profile: "esm-only" },
    clean: true,
    dts: {
      tsgo: true,
    },
    entry: [],
    fixedExtension: true,
    format: "esm",
    fromVite: true,
    minify: "dce-only",
    nodeProtocol: true,
    outDir: "dist",
    publint: true,
    sourcemap: false,
    treeshake: true,
    unused: true,
  },
  test: {
    benchmark: {
      include: ["**/*.{bench,benchmark}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    },
    passWithNoTests: true,
    typecheck: {
      enabled: true,
    },
  },
});
