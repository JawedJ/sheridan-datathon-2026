"""Data for the web engine -> web/public/engine.json (+ test fixtures, timing summary).

Run after build_customer_table.py and the analysis scripts (needs output/customers_edge.csv):
    .venv/bin/python build_engine_data.py

engine.json is columnar (one array per field, same order as `id`) to keep it small.
Writes:
  web/public/engine.json            per-customer numbers the app needs
  output/judges_expected.csv        judges' runways for the standard shocks (engine test fixture)
  output/timing_by_start_month.csv  median EI runway by layoff month (charts)
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).parent
DATA, OUT, WEB = ROOT / "data", ROOT / "output", ROOT / "web" / "public"
EI_WEEKLY_MAX = 729                              # 2026, canada.ca
EI_MONTHLY_MAX = EI_WEEKLY_MAX * 52 / 12
BILLS_SHARE = 0.199                              # median bills share of spending, customers who have bills

t = pd.read_csv(OUT / "customers_edge.csv").set_index("account_id").sort_index()
ms = pd.read_csv(DATA / "monthly_summary.csv").sort_values(["account_id", "month"])
ms["cal"] = ms.month.str[5:].astype(int)

# Seasonal spending factors: 50/50 blend of the account's own pattern and everyone's; mean = 1
pop = ms.groupby("cal").money_out.mean()
pop = pop / pop.mean()
own = ms.groupby(["account_id", "cal"]).money_out.mean().unstack()
own = own.div(own.mean(axis=1), axis=0)
season = (0.5 * own + 0.5 * pop).fillna(pop.to_dict())
season = season.div(season.mean(axis=1), axis=0).reindex(t.index).fillna(pop.to_dict())

# Bonus months: June/December income vs the account's median
med_in = ms.groupby("account_id").money_in.median()
jd = ms[ms.cal.isin([6, 12])].groupby("account_id").money_in.mean()
t["bonus_pct"] = (jd / med_in.replace(0, np.nan) - 1).clip(lower=0).fillna(0)
t.loc[t.bonus_pct <= 0.1, "bonus_pct"] = 0.0

t["pensioner"] = t.pension_share.fillna(0) >= 0.5
t["bills_zero"] = t.H == 0
t["edge"] = t.edge_share > 0.25
t["irregular"] = (t.cv_in > 0.6) & (~t.has_so | (t.so_share_I < 0.15))
np_mask = ~t.pensioner
t["decile"] = 0
t.loc[np_mask, "decile"] = pd.qcut(t.loc[np_mask, "I"].rank(method="first"), 10, labels=False) + 1


def runway(B, gap):
    B, gap = np.asarray(B, float), np.asarray(gap, float)
    with np.errstate(divide="ignore", invalid="ignore"):
        r = np.minimum(B / gap, 120)
    r = np.where(gap <= 0, 120.0, r)
    return np.round(np.where(B <= 0, 0.0, r), 1)


# ---- Test fixture: judges' runways for the README's standard shocks
exp = pd.DataFrame({
    "account_id": t.index,
    "I": t.I, "S": t.S, "F": t.F, "H": t.H, "B": t.B, "P": t.P,
    "base": runway(t.B, t.S - t.I),
    "ei55": runway(t.B, t.S - 0.55 * t.I),
    "furnace": runway(t.B - t.S, t.S - t.I),
    "ei55_bills15": runway(t.B, t.S + 0.15 * t.H - 0.55 * t.I),
    "bills15": runway(t.B, t.S + 0.15 * t.H - t.I),
})
exp.to_csv(OUT / "judges_expected.csv", index=False)


# ---- Timing summary (median EI runway by layoff month), same model the app uses
def simulate(B, S, srow, income, start, max_m=120):
    """Same model as the app's month-by-month path: spending = S x seasonal factor, EI income flat."""
    bal = B
    if bal <= 0:
        return 0.0
    for k in range(max_m):
        m = (start - 1 + k) % 12
        net = income - S * srow[m]
        if net < 0 and bal + net < 0:
            return round(k + bal / -net, 1)
        bal += net
    return 120.0


rows = {}
for acct, r in t.iterrows():
    if r.pensioner:
        continue                      # job loss doesn't apply
    srow = season.loc[acct].values
    rows[acct] = [simulate(r.B, r.S, srow, 0.55 * r.I, m) for m in range(1, 13)]
seas = pd.DataFrame(rows).T
seas.columns = range(1, 13)
finite = seas[(seas < 120).all(axis=1) & (seas > 0).all(axis=1)]
worst = finite.idxmin(axis=1).value_counts(normalize=True)
pd.DataFrame({"start_month": range(1, 13), "median_runway": finite.median().round(2).values,
              "worst_share": [float(worst.get(m, 0)) for m in range(1, 13)], "n": len(finite)}
             ).to_csv(OUT / "timing_by_start_month.csv", index=False)
print("timing: median runway by start month", finite.median().round(1).to_dict())
print(f"timing: {len(finite)} customers; median best-vs-worst start month gap "
      f"{(finite.max(axis=1) - finite.min(axis=1)).median():.1f} months; "
      f"worst month is Jan/Jun/Dec for {100 * worst.reindex([1, 6, 12]).sum():.1f}%")


# ---- engine.json
def col(s, nd=2):
    return [None if pd.isna(v) else round(float(v), nd) for v in s]


eng = {
    "meta": {
        "ei_weekly_max": EI_WEEKLY_MAX, "ei_monthly_max": round(EI_MONTHLY_MAX, 2),
        "bills_share": BILLS_SHARE, "n": int(len(t)),
        "pop_season": [round(float(pop[m]), 3) for m in range(1, 13)],
        "decile_cushion": {int(d): round(float((g.B / g.S).median()), 2)
                           for d, g in t[np_mask].groupby("decile")},
        "decile_comfort": {int(d): round(float(g.plateau.median())) for d, g in t[np_mask].groupby("decile")},
        "source": "PKDD'99 Financial dataset (CAD); EI: canada.ca 2026",
    },
    "id": [int(i) for i in t.index],
    # full precision: runway sits on 1-decimal rounding boundaries, so cents-rounded inputs can flip it
    "I": col(t.I, 8), "S": col(t.S, 8), "F": col(t.F, 8), "H": col(t.H, 8), "B": col(t.B, 8), "P": col(t.P, 8),
    "mean_in": col(t.mean_in), "mean_out": col(t.mean_out),
    "comfort": col(t.plateau, 0),
    "cash_share": col(t.mix_cash_withdrawals_genuine, 3),
    "pension_share": col(t.pension_share.fillna(0), 3),
    "bonus_pct": col(t.bonus_pct, 3),
    "season": [[round(float(x), 3) for x in season.loc[a].values] for a in t.index],
    "age": col(t.owner_age, 0),
    "gender": t.owner_gender.fillna("").tolist(),
    "district": t.district_name.fillna("").tolist(),
    "region": t.region.fillna("").tolist(),
    "decile": [int(x) for x in t.decile],
    "months": [int(x) for x in t.months],
    "flags": [
        "".join(c for c, on in [("p", r.pensioner), ("b", r.bills_zero), ("n", r.neg_ever),
                                 ("e", r.edge), ("i", r.irregular), ("a", r.has_so),
                                 ("s", bool(r.shared_account))] if on)
        for r in t.itertuples()
    ],
}
WEB.mkdir(parents=True, exist_ok=True)
(WEB / "engine.json").write_text(json.dumps(eng, separators=(",", ":")))
print(f"wrote {WEB / 'engine.json'} ({(WEB / 'engine.json').stat().st_size / 1e6:.2f} MB), {len(t)} customers")
