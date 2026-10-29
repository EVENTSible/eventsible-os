import { spawnSync } from "node:child_process";

const result = spawnSync("npm", ["run", "lint"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

if (result.status === 0) {
  process.exit(0);
}

process.exit(result.status ?? 1);
