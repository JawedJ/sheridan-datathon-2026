"use client";
import { useEffect, useState } from "react";
import { GapLines, MultiLine } from "@/components/charts";

type Decile = { decile: number; n: number; income: number; spending: number; buffer: number; comfort: number;
  three_months: number; cushion_months: number; ei_lt3_judges: number; ei_lt3_cap: number };
type Findings = {
  deciles: Decile[];
  windfall: { months: number[]; expected: number[]; bottom20: number[]; top20: number[]; n: number; accounts: number; typical_size: number };
  n_nonpension: number;
};

const money = (v: number) => "$" + Math.round(v).toLocaleString("en-CA");
const kfmt = (v: number) => (v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v));

export default function FindingsPage() {
  const [d, setD] = useState<Findings | null>(null);
  useEffect(() => { fetch("/findings.json").then(r => r.json()).then(setD); }, []);
  if (!d) return <p className="muted">Loading…</p>;
  const d1 = d.deciles[0], d10 = d.deciles[9];
  const w = d.windfall;
  const spentTop3 = 100 - w.top20[3];

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 940 }}>
      <div>
        <h1 style={{ fontSize: 30, lineHeight: 1.2, fontWeight: 700, margin: "4px 0 10px" }}>
          People save to a dollar number, not to a number of months, so the more you earn, the more fragile you are.
        </h1>
        <p style={{ color: "var(--text-2)", margin: 0 }}>
          From 4,500 real bank accounts (PKDD&apos;99 Financial dataset, amounts in CAD). Pensioners are left out of income
          comparisons because a job loss doesn&apos;t apply to them ({d.n_nonpension.toLocaleString()} customers).
        </p>
      </div>

      <div className="kpis">
        {[
          [d1.cushion_months.toFixed(1) + " mo", "of spending saved, lowest-earning 10%"],
          [d10.cushion_months.toFixed(1) + " mo", "of spending saved, highest-earning 10%"],
          [Math.round(d10.ei_lt3_cap) + "%", "of top earners run out within 3 months on real EI, if nothing changes"],
          [spentTop3 + "%", "of a windfall spent within 3 months by top earners"],
        ].map(([v, l]) => (
          <div key={l} className="card kpi" style={{ padding: 14 }}><div className="value" style={{ fontSize: 26 }}>{v}</div><div className="label">{l}</div></div>
        ))}
      </div>

      <section className="card">
        <h2 style={{ fontSize: 18, margin: 0 }}>Savings level off while spending keeps climbing</h2>
        <p style={{ color: "var(--text-2)", fontSize: 14, margin: "4px 0 8px" }}>
          Where each income group&apos;s balance settles (its comfort number), vs what 3 months of their spending costs.
        </p>
        <div className="legend">
          <span><i className="line" style={{ background: "var(--series-1)" }} />Where their balance settles</span>
          <span><i className="line" style={{ background: "var(--series-2)" }} />3 months of their spending</span>
        </div>
        <GapLines cats={d.deciles.map(x => "D" + x.decile)} sub={d.deciles.map(x => kfmt(x.income) + "/mo")}
          kept={d.deciles.map(x => x.comfort)} needed={d.deciles.map(x => x.three_months)} fmt={kfmt}
          tipFor={i => { const x = d.deciles[i]; return <><b>Income group {x.decile}</b> ({money(x.income)}/mo)<br />Balance settles at <b>{money(x.comfort)}</b><br />3 months of spending: <b>{money(x.three_months)}</b><br />Covers {x.cushion_months.toFixed(1)} months</>; }} />
      </section>

      <section className="card">
        <h2 style={{ fontSize: 18, margin: 0 }}>Extra money drains back to the same level, fastest for top earners</h2>
        <p style={{ color: "var(--text-2)", fontSize: 14, margin: "4px 0 8px" }}>
          After a windfall (a month bringing in about {Math.round(w.typical_size)}× their usual income), how much of the extra money is still in the
          account months later. If people saved in months, they&apos;d keep it. Instead balances drift back to their comfort number.
        </p>
        <div className="legend">
          <span><i className="line" style={{ background: "var(--text-3)" }} />Expected if they kept it</span>
          <span><i className="line" style={{ background: "var(--series-2)" }} />Lowest-earning 20%</span>
          <span><i className="line" style={{ background: "var(--series-1)" }} />Highest-earning 20%</span>
        </div>
        <MultiLine labels={w.months.map(m => (m === 0 ? "Windfall" : `${m} mo`))} fmt={v => Math.round(v) + "%"} height={300}
          ariaLabel="Share of a windfall still in the account after 1 to 6 months, by income group"
          lines={[
            { name: "Expected", color: "var(--text-3)", dash: true, values: w.expected },
            { name: "Lowest 20%", color: "var(--series-2)", values: w.bottom20 },
            { name: "Highest 20%", color: "var(--series-1)", values: w.top20 },
          ]} />
        <p className="muted" style={{ margin: "6px 0 0" }}>
          After 3 months top earners still have {w.top20[3]}% of it; the lowest earners {w.bottom20[3]}%.
        </p>
      </section>

    </div>
  );
}
