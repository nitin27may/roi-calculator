import type { Project } from "../../project.js";
import { ROLES as R, baseProject, crew, delivery, envs, fte, line, monthly, rateCard, reduce, res, retire, score } from "./common.js";

/**
 * AI on Snowflake: claim notes, documents and policy text already sit in Snowflake, so Cortex does the AI where the data is.
 * AI_CLASSIFY and AI_EXTRACT run over every adjuster note, AI_COMPLETE writes claim summaries and fraud rationales, document parsing
 * reads uploaded PDFs, and Cortex Search answers questions over policy wording. The Azure side is the landing zone: Blob Storage
 * for files before they reach a Snowflake stage, Data Factory pipelines, Key Vault, private endpoints and Power BI seats.
 * Six-month build, five-year view. The AI credit price is set to an assumed contract rate in Settings; change it to yours.
 * All figures are illustrative.
 */
export function claimsNotesSnowflake(): Project {
  const B = 6, H = 60;
  const p = baseProject({
    name: "Claims notes and fraud-signal analytics on Snowflake Cortex", startDate: "2027-03-01", buildMonths: B, horizonMonths: H, rampMonths: 5, contingencyPct: 15, discountRatePct: 8, hurdleRatePct: 15,
    features: [
      { id: "notes", label: "Claim notes intelligence", description: "Classify and extract facts from every adjuster note and uploaded document inside Snowflake, and write a claim summary for the file.", types: ["ai"] },
      { id: "fraud", label: "Fraud-signal triage", description: "Score claims for suspicious patterns with a short written rationale, and answer investigators' questions over policy wording with Cortex Search.", types: ["ai"] },
    ],
    roles: rateCard(R.pm, R.ba, R.architect, R.aiEngineer, R.dataEngineer, R.dev, R.qa, R.devops, R.security, R.change, R.siuAnalyst, R.claimsClerk),
  });
  p.settings.azureDeployment = "dataZone";
  // Snowflake runs through Azure in a regional account; the AI credit price is the assumed contract rate, not the list price.
  p.settings.snowflake = { routing: "global", edition: "enterprise", aiCreditCad: 2.55 };

  p.build.team = crew(B, H, [
    { role: R.pm, name: "Marcus Tremblay", fte: 0.5, phases: ["discovery", "deploy"] },
    { role: R.ba, name: "Aisha Khan (note coding rules)", phases: ["discovery", "test"] },
    { role: R.architect, name: "Priya Raman", fte: 0.5, phases: ["discovery", "build"] },
    { role: R.dataEngineer, name: "Diego Ramos (Snowflake pipelines, streams and tasks)", phases: ["discovery", "migration"] },
    { role: R.dataEngineer, name: "Amara Okoye (Snowflake security and roles)", fte: 0.5, phases: ["design", "test"] },
    { role: R.aiEngineer, name: "Dr. Mateo Rossi (prompts, evaluation)", phases: ["design", "migration"] },
    { role: R.aiEngineer, name: "Zainab Ali (Cortex Search)", phases: ["design", "migration"] },
    { role: R.dev, name: "Liam O'Connor (investigator app)", phases: ["build", "migration"] },
    { role: R.devops, name: "Ravi Patel (Azure landing zone)", fte: 0.5, phases: ["build", "deploy"] },
    { role: R.security, name: "Chloé Gagnon (privacy, data masking)", fte: 0.5, phases: ["design", "deploy"] },
    { role: R.qa, name: "Grace Kim (labelled test set)", phases: ["build", "migration"] },
    { role: R.change, name: "Jennifer Wu", fte: 0.5, phases: ["test", "deploy"] },
    { role: R.aiEngineer, name: "Dr. Mateo Rossi (hypercare)", phases: ["hypercare"] },
  ]);
  for (const t of p.build.team) if (t.roleId === "aiEngineer") t.experiments = true;
  p.build.environment = [
    { id: "gh", label: "GitHub Enterprise seats", unitPriceId: "github-seat-enterprise-seats", quantity: 8 },
    { id: "sf-dev", label: "Snowflake development account: warehouse and storage during the build", amountCad: 3_200, cadence: "monthly" },
  ];
  p.build.activities = [
    { kind: "playground", id: "playground", label: "Prompt work in Cortex Playground", modelId: "sf:claude-sonnet-5-5", callsPerDevPerDay: 30, inputTokens: 3000, outputTokens: 500, workingDays: 21, reasoning: "none", monthFactors: [1] },
    { kind: "tooling", id: "tooling", label: "AI coding tools", copilotSeatsPerDev: 1, copilotPlan: "copilot-business", codingModelId: "claude-sonnet-5-5", codingTokensPerDevPerDay: { input: 300_000, cachedInput: 1_800_000, output: 45_000 }, workingDays: 21, monthFactors: [1] },
  ];
  p.build.deliveryCosts = [
    delivery("d-label", "Labelling 2,000 historical claim notes for the test set (SIU analysts, contracted)", "vendor", 30_000, 2),
    delivery("d-backfill", "One-time back-fill: classify and extract 4.1 million historical notes (Cortex credits and warehouse)", "dataMigration", 38_000, 5),
    delivery("d-privacy", "Privacy impact assessment and model risk review", "vendor", 24_000, 4),
    delivery("d-training", "Training for investigators and claims analysts", "training", 14_000, 6),
  ];

  p.environments = envs(B, { uat: true });
  const NP = ["dev", "test", "uat"], ALL = ["dev", "test", "uat", "prod"];
  p.resources = [
    res("blob-landing", "Claim files landing zone before the Snowflake stage (Blob, hot, ZRS, 6 TB)", "blob-storage", "hot-zrs", { storageGB: 6000, writeOps10k: 900, readOps10k: 1800, retrievalGB: 0 }, { feature: "notes", envs: ["prod"] }),
    res("blob-np", "Test files (Blob, hot, LRS)", "blob-storage", "hot-lrs", { storageGB: 400, writeOps10k: 30, readOps10k: 60, retrievalGB: 0 }, { feature: "notes", envs: NP }),
    res("adf", "Data Factory pipelines into Snowflake (Azure IR)", "data-factory", "azure-ir", { runsK: 18, diuHours: 200, activityHours: 600 }, { feature: "notes", envs: ALL }),
    res("kv", "Key Vault Standard (Snowflake keys, key-pair auth, API secrets)", "key-vault", "standard", { ops10k: 70, advanced10k: 2, hsmKeys: 0 }, { feature: "notes", envs: ALL }),
    res("pe", "Private endpoints (storage, Key Vault, Data Factory; Snowflake Private Link)", "private-endpoint", "standard", { endpoints: 6, inGB: 700, outGB: 500 }, { feature: "notes", envs: ["prod"] }),
    res("law", "Log Analytics ingestion: pipeline and audit logs", "log-analytics-ingestion", "analytics-payg", { gb: 45, commitments: 0 }, { feature: "notes", envs: ALL }),
    res("appsvc", "Investigator web app (App Service, 2 x P1v3 Linux)", "app-service-plan", "p1v3-linux", { instances: 2 }, { feature: "fraud", envs: ["prod"] }),
    res("appsvc-np", "Investigator web app, non-production", "app-service-plan", "p1v3-linux", { instances: 1 }, { feature: "fraud", envs: NP }),
  ];

  const wh = (size: "xs" | "s" | "m" | "l" | "xl", hoursPerMonth: number) => ({ size, hoursPerMonth });
  p.workloads = [
    { kind: "snowflakeFunction", id: "classify", featureId: "notes", label: "AI_CLASSIFY on every adjuster note (coverage topic, injury, liability)", functionId: "sf-ai-classify", rowsPerMonth: 160_000, tokensPerRow: 350, hiddenPromptTokens: 150, outputTokensPerRow: 10, warehouse: wh("m", 12) },
    { kind: "snowflakeFunction", id: "extract", featureId: "notes", label: "AI_EXTRACT: parties, dates, amounts and vehicles from notes", functionId: "sf-ai-extract", rowsPerMonth: 38_000, tokensPerRow: 1_200, hiddenPromptTokens: 200, outputTokensPerRow: 160, warehouse: wh("m", 14) },
    { kind: "documents", id: "parse", featureId: "notes", label: "Parse uploaded PDFs: police reports, estimates, medical forms", pagesPerMonth: 60_000, pageType: "dense", route: { type: "extract", extractorId: "sf-parse-layout", addOnIds: [] }, warehouse: wh("s", 10) },
    { kind: "snowflakeComplete", id: "summary", featureId: "notes", label: "AI_COMPLETE: claim summary for each new file", modelId: "sf:claude-sonnet-5-5", rowsPerMonth: 10_000, inputTokens: 3_500, outputTokens: 400, warehouse: wh("m", 20) },
    { kind: "snowflakeComplete", id: "rationale", featureId: "fraud", label: "AI_COMPLETE: fraud-signal rationale on flagged claims", modelId: "sf:openai-gpt-5-mini", rowsPerMonth: 25_000, inputTokens: 1_200, outputTokens: 200, warehouse: wh("s", 16) },
    { kind: "cortexSearch", id: "search", featureId: "fraud", label: "Cortex Search over policy wording and past investigations", rows: 450_000, vectorColumns: 1, embeddingModelId: "sf:snowflake-arctic-embed-l-v2.0", avgRowBytes: 2_400, tokensPerRow: 512, changedShareMonthly: 0.04, warehouse: wh("xs", 6) },
    { kind: "seats", id: "bi", featureId: "fraud", label: "Power BI Pro for investigators and claims analysts", seats: 60, unitPriceId: "microsoft-seat-power-bi-pro-users", followsAdoption: false },
    { kind: "contract", id: "support", featureId: "notes", label: "Azure support plan (share allocated)", amountCad: 1_800, cadence: "monthly" },
  ];
  p.maintenance = { mode: "team", team: [
    { roleId: "aiEngineer", name: "AI engineer: prompts, evaluation, model upgrades", people: 0.5, hoursPerMonth: 150, experiments: false },
    { roleId: "dataEngineer", name: "Snowflake data engineer", people: 0.4, hoursPerMonth: 150, experiments: false },
  ] };

  p.currentState = { lines: [
    line("cur-vendor", "Third-party text-analytics and fraud-scoring subscription", "licence", monthly(14_500), retire(8), { featureId: "fraud" }),
    line("cur-coding", "Claims clerks hand-coding adjuster notes for reporting", "people", fte("claimsClerk", 3), reduce(60, true), { featureId: "notes" }),
  ] };
  p.benefits.capabilities = [
    { id: "cap-summary", label: "Investigators read a written summary instead of the whole file", roleId: "siuAnalyst", featureId: "fraud", workloadIds: ["summary", "rationale", "search"], workstreamIds: [], hoursSavedPerMonth: 0,
      driver: "perVolume", volumeFrom: "summary", handledPct: 60, baselineMinutes: 35, savings: { conservative: 8, typical: 14, optimistic: 20 }, unit: "minutes" },
  ];
  p.benefits.value = [
    { id: "val-coding", label: "Fewer wrongly coded notes in loss reporting (9% to 3%)", kind: "quality", featureId: "notes", volumeFrom: "extract", errorRateBeforePct: 9, errorRateAfterPct: 3, costPerError: 7, confidencePct: 70 },
    { id: "val-fraud", label: "Suspicious claims reach an investigator earlier (18 events a year, C$52,000 each, 20% prevented)", kind: "risk", featureId: "fraud", eventsPerYear: 18, impactCad: 52_000, reductionPct: 20, confidencePct: 35 },
  ];
  p.benefits.scorecard = [
    score("sc-coded", "Quality: notes coded consistently", "other", "Notes with a correct coverage topic", "%", 91, 97, true, 30, 70, { featureId: "notes" }),
    score("sc-siu", "Speed: time to first investigator view", "speed", "Days from first note to investigator review", "days", 6, 1, false, 30, 60, { featureId: "fraud" }),
    score("sc-data", "Control: data stays in Snowflake", "compliance", "Claim text copied to systems outside Snowflake", "systems", 3, 0, false, 20, 80, { featureId: "notes" }),
    score("sc-analyst", "Employee: time reading files", "employee", "Share of an investigator's day reading raw notes", "%", 45, 20, false, 20, 55, { featureId: "fraud" }),
  ];
  p.roi.growthPctPerYear = 4;
  p.scenarios = [
    { id: "sc-credit", label: "AI credit at the list price (no negotiated rate)", edits: [{ kind: "set", path: ["settings", "snowflake", "aiCreditCad"], value: 3.1 }] },
    { id: "sc-mini", label: "Summaries on the smaller model", edits: [{ kind: "set", path: ["workloads", "summary", "modelId"], value: "sf:openai-gpt-5-mini" }] },
    { id: "sc-volume", label: "Note volume 30% higher", edits: [{ kind: "scaleUsage", factor: 1.3 }] },
  ];
  return p;
}
