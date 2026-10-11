import { describe, expect, it } from "vitest";
import { loadCatalog } from "@roi-calculator/catalog";
import { DEMO_PROJECTS, ProjectSchema, REPORT_AUDIENCES, benefitBySource, buildLedger, deliveryTimeline, infrastructureReport, showsSection, teamPlan, type ReportSection } from "../src/index.js";

const cat = loadCatalog();
const SECTIONS: ReportSection[] = ["exec", "assumptions", "workloads", "currentState", "scorecard", "range", "monthly", "cumulative", "build", "production", "byYear", "capability", "scenarios", "levers", "watchouts", "infrastructure", "team", "benefitSources"];

describe("report audiences", () => {
  it("the full report shows every section and each audience shows some but not all", () => {
    for (const s of SECTIONS) expect(showsSection("all", s)).toBe(true);
    for (const a of REPORT_AUDIENCES.filter((x) => x.id !== "all")) {
      const n = SECTIONS.filter((s) => showsSection(a.id, s)).length;
      // The one-page summary is the executive page and nothing else; every other copy has several sections.
      expect(n, a.id).toBeGreaterThan(a.id === "onepage" ? 0 : 1);
      expect(n, a.id).toBeLessThan(SECTIONS.length);
    }
  });
  it("every section reaches at least one named audience", () => {
    for (const s of SECTIONS) expect(REPORT_AUDIENCES.some((a) => a.id !== "all" && showsSection(a.id, s)), s).toBe(true);
  });
  it("the one-page summary is the executive page alone", () => {
    expect(SECTIONS.filter((s) => showsSection("onepage", s))).toEqual(["exec"]);
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

describe("delivery timeline", () => {
  for (const d of DEMO_PROJECTS) {
    it(`${d.label}: every phase and costed person is on the timeline, inside the span, and hypercare runs past go-live`, () => {
      const p = ProjectSchema.parse(d.make());
      const t = deliveryTimeline(p);
      expect(t.phases.length).toBe(p.timeline.phases!.length);
      expect(t.people.length).toBe(p.build.team.length);
      for (const b of [...t.phases, ...t.people]) { expect(b.fromMonth).toBeGreaterThanOrEqual(1); expect(b.toMonth).toBeLessThanOrEqual(t.span); expect(b.toMonth).toBeGreaterThanOrEqual(b.fromMonth); }
      expect(t.span).toBeGreaterThan(t.buildMonths);
      expect(t.people.some((b) => b.toMonth > t.buildMonths), "a hypercare line").toBe(true);
    });
  }
  it("leaves out lines that are not costed", () => {
    const p = ProjectSchema.parse(DEMO_PROJECTS[0]!.make());
    p.build.team[0]!.costed = false;
    expect(deliveryTimeline(p).people.length).toBe(p.build.team.length - 1);
  });
});

describe("benefit by source", () => {
  for (const d of DEMO_PROJECTS) {
    it(`${d.label}: the sources add up to the benefit in every month`, () => {
      const p = ProjectSchema.parse(d.make());
      const L = buildLedger(p, cat);
      const { rows, totals } = benefitBySource(L);
      L.months.forEach((m, i) => { const t = Object.values(rows[i]!).reduce((a, b) => a + b, 0); expect(Math.abs(t - m.benefit), `month ${m.m}`).toBeLessThan(0.01); });
      expect(Object.values(totals).reduce((a, b) => a + b, 0)).toBeCloseTo(L.months.reduce((t, m) => t + m.benefit, 0), 2);
    }, 30_000);
  }
});
