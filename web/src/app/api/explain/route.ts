// Turns the engine's numbers into a short plain-language plan.
// Gemini only writes the wording; every number comes from the engine. If GEMINI_API_KEY isn't set
// or the call fails, a template answer is returned so the live demo never depends on it.

import { type Summary, numbersMatch, template } from "@/lib/planText";

export const maxDuration = 30;

export async function POST(req: Request) {
  const s = (await req.json()) as Summary;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ text: template(s), source: "template" });

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  // Gemini only rewords our plan text; it never sees raw data to interpret, and any reply with a
  // number that isn't in our text is rejected (numbersMatch) so the template is used instead.
  const plan = template(s);
  const prompt = `Rewrite this savings plan so it reads naturally, as a short note from a bank advisor to the customer ("you").
Rules:
- Keep every number exactly as written. Do not add, remove, round or calculate any number.
- Do not add any fact or advice that isn't in the plan.
- No greeting, no sign-off, no headings, no lists, no bold. One short paragraph, at most 60 words.

Plan:
${plan}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], // No "thinking": it ate the output budget and leaked planning notes into the reply. Lite models
      // don't think by default and reject the setting, so it's only sent to the others.
      generationConfig: { temperature: 0.4, maxOutputTokens: 600, ...(model.includes("lite") ? {} : { thinkingConfig: { thinkingBudget: 0 } }) } }),
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
    if (/\*\*|JSON|^\s*\d+\.\s|^\s*[-*] /m.test(text)) throw new Error("not a plain letter");
    if (!numbersMatch(text, plan)) throw new Error("reply changed or added a number");
    return Response.json({ text, source: "gemini" });
  } catch (err) {
    console.error("explain: Gemini call failed, using template:", err instanceof Error ? err.message : err);
    return Response.json({ text: template(s), source: "fallback" });
  }
}
