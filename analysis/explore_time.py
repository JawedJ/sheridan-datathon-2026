"""Time: seasons, paydays, weekdays, long-run trends, cohorts, transaction-level habits."""
import numpy as np
import pandas as pd

from explore_common import DATA, customers, head, monthly

t = customers().set_index("account_id")
ms = monthly()
ms["cal_month"] = ms.month.str[5:].astype(int)
ms["year"] = ms.month.str[:4].astype(int)

head("Seasonality: money in/out per active account by calendar month (index, mean=100)")
s = ms.groupby("cal_month")[["money_in", "money_out", "cash_withdrawals_genuine", "household_bills"]].mean()
print((100 * s / s.mean()).round(1).T)

head("Long-run: per active account, by year")
y = ms.groupby("year").agg(accounts=("account_id", "nunique"), money_in=("money_in", "mean"),
                           money_out=("money_out", "mean"), avg_bal=("avg_daily_balance", "mean"),
                           neg_days=("days_below_zero", "mean"))
print(y.round(1))

head("Cohorts: accounts by opening year, months-of-spending saved at end")
t["open_year"] = pd.to_datetime(t.account_opened).dt.year
t["b_months"] = t.B / t.S.replace(0, np.nan)
print(t.groupby("open_year").agg(n=("I", "size"), I=("I", "median"), B=("B", "median"),
                                 b_months=("b_months", "median"), ei=("runway_ei55", "median")).round(1))

head("Balance path after opening (median avg_daily_balance by account-month number)")
ms["age_m"] = ms.groupby("account_id").cumcount()
p = ms.groupby("age_m").avg_daily_balance.median()
print(p.iloc[[0, 1, 2, 3, 6, 12, 24, 36, 48, 60]].round(0).to_dict() if len(p) > 60 else p.iloc[::6].round(0).to_dict())

head("Transactions: day-of-month and weekday patterns")
tx = pd.read_csv(DATA / "transactions.csv", usecols=["account_id", "date", "direction", "operation",
                                                      "purpose", "amount"], parse_dates=["date"])
print("rows:", len(tx))
tx["dom"] = tx.date.dt.day
tx["dow"] = tx.date.dt.day_name().str[:3]
inn = tx.direction.str.startswith("credit")
print("credits by day-of-month (share of count), top 5:",
      tx[inn].dom.value_counts(normalize=True).head(5).round(3).to_dict())
print("debits by day-of-month (share of count), top 5:",
      tx[~inn].dom.value_counts(normalize=True).head(5).round(3).to_dict())
print("count by weekday:", tx.dow.value_counts().to_dict())
print("operation x weekday share (cash withdrawals):",
      tx[tx.operation == "cash withdrawal"].dow.value_counts(normalize=True).round(3).to_dict())

head("Payday: does each account get its main credit on the same day each month?")
cr = tx[inn & (tx.operation != "interest")]
big = cr.loc[cr.groupby([cr.account_id, cr.date.dt.to_period("M")]).amount.idxmax()]
mode_share = big.groupby("account_id").dom.agg(lambda d: d.value_counts(normalize=True).iloc[0])
t["payday_regularity"] = mode_share
print("share of months the biggest credit lands on the account's usual day, quartiles:",
      mode_share.quantile([.25, .5, .75]).round(2).to_dict())
amt_cv = big.groupby("account_id").amount.agg(lambda a: a.std() / a.mean() if a.mean() else np.nan)
print("CV of the biggest monthly credit amount, quartiles:", amt_cv.quantile([.25, .5, .75]).round(3).to_dict())
t["main_credit_cv"] = amt_cv
print("accounts whose biggest monthly credit is near-identical (CV < 2%):", (amt_cv < 0.02).sum())

head("Transaction sizes: round-number cash withdrawals")
cw = tx[tx.operation == "cash withdrawal"].amount
print("cash withdrawals:", len(cw), " median $", round(cw.median()),
      " share whole-dollar:", round((cw % 1 == 0).mean(), 3), " share multiple of $100:", round((cw % 100 == 0).mean(), 3))
cd = tx[tx.operation == "cash deposit"].amount
print("cash deposits:", len(cd), " median $", round(cd.median()), " share multiple of $100:", round((cd % 100 == 0).mean(), 3))

head("Transactions per account per month vs resilience")
n_tx = tx.groupby("account_id").size() / t.months
t["tx_per_month"] = n_tx
t["tx_band"] = pd.qcut(t.tx_per_month, 4, labels=["few", "q2", "q3", "many"])
print(t.groupby("tx_band", observed=True).agg(n=("I", "size"), tx=("tx_per_month", "median"), I=("I", "median"),
                                              B=("B", "median"), ei=("runway_ei55", "median")).round(1))

head("Penalty interest: when and to whom")
pen = tx[tx.purpose == "penalty interest (negative balance)"]
print("penalty rows:", len(pen), " accounts:", pen.account_id.nunique(), " total $", round(pen.amount.sum()))
print("statement fee rows:", (tx.purpose == "statement fee").sum())

head("December / January effect on cash withdrawals by year")
cash_m = ms.groupby(["year", "cal_month"]).cash_withdrawals_genuine.mean().unstack()
print((cash_m[12] / cash_m.mean(axis=1)).round(3).to_dict())

t.reset_index()[["account_id", "payday_regularity", "main_credit_cv", "tx_per_month"]].to_csv(
    DATA.parent / "output" / "customers_time.csv", index=False)
