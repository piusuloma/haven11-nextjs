"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";

/**
 * Compact date-range filter — preset chips + two date inputs. Designed so a
 * non-technical operator can land on the right window in one click without
 * thinking about calendars.
 *
 * Returns ISO `YYYY-MM-DD` strings for `start` and `end` (both inclusive).
 * `null` on either side means open-ended on that side.
 */
export type DateRange = { start: string | null; end: string | null };

const TODAY = () => new Date().toISOString().slice(0, 10);
const DAYS_AGO = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

/** Preset ranges — the labels match what Nigerian operators actually say. */
const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "Today",         range: () => ({ start: TODAY(),       end: TODAY() }) },
  { label: "Yesterday",     range: () => ({ start: DAYS_AGO(1),   end: DAYS_AGO(1) }) },
  { label: "Last 7 days",   range: () => ({ start: DAYS_AGO(6),   end: TODAY() }) },
  { label: "Last 30 days",  range: () => ({ start: DAYS_AGO(29),  end: TODAY() }) },
  { label: "This month",    range: () => {
      const d = new Date();
      const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
      return { start: first, end: TODAY() };
  } },
  { label: "Last month",    range: () => {
      const d = new Date();
      const first = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10);
      const last  = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);
      return { start: first, end: last };
  } },
  { label: "All time",      range: () => ({ start: null, end: null }) },
];

export function DateRangePicker({
  value, onChange, className = "",
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const summary = summariseRange(value);

  function pickPreset(p: typeof PRESETS[number]) {
    onChange(p.range());
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface"
      >
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        {summary}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-border bg-card shadow-xl p-3 space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => {
                const active = isSameRange(value, p.range());
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => pickPreset(p)}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium ${active ? "bg-primary text-primary-foreground" : "bg-surface text-foreground/70 hover:bg-surface/70"}`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Custom range</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">From</span>
                  <input
                    type="date"
                    value={value.start ?? ""}
                    onChange={(e) => onChange({ ...value, start: e.target.value || null })}
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">To</span>
                  <input
                    type="date"
                    value={value.end ?? ""}
                    onChange={(e) => onChange({ ...value, end: e.target.value || null })}
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                  />
                </label>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function summariseRange(r: DateRange): string {
  if (!r.start && !r.end) return "All time";
  // Match against presets for nice labels.
  for (const p of PRESETS) {
    if (isSameRange(r, p.range())) return p.label;
  }
  if (r.start && r.end && r.start === r.end) return r.start;
  return `${r.start ?? "…"} → ${r.end ?? "…"}`;
}

function isSameRange(a: DateRange, b: DateRange): boolean {
  return a.start === b.start && a.end === b.end;
}

/** Predicate factory: does a timestamp fall inside this range (both ends inclusive)? */
export function inRange(ts: number, r: DateRange): boolean {
  if (r.start && ts < new Date(r.start).getTime()) return false;
  if (r.end && ts > new Date(r.end).getTime() + 86400_000 - 1) return false;
  return true;
}
