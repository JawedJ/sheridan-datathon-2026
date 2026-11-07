"""Per-account data for the app: judges' numbers, seasonal profile, bonus, personas.

Run after build_customer_table.py and the analysis scripts:
    .venv/bin/python build_app_data.py
Out: app/data.js  (window.CUSTOMERS = {...}; works when index.html is opened from disk)
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).parent
DATA, OUT, APP = ROOT / "data", ROOT / "output", ROOT / "app"
EI_WEEKLY_MAX = 729                       # 2026, canada.ca
EI_MONTHLY_MAX = EI_WEEKLY_MAX * 52 / 12

t = pd.read_csv(OUT / "customers_edge.csv").set_index("account_id")
ms = pd.read_csv(DATA / "monthly_summary.csv").sort_values(["account_id", "month"])
ms["cal"] = ms.month.str[5:].astype(int)

# ---- Seasonal spending factors: 50/50 blend of the account's own pattern and everyone's
pop = ms.groupby("cal").money_out.mean()
pop = pop / pop.mean()
own = ms.groupby(["account_id", "cal"]).money_out.mean().unstack()
own = own.div(own.mean(axis=1), axis=0)
season = (0.5 * own + 0.5 * pop).fillna(pop.to_dict())
season = season.div(season.mean(axis=1), axis=0)            # average factor = 1

# ---- Bonus months: June and December income vs the account's median
med_in = ms.groupby("account_id").money_in.median()
jd = ms[ms.cal.isin([6, 12])].groupby("account_id").money_in.mean()
bonus_pct = (jd / med_in.replace(0, np.nan) - 1).clip(lower=0).fillna(0)
t["bonus_pct"] = bonus_pct
t["has_bonus"] = t.bonus_pct > 0.1


def simulate(B, S, season_row, income, start_cal, one_off=0.0, max_months=120):
    """Month-by-month balance from start_cal; returns months until the buffer runs out."""
    bal = B - one_off
    if bal <= 0:
        return 0.0
    for k in range(max_months):
        m = (start_cal - 1 + k) % 12 + 1
        net = income - S * season_row[m]
        if net < 0 and bal + net < 0:
            return round(k + bal / -net, 1)
        bal += net
    return 120.0


# ---- Seasonal runway on EI for each start month (no bonus while on EI)
rows = []
for acct, r in t.iterrows():
    srow = season.loc[acct].to_dict() if acct in season.index else pop.to_dict()
    ei = 0.55 * r.I
    by_start = [simulate(r.B, r.S, srow, ei, m) for m in range(1, 13)]
    rows.append((acct, by_start))
seas = pd.DataFrame({a: v for a, v in rows}).T
seas.columns = range(1, 13)
finite = seas[(seas < 120).all(axis=1) & (seas > 0).all(axis=1)]
print("accounts with finite seasonal EI runway in every start month:", len(finite))
print("median (best start - worst start) months:", round((finite.max(axis=1) - finite.min(axis=1)).median(), 1))
worst = finite.idxmin(axis=1).value_counts(normalize=True).sort_index().round(3)
print("share of accounts whose WORST start month is each month:", worst.to_dict())
print("median runway by start month:", finite.median().round(1).to_dict())
pd.DataFrame({"start_month": range(1, 13), "median_runway": finite.median().round(2).values,
              "worst_share": [float(worst.get(m, 0)) for m in range(1, 13)], "n": len(finite)}
             ).to_csv(OUT / "timing_by_start_month.csv", index=False)
jud = t.loc[finite.index, "runway_ei55"]
print("median |seasonal(Jan start) - judges| months:", round((finite[1] - jud).abs().median(), 2))

# ---- Personas (plain-language tags from the findings)
t["persona_pension"] = t.pension_share.fillna(0) >= 0.5
t["persona_thin_high"] = (t.I_dec.isin(["D8", "D9", "D10"])) & (t.B < 3 * t.S) & ~t.persona_pension
t["persona_irregular"] = (t.cv_in > 0.6) & (~t.has_so | (t.so_share_I < 0.15))
t["persona_edge"] = t.edge_share > 0.25
t["persona_builder"] = t.trend == "building"
print("persona counts:", {c: int(t[c].sum()) for c in t.columns if c.startswith("persona_")})
print("overlap: irregular among edge", round(t[t.persona_edge].persona_irregular.mean(), 3),
      " edge among irregular", round(t[t.persona_irregular].persona_edge.mean(), 3))

# ---- Export
pop_season = {int(k): round(float(v), 3) for k, v in pop.items()}
out = {}
for acct, r in t.iterrows():
    srow = season.loc[acct] if acct in season.index else pop
    out[int(acct)] = {
        "I": round(r.I, 2), "S": round(r.S, 2), "F": round(r.F, 2), "H": round(r.H, 2),
        "B": round(r.B, 2), "P": round(r.P, 2),
        "mean_in": round(r.mean_in, 2), "mean_out": round(r.mean_out, 2),
        "pension_share": round(float(np.nan_to_num(r.pension_share)), 3),
        "age": None if pd.isna(r.owner_age) else round(r.owner_age, 1),
        "gender": r.owner_gender, "region": r.region, "district": r.district_name,
        "card": r.card_type, "shared": bool(r.shared_account), "frequency": r.frequency,
        "income_decile": int(str(r.I_dec)[1:]), "cv_in": round(float(np.nan_to_num(r.cv_in)), 3),
        "plateau": round(r.plateau, 2), "trend": r.trend if isinstance(r.trend, str) else None,
        "edge_share": round(r.edge_share, 3), "neg_ever": bool(r.neg_ever), "has_so": bool(r.has_so),
        "bonus_pct": round(r.bonus_pct, 3), "has_bonus": bool(r.has_bonus),
        "cash_share": round(float(np.nan_to_num(r.mix_cash_withdrawals_genuine)), 3),
        "season": [round(float(srow[m]), 3) for m in range(1, 13)],
        "personas": [p for p, c in [("pensioner", "persona_pension"), ("thin_high", "persona_thin_high"),
                                    ("irregular", "persona_irregular"), ("edge", "persona_edge"),
                                    ("builder", "persona_builder")] if r[c]],
    }

examples = {
    "thin_high": int(t[t.persona_thin_high & (t.I_dec == "D10")].sample(1, random_state=1).index[0]),
    "edge": int(t[t.persona_edge & t.persona_irregular].sample(1, random_state=1).index[0]),
    "pensioner": int(t[t.persona_pension].sample(1, random_state=1).index[0]),
    "builder": int(t[t.persona_builder & t.has_bonus & ~t.persona_pension].sample(1, random_state=1).index[0]),
    "judges_example": 20111,
}
APP.mkdir(exist_ok=True)
meta = {"ei_monthly_max": round(EI_MONTHLY_MAX, 2), "ei_weekly_max": EI_WEEKLY_MAX,
        "pop_season": pop_season, "examples": examples,
        "median_bills_share": 0.199}
(APP / "data.js").write_text("window.META = " + json.dumps(meta) + ";\nwindow.CUSTOMERS = " +
                             json.dumps(out, separators=(",", ":")) + ";\n")
print("examples:", examples)
print("wrote", APP / "data.js", f"{(APP / 'data.js').stat().st_size / 1e6:.1f} MB")
