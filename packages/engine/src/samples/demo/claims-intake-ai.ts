import type { Project } from "../../project.js";
import { ROLES as R, baseProject, crew, delivery, envs, line, perTxn, rateCard, reduce, res, score } from "./common.js";

/**
 * AI: an agent reads first-notice-of-loss emails and attachments, checks coverage, classifies the claim and routes it,
 * and an assistant answers adjusters' policy-wording questions over a search index. Azure OpenAI and Claude models on
 * Foundry, Azure AI Search, an orchestration API on AKS, Cosmos DB for agent threads, Blob Storage and Key Vault.
 * Seven-month build, five-year view, with the full Dev Lab (bake-off, iterations, regression, evaluation, red teaming,
 * synthetic data). The saving is clerk and adjuster time, outsourced document keying and mis-routed claims.
 * All figures are illustrative.
 */
export function claimsIntakeAi(): Project {
  const B = 7, H = 60;
  const p = baseProject({
    name: "Claims intake and triage agent (AI)", startDate: "2027-02-01", buildMonths: B, horizonMonths: H, rampMonths: 6, contingencyPct: 15, discountRatePct: 8, hurdleRatePct: 15,
    features: [
      { id: "intake", label: "Intake and triage agent", description: "Reads claim emails and attachments, extracts the facts, checks coverage and routes the claim to the right queue.", types: ["ai"] },
      { id: "assist", label: "Adjuster policy assistant", description: "Answers adjusters' questions about policy wording and claims procedures, with sources.", types: ["ai"] },
    ],
    roles: rateCard(R.pm, R.po, R.ba, R.architect, R.aiEngineer, R.dev, R.dataEngineer, R.qa, R.devops, R.security, R.change, R.claimsClerk, R.adjuster),
  });
  // Data zone keeps processing inside one region group; check it against your privacy and regulatory position before relying on it.
  p.settings.azureDeployment = "dataZone";

  p.build.team = crew(B, H, [
    { role: R.pm, name: "Marcus Tremblay", fte: 0.5, phases: ["discovery", "deploy"] },
    { role: R.po, name: "Nadia Ferreira (product owner, claims)", fte: 0.5, phases: ["discovery", "deploy"] },
    { role: R.ba, name: "Aisha Khan (claims rules, labelling guide)", phases: ["discovery", "test"] },
    { role: R.architect, name: "Priya Raman", fte: 0.5, phases: ["discovery", "build"] },
    { role: R.aiEngineer, name: "Dr. Mateo Rossi (agent design, evaluation)", phases: ["discovery", "migration"] },
    { role: R.aiEngineer, name: "Zainab Ali (retrieval and search)", phases: ["design", "migration"] },
    { role: R.aiEngineer, name: "Henrik Larsen (tools and orchestration)", phases: ["design", "migration"] },
    { role: R.dev, name: "Liam O'Connor (claims core integration)", phases: ["design", "migration"] },
    { role: R.dataEngineer, name: "Diego Ramos (document pipeline)", phases: ["design", "migration"] },
    { role: R.devops, name: "Ravi Patel", fte: 0.5, phases: ["build", "deploy"] },
    { role: R.security, name: "Chloé Gagnon (privacy, red team)", fte: 0.5, phases: ["design", "deploy"] },
    { role: R.qa, name: "Grace Kim (labelled test set)", phases: ["build", "migration"] },
    { role: R.change, name: "Jennifer Wu", fte: 0.5, phases: ["test", "deploy"] },
    { role: R.aiEngineer, name: "Dr. Mateo Rossi (hypercare)", phases: ["hypercare"] },
    { role: R.dev, name: "Liam O'Connor (hypercare)", phases: ["hypercare"] },
  ]);
  for (const t of p.build.team) if (t.roleId === "aiEngineer" || t.roleId === "dev") t.experiments = true;

  p.harnesses = [{
    id: "triage", label: "Claims triage agent", systemPromptTokens: 2200, tools: 8, tokensPerTool: 260, userInputTokens: 2600,
    steps: 5, toolCallsPerStep: 1.4, toolResultTokens: 1800, outputPerStep: 280, finalOutputTokens: 450,
    reasoning: "low", keepReasoning: false, maxTurns: 10, maxTokensPerCall: 4096, compactAtTokens: 0, compactSummaryTokens: 3000, retryRate: 0.04,
  }];
  p.build.workstreams = [
    { id: "ws-intake", featureId: "intake", label: "Intake and triage agent", harnessIds: ["triage"], evaluated: true },
    { id: "ws-assist", featureId: "assist", label: "Adjuster policy assistant (RAG)", harnessIds: [], evaluated: true },
    { id: "ws-shared", label: "Shared ingestion, search and guardrails", harnessIds: [], evaluated: false },
  ];
  const t = p.build.team;
  const set = (name: string, allocations: { workstreamId: string; share: number }[]) => { const x = t.find((l) => l.name?.startsWith(name)); if (x) x.allocations = allocations; };
  set("Dr. Mateo Rossi (agent", [{ workstreamId: "ws-intake", share: 1 }]);
  set("Zainab Ali", [{ workstreamId: "ws-assist", share: 0.7 }, { workstreamId: "ws-shared", share: 0.3 }]);
  set("Henrik Larsen", [{ workstreamId: "ws-intake", share: 0.8 }, { workstreamId: "ws-shared", share: 0.2 }]);

  p.build.activities = [
    { kind: "bakeoff", id: "bakeoff", label: "Model bake-off on 300 labelled claims", featureId: "intake", harnessId: "triage",
      candidates: [{ modelId: "gpt-6-sol", fromMonth: 1 }, { modelId: "claude-sonnet-5-5", fromMonth: 1, toMonth: 4 }, { modelId: "gpt-6-luna", fromMonth: 1, toMonth: 2 }, { modelId: "gpt-6.1-sol", fromMonth: 2, toMonth: 3 }],
      cases: 300, repeats: 3, sweepsPerMonth: [3, 5, 4, 3, 2, 1, 1], cacheHit: 0.3, batchShare: 0 },
    { kind: "iterations", id: "iterations", label: "Harness iterations", workstreamId: "ws-intake", harnessId: "triage", modelId: "gpt-6-sol", runsPerDevPerDay: 10, subsetCases: 30, workingDays: 21, cacheHit: 0.3, monthFactors: [0.6, 0.8, 1, 1, 0.8, 0.5] },
    { kind: "regression", id: "regression", label: "Nightly regression", workstreamId: "ws-intake", harnessId: "triage", modelIds: ["gpt-6-sol"], runsPerMonth: 30, cases: 300, cacheHit: 0.5, batchShare: 0, fromMonth: 3, monthFactors: [1] },
    { kind: "evaluation", id: "evaluation", label: "Foundry evaluation", judgeModelId: "gpt-6-luna", evaluators: ["groundedness", "relevance", "coherence", "taskAdherence", "toolCallAccuracy"],
      queryTokens: 200, contextTokens: 3000, responseTokens: 500, scoredShare: { bakeoff: 1, iterations: 0.3, regression: 1 }, safetyEvaluators: 4 },
    { kind: "redteam", id: "redteam", label: "AI red teaming (prompt injection through attachments, PII leakage)", targetModelId: "gpt-6-sol", scansPerMonth: 6, categories: 5, objectivesPerCategory: 10, strategies: 5, multiTurnShare: 0.2, fromMonth: 5, monthFactors: [1] },
    { kind: "playground", id: "playground", label: "Playground and prompt work", modelId: "gpt-6-sol", callsPerDevPerDay: 35, inputTokens: 3000, outputTokens: 600, workingDays: 21, reasoning: "low", monthFactors: [1] },
    { kind: "synthetic", id: "synthetic", label: "Synthetic claim emails and attachments for edge cases", workstreamId: "ws-intake", generatorModelId: "gpt-6-sol", acceptedPerMonth: 1500, passRate: 0.6, genInputTokens: 1500, genOutputTokens: 900, reasoning: "none", judgeModelId: "gpt-6-luna", judgeInputTokens: 1300, judgeOutputTokens: 150, batchShare: 1, monthFactors: [1, 1, 0.5, 0] },
    { kind: "tooling", id: "tooling", label: "AI coding tools", copilotSeatsPerDev: 1, copilotPlan: "copilot-business", codingModelId: "claude-sonnet-5-5", codingTokensPerDevPerDay: { input: 400_000, cachedInput: 2_400_000, output: 60_000 }, workingDays: 21, monthFactors: [1] },
  ];
  p.build.aiAssist = { productivityPctByRole: { dev: 20, aiEngineer: 10, qa: 10 } };
  p.build.deliveryCosts = [
    delivery("d-label", "Labelling 1,200 historical claims for the test set (claims SMEs, contracted)", "vendor", 36_000, 2),
    delivery("d-privacy", "Privacy impact assessment and model risk review", "vendor", 28_000, 4),
    delivery("d-training", "Training for intake clerks and adjusters on reviewing agent output", "training", 22_000, 7),
    delivery("d-comms", "Staff communications", "comms", 5_000, 7),
  ];

  p.environments = envs(B, { uat: true });
  const NP = ["dev", "test", "uat"], ALL = ["dev", "test", "uat", "prod"];
  p.resources = [
    res("nodes", "Orchestration API and workers on the shared AKS cluster (3 x D4s v5, 1-year reserved)", "vm", "d4s-v5-linux", { count: 3 }, { feature: "intake", envs: ["prod"], term: "ri1" }),
    res("nodes-np", "Orchestration API, non-production (3 x D4s v5)", "vm", "d4s-v5-linux", { count: 3 }, { feature: "intake", envs: NP }),
    res("blob-intake", "Claim emails, attachments and extracted JSON (Blob, hot, ZRS, 9 TB)", "blob-storage", "hot-zrs", { storageGB: 9000, writeOps10k: 1500, readOps10k: 3500, retrievalGB: 0 }, { feature: "intake", envs: ["prod"] }),
    res("blob-archive", "Processed claim documents (Blob, cool, GRS, 20 TB)", "blob-storage", "cool-grs", { storageGB: 20_000, writeOps10k: 200, readOps10k: 150, retrievalGB: 400 }, { feature: "intake", envs: ["prod"] }),
    res("blob-np", "Test documents (Blob, hot, LRS)", "blob-storage", "hot-lrs", { storageGB: 800, writeOps10k: 60, readOps10k: 120, retrievalGB: 0 }, { feature: "intake", envs: NP }),
    res("kv", "Key Vault Premium (model and search keys, customer-managed keys)", "key-vault", "premium", { ops10k: 300, advanced10k: 10, hsmKeys: 4 }, { feature: "intake", envs: ["prod"] }),
    res("kv-np", "Key Vault Standard", "key-vault", "standard", { ops10k: 60, advanced10k: 2, hsmKeys: 0 }, { feature: "intake", envs: NP }),
    res("pe", "Private endpoints (OpenAI, AI Search, Storage, Cosmos DB, Key Vault)", "private-endpoint", "standard", { endpoints: 10, inGB: 1500, outGB: 900 }, { feature: "intake", envs: ["prod"] }),
    res("law", "Log Analytics ingestion: agent traces and audit logs", "log-analytics-ingestion", "analytics-payg", { gb: 160, commitments: 0 }, { feature: "intake", envs: ["prod"] }),
    res("law-np", "Log Analytics ingestion, non-production", "log-analytics-ingestion", "analytics-payg", { gb: 40, commitments: 0 }, { feature: "intake", envs: NP }),
    res("appins", "Application Insights", "application-insights", "workspace-based", { gb: 45, testsK: 60 }, { feature: "intake", envs: ["prod"] }),
  ];

  p.workloads = [
    { kind: "email", id: "mail", featureId: "intake", label: "Inbound claim emails", emailsPerMonth: 38_000, bodyExtractorId: "cu-doc-minimal", attachmentExtractorId: "di-read", attachmentShare: 0.45, attachmentsPerEmail: 2.1, pagesPerAttachment: 4, dedupe: 0.7, triage: { modelId: "gpt-6-luna", outputTokens: 150, reasoning: "none" } },
    { kind: "documents", id: "docs", featureId: "intake", label: "Estimates, police reports and medical forms", pagesPerMonth: 90_000, pageType: "dense", route: { type: "extract", extractorId: "di-layout", addOnIds: [] } },
    { kind: "llm", id: "extract", featureId: "intake", label: "Field extraction and coverage check", callsPerMonth: 52_000, modelId: "gpt-6-luna", inputTokens: 2_400, cachedInputTokens: 600, outputTokens: 220, batchShare: 0, reasoning: "none" },
    { kind: "agent", id: "agent", featureId: "intake", label: "Claims triage agent", harnessId: "triage", modelId: "gpt-6-sol", tasksPerMonth: 10_000, cacheHit: 0.8, toolFees: [] },
    { kind: "embeddings", id: "embed", featureId: "assist", label: "Embeddings for policy wordings and procedures", tokensPerMonth: 6_000_000, modelId: "text-embedding-3-large" },
    { kind: "aiSearch", id: "search", featureId: "assist", label: "Azure AI Search", chunks: 180_000, embeddingModelId: "text-embedding-3-large", bytesPerDim: 4, chunkTokens: 512, replicas: 2 },
    { kind: "retrieval", id: "retrieval", featureId: "assist", label: "Retrieval", queriesPerMonth: 70_000, semanticShare: 0.7 },
    { kind: "chat", id: "chat", featureId: "assist", label: "Adjuster policy assistant", users: 340, conversationsPerUser: 22, turns: 4, modelId: "gpt-6-sol", systemPromptTokens: 700, userTurnTokens: 110, assistantTurnTokens: 420, topK: 5, chunkTokens: 512, cacheHit: 0.4, reasoning: "low", language: "en" },
    { kind: "continuousEval", id: "ceval", featureId: "intake", label: "Continuous evaluation of production runs", interactionsPerMonth: 48_000, sampleShare: 0.05, judgeModelId: "gpt-6-luna", evaluators: ["groundedness", "relevance", "taskAdherence"], contextTokens: 2500, responseTokens: 400, safetyEvaluators: 0 },
    { kind: "contentSafety", id: "safety", featureId: "intake", label: "Content Safety and Prompt Shields on attachments", requestsPerMonth: 48_000, charsPerRequest: 3000, unitPriceIds: ["safety-text", "safety-prompt-shields"] },
    { kind: "hosting", id: "threads", featureId: "intake", label: "Foundry Agent Service thread storage (Cosmos DB)", requestsPerMonth: 10_000, items: [
      { basis: "fixed", id: "cosmos-throughput", label: "Cosmos DB provisioned throughput", unitPriceId: "cosmos-ru-100", quantity: 30 },
      { basis: "fixed", id: "cosmos-storage", label: "Cosmos DB thread storage", unitPriceId: "cosmos-storage-gb", quantity: 80 },
      { basis: "fixed", id: "defender-cosmos", label: "Defender for Cosmos DB", unitPriceId: "defender-cosmos-100ru", quantity: 30 },
    ] },
    { kind: "fixed", id: "platform", featureId: "assist", label: "Platform", group: "Platform", items: [
      { id: "apim", label: "API Management Basic v2 (model gateway)", unitPriceId: "apim-basic-v2", quantity: 1 },
    ] },
  ];
  p.maintenance = { mode: "team", team: [
    { roleId: "aiEngineer", name: "AI engineer: prompts, evaluation, model upgrades", people: 0.75, hoursPerMonth: 150, experiments: false },
    { roleId: "dev", name: "Integration developer", people: 0.4, hoursPerMonth: 150, experiments: false },
  ] };

  p.currentState = { lines: [
    line("cur-keying", "Outsourced document indexing and keying (90,000 pages a month)", "transaction", perTxn(0.38, 90_000), reduce(70, true), { featureId: "intake" }),
  ] };
  p.benefits.capabilities = [
    { id: "cap-intake", label: "Claims set up and routed without manual reading and keying", roleId: "claimsClerk", featureId: "intake", workloadIds: ["mail", "docs", "extract", "agent", "ceval", "safety", "threads"], workstreamIds: ["ws-intake", "ws-shared"], hoursSavedPerMonth: 0,
      driver: "perVolume", volumeFrom: "agent", handledPct: 80, baselineMinutes: 22, savings: { conservative: 5, typical: 9, optimistic: 14 }, unit: "minutes" },
    { id: "cap-assist", label: "Adjusters find policy wording and procedure answers faster", roleId: "adjuster", featureId: "assist", workloadIds: ["embed", "search", "retrieval", "chat"], workstreamIds: ["ws-assist", "ws-shared"], hoursSavedPerMonth: 0,
      driver: "perUserWeek", volumeFrom: "chat", baselineMinutes: 120, savings: { conservative: 10, typical: 18, optimistic: 25 }, unit: "minutes" },
  ];
  p.benefits.value = [
    { id: "val-misroute", label: "Fewer mis-routed claims (7.5% to 3%)", kind: "quality", featureId: "intake", capabilityId: "cap-intake", volumeFrom: "agent", errorRateBeforePct: 7.5, errorRateAfterPct: 3, costPerError: 48, confidencePct: 65 },
    { id: "val-fraud", label: "Duplicate and suspicious claim patterns flagged at intake", kind: "risk", featureId: "intake", eventsPerYear: 24, impactCad: 38_000, reductionPct: 25, confidencePct: 40 },
  ];
  p.benefits.scorecard = [
    score("sc-triage", "Speed: claim set up and assigned", "speed", "Hours from receipt to assigned adjuster", "hours", 14, 1.5, false, 35, 70, { featureId: "intake" }),
    score("sc-accuracy", "Quality: correct routing", "other", "Claims routed to the right queue first time", "%", 92.5, 97, true, 25, 65, { featureId: "intake" }),
    score("sc-adjuster", "Employee: time on admin", "employee", "Share of an adjuster's day on reading and re-keying", "%", 35, 18, false, 20, 55, { featureId: "assist" }),
    score("sc-trust", "Compliance: answers with a cited source", "compliance", "Assistant answers that cite policy text", "%", 0, 95, true, 20, 70, { featureId: "assist" }),
  ];
  p.roi.growthPctPerYear = 5;
  p.roi.transitionCosts = [{ id: "tc-parallel", label: "Parallel running: clerks double-check agent decisions for the first months", monthly: 14_000, fromMonth: 8, toMonth: 10 }];
  p.scenarios = [
    { id: "sc-mini", label: "Triage agent on the small model", edits: [{ kind: "set", path: ["workloads", "agent", "modelId"], value: "gpt-6-luna" }] },
    { id: "sc-lean", label: "Lean build: narrow bake-off, Batch regression", edits: [{ kind: "lever", leverId: "narrowBakeoff" }, { kind: "lever", leverId: "batchRegression" }] },
    { id: "sc-volume", label: "Claim volume 25% higher", edits: [{ kind: "scaleUsage", factor: 1.25 }] },
  ];
  return p;
}
