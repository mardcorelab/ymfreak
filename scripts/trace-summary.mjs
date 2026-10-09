// Prints the last steps of each failed Playwright trace as one GitHub annotation (CI logs aren't always readable).
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = "test-results";
if (!existsSync(root)) process.exit(0);
for (const dir of readdirSync(root)) {
  const zip = join(root, dir, "trace.zip");
  if (!existsSync(zip)) continue;
  const out = `/tmp/trace-${dir}`;
  execSync(`rm -rf ${out} && mkdir -p ${out} && unzip -q -o ${zip} -d ${out}`);
  const lines = [];
  for (const f of readdirSync(out).filter((f) => f.endsWith(".trace"))) {
    for (const l of readFileSync(join(out, f), "utf8").split("\n")) {
      if (!l) continue;
      try {
        const e = JSON.parse(l);
        if (e.type === "before") lines.push(`${e.callId} ${e.apiName ?? e.method} ${JSON.stringify(e.params ?? {}).slice(0, 140)}`);
        if (e.type === "after" && e.error) lines.push(`  ✖ ${e.callId} ${String(e.error?.message ?? e.error).slice(0, 200)}`);
        if (e.type === "console" && /error/i.test(e.messageType ?? "")) lines.push(`  console: ${String(e.text).slice(0, 200)}`);
      } catch {}
    }
  }
  const tail = lines.slice(-40).map((l) => l.replace(/%/g, "%25").replace(/\n/g, " ")).join("%0A");
  console.log(`::error title=trace ${dir.slice(0, 60)}::${tail}`);
}
