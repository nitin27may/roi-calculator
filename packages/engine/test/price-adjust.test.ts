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

describe("your own price for a catalogue unit price", () => {
  const withOverride = (priceOverrides?: Record<string, number>, azureAdjustPct?: number) => new PriceBook(cat, { ...settings(azureAdjustPct), ...(priceOverrides ? { priceOverrides } : {}) });
  it("replaces the catalogue price, is not moved by the Azure adjustment, and leaves other prices alone", () => {
    const list = withOverride();
    const own = withOverride({ "di-layout": 7.25 }, -20);
    expect(own.unitPrice("di-layout")).toBe(7.25);
    expect(own.unitPrice("di-read")).toBeCloseTo(list.unitPrice("di-read") * 0.8, 6);
  });
  it("gives a placeholder price (the custom SaaS seat) a real cost", () => {
    expect(withOverride().unitPrice("saas-seat-custom-seats")).toBe(0);
    expect(withOverride({ "saas-seat-custom-seats": 42 }).unitPrice("saas-seat-custom-seats")).toBe(42);
    const p = ProjectSchema.parse({ ...DEMO_PROJECTS[0]!.make(), resources: [{ id: "s", label: "Tool", typeId: "saas-seat", skuId: "custom", inputs: { seats: 10 }, term: "payg", ahb: false }] });
    const run = (o?: Record<string, number>) => buildLedger({ ...p, settings: { ...p.settings, ...(o ? { priceOverrides: o } : {}) } }, cat).months[p.timeline.buildMonths + 1]!.lines.filter((l) => l.componentId === "resource:s").reduce((t, l) => t + l.cost, 0);
    expect(run()).toBe(0);
    expect(run({ "saas-seat-custom-seats": 42 })).toBeGreaterThan(0);
  });
  it("is refused when negative", () => {
    const p = ProjectSchema.parse(DEMO_PROJECTS[0]!.make());
    expect(ProjectSchema.safeParse({ ...p, settings: { ...p.settings, priceOverrides: { "di-layout": -1 } } }).success).toBe(false);
  });
});
