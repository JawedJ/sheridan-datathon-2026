# Honesty and rules check

Two questions, answered item by item:
1. **Are we following every rule** from the Tangerine brief (`docs/CHALLENGE.md`) and the Devpost page?
2. **Exactly how do we use the data**: what's the raw data, what's the judges' formula, and what's our
   own estimate or assumption?

Nothing in this file has been changed in the app or analysis yet. Items marked **DECIDE** are open
questions for the team.

---

## Part 1 — Rules

### 1.1 Tangerine track requirements
| # | Rule (source) | Status | Where |
| --- | --- | --- | --- |
| R1 | **Know the customer:** any `account_id` → income, bills and fixed costs, savings buffer, months of runway (brief) | ✅ | Engine, section 1 |
| R2 | **Take a shock** and recalculate (job loss with EI, higher rent/bills, surprise repair, a mix); **user can change the size** (brief) | ✅ | Plain-words scenario + "Adjust the shock" sliders (always visible) |
| R3 | **Make a plan:** a goal plan (e.g. emergency fund) **and** a backup plan if the shock hits, **based on their own numbers** (brief) | ✅ | Engine, section 3 |
| R4 | Live twist: judge picks an `account_id` and reads a twist card; we run it live (brief) | ✅ | Type the card into the scenario box; all three example cards parse correctly |
| R5 | Judges' definitions for I, F, S, B, H, P and runway (brief) | ✅ Exact | `npm run verify`: 4,500 accounts × 5 shocks, 49,500 checks, 0 mismatches |
| R6 | "You can use your own definitions… If your numbers differ, be ready to explain why" (brief) | ✅ | Official number always shown first; "Real-world rules" column lists every adjustment on screen |
| R7 | Using AI: "Use any tools you want, including AI" (brief) | ✅ | — |
| R8 | Credit the data: PKDD'99 Financial dataset (CTU Prague) + Statistics Canada / Government of Canada sources if used (brief) | ✅ | README "Data and sources" |
| R9 | Sources: links to every outside data source (brief) | ⚠️ See R9a | — |
| R9a | The "Canadian average income" comparison was first written from memory (~$5,600/month). **Fixed:** now sourced from StatCan Table 14-10-0223-01 (Aug 2026, $1,354.55/week = $5,870/month, read from the official CSV); the ratio changed from ~1.7× to ~1.6×. Not in the app, charts or pitch. | ✅ Fixed | FINDINGS 1.4, REFERENCE 1.7.17 / 11.9 / 17, README sources |

### 1.2 Submission (two sources disagree slightly)
| # | Item | Tangerine brief | Devpost page | Status |
| --- | --- | --- | --- | --- |
| S1 | Demo video | **2 to 3 minutes** of the engine running | **2-minute** video, public YouTube or Google Drive link | Not made. **Aim for about 2:00** to satisfy both |
| S2 | Code | Public repo or zip | Public GitHub repo, or notebook/dashboard/analysis | ✅ github.com/JawedJ/sheridan-datathon-2026 |
| S3 | Write-up | What the engine does + biggest finding | The question you asked, what you did, what you found | Not drafted. Cover all four parts |
| S4 | Sources | Links to every outside source | — | ✅ README (plus R9a) |
| S5 | Team members and tracks on Devpost | — | Required | Your side |

### 1.3 Other tracks we planned to enter
| # | Track | Requirement | Status |
| --- | --- | --- | --- |
| T1 | Best Data Visualization & Storytelling | Judged on the story and charts | ✅ Findings page + charts |
| T2 | **[MLH] Best Use of Gemini API** | Build with the Gemini API | ✅ **Live.** `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.5-flash` set in Vercel; "Write it for the customer" returns Gemini text (verified, source = gemini). Template fallback kept for reliability. Nov 7: first key hit its quota (429); replaced with a new key and switched to gemini-3.5-flash-lite (3.5-flash had no quota left); verified live |

---

## Part 2 — Exactly how we use the data

Legend: **RAW** = straight from the files · **JUDGES** = the brief's formula, exact · **DERIVED** = our
calculation from the data, no assumptions added · **ESTIMATE** = an approximation that fills a gap ·
**ASSUMPTION** = a choice we made that isn't in the data.

### 2.1 Numbers shown for the customer (section 1 of the app)
| # | Shown as | What it is | Type |
| --- | --- | --- | --- |
| H1 | Money in, Spending, Bills & fixed costs, Savings buffer, Loan payment, Runway with no shock | I, S, F, B, P and runway exactly as the brief defines them | JUDGES |
| H2 | Cushion | B ÷ S | DERIVED |
| H3 | Comfort number ("where their balance usually settles") | Median month-end balance, skipping the account's first 3 months | DERIVED |
| H4 | "People at their income level hold X months" | Median B ÷ S for their income decile, pensioners excluded | DERIVED |
| H5 | Tags (bonus, bills paid in cash, often near zero, has gone below zero, irregular income, pensioner) | Thresholds we chose: bonus > 10% in Jun/Dec; H = 0; edge months > 25%; any day below zero; income CV > 0.6 with few autopays; pension ≥ 50% of income | DERIVED with ASSUMPTION thresholds |
| H7 | Customers with no recorded bills (1,225): knock-on effects | F shows ~$0 for them (understated); the autopay warning sign overlaps 94% with this group; top-earner fixed-cost medians are pulled down. Runway and the headline are unaffected (checked within each group) |
| H6 | App label "Bills not recorded" (no claim about how they pay) | H = 0 and 98% of these customers never have a labelled bill. They most likely pay their bills in cash out of their withdrawals: they spend as much as customers with bills, but almost all of it leaves as cash (median customer 99.7%; 96% of their total spending). 158 others pay a bills standing order by untagged transfer. This is our **inference**, not something the data states | ESTIMATE |

### 2.2 The "Official formula" result (section 2)
| # | What | Type |
| --- | --- | --- |
| O1 | Income = shock % × I; spending = S + bills % × H; buffer left = B − one-off; runway rule exactly as the brief | JUDGES |
| O2 | One-off cost "in months of spending" = that many × S (furnace = 1 × S, as in the brief's example) | JUDGES |

### 2.3 The "Real-world rules" result (section 2): every adjustment
| # | Adjustment | Why | Honest caveat | Type |
| --- | --- | --- | --- | --- |
| A1 | EI capped at $729/week = $3,159/month | Real 2026 Canadian policy (canada.ca) | I is **deposits**, not insurable earnings, and includes non-wage money; EI eligibility isn't checked | ESTIMATE |
| A2 | EI cap applies **only to job losses** | EI only replaces income after a layoff | **Fixed.** Before, any income drop was capped (e.g. 71293 "income drops 30%" showed 2.8 months instead of 11.0; would have affected 2,780 customers). Now the scenario box marks layoff/EI wording as a job loss; "income drops X%" isn't; a checkbox under "Adjust the shock" controls it | fixed |
| A3 | Pensioners keep their pension; only the rest of income drops | A layoff can't stop a pension | Pension part = I × lifetime pension share (approximate) | ESTIMATE |
| A4 | **Removed.** Customers with $0 bills used to get estimated bills (19.9% of S) when a bills shock was applied. Now no estimate: the app says their bills aren't recorded, so a bills increase can't be measured. Old row for reference: | Their bills are invisible in the data | One share for everyone (the median among customers who do have bills); it's a guess, labelled on screen | ESTIMATE |
| A5 | Label "Real-world rules" | — | **Resolved:** with the bills estimate removed, this column only applies real policy (EI maximum for job losses, pensions continue) to the judges' own numbers, so the label is accurate. Deposits as income is the judges' definition | wording |

### 2.4 Month-by-month balance chart (collapsed under section 2)
| # | What | Type |
| --- | --- | --- |
| M1 | Spending each month = S × a seasonal factor | DERIVED + ASSUMPTION |
| M2 | Seasonal factor = 50% the customer's own pattern + 50% everyone's (smoothed, so one odd January doesn't dominate) | ASSUMPTION |
| M3 | After the shock, income returns to I, plus a bonus in June and December if they usually get one (> 10%) | ASSUMPTION |
| M4 | Uses median S. For the 26% with the median quirk (S > I), the no-shock path drifts down even though they don't really lose money | known limitation |

### 2.5 Plans (section 3)
| # | What | Type |
| --- | --- | --- |
| P1 | Goal target = 3 × S (3 months of spending) | ASSUMPTION (a standard rule of thumb) |
| P2 | Monthly transfer = their lifetime average surplus (mean in − mean out); if under 2% of I, "trim 10% of non-essential spending" instead | DERIVED + ASSUMPTION (5%, 2%) |
| P3 | "Plus half of each June and December bonus" | ASSUMPTION (half) |
| P4 | Backup: target = max(3 months, shock length). Protected spending = max(labelled bills+insurance+loans, 63.8% of S); the rest is "non-essential"; cut needed = share of non-essential. 63.8% = Canadian basic-needs share (food from stores, main home, transportation, health care, clothing: $48,600 of $76,146), Statistics Canada Survey of Household Spending 2023, Table 11-10-0222-01 | DERIVED + sourced ESTIMATE (a national average applied to each customer) |
| P5 | **Fixed.** Before: flexible = everything except labelled bills, so plans said e.g. "cut 97%" (71293). Now basic needs are protected (P4); if cutting all non-essential spending isn't enough, the app says so and shows the best it can do (71293: 4.3 months, needs extra income). Old note: for cash-bill customers that included their rent | ⚠️ Can produce unrealistic advice, e.g. "cut 97% of flexible spending" (account 71293, EI + rent 15%). We now add a note for cash-bill customers. **DECIDE:** say "not realistic" above some cut (e.g. 50%)? |
| P6 | Plan text (top of the plan section, written automatically once a scenario runs): template instantly, then Gemini (gemini-3.5-flash-lite) rewords that template text. It never sees raw data. Its reply is rejected unless it finished cleanly, is a plain letter, and contains no number that isn't in the template | Wording only; a note says which wording is showing |
| P7 | "What the plan changes" tiles and chart: no plan / backup cuts during the shock / start with 3 months saved / both | DERIVED projections from the same formulas; chart adds seasonal spending (labelled "projection") |

### 2.6 Plain-words scenario box
| # | What | Type |
| --- | --- | --- |
| W1 | Gemini reads the scenario into fixed fields (JSON schema); our code range-checks them and shows "Understood as", "Assumed" and "Not included" pills, so nothing is applied or dropped silently. Replaced a word-pattern script that missed 9 of 25 test phrasings | — |
| W3 | "Other spending" shock: $/month (childcare, car payment, rent up $X) or % of all spending (inflation), added to S in both columns | Our extension of "a shock changes spending"; 0 for the brief's cards, so official answers unchanged |
| W2 | Defaults when the text doesn't say (shown as "Assumed: …"): job loss without a % → 55%; furnace without an amount → 1 month of spending (labelled); length not given → 6 months | ASSUMPTION (matches the brief's examples) |

### 2.7 Findings page and pitch claims
| # | Claim | Status |
| --- | --- | --- |
| F1 | 11.1 vs 1.6 months; 93% "if nothing changes"; ×1.22 | ✅ Stated as non-pensioners on the page |
| F2 | Thermostat ("money above it gets spent") | Observational. We show balances are pulled back; we don't prove *why* (REFERENCE 11.4). Verified Nov 7: with a backward-only baseline the null is −0.01 vs real −0.23, but the effect is mostly within one month (skip a month: −0.07), so part may be deposit timing. The windfall test (FINDINGS 1.2a) is the stronger evidence; say "pulled back", don't quote −0.30 as the whole effect |
| F7 | Windfalls drain back (45% kept after 6 months vs 115% null; top 20% keep 29%) | Observed, with a null. Windfalls = net inflow ≥ 1× usual income, 97% cash deposits |
| F8 | Hidden cash savings | **Stated limit.** 41% of top-10% spending is big cash withdrawals; they look like rent/bills paid in cash, but if a full year of them were saved the top 10% would hold 7.3 months. Say this if asked; don't claim it's ruled out |
| F9 | 43% still run out after cutting all non-essentials | Uses the national-average basic-needs share. With the highest quintile's share (60.6%) it's 37.5%. Either is fine to say; 43% is the conservative one the app uses |
| F3 | Layoff timing chart | Subset: 3,547 non-pensioners whose savings run out within 10 years for every start month; seasonal factors per M2 |
| F4 | "4,500 real bank customers" headline | **Removed** from the engine page (team decision: judges know the dataset). The findings page still states the source |
| F5 | "Under real EI rules" in the pitch | Fine: deposits are the only income measure in the data and the judges' own definition |
| F10 | Findings page accuracy notes | A "How sure are we?" table and a "What we can't rule out" list. The intro box, per-chart notes and number tables were removed for a cleaner page (the detail is in FINDINGS.md section 2.1 and REPORT) |
| F6 | "88% flexible; cutting half brings 93% → 30%" | **Fixed.** Replaced everywhere with the basic-needs-protected numbers: 36% non-essential; cut half → 79% still run out; cut all → 43% |

---

## Part 3 — Decisions for the team (nothing changed yet)
1. **S1** Aim for a ~2:00 video.
