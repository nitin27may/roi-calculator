import { describe, expect, it } from "vitest";
import { loadCatalog } from "@roi-calculator/catalog";
import { DEMO_PROJECTS, ProjectSchema, buildLedger, computeRoi, planChecks, roiOptions, type Project } from "../src/index.js";

const cat = loadCatalog();
const checks = (p: Project) => { const L = buildLedger(p, cat); return planChecks(p, L, computeRoi(L, p.roi.basis, p.roi.discountRatePct, roiOptions(p))); };
const demo = (id: string) => ProjectSchema.parse(DEMO_PROJECTS.find((d) => d.id === id)!.make());
const ids = (p: Project) => checks(p).map((c) => c.id);

describe("plan checks", () => {
  it("raise nothing alarming on the worked examples", () => {
    for (const d of DEMO_PROJECTS) {
      const warn = checks(ProjectSchema.parse(d.make())).filter((c) => c.severity === "warn");
      expect(warn.map((c) => `${d.id}: ${c.message}`), d.id).toEqual([]);
    }
  }, 120_000);

  it("catches a project with no team", () => {
    const p = demo("claims-stp"); p.build.team = [];
    expect(ids(p)).toContain("no-team");
  });
  it("catches the same people saved twice (current-state line and a time-saved capability)", () => {
    const p = demo("claims-stp");
    p.benefits.capabilities.push({ id: "cap-x", label: "Clerk time", roleId: "claimsClerk", workloadIds: [], workstreamIds: [], hoursSavedPerMonth: 10 });
    expect(ids(p)).toContain("double-count:cap-x");
  });
  it("catches benefits far larger than the cost", () => {
    const p = demo("claims-stp");
    p.benefits.oneOff.push({ id: "big", label: "Huge", amount: 500_000_000, month: p.timeline.buildMonths + 2 });
    expect(ids(p)).toContain("benefit-ratio");
  });
  it("catches payback inside the build", () => {
    const p = demo("claims-stp");
    p.benefits.oneOff.push({ id: "early", label: "Early windfall", amount: 50_000_000, month: 1 });
    expect(ids(p)).toContain("payback-early");
  });
  it("notes full adoption, zero discount rate, zero contingency and an unassumed decommission", () => {
    const p = demo("claims-migration");
    p.roi.adoptionPct = 100; p.roi.discountRatePct = 0; p.build.contingencyPct = 0;
    p.currentState!.lines[0]!.decommission = { conditional: true, condition: "x", assumed: false };
    const got = ids(p);
    for (const id of ["full-adoption", "no-discount", "no-contingency", "not-decommissioned"]) expect(got, id).toContain(id);
  });
  it("lists warnings before notes", () => {
    const p = demo("claims-stp"); p.build.team = []; p.roi.discountRatePct = 0;
    const sev = checks(p).map((c) => c.severity);
    expect(sev.indexOf("info")).toBeGreaterThan(sev.lastIndexOf("warn"));
  });
});
