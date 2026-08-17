import { describe, expect, it } from "vitest"

import { SUPPORTED_LOCALES, getTranslations } from "@/lib/i18n/config"

// Key-set parity between locales is NOT tested here, deliberately. `es.ts` ends
// in `satisfies Translations`, where `Translations` is derived from `en.ts`, so
// a missing or extra key is already a compile error in both directions — and a
// hand-written comparison of a few namespaces (which is what this file used to
// hold) only ever re-proved a subset of what `tsc` proves completely.
//
// What the type system genuinely cannot see is a key that exists with nothing
// useful in it: `""`, whitespace, or a placeholder left behind after a rename.
// That is what these check.

type Node = string | { [key: string]: Node }

/** Every leaf in a dictionary, as `namespace.key` → value. */
function leaves(node: Node, path: string[] = []): [string, string][] {
  if (typeof node === "string") return [[path.join("."), node]]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, [...path, k]))
}

describe("translation dictionaries", () => {
  for (const locale of SUPPORTED_LOCALES) {
    describe(locale, () => {
      const entries = leaves(getTranslations(locale) as unknown as Node)

      it("is not empty", () => {
        expect(entries.length).toBeGreaterThan(100)
      })

      it("has no blank strings", () => {
        const blank = entries.filter(([, v]) => v.trim().length === 0).map(([k]) => k)
        expect(blank).toEqual([])
      })

      it("leaves no interpolation placeholder unpaired with its English original", () => {
        // A `{name}` slot that survives a translation but not its counterpart —
        // or vice versa — renders the literal braces to the user.
        const en = new Map(leaves(getTranslations("en") as unknown as Node))
        const mismatched = entries
          .filter(([key, value]) => {
            const original = en.get(key)
            if (original === undefined) return false
            const slots = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(",")
            return slots(original) !== slots(value)
          })
          .map(([k]) => k)
        expect(mismatched).toEqual([])
      })
    })
  }
})
