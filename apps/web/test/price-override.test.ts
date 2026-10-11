import { describe, expect, it } from "vitest";
import { setPriceOverride } from "../lib/infrastructure";

describe("setPriceOverride", () => {
  it("stores a price that differs from the catalogue and drops it when it is put back", () => {
    const p: { settings: { priceOverrides?: Record<string, number> } } = { settings: {} };
    setPriceOverride(p, "di-layout", 7, 10);
    expect(p.settings.priceOverrides).toEqual({ "di-layout": 7 });
    setPriceOverride(p, "di-layout", 10, 10);
    expect(p.settings.priceOverrides).toBeUndefined();
  });
  it("keeps other overrides when one is removed", () => {
    const p = { settings: { priceOverrides: { a: 1, b: 2 } as Record<string, number> } };
    setPriceOverride(p, "a", 5, 5);
    expect(p.settings.priceOverrides).toEqual({ b: 2 });
  });
});
