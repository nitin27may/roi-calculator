import type { Project } from "../../project.js";
import { ROLES as R, baseProject, crew, delivery, envs, fte, line, monthly, perTxn, rateCard, reduce, res, retire, score } from "./common.js";

/**
 * Automation: the quote funnel (web and broker leads, qualification, routing, follow-up, quote hand-off, e-signature)
 * moves from spreadsheets, inboxes and a lead-routing tool to workflows that run as containers on the shared AKS
 * platform, with Service Bus queues, Azure SQL, Blob Storage and Key Vault. Five-month build, five-year view.
 * The saving is staff time, rework and a retired tool; the upside is more leads turned into policies.
 * All figures are illustrative.
 */
export function funnelAutomation(): Project {
  const B = 5, H = 60;
  const p = baseProject({
    name: "Quote funnel automation (lead to bind)", startDate: "2027-03-01", buildMonths: B, horizonMonths: H, rampMonths: 4, contingencyPct: 15, discountRatePct: 8, hurdleRatePct: 15,
    features: [{ id: "funnel", label: "Lead-to-quote automation", description: "Capture, de-duplicate, score and route leads, chase them automatically, hand a complete file to the quoting tool and collect e-signatures.", types: ["automation"] }],
    roles: rateCard(R.pm, R.ba, R.architect, R.dev, R.qa, R.devops, R.security, R.change, R.salesCoordinator, R.marketingOps),
  });
  const F = "funnel";

  p.build.team = crew(B, H, [
    { role: R.pm, name: "Sandra Whitfield", fte: 0.5, phases: ["discovery", "deploy"] },
    { role: R.ba, name: "Jorge Medina (sales operations)", phases: ["discovery", "test"] },
    { role: R.architect, name: "Priya Raman", fte: 0.25, phases: ["discovery", "design"] },
    { role: R.dev, name: "Anika Sharma (workflow lead)", phases: ["design", "migration"] },
    { role: R.dev, name: "Ethan Cole", phases: ["build", "migration"] },
    { role: R.dev, name: "Yuki Tanaka", phases: ["build", "migration"] },
    { role: R.devops, name: "Elena Petrova (shared AKS platform)", fte: 0.5, phases: ["build", "deploy"] },
    { role: R.security, name: "Chloé Gagnon", fte: 0.25, phases: ["design", "test"] },
    { role: R.qa, name: "Omar Haddad", phases: ["build", "migration"] },
    { role: R.change, name: "Jennifer Wu (sales coordinators, brokers)", fte: 0.5, phases: ["test", "deploy"] },
    { role: R.dev, name: "Anika Sharma (hypercare)", phases: ["hypercare"] },
  ]);
  p.build.environment = [
    { id: "gh", label: "GitHub Enterprise seats", unitPriceId: "github-seat-enterprise-seats", quantity: 8 },
    { id: "pa-dev", label: "Power Automate Premium seats for the build team", unitPriceId: "microsoft-seat-power-automate-premium-users", quantity: 4 },
  ];
  p.build.deliveryCosts = [
    delivery("d-crm", "CRM and quoting-tool integration (vendor connectors, certification)", "vendor", 38_000, 3),
    delivery("d-data", "De-duplication and clean-up of 420,000 historical leads", "dataMigration", 14_000, 4),
    delivery("d-training", "Training for coordinators, marketing and brokers", "training", 12_000, 5),
    delivery("d-comms", "Broker announcement and portal guides", "comms", 4_500, 5),
  ];

  // Runs on the shared AKS platform (control plane, ingress, monitoring already paid for by another project): only the added nodes and services are costed here.
  p.environments = envs(B, { uat: false });
  const NP = ["dev", "test"], ALL = ["dev", "test", "prod"];
  p.resources = [
    res("nodes", "Extra AKS node pool for workflow workers (2 x D4s v5, 1-year reserved in production)", "vm", "d4s-v5-linux", { count: 2 }, { feature: F, envs: ["prod"], term: "ri1" }),
    res("nodes-np", "Workflow workers, non-production (2 x D4s v5)", "vm", "d4s-v5-linux", { count: 2 }, { feature: F, envs: NP }),
    res("sql", "Azure SQL Database General Purpose, 4 vCores (lead and routing data)", "sql-db-vcore", "gp-gen5", { vcores: 4, storageGB: 256 }, { feature: F, envs: ALL }),
    res("sb", "Service Bus Standard (lead, follow-up and quote queues)", "service-bus", "standard", { namespaces: 1, opsM: 40 }, { feature: F, envs: ALL }),
    res("blob", "Application packs, call recordings and e-signed documents (Blob, hot, ZRS, 2.5 TB)", "blob-storage", "hot-zrs", { storageGB: 2500, writeOps10k: 450, readOps10k: 900, retrievalGB: 0 }, { feature: F, envs: ["prod"] }),
    res("blob-np", "Test documents (Blob, hot, LRS)", "blob-storage", "hot-lrs", { storageGB: 200, writeOps10k: 20, readOps10k: 40, retrievalGB: 0 }, { feature: F, envs: NP }),
    res("kv", "Key Vault Standard (CRM, telephony and e-signature API keys)", "key-vault", "standard", { ops10k: 150, advanced10k: 2, hsmKeys: 0 }, { feature: F, envs: ALL }),
    res("pe", "Private endpoints (SQL, storage, Key Vault, Service Bus)", "private-endpoint", "standard", { endpoints: 5, inGB: 200, outGB: 150 }, { feature: F, envs: ALL }),
    res("law", "Log Analytics ingestion: workflow and application logs", "log-analytics-ingestion", "analytics-payg", { gb: 70, commitments: 0 }, { feature: F, envs: ALL }),
    res("appins", "Application Insights", "application-insights", "workspace-based", { gb: 22, testsK: 40 }, { feature: F, envs: ["prod"] }),
  ];
  p.workloads = [
    { kind: "seats", id: "seats", featureId: F, label: "Power Automate Premium for sales coordinators and marketing", seats: 30, unitPriceId: "microsoft-seat-power-automate-premium-users", followsAdoption: false },
    { kind: "transactionFee", id: "sms", featureId: F, label: "SMS and email follow-ups (Azure Communication Services)", volumePerMonth: 95_000, cadPerTxn: 0.012 },
    { kind: "transactionFee", id: "esign", featureId: F, label: "E-signature envelopes", volumePerMonth: 4_200, cadPerTxn: 1.85 },
    { kind: "contract", id: "enrich", featureId: F, label: "Lead enrichment and address-validation data service", amountCad: 2_900, cadence: "monthly" },
  ];
  p.maintenance = { mode: "team", team: [{ roleId: "dev", name: "Workflow maintainer", people: 0.4, hoursPerMonth: 150, experiments: false }] };

  p.currentState = { lines: [
    line("cur-coord", "Sales coordinators re-keying, chasing and routing leads by hand", "people", fte("salesCoordinator", 9), reduce(55, true), { featureId: F }),
    line("cur-mktops", "Marketing operations: lead lists, de-duplication, weekly routing reports", "people", fte("marketingOps", 2), reduce(35, true), { featureId: F }),
    line("cur-tool", "Lead-routing software subscription", "licence", monthly(4_800), retire(6), { featureId: F }),
    line("cur-rework", "Rework on duplicate and misrouted leads", "transaction", perTxn(6.5, 2_300), reduce(75, true), { featureId: F }),
    line("cur-paper", "Printed and couriered application packs", "transaction", perTxn(3.2, 1_800), reduce(80, true), { featureId: F }),
  ] };
  p.benefits.value = [
    { id: "val-conv", label: "More leads become policies: faster first contact lifts conversion by 0.9 points", kind: "revenue", featureId: F, monthlyRevenue: 223_000, marginPct: 14, confidencePct: 55 },
    { id: "val-quote-errors", label: "Fewer quote data-entry errors and re-quotes", kind: "quality", featureId: F, volumePerMonth: 11_000, errorRateBeforePct: 6.5, errorRateAfterPct: 1.2, costPerError: 38, confidencePct: 70 },
  ];
  p.benefits.scorecard = [
    score("sc-response", "Speed: first contact", "speed", "Median time from lead to first contact", "minutes", 260, 6, false, 35, 80, { featureId: F }),
    score("sc-dup", "Quality: duplicate leads reaching a coordinator", "other", "Share of leads that are duplicates", "%", 12, 1, false, 20, 75, { featureId: F }),
    score("sc-broker", "Broker experience: quote turnaround", "customer", "Business days from submission to quote", "days", 2.5, 0.5, false, 25, 60, { featureId: F }),
    score("sc-coord", "Coordinator experience: time on admin", "employee", "Share of the day spent on re-keying and chasing", "%", 55, 20, false, 20, 65, { featureId: F }),
  ];
  p.roi.transitionCosts = [{ id: "tc-parallel", label: "Parallel running: coordinators check automated routing against the manual process", monthly: 9_000, fromMonth: 6, toMonth: 8 }];
  p.scenarios = [
    { id: "sc-conv-zero", label: "No conversion uplift (savings only)", edits: [{ kind: "set", path: ["benefits", "value", "val-conv", "confidencePct"], value: 0 }] },
    { id: "sc-volume", label: "Lead volume 30% higher after a marketing push", edits: [{ kind: "lever", leverId: "volume", amount: 130 }] },
    { id: "sc-late", label: "Go-live slips two months", edits: [{ kind: "shiftMonths", target: "golive", by: 2 }] },
  ];
  return p;
}
