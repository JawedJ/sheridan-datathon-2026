"use client";
import { useRef, useState, type ReactNode } from "react";

const W = 860;

function niceTicks(lo: number, hi: number, n = 5): number[] {
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  const step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  const start = Math.floor(lo / step) * step, end = Math.ceil(hi / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = start; v <= end + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

/** Bar with a 4px rounded end on the value side, anchored at the baseline. */
function barPath(x: number, y0: number, y1: number, w: number): string {
  const r = Math.min(4, w / 2, Math.abs(y1 - y0));
  if (y1 <= y0) {
    return `M${x} ${y0}V${y1 + r}Q${x} ${y1} ${x + r} ${y1}H${x + w - r}Q${x + w} ${y1} ${x + w} ${y1 + r}V${y0}Z`;
  }
  return `M${x} ${y0}V${y1 - r}Q${x} ${y1} ${x + r} ${y1}H${x + w - r}Q${x + w} ${y1} ${x + w} ${y1 - r}V${y0}Z`;
}

function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; html: ReactNode } | null>(null);
  const show = (svgX: number, svgY: number, html: ReactNode) => {
    const el = ref.current; if (!el) return;
    const s = el.getBoundingClientRect().width / W;
    setTip({ x: Math.min(el.getBoundingClientRect().width - 180, svgX * s + 12), y: Math.max(0, svgY * s - 10), html });
  };
  return { ref, tip, show, hide: () => setTip(null) };
}

// ------------------------------------------------------------- balance path (engine)
export type PathPt = { k: number; label: string; balance: number };

export function BalanceChart({ pts, shockMonths, fmt }: { pts: PathPt[]; shockMonths: number; fmt: (v: number) => string }) {
  const H = 260, L = 70, R = 16, T = 14, B = 34, iw = W - L - R, ih = H - T - B;
  const { ref, tip, show, hide } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const vals = pts.map(p => p.balance);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(...vals, 1));
  const lo = ticks[0], hi = ticks.at(-1)!;
  const n = pts.length - 1;
  const X = (k: number) => L + (k / n) * iw, Y = (v: number) => T + ((hi - v) / (hi - lo)) * ih;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.k).toFixed(1)} ${Y(p.balance).toFixed(1)}`).join("");
  return (
    <div className="chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Balance month by month during the shock">
        {ticks.map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={v === 0 ? 1.25 : 1} />
            <text x={L - 8} y={Y(v) + 4} textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
        <rect x={X(0)} y={T} width={Math.max(0, X(Math.min(shockMonths, n)) - X(0))} height={ih} fill="var(--series-1)" opacity={0.07} />
        <text x={X(Math.min(shockMonths, n)) - 6} y={T + 14} textAnchor="end">shock period</text>
        {pts.filter((p, i) => i % 3 === 0).map(p => (
          <text key={p.k} x={X(p.k)} y={H - 12} textAnchor="middle">{p.label}</text>
        ))}
        <path d={d} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && (
          <>
            <line x1={X(hover)} x2={X(hover)} y1={T} y2={T + ih} stroke="var(--axis)" />
            <circle cx={X(hover)} cy={Y(pts[hover].balance)} r={4.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
          </>
        )}
        <rect x={L} y={T} width={iw} height={ih} fill="transparent"
          onMouseMove={e => {
            const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
            const x = ((e.clientX - r.left) * W) / r.width;
            const k = Math.max(0, Math.min(n, Math.round(((x - L) / iw) * n)));
            setHover(k);
            show(X(k), Y(pts[k].balance), <><b>{pts[k].label} (month {k})</b><br />Balance: <b>{fmt(pts[k].balance)}</b></>);
          }}
          onMouseLeave={() => { setHover(null); hide(); }} />
      </svg>
      {tip && <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.html}</div>}
    </div>
  );
}

// ------------------------------------------------------------- grouped bars (findings)
export type Series = { name: string; color: string; values: number[] };

export function GroupedBars({ cats, series, fmt, labelAt, highlight, tipFor, height = 320 }: {
  cats: string[]; series: Series[]; fmt: (v: number) => string;
  labelAt?: (ci: number, si: number) => boolean; highlight?: (ci: number) => boolean;
  tipFor: (ci: number) => ReactNode; height?: number;
}) {
  const H = height, L = 60, R = 16, T = 18, B = 36, iw = W - L - R, ih = H - T - B;
  const { ref, tip, show, hide } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const vals = series.flatMap(s => s.values);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals));
  const lo = ticks[0], hi = ticks.at(-1)!;
  const Y = (v: number) => T + ((hi - v) / (hi - lo)) * ih;
  const band = iw / cats.length, gap = 2;
  const bw = Math.min(28, (band * 0.68 - gap * (series.length - 1)) / series.length);
  return (
    <div className="chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        {ticks.map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={v === 0 ? 1.25 : 1} />
            <text x={L - 8} y={Y(v) + 4} textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
        {cats.map((c, ci) => {
          const x0 = L + ci * band + (band - (bw * series.length + gap * (series.length - 1))) / 2;
          return (
            <g key={c} opacity={hover === null || hover === ci ? 1 : 0.45}>
              {series.map((s, si) => {
                const v = s.values[ci], x = x0 + si * (bw + gap);
                const color = highlight ? (highlight(ci) ? s.color : "var(--muted-bar)") : s.color;
                return (
                  <g key={s.name}>
                    <path d={barPath(x, Y(0), Y(v), bw)} fill={color} />
                    {labelAt?.(ci, si) && (
                      <text className="lab" x={x + bw / 2} y={v >= 0 ? Y(v) - 6 : Y(v) + 15} textAnchor="middle" style={{ fontSize: 11.5 }}>{fmt(v)}</text>
                    )}
                  </g>
                );
              })}
              <text x={L + ci * band + band / 2} y={H - 12} textAnchor="middle">{c}</text>
            </g>
          );
        })}
        {cats.map((c, ci) => (
          <rect key={"h" + c} x={L + ci * band} y={T} width={band} height={ih} fill="transparent"
            onMouseMove={() => { setHover(ci); show(L + ci * band + band / 2, T + 10, tipFor(ci)); }}
            onMouseLeave={() => { setHover(null); hide(); }} />
        ))}
      </svg>
      {tip && <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.html}</div>}
    </div>
  );
}

// ------------------------------------------------------------- two lines with a shaded gap (findings)
export function GapLines({ cats, sub, kept, needed, fmt, tipFor }: {
  cats: string[]; sub: string[]; kept: number[]; needed: number[]; fmt: (v: number) => string; tipFor: (i: number) => ReactNode;
}) {
  const H = 340, L = 66, R = 16, T = 22, B = 50, iw = W - L - R, ih = H - T - B;
  const { ref, tip, show, hide } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const n = cats.length;
  const ticks = niceTicks(0, Math.max(...kept, ...needed) * 1.05);
  const hi = ticks.at(-1)!;
  const X = (i: number) => L + ((i + 0.5) / n) * iw, Y = (v: number) => T + ih - (v / hi) * ih;
  const line = (a: number[]) => a.map((v, i) => `${X(i)},${Y(v)}`).join(" ");
  const area = needed.map((v, i) => `${X(i)},${Y(Math.max(v, kept[i]))}`).join(" ") + " " +
    kept.map((v, i) => [X(i), Y(v)] as const).reverse().map(([x, y]) => `${x},${y}`).join(" ");
  const last = n - 1;
  return (
    <div className="chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Where balances settle vs three months of spending, by income decile">
        {ticks.map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? "var(--axis)" : "var(--grid)"} />
            <text x={L - 8} y={Y(v) + 4} textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
        {cats.map((c, i) => (
          <g key={c}>
            <text x={X(i)} y={H - 28} textAnchor="middle">{c}</text>
            <text x={X(i)} y={H - 12} textAnchor="middle" style={{ fontSize: 11, fill: "var(--text-3)" }}>{sub[i]}</text>
          </g>
        ))}
        <polygon points={area} fill="var(--series-2)" opacity={0.1} />
        <polyline points={line(needed)} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" />
        <polyline points={line(kept)} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
        {kept.map((v, i) => <circle key={"k" + i} cx={X(i)} cy={Y(v)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />)}
        {needed.map((v, i) => <circle key={"n" + i} cx={X(i)} cy={Y(v)} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />)}
        <text className="lab" x={X(last) - 10} y={Y(needed[last]) - 10} textAnchor="end">{fmt(needed[last])} needed</text>
        <text className="lab" x={X(last)} y={Y(kept[last]) + 24} textAnchor="middle">{fmt(kept[last])} kept</text>
        <text x={X(last - 1) + 4} y={(Y(needed[last - 1]) + Y(kept[last - 1])) / 2 + 4} textAnchor="middle" style={{ fill: "var(--text-3)" }}>the gap</text>
        {hover !== null && <line x1={X(hover)} x2={X(hover)} y1={T} y2={T + ih} stroke="var(--axis)" />}
        <rect x={L} y={T} width={iw} height={ih} fill="transparent"
          onMouseMove={e => {
            const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
            const x = ((e.clientX - r.left) * W) / r.width;
            const i = Math.max(0, Math.min(n - 1, Math.floor(((x - L) / iw) * n)));
            setHover(i); show(X(i), Y(Math.max(kept[i], needed[i])), tipFor(i));
          }}
          onMouseLeave={() => { setHover(null); hide(); }} />
      </svg>
      {tip && <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.html}</div>}
    </div>
  );
}
