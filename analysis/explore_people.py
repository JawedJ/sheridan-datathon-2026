"""People: age, gender, shared accounts, cards, statement frequency."""
import numpy as np
import pandas as pd

from explore_common import DATA, customers, head, profile

t = customers()
clients = pd.read_csv(DATA / "clients.csv", parse_dates=["birth_date"])
disp = pd.read_csv(DATA / "dispositions.csv")
cards = pd.read_csv(DATA / "cards.csv", parse_dates=["issued"])

t["age_band"] = pd.cut(t.owner_age, [0, 25, 35, 45, 55, 65, 75, 120],
                       labels=["<25", "25-34", "35-44", "45-54", "55-64", "65-74", "75+"])
t["pensioner"] = t.pension_share.fillna(0) >= 0.5

head("Age band")
print(profile(t, "age_band"))
head("Age band, non-pensioners only")
print(profile(t[~t.pensioner], "age_band"))
head("Pensioners by age band (share of band on pension)")
print(t.groupby("age_band", observed=True).pensioner.mean().round(3))

head("Gender of owner")
print(profile(t, "owner_gender"))
head("Gender x age band: median income")
print(t.pivot_table(index="age_band", columns="owner_gender", values="I", aggfunc="median",
                    observed=True).round(0))

head("Shared vs single accounts")
print(profile(t, "shared_account"))
d = disp.merge(clients, on="client_id")
pairs = d.groupby("account_id").filter(lambda x: len(x) == 2)
own = pairs[pairs.type == "owner"].set_index("account_id")
auth = pairs[pairs.type != "owner"].set_index("account_id")
pc = own[["gender", "birth_date"]].join(auth[["gender", "birth_date"]], rsuffix="_auth")
pc["age_gap"] = ((pc.birth_date - pc.birth_date_auth).dt.days / 365.25).abs()
print("shared accounts:", len(pc))
print("gender pairs (owner-auth):", (pc.gender + "-" + pc.gender_auth).value_counts().to_dict())
print("age gap between the two people, median yrs:", round(pc.age_gap.median(), 1),
      " share within 10 yrs:", round((pc.age_gap <= 10).mean(), 3))
print("share with same home district:",
      round((own.district_id == auth.district_id.reindex(own.index)).mean(), 3))

head("Card type")
print(profile(t, "card_type"))
c = cards.merge(disp, on="disposition_id").merge(clients, on="client_id")
c["age_at_issue"] = (c.issued - c.birth_date).dt.days / 365.25
print("age at issue by card type (median, min, max):")
print(c.groupby("card_type").age_at_issue.agg(["median", "min", "max", "size"]).round(1))
print("cards held by authorized users (not owner):", (c.type != "owner").sum())
c2 = c.merge(t[["account_id", "account_opened"]], on="account_id")
c2["account_opened"] = pd.to_datetime(c2.account_opened)
c2["years_after_open"] = (c2.issued - c2.account_opened).dt.days / 365.25
print("years from account open to card issue, median:", round(c2.years_after_open.median(), 2))

head("Statement frequency")
print(profile(t, "frequency"))

head("Account age (years open by end 2025)")
t["acct_years"] = (pd.Timestamp("2025-12-31") - pd.to_datetime(t.account_opened)).dt.days / 365.25
t["acct_age_band"] = pd.cut(t.acct_years, [0, 1, 2, 3, 4, 7], labels=["<1", "1-2", "2-3", "3-4", "4+"])
print(profile(t, "acct_age_band"))

head("Correlations with buffer-in-months (B/S), Spearman")
t["b_months"] = t.B / t.S.replace(0, np.nan)
for col in ["owner_age", "I", "S", "acct_years", "num_users", "average_salary",
            "unemployment_rate_2023", "urban_ratio_pct", "pension_share", "so_total"]:
    print(f"  {col:24s} {t[['b_months', col]].corr(method='spearman').iloc[0, 1]:+.3f}")

head("Women vs men 55-64: pension share and income")
w = t[t.age_band == "55-64"]
print(w.groupby("owner_gender").agg(n=("I", "size"), pension=("pensioner", "mean"),
                                     I=("I", "median"), B=("B", "median")).round(3))
print("youngest pensioner by gender:", t[t.pensioner].groupby("owner_gender").owner_age.min().round(1).to_dict())
print("share on pension at each age 55-66, by gender:")
t["age_int"] = t.owner_age.astype(int)
print(t[(t.age_int >= 55) & (t.age_int <= 66)].pivot_table(index="age_int", columns="owner_gender",
      values="pensioner", aggfunc="mean").round(2).T)
