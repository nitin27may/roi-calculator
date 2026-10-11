# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Your own price for any catalogue unit price (Prices & sources, "Your price"): a negotiated rate, or a price for something the catalogue lacks such as a custom SaaS seat, which used to cost C$0 with no way to set a price. It applies to the project only, replaces the pay-as-you-go price, and is noted as a manual price.
- Hybrid Benefit for SQL Database and SQL Managed Instance: turn it on and enter your own saving on compute, because Azure publishes no compute-only price to read it from.

### Fixed

- A Windows VM on a reserved term with Hybrid Benefit now takes both (reserved price less the Windows licence part) instead of dropping Hybrid Benefit. The claims migration example moves from C$61,010 to C$57,412 a month and pays back in month 28.

### Added

Example projects and reports for each reader.

- Eight worked example projects in `examples/` (a fictional Canadian insurer): claims datacentre migration, claims replatforming to AKS, quote funnel automation, a claims self-service portal, straight-through processing, a SaaS CRM replacement, an AI intake agent on Azure and an AI notes analytics example on Snowflake Cortex. Named contributors, phases, environments, catalogue resources (AKS, Key Vault, Blob Storage and more), current-state savings, scorecards and what-if scenarios. Open them with "Open file as new project"; `pnpm examples` regenerates them and a test keeps them in step with their source.
- Report for each reader: choose Executive sponsor, Finance, Technology, Delivery or Business owner on the Report page. New sections: Team and delivery plan, and Infrastructure by environment.

- Azure price adjustment (Settings, Negotiated pricing): move every Azure list price by a percentage, negative for a discount. A manual price and Snowflake credit prices are not adjusted.

- Scenarios: two new kinds of change (labour rates, move go-live or decommission date), and a saved scenario can be renamed in place and have single changes removed.

### Fixed

- Infrastructure: the environments table shows Cost / month next to the name so it is never scrolled out of view; empty month fields say "default".
- Phones: the top bar shows only build cost and payback and the page intro is hidden, so the page starts on the first screen; larger touch targets on the view switchers; Excel export shows "Preparing Excel…".
- Number fields show a grouped copy (36,000) next to values of 10,000 or more; long project names in the sidebar have full-name tooltips.
- Prices defaults to the project's deployment once it loads, the token calculator starts on a model that deployment offers, and the "pnpm prices" developer text is gone from the app.
- The Build page opened on an empty "Engineering tools & lab" chart for projects with no AI experiments; it now says so. The one-time "cache writes and reasoning tokens" notice and the "engineering tools" line in the top bar no longer show for projects that have none of that. Before / after and By capability explain what they cover.
- Opening a project that prices a build tool, seat or fee from a resource category (for example GitHub or Power Automate seats) crashed the app until the lazy price files had loaded. The pages now wait for them.
- The "sources" count under Benefit at full adoption ignored current-state savings, value items and one-off benefits, and read "1 sources".
- The AKS hosting preset said node VMs were not in the catalogue; they are, as VM resources.

### Added (any-project work)

The any-project work (phases A0 to A15): the ROI Calculator now estimates any technology project, not only AI.

- Project types (#59): a feature is a new application, enhancement, automation, replatform or migration, SaaS replacement or AI, with nothing preselected. AI pages and menu entries appear only for projects that use AI.
- Environments and infrastructure (#57, #60, #62): environments with size, schedule and billed months, and an Infrastructure page for resources defined once and placed in environments.
- Resource catalogue (#64, #67): 79 resource types and 526 SKUs from the Azure Retail Prices API and vendor documents, with reserved terms, Azure Hybrid Benefit and dev/test pricing.
- Current state (#58): what the work costs today, line by line, with keep, reduce or retire, conditional decommissioning and dual running.
- Scorecard (#65): non-financial benefits with before and after, weight and confidence; only monetised items enter NPV and payback.
- Delivery model (#63): delivery phases, hypercare after go-live, effort as hours or people x weeks, and a delivery costs stream.
- Engineering tools & lab, and AI-assisted development (#66): tools and licences, test environments, load testing and a productivity percentage per role, with a net saving on the Summary.
- Run cost beyond AI (#61): seats and licences, vendor or support contracts and per-transaction fees.
- Generic levers (#69): reserved coverage, SKU size, non-production hours, volume, build length, go-live and decommission shifts, labour rates and adoption, with matching sensitivity drivers.
- Recipes and templates (#70): the wizard starts from the kind of change and ships eight non-AI recipes; cheques to online payments is the reference template.
- Portfolio by type (#68): group and filter by project type, with payback and scorecard columns in compare.
- Glossary terms for reserved instance, Azure Hybrid Benefit, dev/test pricing, decommission, per-transaction cost and productivity factor, grouped by topic.

### Changed

- Wording sweep (A15): the product tour is rewritten for any project (version 2, so it shows again once) and adds Infrastructure and Current state and scorecard. The Summary story describes team, build months, environments, delivery costs, go-live volume and payback for non-AI projects, and keeps the candidate-models line only when a project has a model bake-off. It no longer prints a blank or zero where a number is missing.
- "Production AI usage" is "Production usage" and the month column "AI Dev Lab" is "Engineering tools & lab", across Overview, Report, the Excel Months sheet and chart legend. Overview shows the model bake-off, harness and regression lanes only for AI projects, and a Current-state savings lane when there is data.
- Settings, Build, Run, ROI and wizard text that said "AI Dev Lab", "with AI" or "AI usage" now reads generically. The Excel summary row "of which AI Dev Lab" is unchanged.
- No figure changes: the v5 golden fixture passes unchanged.

## [1.0.0] - 2026-10-07

First public release.

### Added

- Cost and ROI engine: one monthly ledger for labour, AI Dev Lab, dev environment, run, platform, maintenance and transition costs, with payback, ROI and NPV. All prices in CAD, with the CAD/USD rate measured from Azure meters.
- Price catalogue with source, retrieval date and confidence on every entry, plus refresh scripts for the Azure Retail Prices API and the Snowflake credit table (`pnpm prices`).
- Build estimate: rate card, named people and role counts, workstreams and templates, per-workstream allocation with month windows, and the AI Dev Lab (bake-offs, harness iterations, regression, evaluation, red teaming, synthetic data, fine-tuning, coding tools) with a month plan.
- Run estimate: production workloads for speech, documents, email, embeddings, AI Search, retrieval, chat, voice and agent harnesses, with per-workload deployment (Global, Canada Regional, US Data Zone) and a Standard or Batch tier.
- Executive Summary page (#13): verdict, headline tiles, waterfall, cumulative cash line and top cost drivers.
- Ranges, IRR and CFO measures (#18): cautious, expected and optimistic cases, IRR, hurdle rate, terminal value and risk weighting.
- Benefits: benchmark library with sources and confidence, per-task, per-user-week and per-queue capabilities, avoided costs and headcount, adoption and realisation, licence overlap, sensitivity tornado, before and after view and savings levers.
- Scenarios, projects library with templates, undo and redo, and file import and export.
- Capacity (PTU) sizing with pay-as-you-go against hourly, 1-month and 1-year reservations.
- Use-case wizard and recipes (#19) and a first-run product tour (#17).
- Field help, glossary and inline validation (#15).
- Report v2 and scenario comparison (#20), with charts in the Excel export.
- Token calculator, including the guided file and agent token estimator (#25), with cache writes, reasoning tokens, language, tokenizer and long-context pricing (#14).
- Exports: Excel workbook, CSV line items, JSON project file and a printable report.
- Editable AI Dev Lab cost grid, fixed monthly allowance and AI Dev Lab settings card (#36).
- Selective build labour: exclude lines from cost and set manual hourly rates (#33).
- Snowflake Cortex credits and the CAD conversion shown on Run, Settings, Tokens and exports (#34).
- Any-project scope gap analysis (#37) and the open-source plan (#38, #39).
- Open-source files: MIT licence, Code of Conduct, Contributing, Security and Support policies, issue and pull request templates (#40).

### Changed

- Hosting, tool fees, images and PTU now flow through the ledger (#21).
- Feature model and per-workload timing (#16).
- Responsive layout, accessibility and dark mode (#22); wizard uses the benefit types from the ROI page (#23).
- Month labels and captions, an explicit cost basis on headline numbers and a pricing model setting (#28, #29).
- The sidebar lists every project as a collapsible row (#32).
- Add menus open downward when there is no room above (#35).
- Renamed the product to ROI Calculator and the packages to `@roi-calculator/*` (#52). Old project files and browser storage keys are still read.
- Internal references removed before the public announcement (#41).

### Fixed

- Review fixes: delete any project, and exclude build labour consistently in every figure (#30).
- Glossary page is scrollable (#28).
- Azure meter mappings found on the first live price refresh.
- Workbook export test types (#24).
