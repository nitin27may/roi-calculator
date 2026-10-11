import type { Project } from "../../project.js";
import { HOURS, ROLES as R, baseProject, crew, decommission, delivery, envs, fte, keep, line, monthly, rateCard, reduce, res, retire, score } from "./common.js";

/**
 * Replatform: the claims system (a .NET Framework monolith on Windows VMs) becomes containerised services on AKS, with the
 * database on Azure SQL Managed Instance, claim documents in Blob Storage, secrets and keys in Key Vault, and a warm
 * second region. Fourteen-month build, five-year view. All figures are illustrative.
 */
export function claimsReplatform(): Project {
  const B = 14, H = 60;
  const p = baseProject({
    name: "Claims replatforming to AKS", startDate: "2027-01-01", buildMonths: B, horizonMonths: H, rampMonths: 6, contingencyPct: 15, discountRatePct: 8, hurdleRatePct: 12,
    features: [{ id: "claims-core", label: "ClaimsNext on AKS", description: "Break the claims monolith into containerised services on AKS, move its data to Azure SQL Managed Instance and Blob Storage, and switch off the Windows VM estate.", types: ["replatform"] }],
    roles: rateCard(R.pm, R.ba, R.architect, R.techLead, R.dev, R.qa, R.devops, R.security, R.dba, R.change, R.sysadmin, R.releaseEngineer, R.legacyDev, R.adjuster),
  });
  const F = "claims-core";

  p.build.team = crew(B, H, [
    { role: R.pm, name: "Marcus Tremblay", phases: ["discovery", "deploy"] },
    { role: R.architect, name: "Priya Raman", phases: ["discovery", "migration"] },
    { role: R.ba, name: "Aisha Khan", phases: ["discovery", "test"] },
    { role: R.techLead, name: "Daniel Okafor", phases: ["design", "deploy"] },
    { role: R.dev, name: "Mei Lin Wong", phases: ["design", "migration"] },
    { role: R.dev, name: "Liam O'Connor", phases: ["design", "migration"] },
    { role: R.dev, name: "Sofia Alvarez", phases: ["build", "migration"] },
    { role: R.dev, name: "Noah Fraser", phases: ["build", "migration"] },
    { role: R.dev, name: "Hannah Brooks", phases: ["build", "migration"] },
    { role: R.dev, name: "Tariq Mahmood", phases: ["build", "migration"] },
    { role: R.devops, name: "Ravi Patel", phases: ["design", "deploy"] },
    { role: R.devops, name: "Elena Petrova (AKS platform)", phases: ["build", "deploy"] },
    { role: R.security, name: "Chloé Gagnon", fte: 0.5, phases: ["design", "deploy"] },
    { role: R.dba, name: "Tomás Silva", phases: ["design", "migration"] },
    { role: R.qa, name: "Grace Kim", phases: ["build", "migration"] },
    { role: R.qa, name: "Omar Haddad", phases: ["build", "migration"] },
    { role: R.change, name: "Jennifer Wu", fte: 0.5, phases: ["test", "deploy"] },
    { role: R.techLead, name: "Daniel Okafor (hypercare)", phases: ["hypercare"] },
    { role: R.dev, name: "Mei Lin Wong (hypercare)", phases: ["hypercare"] },
    { role: R.devops, name: "Ravi Patel (hypercare)", phases: ["hypercare"] },
  ]);

  p.build.environment = [
    { id: "gh", label: "GitHub Enterprise seats", unitPriceId: "github-seat-enterprise-seats", quantity: 22 },
    { id: "copilot", label: "GitHub Copilot Business seats", unitPriceId: "copilot-business", quantity: 14 },
    { id: "sast", label: "Static and dependency scanning (SAST, SCA)", amountCad: 2800, cadence: "monthly" },
    { id: "loadtest", label: "Azure Load Testing and tooling for the performance run", amountCad: 9000, cadence: "once", month: 11 },
  ];
  p.build.deliveryCosts = [
    delivery("d-aks", "AKS landing zone and GitOps enablement (Kubernetes partner)", "vendor", 140_000, 3),
    delivery("d-pentest", "Penetration test and security assessment", "vendor", 55_000, 12),
    delivery("d-perf", "Performance and resilience test services", "vendor", 38_000, 11),
    delivery("d-data", "Claims data migration: SQL Server to Managed Instance, three rehearsals", "dataMigration", 95_000, 12),
    delivery("d-training", "Kubernetes, GitOps and on-call training for engineering and operations", "training", 60_000, 10),
    delivery("d-comms", "Adjuster and broker communications for cutover", "comms", 18_000, 13),
  ];

  p.environments = envs(B, { dr: 0.5 });
  const NP = ["dev", "test", "uat"], PRD = ["prod", "dr"], ALL = ["dev", "test", "uat", "prod", "dr"];
  p.resources = [
    // AKS: a shared Free-tier cluster for dev and test, Standard-tier (uptime SLA) clusters for UAT, production and the second region.
    res("aks-np", "AKS cluster, dev and test (Free tier)", "aks-cluster", "free", { clusters: 1 }, { feature: F, envs: ["dev", "test"] }),
    res("aks-cp", "AKS cluster control plane (Standard tier, uptime SLA)", "aks-cluster", "standard", { clusters: 1 }, { feature: F, envs: ["uat", "prod", "dr"] }),
    res("aks-sys", "AKS system node pool (3 x D4s v5)", "vm", "d4s-v5-linux", { count: 3 }, { feature: F, envs: ALL }),
    res("aks-user-prod", "AKS user node pool, production baseline (9 x D8s v5, 1-year reserved)", "vm", "d8s-v5-linux", { count: 9 }, { feature: F, envs: ["prod"], term: "ri1" }),
    res("aks-user-dr", "AKS user node pool, second region (9 x D8s v5, scaled to half)", "vm", "d8s-v5-linux", { count: 9 }, { feature: F, envs: ["dr"] }),
    res("aks-user-np", "AKS user node pool, non-production (9 x D8s v5)", "vm", "d8s-v5-linux", { count: 9 }, { feature: F, envs: NP }),
    res("aks-disks", "Node OS disks (Premium SSD P10, 128 GiB)", "disk-premium-ssd", "p10", { disks: 12 }, { feature: F, envs: ["uat", "prod", "dr"] }),
    res("acr", "Azure Container Registry Premium with geo-replica", "container-registry", "premium", { registries: 2, extraStorageGB: 600 }, { feature: F, envs: ["prod"] }),
    res("agw", "Application Gateway WAF v2 (broker and adjuster ingress)", "app-gateway", "waf-v2", { gateways: 1, cus: 12 }, { feature: F, envs: ["uat", "prod", "dr"] }),
    // Data and messaging
    res("mi", "Azure SQL Managed Instance, General Purpose, 16 vCores", "sql-mi", "gp-gen5", { vcores: 16, storageGB: 2048 }, { feature: F, envs: ALL }),
    res("redis", "Azure Cache for Redis Premium P1", "redis-cache", "premium-p1", { caches: 1 }, { feature: F, envs: ["uat", "prod", "dr"] }),
    res("sb", "Service Bus Premium, 1 messaging unit", "service-bus", "premium", { namespaces: 1, mus: 1, opsM: 120 }, { feature: F, envs: PRD }),
    res("sb-np", "Service Bus Standard", "service-bus", "standard", { namespaces: 1, opsM: 30 }, { feature: F, envs: NP }),
    // Storage: claim documents and photos, and the archive of closed claims
    res("blob-docs", "Claim documents and photos (Blob, hot, GRS, 30 TB)", "blob-storage", "hot-grs", { storageGB: 30_000, writeOps10k: 2000, readOps10k: 6000, retrievalGB: 0 }, { feature: F, envs: ["prod"] }),
    res("blob-archive", "Closed-claim archive (Blob, cool, GRS, 110 TB)", "blob-storage", "cool-grs", { storageGB: 110_000, writeOps10k: 300, readOps10k: 500, retrievalGB: 2000 }, { feature: F, envs: ["prod"] }),
    res("blob-np", "Claim documents, non-production (Blob, hot, LRS)", "blob-storage", "hot-lrs", { storageGB: 2500, writeOps10k: 300, readOps10k: 800, retrievalGB: 0 }, { feature: F, envs: NP }),
    // Security
    res("kv", "Key Vault Premium (HSM-backed customer-managed keys, secrets)", "key-vault", "premium", { ops10k: 900, advanced10k: 25, hsmKeys: 8 }, { feature: F, envs: PRD }),
    res("kv-np", "Key Vault Standard", "key-vault", "standard", { ops10k: 120, advanced10k: 5, hsmKeys: 0 }, { feature: F, envs: NP }),
    res("def-containers", "Defender for Containers (84 vCores)", "defender-plan", "containers", { units: 84 }, { feature: F, envs: ["prod"] }),
    res("def-sql", "Defender for SQL Managed Instance", "defender-database", "sql", { servers: 1 }, { feature: F, envs: ["prod"] }),
    res("pe", "Private endpoints (storage, Key Vault, registry, Service Bus, Redis)", "private-endpoint", "standard", { endpoints: 16, inGB: 4000, outGB: 2500 }, { feature: F, envs: PRD }),
    res("pe-np", "Private endpoints, non-production", "private-endpoint", "standard", { endpoints: 10, inGB: 300, outGB: 200 }, { feature: F, envs: NP }),
    res("pip", "Public IP addresses (ingress, egress)", "public-ip", "standard-static", { ips: 4 }, { feature: F, envs: PRD }),
    // Operations
    res("law", "Log Analytics ingestion: container, platform and application logs", "log-analytics-ingestion", "analytics-payg", { gb: 650, commitments: 0 }, { feature: F, envs: ["prod"] }),
    res("law-np", "Log Analytics ingestion, non-production", "log-analytics-ingestion", "analytics-payg", { gb: 120, commitments: 0 }, { feature: F, envs: NP }),
    res("appins", "Application Insights (traces, dependencies)", "application-insights", "workspace-based", { gb: 140, testsK: 150 }, { feature: F, envs: ["prod"] }),
    res("alerts", "Azure Monitor log alert rules", "monitor-alerts", "log-5min", { rules: 80 }, { feature: F, envs: ["prod"] }),
    res("bkp", "Backup: Managed Instance long-term retention and document vault (GRS)", "backup-storage", "grs", { gb: 6000 }, { feature: F, envs: ["prod"] }),
    res("egress", "Data transfer out to brokers, partners and the internet", "internet-egress", "internet-100gb-10tb", { outGB: 4500 }, { feature: F, envs: ["prod"] }),
  ];

  p.workloads = [
    { kind: "contract", id: "support", featureId: F, label: "Azure support plan (share allocated to claims)", amountCad: 4200, cadence: "monthly" },
    { kind: "contract", id: "sre", featureId: F, label: "24x7 Kubernetes monitoring and on-call (managed service)", amountCad: 6500, cadence: "monthly" },
    { kind: "contract", id: "apm", featureId: F, label: "Observability and security tooling licences", amountCad: 3100, cadence: "monthly" },
  ];

  p.maintenance = { mode: "team", team: [
    { roleId: "devops", name: "Platform / SRE engineer", people: 1, hoursPerMonth: HOURS, experiments: false },
    { roleId: "dev", name: "Sustaining developers", people: 1.5, hoursPerMonth: HOURS, experiments: false },
  ] };

  p.currentState = { lines: [
    line("cur-hosting", "Hosting for the claims VM estate (34 VMs: compute, storage, network, backup)", "infrastructure", monthly(52_000), retire(17), { featureId: F, ...decommission("The Windows VM estate is switched off after the parallel run", true) }),
    line("cur-os-sql", "Windows Server and SQL Server Enterprise licences", "licence", monthly(21_000), reduce(55, false, 17), { featureId: F }),
    line("cur-middleware", "Application server and middleware subscription", "contract", monthly(19_800), retire(17), { featureId: F, ...decommission("The subscription is not renewed", true) }),
    line("cur-esu", "Extended security updates for out-of-support Windows and .NET", "contract", monthly(8_500), retire(17), { featureId: F }),
    line("cur-ops", "Operations: system administrators and DBAs keeping the VM estate patched", "people", fte("sysadmin", 4.5), reduce(45, true), { featureId: F }),
    line("cur-release", "Release engineering: eight-weekly manual releases and hot-fix deployments", "people", fte("releaseEngineer", 3), reduce(60, true), { featureId: F }),
    line("cur-legacy-dev", "Sustaining engineering on the legacy monolith", "people", fte("legacyDev", 7), reduce(45, true), { featureId: F, confidencePct: 80 }),
  ] };

  p.benefits.capabilities = [
    { id: "cap-speed", label: "Faster claim screens for adjusters and clerks", roleId: "adjuster", featureId: F, workloadIds: [], workstreamIds: [], hoursSavedPerMonth: 0, driver: "perUserWeek", users: 340,
      baselineMinutes: 60, savings: { conservative: 8, typical: 14, optimistic: 20 }, unit: "minutes" },
  ];
  p.benefits.value = [
    { id: "val-outages", label: "Fewer major outages (unplanned claims downtime, backlog overtime, SLA penalties)", kind: "risk", featureId: F, eventsPerYear: 5, impactCad: 120_000, reductionPct: 60, confidencePct: 60 },
  ];
  p.benefits.oneOff = [
    { id: "oo-hardware", label: "Hardware refresh avoided: two storage arrays and host servers due for replacement", amount: 420_000, month: 17 },
  ];
  p.benefits.scorecard = [
    score("sc-releases", "Delivery: releases per year", "agility", "Production releases per year", "releases", 6, 52, true, 25, 70, { featureId: F }),
    score("sc-lead", "Delivery: lead time for a change", "speed", "Days from commit to production", "days", 56, 3, false, 20, 70, { featureId: F }),
    score("sc-avail", "Reliability: availability", "customer", "Claims platform availability", "%", 99.5, 99.95, true, 20, 65, { featureId: F }),
    score("sc-latency", "Experience: claim screen speed", "employee", "95th-percentile load time of the claim screen", "seconds", 4.2, 1.1, false, 15, 60, { featureId: F }),
    score("sc-recovery", "Resilience: time to recover", "compliance", "Recovery time objective tested in a drill", "hours", 24, 2, false, 20, 75, { featureId: F }),
  ];

  p.scenarios = [
    { id: "sc-late", label: "Go-live slips three months", edits: [{ kind: "shiftMonths", target: "golive", by: 3 }] },
    { id: "sc-keep-vms", label: "VM estate stays two extra quarters (decommission +6 months)", edits: [{ kind: "shiftMonths", target: "decommission", by: 6 }] },
    { id: "sc-rates", label: "Contractor rates 15% higher", edits: [{ kind: "scaleRates", factor: 1.15 }] },
    { id: "sc-smaller", label: "Smaller footprint (next size down)", edits: [{ kind: "lever", leverId: "skuDown" }] },
  ];
  return p;
}
void keep;
