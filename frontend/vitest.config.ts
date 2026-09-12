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
    // suite falls outside these globs.
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
      ],
      exclude: ["components/ui/**"],
      // A ratchet, not a target. Each number sits just under what the suite
      // actually reaches today, so coverage can only go up: adding an untested
      // file fails the run, and raising these after a batch of new tests is the
      // deliberate act that locks the gain in. They are NOT a statement that
      // ~48% is enough — it is the floor we have, and the point is that it
      // cannot quietly erode. Before this the report was printed and ignored.
      thresholds: {
        statements: 47,
        branches: 48,
        functions: 49,
        lines: 49,
      },
    },
  },
})
