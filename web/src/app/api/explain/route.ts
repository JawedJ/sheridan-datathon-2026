// Turns the engine's numbers into a short plain-language plan.
// Gemini only writes the wording; every number comes from the engine. If GEMINI_API_KEY isn't set
// or the call fails, a template answer is returned so the live demo never depends on it.

import { type Summary, template } from "@/lib/planText";

export const maxDuration = 30;

export async function POST(req: Request) {
  const s = (await req.json()) as Summary;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ text: template(s), source: "template" });

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const prompt = `You are a friendly financial coach at a Canadian bank. Write a short plan (max 120 words, 3 short paragraphs, no headings, no bullet symbols) for this customer, speaking to them as "you".
Use ONLY the numbers given below; do not compute new numbers or invent any. Amounts are monthly CAD unless stated; write them like $1,605. Write months like 7.8 months.
Key idea to include: their balance settles at a "comfort number" and money above it tends to get spent; the fix is an automatic transfer into savings, not willpower.
If a shock is given, say how long savings last under real rules. If backup.reachable is true, give the cut (cut_dollars a month). If backup.reachable is false, say plainly that even cutting all non-essential spending (cut_dollars a month) only stretches savings to runway_if_cut_all months, so it isn't enough on its own; never call any cut "needed" or sufficient in that case. If real and standard runways differ, mention both briefly. If goal_first_runway is larger than real_runway, say the same shock would last that long had they built the 3-month cushion first; if both_runway is given, say doing both (cushion first, then the cuts) would last that long.

Data (JSON): ${JSON.stringify(s)}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], // No "thinking": it ate the output budget and leaked planning notes into the reply.
      generationConfig: { temperature: 0.4, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } } }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    const cand = j?.candidates?.[0];
    const text: string | undefined = cand?.content?.parts
      ?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? "").join("").trim();
    if (!text) throw new Error("empty");
    // Only accept a finished, plain letter; anything else (cut off, notes, markdown) falls back to the template.
    if (cand.finishReason !== "STOP") throw new Error(`unfinished: ${cand.finishReason}`);
    if (/\*\*|JSON|^\s*\d+\.|^\s*[-*] /m.test(text)) throw new Error("not a plain letter");
    return Response.json({ text, source: "gemini" });
  } catch (err) {
    console.error("explain: Gemini call failed, using template:", err instanceof Error ? err.message : err);
    return Response.json({ text: template(s), source: "fallback" });
  }
}
