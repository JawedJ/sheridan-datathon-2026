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
| R2 | **Take a shock** and recalculate (job loss with EI, higher rent/bills, surprise repair, a mix); **user can change the size** (brief) | ✅ | Plain-words scenario + "Adjust the shock by hand" sliders |
| R3 | **Make a plan:** a goal plan (e.g. emergency fund) **and** a backup plan if the shock hits, **based on their own numbers** (brief) | ✅ | Engine, section 3 |
| R4 | Live twist: judge picks an `account_id` and reads a twist card; we run it live (brief) | ✅ | Type the card into the scenario box; all three example cards parse correctly |
| R5 | Judges' definitions for I, F, S, B, H, P and runway (brief) | ✅ Exact | `npm run verify`: 4,500 accounts × 5 shocks, 49,500 checks, 0 mismatches |
| R6 | "You can use your own definitions… If your numbers differ, be ready to explain why" (brief) | ✅ | Official number always shown first; "Real-world rules" column lists every adjustment on screen |
| R7 | Using AI: "Use any tools you want, including AI" (brief) | ✅ | — |
| R8 | Credit the data: PKDD'99 Financial dataset (CTU Prague) + Statistics Canada / Government of Canada sources if used (brief) | ✅ | README "Data and sources" |
| R9 | Sources: links to every outside data source (brief) | ⚠️ See R9a | — |
| R9a | We quote "Canadian average income ~$5,600/month (~$1,300/week)" in FINDINGS 1.4 and REFERENCE 1.7.17 / 11.9. **It came from memory, not a source we opened.** Not in the app, charts or pitch. | **DECIDE** | Either source it (StatCan Average weekly earnings, Table 14-10-0223-01, listed in the brief) or remove it |

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
| T2 | **[MLH] Best Use of Gemini API** | Build with the Gemini API | ⚠️ **Not actually using Gemini yet.** No `GEMINI_API_KEY` in Vercel, so the app uses template wording. **Don't submit to this track unless the key is set and it really runs.** |

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
| H6 | "Bills paid in cash (not in data)" | H = 0 and 98% of these customers never have a labelled bill. That they pay in cash is our **inference** (99.7% of their spending is cash) | ESTIMATE |

### 2.2 The "Official formula" result (section 2)
| # | What | Type |
| --- | --- | --- |
| O1 | Income = shock % × I; spending = S + bills % × H; buffer left = B − one-off; runway rule exactly as the brief | JUDGES |
| O2 | One-off cost "in months of spending" = that many × S (furnace = 1 × S, as in the brief's example) | JUDGES |

### 2.3 The "Real-world rules" result (section 2): every adjustment
| # | Adjustment | Why | Honest caveat | Type |
| --- | --- | --- | --- | --- |
| A1 | EI capped at $729/week = $3,159/month | Real 2026 Canadian policy (canada.ca) | I is **deposits**, not insurable earnings, and includes non-wage money; EI eligibility isn't checked | ESTIMATE |
| A2 | **Any** income drop below 100% is treated as a job loss, so the EI cap applies | Simplification in the engine | If someone types "income drops 30%" (not a layoff), the cap still applies. **DECIDE:** apply the cap only when the scenario is a job loss? | ASSUMPTION |
| A3 | Pensioners keep their pension; only the rest of income drops | A layoff can't stop a pension | Pension part = I × lifetime pension share (approximate) | ESTIMATE |
| A4 | Customers with $0 bills get estimated bills = 19.9% of S when a bills shock is applied | Their bills are invisible in the data | One share for everyone (the median among customers who do have bills); it's a guess, labelled on screen | ESTIMATE |
| A5 | Label "Real-world rules" | — | It's our estimate of real rules, not real-world data. **DECIDE:** rename to "Real-world estimate"? | wording |

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
| P2 | Monthly transfer = their lifetime average surplus (mean in − mean out); if under 2% of I, "trim flexible spending 5%" instead | DERIVED + ASSUMPTION (5%, 2%) |
| P3 | "Plus half of each June and December bonus" | ASSUMPTION (half) |
| P4 | Backup: target = max(3 months, shock length); cut needed = share of flexible spending (S − F) | DERIVED |
| P5 | **Flexible spending = everything except labelled bills, insurance and loans.** For cash-bill customers that includes their rent | ⚠️ Can produce unrealistic advice, e.g. "cut 97% of flexible spending" (account 71293, EI + rent 15%). We now add a note for cash-bill customers. **DECIDE:** say "not realistic" above some cut (e.g. 50%)? |
| P6 | "The plan, written for the customer": Gemini (if a key is set) or a template, given only our computed numbers | Wording only; label says which wrote it |

### 2.6 Plain-words scenario box
| # | What | Type |
| --- | --- | --- |
| W1 | Rule-based parser; shows "Understood as: …" for every match, nothing applied silently | — |
| W2 | Defaults when the text doesn't say: job loss without a % → 55% (labelled "EI default"); furnace without an amount → 1 month of spending (labelled); length not given → 6 months | ASSUMPTION (matches the brief's examples) |

### 2.7 Findings page and pitch claims
| # | Claim | Status |
| --- | --- | --- |
| F1 | 11.1 vs 1.6 months; 93% "if nothing changes"; ×1.22 | ✅ Stated as non-pensioners on the page |
| F2 | Thermostat ("money above it gets spent") | Observational. We show balances are pulled back; we don't prove *why* (REFERENCE 11.4) |
| F3 | Layoff timing chart | Subset: 3,547 non-pensioners whose savings run out within 10 years for every start month; seasonal factors per M2 |
| F4 | "4,500 real bank customers" | ✅ True. **Note:** they're 1990s Czech customers with amounts converted to CAD. The findings page says so; **the engine page doesn't.** **DECIDE:** add a one-line footnote on the engine page? |
| F5 | "Under real EI rules" in the pitch | Fine with A1's caveat (deposits ≠ insurable earnings) |

---

## Part 3 — Decisions for the team (nothing changed yet)
1. **R9a** Source or remove the "Canadian average income" comparison.
2. **T2** Set the Gemini key, or don't enter the Gemini track.
3. **A2** Apply the EI cap only to job-loss scenarios, not every income drop?
4. **A5** Rename "Real-world rules" → "Real-world estimate"?
5. **P5** Flag backup-plan cuts above some level (e.g. 50%) as unrealistic?
6. **F4** Add a data-origin footnote to the engine page?
7. **S1** Aim for a ~2:00 video.
