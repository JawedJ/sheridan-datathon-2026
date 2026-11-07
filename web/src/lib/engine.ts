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
  cash_share: (number | null)[]; pension_share: number[]; bonus_pct: number[];
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
  bonusPct: number;           // extra income in June and December (0 = none)
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
    pensionShare: d.pension_share[i], bonusPct: d.bonus_pct[i], season: d.season[i],
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
  billsPct: number;       // household bills increase, %
  oneOffMonths: number;   // one-off cost in months of typical spending (furnace = 1)
  oneOffDollars: number;  // extra one-off cost in dollars
  duration: number;       // months until income returns
  startMonth: number;     // 1-12, month the shock starts
};

export const NO_SHOCK: Shock = { incomePct: 100, jobLoss: false, billsPct: 0, oneOffMonths: 0, oneOffDollars: 0, duration: 6, startMonth: 1 };

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

/** Official numbers, exactly as the judges define them. */
export function official(c: Customer, s: Shock): Result {
  const income = (s.incomePct / 100) * c.I;
  const spending = c.S + (s.billsPct / 100) * c.H;
  const bufferLeft = c.B - s.oneOffMonths * c.S - s.oneOffDollars;
  const gap = spending - income;
  return { income, spending, bufferLeft, gap, runway: judgesRunway(bufferLeft, gap), notes: [] };
}

/** Same formula with real-world rules: EI maximum (job losses only), pensions keep paying, cash-paid bills estimated. */
export function realWorld(c: Customer, s: Shock, eiMonthlyMax: number, billsShare: number): Result {
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
  let H = c.H;
  if (s.billsPct > 0 && c.billsZero) {
    H = billsShare * c.S;
    notes.push(`No bills show in the data (paid in cash), so bills are estimated at ${money(H)}/month.`);
  }
  const spending = c.S + (s.billsPct / 100) * H;
  const bufferLeft = c.B - s.oneOffMonths * c.S - s.oneOffDollars;
  const gap = spending - income;
  return { income, spending, bufferLeft, gap, runway: judgesRunway(bufferLeft, gap), notes };
}

export type PathPoint = { k: number; month: number; balance: number; income: number; spending: number };

/** Month-by-month balance with seasonal spending; income returns (with bonus months) after `duration`. */
export function monthlyPath(c: Customer, s: Shock, real: Result, horizon = 24) {
  let bal = real.bufferLeft;
  const pts: PathPoint[] = [{ k: 0, month: s.startMonth, balance: bal, income: 0, spending: 0 }];
  let runsOutAt: number | null = bal <= 0 ? 0 : null;
  let low = bal;
  const extraBills = real.spending - c.S;
  for (let k = 0; k < horizon; k++) {
    const m = ((s.startMonth - 1 + k) % 12) + 1;
    const shocked = k < s.duration;
    const bonus = !shocked && (m === 6 || m === 12) ? c.I * c.bonusPct : 0;
    const income = shocked ? real.income : c.I + bonus;
    const spending = c.S * c.season[m - 1] + (shocked || s.incomePct === 100 ? extraBills : 0);
    const next = bal + income - spending;
    if (runsOutAt === null && next < 0) runsOutAt = k + bal / (spending - income);
    bal = next;
    low = Math.min(low, bal);
    pts.push({ k: k + 1, month: (m % 12) + 1, balance: bal, income, spending });
  }
  return { pts, runsOutAt, low };
}

// ---------------------------------------------------------------- plans
export type GoalPlan = {
  target: number; have: number; gap: number; cushionMonths: number; comfortMonths: number;
  monthlyTransfer: number; transferSource: "surplus" | "trim"; bonusBoost: number;
  monthsToGoal: number | null; monthsWithBonus: number | null;
};

export function goalPlan(c: Customer, targetMonths = 3): GoalPlan {
  const target = targetMonths * c.S;
  const gap = Math.max(0, target - c.B);
  const surplus = Math.max(0, c.meanIn - c.meanOut);
  const flex = Math.max(0, c.S - c.F);
  const transferSource = surplus >= 0.02 * c.I ? "surplus" : "trim";
  const monthlyTransfer = transferSource === "surplus" ? surplus : 0.05 * flex;
  const bonusBoost = c.bonusPct > 0 ? (0.5 * 2 * c.I * c.bonusPct) / 12 : 0;
  const m1 = monthlyTransfer > 0 ? gap / monthlyTransfer : null;
  const m2 = monthlyTransfer + bonusBoost > 0 ? gap / (monthlyTransfer + bonusBoost) : null;
  return {
    target, have: c.B, gap, cushionMonths: c.S > 0 ? c.B / c.S : 0,
    comfortMonths: c.S > 0 ? c.comfort / c.S : 0,
    monthlyTransfer, transferSource, bonusBoost,
    monthsToGoal: m1 === null ? null : Math.ceil(m1), monthsWithBonus: m2 === null ? null : Math.ceil(m2),
  };
}

export type BackupPlan = {
  targetMonths: number; flexible: number; fixedShare: number;
  cutNeeded: number | null;         // share of flexible spending to cut to reach target (0 = none needed)
  cutDollars: number;
  options: { cut: number; runway: number }[];
  reachable: boolean;
};

/** How much flexible spending to cut so the real-world runway reaches `target` months. */
export function backupPlan(c: Customer, real: Result, s: Shock): BackupPlan {
  const targetMonths = Math.max(3, s.incomePct < 100 ? s.duration : 3);
  const flexible = Math.max(0, c.S - c.F);
  const fixedShare = c.S > 0 ? c.F / c.S : 0;
  const options = [0.1, 0.25, 0.5].map(cut => ({
    cut, runway: judgesRunway(real.bufferLeft, real.gap - cut * flexible),
  }));
  if (real.bufferLeft <= 0) return { targetMonths, flexible, fixedShare, cutNeeded: null, cutDollars: 0, options, reachable: false };
  const neededSpending = real.bufferLeft / targetMonths + real.income;
  const cutDollars = Math.max(0, real.spending - neededSpending);
  const cutNeeded = flexible > 0 ? cutDollars / flexible : cutDollars > 0 ? Infinity : 0;
  return { targetMonths, flexible, fixedShare, cutNeeded, cutDollars, options, reachable: cutNeeded <= 1 };
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
