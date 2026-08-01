import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const productionRef = "cplpbzudjprzbnzocirc";
const roots = [".github", "scripts", "supabase", "src/contracts", "docs/integrations"];
const commandRoots = [".github", "scripts"];
const productionMigrationRoot = "supabase/migrations";
const forbiddenSupabaseCommands = [
  /supabase\s+link/i,
  /supabase\s+db\s+push/i,
  /supabase\s+db\s+pull/i,
  /supabase\s+branches?/i,
];
const forbiddenProductionMigrationPatterns = [
  /CI-local Supabase only/i,
  /synthetic-test-focused/i,
  /create\s+table\s+if\s+not\s+exists\s+public\.os_contacts/i,
  /create\s+or\s+replace\s+function\s+public\.os_ingest_builder_submission/i,
];

function filesUnder(path) {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path).flatMap((entry) => filesUnder(join(path, entry)));
}

function isApprovedProductionRefMention(file) {
  return (
    file.endsWith("guard-local-supabase-ci.mjs") ||
    file.endsWith("ecosystem-local-supabase-verify.mjs") ||
    file.endsWith("ecosystem-integration-local-supabase.yml") ||
    /docs[\\/]integrations[\\/]ECOSYSTEM_INTEGRATION_[A-Z0-9_-]+\.md$/.test(file)
  );
}

function isProductionMigration(file) {
  return file === productionMigrationRoot || file.startsWith(`${productionMigrationRoot}/`) || file.startsWith(`${productionMigrationRoot}\\`);
}

const files = roots.flatMap((root) => {
  try {
    return filesUnder(root);
  } catch {
    return [];
  }
});

for (const file of files) {
  if (!/\.(ya?ml|mjs|js|sql|md|toml)$/.test(file)) continue;
  const content = readFileSync(file, "utf8");
  const mayMentionProductionRef = isApprovedProductionRefMention(file);
  if (content.includes(productionRef) && !mayMentionProductionRef) {
    throw new Error(`Production Supabase ref appears outside approved guard/report files: ${file}`);
  }
  if (isProductionMigration(file)) {
    for (const forbidden of forbiddenProductionMigrationPatterns) {
      if (forbidden.test(content)) {
        throw new Error(`CI-local schema pattern appears in production migration path ${file}: ${forbidden}`);
      }
    }
  }
  if (!commandRoots.some((root) => file === root || file.startsWith(`${root}\\`) || file.startsWith(`${root}/`))) continue;
  for (const forbidden of forbiddenSupabaseCommands) {
    if (forbidden.test(content)) {
      throw new Error(`Forbidden Supabase command appears in ${file}: ${forbidden}`);
    }
  }
}

console.log("Local Supabase CI guard passed: no Production ref or remote Supabase commands found.");
