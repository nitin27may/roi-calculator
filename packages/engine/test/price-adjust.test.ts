import { describe, expect, it } from "vitest";
import { loadCatalog } from "@roi-calculator/catalog";
import { DEMO_PROJECTS, PriceBook, ProjectSchema, buildLedger } from "../src/index.js";

const cat = loadCatalog();
const settings = (azureAdjustPct?: number) => ({ azureDeployment: "dataZone" as const, snowflake: { routing: "global" as const, edition: "enterprise" as const }, ...(azureAdjustPct !== undefined ? { azureAdjustPct } : {}) });

describe("Azure price adjustment", () => {
  it("scales token, embedding, speech and unit prices, and leaves Snowflake and a zero setting alone", () => {
    const list = new PriceBook(cat, settings()), cut = new PriceBook(cat, settings(-12)), zero = new PriceBook(cat, settings(0));
    expect(cut.tokenPrices("gpt-6-sol", "2027-03-01").input).toBeCloseTo(list.tokenPrices("gpt-6-sol", "2027-03-01").input * 0.88, 6);
    expect(cut.embeddingPer1M("text-embedding-3-large")).toBeCloseTo(list.embeddingPer1M("text-embedding-3-large") * 0.88, 6);
    expect(cut.unitPrice("di-layout")).toBeCloseTo(list.unitPrice("di-layout") * 0.88, 6);
    expect(cut.optionPrice("vm-d4s-v5-windows-compute", "ahb")!).toBeCloseTo(list.optionPrice("vm-d4s-v5-windows-compute", "ahb")! * 0.88, 6);
    expect(cut.tokenPrices("sf:claude-sonnet-5-5", "2027-03-01")).toEqual(list.tokenPrices("sf:claude-sonnet-5-5", "2027-03-01"));
    expect(cut.unitPrice("sf-ai-classify")).toBe(list.unitPrice("sf-ai-classify"));
    expect(zero.tokenPrices("gpt-6-sol", "2027-03-01")).toEqual(list.tokenPrices("gpt-6-sol", "2027-03-01"));
  });

  it("lowers a project's production cost by about the same share, and only the Azure part of a Snowflake project", () => {
    for (const id of ["claims-replatform", "claims-notes-snowflake"]) {
      const p = ProjectSchema.parse(DEMO_PROJECTS.find((d) => d.id === id)!.make());
      const base = buildLedger(p, cat).totals.runRate;
      const cut = buildLedger({ ...p, settings: { ...p.settings, azureAdjustPct: -20 } }, cat).totals.runRate;
      expect(cut, id).toBeLessThan(base);
      if (id === "claims-replatform") expect(cut / base).toBeGreaterThan(0.75), expect(cut / base).toBeLessThan(0.9);
    }
  });

  it("is refused outside -90% to +200%", () => {
    const p = ProjectSchema.parse(DEMO_PROJECTS[0]!.make());
    expect(ProjectSchema.safeParse({ ...p, settings: { ...p.settings, azureAdjustPct: -95 } }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...p, settings: { ...p.settings, azureAdjustPct: -12 } }).success).toBe(true);
  });
});
