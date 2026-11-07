// Plan wording shared by the page (instant template) and the server route (Gemini, same facts).
// Every number comes from the engine; the wording never computes anything new.

export type Summary = {
  account: number; income: number; spending: number; fixed: number; buffer: number;
  comfort_number: number; cushion_months: number; pensioner: boolean; bonus_pct: number;
  shock: { incomePct: number; billsPct: number; oneOffMonths: number; oneOffDollars: number; duration: number; startMonth: number } | null;
  official_runway: number; real_runway: number; real_notes: string[];
  shock_description: string | null;   // the scenario in plain words, so the wording can't misdescribe it
  buffer_after_shock: number;          // savings left after any one-off cost
  goal_first_runway: number | null;   // same shock, if they'd reached the 3-month goal first
  both_runway: number | null;         // goal first AND the backup cuts
  goal: { target: number; gap: number; monthly_transfer: number; months_to_goal: number | null; months_with_bonus: number | null };
  backup: { target_months: number; cut_share_of_non_essential: number | null; cut_dollars: number; reachable: boolean;
    non_essential_dollars: number; runway_if_cut_all: number } | null;
};

export const $ = (x: number) => "$" + Math.round(x).toLocaleString("en-CA");
const months = (r: number) => (r >= 120 ? "more than 10 years (no shortfall)" : `${r.toFixed(1)} months`);

export function template(s: Summary): string {
  const lines: string[] = [];
  lines.push(`Right now you have ${$(s.buffer)} saved, about ${s.cushion_months} months of your usual spending. ` +
    `Your balance tends to settle around ${$(s.comfort_number)}, and money above that usually gets spent the following month.`);
  if (s.shock && s.backup) {
    if (s.buffer_after_shock !== s.buffer)
      lines.push(`The one-off cost would leave ${$(Math.max(0, s.buffer_after_shock))} in savings.`);
    lines.push(`If this shock hit, your savings would last ${months(s.real_runway)} under real rules` +
      (s.real_runway !== s.official_runway ? ` (${months(s.official_runway)} by the standard formula).` : "."));
    if (s.backup.cut_share_of_non_essential === 0) lines.push(`You'd get through ${s.backup.target_months} months without cutting back.`);
    else if (s.backup.reachable && s.backup.cut_share_of_non_essential !== null)
      lines.push(`To last ${s.backup.target_months} months, cut about ${Math.round(s.backup.cut_share_of_non_essential * 100)}% of your non-essential spending (${$(s.backup.cut_dollars)} a month). Basic needs like food, housing and transportation stay as they are.`);
    else lines.push(`Cutting back alone won't cover ${s.backup.target_months} months: even cutting all non-essential spending (${$(s.backup.cut_dollars)} a month) only stretches savings to ${months(s.backup.runway_if_cut_all)}. Plan for extra income or lower fixed costs too.`);
    if (s.goal_first_runway !== null && s.goal_first_runway > s.real_runway)
      lines.push(`If you'd built the 3-month cushion first, the same shock would last ${months(s.goal_first_runway)}` +
        (s.both_runway !== null && s.both_runway > s.goal_first_runway
          ? `, and ${months(s.both_runway)} if you also cut back when it hits.` : "."));
  }
  if (s.goal.gap > 0) {
    lines.push(`Goal: build a 3-month cushion of ${$(s.goal.target)}. Set an automatic transfer of ${$(s.goal.monthly_transfer)} a month into savings` +
      (s.goal.months_to_goal ? ` and you'll be there in about ${s.goal.months_to_goal} months` : "") +
      (s.goal.months_with_bonus && s.bonus_pct > 0 ? `, or ${s.goal.months_with_bonus} months if you also save half of your June and December bonus.` : "."));
  } else {
    lines.push(`You already have a 3-month cushion. A good next goal is 6 months.`);
  }
  return lines.join("\n\n");
}


/** Every number Gemini writes must already be in the template; otherwise its wording is not used. */
export function numbersMatch(rewrite: string, source: string): boolean {
  const nums = (t: string) => (t.match(/\d[\d,]*(\.\d+)?/g) ?? []).map(x => parseFloat(x.replace(/,/g, "")));
  const allowed = new Set(nums(source));
  return nums(rewrite).every(n => allowed.has(n));
}
