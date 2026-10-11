"use client";
import { deliveryTimeline, type Project } from "@roi-calculator/engine";
import { Legend, ViewToggle } from "@/components/charts";
import { calendarMonth } from "@/lib/months";

/**
 * The delivery plan over months: each delivery phase and each costed team line as a bar, with go-live marked and anything after it
 * (hypercare, a person kept on) in the production colour. A table of the same figures is one click away, and the grid scrolls sideways
 * on a narrow screen instead of squeezing the months.
 */
export function PlanTimeline({ project, className }: { project: Project; className?: string }) {
  const t = deliveryTimeline(project);
  const B = t.buildMonths;
  const cols = `minmax(150px,230px) repeat(${t.span}, minmax(24px,1fr))`;
  // Every cell is placed on an explicit row: mixing explicit columns with auto-placement lets a long label push the next row out of line.
  let row = 1;
  const nextRow = () => ++row;
  const bar = (r: number, from: number, to: number, color: string, label: string) => (
    <div role="img" aria-label={label} title={label} className="my-0.5 h-4 rounded-sm" style={{ gridColumn: `${from + 1} / ${to + 2}`, gridRow: r, background: color }} />
  );
  const rows = [...t.phases.map((b) => ({ ...b, group: "Phase" })), ...t.people.map((b) => ({ ...b, group: "Team" }))];
  const table = (
    <table className="data">
      <caption className="sr-only">Delivery plan by month</caption>
      <thead><tr><th>Item</th><th>Kind</th><th>Detail</th><th className="n">From</th><th className="n">To</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{r.label}</td><td>{r.group}</td><td>{r.sub}</td><td className="n">{r.fromMonth}</td><td className="n">{r.toMonth}</td></tr>)}</tbody>
    </table>
  );
  const total = 1 + t.phases.length + (t.people.length > 0 ? 1 : 0) + t.people.length;
  const colour = (from: number, base: string) => (from > B ? "var(--run)" : base);
  return (
    <div className={className} data-testid="plan-timeline">
      <ViewToggle table={table}>
        <Legend items={[{ label: "Delivery phase", color: "var(--build)" }, { label: "Team, during the build", color: "var(--s1)" }, { label: "After go-live", color: "var(--run)" }]} />
        <p className="mt-1 text-xs text-muted">Go-live is after month {B} ({calendarMonth(project.startDate, B + 1)}); the dashed line marks it. Month 1 is {calendarMonth(project.startDate, 1)}.</p>
        <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Delivery plan by month, scrolls sideways on a narrow screen">
          <div className="relative grid items-center gap-x-px text-xs" style={{ gridTemplateColumns: cols, minWidth: 150 + t.span * 24 }}>
            {t.span > B && <div aria-hidden className="pointer-events-none z-10" style={{ gridColumn: `${B + 2} / ${B + 3}`, gridRow: `1 / ${total + 1}`, borderLeft: "2px dashed var(--ink)", alignSelf: "stretch" }} />}
            <div className="text-muted" style={{ gridColumn: 1, gridRow: 1 }}>Month</div>
            {Array.from({ length: t.span }, (_, i) => <div key={i} className="text-center tabular-nums text-muted" style={{ gridColumn: i + 2, gridRow: 1 }} title={calendarMonth(project.startDate, i + 1)}>{i + 1}</div>)}
            {t.phases.map((b) => { const r = nextRow(); return (
              <div key={b.id} className="contents">
                <div className="truncate pr-2" style={{ gridColumn: 1, gridRow: r }} title={`${b.label}, ${b.sub}`}>{b.label}</div>
                {bar(r, b.fromMonth, b.toMonth, colour(b.fromMonth, "var(--build)"), `${b.label}, months ${b.fromMonth} to ${b.toMonth}`)}
              </div>
            ); })}
            {t.people.length > 0 && <div className="mt-2 font-semibold text-ink-2" style={{ gridColumn: `1 / ${t.span + 2}`, gridRow: nextRow() }}>Team</div>}
            {t.people.map((b) => { const r = nextRow(); return (
              <div key={b.id} className="contents">
                <div className="truncate pr-2" style={{ gridColumn: 1, gridRow: r }} title={`${b.label}, ${b.sub}`}>{b.label}</div>
                {bar(r, b.fromMonth, b.toMonth, colour(b.fromMonth, "var(--s1)"), `${b.label}, ${b.sub}, months ${b.fromMonth} to ${b.toMonth}`)}
              </div>
            ); })}
          </div>
        </div>
      </ViewToggle>
    </div>
  );
}
