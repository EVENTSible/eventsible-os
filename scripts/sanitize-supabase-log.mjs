import { readFileSync } from "node:fs";

const [logPath = "supabase-start.log"] = process.argv.slice(2);

let raw = "";
try {
  raw = readFileSync(logPath, "utf8");
} catch (error) {
  console.log(`Unable to read ${logPath}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(0);
}

const interestingPatterns = [
  /failed/i,
  /error/i,
  /fatal/i,
  /panic/i,
  /syntax/i,
  /migration/i,
  /applying/i,
  /database/i,
  /relation .* does not exist/i,
  /function .* does not exist/i,
  /schema .* does not exist/i,
  /type .* does not exist/i,
  /already exists/i,
  /duplicate/i,
  /permission denied/i,
  /policy/i,
  /grant/i,
  /revoke/i,
  /container/i,
  /docker/i,
  /health/i,
  /timeout/i,
  /could not/i,
  /cannot/i,
  /refused/i,
  /connection/i,
  /SQLSTATE/i,
  /pq:/i,
  /psql:/i,
];

const suppressPatterns = [
  /^\s*(anon key|service_role key|jwt secret|db url|database url|api url|graphql url|s3 storage url|studio url|inbucket url|postgres url)\b/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /service[_-]?role/i,
  /anon[_-]?key/i,
  /password\s*[:=]/i,
];

function redact(line) {
  return line
    .replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/https?:\/\/[^\s'"<>]*supabase[^\s'"<>]*/gi, "[REDACTED_SUPABASE_URL]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/\b(?:sbp|sb_secret|supabase)_[A-Za-z0-9_-]{16,}\b/gi, "[REDACTED_TOKEN]")
    .replace(/(?<=password[=:]\s*)[^\s'";]+/gi, "[REDACTED]")
    .replace(/(?<=token[=:]\s*)[^\s'";]+/gi, "[REDACTED]")
    .replace(/(?<=key[=:]\s*)[^\s'";]+/gi, "[REDACTED]")
    .replace(/\b[A-Za-z0-9_-]{48,}\b/g, "[REDACTED_LONG_VALUE]");
}

const lines = raw.split(/\r?\n/);
const selected = [];

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  if (!line.trim()) continue;
  if (!interestingPatterns.some((pattern) => pattern.test(line))) continue;
  if (suppressPatterns.some((pattern) => pattern.test(line))) continue;
  selected.push(`${index + 1}: ${redact(line)}`);
}

console.log("Safe Supabase startup diagnostics:");
if (selected.length === 0) {
  console.log("No matching diagnostic lines were found in the startup log after sanitization.");
  console.log(`Startup log line count: ${lines.length}`);
} else {
  for (const line of selected.slice(-120)) {
    console.log(line);
  }
  if (selected.length > 120) {
    console.log(`... ${selected.length - 120} earlier diagnostic lines omitted by sanitizer.`);
  }
}
