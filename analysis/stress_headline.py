"""Stress test for the main headline: 'higher earners hold fewer months of cushion; buffer
barely grows with income'. Also tests the 'savings kept at another bank' objection.

Sections
  A  Measurement noise: split-half (odd vs even months) so the income used to rank people and the
     spending/income used in the outcome come from different months. Corrects the elasticity for
     attenuation.
  B  Subgroups: region, account age, gender, shared, without pensioners, without volatile income.
  C  Other buffer definitions: 12-month average, plateau, lowest balance in last 12 months.
  D  Year by year (2022-2025).
  E  Bootstrap 95% intervals for the key numbers.
  F  Thermostat effect by income band.
  G  Savings elsewhere?
"""
import numpy as np
import pandas as pd

from explore_common import DATA, OUT, head, monthly

rng = np.random.default_rng(42)
t = pd.read_csv(OUT / "customers_edge.csv").set_index("account_id")
ms = monthly()
ms["k"] = ms.groupby("account_id").cumcount()
ms["year"] = ms.month.str[:4].astype(int)
so = pd.read_csv(DATA / "standing_orders.csv")
EI_CAP = 729 * 52 / 12
npens = t.pension_share.fillna(0) < 0.5


def spearman(a, b):
    return pd.Series(a).rank().corr(pd.Series(b).rank())


def elasticity(I, B):
    m = (I > 0) & (B > 0)
    return np.polyfit(np.log(I[m]), np.log(B[m]), 1)[0]


def runway(B, gap):
    with np.errstate(divide="ignore", invalid="ignore"):
        r = np.minimum(B / gap, 120)
    r = np.where(gap <= 0, 120.0, r)
    return np.where(B <= 0, 0.0, r)


# ------------------------------------------------------------------ A
head("A. Measurement noise: split-half (odd vs even months), non-pensioners")
body = ms[ms.k >= 3]
odd, even = body[body.k % 2 == 1], body[body.k % 2 == 0]
sh = pd.DataFrame({
    "I_odd": odd.groupby("account_id").money_in.median(),
    "I_even": even.groupby("account_id").money_in.median(),
    "S_odd": odd.groupby("account_id").money_out.median(),
    "S_even": even.groupby("account_id").money_out.median(),
}).join(t[["B"]])
sh = sh[npens.reindex(sh.index).fillna(False)]
sh = sh[(sh.I_odd > 0) & (sh.I_even > 0) & (sh.B > 0)]
rel = np.corrcoef(np.log(sh.I_odd), np.log(sh.I_even))[0, 1]
naive = elasticity(sh.I_odd.values, sh.B.values)
iv = np.cov(np.log(sh.B), np.log(sh.I_even))[0, 1] / np.cov(np.log(sh.I_odd), np.log(sh.I_even))[0, 1]
print(f"reliability of log income (odd vs even months): {rel:.3f}")
print(f"elasticity naive (odd-month income): {naive:.3f}   corrected (instrumented by even months): {iv:.3f}")
print(f"  -> doubling income raises buffer x{2 ** iv:.2f} (corrected)")
sh["dec"] = pd.qcut(sh.I_odd.rank(method="first"), 10, labels=[f"D{i}" for i in range(1, 11)])
sh["cush_even"] = sh.B / sh.S_even
print("months of cushion by decile, ranked on ODD-month income, cushion uses EVEN-month spending:")
print(sh.groupby("dec", observed=True).cush_even.median().round(2).to_dict())
print("spearman(I_odd, B/S_even):", round(spearman(sh.I_odd, sh.cush_even), 3))

# ------------------------------------------------------------------ B
head("B. Subgroups: spearman(income, months of cushion) and top-vs-bottom quintile cushion")
t["cush"] = t.B / t.S.replace(0, np.nan)
t["acct_age"] = pd.cut((pd.Timestamp("2025-12-31") - pd.to_datetime(t.account_opened)).dt.days / 365.25,
                       [0, 2, 3, 4, 7], labels=["1-2y", "2-3y", "3-4y", "4y+"])


def sub(df, label):
    q = pd.qcut(df.I.rank(method="first"), 5, labels=False)
    lo, hi = df.cush[q == 0].median(), df.cush[q == 4].median()
    print(f"  {label:32s} n={len(df):5d}  rho={spearman(df.I, df.cush):+.2f}  "
          f"cushion bottom 20% {lo:5.1f} mo  top 20% {hi:4.1f} mo  holds={'yes' if hi < lo else 'NO'}")


np_t = t[npens]
sub(np_t, "all non-pensioners")
for r, d in np_t.groupby("region"):
    sub(d, f"region: {r}")
for a, d in np_t.groupby("acct_age", observed=True):
    sub(d, f"account age: {a}")
for g, d in np_t.groupby("owner_gender"):
    sub(d, f"gender: {g}")
for s, d in np_t.groupby("shared_account"):
    sub(d, f"shared: {s}")
sub(np_t[np_t.cv_in <= 0.6], "steady income only (cv<=0.6)")
sub(np_t[(np_t.has_so)], "has autopay")
sub(t, "everyone incl. pensioners")

# ------------------------------------------------------------------ C
head("C. Other buffer definitions (non-pensioners): elasticity vs income, cushion top/bottom decile")
g = ms.sort_values(["account_id", "month"]).groupby("account_id")
defs = pd.DataFrame({
    "B6 (judges)": t.B,
    "B12 mean daily balance": g.avg_daily_balance.apply(lambda s: s.tail(12).mean()),
    "plateau (median month-end, after month 3)": t.plateau,
    "lowest balance, last 12 months": g.min_balance.apply(lambda s: s.tail(12).min()),
    "whole-history mean daily balance": g.avg_daily_balance.mean(),
}).loc[np_t.index]
dec = pd.qcut(np_t.I.rank(method="first"), 10, labels=False)
for c in defs.columns:
    b = defs[c]
    cush = b / np_t.S
    print(f"  {c:44s} elasticity {elasticity(np_t.I.values, b.values):.2f}   "
          f"cushion D1 {cush[dec == 0].median():5.1f}  D10 {cush[dec == 9].median():4.1f}")

# ------------------------------------------------------------------ D
head("D. Year by year (account-years with 12 months, non-pensioners)")
ay = ms[ms.k >= 3].groupby(["account_id", "year"]).agg(n=("month", "size"), I=("money_in", "median"),
                                                         S=("money_out", "median"), B=("avg_daily_balance", "mean"))
ay = ay[(ay.n == 12)].reset_index()
ay = ay[ay.account_id.isin(np_t.index)]
for y, d in ay.groupby("year"):
    d = d[(d.I > 0) & (d.B > 0)]
    q = pd.qcut(d.I.rank(method="first"), 10, labels=False)
    c = d.B / d.S
    print(f"  {y}: n={len(d):5d}  elasticity {elasticity(d.I.values, d.B.values):.2f}  "
          f"cushion D1 {c[q == 0].median():5.1f}  D10 {c[q == 9].median():4.1f}  rho {spearman(d.I, c):+.2f}")

# ------------------------------------------------------------------ E
head("E. Bootstrap 95% intervals (1,000 resamples of customers)")
dec_all = pd.qcut(t.I.rank(method="first"), 10, labels=False)
d10, d1 = t[dec_all == 9], t[dec_all == 0]


def boot(f, n=1000):
    vals = [f() for _ in range(n)]
    return np.percentile(vals, [2.5, 97.5])


def rs(df):
    return df.iloc[rng.integers(0, len(df), len(df))]


ei_cap = lambda df: (runway(df.B.values, df.S.values - np.minimum(0.55 * df.I.values, EI_CAP)) < 3).mean()
ei_j = lambda df: (runway(df.B.values, df.S.values - 0.55 * df.I.values) < 3).mean()
print(f"  D10 EI<3mo, real cap   {100 * ei_cap(d10):.1f}%  CI {np.round(100 * boot(lambda: ei_cap(rs(d10))), 1)}")
print(f"  D10 EI<3mo, judges     {100 * ei_j(d10):.1f}%  CI {np.round(100 * boot(lambda: ei_j(rs(d10))), 1)}")
print(f"  D1  EI<3mo, judges     {100 * ei_j(d1):.1f}%  CI {np.round(100 * boot(lambda: ei_j(rs(d1))), 1)}")
print(f"  D10 cushion months     {d10.cush.median():.2f}  CI {np.round(boot(lambda: rs(d10).cush.median()), 2)}")
print(f"  D1  cushion months     {d1.cush.median():.2f}  CI {np.round(boot(lambda: rs(d1).cush.median()), 2)}")
sh_r = sh.reset_index()
print(f"  corrected elasticity   {iv:.3f}  CI ", np.round(boot(lambda: (lambda s: np.cov(np.log(s.B), np.log(s.I_even))[0, 1] /
      np.cov(np.log(s.I_odd), np.log(s.I_even))[0, 1])(rs(sh_r)), 300), 3))

# ------------------------------------------------------------------ F
head("F. Thermostat by income band: next-month net flow when balance is far above vs below usual")
b2 = ms[ms.k >= 3].copy()
gg = b2.groupby("account_id")
b2["dev"] = (b2.month_end_balance - gg.month_end_balance.transform("median")) / gg.money_in.transform("median").replace(0, np.nan)
b2["net_next"] = gg.money_in.shift(-1) - gg.money_out.shift(-1)
b2["net_next"] = b2.net_next / gg.money_in.transform("median").replace(0, np.nan)
b2 = b2.join(pd.qcut(t.I.rank(method="first"), 5, labels=["Q1", "Q2", "Q3", "Q4", "Q5"]).rename("Iq"), on="account_id")
b2 = b2[np.isfinite(b2.dev) & np.isfinite(b2.net_next)]
b2["pos"] = pd.cut(b2.dev, [-np.inf, -0.25, 0.25, 1, np.inf], labels=["below", "near", "above", "far above"])
print(b2.pivot_table(index="Iq", columns="pos", values="net_next", aggfunc="median", observed=True).round(3))
print("spearman(dev, next net) by income quintile:",
      {q: round(spearman(d.dev, d.net_next), 3) for q, d in b2.groupby("Iq", observed=True)})

# ------------------------------------------------------------------ G
head("G. Savings elsewhere? Money sent to other banks, by income decile")
tot = ms.groupby("account_id")[["transfers_out_other", "money_out", "money_in"]].sum()
so_other = so[so.purpose.isna()].groupby("account_id").amount.sum()      # unlabelled standing orders
so_ins = so[so.purpose == "insurance"].groupby("account_id").amount.sum()
x = t[["I", "B", "S", "cush"]].join(tot)
x["dec"] = pd.qcut(x.I.rank(method="first"), 10, labels=[f"D{i}" for i in range(1, 11)])
x["out_other_share"] = x.transfers_out_other / x.money_out
x["any_out_other"] = x.transfers_out_other > 0
x["so_other_share"] = so_other.reindex(x.index).fillna(0) / x.I.replace(0, np.nan)
x["has_ins"] = x.index.isin(so_ins.index)
print(x.groupby("dec", observed=True).agg(any_transfer_out=("any_out_other", "mean"),
      transfer_out_share=("out_other_share", "median"), other_standing_order_share=("so_other_share", "median"),
      insurance_order=("has_ins", "mean")).round(3).T)
top = x[x.dec.isin(["D8", "D9", "D10"])]
print("top 30% earners: cushion with any transfer-out vs none:",
      top.groupby("any_out_other").cush.median().round(2).to_dict(),
      " n:", top.any_out_other.value_counts().to_dict())
top_so = top.so_other_share > 0.05
print("top 30%: unlabelled standing orders > 5% of income:", round(top_so.mean(), 3),
      " cushion with vs without:", round(top.cush[top_so].median(), 2), "vs", round(top.cush[~top_so].median(), 2))
# Upper bound: count EVERY dollar ever sent to other banks, plus every unlabelled standing order for
# every month of history, as hidden savings that were never spent.
n_months = ms.groupby("account_id").size()
x["hidden"] = x.transfers_out_other + so_other.reindex(x.index).fillna(0) * n_months.reindex(x.index)
x["cush_plus"] = (x.B + x.hidden) / x.S
top = x[x.dec.isin(["D8", "D9", "D10"])]
bot = x[x.dec.isin(["D1", "D2"])]
print("UPPER BOUND, all outbound money treated as hidden savings:")
print("  top 30% cushion", round(top.cush.median(), 2), "->", round(top.cush_plus.median(), 2),
      " still under 3 months:", round((top.cush_plus < 3).mean(), 3))
print("  bottom 20% cushion", round(bot.cush.median(), 2), "->", round(bot.cush_plus.median(), 2))
