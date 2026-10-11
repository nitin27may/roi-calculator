import { describe, expect, it } from "vitest";
import { loadCatalog } from "@roi-calculator/catalog";
import { DEMO_PROJECTS, ProjectSchema, buildLedger, costDrivers } from "../src/index.js";

const cat = loadCatalog();

describe("cost drivers", () => {
  for (const d of DEMO_PROJECTS) {
    it(`${d.label}: named drivers explain most of the cost, and the rows add up to the ledger`, () => {
      const p = ProjectSchema.parse(d.make());
      const L = buildLedger(p, cat);
      const rows = costDrivers(L);
      const total = L.months.reduce((t, m) => t + m.lines.reduce((s, l) => s + l.cost, 0), 0);
      expect(rows.reduce((t, r) => t + r.value, 0)).toBeCloseTo(total, 2);
      expect(rows.length).toBeLessThanOrEqual(6);
      const other = rows.find((r) => r.label === "Other")?.value ?? 0;
      expect(other / total, "Other should not dwarf the named drivers").toBeLessThan(0.25);
      expect(rows.filter((r) => r.label === "Building: team labour").length).toBeLessThanOrEqual(1);
    }, 30_000);
  }
});
