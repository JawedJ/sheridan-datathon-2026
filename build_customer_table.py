"""Build one row per account with the judges' metrics, standard shocks, and joined context.

Run:  .venv/bin/python build_customer_table.py
Out:  output/customers.csv  (and customers.json for the web app)
"""
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).parent / "data"
OUT = Path(__file__).parent / "output"
END_OF_DATA = pd.Timestamp("2025-12-31")


def runway(buffer_left, gap):
    """Judges' rule. Returns months (float), 120.0 meaning 'no shortfall (120+)'."""
    buffer_left = np.asarray(buffer_left, dtype=float)
    gap = np.asarray(gap, dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        r = np.minimum(buffer_left / gap, 120)
    r = np.where(gap <= 0, 120.0, r)
    r = np.where(buffer_left <= 0, 0.0, r)
    return np.round(r, 1)


def core_metrics(ms: pd.DataFrame) -> pd.DataFrame:
    """I, S, F, H, B per account from monthly_summary rows."""
    ms = ms.sort_values(["account_id", "month"])
    ms = ms.assign(fixed=ms.household_bills + ms.insurance + ms.loan_payments)
    g = ms.groupby("account_id")
    out = pd.DataFrame({
        "I": g.money_in.median(),
        "S": g.money_out.median(),
        "F": g.fixed.median(),
        "H": g.household_bills.median(),
        "B": g.avg_daily_balance.apply(lambda s: s.tail(6).mean()),
        "months": g.size(),
        "first_month": g.month.first(),
        "last_month": g.month.last(),
    })
    return out


def main():
    OUT.mkdir(exist_ok=True)
    ms = pd.read_csv(DATA / "monthly_summary.csv")
    accounts = pd.read_csv(DATA / "accounts.csv", parse_dates=["account_opened"])
    loans = pd.read_csv(DATA / "loans.csv", parse_dates=["loan_start"])
    clients = pd.read_csv(DATA / "clients.csv", parse_dates=["birth_date"])
    disp = pd.read_csv(DATA / "dispositions.csv")
    cards = pd.read_csv(DATA / "cards.csv")
    districts = pd.read_csv(DATA / "districts.csv")
    orders = pd.read_csv(DATA / "standing_orders.csv")

    # ---- Part 1: judges' metrics -------------------------------------------------
    t = core_metrics(ms)

    # Extra behaviour features (full history)
    g = ms.sort_values(["account_id", "month"]).groupby("account_id")
    t["mean_in"] = g.money_in.mean()
    t["mean_out"] = g.money_out.mean()
    t["pension_share"] = g.pension_in.sum() / g.money_in.sum().replace(0, np.nan)
    t["days_below_zero_total"] = g.days_below_zero.sum()
    t["months_below_zero"] = g.days_below_zero.apply(lambda s: (s > 0).sum())
    t["penalty_fees_total"] = g.bank_fees.sum()
    t["bills_zero"] = t.H == 0

    # ---- Loans: P (judge rule) + outcome -----------------------------------------
    loans["loan_end"] = loans.apply(
        lambda r: r.loan_start + pd.DateOffset(months=int(r.duration_months)), axis=1)
    loans["running_by_status"] = loans.status.isin(["C", "D"])
    loans["running_by_date"] = loans.loan_end > END_OF_DATA
    loans["P"] = np.where(loans.running_by_status, loans.monthly_payment, 0.0)
    t = t.join(loans.set_index("account_id")[
        ["loan_id", "loan_start", "amount", "duration_months", "monthly_payment",
         "status", "defaulted", "running_by_status", "running_by_date", "P"]
    ].rename(columns={"amount": "loan_amount"}))
    t["has_loan"] = t.loan_id.notna()
    t["P"] = t.P.fillna(0.0)

    # Pre-loan metrics: same formulas using only months BEFORE the loan started.
    # This avoids the loan itself (payments, payout) leaking into the "before" picture.
    lm = ms.merge(loans[["account_id", "loan_start"]], on="account_id")
    lm = lm[pd.to_datetime(lm.month + "-01") < lm.loan_start.dt.to_period("M").dt.to_timestamp()]
    pre = core_metrics(lm).add_prefix("pre_")
    pre["pre_runway_base"] = runway(pre.pre_B, pre.pre_S - pre.pre_I)
    pre["pre_runway_ei"] = runway(pre.pre_B, pre.pre_S - 0.55 * pre.pre_I)
    t = t.join(pre[["pre_I", "pre_S", "pre_B", "pre_months", "pre_runway_base", "pre_runway_ei"]])

    # ---- Part 2: standard shocks ------------------------------------------------
    t["runway_base"] = runway(t.B, t.S - t.I)
    t["runway_ei55"] = runway(t.B, t.S - 0.55 * t.I)
    t["runway_furnace"] = runway(t.B - t.S, t.S - t.I)          # one-off = 1 month of S
    t["runway_bills15"] = runway(t.B, t.S + 0.15 * t.H - t.I)
    t["runway_ei55_bills15"] = runway(t.B, t.S + 0.15 * t.H - 0.55 * t.I)
    t["shortfall_no_shock"] = t.S > t.I                          # median quirk flag
    t["buffer_months_of_spending"] = t.B / t.S.replace(0, np.nan)

    # ---- Context joins ----------------------------------------------------------
    t = t.join(accounts.set_index("account_id"))
    t = t.merge(districts[["district_id", "district_name", "region", "average_salary",
                           "unemployment_rate_2023", "urban_ratio_pct", "crimes_2023",
                           "inhabitants"]],
                on="district_id", how="left").set_index(t.index)

    owners = disp[disp.type == "owner"].merge(clients, on="client_id")
    owners["owner_age"] = ((END_OF_DATA - owners.birth_date).dt.days / 365.25).round(1)
    t = t.join(owners.set_index("account_id")[["gender", "owner_age"]].rename(
        columns={"gender": "owner_gender"}))
    t["num_users"] = disp.groupby("account_id").size()
    t["shared_account"] = t.num_users > 1

    card_rank = {"junior": 1, "classic": 2, "gold": 3}
    c = cards.merge(disp, on="disposition_id")
    c["rank"] = c.card_type.map(card_rank)
    best = c.sort_values("rank").groupby("account_id").card_type.last()
    t["card_type"] = best.reindex(t.index).fillna("none")

    so = orders.assign(purpose=orders.purpose.fillna("other"))
    so_tot = so.pivot_table(index="account_id", columns="purpose", values="amount",
                            aggfunc="sum", fill_value=0).add_prefix("so_")
    t = t.join(so_tot)
    so_cols = [c for c in t.columns if c.startswith("so_")]
    t[so_cols] = t[so_cols].fillna(0)
    t["so_total"] = t[so_cols].sum(axis=1)

    t.index.name = "account_id"
    t = t.reset_index()
    t.to_csv(OUT / "customers.csv", index=False)
    t.to_json(OUT / "customers.json", orient="records", date_format="iso", indent=0)

    # ---- Quick report -----------------------------------------------------------
    print(f"accounts: {len(t)}  columns: {t.shape[1]}")
    print(f"P status-vs-date disagreements: "
          f"{(loans.running_by_status != loans.running_by_date).sum()} of {len(loans)}")
    print(f"accounts with S > I and no shock: {t.shortfall_no_shock.mean():.1%}")
    print(f"accounts with $0 household bills median: {t.bills_zero.mean():.1%}")
    for col in ["runway_base", "runway_ei55", "runway_furnace", "runway_ei55_bills15"]:
        r = t[col]
        print(f"{col:22s} median {r.median():5.1f}  <3mo {(r < 3).mean():6.1%}  "
              f"no-shortfall {(r == 120).mean():6.1%}")


if __name__ == "__main__":
    main()
