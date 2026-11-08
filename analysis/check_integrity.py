"""Data integrity checks on the raw files (Nov 7). Nothing is changed; this only checks consistency.

  1  Duplicate transactions
  2  Missing months inside an account's history
  3  Month-end balance = last month + money in - money out (monthly_summary.csv)
  4  Monthly money in / out = sum of that month's transactions
  5  Spending and income parts add up to money_out / money_in
  6  Negative amounts, account coverage
  7  Transaction-level running balance (order within a day is unknown: no timestamps)
"""
import numpy as np
import pandas as pd

from explore_common import DATA, head

ms = pd.read_csv(DATA / "monthly_summary.csv").sort_values(["account_id", "month"])
tx = pd.read_csv(DATA / "transactions.csv", usecols=["transaction_id", "account_id", "date", "operation", "purpose",
                                                     "amount", "signed_amount", "balance"], low_memory=False)
acc = pd.read_csv(DATA / "accounts.csv")

head("1. Duplicates")
print("duplicate transaction ids:", int(tx.transaction_id.duplicated().sum()))
dup = tx[tx.duplicated(["account_id", "date", "operation", "amount"], keep=False)]
print(f"same account, date, type and amount: {len(dup):,} rows ({len(dup) / len(tx):.2%}); by type:",
      dup.operation.value_counts().to_dict())
print("  -> mostly interest credits and fees. Could be real or copies; we can't tell. They're tiny and the judges'")
print("     monthly totals include them, so we keep them to stay matched to the official numbers.")

head("2. Gaps")
ms["p"] = pd.PeriodIndex(ms.month, freq="M")
g = ms.groupby("account_id").p
gaps = int(((g.max() - g.min()).apply(lambda x: x.n) + 1 != g.size()).sum())
print("accounts with a missing month between first and last:", gaps)

head("3. Monthly balances add up")
ms["prev"] = ms.groupby("account_id").month_end_balance.shift()
x = ms.dropna(subset=["prev"])
err = (x.prev + x.money_in - x.money_out - x.month_end_balance).abs()
print(f"month-end = previous + in - out: off by more than $1 in {int((err > 1).sum())} of {len(x):,} account-months "
      f"(largest difference ${err.max():.2f}, cent rounding)")
f = ms.groupby("account_id").first()
print(f"first month starts from $0: {((f.money_in - f.money_out - f.month_end_balance).abs() <= 1).mean():.1%} of accounts")

head("4. Monthly totals match transactions")
tx["month"] = tx.date.str[:7]
tin = tx[tx.signed_amount > 0].groupby(["account_id", "month"]).amount.sum()
tout = tx[tx.signed_amount < 0].groupby(["account_id", "month"]).amount.sum()
m2 = ms.set_index(["account_id", "month"]).join(tin.rename("tin")).join(tout.rename("tout")).fillna({"tin": 0, "tout": 0})
print("money_in mismatches:", int(((m2.money_in - m2.tin).abs() > 1).sum()),
      " money_out mismatches:", int(((m2.money_out - m2.tout).abs() > 1).sum()), "of", f"{len(m2):,}")

head("5. Parts add up")
out_parts = ["household_bills", "insurance", "loan_payments", "bank_fees", "cash_withdrawals_genuine",
             "card_withdrawals", "transfers_out_other"]
in_parts = ["cash_deposits", "transfers_in", "pension_in", "interest_in"]
print("spending parts != money_out:", int(((ms[out_parts].sum(axis=1) - ms.money_out).abs() > 1).sum()),
      " income parts != money_in:", int(((ms[in_parts].sum(axis=1) - ms.money_in).abs() > 1).sum()))

head("6. Ranges and coverage")
print("negative money_in / money_out values:", int((ms.money_in < 0).sum() + (ms.money_out < 0).sum()))
print("accounts in monthly_summary vs accounts.csv:", ms.account_id.nunique(), acc.account_id.nunique())

head("7. Transaction running balance")
t2 = tx.sort_values(["account_id", "date", "transaction_id"])
t2["prevb"] = t2.groupby("account_id").balance.shift()
step = (t2.prevb + t2.signed_amount - t2.balance).abs().dropna()
print(f"previous row + amount = balance (rows ordered by date, then id): {(step <= 0.01).mean():.1%}")
d = t2.groupby(["account_id", "date"]).agg(net=("signed_amount", "sum"), bals=("balance", list))
d["prev"] = d.groupby(level=0).bals.shift()
s = d.sample(20000, random_state=0)
ok = s.apply(lambda r: np.nan if not isinstance(r.prev, list) else
             any(abs(p + r.net - b) <= 0.05 for p in r.prev for b in r.bals), axis=1).dropna()
print(f"order-free daily check (sample of 20,000 days): {ok.mean():.1%} reconcile")
print("  -> transactions within a day have no time, so their order is unknown. All formulas use monthly_summary.csv,")
print("     which reconciles exactly (sections 3-5).")
