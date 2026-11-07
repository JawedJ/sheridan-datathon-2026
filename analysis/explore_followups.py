"""Follow-ups on surprises from the first four surveys."""
import numpy as np
import pandas as pd
from explore_common import DATA, OUT, head, monthly

t = pd.read_csv(OUT / "customers_explore.csv").set_index("account_id")
t = t.join(pd.read_csv(OUT / "customers_time.csv").set_index("account_id"))
ms = monthly()
ms["cal_month"] = ms.month.str[5:].astype(int)
ms["year"] = ms.month.str[:4].astype(int)

head("A. What makes June and December income jump? (component index, mean=100)")
c = ms.groupby("cal_month")[["cash_deposits", "transfers_in", "pension_in", "interest_in"]].mean()
print((100 * c / c.mean()).round(1).loc[[5, 6, 7, 11, 12, 1]].T)
print("share of accounts whose June income beats their own median by >10%:")
med = ms.groupby("account_id").money_in.median()
jun = ms[ms.cal_month == 6].groupby("account_id").money_in.mean()
dec = ms[ms.cal_month == 12].groupby("account_id").money_in.mean()
print("  June", round((jun / med > 1.1).mean(), 3), " Dec", round((dec / med > 1.1).mean(), 3))
print("bonus size (Jun income / median - 1), median among those with a bump:",
      round(((jun / med) - 1)[jun / med > 1.1].median(), 3))
print("pensioners get the bump too?", round(((jun / med) > 1.1)[t.pension_share.reindex(jun.index).fillna(0) >= .5].mean(), 3))

head("B. January spending spike: every year? (Jan out / that year's mean out)")
yo = ms.groupby(["year", "cal_month"]).money_out.mean().unstack()
print((yo[1] / yo.mean(axis=1)).round(3).to_dict(), " June:", (yo[6] / yo.mean(axis=1)).round(3).to_dict())
print("Does the spike follow the bonus? accounts with Dec bump: Jan out / median out")
mo = ms.groupby("account_id").money_out.median()
jan = ms[ms.cal_month == 1].groupby("account_id").money_out.mean()
bump = (dec / med > 1.1)
r = (jan / mo).reindex(bump.index)
print("  with Dec bump", round(r[bump].median(), 3), " without", round(r[~bump].median(), 3))
print("Lowest balance of the year: which calendar month?")
lo = ms.loc[ms.groupby(["account_id", "year"]).min_balance.idxmin()]
print(lo.cal_month.value_counts(normalize=True).round(3).head(6).to_dict())

head("C. Rich-but-fragile: savings rate by income decile")
t["I_dec"] = pd.qcut(t.I.rank(method="first"), 10, labels=[f"D{i}" for i in range(1, 11)])
t["save_rate_median"] = (t.I - t.S) / t.I.replace(0, np.nan)
t["save_rate_mean"] = (t.mean_in - t.mean_out) / t.mean_in.replace(0, np.nan)
print(t.groupby("I_dec", observed=True)[["save_rate_median", "save_rate_mean", "mix_cash_withdrawals_genuine",
      "mix_household_bills", "cv_in"]].median().round(3))
print("Does it hold without the EI cap and without pensioners? EI<3mo by decile, non-pensioners:")
np_ = t[t.pension_share.fillna(0) < .5]
print(np_.groupby("I_dec", observed=True).runway_ei55.apply(lambda r: round(100 * (r < 3).mean(), 1)).to_dict())
print("Spearman I vs B/S (non-pensioners):", round(np_[["I", "B"]].assign(bs=np_.B / np_.S).corr(method='spearman').loc["I", "bs"], 3))

head("D. Buffer as a 'set point': does each account hover around one balance level?")
g = ms[ms.groupby("account_id").cumcount() >= 3].groupby("account_id").avg_daily_balance
setpt = (g.std() / g.mean()).rename("bal_cv")
print("CV of monthly avg balance after month 3, quartiles:", setpt.quantile([.25, .5, .75]).round(3).to_dict())
print("CV of monthly money in, quartiles (for comparison):", t.cv_in.quantile([.25, .5, .75]).round(3).to_dict())

head("E. Fixed-salary customers (biggest credit identical every month)")
t["fixed_salary"] = t.main_credit_cv < 0.02
print(t.groupby("fixed_salary").agg(n=("I", "size"), I=("I", "median"), age=("owner_age", "median"),
      pension=("pension_share", lambda s: (s.fillna(0) >= .5).mean()), B=("B", "median"),
      ei=("runway_ei55", "median")).round(2))

head("F. High-fee statement customers: what's different?")
print(t.groupby("frequency").agg(n=("I", "size"), I=("I", "median"), age=("owner_age", "median"),
      tx=("tx_per_month", "median"), card=("card_type", lambda s: (s != "none").mean()),
      loan=("has_loan", "mean"), fees=("fees", "median"), neg=("neg_ever", "mean")).round(2))

head("G. Who goes below zero? (288 accounts)")
print(t.groupby("neg_ever").agg(I=("I", "median"), cv_in=("cv_in", "median"), cv_out=("cv_out", "median"),
      loan=("has_loan", "mean"), card=("card_type", lambda s: (s != "none").mean()),
      weekly=("frequency", lambda s: (s != "monthly statement").mean()), age=("owner_age", "median"),
      so_share=("so_share_I", "median")).round(3))
print("ever-negative among loan holders vs not:", t.groupby("has_loan").neg_ever.mean().round(3).to_dict())

head("H. Couples: does a second person change the money picture at the same income?")
t["I_q"] = pd.qcut(t.I, 4, labels=["Q1", "Q2", "Q3", "Q4"])
print(t.pivot_table(index="I_q", columns="shared_account", values="B", aggfunc="median", observed=True).round(0))
print(t.pivot_table(index="I_q", columns="shared_account", values="runway_ei55", aggfunc="median", observed=True))

head("I. Under-25s: high buffer at low income - who are they?")
y = t[t.owner_age < 25]
print("n", len(y), " junior card share", round((y.card_type == "junior").mean(), 3),
      " age min", round(y.owner_age.min(), 1), " under 18:", (y.owner_age < 18).sum(),
      " shared", round(y.shared_account.mean(), 3))
print("under-18 account owners: median I", round(t[t.owner_age < 18].I.median()), " B", round(t[t.owner_age < 18].B.median()))
