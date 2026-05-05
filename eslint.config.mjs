import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";
import globals from "globals";

export default [
  {
    ignores: [".next/**", "out/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    settings: {
      react: { version: "detect" },
    },
  },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": ts,
      "react-hooks": reactHooks,
      "@next/next": next,
    },
    rules: {
      ...ts.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...next.configs.recommended.rules,
      semi: ["error", "never"],
      quotes: ["error", "double"],
      "comma-dangle": ["error", "always-multiline"],
      // TypeScript handles undefined-variable checks; ESLint flags TS types as values
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // react-hooks v7 compiler-era rules — too strict outside React Compiler setups
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
    },
  },
];
