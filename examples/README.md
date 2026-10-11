# Example projects

Eight worked projects for a fictional Canadian insurer (Maple Ridge Mutual), one for each kind of change the calculator supports, with named contributors, delivery phases, environments, catalogue Azure resources (AKS, Key Vault, Blob Storage and the rest), current-state savings, a benefit scorecard and what-if scenarios. Every figure in CAD is an illustrative assumption to replace with your own; Azure prices are the catalogue's list prices.

## Use them in the demo

1. Start the app (`pnpm dev`, then http://localhost:3000).
2. In the sidebar choose **Project file & export**, then **Open file as new project**, and pick one of the `.aicost.json` files here.
3. Walk the pages: Summary, Overview, Build, Infrastructure, Run, Value & ROI, Report.

## The projects

| File | Type | What it shows |
|---|---|---|
| `01-claims-migration-to-azure.aicost.json` | Replatform or migration | Lift and shift of 33 VMs out of a leased datacentre: ExpressRoute, Backup, Site Recovery, Key Vault, Blob archive. The case rests on the datacentre exit and an avoided hardware refresh. |
| `02-claims-replatforming-aks.aicost.json` | Replatform or migration | A claims monolith becomes services on AKS, with SQL Managed Instance, Blob Storage, Key Vault, a registry, WAF ingress and a second region. Largest build, longest payback. |
| `03-quote-funnel-automation.aicost.json` | Automation | Lead-to-quote workflows on the shared AKS platform. Staff time, rework and a retired tool, plus a conversion lift shown at half confidence. |
| `04-claims-self-service-portal.aicost.json` | New application | Customer and broker portal on AKS behind Front Door, with photo uploads in Blob Storage. Savings are calls and paper that stop. |
| `05-claims-straight-through-processing.aicost.json` | Enhancement | Rules and automated payments added to a platform that stays in place. Only the added nodes and services are costed. |
| `06-broker-crm-saas-replacement.aicost.json` | Replace with SaaS | SaaS seats cost more than the licences they replace, so the case rests on hosting, support staff, productivity and an unsupported-system risk. |
| `07-claims-intake-triage-agent-ai.aicost.json` | AI | An intake agent and an adjuster assistant: models, AI Search, the full Dev Lab, Agent Service thread storage, AKS, Key Vault and storage. |
| `08-claims-notes-snowflake-cortex-ai.aicost.json` | AI on Snowflake | Claim notes and fraud signals analysed where the data already lives: Cortex functions, AI_COMPLETE, document parsing and Cortex Search, with an Azure landing zone and the AI credit price set to an assumed contract rate. |

## Results

Computed by the engine with the bundled price catalogue. Regenerate with `pnpm examples`.

<!-- results:start -->
| Project | Type | Build (months) | Build cost | Run per month | Benefit per month | Payback | NPV at 8% | IRR |
|---|---|---|---|---|---|---|---|---|
| Claims datacentre migration to Azure | replatform | 9 | C$1.88M | C$61,010 | C$109,440 | month 30 | C$1.02M | 46% |
| Claims replatforming to AKS | replatform | 14 | C$3.81M | C$80,728 | C$203,423 | month 46 | C$0.85M | 18% |
| Quote funnel automation | automation | 5 | C$0.54M | C$20,455 | C$89,509 | month 15 | C$2.48M | 196% |
| Policyholder and broker claims portal | newApp | 10 | C$2.67M | C$69,895 | C$183,735 | month 41 | C$1.26M | 26% |
| Claims straight-through processing | enhancement | 7 | C$1.03M | C$55,545 | C$125,988 | month 26 | C$1.77M | 72% |
| Broker CRM replaced with SaaS | saas | 8 | C$1.81M | C$104,766 | C$167,333 | month 39 | C$0.81M | 27% |
| Claims intake and triage agent | ai | 7 | C$1.30M | C$28,416 | C$69,842 | month 42 | C$0.48M | 23% |
| Claims notes analytics on Snowflake Cortex | ai | 6 | C$0.98M | C$23,422 | C$80,552 | month 26 | C$1.64M | 71% |
<!-- results:end -->

## How they are made

The projects are written in TypeScript in `packages/engine/src/samples/demo/`, checked by the tests, and written here by `pnpm examples`. Edit the TypeScript, not the JSON, then run `pnpm examples`; a test fails if a file here is out of date.
