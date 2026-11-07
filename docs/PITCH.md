# Pitch — The Comfort Number

Judging slot is about 5 minutes: **1 min pitch → 3 min live twist → 1 min questions.**
Judged on Discovery 35%, Data Use 25%, Communication 25%, Impact 15%.

---

## 1. The 1-minute pitch (~150 words, about 60 seconds spoken)

| Time | On screen | Say |
| --- | --- | --- |
| 0:00–0:10 | Title + headline | "We looked at 4,500 real bank customers and found something backwards: **the more you earn, the more fragile you are.**" |
| 0:10–0:25 | Chart 1 (comfort number vs 3 months of spending) | "The lowest earners hold **11 months** of spending in savings. The top 10% hold **1.6**. Their savings level off around $33,000, but three months of their spending costs $72,000." |
| 0:25–0:40 | Chart 3 (thermostat) | "Why? Balances act like a **thermostat**. When someone's balance climbs above their usual level, they spend it back down the next month. Top earners spend down two-thirds of a month's income. People save to a **dollar number**, not to a number of months." |
| 0:40–0:52 | Chart 2 (run out within 3 months) | "Under real EI rules, which cap at $729 a week, **93%** of top earners would run out within three months of a layoff if nothing changed. The official formula says 26%." |
| 0:52–1:00 | Engine | "So our engine doesn't just say 'spend less.' It finds each customer's **comfort number** and shows how to move it. Let's run one." |

**One-line version** (for the Devpost write-up and the video intro):
> People save to a dollar number, not a number of months, so the more you earn, the more fragile you
> are. Our engine finds each customer's comfort number and turns it into a plan.

**Rules for delivery**
- Say the headline in the first 10 seconds. Everything after supports it.
- Use three numbers max per breath: 11 vs 1.6 months, two-thirds, 93%.
- Don't explain the stress test in the pitch. Save it for questions ("we tested it in every region,
  year and savings definition").
- If time runs short, cut the 0:40–0:52 beat. The rest still stands.

---

## 2. The 3-minute live twist (script to rehearse)

The judge picks an `account_id` and reads a twist card. Run it in this order every time:

1. **Know the customer (≈30 s).** Type the ID. Read: money in, spending, fixed costs, buffer,
   runway. Then the line that's ours: *"Their balance settles around $X. That's their comfort
   number, and it covers Y months of spending."*
2. **Apply the twist (≈60 s).** Set the shock exactly as the card says. Read the **judges' runway
   first** ("By the official formula, they last N months"). Then:
   - *If high income:* toggle the real EI cap. "Real EI maxes out at $729 a week, so actually it's M months."
   - *If they pay bills in cash ($0 household bills):* "The data can't see their bills, so a bills
     shock shows no change. Our estimate says it would cost them about Z."
   - *If timing matters:* "And if this layoff hit in December instead of February, they'd have W fewer months."
3. **The plan (≈60 s).**
   - **Goal plan:** "To reach 3 months of cushion they need $G more. Moving their comfort number up
     with an automatic transfer gets them there in T months."
   - **Backup plan:** "If the shock hits now: cutting X% of flexible spending stretches them to 3
     months. Their fixed costs are only F% of spending, so there's room."
4. **Answer the question (≈30 s).** End with a yes/no: "So, do they make it? Under the official
   formula yes, under real EI no, unless they cut X%."

**Twist card cheat sheet** (judges' definitions, README):
| Card | Set |
| --- | --- |
| "Laid off, EI 55% for 6 months" | income = 0.55 × I, shock length 6 months |
| "Furnace costs a month of spending" | one-off = S, subtracted from the buffer |
| "Laid off + bills up 15%" | income = 0.55 × I, spending = S + 0.15 × H |
| "Rent goes up X%" | spending = S + X% × H |

**Rehearse with these accounts** (they hit every branch):
| Account | Why |
| --- | --- |
| 20111 | The judges' worked example; $0 household bills; bonus months |
| 71293 | High earner, thin cushion: the EI cap changes the answer |
| 22998 | Living on the edge, irregular income |
| 93255 | Pensioner: job loss doesn't apply to the pension |
| 98208 | Saver with bonus months |

---

## 3. Questions judges are likely to ask

**"Isn't it obvious that richer people have fewer months saved? Bigger spending, same savings."**
> That's exactly the finding, and it isn't automatic: savings *could* grow with income. We measured
> it. Doubling income raises savings only 22%, after correcting for noise in how income is measured.
> And we found *why*: the thermostat. Money above a set level gets spent the next month.

**"Maybe high earners keep their savings at another bank."**
> We tested it. Only a minority ever send money elsewhere, and those who do have the same cushion.
> Even if every dollar ever sent to another bank were savings, top earners go from 1.9 to 2.4 months.
> What we can't see is money that never touches this account, and we say so.

**"This is 1990s Czech data. Does it apply to Canadians?"**
> The exact dollar amounts don't, and it's a cash economy. The pattern holds whether we halve or
> double every amount, and the behaviour (a comfort level in dollars) isn't specific to cash.
> We'd validate it on Tangerine's own data as the next step.

**"Why do your numbers differ from ours?"**
> They don't, for the official definitions. We match your formulas exactly and show them first.
> We also show a second number where the official shortcut misses real rules: the EI cap, pensioners,
> bills paid in cash. Both are on screen.

**"Is the 93% realistic? Wouldn't they just cut back?"**
> Yes, they would, and that's the point of the plan. 93% assumes nothing changes. 88% of top earners'
> spending is flexible, and cutting half of it brings 93% down to 30%. They're not trapped, they're
> unprepared.

**"How is the comfort number calculated?"**
> The median month-end balance after the first three months of the account. Balances above it are
> followed by net spending the next month, below it by net saving. We checked that this pull is
> stronger than chance with a shuffled-order test.

**"How robust is it?"**
> It holds in all 8 regions, every account age, both genders, couples and singles, every year
> 2021–2025, and five definitions of savings. Top 10% hold 1.63 months (95% interval 1.56–1.69)
> vs 9.03 for the bottom 10%.

**"What would a bank actually do with this?" (Impact)**
> Show customers their cushion in months, not dollars. Then offer an automatic rule: when the balance
> goes above your comfort number, move the extra to savings. It works *with* the thermostat instead
> of asking for willpower. Next step: test it on current customer data.

---

## 4. What the app needs for this pitch to work
- Account lookup with the judges' five numbers, matching their answer key exactly.
- **Comfort number**, and cushion shown in **months**.
- Shock controls for every twist card, plus a **real EI cap** toggle next to the judges' number.
- Shock **start month** (December vs February).
- Goal plan (gap to 3 months, time to reach it with an auto-transfer) and backup plan (% of
  flexible spending to cut to reach 3 months).
- Pensioner and $0-bills handling.
- Charts 1–3 on a findings page for the pitch.

---

## 5. Two-minute demo video outline (Devpost)
1. 0:00–0:15 Headline + chart 1.
2. 0:15–0:40 Thermostat chart and the "dollar number, not months" line.
3. 0:40–1:30 Engine run on account 71293 (high earner): judges' runway → real EI cap → plan.
4. 1:30–1:50 What we checked in the data (formula issues, stress test) in one slide.
5. 1:50–2:00 Impact: the auto-save-above-your-comfort-number idea and next step.
