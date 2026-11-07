// Reads a plain-words scenario with Gemini and returns the engine's shock settings as JSON.
// Tries each model in GEMINI_PARSE_MODELS in order (set it to "gemini-3.5-flash,..." once billing is on);
// a busy model (503/500) gets one retry, an out-of-quota one (429) is skipped straight away.

import { SCENARIO_SCHEMA, scenarioPrompt, type ParsedScenario } from "@/lib/scenario";

export const maxDuration = 30;

const MODELS = (process.env.GEMINI_PARSE_MODELS || "gemini-3.5-flash-lite,gemini-3.5-flash")
  .split(",").map(s => s.trim()).filter(Boolean);

export async function POST(req: Request) {
  const { text, month } = (await req.json()) as { text: string; month?: number };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "Gemini isn't configured." }, { status: 503 });
  if (!text || !text.trim()) return Response.json({ error: "Empty scenario." }, { status: 400 });
  const todayMonth = month && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
  const prompt = scenarioPrompt(text, todayMonth);

  const errors: string[] = [];
  const deadline = Date.now() + 24000;          // stay inside maxDuration
  const attempts = MODELS.flatMap(m => [m, m]); // each model gets one retry if it's busy
  for (const [i, model] of attempts.entries()) {
    if (Date.now() > deadline - 3000) break;
    if (i % 2 === 1 && !/^(500|503)/.test(errors.at(-1)?.split(": ")[1] ?? "")) continue;   // retry only when busy
    if (i % 2 === 1) await new Promise(r => setTimeout(r, 800));
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 4096, responseMimeType: "application/json", responseSchema: SCENARIO_SCHEMA },
        }),
        signal: AbortSignal.timeout(Math.max(3000, Math.min(15000, deadline - Date.now()))),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      const cand = j?.candidates?.[0];
      if (cand?.finishReason !== "STOP") throw new Error(`unfinished: ${cand?.finishReason}`);
      const raw = cand.content.parts.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? "").join("");
      const parsed = JSON.parse(raw) as ParsedScenario;
      return Response.json({ parsed, model });
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.error("parse: all models failed:", errors.join("; "));
  return Response.json({ error: "Couldn't read the scenario right now." }, { status: 502 });
}
