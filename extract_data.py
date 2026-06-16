import json
import pandas as pd
from pathlib import Path

INPUT_FILE = "Compiled data v2.xlsx"
OUTPUT_FILE = Path("js/data.js")

EXCLUDED_FOOD_INDICATORS = [
    "Hectares of land brought under climate-resilient management"
]

TARGETS = {
    "Smallholder farmers supported (with climate-resilient agriculture)": 100000,
    "People reached with integrated food security assistance (IPC 4+)": 2500000
}

ADMIN_AREAS = [
    "Abyei Region",
    "Pibor Administrative Area",
    "Ruweng Administrative Area"
]

def clean_value(v):
    if pd.isna(v):
        return ""
    return str(v).strip()

def clean_number(v):
    if pd.isna(v):
        return 0
    try:
        return float(v)
    except Exception:
        return 0

df = pd.read_excel(INPUT_FILE, sheet_name="All Outputs")

food = df[df["Category"].astype(str).str.strip().eq("FoodSecurity")].copy()
food = food[~food["Indicator"].isin(EXCLUDED_FOOD_INDICATORS)]

records = []

for _, row in food.iterrows():
    indicator = clean_value(row.get("Indicator"))
    agency = clean_value(row.get("Reporting Agency"))
    state = clean_value(row.get("State"))
    county = clean_value(row.get("County"))

    if not indicator or not state or not county:
        continue

    records.append({
        "outcome": "Food Security",
        "indicator": indicator,
        "agency": agency,
        "state": state,
        "county": county,
        "period": clean_value(row.get("Reporing Period")),
        "current": clean_number(row.get("Number")),
        "male": clean_number(row.get("Male")),
        "female": clean_number(row.get("Female")),
        "target": TARGETS.get(indicator, 0),
        "isAdminArea": state in ADMIN_AREAS
    })

data = {
    "foodSecurity": {
        "adminAreas": ADMIN_AREAS,
        "records": records
    }
}

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write("const CO_DATA = ")
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write(";")

print(f"Created {OUTPUT_FILE} with {len(records)} Food Security records.")