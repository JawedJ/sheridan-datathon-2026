"use client";
import { useEffect, useMemo, useState } from "react";
import {
  type Customer, type EngineData, type Shock, MONTHS, NO_SHOCK, NO_SHORTFALL,
  ESSENTIAL_SHARE, backupPlan, fullPlan, type FullPlan, getCustomer, goalPlan, indexData, money, monthlyPath, official,
  realWorld, runwayText,
} from "@/lib/engine";
import { type Summary, template } from "@/lib/planText";
import { EXAMPLE_SCENARIOS, type ParsedScenario, toShock } from "@/lib/scenario";
import { MultiLine } from "@/components/charts";

const kfmt = (v: number) => (Math.abs(v) >= 1000 ? (v < 0 ? "−$" : "$") + Math.round(Math.abs(v) / 1000) + "k" : money(v));
const pct = (x: number) => Math.round(x * 100) + "%";
const short = (r: number) => (r >= NO_SHORTFALL ? "120+" : r.toFixed(1));

function hasShock(s: Shock) {
  return s.incomePct < 100 || s.billsPct > 0 || (s.otherPct ?? 0) > 0 || (s.otherDollars ?? 0) > 0 || s.oneOffMonths > 0 || s.oneOffDollars > 0;
}

export default function Engine() {
  const [data, setData] = useState<EngineData | null>(null);
  const [id, setId] = useState(20111);
  const [idInput, setIdInput] = useState("20111");
  const [text, setText] = useState("");
  const [shock, setShock] = useState<Shock>({ ...NO_SHOCK });
  const [understood, setUnderstood] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [reading, setReading] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => { fetch("/engine.json").then(r => r.json()).then(setData); }, []);
  const idx = useMemo(() => (data ? indexData(data) : null), [data]);
  const c = useMemo(() => (data && idx ? getCustomer(data, idx, id) : null), [data, idx, id]);

  const loadAccount = (n: number) => {
    if (!idx?.has(n)) { setMsg(`There's no account ${n}.`); return false; }
    setId(n); setIdInput(String(n)); setMsg(""); return true;
  };

  const run = async (sentence: string) => {
    if (!sentence.trim() || reading) return;
    setReading(true); setMsg("");
    try {
      const r = await fetch("/api/parse", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: sentence, month: new Date().getMonth() + 1 }) });
      const j = await r.json();
      if (!r.ok || !j.parsed) throw new Error(j.error || "failed");
      const target = j.parsed.account_id ?? id;
      if (j.parsed.account_id !== null && !loadAccount(target)) return;
      const p = toShock(j.parsed as ParsedScenario, shock.startMonth);
      setMissing(p.missing);
      if (p.empty) { setUnderstood(p.notes); setMsg(p.missing.length ? "That isn't something the engine can model (see below)." : "I couldn't find a shock in that. Try one of the examples below."); return; }
      setShock(p.shock);
      setUnderstood([...p.understood, ...p.notes]);
    } catch {
      setMsg("Gemini couldn't read that just now (Google's servers are busy). Try again in a moment, or set the shock with the sliders below." +
        (understood.length ? " The results below are still from the previous scenario." : ""));
    } finally {
      setReading(false);
    }
  };

  const setManual = (patch: Partial<Shock>) => {
    setShock(s => {
      const next = { ...s, ...patch };
      // Sliding income down from "no change" by hand is almost always a layoff; the checkbox can undo it.
      if (patch.incomePct !== undefined && patch.incomePct < 100 && s.incomePct === 100 && patch.jobLoss === undefined) next.jobLoss = true;
      if (next.incomePct === 100) next.jobLoss = false;
      return next;
    });
    setUnderstood(["Adjusted by hand"]); setMissing([]);
  };
  const reset = () => { setShock(s => ({ ...NO_SHOCK, startMonth: s.startMonth })); setUnderstood([]); setMissing([]); setText(""); };

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
            <button className="btn primary" type="submit" disabled={reading}>{reading ? "Reading…" : "Run"}</button>
          </div>
        </form>
        <div className="chip-row">
          {EXAMPLE_SCENARIOS.map(s => (
            <button key={s} className="btn chip" onClick={() => { setText(s); run(s); }}>{s.replace(/ Do they make it\?$/, "")}</button>
          ))}
        </div>
        {reading && <p className="note"><span className="dot" />Gemini is reading the scenario…</p>}
        {msg && <p className="error">{msg}</p>}
        {understood.length > 0 && (
          <div className="understood">
            <span className="muted">Understood as:</span>
            {understood.map(u => <span key={u} className="pill">{u}</span>)}
            <button className="link" onClick={reset}>Clear</button>
          </div>
        )}
        {missing.length > 0 && (
          <div className="understood">
            <span className="muted">Not included (the engine can&apos;t model it):</span>
            {missing.map(m => <span key={m} className="pill warn">{m}</span>)}
          </div>
        )}
      </section>

      {/* ---------------- 1 know the customer + 2 the answer */}
      <div className="split">
        <CustomerPanel c={c} data={data} idInput={idInput} setIdInput={setIdInput}
          onLookup={() => loadAccount(Number(idInput.trim()))}
          onRandom={() => loadAccount(data.id[Math.floor(Math.random() * data.id.length)])} />
        <AnswerPanel c={c} data={data} shock={shock} setManual={setManual} />
      </div>

      {/* ---------------- 3 plans */}
      <Plans c={c} data={data} shock={shock} />
    </div>
  );
}

// ================================================================== 1. know the customer
function CustomerPanel({ c, data, idInput, setIdInput, onLookup, onRandom }: {
  c: Customer; data: EngineData; idInput: string; setIdInput: (v: string) => void;
  onLookup: () => void; onRandom: () => void;
}) {
  const base = official(c, NO_SHOCK);
  const cushion = c.S > 0 ? c.B / c.S : 0;
  const peer = c.decile ? data.meta.decile_cushion[String(c.decile)] : null;
  const tags: string[] = [];
  if (c.pensioner) tags.push("Pensioner");
  if (c.billsZero) tags.push("Bills not recorded");
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
        <Stat k="I" label="Money in" value={money(c.I)} unit="/mo" />
        <Stat k="S" label="Spending" value={money(c.S)} unit="/mo" />
        <Stat k="F" label="Fixed costs" value={money(c.F)} unit="/mo" note="bills + insurance + loans" />
        <Stat k="H" label="Household bills" value={money(c.H)} unit="/mo" note={c.H === 0 ? "not recorded in the data" : "rent & utilities"} />
        <Stat k="B" label="Savings buffer" value={money(c.B)} note="avg. daily balance, last 6 months" />
        <Stat k="P" label="Loan payment" value={c.P ? money(c.P) : "None"} unit={c.P ? "/mo" : ""} note={c.P ? "loan still running" : "no loan running"} />
      </div>

      <div className="facts">
        <div><span>Runway with no shock</span><b>{runwayText(base.runway)}</b></div>
        <div><span>Cushion</span><b>{cushion.toFixed(1)} months of spending</b></div>
        <div><span>Comfort number</span><b>{money(c.comfort)}</b></div>
      </div>
      <p className="note">
        Comfort number = where their balance usually settles.
        {peer !== null && <> People at their income level hold {peer.toFixed(1)} months.</>}
      </p>
      {tags.length > 0 && <div className="tags">{tags.map(t => <span key={t} className="tag">{t}</span>)}</div>}
    </section>
  );
}

function Stat({ k, label, value, unit, note }: { k: string; label: string; value: string; unit?: string; note?: string }) {
  return (
    <div className="stat">
      <div className="stat-label"><span className="sym" title="The judges' symbol for this value">{k}</span>{label}</div>
      <div className="stat-value">{value}<small>{unit}</small></div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}

// ================================================================== 2. the answer
function AnswerPanel({ c, data, shock, setManual }: {
  c: Customer; data: EngineData; shock: Shock; setManual: (p: Partial<Shock>) => void;
}) {
  const off = official(c, shock);
  const real = realWorld(c, shock, data.meta.ei_monthly_max);
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


      <div className="adjust">
        <h3 className="adjust-title">Adjust the shock</h3>
        <div>
          <Slider label="Income during shock" value={shock.incomePct} min={0} max={100} step={5}
            show={shock.incomePct === 100 ? "no change" : `${shock.incomePct}% of usual`} onChange={v => setManual({ incomePct: v })} />
          <label className="check-line">
            <input type="checkbox" checked={shock.jobLoss} onChange={e => setManual({ jobLoss: e.target.checked })} />
            It&apos;s a job loss (EI rules apply, including the ${data.meta.ei_weekly_max}/week maximum)
          </label>
          <Slider label="Lasts" value={shock.duration} min={1} max={24} step={1} show={`${shock.duration} months`} onChange={v => setManual({ duration: v })} />
          <Slider label="Household bills / rent up" value={shock.billsPct} min={0} max={200} step={5} show={`${shock.billsPct}%`} onChange={v => setManual({ billsPct: v })} />
          <Slider label="Other monthly costs up (childcare, car payment…)" value={shock.otherDollars ?? 0} min={0} max={5000} step={50}
            show={shock.otherDollars ? `${money(shock.otherDollars)}/mo` : "none"} onChange={v => setManual({ otherDollars: v })} />
          <Slider label="All spending up (e.g. inflation)" value={shock.otherPct ?? 0} min={0} max={50} step={1}
            show={shock.otherPct ? `${shock.otherPct}% = ${money(((shock.otherPct ?? 0) / 100) * c.S)}/mo` : "none"} onChange={v => setManual({ otherPct: v })} />
          <Slider label="One-off cost, months of spending" value={shock.oneOffMonths} min={0} max={3} step={0.25}
            show={shock.oneOffMonths ? `${shock.oneOffMonths} = ${money(shock.oneOffMonths * c.S)}` : "none"} onChange={v => setManual({ oneOffMonths: v })} />
          <Slider label="One-off cost, dollars" value={shock.oneOffDollars} min={0} max={20000} step={500}
            show={shock.oneOffDollars ? money(shock.oneOffDollars) : "none"} onChange={v => setManual({ oneOffDollars: v })} />
        </div>
      </div>
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

// ================================================================== 3. the plan
// One plan in two phases. "Now" is the brief's goal plan (an emergency fund, for normal times), so it
// always shows. "If it hits" is the brief's backup plan, so it and the comparison need a scenario.
type ImpactProps = {
  c: Customer; shock: Shock; off: ReturnType<typeof official>; real: ReturnType<typeof realWorld>;
  goal: ReturnType<typeof goalPlan>; backup: ReturnType<typeof backupPlan>; plan: FullPlan;
};

const GREY = "var(--text-3)", BLUE = "var(--series-1)";
const mo = (x: number) => (x >= NO_SHORTFALL ? "No shortfall" : `${x.toFixed(1)} months`);

function Plans({ c, data, shock }: { c: Customer; data: EngineData; shock: Shock }) {
  const real = realWorld(c, shock, data.meta.ei_monthly_max);
  const off = official(c, shock);
  const goal = goalPlan(c);
  const backup = backupPlan(c, real, shock);
  const plan = fullPlan(c, real, shock, goal);
  const any = hasShock(shock);
  const okWithout = real.runway >= plan.need;
  const okWith = plan.runway >= plan.need - 0.05;
  const peer = c.decile ? data.meta.decile_cushion[String(c.decile)] : null;

  return (
    <section className="card">
      <h2 className="section-title">3 · Their plan</h2>
      {any && <Letter c={c} shock={shock} off={off} real={real} goal={goal} backup={backup} plan={plan} />}

      {any && (
        <div className="compare">
          <div className={"compare-box " + (okWithout ? "good" : "bad")}>
            <div className="compare-label">Without a plan</div>
            <div className="compare-value">{mo(real.runway)}</div>
            <div className="compare-ok">{okWithout ? "✓ Makes it" : "✕ Runs out early"}</div>
          </div>
          <div className="compare-arrow" aria-hidden>→</div>
          <div className={"compare-box " + (okWith ? "good" : "bad")}>
            <div className="compare-label">With the plan</div>
            <div className="compare-value">{mo(plan.runway)}</div>
            <div className="compare-ok">{okWith ? "✓ Makes it" : "✕ Still short"}</div>
          </div>
          <div className="compare-need">They need <b>{plan.need} months</b></div>
        </div>
      )}

      <div className="checklist">
        <div className="phase">
          <div className="phase-head"><span className="phase-tag">Now</span> Build an emergency fund <span className="phase-brief">(goal plan)</span></div>
          {!plan.saveFirst ? (
            <PlanItem n={1} title={`Keep at least ${money(goal.target)} in savings`}
              why={`That's 3 months of their spending, and they already have ${money(c.B)}.`} />
          ) : goal.monthlyTransfer > 0 && goal.monthsToGoal !== null ? (
            <PlanItem n={1}
              title={<>Move <b>{money(goal.monthlyTransfer)} a month</b> into savings automatically, for <b>{goal.monthsToGoal} months</b></>}
              why={<>{goal.transferSource === "surplus" ? "That's their usual monthly surplus. " : "From trimming 10% of non-essential spending. "}
                It takes savings from {money(c.B)} to <b>{money(goal.target)}</b> (3 months of spending). Without it, their balance keeps settling around {money(c.comfort)}.
                {peer !== null && <> People at their income level hold about {peer.toFixed(1)} months.</>}</>} />
          ) : (
            <PlanItem n={1} title={`Aim for ${money(goal.target)} in savings (3 months of spending)`}
              why="They have no money left over each month, so this needs a spending change first." />
          )}
        </div>

        <div className="phase">
          <div className="phase-head"><span className="phase-tag alt">If it hits</span> Cut back <span className="phase-brief">(backup plan)</span></div>
          {!any ? (
            <p className="muted" style={{ margin: "4px 0 0" }}>Run a scenario above to see what to do if a shock hits.</p>
          ) : plan.cutDollars <= 0.5 ? (
            <PlanItem n={2} title="No cuts needed"
              why={plan.saveFirst ? "With the emergency fund in place, their savings cover the whole shock." : "Their savings already cover the whole shock."} />
          ) : (
            <PlanItem n={2}
              title={<>Cut non-essential spending by <b>{money(plan.cutDollars)} a month</b>{plan.cutShare >= 0.995 ? " (all of it)" : ` (${pct(plan.cutShare)} of it)`}{shock.incomePct < 100 ? <>, for the {shock.duration} months</> : null}</>}
              why={<>Basic needs ({money(backup.essential)}/mo) stay protected.{" "}
                {plan.reachable ? "That makes the savings last as long as needed." : <>Even so, savings only last <b>{mo(plan.runway)}</b>, so they&apos;d also need extra income or help.</>}</>} />
          )}
          {any && <SpendBar c={c} real={real} backup={backup} plan={plan} />}
          {any && (
            <details className="more">
              <summary>What counts as basic needs?</summary>
              <p className="note">
                The data doesn&apos;t say what cash was spent on, so we protect whichever is larger: their labelled bills, insurance and
                loan payments ({money(c.F)}/mo), or {Math.round(ESSENTIAL_SHARE * 100)}% of their spending, the share Canadian households spend on
                basic needs (Statistics Canada, Survey of Household Spending 2023). Only the rest ({money(backup.nonEssential)}/mo) can be cut.
              </p>
            </details>
          )}
        </div>
      </div>

      {any && <PlanChart c={c} shock={shock} real={real} plan={plan} />}
    </section>
  );
}

/** Their monthly spending during the shock: protected basic needs, non-essential kept, the cut; vs income. */
function SpendBar({ c, real, backup, plan }: { c: Customer; real: ReturnType<typeof realWorld>; backup: ReturnType<typeof backupPlan>; plan: FullPlan }) {
  const extra = Math.max(0, real.spending - c.S);           // shock costs (bills, other spending): treated as protected
  const essential = backup.essential + extra;
  const cut = Math.min(plan.cutDollars, backup.nonEssential);
  const kept = Math.max(0, backup.nonEssential - cut);
  const scale = Math.max(real.spending, real.income, 1);
  const w = (x: number) => `${(100 * x) / scale}%`;
  const short = real.spending - real.income;
  return (
    <div className="spendbar">
      <div className="step-kicker">Their monthly spending during the shock</div>
      <div className="sb-track">
        <span className="sb-seg sb-need" style={{ width: w(essential) }} />
        <span className="sb-seg sb-kept" style={{ width: w(kept) }} />
        <span className="sb-seg sb-cut" style={{ width: w(cut) }} />
        <span className="sb-income" style={{ left: w(Math.min(real.income, scale)) }} />
      </div>
      <div className="sb-legend">
        <span><i className="sb-need" />Basic needs {money(essential)}</span>
        {kept > 0.5 && <span><i className="sb-kept" />Non-essential kept {money(kept)}</span>}
        {cut > 0.5 && <span><i className="sb-cut" />Cut {money(cut)}</span>}
        <span><i className="sb-inc" />Income during the shock {money(real.income)}</span>
      </div>
      <p className="note" style={{ margin: "4px 0 0" }}>
        {short > 0
          ? <>Income covers {money(real.income)} of {money(real.spending)} a month, so savings pay the other {money(short)}{cut > 0.5 ? <>, or {money(Math.max(0, short - cut))} after the cut</> : null}.</>
          : <>Income covers all of their spending during the shock.</>}
      </p>
    </div>
  );
}

function PlanItem({ n, title, why }: { n: number; title: React.ReactNode; why: React.ReactNode }) {
  return (
    <div className="plan-item">
      <span className="plan-num">{n}</span>
      <div>
        <div className="plan-do">{title}</div>
        <div className="plan-why">{why}</div>
      </div>
    </div>
  );
}

function PlanChart({ c, shock, real, plan }: { c: Customer; shock: Shock; real: ReturnType<typeof realWorld>; plan: FullPlan }) {
  const H = plan.need;   // only the months they need to get through, nothing after
  // Flat monthly spending, the same numbers as every runway on the page, so the chart can't contradict them.
  const none = monthlyPath(c, shock, real, H, { seasonal: false });
  const withPlan = monthlyPath(c, shock, real, H, { startBuffer: plan.startBuffer, cutDuringShock: plan.cutDollars, seasonal: false });
  const labels = none.pts.map(p => (p.k === 0 ? "Start" : MONTHS[(p.month + 10) % 12]));
  const lines = [
    { name: "Without a plan", color: GREY, dash: true, values: none.pts.map(p => p.balance) },
    { name: "With the plan", color: BLUE, values: withPlan.pts.map(p => p.balance) },
  ];
  return (
    <div className="plan-chart">
      <div className="step-kicker">Savings over the {H} months they need</div>
      <MultiLine labels={labels} lines={lines} fmt={kfmt}
        ariaLabel="Savings month by month, without and with the plan" />
      <p className="note">Same monthly numbers as the runways above. Below $0 means they&apos;ve run out before the end.</p>
    </div>
  );
}

// ------------------------------------------------------------------ the summary: instant template, then Gemini
const letterCache = new Map<string, { text: string; src: string }>();

function Letter(props: ImpactProps) {
  const s = summary(props);
  const key = JSON.stringify(s);
  const [, bump] = useState(0);
  useEffect(() => {
    if (letterCache.has(key)) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: key });
        const j = await r.json();
        letterCache.set(key, { text: j.text, src: j.source });
      } catch { letterCache.set(key, { text: template(JSON.parse(key)), src: "fallback" }); }
      bump(x => x + 1);
    }, 1500);
    return () => clearTimeout(t);
  }, [key]);
  const got = letterCache.get(key);
  const text = got?.text ?? template(s);
  const note = !got ? "Personalising with Gemini…" : got.src === "gemini" ? "Worded by Gemini · numbers from the engine" : "Numbers from the engine";
  return (
    <div className="story">
      <p className={"story-text" + (got ? "" : " pending")}>{text}</p>
      <p className="note">{!got && <span className="dot" />}{note}</p>
    </div>
  );
}

function describeShock(c: Customer, s: Shock): string {
  const parts: string[] = [];
  if (s.incomePct < 100) parts.push(`${s.jobLoss ? "job loss: " : ""}income drops to ${s.incomePct}% of usual for ${s.duration} months`);
  if (s.billsPct > 0) parts.push(`household bills/rent go up ${s.billsPct}%`);
  if (s.otherDollars) parts.push(`monthly costs go up ${money(s.otherDollars)}`);
  if (s.otherPct) parts.push(`all spending goes up ${s.otherPct}%`);
  if (s.oneOffMonths > 0) parts.push(`a one-off cost of ${money(s.oneOffMonths * c.S)} (${s.oneOffMonths} month${s.oneOffMonths === 1 ? "" : "s"} of spending)`);
  if (s.oneOffDollars > 0) parts.push(`a one-off cost of ${money(s.oneOffDollars)}`);
  return parts.join("; ") + `, starting in ${MONTHS[s.startMonth - 1]}`;
}

function summary({ c, shock, off, real, goal, backup, plan }: ImpactProps): Summary {
  const r1 = (x: number) => Math.round(x);
  return {
    account: c.id, income: r1(c.I), spending: r1(c.S), fixed: r1(c.F), buffer: r1(c.B),
    comfort_number: r1(c.comfort), cushion_months: +(c.B / c.S).toFixed(1), pensioner: c.pensioner,
    shock, official_runway: off.runway, real_runway: real.runway, real_notes: real.notes,
    shock_description: describeShock(c, shock),
    buffer_after_shock: r1(real.bufferLeft),
    essential: r1(backup.essential),
    goal: { target: r1(goal.target), gap: r1(goal.gap), monthly_transfer: r1(goal.monthlyTransfer), months_to_goal: goal.monthsToGoal },
    plan: { need: plan.need, save_first: plan.saveFirst, cut_dollars: r1(plan.cutDollars), cut_share: +plan.cutShare.toFixed(2),
      reachable: plan.reachable, runway: plan.runway },
  };
}
