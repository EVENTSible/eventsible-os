import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { ESLint } from "eslint";

const pluginRequire = createRequire(import.meta.resolve("@next/eslint-plugin-next"));
const { getRootDirs } = pluginRequire("./utils/get-root-dirs.js");

test("Next root discovery retains directory-only single, array and brace globs", () => {
  // Keep disposable fixtures under the checkout; never touch other worktrees.
  const root = mkdtempSync(resolve(".lint-glob-test-"));
  try {
    for (const name of ["one", "two"]) mkdirSync(join(root, "apps", name), { recursive: true });
    mkdirSync(join(root, "apps", "one", "nested"));
    writeFileSync(join(root, "apps", "not-a-directory"), "fixture");
    const normalized = (items) => items.map((p) => p.replaceAll("\\", "/").replace(/\/$/, "")).sort();
    const expected = normalized([join(root, "apps", "one"), join(root, "apps", "two")]);
    assert.deepEqual(getRootDirs({ cwd: root, settings: {} }), [root]);
    for (const rootDir of [join(root, "apps", "*"), [join(root, "apps", "one"), join(root, "apps", "two")], join(root, "apps", "{one,two}")]) {
      assert.deepEqual(normalized(getRootDirs({ cwd: root, settings: { next: { rootDir } } })), expected);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Next no-html-link-for-pages still rejects internal anchors with glob roots", async () => {
  const root = mkdtempSync(resolve(".lint-glob-test-"));
  try {
    mkdirSync(join(root, "apps", "site", "pages"), { recursive: true });
    writeFileSync(join(root, "apps", "site", "pages", "about.js"), "export default function About() { return null; }");
    const plugin = pluginRequire("./index.js");
    const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [{
      files: ["**/*.js"],
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { "@next/next": plugin },
      settings: { next: { rootDir: join(root, "apps", "*") } },
      rules: { "@next/next/no-html-link-for-pages": "error" },
    }] });
    const [bad] = await eslint.lintText('export default function Page() { return <a href="/about">About</a>; }', { filePath: join(root, "component.js") });
    assert.ok(bad.messages.some((m) => m.ruleId === "@next/next/no-html-link-for-pages"));
    const [good] = await eslint.lintText('export default function Page() { return <a href="https://example.invalid">External</a>; }', { filePath: join(root, "component.js") });
    assert.equal(good.errorCount, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
