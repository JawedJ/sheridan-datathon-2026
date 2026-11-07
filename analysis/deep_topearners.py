"""Why do top earners run out so fast on EI, and could they cut back?

  A  What their spending is made of (fixed vs flexible, autopay, cash, lumpiness).
  B  Natural experiment: when income actually drops, does spending follow?
  C  How big a cut to flexible spending would get them to 3 months on real EI.
  D  How much of the 93% is the EI cap vs their spending, and the currency-scale question.
Non-pensioners only.
"""
import numpy as np
import pandas as pd

from explore_common import DATA, OUT, head, monthly

EI_CAP = 729 * 52 / 12
t = pd.read_csv(OUT / "customers_edge.csv").set_index("account_id")
t = t[t.pension_share.fillna(0) < 0.5].copy()
t["dec"] = pd.qcut(t.I.rank(method="first"), 10, labels=False) + 1
t["band"] = pd.cut(t.dec, [0, 3, 7, 10], labels=["bottom 30%", "middle 40%", "top 30%"])
ms = monthly()
ms = ms[ms.account_id.isin(t.index)].copy()
ms["k"] = ms.groupby("account_id").cumcount()
ms = ms[ms.k >= 3]
pct = lambda x: f"{100 * x:.1f}%"


def runway(B, gap):
    with np.errstate(divide="ignore", invalid="ignore"):
        r = np.minimum(B / gap, 120)
    r = np.where(gap <= 0, 120.0, r)
    return np.where(B <= 0, 0.0, r)


# ------------------------------------------------------------------ A
head("A. What spending is made of, by income decile (medians)")
tot = ms.groupby("account_id")[["household_bills", "insurance", "loan_payments", "bank_fees",
                                "cash_withdrawals_genuine", "card_withdrawals", "transfers_out_other", "money_out"]].sum()
share = tot.div(tot.money_out.replace(0, np.nan), axis=0)
t = t.join(share.add_prefix("sh_"))
t["fixed_share"] = t.F / t.S.replace(0, np.nan)
t["so_share_S"] = t.so_total / t.S.replace(0, np.nan)
top3 = ms.groupby("account_id").money_out.apply(lambda s: s.nlargest(3).sum() / s.sum() if s.sum() else np.nan)
t["top3_out_share"] = top3
big = ms.assign(med=ms.groupby("account_id").money_out.transform("median"))
big["spike"] = big.money_out > 2 * big.med
spike_share = big.assign(x=np.where(big.spike, big.money_out - big.med, 0)).groupby("account_id").x.sum() / tot.money_out
t["spike_excess_share"] = spike_share
tbl = t.groupby("dec").agg(I=("I", "median"), S=("S", "median"), F=("F", "median"),
                           fixed=("fixed_share", "median"), autopay=("so_share_S", "median"),
                           cash=("sh_cash_withdrawals_genuine", "median"), bills=("sh_household_bills", "median"),
                           top3=("top3_out_share", "median"), spikes=("spike_excess_share", "median"),
                           cv_out=("cv_out", "median"))
print(tbl.round(3))
print("\nflexible (non-fixed) spending, $ per month, median by decile:",
      (t.S - t.F).groupby(t.dec).median().round(0).to_dict())

# ------------------------------------------------------------------ B
head("B. When income really drops (< 60% of usual), what happens to spending that month and next?")
g = ms.groupby("account_id")
ms["usual_in"] = g.money_in.transform("median")
ms["usual_out"] = g.money_out.transform("median")
ms["out_next"] = g.money_out.shift(-1)
ms["in_next"] = g.money_in.shift(-1)
drop = ms[(ms.money_in < 0.6 * ms.usual_in) & (ms.usual_in > 0)].join(t.band, on="account_id")
normal = ms[(ms.money_in >= 0.9 * ms.usual_in) & (ms.money_in <= 1.1 * ms.usual_in)].join(t.band, on="account_id")
print("income-drop months:", len(drop), " accounts:", drop.account_id.nunique())
res = pd.DataFrame({
    "n_drop_months": drop.groupby("band", observed=True).size(),
    "income_vs_usual": (drop.money_in / drop.usual_in).groupby(drop.band, observed=True).median(),
    "spend_same_month": (drop.money_out / drop.usual_out).groupby(drop.band, observed=True).median(),
    "spend_next_month": (drop.out_next / drop.usual_out).groupby(drop.band, observed=True).median(),
    "spend_normal_month": (normal.money_out / normal.usual_out).groupby(normal.band, observed=True).median(),
})
print(res.round(3))
two = drop[(drop.in_next < 0.6 * drop.usual_in)]
print("two drops in a row (closest thing to a job loss):", len(two), "account-months")
print("  spending next month vs usual:", (two.out_next / two.usual_out).groupby(two.band, observed=True).median().round(3).to_dict())

# ------------------------------------------------------------------ C
head("C. Cut needed to reach 3 months of runway on real EI")
ei = np.minimum(0.55 * t.I, EI_CAP)
t["rw_cap"] = runway(t.B.values, (t.S - ei).values)
need_S = t.B / 3 + ei                       # spending that gives exactly 3 months
flex = (t.S - t.F).clip(lower=1)
t["cut_needed"] = ((t.S - need_S) / flex).clip(lower=0)
t["feasible_cut"] = t.cut_needed <= 1        # achievable without touching fixed costs
print(t.groupby("dec").agg(rw_cap=("rw_cap", "median"), lt3=("rw_cap", lambda r: round(100 * (r < 3).mean(), 1)),
                           cut_needed=("cut_needed", "median"),
                           possible_without_fixed=("feasible_cut", "mean")).round(2))
for cut in [0.25, 0.5]:
    S2 = t.S - cut * flex
    r2 = runway(t.B.values, (S2 - ei).values)
    print(f"cut flexible spending {int(cut * 100)}%: top 10% under 3 months {pct((r2[t.dec == 10] < 3).mean())}, "
          f"median runway {np.median(r2[t.dec == 10]):.1f} mo (was {t.rw_cap[t.dec == 10].median():.1f})")
S_floor = t.F + (t.S - t.F)[t.dec == 5].median()           # fixed costs + a median customer's flexible spending
r3 = runway(t.B.values, (np.maximum(S_floor, 0) - ei).values)
print(f"live on fixed costs + a median customer's flexible spending (${(t.S - t.F)[t.dec == 5].median():,.0f}): "
      f"top 10% under 3 months {pct((r3[t.dec == 10] < 3).mean())}, median runway {np.median(r3[t.dec == 10]):.1f} mo")

# ------------------------------------------------------------------ D
head("D. How much is the EI cap vs spending? And does the currency scale matter?")
d10 = t[t.dec == 10]
print(f"top 10%: income ${d10.I.median():,.0f}/mo, EI under judges' rule ${0.55 * d10.I.median():,.0f}, real cap ${EI_CAP:,.0f}"
      f" -> EI replaces {EI_CAP / d10.I.median():.0%} of income")
for label, inc in [("no EI at all", 0 * t.I), ("real cap", ei), ("judges' 55% uncapped", 0.55 * t.I), ("full income kept", t.I)]:
    r = runway(t.B.values, (t.S - inc).values)
    print(f"  {label:22s} top 10% under 3 months: {pct((r[t.dec == 10] < 3).mean())}   bottom 10%: {pct((r[t.dec == 1] < 3).mean())}")
dist = pd.read_csv(DATA / "districts.csv")
print(f"\nscale check: district average salary ${dist.average_salary.median():,.0f}/mo; customers' median income "
      f"${t.I.median():,.0f}/mo; Canada average weekly earnings $1,354.55 = $5,870/mo "
      f"(StatCan Table 14-10-0223-01, Aug 2026, seasonally adjusted, series v79311153)")
for scale in [0.5, 0.75, 1.0, 1.5]:
    ei_s = np.minimum(0.55 * t.I * scale, EI_CAP)
    r = runway((t.B * scale).values, (t.S * scale - ei_s).values)
    print(f"  if all amounts were x{scale}: top 10% under 3 months {pct((r[t.dec == 10] < 3).mean())}, "
          f"months-of-cushion gap unchanged (D1 {(t.B / t.S)[t.dec == 1].median():.1f} vs D10 {(t.B / t.S)[t.dec == 10].median():.1f})")
