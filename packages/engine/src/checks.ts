import { blockedByCondition, currentLines } from "./currentstate.js";
import type { Ledger } from "./ledger.js";
import type { Project } from "./project.js";
import type { RoiResult } from "./roi.js";
import { sum } from "./lines.js";

/**
 * Cross-field checks on a business case: things a careful reader would question that no single input can show. Each is a prompt to look,
 * not an error, and none changes a figure. `warn` is worth fixing or explaining before the case is shown; `info` is worth knowing.
 */
export interface PlanCheck { id: string; severity: "warn" | "info"; message: string }

const money = (v: number) => `C$${Math.round(v).toLocaleString("en-CA")}`;

export function planChecks(p: Project, ledger: Ledger, roi: RoiResult): PlanCheck[] {
  const out: PlanCheck[] = [];
  const B = p.timeline.buildMonths;
  const add = (id: string, severity: PlanCheck["severity"], message: string) => out.push({ id, severity, message });

  if (p.build.includeLabour && p.build.team.length === 0) add("no-team", "warn", "No build team is entered, so build labour is zero. If people will do the work, add them on Build; if they are already paid for, switch labour off so the case says so.");

  if (roi.totalCost > 0 && roi.totalBenefit > 6 * roi.totalCost) {
    add("benefit-ratio", "warn", `Total benefit (${money(roi.totalBenefit)}) is ${Math.round(roi.totalBenefit / roi.totalCost)} times the total cost. That is unusual enough to check for the same saving counted twice, for example a current-state line and time saved by the same people.`);
  }

  // The same role in a current-state people line and in a time-saved capability is the usual double count.
  const lineRoles = new Set(currentLines(p).filter((l) => l.basis.kind === "fte").map((l) => (l.basis as { roleId: string }).roleId));
  for (const c of p.benefits.capabilities) {
    if (lineRoles.has(c.roleId)) add(`double-count:${c.id}`, "warn", `"${c.label}" saves time for ${p.rateCard.find((r) => r.id === c.roleId)?.label ?? c.roleId}, and a current-state line also saves their cost. Count it once.`);
  }

  if (roi.paybackMonth !== null && roi.paybackMonth <= B) add("payback-early", "warn", `Payback is in month ${roi.paybackMonth}, inside the ${B}-month build. That usually means a one-off benefit or benefits that start before go-live; check it is intended.`);

  const early = ledger.months.find((m) => m.m <= B && m.benefit - m.benefitBy.oneOff > 0.5);
  if (early && !(roi.paybackMonth !== null && roi.paybackMonth <= B)) add("benefit-early", "info", `Benefit starts in month ${early.m}, before go-live (month ${B + 1}). Check that capabilities and savings start from go-live.`);

  const full = p.roi.adoptionPct === 100 || p.roi.realisationPct === 100 || p.benefits.capabilities.some((c) => c.adoptionPct === 100 || c.realisationPct === 100);
  if (full) add("full-adoption", "info", "Adoption or realisation is set to 100%. That assumes everyone changes at once and every saved hour is used; a cautious case usually sits lower.");

  const blocked = currentLines(p).filter((l) => blockedByCondition(l) && l.change.mode !== "keep");
  if (blocked.length > 0) add("not-decommissioned", "info", `${blocked.length} current-state saving${blocked.length === 1 ? " is" : "s are"} left out because the decommission is not assumed (${blocked.slice(0, 2).map((l) => `"${l.label}"`).join(", ")}${blocked.length > 2 ? ", ..." : ""}). They count once you say the system will really be switched off.`);

  if (p.roi.discountRatePct === 0) add("no-discount", "info", "The discount rate is 0%, so NPV is just the total net. Finance usually expects a rate, often the cost of capital.");
  if (p.build.includeLabour && p.build.contingencyPct === 0 && sum(ledger.months.map((m) => m.byStream.labour)) > 0) add("no-contingency", "info", "Contingency is 0%. Most business cases carry some for the build.");
  if (roi.irrPct !== null && roi.irrPct > 150) add("irr-high", "info", `IRR is ${Math.round(roi.irrPct)}%. That is usually a small build against large benefits; read payback and NPV alongside it.`);

  const conf = [...p.benefits.capabilities.map((c) => c.confidencePct), ...p.benefits.value.map((v) => v.confidencePct), ...currentLines(p).map((l) => l.confidencePct), ...p.benefits.avoidedCosts.map((a) => a.confidencePct)];
  if (conf.length >= 3 && conf.every((c) => c === undefined || c >= 100)) add("all-certain", "info", `All ${conf.length} benefit lines are counted at 100% confidence. Setting a confidence on the uncertain ones shows how much of the case rests on them.`);

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warn" ? -1 : 1));
}
