import { describe, expect, it } from "vitest";
import { loadCatalog } from "@roi-calculator/catalog";
import { PriceBook, ProjectSchema, blankProject, buildLedger, type Project } from "../src/index.js";

const cat = loadCatalog();
const vm = cat.resourceTypes.find((t) => t.id === "vm")!;

function monthly(term: "payg" | "ri1" | "ri3", ahb: boolean, sku = "d4s-v5-windows"): number {
  const p: Project = ProjectSchema.parse({ ...blankProject("t", "2027-01-01"), resources: [{ id: "r", label: "VM", typeId: "vm", skuId: sku, inputs: { count: 1 }, term, ahb }] });
  const L = buildLedger(p, cat);
  return L.months[p.timeline.buildMonths]!.lines.filter((l) => l.componentId === "resource:r").reduce((t, l) => t + l.cost, 0);
}

describe("Hybrid Benefit with a reserved term (Windows VMs)", () => {
  it("removes the Windows licence part from the reserved price", () => {
    const book = new PriceBook(cat, { azureDeployment: "dataZone", snowflake: { routing: "global", edition: "enterprise" } });
    const id = "vm-d4s-v5-windows-compute";
    const licence = book.unitPrice(id) - book.optionPrice(id, "ahb")!;
    expect(monthly("ri3", true)).toBeCloseTo(book.optionPrice(id, "ri3")! - licence, 4);
    expect(monthly("ri1", true)).toBeCloseTo(book.optionPrice(id, "ri1")! - licence, 4);
  });
  it("is cheaper than either benefit alone, and a Linux VM is unchanged by the flag", () => {
    expect(monthly("ri3", true)).toBeLessThan(monthly("ri3", false));
    expect(monthly("ri3", true)).toBeLessThan(monthly("payg", true));
    expect(monthly("ri3", true, "d4s-v5-linux")).toBeCloseTo(monthly("ri3", false, "d4s-v5-linux"), 6);
  });
  it("never goes below zero and stays above the Linux reserved price for every Windows size", () => {
    const book = new PriceBook(cat, { azureDeployment: "dataZone", snowflake: { routing: "global", edition: "enterprise" } });
    for (const sku of vm.skus.filter((s) => s.attrs.os === "windows")) {
      const id = sku.prices.compute!;
      const ahb = book.optionPrice(id, "ahb");
      if (ahb === undefined) continue;
      const licence = book.unitPrice(id) - ahb;
      for (const t of ["ri1", "ri3"] as const) {
        const ri = book.optionPrice(id, t);
        if (ri === undefined) continue;
        expect(ri - licence, `${sku.id} ${t}`).toBeGreaterThan(0);
        expect(ri - licence, `${sku.id} ${t} should be under the Linux pay-as-you-go price`).toBeLessThan(ahb);
      }
    }
  });
});

describe("Hybrid Benefit where the catalogue has no price (SQL Managed Instance)", () => {
  const mi = (ahb: boolean, ahbSavingPct?: number, term: "payg" | "ri1" = "payg"): number => {
    const p: Project = ProjectSchema.parse({ ...blankProject("t", "2027-01-01"), resources: [{ id: "r", label: "MI", typeId: "sql-mi", skuId: "gp-gen5", inputs: { vcores: 8, storageGB: 500 }, term, ahb, ...(ahbSavingPct !== undefined ? { ahbSavingPct } : {}) }] });
    const L = buildLedger(p, cat);
    const lines = L.months[p.timeline.buildMonths]!.lines.filter((l) => l.componentId === "resource:r");
    return lines.find((l) => l.meter.endsWith("-compute"))!.cost;
  };
  it("takes the stated saving off compute only, and nothing when none is stated", () => {
    expect(mi(true, 40)).toBeCloseTo(mi(false) * 0.6, 4);
    expect(mi(true)).toBeCloseTo(mi(false), 6);
    expect(mi(false, 40)).toBeCloseTo(mi(false), 6);
  });
  it("applies on top of a reserved price too", () => {
    expect(mi(true, 25, "ri1")).toBeCloseTo(mi(false, undefined, "ri1") * 0.75, 4);
  });
  it("leaves storage at the catalogue price", () => {
    const run = (s?: number) => {
      const p: Project = ProjectSchema.parse({ ...blankProject("t", "2027-01-01"), resources: [{ id: "r", label: "MI", typeId: "sql-mi", skuId: "gp-gen5", inputs: { vcores: 8, storageGB: 500 }, term: "payg", ahb: true, ...(s ? { ahbSavingPct: s } : {}) }] });
      return buildLedger(p, cat).months[p.timeline.buildMonths]!.lines.find((l) => l.componentId === "resource:r" && l.meter.endsWith("-storage"))!.cost;
    };
    expect(run(40)).toBeCloseTo(run(), 6);
  });
});
