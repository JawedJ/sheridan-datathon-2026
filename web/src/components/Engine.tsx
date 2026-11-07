"use client";
import { useEffect, useMemo, useState } from "react";
import {
  type Customer, type EngineData, type Shock, MONTHS, NO_SHOCK, NO_SHORTFALL, TWISTS,
  backupPlan, getCustomer, goalPlan, indexData, money, monthlyPath, official, realWorld, runwayText,
} from "@/lib/engine";
import { BalanceChart } from "@/components/charts";

const EXAMPLES = [
  { id: 20111, label: "Judges' example" },
  { id: 71293, label: "High earner, thin cushion" },
  { id: 22998, label: "Living on the edge" },
  { id: 98208, label: "Saver with bonuses" },
  { id: 93255, label: "Pensioner" },
];

const kfmt = (v: number) => (Math.abs(v) >= 1000 ? (v < 0 ? "−$" : "$") + Math.round(Math.abs(v) / 1000) + "k" : money(v));
const pct = (x: number) => Math.round(x * 100) + "%";

export default function Engine() {
  const [data, setData] = useState<EngineData | null>(null);
  const [query, setQuery] = useState("20111");
  const [id, setId] = useState(20111);
  const [shock, setShock] = useState<Shock>({ ...NO_SHOCK });
  const [twist, setTwist] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { fetch("/engine.json").then(r => r.json()).then(setData); }, []);
  const idx = useMemo(() => (data ? indexData(data) : null), [data]);
  const c = useMemo(() => (data && idx ? getCustomer(data, idx, id) : null), [data, idx, id]);

  const lookup = (raw: string) => {
    const n = Number(raw.trim());
    if (!data || !idx) return;
    if (!idx.has(n)) { setError(`No account ${raw}`); return; }
    setError(""); setId(n); setQuery(String(n));
  };
  const random = () => { if (data) { const n = data.id[Math.floor(Math.random() * data.id.length)]; lookup(String(n)); } };
  const set = (patch: Partial<Shock>) => { setShock(s => ({ ...s, ...patch })); setTwist(null); };

  if (!data || !c) return <p className="muted">Loading 4,500 customers…</p>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <form onSubmit={e => { e.preventDefault(); lookup(query); }} style={{ display: "flex", gap: 8 }}>
          <input className="input num" value={query} onChange={e => setQuery(e.target.value)} placeholder="account_id" aria-label="Account ID" style={{ width: 140 }} />
          <button className="btn primary" type="submit">Look up</button>
          <button className="btn" type="button" onClick={random}>Random</button>
        </form>
        {error && <span style={{ color: "var(--bad)", fontSize: 13 }}>{error}</span>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginLeft: "auto" }}>
          {EXAMPLES.map(e => (
            <button key={e.id} className={"btn chip" + (e.id === id ? " on" : "")} onClick={() => lookup(String(e.id))}>{e.label}</button>
          ))}
        </div>
      </div>

      <CustomerCard c={c} data={data} />
      <ShockPanel c={c} data={data} shock={shock} set={set} twist={twist}
        applyTwist={(k, s) => { setShock(prev => ({ ...prev, ...NO_SHOCK, startMonth: prev.startMonth, ...s })); setTwist(k); }} />
    </div>
  );
}

// ------------------------------------------------------------------ 1. know the customer
function CustomerCard({ c, data }: { c: Customer; data: EngineData }) {
  const base = official(c, NO_SHOCK);
  const cushion = c.S > 0 ? c.B / c.S : 0;
  const peer = c.decile ? data.meta.decile_cushion[String(c.decile)] : null;
  const tags: string[] = [];
  if (c.pensioner) tags.push("Pensioner: a job loss doesn't stop the pension");
  if (c.decile >= 8 && cushion < 3) tags.push("High earner, thin cushion");
  if (c.bonusPct > 0) tags.push(`Bonus months: June & December +${pct(c.bonusPct)}`);
  if (c.billsZero) tags.push("No bills in the data (paid in cash)");
  if (c.onEdge) tags.push("Often close to zero");
  if (c.irregular) tags.push("Irregular income, few automatic payments");
  if (c.everNegative) tags.push("Has gone below zero");
  if (c.shared) tags.push("Shared account");
  return (
    <section className="card">
      <h2 className="section-title">1 · Know the customer</h2>
      <p style={{ margin: "-4px 0 14px", color: "var(--text-2)" }}>
        <b style={{ color: "var(--text)" }}>#{c.id}</b>
        {c.age ? ` · ${Math.round(c.age)} yrs` : ""}{c.gender ? ` ${c.gender}` : ""} · {c.district}, {c.region}
        {c.decile ? ` · income group ${c.decile} of 10` : ""}
      </p>
      <div className="kpis">
        <Kpi label="Money in (I)" value={money(c.I) + "/mo"} note="typical month (median)" />
        <Kpi label="Spending (S)" value={money(c.S) + "/mo"} note="typical month (median)" />
        <Kpi label="Fixed costs (F)" value={money(c.F) + "/mo"} note="bills + insurance + loans" />
        <Kpi label="Buffer (B)" value={money(c.B)} note="avg balance, last 6 months" />
        <Kpi label="Loan payment (P)" value={money(c.P) + "/mo"} note={c.P ? "loan still running" : "no running loan"} />
        <Kpi label="Runway, no shock" value={runwayText(base.runway)} note="judges' formula" />
      </div>
      <div className="callout" style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: "6px 24px", alignItems: "baseline" }}>
        <span>Comfort number: <b className="num">{money(c.comfort)}</b> <span className="muted">(where their balance settles)</span></span>
        <span>Cushion: <b className="num">{cushion.toFixed(1)} months</b> of spending</span>
        {peer !== null && <span className="muted">Typical for their income group: {peer.toFixed(1)} months</span>}
      </div>
      {tags.length > 0 && <div style={{ marginTop: 12 }}>{tags.map(t => <span key={t} className="tag">{t}</span>)}</div>}
    </section>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="kpi"><div className="label">{label}</div><div className="value">{value}</div><div className="note">{note}</div></div>;
}

// ------------------------------------------------------------------ 2. shock + 3. plan
function ShockPanel({ c, data, shock, set, twist, applyTwist }: {
  c: Customer; data: EngineData; shock: Shock; set: (p: Partial<Shock>) => void;
  twist: string | null; applyTwist: (k: string, s: Partial<Shock>) => void;
}) {
  const off = official(c, shock);
  const real = realWorld(c, shock, data.meta.ei_monthly_max, data.meta.bills_share);
  const path = monthlyPath(c, shock, real, 24);
  const goal = goalPlan(c);
  const backup = backupPlan(c, real, shock);
  const jobLoss = shock.incomePct < 100;
  const anyShock = jobLoss || shock.billsPct > 0 || shock.oneOffMonths > 0 || shock.oneOffDollars > 0;

  // Verdict: does the buffer last through the shock period (job loss) or 3 months (other shocks)?
  const horizon = jobLoss ? shock.duration : 3;
  const makesItOfficial = off.runway >= horizon;
  const makesItReal = real.runway >= horizon;
  let tone = "good", headline = "", sub = "";
  if (!anyShock) { headline = "No shock applied"; sub = "Pick a twist card or move a slider."; tone = "warn"; }
  else if (makesItOfficial && makesItReal) { headline = "Yes, they make it"; sub = `Savings last at least ${horizon} months under both views.`; }
  else if (makesItOfficial && !makesItReal) { tone = "warn"; headline = "Official formula: yes. Real rules: no"; sub = `Real-world runway is ${runwayText(real.runway)}, short of ${horizon} months.`; }
  else { tone = "bad"; headline = `No, savings run out in about ${runwayText(Math.min(off.runway, real.runway))}`; sub = `They need ${horizon} months.`; }

  // p.month is the calendar month at that point (k = 0 is the start of the shock month)
  const pts = path.pts.map(p => ({ k: p.k, label: MONTHS[p.month - 1], balance: p.balance }));

  return (
    <>
      <section className="card shock-grid">
        <div style={{ minWidth: 0 }}>
          <h2 className="section-title">2 · Take a shock</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {TWISTS.map(t => (
              <button key={t.key} className={"btn chip" + (twist === t.key ? " on" : "")} onClick={() => applyTwist(t.key, t.shock)}>{t.label}</button>
            ))}
            <button className="btn chip" onClick={() => applyTwist("reset", {})}>Reset</button>
          </div>
          <Slider label="Income during shock" value={shock.incomePct} min={0} max={100} step={5}
            show={shock.incomePct === 100 ? "no job loss" : `${shock.incomePct}% of usual (EI = 55%)`} onChange={v => set({ incomePct: v })} />
          <Slider label="Shock lasts" value={shock.duration} min={1} max={24} step={1} show={`${shock.duration} months`} onChange={v => set({ duration: v })} />
          <Slider label="Household bills / rent up" value={shock.billsPct} min={0} max={50} step={5} show={`${shock.billsPct}%`} onChange={v => set({ billsPct: v })} />
          <Slider label="One-off cost (months of spending)" value={shock.oneOffMonths} min={0} max={3} step={0.25}
            show={shock.oneOffMonths ? `${shock.oneOffMonths} × = ${money(shock.oneOffMonths * c.S)}` : "none"} onChange={v => set({ oneOffMonths: v })} />
          <Slider label="One-off cost (dollars)" value={shock.oneOffDollars} min={0} max={20000} step={500}
            show={shock.oneOffDollars ? money(shock.oneOffDollars) : "none"} onChange={v => set({ oneOffDollars: v })} />
          <label className="slider" style={{ display: "block" }}>
            <span style={{ fontSize: 13.5, color: "var(--text-2)" }}>Shock starts in</span>
            <select className="input" style={{ display: "block", marginTop: 4 }} value={shock.startMonth}
              onChange={e => set({ startMonth: Number(e.target.value) })}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        </div>

        <div style={{ minWidth: 0, display: "grid", gap: 14, alignContent: "start" }}>
          <div className={"verdict " + tone}>{headline}<small>{sub}</small></div>
          <div className="compare">
            <ResultCol title="Official formula (judges' definitions)" r={off} />
            <ResultCol title="Real-world rules" r={real} notes={real.notes.length ? real.notes : ["Same as official for this shock."]} />
          </div>
          <div>
            <div className="legend"><span><i className="line" style={{ background: "var(--series-1)" }} />Balance month by month (real-world rules, seasonal spending)</span></div>
            <BalanceChart pts={pts} shockMonths={jobLoss ? shock.duration : 24} fmt={kfmt} />
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {path.runsOutAt === null ? "Balance stays above zero for 24 months." : `Balance hits zero after ${path.runsOutAt.toFixed(1)} months.`}
              {" "}Lowest point: {money(path.low)}. Spending follows their usual seasonal pattern (January and June run high).
            </p>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div className="card plan">
          <h2 className="section-title">3 · Goal plan: build a 3-month cushion</h2>
          <GoalView c={c} g={goal} />
        </div>
        <div className="card plan">
          <h2 className="section-title">3 · Backup plan if the shock hits</h2>
          <BackupView c={c} b={backup} real={real} shock={shock} anyShock={anyShock} />
        </div>
      </section>
      <Explain c={c} shock={shock} off={off} real={real} goal={goal} backup={backup} anyShock={anyShock} />
    </>
  );
}

function Slider({ label, value, min, max, step, show, onChange }: {
  label: string; value: number; min: number; max: number; step: number; show: string; onChange: (v: number) => void;
}) {
  return (
    <div className="slider">
      <label><span>{label}</span><b>{show}</b></label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={label} />
    </div>
  );
}

function ResultCol({ title, r, notes }: { title: string; r: ReturnType<typeof official>; notes?: string[] }) {
  return (
    <div className="col">
      <h4>{title}</h4>
      <div className="big">{runwayText(r.runway)}</div>
      <dl>
        <dt>Income during shock</dt><dd>{money(r.income)}/mo</dd>
        <dt>Spending</dt><dd>{money(r.spending)}/mo</dd>
        <dt>{r.gap > 0 ? "Monthly gap" : "Monthly surplus"}</dt><dd>{money(Math.abs(r.gap))}</dd>
        <dt>Buffer after one-off costs</dt><dd>{money(r.bufferLeft)}</dd>
      </dl>
      {notes && <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 12.5, color: "var(--text-2)" }}>{notes.map(n => <li key={n}>{n}</li>)}</ul>}
    </div>
  );
}

function GoalView({ c, g }: { c: Customer; g: ReturnType<typeof goalPlan> }) {
  if (g.gap === 0) {
    return (
      <>
        <p>Already covered: <b>{g.cushionMonths.toFixed(1)} months</b> of spending saved, above the 3-month target ({money(g.target)}).</p>
        <p className="muted">Next goal: 6 months ({money(6 * c.S)}).</p>
      </>
    );
  }
  return (
    <>
      <p>Target <b>{money(g.target)}</b> (3 months of spending). They have <b>{money(g.have)}</b>, so they&apos;re <b>{money(g.gap)}</b> short.</p>
      <div className="callout">
        Their balance settles around <b>{money(c.comfort)}</b>, and money above it gets spent the next month.
        The fix is to <b>raise that setting</b>: automatically move money into savings before it gets spent.
      </div>
      <ul>
        <li>
          {g.transferSource === "surplus"
            ? <>Auto-transfer their usual monthly surplus, <b>{money(g.monthlyTransfer)}/mo</b></>
            : <>No regular surplus, so trim flexible spending 5%: <b>{money(g.monthlyTransfer)}/mo</b></>}
          {g.monthsToGoal !== null && <>: reaches the target in <b>{g.monthsToGoal} months</b>.</>}
        </li>
        {g.bonusBoost > 0 && g.monthsWithBonus !== null && (
          <li>Also bank half of each June and December bonus (+{pct(c.bonusPct)} months): <b>{g.monthsWithBonus} months</b>.</li>
        )}
      </ul>
    </>
  );
}

function BackupView({ c, b, real, shock, anyShock }: {
  c: Customer; b: ReturnType<typeof backupPlan>; real: ReturnType<typeof realWorld>; shock: Shock; anyShock: boolean;
}) {
  if (!anyShock) return <p className="muted">Apply a shock to see the backup plan.</p>;
  const worst = [1, 6, 12].includes(shock.startMonth);
  return (
    <>
      <p>
        Fixed costs are <b>{pct(b.fixedShare)}</b> of their spending, so <b>{money(b.flexible)}/mo</b> is flexible
        {c.cashShare > 0.5 ? ` (mostly cash withdrawals, ${pct(c.cashShare)} of spending)` : ""}.
      </p>
      {real.runway >= NO_SHORTFALL || b.cutNeeded === 0 ? (
        <p>No cuts needed: their real-world runway already covers {b.targetMonths} months.</p>
      ) : b.reachable && b.cutNeeded !== null ? (
        <p>To last <b>{b.targetMonths} months</b>, cut <b>{pct(b.cutNeeded)}</b> of flexible spending (<b>{money(b.cutDollars)}/mo</b>).</p>
      ) : (
        <p>Even cutting all flexible spending won&apos;t reach {b.targetMonths} months. They&apos;d need extra income or to reduce fixed costs.</p>
      )}
      <ul>
        {b.options.map(o => <li key={o.cut}>Cut {pct(o.cut)} of flexible spending: {runwayText(o.runway)}</li>)}
        {c.bonusPct > 0 && shock.incomePct < 100 && <li>A layoff also means losing the June and December bonus months.</li>}
      </ul>
      <div className="callout" style={{ marginTop: 8 }}>
        {worst
          ? `Starting in ${MONTHS[shock.startMonth - 1]} is one of the hardest times: spending peaks in January and June.`
          : "Timing matters: the same shock starting in December or January leaves less room, because spending peaks then."}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Gemini wording
function Explain(props: {
  c: Customer; shock: Shock; off: ReturnType<typeof official>; real: ReturnType<typeof realWorld>;
  goal: ReturnType<typeof goalPlan>; backup: ReturnType<typeof backupPlan>; anyShock: boolean;
}) {
  const key = JSON.stringify([props.c.id, props.shock]);
  // Answer is tied to the customer + shock it was written for; changing either hides it.
  const [ans, setAns] = useState<{ key: string; text: string; src: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const text = ans?.key === key ? ans.text : "", src = ans?.key === key ? ans.src : "";
  const run = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(summary(props)) });
      const j = await r.json(); setAns({ key, text: j.text, src: j.source });
    } catch { setAns({ key, text: "Couldn't reach the explainer.", src: "error" }); }
    setBusy(false);
  };
  return (
    <section className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 className="section-title" style={{ margin: 0 }}>Plan in plain words</h2>
        <button className="btn" onClick={run} disabled={busy}>{busy ? "Writing…" : "Write it for the customer"}</button>
        {src && <span className="muted">{src === "gemini" ? "Written by Gemini from the numbers above" : "Template (Gemini not configured)"}</span>}
      </div>
      {text && <div style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{text}</div>}
    </section>
  );
}

function summary({ c, shock, off, real, goal, backup, anyShock }: Parameters<typeof Explain>[0]) {
  const r1 = (x: number) => Math.round(x);
  return {
    account: c.id, income: r1(c.I), spending: r1(c.S), fixed: r1(c.F), buffer: r1(c.B),
    comfort_number: r1(c.comfort), cushion_months: +(c.B / c.S).toFixed(1), pensioner: c.pensioner,
    bonus_pct: c.bonusPct, shock: anyShock ? shock : null,
    official_runway: off.runway, real_runway: real.runway, real_notes: real.notes,
    goal: { target: r1(goal.target), gap: r1(goal.gap), monthly_transfer: r1(goal.monthlyTransfer), months_to_goal: goal.monthsToGoal, months_with_bonus: goal.monthsWithBonus },
    backup: anyShock ? { target_months: backup.targetMonths, cut_share_of_flexible: backup.cutNeeded, cut_dollars: r1(backup.cutDollars), reachable: backup.reachable } : null,
  };
}
