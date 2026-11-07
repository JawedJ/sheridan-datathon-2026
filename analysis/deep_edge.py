"""Deep dive: the on-the-edge group (4.12), no-autopay customers (4.5), statement frequency (4.6)."""
import numpy as np
import pandas as pd

from explore_common import DATA, OUT, head, monthly

t = pd.read_csv(OUT / "customers_plateau.csv").set_index("account_id")
ms = monthly()
ms["cal"] = ms.month.str[5:].astype(int)
so = pd.read_csv(DATA / "standing_orders.csv")
pct = lambda x: f"{100 * x:.1f}%"

# ---------------------------------------------------------------- edge group
head("EDGE 1. A sturdier definition: months where the low point < 25% of the account's usual income")
med_in = ms.groupby("account_id").money_in.transform("median")
ms["edge_m"] = ms.min_balance < 0.25 * med_in
es = ms.groupby("account_id").edge_m.mean()
t["edge_share"] = es
t["edge_grp"] = pd.cut(es, [-0.01, 0.05, 0.25, 0.5, 1.0], labels=["rarely (<5%)", "sometimes", "often", "mostly (>50%)"])
print(t.groupby("edge_grp", observed=True).agg(n=("I", "size"), I=("I", "median"), S=("S", "median"),
      B=("B", "median"), plateau=("plateau", "median"), ei=("runway_ei55", "median"),
      ei_lt3=("runway_ei55", lambda r: round(100 * (r < 3).mean(), 1))).round(1))
edge = t.edge_share > 0.25
print("edge accounts (edge months > 25% of history):", edge.sum())

head("EDGE 2. Is it a phase or a way of life? Edge share in first vs second half of each history")
ms["half"] = np.where(ms.groupby("account_id").cumcount() < ms.groupby("account_id").month.transform("size") / 2, "first", "second")
h = ms.groupby(["account_id", "half"]).edge_m.mean().unstack()
he = h.loc[edge[edge].index]
print("edge accounts: median edge share first half", round(he["first"].median(), 3), " second half", round(he["second"].median(), 3))
print("  got better (second < first - 0.1):", pct((he["second"] < he["first"] - 0.1).mean()),
      " got worse:", pct((he["second"] > he["first"] + 0.1).mean()), " stayed:", pct(((he["second"] - he["first"]).abs() <= 0.1).mean()))
print("longest unbroken run of edge months, median:", ms[ms.account_id.isin(edge[edge].index)].groupby("account_id").edge_m.apply(
    lambda s: (s != s.shift()).cumsum()[s].value_counts().max() if s.any() else 0).median())

head("EDGE 3. What do edge accounts look like? (medians / shares)")
cols = dict(I=("I", "median"), cv_in=("cv_in", "median"), save_mean=("save_rate_mean", "median") if "save_rate_mean" in t else ("I", "size"),
            cash=("mix_cash_withdrawals_genuine", "median"), bills=("mix_household_bills", "median"),
            so_share=("so_share_I", "median"), loan=("has_loan", "mean"), weekly=("frequency", lambda s: (s != "monthly statement").mean()),
            neg=("neg_ever", "mean"), age=("owner_age", "median"), card=("card_type", lambda s: (s != "none").mean()),
            shared=("shared_account", "mean"), pension=("pension_share", lambda s: (s.fillna(0) >= .5).mean()))
t["save_rate_mean"] = (t.mean_in - t.mean_out) / t.mean_in.replace(0, np.nan)
cols["save_mean"] = ("save_rate_mean", "median")
print(t.groupby(edge).agg(**cols).round(3).T)

head("EDGE 4. Which calendar months are edge months? (share of all edge months)")
print(ms[ms.edge_m].cal.value_counts(normalize=True).sort_index().round(3).to_dict())

head("EDGE 5. What happens in the month an account tips onto the edge? (vs its usual)")
ms["prev_edge"] = ms.groupby("account_id").edge_m.shift(1)
tip = ms[(ms.edge_m) & (ms.prev_edge == False)]
med_out = ms.groupby("account_id").money_out.transform("median")
r_in = (tip.money_in / med_in.loc[tip.index]).median()
r_out = (tip.money_out / med_out.loc[tip.index]).median()
print(f"tipping months: {len(tip):,}  income vs usual x{r_in:.2f}  spending vs usual x{r_out:.2f}")
print("  share where spending > 1.3x usual:", pct((tip.money_out > 1.3 * med_out.loc[tip.index]).mean()),
      " share where income < 0.8x usual:", pct((tip.money_in < 0.8 * med_in.loc[tip.index]).mean()))
prev = ms.groupby("account_id").money_out.shift(1).loc[tip.index]
print("  month BEFORE tipping, spending vs usual: x", round((prev / med_out.loc[tip.index]).median(), 2))

head("EDGE 6. Plateau of edge accounts in months of spending")
t["plateau_months_spend"] = t.plateau / t.S.replace(0, np.nan)
print(t.groupby(edge).plateau_months_spend.median().round(2).to_dict())

# ---------------------------------------------------------------- no autopay
head("AUTOPAY 1. Customers with no standing orders at all")
t["has_so"] = t.index.isin(so.account_id)
print("no standing orders:", (~t.has_so).sum(), pct((~t.has_so).mean()))
t["I_q"] = pd.qcut(t.I, 4, labels=["Q1", "Q2", "Q3", "Q4"])
print("ever-negative rate by income quarter x autopay:")
print(t.pivot_table(index="I_q", columns="has_so", values="neg_ever", aggfunc="mean", observed=True).round(3))
print("EI<3mo by income quarter x autopay:")
print(t.pivot_table(index="I_q", columns="has_so", values="runway_ei55", aggfunc=lambda r: round(100 * (r < 3).mean(), 1), observed=True))
print("counts:")
print(t.pivot_table(index="I_q", columns="has_so", values="I", aggfunc="size", observed=True))

head("AUTOPAY 2. What does income look like without autopay?")
zero_in = ms.assign(z=ms.money_in == 0).groupby("account_id").z.mean()
t["zero_in_months"] = zero_in
top_share = ms.groupby("account_id").money_in.apply(lambda s: s.nlargest(3).sum() / s.sum() if s.sum() else np.nan)
t["top3_income_share"] = top_share
print(t.groupby("has_so").agg(cv_in=("cv_in", "median"), zero_in=("zero_in_months", "mean"),
      top3=("top3_income_share", "median"), months=("months", "median"), payday=("payday_regularity", "median") if "payday_regularity" in t else ("I", "size"),
      cash_in=("I", "size")).round(3))

head("AUTOPAY 3. Does the number of autopays matter? (count of standing orders)")
t["n_so"] = so.groupby("account_id").size().reindex(t.index).fillna(0)
print(t.groupby(t.n_so.clip(upper=4)).agg(n=("I", "size"), I=("I", "median"), neg=("neg_ever", "mean"),
      cv_in=("cv_in", "median"), ei=("runway_ei55", "median")).round(3))

# ---------------------------------------------------------------- statement frequency
head("STATEMENTS 1. Same income, different statement habit: fragility within income deciles D7-D10")
hi = t[t.I_dec.isin(["D7", "D8", "D9", "D10"])].copy()
hi["freq"] = np.where(hi.frequency == "monthly statement", "monthly", "frequent")
print(hi.groupby(["I_dec", "freq"], observed=True).agg(n=("I", "size"), I=("I", "median"), B=("B", "median"),
      ei_lt3=("runway_ei55", lambda r: round(100 * (r < 3).mean(), 1)), neg=("neg_ever", "mean"),
      edge=("edge_share", "median")).round(3))
print("pooled D7-D10: EI<3mo frequent", pct((hi[hi.freq == "frequent"].runway_ei55 < 3).mean()),
      " monthly", pct((hi[hi.freq == "monthly"].runway_ei55 < 3).mean()))
print("pooled D7-D10: ever negative frequent", pct(hi[hi.freq == "frequent"].neg_ever.mean()),
      " monthly", pct(hi[hi.freq == "monthly"].neg_ever.mean()))

head("STATEMENTS 2. Do frequent-statement customers have more volatile spending or bigger obligations?")
t["freq"] = np.where(t.frequency == "monthly statement", "monthly", "frequent")
print(t.groupby("freq").agg(cv_out=("cv_out", "median"), cv_in=("cv_in", "median"), so_share=("so_share_I", "median"),
      loan=("has_loan", "mean"), lease=("so_leasing", lambda s: (s > 0).mean()), b_months=("plateau_months_spend", "median"),
      fees=("fees", "median")).round(3))

t.reset_index().to_csv(OUT / "customers_edge.csv", index=False)
