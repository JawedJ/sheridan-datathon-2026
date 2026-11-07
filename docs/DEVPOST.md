# Devpost submission text

## Elevator pitch (tagline)
People save to a dollar number, not a number of months, so the more you earn, the more fragile you are. Our engine finds each customer's "comfort number" and stress-tests it.

## About the project (paste as Markdown)

## Inspiration
The brief asked a simple question: if something goes wrong, how long can this customer last? We
expected the answer to follow income: earn more, last longer. When we computed runway for all 4,500
customers, it went the other way. The lowest-earning 10% hold **11 months** of spending in savings.
The top 10% hold **1.6**. We wanted to know why, and whether it was real.

## What it does
**Comfort Number** is a resilience engine built around the brief's three parts:

1. **Know the customer:** enter an account ID and see income, fixed costs, spending, savings buffer,
   runway, and their *comfort number*, the balance their account keeps settling back to.
2. **Take a shock:** type it in plain words ("Account 71293 is laid off, EI 55% for 6 months") or use
   the sliders. Every match is shown back as "Understood as…", so nothing is applied silently.
3. **Make a plan:** a goal plan (an automatic transfer of money above the comfort number until they
   have 3 months saved) and a backup plan (how much non-essential spending to cut, with basic needs
   protected, and an honest message when cutting isn't enough).

Every answer shows two runways side by side:
- **Official formula:** exactly the judges' definitions. It matches an independent Python
  calculation for all 4,500 accounts × 5 standard shocks (49,500 checks, 0 mismatches).
- **Real-world rules:** the same numbers with two real policies applied: EI is capped at
  $729/week for layoffs, and pensions keep paying.

$$
\text{runway} = \min\left(\frac{B - \text{one-off cost}}{S_{\text{shock}} - I_{\text{shock}}},\ 120\right)
$$

Gemini then turns the engine's numbers into a short plain-language plan. Gemini never does the
math; if it's unavailable, a template is used, so the numbers always match.

## What we found
**People save to a dollar number, not a number of months.**
- Doubling income raises savings by only about 22% (elasticity 0.29, 95% CI 0.26–0.31, corrected for
  measurement noise). If people saved in months, it would double.
- **Windfalls drain back.** After a windfall (a month bringing in at least a month's usual income),
  accounts keep only 45% of it six months later, and top earners only 29%. With no set point they'd
  keep all of it. Top earners spend about three of every four windfall dollars within 3 months.
- **Why it matters:** under the real EI cap, which replaces only about 12% of a top earner's
  income, 93% of top earners would run out within 3 months of a layoff if nothing changed. The
  official 55% rule says 26%.
- Cutting back after the shock doesn't save most of them. With basic needs protected (Statistics
  Canada: 64% of household spending), cutting *all* non-essential spending still leaves 43%
  running out within 3 months. The fix has to come *before* the shock, so that's what our goal plan does.
- Layoff timing matters too: a January layoff leaves a median 6.1 months of runway vs 7.8 in February.

## How we built it
- **Analysis:** Python and pandas over the monthly summaries and 1M+ transactions. One table per
  customer with the judges' metrics, then a broad survey (people, places, behaviour, time) before
  deep dives on the threads we chose.
- **Checking it's real:** all 8 regions, every account age, both genders, couples and singles,
  every year 2021–2025, five definitions of savings, bootstrap intervals, a random 50/50 hold-out,
  shuffled-order nulls, and tests for cash re-deposits and "savings at another bank."
- **App:** Next.js and TypeScript on Vercel. All calculations run in the browser from precomputed
  per-customer data (kept at full precision; rounding to cents flipped 13 results), so the live demo
  is instant. One server route calls the Gemini API to write the plan.
- **Sources:** EI maximum from canada.ca (2026); basic-needs share from Statistics Canada's Survey of
  Household Spending 2023 (Tables 11-10-0222-01 and 11-10-0223-01); Canadian average earnings from
  Statistics Canada Table 14-10-0223-01.

## Challenges
- **Matching the official formula exactly.** We found real quirks: medians of income and spending
  come from different months, so 26% of customers show a shortfall with no shock at all, even though
  97.5% of them took in more than they spent overall. EI is applied to pensioners, and a bills shock
  does nothing for the 27% whose bills aren't recorded. We kept the official numbers exact and
  showed our corrections next to them, never in place of them.
- **Not fooling ourselves.** Our first test of the comfort number was partly an artifact: comparing
  balances to the account's whole-history median quietly uses the future. We rebuilt it using only
  past months and added the windfall test, which doesn't depend on that choice.
- **Not overstating.** An early version said cutting half of top earners' spending would fix most
  of the problem. It treated all cash as cuttable. Once we protected basic needs using Statistics
  Canada data, the honest answer was much weaker, and we replaced the claim everywhere.

## What we learned
- A finding you can explain in one sentence is worth ten you can't.
- Show the official answer first, then show what changes and why.
- The most useful test is the one that tries to kill your headline.

## Limits (we say these up front)
- The data is the PKDD'99 Czech bank dataset with dates shifted and amounts in CAD, from a cash
  economy. We claim the *pattern*, not the exact dollar amounts.
- We only see one bank, and we can't follow cash. About 41% of top earners' spending is large cash
  withdrawals that look like rent or bills paid in cash, but we can't prove none of it was saved.
- The comfort number is observed behaviour. We show balances get pulled back; we don't prove why.

## What's next
Validate the comfort number on Tangerine's own customers, and test the simplest version of the fix:
show balances in months of spending, not just dollars, so the number people anchor to finally
grows with their life.

## Built with (tags)
python, pandas, numpy, typescript, react, next.js, vercel, node.js, google-gemini, gemini-api, svg, css, github, statistics-canada, data-analysis

## "Try it out" links
- App: https://comfort-number.vercel.app
- Findings charts: https://comfort-number.vercel.app/findings
- Code: https://github.com/JawedJ/sheridan-datathon-2026

## Image gallery (3:2, ≤ 5 MB each)
1. Engine with a scenario typed in (twist → official vs real-world runway)
2. Plans section (goal plan + backup plan)
3. Findings: "Savings level off while spending keeps climbing"
4. Findings: "Top earners are the most likely to run out after a layoff"
5. Findings: layoff timing by start month

## Video demo link
(not recorded yet; aim for about 2:00, public YouTube or Google Drive)
