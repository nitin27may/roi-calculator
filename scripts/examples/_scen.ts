import { loadCatalog } from "@roi-calculator/catalog";
import { DEMO_PROJECTS, ProjectSchema, compareScenarios } from "@roi-calculator/engine";
const cat = loadCatalog();
for (const d of DEMO_PROJECTS) {
  const p = ProjectSchema.parse(d.make());
  const r = compareScenarios(p, cat);
  console.log(d.id);
  for (const x of r) console.log("  ", x.error ? "ERROR " + x.error : "ok   ", x.label, x.roi.paybackMonth, Math.round(x.roi.npv ?? 0));
}
