# Pitch — The Comfort Number

Judging slot is about 5 minutes: **1 min pitch → 3 min live twist → 1 min questions.**
Judged on Discovery 35%, Data Use 25%, Communication 25%, Impact 15%.
App: https://comfort-number.vercel.app (engine on the home page, charts under Findings).

---

## 0. The one idea

> **People save to a dollar number, not a number of months. So the more you earn, the more fragile you are.**

Three numbers to remember, and nothing else:
- **11 months vs 1.6 months**: savings of the lowest vs highest earners, in months of their own spending.
- **3 of every 4 dollars**: how much of a windfall top earners spend within 3 months. Savings drift back to a set dollar level, their *comfort number*.
- **93%**: top earners who'd run out within 3 months of a layoff under real EI rules, if nothing changed. The official formula says 26%.

---

## 1. The 1-minute pitch (about 150 words)

| Time | On screen | Say |
| --- | --- | --- |
| 0:00–0:10 | Findings page title | "Who runs out of money faster after a layoff: someone earning six thousand a month, or twenty-five thousand? In 4,500 bank accounts, it's the **high earner**." |
| 0:10–0:22 | Chart 1 (savings level off) | "The lowest earners hold **11 months** of spending in savings. The top 10% hold **1.6**. Their savings level off around $33,000, but three months of their spending costs $72,000." |
| 0:22–0:37 | Chart 2 (balances pulled back; windfall result in its notes) | "Why? People save to a **dollar number**, not to a number of months. When top earners get a windfall, they spend **three of every four dollars** within three months. Their balance drifts back to the same level. We call it their **comfort number**." |
| 0:37–0:50 | Chart 3 (run out after a layoff) | "With real EI, which caps at $729 a week, **93%** of top earners would run out within three months. The official formula says 26%. And cutting back after the layoff isn't enough: even cutting everything non-essential leaves 43% short." |
| 0:50–1:00 | Switch to the engine | "So the fix has to come **before** the shock. Our engine finds each customer's comfort number and builds the cushion first. Give us an account and a twist card." |

**One-line version** (Devpost, video intro):
> People save to a dollar number, not a number of months, so the more you earn, the more fragile you
> are. Our engine finds each customer's comfort number and builds the cushion before the shock.

**Delivery rules**
- The headline lands in the first 10 seconds. Everything after supports it.
- Say "four thousand five hundred bank accounts", not "real Canadians": it's a public dataset in CAD.
- Never explain the stress tests in the pitch. They're for questions.
- If time runs short, cut the "official formula says 26%" sentence. The rest still stands.

---

## 2. The 3-minute live twist

The judge picks an `account_id` and reads a twist card. Same routine every time:

**0. Type the card (≈15 s).** Type it into the scenario box *with the account number*, e.g.
"Account 71293 is laid off, EI pays 55% for 6 months", and press Run. Gemini reads it.
Read the pills aloud: *"It understood: off work on EI, income 55%, 6 months."*
- "Assumed: …" pills = defaults from the brief (no % → 55%; no length → 6 months). Say them.
- "Not included" pills = things the engine can't model (a partner's job loss, "groceries up 20%"). Say so plainly.
- New costs work too: "daycare $1,000 a month", "inflation pushes spending up 8%" go in as other spending.
- If Gemini is slow or busy: set it with the sliders under "Adjust the shock". Practise this once.

**1. Know the customer (≈30 s).** Point at the six boxes, using the judges' letters:
*"Money in I, spending S, fixed costs F, household bills H, buffer B, loan payment P."*
Then the line that's ours: *"Their balance settles around $X. That's their comfort number, and it
covers Y months of spending."*

**2. What happens (≈45 s).** Read the verdict at the top, then:
- **Official formula first:** "By your formula, they last N months."
- **Real-world column, only if it differs:** "With the real EI maximum, $729 a week, it's M months."
  (It only differs for job losses of higher earners, or pensioners, whose pension keeps paying.)
- **If H is $0:** "Their household bills aren't recorded in the data. So a
  bills increase can't change their number. That's a limit of the data, and we don't guess it."

**3. The plan (≈60 s).** Scroll to section 3:
- Read the first sentence or two of the plan text.
- Point at the four tiles: **No plan / Backup plan / Goal plan first / Both.**
  *"Cutting back after the shock gets them to A months. Having the 3-month cushion first gets them
  to B. Both together, C."*
- Goal plan: *"An automatic transfer of $T a month builds that cushion in G months."*

**4. Answer the card (≈20 s).** End with a clear yes or no:
*"So, do they make it? By the official formula yes, with real EI no. Our plan gets them there."*

### Rehearsal sheet (exact numbers from the app)

| Account | Who | Card | Official | Real | What to say |
| --- | --- | --- | ---: | ---: | --- |
| **71293** | High earner, $21,513/mo in, 2.4 months saved | Laid off, EI 55%, 6 months | 6.2 | **2.8** | The EI cap is the story. Backup alone 5.0, cushion first 3.6, **both 6.3: makes it** |
| **20111** | Judges' example, H = $0 | Laid off, EI 55%, 6 months | 3.4 | 3.2 | Cut 81% of non-essential ($2,505/mo) to reach 6 months; cushion first + cuts = 8.8 |
| 20111 | | Furnace (1 month of spending) | 4.0 | 4.0 | Makes 3 months without cuts. No-shock runway is only 7.8 because of the median quirk |
| 20111 | | Bills up 15% | no change | no change | H = $0: the bills shock can't change their number (paid in cash) |
| **22998** | On the edge, 1.5 months saved, H = $0 | Furnace | **1.9** | 1.9 | Doesn't make 3 months; cut 25% of non-essential ($805/mo) |
| 22998 | | Laid off, EI 55%, 6 months | 2.5 | 2.3 | Cutting can't reach 6 months (best 5.2); cushion first + cuts = 10.5 |
| **93255** | Pensioner, 14.8 months saved | Any card | no shortfall | no shortfall | Income covers spending; a layoff can't stop a pension |
| **98208** | Top earner, H = $0 | Laid off, EI 55%, 6 months | 4.7 | **2.1** | Even cutting everything only gets 3.6; both plans 5.8, still short |

Brief's own cards: "Laid off, EI 55% for 6 months" · "Furnace costs a full month of spending" ·
"Laid off (EI 55%) + household bills up 15%" · "Rent up 25% starting in January".

---

## 3. Questions judges are likely to ask

**"Isn't it obvious that richer people have fewer months saved?"**
> Only if savings stayed flat, and they don't have to. We measured it: doubling income raises
> savings by just 22%, after correcting for noise in how income is measured. If people saved in
> months, it would double.

**"How do you know the comfort number is real and not a statistical artifact?"**
> We tested it two ways. After a windfall, accounts keep only 45% of it six months later, and top
> earners 29%. With no set point they'd keep all of it. And comparing each balance only to its own
> past, the pull back shows up in real data (−0.23) but not in shuffled data (−0.01).

**"You tested lots of angles. Couldn't this be chance?"**
> We split the accounts in half at random, three times. Every half gives the same answer: top
> earners 1.6–1.7 months, bottom earners 8.8–9.9. It also holds in all 8 regions, every year, both
> genders, and with five definitions of savings.

**"Maybe high earners keep savings somewhere else."**
> Money sent to other banks can't explain it: even counting every such dollar as savings, top
> earners only reach 2.4 months. What we can't rule out is cash kept at home. 41% of their spending
> is large cash withdrawals. They look like rent and bills (same amount, mid-month), but we can't
> follow cash, so we state it as our biggest limit.

**"Why do some of your numbers differ from ours?"**
> They don't, for your definitions: we match your formula exactly for every account, and we show
> it first. The second column changes only one thing, income during a job loss: the real EI
> maximum, and pensions that keep paying. Spending, buffer and bills are identical.

**"Is the 93% realistic? People would cut back."**
> It's "if nothing changes", so we tested cutting back. Protecting basic needs (Statistics Canada:
> 64% of household spending), cutting *everything* else still leaves 43% running out within three
> months. That's why the plan has to start before the shock.

**"What about customers with no household bills?"**
> 1,225 have none recorded. They spend as much as everyone else, but 96% of it leaves as cash, so
> their bills are probably paid from that, but we can't verify it. So we don't invent a number; the app
> just says they're not recorded.

**"This is old Czech data. Does it apply to Canadians?"**
> The dollar amounts don't, which is why we only claim the pattern. It holds if we halve or double
> every amount. The next step is checking it on Tangerine's own customers.

**"What does Gemini do?"**
> Two things. It reads the twist card into the engine's settings, and shows exactly what it
> understood, what it assumed and what it couldn't include. Then it rewords the plan for the
> customer. It never does the math: every number comes from our engine, and the server rejects any
> reply that changes a number.

**"What would a bank do with this?" (Impact)**
> Two cheap changes. Show the balance in months of spending, not just dollars, so the number people
> anchor to grows with their life. And offer an automatic rule: money above your comfort number
> moves to savings. It works with how people already behave, not against it.

---

## 4. Two-minute video (Devpost)

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:15 | Findings, chart 1 | The headline and 11 vs 1.6 months |
| 0:15–0:35 | Chart 2 and its notes (windfall result) | Dollar number, not months; 3 of 4 windfall dollars spent |
| 0:35–0:50 | Chart 3 | 93% vs 26%; cutting back leaves 43% short |
| 0:50–1:35 | Engine: type the 71293 layoff card | Pills → six values → official 6.2 vs real 2.8 → four tiles → both plans 6.3 |
| 1:35–1:50 | A simple title card (or stay on the engine) | Hold-out, windfalls, our biggest limit (cash) |
| 1:50–2:00 | Back to the headline | Show balances in months; build the cushion before the shock |

---

## 5. Before judging (checklist)
- [ ] Billing on for the Gemini key; set `GEMINI_PARSE_MODELS=gemini-3.5-flash,gemini-3.5-flash-lite` in Vercel and redeploy.
- [ ] Run the four brief cards on 71293, 20111 and 22998 on the live site.
- [ ] Practise one twist with the sliders only (in case Gemini is slow).
- [ ] Time the pitch out loud: under 60 seconds.
