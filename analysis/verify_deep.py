"""Verification deep dive (Nov 7): which claims are real, which are artifacts?

  1  Saving elsewhere / fake income
     1a Cash round-tripping: is top earners' "income" cash they took out and put back in?
     1b Headline on accounts whose income arrives mostly by transfer (salary-like, not cash).
     1c Lumpy cash withdrawals: upper bound if big irregular withdrawals were saved, not spent.
  2  Hold-out: split accounts 50/50 at random, re-run the headline numbers on each half.
  3  Set point: after a windfall, does the balance drift back to where it was?
  4  Stronger thermostat test: backward-looking baseline, skip-a-month, and a matched null.
  5  Timing: is the seasonal spending pattern stable across years?
Run after build_customer_table.py and the deep_* scripts (needs output/customers_edge.csv).
"""
import numpy as np
import pandas as pd

from explore_common import DATA, OUT, head, monthly

rng = np.random.default_rng(7)
t = pd.read_csv(OUT / "customers_edge.csv").set_index("account_id")
t["cush"] = t.B / t.S.replace(0, np.nan)
npens = t.pension_share.fillna(0) < 0.5
EI_CAP = 729 * 52 / 12
ms = monthly()
ms["k"] = ms.groupby("account_id").cumcount()


def rho(a, b):
    return pd.Series(np.asarray(a)).rank().corr(pd.Series(np.asarray(b)).rank())


def elasticity(I, B):
    I, B = np.asarray(I), np.asarray(B)
    m = (I > 0) & (B > 0)
    return np.polyfit(np.log(I[m]), np.log(B[m]), 1)[0]


def runway(B, gap):
    with np.errstate(divide="ignore", invalid="ignore"):
        r = np.minimum(B / gap, 120)
    r = np.where(gap <= 0, 120.0, r)
    return np.where(B <= 0, 0.0, r)


def headline(df, label):
    d = pd.qcut(df.I.rank(method="first"), 10, labels=False)
    lt3 = runway(df.B.values, df.S.values - np.minimum(0.55 * df.I.values, EI_CAP)) < 3
    print(f"  {label:38s} n={len(df):5d}  cushion D1 {df.cush[d == 0].median():5.1f}  D10 {df.cush[d == 9].median():4.1f}"
          f"  elasticity {elasticity(df.I, df.B):.2f}  rho {rho(df.I, df.cush):+.2f}  D10 EI-cap<3mo {100 * lt3[d == 9].mean():4.1f}%")


np_t = t[npens].copy()
np_t["dec"] = pd.qcut(np_t.I.rank(method="first"), 10, labels=False)

# ------------------------------------------------------------------ 1a
head("1a. Cash round-tripping: deposits that match a cash withdrawal in the previous 7 days")
tx = pd.read_csv(DATA / "transactions.csv", usecols=["account_id", "date", "operation", "amount"], low_memory=False)
tx["date"] = pd.to_datetime(tx.date)
dep = tx[tx.operation == "cash deposit"][["account_id", "date", "amount"]].sort_values("date")
wd = tx[tx.operation == "cash withdrawal"][["account_id", "date", "amount"]].sort_values("date")
m = pd.merge_asof(dep, wd.rename(columns={"date": "wd_date", "amount": "wd_amt"}), left_on="date",
                  right_on="wd_date", by="account_id", direction="backward", tolerance=pd.Timedelta("7D"))
m["match"] = m.wd_amt.notna() & ((m.amount - m.wd_amt).abs() <= 0.10 * m.amount)
rt = m.groupby("account_id").apply(lambda d: d.amount[d.match].sum() / d.amount.sum(), include_groups=False)
np_t["roundtrip_share"] = rt.reindex(np_t.index).fillna(0)
print("share of cash deposits that look like a re-deposit of a recent withdrawal (amount within 10%, <=7 days):")
print(np_t.groupby("dec").roundtrip_share.agg(["mean", "median"]).round(3).T.rename(columns=lambda c: f"D{c + 1}"))
inc_tot = ms.groupby("account_id")[["cash_deposits", "transfers_in", "pension_in", "money_in"]].sum()
np_t = np_t.join((inc_tot.cash_deposits / inc_tot.money_in).rename("cash_share"))
print("cash share of all money in, by decile:",
      np_t.groupby("dec").cash_share.median().round(2).rename(lambda c: f"D{c + 1}").to_dict())
# Strip round-trips: remove matched deposits from income AND the matched withdrawal from spending.
adj = 1 - np_t.roundtrip_share * np_t.cash_share
np_t["I_adj"], np_t["S_adj"] = np_t.I * adj, np_t.S - np_t.I * (1 - adj)
x = np_t[(np_t.S_adj > 0)].assign(I=lambda d: d.I_adj, S=lambda d: d.S_adj)
x["cush"] = x.B / x.S
headline(np_t, "as published (non-pensioners)")
headline(x, "round-trips removed")

# ------------------------------------------------------------------ 1b
head("1b. Accounts whose income arrives mostly by bank transfer (salary-like, not cash)")
np_t["transfer_share"] = (inc_tot.transfers_in / inc_tot.money_in).reindex(np_t.index)
for cut in (0.5, 0.8):
    sub = np_t[np_t.transfer_share >= cut]
    headline(sub, f"transfer share of income >= {int(cut * 100)}%")
headline(np_t[np_t.cash_share >= 0.8], "cash share of income >= 80%")

# ------------------------------------------------------------------ 1c
head("1c. Lumpy cash withdrawals: upper bound if every withdrawal >= 2x the account's typical one was saved")
wd = wd.join(np_t[["dec"]], on="account_id").dropna(subset=["dec"])
typ = wd.groupby("account_id").amount.transform("median")
wd["lumpy"] = wd.amount >= 2 * typ
lump = wd[wd.lumpy].groupby("account_id").amount.sum()
spend_tot = ms.groupby("account_id").money_out.sum()
np_t["lumpy_share"] = (lump.reindex(np_t.index).fillna(0) / spend_tot.reindex(np_t.index))
print("share of all spending that is lumpy cash withdrawals:",
      np_t.groupby("dec").lumpy_share.median().round(3).rename(lambda c: f"D{c + 1}").to_dict())
months_n = ms.groupby("account_id").size().reindex(np_t.index)
yearly_lump = lump.reindex(np_t.index).fillna(0) / months_n * 12
np_t["cush_lump"] = (np_t.B + yearly_lump) / np_t.S      # one extra year of lumpy withdrawals kept as savings
for name, d in (("bottom 20%", np_t[np_t.dec <= 1]), ("top 10%", np_t[np_t.dec == 9])):
    print(f"  {name}: cushion {d.cush.median():.2f} -> {d.cush_lump.median():.2f} months "
          f"(adding a full year of lumpy withdrawals back as savings); under 3 months: {(d.cush_lump < 3).mean():.0%}")

# ------------------------------------------------------------------ 2
head("2. Hold-out: random 50/50 split of accounts")
for seed in (1, 2, 3):
    r = np.random.default_rng(seed).random(len(np_t)) < 0.5
    headline(np_t[r], f"seed {seed}, half A")
    headline(np_t[~r], f"seed {seed}, half B")

# ------------------------------------------------------------------ 3
head("3. Set point: windfall months (net inflow >= 1x usual income), balance path afterwards")
b = ms[ms.k >= 3].copy()
g = b.groupby("account_id")
b["Imed"] = g.money_in.transform("median").replace(0, np.nan)
b["net"] = b.money_in - b.money_out
b["base"] = g.month_end_balance.transform(lambda s: s.shift(1).rolling(3).median())
for h in range(0, 7):
    b[f"bal+{h}"] = g.month_end_balance.shift(-h)
ev = b[(b.net >= b.Imed) & b.base.notna() & b["bal+6"].notna()].copy()
ev = ev[ev.account_id.isin(np_t.index)]
ev = ev.join(np_t[["dec"]], on="account_id")
ev["windfall"] = ev["bal+0"] - ev.base
ev = ev[ev.windfall > 0]
for h in (1, 3, 6):
    ev[f"kept+{h}"] = (ev[f"bal+{h}"] - ev.base) / ev.windfall
print(f"n windfalls = {len(ev):,} in {ev.account_id.nunique():,} accounts")
print("median share of the windfall still in the account (1.0 = all kept, 0 = back to old level):")
tab = ev.groupby(pd.cut(ev.dec, [-1, 1, 7, 9], labels=["bottom 20%", "middle", "top 20%"]), observed=True)[
    ["kept+1", "kept+3", "kept+6"]].median().round(2)
tab.loc["all"] = ev[["kept+1", "kept+3", "kept+6"]].median().round(2)
print(tab)
print("share of windfalls mostly gone (<25% kept) after 6 months:", round((ev["kept+6"] < 0.25).mean(), 3))
# Null: same accounts, same windfall months, but subsequent net flows drawn at random from the account's
# own history (so drift and typical surplus are kept; only the response to the windfall is removed).
nets = b.groupby("account_id").net.apply(np.array)
sim = []
for _, r in ev.sample(min(4000, len(ev)), random_state=0).iterrows():
    draws = rng.choice(nets[r.account_id], 6)
    sim.append(1 + draws.cumsum()[[0, 2, 5]] / r.windfall)
sim = np.array(sim)
print("null (random-order own flows): median kept +1/+3/+6 =", np.round(np.median(sim, axis=0), 2))

# ------------------------------------------------------------------ 4
head("4. Thermostat: tests that can't come from measuring against the account's own future")
c = b.copy()
c["prev6"] = g.month_end_balance.transform(lambda s: s.shift(1).rolling(6).median())
c["dev_back"] = (c.month_end_balance - c.prev6) / c.Imed
c["dev_full"] = (c.month_end_balance - g.month_end_balance.transform("median")) / c.Imed
c["net1"] = g.net.shift(-1) / c.Imed
c["net2"] = g.net.shift(-2) / c.Imed
c["net0"] = c.net / c.Imed
c["avgdev"] = (c.avg_daily_balance - g.avg_daily_balance.transform(lambda s: s.shift(1).rolling(6).median())) / c.Imed
c = c.replace([np.inf, -np.inf], np.nan)


def corr(df, a, bcol):
    d = df[[a, bcol]].dropna()
    return rho(d[a], d[bcol]), len(d)


for a, bb, lab in (("dev_full", "net1", "published: vs whole-history median, next month"),
                   ("dev_back", "net1", "vs previous 6 months only, next month"),
                   ("dev_back", "net2", "vs previous 6 months, skip a month (t+2)"),
                   ("avgdev", "net2", "average daily balance, previous 6m, t+2")):
    r_, n_ = corr(c, a, bb)
    print(f"  {lab:50s} rho {r_:+.3f}  n={n_:,}")
# Partial out this month's own flow (payday timing): residualize next-month net on this month's net.
d = c[["dev_back", "net1", "net0"]].dropna()
res = d.net1.rank() - np.polyval(np.polyfit(d.net0.rank(), d.net1.rank(), 1), d.net0.rank())
print(f"  {'vs previous 6m, next month, controlling this month':50s} rho {rho(d.dev_back, res):+.3f}")


def null_back(df, lag):
    out = []
    for _, d in df.groupby("account_id"):
        net = rng.permutation(d.net.values)
        bal = d.month_end_balance.values[0] + np.cumsum(net)
        s = pd.Series(bal)
        prev = s.shift(1).rolling(6).median().values
        im = max(np.median(d.money_in), 1)
        dev = (bal - prev) / im
        nn = np.r_[net[lag:], [np.nan] * lag] / im
        out.append(pd.DataFrame({"dev": dev, "nn": nn}))
    o = pd.concat(out).dropna()
    return rho(o.dev, o.nn)


samp = rng.choice(c.account_id.unique(), 1000, replace=False)
cs = c[c.account_id.isin(samp)]
for lag, col in ((1, "net1"), (2, "net2")):
    nulls = [null_back(cs, lag) for _ in range(5)]
    r_, _ = corr(cs, "dev_back", col)
    print(f"  backward baseline, t+{lag}: real {r_:+.3f} vs shuffled-order null {np.mean(nulls):+.3f} "
          f"(range {min(nulls):+.3f}..{max(nulls):+.3f})")
c = c.join(np_t[["dec"]], on="account_id")
print("backward baseline, t+2, by income group:",
      {k: round(corr(dd, "dev_back", "net2")[0], 3) for k, dd in
       c.groupby(pd.cut(c.dec, [-1, 1, 7, 9], labels=["bottom 20%", "middle", "top 20%"]), observed=True)})

# ------------------------------------------------------------------ 5
head("5. Timing: is the seasonal spending pattern stable across years (out of sample)?")
s = ms[ms.k >= 3].copy()
s["yr"], s["cal"] = s.month.str[:4].astype(int), s.month.str[5:].astype(int)
s["rel"] = s.money_out / s.groupby(["account_id", "yr"]).money_out.transform("mean")
full = s.groupby(["account_id", "yr"]).cal.transform("size") == 12
pop_y = s[full].groupby(["yr", "cal"]).rel.mean().unstack().round(2)
print("population spending by calendar month, each year (1.00 = that year's average):")
print(pop_y)
# Per-account: estimate own pattern on 2021-2023, test on 2024-2025.
early = s[full & s.yr.between(2021, 2023)].groupby(["account_id", "cal"]).rel.mean().unstack()
late = s[full & s.yr.between(2024, 2025)].groupby(["account_id", "cal"]).rel.mean().unstack()
both = early.index.intersection(late.index)
pc = [np.corrcoef(early.loc[a], late.loc[a])[0, 1] for a in both]
print(f"per-account month pattern, 2021-23 vs 2024-25: median correlation {np.nanmedian(pc):.2f} (n={len(both):,})")
pop_e, pop_l = early.mean(), late.mean()
print(f"population pattern, 2021-23 vs 2024-25: correlation {np.corrcoef(pop_e, pop_l)[0, 1]:.2f}")
tm = pd.read_csv(OUT / "timing_by_start_month.csv")
print("published timing medians:", dict(zip(tm.start_month, tm.median_runway)))

# ------------------------------------------------------------------ 6
head("6. Customers with $0 recorded household bills: no bills, or bills we can't see?")
zero = set(t.index[t.H == 0])
so = pd.read_csv(DATA / "standing_orders.csv")
tot = ms.groupby("account_id")[["household_bills", "cash_withdrawals_genuine", "money_out"]].sum()
x = t.join(tot)
x["zero"] = x.index.isin(zero)
print("n:", x.zero.value_counts().to_dict())
print("ever paid a labelled bill:", x.groupby("zero").apply(lambda d: (d.household_bills > 0).mean(), include_groups=False).round(3).to_dict())
print("median monthly spending:", x.groupby("zero").S.median().round().to_dict())
print("cash share of all spending:", (x.groupby("zero").cash_withdrawals_genuine.sum() / x.groupby("zero").money_out.sum()).round(3).to_dict())
print("median owner age:", x.groupby("zero").owner_age.median().round(1).to_dict())
withb = x[~x.zero]
print(f"customers WITH bills: median ${withb.H.median():,.0f}/mo = {(withb.H / withb.S).median():.0%} of their spending")
sb = so[(so.purpose == "household bills") & so.account_id.isin(zero)]
txo = pd.read_csv(DATA / "transactions.csv", usecols=["account_id", "operation", "amount"], low_memory=False)
txo = txo[txo.account_id.isin(sb.account_id) & txo.operation.isin(["transfer out to another bank", "bill payment"])]
mm = txo.merge(sb[["account_id", "amount"]].rename(columns={"amount": "so_amt"}), on="account_id")
paid = mm[(mm.amount - mm.so_amt).abs() <= 0.01 * mm.so_amt].account_id.nunique()
# What else the $0-bill group touches
npn = x[x.pension_share.fillna(0) < 0.5].copy()
npn["dec"] = pd.qcut(npn.I.rank(method="first"), 10, labels=False) + 1
print("share with $0 bills by income decile (non-pensioners):", npn.groupby("dec").zero.mean().round(2).to_dict())
d10 = npn[npn.dec == 10]
print(f"top 10%: fixed costs F median, bills recorded ${d10[~d10.zero].F.median():,.0f} vs not ${d10[d10.zero].F.median():,.0f}; "
      f"bills share of spending (recorded) {(d10[~d10.zero].H / d10[~d10.zero].S).median():.1%}")
if "has_so" in x:
    noap = ~x.has_so
    print(f"no-autopay customers who also have $0 bills: {(noap & x.zero).sum() / noap.sum():.1%} of {noap.sum()}")
w = npn[~npn.zero]; qw = pd.qcut(w.I.rank(method="first"), 10, labels=False)
z = npn[npn.zero]; qz = pd.qcut(z.I.rank(method="first"), 5, labels=False)
print(f"headline within groups: bills recorded D1 {(w.B / w.S)[qw == 0].median():.1f} vs D10 {(w.B / w.S)[qw == 9].median():.1f} months; "
      f"no bills recorded bottom fifth {(z.B / z.S)[qz == 0].median():.1f} vs top fifth {(z.B / z.S)[qz == 4].median():.1f}")
print(f"$0-bill customers with a household-bills standing order: {sb.account_id.nunique()}; "
      f"of them, paying that exact amount by unlabelled transfer: {paid}")
