# Speaker notes: pitch, live demo, questions

One page to keep open while presenting. App: https://comfort-number.vercel.app
(Engine on the home page, two charts under Findings.) Full detail: `docs/REPORT.md`.

Judging: Discovery 35 · Data Use 25 · Communication 25 · Impact 15.
Slot: 1 min pitch → 3 min live twist → 1 min questions.

---

## 1. The pitch (60 seconds, about 150 words)

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | Findings page | "Who runs out of money faster after a layoff: someone earning six thousand a month, or twenty-five thousand? In 4,500 bank accounts, it's the **high earner**." |
| 0:10 | Chart 1 | "The lowest earners hold **11 months** of spending in savings. The top 10% hold **1.6**. Their savings level off around $33,000, but three months of their spending costs $72,000." |
| 0:22 | Windfall chart | "Why? People save to a **dollar number**, not a number of months. Give top earners extra money and three months later **three-quarters of it is gone**. Their balance drifts back to the same level, their **comfort number**." |
| 0:35 | The 93% number | "We matched your formula on all 4,500 accounts, then fixed where it breaks. With the real EI cap of $729 a week, **93%** of top earners run out within three months. Your formula says 26%." |
| 0:48 | Switch to the engine | "So the fix has to come **before** the shock. Our plan builds the cushion first, so they cut less when it hits. Give us an account and a twist card." |

Three numbers only: **11 vs 1.6 months · three-quarters of a windfall gone · 93%.**

---

## 2. Live twist: what to do and what to point out

**0. Type the card** with the account number ("Account 71293 is laid off, EI pays 55% for 6 months") → Run.
Read the pills aloud. If Gemini is slow, use the sliders under "Adjust the shock".
> *Data Use moment:* "Gemini reads the card, but it never does the math. Anything our model can't
> handle shows as 'Not included' instead of being guessed."

**1. Section 1, the customer.** Point at the six boxes by the judges' letters: I, S, F, H, B, P.
Then the comfort number: "Their balance settles around $X. That's Y months of spending."
> *If H is $0:* "Their household bills aren't recorded in the data. That's 27% of customers, so a %
> bills shock can't change their number. We don't invent one."

**2. Section 2, what happens.** Official runway first, then real-world if it differs.
> *If the numbers differ:* "Your formula gives 55% of income on EI. Real EI caps at $729 a week, so
> for this customer it's $3,159 a month. That's the only thing we change."
> *If it's a pensioner:* "Your formula applies a job loss to their pension. A pension keeps paying."
> *If they're short with no shock at all* (1 in 4 customers, including your example 20111):
> "This is a quirk in the formula: typical income and typical spending are medians from different
> months. 20111's typical income is $6,339 and spending $8,600, but over their whole history they
> took in about $286 a month **more** than they spent. 97.5% of these 'short' customers actually
> save over time."

**3. Section 3, their plan.**
"Without a plan, A months. With the plan, B. They need N."
1. **Now:** "Move $T a month into savings automatically for G months, until they have 3 months saved."
2. **If it hits:** "Then cut non-essential spending by $C a month. Basic needs stay protected."
> *Why both:* "For high earners, saving alone or cutting alone isn't enough. Saving first means they cut less."
> *The savings timeline (under 1):* "Today a layoff would last 2.8 months. Every month they save, it lasts longer:
> 3.1 after 3 months, 3.6 once the fund is full. That's why the plan starts now, not after the layoff."
> *The spending bar (under 2):* "Grey is basic needs, which we protect. The green line is their income during the
> shock: EI covers $3,159 of their $19,172 a month. Everything right of the line comes out of savings, and the
> striped part is what the plan cuts."
> *Peer line:* "People at their income level hold about 2 months. The fund takes them to 3."
> *Basic needs:* "We can't see what cash is spent on, so we protect 64% of spending, the Statistics
> Canada share for food, housing, transportation, health and clothing. Only the rest can be cut."

**4. Answer the card:** "So, do they make it? By your formula yes or no, with real EI yes or no, and with the plan, yes."

### Rehearsal numbers (laid off, EI 55%, 6 months)
| Account | Official | Real | Plan |
| --- | ---: | ---: | --- |
| 71293 (high earner) | 6.2 | **2.8** | Save $1,605/mo for 8 months, then cut $6,427/mo → **6.0 ✓** |
| 20111 (judges' example) | 3.4 | 3.2 | Save $286/mo for 29 months, then cut $1,141/mo → 6.0 ✓ |
| 22998 (on the edge) | 2.5 | 2.3 | Save first, then cut $1,327/mo → 6.0 ✓ |
| 98208 (top earner) | 4.7 | **2.1** | Save $2,667/mo, then cut everything → 5.8 ✕: needs extra income or help |
| 93255 (pensioner) | no shortfall | no shortfall | Pension covers spending |
Furnace on 22998: 1.9 months, short of 3; with the emergency fund, no cuts needed (7.9).

---

## 3. Data Use: what to say when asked (or when it comes up)

**How we cleaned and questioned the data**
- We never edit the raw files, and we don't fill gaps with guesses. Everything is code anyone can rerun.
- No customers removed: the judges can pick any of the 4,500.
- We checked the data adds up: no missing months, every month-end balance = last month + in − out (180,826 checks,
  off by at most $0.14), monthly totals match the 1 million transactions exactly.
- Pensioners (740) are kept in the engine but left out of income comparisons: a layoff can't stop a pension.
- The first 3 months of each account are skipped when measuring habits: accounts start at $0 and fill up.
- 2020 is a partial year (accounts still opening), so year-by-year checks use 2021–2025.
- Patterns that look generated by the data prep (weekday spikes, round amounts, bank codes): no findings built on them.
- Guesses we removed: a bills estimate, a June/December "bonus", "paid in cash" wording.

**Four problems in the official formula**
| Problem | Size |
| --- | --- |
| Income and spending medians come from different months, so customers look short with no shock | 1,181 customers (26%); 97.5% of them actually take in more than they spend |
| No EI maximum: 55% of income can be far above the real $729/week | 2,574 customers (57%) would get more than the cap |
| A job-loss shock applied to pensioners | 740 customers |
| Bills shock does nothing when bills aren't recorded | 1,225 customers (27%) |
We match the formula exactly (49,500 checks, 0 mismatches) and show our correction **next to** it, never instead of it.

**How we know the finding is real**
- Same answer on a random half of customers and on the other half (3 times).
- Holds in all 8 regions, every year, both genders, couples and singles, 5 definitions of savings.
- Corrected for noisy income: doubling income raises savings only about 22% (×1.22).
- Not caused by cash being re-deposited (only 0.5–3.6% of deposits).
- Stronger for customers paid by bank transfer, not weaker.
- Savings at other banks can't explain it: counting every dollar sent elsewhere moves top earners from 1.9 to only 2.4 months.

**What we can't claim (say these up front)**
- It's 1990s Czech bank data, relabelled in CAD and 2020–2025. We claim the **pattern**, not the dollar amounts.
- We only see one bank, and we can't follow cash. 41% of top earners' spending is large cash withdrawals; if that were secretly saved, the gap would shrink.
- No household size. The comfort number is observed behaviour; we show it, we don't prove why.

---

## 4. Likely questions, short answers

**"Isn't it obvious richer people have fewer months saved?"**
Only if savings stay flat, and they don't have to. Doubling income raises savings just 22%. And the windfall chart shows it's behaviour: top earners spend three-quarters of extra money within three months; the lowest earners keep two-thirds.

**"Why do your numbers differ from ours?"**
They don't, for your definitions; we match exactly and show yours first. The real-world column changes one thing: income during a job loss (the EI maximum, and pensions keep paying).

**"Is 93% realistic? People would cut back."**
It's "if nothing changes". Even cutting all non-essential spending (basic needs protected) leaves 43% short. That's why the plan starts before the shock.

**"What does Gemini do?"**
Reads the twist card into the engine's settings, showing what it understood, assumed, and couldn't include. Then rewords the plan summary. It never does math, and the server rejects any reply that changes a number.

**"What would a bank do with this?"** (Impact)
Two cheap changes: show balances in months of spending, not just dollars; and offer an automatic rule that moves money above the comfort number into savings. Next step: test it on Tangerine's own customers.

**"Why not loan defaults?"**
It's the most-studied question on this dataset, so we looked for something new.

---

## 5. Before judging
- [ ] Billing on for the Gemini key; set `GEMINI_PARSE_MODELS=gemini-3.5-flash,gemini-3.5-flash-lite` in Vercel; redeploy.
- [ ] Run 71293, 20111 and 22998 on the live site.
- [ ] Practise one twist with sliders only.
- [ ] Time the pitch: under 60 seconds.
