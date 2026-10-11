import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "@roi-calculator/catalog";
import {
  DEMO_PROJECTS, PROJECT_TYPES, ProjectSchema, buildLedger, compareScenarios, computeAllocation, computeRoi, currentStateRows, demoProjectJson, evaluateLevers,
  migrateProject, pricesUsedRows, projectIssues, projectTypes, resourceCostRows, roiOptions, scorecardRows, summarize, usesAi,
} from "../src/index.js";

const cat = loadCatalog();
const examples = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "examples");

describe("demo projects", () => {
  it("cover each of the six project types at least once", () => {
    const types = new Set(DEMO_PROJECTS.map((d) => d.type));
    for (const t of PROJECT_TYPES) expect(types.has(t), t).toBe(true);
    expect(DEMO_PROJECTS.length).toBeGreaterThanOrEqual(6);
  });

  it("have unique ids and file names", () => {
    expect(new Set(DEMO_PROJECTS.map((d) => d.id)).size).toBe(DEMO_PROJECTS.length);
    expect(new Set(DEMO_PROJECTS.map((d) => d.file)).size).toBe(DEMO_PROJECTS.length);
  });

  for (const d of DEMO_PROJECTS) {
    describe(d.label, () => {
      const parsed = ProjectSchema.safeParse(d.make());
      const p = parsed.success ? parsed.data : undefined;

      it("is valid and every id it points at exists", () => {
        expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))).toBe(true);
        expect(projectIssues(p!)).toEqual([]);
      });

      it("is the type it claims to be, and uses AI only when it is the AI example", () => {
        expect(projectTypes(p!)).toContain(d.type);
        expect(usesAi(p!)).toBe(d.type === "ai");
      });

      it("has the file in examples/ written from this definition", () => {
        const text = readFileSync(join(examples, `${d.file}.aicost.json`), "utf8");
        expect(text, "run `pnpm examples`").toBe(demoProjectJson(d));
        // The file opens the way the app opens it: migrate, then validate.
        expect(ProjectSchema.safeParse(migrateProject(JSON.parse(text))).success).toBe(true);
      });

      it("prices every resource from the catalogue with no missing SKU or price", () => {
        const ledger = buildLedger(p!, cat);
        const problems = ledger.notes.filter((n) => n.kind === "resource" || n.kind === "unavailable" || n.kind === "retired" || n.kind === "deprecated");
        // A dev/test rate that does not exist for a disk or vault falls back to pay-as-you-go; that is a notice, not a missing price.
        expect(problems.map((n) => n.message).filter((m) => !m.includes("no dev/test price"))).toEqual([]);
        expect((p!.resources ?? []).length).toBeGreaterThan(0);
        for (const r of resourceCostRows(p!, ledger)) {
          const free = p!.resources!.find((x) => x.id === r.resourceId)?.skuId === "free";
          if (!free) expect(r.monthly, r.resourceId).toBeGreaterThan(0);
        }
      });

      it("has named people, delivery phases, environments and delivery costs", () => {
        expect(p!.build.team.length).toBeGreaterThanOrEqual(8);
        expect(p!.build.team.every((t) => t.name && t.name.length > 0)).toBe(true);
        expect(p!.timeline.phases?.length).toBeGreaterThanOrEqual(6);
        expect(p!.environments?.some((e) => e.production)).toBe(true);
        expect(p!.environments?.some((e) => !e.production)).toBe(true);
        expect((p!.build.deliveryCosts ?? []).length).toBeGreaterThanOrEqual(3);
        for (const t of p!.build.team) expect(p!.rateCard.some((r) => r.id === t.roleId), t.roleId).toBe(true);
      });

      it("uses Key Vault and Azure storage", () => {
        const types = new Set((p!.resources ?? []).map((r) => r.typeId));
        expect(types.has("key-vault")).toBe(true);
        expect(types.has("blob-storage")).toBe(true);
      });

      it("builds a ledger, a payback inside the plan and the same figures in the summary", () => {
        const ledger = buildLedger(p!, cat);
        const roi = computeRoi(ledger, p!.roi.basis, p!.roi.discountRatePct, roiOptions(p!));
        const s = summarize(p!, ledger, roi, cat);
        expect(s.build).toBeGreaterThan(100_000);
        expect(s.steadyStateAnnualRun).toBeGreaterThan(0);
        expect(s.benefitPerYear).toBeGreaterThan(0);
        expect(s.paysBackWithinPlan).toBe(true);
        expect(s.paybackMonth!).toBeGreaterThan(p!.timeline.buildMonths);
        expect(Number.isFinite(s.npv)).toBe(true);
        expect(s.currentLineCount).toBeGreaterThan(0);
        expect(s.scorecard?.count).toBeGreaterThanOrEqual(4);
        expect(s.irrPct).not.toBeNull();
      }, 30_000);

      it("has no benefit counted twice: current-state lines and capabilities cover different things", () => {
        // A people line and a time-saved capability for the same role are the usual double count; the demos use one or the other.
        const lineRoles = new Set((p!.currentState?.lines ?? []).filter((l) => l.basis.kind === "fte").map((l) => (l.basis as { roleId: string }).roleId));
        for (const c of p!.benefits.capabilities) expect(lineRoles.has(c.roleId), `${c.id} and a current-state line both use role ${c.roleId}`).toBe(false);
      });

      it("runs every scenario, the allocation, levers and the report tables without error", () => {
        const results = compareScenarios(p!, cat);
        expect(results.length).toBe(p!.scenarios.length + 1);
        for (const r of results) expect(r.error, r.label).toBeUndefined();
        const ledger = buildLedger(p!, cat);
        expect(computeAllocation(p!, ledger, p!.roi.basis)).toBeTruthy();
        expect(evaluateLevers(p!, cat).length).toBeGreaterThan(0);
        expect(pricesUsedRows(ledger, cat).length).toBeGreaterThan(0);
        expect(currentStateRows(p!).length).toBeGreaterThan(0);
        expect(scorecardRows(p!).length).toBeGreaterThanOrEqual(4);
      }, 30_000);
    });
  }
});
