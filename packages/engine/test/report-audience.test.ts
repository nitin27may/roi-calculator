import { describe, expect, it } from "vitest";
import { loadCatalog } from "@roi-calculator/catalog";
import { DEMO_PROJECTS, ProjectSchema, REPORT_AUDIENCES, buildLedger, infrastructureReport, showsSection, teamPlan, type ReportSection } from "../src/index.js";

const cat = loadCatalog();
const SECTIONS: ReportSection[] = ["exec", "assumptions", "workloads", "currentState", "scorecard", "range", "monthly", "cumulative", "build", "production", "byYear", "capability", "scenarios", "levers", "watchouts", "infrastructure", "team"];

describe("report audiences", () => {
  it("the full report shows every section and each audience shows some but not all", () => {
    for (const s of SECTIONS) expect(showsSection("all", s)).toBe(true);
    for (const a of REPORT_AUDIENCES.filter((x) => x.id !== "all")) {
      const n = SECTIONS.filter((s) => showsSection(a.id, s)).length;
      expect(n, a.id).toBeGreaterThan(1);
      expect(n, a.id).toBeLessThan(SECTIONS.length);
    }
  });
  it("every section reaches at least one named audience", () => {
    for (const s of SECTIONS) expect(REPORT_AUDIENCES.some((a) => a.id !== "all" && showsSection(a.id, s)), s).toBe(true);
  });
  it("only technology reads the infrastructure table and only delivery the team plan", () => {
    expect(REPORT_AUDIENCES.filter((a) => a.id !== "all" && showsSection(a.id, "infrastructure")).map((a) => a.id)).toEqual(["tech"]);
    expect(REPORT_AUDIENCES.filter((a) => a.id !== "all" && showsSection(a.id, "team")).map((a) => a.id)).toEqual(["delivery"]);
  });

  for (const d of DEMO_PROJECTS) {
    it(`${d.label}: the team plan adds up to the labour in the ledger and the infrastructure table to the resource cost`, () => {
      const p = ProjectSchema.parse(d.make());
      const ledger = buildLedger(p, cat);
      const plan = teamPlan(p, ledger);
      const labour = ledger.months.reduce((t, m) => t + m.byStream.labour, 0);
      expect(plan.rows.length).toBe(p.build.team.length);
      expect(plan.total).toBeCloseTo(labour, 2);
      const infra = infrastructureReport(p, ledger, cat);
      expect(infra.rows.length).toBe(p.resources!.length);
      expect(infra.total).toBeGreaterThan(0);
      for (const r of infra.rows) expect(Object.keys(r.perEnv).length, r.id).toBeGreaterThan(0);
    }, 30_000);
  }
});
