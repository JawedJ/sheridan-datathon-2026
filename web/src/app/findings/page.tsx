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
        <Caveats title="Before you read the charts" items={[
          <>The data is the PKDD&apos;99 Czech bank dataset (1990s), with dates moved to 2020–2025 and amounts converted to CAD. We claim the <b>pattern</b>, not the exact dollar amounts.</>,
          <>&quot;Income&quot; means money deposited into the account (the judges&apos; definition). There are no pay stubs, and 99% of deposits are cash.</>,
          <>Every chart shows group medians. Individual customers vary a lot around them; the engine shows any one customer&apos;s own numbers.</>,
          <>We only see this one bank account. Savings kept somewhere else are invisible to us (see the limits at the bottom).</>,
        ]} />
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
          tipFor={i => { const x = d.deciles[i]; return <><b>Income group {x.decile}</b> ({money(x.income)}/mo)<br />Balance settles at <b>{money(x.comfort)}</b><br />3 months of spending: <b>{money(x.three_months)}</b><br />Covers {x.cushion_months.toFixed(1)} months · n={x.n}</>; }} />
        <DataTable head={["Group", "Income", "Settles at", "3 months of spending", "Months covered"]}
          rows={d.deciles.map(x => ["D" + x.decile, money(x.income), money(x.comfort), money(x.three_months), x.cushion_months.toFixed(2)])} />
        <Caveats items={[
          <><b>Don&apos;t misread it as &quot;high earners save less money.&quot;</b> They hold <i>more</i> dollars ({kfmt(d10.comfort)} vs {kfmt(d1.comfort)}). It&apos;s the number of <i>months</i> those dollars cover that falls.</>,
          <><b>How it&apos;s measured:</b> &quot;settles at&quot; is each customer&apos;s median month-end balance after their first 3 months (accounts start at $0). &quot;3 months of spending&quot; is 3 × their median monthly money out. The months-saved column uses the judges&apos; buffer (average daily balance, last 6 months).</>,
          <><b>Why we trust it:</b> the same result on a random half of customers and on the other half; in all 8 regions and every year 2021–2025; with five definitions of savings; and after correcting for noisy income (savings grow only ×1.22 when income doubles, 95% range ×1.20–×1.24).</>,
          <><b>Not caused by cash moving in and out:</b> only 0.5–3.6% of deposits look like re-deposited withdrawals, and customers paid by bank transfer show the pattern even more strongly.</>,
        ]} />
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
          tipFor={i => { const t = d.thermostat[i]; return <><b>Balance {t.position.toLowerCase()}</b><br />Bottom 20%: <b>{signed(t.bottom20)}</b> of usual income next month<br />Top 20%: <b>{signed(t.top20)}</b><br />{t.bottom20_n.toLocaleString()} / {t.top20_n.toLocaleString()} account-months</>; }} />
        <Caveats items={[
          <><b>Part of this shape is automatic.</b> &quot;Usual&quot; here is the account&apos;s median over its whole history, so a high month is partly high <i>because</i> later months are lower. Shuffling each account&apos;s months at random still gives about two-thirds of the effect.</>,
          <><b>The real part, measured fairly:</b> comparing each balance only with its <i>previous</i> 6 months, shuffled data shows no pull (−0.01) and real data still does (−0.23). It mostly happens within one month, so some of it may be timing: cash deposited late in a month and spent early the next.</>,
          <><b>The cleanest evidence isn&apos;t on this chart:</b> after a windfall (a month bringing in at least a month&apos;s usual income), accounts still hold only 45% of it six months later (top 20% of earners: 29%). With no pull back, they&apos;d hold all of it.</>,
          <><b>What it doesn&apos;t show:</b> <i>why</i> people do this. It&apos;s observed behaviour, not proven psychology. Income groups here are fifths of all customers.</>,
        ]} />
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
        <Caveats items={[
          <><b>This is &quot;if nothing changes,&quot; not a forecast.</b> It assumes they keep spending exactly as usual. Real people cut back, so read it as how exposed they are, not how many will go broke.</>,
          <><b>Cutting back helps, but not enough:</b> protecting basic needs (Statistics Canada: 64% of household spending; 61% for the richest fifth), cutting <i>all</i> other spending still leaves 38–43% of the top group running out within 3 months.</>,
          <><b>EI is simplified:</b> we assume everyone qualifies, for the whole period, with no severance, other savings or a partner&apos;s income. The real maximum is $729/week in 2026 (canada.ca).</>,
          <><b>The orange bars depend on the cap; the gap in months saved (chart 1) doesn&apos;t.</b> Even with the judges&apos; uncapped 55% rule, top earners are the most exposed group.</>,
        ]} />
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
        <p className="muted" style={{ margin: "6px 0 0" }}>{d.timing_n.toLocaleString()} non-pensioner customers whose savings run out within 10 years for every start month.</p>
        <Caveats items={[
          <><b>This one is a model, not an observation.</b> Nobody in the data was laid off; we replay each customer&apos;s own seasonal spending against EI at 55% of income (the judges&apos; rule, no cap).</>,
          <><b>The seasonal pattern itself is solid:</b> January runs about 1.6× a normal month, June 1.5× and February 0.7×, in every year from 2021 to 2025.</>,
          <><b>For one customer it&apos;s rougher:</b> a person&apos;s own pattern only partly repeats from year to year (correlation 0.55), so treat their best and worst start months as a guide, not a promise.</>,
          <><b>Customers who never run out are left out</b>, because their runway is &quot;no shortfall&quot; in every month and there&apos;s nothing to compare.</>,
        ]} />
      </section>

      <section className="card">
        <h2 style={{ fontSize: 18, margin: 0 }}>How sure are we?</h2>
        <table className="data" style={{ marginTop: 10 }}>
          <thead><tr><th>Claim</th><th>Confidence</th><th>Why</th></tr></thead>
          <tbody>
            <tr><td>Higher earners hold fewer months of savings</td><td><b>High</b></td><td>Holds on a random hold-out, in every region, year and group, with 5 definitions of savings and after noise correction</td></tr>
            <tr><td>Savings drift back to a set level (the comfort number)</td><td><b>High</b></td><td>Windfalls drain back (45% kept vs 100%+ expected without a set point), and a fair version of the thermostat test agrees</td></tr>
            <tr><td>93% of top earners run out within 3 months on real EI</td><td><b>Medium</b></td><td>Real policy, but assumes no change in spending, full EI eligibility and no other savings</td></tr>
            <tr><td>Cutting back isn&apos;t enough for 38–43%</td><td><b>Medium</b></td><td>Basic needs use a national average; the data can&apos;t show what cash was spent on</td></tr>
            <tr><td>Layoff timing changes runway by about 2.7 months</td><td><b>Medium</b></td><td>The seasonal pattern is stable; the runway itself is a simulation</td></tr>
          </tbody>
        </table>
        <h3 style={{ fontSize: 15, margin: "16px 0 4px" }}>What we can&apos;t rule out</h3>
        <ul className="limits">
          <li><b>Cash kept at home.</b> 41% of top earners&apos; spending is large cash withdrawals. They look like rent or bills paid in cash (they repeat at similar amounts, mid-month, and are more common when no bills are recorded), but we can&apos;t follow cash once it leaves the bank. If a full year of them had been saved instead, top earners would hold about 7 months, not 1.6.</li>
          <li><b>Savings at other banks.</b> Money sent to other banks can&apos;t explain it: counting every such dollar as savings moves top earners from 1.9 to only 2.4 months. Money that never touches this account is invisible.</li>
          <li><b>Household size.</b> The data doesn&apos;t say how many people an income supports.</li>
          <li><b>Old data, new labels.</b> The amounts and habits come from a 1990s cash economy. The pattern should be checked on today&apos;s Canadian customers.</li>
        </ul>
        <p className="muted" style={{ margin: "8px 0 0" }}>Every number here can be reproduced from the repo; full method in FINDINGS.md and docs/REPORT.md.</p>
      </section>
    </div>
  );
}

function Caveats({ title = "How accurate is this, and what it doesn't say", items }: { title?: string; items: React.ReactNode[] }) {
  return (
    <div className="caveats">
      <div className="caveats-title">{title}</div>
      <ul>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details style={{ marginTop: 8 }}>
      <summary>Show the numbers</summary>
      <table className="data"><thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
    </details>
  );
}
