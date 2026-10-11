import type { Project } from "../../project.js";
import { ROLES as R, baseProject, crew, decommission, delivery, envs, fte, line, monthly, rateCard, reduce, res, retire, score } from "./common.js";

/**
 * Replatform / migration, lift and shift: the claims estate (33 virtual machines on ageing VMware hosts in a leased
 * datacentre) moves unchanged to Azure virtual machines, so the datacentre, the hardware refresh and the VMware
 * subscription can go. Nine-month build, five-year view. The application is not changed; modernising it is the next
 * project (see "Claims replatforming to AKS"). All figures are illustrative.
 */
export function claimsMigration(): Project {
  const B = 9, H = 60;
  const p = baseProject({
    name: "Claims datacentre migration to Azure (rehost)", startDate: "2027-02-01", buildMonths: B, horizonMonths: H, rampMonths: 3, contingencyPct: 15, discountRatePct: 8, hurdleRatePct: 10,
    features: [{ id: "claims-estate", label: "Claims estate migration", description: "Move 33 claims virtual machines from the leased datacentre to Azure in three waves, stand up the network and DR, and exit the datacentre.", types: ["replatform"] }],
    roles: rateCard(R.pm, R.ba, R.architect, R.devops, R.dba, R.security, R.network, R.qa, R.change, R.sysadmin),
  });
  const F = "claims-estate";

  p.build.team = crew(B, H, [
    { role: R.pm, name: "Marcus Tremblay", phases: ["discovery", "deploy"] },
    { role: R.architect, name: "Priya Raman", phases: ["discovery", "migration"] },
    { role: R.ba, name: "Aisha Khan (application owners, cutover plans)", fte: 0.5, phases: ["discovery", "test"] },
    { role: R.devops, name: "Ravi Patel (landing zone, automation)", phases: ["design", "deploy"] },
    { role: R.devops, name: "Kenji Watanabe (migration waves)", phases: ["build", "migration"] },
    { role: R.devops, name: "Fatima Rahman (backup and DR)", phases: ["build", "migration"] },
    { role: R.network, name: "Luc Bouchard (ExpressRoute, firewall)", phases: ["design", "test"] },
    { role: R.dba, name: "Tomás Silva (SQL Server VMs)", phases: ["design", "migration"] },
    { role: R.security, name: "Chloé Gagnon", fte: 0.5, phases: ["design", "test"] },
    { role: R.qa, name: "Grace Kim (wave testing)", phases: ["build", "migration"] },
    { role: R.change, name: "Jennifer Wu", fte: 0.5, phases: ["test", "deploy"] },
    { role: R.devops, name: "Ravi Patel (hypercare)", phases: ["hypercare"] },
    { role: R.devops, name: "Kenji Watanabe (hypercare)", phases: ["hypercare"] },
    { role: R.dba, name: "Tomás Silva (hypercare)", fte: 0.5, phases: ["hypercare"] },
  ]);
  p.build.environment = [
    { id: "migrate", label: "Azure Migrate appliance and replication tooling", amountCad: 1800, cadence: "monthly" },
    { id: "script", label: "Infrastructure-as-code and policy scanning licences", amountCad: 1400, cadence: "monthly" },
  ];
  p.build.deliveryCosts = [
    delivery("d-partner", "Migration partner: discovery, dependency mapping and wave execution", "vendor", 210_000, 4),
    delivery("d-network", "ExpressRoute circuit provisioning and carrier cross-connects", "vendor", 24_000, 3),
    delivery("d-databox", "Offline transfer of the 60 TB file archive (Azure Data Box)", "dataMigration", 32_000, 6),
    delivery("d-exit", "Datacentre exit: decommissioning, secure data destruction, asset disposal", "other", 85_000, 10),
    delivery("d-training", "Azure operations training for the infrastructure team", "training", 25_000, 7),
    delivery("d-comms", "Application owner and business communications for the cutover weekends", "comms", 8_000, 8),
  ];

  // Dev and test are Windows VMs, which have a dev/test rate; the other environments are pay-as-you-go.
  p.environments = envs(B, { devTest: true, uat: false, dr: false });
  const NP = ["dev", "test"], PRD = ["prod"];
  p.resources = [
    // 33 Windows VMs with Hybrid Benefit (existing Windows Server and SQL Server licences with Software Assurance).
    res("vm-app", "Application tier (19 x D4s v5, Windows, Hybrid Benefit)", "vm", "d4s-v5-windows", { count: 19 }, { feature: F, envs: [...NP, ...PRD], ahb: true }),
    res("vm-batch", "Batch and integration tier (4 x D8s v5, Windows, Hybrid Benefit)", "vm", "d8s-v5-windows", { count: 4 }, { feature: F, envs: [...NP, ...PRD], ahb: true }),
    res("vm-sql", "SQL Server virtual machines (6 x E8s v5, Windows, Hybrid Benefit)", "vm", "e8s-v5-windows", { count: 6 }, { feature: F, envs: [...NP, ...PRD], ahb: true }),
    res("vm-util", "Utility servers: jump hosts, schedulers (4 x B4ms, Linux)", "vm", "b4ms-linux", { count: 4 }, { feature: F, envs: PRD }),
    res("disk-os", "OS disks (Premium SSD P10)", "disk-premium-ssd", "p10", { disks: 33 }, { feature: F, envs: [...NP, ...PRD] }),
    res("disk-data", "SQL and file data disks (Premium SSD P30, 1 TiB)", "disk-premium-ssd", "p30", { disks: 40 }, { feature: F, envs: PRD }),
    res("disk-data-np", "SQL and file data disks, non-production (Premium SSD P30)", "disk-premium-ssd", "p30", { disks: 8 }, { feature: F, envs: NP }),
    res("disk-dr", "Replica disks in the second region (Standard SSD E30)", "disk-standard-ssd", "e30", { disks: 22 }, { feature: F, envs: PRD }),
    // Storage: the 60 TB file and claim-image archive that used to sit on the SAN and tape
    res("blob-archive", "File and claim-image archive (Blob, cool, GRS, 60 TB)", "blob-storage", "cool-grs", { storageGB: 60_000, writeOps10k: 120, readOps10k: 400, retrievalGB: 1200 }, { feature: F, envs: PRD }),
    res("blob-diag", "Diagnostics, scripts and migration staging (Blob, hot, LRS)", "blob-storage", "hot-lrs", { storageGB: 2000, writeOps10k: 400, readOps10k: 600, retrievalGB: 0 }, { feature: F, envs: PRD }),
    // Resilience
    res("bkp-vm", "Azure Backup: virtual machines (27) ", "backup-instance", "azure-vm", { instances: 27 }, { feature: F, envs: PRD }),
    res("bkp-sql", "Azure Backup: SQL Server in VMs (6)", "backup-instance", "sql-in-vm", { instances: 6 }, { feature: F, envs: PRD }),
    res("bkp-store", "Backup storage (GRS vault)", "backup-storage", "grs", { gb: 14_000 }, { feature: F, envs: PRD }),
    res("asr", "Site Recovery replication to the second region (22 servers)", "site-recovery", "to-azure", { instances: 22 }, { feature: F, envs: PRD }),
    // Network and connectivity
    res("er", "ExpressRoute circuits: 2 x 1 Gbps metered (diverse paths)", "expressroute-circuit", "standard-metered-1gbps", { circuits: 2 }, { feature: F, envs: PRD }),
    res("er-gw", "ExpressRoute gateway (ErGw1AZ)", "expressroute-gateway", "ergw1az", { gateways: 1 }, { feature: F, envs: PRD }),
    res("fw", "Azure Firewall Standard (hub)", "azure-firewall", "standard", { firewalls: 1, dataGB: 9000 }, { feature: F, envs: PRD }),
    res("bastion", "Azure Bastion Standard", "bastion", "standard", { hosts: 1, extra: 0 }, { feature: F, envs: PRD }),
    res("pip", "Public IP addresses", "public-ip", "standard-static", { ips: 3 }, { feature: F, envs: PRD }),
    res("pe", "Private endpoints (storage, Key Vault, backup)", "private-endpoint", "standard", { endpoints: 6, inGB: 800, outGB: 500 }, { feature: F, envs: PRD }),
    res("egress", "Data transfer out", "internet-egress", "internet-100gb-10tb", { outGB: 1500 }, { feature: F, envs: PRD }),
    // Security and operations
    res("kv", "Key Vault Standard (disk encryption keys, TDE, certificates)", "key-vault", "standard", { ops10k: 60, advanced10k: 4, hsmKeys: 0 }, { feature: F, envs: PRD }),
    res("def-servers", "Defender for Servers Plan 2 (33 servers)", "defender-plan", "servers-p2", { units: 33 }, { feature: F, envs: PRD }),
    res("law", "Log Analytics ingestion: security and performance logs", "log-analytics-ingestion", "analytics-payg", { gb: 420, commitments: 0 }, { feature: F, envs: PRD }),
    res("law-keep", "Log Analytics: 12-month retention for audit", "log-analytics-retention", "interactive", { gb: 3000 }, { feature: F, envs: PRD }),
    res("alerts", "Azure Monitor alert rules", "monitor-alerts", "log-5min", { rules: 45 }, { feature: F, envs: PRD }),
  ];
  p.workloads = [
    { kind: "contract", id: "support", featureId: F, label: "Azure support plan (share allocated to claims)", amountCad: 3600, cadence: "monthly" },
    { kind: "contract", id: "msp", featureId: F, label: "Managed service: patching, monitoring and backup checks (after hypercare)", amountCad: 7800, cadence: "monthly", startMonth: B + 3 },
  ];
  p.maintenance = { mode: "team", team: [{ roleId: "devops", name: "Cloud operations engineer", people: 1, hoursPerMonth: 150, experiments: false }] };

  p.currentState = { lines: [
    line("cur-colo", "Datacentre space, power and cooling (8 racks, leased)", "infrastructure", monthly(23_000), retire(11), { featureId: F, ...decommission("The colocation contract is terminated after cutover", true) }),
    line("cur-hw", "Server and storage hardware maintenance and support", "contract", monthly(18_000), retire(11), { featureId: F, ...decommission("Hardware is decommissioned and the support contract lapses", true) }),
    line("cur-vmware", "Virtualisation subscription (hosts, management tooling)", "licence", monthly(26_000), retire(11), { featureId: F, ...decommission("The subscription is not renewed", true) }),
    line("cur-dr", "Disaster recovery site contract and replication", "contract", monthly(12_000), retire(11), { featureId: F, ...decommission("The DR contract is terminated once Azure Site Recovery is proven", true) }),
    line("cur-backup", "Tape backup, offsite vaulting and backup software", "contract", monthly(4_000), retire(11), { featureId: F }),
    line("cur-wan", "WAN circuits to the datacentre", "contract", monthly(9_000), reduce(60, false, 11), { featureId: F }),
    line("cur-ops", "Infrastructure operations: system administrators and storage administrator", "people", fte("sysadmin", 3), reduce(40, true), { featureId: F }),
  ] };
  p.benefits.oneOff = [
    { id: "oo-refresh", label: "Hardware refresh avoided: host servers and SAN are out of warranty in 2028", amount: 950_000, month: 10 },
    { id: "oo-resale", label: "Resale and recycling of retired hardware", amount: 60_000, month: 12 },
  ];
  p.benefits.value = [
    { id: "val-hw-failure", label: "Fewer hardware-failure outages on out-of-warranty equipment", kind: "risk", featureId: F, eventsPerYear: 0.5, impactCad: 350_000, reductionPct: 80, confidencePct: 60 },
  ];
  p.benefits.scorecard = [
    score("sc-rto", "Resilience: time to recover", "compliance", "Recovery time in the last DR test", "hours", 72, 8, false, 30, 75, { featureId: F }),
    score("sc-provision", "Agility: time to provision a server", "agility", "Days from request to a working server", "days", 45, 1, false, 25, 80, { featureId: F }),
    score("sc-restore", "Reliability: backup restore success", "other", "Test restores that succeed", "%", 91, 99, true, 25, 70, { featureId: F }),
    score("sc-exit", "Risk: datacentre exposure", "compliance", "Open audit findings on physical sites", "findings", 6, 0, false, 20, 80, { featureId: F }),
  ];
  p.scenarios = [
    { id: "sc-late", label: "Cutover slips three months (colo renewed for a quarter)", edits: [{ kind: "shiftMonths", target: "golive", by: 3 }] },
    { id: "sc-contract", label: "Colo contract has a six-month notice period", edits: [{ kind: "shiftMonths", target: "decommission", by: 6 }] },
    { id: "sc-rates", label: "Contractor rates 15% higher", edits: [{ kind: "scaleRates", factor: 1.15 }] },
  ];
  return p;
}
