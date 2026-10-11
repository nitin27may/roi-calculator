import type { Project } from "../../project.js";
import { ROLES as R, baseProject, crew, delivery, envs, line, perTxn, rateCard, reduce, res, score } from "./common.js";

/**
 * Enhancement: add straight-through processing and automated payments to the claims platform that stays in place.
 * A rules service and a payments service run on the existing AKS cluster (extra nodes only), with Service Bus topics,
 * Blob Storage for estimate photos and Key Vault for the payment keys. Seven-month build, five-year view. The saving is
 * adjuster and clerk time on small claims, and the overpayments that manual keying lets through. All figures are illustrative.
 */
export function claimsStp(): Project {
  const B = 7, H = 60;
  const p = baseProject({
    name: "Claims straight-through processing and automated payments", startDate: "2027-06-01", buildMonths: B, horizonMonths: H, rampMonths: 6, contingencyPct: 15, discountRatePct: 8, hurdleRatePct: 15,
    features: [{ id: "stp", label: "Straight-through processing and payments", description: "Rules that settle low-value auto and property claims without an adjuster, automated payment issue, and a duplicate-payment check, added to the existing claims platform.", types: ["enhancement"] }],
    roles: rateCard(R.pm, R.ba, R.architect, R.techLead, R.dev, R.qa, R.devops, R.security, R.change, R.adjuster, R.claimsClerk),
  });
  const F = "stp";

  p.build.team = crew(B, H, [
    { role: R.pm, name: "Marcus Tremblay", fte: 0.5, phases: ["discovery", "deploy"] },
    { role: R.ba, name: "Aisha Khan", phases: ["discovery", "test"] },
    { role: R.architect, name: "Priya Raman", fte: 0.25, phases: ["discovery", "design"] },
    { role: R.techLead, name: "Daniel Okafor", phases: ["design", "deploy"] },
    { role: R.dev, name: "Mei Lin Wong (rules service)", phases: ["design", "migration"] },
    { role: R.dev, name: "Liam O'Connor (payments service)", phases: ["design", "migration"] },
    { role: R.dev, name: "Tariq Mahmood (claims core changes)", phases: ["build", "migration"] },
    { role: R.devops, name: "Ravi Patel", fte: 0.5, phases: ["build", "deploy"] },
    { role: R.security, name: "Chloé Gagnon", fte: 0.25, phases: ["design", "test"] },
    { role: R.qa, name: "Grace Kim", phases: ["build", "migration"] },
    { role: R.change, name: "Jennifer Wu (adjusters, finance)", fte: 0.5, phases: ["test", "deploy"] },
    { role: R.dev, name: "Mei Lin Wong (hypercare)", phases: ["hypercare"] },
  ]);
  p.build.environment = [
    { id: "gh", label: "GitHub Enterprise seats", unitPriceId: "github-seat-enterprise-seats", quantity: 9 },
    { id: "copilot", label: "GitHub Copilot Business seats", unitPriceId: "copilot-business", quantity: 6 },
    { id: "sandbox", label: "Bank and payments sandbox access", amountCad: 900, cadence: "monthly" },
  ];
  p.build.deliveryCosts = [
    delivery("d-rules", "Rules-engine vendor: implementation and rule authoring workshops", "vendor", 120_000, 3),
    delivery("d-pay", "Payments integration and bank certification (EFT, e-transfer)", "vendor", 45_000, 5),
    delivery("d-training", "Training for adjusters, claims clerks and finance", "training", 30_000, 6),
    delivery("d-comms", "Communication to claimants and repair partners", "comms", 7_000, 7),
  ];

  // The cluster, ingress, SQL Managed Instance, monitoring and Key Vault tooling already exist; only what this change adds is costed.
  p.environments = envs(B, { uat: true });
  const NP = ["dev", "test", "uat"], ALL = ["dev", "test", "uat", "prod"];
  p.resources = [
    res("nodes-prod", "Extra AKS user nodes for the rules and payments services (3 x D8s v5, 1-year reserved)", "vm", "d8s-v5-linux", { count: 3 }, { feature: F, envs: ["prod"], term: "ri1" }),
    res("nodes-np", "Extra AKS user nodes, non-production (3 x D8s v5)", "vm", "d8s-v5-linux", { count: 3 }, { feature: F, envs: NP }),
    res("sb", "Service Bus Premium: extra messaging unit for settlement and payment topics", "service-bus", "premium", { namespaces: 0, mus: 1, opsM: 0 }, { feature: F, envs: ["prod"] }),
    res("sb-np", "Service Bus Standard", "service-bus", "standard", { namespaces: 1, opsM: 20 }, { feature: F, envs: NP }),
    res("mi-storage", "Managed Instance: extra storage for decision logs and payment history", "sql-mi", "gp-gen5", { vcores: 0, storageGB: 512 }, { feature: F, envs: ALL }),
    res("blob-est", "Estimate photos and settlement letters (Blob, hot, ZRS, 8 TB)", "blob-storage", "hot-zrs", { storageGB: 8000, writeOps10k: 1100, readOps10k: 2500, retrievalGB: 0 }, { feature: F, envs: ["prod"] }),
    res("blob-np", "Test photos (Blob, hot, LRS)", "blob-storage", "hot-lrs", { storageGB: 600, writeOps10k: 40, readOps10k: 80, retrievalGB: 0 }, { feature: F, envs: NP }),
    res("kv", "Key Vault Premium: payment signing keys in an HSM", "key-vault", "premium", { ops10k: 200, advanced10k: 30, hsmKeys: 3 }, { feature: F, envs: ["prod"] }),
    res("pe", "Private endpoints (storage, Key Vault, Service Bus)", "private-endpoint", "standard", { endpoints: 4, inGB: 600, outGB: 400 }, { feature: F, envs: ["prod"] }),
    res("law", "Log Analytics ingestion: decision and audit logs (kept for audit)", "log-analytics-ingestion", "analytics-payg", { gb: 85, commitments: 0 }, { feature: F, envs: ["prod"] }),
    res("law-np", "Log Analytics ingestion, non-production", "log-analytics-ingestion", "analytics-payg", { gb: 20, commitments: 0 }, { feature: F, envs: NP }),
  ];
  p.workloads = [
    { kind: "transactionFee", id: "pay-fee", featureId: F, label: "Electronic payment fees (EFT and e-transfer)", volumePerMonth: 9_800, cadPerTxn: 0.28 },
    { kind: "transactionFee", id: "estimate-fee", featureId: F, label: "Photo-estimate service: fee per estimate", volumePerMonth: 6_500, cadPerTxn: 4.2 },
    { kind: "contract", id: "rules", featureId: F, label: "Rules engine subscription", amountCad: 3_900, cadence: "monthly" },
  ];
  p.maintenance = { mode: "team", team: [
    { roleId: "dev", name: "Rules and payments developers", people: 0.75, hoursPerMonth: 150, experiments: false },
    { roleId: "ba", name: "Rules analyst (claims policy changes)", people: 0.5, hoursPerMonth: 150, experiments: false },
  ] };

  p.currentState = { lines: [
    line("cur-small-claims", "Adjuster review of small auto and property claims (5,200 a month, about 33 minutes each)", "transaction", perTxn(31.9, 5_200), reduce(40, true), { featureId: F }),
    line("cur-payments", "Manual payment set-up, second-person approval and cheque runs (9,800 a month)", "transaction", perTxn(3.15, 9_800), reduce(70, true), { featureId: F }),
    line("cur-recon", "Payment reconciliation and exception chasing", "people", { kind: "fte", roleId: "claimsClerk", fte: 3, hoursPerMonth: 150 }, reduce(50, true), { featureId: F }),
  ] };
  p.benefits.value = [
    { id: "val-leakage", label: "Fewer overpayments and duplicate payments caught before money leaves", kind: "quality", featureId: F, volumePerMonth: 9_800, errorRateBeforePct: 2.6, errorRateAfterPct: 1.7, costPerError: 540, confidencePct: 60 },
  ];
  p.benefits.scorecard = [
    score("sc-cycle", "Speed: small-claim settlement", "speed", "Days from report to payment for claims under C$3,500", "days", 9, 2, false, 35, 70, { featureId: F }),
    score("sc-stp", "Efficiency: claims settled without an adjuster", "agility", "Share of eligible claims settled straight through", "%", 0, 38, true, 25, 60, { featureId: F }),
    score("sc-sat", "Customer: satisfaction on small claims", "customer", "Transactional NPS", "points", 31, 48, true, 25, 55, { featureId: F }),
    score("sc-audit", "Control: payments with a complete audit trail", "compliance", "Payments with an automatic decision log", "%", 64, 100, true, 15, 85, { featureId: F }),
  ];
  p.scenarios = [
    { id: "sc-stp-low", label: "Only 25% of eligible claims qualify for straight-through", edits: [{ kind: "set", path: ["currentState", "lines", "cur-small-claims", "change", "pct"], value: 25 }] },
    { id: "sc-late", label: "Go-live slips two months", edits: [{ kind: "shiftMonths", target: "golive", by: 2 }] },
    { id: "sc-volume", label: "Claim volume 20% higher (storm season)", edits: [{ kind: "lever", leverId: "volume", amount: 120 }] },
  ];
  return p;
}
