# Complete Reference — everything about our data, calculations, cleaning and findings

One place with every detail, so you can decide what matters for the pitch, demo, video and Devpost.
Every item has a number (e.g. **4.3**), so you can reply "keep 4.3, cut 9.2". Nothing here is
ranked by importance; section 0 is the only summary.

Sources for every number: the scripts in `analysis/`, `build_*.py`, the app's `web/src/lib/engine.ts`.
"Non-pensioners" = everyone except the 740 pension-income customers. Money is CAD per month unless stated.

**Contents**
0. One-page summary
1. The dataset
2. The judges' definitions (exact formulas)
3. Our own definitions and calculations
4. How we checked, cleaned and changed things
5. Headline finding and its evidence
6. Stress tests
7. Supporting findings (used in the product)
8. Other findings from the broad survey
9. Loans (parked)
10. Data artifacts (things that look generated)
11. Limits (what we can't claim)
12. The app: every calculation it does
13. Corrections we made along the way
14. Numbers that can be confused with each other
15. Files, outputs and how to reproduce
16. Not done / open questions
17. Sources

---

## 0. One-page summary

| # | Item | One line |
| --- | --- | --- |
| 0.1 | Headline | People save to a dollar number, not a number of months, so the more you earn, the more fragile you are. |
| 0.2 | Key contrast | Lowest-earning 10% hold 11.1 months of spending; highest-earning 10% hold 1.6 (non-pensioners). |
| 0.3 | Mechanism | Balances act like a thermostat: above-usual balances are spent down the next month (top earners: −66% of a month's income). |
| 0.4 | Why high earners | The level people settle at grows only ~22% when income doubles (elasticity 0.29, 95% CI 0.26–0.31). |
| 0.5 | Layoff risk | With real EI rules, 93% of top earners run out within 3 months *if nothing changes* (judges' uncapped rule: 25.5%). |
| 0.6 | They can adapt | 88% of top earners' spending is flexible; cutting half of it brings 93% down to 30%. |
| 0.7 | Robust | Holds in all 8 regions, every account age, both genders, couples and singles, every year 2021–2025, 5 savings definitions, noise-corrected. |
| 0.8 | Data use | Found 5 problems with the official formula; match the official formula exactly anyway (49,500 checks, 0 mismatches). |
| 0.9 | Product | Engine shows official vs real-world runway, the customer's comfort number, and plans: auto-transfer above the comfort number; % of flexible spending to cut. |
| 0.10 | Supporting | Layoff timing matters (January 6.1 vs February 7.8 months); bonus months; edge slide; no autopay → going negative. |

---

## 1. The dataset

### 1.1 Origin
- Real, anonymized data from a **Czech bank in the 1990s**: the PKDD'99 Discovery Challenge Financial dataset ("Berka" dataset), CTU Prague.
- Tangerine shifted dates to **2020-01-01 → 2025-12-31** and converted amounts to **CAD**.
- It's a well-known, much-studied dataset. Loan-default prediction is its most common use, which is why we parked that angle (section 9).

### 1.2 Files and sizes
| # | File | Rows | Size | What it holds |
| --- | --- | ---: | ---: | --- |
| 1.2.1 | `accounts.csv` | 4,500 | 171 KB | `account_id`, `district_id` (branch), `frequency` (statement frequency), `account_opened` |
| 1.2.2 | `monthly_summary.csv` | 185,326 | 21.6 MB | One row per account per month (first to last transaction month, quiet months included). **The judges' numbers come from here.** |
| 1.2.3 | `transactions.csv` | 1,056,320 | 102.6 MB | Every transaction (too big for GitHub's 100 MB limit, so the dataset isn't in the repo) |
| 1.2.4 | `loans.csv` | 682 | 47 KB | One loan per account at most; amount, duration, monthly payment, status A/B/C/D, `defaulted` |
| 1.2.5 | `clients.csv` | 5,369 | 128 KB | `client_id`, gender, birth date, home district |
| 1.2.6 | `dispositions.csv` | 5,369 | 159 KB | Links clients to accounts as `owner` or `authorized user` |
| 1.2.7 | `cards.csv` | 892 | 30 KB | Card type (junior, classic, gold), issue date |
| 1.2.8 | `standing_orders.csv` | 6,471 | 285 KB | Automatic payments: `amount`, `purpose` (household bills, insurance, leasing, loan payment, blank = other). **Undated snapshot at end of data** |
| 1.2.9 | `districts.csv` | 77 | 7 KB | Inhabitants, municipalities, urban ratio, average salary, unemployment 2022/2023, entrepreneurs, crimes 2022/2023. District 69 has no 2022 values |

### 1.3 How files connect
```
districts ──< accounts ──< transactions
                │    ├──< monthly_summary
                │    ├──< standing_orders
                │    └──< loans
                └──< dispositions >── clients
                          └──< cards
```

### 1.4 `monthly_summary` columns
- `money_in` = `cash_deposits` + `transfers_in` + `pension_in` + `interest_in` (`transfers_in` excludes pensions).
- `money_out` = `household_bills` + `insurance` + `loan_payments` + `bank_fees` + `cash_withdrawals_genuine` + `card_withdrawals` + `transfers_out_other` (unlabelled transfers out).
- `month_end_balance`, `min_balance`, `avg_daily_balance` (end-of-day balances, carried forward on quiet days; the first month counts from the first transaction), `days_below_zero`.

### 1.5 `transactions` columns
`direction` (credit/debit), `operation` (cash deposit, cash withdrawal, card withdrawal, transfer in/out, bill payment, bank fee, interest), `purpose` (household bills, insurance, loan payment, pension, interest credited, statement fee, penalty interest; blank = unlabelled), `amount`, `signed_amount`, `balance` (rows within a day aren't in time order), `partner_bank`, `partner_account`.

### 1.6 Loan statuses
A = finished, repaid (203) · B = finished, defaulted (31) · C = running, OK (403) · D = running, in debt (45). `defaulted` = 1 for B or D → **76 defaults (11.1%)**.

### 1.7 What a typical customer looks like
| # | Fact | Value |
| --- | --- | --- |
| 1.7.1 | Median monthly income (I), all customers | $7,568 (middle half $3,380–$13,280) |
| 1.7.2 | Median income, non-pensioners | $9,468 |
| 1.7.3 | Money in that arrives as cash deposits | ~99% (pensioners: transfers) |
| 1.7.4 | Money out that's cash withdrawals | 76% of all money out |
| 1.7.5 | Labelled household bills | 16.5% of all money out |
| 1.7.6 | Insurance + loans + card payments + fees | ~3% combined |
| 1.7.7 | Transfers to other banks | 3.9% of all money out; median account 0% |
| 1.7.8 | Pensioners (pension ≥ 50% of money in) | 740 (16.4%), owner median age 72 vs 39 |
| 1.7.9 | Shared accounts (2 people) | 869 (19%) |
| 1.7.10 | Accounts with any standing order | 83.5%; with none: 742 (16.5%) |
| 1.7.11 | Statement frequency | monthly 4,167 · weekly 240 · after every transaction 93 |
| 1.7.12 | Best card per account | none 3,608 · classic 659 · junior 145 · gold 88 |
| 1.7.13 | Accounts opened by year | 2020: 1,139 · 2021: 439 · 2022: 661 · 2023: 1,363 · 2024: 898 |
| 1.7.14 | History length | every account has ≥ 12 months |
| 1.7.15 | Regions / districts | 8 regions, 77 districts |
| 1.7.16 | Customers earn vs district average salary | ~1.34× |
| 1.7.17 | Customers' income vs Canadian average ($1,354.55/week = $5,870/month, StatCan Table 14-10-0223-01, Aug 2026, seasonally adjusted) | ~1.6× (non-pensioners, $9,468) |

---

## 2. The judges' definitions (exact formulas, from the organizers' brief)

| # | Symbol | Name | Definition |
| --- | --- | --- | --- |
| 2.1 | I | Typical monthly money in | Median of `money_in` over all the account's months |
| 2.2 | F | Typical fixed costs | Median of (`household_bills` + `insurance` + `loan_payments`). Shown, not used in runway |
| 2.3 | S | Typical monthly spending | Median of `money_out` |
| 2.4 | B | Buffer | Mean of `avg_daily_balance` over the account's last 6 rows, sorted by month |
| 2.5 | H | Household bills | Median of `household_bills` (rent/utility shocks change this) |
| 2.6 | P | Loan payment | `monthly_payment` from `loans.csv` if the loan is still running at end of 2025, else 0 |

**2.7 Runway rule**
```
buffer_left = B − one_off_costs
gap         = spending_after_shock − income_after_shock
if buffer_left <= 0:  runway = 0
elif gap <= 0:        runway = "no shortfall (120+)"
else:                 runway = min(buffer_left / gap, 120)
```
Rounded to 1 decimal.

**2.8 Shocks as the judges define them**
| # | Shock | Change |
| --- | --- | --- |
| 2.8.1 | Job loss, EI 55% | income = 0.55 × I |
| 2.8.2 | Household bills up X% | spending = S + X% × H |
| 2.8.3 | One-off cost (e.g. furnace = a month of spending) | one_off_costs = S, subtracted from B |
| 2.8.4 | Combination | apply each change together |

**2.9 Worked example, account 20111:** I = $6,339.39, S = $8,599.60, F = $2,330.10, H = $0, B = $17,611.86, P = $2,330.20.
No shock 7.8 months · EI 55% 3.4 · furnace 4.0 · EI + bills 15% 3.4 (bills shock does nothing because H = 0).

**2.10** The brief allows our own definitions: "If your numbers differ from these, be ready to explain why."

---

## 3. Our own definitions and calculations

| # | Name | Exact definition | Where |
| --- | --- | --- | --- |
| 3.1 | Cushion (months of spending) | B ÷ S | everywhere |
| 3.2 | **Comfort number** | Median of `month_end_balance` over the account's months **after the first 3** (skips the fill-up from $0) | `deep_plateau.py` ("plateau") |
| 3.3 | Flexible spending | S − F | `deep_topearners.py`, app |
| 3.4 | Fixed share | F ÷ S | same |
| 3.5 | Cash share | lifetime `cash_withdrawals_genuine` ÷ lifetime `money_out` | `explore_behaviour.py` |
| 3.6 | Pensioner | lifetime `pension_in` ÷ lifetime `money_in` ≥ 0.5 | all |
| 3.7 | Income decile | Deciles of I among **non-pensioners** (376 each) for the headline/charts; some survey tables use all 4,500 (450 each), see 14.1 | `build_chart_data.py` |
| 3.8 | Real EI cap | $729/week × 52 ÷ 12 = **$3,159/month** (2026) | all |
| 3.9 | Real-cap EI income | min(0.55 × I, $3,159) | stress test, charts |
| 3.10 | Elasticity of buffer to income | slope of log(B) on log(I), non-pensioners with I > 0 and B > 0 | `deep_plateau.py`, `stress_headline.py` |
| 3.11 | Noise-corrected elasticity | Split each account's months (after month 3) into odd and even. Rank/regress on odd-month median income, instrument with even-month median income: cov(log B, log I_even) ÷ cov(log I_odd, log I_even) | `stress_headline.py` |
| 3.12 | Thermostat "deviation" | (this month's `month_end_balance` − account's median month-end balance) ÷ account's median `money_in` | `deep_plateau.py` |
| 3.13 | Thermostat "next-month net" | next month's (`money_in` − `money_out`) ÷ account's median `money_in` | same |
| 3.14 | Thermostat bins | deviation < −1 far below · −1 to −0.25 below · −0.25 to 0.25 near · 0.25 to 1 above · > 1 far above (charts merge the bottom two: < −0.25 = "below") | same |
| 3.15 | Shuffled-order null | For 800 random accounts, shuffle the order of monthly net flows, rebuild the balance as a random walk, recompute the correlation; 3 runs | `deep_plateau.py` |
| 3.16 | Edge month | `min_balance` < 25% of the account's median `money_in` | `deep_edge.py` |
| 3.17 | On the edge (customer) | edge months > 25% of their history (117 customers) | same |
| 3.18 | Income volatility (CV) | std ÷ mean of monthly `money_in` | `explore_behaviour.py` |
| 3.19 | Irregular earner | income CV > 0.6 and (no standing orders or standing orders < 15% of I) (545) | `build_engine_data.py` |
| 3.20 | Bonus % | (mean of June + December `money_in`) ÷ median `money_in` − 1; set to 0 if ≤ 10% | `build_engine_data.py` |
| 3.21 | Seasonal spending factors | For each calendar month: 50% the account's own (mean `money_out` that month ÷ its overall mean) + 50% everyone's; rescaled to average 1 | `build_engine_data.py` |
| 3.22 | Balance trend | slope of month-end balance over the last 12 months ÷ I; draining < −5%, flat ±5%, building > +5% | `explore_behaviour.py` |
| 3.23 | Savings rate | (mean in − mean out) ÷ mean in (lifetime) | `explore_followups.py` |
| 3.24 | Fragility gap | max(0, 3 × S − B) | `deep_plateau.py` |
| 3.25 | Cut needed to reach 3 months (real cap) | (S − (B ÷ 3 + capped EI)) ÷ (S − F) | `deep_topearners.py` |
| 3.26 | Income-drop month (natural experiment) | `money_in` < 60% of the account's median; "normal" month = 90–110% | `deep_topearners.py` |
| 3.27 | Layoff-timing simulation | Non-pensioners. Start at B; each month income = 0.55 × I, spending = S × seasonal factor; count months until the balance hits 0 (max 120). Repeat for each start month. Keep customers who run out within 10 years for every start month (3,547) | `build_engine_data.py` |

---

## 4. How we checked, cleaned and changed things

### 4.1 Problems found in the official formula (all verified against the data)
| # | Problem | Evidence | What we did |
| --- | --- | --- | --- |
| 4.1.1 | **Median quirk**: 1,181 customers (26.2%) have S > I, so they look like they lose money with no shock | 97.5% of them took in more than they spent over their whole history and ended with a positive balance. Medians come from different months; spending is lumpy (39% of all account-months have out > in). Median false gap $531 | Report the official number as-is. Alternatives tested: paired gap median(out − in) fixes 63% of them; means instead of medians |
| 4.1.2 | **EI has no cap** in the official rule | 57.2% of customers (2,574) would get more than the real $3,159/month maximum. With the cap, EI runway < 3 months goes **9.7% → 27.9%**; median 8.6 → 5.7 months. Insensitive to the exact cap ($668–$729/week → 28.6–29.6% unrounded) | Real-cap number shown next to the official one |
| 4.1.3 | **Pensioners get a job-loss shock** | 740 customers, median age 72; job loss can't stop a pension. Doesn't flip anyone (median EI runway 35 months, 0% under 3 either way) | Excluded from income rankings; app keeps the pension during a job loss |
| 4.1.4 | **Bills shock does nothing for 27%** | 1,225 customers have $0 median household bills; 98.2% never pay a labelled bill; only 13% have a bills standing order (vs 75% overall); 99.7% of their spending is cash (vs 59%) | App estimates their bills at 19.9% of spending (median bills share of customers who have bills), labelled as an estimate |
| 4.1.5 | **Spending is mostly unlabelled cash** | 76% of money out is cash with no purpose | Plans talk about "flexible spending" rather than categories |
| 4.1.6 | "Household bills" = standing orders exactly | Median ratio of bills standing order ÷ H = 1.00 | Explains 4.1.4 |

### 4.2 Things we checked that turned out fine
| # | Check | Result |
| --- | --- | --- |
| 4.2.1 | Loan "still running" rule for P | Status C/D and start + duration past 2025-12-31 agree for all 682 loans |
| 4.2.2 | Loan payouts inflating the buffer | Loan-month deposits ≈ 19% of the loan amount (normal level); payout doesn't land in the account |
| 4.2.3 | Short histories | None; every account has ≥ 12 months, so the 6-month buffer always exists |
| 4.2.4 | Accounts ending early | 76 have no December 2025 row (56 end in November); kept |
| 4.2.5 | 120 cap | With no shock, 78.7% show "no shortfall (120+)"; the formula only separates people once a shock hits |
| 4.2.6 | Our numbers vs the official formulas | Exact match, all 4,500 accounts × 5 shocks (section 12.10) |

### 4.3 Cleaning log (every judgement call)
| # | Issue | Count | What we did |
| --- | --- | ---: | --- |
| 4.3.1 | Negative buffer (B ≤ 0) | 23 | Kept; runway = 0 under every shock (official rule) |
| 4.3.2 | Zero median income | 14 | Kept; dropped only from log-based elasticity (log 0 undefined) |
| 4.3.3 | Income under $500/month | 118 | Kept; treated as special cases for plans |
| 4.3.4 | Pensioners | 740 | Excluded from income rankings, elasticity, charts and timing; pension kept in the app |
| 4.3.5 | $0 labelled bills | 1,225 | Official rule leaves $0; app estimate 19.9% of S when a bills shock is applied |
| 4.3.6 | First 3 months of each account (fill-up from $0) | all | Excluded from comfort number, thermostat, split-half and year-by-year analysis |
| 4.3.7 | 2020 partial year | — | Year-by-year test uses 2021–2025, full 12-month account-years only |
| 4.3.8 | Median quirk (4.1.1) | 1,181 | Official number reported as-is |
| 4.3.9 | No December 2025 row | 76 | Kept |
| 4.3.10 | Owners under 18 | 56 | Kept; flagged as a curiosity |
| 4.3.11 | District 69 missing 2022 values | 1 district | 2022 columns not used |
| 4.3.12 | Weekdays, round amounts, bank codes | — | Treated as artifacts; no findings built on them (section 10) |
| 4.3.13 | App input precision | all | Exported at full precision; rounding to cents flipped 13 runways by 0.1 (section 13.6) |
| 4.3.14 | Rounding rule | all | App rounds like Python (exact halves to even); didn't change any result, kept for safety |
| 4.3.15 | Raw data not modified | — | We never edit the CSVs; every change is a calculation in code |

---

## 5. Headline finding and its evidence

### 5.1 Headline table (non-pensioners, 376 per decile)
| | Lowest-earning 10% (D1) | Highest-earning 10% (D10) |
| --- | ---: | ---: |
| Median income | $1,186 | $26,568 |
| Median spending | $1,278 | $24,139 |
| Median buffer B | $14,934 | $39,377 |
| Comfort number (where balance settles) | $14,272 | $33,414 |
| 3 months of spending | $3,835 | $72,418 |
| Months of spending saved | **11.1** | **1.6** |
| Run out < 3 months on EI, official rule | 3.5% | 25.5% |
| Run out < 3 months on EI, real cap | 3.5% | **93.4%** |

### 5.2 Full decile table (non-pensioners; chart data)
| Decile | Income | Spending | Buffer | Comfort no. | 3 mo spending | Months saved | EI<3 official | EI<3 real cap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| D1 | $1,186 | $1,278 | $14,934 | $14,272 | $3,835 | 11.06 | 3.5% | 3.5% |
| D2 | $2,187 | $1,598 | $13,445 | $12,416 | $4,794 | 8.56 | 2.7% | 2.7% |
| D3 | $4,232 | $3,635 | $17,797 | $16,438 | $10,904 | 4.63 | 6.4% | 6.4% |
| D4 | $6,597 | $6,239 | $20,989 | $18,479 | $18,718 | 3.14 | 9.0% | 13.3% |
| D5 | $8,552 | $8,183 | $24,908 | $21,037 | $24,548 | 2.88 | 10.1% | 25.3% |
| D6 | $10,505 | $10,116 | $27,423 | $23,299 | $30,349 | 2.68 | 13.0% | 32.7% |
| D7 | $12,405 | $12,136 | $28,729 | $25,409 | $36,409 | 2.40 | 14.1% | 44.9% |
| D8 | $14,294 | $13,953 | $32,899 | $28,398 | $41,859 | 2.35 | 14.6% | 49.2% |
| D9 | $17,514 | $16,493 | $32,346 | $28,126 | $49,478 | 1.96 | 21.8% | 71.0% |
| D10 | $26,568 | $24,139 | $39,377 | $33,414 | $72,418 | 1.62 | 25.5% | 93.4% |

- 5.2.1 The comfort number and 3 months of spending cross at about $7k/month income (D4–D5).
- 5.2.2 Income rises ~22× from D1 to D10; the comfort number only ~2.3×.

### 5.3 All-customers version (from the first survey, 450 per decile)
D1: I $1,580, B $14,060, 10.6 months, EI<3 3.1% / 3.1% · D3: $3,379, $14,369, 6.1, 1.6% / 1.6% · D5: $6,421, $20,834, 3.5, 8.4% / 12.0% · D7: $11,101, $28,287, 2.7, 12.2% / 34.4% · D9: $15,642, $32,800, 2.1, 18.2% / 62.0% · D10: $25,474, $38,899, 1.7, 24.4% / **89.3%**.
- 5.3.1 Lifetime savings rate: 18% in D1 vs 3.7% in D10.
- 5.3.2 Spearman income vs months saved: −0.74 (all), −0.68 (non-pensioners).

### 5.4 The thermostat (mechanism)
| Balance vs usual | Next-month net flow (share of usual income) | Next-month cash withdrawals vs usual | Chance of a > 2× cash withdrawal |
| --- | ---: | ---: | ---: |
| Far below | +34% | — | — |
| Below | +20% | 0.70× | 10.5% |
| Near usual | +4% | 1.00× | 14.0% |
| Above | −5% | 1.22× | 24.3% |
| Far above | −19% | 1.67× | 36.0% |

- 5.4.1 Spearman(deviation, next-month net) = **−0.30** over 166,875 account-months; shuffled-order null ≈ −0.20 (−0.195, −0.204, −0.19). Some negative correlation is automatic when measuring against a median, so the claim is "stronger than chance," not the raw −0.30.
- 5.4.2 94% of accounts individually show a negative correlation (caveat: the null would also produce many).
- 5.4.3 Next-month total spending: below usual 0.88× · near 1.01× · above 1.14× · far above 1.39×.
- 5.4.4 The money leaves as **cash withdrawals**, not transfers to other banks.
- 5.4.5 By income (chart): next-month net, bottom 20% vs top 20% of earners: below +34% / +19% · near +18% / +3% · above +12% / −17% · far above −27% / **−66%**.
- 5.4.6 Strength by income quintile (Spearman): Q1 −0.26, Q2 −0.26, Q3 −0.29, Q4 −0.31, Q5 **−0.43**.

### 5.5 The comfort number is in dollars, not months
- 5.5.1 Comfort number by all-customer decile: D1 $13.1k · D2 $12.4k · D3 $13.5k · D4 $16.0k · D5 $18.3k · D6 $21.1k · D7 $23.8k · D8 $26.3k · D9 $28.1k · D10 $33.2k. As months of income: 12.0 → 5.1 → 4.0 → 3.8 → 2.9 → 2.5 → 2.2 → 2.0 → 1.7 → 1.3.
- 5.5.2 Elasticity of buffer to income: naive 0.26 (all non-pensioners); by income band: < $5k 0.06, $5–12k 0.52, > $12k 0.32. Everyone below ~$5k keeps about $13k regardless.
- 5.5.3 Noise-corrected elasticity **0.29 (95% CI 0.26–0.31)** → doubling income raises savings ×1.22.
- 5.5.4 Ruled out "pass-through accounts": D5–D10 income is 99% cash deposits; money to other banks is ~0%; D10 spends 90% as cash.
- 5.5.5 Lifetime money kept (1 − out ÷ in): D1 18% → D10 3.7%.
- 5.5.6 New accounts: average balance $566 → $8.5k → $17.8k → $21.8k over months 0–3, then $19–24k for years.

### 5.6 Fragility gap (all-customer deciles)
| Decile | Short of 3 months | Median gap | Monthly surplus | Months to close |
| --- | ---: | ---: | ---: | ---: |
| D5 | 45% | $0 | $658 | — |
| D6 | 56% | $1,745 | $735 | 2.3 |
| D7 | 59% | $3,484 | $863 | 3.5 |
| D8 | 71% | $8,310 | $899 | 7.8 |
| D9 | 80% | $14,163 | $911 | 13.8 |
| D10 | 98% | $31,642 | $1,034 | 27.9 |

- 5.6.1 Saving half the June/December bonus closes the gap in (years): D6 0.33 · D7 0.62 · D8 1.17 · D9 1.85 · D10 3.03.

### 5.7 Why top earners run out, and whether they could cut (non-pensioners)
| Decile | Spending | Fixed costs | Fixed share | Flexible | Cash share | Autopay share of S |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| D1 | $1,278 | $0 | 0% | $1,106 | 99.7% | 0% |
| D2 | $1,598 | $1,053 | 52% | $962 | 36% | 85% |
| D5 | $8,183 | $2,863 | 36% | $5,232 | 62% | 49% |
| D8 | $13,953 | $2,876 | 21% | $11,034 | 78% | 26% |
| D10 | $24,139 | $2,967 | 12% | $20,544 | 89% | 18% |

- 5.7.1 Fixed costs plateau around $3k/month from D5 up.
- 5.7.2 We can't tell whether cash spending is necessary (no categories, no household size).
- 5.7.3 Natural experiment (12,450 income-drop months, 904 accounts): spending that month / next month / after two low months: bottom 30% 1.35× / 0.81× / 0.88× · middle 40% 0.60× / 0.59× / 0.29× · top 30% 0.56× / 0.58× / 0.33×. Normal months ≈ 0.96–1.00×. Partly mechanical (cash is withdrawn after deposits arrive).
- 5.7.4 Cut of flexible spending needed to reach 3 months (real cap), median: D9 20%, D10 **39%**; achievable without touching fixed costs for ~99%.
- 5.7.5 Top 10% under 3 months: as is 93.4% · cut flexible 25% → 72.3% (median runway 2.5) · cut 50% → **29.5%** (3.7) · live on fixed costs + a median customer's flexible spending ($5,232) → 8.5% (8.2 months).
- 5.7.6 Top 10% under 3 months by EI rule: no EI 98.7% · real cap 93.4% · official uncapped 25.5% · full income kept 0%. Bottom 10%: 3.5% / 3.5% / 3.5% / 2.9%.
- 5.7.7 The real cap replaces 12% of a top earner's income ($3,159 of $26,568).
- 5.7.8 Currency scale: if every amount were ×0.5 / ×0.75 / ×1 / ×1.5, top 10% under 3 months = 81.4% / 90.4% / 93.4% / 95.7%. Months saved (11.1 vs 1.6) is identical at any scale.

---

## 6. Stress tests (`analysis/stress_headline.py`)
| # | Test | Result |
| --- | --- | --- |
| 6.1 | Measurement noise (split-half) | Income reliability 0.854. Elasticity naive 0.237 → corrected 0.286. Cushion by odd-month income decile, using even-month spending: D1 8.83 · D2 8.15 · D3 4.12 · D4 3.08 · D5 2.63 · D6 2.58 · D7 2.29 · D8 2.20 · D9 1.78 · D10 1.49; Spearman −0.68 |
| 6.2 | 8 regions | Spearman −0.64 to −0.74; top 20% at 1.6–1.9 months vs bottom 20% at 8.2–10.0 everywhere |
| 6.3 | Account age (1–2y, 2–3y, 3–4y, 4y+) | −0.66 to −0.70; holds |
| 6.4 | Gender, couples vs singles | −0.68 each; holds |
| 6.5 | Steady income only (CV ≤ 0.6); autopay only | −0.67, −0.69; holds |
| 6.6 | Including pensioners | −0.74; holds |
| 6.7 | Buffer definitions: judges' 6-month / 12-month mean / comfort number / whole-history mean / lowest balance last 12 months | Elasticity 0.26 / 0.25 / 0.23 / 0.25 / 0.09; D10 cushion 1.6 / 1.5 / 1.4 / 1.4 / **0.5** months |
| 6.8 | Year by year (full account-years, non-pensioners) | 2021 elasticity 0.24, D10 1.2 mo · 2022 0.24, 1.3 · 2023 0.24, 1.3 · 2024 0.25, 1.3 · 2025 0.27, 1.3 |
| 6.9 | Bootstrap 95% intervals (1,000 resamples, all customers) | D10 cushion 1.63 (1.56–1.69) · D1 9.03 (8.75–9.50) · D10 EI<3 real cap 90.2% (87.3–92.9) · official 26.0% (22.0–30.0) · D1 3.1% (1.6–4.9) · corrected elasticity 0.286 (0.26–0.31) |
| 6.10 | Thermostat in every income quintile | Yes; strongest at the top (5.4.6) |
| 6.11 | "Savings kept at another bank" | 20–41% per decile ever send money elsewhere; median share 0%. Top-30% earners with outbound transfers: cushion 1.84 vs 1.98 without. Unlabelled standing orders > 5% of income: 19.7% of top earners, cushion 1.88 vs 1.96. **Upper bound** (every dollar ever sent elsewhere + every unlabelled standing order every month counted as hidden savings): top 30% 1.93 → 2.44 months, 62% still under 3; bottom 20% 8.51 → 15.46 |
| 6.12 | Not ruled out | Savings funded by money that never touches this bank |

---

## 7. Supporting findings (used in the product)

### 7.1 Layoff timing (app model, 3,547 non-pensioners)
- 7.1.1 Median runway by layoff month: Jan **6.1** · Feb **7.8** · Mar 7.1 · Apr 7.0 · May 6.9 · Jun 6.6 · Jul 6.7 · Aug 6.3 · Sep 6.9 · Oct 6.9 · Nov 6.9 · Dec 6.4.
- 7.1.2 Median gap between a customer's best and worst start month: **2.7 months**.
- 7.1.3 Worst month is January (16.1%), June (18.4%) or December (18.1%) for 52.6% of customers.

### 7.2 Bonus months
- 7.2.1 Money in by calendar month (index, average = 100): Jan 97 · Feb 94 · Mar 97 · Apr 95 · May 96 · **Jun 122** · Jul 97 · Aug 96 · Sep 96 · Oct 96 · Nov 94 · **Dec 120**.
- 7.2.2 Driven by transfers in (+35%) and cash deposits (+20%); pensions flat; interest +10% in Dec.
- 7.2.3 66% of customers get > 10% above their median income in June (65.6% in December); median bump among them +50%.
- 7.2.4 Pensioners almost never (0.1%).
- 7.2.5 Two +50% months ≈ +8% a year above 12 × I.

### 7.3 Seasonal spending / January
- 7.3.1 Money out by calendar month (index): Jan **145** · Feb **70** · Mar 89 · Apr 89 · May 95 · **Jun 139** · Jul 89 · Aug 93 · Sep 93 · Oct 95 · Nov 93 · Dec 112. Cash withdrawals: Jan 157, Jun 151, Feb 61.
- 7.3.2 January spending ÷ that year's average: 2021 1.31 · 2022 1.49 · 2023 1.49 · 2024 1.41 · 2025 1.45 (2020 is 0.04 because accounts were still opening). June: 1.37–1.51.
- 7.3.3 Lowest balance of the year: January 23.7% of account-years, February 13.4%, June 13.3%, July 7.5%, December 7.1%.
- 7.3.4 Customers without a December bonus spike harder in January (2.0× their median spending vs 1.7×).
- 7.3.5 Household bills rise steadily through the year (index 98 → 102), no seasonality.

### 7.4 Living on the edge (117 customers)
- 7.4.1 Edge groups by share of edge months: rarely < 5% (2,543) · sometimes (1,840) · often 25–50% (106, EI<3 66%) · mostly > 50% (11, EI<3 73%).
- 7.4.2 Slide, not a phase: edge share 25% (first half of history) → 46% (second half); 70% got worse, 20% better, 10% same; median longest streak 6 months.
- 7.4.3 Not seasonal: edge months 7.5–9.4% in every calendar month.
- 7.4.4 Tipping month: spending > 1.3× usual in 42%, income < 0.8× usual in 40%; median spending 1.14×, income 0.99×; spending already 1.08× the month before.
- 7.4.5 Profile vs everyone else: income $12,801 vs $7,491 · income CV 0.91 vs 0.25 · savings rate 2% vs 8% · cash 90% vs 66% · labelled bills 0% vs 20% · standing orders 11% vs 42% of income · loan 39% vs 15% · frequent statements 21% vs 7% · ever negative 86% vs 4% · card 10% vs 20% · shared 4% vs 20% · pensioners 1% vs 17% · comfort number 1.1 vs 3.0 months of spending.
- 7.4.6 Overlap with irregular earners: 32% of edge customers are irregular; 7% of irregular customers are on the edge.
- 7.4.7 Earlier, looser definition (lowest balance < 25% of *that month's* income in most months): 119 customers, EI<3 71%.

### 7.5 No automatic payments → going negative
- 7.5.1 742 customers (16.5%) have no standing orders.
- 7.5.2 Ever negative by income quarter, no autopay vs autopay: Q1 7.3% vs 1.0% · Q2 32.4% vs 2.6% · Q3 26.7% vs 4.5% · Q4 28.8% vs 6.2% (n no-autopay: 289, 111, 165, 177).
- 7.5.3 EI<3 by quarter, no autopay vs autopay: 4.8 vs 1.4 · 21.6 vs 2.9 · 15.8 vs 11.5 · 15.3 vs 20.4 (reverses at the top).
- 7.5.4 Their income: CV 0.92 vs 0.24; top 3 months bring 24% of income vs 12%; zero-income months 4.3% vs 0.2%.
- 7.5.5 By number of standing orders, ever negative: 0 → 20.5% · 1 → 4.8% · 2 → **0%** · 3 → 3.8% · 4+ → 6.9%.
- 7.5.6 All customers: 288 (6.4%) ever went negative; their EI<3 is 45.8% vs 7.2%; they earn more ($10,739 vs $7,325).
- 7.5.7 Caveat: autopay is likely a marker of steady income, not the cause.

### 7.6 Statement frequency
| Type | n | Median I | EI<3 official / real cap | Has loan | Ever negative | Fees per month |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Monthly | 4,167 | $6,982 | 8.6% / 25.1% | 13% | 5% | $7.9 |
| Weekly | 240 | $16,052 | 22.5% / 62.5% | 38% | 15% | $16.6 |
| After every transaction | 93 | $16,053 | 24.7% / 63.4% | 34% | 24% | $49.7 |
- 7.6.1 Correction: at the same income (top 40%), EI<3 is 19.8% (frequent) vs 16.7% (monthly), so most of the fragility was income.
- 7.6.2 What survives: ever negative 15.3% vs 7.8% at the same income; income CV 0.91 vs 0.24; leasing 20% vs 7%; comfort number 1.7 vs 3.1 months; lifetime fees $829 vs $284.

### 7.7 Fixed commitments
- 7.7.1 Leasing standing order (7.6% of customers): buffer $30,937 vs $21,700, but EI<3 17.6% vs 9.0%.
- 7.7.2 Loan standing order (15.9%): buffer $28,500 vs $21,040, EI<3 20.5% vs 7.6%.
- 7.7.3 Insurance (11.8%): EI<3 12.0% vs 9.3%. Household bills order (74.8%): 7.8% vs 15.1%. Other (26.6%): 11.2% vs 9.1%.
- 7.7.4 Standing orders as share of income: quartiles 18% / 41% / 61%; 90th percentile 66%.
- 7.7.5 Standing-order median amounts: household bills $2,007 · loan $2,511 · leasing $1,228 · other $843 · insurance $396.

---

## 8. Other findings from the broad survey

### 8.1 People
- 8.1.1 By age band (all customers): <25 cushion 4.1 months · 25–34 2.6 · 35–44 2.6 · 45–54 2.6 · 55–64 2.9 · 65–74 6.2 · 75+ 5.8. EI<3: 8.2% / 12.0% / 12.1% / 13.2% / 10.2% / 0% / 0%.
- 8.1.2 Retirement looks rule-based: share on pension, women 26% at 59, 81% at 60, 100% at 61; men 0% at 63, 95% at 64. Youngest pensioner: women 59.2, men 64.0.
- 8.1.3 Women 55–64: income $5,328 vs men $9,100 (28% vs 6% on pension). Under 25 reversed: women $6,887, men $5,137. Overall identical ($7,565 vs $7,585).
- 8.1.4 Gender overall: cushion 3.05 vs 2.98 months; EI<3 8.7% vs 10.6%.
- 8.1.5 Couples: 869 shared accounts, all one man + one woman (437 M-owner, 432 F-owner), all within 10 years in age (median gap 4.1), all same home district.
- 8.1.6 Couples vs singles: income $6,949 vs $7,721, EI<3 8.6% vs 9.9%; lowest income quarter EI runway 51.2 vs 37.3 months; no difference higher up.
- 8.1.7 Cards: classic income $13,711, gold $14,996, junior $11,460, none $5,758. Gold buffer $48,894. EI<3 real cap: classic 40.8%, gold 26.1%, junior 33.8%, none 25.4%.
- 8.1.8 Card holders use more cash (79% vs 62% of spending); card payments < 1% of spending. Junior cards issued at age 12.6–20.9 (median 18.4); cards issued a median 1.8 years after opening; no cards for authorized users.
- 8.1.9 Cash share by age: <25 82% · 25–34 70% · 35–44 69% · 45–54 71% · 55–64 65% · 65+ 48%.
- 8.1.10 Owners under 18: 56 (youngest 16.1); median income $1,600, buffer $21,873. Under-25s: 20% have junior cards; 10% shared.
- 8.1.11 Account age barely matters (cushion 2.8–3.3 months across groups).
- 8.1.12 Spearman with months saved: income −0.74, spending −0.81, pension share +0.35, standing-order total −0.46, age +0.15; district salary, unemployment, urban ratio ≈ 0.

### 8.2 Places
- 8.2.1 Region medians: income $6,860 (east Bohemia) to $8,142 (Prague); buffer $20,597–$23,412; EI<3 7.4%–11.4%.
- 8.2.2 Across 77 districts, Spearman with customer outcomes: average salary vs income −0.11, vs buffer +0.05; unemployment vs buffer +0.16, vs EI runway −0.08; urban ratio vs income −0.23; entrepreneurs vs income +0.12; crimes vs buffer −0.06.
- 8.2.3 Within-district income spread $7,388 vs between-district $1,882 (~4×).
- 8.2.4 Customers per 10k inhabitants: 2.3–11.2 (median 4.6); higher in poorer, more rural districts (reach vs salary −0.27, vs urban −0.36).
- 8.2.5 91% bank in their home district; the 409 who don't hold slightly more (cushion 3.35 vs 3.00).
- 8.2.6 Unemployment rose in 73 of 76 districts 2022→2023; no relation to buffers (+0.19).

### 8.3 Behaviour
- 8.3.1 Income CV quartiles 0.18 / 0.25 / 0.45; spending CV 0.50 / 0.65 / 0.84.
- 8.3.2 Steadiest income quarter: income $3,508, cushion 6.4 months, EI<3 3.9% (mostly pensioners). Most volatile: $8,982, 2.6 months, 16.2%.
- 8.3.3 Balance trend: 72.8% rising over the last 12 months; median +5.5% of monthly income per month. Building 2,340 (EI<3 2.7%) · flat 1,516 (17.6%) · draining 630 (16.5%).
- 8.3.4 Balance volatility (CV of monthly average balance after month 3): 0.17 / 0.23 / 0.32.
- 8.3.5 Spending archetypes: all-cash (> 95% cash) 861, EI<3 12.7% · bill-heavy (> 30% bills) 1,679, 4.6% · transfer-heavy 497, 5.6% · mixed 1,463, 15.0%.
- 8.3.6 Fixed-amount income (biggest monthly credit varies < 2%): 330 customers, 71% pensioners, median age 68, EI runway 39 months.
- 8.3.7 Payday regularity: biggest credit lands on the account's usual day 97% of months (median).
- 8.3.8 Transactions per month: few (4.4) → many (7.1); more transactions = higher income, lower runway.
- 8.3.9 Interest: implied ~4.9% a year on average balance for everyone (10th–90th percentile 4.5–5.2%).
- 8.3.10 Fees: $1.71M total; 97.7% of customers pay some; 155,832 statement-fee rows; penalty interest 1,577 rows on 264 accounts, $23,700 total.
- 8.3.11 Living close to zero (lowest balance < 25% of that month's income, share of months): quartiles 1.8% / 3.1% / 5.3%; 90th 10%.
- 8.3.12 Lowest point vs average balance in a month: median 0.82.

### 8.4 Time
- 8.4.1 Per active account by year: accounts 1,139 (2020) → 4,492 (2025); money in $10.3k → $11.2k; money out $7.2k → $10.9k; average balance $17.7k → $24.1k; days below zero 0 → 0.2.
- 8.4.2 Cohorts (opening year → cushion months): 2020 3.8 · 2021 3.3 · 2022 3.4 · 2023 3.2 · 2024 3.2.

---

## 9. Loans (parked: most-studied angle on this dataset)
- 9.1 682 loans, 76 defaults (11.1%). Status: A 203, B 31, C 403, D 45.
- 9.2 Using only months before each loan started (median 13 months of history, minimum 3):
  - 9.2.1 None of the 606 repayers ever had a negative balance, before or after the loan.
  - 9.2.2 27 of 76 defaulters were negative before approval (B: 8, D: 19); all 27 defaulted. First negative month relative to loan start: median +2 months, range −14 to +55.
  - 9.2.3 Pre-loan buffer quarter: lowest (< $18,555) 25.1% default · 7.1% · 7.6% · highest 4.7%.
  - 9.2.4 Payment-to-income quarter: lowest 4.1% · 11.2% · 9.4% · highest 19.9%.
  - 9.2.5 Pre-loan EI runway band: < 3 mo 22.0% · 3–6 8.9% · 6–12 4.5% · 12–120 7.1% · "no shortfall" 17.3%.
  - 9.2.6 Flag "negative before the loan OR lowest-quarter buffer": flags 180, catches 52 of 76 defaults (68%); flagged 28.9% default vs 4.8% unflagged.
  - 9.2.7 Defaulters vs repayers before the loan: buffer $17,727 vs $25,788; income $10,574 vs $13,850; lowest balance $245 vs $440.
- 9.3 Caveats: small numbers; not robustness-tested; computed in a one-off run, not a saved script.

---

## 10. Data artifacts (things that look generated, not real)
- 10.1 Weekdays are meaningless: transactions spread evenly over all 7 days (14.2–14.4% each).
- 10.2 Amounts aren't round: 0.4% of cash withdrawals are whole dollars (conversion scrambled them).
- 10.3 43% of credits land on the 30th/31st: interest posting, not paydays.
- 10.4 Partner bank codes are uniform (458–531 standing orders each across 13 codes).
- 10.5 Interest rate near-uniform (~4.9%).
- 10.6 "Household bills" is exactly the standing-order amount.
- 10.7 Couples perfectly regular; retirement ages knife-edge (8.1.2, 8.1.5).
- 10.8 2020 is a partial year (accounts still opening; January 2020 spending ≈ 0).

---

## 11. Limits (what we can't claim)
- 11.1 1990s Czech cash economy: we claim the pattern, not the exact dollar amounts.
- 11.2 Only one bank: savings funded from money that never touches this account can't be ruled out.
- 11.3 "Money in" is deposits, not gross salary, so EI amounts are approximate.
- 11.4 The comfort number is observed behaviour, not proven psychology.
- 11.5 Warning signs are correlations, not causes.
- 11.6 No household size: a high income may support more people.
- 11.7 We can't tell necessary from discretionary spending (cash has no category).
- 11.8 Small groups: 117 edge customers, 76 loan defaults.
- 11.9 Customers earn ~1.6× the Canadian average (StatCan, Aug 2026); tested: results hold at any scale (5.7.8).

---

## 12. The app: every calculation it does
Live at https://comfort-number.vercel.app (code in `web/`, engine in `web/src/lib/engine.ts`).

- 12.1 **Data:** `engine.json` (0.96 MB, columnar, full-precision I, S, F, H, B, P) built by `build_engine_data.py`; all calculations run in the browser.
- 12.2 **Customer card:** I, S, F, B, P and no-shock runway (official); comfort number; cushion months (B ÷ S) and the typical cushion for their income decile; tags: pensioner, high earner with thin cushion (decile ≥ 8 and cushion < 3), bonus months, no bills in data, often close to zero, irregular income, has gone below zero, shared account.
- 12.2a **Plain-words scenario box (top of the page):** rule-based parser (`web/src/lib/scenario.ts`) reads the account number, job loss / EI %, income drop, length (months, weeks, a year), bills/rent increase %, one-off cost (months of spending or dollars; furnace defaults to 1 month), start month; shows "Understood as" for each match. Defaults: job loss without a % → 55%, length → 6 months.
- 12.3 **Shock inputs (also always visible under "Adjust the shock"):** income during shock (% of usual; 100 = no job loss), shock length (months), household bills/rent up (%), one-off cost in months of spending, one-off cost in dollars, start month. Twist cards: EI 55% for 6 months · furnace (1 month of spending) · EI + bills 15% · rent and bills up 25% · reset.
- 12.4 **Official result:** income = pct × I; spending = S + bills% × H; buffer left = B − one-off; runway by the official rule (2.7).
- 12.5 **Real-world result:** same formula, but (a) pensioners keep their pension (I × pension share) and only the rest drops; (b) for a job loss only (layoff/EI wording, or the "It's a job loss" checkbox), earned income is capped at $3,159/month; a plain income drop such as reduced hours isn't capped; (c) if H = 0 and a bills shock is applied, H is estimated at 19.9% × S. Each applied correction is listed on screen.
- 12.6 **Verdict:** horizon = shock length for a job loss, otherwise 3 months. "Yes, they make it" if both runways ≥ horizon; "Official formula: yes. Real rules: no" if only the official one is; otherwise "No, savings run out in about X."
- 12.7 **Balance chart (24 months):** starts at buffer left; each month spending = S × seasonal factor (+ extra bills during the shock, or always for a non-job-loss shock); income = real-world shock income during the shock, then I (+ I × bonus % in June and December). Reports when the balance hits zero and the lowest point.
- 12.8 **Goal plan:** target = 3 × S; gap = max(0, target − B); monthly transfer = lifetime mean surplus (mean in − mean out) if ≥ 2% of I, else 5% of flexible spending; bonus boost = half of (2 × I × bonus %) per year ÷ 12; months to goal = ceil(gap ÷ transfer). Comfort-number message: "raise the setting with an automatic transfer."
- 12.9 **Backup plan:** target months = max(3, shock length if job loss); needed spending = buffer left ÷ target + real-world income; cut = real-world spending − needed spending, as a share of flexible spending (S − F); also runway after cutting flexible spending 10%, 25%, 50%; notes on lost bonus months and start-month timing.
- 12.10 **Accuracy check (`npm run verify`):** compares the app's I, S, F, H, B, P and official runway (no shock, EI 55%, furnace, EI + bills 15%, bills 15%) with `output/judges_expected.csv` from Python: 4,500 accounts, 49,500 checks, **0 mismatches**, exact (no tolerance).
- 12.11 **Plan in plain words:** `/api/explain` sends the computed numbers to Gemini (model `gemini-2.5-flash` by default) with instructions to use only those numbers; max ~120 words. If `GEMINI_API_KEY` isn't set or the call fails/times out (12 s), a template using the same numbers is returned. **Key not set yet.**
- 12.12 **Findings page:** the four charts from `findings.json` (5.2, 5.4.5, 5.2 EI columns, 7.1.1).
- 12.13 **Rehearsal accounts:** 20111 (judges' example), 71293 (high earner, thin cushion: official 6.2 vs real 2.8 months on EI), 22998 (on the edge), 98208 (saver with bonuses), 93255 (pensioner).
- 12.14 **Known simplifications:** the chart uses median S with seasonal factors (so for customers with the median quirk the no-shock path drifts down); plans use lifetime mean surplus; bills estimate is a single share for everyone.

---

## 13. Corrections we made along the way
- 13.1 Loan defaults were our first lead; parked because it's the most-studied angle on this dataset.
- 13.2 Statement frequency's fragility was mostly income (7.6.1); only the overdraft signal survives.
- 13.3 "Irregular earners" and "on the edge" overlap much less than first suggested (7.4.6).
- 13.4 Layoff timing: first reported December 6.9 vs February 9.2 (2.9-month gap, average-based model); corrected to January 6.1 vs February 7.8 (2.7-month gap) using the median-based model the app uses.
- 13.5 The 93% figure only holds "if nothing changes"; added the cut-back analysis (5.7).
- 13.6 App inputs rounded to cents flipped 13 of 49,500 runways by 0.1; fixed by exporting full precision.
- 13.7 The prototype in `app/` is throwaway; the real app is `web/`.
- 13.8 The EI cap is real policy; the official uncapped rule is the simplification (wording fixed in docs).

---

## 14. Numbers that can be confused with each other
- 14.1 **Top 10% run out within 3 months on real EI:** 89.3% (all customers, rounded runways, first survey) · 90.2% (all customers, unrounded, bootstrap) · **93.4% (non-pensioners, charts and pitch)**. Use 93% with "non-pensioners".
- 14.2 **Top 10% months saved:** 1.7 (all customers) · 1.6 / 1.62 (non-pensioners) · 1.63 (bootstrap, all) · 1.49 (split-half).
- 14.3 **Bottom 10% months saved:** 10.6 (all) · 11.1 (non-pensioners) · 9.03 (bootstrap median) · 8.83 (split-half).
- 14.4 **Elasticity:** 0.26 (naive, non-pensioners) · 0.24 (naive, odd-month income) · **0.29** (noise-corrected) → ×1.19 vs **×1.22** when income doubles.
- 14.5 **EI < 3 months, everyone:** 9.7% official · 27.9% real cap · 11.6% official for non-pensioners.
- 14.6 **Official rule for top 10%:** 24.4% (all) vs 25.5% (non-pensioners) vs 26.0% (bootstrap); pitch says "26%".
- 14.7 **Comfort number D10:** $33,170 (all-customer decile) vs $33,414 (non-pensioner decile).

---

## 15. Files, outputs and how to reproduce
| File | What it does | Output |
| --- | --- | --- |
| `build_customer_table.py` | Judges' metrics, standard shocks, pre-loan metrics, context joins | `output/customers.csv/.json` |
| `analysis/verify_formula.py` | Formula problems (4.1) | `output/customers_checks.csv` |
| `analysis/explore_people.py`, `explore_places.py`, `explore_behaviour.py`, `explore_time.py`, `explore_followups.py` | Broad survey (sections 7–8) | `output/customers_explore.csv`, `customers_time.csv` |
| `analysis/deep_plateau.py` | Thermostat, comfort number, elasticity, fragility gap | `output/customers_plateau.csv` |
| `analysis/deep_edge.py` | Edge, autopay, statement frequency | `output/customers_edge.csv` |
| `analysis/stress_headline.py` | Stress tests (section 6) | printout |
| `analysis/deep_topearners.py` | Top earners' spending, natural experiment, cuts, EI and scale sensitivity | printout |
| `build_engine_data.py` | App data, test fixture, timing simulation | `web/public/engine.json`, `output/judges_expected.csv`, `output/timing_by_start_month.csv` |
| `build_chart_data.py` | Chart data | `charts/charts.js`, `web/public/findings.json` |
| `web/` | The app; `npm run verify`, `npm run dev`, `vercel deploy --prod --yes` | — |

Run order: `build_customer_table.py` → `analysis/` (verify_formula, explore_behaviour, explore_time, deep_plateau, deep_edge, stress_headline) → `build_engine_data.py` → `build_chart_data.py` → `web/`.
Data and `output/` aren't in the repo (`transactions.csv` is over 100 MB). Loan numbers (section 9) came from a one-off run.

---

## 16. Not done / open questions
- 16.1 Gemini key not set in Vercel (template wording used).
- 16.2 Pitch doesn't yet include a cleaning sentence or a "how did you clean the data?" answer.
- 16.3 Devpost write-up not drafted.
- 16.4 Possible deep dives: does the comfort number move after a bonus or big event? Who raised theirs over time, and what's different about them? How many months of warning does the edge slide give before the first negative balance?
- 16.5 Loan analysis not saved as a script or robustness-tested.
- 16.7 Open honesty decisions: see `docs/HONESTY.md` Part 3.
- 16.6 Vercel isn't auto-deploying from GitHub (Root Directory would need to be `web`).

---

## 17. Sources
- PKDD'99 Discovery Challenge Financial dataset, CTU Prague Relational Dataset Repository: https://relational.fel.cvut.cz/dataset/Financial
- Government of Canada, EI regular benefits (55%, $729/week maximum, $68,900 maximum insurable earnings, 2026): https://www.canada.ca/en/services/benefits/ei/ei-regular-benefit/benefit-amount.html
- Statistics Canada, Table 14-10-0223-01, Employment and average weekly earnings (including overtime) for all employees, monthly, seasonally adjusted; Canada, industrial aggregate excluding unclassified businesses, August 2026 = $1,354.55/week (series v79311153; used only for the scale comparison): https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410022301
- Organizers' brief and data dictionary: `docs/CHALLENGE.md`
