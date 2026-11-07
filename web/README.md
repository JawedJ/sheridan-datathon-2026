# Comfort Number — web app

Live: https://comfort-number.vercel.app

Next.js 16 (App Router). All calculations run in the browser from `public/engine.json`, so the live
demo doesn't depend on a server. Only the plan wording calls the server (`/api/explain`), automatically
after a scenario runs; the template version shows instantly, so the page never waits on it.

| Path | What it is |
| --- | --- |
| `src/lib/engine.ts` | Judges' formulas, real-world corrections (EI maximum, pensions, cash-paid bills), month-by-month path, goal and backup plans |
| `src/components/Engine.tsx` | Engine screen: customer, shock, plans |
| `src/components/charts.tsx` | SVG charts (balance path, grouped bars, gap lines) |
| `src/app/findings/page.tsx` | The four headline charts |
| `src/app/api/explain/route.ts` | Gemini rewrites the plan in plain words from the engine's numbers (thinking off, output checked); template fallback |
| `src/lib/planText.ts` | Plan wording template, shared by the page (instant) and the route (fallback) |
| `public/engine.json` | Per-customer data, built by `../build_engine_data.py` (keep inputs at full precision) |
| `public/findings.json` | Chart data, built by `../build_chart_data.py` |
| `scripts/verify-engine.mts` | Exact-match check against the judges' formulas computed in Python |

```bash
npm install
npm run verify   # 4,500 accounts x 5 shocks = 49,500 checks, must be 0 mismatches
npm run dev      # http://localhost:3000
```

**Deploy** (from this folder, Vercel CLI logged in): `vercel deploy --prod --yes`.
Pushing to GitHub doesn't deploy on its own; to enable that, set Root Directory = `web` in the Vercel project.

**Gemini:** set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, default `gemini-3.5-flash-lite`) in the
Vercel project's environment variables, then redeploy. Without it the template wording is used.
