import { defineConfig } from "tsup"

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/handlers.ts",
    "src/proxy.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["next", "next/server", "next/headers"],
})
