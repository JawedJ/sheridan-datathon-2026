"""Verify suspected problems with the judges' formulas. Prints evidence for FINDINGS.md.

Run:  .venv/bin/python analysis/verify_formula.py   (after build_customer_table.py)
"""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA, OUT = ROOT / "data", ROOT / "output"

t = pd.read_csv(OUT / "customers.csv")
ms = pd.read_csv(DATA / "monthly_summary.csv").sort_values(["account_id", "month"])
pct = lambda x: f"{100 * x:.1f}%"


def section(title):
    print(f"\n=== {title} ===")


# 1. S > I with no shock: real losses or a median artifact? -----------------------
section("1. Spending median > income median with no shock")
last_bal = ms.groupby("account_id").month_end_balance.last()
first_in = ms.groupby("account_id").money_in.first()
net = ms.groupby("account_id").apply(lambda d: d.money_in.sum() - d.money_out.sum())
t = t.set_index("account_id")
t["final_balance"] = last_bal
t["lifetime_net"] = net
q = t[t.shortfall_no_shock]
print("accounts with S > I:", len(q), pct(len(q) / len(t)))
print("  of those, lifetime money in >= money out:", pct((q.lifetime_net >= 0).mean()))
print("  of those, mean_in >= mean_out:", pct((q.mean_in >= q.mean_out).mean()))
print("  of those, final balance > 0:", pct((q.final_balance > 0).mean()))
# Why medians disagree: income is lumpy. Share of months with money_in == 0 / money_out == 0
z = ms.assign(in0=ms.money_in == 0, out0=ms.money_out == 0).groupby("account_id")[["in0", "out0"]].mean()
print("  median share of months with zero money in:  S>I", pct(z.loc[q.index, "in0"].median()),
      " others", pct(z.drop(q.index).in0.median()))
# Month-by-month: how often does a single month have out > in?
ms["deficit"] = ms.money_out > ms.money_in
print("  share of all account-months with out > in:", pct(ms.deficit.mean()))
# Alternative: paired monthly gap median(money_out - money_in)
gap_med = ms.assign(g=ms.money_out - ms.money_in).groupby("account_id").g.median()
t["paired_gap"] = gap_med
print("  S>I accounts whose paired median gap (out-in per month) <= 0:",
      pct((t.loc[q.index, "paired_gap"] <= 0).mean()))
print("  S - I for S>I accounts, median $:", round((q.S - q.I).median()))

# 2. EI at 55% of ALL money in -------------------------------------------------
section("2. EI = 55% of all money in (pensions, interest, transfers included)")
pens = t.pension_share.fillna(0)
print("accounts with any pension income:", pct((pens > 0).mean()))
print("accounts where pension is >= 50% of money in:", (pens >= 0.5).sum(), pct((pens >= 0.5).mean()))
# EI weekly maximum $729 (2026, canada.ca); monthly = 729 * 52 / 12
EI_MAX_MONTH = 729 * 52 / 12
cap = 0.55 * t.I > EI_MAX_MONTH
print(f"EI monthly cap used: ${EI_MAX_MONTH:,.0f} (weekly max $729, 2026 figure)")
print("accounts where 0.55 x I exceeds the EI cap:", cap.sum(), pct(cap.mean()))
ei_capped = np.minimum(0.55 * t.I, EI_MAX_MONTH)
def runway(bl, g):
    bl, g = np.asarray(bl, float), np.asarray(g, float)
    with np.errstate(divide="ignore", invalid="ignore"):
        r = np.minimum(bl / g, 120)
    r = np.where(g <= 0, 120.0, r)
    return np.round(np.where(bl <= 0, 0.0, r), 1)
t["runway_ei_capped"] = runway(t.B, t.S - ei_capped)
print("EI runway <3 months: judges' rule", pct((t.runway_ei55 < 3).mean()),
      " with EI cap", pct((t.runway_ei_capped < 3).mean()))
print("median EI runway: judges' rule", t.runway_ei55.median(), " with cap", t.runway_ei_capped.median())
# Pension-protected version: pension keeps paying, only the rest drops to 55%
pension_med = ms.groupby("account_id").pension_in.median()
t["pension_med"] = pension_med
other = (t.I - t.pension_med).clip(lower=0)
t["runway_ei_pension_kept"] = runway(t.B, t.S - (t.pension_med + 0.55 * other))
pp = pens >= 0.5
print("pension-heavy accounts: EI runway <3mo judges", pct((t.loc[pp, "runway_ei55"] < 3).mean()),
      " pension kept", pct((t.loc[pp, "runway_ei_pension_kept"] < 3).mean()))

# 3. Zero household bills ------------------------------------------------------
section("3. Household bills median = $0")
zb = t[t.bills_zero]
print("accounts:", len(zb), pct(len(zb) / len(t)))
anyb = ms.groupby("account_id").household_bills.apply(lambda s: (s > 0).mean())
print("  of those, share with ANY month of household bills:", pct((anyb.loc[zb.index] > 0).mean()))
so = pd.read_csv(DATA / "standing_orders.csv")
so_hb = so[so.purpose == "household bills"].account_id.unique()
print("  of those, with a household-bills standing order:", pct(zb.index.isin(so_hb).mean()))
print("  all accounts with a household-bills standing order:", pct(t.index.isin(so_hb).mean()))
print("  median transfers_out_other share of spending, zero-bill vs others:")
tot = ms.groupby("account_id")[["transfers_out_other", "money_out"]].sum()
share = tot.transfers_out_other / tot.money_out.replace(0, np.nan)
print("    zero-bill", pct(share.loc[zb.index].median()), " others", pct(share.drop(zb.index).median()))
print("  median 'unlabelled' (cash + card + other transfers) share of spending:")
lab = ms.groupby("account_id")[["cash_withdrawals_genuine", "card_withdrawals", "transfers_out_other"]].sum().sum(axis=1)
print("    all accounts", pct((lab / tot.money_out.replace(0, np.nan)).median()))

# 4. Buffer: stale, inflated by loan payouts ------------------------------------
section("4. Buffer = mean daily balance, last 6 months")
print("accounts whose data ends before 2025-12:", (t.last_month < "2025-12").sum())
print("accounts with < 6 months of history:", (t.months < 6).sum(),
      " < 12 months:", (t.months < 12).sum())
loans = pd.read_csv(DATA / "loans.csv", parse_dates=["loan_start"])
ls = loans.assign(month=loans.loan_start.dt.strftime("%Y-%m"))
lm = ls.merge(ms, on=["account_id", "month"])
print("loan-start month: median money_in vs loan amount ratio:",
      round((lm.money_in / lm.amount).median(), 3), "(near 0 = payout not deposited here)")
recent = loans[loans.loan_start >= "2025-07-01"]
print("loans started in the last 6 months (could inflate B):", len(recent))
print("negative buffers:", (t.B <= 0).sum())

# 5. Quiet months & tiny accounts ----------------------------------------------
section("5. Income median of zero / very low")
print("accounts with I == 0:", (t.I == 0).sum(), " I < $500:", (t.I < 500).sum())

# 6. How much of 'spending' is cuttable? ---------------------------------------
section("6. Locked vs flexible spending (share of total money out)")
parts = ms.groupby("account_id")[["household_bills", "insurance", "loan_payments", "bank_fees",
                                  "cash_withdrawals_genuine", "card_withdrawals",
                                  "transfers_out_other", "money_out"]].sum()
for c in parts.columns[:-1]:
    print(f"  {c:26s} {pct((parts[c] / parts.money_out).median())} median share,"
          f" {pct(parts[c].sum() / parts.money_out.sum())} of all money out")

# 7. Runway distribution / 120 cap ---------------------------------------------
section("7. Runway values")
for c in ["runway_base", "runway_ei55", "runway_furnace", "runway_ei55_bills15"]:
    r = t[c]
    print(f"  {c:22s} =0 {pct((r == 0).mean())}  <3 {pct((r < 3).mean())}  "
          f"<6 {pct((r < 6).mean())}  120 {pct((r == 120).mean())}  median {r.median()}")

t.reset_index().to_csv(OUT / "customers_checks.csv", index=False)
