import { describe, expect, it } from "vitest";
import { DEMO_PROJECTS, buildLedger, buildPlanProject, recipeById } from "../src/index.js";
import { loadCatalog } from "@roi-calculator/catalog";

const build = (values: Record<string, string | number | boolean>) =>
  buildPlanProject({ name: "Auto", deployment: "dataZone", quality: "balanced", batchAllowed: false, build: { people: 0, months: 4 }, devKinds: [], selections: [{ recipeId: "rpa", values, types: ["automation"] }] });

const kinds = (p: ReturnType<typeof build>["project"]) => ({
  types: (p.resources ?? []).map((r) => r.typeId).sort(),
  workloads: p.workloads.map((w) => w.kind + ":" + w.id).sort(),
});

describe("automation is not always RPA", () => {
  it("RPA alone: licence and robot machines", () => {
    const k = kinds(build({ how: "rpa" }).project);
    expect(k.types).toEqual(["vm"]);
    expect(k.workloads).toEqual(["contract:rpa-licence"]);
  });
  it("custom logic alone: no RPA licence and no robot machines", () => {
    const k = kinds(build({ how: "custom" }).project);
    expect(k.types).toEqual(["functions-premium"]);
    expect(k.workloads).toEqual([]);
  });
  it("custom logic can run on Logic Apps", () => {
    expect(kinds(build({ how: "custom", host: "logic" }).project).types).toEqual(["logic-apps-standard"]);
  });
  it("AI alone: per-item model cost on the share of items that need it", () => {
    const p = build({ how: "ai", items: 10_000, aiShare: 20, aiUnit: 0.05 }).project;
    expect(p.resources ?? []).toHaveLength(0);
    expect(p.workloads).toMatchObject([{ kind: "transactionFee", volumePerMonth: 2000, cadPerTxn: 0.05 }]);
  });
  it("a mix adds each approach's own costs", () => {
    const k = kinds(build({ how: "custom,rpa,ai" }).project);
    expect(k.types).toEqual(["functions-premium", "vm"]);
    expect(k.workloads).toHaveLength(2);
  });
  it("questions follow the ticks", () => {
    const qs = recipeById("rpa")!.questions;
    const shown = (how: string) => qs.filter((q) => !q.when || q.when({ how })).map((q) => q.id);
    expect(shown("custom")).toContain("host");
    expect(shown("custom")).not.toContain("licence");
    expect(shown("rpa")).toContain("licence");
    expect(shown("rpa")).not.toContain("aiUnit");
    expect(shown("ai")).toContain("aiUnit");
  });
});

const cat = loadCatalog();
const find = (id: string) => DEMO_PROJECTS.find((d) => d.id === id)!.make();

describe("delivery costs can be left out", () => {
  it("excluding them removes their cost and keeps the items", () => {
    const p = find("funnel-automation");
    const on = buildLedger(p, cat);
    const items = p.build.deliveryCosts!.length;
    expect(items).toBeGreaterThan(0);
    expect(on.months.some((m) => m.lines.some((l) => l.stream === "delivery"))).toBe(true);
    p.build.includeDeliveryCosts = false;
    const off = buildLedger(p, cat);
    expect(off.months.some((m) => m.lines.some((l) => l.stream === "delivery"))).toBe(false);
    expect(off.totals.build).toBeLessThan(on.totals.build);
    expect(p.build.deliveryCosts).toHaveLength(items);
  });
});

describe("AI coding tools: seats, top-up and tokens", () => {
  const withTooling = (extra: Record<string, unknown>) => {
    const p = find("claims-intake-ai");
    p.build.activities = p.build.activities.filter((a) => a.kind !== "tooling");
    p.build.activities.push({ kind: "tooling", id: "tools", label: "AI coding tools", copilotSeatsPerDev: 1, copilotPlan: "copilot-business", codingModelId: "claude-sonnet-5-5", codingTokensPerDevPerDay: { input: 1000, cachedInput: 0, output: 1000 }, workingDays: 21, monthFactors: [1], ...extra } as never);
    return buildLedger(p, cat).months.flatMap((m) => m.lines.filter((l) => l.componentId === "tools"));
  };
  it("a per-developer top-up is its own line", () => {
    const lines = withTooling({ topUpPerDevPerMonthCad: 100, noCodingTokens: true });
    expect(lines.map((l) => l.id.split(":")[1]).filter((x, i, a) => a.indexOf(x) === i).sort()).toEqual(["copilot", "topup"]);
    expect(lines.filter((l) => l.id.endsWith(":topup"))[0]!.unitPrice).toBe(100);
  });
  it("tokens can be left out and are counted by default", () => {
    expect(withTooling({}).some((l) => l.id.endsWith(":coding"))).toBe(true);
    expect(withTooling({ noCodingTokens: true }).some((l) => l.id.endsWith(":coding"))).toBe(false);
  });
});
