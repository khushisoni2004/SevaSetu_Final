from pathlib import Path
import csv
import json
import re
import unicodedata

RAW_DIR = Path("datasets/raw_schemes")
OUT_FILE = Path("frontend/src/data/sevasetuImportedSchemes.json")
BACKUP_FILE = Path("frontend/src/data/sevasetuImportedSchemes_before_strict_clean.json")

STATE_FOLDER_MAP = {
    "madhya_pradesh": "Madhya Pradesh",
    "uttar_pradesh": "Uttar Pradesh",
    "rajasthan": "Rajasthan",
    "maharashtra": "Maharashtra",
    "gujarat": "Gujarat",
    "bihar": "Bihar",
    "punjab": "Punjab",
    "delhi": "Delhi",
    "karnataka": "Karnataka",
    "kerala": "Kerala",
    "tamil_nadu": "Tamil Nadu",
    "west_bengal": "West Bengal",
    "odisha": "Odisha",
    "assam": "Assam",
    "uttarakhand": "Uttarakhand",
    "jharkhand": "Jharkhand",
    "chhattisgarh": "Chhattisgarh",
    "telangana": "Telangana",
    "andhra_pradesh": "Andhra Pradesh",
    "haryana": "Haryana",
    "himachal_pradesh": "Himachal Pradesh",
    "goa": "Goa",
    "puducherry": "Puducherry",
    "tripura": "Tripura",
    "jammu_kashmir": "Jammu and Kashmir"
}

ALL_STATES = list(STATE_FOLDER_MAP.values())

DOC_RULES = {
    "Aadhaar Card": ["aadhaar", "aadhar", "uidai"],
    "Caste Certificate": ["caste certificate", "scheduled caste", "scheduled tribe", "obc certificate"],
    "Income Certificate": ["income certificate", "annual income", "income"],
    "Bank Passbook": ["bank passbook", "bank account", "bank"],
    "Educational Certificate": ["marksheet", "mark sheet", "educational certificate", "school certificate", "college certificate"],
    "Domicile Certificate": ["domicile", "residence certificate", "resident certificate", "residential certificate"],
    "PAN Card": ["pan card"],
    "Ration Card": ["ration card"],
    "Birth Certificate": ["birth certificate"],
    "Mobile Number": ["mobile number", "phone number"],
    "Passport Size Photo": ["passport-sized photograph", "passport size", "photograph", "photo"],
    "Land Record": ["land record", "khasra", "khatauni", "record of rights"],
    "Crop Details": ["crop details"],
    "Vendor Certificate": ["vendor certificate"],
    "Occupation Proof": ["occupation proof", "trade certificate"],
    "FIR / Police Certificate": ["fir", "police", "non-traceable"]
}

CATEGORY_RULES = [
    ("Education & Students", ["scholarship", "student", "education", "school", "college", "hostel", "merit", "pre matric", "post matric", "tuition", "fee reimbursement", "free school bag", "uniform"]),
    ("Agriculture & Farmers", ["farmer", "kisan", "agriculture", "crop", "irrigation", "soil", "farming", "fisherman", "fishermen", "fisherwomen", "fishing"]),
    ("Women & Child", ["women", "woman", "mahila", "girl", "maternity", "mother", "widow", "child", "janani", "ladli", "kanya"]),
    ("Health & Wellness", ["health", "medical", "hospital", "insurance", "nutrition", "treatment", "ayushman", "jan arogya"]),
    ("Business & Finance", ["business", "startup", "msme", "loan", "credit", "vendor", "finance", "entrepreneur", "industry"]),
    ("Employment & Skills", ["skill", "employment", "job", "apprenticeship", "worker", "artisan", "training", "labour", "unemployment"]),
    ("Pension & Social Security", ["pension", "senior", "old age", "social security", "relief", "welfare", "assistance"]),
    ("Housing & Utilities", ["housing", "house", "toilet", "electricity", "water", "gas"])
]

BENEFICIARY_RULES = [
    ("Student", ["student", "scholarship", "education", "school", "college", "hostel", "merit"]),
    ("Farmer", ["farmer", "kisan", "agriculture", "crop", "irrigation"]),
    ("Fisherman", ["fisherman", "fishermen", "fisherwomen", "fishing"]),
    ("Women", ["women", "woman", "mahila", "girl", "maternity", "mother", "widow", "kanya"]),
    ("Citizen", ["citizen", "family", "welfare", "relief"]),
    ("Business Owner", ["business", "startup", "msme", "vendor", "loan", "industry"]),
    ("Worker", ["worker", "skill", "employment", "artisan", "labour"]),
    ("Senior Citizen", ["senior", "old age", "pension"])
]

CASTE_RULES = {
    "SC": ["scheduled caste", " sc ", " dalit "],
    "ST": ["scheduled tribe", " st ", "tribal", "adivasi", "आदिवासी"],
    "OBC": [" obc ", "other backward"],
    "EWS": ["ews", "economically weaker", "bpl", "below poverty"],
    "Minority": ["minority", "minorities"]
}

BAD_SCHOLARSHIP_WORDS = [
    "award", "research award", "scientist award", "nutrition", "poshan",
    "meal", "food grain", "prize", "medal", "teacher training"
]

def clean(value):
    value = str(value or "")
    value = unicodedata.normalize("NFKD", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()

def low(value):
    return " " + clean(value).lower() + " "

def slugify(value):
    value = clean(value).lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value[:90] or "scheme"

def pick(row, names):
    lowered = {clean(k).lower(): v for k, v in row.items()}
    for name in names:
        name = name.lower()
        for k, v in lowered.items():
            if k == name or name in k:
                return clean(v)
    return ""

def path_state(path):
    parts = [p.lower().replace("-", "_").replace(" ", "_") for p in path.parts]
    for part in parts:
        if part in STATE_FOLDER_MAP:
            return STATE_FOLDER_MAP[part]
    return ""

def strict_state(title, details, level, path):
    folder_state = path_state(path) if path else ""

    if folder_state:
        return [folder_state]

    level_l = clean(level).lower()
    title_l = low(title)
    first_l = low((details or "")[:700])

    if level_l == "central":
        return ["All India"]

    found = []

    for state in ALL_STATES:
        st = state.lower()
        if st in title_l or st in first_l:
            found.append(state)

    if found:
        return list(dict.fromkeys(found[:1]))

    if "central government" in first_l or "central govt" in first_l or "all india" in first_l:
        return ["All India"]

    if level_l == "state":
        return ["State Not Specified"]

    return ["All India"]

def infer_category(text):
    text_l = low(text)
    for category, words in CATEGORY_RULES:
        if any(w in text_l for w in words):
            return category
    return "General Citizen Services"

def infer_beneficiaries(text):
    text_l = low(text)
    out = []
    for ben, words in BENEFICIARY_RULES:
        if any(w in text_l for w in words):
            out.append(ben)
    return list(dict.fromkeys(out or ["Citizen"]))

def infer_categories(text):
    text_l = low(text)
    out = []
    for cat, words in CASTE_RULES.items():
        if any(w in text_l for w in words):
            out.append(cat)
    return out or ["General", "OBC", "SC", "ST", "EWS"]

def infer_income(text):
    text_l = low(text)
    if any(w in text_l for w in [" bpl ", " poor ", "low income", "economically weaker", "annual income", "income certificate"]):
        return ["Low Income"]
    return ["Low Income", "Middle Income"]

def infer_docs(text):
    text_l = low(text)
    docs = []
    for doc, words in DOC_RULES.items():
        if any(w in text_l for w in words):
            docs.append(doc)
    if "Aadhaar Card" not in docs:
        docs.insert(0, "Aadhaar Card")
    return list(dict.fromkeys(docs))[:10]

def scheme_quality_flags(title, category, benefits):
    text_l = low(title + " " + category + " " + benefits)
    flags = []

    if "scholarship" in text_l and any(bad in text_l for bad in BAD_SCHOLARSHIP_WORDS):
        flags.append("Not scholarship recommendation safe")

    if "award" in text_l or "research award" in text_l or "scientist award" in text_l:
        flags.append("Award scheme")

    if "poshan" in text_l or "nutrition" in text_l or "meal" in text_l:
        flags.append("Nutrition/meal scheme")

    return flags

def read_csv(path):
    rows = []
    with path.open("r", encoding="utf-8-sig", errors="ignore") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append((row, path))
    return rows

def read_txt(path):
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = [clean(x) for x in text.splitlines() if clean(x)]
    title = lines[0] if lines else path.stem
    row = {
        "scheme_name": title,
        "details": text,
        "benefits": text,
        "eligibility": text,
        "application": text,
        "documents": text,
        "level": "State"
    }
    return [(row, path)]

def normalize(row, index, path):
    title = pick(row, ["scheme_name", "scheme name", "title", "name", "scheme"])
    if not title:
        return None

    details = pick(row, ["details", "description", "summary", "objective"])
    benefits = pick(row, ["benefits", "benefit"])
    eligibility = pick(row, ["eligibility", "eligible", "criteria"])
    application = pick(row, ["application", "application process", "how to apply", "apply"])
    documents = pick(row, ["documents", "required documents", "docs"])
    level = pick(row, ["level", "scheme level"])
    tags = pick(row, ["tags", "schemecategory", "schemeCategory", "category", "sector"])
    slug = pick(row, ["slug"])
    source = pick(row, ["source", "url", "link", "official link"])

    full = " ".join([title, details, benefits, eligibility, application, documents, level, tags])

    category = infer_category(full)
    states = strict_state(title, details, level, path)
    beneficiaries = infer_beneficiaries(full)
    eligible_categories = infer_categories(full)
    income_groups = infer_income(full)
    required_docs = infer_docs(documents + " " + eligibility + " " + benefits)

    final_benefits = benefits or details[:650] or "Benefits are available as per official scheme guidelines."
    quality_flags = scheme_quality_flags(title, category, final_benefits)

    return {
        "id": (slug or slugify(title)) + "-" + str(index),
        "title": title,
        "slug": slug or slugify(title),
        "source": source or "Imported dataset; verify with official portal",
        "state": states,
        "category": category,
        "eligibleCategories": eligible_categories,
        "beneficiaryTypes": beneficiaries,
        "incomeGroups": income_groups,
        "requiredDocuments": required_docs,
        "benefits": final_benefits,
        "eligibility": eligibility or "Eligibility should be verified from the official scheme portal.",
        "applicationProcess": application or "Apply through the official government portal or the concerned department.",
        "officialLink": source or "https://www.myscheme.gov.in/",
        "verificationStatus": "Needs official verification",
        "qualityFlags": quality_flags
    }

def main():
    rows = []

    for p in RAW_DIR.rglob("*.csv"):
        rows.extend(read_csv(p))

    for p in RAW_DIR.rglob("*.txt"):
        rows.extend(read_txt(p))

    schemes = []
    seen = set()

    for i, (row, path) in enumerate(rows, 1):
        s = normalize(row, i, path)
        if not s:
            continue
        key = s["title"].lower()
        if key in seen:
            continue
        seen.add(key)
        schemes.append(s)

    schemes = [s for s in schemes if s["state"] != ["State Not Specified"]]

    if OUT_FILE.exists():
        BACKUP_FILE.write_text(OUT_FILE.read_text(encoding="utf-8"), encoding="utf-8")

    OUT_FILE.write_text(json.dumps(schemes, indent=2, ensure_ascii=False), encoding="utf-8")

    print("Converted clean schemes:", len(schemes))

    print("\nState counts:")
    counts = {}
    for s in schemes:
        for st in s["state"]:
            counts[st] = counts.get(st, 0) + 1
    for k, v in sorted(counts.items(), key=lambda x: x[1], reverse=True)[:25]:
        print(k, v)

    print("\nMP Education examples:")
    for s in schemes:
        if ("Madhya Pradesh" in s["state"] or "All India" in s["state"]) and s["category"] == "Education & Students":
            print("-", s["title"], "|", s["state"], "|", s["eligibleCategories"], "| flags:", s["qualityFlags"][:2])

if __name__ == "__main__":
    main()
