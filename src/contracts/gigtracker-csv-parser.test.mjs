import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../public/gigtracker-v1.js", import.meta.url), "utf8");
const parser = source.split("\n").find((line) => line.startsWith("function csvRows(file)"));

test("legacy CSV parser compiles and normalizes aliases and unknown headers", async () => {
  let options;
  const csvRows = runInNewContext(`${parser}; csvRows;`, { Papa: { parse: (_file, config) => { options = config; config.complete({ errors: [], data: [{ synthetic: true }] }); } } });
  const data = await csvRows("synthetic.csv");
  assert.equal(data[0].synthetic, true);
  assert.equal(options.transformHeader(" Customer "), "client_name");
  assert.equal(options.transformHeader("Start"), "starts_at");
  assert.equal(options.transformHeader("Custom Header"), "custom_header");
});

test("legacy CSV parser rejects parse errors", async () => {
  const csvRows = runInNewContext(`${parser}; csvRows;`, { Papa: { parse: (_file, config) => config.complete({ errors: [{ message: "Synthetic invalid CSV" }], data: [] }) } });
  await assert.rejects(csvRows("synthetic.csv"), /Synthetic invalid CSV/);
});
