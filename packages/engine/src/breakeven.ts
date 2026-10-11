import type { Catalog } from "@roi-calculator/catalog";
import { buildLedger, type Ledger } from "./ledger.js";
import type { Project } from "./project.js";
import { computeRoi, roiOptions } from "./roi.js";
import { applyEdit } from "./scenarios.js";

/**
 * What must be true for the project to just break even: how far benefits can fall, costs can rise or go-live can slip before NPV
 * reaches zero, on the project's own cost basis and discount rate. Each is solved on its own with the others as entered, so they are
 * margins of safety, not a forecast, and they do not add up.
 */
export interface BreakEven {
  /** NPV as entered. At or below zero the project is already past break-even and the margins read the other way. */
  npv: number;
  /** Benefits as a share of the expected benefits at which NPV is zero, in percent. Below 100 is a margin; above 100 is what is missing. Null when no share up to 1,000% gets there. */
  benefitPct: number | null;
  /** Costs as a share of the expected costs at which NPV is zero, in percent. Above 100 is a margin; below 100 is what must be saved. Null when costs of zero still leave NPV below zero. */
  costPct: number | null;
  /** Months go-live can slip before NPV reaches zero: 0 when NPV is already at or below zero, null when it is still positive after the longest slip tried. */
  delayMonths: number | null;
  /** The longest slip tried, so "null" can be said plainly. */
  maxDelay: number;
  /** What one month's slip in go-live costs in NPV (a positive number), from moving go-live by one month; null when that cannot be worked out. */
  delayCostPerMonth: number | null;
}

export const MAX_DELAY_MONTHS = 24;

/** The ledger with every benefit multiplied by `b` and every cost by `c`. */
function scaled(L: Ledger, b: number, c: number): Ledger {
  return {
    ...L,
    months: L.months.map((m) => ({
      ...m, benefit: m.benefit * b,
      byStream: Object.fromEntries(Object.entries(m.byStream).map(([k, v]) => [k, (v as number) * c])) as typeof m.byStream,
    })),
  };
}

/** Bisection on a function that only rises with its argument: the argument where it crosses zero, or null if it never does inside [lo, hi]. */
function rootOfRising(f: (x: number) => number, lo: number, hi: number): number | null {
  if (f(hi) < 0) return null;
  if (f(lo) >= 0) return lo;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) >= 0) hi = mid; else lo = mid;
  }
  return hi;
}

export function breakEven(p: Project, ledger: Ledger, cat: Catalog): BreakEven {
  const npvOf = (L: Ledger) => computeRoi(L, p.roi.basis, p.roi.discountRatePct, roiOptions(p)).npv;
  const npv = npvOf(ledger);
  const benefit = rootOfRising((x) => npvOf(scaled(ledger, x, 1)), 0, 10);
  // Costs: NPV falls as costs rise, so solve on the negated factor's complement.
  const costRoot = rootOfRising((x) => npvOf(scaled(ledger, 1, 10 - x)), 0, 10);
  const cost = costRoot === null ? null : 10 - costRoot;
  let delay: number | null;
  if (npv <= 0) delay = 0;
  else {
    const npvAt = (d: number) => npvOf(buildLedger(applyEdit(p, { kind: "shiftMonths", target: "golive", by: d }, cat), cat));
    const safe = (d: number) => { try { return npvAt(d); } catch { return -Infinity; } };
    if (safe(MAX_DELAY_MONTHS) > 0) delay = null;
    else {
      let lo = 0, hi = MAX_DELAY_MONTHS; // NPV is above zero at lo and at or below it at hi
      while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (safe(mid) > 0) lo = mid; else hi = mid; }
      delay = lo;
    }
  }
  const slipOne = (() => { try { return npv - npvOf(buildLedger(applyEdit(p, { kind: "shiftMonths", target: "golive", by: 1 }, cat), cat)); } catch { return null; } })();
  return { delayCostPerMonth: slipOne, npv, benefitPct: benefit === null ? null : benefit * 100, costPct: cost === null ? null : cost * 100, delayMonths: delay, maxDelay: MAX_DELAY_MONTHS };
}

/** The three margins in plain sentences, worded for NPV above or at-or-below zero. */
export function breakEvenSentences(b: BreakEven): { id: "benefit" | "cost" | "delay" | "delayCost"; text: string }[] {
  const out: { id: "benefit" | "cost" | "delay" | "delayCost"; text: string }[] = [];
  const pct = (x: number) => `${Math.round(x)}%`;
  const positive = b.npv > 0;
  if (b.benefitPct !== null) out.push({ id: "benefit", text: positive ? `Benefits can fall to ${pct(b.benefitPct)} of what is expected before NPV reaches zero.` : `Benefits would need to be ${pct(b.benefitPct)} of what is expected for NPV to reach zero.` });
  else out.push({ id: "benefit", text: "NPV stays below zero even with ten times the expected benefits." });
  if (b.costPct !== null) out.push({ id: "cost", text: positive ? `Costs can run to ${pct(b.costPct)} of what is expected (${pct(b.costPct - 100)} over) before NPV reaches zero.` : `Costs would need to fall to ${pct(b.costPct)} of what is expected for NPV to reach zero.` });
  else out.push({ id: "cost", text: "NPV stays below zero even with no cost at all." });
  if (b.delayMonths === null) out.push({ id: "delay", text: `NPV stays above zero even if go-live slips ${b.maxDelay} months.` });
  else if (b.delayMonths === 0) out.push({ id: "delay", text: "NPV is already at or below zero, so a later go-live only makes it worse." });
  else out.push({ id: "delay", text: `Go-live can slip ${b.delayMonths} month${b.delayMonths === 1 ? "" : "s"} before NPV reaches zero.` });
  if (b.delayCostPerMonth !== null && b.delayCostPerMonth > 0) out.push({ id: "delayCost", text: `Each month go-live slips costs about C$${Math.round(b.delayCostPerMonth).toLocaleString("en-CA")} of NPV.` });
  return out;
}
