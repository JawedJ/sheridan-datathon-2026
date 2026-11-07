# Findings — Resilience Rewired (Tangerine track)

> **Headline:** *People save to a dollar number, not to a number of months, so the more you earn,
> the more fragile you are.*
>
> Balances act like a thermostat: money above a customer's usual level gets spent back down, and
> that level barely grows with income. Top earners end up with the thinnest cushion and are the
> most likely to run out after a layoff.

Charts: `charts/index.html` (open with `python3 -m http.server 8766 --directory charts`).
Every finding lists its evidence and sample size. Numbers in [brackets] after a heading are stable
IDs used in cross-references.

**Contents**
1. The headline and its evidence
2. Is it real? Stress test
3. Supporting findings for the product (timing, warning signs)
4. Data use: what we checked, cleaned and can't claim
5. Background: EI, key terms, the data
6. Other findings from the broad survey
7. Reproduce: files and run order

---

## 1. The headline and its evidence

| | Lowest-earning 10% | Highest-earning 10% |
| --- | ---: | ---: |
| Median income | $1,186/mo | $26,568/mo |
| Where their balance settles | $14,272 | $33,414 |
| Months of spending saved | **11.1** | **1.6** |
| Run out within 3 months on EI (judges' rule) | 3.5% | 25.5% |
| Run out within 3 months on EI (real $729/week maximum) | 3.5% | **93.4%** |

Non-pensioners, n = 376 per decile (3,760 total). Doubling income raises the buffer only about 22%
(elasticity 0.29, corrected for measurement noise).

**Three pieces of evidence, in the order of the pitch:**
1. **What:** savings don't keep pace with income [4.1].
2. **Why:** a measured thermostat pulls balances back to a comfort level [D1].
3. **So what:** that level is set in dollars, not months, so high earners' cushions are thinnest [D2].

**Why it matters (impact):** advice like "spend less" fights the thermostat. The fix is to *raise
the setting*: automatically move money above a customer's comfort number into savings, and show
people their cushion in months, not dollars.

**Is it non-obvious?** Partly. A team doing a broad survey could find the income table, and the EI
cap effect follows from the rules. What's harder to reproduce is the measured mechanism (D1, tested
against a shuffled-order null), the per-customer comfort number, and the robustness in section 2.

### 1.1 Higher earners hold fewer months of cushion [4.1]
Savings don't keep pace with income. Every step up the income ladder holds *fewer* months of cushion.

| Income decile | Median I | Median B | Buffer in months of spending | EI < 3 mo (judges) | EI < 3 mo (real cap) |
| --- | ---: | ---: | ---: | ---: | ---: |
| D1 (lowest) | $1,580 | $14,060 | 10.6 | 3.1% | 3.1% |
| D3 | $3,379 | $14,369 | 6.1 | 1.6% | 1.6% |
| D5 | $6,421 | $20,834 | 3.5 | 8.4% | 12.0% |
| D7 | $11,101 | $28,287 | 2.7 | 12.2% | 34.4% |
| D9 | $15,642 | $32,800 | 2.1 | 18.2% | 62.0% |
| D10 (highest) | $25,474 | $38,899 | 1.7 | 24.4% | **89.3%** |

- Income goes up about 16× from D1 to D10, but the buffer only goes up about 2.8×.
- Higher earners spend almost everything: lifetime savings rate is 18% in D1 vs 3.7% in D10.
- The real EI cap makes it dramatic, since high earners lose the most. But the pattern holds without
  the cap and without pensioners (Spearman income vs months-of-buffer = −0.68).
- **Abstract angle:** "fragility" isn't poverty. It's the *gap between lifestyle and cushion*. A
  $25k/month earner can be closer to the edge than a $1.6k/month one.

### 1.2 The comfort number: balances act like a thermostat [D1]
**Hypothesis:** each customer has a balance they feel comfortable at. Money above it gets spent;
below it, they tighten up. That would make balances plateau.

| Balance this month vs the account's usual level | Next month's net flow (share of usual income) | Next month's cash withdrawals vs usual | Chance of a big (>2×) cash withdrawal |
| --- | ---: | ---: | ---: |
| Far below | +34% (saving) | — | — |
| Below | +20% | 0.70× | 10.5% |
| Near usual | +4% | 1.00× | 14.0% |
| Above | −5% | 1.22× | 24.3% |
| Far above | −19% (spending down) | 1.67× | 36.0% |

- Balance-above-usual vs next month's net flow: Spearman −0.30 over 166,875 account-months. A
  shuffled-order null gives about −0.20 (some negative correlation is automatic). The real
  pull back to the target is clearly stronger than chance.
- 94% of accounts individually show the pull-back.
- **How the money leaves:** when the balance is high, the next month brings a big cash withdrawal.
  Spending, not transfers to other banks (those are about 0% for almost everyone).
- **Abstract angle:** a balance works like a thermostat. Savings don't grow because extra money gets
  "spent back down" to the comfort level. That points straight at an app tip: *raise the setting*
  (automatic transfer to savings) instead of "try to spend less."

### 1.3 The comfort number is in dollars, not months [D2]
Links 4.1 and D1.
- The comfort level (median balance after month 3) rises far slower than income: $13k at the
  bottom decile, $33k at the top, while income rises 16×. As months of income: **12.0 → 1.3**.
- Buffer vs income elasticity is **0.26**: doubling income raises the buffer only about 19%. Below
  $5k/month income it's flat (0.06). Everyone keeps about $13k regardless.
- **Ruled out: pass-through accounts.** High earners' income is 99% cash deposits and almost
  nothing goes to other banks. They withdraw it as cash (90% of spending in D10) and spend it.
- **The fragility gap** (dollars needed to reach 3 months of spending):

| Decile | Short of 3 months | Median gap | Monthly surplus | Months to close at that surplus |
| --- | ---: | ---: | ---: | ---: |
| D5 | 45% | $0 | $658 | — |
| D7 | 59% | $3,484 | $863 | 3.5 |
| D9 | 80% | $14,163 | $911 | 13.8 |
| D10 | 98% | $31,642 | $1,034 | 27.9 |

- **Abstract angle:** people seem to anchor savings to a *round dollar feeling* ("$20k is a lot")
  instead of their lifestyle. The richer you are, the less that number covers.

### 1.4 Why top earners run out so fast, and could they cut back? [D8]
Script: `analysis/deep_topearners.py`. Non-pensioners.

**Short answer:** the "93% run out within 3 months" figure is true *if they keep spending as usual*.
The EI cap is real Canadian policy, so 93% is the realistic number. The judges' uncapped 55% rule
(25.5%) is the simplification. Most of the jump from 25.5% to 93% comes from applying that real cap. Top earners also have by far the most room to cut, because almost
none of their extra spending is locked in. The robust part of the headline is the cushion gap
(11.1 vs 1.6 months), which doesn't depend on EI rules or currency scale.

**Their extra spending isn't fixed costs.**
| Income decile | Spending | Fixed costs (bills + insurance + loans) | Fixed share | Flexible spending | Cash share |
| --- | ---: | ---: | ---: | ---: | ---: |
| D2 | $1,598 | $1,053 | 52% | $962 | 36% |
| D5 | $8,183 | $2,863 | 36% | $5,232 | 62% |
| D8 | $13,953 | $2,876 | 21% | $11,034 | 78% |
| D10 | $24,139 | $2,967 | **12%** | **$20,544** | **89%** |

- Fixed costs plateau around $3k/month from D5 up. Almost all of a top earner's extra spending is
  flexible, and nearly all of it leaves as cash.
- **We can't say whether it's *unnecessary*.** Cash withdrawals carry no category. It could be
  luxuries, or rent and family costs paid in cash (household size isn't in the data).

**Could they cut? The data says probably yes.** Natural experiment: months where income fell below
60% of usual (12,450 account-months):
| Group | Spending that month | Next month | After two low months in a row |
| --- | ---: | ---: | ---: |
| Bottom 30% | 1.35× usual | 0.81× | 0.88× |
| Middle 40% | 0.60× | 0.59× | 0.29× |
| Top 30% | 0.56× | 0.58× | 0.33× |

Top and middle earners spend much less when money stops coming in; the bottom 30% barely can.
Caveat: some of this is mechanical. People withdraw cash after deposits arrive, so a month with no
deposit has fewer withdrawals anyway. It shows spending *can* drop, not that it's painless.

**How much cutting would rescue them (real EI cap):**
- To reach 3 months of runway, the median top-10% customer must cut **39%** of flexible spending
  (D9: 20%). For 99% of them, that's possible without touching fixed costs.
- Cut flexible spending 25% → 72% still run out within 3 months. Cut 50% → **30%**.
- Live on fixed costs plus a *median customer's* flexible spending ($5,232) → only **8.5%** run out,
  with median runway 8.2 months.

**How much is the EI cap?**
| Income replaced while laid off | Top 10% run out within 3 months | Bottom 10% |
| --- | ---: | ---: |
| Nothing (no EI) | 98.7% | 3.5% |
| Real EI cap ($3,159/month = 12% of a top earner's income) | 93.4% | 3.5% |
| Judges' rule (55%, uncapped) | 25.5% | 3.5% |

- **Currency scale:** customers' median income ($9,468/month for non-pensioners) is about 1.7× the
  Canadian average (~$5,600/month). If every amount were halved, 81% of top earners would still run
  out. The cushion gap (11.1 vs 1.6 months) is identical at any scale.

**What this changes in the story:** top earners aren't trapped. They're *unprepared*. Their risk is
the cushion, not their ability to adapt. That's good for the product: the backup plan can say
exactly how much to cut ("39% of your flexible spending gets you to 3 months"), and the goal plan
can say how to avoid needing to.

---

## 2. Is it real? Stress test [4D]
**Verdict: the headline holds in every test.** Higher earners hold fewer months of cushion, and the
buffer grows only about 22% when income doubles.

| Test | Why a judge might ask | Result |
| --- | --- | --- |
| **Measurement noise** (rank people by odd-month income, measure cushion with even-month spending) | Noisy income can fake a flat slope, and dividing by noisy spending can fake a falling ratio | Income reliability 0.85. Corrected elasticity **0.29 (95% CI 0.26–0.31)**, barely above the naive 0.24. Cushion still falls D1 8.8 → D10 1.5 months |
| **8 regions** | Is it one place? | Holds in all 8 (Spearman −0.64 to −0.74; top 20% at 1.6–1.9 months vs bottom 20% at 8.2–10.0) |
| **Account age, gender, couples, steady income only, autopay only** | Is it one group? | Holds in every subgroup (Spearman −0.66 to −0.70) |
| **5 buffer definitions** (judges' 6-month, 12-month, plateau, whole-history, lowest balance) | Is it the judges' definition? | Holds for all: elasticity 0.09–0.26. Using the *lowest* balance, top earners have just **0.5 months** |
| **Each year 2021–2025** | Is it one period? | Holds every year: elasticity 0.24–0.27, D10 cushion 1.2–1.3 months |
| **Bootstrap (1,000 resamples)** | Is it a fluke of the sample? | Top 10% cushion 1.63 months (CI 1.56–1.69) vs bottom 10% 9.03 (8.75–9.50). Top 10% EI < 3 mo with real cap: 90.2% (87.3–92.9) |
| **Thermostat by income** | Does the mechanism apply to everyone? | Present in every income quintile, and **strongest for top earners**: Spearman −0.43 vs −0.26 for the bottom. When their balance is far above usual, top earners' next month runs **−66% of income** |
| **"They keep savings at another bank"** | The obvious banker's objection | Only 25–41% of any decile ever send money to another bank, and the median share of spending is 0%. Top earners who do send money have *similar* in-bank cushions (1.84 vs 1.98 months). **Upper bound:** counting every dollar ever sent elsewhere as never-spent savings moves top earners from 1.9 to only 2.4 months (bottom 20%: 8.5 → 15.5), and 62% stay under 3 months |

What this can't rule out: savings funded from income that never touches this bank (cash kept at
home, a second job paid elsewhere). The data can't see that, and we say so (section 4.3).

---

## 3. Supporting findings for the product
These don't carry the headline, but they make the engine smarter and the advice more specific.

### 3.1 When the shock hits changes runway by about 3 months [D6]
Month-by-month simulation on EI 55% using each customer's own seasonal spending (blended 50/50 with
everyone's pattern) and no bonuses while laid off:
- **Best vs worst start month differs by 2.9 months** of runway for the median customer (4,128
  customers with a finite runway).
- Median runway by layoff month: **December 6.9**, June 7.2, January 7.4 … **February 9.2**.
- The worst start month is December (17.7% of customers), January (18.0%) or June (18.7%) for
  over half of all customers.
- A January start lands within 0.5 months of the judges' formula (median), so the formula is
  roughly a "typical month" answer that misses timing.

### 3.2 Two bonus months a year, hidden by the median [4.2]
- Money in jumps **+22% in June and +20% in December** (index vs the yearly average). That's driven by
  transfers in (+35%) and cash deposits (+20%); pensions stay flat.
- **66% of customers** get at least 10% more than their usual income in June and in December. For
  those, the median bump is **about +50%**: a 13th/14th-month-salary pattern.
- Pensioners don't get it (0.1%), so it's tied to work income.
- **Why it matters:** the judges' median income (I) ignores the bonuses. A year with two +50% months
  is about +8% more money than 12 × I says. A plan could say "bank half your June and December bonus,"
  and a job loss in May costs more than it looks (you lose the bonus too).

### 3.3 January is the riskiest month [4.3]
- Spending in January is **1.3–1.5× the yearly average, every year 2021–2025**. June is similar
  (1.35–1.5×). February is the quietest month (0.70×).
- The **lowest balance of the year falls in January for 24% of account-years**, nearly twice any
  other month (Feb 13%, Jun 13%).
- Customers *without* a December bonus spike harder in January (2.0× their median vs 1.7×). They're
  funding the holidays from savings.
- **Abstract angle:** timing is a shock multiplier. The same layoff hurts more in January (low
  balance, high spending) than in July. The engine could offer "when does the shock hit?" as a
  slider.

### 3.4 Living on the edge is a slide, not a phase [D3]
Sturdier definition: months where the lowest balance is under 25% of the account's usual income.
117 accounts are on the edge more than 25% of the time.
- **It gets worse over time.** Median edge-month share goes from 25% in the first half of their
  history to 46% in the second half. 70% got worse, 20% got better, 10% stayed the same. Typical
  unbroken edge streak: 6 months.
- **Not seasonal.** Edge months are spread evenly through the year (7.5–9.4% per month).
- **What tips someone onto the edge:** a spending spike (42% of tips, >1.3× usual) or an income
  dip (40%, <0.8× usual), roughly equally. Spending had already crept up the month before (1.08×).
- **Who they are vs everyone else:** higher income ($12,801 vs $7,491), 4× more volatile income
  (CV 0.91 vs 0.25), save only 2% vs 8%, 90% cash spending, **no labelled bills**, few standing
  orders, 39% have a loan (vs 15%), 86% have gone negative (vs 4%), rarely shared accounts (4% vs 20%),
  no pensioners. Their comfort level is only **1.1 months** of spending (vs 3.0).
- **Abstract angle:** the edge is a trap people slide into, not a bad month. That makes it a
  good thing to *detect early*: the slide shows in the data months before they hit the bottom.

### 3.5 No automatic payments → going negative, even at the same income [D4]
- 742 customers (16.5%) have no standing orders at all.
- **Controlled for income**, they go negative far more often:

| Income quarter | Ever negative, no autopay | Ever negative, has autopay |
| --- | ---: | ---: |
| Q1 (lowest) | 7.3% | 1.0% |
| Q2 | 32.4% | 2.6% |
| Q3 | 26.7% | 4.5% |
| Q4 (highest) | 28.8% | 6.2% |

- Their income is erratic: CV 0.92 vs 0.24. The top 3 months bring in 24% of all income (vs 12%),
  and they have zero-income months 4.3% of the time (vs 0.2%).
- Customers with exactly 2 standing orders: **0%** ever negative.
- Caveat: autopay is likely a *marker* of steady income, not the cause. An irregular earner can't
  commit to fixed monthly payments. For the app it doesn't matter which way it runs: it's a free,
  easy-to-see warning sign.

### 3.6 Statement frequency: mostly income, but a real overdraft signal [D5]
**What it is:** customers choose how often the bank sends an account statement: monthly (93%),
weekly (5%) or after every transaction (2%). Each statement has a fee.
- **Correction to the first survey:** most of the extra fragility was just income. Comparing customers in the same
  top-40% income band, EI < 3 mo is 19.8% (frequent) vs 16.7% (monthly), a small difference.
- **What survives:** going negative is still **2× as common** (15.3% vs 7.8%) at the same income.
  Frequent-statement customers also have 4× more volatile income, 3× as much leasing (20% vs 7%),
  a lower comfort level (1.7 vs 3.1 months), and pay about 3× the fees ($829 vs $284 lifetime).
- **Abstract angle:** checking often looks like a response to tight, irregular cash flow. They
  watch closely because they need to, and it costs them.

### 3.7 Fixed commitments (leasing, loans) double fragility [4.11]
- Customers with a **leasing** standing order (7.6%) have *bigger* buffers ($30,937 vs $21,700) but
  **twice the EI < 3 mo** (17.6% vs 9.0%). Same with loan standing orders (20.5% vs 7.6%).
- Standing orders take a median 41% of income (top 10%: 66%).
- **Abstract angle:** commitments are the opposite of a buffer. They feel safe (a car, a mortgage)
  but they're the part of spending you can't cut when income drops.

---

## 4. Data use: what we checked, cleaned and can't claim

### 4.1 Problems found in the judges' formula [3]

Each problem was tested against the data; the evidence is in `analysis/verify_formula.py`.

#### [3.1] VERIFIED — "Losing money with no shock" is mostly an artifact of medians
- **1,181 accounts (26.2%)** have median spending > median income, so the formula says they're
  losing money every month even with no shock.
- But **97.5% of them actually took in more than they spent** over their whole history, and their
  balance ended positive.
- Why: the two medians come from *different months*. Income is steady; spending comes in lumps
  (a big cash withdrawal one month, little the next). A middle spending month can be bigger than a
  middle income month even when income wins overall. Across all account-months, 39% have out > in.
- Size: the typical false gap is small (median S − I = $531), so it mostly shows up as a long but
  finite runway instead of "no shortfall."
- **Fix to present:** report the formula's answer (it's what judges expect), plus a sanity flag
  "lifetime net positive." Alternatives are a paired gap, median(out − in) month by month (fixes 63%
  of these cases), or means instead of medians.

#### [3.2] VERIFIED — EI at 55% ignores the EI maximum
- Real EI caps out at **$3,159/month** (2026). For **57.2% of customers**, 0.55 × I is above that,
  so the judges' rule gives them more EI than the government would.
- Applying the cap, the share of customers who **run out within 3 months on EI goes from 9.7%
  to 27.9%**, and median EI runway drops from **8.6 to 5.7 months**.
- The result barely moves with the exact cap ($668–$729/week gives 28.6–29.6%; the slight gap to
  27.9% is because those runs skipped the 1-decimal rounding), so it's not sensitive to the year.
- Caveat: `money_in` is deposits, not gross pay, and includes non-wage money. So "I" is not
  exactly insurable earnings. The direction (judges' rule is too generous) holds regardless.

#### [3.3] VERIFIED — EI is applied to pensioners, who can't be laid off
- 740 accounts (16.4%) live mainly on pensions, owner median age 72. A "job loss" shock cuts
  their pension to 55%, which doesn't happen in real life.
- In practice it doesn't flip anyone. Pensioners are very resilient (median EI runway 35 months,
  0% under 3 months either way) because they spend little (median S $2,381 vs I $3,530).
- **Fix to present:** in the engine, detect pension-heavy accounts and say "job-loss shock doesn't
  apply; pension continues." Fragility numbers should exclude them (non-pension EI under 3
  months: 11.6% judges' rule).

#### [3.4] VERIFIED — "Bills up 15%" does nothing for 27% of customers
- **1,225 accounts (27.2%)** have $0 median household bills. **98.2% of them never pay a labelled
  household bill in any month**, and only 13% have a household-bills standing order (vs 75% overall).
- Their spending is **99.7% cash withdrawals** (vs 59% for other customers). They almost certainly
  pay rent and utilities in cash, so the bills are invisible in the data.
- So the bills shock adds $0 to their spending and they look immune to rising bills. They aren't.
- **Fix to present:** for zero-bill accounts, estimate bills as the typical bills share of
  spending (median 19.9% for customers who do have bills), and label it as an estimate.

#### [3.5] VERIFIED — Most spending can't be classified, so "fixed vs flexible" is a guess
- 76% of money out is cash withdrawals with no purpose attached. We know how much leaves, not
  what it's for.
- This limits the plan in part 3: we can't tell a customer "cut restaurants." Plans have to work
  with what's labelled (bills, insurance, loans, standing orders) plus "discretionary cash."

#### [3.6] CHECKED — minor or not a problem
- **Loan payment P:** status C/D ("running") and start + duration past end of 2025 agree for
  all 682 loans. The rule is unambiguous.
- **Loan payouts inflating the buffer:** the loan amount doesn't land in the account (loan-month
  deposits are about 19% of the loan amount, the normal level). Not a real issue.
- **Accounts ending early:** 76 accounts have no December 2025 row (56 end in November), so their
  "last 6 months" is slightly older. Minor.
- **No short histories:** every account has at least 12 months. The 6-month buffer is always defined.
- **Negative buffers:** 23 accounts. Runway is 0 under every shock.
- **Tiny incomes:** 14 accounts with I = $0, 118 under $500. Runway math works, but plans
  should treat them as special cases.
- **The 120 cap:** with no shock, 78.7% of customers show "no shortfall (120+)." The formula only
  starts telling customers apart once a shock hits.

### 4.2 Cleaning log [5A]
| Issue | Count | What we did | Where |
| --- | ---: | --- | --- |
| Judges' formulas reproduced exactly | 4,500 | Verified on 5 accounts against an independent pure-Python recompute | `build_customer_table.py` |
| Negative buffer (B ≤ 0) | 23 | Kept; runway = 0 under every shock (judges' rule) | table |
| Zero median income | 14 | Kept; excluded from log-based elasticity (log 0 undefined) | stress test |
| Income under $500/month | 118 | Kept; flagged as special cases for plans | 3.6 |
| Pensioners (pension ≥ 50% of income) | 740 | Excluded from fragility rankings and elasticity; the engine should keep their pension during a job-loss shock | 3.3, 4D |
| $0 labelled household bills | 1,225 | Judges' rule leaves them at $0; the engine can offer an estimate (19.9% of spending), clearly labelled | 3.4 |
| First 3 months of each account ("fill-up" from $0) | all | Excluded from comfort-number, split-half and year-by-year analysis | D1, 4D |
| Partial first year (2020 opening wave) | — | Year-by-year test starts at 2021 and uses only full 12-month account-years | 4D |
| Median income vs median spending from different months | 1,181 show a shortfall (97.5% of them false) | Report judges' number as-is; month-by-month view uses real averages | 3.1 |
| EI uncapped in judges' rule | 2,574 above cap | Real cap ($729/week, 2026) available as a toggle | 3.2 |
| Accounts with no December 2025 row | 76 | Kept; their last 6 months are slightly older | 3.6 |
| Owners under 18 | 56 | Kept; flagged as a curiosity | 4.14 |
| District 69 missing 2022 values | 1 district | 2022 columns not used anywhere | — |
| Weekdays, round amounts, bank codes | — | Treated as artifacts; no findings built on them | 5 |

### 4.3 Limits: what we can't claim [5B]
- **It's 1990s Czech data**, dates shifted and amounts converted to CAD. It's a cash economy (76% of spending is cash), unlike Canada today. The *pattern* (a comfort level in dollars) is what we claim, not the exact numbers.
- **We only see one bank.** Savings funded from money that never touches this account can't be ruled out. The upper bound in 4D shows that money which *does* leave this bank can't explain it.
- **"Money in" is deposits, not salary**, so EI amounts are approximate (and the real cap makes this matter less for high earners).
- **The comfort number is observed behaviour, not proven psychology.** We show balances get pulled back to a level; we can't prove *why*.
- **Correlation, not cause**, for warning signs too (autopay is likely a marker of steady income).
- **No household size.** A high income may support more people, which would make high earners' real cushion even thinner per person.
- **Small groups for some findings:** 117 edge customers, 76 loan defaults.

### 4.4 Data artifacts: things that look generated [5]
Worth knowing so we don't build findings on them, and worth one line in the pitch for honesty.
- **Weekdays are meaningless.** Transactions are spread evenly over all 7 days (14.2–14.4% each,
  cash withdrawals included). The date shift broke the weekday pattern; no weekend effect can be studied.
- **Amounts aren't round.** Only 0.4% of cash withdrawals are whole dollars. Currency conversion
  scrambled the "$100 bills" signal.
- **Month-end credits are interest.** 43% of all credits land on the 30th or 31st. That's interest
  posting, not paydays. Main deposits land on the same day each month (97% of months, median account).
- **Partner bank codes are uniform** (458–531 standing orders each across 13 codes), so they're
  anonymized labels with no meaning.
- **Interest rate is near-uniform** at about 4.9% a year on average balance for everyone.
- **Household bills = standing orders exactly** (median ratio 1.00). "Household bills" is
  just the standing order, so customers who pay bills any other way show $0 (see [3.4]).
- **Couples are perfectly regular** (always M+F, under 10 years apart, same district), and
  retirement ages are knife-edge ([4.8]).
- **First year (2020) is partial:** January 2020 spending is near 0, because accounts were still opening.

---

## 5. Background

### 5.1 What is EI?
**Employment Insurance** is money the Government of Canada pays you for a while after you lose
your job through no fault of your own (e.g. a layoff).

- It pays **55% of your average weekly insurable earnings** (roughly: your pay before tax)...
- ...**up to a maximum of $729 a week** in 2026, about **$3,159 a month**. Earnings above
  $68,900 a year don't count.
- Regular benefits last a limited number of weeks (the judges' example uses 6 months).
- Source: [canada.ca — EI regular benefits: how much you could receive](https://www.canada.ca/en/services/benefits/ei/ei-regular-benefit/benefit-amount.html)

The judges' shortcut is "income after job loss = 0.55 × typical money in." Section 4.1 shows two
places where that shortcut breaks.

### 5.2 Key terms
| Term | Meaning |
| --- | --- |
| **Shock** | A sudden bad event: job loss, bills go up, a one-off repair |
| **I** (income) | Typical money coming into the account per month (median of `money_in`) |
| **S** (spending) | Typical money going out per month (median of `money_out`) |
| **F** (fixed costs) | Typical bills + insurance + loan payments |
| **H** (household bills) | Typical household bills (rent/utilities); the "bills go up" shock scales this |
| **B** (buffer) | Savings cushion: average daily balance over the last 6 months |
| **Gap / shortfall** | How much more goes out than comes in each month (S − I) |
| **Runway** | Months until the buffer runs out = buffer ÷ gap (capped at 120) |
| **Default** | Customer failed to repay a loan |

Runway example (account 20111): I ≈ $6,339, S ≈ $8,600, B ≈ $17,612.
On EI: income = 0.55 × 6,339 ≈ $3,487 → gap ≈ $5,113/month → 17,612 ÷ 5,113 ≈ **3.4 months**.

### 5.3 The data

Real, anonymized data from a **Czech bank in the 1990s** (the PKDD'99 Financial dataset). Dates
were shifted to 2020–2025 and amounts converted to Canadian dollars. So the "customers" are
real people, but their banking habits are 1990s Czech ones: mostly cash, few cards. That matters
for several findings below.

#### How the files connect
```
districts ──< accounts ──< transactions        (every single movement of money)
                │    ├──< monthly_summary       (transactions rolled up per month)  ← main file
                │    ├──< standing_orders       (automatic recurring payments)
                │    └──< loans                 (one per account at most, with outcome)
                └──< dispositions >── clients   (people; owner or authorized user)
                          └──< cards
```

| File | Rows | What it tells us |
| --- | ---: | --- |
| `accounts` | 4,500 | Each customer account: branch district, statement frequency, open date |
| `monthly_summary` | 185,326 | Per account per month: money in/out by type, balances, days below zero. **The judges' numbers come from here.** |
| `transactions` | 1,056,320 | Every deposit, withdrawal, payment. The detail behind the monthly summary |
| `loans` | 682 | Amount, length, monthly payment and **outcome**: A repaid, B defaulted (finished), C running OK, D running in debt |
| `clients` | 5,369 | Gender, birth date, home district |
| `dispositions` | 5,369 | Links people to accounts. More than one person = shared account |
| `cards` | 892 | Card type: junior, classic, gold |
| `standing_orders` | 6,471 | Automatic payments (bills, insurance, leasing, loans). Snapshot at end of data, no dates |
| `districts` | 77 | Average salary, unemployment, urbanization, crime per region |

#### What a typical customer looks like
- Median income **$7,568/month** (middle half: $3,380–$13,280).
- **Cash dominates.** About 99% of money in arrives as cash deposits, and **76% of all money out
  is cash withdrawals.** Labelled bills are only 16.5% of spending; insurance, loans, card
  payments and fees together are about 3%.
- **740 accounts (16%) are pensioners.** Pension is at least half of their money in, and the owner's
  median age is 72 (vs 39 for everyone else).
- Loans: 682 accounts. 403 running OK, 203 repaid, 45 running in debt, 31 defaulted.
  **76 defaults overall (11.1%).**

---

## 6. Other findings from the broad survey
Not part of the headline. Kept for questions and possible future angles.

### Where you live barely matters [4.4]
- Region medians are tightly bunched: income $6,860–$8,142, buffer $20,597–$23,412.
- Across the 77 districts, customers' income, buffer and runway have essentially **no correlation**
  with district average salary (−0.11), unemployment (+0.16), urbanization (−0.23) or crime (−0.06).
- **Within one district, incomes vary about 4× more than between districts** (spread $7,388 vs $1,882).
- Customers earn about 1.34× their district's average salary, so the bank skews toward better-off locals.
- The bank reaches more people in poorer and more rural districts (2.3–11.2 customers per 10k inhabitants).
- **Abstract angle:** "postcode isn't destiny." A resilience score should use a person's own
  cash flow, not their neighbourhood. That's a fairness point for lending too.

### Retirees are the safest group [4.7]
- 740 pensioners (16%, median age 72): median EI runway **35 months**, 0% under 3 months.
- They spend well below income (S $2,381 vs I $3,530) and hold 6× their monthly spending.
- 330 customers get an *identical* biggest deposit every month (amount varies under 2%). 71% are
  pensioners and they're the steadiest of all (runway 39 months).

### Women stop working about 4 years earlier [4.8]
- The share of people on pension jumps sharply: **women at 59–60** (26% at 59, 81% at 60, 100% at 61);
  **men at 64** (0% at 63, 95% at 64).
- Result: women aged 55–64 have median income **$5,328 vs $9,100** for men in the same band.
  Under 25 it's reversed (women $6,887, men $5,137).
- Overall the genders look identical (income $7,565 vs $7,585), which hides the late-career gap.
- Caveat: the knife-edge cutoffs suggest the age shift applied a rule, so check before claiming it's
  real-world behaviour. (The 1990s Czech pension system did have earlier retirement for women.)

### Cards are cash tools [4.9]
- Card holders spend **79% of their money as cash withdrawals vs 62%** for non-holders. Card
  *payments* are under 1% of all spending.
- Card holders earn 2–2.6× more (classic $13,711, gold $14,996, none $5,758). Gold holders hold the
  biggest buffers ($48,894).
- Classic card holders are fragile under the real cap (40.8% EI < 3 mo vs 25.4% without a card).
- Junior cards go to ages 12.6–20.9 (median 18.4). Cards are issued a median 1.8 years after opening.
- Older customers use less cash (48% of spending at 65+, vs 82% under 25), because they pay bills
  through the bank.

### Couples protect the bottom of the income ladder [4.10]
- 869 shared accounts (19%). Slightly lower income than single accounts but slightly safer overall
  (EI < 3 mo 8.6% vs 9.9%).
- At the lowest income quarter, shared accounts last **51 months on EI vs 37** for single. At the
  higher quarters there's no difference.
- Every shared account is one man + one woman, under 10 years apart in age, same home district.
  That's real couples, or a very regular generator (see 5).

### Balances mostly grow; new accounts fill up in 3 months [4.13]
- 73% of accounts had a rising balance over their last 12 months. Median growth is 5.5% of monthly
  income per month.
- Three groups: **building** (2,340): EI < 3 mo 2.7%. **Flat** (1,516, high earners): 17.6%.
  **Draining** (630): 16.5%.
- A new account's average balance goes $566 → $8.5k → $17.8k → $21.8k over months 0–3, then stays
  around $19–24k for years. People seem to have a "comfortable balance" they top up to.
- Per active account, yearly spending rose from $7.2k (2020) to $10.9k (2025). Balances rose from
  $17.7k to $24.1k.

### Minors with $22k buffers [4.14]
- 56 account owners are under 18 (youngest 16.1). Median income $1,600 but median buffer $21,873.
  That looks like parent-funded savings accounts.
- Under-25s overall hold 4.1 months of spending, the most of any working-age group.

### Loans (parked) [6]
Early look, not pursued further yet: 682 loans, 76 defaults (11.1%). Using only data from before the
loan was approved, none of the 606 repayers ever went below zero, while 27 of the 76 defaulters already had.
Low pre-loan buffer (bottom quarter) defaults 25.1% vs 4.7% at the top. Runway alone predicts
poorly: customers marked "no shortfall" defaulted at 17.3%. Small samples, so not robustness-tested.

### Superseded
Early versions of 4.5, 4.6 and 4.12 are replaced by the deeper versions in 3.4–3.6 (D3–D5).
One correction: most of statement frequency's apparent fragility was just income (D5).

---

## 7. Reproduce: files and run order
| File | What it does |
| --- | --- |
| `build_customer_table.py` | One row per account: judges' metrics, shocks, pre-loan metrics, context → `output/customers.csv` |
| `analysis/verify_formula.py` | Tests the formula problems in 4.1 → `output/customers_checks.csv` |
| `analysis/explore_*.py` | Broad survey: people, places, behaviour, time, follow-ups (sections 3 and 6) |
| `analysis/deep_plateau.py` | Comfort-number test, buffer elasticity, fragility gap [D1, D2] → `output/customers_plateau.csv` |
| `analysis/deep_edge.py` | Edge group, autopay, statement frequency [D3–D5] → `output/customers_edge.csv` |
| `analysis/stress_headline.py` | Stress test + savings-elsewhere check (section 2) |
| `analysis/deep_topearners.py` | Why top earners run out: spending mix, income-drop natural experiment, cuts needed, EI-cap and scale sensitivity [D8] |
| `build_app_data.py` | Seasonal factors, bonus %, timing simulation [D6] → `output/timing_by_start_month.csv` (also writes data for the throwaway prototype in `app/`) |
| `build_chart_data.py` | Chart data → `charts/charts.js` |
| `charts/index.html` | The four headline charts |

Run order (from the repo root, with `.venv`):
```
python build_customer_table.py
cd analysis && python verify_formula.py && python explore_behaviour.py && python explore_time.py \
  && python deep_plateau.py && python deep_edge.py && python stress_headline.py && cd ..
python build_app_data.py && python build_chart_data.py
```
`app/` holds an early throwaway prototype; the real app will be built separately.

Verification: account 20111 and 4 random accounts match an independent pure-Python recompute of
the judges' formulas exactly.

## Sources
- PKDD'99 Discovery Challenge Financial dataset, CTU Prague: https://relational.fel.cvut.cz/dataset/Financial
- EI benefit rate and 2026 maximum: https://www.canada.ca/en/services/benefits/ei/ei-regular-benefit/benefit-amount.html
