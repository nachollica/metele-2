import path from "node:path"
import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": dirname,
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    css: false,
    restoreMocks: true,
    clearMocks: true,
    // Coverage over the app code we own: everything under app/, components/,
    // and lib/. `components/ui/` (shadcn primitives) is excluded, and the e2e
    // suite falls outside these globs. Report-only: no thresholds, the run
    // never fails on coverage.
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
      ],
      exclude: ["components/ui/**"],
    },
  },
})
