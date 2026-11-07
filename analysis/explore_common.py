"""Shared loaders and a group-profile helper for the exploration scripts."""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA, OUT = ROOT / "data", ROOT / "output"
pd.set_option("display.width", 160, "display.max_columns", 30)


def customers():
    return pd.read_csv(OUT / "customers_checks.csv")


def monthly():
    return pd.read_csv(DATA / "monthly_summary.csv").sort_values(["account_id", "month"])


def profile(t, by, min_n=20):
    """Median money picture per group: n, income, spending, buffer, months saved, EI runway."""
    g = t.groupby(by, observed=True)
    out = pd.DataFrame({
        "n": g.size(),
        "I": g.I.median().round(0),
        "S": g.S.median().round(0),
        "B": g.B.median().round(0),
        "B_over_S": (g.B.median() / g.S.median()).round(2),
        "ei_runway": g.runway_ei55.median(),
        "ei_lt3_pct": g.runway_ei55.apply(lambda r: 100 * (r < 3).mean()).round(1),
        "eicap_lt3_pct": g.runway_ei_capped.apply(lambda r: 100 * (r < 3).mean()).round(1),
    })
    return out[out.n >= min_n]


def head(title):
    print(f"\n### {title}")
