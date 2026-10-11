/**
 * Prints what the engine makes of a demo project: validation, build and run cost, benefit, payback, NPV, alerts and the
 * biggest resource lines. Used while writing and checking the demo projects.
 *
 *   pnpm tsx scripts/examples/inspect.ts [project id ...]
 */
import { loadCatalog } from "@roi-calculator/catalog";
import { DEMO_PROJECTS, ProjectSchema, buildLedger, computeRoi, resourceCostRows, roiOptions, summarize } from "@roi-calculator/engine";

const cat = loadCatalog();
const want = process.argv.slice(2);
const c = (n: number) => `C$${Math.round(n).toLocaleString("en-CA")}`;
for (const d of DEMO_PROJECTS) {
  if (want.length && !want.includes(d.id)) continue;
  const parsed = ProjectSchema.safeParse(d.make());
  if (!parsed.success) { console.log(`\n## ${d.id}: INVALID`, JSON.stringify(parsed.error.issues.slice(0, 5), null, 1)); continue; }
  const p = parsed.data;
  const ledger = buildLedger(p, cat);
  const roi = computeRoi(ledger, p.roi.basis, p.roi.discountRatePct, roiOptions(p));
  const s = summarize(p, ledger, roi, cat);
  console.log(`\n## ${d.id}: ${p.name}`);
  console.log(`build ${c(s.build)} | run/yr ${c(s.steadyStateAnnualRun)} | benefit/yr ${c(s.benefitPerYear)} | total cost ${c(s.totalCost)} | total benefit ${c(s.totalBenefit)}`);
  console.log(`payback m${s.paybackMonth} (discounted m${s.discountedPaybackMonth}) | ROI ${(s.roi * 100).toFixed(0)}% | NPV ${c(s.npv)} | IRR ${s.irrPct?.toFixed(1)}% | verdict ${s.verdict.text}`);
  const cv = s.currentVsTarget;
  console.log(`current ${c(cv.currentMonthly)}/mo | saving ${c(cv.saving ?? 0)}/mo`, Object.keys(cv).join(","));
  console.log("by stream (build months | first full year):");
  const streams: Record<string, number> = {};
  for (const m of ledger.months.slice(0, p.timeline.buildMonths)) for (const [k, v] of Object.entries(m.byStream)) streams[`build:${k}`] = (streams[`build:${k}`] ?? 0) + (v as number);
  const y1 = ledger.months.slice(p.timeline.buildMonths + 6, p.timeline.buildMonths + 18);
  for (const m of y1) for (const [k, v] of Object.entries(m.byStream)) streams[`y2:${k}`] = (streams[`y2:${k}`] ?? 0) + (v as number);
  console.log(Object.entries(streams).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${c(v)}`).join("  "));
  if (s.alerts.length) console.log("alerts:", s.alerts.map((a) => `${a.label}: ${a.count}`).join("; "));
  if (p.resources?.length) {
    const rows = resourceCostRows(p, ledger).sort((a, b) => b.monthly - a.monthly);
    console.log("top resources (monthly across environments):");
    for (const r of rows.slice(0, 8)) console.log(`  ${c(r.monthly).padStart(10)}  ${p.resources!.find((x) => x.id === r.resourceId)?.label}${r.notes.length ? "  [" + r.notes[0] + "]" : ""}`);
  }
  if (process.env.VERBOSE) { console.log(JSON.stringify(s.range, null, 1)); }
}
