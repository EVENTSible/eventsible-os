import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const productionRef = "cplpbzudjprzbnzocirc";
const roots = [".github", "scripts", "supabase", "src/contracts", "docs/integrations"];
const commandRoots = [".github", "scripts"];
const productionMigrationRoot = "supabase/migrations";
const historicalBuilderWiringMigration = "20260803223000_builder_submission_outbox_wiring.sql";
const historicalBuilderQuoteLookupMigration = "20260804003000_builder_submission_outbox_quote_lookup_fix.sql";
const outboxHelperGrantPattern = /grant\s+execute\s+on\s+function\s+public\.os_enqueue_integration_event\s*\(\s*text\s*,\s*text\s*,\s*text\s*,\s*jsonb\s*,\s*jsonb\s*,\s*text\s*\)\s+to\s+(public|anon|authenticated)\b/i;
const builderWiringGrantPattern = /grant\s+execute\s+on\s+function\s+public\.os_enqueue_builder_submission_received_from_activity\s*\(\s*\)\s+to\s+(public|anon|authenticated)\b/i;
const builderQuoteIdPhysicalReferencePattern = /(\bq|\bos_quote_versions)\.quote_id\b/i;
const builderActivityQuoteIdPromotionPattern = /quote_id_value\s*:=\s*coalesce\s*\([^;]*activity_quote_id_value/is;
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
  /drop\s+table/i,
  /truncate\s+table/i,
  /delete\s+from\s+public\.os_(contacts|builder_submissions|leads|events|quote_versions|quote_items|bookings)\b/i,
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
    file.endsWith("verify-outbox-helper-grants.mjs") ||
    file.endsWith("verify-builder-outbox-production-quote-shape.mjs") ||
    file.endsWith("verify-builder-event-staff-label.mjs") ||
    file.endsWith("ecosystem-integration-local-supabase.yml") ||
    /docs[\\/]integrations[\\/](ECOSYSTEM|BUILDER_OUTBOX)_[A-Z0-9_-]+\.md$/.test(file)
  );
}

function isProductionMigration(file) {
  return file === productionMigrationRoot || file.startsWith(`${productionMigrationRoot}/`) || file.startsWith(`${productionMigrationRoot}\\`);
}

function isHistoricalBuilderWiringMigration(file) {
  return file.endsWith(historicalBuilderWiringMigration);
}

function isHistoricalBuilderQuoteLookupMigration(file) {
  return file.endsWith(historicalBuilderQuoteLookupMigration);
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
        throw new Error(`Forbidden production migration pattern appears in ${file}: ${forbidden}`);
      }
    }
    if (outboxHelperGrantPattern.test(content)) {
      throw new Error(`Outbox helper must not be granted to public, anon, or authenticated in ${file}.`);
    }
    if (builderWiringGrantPattern.test(content)) {
      throw new Error(`Builder outbox wiring function must not be granted to public, anon, or authenticated in ${file}.`);
    }
    if (!isHistoricalBuilderWiringMigration(file) && builderQuoteIdPhysicalReferencePattern.test(content)) {
      throw new Error(`Builder outbox quote lookup must not directly reference a physical quote_id column in ${file}.`);
    }
    if (!isHistoricalBuilderQuoteLookupMigration(file) && builderActivityQuoteIdPromotionPattern.test(content)) {
      throw new Error(`Builder outbox related quote_id must not be derived from activity quote_id in ${file}.`);
    }
  }
  if (!commandRoots.some((root) => file === root || file.startsWith(`${root}\\`) || file.startsWith(`${root}/`))) continue;
  for (const forbidden of forbiddenSupabaseCommands) {
    if (forbidden.test(content)) {
      throw new Error(`Forbidden Supabase command appears in ${file}: ${forbidden}`);
    }
  }
}

console.log("Local Supabase CI guard passed: no Production ref, remote Supabase commands, unsafe migration patterns, public outbox-helper grants, unsafe Builder quote lookup references, or activity quote_id promotion found.");
