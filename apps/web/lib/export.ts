"use client";
import { lineItemRows, toCsv, type Ledger, type Project, type RoiResult } from "@roi-calculator/engine";
import { catalog, ensureResources } from "./compute";
import { buildWorkbook, chartMonths } from "./workbook";
import { renderMonthlyChartPng } from "./xlsx-chart";

/** File-name part from the project name: lower case, runs of other characters become one dash, no dash at either end. */
export const slug = (p: Pick<Project, "name">) => p.name.replace(/[^\w-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "project";

export function download(name: string, data: BlobPart, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportCsv(p: Project, ledger: Ledger) {
  // A byte order mark makes Excel on Windows read the file as UTF-8, so "×" and "→" in the formulas show correctly.
  download(`${slug(p)}-line-items.csv`, `\uFEFF${toCsv(lineItemRows(ledger))}`, "text/csv;charset=utf-8");
}

/** Downloads the workbook (see buildWorkbook for what is in it). */
export async function exportXlsx(p: Project, ledger: Ledger, roi: RoiResult) {
  await ensureResources();
  const chartPng = await renderMonthlyChartPng(chartMonths(ledger)).catch(() => null);
  const wb = await buildWorkbook(p, ledger, roi, catalog, { chartPng });
  const buf = await wb.xlsx.writeBuffer();
  download(`${slug(p)}.xlsx`, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
