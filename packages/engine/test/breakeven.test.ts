import { describe, expect, it } from "vitest";
import { loadCatalog } from "@roi-calculator/catalog";
import { DEMO_PROJECTS, ProjectSchema, breakEven, breakEvenSentences, applyEdit, buildLedger, computeRoi, roiOptions, type Project } from "../src/index.js";

const cat = loadCatalog();
const npv = (p: Project, L = buildLedger(p, cat)) => computeRoi(L, p.roi.basis, p.roi.discountRatePct, roiOptions(p)).npv;

describe("break-even", () => {
  it("leaves NPV at zero when benefits and costs are moved to their break-even shares", () => {
    const p = ProjectSchema.parse(DEMO_PROJECTS.find((d) => d.id === "claims-stp")!.make());
    const L = buildLedger(p, cat);
    const b = breakEven(p, L, cat);
    expect(b.npv).toBeGreaterThan(0);
    expect(b.benefitPct!).toBeGreaterThan(0);
    expect(b.benefitPct!).toBeLessThan(100);
    expect(b.costPct!).toBeGreaterThan(100);
    const at = (bf: number, cf: number) => computeRoi({ ...L, months: L.months.map((m) => ({ ...m, benefit: m.benefit * bf, byStream: Object.fromEntries(Object.entries(m.byStream).map(([k, v]) => [k, (v as number) * cf])) as typeof m.byStream })) }, p.roi.basis, p.roi.discountRatePct, roiOptions(p)).npv;
    expect(Math.abs(at(b.benefitPct! / 100, 1))).toBeLessThan(5);
    expect(Math.abs(at(1, b.costPct! / 100))).toBeLessThan(5);
  });

  it("finds the longest slip that keeps NPV positive: positive at that slip, not above zero one month later", () => {
    const p = ProjectSchema.parse(DEMO_PROJECTS.find((d) => d.id === "claims-stp")!.make());
    const b = breakEven(p, buildLedger(p, cat), cat);
    expect(b.delayMonths).not.toBeNull();
    const slipped = (d: number) => { const q = applyEdit(p, { kind: "shiftMonths", target: "golive", by: d }, cat); return npv(q); };
    expect(slipped(b.delayMonths!)).toBeGreaterThan(0);
    expect(slipped(b.delayMonths! + 1)).toBeLessThanOrEqual(0);
  });

  it("reads the other way when NPV is already below zero", () => {
    const p = ProjectSchema.parse(DEMO_PROJECTS.find((d) => d.id === "claims-stp")!.make());
    p.currentState = { lines: [] };
    p.benefits.value = [];
    const L = buildLedger(p, cat);
    const b = breakEven(p, L, cat);
    expect(b.npv, "the project with its savings removed should be under water").toBeLessThanOrEqual(0);
    expect(b.benefitPct === null || b.benefitPct > 100).toBe(true);
    expect(b.costPct === null || b.costPct < 100).toBe(true);
    expect(b.delayMonths).toBe(0);
    expect(breakEvenSentences(b).map((x) => x.text).join(" ")).toMatch(/would need|already at or below zero/);
  });

  for (const d of DEMO_PROJECTS) {
    it(`${d.label}: sentences with sensible numbers`, () => {
      const p = ProjectSchema.parse(d.make());
      const b = breakEven(p, buildLedger(p, cat), cat);
      const s = breakEvenSentences(b);
      expect(s.map((x) => x.id).slice(0, 3)).toEqual(["benefit", "cost", "delay"]);
      if (b.delayCostPerMonth !== null && b.delayCostPerMonth > 0) expect(s.at(-1)!.id).toBe("delayCost");
      for (const x of s) expect(x.text).not.toMatch(/NaN|undefined|Infinity/);
      if (b.npv > 0) { expect(b.benefitPct!).toBeLessThan(100); expect(b.costPct!).toBeGreaterThan(100); }
    }, 60_000);
  }
});
