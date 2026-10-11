import type { Catalog } from "@roi-calculator/catalog";
import { lineWindow } from "./delivery.js";
import type { Ledger } from "./ledger.js";
import { sum } from "./lines.js";
import type { Project } from "./project.js";
import { resourceCostRows } from "./infrastructure.js";

/**
 * Who a report is for. One project, one set of figures, shown in the order and depth each reader needs. A section a reader
 * does not need is left out of their copy; nothing is recalculated, so every figure is the same in every copy.
 */
export const REPORT_AUDIENCES = [
  { id: "all", label: "Full report", detail: "Every section, for the project file" },
  { id: "sponsor", label: "Executive sponsor", detail: "The decision: verdict, cost, return, what could change it" },
  { id: "finance", label: "Finance (CFO)", detail: "Cash flow, NPV, IRR, ranges, scenarios and assumptions" },
  { id: "tech", label: "Technology and architecture", detail: "Infrastructure by environment, run cost by workload, prices, risks" },
  { id: "delivery", label: "Delivery and PMO", detail: "Team, phases, delivery costs, build by month" },
  { id: "business", label: "Business owner", detail: "What changes for the business: savings, benefits, scorecard" },
] as const;
export type ReportAudience = (typeof REPORT_AUDIENCES)[number]["id"];

export type ReportSection =
  | "exec" | "assumptions" | "workloads" | "currentState" | "scorecard" | "range"
  | "monthly" | "cumulative" | "build" | "production" | "byYear" | "capability" | "scenarios" | "levers" | "watchouts"
  | "infrastructure" | "team";

/** Which audiences get which section. "all" gets every section. */
const SECTION_AUDIENCES: Record<ReportSection, readonly ReportAudience[]> = {
  exec: ["sponsor", "finance", "business"],
  assumptions: ["finance", "tech", "delivery"],
  workloads: ["tech"],
  currentState: ["sponsor", "finance", "business"],
  scorecard: ["sponsor", "business"],
  range: ["sponsor", "finance"],
  monthly: ["finance", "delivery"],
  cumulative: ["sponsor", "finance"],
  build: ["finance", "delivery"],
  production: ["finance", "tech"],
  byYear: ["finance"],
  capability: ["finance", "business"],
  scenarios: ["sponsor", "finance"],
  levers: ["finance", "tech"],
  watchouts: ["tech", "delivery", "sponsor"],
  infrastructure: ["tech"],
  team: ["delivery"],
};

export const showsSection = (audience: ReportAudience, section: ReportSection): boolean => audience === "all" || SECTION_AUDIENCES[section].includes(audience);
export const isReportAudience = (v: string | null | undefined): v is ReportAudience => REPORT_AUDIENCES.some((a) => a.id === v);

export interface TeamPlanRow { seat: number; name: string; role: string; fte: number; fromMonth: number; toMonth: number; phase: string; cost: number }
export interface TeamPlan { rows: TeamPlanRow[]; total: number; peopleMonths: number }

/**
 * What each build team line costs over the plan, as the ledger bills it (with contingency, AI assistance and any manual rate),
 * with the months it is billed. Lines left out of cost ("Costed" off) are not listed. Hypercare lines are billed after go-live.
 */
export function teamPlan(p: Project, ledger: Ledger): TeamPlan {
  const bySeat = new Map<number, number>();
  for (const m of ledger.months) for (const l of m.lines) if (l.stream === "labour" && l.seat !== undefined) bySeat.set(l.seat, (bySeat.get(l.seat) ?? 0) + l.cost);
  const rows: TeamPlanRow[] = [];
  p.build.team.forEach((t, i) => {
    if (!bySeat.has(i)) return;
    const w = lineWindow(p, t);
    rows.push({
      seat: i, name: t.name ?? "(unnamed)", role: p.rateCard.find((r) => r.id === t.roleId)?.label ?? t.roleId, fte: t.people,
      fromMonth: w.from, toMonth: w.to, phase: t.phase ?? p.timeline.phases?.find((x) => x.id === t.phaseId)?.label ?? "Whole build", cost: bySeat.get(i)!,
    });
  });
  return { rows, total: sum(rows.map((r) => r.cost)), peopleMonths: sum(rows.map((r) => r.fte * Math.max(0, r.toMonth - r.fromMonth + 1))) };
}

export interface InfraReportEnv { id: string; label: string; production: boolean }
export interface InfraReportRow { id: string; label: string; type: string; sku: string; perEnv: Record<string, number>; monthly: number }
export interface InfraReport { envs: InfraReportEnv[]; rows: InfraReportRow[]; envTotals: Record<string, number>; total: number }

/** Resources by environment: the monthly cost of each resource in each environment, in the first month it is billed there. */
export function infrastructureReport(p: Project, ledger: Ledger, cat: Catalog): InfraReport {
  const envs: InfraReportEnv[] = (p.environments ?? []).length ? p.environments!.map((e) => ({ id: e.id, label: e.label, production: e.production })) : [{ id: "", label: "Production", production: true }];
  const costs = new Map(resourceCostRows(p, ledger).map((r) => [r.resourceId, r]));
  const rows: InfraReportRow[] = (p.resources ?? []).map((r) => {
    const type = cat.resourceTypes.find((t) => t.id === r.typeId);
    const perEnv: Record<string, number> = {};
    for (const c of costs.get(r.id)?.perEnv ?? []) perEnv[c.envId ?? ""] = c.monthly;
    return { id: r.id, label: r.label, type: type?.label ?? r.typeId, sku: type?.skus.find((s) => s.id === r.skuId)?.label ?? r.skuId, perEnv, monthly: sum(Object.values(perEnv)) };
  });
  const envTotals: Record<string, number> = {};
  for (const e of envs) envTotals[e.id] = sum(rows.map((r) => r.perEnv[e.id] ?? 0));
  return { envs, rows, envTotals, total: sum(Object.values(envTotals)) };
}
