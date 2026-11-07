// Reads a twist card written in plain words. Gemini turns the sentence into the engine's shock
// settings (structured JSON, checked against a schema); our code range-checks every value and
// builds the "Understood as" list from what will actually be applied. Anything the engine can't
// model is listed back to the user, never silently dropped or guessed.

import { MONTHS, NO_SHOCK, type Shock } from "./engine";

/** What Gemini returns (all fields present; null = not mentioned). */
export type ParsedScenario = {
  account_id: number | null;
  income_pct: number | null;        // income during the shock, % of usual (null = income unchanged)
  ei_rules: boolean;                // layoff / sick / parental leave: EI rules (incl. weekly maximum) apply
  duration_months: number | null;   // how long the income drop lasts
  bills_pct: number | null;         // household bills / rent increase, %
  bills_dollars: number | null;     // ... or as dollars per month (converted with the customer's bills)
  one_off_months: number | null;    // one-off cost as months of usual spending
  one_off_dollars: number | null;   // one-off cost in dollars
  start_month: number | null;       // 1-12
  assumptions: string[];            // defaults the reader had to apply
  not_modelled: string[];           // parts of the card the engine can't represent
};

export const SCENARIO_SCHEMA = {
  type: "OBJECT",
  properties: {
    account_id: { type: "INTEGER", nullable: true },
    income_pct: { type: "NUMBER", nullable: true },
    ei_rules: { type: "BOOLEAN" },
    duration_months: { type: "NUMBER", nullable: true },
    bills_pct: { type: "NUMBER", nullable: true },
    bills_dollars: { type: "NUMBER", nullable: true },
    one_off_months: { type: "NUMBER", nullable: true },
    one_off_dollars: { type: "NUMBER", nullable: true },
    start_month: { type: "INTEGER", nullable: true },
    assumptions: { type: "ARRAY", items: { type: "STRING" } },
    not_modelled: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["account_id", "income_pct", "ei_rules", "duration_months", "bills_pct", "bills_dollars",
    "one_off_months", "one_off_dollars", "start_month", "assumptions", "not_modelled"],
  propertyOrdering: ["account_id", "income_pct", "ei_rules", "duration_months", "bills_pct", "bills_dollars",
    "one_off_months", "one_off_dollars", "start_month", "assumptions", "not_modelled"],
};

export function scenarioPrompt(text: string, todayMonth: number): string {
  return `You convert a financial "shock" scenario, written in plain English by a hackathon judge, into settings for a bank-customer resilience engine. Read the scenario carefully, like an expert financial analyst, and fill in the JSON fields exactly as defined below.

THE ENGINE CAN ONLY MODEL THESE THINGS
1. account_id: the customer's account number if the text names one (e.g. "account 71293", "#71293", "customer 20111"). Otherwise null.
2. Income during the shock:
   - income_pct = the customer's income DURING the shock as a percentage of their usual income (0-100). null if income doesn't change.
   - Read the direction carefully: "drops TO 40%" means 40; "drops BY 40%", "loses 40% of their income", "a 40% pay cut" mean 60; "cut in half" means 50; "no income", "no EI", "no pay" mean 0.
   - ei_rules = true when the income drop is because they are off work and on Employment Insurance: laid off, let go, fired, lost their job, unemployed, on EI, sick and can't work (EI sickness benefits), maternity or parental leave (EI benefits). Otherwise false (pay cut, fewer hours, business slowdown, commission drop).
   - If they are laid off / on EI / on sick or parental leave and no percentage is given, use 55 (the EI rate) and add an assumption "No EI rate given, used 55% (the standard EI rate)".
   - duration_months = how long the income drop lasts, in months (1-24). Convert: weeks / 4.345, "a year" = 12, "half a year" = 6, "six-month layoff" = 6. If income drops but no length is given, use null and add the assumption "No length given, used 6 months".
3. Household bills / rent going up (this is the ONLY kind of spending increase the engine can model):
   - bills_pct = the percentage increase ("rent goes up 15%" → 15; "bills double" → 100; "triple" → 200).
   - bills_dollars = an increase stated in dollars per month ("rent goes up by $300 a month" → 300). Use bills_pct OR bills_dollars, not both.
   - Counts as bills: rent, mortgage payment, utilities, hydro, heating, electricity, water, internet/phone bills, property tax, condo fees.
4. A one-off cost (a single unexpected expense paid from savings):
   - one_off_dollars = the amount in dollars ("$2,500 car repair" → 2500, "$3k" → 3000). Several one-off costs: add them up.
   - one_off_months = the cost measured in months of their usual spending ("a full month of their typical spending" → 1, "two months of expenses" → 2).
   - A furnace / roof / major home repair with NO amount given: one_off_months = 1 and add the assumption "No cost given for the repair, used 1 month of their usual spending". Any other one-off cost with no amount: leave null and list it in not_modelled ("<the cost>: no amount given").
5. start_month = the calendar month the shock starts (1 = January ... 12 = December). The current month is ${todayMonth} (${MONTHS[todayMonth - 1]}), so "next month" = ${(todayMonth % 12) + 1}. null if not mentioned.

WHAT THE ENGINE CANNOT MODEL → list in not_modelled, briefly, and do NOT approximate it in the other fields:
- Increases to all spending or to non-bill spending (inflation, groceries, gas, childcare, tuition).
- Someone else's job loss or income (spouse, partner, roommate): we don't know their share of household income.
- Good news (raises, bonuses, inheritances, tax refunds, lottery wins).
- Anything else that isn't one of the fields above.
Questions like "Do they make it?" are not shocks; ignore them.

RULES
- Use only what the text says plus the defaults above. Never invent amounts.
- Use null for anything not mentioned. Numbers only, no units or symbols.
- assumptions and not_modelled are short plain-English phrases; use [] when empty.
- Only list something in not_modelled if you could NOT put it in one of the fields above.

EXAMPLES (input → output)
"Account 71293 loses 40% of their income for half a year and needs a $3k dental procedure" →
{"account_id":71293,"income_pct":60,"ei_rules":false,"duration_months":6,"bills_pct":null,"bills_dollars":null,"one_off_months":null,"one_off_dollars":3000,"start_month":null,"assumptions":[],"not_modelled":[]}
"They're laid off and their partner's hours get cut" →
{"account_id":null,"income_pct":55,"ei_rules":true,"duration_months":null,"bills_pct":null,"bills_dollars":null,"one_off_months":null,"one_off_dollars":null,"start_month":null,"assumptions":["No EI rate given, used 55% (the standard EI rate)","No length given, used 6 months"],"not_modelled":["Partner's hours cut: their share of household income is unknown"]}
"Groceries go up 20% and rent rises $250 a month from March" →
{"account_id":null,"income_pct":null,"ei_rules":false,"duration_months":null,"bills_pct":null,"bills_dollars":250,"one_off_months":null,"one_off_dollars":null,"start_month":3,"assumptions":[],"not_modelled":["Groceries up 20%: only bills and rent increases can be modelled"]}

Scenario: """${text.slice(0, 600)}"""`;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Turn the reader's output into engine settings. `billsH` = the target customer's monthly
 *  household bills (to convert a dollar increase); every value is range-checked here. */
export function toShock(p: ParsedScenario, billsH: number, keepStartMonth: number) {
  const shock: Shock = { ...NO_SHOCK, startMonth: keepStartMonth };
  const understood: string[] = [];
  const notes = [...(p.assumptions ?? [])].map(a => "Assumed: " + a);
  const missing = [...(p.not_modelled ?? [])];

  if (finite(p.income_pct) && p.income_pct < 100) {
    shock.incomePct = Math.round(clamp(p.income_pct, 0, 100));
    shock.jobLoss = !!p.ei_rules;
    understood.push(p.ei_rules ? `Off work on EI: income drops to ${shock.incomePct}% of usual` : `Income drops to ${shock.incomePct}% of usual`);
    shock.duration = finite(p.duration_months) ? Math.round(clamp(p.duration_months, 1, 24)) : 6;
    understood.push(`Lasts ${shock.duration} month${shock.duration === 1 ? "" : "s"}`);
  }
  if (finite(p.bills_pct) && p.bills_pct > 0) {
    shock.billsPct = Math.round(clamp(p.bills_pct, 0, 300));
    understood.push(`Household bills / rent up ${shock.billsPct}%`);
  } else if (finite(p.bills_dollars) && p.bills_dollars > 0) {
    if (billsH > 0) {
      shock.billsPct = Math.round(clamp((100 * p.bills_dollars) / billsH, 0, 300));
      understood.push(`Household bills / rent up $${Math.round(p.bills_dollars).toLocaleString("en-CA")}/mo (${shock.billsPct}% of their bills)`);
    } else {
      missing.push(`Bills up $${Math.round(p.bills_dollars)}/mo: this customer's bills aren't recorded, so the increase can't be applied`);
    }
  }
  if (finite(p.one_off_months) && p.one_off_months > 0) {
    shock.oneOffMonths = clamp(Math.round(p.one_off_months * 4) / 4, 0, 6);
    understood.push(`One-off cost: ${shock.oneOffMonths} month${shock.oneOffMonths === 1 ? "" : "s"} of usual spending`);
  }
  if (finite(p.one_off_dollars) && p.one_off_dollars > 0) {
    shock.oneOffDollars = Math.round(clamp(p.one_off_dollars, 0, 10_000_000));
    understood.push(`One-off cost: $${shock.oneOffDollars.toLocaleString("en-CA")}`);
  }
  if (finite(p.start_month) && p.start_month >= 1 && p.start_month <= 12) {
    shock.startMonth = Math.round(p.start_month);
    understood.push(`Starts in ${MONTHS[shock.startMonth - 1]}`);
  }
  const accountId = finite(p.account_id) && p.account_id > 0 ? Math.round(p.account_id) : null;
  return { accountId, shock, understood, notes, missing, empty: understood.length === 0 };
}

export const EXAMPLE_SCENARIOS = [
  "This customer was laid off. EI pays 55% of their usual income for 6 months. Do they make it?",
  "The furnace dies, and the repair costs a full month of their typical spending.",
  "They lose their job (EI at 55%) and their household bills go up 15% in the same month.",
  "Rent goes up 25% starting in January.",
];
