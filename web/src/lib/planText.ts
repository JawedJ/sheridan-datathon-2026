// Plan wording shared by the page (instant template) and the server route (Gemini, same facts).
// Every number comes from the engine; the wording never computes anything new.

export type Summary = {
  account: number; income: number; spending: number; fixed: number; buffer: number;
  comfort_number: number; cushion_months: number; pensioner: boolean;
  shock: unknown;
  official_runway: number; real_runway: number; real_notes: string[];
  shock_description: string | null;   // the scenario in plain words
  buffer_after_shock: number;          // savings left after any one-off cost
  essential: number;                   // basic-needs spending protected per month
  goal: { target: number; gap: number; monthly_transfer: number; months_to_goal: number | null };
  plan: { need: number; save_first: boolean; cut_dollars: number; cut_share: number; reachable: boolean; runway: number };
};

export const $ = (x: number) => "$" + Math.round(x).toLocaleString("en-CA");
const months = (r: number) => (r >= 120 ? "more than 10 years (no shortfall)" : `${r.toFixed(1)} months`);

/** The plan in 2-3 short sentences: without a plan, what the plan is, where it leaves them. */
export function template(s: Summary): string {
  const p = s.plan, g = s.goal, out: string[] = [];
  const save = p.save_first && g.monthly_transfer > 0 && g.months_to_goal
    ? `set aside ${$(g.monthly_transfer)} a month for ${g.months_to_goal} months to build a ${$(g.target)} emergency fund`
    : null;
  const cut = p.cut_dollars > 0 ? `cut non-essential spending by ${$(p.cut_dollars)} a month` : null;
  out.push(s.real_runway >= p.need
    ? `Without a plan, your savings would last ${months(s.real_runway)}, enough for the ${p.need} months you need.`
    : `Without a plan, your savings would last ${months(s.real_runway)}, short of the ${p.need} months you need.`);
  if (save && cut) out.push(`The plan: ${save} now, and if it happens, ${cut}.`);
  else if (save) out.push(`The plan: ${save} now; with that in place you wouldn't need to cut back.`);
  else if (cut) out.push(`The plan: if it happens, ${cut}.`);
  else out.push(`No changes are needed, but keep at least ${$(g.target)} in savings.`);
  if (save || cut) out.push(p.reachable
    ? `That makes your savings last ${months(p.runway)}.`
    : `Even then, your savings last ${months(p.runway)}, so you'd also need extra income or help.`);
  return out.join(" ");
}

/** Every number Gemini writes must already be in the template; otherwise its wording is not used. */
export function numbersMatch(rewrite: string, source: string): boolean {
  const nums = (t: string) => (t.match(/\d[\d,]*(\.\d+)?/g) ?? []).map(x => parseFloat(x.replace(/,/g, "")));
  const allowed = new Set(nums(source));
  return nums(rewrite).every(n => allowed.has(n));
}
