"""Data for the headline charts -> charts/charts.js

Run after build_engine_data.py:  .venv/bin/python build_chart_data.py
All decile figures exclude pensioners (job loss doesn't apply to them), matching the stress test.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).parent
DATA, OUT, CHARTS = ROOT / "data", ROOT / "output", ROOT / "charts"
EI_CAP = 729 * 52 / 12

t = pd.read_csv(OUT / "customers_edge.csv").set_index("account_id")
t = t[t.pension_share.fillna(0) < 0.5]
t["dec"] = pd.qcut(t.I.rank(method="first"), 10, labels=False) + 1


def runway(B, gap):
    with np.errstate(divide="ignore", invalid="ignore"):
        r = np.minimum(B / gap, 120)
    r = np.where(gap <= 0, 120.0, r)
    return np.where(B <= 0, 0.0, r)


t["rw_judges"] = runway(t.B.values, (t.S - 0.55 * t.I).values)
t["rw_cap"] = runway(t.B.values, (t.S - np.minimum(0.55 * t.I, EI_CAP)).values)
deciles = []
for d, g in t.groupby("dec"):
    deciles.append({
        "decile": int(d), "n": int(len(g)),
        "income": round(g.I.median()), "spending": round(g.S.median()),
        "buffer": round(g.B.median()), "comfort": round(g.plateau.median()),
        "three_months": round(3 * g.S.median()),
        "cushion_months": round(float((g.B / g.S).median()), 2),
        "ei_lt3_judges": round(100 * float((g.rw_judges < 3).mean()), 1),
        "ei_lt3_cap": round(100 * float((g.rw_cap < 3).mean()), 1),
    })

# Thermostat: next month's net flow by balance position, bottom vs top income quintile
ms = pd.read_csv(DATA / "monthly_summary.csv").sort_values(["account_id", "month"])
ms["k"] = ms.groupby("account_id").cumcount()
ms = ms[ms.k >= 3].copy()
g = ms.groupby("account_id")
usual_in = g.money_in.transform("median").replace(0, np.nan)
ms["dev"] = (ms.month_end_balance - g.month_end_balance.transform("median")) / usual_in
ms["net_next"] = (g.money_in.shift(-1) - g.money_out.shift(-1)) / usual_in
allc = pd.read_csv(OUT / "customers_edge.csv").set_index("account_id")
q = pd.qcut(allc.I.rank(method="first"), 5, labels=False)
ms = ms.join(q.rename("q"), on="account_id")
ms = ms[np.isfinite(ms.dev) & np.isfinite(ms.net_next)]
bins = [-np.inf, -0.25, 0.25, 1, np.inf]
labels = ["Below usual", "Near usual", "Above usual", "Far above usual"]
ms["pos"] = pd.cut(ms.dev, bins, labels=labels)
thermo = []
for lab in labels:
    row = {"position": lab}
    for name, qq in [("bottom20", 0), ("top20", 4)]:
        s = ms[(ms.pos == lab) & (ms.q == qq)].net_next
        row[name] = round(100 * float(s.median()), 1)
        row[name + "_n"] = int(len(s))
    thermo.append(row)

timing = pd.read_csv(OUT / "timing_by_start_month.csv")
months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
timing_rows = [{"month": months[int(r.start_month) - 1], "runway": float(r.median_runway),
                "worst_share": round(100 * float(r.worst_share), 1)} for r in timing.itertuples()]

out = {"deciles": deciles, "thermostat": thermo, "timing": timing_rows,
       "timing_n": int(timing.n.iloc[0]), "n_nonpension": int(len(t))}
CHARTS.mkdir(exist_ok=True)
(CHARTS / "charts.js").write_text("window.CHARTS = " + json.dumps(out, indent=1) + ";\n")
(ROOT / "web" / "public" / "findings.json").write_text(json.dumps(out))
print(json.dumps(out, indent=1))
