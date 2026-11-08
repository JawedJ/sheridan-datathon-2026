# Full Report — what we found, what we did with the data, and why

This report is written so you can understand and defend every part of the project in front of the
judges. It explains in plain language what we found, exactly how we used the data, where and why we
go beyond the organizers' formulas, how we cleaned the data, what we can't claim, and how to answer
the questions judges are most likely to ask.

Companion files: `docs/REFERENCE.md` (every number, numbered), `docs/HONESTY.md` (every rule and
every data choice, labelled), `FINDINGS.md` (technical write-up), `docs/PITCH.md` (pitch script).

---

## Part 1 — The story in one minute

We looked at 4,500 real bank customers and found something backwards: **the more people earn, the
more fragile they are.** The lowest-earning 10% have about 11 months of their spending saved. The
highest-earning 10% have about 1.6 months.

The reason is how people treat their bank balance. It behaves like a **thermostat**: when the
balance climbs above a customer's usual level, they spend the extra the following month, and when
it drops below, they tighten up. That usual level, which we call the **comfort number**, is a dollar
amount that barely grows with income. Doubling someone's income only raises their savings by about
22%. So people save to a *dollar* number, not to a *number of months*, and the more you earn and
spend, the fewer months that dollar number covers.

Under real Canadian EI rules, where benefits are capped at $729 a week, 93% of the highest earners
would run out of savings within 3 months of a layoff if their spending stayed the same. The
official formula, which has no cap, says 26%.

Our engine shows each customer's numbers exactly as the judges define them, shows what changes
under real-world rules, and gives a plan built around the comfort number: instead of "spend less,"
set up an automatic transfer so money above the comfort number goes into savings before it gets
spent.

---

## Part 2 — The data, and what it can and can't tell us

### What it is
The dataset is real, anonymized data from a **Czech bank in the 1990s**: the PKDD'99 Discovery
Challenge "Financial" dataset from CTU Prague. Tangerine prepared it for the hackathon by shifting
the dates to 2020–2025 and converting amounts to Canadian dollars. It covers 4,500 accounts, about
1.06 million transactions, 682 loans, 5,369 people, 892 cards, 6,471 standing orders (automatic
payments) and 77 districts.

The file the judges' formulas use is `monthly_summary.csv`: one row per account per month, listing
money in (split into cash deposits, transfers, pensions and interest), money out (split into
household bills, insurance, loan payments, bank fees, cash withdrawals, card payments and other
transfers), and balances (end of month, lowest, average daily, days below zero).

### What a typical customer looks like
The typical customer deposits about $7,568 a month. Almost all money comes in as cash deposits, and
**76% of all money going out is cash withdrawals with no label saying what it was for.** Only 16.5%
of spending is labelled household bills. 740 customers (16%) are pensioners, with a median age of 72.
869 accounts are shared by two people. Customers earn about 1.6× the Canadian average
($5,870/month in August 2026, Statistics Canada) and about 1.34× their own district's average salary.

### What's missing from the data (and why it matters)
This shapes almost every decision we made, so it's worth knowing well:

1. **No salary.** The data has deposits, not pay stubs. "Income" means money deposited. That's how
   the judges define it, and it's the only measure available.
2. **No spending categories for cash.** 76% of spending is cash withdrawals. We know how much left
   the account, not whether it went to rent, groceries or a holiday.
3. **Some customers' bills are invisible.** 1,225 customers (27%) show $0 household bills because
   they pay their bills in cash. The data simply never records them.
4. **No household size.** A $25,000/month income might support one person or six.
5. **Only one bank.** If a customer keeps savings elsewhere, we can't see it directly.
6. **Some patterns are artifacts of the preparation.** Weekdays are meaningless (activity is spread
   evenly over all seven days because the dates were shifted), amounts aren't round (because of
   currency conversion), bank codes are uniform labels, and retirement ages and couples are
   unusually regular. We built no findings on any of these.

---

## Part 3 — How we follow the judges' rules

The brief gives exact definitions so that teams' numbers can be checked against an answer key: (all six are shown in section 1 of the app, each labelled with the judges' letter: I, S, F, H, B, P; H shows "not recorded in the data" when it's $0):

| Number | Judges' definition |
| --- | --- |
| Typical monthly money in (I) | Median of `money_in` |
| Typical fixed costs (F) | Median of household bills + insurance + loan payments |
| Typical monthly spending (S) | Median of `money_out` |
| Buffer (B) | Average of `avg_daily_balance` over the last 6 months |
| Household bills (H) | Median of `household_bills` |
| Loan payment (P) | Monthly payment if the loan is still running at the end of 2025, else 0 |
| Runway | (B − one-off costs) ÷ (spending after shock − income after shock); 0 if no buffer left; "no shortfall (120+)" if income covers spending; capped at 120; rounded to 1 decimal |

Shocks as the judges define them: job loss with EI = income becomes 0.55 × I; bills up 15% =
spending becomes S + 0.15 × H; a one-off cost (like a furnace costing a month of spending) is
subtracted from B.

**We follow these exactly.** The "Official formula" column in the app is the judges' calculation
and nothing else. We proved it: an automated check compares the app against the same formulas
computed independently in Python, for all 4,500 accounts and five standard shocks (no shock, EI,
furnace, EI + bills, bills). That's 49,500 comparisons and **zero mismatches**, exact to the decimal.

Two technical details came up while doing this:
- At first, 13 of the 49,500 runways differed by 0.1. The cause was that we had rounded the app's
  input data to the cent, which flipped results sitting exactly on a rounding boundary. We now use
  full precision.
- We also made the app round the way Python does (exact halves go to the even digit), since the
  judges likely calculate in Python. This didn't change any result.

---

## Part 4 — Where we go beyond the judges' rules, and why

The brief explicitly allows this: *"You can use your own definitions instead. If your numbers differ
from these, be ready to explain why."* Our rule: **the official number is always shown first and
never changed.** Anything extra is shown next to it, labelled, and explained on screen.

### 4.0 Shocks beyond the brief's examples
The brief says a shock "changes income or spending" and gives a bills rule (spending = S + x% × H).
Twist cards could also name costs that aren't household bills, so the engine adds one more spending
input, used in both columns the same way: **other spending**, either $ per month (childcare, a car
payment, rent up by a dollar amount) or a % of all usual spending (inflation). Spending = S + x% × H
+ other. It is 0 for all of the brief's own cards, so the official answers don't change (49,500
checks still match). Dollar increases are added straight to spending, so "rent up $300" also works
for the 1,225 customers whose bills aren't recorded. Still not modelled, and shown as "Not included":
a partner's job loss (their share of income is unknown), a % rise in one category like groceries
(its amount is unknown), EI running out, and good news.

### 4.1 The "Real-world rules" column
Next to the official runway, the app shows a second runway that applies real Canadian policy to the
judges' own numbers. Only two things differ:

**(a) The EI maximum, for job losses only.** Real EI pays 55% of insurable earnings, but never more
than $729 a week ($3,159 a month) in 2026 (Government of Canada, canada.ca). The judges' rule has no
cap. 57% of customers would be paid more than the government actually pays under the judges' rule.
- *Why it matters:* for a top earner with $21,513/month income, the official formula assumes
  $11,832/month of EI; real EI would pay $3,159. Account 71293's runway drops from 6.2 to 2.8 months.
- *Only for layoffs:* EI only applies after a job loss. If a scenario is a plain income drop
  (e.g. "income drops 30%" from reduced hours), the cap doesn't apply. An earlier version capped
  every income drop, which wrongly showed account 71293 at 2.8 months instead of 11.0 for a 30% pay
  cut. We fixed that.
- *Income is deposits:* EI is based on pay, and our income is deposits. That's the judges' own
  definition and the only income measure in the data, so we use it as is.

**(b) Pensions keep paying.** 740 customers live mainly on pensions. The judges' job-loss shock
would cut their pension to 55%, which can't happen in real life. In the real-world column only the
non-pension part of their income drops. (The pension portion is estimated as their income × the
share of their lifetime deposits that were pensions.) In practice this changes nobody's verdict;
pensioners are the safest group anyway.

**What the real-world column does *not* do:** it doesn't invent missing data. An earlier version
estimated bills for customers whose bills aren't recorded (19.9% of their spending). We removed it,
because that number didn't exist in the data. Now, if you apply a bills shock to one of those
1,225 customers, the app says: *"This customer's bills aren't recorded in the data (they pay in
cash), so a bills increase can't be measured for them."*

### 4.2 The comfort number (a new measure we created)
**Definition:** the median of the customer's month-end balances, skipping their first three months
(when a new account is still filling up from $0). In plain words: where their balance usually sits.
It's purely calculated from the data, with no assumptions. The app also shows their **cushion**
(buffer ÷ spending, in months) and how that compares to people at the same income level.

### 4.3 Seasonal spending (used in the plan chart)
The judges' formula assumes every month is the same. Real spending isn't: across all customers,
January spending runs about 45% above average and June about 39% above, while February runs 30%
below. Two-thirds of customers also receive roughly 50% more money in June and December. That
looks like a bonus, but the data doesn't label it, so the app doesn't use it (removed as guesswork).

The separate month-by-month chart under section 2 was removed for a cleaner screen; the same month-by-month model now drives only the plan chart ("What the plan changes"):
- spending each month = S × a seasonal factor. The factor is 50% the customer's own pattern and
  50% everyone's, so one unusual January doesn't dominate. That blend is our choice.
- during the shock, income is the real-world shock income; afterwards it returns to I.

This is extra context, not a replacement for the runway number. One limitation to know: it uses
the median spending S, so for the 26% of customers where median spending is above median income
(see 6.1), the no-shock path drifts downward even though they don't really lose money.

### 4.4 The plans (part 3 of the brief)
The brief asks for *"a goal plan, like building an emergency fund, and a backup plan for if the
shock hits, both based on their own numbers."*

**Goal plan = before anything goes wrong.**
- Target: 3 months of their typical spending (3 × S), a standard emergency-fund rule of thumb.
- How: an automatic monthly transfer equal to their usual surplus (average money in minus average
  money out over their history). If they have almost no surplus (under 2% of income), the plan
  suggests trimming 10% of their non-essential spending instead.
- The comfort-number message: *their balance settles around $X and extra money gets spent, so an
  automatic transfer raises that level without relying on willpower.* This comes directly from our
  main finding.

**Backup plan = after the shock has happened.** What they can do to make their savings last.
- The problem: to say "cut spending," we need to know which spending is cuttable, and the data
  can't tell us (76% is unlabelled cash). An earlier version treated *all* unlabelled spending as
  cuttable and produced advice like "cut 97% of your spending," which meant giving up food.
- The fix: we protect basic needs using an official source. Statistics Canada's Survey of
  Household Spending 2023 (Table 11-10-0222-01) shows the average Canadian household spends
  $48,600 of $76,146 (**63.8%**) on basic needs: food from stores $8,579, main home (rent or
  mortgage, utilities, property tax, upkeep) $22,226, transportation $12,019, health care $3,060,
  clothing $2,716. Restaurants, recreation and similar are not counted as basic.
- Rule: protected spending = whichever is larger, their labelled bills/insurance/loans or 63.8%
  of their spending. Everything above that is "non-essential," the most they could cut.
- The plan says how much of the non-essential part to cut to get through the shock (at least
  3 months, or the shock length for a layoff). If cutting *all* non-essential spending still isn't
  enough, it says so plainly and shows the best it can do. Account 71293 (layoff + rent up 15%):
  *"Cutting spending alone won't get them through 6 months. Even cutting all non-essential spending
  only stretches savings to 4.3 months. They'd need extra income or help."*
- Honest limit, stated in the app: 63.8% is a national average, not this customer's actual
  spending, and it comes from Canadian data while the customers are from a 1990s Czech bank.

**How the plan appears.** The goal plan always shows: the brief describes it as "a goal plan, like building an emergency fund", for normal times, and building the cushion before a shock is our headline. The backup plan ("for if the shock hits"), the plan text and the outcome chart appear once a scenario is run. The plan section opens with the
plan in plain words, written automatically: a template version appears instantly, then Google's
Gemini (gemini-3.5-flash-lite) rewords it a second or two later. Gemini only rewords our template
text; it never sees raw data to interpret. Its reply is only used if it finished cleanly, reads as a
plain letter, and every number in it already appears in our text. Otherwise (or if Google's quota is
used up) the template stays, and a small note says which wording is showing. We tightened this after
Gemini, given raw numbers, misdescribed a furnace as an income shock and quoted savings before the
one-off cost.

**Layout (simplified Nov 7).** The plan reads top to bottom: a 2-3 sentence summary (where they stand, what gets them through, what to do now); four outcome tiles; two step cards, each built around one action number (Step 1, before a shock: $X/month into savings with a progress bar; Step 2, if it hits: $Y/month less spending, with bars showing how far each level of cutting gets them against the months needed); then the chart. The June/December "bonus" boost was removed (the extra income is unlabelled, so calling it a bonus was guesswork).

**What the plan changes (chart).** Four outcomes for the same scenario, as tiles and a 24-month
balance chart: no plan; backup plan (cut the needed share of non-essential spending during the
shock); goal plan first (start the shock with 3 months saved); both. Tiles use the same runway
formula as everywhere else; the chart adds the customer's seasonal spending. For a high earner like
71293 no single plan is enough (2.8 / 5.0 / 3.6 months against 6 needed), but both together are
(6.3), which is the headline in one picture: build the cushion before the shock.

### 4.5 The plain-words scenario box
Judges read a twist card; we type it in. **Gemini reads it** and fills a fixed set of fields (a JSON
schema): account, income during the shock (% of usual), whether EI rules apply (layoff, sickness,
parental leave), how long, bills/rent increase (% or $/month), one-off cost ($ or months of spending),
start month, any defaults it applied, and anything the engine can't model. Our code then range-checks
every value and builds the **"Understood as: …"** pills from what is actually applied, so nothing
happens silently. Defaults come from the brief's own examples (job loss without a % → EI at 55%;
furnace without an amount → one month of spending; no length → 6 months) and are shown as
"Assumed: …". Things the engine can't model (inflation on all spending, a partner's job loss, good
news) are shown as **"Not included"** instead of being guessed. Every setting can still be changed
with the sliders.

*Why Gemini and not a script:* we first used a word-pattern script. Tested on 25 different phrasings
it missed 9 completely ("income cut in half", "a 20% pay cut", "bills double") and misread one
silently ("lose 40% of their income" read as *to* 40%). Gemini read all 14 test phrasings it answered
correctly, including those. *Reliability:* on the free tier Google is often busy (about half of
requests timed out in testing, 7–19 s when they worked) and the stronger models allow 20 requests a
day. Billing goes on before judging; the model list is one Vercel setting (`GEMINI_PARSE_MODELS`). If
Gemini can't answer, the page says so and the previous results stay, labelled as such.

### 4.6 Choices in our analysis (not the app)
- **Pensioners are left out of income comparisons** (the headline numbers, charts, elasticity),
  because a job-loss shock doesn't apply to them. This is stated wherever those numbers appear.
- **The first three months of every account are skipped** when measuring the comfort number and
  the thermostat, because accounts start at $0 and fill up.
- **The layoff-timing chart** uses the 3,547 non-pensioners whose savings would run out within
  10 years for every possible start month (people with no shortfall at all can't be compared).

---

## Part 5 — How we cleaned the data

**First principle: we never edit the raw files.** Every change is a calculation in code that anyone
can rerun.

**Second principle: we don't fill gaps with guesses.** When the data can't answer something, we say
so instead of inventing a number (see the bills decision in 4.1).

What we did with each awkward case:
| Case | Count | What we did | Why |
| --- | ---: | --- | --- |
| Buffer at or below $0 | 23 | Kept; runway = 0 under every shock | That's the judges' rule |
| Zero typical income | 14 | Kept; left out only of the income-vs-savings slope (log of 0 is undefined) | They're real customers a judge could pick |
| Income under $500/month | 118 | Kept | Real customers |
| Pensioners | 740 | Kept in the app; left out of income comparisons | A layoff can't stop a pension |
| $0 recorded bills | 1,225 | Kept; no bills estimate; limitation shown on screen | Their bills almost certainly exist and are most likely paid in cash out of their withdrawals: they spend as much as customers with bills, but 96% of it leaves as cash. 158 of them even pay a bills standing order every month, but the bank didn't tag those payments as bills. Also affects: their fixed costs (F) show about $0; the "no autopay" warning sign (94% of no-autopay customers are in this group). Doesn't affect runway (cash-paid bills are already inside spending S) or the headline, which holds within each group |
| First 3 months of each account | all | Skipped for comfort number and thermostat | Accounts fill up from $0 |
| 2020 (partial first year) | — | Year-by-year checks use 2021–2025 only, full years only | Accounts were still opening |
| Accounts without a December 2025 row | 76 | Kept | Their "last 6 months" is just slightly older |
| Owners under 18 | 56 | Kept, noted as a curiosity | Likely parent-funded savings accounts |
| District 69 missing 2022 values | 1 district | Those columns not used | — |
| Weekdays, round numbers, bank codes | — | No findings built on them | They look generated by the data preparation |

We **did not** remove any customers from the engine. The judges can pick any account ID, so every
account has to work.

---

## Part 6 — Problems we found in the official formula

We didn't change the official formula. We investigated where it could mislead, so we can answer
questions about it and show judges we understand it.

### 6.1 The median quirk
1,181 customers (26%) have median spending above median income, so the formula says they lose money
every month even with no shock. But 97.5% of them actually took in more than they spent over their
whole history. The reason: the two medians come from different months, and spending is lumpy (a big
cash withdrawal one month, little the next). Across all account-months, 39% have more going out than
coming in. The typical false gap is small ($531/month), so it mostly shows up as a long-but-finite
runway. *We report the official number anyway; it's the definition.*

### 6.2 The EI cap is missing
Covered in 4.1. Across everyone, applying the real cap raises the share who run out within 3 months
of a layoff from 9.7% to 27.9%, and drops the median runway from 8.6 to 5.7 months.

### 6.3 Pensioners get a job-loss shock
Covered in 4.1.

### 6.4 The bills shock does nothing for 27% of customers
1,225 customers have $0 median household bills; 98% never pay a labelled bill at all, and 99.7% of
their spending is cash. Household bills in this data turn out to be exactly the automatic payments
(standing orders), so anyone paying bills another way shows $0. "Bills up 15%" adds nothing for them.

### 6.5 Most spending can't be classified
76% of money out is unlabelled cash. This is why the backup plan needs the Statistics Canada
basic-needs share (4.4).

### 6.6 Checks that turned out fine
The "loan still running" rule is unambiguous (status and dates agree for all 682 loans). Loan
payouts don't inflate buffers. Every account has at least 12 months of history. With no shock, 79%
of customers show "no shortfall"; the formula only starts separating people once a shock hits.

---

## Part 7 — What we found

### 7.1 The headline: higher earners hold fewer months of savings
Non-pensioners, split into ten equal income groups (376 people each):

| | Lowest 10% | Highest 10% |
| --- | ---: | ---: |
| Typical income | $1,186/mo | $26,568/mo |
| Where their balance settles | $14,272 | $33,414 |
| 3 months of their spending | $3,835 | $72,418 |
| Months of spending saved | **11.1** | **1.6** |
| Run out within 3 months of a layoff: official rule | 3.5% | 25.5% |
| Run out within 3 months of a layoff: real EI cap | 3.5% | **93.4%** |

Income rises about 22× from the bottom group to the top, but the comfort number only rises about
2.3×. The two lines cross at around $7,000/month of income: below that, people's savings cover 3
months; above it, the gap widens fast.

### 7.2 The mechanism: the thermostat
We measured, for every account and month, how far the balance sat above or below the account's
usual level, and what happened to money in minus money out the following month:

| Balance this month | Next month (share of usual monthly income) |
| --- | ---: |
| Far below usual | +34% (saving) |
| Below usual | +20% |
| Near usual | +4% |
| Above usual | −5% |
| Far above usual | −19% (spending it down) |

When a balance is far above usual, the next month's cash withdrawals are 1.67× normal, and there's a
36% chance of a big withdrawal (more than double normal), vs 10.5% when the balance is below usual.
The money leaves as cash spending, not as transfers to other accounts.

*Is it real or a statistical artifact?* Measuring against a median automatically creates some of
this pattern, so we built a comparison: shuffle the order of each account's monthly flows (keeping
the same amounts) and measure again. Real data: correlation −0.30. Shuffled: about −0.20. The real
pull back toward the usual level is clearly stronger than chance.

*A stricter version (verification pass):* the −0.20 in the shuffled data happens because "usual"
was the account's whole-history median, which quietly uses the future. Measuring "usual" from the
previous 6 months only fixes that: shuffled data drops to −0.01, real data stays at −0.23. One
honest caveat: the pull is fast. If we skip a month, it's only −0.07, so part of the one-month
effect may be timing (cash deposited at the end of one month and spent early the next).

### 7.2a The cleanest proof: windfalls drain back
Correlations can be argued with, so we ran a direct test. We found 5,747 "windfall" months (net
inflow of at least one month's usual income, typically 2.8×, almost all cash deposits; loans are
not paid into the account) and tracked how much was still there later.

| Share of the windfall still in the account | after 1 month | 3 months | 6 months |
| --- | ---: | ---: | ---: |
| Bottom 20% of earners | 79% | 65% | 67% |
| Top 20% of earners | 43% | 24% | 29% |
| Everyone | 62% | 44% | 45% |
| If there were no set point (same account's own flows, random order) | 100% | 108% | 115% |

Without a set point the windfall would stay and keep growing. Instead more than half drains away
within 3 months and then levels off: the balance settles back near its old level. Top earners
spend about three of every four windfall dollars within 3 months. This is the mechanism, measured
a second, independent way.

*It's strongest for top earners:* when their balance is far above usual, the top 20% of earners
spend down two-thirds of a month's income the next month (−66%), vs −27% for the bottom 20%.

### 7.3 Why it hits high earners: dollars, not months
- The "elasticity" of savings to income is **0.29**: double the income and savings rise only ×1.22.
  Below $5,000/month income it's almost flat; nearly everyone keeps about $13,000.
- Top earners' extra spending isn't fixed costs. Labelled bills plateau around $3,000/month from the
  middle of the income range up. A top earner spends $24,139/month, of which only $2,967 is labelled
  bills; 89% leaves as cash. (41% of top earners have no recorded bills, which pulls that down; for
  those whose bills are recorded, fixed costs are $4,974, still only about a fifth of spending.)
- We ruled out "pass-through accounts" (money just passing through to another bank): top earners'
  money comes in as cash deposits and leaves as cash withdrawals; almost nothing goes to other banks.

### 7.4 Could top earners just cut back? (important nuance)
- Under the real EI cap, 93% of top earners run out within 3 months **if their spending doesn't change.**
- With basic needs protected (Statistics Canada, 63.8% of spending), only 36% of a top earner's
  spending is non-essential. Cutting half of it, 79% still run out within 3 months. Cutting all of
  it, 43% still run out. The median top earner would need to cut 91% of their non-essential spending.
- Natural experiment: in months where income really dropped below 60% of usual, top earners'
  spending fell to about 0.56× normal. That shows spending *can* drop, though part of it is
  mechanical (cash is withdrawn after deposits arrive).
- **Note:** an earlier version of this analysis treated all cash as cuttable and said "cutting half
  brings 93% down to 30%." That claim is superseded by the basic-needs version above and has been
  replaced everywhere (README, pitch, findings page).

### 7.5 Is it robust? The stress tests
| Test | What it rules out | Result |
| --- | --- | --- |
| Measurement noise | Noisy income can fake a flat slope | Rank people by income from odd months, measure from even months: elasticity 0.29 (95% range 0.26–0.31); top group still 1.5 months vs 8.8 |
| All 8 regions | "It's one place" | Holds everywhere |
| Account age, gender, couples vs singles, steady income only, autopay only | "It's one group" | Holds in every group |
| Five definitions of savings | "It's the judges' buffer definition" | Holds for all; using the lowest balance, top earners have just 0.5 months |
| Each year 2021–2025 | "It's one period" | Holds every year |
| 1,000 random resamples | "It's luck" | Top 10%: 1.63 months (1.56–1.69) vs bottom 10%: 9.03 (8.75–9.50) |
| Savings at another bank | The obvious banker's objection | Even counting every dollar ever sent to another bank as savings, top earners only go from 1.9 to 2.4 months, and 62% stay under 3 months |
| Currency scale | "Amounts are inflated" | Halving every amount, 81% of top earners still run out; the months-saved gap is identical at any scale |
| Hold-out (split accounts 50/50 at random, 3 times) | "You tried lots of angles and found noise" | All 6 halves: top 10% 1.6–1.7 months, bottom 10% 8.8–9.9, elasticity 0.25–0.26, 92–95% run out on real EI |
| Cash re-deposits | "Income is inflated by people withdrawing and re-depositing cash" | Only 0.5–3.6% of deposits look like re-deposits; removing them changes nothing that matters (1.6 → 1.7 months) |
| Salary-like income only (≥80% arrives by transfer) | "Cash deposits aren't real income" | The effect gets *stronger*: Spearman −0.80, top 10% 1.5 months |
| Basic needs for the richest households (StatCan 60.6% vs 63.8%) | "Rich people spend less on basics" | Cutting all non-essential: 37.5% still run out instead of 43% |
| Seasonal pattern by year | "The timing finding is overfit" | Same pattern every year (January 1.6×, June 1.5×, February 0.7×); correlation between 2021–23 and 2024–25: 0.99 |

### 7.6 Supporting findings (used in the product)
- **Layoff timing matters.** Median runway by the month the layoff starts: January 6.1 months
  (worst), February 7.8 (best). The median customer's best and worst months differ by 2.7 months.
  January, June and December are the worst months for over half of customers.
- **Extra June and December income.** 66% of customers receive about +50% more money in June and
  December. We don't know what it is (no label), so it's a finding only; the app doesn't use it.
- **January is the riskiest month.** Spending runs 1.3–1.5× normal every January, and the lowest
  balance of the year falls in January for 24% of account-years.
- **Living on the edge is a slide, not a phase.** 117 customers spend more than a quarter of their
  months near zero. For 70% of them it gets worse over time (25% of months → 46%). It's triggered
  about equally by spending spikes and income dips.
- **No automatic payments → going negative.** At the same income level, customers with no standing
  orders go below zero 5–12× as often. Customers with exactly two standing orders: 0%. Likely a
  sign of irregular income, not the cause.
- **Statement frequency.** Customers who choose weekly or per-transaction statements looked fragile,
  but that was mostly their higher income. What survives: they go negative twice as often at the
  same income, and pay about 3× the fees.

### 7.7 Other findings (background, not in the pitch)
Where you live barely matters (incomes vary 4× more *within* a district than between districts).
Retirees are the safest group (median 35 months on EI). Women's pension age is about 4 years earlier
than men's in this data (probably a rule in how the data was generated). Card holders actually use
*more* cash. Couples protect the lowest earners (51 vs 37 months). Balances mostly grow; new accounts
fill up in about 3 months, then plateau.

### 7.8 Loans (deliberately parked)
Our first lead was loan defaults: none of the 606 customers who repaid ever went below zero, while
27 of the 76 who defaulted were already negative before the loan was approved. We parked it because
loan-default prediction is the most-studied use of this famous dataset, so it's unlikely to be
original, and the sample is small.

---

## Part 8 — What we can't claim (limits)
1. It's 1990s Czech data with amounts converted to CAD, from a cash economy. We claim the
   *pattern* (a comfort level set in dollars), not the exact dollar amounts.
2. We only see one bank. Savings funded by money that never touches this account can't be ruled
   out (though money that *does* leave this bank can't explain the finding).
3. The comfort number and thermostat are observed behaviour. We show balances get pulled back to a
   level; we can't prove *why* people do it.
4. Warning signs (no autopay, frequent statements) are correlations, not causes.
5. No household size: a high income may support more people, which would make high earners' real
   cushion even thinner per person.
6. We can't see what cash was spent on; the backup plan uses a Canadian national average.
   About 41% of top earners' spending is big cash withdrawals. They look like rent or bills paid in
   cash (they recur at similar amounts, mid-month, more often when no bills are recorded), but we
   can't prove none of it was saved at home. In the extreme case where a full year of them was
   saved, top earners would hold 7.3 months. This is the biggest limit, and we say it plainly.
7. Some groups are small (117 edge customers, 76 loan defaults).

---

## Part 9 — Questions judges are likely to ask, with answers

**"Do your numbers match ours?"**
Yes, exactly. The "Official formula" column uses your definitions, and we checked it against an
independent calculation for all 4,500 accounts and five standard shocks: 49,500 checks, zero
mismatches.

**"Why is there a second runway number?"**
The brief invites our own definitions if we can explain them. The second column applies two real
policies to your numbers: EI is capped at $729 a week for layoffs, and pensions keep paying. It
never invents data. The official number is always shown first.

**"Isn't it obvious that richer people have fewer months saved, since they spend more?"**
Only if savings stayed flat, and they could easily grow with income. We measured it: doubling
income raises savings just 22%, even after correcting for measurement noise. And we found *why*:
the thermostat. Money above a customer's usual balance is spent the next month.

**"How do you know the thermostat isn't a statistical artifact?"**
Two ways. First, a correlation measured carefully: comparing each balance only to its *previous* 6
months, shuffled data shows nothing (−0.01) and the real data shows −0.23. Second, a direct test:
after a windfall, accounts keep only 45% of it six months later, while with no set point they'd
keep all of it. Top earners keep 29%. Two different methods, same answer.

**"You tested a lot of things. Isn't one of them bound to look significant?"**
We split the accounts 50/50 at random, three times, and re-ran the headline on each half. All six
halves give the same answer: top earners 1.6–1.7 months, bottom earners 8.8–9.9.

**"Maybe high earners keep their savings at another bank."**
We tested the worst case: counting every dollar ever sent to another bank as savings that were
never spent. Top earners only go from 1.9 to 2.4 months, and 62% stay under 3 months. What we can't
see is money that never touches this bank, and we say so.
(If pushed on cash: big cash withdrawals look like rent/bills paid in cash, but we can't follow
cash, so it's our stated biggest limit. See Part 8.)

**"This is old Czech data. Does it apply to Canadians?"**
The exact amounts don't. The pattern holds whether we halve or increase every amount, and a comfort
level set in dollars isn't specific to cash economies. The next step would be validating it on
Tangerine's own data.

**"Why is income based on deposits?"**
That's your definition, and the only income measure in the data; there are no pay stubs.

**"Is the 93% realistic? Wouldn't people cut back?"**
93% assumes nothing changes. Even protecting basic needs with Statistics Canada's figure and cutting
*all* non-essential spending, 43% of top earners still run out within 3 months. They're less able
to adapt than you'd think.

**"Where does the 63.8% come from?"**
Statistics Canada, Survey of Household Spending 2023: Canadian households spend $48,600 of $76,146
on food from stores, their main home, transportation, health care and clothing. We use it only to
stop the backup plan from cutting basic needs, because the data can't show what cash was spent on.
It's a national average, and we say so in the app.

**"What do you do about customers with no bills in the data?"**
We don't estimate. Their bills are paid in cash and aren't recorded, so the app says a bills increase
can't be measured for them. We considered estimating and decided against it, because that number
wouldn't come from the data.

**"How did you clean the data?"**
We never edited the raw files; every step is code. We kept every customer in the engine (you can pick
any account), and handled the awkward cases explicitly: negative buffers get runway 0 per your rule;
pensioners are excluded from income comparisons; the first three months of each account are skipped
for the comfort number; the partial 2020 year is excluded from year-by-year checks; and we built no
findings on artifacts like weekdays. Where data was missing, we stated the limitation instead of
guessing.

**"What's wrong with the official formula?"**
Nothing is *wrong*, but it can mislead in four ways: 26% of customers look like they lose money
every month because the medians come from different months (97.5% of them don't); EI has no cap;
pensioners get a layoff shock; and the bills shock does nothing for 27% of customers whose bills
aren't recorded. We report your numbers as they are and explain these next to them.

**"How is the comfort number calculated?"**
The median of a customer's month-end balances, skipping their first three months. Where their
balance usually sits.

**"How robust is the main finding?"**
It holds in all 8 regions, every account age, both genders, couples and singles, every year from
2021 to 2025, five different savings definitions, and 1,000 random resamples. The top 10% hold 1.63
months (95% range 1.56–1.69) vs 9.03 for the bottom 10%.

**"How does the scenario box work? Is it AI?"**
No, it's rule-based on purpose: instant, works offline, and predictable during a live demo. It
shows "Understood as…" so you can check it read the card correctly, and every setting can be
adjusted with the sliders.

**"What does Gemini do?"**
It rewords the plan for the customer. It only rewrites our own plan text, and the server rejects any
reply containing a number that isn't in that text, so Gemini can't show a wrong number. If it's
unavailable, our original wording is shown.

**"Why does timing matter?"**
Spending peaks in January and June. A layoff in January
leaves the median customer 6.1 months; in February, 7.8 months.

**"What would a bank do with this?"** (Impact)
Show customers their savings cushion in months, not dollars, and offer an automatic rule: when the
balance goes above your comfort number, move the extra to savings. It works with the thermostat
instead of asking for willpower. Next step: test it on current customer data.

**"Why didn't you predict loan defaults?"**
We looked at it first and found a strong signal, but loan default prediction is the most-studied use
of this dataset, so it wouldn't be original. We focused on something new.

---

## Part 10 — Corrections we made along the way (good to know if asked)
1. Loan defaults were our first lead; parked as unoriginal.
2. Statement frequency's apparent fragility was mostly income.
3. "Irregular earners" and "on the edge" overlap less than we first thought (32%).
4. Layoff timing was first reported as December 6.9 vs February 9.2 from an average-based model;
   corrected to January 6.1 vs February 7.8 using the same median-based model as the app.
5. Every income drop used to be treated as a layoff (EI cap applied); now only layoffs.
6. A bills estimate for customers with unrecorded bills was removed.
7. The backup plan used to treat all cash as cuttable; it now protects basic needs (Statistics Canada).
8. A "Canadian average income" figure was first written from memory; it's now sourced from
   Statistics Canada (customers earn ~1.6× the average, not ~1.7×).
9. App inputs rounded to the cent flipped 13 runways by 0.1; fixed by using full precision.
10. The default Gemini model had been retired by Google; switched to gemini-3.5-flash.

---

## Part 11 — Sources
- PKDD'99 Discovery Challenge Financial dataset, CTU Prague: https://relational.fel.cvut.cz/dataset/Financial
- Government of Canada, EI regular benefits (55%, $729/week maximum in 2026):
  https://www.canada.ca/en/services/benefits/ei/ei-regular-benefit/benefit-amount.html
- Statistics Canada, Table 14-10-0223-01, average weekly earnings, August 2026 ($1,354.55/week):
  https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410022301
- Statistics Canada, Table 11-10-0222-01, Household spending 2023 (basic needs 63.8%):
  https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1110022201
- Statistics Canada, Table 11-10-0223-01, Household spending by income quintile 2023 (highest
  quintile 60.6%, sensitivity check only): https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1110022301
- Organizers' brief and data dictionary: `docs/CHALLENGE.md`
