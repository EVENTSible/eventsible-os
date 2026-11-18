import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url)));
const packages = lock.packages;
const result = spawnSync("npm", ["audit", "--json", "--audit-level=low", "--fetch-retries=0", "--fetch-timeout=20000"],
  { encoding: "utf8", shell: process.platform === "win32", maxBuffer: 8 * 1024 * 1024 });
let audit;
try { audit = JSON.parse(result.stdout); } catch { /* report unavailable below */ }
if (!audit?.metadata?.vulnerabilities || audit.error) throw new Error("Full registry audit unavailable; findings cannot be classified.");

function parentRoutes(name) {
  const parents = [];
  for (const [path, pkg] of Object.entries(packages)) {
    for (const kind of ["dependencies", "devDependencies", "optionalDependencies"]) {
      if (pkg[kind]?.[name]) parents.push({ package: path || "(root)", version: pkg.version ?? lock.version,
        kind, declared: pkg[kind][name] });
    }
  }
  return parents;
}
for (const [name, finding] of Object.entries(audit.vulnerabilities)) {
  const instances = (finding.nodes ?? []).map(path => ({ path, version: packages[path]?.version ?? "unknown",
    scope: packages[path]?.dev ? "development" : "runtime" }));
  const advisories = finding.via.filter(item => typeof item === "object").map(item => ({
    title: item.title, url: item.url, severity: item.severity, affectedRange: item.range,
  }));
  console.log(JSON.stringify({ name, severity: finding.severity, installed: instances,
    parents: parentRoutes(name), affectedRange: finding.range, advisories,
    fixAvailable: finding.fixAvailable, indirectVia: finding.via.filter(item => typeof item === "string") }));
}
console.log(JSON.stringify({ scope: "all", counts: audit.metadata.vulnerabilities }));
