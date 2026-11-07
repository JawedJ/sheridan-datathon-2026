// Turns the engine's numbers into a short plain-language plan.
// Gemini only writes the wording; every number comes from the engine. If GEMINI_API_KEY isn't set
// or the call fails, a template answer is returned so the live demo never depends on it.

type Summary = {
  account: number; income: number; spending: number; fixed: number; buffer: number;
  comfort_number: number; cushion_months: number; pensioner: boolean; bonus_pct: number;
  shock: { incomePct: number; billsPct: number; oneOffMonths: number; oneOffDollars: number; duration: number; startMonth: number } | null;
  official_runway: number; real_runway: number; real_notes: string[];
  goal: { target: number; gap: number; monthly_transfer: number; months_to_goal: number | null; months_with_bonus: number | null };
  backup: { target_months: number; cut_share_of_non_essential: number | null; cut_dollars: number; reachable: boolean } | null;
};

const $ = (x: number) => "$" + Math.round(x).toLocaleString("en-CA");
const months = (r: number) => (r >= 120 ? "more than 10 years (no shortfall)" : `${r.toFixed(1)} months`);

function template(s: Summary): string {
  const lines: string[] = [];
  lines.push(`Right now you have ${$(s.buffer)} saved, about ${s.cushion_months} months of your usual spending. ` +
    `Your balance tends to settle around ${$(s.comfort_number)}, and money above that usually gets spent the following month.`);
  if (s.shock && s.backup) {
    lines.push(`If this shock hit, your savings would last ${months(s.real_runway)} under real rules` +
      (s.real_runway !== s.official_runway ? ` (${months(s.official_runway)} by the standard formula).` : "."));
    if (s.backup.cut_share_of_non_essential === 0) lines.push(`You'd get through ${s.backup.target_months} months without cutting back.`);
    else if (s.backup.reachable && s.backup.cut_share_of_non_essential !== null)
      lines.push(`To last ${s.backup.target_months} months, cut about ${Math.round(s.backup.cut_share_of_non_essential * 100)}% of your non-essential spending (${$(s.backup.cut_dollars)} a month). Basic needs like food, housing and transportation stay as they are.`);
    else lines.push(`Cutting non-essential spending alone won't cover ${s.backup.target_months} months, so plan for extra income or lower fixed costs.`);
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

export async function POST(req: Request) {
  const s = (await req.json()) as Summary;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ text: template(s), source: "template" });

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `You are a friendly financial coach at a Canadian bank. Write a short plan (max 120 words, 3 short paragraphs, no headings, no bullet symbols) for this customer, speaking to them as "you".
Use ONLY the numbers given below; do not compute new numbers or invent any. Amounts are monthly CAD unless stated.
Key idea to include: their balance settles at a "comfort number" and money above it tends to get spent; the fix is an automatic transfer into savings, not willpower.
If a shock is given, say how long savings last under real rules and the cut needed. If real and standard runways differ, mention both briefly.

Data (JSON): ${JSON.stringify(s)}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 400 } }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}`);
    const j = await r.json();
    const text: string | undefined = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").trim();
    if (!text) throw new Error("empty");
    return Response.json({ text, source: "gemini" });
  } catch {
    return Response.json({ text: template(s), source: "template" });
  }
}
