import re
import json
from pathlib import Path
import os
import hmac
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "sevasetu_db")
JWT_SECRET = os.getenv("JWT_SECRET", "change_this_secret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

app = FastAPI(title="SevaSetu Auth Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]
users = db["users"]
profiles = db["profiles"]
saved_schemes = db["saved_schemes"]


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    mobile: Optional[str] = Field(default="", max_length=15)
    password: str = Field(..., min_length=6, max_length=80)


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    category: Optional[str] = None
    incomeRange: Optional[str] = None
    occupation: Optional[str] = None
    beneficiaryType: Optional[str] = None
    documents: Optional[list] = None
    familySize: Optional[int] = None
    disability: Optional[str] = None
    student: Optional[bool] = None
    farmer: Optional[bool] = None
    woman: Optional[bool] = None
    seniorCitizen: Optional[bool] = None


class SavedSchemeRequest(BaseModel):
    scheme: dict


def now_utc():
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    iterations = 120000
    password_bytes = password.encode("utf-8")
    dk = hashlib.pbkdf2_hmac("sha256", password_bytes, salt.encode("utf-8"), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${dk.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        algorithm, iterations, salt, stored_hash = hashed.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        password_bytes = password.encode("utf-8")
        dk = hashlib.pbkdf2_hmac("sha256", password_bytes, salt.encode("utf-8"), int(iterations))
        return hmac.compare_digest(dk.hex(), stored_hash)
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    expire = now_utc() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": now_utc(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def clean_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "mobile": user.get("mobile", ""),
        "created_at": user.get("created_at"),
        "last_login": user.get("last_login"),
    }


async def get_user_from_token(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing login token")

    token = authorization.replace("Bearer ", "").strip()

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("email")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


@app.on_event("startup")
async def startup():
    await users.create_index("email", unique=True)
    await users.create_index("mobile")
    await saved_schemes.create_index([("user_email", 1), ("scheme.id", 1)], unique=True)


@app.get("/")
async def root():
    return {"message": "SevaSetu backend running", "status": "ok"}


@app.get("/health")
async def health():
    try:
        await db.command("ping")
        mongo_status = "connected"
    except Exception:
        mongo_status = "not connected"

    return {
        "status": "ok",
        "mongodb": mongo_status,
        "database": DB_NAME,
    }


@app.post("/api/auth/register")
async def register(data: RegisterRequest):
    email = data.email.lower().strip()
    mobile = (data.mobile or "").strip()

    existing = await users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    if mobile:
        existing_mobile = await users.find_one({"mobile": mobile})
        if existing_mobile:
            raise HTTPException(status_code=409, detail="Mobile number already registered")

    user_doc = {
        "name": data.name.strip(),
        "email": email,
        "mobile": mobile,
        "password_hash": hash_password(data.password),
        "role": "citizen",
        "is_active": True,
        "created_at": now_utc(),
        "last_login": now_utc(),
    }

    result = await users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    token = create_token(str(result.inserted_id), email)

    return {
        "message": "Signup successful",
        "token": token,
        "user": clean_user(user_doc),
    }


@app.post("/api/auth/login")
async def login(data: LoginRequest):
    login_id = data.email.lower().strip()

    user = await users.find_one({
        "$or": [
            {"email": login_id},
            {"mobile": login_id},
        ]
    })

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email/mobile or password")

    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email/mobile or password")

    await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": now_utc()}},
    )

    user["last_login"] = now_utc()
    token = create_token(str(user["_id"]), user["email"])

    return {
        "message": "Login successful",
        "token": token,
        "user": clean_user(user),
    }


@app.get("/api/auth/me")
async def me(authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization)
    return {"user": clean_user(user)}


@app.get("/api/users")
async def list_users():
    data = []
    cursor = users.find({}, {"password_hash": 0}).sort("created_at", -1)
    async for user in cursor:
        data.append(clean_user(user))
    return {"count": len(data), "users": data}


def clean_saved_scheme(item: dict) -> dict:
    scheme = item.get("scheme", {})
    return {
        "mongo_id": str(item.get("_id")),
        "user_email": item.get("user_email", ""),
        "scheme": scheme,
        "saved_at": item.get("saved_at"),
    }


@app.get("/api/saved-db")
async def get_saved_schemes(authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization)
    data = []
    cursor = saved_schemes.find({"user_email": user["email"]}).sort("saved_at", -1)

    async for item in cursor:
        data.append(clean_saved_scheme(item))

    return {
        "count": len(data),
        "items": data,
    }


@app.post("/api/saved-db")
async def save_scheme(data: SavedSchemeRequest, authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization)
    scheme = data.scheme or {}

    scheme_id = str(scheme.get("id") or scheme.get("title") or "").strip()
    if not scheme_id:
        raise HTTPException(status_code=400, detail="Invalid scheme data")

    doc = {
        "user_id": str(user["_id"]),
        "user_email": user["email"],
        "scheme": scheme,
        "saved_at": now_utc(),
    }

    try:
        existing = await saved_schemes.find_one({
            "user_email": user["email"],
            "scheme.id": scheme_id,
        })

        if existing:
            return {
                "message": "Scheme already saved",
                "item": clean_saved_scheme(existing),
            }

        result = await saved_schemes.insert_one(doc)
        doc["_id"] = result.inserted_id

        return {
            "message": "Scheme saved successfully",
            "item": clean_saved_scheme(doc),
        }
    except Exception as e:
        existing = await saved_schemes.find_one({
            "user_email": user["email"],
            "scheme.id": scheme_id,
        })
        if existing:
            return {
                "message": "Scheme already saved",
                "item": clean_saved_scheme(existing),
            }
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/saved-db/{scheme_id}")
async def delete_saved_scheme(scheme_id: str, authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization)

    result = await saved_schemes.delete_one({
        "user_email": user["email"],
        "scheme.id": scheme_id,
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Saved scheme not found")

    return {
        "message": "Scheme removed successfully",
        "deleted": True,
        "scheme_id": scheme_id,
    }


@app.delete("/api/saved-db/mongo/{mongo_id}")
async def delete_saved_scheme_by_mongo_id(mongo_id: str, authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization)

    try:
        oid = ObjectId(mongo_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid MongoDB id")

    result = await saved_schemes.delete_one({
        "_id": oid,
        "user_email": user["email"],
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Saved scheme not found")

    return {
        "message": "Scheme removed successfully",
        "deleted": True,
        "mongo_id": mongo_id,
    }


def public_user(user: dict) -> dict:
    return {
        "id": str(user.get("_id")),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "mobile": user.get("mobile", ""),
        "age": user.get("age"),
        "gender": user.get("gender", ""),
        "state": user.get("state", ""),
        "district": user.get("district", ""),
        "city": user.get("city", ""),
        "category": user.get("category", ""),
        "incomeRange": user.get("incomeRange", ""),
        "occupation": user.get("occupation", ""),
        "beneficiaryType": user.get("beneficiaryType", ""),
        "documents": user.get("documents", []),
        "familySize": user.get("familySize"),
        "disability": user.get("disability", ""),
        "student": user.get("student", False),
        "farmer": user.get("farmer", False),
        "woman": user.get("woman", False),
        "seniorCitizen": user.get("seniorCitizen", False),
        "created_at": user.get("created_at"),
        "last_login": user.get("last_login"),
        "updated_at": user.get("updated_at"),
    }


@app.put("/api/profile")
async def update_profile(data: ProfileUpdateRequest, authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization)

    allowed = {
        "name",
        "mobile",
        "age",
        "gender",
        "state",
        "district",
        "city",
        "category",
        "incomeRange",
        "occupation",
        "beneficiaryType",
        "documents",
        "familySize",
        "disability",
        "student",
        "farmer",
        "woman",
        "seniorCitizen",
    }

    payload = data.dict(exclude_unset=True)
    update_data = {}

    for key, value in payload.items():
        if key in allowed:
            update_data[key] = value

    update_data["updated_at"] = now_utc()

    await users.update_one(
        {"_id": user["_id"]},
        {"$set": update_data},
    )

    updated = await users.find_one({"_id": user["_id"]})

    return {
        "message": "Profile updated successfully",
        "user": public_user(updated),
    }


def clean_profile_doc(doc: dict) -> dict:
    if not doc:
        return {}

    doc.pop("_id", None)

    return {
        "user_id": doc.get("user_id", ""),
        "email": doc.get("email", ""),
        "name": doc.get("name", ""),
        "mobile": doc.get("mobile", ""),
        "age": doc.get("age"),
        "gender": doc.get("gender", ""),
        "state": doc.get("state", ""),
        "district": doc.get("district", ""),
        "city": doc.get("city", ""),
        "category": doc.get("category", ""),
        "incomeRange": doc.get("incomeRange", ""),
        "occupation": doc.get("occupation", ""),
        "beneficiaryType": doc.get("beneficiaryType", ""),
        "documents": doc.get("documents", []),
        "uploadedDocuments": doc.get("uploadedDocuments", []),
        "familySize": doc.get("familySize"),
        "disability": doc.get("disability", "No"),
        "student": doc.get("student", False),
        "farmer": doc.get("farmer", False),
        "woman": doc.get("woman", False),
        "seniorCitizen": doc.get("seniorCitizen", False),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


@app.get("/api/profile")
async def get_profile(authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization)

    profile = await profiles.find_one({"email": user["email"]})

    if not profile:
        profile = {
            "user_id": str(user["_id"]),
            "email": user.get("email", ""),
            "name": user.get("name", ""),
            "mobile": user.get("mobile", ""),
            "age": user.get("age"),
            "documents": [],
            "uploadedDocuments": [],
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }

        await profiles.insert_one(profile.copy())

    return {
        "profile": clean_profile_doc(profile)
    }


@app.put("/api/profile")
async def update_profile(data: ProfileUpdateRequest, authorization: Optional[str] = Header(default=None)):
    user = await get_user_from_token(authorization)

    payload = data.dict(exclude_unset=True)

    allowed = {
        "name",
        "email",
        "mobile",
        "age",
        "gender",
        "state",
        "district",
        "city",
        "category",
        "incomeRange",
        "occupation",
        "beneficiaryType",
        "documents",
        "uploadedDocuments",
        "familySize",
        "disability",
        "student",
        "farmer",
        "woman",
        "seniorCitizen",
    }

    update_data = {}

    for key, value in payload.items():
        if key in allowed:
            update_data[key] = value

    update_data["user_id"] = str(user["_id"])
    update_data["email"] = user["email"]
    update_data["updated_at"] = now_utc()

    existing = await profiles.find_one({"email": user["email"]})

    if not existing:
        update_data["created_at"] = now_utc()

    await profiles.update_one(
        {"email": user["email"]},
        {"$set": update_data},
        upsert=True,
    )

    # Keep useful basic fields synced in users collection too
    user_sync = {}
    for key in ["name", "mobile", "age", "gender", "state", "district", "city", "category", "incomeRange", "occupation", "beneficiaryType", "documents", "uploadedDocuments"]:
        if key in update_data:
            user_sync[key] = update_data[key]

    if user_sync:
        user_sync["updated_at"] = now_utc()
        await users.update_one(
            {"_id": user["_id"]},
            {"$set": user_sync},
        )

    profile = await profiles.find_one({"email": user["email"]})

    return {
        "message": "Profile saved successfully in MongoDB",
        "profile": clean_profile_doc(profile),
        "user": clean_profile_doc(profile),
    }


class VoiceQueryRequest(BaseModel):
    query: str
    profile: Optional[dict] = None
    language: Optional[str] = "english"
    language: Optional[str] = "hindi"


def load_voice_scheme_data():
    possible_paths = [
        Path(__file__).resolve().parent.parent / "frontend" / "src" / "data" / "sevasetuImportedSchemes.json",
        Path(__file__).resolve().parent / "sevasetuImportedSchemes.json",
    ]

    for p in possible_paths:
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                return []

    return []


def normalize_voice_text(value):
    return str(value or "").strip().lower()


def parse_voice_query(query: str):
    q = normalize_voice_text(query)

    extracted = {
        "state": "",
        "gender": "",
        "age": None,
        "occupation": "",
        "incomeRange": "",
        "category": "",
        "beneficiaryType": "",
        "documents": [],
        "need": "",
    }

    state_map = {
        "mp": "Madhya Pradesh",
        "madhya pradesh": "Madhya Pradesh",
        "up": "Uttar Pradesh",
        "uttar pradesh": "Uttar Pradesh",
        "maharashtra": "Maharashtra",
        "rajasthan": "Rajasthan",
        "gujarat": "Gujarat",
        "bihar": "Bihar",
        "punjab": "Punjab",
        "assam": "Assam",
        "kerala": "Kerala",
        "karnataka": "Karnataka",
        "tamil nadu": "Tamil Nadu",
        "odisha": "Odisha",
        "west bengal": "West Bengal",
        "delhi": "Delhi",
    }

    for key, value in state_map.items():
        if key in q:
            extracted["state"] = value
            break

    if any(w in q for w in ["student", "vidyarthi", "college", "school", "scholarship"]):
        extracted["beneficiaryType"] = "Student"
        extracted["occupation"] = "Student"
        extracted["need"] = "education scholarship training"

    if any(w in q for w in ["farmer", "kisan", "farming", "agriculture", "crop"]):
        extracted["beneficiaryType"] = "Farmer"
        extracted["occupation"] = "Farmer"
        extracted["need"] = "agriculture farming subsidy"

    if any(w in q for w in ["woman", "women", "mahila", "girl", "female"]):
        extracted["gender"] = "Female"
        extracted["beneficiaryType"] = extracted["beneficiaryType"] or "Women"
        extracted["need"] = extracted["need"] or "women welfare support"

    if any(w in q for w in ["business", "startup", "msme", "shop", "loan"]):
        extracted["beneficiaryType"] = extracted["beneficiaryType"] or "MSME Owner"
        extracted["occupation"] = extracted["occupation"] or "Business Owner"
        extracted["need"] = "business startup loan finance"

    if any(w in q for w in ["worker", "majdur", "labour", "labor"]):
        extracted["beneficiaryType"] = extracted["beneficiaryType"] or "Worker"
        extracted["occupation"] = extracted["occupation"] or "Worker"
        extracted["need"] = "worker labour welfare"

    if any(w in q for w in ["senior", "old", "elder", "pension", "vridh"]):
        extracted["beneficiaryType"] = extracted["beneficiaryType"] or "Senior Citizen"
        extracted["occupation"] = extracted["occupation"] or "Senior Citizen"
        extracted["need"] = "pension senior citizen"

    if any(w in q for w in ["low income", "poor", "garib", "below 1 lakh", "below one lakh", "bpl"]):
        extracted["incomeRange"] = "Below ₹1 Lakh"

    if any(w in q for w in ["obc"]):
        extracted["category"] = "OBC"
    elif any(w in q for w in ["sc"]):
        extracted["category"] = "SC"
    elif any(w in q for w in ["st"]):
        extracted["category"] = "ST"
    elif any(w in q for w in ["ews"]):
        extracted["category"] = "EWS"

    doc_map = {
        "aadhaar": "Aadhaar Card",
        "aadhar": "Aadhaar Card",
        "pan": "PAN Card",
        "income": "Income Certificate",
        "caste": "Caste Certificate",
        "jati": "Caste Certificate",
        "domicile": "Domicile Certificate",
        "ration": "Ration Card",
        "bank": "Bank Passbook",
        "passbook": "Bank Passbook",
        "birth": "Birth Certificate",
        "marksheet": "Educational Certificate",
        "education certificate": "Educational Certificate",
    }

    docs = []
    for key, value in doc_map.items():
        if key in q and value not in docs:
            docs.append(value)

    extracted["documents"] = docs

    age_match = re.search(r"\b(\d{1,2})\b", q)
    if age_match:
        try:
            extracted["age"] = int(age_match.group(1))
        except Exception:
            pass

    return extracted


def merge_voice_profile(profile, extracted):
    profile = profile or {}
    merged = dict(profile)

    # Voice query must get highest priority because user is asking current need.
    for key, value in extracted.items():
        if key == "documents":
            old_docs = profile.get("documents") or []
            merged["documents"] = list(dict.fromkeys(old_docs + value))
        elif value:
            merged[key] = value

    return merged

def scheme_states(scheme):
    raw = scheme.get("state") or ["All India"]
    if isinstance(raw, str):
        raw = [raw]
    return raw


def scheme_docs(scheme):
    docs = scheme.get("requiredDocuments") or []
    if isinstance(docs, str):
        docs = [docs]
    return docs


def has_words(source, words):
    s = normalize_voice_text(source)
    return any(normalize_voice_text(w) in s for w in words if w)


def voice_intent_config(intent: str):
    configs = {
        "student": {
            "category_words": ["education", "student", "scholarship"],
            "strong_words": ["scholarship", "hostel", "merit", "pre-matric", "post-matric", "education", "student", "training"],
            "bad_words": ["farmer", "farming", "agriculture", "women", "woman", "widow", "maternity", "msme owner", "business owner", "senior citizen"],
            "label": "Education & Students",
        },
        "farmer": {
            "category_words": ["agriculture", "farmer"],
            "strong_words": ["farmer", "kisan", "agriculture", "irrigation", "crop", "soil", "farming", "subsidy"],
            "bad_words": ["student", "scholarship", "widow", "maternity", "senior citizen", "msme owner"],
            "label": "Agriculture & Farmers",
        },
        "women": {
            "category_words": ["women", "woman", "child"],
            "strong_words": ["women", "woman", "girl", "mahila", "widow", "maternity", "janani", "mother", "child"],
            "bad_words": ["farmer", "agriculture", "student", "scholarship", "msme owner", "senior citizen"],
            "label": "Women & Child",
        },
        "business": {
            "category_words": ["business", "industry", "finance", "banking"],
            "strong_words": ["startup", "business", "msme", "loan", "credit", "finance", "industry"],
            "bad_words": ["student", "farmer", "maternity", "widow", "senior citizen"],
            "label": "Business / Finance",
        },
        "worker": {
            "category_words": ["youth", "employment", "skill"],
            "strong_words": ["skill", "employment", "job", "worker", "labour", "apprenticeship", "training"],
            "bad_words": ["farmer", "maternity", "widow", "senior citizen"],
            "label": "Employment & Skills",
        },
        "senior": {
            "category_words": ["senior", "pension", "welfare"],
            "strong_words": ["senior", "pension", "elder", "old age"],
            "bad_words": ["student", "farmer", "startup", "maternity"],
            "label": "Senior Citizen",
        },
    }
    return configs.get(intent, {
        "category_words": [],
        "strong_words": [],
        "bad_words": [],
        "label": "General",
    })


def scheme_public_text(scheme: dict):
    return " ".join([
        str(scheme.get("title", "")),
        str(scheme.get("category", "")),
        str(scheme.get("benefits", "")),
    ]).lower()


def strict_category_match(scheme: dict, intent: str):
    if intent == "general":
        return True

    config = voice_intent_config(intent)
    category = normalize_voice_text(scheme.get("category", ""))
    title = normalize_voice_text(scheme.get("title", ""))
    benefits = normalize_voice_text(scheme.get("benefits", ""))

    category_hit = any(word in category for word in config["category_words"])
    title_hit = any(word in title for word in config["strong_words"])
    benefit_hit = any(word in benefits for word in config["strong_words"])

    bad_hit = any(word in benefits for word in config["bad_words"])

    # Category or title must be relevant. Benefits can support it, but cannot alone override wrong category.
    if category_hit or title_hit:
        return True

    # Only allow benefit-only match when there is no contradiction.
    if benefit_hit and not bad_hit:
        return True

    return False


def strict_state_match(scheme: dict, profile: dict):
    states = scheme_states(scheme)
    profile_state = str(profile.get("state") or "").strip()

    if not profile_state:
        return True

    return "All India" in states or profile_state in states


def strict_category_caste_match(scheme: dict, user_category: str):
    if not user_category:
        return False

    user_category = normalize_voice_text(user_category)

    # Do not check requiredDocuments here. Caste Certificate document should not create fake SC/OBC match.
    public_text = scheme_public_text(scheme)

    category_words = {
        "sc": [" sc ", "scheduled caste", "dalit"],
        "st": [" st ", "scheduled tribe"],
        "obc": ["obc", "other backward"],
        "ews": ["ews", "economically weaker"],
        "minority": ["minority", "minorities"],
        "general": ["general citizen", "all citizens", "citizen"],
    }

    words = category_words.get(user_category, [user_category])
    padded = " " + public_text + " "

    return any(word in padded for word in words)


def score_voice_scheme(scheme, profile, query):
    score = 0
    reasons = []
    missing_docs = []
    available_docs = []

    extracted = parse_voice_query(query)
    intent = get_voice_intent(query, extracted) if "get_voice_intent" in globals() else "general"
    config = voice_intent_config(intent)

    public_text = scheme_public_text(scheme)
    category = str(scheme.get("category") or "Scheme")

    if strict_category_match(scheme, intent):
        score += 30
        reasons.append(f"Scheme category matched your need: {config['label']}")
    else:
        score -= 40
        reasons.append("Scheme category does not match your current need")

    if strict_state_match(scheme, profile):
        score += 20
        reasons.append(f"State coverage matched: {profile.get('state') or 'All India'}")
    else:
        score -= 30
        reasons.append("State coverage does not match your profile")

    # Strong title/benefit keyword match
    strong_hits = [w for w in config["strong_words"] if w in public_text]
    if strong_hits:
        score += min(20, 8 + len(strong_hits) * 4)
        reasons.append("Query keywords matched: " + ", ".join(strong_hits[:3]))

    # Penalize contradiction in benefits text
    bad_hits = [w for w in config["bad_words"] if w in public_text]
    if bad_hits:
        score -= 18
        reasons.append("Reduced score because scheme description targets another beneficiary group")

    beneficiary = str(profile.get("beneficiaryType") or "").strip()
    occupation = str(profile.get("occupation") or "").strip()

    if beneficiary and normalize_voice_text(beneficiary) in public_text:
        score += 8
        reasons.append(f"Beneficiary matched: {beneficiary}")
    elif occupation and normalize_voice_text(occupation) in public_text:
        score += 7
        reasons.append(f"Occupation matched: {occupation}")

    user_category = str(profile.get("category") or "").strip()
    if user_category:
        if strict_category_caste_match(scheme, user_category):
            score += 8
            reasons.append(f"Category/caste matched: {user_category}")
        else:
            reasons.append(f"Category/caste considered: {user_category}")

    if profile.get("incomeRange"):
        score += 5
        reasons.append(f"Income information available: {profile.get('incomeRange')}")

    user_docs = set(profile.get("documents") or [])
    uploaded = profile.get("uploadedDocuments") or []

    for item in uploaded:
        if isinstance(item, dict):
            if item.get("documentName"):
                user_docs.add(item.get("documentName"))
            if item.get("guessedType"):
                user_docs.add(item.get("guessedType"))

    required = scheme_docs(scheme)

    if required:
        for doc in required:
            if doc in user_docs:
                available_docs.append(doc)
            else:
                missing_docs.append(doc)

        doc_score = round((len(available_docs) / len(required)) * 12)
        score += doc_score

        if available_docs:
            reasons.append("Available documents: " + ", ".join(available_docs[:3]))
        if missing_docs:
            reasons.append("Missing documents: " + ", ".join(missing_docs[:3]))

    score = max(5, min(92, score))

    return {
        "score": score,
        "reasons": reasons[:6],
        "missingDocuments": missing_docs,
        "availableDocuments": available_docs,
        "intent": intent,
    }


def build_voice_reply(language, best, missing):
    language = clean_voice_language(language) if "clean_voice_language" in globals() else "english"

    title = best.get("title", "a matching scheme")
    category = best.get("category", "scheme")
    score = best.get("_aiScore", 0)

    if language == "hindi":
        reply = (
            f"आपकी voice query और profile के आधार पर {title} सबसे बेहतर {category} scheme लग रही है। "
            f"इसका match score {score} percent है। "
        )
        if missing:
            reply += "Missing documents हैं: " + ", ".join(missing[:3]) + ". "
        else:
            reply += "आपके documents अच्छे लग रहे हैं। "
        reply += "Final eligibility official government portal पर confirm करें।"
        return reply

    reply = (
        f"Based on your current voice query and profile, {title} is the best matching {category} scheme. "
        f"The match score is {score} percent. "
    )

    if missing:
        reply += "Missing documents are: " + ", ".join(missing[:3]) + ". "
    else:
        reply += "Your document readiness looks good. "

    reply += "Please confirm final eligibility only on the official government portal."
    return reply




def ss_voice_clean(value):
    return str(value or "").strip().lower()


INDIAN_STATES_FOR_VOICE = [
    "Madhya Pradesh",
    "Uttar Pradesh",
    "Rajasthan",
    "Maharashtra",
    "Gujarat",
    "Bihar",
    "Punjab",
    "Delhi",
    "Karnataka",
    "Kerala",
    "Tamil Nadu",
    "West Bengal",
    "Odisha",
    "Assam",
    "All India",
]


INDIAN_STATES_FOR_VOICE = [
    "Madhya Pradesh",
    "Uttar Pradesh",
    "Rajasthan",
    "Maharashtra",
    "Gujarat",
    "Bihar",
    "Punjab",
    "Delhi",
    "Karnataka",
    "Kerala",
    "Tamil Nadu",
    "West Bengal",
    "Odisha",
    "Assam",
    "All India",
]


def ss_voice_state_list(scheme):
    found = []

    raw_values = [
        scheme.get("state"),
        scheme.get("states"),
        scheme.get("applicableStates"),
        scheme.get("coverage"),
        scheme.get("location"),
    ]

    for raw in raw_values:
        if isinstance(raw, list):
            for item in raw:
                if str(item).strip():
                    found.append(str(item).strip())
        elif raw:
            found.append(str(raw).strip())

    title_text = str(scheme.get("title", "")).lower()
    public_text = ss_voice_public_text(scheme) if "ss_voice_public_text" in globals() else title_text

    for state in INDIAN_STATES_FOR_VOICE:
        if state.lower() in title_text or state.lower() in public_text:
            found.append(state)

    if not found:
        found.append("All India")

    clean = []
    for item in found:
        if item and item not in clean:
            clean.append(item)

    return clean


def ss_voice_title_state(scheme):
    title = str(scheme.get("title", "")).lower()

    for state in INDIAN_STATES_FOR_VOICE:
        if state != "All India" and state.lower() in title:
            return state

    if "all india" in title:
        return "All India"

    return ""


def ss_voice_state_match(scheme, profile_state):
    profile_state = str(profile_state or "").strip()

    if not profile_state:
        return True

    title_state = ss_voice_title_state(scheme)

    # Title state is the strongest signal. If title says Rajasthan and user selected MP, reject.
    if title_state:
        if title_state == "All India":
            return True
        return title_state.lower() == profile_state.lower()

    states = ss_voice_state_list(scheme)

    for st in states:
        if st.lower() == "all india":
            return True
        if st.lower() == profile_state.lower():
            return True

    return False


def ss_voice_state_label(scheme):
    title_state = ss_voice_title_state(scheme)

    if title_state:
        return title_state

    states = ss_voice_state_list(scheme)
    return ", ".join(states[:2]) if states else "All India"


def ss_voice_current_intent(query):
    q = ss_voice_clean(query)

    if any(w in q for w in ["student", "scholarship", "school", "college", "education", "hostel", "merit", "pre matric", "post matric"]):
        return "student"

    if any(w in q for w in ["farmer", "kisan", "agriculture", "crop", "irrigation", "soil", "farming"]):
        return "farmer"

    if any(w in q for w in ["woman", "women", "mahila", "girl", "widow", "maternity", "mother", "female"]):
        return "women"

    if any(w in q for w in ["business", "startup", "msme", "shop", "loan", "credit", "entrepreneur"]):
        return "business"

    if any(w in q for w in ["job", "skill", "employment", "worker", "labour", "apprenticeship"]):
        return "employment"

    if any(w in q for w in ["senior", "pension", "old age", "elder"]):
        return "senior"

    if any(w in q for w in ["health", "medical", "insurance", "hospital", "treatment"]):
        return "health"

    return "unknown"


def ss_voice_intent_rules(intent):
    return {
        "student": {
            "category": ["education", "student"],
            "title": ["scholarship", "hostel", "merit", "education", "student", "pre-matric", "post-matric"],
            "bad": ["farmer", "agriculture", "maternity", "widow", "msme", "business", "senior", "medical"],
            "label": "Education & Students",
        },
        "farmer": {
            "category": ["agriculture", "farmer"],
            "title": ["farmer", "kisan", "irrigation", "crop", "soil", "agriculture", "farming"],
            "bad": ["student", "scholarship", "maternity", "widow", "business", "senior"],
            "label": "Agriculture & Farmers",
        },
        "women": {
            "category": ["women", "woman", "child"],
            "title": ["women", "woman", "mahila", "girl", "widow", "maternity", "mother", "janani"],
            "bad": ["farmer", "agriculture", "msme", "business", "senior"],
            "label": "Women & Child",
        },
        "business": {
            "category": ["business", "industry", "finance", "banking", "entrepreneur"],
            "title": ["business", "startup", "msme", "loan", "credit", "entrepreneur", "finance"],
            "bad": ["student", "scholarship", "maternity", "widow", "senior", "farmer"],
            "label": "Business & Finance",
        },
        "employment": {
            "category": ["employment", "skill", "youth"],
            "title": ["skill", "job", "employment", "apprenticeship", "training", "worker"],
            "bad": ["maternity", "widow", "senior", "farmer"],
            "label": "Employment & Skills",
        },
        "senior": {
            "category": ["senior", "pension", "welfare"],
            "title": ["senior", "pension", "old age", "elder"],
            "bad": ["student", "farmer", "startup", "maternity"],
            "label": "Senior Citizen",
        },
        "health": {
            "category": ["health", "wellness", "medical"],
            "title": ["health", "medical", "insurance", "hospital", "treatment", "nutrition"],
            "bad": ["student", "scholarship", "farmer", "startup"],
            "label": "Health & Wellness",
        },
    }.get(intent, {"category": [], "title": [], "bad": [], "label": "General"})


def ss_voice_public_text(scheme):
    return " ".join([
        str(scheme.get("title", "")),
        str(scheme.get("category", "")),
        str(scheme.get("benefits", "")),
        str(scheme.get("description", "")),
        str(scheme.get("summary", "")),
    ]).lower()


def ss_voice_exact_intent_match(scheme, intent):
    if intent == "unknown":
        return False

    rules = ss_voice_intent_rules(intent)
    category = ss_voice_clean(scheme.get("category", ""))
    title = ss_voice_clean(scheme.get("title", ""))
    public = ss_voice_public_text(scheme)

    category_hit = any(w in category for w in rules["category"])
    title_hit = any(w in title for w in rules["title"])
    public_hit = any(w in public for w in rules["title"])
    bad_hit = any(w in public for w in rules["bad"])

    if category_hit:
        return True

    if title_hit and not bad_hit:
        return True

    if public_hit and not bad_hit and category_hit:
        return True

    return False


def ss_voice_state_match(scheme, profile_state):
    profile_state = str(profile_state or "").strip()

    if not profile_state:
        return True

    states = ss_voice_state_list(scheme)

    for st in states:
        if st.lower() == "all india":
            return True
        if st.lower() == profile_state.lower():
            return True

    return False


def ss_voice_docs(scheme):
    docs = scheme.get("requiredDocuments") or []
    if isinstance(docs, str):
        return [docs]
    if isinstance(docs, list):
        return docs
    return []


def ss_voice_score_scheme(scheme, profile, query, intent):
    score = 0
    reasons = []
    missing_docs = []
    available_docs = []

    rules = ss_voice_intent_rules(intent)
    public = ss_voice_public_text(scheme)

    if not ss_voice_exact_intent_match(scheme, intent):
        return None

    if not ss_voice_state_match(scheme, profile.get("state")):
        return None

    score += 35
    reasons.append(f"Exact need matched: {rules['label']}")

    scheme_state_label = ss_voice_state_label(scheme)
    selected_state = profile.get("state") or "All India"

    if scheme_state_label == "All India":
        score += 16
        reasons.append("State group: All India")
    else:
        score += 22
        reasons.append(f"State group matched: {scheme_state_label}")

    title_hits = [w for w in rules["title"] if w in public]
    if title_hits:
        score += min(16, len(title_hits) * 4)
        reasons.append("Relevant keywords: " + ", ".join(title_hits[:3]))

    user_category = str(profile.get("category") or "").strip()
    required = ss_voice_docs(scheme)

    if user_category:
        cat = user_category.lower()
        caste_doc_needed = any("caste" in str(d).lower() for d in required)

        category_text_match = False
        padded_public = " " + public + " "

        if cat == "sc":
            category_text_match = " scheduled caste " in padded_public or " sc " in padded_public or " dalit " in padded_public
        elif cat == "st":
            category_text_match = " scheduled tribe " in padded_public or " st " in padded_public
        elif cat == "obc":
            category_text_match = " obc " in padded_public or " other backward " in padded_public
        elif cat == "ews":
            category_text_match = " ews " in padded_public or " economically weaker " in padded_public
        elif cat == "minority":
            category_text_match = " minority " in padded_public or " minorities " in padded_public
        elif cat == "general":
            category_text_match = " all citizens " in padded_public or " citizen " in padded_public or scheme_state_label == "All India"

        if category_text_match or caste_doc_needed:
            score += 12
            reasons.append(f"Category/caste matched or supported: {user_category}")
        else:
            score += 3
            reasons.append(f"Category/caste considered: {user_category}")

    if profile.get("incomeRange"):
        score += 5
        reasons.append(f"Income considered: {profile.get('incomeRange')}")

    user_docs = set(profile.get("documents") or [])

    for item in profile.get("uploadedDocuments") or []:
        if isinstance(item, dict):
            if item.get("documentName"):
                user_docs.add(item.get("documentName"))
            if item.get("guessedType"):
                user_docs.add(item.get("guessedType"))

    if required:
        for doc in required:
            if doc in user_docs:
                available_docs.append(doc)
            else:
                missing_docs.append(doc)

        score += round((len(available_docs) / len(required)) * 8)

        if missing_docs:
            reasons.append("Missing documents: " + ", ".join(missing_docs[:3]))
        if available_docs:
            reasons.append("Available documents: " + ", ".join(available_docs[:3]))

    score = max(5, min(92, score))

    return {
        "score": score,
        "reasons": reasons[:6],
        "missingDocuments": missing_docs,
        "availableDocuments": available_docs,
    }


def ss_voice_reply(language, best, missing):
    language = ss_voice_clean(language)
    title = best.get("title", "a matching scheme")
    category = best.get("category", "scheme")
    score = best.get("_aiScore", 0)

    if language == "hindi":
        reply = f"आपकी query के अनुसार {title} सबसे बेहतर {category} scheme लग रही है। Match score {score} percent है। "
        if missing:
            reply += "Missing documents हैं: " + ", ".join(missing[:3]) + ". "
        else:
            reply += "आपके documents अच्छे लग रहे हैं। "
        reply += "Final eligibility official government portal पर confirm करें।"
        return reply

    reply = f"Based on your query, {title} is the best matching {category} scheme. The match score is {score} percent. "
    if missing:
        reply += "Missing documents are: " + ", ".join(missing[:3]) + ". "
    else:
        reply += "Your document readiness looks good. "
    reply += "Please confirm final eligibility only on the official government portal."
    return reply



def real_arr(value):
    if not value:
        return []
    if isinstance(value, list):
        return value
    return [value]


def real_clean(value):
    return str(value or "").strip().lower()


def real_intent(query):
    q = real_clean(query)

    if any(w in q for w in ["student", "scholarship", "education", "college", "school", "hostel"]):
        return "Student"

    if any(w in q for w in ["farmer", "kisan", "agriculture", "crop", "irrigation"]):
        return "Farmer"

    if any(w in q for w in ["woman", "women", "mahila", "girl", "mother", "maternity", "widow"]):
        return "Women"

    if any(w in q for w in ["business", "startup", "msme", "loan", "vendor", "shop"]):
        return "Business Owner"

    if any(w in q for w in ["worker", "skill", "job", "employment", "artisan"]):
        return "Worker"

    if any(w in q for w in ["health", "medical", "insurance", "hospital"]):
        return "Citizen"

    return ""


def real_user_docs(profile):
    docs = set(profile.get("documents") or [])

    for item in profile.get("uploadedDocuments") or []:
        if isinstance(item, dict):
            if item.get("documentName"):
                docs.add(item["documentName"])
            if item.get("guessedType"):
                docs.add(item["guessedType"])

    return list(docs)


def real_scheme_score(scheme, profile, query):
    score = 0
    reasons = []
    warnings = []
    available = []
    missing = []

    states = real_arr(scheme.get("state"))
    categories = real_arr(scheme.get("eligibleCategories"))
    beneficiaries = real_arr(scheme.get("beneficiaryTypes"))
    income_groups = real_arr(scheme.get("incomeGroups"))
    docs = real_arr(scheme.get("requiredDocuments"))

    selected_state = profile.get("state") or ""
    selected_category = profile.get("category") or ""
    intent = real_intent(query) or profile.get("beneficiaryType") or profile.get("occupation") or ""

    user_docs = real_user_docs(profile)

    if selected_state:
        if "All India" in states or any(real_clean(s) == real_clean(selected_state) for s in states):
            score += 25
            reasons.append(f"State matched: {selected_state}")
        else:
            score -= 40
            warnings.append(f"State mismatch. Scheme is for {', '.join(states)}.")
    else:
        warnings.append("State not selected.")

    if selected_category:
        if any(real_clean(c) == real_clean(selected_category) for c in categories):
            score += 20
            reasons.append(f"Category/caste matched: {selected_category}")
        else:
            score -= 25
            warnings.append(f"Category/caste mismatch. Eligible: {', '.join(categories)}.")
    else:
        warnings.append("Category/caste not selected.")

    if intent:
        ok = any(
            real_clean(b) == real_clean(intent)
            or real_clean(intent) in real_clean(b)
            or real_clean(b) in real_clean(intent)
            for b in beneficiaries
        )

        if ok:
            score += 25
            reasons.append(f"Beneficiary matched: {intent}")
        else:
            score -= 25
            warnings.append(f"Beneficiary mismatch. Scheme is for {', '.join(beneficiaries)}.")

    if profile.get("incomeRange"):
        if not income_groups or any("low" in real_clean(profile.get("incomeRange")) and "low" in real_clean(g) for g in income_groups):
            score += 10
            reasons.append(f"Income considered: {profile.get('incomeRange')}")
        else:
            warnings.append(f"Income group may not match: {', '.join(income_groups)}.")

    for doc in docs:
        if any(real_clean(d) == real_clean(doc) for d in user_docs):
            available.append(doc)
        else:
            missing.append(doc)

    if docs:
        score += round((len(available) / len(docs)) * 20)

    if available:
        reasons.append("Available documents: " + ", ".join(available[:3]))
    if missing:
        warnings.append("Missing documents: " + ", ".join(missing[:3]))

    score = max(0, min(100, score))

    status = "Not Recommended"
    if score >= 80:
        status = "Strong Match"
    elif score >= 60:
        status = "Good Match"
    elif score >= 40:
        status = "Partial Match"

    return {
        "score": score,
        "status": status,
        "intent": intent,
        "reasons": reasons,
        "warnings": warnings,
        "availableDocuments": available,
        "missingDocuments": missing,
    }


def real_voice_reply(language, best):
    language = real_clean(language)
    title = best.get("title")
    category = best.get("category")
    score = best.get("score", 0)
    missing = best.get("missingDocuments", [])

    if language == "hindi":
        text = f"आपकी profile और query के अनुसार {title} सबसे बेहतर {category} scheme है। Match score {score} percent है। "
        if missing:
            text += "Missing documents हैं: " + ", ".join(missing[:3]) + ". "
        text += "Final eligibility official portal पर verify करें।"
        return text

    text = f"Based on your profile and query, {title} is the best matching {category} scheme. The match score is {score} percent. "
    if missing:
        text += "Missing documents are: " + ", ".join(missing[:3]) + ". "
    text += "Please verify final eligibility on the official portal."
    return text



# ===== SEVASETU REAL DATASET VOICE MATCHER - STRICT FINAL =====

def ss_real_clean(value):
    return str(value or "").strip().lower()


def ss_real_arr(value):
    if not value:
        return []
    if isinstance(value, list):
        return value
    return [value]


def ss_query_need(query):
    q = ss_real_clean(query)

    if any(w in q for w in ["scholarship", "pre matric", "pre-matric", "post matric", "post-matric", "fees", "tuition", "student aid"]):
        return "scholarship"

    if any(w in q for w in ["student", "education", "school", "college", "hostel", "career guidance", "laptop"]):
        return "student_education"

    if any(w in q for w in ["farmer", "kisan", "agriculture", "crop", "irrigation", "soil", "fisherman", "fishermen", "fishing"]):
        return "farmer"

    if any(w in q for w in ["women", "woman", "mahila", "girl", "widow", "maternity", "mother", "kanya"]):
        return "women"

    if any(w in q for w in ["business", "startup", "msme", "loan", "credit", "vendor", "industry"]):
        return "business"

    if any(w in q for w in ["health", "medical", "insurance", "hospital", "treatment", "ayushman"]):
        return "health"

    if any(w in q for w in ["job", "skill", "employment", "apprenticeship", "training", "worker", "labour"]):
        return "employment"

    if any(w in q for w in ["pension", "senior", "old age", "elderly"]):
        return "pension"

    return "general"


def ss_scheme_text(scheme):
    return ss_real_clean(" ".join([
        str(scheme.get("title", "")),
        str(scheme.get("category", "")),
        str(scheme.get("benefits", "")),
        str(scheme.get("eligibility", "")),
        str(scheme.get("applicationProcess", "")),
    ]))


def ss_scheme_purpose_ok(scheme, query):
    need = ss_query_need(query)
    text = ss_scheme_text(scheme)
    flags = [ss_real_clean(x) for x in scheme.get("qualityFlags", [])]
    q = ss_real_clean(query)

    if need == "scholarship":
        bad_words = [
            "award",
            "research award",
            "scientist award",
            "nutrition",
            "poshan",
            "meal",
            "food grain",
            "prize",
            "medal",
            "teacher training",
            "internship",
            "institution of eminence",
            "institutions of eminence",
            "covid-19 bal seva",
            "bal seva",
            "house rent",
            "aaws bhatta",
            "awas bhatta",
            "chhatrawas",
            "hostel",
            "residential hostel"
        ]

        if "fisherman" in text or "fishermen" in text or "fisherwomen" in text or "fishing" in text:
            if not any(w in q for w in ["fisherman", "fishermen", "fisherwomen", "fishing", "machhua", "machhuaara"]):
                return False

        good_words = [
            "scholarship",
            "chatravriti",
            "chhaatravrtti",
            "shishyavritti",
            "pre matric",
            "pre-matric",
            "post matric",
            "post-matric",
            "fee reimbursement",
            "tuition fee",
            "education loan",
            "free coaching",
            "state government sc scholarship",
            "scheduled caste scholarship",
            "top class education"
        ]

        if any(flag in ["award scheme", "nutrition/meal scheme", "not scholarship recommendation safe"] for flag in flags):
            return False

        return any(w in text for w in good_words) and not any(w in text for w in bad_words)

    if need == "student_education":
        bad_words = ["research award", "scientist award", "nutrition", "poshan", "meal", "food grain"]

        if any(word in q for word in ["hostel", "rent", "accommodation", "bhatta"]):
            return any(w in text for w in ["hostel", "house rent", "aaws bhatta", "awas bhatta", "chhatrawas"])

        good_words = [
            "student",
            "education",
            "school",
            "college",
            "career guidance",
            "laptop",
            "free admission",
            "scholarship",
            "chatravriti",
            "shishyavritti",
            "free coaching",
            "fee reimbursement"
        ]

        return any(w in text for w in good_words) and not any(w in text for w in bad_words)

    if need == "farmer":
        return any(w in text for w in ["farmer", "kisan", "agriculture", "crop", "irrigation", "soil", "fisherman", "fishermen", "fishing"])

    if need == "women":
        return any(w in text for w in ["women", "woman", "mahila", "girl", "widow", "maternity", "mother", "kanya", "ladli", "janani"])

    if need == "business":
        return any(w in text for w in ["business", "startup", "msme", "loan", "credit", "vendor", "entrepreneur", "industry"])

    if need == "health":
        return any(w in text for w in ["health", "medical", "insurance", "hospital", "treatment", "ayushman", "jan arogya"])

    if need == "employment":
        return any(w in text for w in ["skill", "job", "employment", "apprenticeship", "worker", "training", "unemployment", "labour"])

    if need == "pension":
        return any(w in text for w in ["pension", "senior", "old age", "elderly"])

    return True


def ss_user_docs(profile):
    docs = set(profile.get("documents") or [])

    for item in profile.get("uploadedDocuments") or []:
        if isinstance(item, dict):
            if item.get("documentName"):
                docs.add(item.get("documentName"))
            if item.get("guessedType"):
                docs.add(item.get("guessedType"))

    return list(docs)


def ss_real_score(scheme, profile, query):
    if not ss_scheme_purpose_ok(scheme, query):
        return None

    score = 0
    reasons = []
    warnings = []
    available = []
    missing = []

    states = ss_real_arr(scheme.get("state"))
    eligible_categories = ss_real_arr(scheme.get("eligibleCategories"))
    beneficiaries = ss_real_arr(scheme.get("beneficiaryTypes"))
    income_groups = ss_real_arr(scheme.get("incomeGroups"))
    required_docs = ss_real_arr(scheme.get("requiredDocuments"))

    selected_state = str(profile.get("state") or "").strip()
    selected_category = str(profile.get("category") or "").strip()
    query_need = ss_query_need(query)
    title_text = ss_scheme_text(scheme)

    if selected_state:
        if any(ss_real_clean(s) == ss_real_clean(selected_state) for s in states):
            score += 28
            reasons.append(f"State matched: {selected_state}")
        elif "All India" in states:
            score += 14
            reasons.append("State matched: All India / Central scheme")
        else:
            return None
    else:
        return None

    exact_category = False
    broad_category = False

    if selected_category:
        selected_cat_clean = ss_real_clean(selected_category)
        category_set = set([ss_real_clean(c) for c in eligible_categories])
        exact_category = selected_cat_clean in category_set
        broad_category = {"general", "obc", "sc", "st", "ews"}.issubset(category_set) or len(category_set) >= 4

        sc_specific_text = any(w in title_text for w in ["scheduled caste", "sc scholarship", " sc ", "state government sc scholarship"])
        st_specific_text = any(w in title_text for w in ["scheduled tribe", "st scholarship", "tribal", "adivasi"])
        obc_specific_text = any(w in title_text for w in ["obc scholarship", "other backward", "backward class"])
        ews_specific_text = any(w in title_text for w in ["ews", "economically weaker", "sudama"])

        if selected_cat_clean != "sc" and sc_specific_text:
            return None
        if selected_cat_clean != "st" and st_specific_text:
            return None
        if selected_cat_clean != "obc" and obc_specific_text:
            return None
        if selected_cat_clean != "ews" and ews_specific_text:
            return None

        if exact_category and not broad_category:
            score += 30
            reasons.append(f"Category/caste exactly matched: {selected_category}")
        elif exact_category and broad_category:
            score += 8
            reasons.append(f"Category/caste broadly eligible: {selected_category}")
        else:
            return None
    else:
        return None

    if selected_category and ss_real_clean(selected_category) in ["sc", "st", "obc", "ews", "minority"]:
        cat = ss_real_clean(selected_category)

        strong_terms = {
            "sc": ["scheduled caste", " sc scholarship", "sc scholarship", "scheduled caste scholarship"],
            "st": ["scheduled tribe", " st scholarship", "st scholarship", "tribal", "adivasi"],
            "obc": ["obc scholarship", "other backward"],
            "ews": ["ews", "economically weaker", "sudama"],
            "minority": ["minority", "minorities"]
        }

        if any(term in title_text for term in strong_terms.get(cat, [])):
            score += 18
            reasons.append(f"{selected_category}-specific scheme detected")
        elif broad_category:
            score -= 14
            warnings.append("Scheme is broad, not specifically for selected caste/category")

    if query_need in ["scholarship", "student_education"]:
        if any(ss_real_clean(b) == "student" for b in beneficiaries):
            score += 22
            reasons.append("Beneficiary matched: Student")
        else:
            return None

    if query_need == "scholarship":
        score += 12
        reasons.append("Scholarship-specific query matched")

        if any(w in title_text for w in ["sc scholarship", "scheduled caste", "state scholarship", "chatravriti", "chhaatravrtti", "shishyavritti", "top class education"]):
            score += 10
            reasons.append("Scholarship title strongly matched")

    elif query_need == "farmer":
        if any(ss_real_clean(b) in ["farmer", "fisherman"] for b in beneficiaries):
            score += 22
            reasons.append("Beneficiary matched: Farmer/Fisherman")
        else:
            return None

    elif query_need == "women":
        if any(ss_real_clean(b) in ["women", "girl child"] for b in beneficiaries):
            score += 22
            reasons.append("Beneficiary matched: Women")
        else:
            return None

    elif query_need == "business":
        if any(ss_real_clean(b) in ["business owner", "street vendor"] for b in beneficiaries):
            score += 22
            reasons.append("Beneficiary matched: Business/Vendor")
        else:
            return None

    elif query_need in ["health", "employment", "pension"]:
        score += 18
        reasons.append(f"{query_need.replace('_', ' ').title()} need matched")

    if profile.get("incomeRange"):
        if not income_groups or any("low" in ss_real_clean(profile.get("incomeRange")) and "low" in ss_real_clean(g) for g in income_groups):
            score += 8
            reasons.append(f"Income considered: {profile.get('incomeRange')}")
        else:
            score += 2
            warnings.append("Income group may need official verification")

    user_docs = ss_user_docs(profile)

    for doc in required_docs:
        if any(ss_real_clean(d) == ss_real_clean(doc) for d in user_docs):
            available.append(doc)
        else:
            missing.append(doc)

    if required_docs:
        doc_ratio = len(available) / len(required_docs)
        score += round(doc_ratio * 8)

        if len(missing) >= 3:
            score -= 10
        elif len(missing) >= 1:
            score -= 5

    if available:
        reasons.append("Available documents: " + ", ".join(available[:3]))

    if missing:
        warnings.append("Missing documents: " + ", ".join(missing[:3]))

    score = max(0, min(96, score))

    if score < 58:
        return None

    status = "Strong Match" if score >= 80 else "Good Match" if score >= 65 else "Partial Match"

    return {
        "score": score,
        "status": status,
        "reasons": reasons[:6],
        "warnings": warnings[:5],
        "availableDocuments": available,
        "missingDocuments": missing,
    }


def ss_real_reply(language, best):
    language = ss_real_clean(language)
    title = best.get("title", "matching scheme")
    category = best.get("category", "scheme")
    score = best.get("score", 0)
    missing = best.get("missingDocuments", [])

    if language == "hindi":
        reply = f"आपकी profile और query के अनुसार {title} सबसे बेहतर {category} scheme है। Match score {score} percent है। "
        if missing:
            reply += "Missing documents हैं: " + ", ".join(missing[:3]) + ". "
        reply += "Final eligibility official portal पर verify करें।"
        return reply

    reply = f"Based on your profile and query, {title} is the best matching {category} scheme. The match score is {score} percent. "
    if missing:
        reply += "Missing documents are: " + ", ".join(missing[:3]) + ". "
    reply += "Please verify final eligibility on the official portal."
    return reply


@app.post("/api/ai/voice-query")
async def voice_scheme_query(data: VoiceQueryRequest, authorization: Optional[str] = Header(default=None)):
    query = data.query.strip()

    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    language = ss_real_clean(data.language or "english")
    language = "hindi" if language == "hindi" else "english"

    profile = data.profile or {}

    try:
        if authorization:
            user = await get_user_from_token(authorization)
            db_profile = {}
            try:
                db_profile_doc = await profiles.find_one({"email": user["email"]})
                if db_profile_doc:
                    db_profile_doc.pop("_id", None)
                    db_profile = db_profile_doc
            except Exception:
                db_profile = {}

            profile = {**db_profile, **profile}
    except Exception:
        pass

    extracted = parse_voice_query(query)

    # Dropdown selected state is final. Voice-extracted state is used only if dropdown/profile state is empty.
    if profile.get("selectedState"):
        profile["state"] = profile.get("selectedState")
    elif extracted.get("state") and not profile.get("state"):
        profile["state"] = extracted["state"]

    # Dropdown selected category is final. Voice-extracted category is used only if dropdown/profile category is empty.
    if profile.get("selectedCategory"):
        profile["category"] = profile.get("selectedCategory")
    elif extracted.get("category") and not profile.get("category"):
        profile["category"] = extracted["category"]

    if not profile.get("state"):
        return {
            "reply": "Please select your state first for accurate scheme matching." if language == "english" else "कृपया accurate matching के लिए state select करें।",
            "needsClarification": True,
            "clarificationField": "state",
            "matchedSchemes": [],
            "extractedProfile": extracted,
            "usedProfile": profile,
        }

    if not profile.get("category"):
        return {
            "reply": "Please select your category or caste first for accurate scheme matching." if language == "english" else "कृपया accurate matching के लिए category या caste select करें।",
            "needsClarification": True,
            "clarificationField": "category",
            "matchedSchemes": [],
            "extractedProfile": extracted,
            "usedProfile": profile,
        }

    schemes = load_voice_scheme_data()
    ranked = []

    for scheme in schemes:
        result = ss_real_score(scheme, profile, query)

        if result:
            ranked.append({
                **scheme,
                **result,
            })

    ranked.sort(key=lambda item: item["score"], reverse=True)
    top = ranked[:5]

    if top:
        reply = ss_real_reply(language, top[0])
    else:
        reply = (
            "No accurate matching scheme was found. Try a clearer query such as scholarship, farmer support, women support, health support, business loan, or employment skill scheme."
            if language == "english"
            else "Accurate matching scheme नहीं मिली। Query clearly लिखें जैसे scholarship, farmer support, women support, health support, business loan या employment skill scheme."
        )

    matched = []
    for item in top:
        matched.append({
            "id": item.get("id"),
            "title": item.get("title"),
            "category": item.get("category"),
            "state": item.get("state"),
            "benefits": item.get("benefits"),
            "requiredDocuments": item.get("requiredDocuments", []),
            "score": item.get("score", 0),
            "status": item.get("status"),
            "reasons": item.get("reasons", []),
            "warnings": item.get("warnings", []),
            "missingDocuments": item.get("missingDocuments", []),
            "availableDocuments": item.get("availableDocuments", []),
            "officialLink": item.get("officialLink"),
        })

    return {
        "reply": reply,
        "needsClarification": False,
        "intent": ss_query_need(query),
        "extractedProfile": extracted,
        "usedProfile": profile,
        "matchedSchemes": matched,
    }

# ===== SEVASETU VOICE BOT V3 - FINAL DROPDOWN STRICT MATCHER =====

def v3_clean(x):
    return str(x or "").strip().lower()

def v3_arr(x):
    if not x:
        return []
    if isinstance(x, list):
        return x
    return [x]

def v3_text(s):
    return v3_clean(" ".join([
        str(s.get("title", "")),
        str(s.get("category", "")),
        str(s.get("benefits", "")),
        str(s.get("eligibility", "")),
        str(s.get("applicationProcess", "")),
    ]))

def v3_need(query):
    q = v3_clean(query)

    if any(w in q for w in ["scholarship", "chatravriti", "छात्रवृत्ति", "pre matric", "post matric", "fee", "tuition"]):
        return "scholarship"
    if any(w in q for w in ["student", "education", "school", "college"]):
        return "student"
    if any(w in q for w in ["farmer", "kisan", "agriculture", "crop", "fisherman", "fishing"]):
        return "farmer"
    if any(w in q for w in ["women", "woman", "mahila", "girl", "widow", "maternity"]):
        return "women"
    if any(w in q for w in ["business", "startup", "msme", "loan", "vendor"]):
        return "business"
    if any(w in q for w in ["health", "medical", "insurance", "hospital"]):
        return "health"
    if any(w in q for w in ["job", "skill", "employment", "training", "worker"]):
        return "employment"
    if any(w in q for w in ["pension", "senior", "old age"]):
        return "pension"

    return "general"

def v3_selected_category_terms(category):
    c = v3_clean(category)

    if c == "sc":
        return ["scheduled caste", "sc scholarship", "scheduled caste scholarship", "state government sc scholarship", "scheduled caste students", "(scheduled caste)"]
    if c == "st":
        return ["scheduled tribe", "st scholarship", "tribal", "adivasi", "study abroad scholarships (scheduled tribe)", "(scheduled tribes)", "(scheduled tribe)"]
    if c == "obc":
        return ["obc", "other backward", "backward class", "backward classes"]
    if c == "ews":
        return ["ews", "economically weaker", "sudama", "below poverty", "bpl"]
    if c == "minority":
        return ["minority", "minorities"]

    return []

def v3_other_category_terms(category):
    all_terms = {
        "sc": ["scheduled caste", "sc scholarship", "scheduled caste scholarship", "scheduled caste students", "(scheduled caste)"],
        "st": ["scheduled tribe", "st scholarship", "tribal", "adivasi", "(scheduled tribe)", "(scheduled tribes)"],
        "obc": ["obc", "other backward", "backward class", "backward classes"],
        "ews": ["ews", "economically weaker", "sudama", "below poverty", "bpl"],
        "minority": ["minority", "minorities"],
    }

    current = v3_clean(category)
    out = []

    for key, terms in all_terms.items():
        if key != current:
            out.extend(terms)

    return out

def v3_is_bad_for_scholarship(text, query):
    q = v3_clean(query)

    bad = [
        "award",
        "research award",
        "scientist award",
        "nutrition",
        "poshan",
        "meal",
        "food grain",
        "internship",
        "institution of eminence",
        "institutions of eminence",
        "covid-19 bal seva",
        "house rent",
        "aaws bhatta",
        "awas bhatta",
        "chhatrawas",
        "hostel",
        "fisherman",
        "fishermen",
        "fisherwomen",
        "fishing",
        "employment oriented training",
        "training to educated unemployed"
    ]

    if any(w in text for w in ["fisherman", "fishermen", "fishing"]):
        return not any(w in q for w in ["fisherman", "fishermen", "fishing", "machhua"])

    return any(w in text for w in bad)

def v3_purpose_ok(scheme, query):
    need = v3_need(query)
    text = v3_text(scheme)

    if need == "scholarship":
        if v3_is_bad_for_scholarship(text, query):
            return False

        good = [
            "scholarship",
            "chatravriti",
            "chhaatravrtti",
            "shishyavritti",
            "छात्रवृत्ति",
            "pre matric",
            "post matric",
            "pre-matric",
            "post-matric",
            "fee reimbursement",
            "tuition fee",
            "top class education",
            "free coaching",
            "state scholarship"
        ]

        return any(w in text for w in good)

    if need == "student":
        return any(w in text for w in ["student", "education", "school", "college", "scholarship", "free coaching", "laptop"])

    if need == "farmer":
        return any(w in text for w in ["farmer", "kisan", "agriculture", "crop", "fisherman", "fishing"])

    if need == "women":
        return any(w in text for w in ["women", "woman", "mahila", "girl", "widow", "maternity", "kanya", "ladli"])

    if need == "business":
        return any(w in text for w in ["business", "startup", "msme", "loan", "vendor", "credit", "industry"])

    if need == "health":
        return any(w in text for w in ["health", "medical", "insurance", "hospital", "ayushman", "jan arogya"])

    if need == "employment":
        return any(w in text for w in ["skill", "job", "employment", "apprenticeship", "training", "worker", "labour"])

    if need == "pension":
        return any(w in text for w in ["pension", "senior", "old age", "elderly"])

    return True

def v3_safe_title(title):
    title = str(title or "").strip()
    if len(title) <= 90:
        return title

    first = title.split(".")[0].strip()
    if 10 <= len(first) <= 100:
        return first

    return title[:90].strip() + "..."

def v3_user_docs(profile):
    docs = set(profile.get("documents") or [])

    for item in profile.get("uploadedDocuments") or []:
        if isinstance(item, dict):
            if item.get("documentName"):
                docs.add(item["documentName"])
            if item.get("guessedType"):
                docs.add(item["guessedType"])

    return list(docs)

def v3_score_scheme(scheme, profile, query):
    selected_state = str(profile.get("state") or profile.get("selectedState") or "").strip()
    selected_category = str(profile.get("category") or profile.get("selectedCategory") or "").strip()

    if not selected_state or not selected_category:
        return None

    if not v3_purpose_ok(scheme, query):
        return None

    text = v3_text(scheme)
    states = v3_arr(scheme.get("state"))
    cats = v3_arr(scheme.get("eligibleCategories"))
    bens = v3_arr(scheme.get("beneficiaryTypes"))
    docs = v3_arr(scheme.get("requiredDocuments"))
    incomes = v3_arr(scheme.get("incomeGroups"))

    score = 0
    reasons = []
    warnings = []

    if any(v3_clean(s) == v3_clean(selected_state) for s in states):
        score += 28
        reasons.append(f"State matched: {selected_state}")
    elif "All India" in states:
        score += 14
        reasons.append("State matched: All India / Central scheme")
    else:
        return None

    cat_clean = v3_clean(selected_category)
    cat_set = set(v3_clean(c) for c in cats)

    selected_terms = v3_selected_category_terms(selected_category)
    other_terms = v3_other_category_terms(selected_category)

    has_selected_specific_text = any(t in text for t in selected_terms)
    has_other_specific_text = any(t in text for t in other_terms)

    if cat_clean not in cat_set:
        return None

    if has_other_specific_text and not has_selected_specific_text:
        return None

    if cat_clean in ["sc", "st", "obc", "ews", "minority"]:
        if has_selected_specific_text:
            score += 34
            reasons.append(f"Category exactly matched: {selected_category}")
        else:
            broad_set = {"general", "obc", "sc", "st", "ews"}
            if broad_set.issubset(cat_set) or len(cat_set) >= 4:
                score -= 5
                warnings.append(f"Broad scheme, not specifically for {selected_category}")
            else:
                score += 18
                reasons.append(f"Category matched: {selected_category}")
    else:
        score += 14
        reasons.append(f"Category matched: {selected_category}")

    need = v3_need(query)

    if need in ["scholarship", "student"]:
        if any(v3_clean(b) == "student" for b in bens):
            score += 22
            reasons.append("Beneficiary matched: Student")
        else:
            return None

        if need == "scholarship":
            score += 12
            reasons.append("Scholarship-specific query matched")

    elif need == "farmer":
        if any(v3_clean(b) in ["farmer", "fisherman"] for b in bens):
            score += 22
            reasons.append("Beneficiary matched: Farmer/Fisherman")
        else:
            return None

    elif need == "women":
        if any(v3_clean(b) in ["women", "girl child"] for b in bens):
            score += 22
            reasons.append("Beneficiary matched: Women")
        else:
            return None

    else:
        score += 12
        reasons.append("Need matched")

    if profile.get("incomeRange"):
        if not incomes or any("low" in v3_clean(profile.get("incomeRange")) and "low" in v3_clean(i) for i in incomes):
            score += 8
            reasons.append(f"Income considered: {profile.get('incomeRange')}")

    user_docs = v3_user_docs(profile)
    available = []
    missing = []

    for d in docs:
        if any(v3_clean(x) == v3_clean(d) for x in user_docs):
            available.append(d)
        else:
            missing.append(d)

    if docs:
        score += round((len(available) / len(docs)) * 8)

    if len(missing) >= 3:
        score -= 10
    elif len(missing) > 0:
        score -= 5

    if available:
        reasons.append("Available documents: " + ", ".join(available[:3]))

    if missing:
        warnings.append("Missing documents: " + ", ".join(missing[:3]))

    score = max(0, min(96, score))

    if score < 55:
        return None

    return {
        "score": score,
        "status": "Strong Match" if score >= 80 else "Good Match" if score >= 65 else "Partial Match",
        "reasons": reasons[:6],
        "warnings": warnings[:5],
        "availableDocuments": available,
        "missingDocuments": missing
    }

@app.post("/api/ai/voice-query-v3")
async def voice_scheme_query_v3(data: VoiceQueryRequest, authorization: Optional[str] = Header(default=None)):
    query = data.query.strip()
    language = v3_clean(data.language or "english")
    language = "hindi" if language == "hindi" else "english"

    incoming_profile = data.profile or {}

    selected_state = incoming_profile.get("selectedState") or incoming_profile.get("state") or ""
    selected_category = incoming_profile.get("selectedCategory") or incoming_profile.get("category") or ""

    profile = dict(incoming_profile)
    profile["state"] = selected_state
    profile["category"] = selected_category

    extracted = parse_voice_query(query)

    if not profile.get("state"):
        return {
            "reply": "Please select your state first." if language == "english" else "कृपया पहले state select करें।",
            "needsClarification": True,
            "matchedSchemes": [],
            "extractedProfile": extracted,
            "usedProfile": profile
        }

    if not profile.get("category"):
        return {
            "reply": "Please select your category or caste first." if language == "english" else "कृपया पहले category या caste select करें।",
            "needsClarification": True,
            "matchedSchemes": [],
            "extractedProfile": extracted,
            "usedProfile": profile
        }

    schemes = load_voice_scheme_data()
    ranked = []

    for scheme in schemes:
        result = v3_score_scheme(scheme, profile, query)
        if result:
            ranked.append({**scheme, **result})

    ranked.sort(key=lambda x: x.get("score", 0), reverse=True)
    top = ranked[:5]

    if top:
        best = top[0]
        title = v3_safe_title(best.get("title"))
        reply = f"Based on your selected {profile.get('category')} category and {profile.get('state')} state, {title} is the best matching scheme. Match score is {best.get('score')} percent."
        if best.get("missingDocuments"):
            reply += " Missing documents are: " + ", ".join(best.get("missingDocuments")[:3]) + "."
        reply += " Please verify final eligibility on the official portal."
    else:
        reply = f"No accurate scheme found for selected category {profile.get('category')} and state {profile.get('state')}."

    matched = []

    for item in top:
        matched.append({
            "id": item.get("id"),
            "title": v3_safe_title(item.get("title")),
            "category": item.get("category"),
            "state": item.get("state"),
            "benefits": item.get("benefits"),
            "requiredDocuments": item.get("requiredDocuments", []),
            "score": item.get("score", 0),
            "status": item.get("status"),
            "reasons": item.get("reasons", []),
            "warnings": item.get("warnings", []),
            "missingDocuments": item.get("missingDocuments", []),
            "availableDocuments": item.get("availableDocuments", []),
            "officialLink": item.get("officialLink"),
        })

    return {
        "reply": reply,
        "needsClarification": False,
        "intent": v3_need(query),
        "extractedProfile": profile,
        "usedProfile": profile,
        "matchedSchemes": matched
    }


# ===== SEVASETU VOICE BOT V4 - CLEAN FINAL OUTPUT =====

def v4_clean(x):
    return str(x or "").strip().lower()

def v4_arr(x):
    if not x:
        return []
    if isinstance(x, list):
        return x
    return [x]

def v4_text(s):
    return v4_clean(" ".join([
        str(s.get("title", "")),
        str(s.get("category", "")),
        str(s.get("benefits", "")),
        str(s.get("eligibility", "")),
        str(s.get("applicationProcess", "")),
    ]))

def v4_title(s):
    return str(s.get("title") or "").strip()

def v4_safe_title(title):
    title = str(title or "").strip()
    if len(title) <= 75:
        return title
    first = title.split(".")[0].strip()
    if 8 <= len(first) <= 75:
        return first
    return title[:75].strip() + "..."

def v4_safe_benefit(text):
    text = str(text or "").replace("(adsbygoogle=window.adsbygoogle||[]).push({});", " ")
    text = " ".join(text.split())
    if len(text) <= 260:
        return text
    return text[:260].strip() + "..."

def v4_need(query):
    q = v4_clean(query)
    if any(w in q for w in ["scholarship", "chatravriti", "छात्रवृत्ति", "pre matric", "post matric", "fee", "tuition"]):
        return "scholarship"
    if any(w in q for w in ["student", "education", "school", "college", "coaching"]):
        return "student"
    if any(w in q for w in ["farmer", "kisan", "agriculture", "crop", "fisherman", "fishing"]):
        return "farmer"
    if any(w in q for w in ["women", "woman", "mahila", "girl", "widow", "maternity"]):
        return "women"
    if any(w in q for w in ["business", "startup", "msme", "loan", "vendor"]):
        return "business"
    if any(w in q for w in ["health", "medical", "insurance", "hospital"]):
        return "health"
    if any(w in q for w in ["job", "skill", "employment", "training", "worker"]):
        return "employment"
    if any(w in q for w in ["pension", "senior", "old age"]):
        return "pension"
    return "general"

def v4_category_specific_terms(category):
    c = v4_clean(category)
    if c == "sc":
        return ["scheduled caste", "sc scholarship", "scheduled caste scholarship", "sc students", "(scheduled caste)"]
    if c == "st":
        return ["scheduled tribe", "st scholarship", "tribal", "adivasi", "(scheduled tribe)", "(scheduled tribes)"]
    if c == "obc":
        return ["obc", "other backward", "backward class", "backward classes"]
    if c == "ews":
        return ["ews", "economically weaker", "sudama", "below poverty", "bpl"]
    if c == "minority":
        return ["minority", "minorities"]
    return []

def v4_other_category_terms(category):
    all_terms = {
        "sc": ["scheduled caste", "sc scholarship", "scheduled caste scholarship", "sc students", "(scheduled caste)"],
        "st": ["scheduled tribe", "st scholarship", "tribal", "adivasi", "(scheduled tribe)", "(scheduled tribes)"],
        "obc": ["obc", "other backward", "backward class", "backward classes"],
        "ews": ["ews", "economically weaker", "sudama", "below poverty", "bpl"],
        "minority": ["minority", "minorities"],
    }
    c = v4_clean(category)
    out = []
    for key, terms in all_terms.items():
        if key != c:
            out.extend(terms)
    return out

def v4_scholarship_title_ok(scheme, query):
    title = v4_clean(scheme.get("title"))
    text = v4_text(scheme)
    q = v4_clean(query)

    hard_bad = [
        "doorstep delivery",
        "delhi govt",
        "public services",
        "women scientist",
        "scientist",
        "research",
        "ph.d",
        "phd",
        "m.sc",
        "msc",
        "fellowship",
        "internship",
        "award",
        "institution of eminence",
        "institutions of eminence",
        "nutrition",
        "poshan",
        "meal",
        "food grain",
        "house rent",
        "aaws bhatta",
        "awas bhatta",
        "chhatrawas",
        "hostel",
        "covid-19",
        "bal seva",
        "employment oriented training",
        "training to educated unemployed",
        "startup",
        "loan scheme",
        "skill loan",
        "vocational training"
    ]

    if any(w in title for w in hard_bad):
        return False

    if any(w in text for w in ["fisherman", "fishermen", "fisherwomen", "fishing"]):
        if not any(w in q for w in ["fisherman", "fishermen", "fishing", "machhua"]):
            return False

    good_title = [
        "scholarship",
        "chatravriti",
        "chhaatravrtti",
        "shishyavritti",
        "छात्रवृत्ति",
        "pre-matric",
        "pre matric",
        "post-matric",
        "post matric",
        "merit scholarship",
        "financial assistance for purchase of stationery",
        "free coaching scheme",
        "top class education",
        "fee reimbursement",
        "tuition fee"
    ]

    if any(w in title for w in good_title):
        return True

    return False

def v4_purpose_ok(scheme, query):
    need = v4_need(query)
    text = v4_text(scheme)

    if need == "scholarship":
        return v4_scholarship_title_ok(scheme, query)

    if need == "student":
        bad = ["doorstep delivery", "research award", "scientist", "nutrition", "poshan", "meal"]
        good = ["student", "education", "school", "college", "scholarship", "free coaching", "laptop", "fee reimbursement"]
        return any(w in text for w in good) and not any(w in text for w in bad)

    if need == "farmer":
        return any(w in text for w in ["farmer", "kisan", "agriculture", "crop", "fisherman", "fishing"])

    if need == "women":
        return any(w in text for w in ["women", "woman", "mahila", "girl", "widow", "maternity", "kanya", "ladli"])

    if need == "business":
        return any(w in text for w in ["business", "startup", "msme", "loan", "vendor", "credit"])

    if need == "health":
        return any(w in text for w in ["health", "medical", "insurance", "hospital", "ayushman", "jan arogya"])

    if need == "employment":
        return any(w in text for w in ["skill", "job", "employment", "apprenticeship", "training", "worker"])

    if need == "pension":
        return any(w in text for w in ["pension", "senior", "old age", "elderly"])

    return True

def v4_user_docs(profile):
    docs = set(profile.get("documents") or [])
    for item in profile.get("uploadedDocuments") or []:
        if isinstance(item, dict):
            if item.get("documentName"):
                docs.add(item["documentName"])
            if item.get("guessedType"):
                docs.add(item["guessedType"])
    return list(docs)

def v4_score_scheme(scheme, profile, query):
    selected_state = str(profile.get("selectedState") or profile.get("state") or "").strip()
    selected_category = str(profile.get("selectedCategory") or profile.get("category") or "").strip()

    if not selected_state or not selected_category:
        return None

    if not v4_purpose_ok(scheme, query):
        return None

    text = v4_text(scheme)
    states = v4_arr(scheme.get("state"))
    cats = v4_arr(scheme.get("eligibleCategories"))
    bens = v4_arr(scheme.get("beneficiaryTypes"))
    docs = v4_arr(scheme.get("requiredDocuments"))
    incomes = v4_arr(scheme.get("incomeGroups"))

    score = 0
    reasons = []
    warnings = []

    if any(v4_clean(s) == v4_clean(selected_state) for s in states):
        score += 30
        reasons.append(f"State matched: {selected_state}")
    elif "All India" in states:
        score += 14
        reasons.append("State matched: All India / Central scheme")
    else:
        return None

    cat_clean = v4_clean(selected_category)
    cat_set = set(v4_clean(c) for c in cats)

    if cat_clean not in cat_set:
        return None

    selected_terms = v4_category_specific_terms(selected_category)
    other_terms = v4_other_category_terms(selected_category)

    has_selected_specific = any(t in text for t in selected_terms)
    has_other_specific = any(t in text for t in other_terms)

    if has_other_specific and not has_selected_specific:
        return None

    broad_set = {"general", "obc", "sc", "st", "ews"}
    is_broad = broad_set.issubset(cat_set) or len(cat_set) >= 4

    if cat_clean in ["sc", "st", "obc", "ews", "minority"]:
        if has_selected_specific:
            score += 35
            reasons.append(f"Category exactly matched: {selected_category}")
        elif is_broad:
            score += 6
            warnings.append(f"Broad category scheme, not specifically for {selected_category}")
        else:
            score += 18
            reasons.append(f"Category matched: {selected_category}")
    else:
        score += 15
        reasons.append(f"Category matched: {selected_category}")

    need = v4_need(query)

    if need in ["scholarship", "student"]:
        if any(v4_clean(b) == "student" for b in bens):
            score += 22
            reasons.append("Beneficiary matched: Student")
        else:
            return None
        if need == "scholarship":
            score += 12
            reasons.append("Scholarship-specific query matched")
    else:
        score += 12
        reasons.append("Need matched")

    if profile.get("incomeRange"):
        if not incomes or any("low" in v4_clean(profile.get("incomeRange")) and "low" in v4_clean(i) for i in incomes):
            score += 8
            reasons.append(f"Income considered: {profile.get('incomeRange')}")

    user_docs = v4_user_docs(profile)
    available = []
    missing = []

    for d in docs:
        if any(v4_clean(x) == v4_clean(d) for x in user_docs):
            available.append(d)
        else:
            missing.append(d)

    if docs:
        score += round((len(available) / len(docs)) * 6)

    if len(missing) >= 3:
        score -= 8
    elif len(missing) > 0:
        score -= 4

    if available:
        reasons.append("Available documents: " + ", ".join(available[:3]))
    if missing:
        warnings.append("Missing documents: " + ", ".join(missing[:3]))

    score = max(0, min(96, score))

    if score < 55:
        return None

    return {
        "score": score,
        "status": "Strong Match" if score >= 80 else "Good Match" if score >= 65 else "Partial Match",
        "reasons": reasons[:6],
        "warnings": warnings[:5],
        "availableDocuments": available,
        "missingDocuments": missing
    }

@app.post("/api/ai/voice-query-v4")
async def voice_scheme_query_v4(data: VoiceQueryRequest, authorization: Optional[str] = Header(default=None)):
    query = data.query.strip()
    language = v4_clean(data.language or "english")

    incoming = data.profile or {}

    selected_state = incoming.get("selectedState") or incoming.get("state") or ""
    selected_category = incoming.get("selectedCategory") or incoming.get("category") or ""

    profile = dict(incoming)
    profile["state"] = selected_state
    profile["category"] = selected_category

    extracted = parse_voice_query(query)

    clean_detected = {
        "state": selected_state,
        "category": selected_category,
        "occupation": incoming.get("occupation") or extracted.get("occupation") or "",
        "beneficiaryType": "Student" if v4_need(query) in ["scholarship", "student"] else incoming.get("beneficiaryType", ""),
        "incomeRange": incoming.get("incomeRange") or extracted.get("incomeRange") or "",
        "documents": incoming.get("documents") or extracted.get("documents") or [],
        "need": v4_need(query)
    }

    if not selected_state:
        return {
            "reply": "Please select your state first.",
            "needsClarification": True,
            "matchedSchemes": [],
            "extractedProfile": clean_detected,
            "usedProfile": profile
        }

    if not selected_category:
        return {
            "reply": "Please select your category or caste first.",
            "needsClarification": True,
            "matchedSchemes": [],
            "extractedProfile": clean_detected,
            "usedProfile": profile
        }

    ranked = []

    for scheme in load_voice_scheme_data():
        result = v4_score_scheme(scheme, profile, query)
        if result:
            ranked.append({**scheme, **result})

    ranked.sort(key=lambda x: x.get("score", 0), reverse=True)
    top = ranked[:5]

    if top:
        best = top[0]
        reply = f"Based on your selected {selected_category} category and {selected_state} state, {v4_safe_title(best.get('title'))} is the best matching scheme. Match score is {best.get('score')} percent."
        if best.get("missingDocuments"):
            reply += " Missing documents are: " + ", ".join(best.get("missingDocuments")[:3]) + "."
        reply += " Please verify final eligibility on the official portal."
    else:
        reply = f"No accurate scheme found for selected {selected_category} category and {selected_state} state."

    matched = []
    for item in top:
        matched.append({
            "id": item.get("id"),
            "title": v4_safe_title(item.get("title")),
            "category": item.get("category"),
            "state": item.get("state"),
            "benefits": v4_safe_benefit(item.get("benefits")),
            "requiredDocuments": item.get("requiredDocuments", []),
            "score": item.get("score", 0),
            "status": item.get("status"),
            "reasons": item.get("reasons", []),
            "warnings": item.get("warnings", []),
            "missingDocuments": item.get("missingDocuments", []),
            "availableDocuments": item.get("availableDocuments", []),
            "officialLink": item.get("officialLink"),
        })

    return {
        "reply": reply,
        "needsClarification": False,
        "intent": v4_need(query),
        "extractedProfile": clean_detected,
        "usedProfile": profile,
        "matchedSchemes": matched
    }


# ===== SEVASETU VOICE BOT V5 - PURE HINDI / PURE ENGLISH REPLY =====

def v5_hindi_category(cat):
    c = v4_clean(cat)
    if c == "obc":
        return "ओबीसी"
    if c == "sc":
        return "अनुसूचित जाति"
    if c == "st":
        return "अनुसूचित जनजाति"
    if c == "ews":
        return "ईडब्ल्यूएस"
    if c == "general":
        return "सामान्य"
    if c == "minority":
        return "अल्पसंख्यक"
    return cat

def v5_hindi_need(need):
    n = v4_clean(need)
    if n == "scholarship":
        return "छात्रवृत्ति"
    if n == "student":
        return "शिक्षा"
    if n == "farmer":
        return "किसान सहायता"
    if n == "women":
        return "महिला सहायता"
    if n == "business":
        return "व्यवसाय सहायता"
    if n == "health":
        return "स्वास्थ्य सहायता"
    if n == "employment":
        return "रोजगार सहायता"
    if n == "pension":
        return "पेंशन"
    return "योजना"

def v5_hindi_docs(docs):
    m = {
        "Aadhaar Card": "आधार कार्ड",
        "Caste Certificate": "जाति प्रमाण पत्र",
        "Income Certificate": "आय प्रमाण पत्र",
        "Bank Passbook": "बैंक पासबुक",
        "Educational Certificate": "शैक्षणिक प्रमाण पत्र",
        "Domicile Certificate": "निवास प्रमाण पत्र",
        "Passport Size Photo": "पासपोर्ट साइज फोटो",
        "Mobile Number": "मोबाइल नंबर",
        "PAN Card": "पैन कार्ड",
        "Ration Card": "राशन कार्ड",
        "Birth Certificate": "जन्म प्रमाण पत्र"
    }
    return [m.get(d, d) for d in docs]

def v5_reply(language, profile, best):
    lang = v4_clean(language)
    title = v4_safe_title(best.get("title"))
    score = best.get("score", 0)
    missing = best.get("missingDocuments", [])
    state = profile.get("state", "")
    category = profile.get("category", "")

    if lang == "hindi":
        reply = f"आपकी चुनी हुई {v5_hindi_category(category)} श्रेणी और {state} राज्य के आधार पर {title} आपके लिए सबसे उपयुक्त योजना है। मिलान स्कोर {score} प्रतिशत है।"
        if missing:
            reply += " अभी ये दस्तावेज़ बाकी हैं: " + ", ".join(v5_hindi_docs(missing[:3])) + "।"
        reply += " अंतिम पात्रता आधिकारिक पोर्टल पर जरूर सत्यापित करें।"
        return reply

    reply = f"Based on your selected {category} category and {state} state, {title} is the best matching scheme. Match score is {score} percent."
    if missing:
        reply += " Missing documents are: " + ", ".join(missing[:3]) + "."
    reply += " Please verify final eligibility on the official portal."
    return reply

@app.post("/api/ai/voice-query-v5")
async def voice_scheme_query_v5(data: VoiceQueryRequest, authorization: Optional[str] = Header(default=None)):
    query = data.query.strip()
    language = v4_clean(data.language or "english")
    language = "hindi" if language == "hindi" else "english"

    incoming = data.profile or {}

    selected_state = incoming.get("selectedState") or incoming.get("state") or ""
    selected_category = incoming.get("selectedCategory") or incoming.get("category") or ""

    profile = dict(incoming)
    profile["state"] = selected_state
    profile["category"] = selected_category

    extracted = parse_voice_query(query)

    clean_detected = {
        "state": selected_state,
        "category": selected_category,
        "occupation": incoming.get("occupation") or extracted.get("occupation") or "",
        "beneficiaryType": "Student" if v4_need(query) in ["scholarship", "student"] else incoming.get("beneficiaryType", ""),
        "incomeRange": incoming.get("incomeRange") or extracted.get("incomeRange") or "",
        "documents": incoming.get("documents") or extracted.get("documents") or [],
        "need": v4_need(query)
    }

    if not selected_state:
        return {
            "reply": "कृपया पहले राज्य चुनें।" if language == "hindi" else "Please select your state first.",
            "needsClarification": True,
            "matchedSchemes": [],
            "extractedProfile": clean_detected,
            "usedProfile": profile
        }

    if not selected_category:
        return {
            "reply": "कृपया पहले श्रेणी या जाति चुनें।" if language == "hindi" else "Please select your category or caste first.",
            "needsClarification": True,
            "matchedSchemes": [],
            "extractedProfile": clean_detected,
            "usedProfile": profile
        }

    ranked = []

    for scheme in load_voice_scheme_data():
        result = v4_score_scheme(scheme, profile, query)
        if result:
            ranked.append({**scheme, **result})

    ranked.sort(key=lambda x: x.get("score", 0), reverse=True)
    top = ranked[:5]

    if top:
        reply = v5_reply(language, profile, top[0])
    else:
        if language == "hindi":
            reply = f"चुनी हुई {v5_hindi_category(selected_category)} श्रेणी और {selected_state} राज्य के लिए कोई सटीक योजना नहीं मिली।"
        else:
            reply = f"No accurate scheme found for selected {selected_category} category and {selected_state} state."

    matched = []
    for item in top:
        matched.append({
            "id": item.get("id"),
            "title": v4_safe_title(item.get("title")),
            "category": item.get("category"),
            "state": item.get("state"),
            "benefits": v4_safe_benefit(item.get("benefits")),
            "requiredDocuments": item.get("requiredDocuments", []),
            "score": item.get("score", 0),
            "status": item.get("status"),
            "reasons": item.get("reasons", []),
            "warnings": item.get("warnings", []),
            "missingDocuments": item.get("missingDocuments", []),
            "availableDocuments": item.get("availableDocuments", []),
            "officialLink": item.get("officialLink"),
        })

    return {
        "reply": reply,
        "needsClarification": False,
        "intent": v4_need(query),
        "extractedProfile": clean_detected,
        "usedProfile": profile,
        "matchedSchemes": matched
    }


# ===== SEVASETU VOICE BOT V6 - BETTER PURE HINDI WORDING =====

def v6_hindi_state(state):
    m = {
        "Madhya Pradesh": "मध्य प्रदेश",
        "Delhi": "दिल्ली",
        "Bihar": "बिहार",
        "Jharkhand": "झारखंड",
        "Uttar Pradesh": "उत्तर प्रदेश",
        "Rajasthan": "राजस्थान",
        "Maharashtra": "महाराष्ट्र",
        "Gujarat": "गुजरात",
        "Haryana": "हरियाणा",
        "Punjab": "पंजाब",
        "Uttarakhand": "उत्तराखंड",
        "Chhattisgarh": "छत्तीसगढ़",
        "Karnataka": "कर्नाटक",
        "Kerala": "केरल",
        "Tamil Nadu": "तमिलनाडु",
        "West Bengal": "पश्चिम बंगाल",
        "All India": "पूरे भारत"
    }
    return m.get(str(state).strip(), state)

def v6_hindi_scheme_title(title):
    t = str(title or "").strip()

    replacements = {
        "Pichda Varg Post Matric Chhatravritti": "पिछड़ा वर्ग पोस्ट मैट्रिक छात्रवृत्ति",
        "Post Metric Scholarship For OBC Students": "ओबीसी विद्यार्थियों के लिए पोस्ट मैट्रिक छात्रवृत्ति",
        "Post Matric Scholarship For OBC Students": "ओबीसी विद्यार्थियों के लिए पोस्ट मैट्रिक छात्रवृत्ति",
        "Pre-matric Scholarship": "प्री मैट्रिक छात्रवृत्ति",
        "Pre Matric Scholarship": "प्री मैट्रिक छात्रवृत्ति",
        "Post-Matric Scholarship": "पोस्ट मैट्रिक छात्रवृत्ति",
        "Post Matric Scholarship": "पोस्ट मैट्रिक छात्रवृत्ति",
        "Scholarship": "छात्रवृत्ति",
        "Merit Scholarship": "मेधावी छात्रवृत्ति",
        "Free Coaching Scheme": "निःशुल्क कोचिंग योजना",
        "Financial Assistance": "वित्तीय सहायता",
        "Purchase Of Stationery": "स्टेशनरी खरीदने के लिए सहायता",
        "Other Backward Classes": "अन्य पिछड़ा वर्ग",
        "OBC Students": "ओबीसी विद्यार्थी",
        "SC Students": "अनुसूचित जाति विद्यार्थी",
        "ST Students": "अनुसूचित जनजाति विद्यार्थी",
        "Students": "विद्यार्थी",
        "Education": "शिक्षा",
        "Scheme": "योजना",
    }

    for a, b in replacements.items():
        t = t.replace(a, b)

    return t

def v6_reply(language, profile, best):
    lang = v4_clean(language)
    title = v4_safe_title(best.get("title"))
    score = best.get("score", 0)
    missing = best.get("missingDocuments", [])
    state = profile.get("state", "")
    category = profile.get("category", "")

    if lang == "hindi":
        title_hi = v6_hindi_scheme_title(title)
        state_hi = v6_hindi_state(state)
        category_hi = v5_hindi_category(category)

        reply = f"आपकी चुनी हुई {category_hi} श्रेणी और {state_hi} राज्य के आधार पर {title_hi} आपके लिए सबसे उपयुक्त योजना है। मिलान स्कोर {score} प्रतिशत है।"
        if missing:
            reply += " अभी ये दस्तावेज़ बाकी हैं: " + ", ".join(v5_hindi_docs(missing[:3])) + "।"
        reply += " अंतिम पात्रता आधिकारिक पोर्टल पर जरूर सत्यापित करें।"
        return reply

    reply = f"Based on your selected {category} category and {state} state, {title} is the best matching scheme. Match score is {score} percent."
    if missing:
        reply += " Missing documents are: " + ", ".join(missing[:3]) + "."
    reply += " Please verify final eligibility on the official portal."
    return reply

@app.post("/api/ai/voice-query-v6")
async def voice_scheme_query_v6(data: VoiceQueryRequest, authorization: Optional[str] = Header(default=None)):
    query = data.query.strip()
    language = v4_clean(data.language or "english")
    language = "hindi" if language == "hindi" else "english"

    incoming = data.profile or {}

    selected_state = incoming.get("selectedState") or incoming.get("state") or ""
    selected_category = incoming.get("selectedCategory") or incoming.get("category") or ""

    profile = dict(incoming)
    profile["state"] = selected_state
    profile["category"] = selected_category

    extracted = parse_voice_query(query)

    clean_detected = {
        "state": selected_state,
        "category": selected_category,
        "occupation": incoming.get("occupation") or extracted.get("occupation") or "",
        "beneficiaryType": "Student" if v4_need(query) in ["scholarship", "student"] else incoming.get("beneficiaryType", ""),
        "incomeRange": incoming.get("incomeRange") or extracted.get("incomeRange") or "",
        "documents": incoming.get("documents") or extracted.get("documents") or [],
        "need": v4_need(query)
    }

    if not selected_state:
        return {
            "reply": "कृपया पहले राज्य चुनें।" if language == "hindi" else "Please select your state first.",
            "needsClarification": True,
            "matchedSchemes": [],
            "extractedProfile": clean_detected,
            "usedProfile": profile
        }

    if not selected_category:
        return {
            "reply": "कृपया पहले श्रेणी या जाति चुनें।" if language == "hindi" else "Please select your category or caste first.",
            "needsClarification": True,
            "matchedSchemes": [],
            "extractedProfile": clean_detected,
            "usedProfile": profile
        }

    ranked = []
    for scheme in load_voice_scheme_data():
        result = v4_score_scheme(scheme, profile, query)
        if result:
            ranked.append({**scheme, **result})

    ranked.sort(key=lambda x: x.get("score", 0), reverse=True)
    top = ranked[:5]

    if top:
        reply = v6_reply(language, profile, top[0])
    else:
        if language == "hindi":
            reply = f"चुनी हुई {v5_hindi_category(selected_category)} श्रेणी और {v6_hindi_state(selected_state)} राज्य के लिए कोई सटीक योजना नहीं मिली।"
        else:
            reply = f"No accurate scheme found for selected {selected_category} category and {selected_state} state."

    matched = []
    for item in top:
        matched.append({
            "id": item.get("id"),
            "title": v4_safe_title(item.get("title")),
            "category": item.get("category"),
            "state": item.get("state"),
            "benefits": v4_safe_benefit(item.get("benefits")),
            "requiredDocuments": item.get("requiredDocuments", []),
            "score": item.get("score", 0),
            "status": item.get("status"),
            "reasons": item.get("reasons", []),
            "warnings": item.get("warnings", []),
            "missingDocuments": item.get("missingDocuments", []),
            "availableDocuments": item.get("availableDocuments", []),
            "officialLink": item.get("officialLink"),
        })

    return {
        "reply": reply,
        "needsClarification": False,
        "intent": v4_need(query),
        "extractedProfile": clean_detected,
        "usedProfile": profile,
        "matchedSchemes": matched
    }



# ================= SEVASETU FINAL MONGODB SYNC APIs =================
# Saves real frontend data into MongoDB Compass:
# voice_profiles, voice_interactions, application_tracker, frontend_sync_logs

from fastapi import Body
from pymongo import MongoClient
from datetime import datetime
import os

SEVASETU_MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
SEVASETU_DB_NAME = os.getenv("MONGODB_DB", "sevasetu_db")

_sevasetu_client = MongoClient(SEVASETU_MONGO_URI)
_sevasetu_db = _sevasetu_client[SEVASETU_DB_NAME]

def _now_iso():
    return datetime.utcnow().isoformat() + "Z"

def _safe_payload(payload):
    if not isinstance(payload, dict):
        return {"value": payload}
    return payload

@app.post("/api/voice-form/save")
async def save_voice_form_profile(payload: dict = Body(...)):
    payload = _safe_payload(payload)
    payload["createdAt"] = _now_iso()
    payload["source"] = "voice_form_help"

    result = _sevasetu_db.voice_profiles.insert_one(payload)

    profile = payload.get("profile") or payload.get("profilePreview") or {}
    email = (
        payload.get("email")
        or profile.get("email")
        or payload.get("userEmail")
        or "local-user@sevasetu"
    )

    _sevasetu_db.profiles.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "name": profile.get("name", ""),
                "state": profile.get("state", ""),
                "category": profile.get("category", ""),
                "beneficiaryType": profile.get("beneficiaryType", ""),
                "documents": profile.get("documents", []),
                "missingDocuments": profile.get("missingDocuments", []),
                "updatedAt": _now_iso(),
                "lastSource": "voice_form_help",
            }
        },
        upsert=True,
    )

    return {"ok": True, "collection": "voice_profiles", "id": str(result.inserted_id)}

@app.post("/api/voice-interactions")
async def save_voice_interaction(payload: dict = Body(...)):
    payload = _safe_payload(payload)
    payload["createdAt"] = _now_iso()
    payload["source"] = payload.get("source", "voice_bot")

    result = _sevasetu_db.voice_interactions.insert_one(payload)
    return {"ok": True, "collection": "voice_interactions", "id": str(result.inserted_id)}

@app.post("/api/application-tracker/sync")
async def sync_application_tracker(payload: dict = Body(...)):
    payload = _safe_payload(payload)
    payload["updatedAt"] = _now_iso()
    payload["source"] = "application_tracker"

    email = payload.get("email") or payload.get("userEmail") or "local-user@sevasetu"
    items = payload.get("items", [])

    _sevasetu_db.application_tracker.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "items": items,
                "count": len(items) if isinstance(items, list) else 0,
                "updatedAt": _now_iso(),
            }
        },
        upsert=True,
    )

    _sevasetu_db.frontend_sync_logs.insert_one({
        "email": email,
        "type": "application_tracker_sync",
        "count": len(items) if isinstance(items, list) else 0,
        "createdAt": _now_iso(),
    })

    return {"ok": True, "collection": "application_tracker", "count": len(items) if isinstance(items, list) else 0}

@app.post("/api/frontend-sync")
async def save_frontend_sync(payload: dict = Body(...)):
    payload = _safe_payload(payload)
    payload["createdAt"] = _now_iso()
    result = _sevasetu_db.frontend_sync_logs.insert_one(payload)
    return {"ok": True, "collection": "frontend_sync_logs", "id": str(result.inserted_id)}

@app.get("/api/database/summary")
async def database_summary():
    collections = _sevasetu_db.list_collection_names()
    data = {}
    for name in collections:
        data[name] = _sevasetu_db[name].count_documents({})
    return {"ok": True, "database": SEVASETU_DB_NAME, "collections": data}
# ================= END SEVASETU FINAL MONGODB SYNC APIs =================
