"use client";
import { useEffect, useState } from "react";
import { GapLines, GroupedBars } from "@/components/charts";

type Decile = { decile: number; n: number; income: number; spending: number; buffer: number; comfort: number;
  three_months: number; cushion_months: number; ei_lt3_judges: number; ei_lt3_cap: number };
type Findings = {
  deciles: Decile[];
  thermostat: { position: string; bottom20: number; top20: number; bottom20_n: number; top20_n: number }[];
  timing: { month: string; runway: number; worst_share: number }[];
  timing_n: number; n_nonpension: number;
};

const money = (v: number) => "$" + Math.round(v).toLocaleString("en-CA");
const kfmt = (v: number) => (v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v));
const signed = (v: number) => (v > 0 ? "+" : "") + Math.round(v) + "%";

export default function FindingsPage() {
  const [d, setD] = useState<Findings | null>(null);
  useEffect(() => { fetch("/findings.json").then(r => r.json()).then(setD); }, []);
  if (!d) return <p className="muted">Loading…</p>;
  const d1 = d.deciles[0], d10 = d.deciles[9];
  const worst3 = [...d.timing].sort((a, b) => a.runway - b.runway).slice(0, 3).map(t => t.month);
  const best = [...d.timing].sort((a, b) => b.runway - a.runway)[0];
  const worst = [...d.timing].sort((a, b) => a.runway - b.runway)[0];

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
          ["×1.22", "growth in savings when income doubles"],
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
        <h2 style={{ fontSize: 18, margin: 0 }}>Balances act like a thermostat, and top earners spend extra fastest</h2>
        <p style={{ color: "var(--text-2)", fontSize: 14, margin: "4px 0 8px" }}>
          Next month&apos;s money in minus money out, as a share of usual monthly income, by where the balance sits vs its usual level.
          Above zero = saving, below zero = spending down.
        </p>
        <div className="legend">
          <span><i style={{ background: "var(--series-2)" }} />Bottom 20% of earners</span>
          <span><i style={{ background: "var(--series-1)" }} />Top 20% of earners</span>
        </div>
        <GroupedBars cats={d.thermostat.map(t => t.position)} fmt={signed} labelAt={() => true}
          series={[
            { name: "Bottom 20%", color: "var(--series-2)", values: d.thermostat.map(t => t.bottom20) },
            { name: "Top 20%", color: "var(--series-1)", values: d.thermostat.map(t => t.top20) },
          ]}
          tipFor={i => { const t = d.thermostat[i]; return <><b>Balance {t.position.toLowerCase()}</b><br />Bottom 20%: <b>{signed(t.bottom20)}</b> of usual income next month<br />Top 20%: <b>{signed(t.top20)}</b></>; }} />
      </section>

      <section className="card">
        <h2 style={{ fontSize: 18, margin: 0 }}>Top earners are the most likely to run out after a layoff</h2>
        <p style={{ color: "var(--text-2)", fontSize: 14, margin: "4px 0 8px" }}>
          Share of each income group whose savings would run out within 3 months on EI if they kept spending as usual.
          The real EI maximum ($729/week in 2026) replaces only 12% of a top earner&apos;s income. With basic needs protected
          (Statistics Canada), even cutting all non-essential spending leaves 43% of the top group running out within 3 months.
        </p>
        <div className="legend">
          <span><i style={{ background: "var(--series-1)" }} />Judges&apos; rule (55% of income)</span>
          <span><i style={{ background: "var(--series-2)" }} />With the real EI maximum</span>
        </div>
        <GroupedBars cats={d.deciles.map(x => "D" + x.decile)} fmt={v => Math.round(v) + "%"}
          labelAt={(ci, si) => ci === 9 || (ci === 0 && si === 1)}
          series={[
            { name: "Judges' rule", color: "var(--series-1)", values: d.deciles.map(x => x.ei_lt3_judges) },
            { name: "Real EI maximum", color: "var(--series-2)", values: d.deciles.map(x => x.ei_lt3_cap) },
          ]}
          tipFor={i => { const x = d.deciles[i]; return <><b>Income group {x.decile}</b> ({money(x.income)}/mo)<br />Judges&apos; rule: <b>{x.ei_lt3_judges}%</b><br />Real EI maximum: <b>{x.ei_lt3_cap}%</b></>; }} />
      </section>

      <section className="card">
        <h2 style={{ fontSize: 18, margin: 0 }}>When the layoff hits changes how long savings last</h2>
        <p style={{ color: "var(--text-2)", fontSize: 14, margin: "4px 0 8px" }}>
          Median months of runway on EI (55%) by the month the job loss starts, using each customer&apos;s seasonal spending.
          The three shortest are highlighted. {worst.month} {worst.runway.toFixed(1)} vs {best.month} {best.runway.toFixed(1)} months.
        </p>
        <GroupedBars cats={d.timing.map(t => t.month)} fmt={v => v + " mo"} height={290}
          highlight={ci => worst3.includes(d.timing[ci].month)}
          labelAt={ci => worst3.includes(d.timing[ci].month) || d.timing[ci].month === best.month}
          series={[{ name: "Median runway", color: "var(--series-1)", values: d.timing.map(t => t.runway) }]}
          tipFor={i => { const t = d.timing[i]; return <><b>Layoff starts in {t.month}</b><br />Median runway: <b>{t.runway.toFixed(1)} months</b><br />Worst month for {t.worst_share}% of customers</>; }} />
      </section>

    </div>
  );
}
