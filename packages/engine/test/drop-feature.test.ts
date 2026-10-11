import { describe, expect, it } from "vitest";
import { loadCatalog } from "@roi-calculator/catalog";
import { DEMO_PROJECTS, ProjectSchema, applyScenario, buildLedger, projectIssues } from "../src/index.js";

const cat = loadCatalog();

describe("leave out a feature (scenario)", () => {
  for (const d of DEMO_PROJECTS) {
    const p = ProjectSchema.parse(d.make());
    for (const f of p.features) {
      it(`${d.label}: leaving out "${f.label}" gives a valid, cheaper project with nothing left pointing at it`, () => {
        const q = applyScenario(p, { id: "x", label: "x", edits: [{ kind: "dropFeature", featureId: f.id }] }, cat);
        expect(projectIssues(q)).toEqual([]);
        expect(q.features.some((x) => x.id === f.id)).toBe(false);
        const owns = (x: { featureId?: string }) => x.featureId === f.id;
        expect([...q.workloads, ...(q.resources ?? []), ...q.build.workstreams, ...q.build.activities, ...q.benefits.capabilities, ...q.benefits.value, ...(q.benefits.scorecard ?? []), ...(q.currentState?.lines ?? [])].filter(owns)).toEqual([]);
        const total = (x: typeof p) => buildLedger(x, cat).totals;
        expect(total(q).build + total(q).runRate).toBeLessThanOrEqual(total(p).build + total(p).runRate + 1);
      }, 30_000);
    }
  }
  it("is a no-op for a feature that does not exist", () => {
    const p = ProjectSchema.parse(DEMO_PROJECTS[0]!.make());
    const q = applyScenario(p, { id: "x", label: "x", edits: [{ kind: "dropFeature", featureId: "nope" }] }, cat);
    expect(q.workloads.length).toBe(p.workloads.length);
  });
});
