"use client";
import { useEffect, useMemo, useState } from "react";
import {
  type Customer, type EngineData, type Shock, MONTHS, NO_SHOCK, NO_SHORTFALL,
  backupPlan, getCustomer, goalPlan, indexData, money, monthlyPath, official, realWorld, runwayText,
} from "@/lib/engine";
import { EXAMPLE_SCENARIOS, parseScenario } from "@/lib/scenario";
import { BalanceChart } from "@/components/charts";

const EXAMPLES = [
  { id: 20111, label: "Judges' example" },
  { id: 71293, label: "High earner" },
  { id: 22998, label: "On the edge" },
  { id: 98208, label: "Saver with bonuses" },
  { id: 93255, label: "Pensioner" },
];

const kfmt = (v: number) => (Math.abs(v) >= 1000 ? (v < 0 ? "−$" : "$") + Math.round(Math.abs(v) / 1000) + "k" : money(v));
const pct = (x: number) => Math.round(x * 100) + "%";
const short = (r: number) => (r >= NO_SHORTFALL ? "120+" : r.toFixed(1));

function hasShock(s: Shock) {
  return s.incomePct < 100 || s.billsPct > 0 || s.oneOffMonths > 0 || s.oneOffDollars > 0;
}

export default function Engine() {
  const [data, setData] = useState<EngineData | null>(null);
  const [id, setId] = useState(20111);
  const [idInput, setIdInput] = useState("20111");
  const [text, setText] = useState("");
  const [shock, setShock] = useState<Shock>({ ...NO_SHOCK });
  const [understood, setUnderstood] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);

  useEffect(() => { fetch("/engine.json").then(r => r.json()).then(setData); }, []);
  const idx = useMemo(() => (data ? indexData(data) : null), [data]);
  const c = useMemo(() => (data && idx ? getCustomer(data, idx, id) : null), [data, idx, id]);

  const loadAccount = (n: number) => {
    if (!idx?.has(n)) { setMsg(`There's no account ${n}.`); return false; }
    setId(n); setIdInput(String(n)); setMsg(""); return true;
  };

  const run = (sentence: string) => {
    const p = parseScenario(sentence, shock.startMonth);
    if (p.accountId !== null && !loadAccount(p.accountId)) return;
    if (p.empty) { setMsg("I couldn't find a shock in that. Try one of the examples below."); return; }
    setShock(p.shock);
    setUnderstood(p.understood.filter(u => !u.startsWith("Customer #")));
    setMsg("");
  };

  const setManual = (patch: Partial<Shock>) => { setShock(s => ({ ...s, ...patch })); setUnderstood(["Adjusted by hand"]); };
  const reset = () => { setShock(s => ({ ...NO_SHOCK, startMonth: s.startMonth })); setUnderstood([]); setText(""); };

  if (!data || !c) return <p className="muted">Loading 4,500 customers…</p>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* ---------------- scenario bar: the main way to run a test */}
      <section className="card hero">
        <form onSubmit={e => { e.preventDefault(); run(text); }}>
          <label htmlFor="scenario" className="hero-label">Describe a scenario</label>
          <div className="scenario-row">
            <input id="scenario" className="input scenario-input" value={text} onChange={e => setText(e.target.value)}
              placeholder="e.g. Account 71293 is laid off. EI pays 55% for 6 months and rent goes up 15%." autoComplete="off" />
            <button className="btn primary" type="submit">Run</button>
          </div>
        </form>
        <div className="chip-row">
          {EXAMPLE_SCENARIOS.map(s => (
            <button key={s} className="btn chip" onClick={() => { setText(s); run(s); }}>{s.replace(/ Do they make it\?$/, "")}</button>
          ))}
        </div>
        {msg && <p className="error">{msg}</p>}
        {understood.length > 0 && (
          <div className="understood">
            <span className="muted">Understood as:</span>
            {understood.map(u => <span key={u} className="pill">{u}</span>)}
            <button className="link" onClick={reset}>Clear</button>
          </div>
        )}
      </section>

      {/* ---------------- 1 know the customer + 2 the answer */}
      <div className="split">
        <CustomerPanel c={c} data={data} idInput={idInput} setIdInput={setIdInput}
          onLookup={() => loadAccount(Number(idInput.trim()))}
          onRandom={() => loadAccount(data.id[Math.floor(Math.random() * data.id.length)])}
          onExample={loadAccount} currentId={id} />
        <AnswerPanel c={c} data={data} shock={shock} adjustOpen={adjustOpen} setAdjustOpen={setAdjustOpen} setManual={setManual} />
      </div>

      {/* ---------------- 3 plans */}
      <Plans c={c} data={data} shock={shock} />
    </div>
  );
}

// ================================================================== 1. know the customer
function CustomerPanel({ c, data, idInput, setIdInput, onLookup, onRandom, onExample, currentId }: {
  c: Customer; data: EngineData; idInput: string; setIdInput: (v: string) => void;
  onLookup: () => void; onRandom: () => void; onExample: (n: number) => void; currentId: number;
}) {
  const base = official(c, NO_SHOCK);
  const cushion = c.S > 0 ? c.B / c.S : 0;
  const peer = c.decile ? data.meta.decile_cushion[String(c.decile)] : null;
  const tags: string[] = [];
  if (c.pensioner) tags.push("Pensioner");
  if (c.bonusPct > 0) tags.push(`June & Dec bonus +${pct(c.bonusPct)}`);
  if (c.billsZero) tags.push("Bills paid in cash (not in data)");
  if (c.onEdge) tags.push("Often near zero");
  if (c.everNegative) tags.push("Has gone below zero");
  if (c.irregular) tags.push("Irregular income");
  return (
    <section className="card">
      <div className="panel-head">
        <h2 className="section-title">1 · The customer</h2>
        <form className="id-form" onSubmit={e => { e.preventDefault(); onLookup(); }}>
          <input className="input num" value={idInput} onChange={e => setIdInput(e.target.value)} aria-label="Account ID" />
          <button className="btn" type="submit">Go</button>
          <button className="btn" type="button" onClick={onRandom}>Random</button>
        </form>
      </div>
      <p className="who">
        <b>#{c.id}</b>{c.age ? ` · ${Math.round(c.age)} yrs` : ""}{c.gender ? ` ${c.gender}` : ""} · {c.district}
      </p>

      <div className="stat-grid">
        <Stat label="Money in" value={money(c.I)} unit="/mo" />
        <Stat label="Spending" value={money(c.S)} unit="/mo" />
        <Stat label="Bills & fixed costs" value={money(c.F)} unit="/mo" />
        <Stat label="Savings buffer" value={money(c.B)} />
      </div>

      <div className="facts">
        <div><span>Runway with no shock</span><b>{runwayText(base.runway)}</b></div>
        <div><span>Loan payment</span><b>{c.P ? money(c.P) + "/mo" : "None running"}</b></div>
        <div><span>Cushion</span><b>{cushion.toFixed(1)} months of spending</b></div>
        <div><span>Comfort number</span><b>{money(c.comfort)}</b></div>
      </div>
      <p className="note">
        Comfort number = where their balance usually settles.
        {peer !== null && <> People at their income level hold {peer.toFixed(1)} months.</>}
      </p>
      {tags.length > 0 && <div className="tags">{tags.map(t => <span key={t} className="tag">{t}</span>)}</div>}

      <div className="chip-row" style={{ marginTop: 12 }}>
        <span className="muted">Try:</span>
        {EXAMPLES.map(e => (
          <button key={e.id} className={"btn chip" + (e.id === currentId ? " on" : "")} onClick={() => onExample(e.id)}>{e.label}</button>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return <div className="stat"><div className="stat-label">{label}</div><div className="stat-value">{value}<small>{unit}</small></div></div>;
}

// ================================================================== 2. the answer
function AnswerPanel({ c, data, shock, adjustOpen, setAdjustOpen, setManual }: {
  c: Customer; data: EngineData; shock: Shock; adjustOpen: boolean; setAdjustOpen: (v: boolean) => void; setManual: (p: Partial<Shock>) => void;
}) {
  const off = official(c, shock);
  const real = realWorld(c, shock, data.meta.ei_monthly_max, data.meta.bills_share);
  const path = monthlyPath(c, shock, real, 24);
  const any = hasShock(shock);
  const jobLoss = shock.incomePct < 100;
  const horizon = jobLoss ? shock.duration : 3;
  const okOff = off.runway >= horizon, okReal = real.runway >= horizon;

  let tone = "neutral", headline = "Run a scenario to see what happens", sub = "Type it above or tap an example.";
  if (any) {
    if (okOff && okReal) { tone = "good"; headline = "Yes, they make it"; sub = `Savings last at least ${horizon} months either way.`; }
    else if (okOff) { tone = "warn"; headline = "Official formula says yes. Real rules say no."; sub = `With real-world rules their savings last ${runwayText(real.runway)}, not ${horizon}.`; }
    else { tone = "bad"; headline = "No, their savings run out"; sub = `They need ${horizon} months. Savings last ${runwayText(Math.min(off.runway, real.runway))}.`; }
  }
  const pts = path.pts.map(p => ({ k: p.k, label: MONTHS[p.month - 1], balance: p.balance }));
  const same = off.runway === real.runway && real.notes.length === 0;

  return (
    <section className="card">
      <h2 className="section-title">2 · What happens</h2>
      <div className={"verdict " + tone}>{headline}<small>{sub}</small></div>

      <div className="runways">
        <div className="runway">
          <div className="runway-label">Official formula</div>
          <div className="runway-value">{short(off.runway)}<small>{off.runway >= NO_SHORTFALL ? " months, no shortfall" : " months"}</small></div>
          <div className="note">Judges&apos; definitions</div>
        </div>
        <div className={"runway" + (same ? "" : " highlight")}>
          <div className="runway-label">Real-world rules</div>
          <div className="runway-value">{short(real.runway)}<small>{real.runway >= NO_SHORTFALL ? " months, no shortfall" : " months"}</small></div>
          <div className="note">{same ? "Same as official for this scenario" : "EI maximum, pensions, cash-paid bills"}</div>
        </div>
      </div>

      {any && (
        <table className="calc">
          <thead><tr><th></th><th>Official</th><th>Real-world</th></tr></thead>
          <tbody>
            <tr><td>Income during shock</td><td>{money(off.income)}</td><td>{money(real.income)}</td></tr>
            <tr><td>Spending</td><td>{money(off.spending)}</td><td>{money(real.spending)}</td></tr>
            <tr><td>{off.gap > 0 ? "Short each month" : "Left over each month"}</td><td>{money(Math.abs(off.gap))}</td><td>{money(Math.abs(real.gap))}</td></tr>
            <tr><td>Savings after one-off costs</td><td>{money(off.bufferLeft)}</td><td>{money(real.bufferLeft)}</td></tr>
          </tbody>
        </table>
      )}
      {real.notes.length > 0 && <ul className="notes">{real.notes.map(n => <li key={n}>{n}</li>)}</ul>}

      {any && (
        <details className="more">
          <summary>Month-by-month balance</summary>
          <BalanceChart pts={pts} shockMonths={jobLoss ? shock.duration : 24} fmt={kfmt} />
          <p className="note">
            {path.runsOutAt === null ? "Balance stays above zero for 24 months." : `Balance hits zero after ${path.runsOutAt.toFixed(1)} months.`}
            {" "}Lowest point {money(path.low)}. Uses real-world rules and their usual seasonal spending (January and June run high).
          </p>
        </details>
      )}

      <details className="more" open={adjustOpen} onToggle={e => setAdjustOpen((e.target as HTMLDetailsElement).open)}>
        <summary>Adjust the shock by hand</summary>
        <div style={{ marginTop: 10 }}>
          <Slider label="Income during shock" value={shock.incomePct} min={0} max={100} step={5}
            show={shock.incomePct === 100 ? "no change" : `${shock.incomePct}% of usual`} onChange={v => setManual({ incomePct: v })} />
          <Slider label="Lasts" value={shock.duration} min={1} max={24} step={1} show={`${shock.duration} months`} onChange={v => setManual({ duration: v })} />
          <Slider label="Household bills / rent up" value={shock.billsPct} min={0} max={50} step={5} show={`${shock.billsPct}%`} onChange={v => setManual({ billsPct: v })} />
          <Slider label="One-off cost, months of spending" value={shock.oneOffMonths} min={0} max={3} step={0.25}
            show={shock.oneOffMonths ? `${shock.oneOffMonths} = ${money(shock.oneOffMonths * c.S)}` : "none"} onChange={v => setManual({ oneOffMonths: v })} />
          <Slider label="One-off cost, dollars" value={shock.oneOffDollars} min={0} max={20000} step={500}
            show={shock.oneOffDollars ? money(shock.oneOffDollars) : "none"} onChange={v => setManual({ oneOffDollars: v })} />
          <label className="slider" style={{ display: "block" }}>
            <span style={{ fontSize: 13.5, color: "var(--text-2)" }}>Starts in</span>
            <select className="input" style={{ display: "block", marginTop: 4 }} value={shock.startMonth}
              onChange={e => setManual({ startMonth: Number(e.target.value) })}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        </div>
      </details>
    </section>
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

// ================================================================== 3. plans
function Plans({ c, data, shock }: { c: Customer; data: EngineData; shock: Shock }) {
  const real = realWorld(c, shock, data.meta.ei_monthly_max, data.meta.bills_share);
  const off = official(c, shock);
  const goal = goalPlan(c);
  const backup = backupPlan(c, real, shock);
  const any = hasShock(shock);
  return (
    <>
      <div className="plans">
        <section className="card plan">
          <h2 className="section-title">3 · Goal plan</h2>
          <p className="plan-lead">Build a 3-month emergency fund</p>
          {goal.gap === 0 ? (
            <p>Already there: <b>{goal.cushionMonths.toFixed(1)} months</b> saved. Next goal: 6 months ({money(6 * c.S)}).</p>
          ) : (
            <>
              <div className="progress" aria-label={`${pct(goal.have / goal.target)} of target`}>
                <div style={{ width: pct(Math.min(1, goal.have / goal.target)) }} />
              </div>
              <p className="note">{money(goal.have)} of {money(goal.target)} · {money(goal.gap)} to go</p>
              <ul>
                <li>
                  {goal.transferSource === "surplus"
                    ? <>Automatic transfer of <b>{money(goal.monthlyTransfer)}/mo</b> (their usual surplus)</>
                    : <>Trim flexible spending 5% and save <b>{money(goal.monthlyTransfer)}/mo</b></>}
                  {goal.monthsToGoal !== null && <> → there in <b>{goal.monthsToGoal} months</b></>}
                </li>
                {goal.bonusBoost > 0 && goal.monthsWithBonus !== null && (
                  <li>Plus half of each June and December bonus → <b>{goal.monthsWithBonus} months</b></li>
                )}
              </ul>
              <p className="tip-line">Their balance settles around {money(c.comfort)} and extra money gets spent. An automatic transfer raises that level without relying on willpower.</p>
            </>
          )}
        </section>

        <section className="card plan">
          <h2 className="section-title">3 · Backup plan</h2>
          {!any ? (
            <p className="muted">Run a scenario to get a backup plan.</p>
          ) : (
            <>
              <p className="plan-lead">
                {real.runway >= NO_SHORTFALL || backup.cutNeeded === 0
                  ? `No cuts needed to last ${backup.targetMonths} months`
                  : backup.reachable && backup.cutNeeded !== null
                    ? `Cut ${pct(backup.cutNeeded)} of flexible spending to last ${backup.targetMonths} months`
                    : `Cutting flexible spending alone won't reach ${backup.targetMonths} months`}
              </p>
              <p className="note">
                Fixed costs are {pct(backup.fixedShare)} of spending; {money(backup.flexible)}/mo is flexible
                {c.billsZero ? " (their bills aren't visible in the data, so some of this may be rent)" : ""}.
              </p>
              <ul>
                {backup.cutNeeded !== null && backup.cutNeeded > 0 && backup.reachable && <li>That&apos;s <b>{money(backup.cutDollars)}/mo</b> less spending</li>}
                {backup.options.map(o => <li key={o.cut}>Cut {pct(o.cut)} → {runwayText(o.runway)}</li>)}
                {c.bonusPct > 0 && shock.incomePct < 100 && <li>A layoff also means losing the June and December bonus</li>}
              </ul>
              <p className="tip-line">
                {[1, 6, 12].includes(shock.startMonth)
                  ? `${MONTHS[shock.startMonth - 1]} is one of the hardest months to start: spending peaks in January and June.`
                  : "Timing matters: the same shock starting in December or January leaves less room."}
              </p>
            </>
          )}
        </section>
      </div>
      <Explain c={c} shock={shock} off={off} real={real} goal={goal} backup={backup} anyShock={any} />
    </>
  );
}

// ================================================================== plan in plain words (Gemini)
function Explain(props: {
  c: Customer; shock: Shock; off: ReturnType<typeof official>; real: ReturnType<typeof realWorld>;
  goal: ReturnType<typeof goalPlan>; backup: ReturnType<typeof backupPlan>; anyShock: boolean;
}) {
  const key = JSON.stringify([props.c.id, props.shock]);
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
      <div className="panel-head">
        <h2 className="section-title" style={{ margin: 0 }}>The plan, written for the customer</h2>
        <button className="btn" onClick={run} disabled={busy}>{busy ? "Writing…" : "Write it"}</button>
      </div>
      {text && <div className="letter">{text}</div>}
      {src && <p className="note">{src === "gemini" ? "Written by Gemini using only the numbers above." : "Template wording (Gemini not configured)."}</p>}
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
