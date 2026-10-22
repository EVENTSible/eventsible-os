import { isAbsolute } from "node:path";
import { globSync as tinyGlobSync } from "tinyglobby";

// Only @next/eslint-plugin-next's get-root-dirs consumer uses this override.
// Preserve fast-glob's directory matching and absolute-pattern output; do not
// offer this as a general fast-glob replacement for other dependencies.
export const globSync = (pattern, options = {}) => tinyGlobSync(pattern, {
  ...options,
  expandDirectories: false,
  absolute: options.absolute ?? isAbsolute(pattern),
});
