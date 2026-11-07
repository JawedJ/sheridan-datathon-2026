"""Money behaviour: does saving scale with income, income stability, balance trends,
living close to zero, spending mix, standing orders, interest, fees."""
import numpy as np
import pandas as pd

from explore_common import DATA, customers, head, monthly, profile

t = customers().set_index("account_id")
ms = monthly()
so = pd.read_csv(DATA / "standing_orders.csv")

head("Does the buffer scale with income? (income deciles)")
t["I_dec"] = pd.qcut(t.I.rank(method="first"), 10, labels=[f"D{i}" for i in range(1, 11)])
print(profile(t.reset_index(), "I_dec"))
print("spearman I vs B:", round(t[["I", "B"]].corr(method="spearman").iloc[0, 1], 3))
print("B / I (months of income held), median by decile:")
print((t.groupby("I_dec", observed=True).apply(lambda g: (g.B / g.I.replace(0, np.nan)).median())).round(2).to_dict())

head("Income stability: coefficient of variation of monthly money in")
g = ms.groupby("account_id").money_in
t["cv_in"] = (g.std() / g.mean().replace(0, np.nan))
t["cv_out"] = ms.groupby("account_id").money_out.std() / ms.groupby("account_id").money_out.mean().replace(0, np.nan)
print("cv_in quartiles:", t.cv_in.quantile([.25, .5, .75]).round(2).to_dict())
print("cv_out quartiles:", t.cv_out.quantile([.25, .5, .75]).round(2).to_dict())
t["cv_band"] = pd.qcut(t.cv_in, 4, labels=["steady", "q2", "q3", "volatile"])
print(profile(t.reset_index(), "cv_band"))

head("Balance trend: last 12 months, slope of month-end balance ($/month)")
def slope(s):
    s = s.tail(12)
    x = np.arange(len(s))
    return np.polyfit(x, s.values, 1)[0] if len(s) >= 6 else np.nan
t["bal_slope"] = ms.groupby("account_id").month_end_balance.apply(slope)
t["slope_rel"] = t.bal_slope / t.I.replace(0, np.nan)
print("share of accounts with balance rising:", round((t.bal_slope > 0).mean(), 3))
print("slope as % of monthly income, quartiles:", (100 * t.slope_rel).quantile([.1, .25, .5, .75, .9]).round(1).to_dict())
t["trend"] = pd.cut(t.slope_rel, [-np.inf, -0.05, 0.05, np.inf], labels=["draining", "flat", "building"])
print(profile(t.reset_index(), "trend"))

head("Living close to zero: monthly low point vs monthly income")
ms["low_ratio"] = ms.min_balance / ms.money_in.replace(0, np.nan)
close = ms.assign(close=ms.low_ratio < 0.25).groupby("account_id").close.mean()
t["close_share"] = close
print("share of months where the lowest balance < 25% of that month's income: quartiles",
      close.quantile([.25, .5, .75, .9]).round(3).to_dict())
t["p2p"] = pd.cut(t.close_share, [-0.01, 0.0, 0.25, 0.75, 1.0], labels=["never", "sometimes", "often", "almost always"])
print(profile(t.reset_index(), "p2p"))

head("Where in the month does the balance bottom out? (min / avg daily balance)")
ms["min_over_avg"] = ms.min_balance / ms.avg_daily_balance.replace(0, np.nan)
print("median min/avg per month:", round(ms.min_over_avg.median(), 3))

head("Spending mix archetypes (share of lifetime money out)")
cols = ["household_bills", "insurance", "loan_payments", "bank_fees", "cash_withdrawals_genuine",
        "card_withdrawals", "transfers_out_other"]
mix = ms.groupby("account_id")[cols + ["money_out"]].sum()
mix = mix[cols].div(mix.money_out.replace(0, np.nan), axis=0)
t = t.join(mix.add_prefix("mix_"))
t["archetype"] = np.select(
    [t.mix_cash_withdrawals_genuine > 0.95, t.mix_household_bills > 0.3, t.mix_transfers_out_other > 0.2],
    ["all-cash", "bill-heavy", "transfer-heavy"], "mixed")
print(profile(t.reset_index(), "archetype"))

head("Standing orders: what they are and who has them")
so["purpose"] = so.purpose.fillna("other")
print(so.groupby("purpose").amount.agg(["size", "median"]).round(0))
print("accounts with any standing order:", round(t.index.isin(so.account_id).mean(), 3))
for p in ["leasing", "insurance", "household bills", "loan payment", "other"]:
    has = t.index.isin(so[so.purpose == p].account_id)
    print(f"  has {p:16s}: {has.mean():.3f}  median B {t.B[has].median():>8,.0f} vs {t.B[~has].median():>8,.0f}"
          f"  EI<3mo {100*(t.runway_ei55[has] < 3).mean():4.1f}% vs {100*(t.runway_ei55[~has] < 3).mean():4.1f}%")
t["so_share_I"] = t.so_total / t.I.replace(0, np.nan)
print("standing orders as share of income, quartiles:", t.so_share_I.quantile([.25, .5, .75, .9]).round(2).to_dict())
print("standing-order household bills vs monthly_summary median H (accounts with both):")
sob = so[so.purpose == "household bills"].groupby("account_id").amount.sum()
both = t.join(sob.rename("so_hb"), how="inner")
print("  median ratio so_hb / H:", round((both.so_hb / both.H.replace(0, np.nan)).median(), 3))

head("Partner banks")
print(so.to_bank.value_counts().head(13).to_dict())

head("Interest paid by the bank (implied annual rate)")
iy = ms.groupby("account_id").agg(interest=("interest_in", "sum"), bal=("avg_daily_balance", "mean"), m=("month", "size"))
rate = (iy.interest / iy.m * 12) / iy.bal.replace(0, np.nan)
print("implied annual rate, quartiles:", rate.quantile([.1, .25, .5, .75, .9]).round(4).to_dict())

head("Bank fees and penalty interest")
fees = ms.groupby("account_id").bank_fees.sum()
t["fees"] = fees
print("total bank fees, all customers $:", round(fees.sum()), " share of customers paying any:", round((fees > 0).mean(), 3))
t["neg_ever"] = t.days_below_zero_total > 0
print("ever below zero:", t.neg_ever.sum(), round(t.neg_ever.mean(), 3))
print(profile(t.reset_index(), "neg_ever"))
print("fees per month, by statement frequency:")
print((t.groupby("frequency").fees.median() / t.groupby("frequency").months.median()).round(1).to_dict())

head("Cash habits: average withdrawal size and round numbers (from monthly totals)")
print("median share of spending that is cash, by age band:")
t["age_band"] = pd.cut(t.owner_age, [0, 25, 35, 45, 55, 65, 120], labels=["<25", "25-34", "35-44", "45-54", "55-64", "65+"])
print(t.groupby("age_band", observed=True).mix_cash_withdrawals_genuine.median().round(3).to_dict())
print("card holders vs not, cash share:", t.groupby(t.card_type != "none").mix_cash_withdrawals_genuine.median().round(3).to_dict())

t.reset_index().to_csv(DATA.parent / "output" / "customers_explore.csv", index=False)
