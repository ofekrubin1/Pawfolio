"use client";

import { fmtDate } from "@/lib/format";

/** Minimal line chart for a handful of points (weight, price per kg). */
export function LineChart({
  points,
  unit,
  color = "var(--color-brand)",
  height = 160,
}: {
  points: { date: string; value: number }[];
  unit: string;
  color?: string;
  height?: number;
}) {
  if (points.length === 0) return null;
  const W = 320;
  const H = height;
  const pad = { top: 18, bottom: 22, left: 8, right: 8 };
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.15;
  max += span * 0.15;
  const times = points.map((p) => new Date(p.date).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  // Chart reads left→right in time even in an RTL page.
  const x = (t: number) => (t1 === t0 ? W / 2 : pad.left + ((t - t0) / (t1 - t0)) * (W - pad.left - pad.right));
  const y = (v: number) => pad.top + (1 - (v - min) / (max - min)) * (H - pad.top - pad.bottom);
  const coords = points.map((p, i) => [x(times[i]), y(p.value)] as const);
  const line = coords.map(([cx, cy], i) => `${i ? "L" : "M"}${cx.toFixed(1)},${cy.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const fmt = (v: number) => v.toLocaleString("he-IL", { maximumFractionDigits: 1 });

  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`גרף, ערך אחרון ${fmt(last.value)} ${unit}`}>
        <line x1={pad.left} x2={W - pad.right} y1={H - pad.bottom} y2={H - pad.bottom} stroke="var(--color-line)" />
        {coords.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
        {coords.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i === coords.length - 1 ? 4.5 : 3} fill={color}>
            <title>{`${fmtDate(points[i].date)}: ${fmt(points[i].value)} ${unit}`}</title>
          </circle>
        ))}
        <text
          x={Math.min(Math.max(coords[coords.length - 1][0], 30), W - 30)}
          y={coords[coords.length - 1][1] - 9}
          textAnchor="middle"
          fontSize="12"
          fontWeight="600"
          fill="var(--color-fg)"
        >
          {fmt(last.value)} {unit}
        </text>
        <text x={pad.left} y={H - 6} fontSize="10" fill="var(--color-muted)">
          {fmtDate(points[0].date)}
        </text>
        {points.length > 1 && (
          <text x={W - pad.right} y={H - 6} fontSize="10" textAnchor="end" fill="var(--color-muted)">
            {fmtDate(last.date)}
          </text>
        )}
      </svg>
    </div>
  );
}
