import { describe, expect, it } from "vitest";
import { DEMO_PROJECTS, ProjectSchema, computeRoi, roiOptions, summarize } from "@roi-calculator/engine";
import { catalog, ledgerFor } from "../lib/compute";

/**
 * The resource price categories load after the first render. A project that prices a build tool or a seat from one of them
 * (GitHub seats, Power Automate seats) used to crash the page until they arrived. These run before they have.
 */
describe("ledgerFor while the resource prices are still loading", () => {
  for (const d of DEMO_PROJECTS) {
    it(`${d.label} builds a ledger instead of throwing`, () => {
      const p = ProjectSchema.parse(d.make());
      const { ledger, project } = ledgerFor(p);
      expect(ledger.months.length).toBe(p.timeline.horizonMonths);
      expect(ledger.totals.build).toBeGreaterThan(0);
      // Everything derived from it must use the project the ledger was built from, or the summary throws the same error.
      expect(() => summarize(project, ledger, computeRoi(ledger, project.roi.basis, project.roi.discountRatePct, roiOptions(project)), catalog)).not.toThrow();
    }, 30_000);
  }
});
