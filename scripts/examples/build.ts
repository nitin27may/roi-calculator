/**
 * Writes the demo projects to examples/ as project files you can open in the app ("Open file as new project"), and
 * rewrites the table in examples/README.md from what the engine computes. Run after changing a demo project:
 *
 *   pnpm examples
 *
 * `pnpm examples --check` writes nothing and fails when a file is out of date (CI uses the same comparison in a test).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "@roi-calculator/catalog";
import { DEMO_PROJECTS, ProjectSchema, buildLedger, computeRoi, demoProjectJson, roiOptions, summarize } from "@roi-calculator/engine";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = join(root, "examples");
const check = process.argv.includes("--check");
const cat = loadCatalog();
const c = (n: number) => `C$${Math.round(n).toLocaleString("en-CA")}`;
const m = (n: number) => `C$${(n / 1_000_000).toFixed(2)}M`;

mkdirSync(dir, { recursive: true });
let stale = 0;
const rows: string[] = [];
for (const d of DEMO_PROJECTS) {
  const parsed = ProjectSchema.parse(d.make());
  const json = demoProjectJson(d);
  const path = join(dir, `${d.file}.aicost.json`);
  if (!existsSync(path) || readFileSync(path, "utf8") !== json) {
    stale++;
    if (!check) writeFileSync(path, json);
    console.log(`${check ? "out of date" : "wrote"}: examples/${d.file}.aicost.json`);
  }
  const ledger = buildLedger(parsed, cat);
  const roi = computeRoi(ledger, parsed.roi.basis, parsed.roi.discountRatePct, roiOptions(parsed));
  const s = summarize(parsed, ledger, roi, cat);
  rows.push(`| ${d.label} | ${d.type} | ${parsed.timeline.buildMonths} | ${m(s.build)} | ${c(s.steadyStateAnnualRun / 12)} | ${c(s.benefitPerYear / 12)} | ${s.paybackMonth ? `month ${s.paybackMonth}` : "no payback"} | ${m(s.npv)} | ${s.irrPct === null ? "n/a" : `${s.irrPct.toFixed(0)}%`} |`);
}

const readme = join(dir, "README.md");
const start = "<!-- results:start -->", end = "<!-- results:end -->";
const table = `${start}\n| Project | Type | Build (months) | Build cost | Run per month | Benefit per month | Payback | NPV at 8% | IRR |\n|---|---|---|---|---|---|---|---|---|\n${rows.join("\n")}\n${end}`;
if (existsSync(readme)) {
  const text = readFileSync(readme, "utf8");
  const next = text.includes(start) ? text.replace(new RegExp(`${start}[\\s\\S]*${end}`), table) : text;
  if (next !== text) { stale++; if (!check) writeFileSync(readme, next); console.log(`${check ? "out of date" : "wrote"}: examples/README.md`); }
}
if (check && stale) { console.error("Run `pnpm examples` and commit the result."); process.exit(1); }
console.log(stale ? "" : "Examples are up to date.");
