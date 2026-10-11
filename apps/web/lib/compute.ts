"use client";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { loadCoreCatalog, loadResourceCategories } from "@roi-calculator/catalog";
import { DEPLOYMENT_LABEL, availableIn, buildLedger, computeRoi, roiOptions, evaluateLevers, summarize, type AzureDeployment } from "@roi-calculator/engine";
import { useStudio } from "./store";
import type { Percentile, Project } from "@roi-calculator/engine";

/**
 * The bundled CAD price catalogue (validated once). It starts without the infrastructure resource categories, which are
 * about half a megabyte of JSON; `ensureResources()` adds them in place from one lazily loaded chunk per category. Pages that
 * show resources call `useResourcesReady`, and the ledger asks for them as soon as the project has a resource.
 */
export const catalog = loadCoreCatalog();

const useResourceState = create<{ version: number; ready: boolean }>(() => ({ version: 0, ready: false }));
let started: Promise<void> | undefined;

/** Loads every resource category once and resolves when the catalogue holds them. A failed load can be retried. */
export function ensureResources(): Promise<void> {
  started ??= loadResourceCategories(catalog)
    .then(() => useResourceState.setState((s) => ({ version: s.version + 1, ready: true })))
    .catch((e: unknown) => { started = undefined; console.error("Could not load the resource prices", e); throw e; });
  return started;
}

/** True once the resource categories are in the catalogue; starts loading them when `wanted`. */
export function useResourcesReady(wanted = true): boolean {
  const ready = useResourceState((s) => s.ready);
  useEffect(() => { if (wanted && !ready) ensureResources().catch(() => undefined); }, [wanted, ready]);
  return ready;
}

/** Every catalogue price id a project points at (`unitPriceId`, `unitPriceIds`), at any depth. */
function priceIdsIn(x: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(x)) x.forEach((e) => priceIdsIn(e, out));
  else if (x && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      if (k === "unitPriceId" && typeof v === "string") out.add(v);
      else if (k === "unitPriceIds" && Array.isArray(v)) v.forEach((i) => typeof i === "string" && out.add(i));
      else priceIdsIn(v, out);
    }
  }
  return out;
}

/**
 * False while the project points at a price from a resource category that has not loaded yet (a build tool, a seat, a fee), and
 * starts loading them. Pages that read the project directly (sensitivity, scenarios, levers) wait for true, so none of them
 * meets a price the catalogue does not hold yet.
 */
export function useProjectPricesReady(project: Project): boolean {
  const ready = useResourceState((s) => s.ready);
  const missing = useMemo(() => {
    if (ready) return false;
    const have = new Set(catalog.unitPrices.map((u) => u.id));
    return [...priceIdsIn(project)].some((id) => !have.has(id));
  }, [ready, project]);
  useEffect(() => { if (missing) ensureResources().catch(() => undefined); }, [missing]);
  return !missing;
}

/** Changes when resource categories arrive, for memos that read `catalog.resourceTypes` or `catalog.unitPrices`. */
export const useResourceVersion = () => useResourceState((s) => s.version);

/** Removes every item that prices itself from `unitPriceId` (catalogue items, hosting lines, seats, fees), at any depth. */
function withoutPrice<T>(x: T, id: string): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.filter((e) => !(e && typeof e === "object" && (e as { unitPriceId?: string }).unitPriceId === id)).map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, e]) => [k, walk(e)]));
    return v;
  };
  return walk(x) as T;
}

/**
 * Builds the ledger. The resource price categories (licences, storage, network...) load lazily, and a project can price a
 * build tool or a seat from one of them. Until they arrive, an item priced from a category that is not in yet is left out and
 * loading starts, instead of the page failing; the ledger is built again when the categories land. Returns the project the
 * ledger was built from, which is what every figure derived from it (summary, ranges, sensitivity) must use too.
 */
export function ledgerFor(project: Project, percentile?: Percentile): { project: Project; ledger: ReturnType<typeof buildLedger> } {
  let q = project;
  for (let i = 0; i < 100; i++) {
    try { return { project: q, ledger: buildLedger(q, catalog, percentile) }; } catch (e) {
      const missing = /^Unknown unit price "(.+)"$/.exec(e instanceof Error ? e.message : "")?.[1];
      if (!missing || useResourceState.getState().ready) throw e;
      ensureResources().catch(() => undefined);
      q = withoutPrice(q, missing);
    }
  }
  return { project: q, ledger: buildLedger(q, catalog, percentile) };
}

export function useLedger() {
  const project = useStudio((s) => s.project);
  const percentile = useStudio((s) => s.percentile);
  useResourcesReady(true);
  const resourceVersion = useResourceVersion();
  return useMemo(() => {
    const { project: priced, ledger } = ledgerFor(project, percentile);
    const roi = computeRoi(ledger, priced.roi.basis, priced.roi.discountRatePct, roiOptions(priced));
    return { project: priced, ledger, roi };
  }, [project, percentile, resourceVersion]);
}

/**
 * The single figures behind the Summary page, the Report and the Excel export, so all three
 * always agree. Built on top of `useLedger()`'s memoised ledger and ROI.
 */
export function useSummary() {
  const { project, ledger, roi } = useLedger();
  const summary = useMemo(() => summarize(project, ledger, roi, catalog), [project, ledger, roi]);
  return { project, ledger, roi, summary };
}

export function useLevers() {
  const project = useStudio((s) => s.project);
  return useMemo(() => evaluateLevers(project, catalog), [project]);
}

type Offerable = Parameters<typeof availableIn>[0] & { id: string; label: string };

/**
 * Select options for catalogue entries: those offered under the project's deployment first, the rest
 * after them and labelled, so an existing choice stays visible while the list reads as a filter.
 */
export function deploymentOptions<T extends Offerable>(items: T[], label: (x: T) => string = (x) => x.label, deployment?: AzureDeployment) {
  const d = deployment ?? useStudio.getState().project.settings.azureDeployment;
  const short = { global: "Global", regional: "Canada Regional", dataZone: "US Data Zone" }[d];
  const ok = items.filter((x) => availableIn(x, d)), no = items.filter((x) => !availableIn(x, d));
  return [...ok.map((x) => ({ value: x.id, label: label(x) })), ...no.map((x) => ({ value: x.id, label: `${label(x)} (not offered in ${short})` }))];
}

export const deploymentName = () => DEPLOYMENT_LABEL[useStudio.getState().project.settings.azureDeployment];

export const modelOptions = (filter?: (m: (typeof catalog.chatModels)[number]) => boolean, deployment?: AzureDeployment) =>
  deploymentOptions(catalog.chatModels.filter((m) => m.lifecycle.status !== "retired" && (!filter || filter(m))), undefined, deployment);
