"""Places: districts, regions, branch vs home district, local economy vs customer money."""
import numpy as np
import pandas as pd

from explore_common import DATA, customers, head, profile

t = customers()
clients = pd.read_csv(DATA / "clients.csv")
disp = pd.read_csv(DATA / "dispositions.csv")
dist = pd.read_csv(DATA / "districts.csv")

head("Region profile")
print(profile(t, "region").sort_values("I"))

head("Prague vs everyone else")
t["prague"] = t.district_id == 1
print(profile(t, "prague"))

head("District level: customers' median income vs district average salary")
d = t.groupby("district_id").agg(n=("I", "size"), I=("I", "median"), B=("B", "median"),
                                 ei=("runway_ei55", "median")).join(dist.set_index("district_id"))
d = d[d.n >= 20]
print("districts with >= 20 customers:", len(d))
for a, b in [("average_salary", "I"), ("average_salary", "B"), ("unemployment_rate_2023", "B"),
             ("unemployment_rate_2023", "ei"), ("urban_ratio_pct", "I"), ("entrepreneurs_per_1000", "I"),
             ("crimes_2023", "B")]:
    print(f"  spearman {a:24s} vs {b:3s}: {d[[a, b]].corr(method='spearman').iloc[0, 1]:+.3f}")
print("ratio customer median income / district avg salary, median:",
      round((d.I / d.average_salary).median(), 2), " range", round((d.I / d.average_salary).min(), 2),
      "-", round((d.I / d.average_salary).max(), 2))

head("Customers per 10k inhabitants (bank's reach) vs district traits")
d["per10k"] = d.n / d.inhabitants * 1e4
print(d.per10k.describe().round(2).to_dict())
for a in ["average_salary", "urban_ratio_pct", "unemployment_rate_2023"]:
    print(f"  spearman reach vs {a}: {d[['per10k', a]].corr(method='spearman').iloc[0, 1]:+.3f}")

head("Branch district vs home district of owner")
own = disp[disp.type == "owner"].merge(clients, on="client_id")[["account_id", "district_id"]]
x = t[["account_id", "district_id"]].merge(own, on="account_id", suffixes=("_branch", "_home"))
x["same"] = x.district_id_branch == x.district_id_home
print("owners banking in their home district:", round(x.same.mean(), 3), " n differ:", (~x.same).sum())
t = t.merge(x[["account_id", "same"]], on="account_id")
print(profile(t, "same"))

head("Unemployment change 2022->2023 vs customers")
dist["unemp_delta"] = dist.unemployment_rate_2023 - dist.unemployment_rate_2022
d = d.join(dist.set_index("district_id")[["unemp_delta"]])
print("districts where unemployment rose:", (dist.unemp_delta > 0).sum(), "of", dist.unemp_delta.notna().sum())
print("  spearman unemp_delta vs B:", round(d[["unemp_delta", "B"]].corr(method="spearman").iloc[0, 1], 3))

head("Within-district spread vs between-district spread of income")
within = t.groupby("district_id").I.std().median()
between = t.groupby("district_id").I.median().std()
print(f"median within-district std ${within:,.0f}  vs std of district medians ${between:,.0f}")
