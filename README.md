# The Comfort Number — Tangerine "Resilience Rewired"

Sheridan Datathon 2026 · Tangerine track

> **People save to a dollar number, not to a number of months, so the more you earn, the more
> fragile you are.**

Across 4,500 real bank accounts, the lowest-earning 10% hold **11.1 months** of spending in savings.
The highest-earning 10% hold **1.6**. Under real EI rules, if they kept spending as usual, **93%**
of top earners would run out within 3 months of a layoff, versus 3.5% of the lowest earners. They
aren't trapped, though: 88% of their spending is flexible, and cutting half of it brings 93% down to 30%.

The reason: balances act like a **thermostat**. When a customer's balance climbs above their usual
level, they spend it back down the next month (top earners net −66% of a month's income), and that
"comfort number" barely grows with income. Doubling income raises savings only about 22%.

**What it means:** "spend less" fights the thermostat. The fix is to raise the setting:
automatically move money above a customer's comfort number into savings, and show their cushion
in months, not dollars.

## The app
**Live: https://comfort-number.vercel.app**

- **Engine:** enter any `account_id` and see the judges' numbers (income, spending, fixed costs,
  buffer, runway) plus the customer's comfort number and cushion in months. Apply a shock (twist
  cards or sliders for EI %, length, bills, one-off costs, start month) and compare the **official
  formula** with **real-world rules** (EI maximum, pensions keep paying, cash-paid bills estimated).
  Then get a goal plan (auto-transfer above the comfort number) and a backup plan (% of flexible
  spending to cut). Gemini can rewrite the plan in plain words, using only the engine's numbers.
- **Findings:** the four headline charts.
- **Accuracy:** matches the judges' formulas exactly for all 4,500 accounts (`npm run verify`).

## What's in the repo
| Path | What it is |
| --- | --- |
| [`FINDINGS.md`](FINDINGS.md) | The full write-up: headline, evidence, stress test, supporting findings, data checks, limits |
| [`charts/index.html`](charts/index.html) | The four headline charts |
| `build_customer_table.py` | Per-customer judges' metrics (income, spending, fixed costs, buffer, runway, standard shocks) |
| `analysis/` | Formula checks, broad survey, deep dives, stress test |
| `output/` | Generated tables (not committed; rebuilt by the scripts) |
| `docs/PITCH.md` | The 1-minute pitch, live-twist script, judge Q&A prep, demo video outline |
| `docs/CHALLENGE.md` | The organizers' challenge brief and data dictionary |
| `data/` | The provided dataset (not committed; add it locally) |
| `web/` | The app (Next.js on Vercel) |
| `app/` | Early throwaway prototype |

## How we know it's real
- Holds in all 8 regions, every account age, both genders, couples and singles, every year 2021–2025,
  and five different definitions of savings.
- Correcting for income-measurement noise (split-half months) barely changes it: elasticity
  0.29 (95% CI 0.26–0.31).
- The thermostat beats a shuffled-order null and appears in every income group, strongest at the top.
- "They keep savings at another bank": even counting every dollar ever sent elsewhere as savings,
  top earners only reach 2.4 months.

Details and limits: [FINDINGS.md](FINDINGS.md) sections 2 and 4.

## We questioned the official formula
Five issues with the judges' runway definition: a median quirk makes 26% of customers look like they
lose money (97.5% don't); EI has no cap (the real cap triples 3-month failures); pensioners get a
job-loss shock; 27% of customers' bills are invisible (paid in cash); 76% of spending is unlabelled
cash. Our numbers match the judges' formulas exactly. We show the corrected view next to them.

## Run it
The dataset isn't in the repo (`transactions.csv` is over GitHub's 100 MB limit). Put the nine
provided CSVs (`accounts.csv` … `transactions.csv`) in a `data/` folder at the repo root first.
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python build_customer_table.py
cd analysis && ../.venv/bin/python verify_formula.py && ../.venv/bin/python explore_behaviour.py \
  && ../.venv/bin/python explore_time.py && ../.venv/bin/python deep_plateau.py \
  && ../.venv/bin/python deep_edge.py && ../.venv/bin/python stress_headline.py && cd ..
.venv/bin/python build_engine_data.py && .venv/bin/python build_chart_data.py
cd web && npm install && npm run verify && npm run dev   # http://localhost:3000
```

## Data and sources
- **PKDD'99 Discovery Challenge Financial dataset** (real anonymized bank data), CTU Prague Relational
  Dataset Repository: https://relational.fel.cvut.cz/dataset/Financial. Provided by Tangerine with
  dates shifted to 2020–2025 and amounts in CAD.
- **Government of Canada**, EI regular benefits (55% rate, $729/week maximum in 2026):
  https://www.canada.ca/en/services/benefits/ei/ei-regular-benefit/benefit-amount.html
