import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";

// A registry error is never a clean audit. Retry only temporary service errors;
// genuine findings keep their strict high/critical release gate immediately.
export async function runAudit({
  productionOnly = false,
  execute = spawnSync,
  wait = setTimeout,
  log = console,
} = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = execute(
      "npm",
      [
        "audit",
        "--json",
        "--audit-level=high",
        "--fetch-retries=0",
        "--fetch-timeout=20000",
        ...(productionOnly ? ["--omit=dev"] : []),
      ],
      {
        encoding: "utf8",
        shell: process.platform === "win32",
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    let report;
    try {
      report = JSON.parse(result.stdout);
    } catch {
      /* fail closed below */
    }
    const counts = report?.metadata?.vulnerabilities;
    if (
      !report?.error &&
      counts &&
      Number.isInteger(counts.high) &&
      Number.isInteger(counts.critical)
    ) {
      log.log(
        JSON.stringify({
          scope: productionOnly ? "production" : "all",
          attempt,
          vulnerabilities: counts,
        }),
      );
      for (const [name, finding] of Object.entries(report.vulnerabilities ?? {})) {
        log.log(`${name}: ${finding.severity}`);
      }
      return result.status === 0 && counts.high === 0 && counts.critical === 0 ? 0 : 1;
    }
    const diagnostic = `${report?.error?.code ?? ""} ${report?.error?.summary ?? ""} ${result.stderr ?? ""}`;
    const transient = /\b(?:429|500|502|503|504)\b|ETIMEDOUT|ECONNRESET|EAI_AGAIN/.test(diagnostic);
    log.error(`Audit unavailable (attempt ${attempt}/3); release remains blocked.`);
    if (!transient || attempt === 3) return 1;
    await wait(8000);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runAudit({ productionOnly: process.argv.includes("--omit=dev") });
}
