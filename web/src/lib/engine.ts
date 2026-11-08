// Resilience engine: judges' formulas, real-world corrections, month-by-month path, plans.
// Pure functions, no React, so they can be tested against the Python numbers.

export type EngineData = {
  meta: {
    ei_weekly_max: number;
    ei_monthly_max: number;
    bills_share: number;
    n: number;
    pop_season: number[];
    decile_cushion: Record<string, number>;
    decile_comfort: Record<string, number>;
    source: string;
  };
  id: number[];
  I: number[]; S: number[]; F: number[]; H: number[]; B: number[]; P: number[];
  mean_in: number[]; mean_out: number[]; comfort: (number | null)[];
  cash_share: (number | null)[]; pension_share: number[];
  season: number[][]; age: (number | null)[]; gender: string[]; district: string[]; region: string[];
  decile: number[]; months: number[]; flags: string[];
};

export type Customer = {
  id: number;
  I: number; S: number; F: number; H: number; B: number; P: number;
  meanIn: number; meanOut: number;
  comfort: number;            // where the balance settles (median month-end balance after month 3)
  cashShare: number;
  pensionShare: number;
  season: number[];           // 12 spending factors, average 1
  age: number | null; gender: string; district: string; region: string;
  decile: number;             // income decile among non-pensioners (0 = pensioner)
  months: number;
  pensioner: boolean; billsZero: boolean; everNegative: boolean; onEdge: boolean;
  irregular: boolean; hasAutopay: boolean; shared: boolean;
};

export function indexData(d: EngineData): Map<number, number> {
  const m = new Map<number, number>();
  d.id.forEach((id, i) => m.set(id, i));
  return m;
}

export function getCustomer(d: EngineData, idx: Map<number, number>, id: number): Customer | null {
  const i = idx.get(id);
  if (i === undefined) return null;
  const f = d.flags[i];
  return {
    id, I: d.I[i], S: d.S[i], F: d.F[i], H: d.H[i], B: d.B[i], P: d.P[i],
    meanIn: d.mean_in[i], meanOut: d.mean_out[i],
    comfort: d.comfort[i] ?? d.B[i],
    cashShare: d.cash_share[i] ?? 0,
    pensionShare: d.pension_share[i], season: d.season[i],
    age: d.age[i], gender: d.gender[i], district: d.district[i], region: d.region[i],
    decile: d.decile[i], months: d.months[i],
    pensioner: f.includes("p"), billsZero: f.includes("b"), everNegative: f.includes("n"),
    onEdge: f.includes("e"), irregular: f.includes("i"), hasAutopay: f.includes("a"), shared: f.includes("s"),
  };
}

// ---------------------------------------------------------------- shocks
export type Shock = {
  incomePct: number;      // income during the shock as % of usual (100 = no change, 55 = EI)
  jobLoss: boolean;       // true = layoff, so EI rules (the weekly maximum) apply; false = e.g. reduced hours
  billsPct: number;       // household bills increase, % (the judges' rule: + billsPct% x H)
  otherPct?: number;      // all usual spending goes up, % (e.g. inflation): + otherPct% x S
  otherDollars?: number;  // new or higher recurring cost, $/month (childcare, a car payment, rent up $300)
  oneOffMonths: number;   // one-off cost in months of typical spending (furnace = 1)
  oneOffDollars: number;  // extra one-off cost in dollars
  duration: number;       // months until income returns
  startMonth: number;     // 1-12, month the shock starts
};

export const NO_SHOCK: Shock = { incomePct: 100, jobLoss: false, billsPct: 0, otherPct: 0, otherDollars: 0, oneOffMonths: 0, oneOffDollars: 0, duration: 6, startMonth: 1 };

export const TWISTS: { key: string; label: string; shock: Partial<Shock> }[] = [
  { key: "ei", label: "Laid off, EI 55% for 6 months", shock: { incomePct: 55, jobLoss: true, billsPct: 0, oneOffMonths: 0, duration: 6 } },
  { key: "furnace", label: "Furnace dies (1 month of spending)", shock: { incomePct: 100, billsPct: 0, oneOffMonths: 1 } },
  { key: "combo", label: "Laid off + bills up 15%", shock: { incomePct: 55, jobLoss: true, billsPct: 15, oneOffMonths: 0, duration: 6 } },
  { key: "rent", label: "Rent and bills up 25%", shock: { incomePct: 100, billsPct: 25, oneOffMonths: 0 } },
];

export const NO_SHORTFALL = 120;

/** Round to 1 decimal the way Python/numpy does (exact halves go to the even digit), so the app
 *  matches answer keys computed in Python. JavaScript's Math.round always rounds halves up. */
function round1(x: number): number {
  const y = x * 10;
  const r = Math.abs(y - Math.trunc(y)) === 0.5 ? 2 * Math.round(y / 2) : Math.round(y);
  return r / 10;
}

/** The judges' runway rule (README): rounded to 1 decimal, capped at 120. */
export function judgesRunway(bufferLeft: number, gap: number): number {
  if (bufferLeft <= 0) return 0;
  if (gap <= 0) return NO_SHORTFALL;
  return round1(Math.min(bufferLeft / gap, NO_SHORTFALL));
}

export type Result = {
  income: number; spending: number; bufferLeft: number; gap: number; runway: number;
  notes: string[];
};

/** Extra monthly spending beyond the judges' bills rule. The brief says a shock "changes income or
 *  spending"; this adds other recurring costs the same way (0 for all of the brief's own cards). */
export function otherSpending(c: Customer, s: Shock): number {
  return ((s.otherPct ?? 0) / 100) * c.S + (s.otherDollars ?? 0);
}

/** Official numbers, exactly as the judges define them. */
export function official(c: Customer, s: Shock): Result {
  const income = (s.incomePct / 100) * c.I;
  const spending = c.S + (s.billsPct / 100) * c.H + otherSpending(c, s);
  const bufferLeft = c.B - s.oneOffMonths * c.S - s.oneOffDollars;
  const gap = spending - income;
  return { income, spending, bufferLeft, gap, runway: judgesRunway(bufferLeft, gap), notes: [] };
}

/** Same formula with real-world rules: EI maximum (job losses only) and pensions keep paying.
 *  No estimates: if a customer's bills aren't in the data, a bills increase is reported as unmeasurable. */
export function realWorld(c: Customer, s: Shock, eiMonthlyMax: number): Result {
  const notes: string[] = [];
  const jobLoss = s.jobLoss && s.incomePct < 100;   // EI only applies after a job loss, not e.g. reduced hours
  const pension = c.pensioner ? c.I * c.pensionShare : 0;
  let earned = (s.incomePct / 100) * (c.I - pension);
  if (jobLoss && c.pensioner) notes.push("Pension keeps paying; only the rest of income drops.");
  if (jobLoss && s.incomePct > 0 && earned > eiMonthlyMax) {
    notes.push(`EI maximum applied: ${money(eiMonthlyMax)}/month instead of ${money(earned)}.`);
    earned = eiMonthlyMax;
  }
  const income = pension + earned;
  if (s.billsPct > 0 && c.billsZero) {
    notes.push("This customer's household bills aren't recorded in the data, so a percentage bills increase can't be measured for them.");
  }
  const spending = c.S + (s.billsPct / 100) * c.H + otherSpending(c, s);
  const bufferLeft = c.B - s.oneOffMonths * c.S - s.oneOffDollars;
  const gap = spending - income;
  return { income, spending, bufferLeft, gap, runway: judgesRunway(bufferLeft, gap), notes };
}

export type PathPoint = { k: number; month: number; balance: number; income: number; spending: number };

/** Month-by-month balance with seasonal spending; usual income returns after `duration`. */
export function monthlyPath(c: Customer, s: Shock, real: Result, horizon = 24,
  opts: { startBuffer?: number; cutDuringShock?: number } = {}) {
  // startBuffer: savings before one-off costs (default: today's buffer). cutDuringShock: $/month less
  // spending while the shock lasts (backup plan). Defaults reproduce the plain path exactly.
  const oneOff = c.B - real.bufferLeft;
  let bal = opts.startBuffer === undefined ? real.bufferLeft : opts.startBuffer - oneOff;
  const cut = opts.cutDuringShock ?? 0;
  const pts: PathPoint[] = [{ k: 0, month: s.startMonth, balance: bal, income: 0, spending: 0 }];
  let runsOutAt: number | null = bal <= 0 ? 0 : null;
  let low = bal;
  const extraBills = real.spending - c.S;
  for (let k = 0; k < horizon; k++) {
    const m = ((s.startMonth - 1 + k) % 12) + 1;
    const shocked = k < s.duration;
    const income = shocked ? real.income : c.I;
    const spending = c.S * c.season[m - 1] + (shocked || s.incomePct === 100 ? extraBills : 0) - (shocked ? cut : 0);
    const next = bal + income - spending;
    if (runsOutAt === null && next < 0) runsOutAt = k + bal / (spending - income);
    bal = next;
    low = Math.min(low, bal);
    pts.push({ k: k + 1, month: (m % 12) + 1, balance: bal, income, spending });
  }
  return { pts, runsOutAt, low };
}

// ---------------------------------------------------------------- plans
/** Share of household spending that goes to basic needs in Canada: food from stores, main home
 *  (rent/mortgage, utilities, property tax, upkeep), transportation, health care and clothing.
 *  Statistics Canada, Survey of Household Spending 2023, Table 11-10-0222-01, Canada, average per
 *  household: $8,579 + $22,226 + $12,019 + $3,060 + $2,716 = $48,600 of $76,146 total current
 *  consumption = 63.8%. Used only to stop plans from cutting basic needs; it's a national average,
 *  not this customer's actual spending (the data can't show what cash was spent on). */
export const ESSENTIAL_SHARE = 48600 / 76146;

/** Spending we treat as protected: labelled bills/insurance/loans, or the Canadian basic-needs share
 *  of their spending, whichever is larger. The rest is "non-essential" (an estimate). */
export function essentialFloor(c: Customer): number {
  return Math.max(c.F, ESSENTIAL_SHARE * c.S);
}

export type GoalPlan = {
  target: number; have: number; gap: number; cushionMonths: number; comfortMonths: number;
  monthlyTransfer: number; transferSource: "surplus" | "trim";
  monthsToGoal: number | null;
};

export function goalPlan(c: Customer, targetMonths = 3): GoalPlan {
  const target = targetMonths * c.S;
  const gap = Math.max(0, target - c.B);
  const surplus = Math.max(0, c.meanIn - c.meanOut);
  const nonEssential = Math.max(0, c.S - essentialFloor(c));
  const transferSource = surplus >= 0.02 * c.I ? "surplus" : "trim";
  const monthlyTransfer = transferSource === "surplus" ? surplus : 0.1 * nonEssential;
  const m1 = monthlyTransfer > 0 ? gap / monthlyTransfer : null;
  return {
    target, have: c.B, gap, cushionMonths: c.S > 0 ? c.B / c.S : 0,
    comfortMonths: c.S > 0 ? c.comfort / c.S : 0,
    monthlyTransfer, transferSource,
    monthsToGoal: m1 === null ? null : Math.ceil(m1),
  };
}

export type BackupPlan = {
  targetMonths: number;
  essential: number;                // protected spending per month (see essentialFloor)
  nonEssential: number;             // the rest of their usual spending: the most they could cut
  cutNeeded: number | null;         // share of non-essential spending to cut to reach target (0 = none needed)
  cutDollars: number;
  options: { cut: number; runway: number }[];   // cut 25%, 50%, all of non-essential spending
  reachable: boolean;               // false = even cutting all non-essential spending isn't enough
  bestRunway: number;               // runway if they cut all non-essential spending
};

/** How much non-essential spending to cut so the real-world runway reaches `target` months.
 *  Basic needs are never cut (see ESSENTIAL_SHARE). */
export function backupPlan(c: Customer, real: Result, s: Shock): BackupPlan {
  const targetMonths = Math.max(3, s.incomePct < 100 ? s.duration : 3);
  const essential = essentialFloor(c);
  const nonEssential = Math.max(0, c.S - essential);
  const options = [0.25, 0.5, 1].map(cut => ({
    cut, runway: judgesRunway(real.bufferLeft, real.gap - cut * nonEssential),
  }));
  const bestRunway = options[2].runway;
  if (real.bufferLeft <= 0) return { targetMonths, essential, nonEssential, cutNeeded: null, cutDollars: 0, options, reachable: false, bestRunway };
  const neededSpending = real.bufferLeft / targetMonths + real.income;
  const cutDollars = Math.max(0, real.spending - neededSpending);
  const cutNeeded = nonEssential > 0 ? cutDollars / nonEssential : cutDollars > 0 ? Infinity : 0;
  return { targetMonths, essential, nonEssential, cutNeeded, cutDollars, options, reachable: cutNeeded <= 1, bestRunway };
}

// ---------------------------------------------------------------- formatting
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function money(x: number): string {
  const s = "$" + Math.round(Math.abs(x)).toLocaleString("en-CA");
  return x < 0 ? "−" + s : s;
}

export function runwayText(r: number): string {
  if (r >= NO_SHORTFALL) return "No shortfall (120+)";
  return `${r.toFixed(1)} months`;
}
