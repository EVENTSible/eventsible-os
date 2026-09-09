import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationRoot = "supabase/migrations";
const manifestPath = "supabase/migration-history.json";
const canonicalOnly = process.argv.includes("--canonical-only");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const migrationFiles = readdirSync(migrationRoot)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (manifest.format !== "eventsible_supabase_migration_history_v1") {
  throw new Error(`Unsupported migration-history manifest: ${manifest.format}`);
}

if (manifest.migrations.length !== 44) {
  throw new Error(`Expected 44 canonical migrations, found ${manifest.migrations.length}.`);
}

const pendingMigrations = manifest.pendingMigrations ?? [];
if (!Array.isArray(pendingMigrations)) {
  throw new Error("Migration-history pendingMigrations must be an array when present.");
}

if (canonicalOnly && pendingMigrations.length > 0) {
  throw new Error(
    `Canonical-only verification found tracked pending migrations: ${pendingMigrations
      .map((migration) => migration.version)
      .join(", ")}`,
  );
}

const expected = new Map(
  [...manifest.migrations, ...pendingMigrations].map((migration) => [
    `${migration.version}_${migration.name}.sql`,
    migration.sha256,
  ]),
);
const versions = migrationFiles.map((file) => file.slice(0, 14));
const duplicateVersions = versions.filter(
  (version, index) => versions.indexOf(version) !== index,
);

if (duplicateVersions.length > 0) {
  throw new Error(`Duplicate migration versions: ${[...new Set(duplicateVersions)].join(", ")}`);
}

const supersededVersions = new Set([
  "20260731000000",
  "20260803223000",
  "20260804003000",
  "20260804013000",
  "20260804153000",
  "20260804181000",
  "20260805170000",
  "20260902004322",
  "20260902050555",
  "20260902172423",
  "20260908045800",
]);
const activeSuperseded = versions.filter((version) => supersededVersions.has(version));
if (activeSuperseded.length > 0) {
  throw new Error(`Superseded local migration versions are active: ${activeSuperseded.join(", ")}`);
}

for (const [file, expectedHash] of expected) {
  if (!migrationFiles.includes(file)) {
    throw new Error(`Tracked migration is missing: ${file}`);
  }
  const actualHash = createHash("sha256")
    .update(readFileSync(join(migrationRoot, file)))
    .digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`Tracked migration changed: ${file}; expected ${expectedHash}, received ${actualHash}.`);
  }
}

const historicalBoundary = manifest.canonicalThrough;
const unexpectedHistorical = migrationFiles.filter((file) => {
  const version = file.slice(0, 14);
  return version <= historicalBoundary && !expected.has(file);
});
if (unexpectedHistorical.length > 0) {
  throw new Error(`Unexpected migration inside canonical history: ${unexpectedHistorical.join(", ")}`);
}

const untrackedMigrations = migrationFiles.filter((file) => !expected.has(file));
if (untrackedMigrations.length > 0) {
  throw new Error(`Untracked migrations: ${untrackedMigrations.join(", ")}`);
}

console.log(
  `Migration history verified: 44 immutable canonical migrations${
    pendingMigrations.length > 0 ? ` and ${pendingMigrations.length} tracked pending migration(s)` : ""
  }; no duplicate or superseded timestamps.`,
);
