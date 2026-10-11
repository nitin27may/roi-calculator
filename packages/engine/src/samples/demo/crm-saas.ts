import type { Project } from "../../project.js";
import { ROLES as R, baseProject, crew, decommission, delivery, envs, fte, line, monthly, rateCard, reduce, res, retire, score } from "./common.js";

/**
 * Replace with SaaS: the self-hosted broker CRM and quoting front end (six VMs and an Oracle database, end of vendor
 * support in 2028) is retired and 420 people move to a hosted CRM. What stays in Azure is the integration layer: API
 * Management, Logic Apps, Service Bus, Data Factory for the migration and nightly sync, Blob Storage and Key Vault.
 * Eight-month build, five-year view. SaaS seats cost more than the licences they replace, so the case rests on hosting,
 * support staff, productivity and the security risk of an unsupported system. All figures are illustrative.
 */
export function crmSaas(): Project {
  const B = 8, H = 60;
  const p = baseProject({
    name: "Broker CRM replaced with SaaS", startDate: "2027-04-01", buildMonths: B, horizonMonths: H, rampMonths: 6, contingencyPct: 15, discountRatePct: 8, hurdleRatePct: 10,
    features: [{ id: "crm", label: "SaaS CRM and broker management", description: "Move broker, account and quote data to a hosted CRM, rebuild the integrations to the claims, policy and billing systems, and switch off the self-hosted CRM and its Oracle database.", types: ["saas"] }],
    roles: rateCard(R.pm, R.ba, R.architect, R.dev, R.qa, R.devops, R.security, R.dba, R.dataEngineer, R.change, R.sysadmin, R.legacyDev, R.salesCoordinator),
  });
  const F = "crm";

  p.build.team = crew(B, H, [
    { role: R.pm, name: "Sandra Whitfield", phases: ["discovery", "deploy"] },
    { role: R.ba, name: "Jorge Medina (broker management process)", phases: ["discovery", "test"] },
    { role: R.ba, name: "Aisha Khan (quote and rating rules)", phases: ["design", "test"] },
    { role: R.architect, name: "Priya Raman", fte: 0.5, phases: ["discovery", "build"] },
    { role: R.dev, name: "Anika Sharma (CRM configuration)", phases: ["design", "migration"] },
    { role: R.dev, name: "Ethan Cole (integrations)", phases: ["design", "migration"] },
    { role: R.dev, name: "Yuki Tanaka (integrations)", phases: ["build", "migration"] },
    { role: R.dataEngineer, name: "Diego Ramos (data migration)", phases: ["design", "migration"] },
    { role: R.dba, name: "Tomás Silva (Oracle extracts)", fte: 0.5, phases: ["design", "migration"] },
    { role: R.devops, name: "Ravi Patel (integration platform)", fte: 0.5, phases: ["build", "deploy"] },
    { role: R.security, name: "Chloé Gagnon", fte: 0.25, phases: ["design", "test"] },
    { role: R.qa, name: "Grace Kim", phases: ["build", "migration"] },
    { role: R.change, name: "Jennifer Wu (training, 420 users)", phases: ["test", "deploy"] },
    { role: R.dev, name: "Anika Sharma (hypercare)", phases: ["hypercare"] },
    { role: R.dataEngineer, name: "Diego Ramos (hypercare)", phases: ["hypercare"] },
  ]);
  p.build.environment = [
    { id: "sandbox", label: "SaaS full-copy sandboxes during the build", amountCad: 2_400, cadence: "monthly" },
    { id: "gh", label: "GitHub Enterprise seats", unitPriceId: "github-seat-enterprise-seats", quantity: 8 },
  ];
  p.build.deliveryCosts = [
    delivery("d-impl", "SaaS vendor implementation partner: configuration, workflows, reports", "vendor", 260_000, 4),
    delivery("d-data", "Data cleansing and migration of 18 years of broker, account and quote history", "dataMigration", 110_000, 6),
    delivery("d-training", "Role-based training and floor support for 420 users", "training", 72_000, 7),
    delivery("d-comms", "Broker communications and new-portal guides", "comms", 15_000, 8),
    delivery("d-exit", "Legacy exit: archive of read-only history, decommissioning, Oracle licence true-down", "other", 38_000, 9),
  ];

  p.environments = envs(B, { devTest: false, uat: true });
  const NP = ["dev", "test", "uat"], ALL = ["dev", "test", "uat", "prod"];
  p.resources = [
    res("apim", "API Management Standard (CRM, policy, claims and billing APIs)", "apim-gateway", "standard", { units: 1 }, { feature: F, envs: ["uat", "prod"] }),
    res("apim-dev", "API Management Developer", "apim-gateway", "developer", { units: 1 }, { feature: F, envs: ["dev", "test"] }),
    res("logic", "Logic Apps Standard WS1: integration workflows (2 instances)", "logic-apps-standard", "ws1", { instances: 2 }, { feature: F, envs: ALL }),
    res("sb", "Service Bus Standard: change events between the CRM and core systems", "service-bus", "standard", { namespaces: 1, opsM: 25 }, { feature: F, envs: ALL }),
    res("adf", "Data Factory: nightly sync and migration runs (Azure IR)", "data-factory", "azure-ir", { runsK: 12, diuHours: 120, activityHours: 400 }, { feature: F, envs: ALL }),
    res("blob", "Attachments and read-only archive of legacy history (Blob, cool, GRS, 4 TB)", "blob-storage", "cool-grs", { storageGB: 4000, writeOps10k: 60, readOps10k: 120, retrievalGB: 200 }, { feature: F, envs: ["prod"] }),
    res("blob-np", "Migration staging (Blob, hot, LRS)", "blob-storage", "hot-lrs", { storageGB: 1200, writeOps10k: 100, readOps10k: 200, retrievalGB: 0 }, { feature: F, envs: NP }),
    res("kv", "Key Vault Standard (SaaS API credentials, certificates)", "key-vault", "standard", { ops10k: 90, advanced10k: 2, hsmKeys: 0 }, { feature: F, envs: ALL }),
    res("pe", "Private endpoints", "private-endpoint", "standard", { endpoints: 4, inGB: 300, outGB: 200 }, { feature: F, envs: ALL }),
    res("law", "Log Analytics ingestion: integration and audit logs", "log-analytics-ingestion", "analytics-payg", { gb: 60, commitments: 0 }, { feature: F, envs: ALL }),
  ];
  p.workloads = [
    // 420 seats at an assumed C$138 a seat a month (a mid-range enterprise CRM list price). Replace with your quote.
    { kind: "seats", id: "crm-seats", featureId: F, label: "SaaS CRM subscriptions (420 seats)", seats: 420, cadPerSeat: 138, followsAdoption: true },
    { kind: "contract", id: "crm-support", featureId: F, label: "SaaS premier support (about 9% of subscription), rising 4% a year", amountCad: 62_000, cadence: "yearly", escalationPct: 4 },
    { kind: "contract", id: "crm-sandbox", featureId: F, label: "Two full-copy sandboxes", amountCad: 2_400, cadence: "monthly" },
    { kind: "transactionFee", id: "esign", featureId: F, label: "E-signature envelopes from the CRM", volumePerMonth: 3_100, cadPerTxn: 1.85 },
  ];
  p.maintenance = { mode: "team", team: [
    { roleId: "dev", name: "CRM administrators and integration developer", people: 2, hoursPerMonth: 150, experiments: false },
  ] };

  p.currentState = { lines: [
    line("cur-licence", "CRM licences and annual maintenance (vendor)", "licence", monthly(41_000), retire(10), { featureId: F, ...decommission("The vendor contract is not renewed", true) }),
    line("cur-hosting", "Hosting for the CRM: six VMs, storage and backup", "infrastructure", monthly(14_500), retire(10), { featureId: F, ...decommission("The VMs are switched off", true) }),
    line("cur-oracle", "Oracle database licences and support", "licence", monthly(9_800), retire(10), { featureId: F }),
    line("cur-bi", "Reporting add-on and CTI telephony connector", "licence", monthly(5_300), retire(10), { featureId: F }),
    line("cur-dba", "Database administrator time on the CRM database", "people", fte("dba", 1), retire(10), { featureId: F }),
    line("cur-sysadmin", "System administration of the CRM servers", "people", fte("sysadmin", 0.5), retire(10), { featureId: F }),
    line("cur-support-dev", "Sustaining developers on the CRM (customisations, upgrades, hot fixes)", "people", fte("legacyDev", 4), reduce(70, true), { featureId: F }),
  ] };
  p.benefits.capabilities = [
    { id: "cap-productivity", label: "Less time searching for broker and account history, one place for quotes", roleId: "salesCoordinator", featureId: F, workloadIds: [], workstreamIds: [], hoursSavedPerMonth: 0,
      driver: "perUserWeek", users: 420, baselineMinutes: 90, savings: { conservative: 12, typical: 22, optimistic: 32 }, unit: "minutes", adoptionPct: 85, realisationPct: 70 },
  ];
  p.benefits.value = [
    { id: "val-risk", label: "Security incident on an unsupported system avoided (0.12 events a year, C$3.2M each)", kind: "risk", featureId: F, eventsPerYear: 0.12, impactCad: 3_200_000, reductionPct: 75, confidencePct: 60 },
  ];
  p.benefits.scorecard = [
    score("sc-support", "Risk: vendor-supported platform", "compliance", "Components past end of vendor support", "components", 4, 0, false, 30, 85, { featureId: F }),
    score("sc-mobile", "Experience: brokers and sales staff can use it on a phone", "employee", "Share of CRM tasks available on mobile", "%", 10, 85, true, 20, 60, { featureId: F }),
    score("sc-release", "Agility: time to change a workflow", "agility", "Days to change a sales workflow", "days", 60, 5, false, 25, 65, { featureId: F }),
    score("sc-duplicates", "Data quality: duplicate broker and account records", "other", "Duplicate records", "%", 14, 2, false, 25, 70, { featureId: F }),
  ];
  p.scenarios = [
    { id: "sc-seats", label: "300 seats instead of 420 (contractors and part-timers share a lighter licence)", edits: [{ kind: "set", path: ["workloads", "crm-seats", "seats"], value: 300 }] },
    { id: "sc-late", label: "Cutover slips three months (legacy contracts renewed for a quarter)", edits: [{ kind: "shiftMonths", target: "golive", by: 3 }, { kind: "shiftMonths", target: "decommission", by: 3 }] },
    { id: "sc-price", label: "Vendor price 15% higher at renewal", edits: [{ kind: "set", path: ["workloads", "crm-seats", "cadPerSeat"], value: 158.7 }] },
  ];
  return p;
}
