// Plan wording shared by the page (instant template) and the server route (Gemini, same facts).
// Every number comes from the engine; the wording never computes anything new.

export type Summary = {
  account: number; income: number; spending: number; fixed: number; buffer: number;
  comfort_number: number; cushion_months: number; pensioner: boolean;
  shock: { incomePct: number; billsPct: number; oneOffMonths: number; oneOffDollars: number; duration: number; startMonth: number } | null;
  official_runway: number; real_runway: number; real_notes: string[];
  shock_description: string | null;   // the scenario in plain words, so the wording can't misdescribe it
  buffer_after_shock: number;          // savings left after any one-off cost
  goal_first_runway: number | null;   // same shock, if they'd reached the 3-month goal first
  both_runway: number | null;         // goal first AND the backup cuts
  goal: { target: number; gap: number; monthly_transfer: number; months_to_goal: number | null };
  backup: { target_months: number; cut_share_of_non_essential: number | null; cut_dollars: number; reachable: boolean;
    non_essential_dollars: number; runway_if_cut_all: number } | null;
};

export const $ = (x: number) => "$" + Math.round(x).toLocaleString("en-CA");
const months = (r: number) => (r >= 120 ? "more than 10 years (no shortfall)" : `${r.toFixed(1)} months`);

/** The plan in 2-3 short sentences: where they stand, what gets them through, what to do now. */
export function template(s: Summary): string {
  const out: string[] = [];
  const goalLine = s.goal.gap > 0 && s.goal.monthly_transfer > 0 && s.goal.months_to_goal
    ? `Setting aside ${$(s.goal.monthly_transfer)} a month automatically builds a 3-month cushion of ${$(s.goal.target)} in about ${s.goal.months_to_goal} months.`
    : s.goal.gap === 0 ? "You already have a 3-month cushion." : null;
  if (!s.shock || !s.backup) {
    out.push(`You have ${$(s.buffer)} saved, about ${s.cushion_months} months of your usual spending.`);
    if (goalLine) out.push(goalLine);
    return out.join(" ");
  }
  const need = s.backup.target_months;
  if (s.real_runway >= need) {
    out.push(`Your savings would last ${months(s.real_runway)} in this scenario, enough to get through it.`);
  } else {
    out.push(`Your savings would last ${months(s.real_runway)} in this scenario, short of the ${need} months you need.`);
    const share = s.backup.cut_share_of_non_essential;
    if (s.backup.reachable && share)
      out.push(`Cutting ${Math.round(share * 100)}% of your non-essential spending (${$(s.backup.cut_dollars)} a month) would get you there.`);
    else if (s.both_runway !== null && s.both_runway >= need)
      out.push(`Cutting back alone isn't enough, but with a 3-month cushion saved first, cutting back would last ${months(s.both_runway)}.`);
    else
      out.push(`Even cutting all non-essential spending only reaches ${months(s.backup.runway_if_cut_all)}, so you'd also need extra income or help.`);
  }
  if (goalLine) out.push(goalLine);
  return out.join(" ");
}

/** Every number Gemini writes must already be in the template; otherwise its wording is not used. */
export function numbersMatch(rewrite: string, source: string): boolean {
  const nums = (t: string) => (t.match(/\d[\d,]*(\.\d+)?/g) ?? []).map(x => parseFloat(x.replace(/,/g, "")));
  const allowed = new Set(nums(source));
  return nums(rewrite).every(n => allowed.has(n));
}
