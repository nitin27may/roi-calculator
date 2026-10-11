import type { Project } from "../../project.js";
import { ROLES as R, baseProject, crew, delivery, envs, line, perTxn, rateCard, reduce, res, score } from "./common.js";

/**
 * New application: a self-service claims portal and app for policyholders and brokers (report a claim, upload photos,
 * track status, message the adjuster), built on AKS behind Front Door with a WAF, with Azure SQL, Blob Storage for the
 * photos and documents, Key Vault and a second region. Ten-month build, five-year view. The saving is calls and paper
 * that no longer happen; the rest is shown in the scorecard. All figures are illustrative.
 */
export function claimsPortal(): Project {
  const B = 10, H = 60;
  const p = baseProject({
    name: "Policyholder and broker claims portal", startDate: "2027-01-01", buildMonths: B, horizonMonths: H, rampMonths: 9, contingencyPct: 15, discountRatePct: 8, hurdleRatePct: 12,
    features: [{ id: "portal", label: "Claims self-service portal", description: "Web and mobile portal to report a claim, upload photos and documents, see status, and message the adjuster. Replaces phone and paper for routine steps.", types: ["newApp"] }],
    roles: rateCard(R.pm, R.po, R.ba, R.ux, R.architect, R.techLead, R.dev, R.qa, R.devops, R.security, R.change, R.agent, R.claimsClerk),
  });
  const F = "portal";

  p.build.team = crew(B, H, [
    { role: R.pm, name: "Sandra Whitfield", phases: ["discovery", "deploy"] },
    { role: R.po, name: "Nadia Ferreira (product owner, claims)", phases: ["discovery", "deploy"] },
    { role: R.ba, name: "Aisha Khan", phases: ["discovery", "test"] },
    { role: R.ux, name: "Olivia Park (research, design system)", phases: ["discovery", "build"] },
    { role: R.architect, name: "Priya Raman", fte: 0.5, phases: ["discovery", "migration"] },
    { role: R.techLead, name: "Daniel Okafor", phases: ["design", "deploy"] },
    { role: R.dev, name: "Mei Lin Wong (back end)", phases: ["design", "migration"] },
    { role: R.dev, name: "Liam O'Connor (back end)", phases: ["design", "migration"] },
    { role: R.dev, name: "Sofia Alvarez (web)", phases: ["build", "migration"] },
    { role: R.dev, name: "Noah Fraser (web)", phases: ["build", "migration"] },
    { role: R.dev, name: "Hannah Brooks (iOS and Android)", phases: ["build", "migration"] },
    { role: R.dev, name: "Tariq Mahmood (integration with claims core)", phases: ["design", "migration"] },
    { role: R.devops, name: "Ravi Patel", phases: ["design", "deploy"] },
    { role: R.security, name: "Chloé Gagnon", fte: 0.5, phases: ["design", "deploy"] },
    { role: R.qa, name: "Grace Kim", phases: ["build", "migration"] },
    { role: R.qa, name: "Omar Haddad (accessibility, performance)", phases: ["test", "migration"] },
    { role: R.change, name: "Jennifer Wu (brokers, contact centre)", fte: 0.5, phases: ["test", "deploy"] },
    { role: R.techLead, name: "Daniel Okafor (hypercare)", phases: ["hypercare"] },
    { role: R.dev, name: "Mei Lin Wong (hypercare)", phases: ["hypercare"] },
    { role: R.dev, name: "Sofia Alvarez (hypercare)", phases: ["hypercare"] },
  ]);
  p.build.environment = [
    { id: "gh", label: "GitHub Enterprise seats", unitPriceId: "github-seat-enterprise-seats", quantity: 20 },
    { id: "copilot", label: "GitHub Copilot Business seats", unitPriceId: "copilot-business", quantity: 11 },
    { id: "devices", label: "Mobile device test farm", amountCad: 1500, cadence: "monthly" },
    { id: "a11y", label: "Accessibility and usability testing with policyholders", amountCad: 18_000, cadence: "once", month: 8 },
  ];
  p.build.deliveryCosts = [
    delivery("d-design", "Brand and design-system agency", "vendor", 65_000, 2),
    delivery("d-pentest", "Penetration test and privacy impact assessment", "vendor", 48_000, 8),
    delivery("d-store", "Mobile app store setup, certificates and release management", "other", 6_000, 9),
    delivery("d-training", "Training for adjusters, contact-centre agents and broker support", "training", 28_000, 9),
    delivery("d-comms", "Launch campaign to policyholders and brokers", "comms", 55_000, 10),
  ];

  p.environments = envs(B, { dr: 0.5 });
  const NP = ["dev", "test", "uat"], PRD = ["prod", "dr"], ALL = ["dev", "test", "uat", "prod", "dr"];
  p.resources = [
    res("fd", "Front Door Premium with WAF and bot protection", "front-door", "premium", { profiles: 1, requests10k: 9000, outGB: 5500 }, { feature: F, envs: ["prod"] }),
    res("aks-np", "AKS cluster, dev and test (Free tier)", "aks-cluster", "free", { clusters: 1 }, { feature: F, envs: ["dev", "test"] }),
    res("aks-cp", "AKS cluster control plane (Standard tier)", "aks-cluster", "standard", { clusters: 1 }, { feature: F, envs: ["uat", "prod", "dr"] }),
    res("aks-sys", "AKS system node pool (3 x D4s v5)", "vm", "d4s-v5-linux", { count: 3 }, { feature: F, envs: ALL }),
    res("aks-user-prod", "AKS user node pool (6 x D4s v5, 1-year reserved)", "vm", "d4s-v5-linux", { count: 6 }, { feature: F, envs: ["prod"], term: "ri1" }),
    res("aks-user-dr", "AKS user node pool, second region (6 x D4s v5, run at half)", "vm", "d4s-v5-linux", { count: 6 }, { feature: F, envs: ["dr"] }),
    res("aks-user-np", "AKS user node pool, non-production (6 x D4s v5)", "vm", "d4s-v5-linux", { count: 6 }, { feature: F, envs: NP }),
    res("aks-disks", "Node OS disks (Premium SSD P10)", "disk-premium-ssd", "p10", { disks: 9 }, { feature: F, envs: ["uat", "prod", "dr"] }),
    res("acr", "Azure Container Registry Standard", "container-registry", "standard", { registries: 1, extraStorageGB: 100 }, { feature: F, envs: ["prod"] }),
    res("sql", "Azure SQL Database General Purpose, zone-redundant, 8 vCores", "sql-db-vcore", "gp-gen5-zr", { vcores: 8, storageGB: 512 }, { feature: F, envs: ALL }),
    res("redis", "Azure Cache for Redis Standard C3 (sessions, status cache)", "redis-cache", "standard-c3", { caches: 1 }, { feature: F, envs: ["uat", "prod", "dr"] }),
    res("sb", "Service Bus Standard (claim events, notifications)", "service-bus", "standard", { namespaces: 1, opsM: 90 }, { feature: F, envs: ALL }),
    res("apim", "API Management Standard (claims-core and broker APIs)", "apim-gateway", "standard", { units: 1 }, { feature: F, envs: ["uat", "prod"] }),
    res("blob-photos", "Photos, video and documents uploaded by policyholders (Blob, hot, GRS, 14 TB)", "blob-storage", "hot-grs", { storageGB: 14_000, writeOps10k: 1800, readOps10k: 5200, retrievalGB: 0 }, { feature: F, envs: ["prod"] }),
    res("blob-cool", "Closed-claim media after 180 days (Blob, cool, GRS, 40 TB)", "blob-storage", "cool-grs", { storageGB: 40_000, writeOps10k: 200, readOps10k: 250, retrievalGB: 800 }, { feature: F, envs: ["prod"] }),
    res("blob-np", "Test uploads (Blob, hot, LRS)", "blob-storage", "hot-lrs", { storageGB: 1500, writeOps10k: 100, readOps10k: 200, retrievalGB: 0 }, { feature: F, envs: NP }),
    res("kv", "Key Vault Premium (signing keys, customer-managed keys)", "key-vault", "premium", { ops10k: 600, advanced10k: 20, hsmKeys: 4 }, { feature: F, envs: PRD }),
    res("kv-np", "Key Vault Standard", "key-vault", "standard", { ops10k: 80, advanced10k: 2, hsmKeys: 0 }, { feature: F, envs: NP }),
    res("def-containers", "Defender for Containers (42 vCores)", "defender-plan", "containers", { units: 42 }, { feature: F, envs: ["prod"] }),
    res("pe", "Private endpoints", "private-endpoint", "standard", { endpoints: 12, inGB: 3000, outGB: 1800 }, { feature: F, envs: PRD }),
    res("pe-np", "Private endpoints, non-production", "private-endpoint", "standard", { endpoints: 8, inGB: 200, outGB: 150 }, { feature: F, envs: NP }),
    res("law", "Log Analytics ingestion: containers, WAF and audit logs", "log-analytics-ingestion", "analytics-payg", { gb: 380, commitments: 0 }, { feature: F, envs: ["prod"] }),
    res("law-np", "Log Analytics ingestion, non-production", "log-analytics-ingestion", "analytics-payg", { gb: 70, commitments: 0 }, { feature: F, envs: NP }),
    res("appins", "Application Insights (web, mobile back end)", "application-insights", "workspace-based", { gb: 110, testsK: 260 }, { feature: F, envs: ["prod"] }),
    res("alerts", "Azure Monitor alert rules", "monitor-alerts", "log-5min", { rules: 50 }, { feature: F, envs: ["prod"] }),
    res("dns", "Azure DNS public zones", "azure-dns", "public", { zones: 3, queriesM: 40 }, { feature: F, envs: ["prod"] }),
  ];
  p.workloads = [
    { kind: "transactionFee", id: "msg", featureId: F, label: "SMS and email: one-time codes, status updates (Azure Communication Services)", volumePerMonth: 310_000, cadPerTxn: 0.011 },
    { kind: "contract", id: "idp", featureId: F, label: "Customer identity: Microsoft Entra External ID beyond the free tier", amountCad: 1_900, cadence: "monthly" },
    { kind: "contract", id: "sre", featureId: F, label: "24x7 monitoring and on-call (managed service)", amountCad: 4_800, cadence: "monthly" },
    { kind: "contract", id: "support", featureId: F, label: "Azure support plan (share allocated to the portal)", amountCad: 2_600, cadence: "monthly" },
  ];
  p.maintenance = { mode: "team", team: [
    { roleId: "dev", name: "Portal developers", people: 2, hoursPerMonth: 150, experiments: false },
    { roleId: "devops", name: "Platform / SRE share", people: 0.5, hoursPerMonth: 150, experiments: false },
    { roleId: "ux", name: "Product designer", people: 0.25, hoursPerMonth: 150, experiments: false },
  ] };

  p.currentState = { lines: [
    line("cur-status-calls", "Contact-centre calls asking for claim status (32,000 a month)", "transaction", perTxn(6.8, 32_000), reduce(35, true), { featureId: F }),
    line("cur-fnol-calls", "Reporting a claim by phone: agent intake and data entry (9,200 a month)", "transaction", perTxn(11.2, 9_200), reduce(45, true), { featureId: F }),
    line("cur-mail", "Status letters, document requests and postage (24,000 a month)", "transaction", perTxn(1.55, 24_000), reduce(55, true), { featureId: F }),
    line("cur-doc-handling", "Mailroom and scanning of supporting documents", "people", { kind: "fte", roleId: "claimsClerk", fte: 4, hoursPerMonth: 150 }, reduce(50, true), { featureId: F }),
  ] };
  p.benefits.value = [
    { id: "val-fnol-quality", label: "Complete first notice of loss: fewer follow-up calls to fix missing details", kind: "quality", featureId: F, volumePerMonth: 9_200, errorRateBeforePct: 18, errorRateAfterPct: 6, costPerError: 24, confidencePct: 70 },
    { id: "val-retention", label: "Retention: policyholders who rate the claim 9 or 10 renew more often", kind: "revenue", featureId: F, monthlyRevenue: 120_000, marginPct: 20, startMonth: 14, confidencePct: 40 },
  ];
  p.benefits.scorecard = [
    score("sc-nps", "Customer: claims satisfaction", "customer", "Transactional NPS after claim closure", "points", 22, 41, true, 30, 60, { featureId: F }),
    score("sc-fnol-time", "Speed: reporting a claim", "speed", "Minutes to report a claim", "minutes", 22, 6, false, 20, 75, { featureId: F }),
    score("sc-cycle", "Speed: days to first adjuster contact", "speed", "Days from loss report to first contact", "days", 2.8, 0.6, false, 20, 65, { featureId: F }),
    score("sc-selfserve", "Digital: claims reported online", "agility", "Share of new claims reported through the portal or app", "%", 8, 55, true, 15, 55, { featureId: F }),
    score("sc-a11y", "Compliance: accessibility", "compliance", "WCAG 2.2 AA success criteria met", "%", 0, 100, true, 15, 80, { featureId: F }),
  ];
  p.scenarios = [
    { id: "sc-slow", label: "Slow adoption: half the expected volume shifts", edits: [{ kind: "set", path: ["timeline", "adoptionRampMonths"], value: 18 }] },
    { id: "sc-late", label: "Go-live slips three months", edits: [{ kind: "shiftMonths", target: "golive", by: 3 }] },
    { id: "sc-smaller", label: "Smaller footprint (next size down)", edits: [{ kind: "lever", leverId: "skuDown" }] },
  ];
  return p;
}
