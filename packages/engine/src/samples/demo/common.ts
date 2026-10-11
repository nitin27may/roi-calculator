import { CURRENT_PROJECT_VERSION, PROJECT_SCHEMA_ID, type CurrentLine, type DeliveryCost, type Environment, type Project, type Resource, type ScoreItem } from "../../project.js";
import { standardPhases } from "../../delivery.js";

/**
 * Shared pieces of the demo projects (`DEMO_PROJECTS`). The company, people and figures are invented for the demo:
 * Maple Ridge Mutual is a fictional Canadian property and casualty insurer. Every cost is in CAD and every rate, volume
 * and saving is an assumption to replace with your own. Azure resources reference catalogue SKUs, so their prices are
 * the catalogue's (list prices, pay-as-you-go unless a reserved term is chosen), not figures typed in here.
 */

type TeamLine = Project["build"]["team"][number];
type Role = Project["rateCard"][number];

/** Hours one full-time person works in a month, as the plan recipes use. */
export const HOURS = 150;

/** Delivery and run-side roles. Benefit-side roles (adjusters, agents) sit at the end of the card. */
export const ROLES = {
  pm: { id: "pm", label: "Project manager", hourlyRate: 110 },
  po: { id: "po", label: "Product owner", hourlyRate: 115 },
  ba: { id: "ba", label: "Business analyst", hourlyRate: 95 },
  architect: { id: "architect", label: "Solution architect", hourlyRate: 145 },
  techLead: { id: "techLead", label: "Technical lead", hourlyRate: 125 },
  dev: { id: "dev", label: "Developer", hourlyRate: 105 },
  ux: { id: "ux", label: "UX designer", hourlyRate: 100 },
  qa: { id: "qa", label: "QA / test engineer", hourlyRate: 85 },
  devops: { id: "devops", label: "DevOps / platform engineer", hourlyRate: 115 },
  security: { id: "security", label: "Security engineer", hourlyRate: 125 },
  network: { id: "network", label: "Network engineer", hourlyRate: 118 },
  dba: { id: "dba", label: "Database administrator", hourlyRate: 110 },
  dataEngineer: { id: "dataEngineer", label: "Data engineer", hourlyRate: 110 },
  aiEngineer: { id: "aiEngineer", label: "AI engineer", hourlyRate: 130 },
  change: { id: "change", label: "Change and training", hourlyRate: 85 },
  // On the benefit and current-cost side: the people whose time the change saves.
  adjuster: { id: "adjuster", label: "Claims adjuster", hourlyRate: 58 },
  siuAnalyst: { id: "siuAnalyst", label: "Special investigations analyst", hourlyRate: 68 },
  claimsClerk: { id: "claimsClerk", label: "Claims clerk", hourlyRate: 42 },
  agent: { id: "agent", label: "Contact-centre agent", hourlyRate: 36 },
  marketingOps: { id: "marketingOps", label: "Marketing operations analyst", hourlyRate: 62 },
  salesCoordinator: { id: "salesCoordinator", label: "Sales coordinator", hourlyRate: 40 },
  sysadmin: { id: "sysadmin", label: "Systems administrator", hourlyRate: 78 },
  releaseEngineer: { id: "releaseEngineer", label: "Release engineer", hourlyRate: 100 },
  legacyDev: { id: "legacyDev", label: "Legacy application developer", hourlyRate: 105 },
} satisfies Record<string, Role>;

export const rateCard = (...roles: Role[]): Role[] => roles;

/** One named person (or a fraction of one) on the build, billed over standard delivery phases. */
export interface Crew { role: Role; name: string; fte?: number; phases: string[]; hours?: number; note?: string }

/** Team lines from a crew list: `phases` are standard phase ids; a line runs from the first to the last of them. */
export function crew(buildMonths: number, horizonMonths: number, list: Crew[]): TeamLine[] {
  const phases = standardPhases(buildMonths, horizonMonths);
  return list.map((c) => {
    const hit = c.phases.map((id) => phases.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => x !== undefined);
    if (hit.length === 0) throw new Error(`No phase matches ${c.phases.join(", ")} for ${c.name}`);
    const line: TeamLine = { roleId: c.role.id, name: c.name, people: c.fte ?? 1, hoursPerMonth: c.hours ?? HOURS, experiments: false };
    line.fromMonth = Math.min(...hit.map((x) => x.fromMonth));
    line.toMonth = Math.max(...hit.map((x) => x.toMonth));
    if (hit.length === 1) line.phaseId = hit[0]!.id; else line.phase = hit.map((x) => x.label).join(" to ");
    return line;
  });
}

/** A catalogue resource priced as production; `envs` lists the environments it runs in (absent: every environment). */
export function res(id: string, label: string, typeId: string, skuId: string, inputs: Record<string, number>, o: { feature?: string; envs?: string[]; term?: Resource["term"]; ahb?: boolean } = {}): Resource {
  return { id, label, ...(o.feature ? { featureId: o.feature } : {}), typeId, skuId, inputs, term: o.term ?? "payg", ahb: o.ahb ?? false, ...(o.envs ? { envIds: o.envs } : {}) };
}

/** The usual non-production ladder. Development and test run half-days at reduced size; UAT is full size for the last build months. */
export function envs(buildMonths: number, o: { dr?: boolean | number; uat?: boolean; devSize?: number; testSize?: number; hours?: { hoursPerDay: number; daysPerMonth: number }; devTest?: boolean } = {}): Environment[] {
  const sched = o.hours ?? { hoursPerDay: 10, daysPerMonth: 22 };
  const out: Environment[] = [
    { id: "dev", label: "Development", production: false, sizeFactor: o.devSize ?? 0.25, schedule: sched, pricing: o.devTest ? "devtest" : "payg" },
    // Test reuses the development setting only where the dev/test rate exists (Windows VMs, App Service); elsewhere the engine falls back to pay-as-you-go with a notice.
    { id: "test", label: "Test and performance", production: false, sizeFactor: o.testSize ?? 0.5, schedule: sched, pricing: o.devTest ? "devtest" : "payg" },
  ];
  if (o.uat !== false) out.push({ id: "uat", label: "UAT and pre-production", production: false, sizeFactor: 1, schedule: sched, fromMonth: Math.max(1, buildMonths - 3), toMonth: buildMonths, pricing: "payg" });
  out.push({ id: "prod", label: "Production", production: true, sizeFactor: 1, schedule: { hoursPerMonth: 730 }, pricing: "payg" });
  if (o.dr) out.push({ id: "dr", label: "Disaster recovery (second region)", production: true, sizeFactor: typeof o.dr === "number" ? o.dr : 0.5, schedule: { hoursPerMonth: 730 }, pricing: "payg" });
  return out;
}

export const delivery = (id: string, label: string, category: DeliveryCost["category"], amountCad: number, month?: number): DeliveryCost =>
  ({ id, label, category, amountCad, cadence: "once", ...(month ? { month } : {}) });

export const line = (id: string, label: string, category: CurrentLine["category"], basis: CurrentLine["basis"], change: CurrentLine["change"], extra: Partial<CurrentLine> = {}): CurrentLine =>
  ({ id, label, category, basis, change, ...extra });
export const monthly = (amountCad: number): CurrentLine["basis"] => ({ kind: "monthly", amountCad });
export const fte = (roleId: string, n: number, hoursPerMonth = HOURS): CurrentLine["basis"] => ({ kind: "fte", roleId, fte: n, hoursPerMonth });
export const perTxn = (unitCostCad: number, volumePerMonth: number): CurrentLine["basis"] => ({ kind: "perTransaction", unitCostCad, volumePerMonth });
export const retire = (fromMonth?: number): CurrentLine["change"] => ({ mode: "retire", ...(fromMonth ? { fromMonth } : {}) });
export const reduce = (pct: number, followsAdoption = true, fromMonth?: number): CurrentLine["change"] => ({ mode: "reduce", pct, followsAdoption, ...(fromMonth ? { fromMonth } : {}) });
export const keep: CurrentLine["change"] = { mode: "keep" };
export const decommission = (condition: string, assumed: boolean): Pick<CurrentLine, "decommission"> => ({ decommission: { conditional: true, condition, assumed } });

export const score = (id: string, label: string, dimension: ScoreItem["dimension"], measure: string, unit: string, before: number, after: number, higherIsBetter: boolean, weightPct: number, confidencePct: number, extra: Partial<ScoreItem> = {}): ScoreItem =>
  ({ id, label, dimension, measure, unit, before, after, higherIsBetter, weightPct, confidencePct, ...extra });

export interface BaseOptions {
  name: string;
  startDate: string;
  buildMonths: number;
  horizonMonths?: number;
  rampMonths: number;
  features: Project["features"];
  roles: Role[];
  contingencyPct: number;
  discountRatePct?: number;
  hurdleRatePct?: number;
  basis?: Project["roi"]["basis"];
  benefitPreset?: Project["roi"]["benefitPreset"];
}

/** An empty but valid project with the delivery phases laid out; the caller fills in team, resources, workloads and benefits. */
export function baseProject(o: BaseOptions): Project {
  const horizon = o.horizonMonths ?? 60;
  return {
    schema: PROJECT_SCHEMA_ID, version: CURRENT_PROJECT_VERSION, name: o.name, startDate: o.startDate,
    // Canada Regional keeps data in Canada, which an insurer's regulators expect; the engine falls back with a notice where a model is not offered there.
    settings: { azureDeployment: "regional", language: "en", snowflake: { routing: "global", edition: "enterprise" } },
    timeline: { buildMonths: o.buildMonths, horizonMonths: horizon, adoptionRampMonths: o.rampMonths, phases: standardPhases(o.buildMonths, horizon) },
    features: o.features,
    rateCard: o.roles,
    harnesses: [],
    build: { team: [], includeLabour: true, workstreams: [], contingencyPct: o.contingencyPct, contingencyScope: "labour", activities: [], environment: [], deliveryCosts: [] },
    workloads: [],
    resources: [],
    environments: [],
    maintenance: { mode: "none" },
    benefits: { capabilities: [], avoidedCosts: [], oneOff: [], value: [], scorecard: [] },
    roi: {
      basis: o.basis ?? "full", benefitPreset: o.benefitPreset ?? "typical", devCutPct: 0, maintCutPct: 0, transitionCosts: [],
      growthPctPerYear: 0, rateEscalationPctPerYear: 2, discountRatePct: o.discountRatePct ?? 8,
      ...(o.hurdleRatePct !== undefined ? { hurdleRatePct: o.hurdleRatePct } : {}),
    },
    scenarios: [],
    currentState: { lines: [] },
  };
}
