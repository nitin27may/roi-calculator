import { ProjectSchema, type Project, type ProjectType } from "../../project.js";
import { claimsMigration } from "./claims-migration.js";
import { funnelAutomation } from "./funnel-automation.js";
import { claimsPortal } from "./claims-portal.js";
import { claimsStp } from "./claims-stp.js";
import { crmSaas } from "./crm-saas.js";
import { claimsIntakeAi } from "./claims-intake-ai.js";
import { claimsNotesSnowflake } from "./claims-notes-snowflake.js";
import { claimsReplatform } from "./claims-replatform.js";

/** Worked examples, one per kind of project, built from a fictional Canadian insurer. Each one is also written to examples/ as a JSON file you can open in the app. */
export interface DemoProject { id: string; file: string; label: string; type: ProjectType; detail: string; make: () => Project }

/** The text of a demo's project file: the project after the schema has filled in its defaults, as the app writes it with "Save to file" (two-space JSON), plus a final newline. */
export const demoProjectJson = (d: DemoProject): string => `${JSON.stringify(ProjectSchema.parse(d.make()), null, 2)}\n`;

export const DEMO_PROJECTS: readonly DemoProject[] = [
  { id: "claims-migration", type: "replatform", file: "01-claims-migration-to-azure", label: "Claims datacentre migration to Azure", detail: "Replatform: lift and shift 33 claims VMs out of a leased datacentre, with ExpressRoute, backup, DR, Key Vault and storage", make: claimsMigration },
  { id: "claims-replatform", type: "replatform", file: "02-claims-replatforming-aks", label: "Claims replatforming to AKS", detail: "Replatform: a claims monolith becomes containerised services on AKS with Key Vault, Blob Storage and a second region", make: claimsReplatform },
  { id: "funnel-automation", type: "automation", file: "03-quote-funnel-automation", label: "Quote funnel automation", detail: "Automation: lead-to-quote workflows on the shared AKS platform with Service Bus, SQL, Blob Storage and Key Vault; staff-time and conversion benefits", make: funnelAutomation },
  { id: "claims-portal", type: "newApp", file: "04-claims-self-service-portal", label: "Policyholder and broker claims portal", detail: "New application: self-service claims portal and app on AKS behind Front Door, with SQL, Blob Storage for photos and Key Vault", make: claimsPortal },
  { id: "claims-stp", type: "enhancement", file: "05-claims-straight-through-processing", label: "Claims straight-through processing", detail: "Enhancement: rules and automated payments added to the existing claims platform on AKS, with payment keys in Key Vault", make: claimsStp },
  { id: "crm-saas", type: "saas", file: "06-broker-crm-saas-replacement", label: "Broker CRM replaced with SaaS", detail: "Replace with SaaS: retire a self-hosted CRM and Oracle database for 420 SaaS seats, with an Azure integration layer", make: crmSaas },
  { id: "claims-intake-ai", type: "ai", file: "07-claims-intake-triage-agent-ai", label: "Claims intake and triage agent", detail: "AI: an agent reads claim emails and attachments and routes claims; an adjuster policy assistant (RAG); full Dev Lab, Agent Service, AKS, Key Vault and storage", make: claimsIntakeAi },
  { id: "claims-notes-snowflake", type: "ai", file: "08-claims-notes-snowflake-cortex-ai", label: "Claims notes analytics on Snowflake Cortex", detail: "AI on Snowflake: classify, extract, summarise and search claim notes with Cortex where the data lives, with an Azure landing zone, Key Vault and Blob Storage", make: claimsNotesSnowflake },
];
