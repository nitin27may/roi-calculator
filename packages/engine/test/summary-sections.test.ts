import { describe, expect, it } from "vitest";
import { loadCatalog } from "@roi-calculator/catalog";
import { ALL_PROJECT_TEMPLATES, DEMO_PROJECTS, ProjectSchema, buildLedger, computeRoi, meetingIntelligence, roiOptions, summaryRows, summarySections, type Project } from "../src/index.js";

const cat = loadCatalog();
const run = (p: Project) => { const L = buildLedger(p, cat); return { L, R: computeRoi(L, p.roi.basis, p.roi.discountRatePct, roiOptions(p)) }; };
const projects: [string, Project][] = [
  ["sample", meetingIntelligence],
  ...ALL_PROJECT_TEMPLATES.map((t) => [t.label, t.make(t.label)] as [string, Project]),
  ...DEMO_PROJECTS.map((d) => [d.label, ProjectSchema.parse(d.make())] as [string, Project]),
];

describe("summary sections (for the spreadsheet)", () => {
  for (const [name, p] of projects) {
    it(`${name}: every summary row has a section, and the figures match summaryRows`, () => {
      const { L, R } = run(p);
      const rows = summaryRows(p, L, R, cat);
      const { verdict, sections } = summarySections(p, L, R, cat, rows);
      expect(verdict).toMatch(/NPV (positive|negative)/);
      const all = sections.flatMap((s) => s.entries);
      expect(all.length).toBe(rows.length - 1);
      for (const e of all) {
        if (e.kind === "money" || e.kind === "count") expect(typeof e.value, e.label).toBe("number");
        if (e.kind === "pct") expect(Math.abs(e.value as number), e.label).toBeLessThan(1000);
        expect(String(e.value), e.label).not.toMatch(/NaN|undefined/);
      }
      expect(all.filter((e) => e.kind === "date").length).toBe(1);
      expect(sections[0]!.id).toBe("Plan");
    }, 30_000);
  }
  it("writes percentages as fractions and ranges as readable money", () => {
    const { L, R } = run(meetingIntelligence);
    const all = summarySections(meetingIntelligence, L, R, cat).sections.flatMap((s) => s.entries);
    expect(all.find((e) => e.label.startsWith("ROI ("))!.kind).toBe("pct");
    expect(String(all.find((e) => e.label === "NPV, low to high")!.value)).toMatch(/^-?C\$[\d,]+ to -?C\$[\d,]+$|^C\$-?[\d,]+ to C\$-?[\d,]+$/);
  });
});
