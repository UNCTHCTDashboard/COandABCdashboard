import json
import re
import pandas as pd
from pathlib import Path

INPUT_FILE = "Compiled data v2.xlsx"
OUTPUT_FILE = Path("js/data.js")

ADMIN_AREAS = [
    "Abyei Region",
    "Pibor Administrative Area",
    "Ruweng Administrative Area",
    "Abyei",
    "Pibor",
    "Ruweng"
]

EXCLUDED_FOOD_INDICATORS = [
    "Hectares of land brought under climate-resilient management"
]

BASIC_CATEGORY_TO_SECTOR = {
    "BS-Education": "Education",
    "BS-Health": "Health",
    "BS-Nutrition": "Nutrition"
}

DURABLE_CATEGORY_TO_SECTOR = {
    "DS-BS": "Durable Solutions Basic Services",
    "DS-LHE": "Durable Solutions Livelihoods & Economic Inclusion",
    "DS-Sec": "Durable Solutions Security",
    "DS-SEC": "Durable Solutions Security"
}

RAPID_RESPONSE_SERVICE_COLUMNS = {
    "Number of people provided with meergency shelter support": "Emergency Shelter Support",
    "Number of people provided with emergency shelter support": "Emergency Shelter Support",
    " Number of children receiving emergency education support": "Emergency Education Support",
    "Number of children receiving emergency education support": "Emergency Education Support",
    "Number of people reached with emergency protection services": "Emergency Protection Services",
    "Number of people receiving emergency WASH services": "Emergency WASH Services",
    "Number of people recahed with emergency Health and Nutrition Services": "Emergency Health and Nutrition Services",
    "Number of people reached with emergency Health and Nutrition Services": "Emergency Health and Nutrition Services",
    "Number of individuals supported through emergency MPCA": "Emergency MPCA",
    "Number of people supported through CCCM interventions": "CCCM Support"
}


def clean_value(v):
    if pd.isna(v):
        return ""
    return str(v).strip()


def clean_text(v):
    text = clean_value(v)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_number(v):
    if pd.isna(v):
        return 0
    try:
        return float(str(v).replace(",", "").strip())
    except Exception:
        return 0


def normalize_text(text):
    text = clean_text(text).lower()
    text = text.replace("–", "-").replace("—", "-")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_date(v):
    if pd.isna(v):
        return ""
    try:
        return pd.to_datetime(v).strftime("%Y-%m-%d")
    except Exception:
        return clean_text(v)


def get_food_target(indicator):
    text = normalize_text(indicator)

    if "smallholder farmers supported" in text:
        return 100000

    if "integrated food security assistance" in text:
        return 2500000

    return 0


def get_basic_target(indicator):
    text = normalize_text(indicator)

    if "out-of-school children" in text and "formal/non-formal education" in text:
        return 200000

    if "crisis-affected children" in text and "temporary learning spaces" in text:
        return 150000

    if "foundational literacy" in text or "foundational literacy/numeracy" in text:
        return 600000

    if "life skills" in text and "vocational" in text:
        return 30000

    if "people accessing health services" in text or "people in need access essential health" in text:
        return 3200000

    if "health facilities" in text and "essential health services package" in text:
        return 816

    if "public health emergencies" in text:
        return 15

    if "antenatal care" in text:
        return 50

    if "malnutrition" in text or "sam/mam" in text:
        return 1200000

    return 0


def get_durable_target(indicator):
    text = normalize_text(indicator)

    if "displaced persons" in text and "targeted assistance" in text:
        return 60000

    if "closure" in text and "camp" in text:
        return 1

    if "access to basic services" in text:
        return 75

    if "roadmaps" in text or "action plans" in text:
        return 5

    if "coordination mechanisms" in text:
        return 3

    return 0


def get_peace_target(indicator):
    text = normalize_text(indicator)

    if "community peace committees" in text or "peace committees or platforms" in text:
        return 12

    if "duty bearers" in text and "sgbv" in text:
        return 600

    if "access-to-justice" in text or "access to justice" in text or "legal aid" in text:
        if "individuals" in text or "received" in text or "receiving" in text:
            return 4000

    if "justice sector actors" in text:
        return 300

    if "mobile access-to-justice" in text or "mobile access to justice" in text:
        return 8

    if "civic education" in text:
        return 30000

    return 0


# =========================
# READ MAIN ALL OUTPUTS SHEET
# =========================

df = pd.read_excel(INPUT_FILE, sheet_name="All Outputs")
df.columns = [str(c).strip() for c in df.columns]

required_columns = [
    "Category",
    "Indicator",
    "Reporting Agency",
    "State",
    "County",
    "Number"
]

missing = [c for c in required_columns if c not in df.columns]

if missing:
    raise ValueError(
        f"Missing required columns in Excel: {missing}. "
        f"Available columns: {list(df.columns)}"
    )


# =========================
# FOOD SECURITY
# =========================

food = df[df["Category"].astype(str).str.strip().eq("FoodSecurity")].copy()
food = food[~food["Indicator"].astype(str).str.strip().isin(EXCLUDED_FOOD_INDICATORS)]

food_records = []

for _, row in food.iterrows():
    indicator = clean_text(row.get("Indicator"))
    agency = clean_text(row.get("Reporting Agency"))
    state = clean_text(row.get("State"))
    county = clean_text(row.get("County"))

    if not indicator or not state or not county:
        continue

    food_records.append({
        "outcome": "Food Security",
        "indicator": indicator,
        "agency": agency,
        "state": state,
        "county": county,
        "period": clean_text(row.get("Reporing Period")),
        "current": clean_number(row.get("Number")),
        "male": clean_number(row.get("Male")),
        "female": clean_number(row.get("Female")),
        "target": get_food_target(indicator),
        "isAdminArea": state in ADMIN_AREAS
    })


# =========================
# BASIC SERVICES
# =========================

basic = df[
    df["Category"].astype(str).str.strip().isin(BASIC_CATEGORY_TO_SECTOR.keys())
].copy()

basic_records = []

for _, row in basic.iterrows():
    category = clean_text(row.get("Category"))
    indicator = clean_text(row.get("Indicator"))
    agency = clean_text(row.get("Reporting Agency"))
    state = clean_text(row.get("State"))
    county = clean_text(row.get("County"))

    if not indicator or not state or not county:
        continue

    basic_records.append({
        "outcome": "Basic Services",
        "sector": BASIC_CATEGORY_TO_SECTOR.get(category, ""),
        "category": category,
        "indicator": indicator,
        "agency": agency,
        "state": state,
        "county": county,
        "period": clean_text(row.get("Reporing Period")),
        "current": clean_number(row.get("Number")),
        "male": clean_number(row.get("Male")),
        "female": clean_number(row.get("Female")),
        "target": get_basic_target(indicator),
        "isAdminArea": state in ADMIN_AREAS
    })


# =========================
# DURABLE SOLUTIONS
# =========================

durable = df[
    df["Category"].astype(str).str.strip().isin(DURABLE_CATEGORY_TO_SECTOR.keys())
].copy()

durable_records = []

for _, row in durable.iterrows():
    category = clean_text(row.get("Category"))

    if category.upper() == "DS-SEC":
        category = "DS-Sec"

    indicator = clean_text(row.get("Indicator"))
    agency = clean_text(row.get("Reporting Agency"))
    state = clean_text(row.get("State"))
    county = clean_text(row.get("County"))

    if not indicator or not state or not county:
        continue

    durable_records.append({
        "outcome": "Durable Solutions",
        "sector": DURABLE_CATEGORY_TO_SECTOR.get(category, ""),
        "category": category,
        "supportType": clean_text(row.get("Support Type")),
        "indicator": indicator,
        "agency": agency,
        "state": state,
        "county": county,
        "period": clean_text(row.get("Reporing Period")),
        "current": clean_number(row.get("Number")),
        "male": clean_number(row.get("Male")),
        "female": clean_number(row.get("Female")),
        "idps": clean_number(row.get("IDPs")),
        "returnees": clean_number(row.get("Returnees")),
        "hostCommunity": clean_number(row.get("Host Community")),
        "target": get_durable_target(indicator),
        "isAdminArea": state in ADMIN_AREAS
    })


# =========================
# PEACE AND GOVERNANCE
# =========================

peace_filter = (
    df.get("Output", pd.Series([""] * len(df))).astype(str).str.strip().str.lower().eq("peace and governance")
)

if peace_filter.sum() == 0:
    peace_filter = (
        df.get("Output", pd.Series([""] * len(df))).astype(str).str.lower().str.contains("peace", na=False)
        |
        df.get("Category", pd.Series([""] * len(df))).astype(str).str.lower().str.contains("peace", na=False)
    )

peace = df[peace_filter].copy()

peace_records = []

for _, row in peace.iterrows():
    indicator = clean_text(row.get("Indicator"))

    if not indicator:
        indicator = clean_text(row.get("Targets Agreed"))

    agency = clean_text(row.get("Reporting Agency"))
    state = clean_text(row.get("State"))
    county = clean_text(row.get("County"))

    if not indicator or not state or not county:
        continue

    current = clean_number(row.get("Number"))
    target = clean_number(row.get("Target"))

    if target == 0:
        target = clean_number(row.get("Targets Agreed"))

    if target == 0:
        target = get_peace_target(indicator)

    peace_records.append({
        "outcome": "Peace and Governance",
        "indicator": indicator,
        "agency": agency,
        "state": state,
        "county": county,
        "period": clean_text(row.get("Reporing Period")),
        "category": clean_text(row.get("Category")),
        "targetsAgreed": clean_text(row.get("Targets Agreed")),
        "current": current,
        "male": clean_number(row.get("Male")),
        "female": clean_number(row.get("Female")),
        "target": target,
        "remarks": clean_text(row.get("Remarks")),
        "risk": clean_text(row.get("Risk")),
        "implementingPartners": clean_text(row.get("Implementing Partners")),
        "isAdminArea": state in ADMIN_AREAS
    })


# =========================
# RAPID RESPONSE
# =========================

rapid_response_records = []

try:
    rr = pd.read_excel(INPUT_FILE, sheet_name="Rapid Response")
    rr.columns = [str(c).strip() for c in rr.columns]

    for _, row in rr.iterrows():
        state = clean_text(row.get("State"))
        county = clean_text(row.get("County"))

        if not state or not county:
            continue

        services = []

        for col, service_name in RAPID_RESPONSE_SERVICE_COLUMNS.items():
            if col in rr.columns:
                services.append({
                    "service": service_name,
                    "value": clean_number(row.get(col))
                })

        rapid_response_records.append({
            "outcome": "Rapid Response",
            "output": clean_text(row.get("Output")),
            "agency": clean_text(row.get("Reporting Agency")),
            "category": clean_text(row.get("Category")),
            "targetsAgreed": clean_text(row.get("Targets Agreed")),
            "period": clean_text(row.get("Reporing Period")),
            "singleCount": clean_number(row.get("Single Count")),
            "status": clean_text(row.get("Status")),
            "state": state,
            "county": county,
            "male": clean_number(row.get("Male")),
            "female": clean_number(row.get("Female")),
            "remarks": clean_text(row.get("Remarks (Challenges etc)")),
            "shockDate": clean_date(row.get("Date of Shock / Emergency Happened")),
            "responseStartDate": clean_date(row.get("Date when response started")),
            "daysToRespond": clean_number(row.get("Number of days taken to respond - from the date of alert")),
            "exitDate": clean_date(row.get("Date of exit")),
            "services": services,
            "isAdminArea": state in ADMIN_AREAS
        })

except Exception as e:
    print(f"WARNING: Could not read Rapid Response sheet: {e}")


# =========================
# FINAL DATA OBJECT
# =========================

data = {
    "foodSecurity": {
        "adminAreas": ADMIN_AREAS,
        "records": food_records
    },
    "basicServices": {
        "adminAreas": ADMIN_AREAS,
        "records": basic_records
    },
    "durableSolutions": {
        "adminAreas": ADMIN_AREAS,
        "records": durable_records
    },
    "rapidResponse": {
        "adminAreas": ADMIN_AREAS,
        "records": rapid_response_records
    },
    "peaceGovernance": {
        "adminAreas": ADMIN_AREAS,
        "records": peace_records
    }
}

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write("window.CO_DATA = ")
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write(";")

print(f"Created {OUTPUT_FILE}")
print(f"Food Security records: {len(food_records)}")
print(f"Basic Services records: {len(basic_records)}")
print(f"Durable Solutions records: {len(durable_records)}")
print(f"Rapid Response records: {len(rapid_response_records)}")
print(f"Peace and Governance records: {len(peace_records)}")

missing_peace_targets = [
    {
        "indicator": r["indicator"],
        "current": r["current"],
        "target": r["target"]
    }
    for r in peace_records
    if r["target"] == 0
]

if missing_peace_targets:
    print("\nWARNING: Some Peace and Governance records have target = 0")
    for item in missing_peace_targets[:20]:
        print(f"- {item['indicator']} | current={item['current']}")
else:
    print("All Peace and Governance records have targets.")