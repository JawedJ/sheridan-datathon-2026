// Checks the app's engine against the judges' formulas computed independently in Python
// (output/judges_expected.csv from build_engine_data.py) for every account and standard shock.
// Run from web/:  npm run verify   (exact match, no rounding tolerance)
import { readFileSync } from "node:fs";
import { getCustomer, indexData, official, type EngineData, type Shock, NO_SHOCK } from "../src/lib/engine.ts";

const data: EngineData = JSON.parse(readFileSync(new URL("../public/engine.json", import.meta.url), "utf8"));
const idx = indexData(data);
const [header, ...lines] = readFileSync(new URL("../../output/judges_expected.csv", import.meta.url), "utf8").trim().split("\n");
const cols = header.split(",");

const shocks: Record<string, Partial<Shock>> = {
  base: {},
  ei55: { incomePct: 55 },
  furnace: { oneOffMonths: 1 },
  ei55_bills15: { incomePct: 55, billsPct: 15 },
  bills15: { billsPct: 15 },
};

let checks = 0, fails = 0;
const inputs = ["I", "S", "F", "H", "B", "P"] as const;
for (const line of lines) {
  const v = Object.fromEntries(line.split(",").map((x, i) => [cols[i], Number(x)]));
  const c = getCustomer(data, idx, v.account_id);
  if (!c) { fails++; console.log("missing", v.account_id); continue; }
  for (const k of inputs) {
    checks++;
    if (Math.abs(c[k] - v[k]) > 0.011) { fails++; if (fails < 10) console.log(`#${v.account_id} ${k}: app ${c[k]} vs python ${v[k]}`); }
  }
  for (const [name, s] of Object.entries(shocks)) {
    checks++;
    const r = official(c, { ...NO_SHOCK, ...s }).runway;
    if (Math.abs(r - v[name]) > 1e-9) { fails++; if (fails < 10) console.log(`#${v.account_id} ${name}: app ${r} vs python ${v[name]}`); }
  }
}
console.log(`${lines.length} accounts, ${checks} checks, ${fails} mismatches`);
process.exit(fails ? 1 : 0);
