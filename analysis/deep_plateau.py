"""Deep dive: why higher earners are more fragile (4.1) and why balances plateau (4.13).

Hypotheses tested:
  H1 Comfort number: each account steers toward a target balance; money above it gets spent.
  H2 Buffer grows much slower than income (elasticity well below 1).
  H3 Where the excess goes when balance is above target.
  H4 High earners are 'pass-through' accounts (money in, money straight out to other banks).
  H5 Size of the fragility gap: what it would take to reach 3 months of cushion.
"""
import numpy as np
import pandas as pd

from explore_common import OUT, head, monthly

t = pd.read_csv(OUT / "customers_explore.csv").set_index("account_id")
ms = monthly()
ms = ms[ms.groupby("account_id").cumcount() >= 3].copy()   # skip the fill-up months
ms["net"] = ms.money_in - ms.money_out
rng = np.random.default_rng(0)

head("H1 Comfort number: does a balance above the account's usual level predict net outflow next month?")
g = ms.groupby("account_id")
ms["dev"] = ms.month_end_balance - g.month_end_balance.transform("median")
ms["dev_rel"] = ms.dev / g.money_in.transform("median").replace(0, np.nan)
ms["net_next"] = g.net.shift(-1)
ms["net_next_rel"] = ms.net_next / g.money_in.transform("median").replace(0, np.nan)
ok = ms.dropna(subset=["dev_rel", "net_next_rel"])
ok = ok[np.isfinite(ok.dev_rel) & np.isfinite(ok.net_next_rel)]
real = ok[["dev_rel", "net_next_rel"]].corr(method="spearman").iloc[0, 1]
print(f"spearman(balance above usual, next month's net flow) = {real:+.3f}  (n={len(ok):,})")


def shuffled_corr(df):
    """Null: shuffle each account's monthly net flows, rebuild balances as a random walk."""
    out = []
    for _, d in df.groupby("account_id"):
        net = rng.permutation(d.net.values)
        bal = d.month_end_balance.values[0] + np.cumsum(net)
        dev = bal - np.median(bal)
        out.append(pd.DataFrame({"dev": dev[:-1] / max(np.median(d.money_in), 1), "nn": net[1:] / max(np.median(d.money_in), 1)}))
    o = pd.concat(out)
    return o.corr(method="spearman").iloc[0, 1]


sample = rng.choice(ms.account_id.unique(), 800, replace=False)
null = [shuffled_corr(ms[ms.account_id.isin(sample)]) for _ in range(3)]
print("null (same flows, random order) spearman:", [round(x, 3) for x in null])
print("share of accounts with negative per-account correlation:",
      round(ok.groupby("account_id").apply(lambda d: d.dev_rel.rank().corr(d.net_next_rel.rank())
                                         if len(d) >= 8 else np.nan).lt(0).mean(), 3))
ok["dev_bin"] = pd.cut(ok.dev_rel, [-np.inf, -1, -0.25, 0.25, 1, np.inf],
                       labels=["far below", "below", "near usual", "above", "far above"])
print("next month's net flow (as share of usual income) by where balance sits:")
print(ok.groupby("dev_bin", observed=True).net_next_rel.agg(["size", "median", "mean"]).round(3))

head("H1b How does the plateau compare to income? (account median balance after month 3)")
plateau = g.month_end_balance.median()
t["plateau"] = plateau
t["plateau_months_income"] = t.plateau / t.I.replace(0, np.nan)
t["I_dec"] = pd.qcut(t.I.rank(method="first"), 10, labels=[f"D{i}" for i in range(1, 11)])
print(t.groupby("I_dec", observed=True).agg(I=("I", "median"), plateau=("plateau", "median"),
      p_months=("plateau_months_income", "median")).round(1).T)

head("H2 Elasticity: log(buffer) vs log(income), non-pensioners, I and B > 0")
w = t[(t.I > 0) & (t.B > 0) & (t.pension_share.fillna(0) < 0.5)]
slope, icpt = np.polyfit(np.log(w.I), np.log(w.B), 1)
print(f"slope = {slope:.2f}  (1.0 = buffer grows in step with income; 0 = fixed amount)")
print(f"  doubling income -> buffer x{2 ** slope:.2f}")
for lo_, hi_ in [(0, 5000), (5000, 12000), (12000, 1e9)]:
    s = w[(w.I >= lo_) & (w.I < hi_)]
    sl = np.polyfit(np.log(s.I), np.log(s.B), 1)[0]
    print(f"  income ${lo_:,.0f}-{hi_:,.0f}: slope {sl:.2f}  n={len(s)}")

head("H3 Where does money go in months after the balance is above usual?")
cols = ["cash_withdrawals_genuine", "household_bills", "transfers_out_other", "card_withdrawals", "money_out"]
nxt = ms.groupby("account_id")[cols].shift(-1)
base = ms.groupby("account_id")[cols].transform("median").replace(0, np.nan)
ratio = (nxt / base)
ratio["dev_bin"] = pd.cut(ms.dev_rel, [-np.inf, -0.25, 0.25, 1, np.inf], labels=["below", "near", "above", "far above"])
print("next-month spending vs the account's own median, by where balance sits (median ratio):")
print(ratio.groupby("dev_bin", observed=True)[["cash_withdrawals_genuine", "money_out"]].median().round(3))
print("share of months with a cash withdrawal > 2x the account's usual, by balance position:")
big = (nxt.cash_withdrawals_genuine > 2 * base.cash_withdrawals_genuine)
print(big.groupby(ratio.dev_bin, observed=True).mean().round(3).to_dict())

head("H4 Are high earners pass-through accounts?")
tot = monthly().groupby("account_id")[["cash_deposits", "transfers_in", "pension_in", "money_in",
                                       "transfers_out_other", "cash_withdrawals_genuine", "money_out"]].sum()
share = pd.DataFrame({
    "in_via_transfer": tot.transfers_in / tot.money_in,
    "in_via_cash": tot.cash_deposits / tot.money_in,
    "out_to_other_banks": tot.transfers_out_other / tot.money_out,
    "out_as_cash": tot.cash_withdrawals_genuine / tot.money_out,
    "kept": 1 - tot.money_out / tot.money_in,
})
print(share.join(t.I_dec).groupby("I_dec", observed=True).median().round(3))

head("H5 Fragility gap: dollars needed to reach 3 months of spending")
t["gap_to_3m"] = (3 * t.S - t.B).clip(lower=0)
t["monthly_surplus"] = (t.mean_in - t.mean_out).clip(lower=0)
t["months_to_close"] = t.gap_to_3m / t.monthly_surplus.replace(0, np.nan)
print(t.groupby("I_dec", observed=True).agg(short_pct=("gap_to_3m", lambda s: 100 * (s > 0).mean()),
      gap=("gap_to_3m", "median"), surplus=("monthly_surplus", "median"),
      months_to_close=("months_to_close", "median")).round(1))
print("if each customer saved their June+December bonus (half of the extra), months to close the gap:")
ms_all = monthly()
ms_all["cal"] = ms_all.month.str[5:].astype(int)
med_in = ms_all.groupby("account_id").money_in.median()
bonus = ms_all[ms_all.cal.isin([6, 12])].groupby("account_id").money_in.mean() - med_in
t["bonus_per_year"] = (2 * bonus.clip(lower=0)).reindex(t.index)
t["years_bonus_close"] = t.gap_to_3m / (0.5 * t.bonus_per_year).replace(0, np.nan)
print(t.groupby("I_dec", observed=True).years_bonus_close.median().round(2).to_dict())

t.reset_index().to_csv(OUT / "customers_plateau.csv", index=False)
