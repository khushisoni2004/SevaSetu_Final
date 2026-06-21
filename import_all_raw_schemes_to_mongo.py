import csv
import json
import hashlib
import re
from pathlib import Path
from pymongo import MongoClient, UpdateOne

BASE_DIR = Path("/Users/khushisoni/Downloads/SevaSetu_Final_With_Data")
RAW_DIR = BASE_DIR / "datasets" / "raw_schemes"

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "sevasetu"
COLLECTION_NAME = "schemes"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
schemes_col = db[COLLECTION_NAME]

def clean_text(value):
    if value is None:
        return ""
    value = str(value)
    value = value.replace("\ufeff", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()

def detect_state_from_path(path):
    parts = [p.lower() for p in path.parts]
    states = [
        "andhra_pradesh", "arunachal_pradesh", "assam", "bihar", "chhattisgarh",
        "goa", "gujarat", "haryana", "himachal_pradesh", "jharkhand", "karnataka",
        "kerala", "madhya_pradesh", "maharashtra", "manipur", "meghalaya",
        "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim",
        "tamil_nadu", "telangana", "tripura", "uttar_pradesh", "uttarakhand",
        "west_bengal", "delhi", "puducherry", "jammu_kashmir", "ladakh"
    ]

    for state in states:
        if state in parts:
            return state.replace("_", " ").title()

    for part in parts:
        if part.startswith("state_"):
            return part.replace("state_", "").replace("_", " ").title()

    return ""

def make_hash(record):
    hash_source = {
        "scheme_name": clean_text(record.get("scheme_name")).lower(),
        "state": clean_text(record.get("state")).lower(),
        "level": clean_text(record.get("level")).lower(),
        "details": clean_text(record.get("details"))[:500].lower(),
        "source_file": clean_text(record.get("source_file")).lower(),
    }
    raw = json.dumps(hash_source, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def normalize_csv_row(row, source_file):
    scheme_name = clean_text(row.get("scheme_name") or row.get("title") or row.get("name"))

    details = clean_text(row.get("details") or row.get("description") or row.get("scheme_details"))
    benefits = clean_text(row.get("benefits"))
    eligibility = clean_text(row.get("eligibility"))
    application = clean_text(row.get("application") or row.get("how_to_apply"))
    documents = clean_text(row.get("documents"))
    level = clean_text(row.get("level") or row.get("scheme_type"))
    category = clean_text(row.get("schemeCategory") or row.get("category"))

    state = detect_state_from_path(source_file)
    if not state and level.lower() == "central":
        state = "All India"

    if not scheme_name:
        first_part = details[:90]
        scheme_name = first_part if first_part else source_file.stem.replace("_", " ").title()

    record = {
        "scheme_name": scheme_name,
        "slug": clean_text(row.get("slug")),
        "details": details,
        "description": details,
        "benefits": benefits,
        "eligibility": eligibility,
        "application": application,
        "documents": documents,
        "level": level or "State",
        "scheme_type": level or "State",
        "category": category,
        "schemeCategory": category,
        "tags": clean_text(row.get("tags")),
        "state": state,
        "source_platform": "raw_dataset",
        "source_type": "csv",
        "source_file": str(source_file),
    }

    record["record_hash"] = make_hash(record)
    return record

def parse_txt_file(path):
    text = clean_text(path.read_text(encoding="utf-8", errors="ignore"))
    if not text:
        return None

    state = detect_state_from_path(path)

    name_match = re.search(
        r"(?:scheme name|name of scheme|title)\s*[:\-]\s*(.{5,160})",
        text,
        flags=re.IGNORECASE,
    )

    if name_match:
        scheme_name = clean_text(name_match.group(1))
    else:
        scheme_name = path.stem.replace("_", " ").replace("-", " ").title()

    record = {
        "scheme_name": scheme_name,
        "slug": path.stem,
        "details": text,
        "description": text,
        "benefits": "",
        "eligibility": "",
        "application": "",
        "documents": "",
        "level": "State",
        "scheme_type": "State",
        "category": "",
        "schemeCategory": "",
        "tags": "",
        "state": state,
        "source_platform": "raw_dataset",
        "source_type": "txt",
        "source_file": str(path),
    }

    lower_text = text.lower()

    if "eligibility" in lower_text:
        record["eligibility"] = text

    if "document" in lower_text or "aadhaar" in lower_text or "certificate" in lower_text:
        record["documents"] = text

    if "benefit" in lower_text or "financial assistance" in lower_text or "subsidy" in lower_text:
        record["benefits"] = text

    record["record_hash"] = make_hash(record)
    return record

def load_all_records():
    records = []

    csv_files = list(RAW_DIR.rglob("*.csv"))
    txt_files = list(RAW_DIR.rglob("*.txt"))

    print("CSV files found:", len(csv_files))
    print("TXT files found:", len(txt_files))

    for csv_path in csv_files:
        print("Reading CSV:", csv_path)
        with csv_path.open("r", encoding="utf-8", errors="ignore", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = normalize_csv_row(row, csv_path)
                if record and record["scheme_name"]:
                    records.append(record)

    for txt_path in txt_files:
        record = parse_txt_file(txt_path)
        if record and record["scheme_name"]:
            records.append(record)

    return records

def main():
    print("Starting SevaSetu raw schemes import...")
    print("Raw folder:", RAW_DIR)

    records = load_all_records()
    print("Raw records prepared:", len(records))

    unique = {}
    for record in records:
        if record.get("record_hash"):
            unique[record["record_hash"]] = record

    final_records = list(unique.values())
    print("Unique records:", len(final_records))

    if not final_records:
        print("No valid records found. Check RAW_DIR path.")
        return

    schemes_col.drop_index("record_hash_1") if "record_hash_1" in schemes_col.index_information() else None
    schemes_col.create_index("record_hash", unique=True)
    schemes_col.create_index("scheme_name")
    schemes_col.create_index("state")
    schemes_col.create_index("category")
    schemes_col.create_index("source_platform")

    operations = [
        UpdateOne(
            {"record_hash": record["record_hash"]},
            {"$set": record},
            upsert=True,
        )
        for record in final_records
    ]

    result = schemes_col.bulk_write(operations, ordered=False)

    print("Import completed.")
    print("Inserted:", result.upserted_count)
    print("Updated:", result.modified_count)
    print("Total schemes in MongoDB:", schemes_col.count_documents({}))
    print("Raw dataset schemes:", schemes_col.count_documents({"source_platform": "raw_dataset"}))
    print("TXT schemes:", schemes_col.count_documents({"source_type": "txt"}))
    print("CSV schemes:", schemes_col.count_documents({"source_type": "csv"}))

if __name__ == "__main__":
    main()
