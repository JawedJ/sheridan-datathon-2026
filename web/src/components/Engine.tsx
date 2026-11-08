"use client";
import { useEffect, useMemo, useState } from "react";
import {
  type Customer, type EngineData, type Shock, MONTHS, NO_SHOCK, NO_SHORTFALL,
  ESSENTIAL_SHARE, backupPlan, getCustomer, goalPlan, indexData, judgesRunway, money, monthlyPath, official,
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
// The goal plan is for normal times (the brief: "a goal plan, like building an emergency fund"), so it
// always shows. The backup plan is "for if the shock hits", so it and the outcomes need a scenario.
type ImpactProps = {
  c: Customer; shock: Shock; off: ReturnType<typeof official>; real: ReturnType<typeof realWorld>;
  goal: ReturnType<typeof goalPlan>; backup: ReturnType<typeof backupPlan>;
};

const GREY = "var(--text-3)", BLUE = "var(--series-1)", ORANGE = "var(--series-2)", INK = "var(--text)";
const mo = (x: number) => (x >= NO_SHORTFALL ? "No shortfall" : `${x.toFixed(1)} mo`);

function Plans({ c, data, shock }: { c: Customer; data: EngineData; shock: Shock }) {
  const real = realWorld(c, shock, data.meta.ei_monthly_max);
  const off = official(c, shock);
  const goal = goalPlan(c);
  const backup = backupPlan(c, real, shock);
  const any = hasShock(shock);

  const oneOff = c.B - real.bufferLeft;
  const goalStart = Math.max(c.B, goal.target);
  const cutShare = backup.cutNeeded === null ? 1 : Math.min(1, backup.cutNeeded);
  const cut = cutShare * backup.nonEssential;
  const backupRunway = judgesRunway(real.bufferLeft, real.gap - cut);
  const goalFirstRunway = goal.gap > 0 ? judgesRunway(goalStart - oneOff, real.gap) : null;
  const bothRunway = goalFirstRunway !== null && cut > 0 ? judgesRunway(goalStart - oneOff, real.gap - cut) : null;
  const props = { c, shock, off, real, goal, backup };

  return (
    <section className="card">
      <h2 className="section-title">3 · The plan</h2>
      {any && <Letter {...props} goalFirstRunway={goalFirstRunway} bothRunway={bothRunway} />}
      {any && (
        <Outcomes need={backup.targetMonths} real={real} cut={cut} cutShare={cutShare} backupRunway={backupRunway}
          goalStart={goalStart} goalFirstRunway={goalFirstRunway} bothRunway={bothRunway} />
      )}
      <div className="steps">
        <GoalStep c={c} goal={goal} />
        {any ? <BackupStep c={c} real={real} backup={backup} /> : (
          <div className="step step-empty">
            <div className="step-kicker">Step 2 · If a shock hits</div>
            <p className="muted" style={{ margin: 0 }}>Run a scenario above to see the backup plan and how long their savings last.</p>
          </div>
        )}
      </div>
      {any && (
        <PlanChart c={c} shock={shock} real={real} cut={cut} goalStart={goalStart}
          showGoal={goalFirstRunway !== null} showBoth={bothRunway !== null} />
      )}
    </section>
  );
}

function Outcomes({ need, real, cut, cutShare, backupRunway, goalStart, goalFirstRunway, bothRunway }: {
  need: number; real: ReturnType<typeof realWorld>; cut: number; cutShare: number; backupRunway: number;
  goalStart: number; goalFirstRunway: number | null; bothRunway: number | null;
}) {
  const cutLabel = cutShare >= 1 ? "Cut all non-essential" : `Cut ${pct(cutShare)} of non-essential`;
  return (
    <>
      <p className="impact-lead">How long savings last. They need <b>{need} months</b>.</p>
      <div className="outcomes">
        <Outcome color={GREY} dash name="No plan" value={mo(real.runway)} detail="Spending as usual" ok={real.runway >= need} />
        <Outcome color={ORANGE} name="Backup plan" value={mo(cut > 0 ? backupRunway : real.runway)}
          detail={cut > 0 ? `${cutLabel} (${money(cut)}/mo)` : "No cuts needed"} ok={(cut > 0 ? backupRunway : real.runway) >= need} />
        <Outcome color={BLUE} name="Goal plan first" value={goalFirstRunway !== null ? mo(goalFirstRunway) : "Already there"}
          detail={goalFirstRunway !== null ? `Start with ${money(goalStart)} saved` : "Already has 3 months saved"}
          ok={goalFirstRunway !== null ? goalFirstRunway >= need : null} />
        {bothRunway !== null && (
          <Outcome color={INK} name="Both plans" value={mo(bothRunway)} detail="Save first, then cut back" ok={bothRunway >= need} />
        )}
      </div>
    </>
  );
}

function Outcome({ color, dash, name, value, detail, ok }: {
  color: string; dash?: boolean; name: string; value: string; detail: string; ok?: boolean | null;
}) {
  return (
    <div className="outcome" style={{ borderTopColor: color, borderTopStyle: dash ? "dashed" : "solid" }}>
      <div className="outcome-name">{name}</div>
      <div className="outcome-value">{value}</div>
      <div className="outcome-detail">{detail}</div>
      {ok !== undefined && ok !== null && (
        <div className={"outcome-ok " + (ok ? "good" : "bad")}>{ok ? "✓ Makes it" : "✕ Runs out early"}</div>
      )}
    </div>
  );
}

function GoalStep({ c, goal }: { c: Customer; goal: ReturnType<typeof goalPlan> }) {
  return (
    <div className="step">
      <div className="step-kicker">Step 1 · Before a shock</div>
      <div className="step-title">Build a 3-month emergency fund</div>
      {goal.gap === 0 ? (
        <>
          <div className="step-big">Already there</div>
          <div className="step-sub">{goal.cushionMonths.toFixed(1)} months saved. Next goal: 6 months ({money(6 * c.S)}).</div>
        </>
      ) : goal.monthlyTransfer > 0 ? (
        <>
          <div className="step-big">{money(goal.monthlyTransfer)}<small>/mo into savings</small></div>
          <div className="step-sub">
            {goal.transferSource === "surplus" ? "Automatic transfer of their usual surplus" : "From trimming 10% of non-essential spending"}
            {goal.monthsToGoal !== null && <> · ready in <b>{goal.monthsToGoal} months</b></>}
          </div>
          <div className="progress" aria-label={`${pct(goal.have / goal.target)} of target`}>
            <div style={{ width: pct(Math.min(1, goal.have / goal.target)) }} />
          </div>
          <div className="step-meta"><span>{money(goal.have)} saved</span><span>goal {money(goal.target)}</span></div>
        </>
      ) : (
        <div className="step-sub">No money left over each month to transfer.</div>
      )}
      <p className="step-why">Without it, their balance keeps settling around {money(c.comfort)}.</p>
    </div>
  );
}

function BackupStep({ c, real, backup }: { c: Customer; real: ReturnType<typeof realWorld>; backup: ReturnType<typeof backupPlan> }) {
  const need = backup.targetMonths;
  const noCuts = real.runway >= NO_SHORTFALL || backup.cutNeeded === 0;
  const scale = Math.max(need, ...backup.options.map(o => Math.min(o.runway, need * 2)), real.runway < NO_SHORTFALL ? real.runway : 0);
  const bars = [{ label: "No cuts", runway: real.runway }, ...backup.options.map(o => ({ label: o.cut === 1 ? "Cut all" : `Cut ${pct(o.cut)}`, runway: o.runway }))];
  return (
    <div className="step">
      <div className="step-kicker">Step 2 · If it hits</div>
      <div className="step-title">
        {noCuts ? "No cuts needed" : backup.reachable ? "Cut non-essential spending" : "Cutting back isn't enough on its own"}
      </div>
      {noCuts ? (
        <div className="step-big">{mo(real.runway)}<small> without changes</small></div>
      ) : backup.reachable && backup.cutNeeded !== null ? (
        <>
          <div className="step-big">{money(backup.cutDollars)}<small>/mo less spending</small></div>
          <div className="step-sub">{pct(backup.cutNeeded)} of non-essential spending · lasts {need} months</div>
        </>
      ) : (
        <>
          <div className="step-big">{mo(backup.bestRunway)}<small> at most</small></div>
          <div className="step-sub">even cutting all {money(backup.nonEssential)}/mo of non-essential spending</div>
        </>
      )}
      {!noCuts && (
        <div className="cutbars" aria-label="How long savings last at each level of cutting">
          {bars.map(b => {
            const w = Math.min(1, Math.min(b.runway, scale) / scale);
            const ok = b.runway >= need;
            return (
              <div key={b.label} className="cutbar">
                <span className="cutbar-label">{b.label}</span>
                <span className="cutbar-track">
                  <span className={"cutbar-fill" + (ok ? " ok" : "")} style={{ width: `${w * 100}%` }} />
                  <span className="cutbar-need" style={{ left: `${(need / scale) * 100}%` }} />
                </span>
                <span className="cutbar-value">{mo(b.runway)}</span>
              </div>
            );
          })}
          <div className="cutbar-key">Line = {need} months needed</div>
        </div>
      )}
      <details className="more">
        <summary>Basic needs protected: {money(backup.essential)}/mo</summary>
        <p className="note">
          The data doesn&apos;t say what cash was spent on, so we protect whichever is larger: their labelled bills, insurance and
          loan payments ({money(c.F)}/mo), or {Math.round(ESSENTIAL_SHARE * 100)}% of their spending, the share Canadian households spend on
          basic needs (Statistics Canada, Survey of Household Spending 2023). Only the rest ({money(backup.nonEssential)}/mo) is treated as cuttable.
        </p>
      </details>
    </div>
  );
}

function PlanChart({ c, shock, real, cut, goalStart, showGoal, showBoth }: {
  c: Customer; shock: Shock; real: ReturnType<typeof realWorld>; cut: number; goalStart: number; showGoal: boolean; showBoth: boolean;
}) {
  const H = 24;
  const none = monthlyPath(c, shock, real, H);
  const withCut = monthlyPath(c, shock, real, H, { cutDuringShock: cut });
  const first = monthlyPath(c, shock, real, H, { startBuffer: goalStart });
  const both = monthlyPath(c, shock, real, H, { startBuffer: goalStart, cutDuringShock: cut });
  const labels = none.pts.map(p => (p.k === 0 ? "Start" : MONTHS[(p.month + 10) % 12]));
  const lines = [
    { name: "No plan", color: GREY, dash: true, values: none.pts.map(p => p.balance) },
    ...(cut > 0 ? [{ name: "Backup plan", color: ORANGE, values: withCut.pts.map(p => p.balance) }] : []),
    ...(showGoal ? [{ name: "Goal plan first", color: BLUE, values: first.pts.map(p => p.balance) }] : []),
    ...(showBoth ? [{ name: "Both plans", color: INK, values: both.pts.map(p => p.balance) }] : []),
  ];
  return (
    <div className="plan-chart">
      <div className="step-kicker">Savings month by month</div>
      <MultiLine labels={labels} lines={lines} fmt={kfmt} shade={shock.incomePct < 100 ? { to: shock.duration, label: "shock period" } : undefined}
        ariaLabel="Savings month by month: no plan, backup plan, goal plan first, both" />
      <p className="note">Projection using their usual seasonal spending. Below $0 means they&apos;ve run out.</p>
    </div>
  );
}

// ------------------------------------------------------------------ the summary: instant template, then Gemini
const letterCache = new Map<string, { text: string; src: string }>();

function Letter(props: ImpactProps & { goalFirstRunway: number | null; bothRunway: number | null }) {
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

function summary({ c, shock, off, real, goal, backup, goalFirstRunway, bothRunway }: ImpactProps & { goalFirstRunway: number | null; bothRunway: number | null }): Summary {
  const r1 = (x: number) => Math.round(x);
  return {
    account: c.id, income: r1(c.I), spending: r1(c.S), fixed: r1(c.F), buffer: r1(c.B),
    comfort_number: r1(c.comfort), cushion_months: +(c.B / c.S).toFixed(1), pensioner: c.pensioner,
    shock,
    official_runway: off.runway, real_runway: real.runway, real_notes: real.notes,
    shock_description: describeShock(c, shock),
    buffer_after_shock: r1(real.bufferLeft),
    goal_first_runway: goalFirstRunway, both_runway: bothRunway,
    goal: { target: r1(goal.target), gap: r1(goal.gap), monthly_transfer: r1(goal.monthlyTransfer), months_to_goal: goal.monthsToGoal },
    backup: {
      target_months: backup.targetMonths, reachable: backup.reachable,
      // when cutting can't get there, don't hand over a "needed" cut bigger than all non-essential spending
      cut_share_of_non_essential: backup.reachable ? backup.cutNeeded : null,
      cut_dollars: backup.reachable ? r1(backup.cutDollars) : r1(backup.nonEssential),
      non_essential_dollars: r1(backup.nonEssential), runway_if_cut_all: backup.bestRunway,
    },
  };
}
