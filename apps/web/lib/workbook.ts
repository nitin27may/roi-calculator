import type { Workbook } from "exceljs";
import { WIDE_RANGE_TEXT, avoidedMonthly, summarySections, buildLabel, labourExcluded, capabilityHours, computeAllocation, irrBand, lineItemRows, moneyBand, monthRows, pricesUsedRows, currentLines, currentStateRows, scoreItems, scorecardRows, summarize, summaryRows, type Ledger, type Project, type RoiResult, type Row } from "@roi-calculator/engine";
import type { Catalog } from "@roi-calculator/catalog";
import type { ChartMonth } from "./xlsx-chart";

/** Money with cents (unit prices, summary figures) and in whole dollars (tables of rounded figures); negatives in red. */
export const MONEY = '"C$"#,##0.00;[Red]-"C$"#,##0.00';
export const MONEY0 = '"C$"#,##0;[Red]-"C$"#,##0';
const PCT = "0.0%", PCT_POINTS = '0.0"%"', COUNT = "#,##0", UNIT_PRICE = "#,##0.0000", QTY = "#,##0.###";
const TEAL = "FF0D6B57", BAND = "FFE3F1EC";
const STREAM_NAME: Record<string, string> = { labour: "Build labour", devlab: "Engineering tools & lab", devenv: "Dev environment", run: "Production usage", platform: "Platform", maint: "Maintenance", transition: "Transition", env: "Environments", delivery: "Delivery costs" }; 

/** Summary rows whose value is an amount of money (the rest are counts, months, percentages or text). */
export const isMoneySummaryRow = (label: string): boolean =>
  /cost|benefit|^net\b|npv|saving|labour|lab\b|run\b|tools/i.test(label) && !/^payback|months|irr|^roi|rate|length|hours/i.test(label);

/** Monthly figures for the picture on the Summary sheet. */
export const chartMonths = (ledger: Ledger): ChartMonth[] =>
  ledger.months.map((m) => ({ build: m.byStream.labour + (m.byStream.delivery ?? 0), devlab: m.byStream.devlab + m.byStream.devenv, run: m.byStream.run, platform: m.byStream.platform + (m.byStream.env ?? 0), maint: m.byStream.maint + m.byStream.transition, benefit: m.benefit }));

/** Rows of the "How sure are we" table: full numbers in every case, with a plain note when the range is wide. */
export function rangeTableRows(p: Project, ledger: Ledger, roi: RoiResult, cat: Catalog): Row[] {
  const s = summarize(p, ledger, roi, cat);
  const money = (label: string, r: { low: number; expected: number; high: number }): Row => ({
    Figure: label, Cautious: Math.round(r.low), Expected: Math.round(r.expected), Optimistic: Math.round(r.high), Note: moneyBand(r).wide ? WIDE_RANGE_TEXT : "",
  });
  const rows: Row[] = [
    money("Total cost over the plan", s.range.totalCost),
    money(buildLabel(p), s.range.build),
    money("Annual run, steady state", s.range.annualRun),
    money("Total benefit over the plan", s.range.totalBenefit),
    money(`NPV at ${s.discountRatePct}%`, s.range.npv),
  ];
  if (s.range.irrPct) {
    const r = s.range.irrPct;
    rows.push({ Figure: "IRR (percent a year)", Cautious: Math.round(r.low * 10) / 10, Expected: Math.round(r.expected * 10) / 10, Optimistic: Math.round(r.high * 10) / 10, Note: irrBand(r).wide ? WIDE_RANGE_TEXT : "" });
  }
  return rows;
}

export interface WorkbookOptions {
  /** PNG of the monthly chart. Omitted when it could not be drawn. */
  chartPng?: Uint8Array | null;
}

const isoDate = (v: unknown): Date | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);

interface SheetOptions {
  /** Columns written as money with cents, and as whole dollars. */
  money?: string[]; money0?: string[];
  /** Any other column formats by header. */
  fmt?: Record<string, string>;
  /** Columns that wrap long text, and fixed widths by header. */
  wrap?: string[]; widths?: Record<string, number>;
  tab?: string; filter?: boolean; freezeCols?: number;
  /** Columns that get a SUM row under the data (a real formula, with its value cached). */
  total?: string[];
}

/**
 * Workbook: a Summary laid out in sections (with the ranges table, data bars and a chart picture), then Months, Line items, ROI by capability,
 * Assumptions, the current-state and scorecard sheets when the project has them, and Prices used. Every sheet prints landscape, one page wide,
 * with its header row repeated; numbers, percentages and dates are real values with a format, never text. exceljs has no native charts, so the
 * chart is an embedded picture and the numbers behind it stay in the Months sheet.
 */
export async function buildWorkbook(p: Project, ledger: Ledger, roi: RoiResult, cat: Catalog, opts: WorkbookOptions = {}): Promise<Workbook> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "ROI Calculator";
  wb.title = p.name;
  wb.created = new Date();
  const fillOf = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
  const setup = (ws: ReturnType<Workbook["addWorksheet"]>, portrait = false) => {
    ws.pageSetup = { paperSize: 9, orientation: portrait ? "portrait" : "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
    ws.headerFooter.oddFooter = `&L${p.name.replace(/&/g, "&&")}&CPage &P of &N&R&D`;
  };

  const sheet = (name: string, rows: Row[], o: SheetOptions = {}) => {
    const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: o.tab ?? TEAL } } });
    setup(ws);
    if (!rows.length) return ws;
    const cols = Object.keys(rows[0]!);
    ws.columns = cols.map((c) => {
      const text = o.wrap?.includes(c);
      const longest = Math.max(c.length + 2, ...rows.slice(0, 80).map((r) => String(r[c] ?? "").length + 2));
      return { header: c, key: c, width: o.widths?.[c] ?? (text ? 46 : Math.min(44, Math.max(10, longest))) };
    });
    // Blank text becomes an empty cell (not "" text) and an ISO date becomes a real date.
    const dateCol = cols.filter((c) => rows.some((r) => isoDate(r[c])));
    ws.addRows(rows.map((r) => cols.map((c) => { const v = r[c]; if (v === "" || v === undefined) return null; return dateCol.includes(c) ? isoDate(v) ?? v : v; })));
    const head = ws.getRow(1);
    head.height = 30;
    head.eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = fillOf(TEAL); cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; cell.border = { bottom: { style: "medium", color: { argb: "FF08463A" } } }; });
    const n = rows.length;
    cols.forEach((c, i) => {
      const fmt = o.fmt?.[c] ?? (o.money?.includes(c) ? MONEY : o.money0?.includes(c) ? MONEY0 : dateCol.includes(c) ? "yyyy-mm-dd" : undefined);
      for (let r = 2; r <= n + 1; r++) {
        const cell = ws.getCell(r, i + 1);
        if (fmt && (typeof cell.value === "number" || cell.value instanceof Date)) cell.numFmt = fmt;
        if (o.wrap?.includes(c)) cell.alignment = { wrapText: true, vertical: "top" };
      }
    });
    ws.views = [{ state: "frozen", xSplit: o.freezeCols ?? 0, ySplit: 1 }];
    ws.pageSetup.printTitlesRow = "1:1";
    if (o.filter) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    if (o.total?.length) {
      const tr = n + 2;
      const label = ws.getCell(tr, 1);
      label.value = "Total"; label.font = { bold: true };
      for (const c of o.total) {
        const i = cols.indexOf(c) + 1;
        if (i < 1) continue;
        const letter = ws.getColumn(i).letter;
        const sum = rows.reduce((t, r) => t + (typeof r[c] === "number" ? (r[c] as number) : 0), 0);
        const cell = ws.getCell(tr, i);
        cell.value = { formula: `SUM(${letter}2:${letter}${n + 1})`, result: sum };
        cell.numFmt = o.fmt?.[c] ?? (o.money0?.includes(c) ? MONEY0 : MONEY);
        cell.font = { bold: true };
      }
      ws.getRow(tr).eachCell((cell) => { cell.border = { top: { style: "thin" } }; });
    }
    return ws;
  };

  // ---- Summary: title, verdict, then the figures in sections
  const { verdict, sections } = summarySections(p, ledger, roi, cat);
  const summary = wb.addWorksheet("Summary", { properties: { tabColor: { argb: "FF08463A" } } });
  setup(summary, true);
  summary.columns = [{ width: 58 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 40 }];
  const span = (r: number) => summary.mergeCells(r, 1, r, 5);
  summary.getCell(1, 1).value = p.name; span(1);
  summary.getCell(1, 1).font = { bold: true, size: 18, color: { argb: "FF08463A" } };
  summary.getRow(1).height = 28;
  summary.getCell(2, 1).value = `Cost and ROI estimate · Canadian dollars · prices as of ${cat.meta.asOf} · ${p.timeline.horizonMonths}-month plan from ${p.startDate}`; span(2);
  summary.getCell(2, 1).font = { color: { argb: "FF566259" } };
  summary.getCell(4, 1).value = "Verdict";
  summary.getCell(4, 1).font = { bold: true };
  summary.getCell(4, 2).value = verdict;
  summary.mergeCells(4, 2, 4, 5);
  const positive = /NPV positive/.test(verdict);
  summary.getCell(4, 2).font = { bold: true, color: { argb: positive ? "FF0B5E49" : "FF9A4B12" } };
  summary.getCell(4, 2).fill = fillOf(positive ? "FFDCEFE8" : "FFFBE7D2");
  summary.getCell(4, 2).alignment = { vertical: "middle", wrapText: true };
  summary.getRow(4).height = 24;
  let r = 6;
  const band = (title: string) => {
    for (let c = 1; c <= 5; c++) { const cell = summary.getCell(r, c); cell.fill = fillOf(TEAL); cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; }
    summary.getCell(r, 1).value = title;
    r++;
  };
  for (const sec of sections) {
    band(sec.id);
    for (const e of sec.entries) {
      const label = summary.getCell(r, 1), val = summary.getCell(r, 2);
      label.value = e.label.replace(/^\s+/, "    ");
      label.alignment = { vertical: "top", wrapText: true };
      if (e.kind === "date") { val.value = isoDate(e.value) ?? String(e.value); val.numFmt = "yyyy-mm-dd"; }
      else { val.value = e.value; }
      if (typeof e.value === "number") val.numFmt = e.kind === "pct" ? PCT : e.kind === "count" ? COUNT : MONEY;
      val.alignment = { horizontal: typeof e.value === "number" || e.kind === "date" ? "right" : "left", vertical: "top", wrapText: true };
      if (e.kind === "text" && String(e.value).length > 24) { summary.mergeCells(r, 2, r, 5); summary.getRow(r).height = Math.min(60, 15 * Math.ceil(String(e.value).length / 70)); }
      r++;
    }
    r++;
  }
  band("How sure are we: the three cases, in full numbers");
  const table = rangeTableRows(p, ledger, roi, cat);
  const cols = ["Figure", "Cautious", "Expected", "Optimistic", "Note"];
  cols.forEach((c, i) => { const cell = summary.getCell(r, i + 1); cell.value = c; cell.font = { bold: true }; cell.fill = fillOf(BAND); cell.alignment = { horizontal: i === 0 || i === 4 ? "left" : "right" }; });
  r++;
  const first = r;
  const irrRow = table.findIndex((x) => String(x.Figure).startsWith("IRR"));
  table.forEach((row, i) => {
    cols.forEach((c, j) => {
      const cell = summary.getCell(r, j + 1);
      cell.value = (row[c] === "" ? null : row[c]) as string | number | null;
      if (j >= 1 && j <= 3) cell.numFmt = i === irrRow ? PCT_POINTS : MONEY0;
      if (j === 4) cell.alignment = { wrapText: true, vertical: "top" };
    });
    r++;
  });
  const last = r - 1;
  // Data bars per row group: the money rows share one scale, so a long bar always means a bigger amount.
  const moneyLast = irrRow === -1 ? last : first + irrRow - 1;
  summary.addConditionalFormatting({
    ref: `B${first}:D${moneyLast}`,
    rules: [{ type: "dataBar", priority: 1, minLength: 0, maxLength: 100, gradient: false, cfvo: [{ type: "num", value: 0 }, { type: "max" }], color: { argb: "FF1F8F6F" } } as never],
  });
  if (irrRow !== -1) {
    summary.addConditionalFormatting({
      ref: `B${first + irrRow}:D${first + irrRow}`,
      rules: [{ type: "dataBar", priority: 2, minLength: 0, maxLength: 100, gradient: false, cfvo: [{ type: "num", value: 0 }, { type: "max" }], color: { argb: "FF2F6FD0" } } as never],
    });
  }
  if (opts.chartPng) {
    const id = wb.addImage({ buffer: opts.chartPng as unknown as ArrayBuffer, extension: "png" });
    r += 1;
    summary.getCell(r, 1).value = "Chart: monthly cost and benefit (a picture; the numbers are in the Months sheet)";
    summary.getCell(r, 1).font = { italic: true, color: { argb: "FF566259" } };
    summary.addImage(id, { tl: { col: 0, row: r }, ext: { width: 720, height: 320 } });
  }
  summary.views = [{ state: "frozen", ySplit: 4 }];

  // ---- Months
  const months = monthRows(ledger, roi).map((m) => ({ ...m, Phase: m.Phase === "build" ? "Build" : "Production" }));
  const monthMoney = Object.keys(months[0] ?? {}).filter((k) => !["Month", "Date", "Phase", "Adoption"].includes(k));
  sheet("Months", months, {
    money0: monthMoney, fmt: { Adoption: "0%", Month: "0" }, freezeCols: 2, tab: "FF2F6FD0",
    total: monthMoney.filter((k) => k !== "Cumulative net"),
  });

  // ---- Line items: plain stream names, a filter, full-precision prices
  const items = lineItemRows(ledger).map((l) => ({ ...l, Stream: STREAM_NAME[String(l.Stream)] ?? l.Stream, Phase: l.Phase === "build" ? "Build" : "Production" }));
  sheet("Line items", items, { money: ["Cost (CAD)", "CAD per credit"], fmt: { "Unit price (CAD)": UNIT_PRICE, Quantity: QTY, Credits: QTY, Month: "0" }, filter: true, freezeCols: 0, wrap: ["Formula"], widths: { Formula: 60, Item: 48, Component: 26 }, tab: "FF2F6FD0" });

  // ---- ROI by capability, with totals that tie to the Summary
  const a = computeAllocation(p, ledger, p.roi.basis);
  const capRows: Row[] = [
    ...a.capabilities.map((c) => ({ Capability: c.label, Benefit: Math.round(c.benefit), "Direct cost": Math.round(c.direct), "Shared cost": Math.round(c.shared), Net: Math.round(c.net), ROI: c.roi ?? "" })),
    { Capability: `Project-level benefits (avoided costs, one-offs${currentLines(p).length > 0 ? ", current-state savings" : ""})`, Benefit: Math.round(a.projectBenefit), "Direct cost": "", "Shared cost": "", Net: "", ROI: "" },
    { Capability: "Cost not linked to a capability (see the allocation note below)", Benefit: "", "Direct cost": Math.round(a.unallocated.cost), "Shared cost": "", Net: "", ROI: "" },
  ];
  const caps = sheet("ROI by capability", capRows, { money0: ["Benefit", "Direct cost", "Shared cost", "Net"], fmt: { ROI: "0%" }, wrap: ["Capability"], widths: { Capability: 60 }, total: ["Benefit", "Direct cost", "Shared cost"], tab: "FF2F6FD0" });
  const note = caps.rowCount + 2;
  caps.getCell(note, 1).value = "Workload costs, and the build cost of linked workstreams, follow the links set on each capability. Build, platform, maintenance and transition costs are spread in proportion to each capability's direct cost. Allocated plus unallocated equals the total cost.";
  caps.mergeCells(note, 1, note, 6);
  caps.getCell(note, 1).alignment = { wrapText: true, vertical: "top" };
  caps.getRow(note).height = 44;

  sheet("Assumptions", [
    ...p.rateCard.map((x) => ({ Section: "Rate card", Item: x.label, Value: x.hourlyRate, Unit: labourExcluded(p) ? "CAD/hour (not costed: build labour excluded)" : "CAD/hour" })),
    ...p.build.team.map((t) => ({ Section: "Build team", Item: `${t.name ? `${t.name}, ` : ""}${t.phase ?? "Build"}: ${p.rateCard.find((x) => x.id === t.roleId)?.label}`, Value: t.people, Unit: `people, months ${t.fromMonth ?? 1}–${t.toMonth ?? p.timeline.buildMonths}${labourExcluded(p) ? " (labour not costed: build labour excluded)" : t.costed === false ? " (not costed: line excluded)" : ""}${t.rateOverride !== undefined ? `, manual rate CAD ${t.rateOverride}/hour` : ""}` })),
    ...p.benefits.capabilities.map((c) => { const h = capabilityHours(p, c, cat.benchmarks); return { Section: "Time saved", Item: c.label, Value: Math.round(h.net * 10) / 10, Unit: `net hours/month at full rollout: ${h.formula}` }; }),
    ...p.benefits.avoidedCosts.map((c) => ({ Section: "Avoided cost", Item: c.label, Value: Math.round(avoidedMonthly(p, c)), Unit: `${c.fte !== undefined ? `${c.fte} FTE, ` : ""}CAD/month from month ${c.startMonth ?? p.timeline.buildMonths + 1}` })),
    { Section: "ROI", Item: "Benefit preset", Value: p.roi.benefitPreset, Unit: "" },
    { Section: "ROI", Item: "Growth per year", Value: p.roi.growthPctPerYear, Unit: "%" },
    { Section: "ROI", Item: "Rate escalation per year", Value: p.roi.rateEscalationPctPerYear, Unit: "%" },
    { Section: "ROI", Item: "Discount rate", Value: p.roi.discountRatePct, Unit: "%" },
  ], { wrap: ["Unit", "Item"], widths: { Unit: 70, Item: 52 }, filter: true, tab: "FF8A6A3A" });
  // Only for projects that itemise what the work costs today, so other workbooks keep their sheets.
  if (currentLines(p).length > 0) sheet("Current state", currentStateRows(p), { money0: ["Cost per month today (CAD)", "Saving per month, change in full effect (CAD)"], wrap: ["Item", "Basis", "Change"], widths: { Item: 50, Basis: 34, Change: 40 }, tab: "FF8A6A3A" });
  // Only for projects with scorecard items; non-monetised items are listed but add nothing to the financial figures.
  if (scoreItems(p).length > 0) sheet("Scorecard", scorecardRows(p), { money0: ["Value per month, full rollout (CAD)"], fmt: { "Improvement (%)": PCT_POINTS, "Weight (%)": '0"%"', "Confidence (%)": '0"%"' }, wrap: ["Item", "Measure"], widths: { Item: 40, Measure: 44 }, tab: "FF8A6A3A" });
  // Prices used: the item first, the catalogue id last, and links that open.
  const prices = pricesUsedRows(ledger, cat).map((x) => ({ Item: x.Item, Type: x.Type, Source: x.Source, Confidence: x.Confidence, Retrieved: x.Retrieved, URL: x.URL, Id: x.Id }));
  const pu = sheet("Prices used", prices, { filter: true, widths: { Item: 56, URL: 50 }, tab: "FF7C97A0" });
  const urlCol = Object.keys(prices[0] ?? {}).indexOf("URL") + 1;
  if (urlCol > 0) for (let i = 0; i < prices.length; i++) { const u = String(prices[i]!.URL ?? ""); if (/^https?:\/\//.test(u)) pu.getCell(i + 2, urlCol).value = { text: u, hyperlink: u }; }
  return wb;
}
