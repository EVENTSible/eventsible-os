# Scoped Next lint glob adapter

This replaces only `@next/eslint-plugin-next@16.4.2`'s `fast-glob` dependency. That pinned plugin imports only `globSync` in `dist/utils/get-root-dirs.js`, passing a string pattern and `onlyDirectories: true`.

The override removes the unpatched `braces`/`micromatch` chain from the install rather than suppressing an advisory or disabling Next lint rules. The adapter delegates to pinned `tinyglobby@0.2.17`, preserves absolute-pattern results, and disables automatic recursive directory expansion to match the existing consumer. It is not a general fast-glob implementation.

The override's `file:../../../tools/next-lint-glob` path is relative to the pinned consumer package at `node_modules/@next/eslint-plugin-next`; the lockfile links it to repository `tools/next-lint-glob`. Clean `npm ci` is part of verification. Node 24.14.1 is the development/CI baseline; the package's engines capture the Node versions supporting synchronous require of this ESM adapter.

`src/contracts/lint-glob-compatibility.test.mjs` verifies default roots, single/array/brace patterns, directory-only matching, no recursive expansion of explicit directories, and actual enforcement of Next's internal-anchor lint rule. Re-review the adapter and caller source when upgrading Next or its lint plugin.

Upstream API: https://superchupu.dev/tinyglobby/documentation
