import { readFileSync } from "node:fs";

const [expectedPath, actualPath] = process.argv.slice(2);
if (!expectedPath || !actualPath) {
  throw new Error("Provide the Production-restore and reconstructed catalog paths.");
}

const normalize = (value) => {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalize(child)]),
  );
};

const expected = normalize(JSON.parse(readFileSync(expectedPath, "utf8")));
const actual = normalize(JSON.parse(readFileSync(actualPath, "utf8")));
const differences = [];

function compare(left, right, path = "catalog") {
  if (Object.is(left, right)) return;
  if (typeof left !== typeof right || left === null || right === null) {
    differences.push(path);
    return;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      differences.push(`${path}.length`);
      return;
    }
    left.forEach((value, index) => compare(value, right[index], `${path}[${index}]`));
    return;
  }
  if (typeof left === "object") {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) compare(left[key], right[key], `${path}.${key}`);
    return;
  }
  differences.push(path);
}

compare(expected, actual);
if (differences.length > 0) {
  console.error(`Application schema catalogs differ at ${differences.length} path(s):`);
  for (const path of differences.slice(0, 100)) console.error(`- ${path}`);
  if (differences.length > 100) console.error(`- and ${differences.length - 100} more`);
  process.exitCode = 1;
} else {
  console.log("Application schema catalogs match exactly.");
}
