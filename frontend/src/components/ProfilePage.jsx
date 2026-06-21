import React, { useEffect, useMemo, useState } from "react";
import "./ProfilePage.css";
import {
  BadgeCheck,
  CheckCircle2,
  FileText,
  MapPin,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
  User,
  WalletCards,
} from "lucide-react";
import { api } from "../api";

const DOCUMENTS = [
  { name: "Aadhaar Card", mandatory: true },
  { name: "Caste Certificate", mandatory: true },
  { name: "PAN Card", mandatory: false },
  { name: "Income Certificate", mandatory: false },
  { name: "Domicile Certificate", mandatory: false },
  { name: "Ration Card", mandatory: false },
  { name: "Bank Passbook", mandatory: false },
  { name: "Birth Certificate", mandatory: false },
  { name: "Educational Certificate", mandatory: false },
  { name: "Passport Size Photo", mandatory: false },
  { name: "Mobile Number", mandatory: false },
];

const MANDATORY_DOCS = ["Aadhaar Card", "Caste Certificate"];

const STATES = [
  "All India",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("sevasetu_user") || "{}");
  } catch {
    return {};
  }
}

function getProfile() {
  try {
    return JSON.parse(localStorage.getItem("sevasetu_profile") || "{}");
  } catch {
    return {};
  }
}

function formatSize(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function guessDocumentType(fileName) {
  const name = String(fileName || "").toLowerCase();

  if (name.includes("aadhaar") || name.includes("aadhar")) return "Aadhaar Card";
  if (name.includes("pan")) return "PAN Card";
  if (name.includes("income")) return "Income Certificate";
  if (name.includes("caste")) return "Caste Certificate";
  if (name.includes("domicile")) return "Domicile Certificate";
  if (name.includes("ration")) return "Ration Card";
  if (name.includes("bank") || name.includes("passbook")) return "Bank Passbook";
  if (name.includes("birth")) return "Birth Certificate";
  if (name.includes("education") || name.includes("marksheet") || name.includes("certificate")) return "Educational Certificate";
  if (name.includes("photo") || name.includes("passport")) return "Passport Size Photo";

  return "";
}

export default function ProfilePage() {
  const user = useMemo(() => getUser(), []);
  const stored = useMemo(() => getProfile(), []);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: stored.name || user.name || "",
    email: stored.email || user.email || "",
    mobile: stored.mobile || user.mobile || "",
    age: stored.age || user.age || "",
    gender: stored.gender || user.gender || "",
    state: stored.state || user.state || "",
    district: stored.district || user.district || "",
    city: stored.city || user.city || "",
    category: stored.category || user.category || "",
    incomeRange: stored.incomeRange || user.incomeRange || "",
    occupation: stored.occupation || user.occupation || "",
    beneficiaryType: stored.beneficiaryType || user.beneficiaryType || "",
    familySize: stored.familySize || user.familySize || "",
    disability: stored.disability || user.disability || "No",
    student: Boolean(stored.student || user.student),
    farmer: Boolean(stored.farmer || user.farmer),
    woman: Boolean(stored.woman || user.woman),
    seniorCitizen: Boolean(stored.seniorCitizen || user.seniorCitizen),
    documents: stored.documents || user.documents || [],
    uploadedDocuments: stored.uploadedDocuments || user.uploadedDocuments || [],
  });

  useEffect(() => {
    localStorage.setItem("sevasetu_profile", JSON.stringify(form));
    localStorage.setItem("sevasetu_profile_last_saved_auto", new Date().toISOString());
  }, [form]);

  useEffect(() => {
    async function loadMe() {
      try {
        const me = await api("/api/auth/me");
        let mongoProfile = {};

        try {
          const profileRes = await api("/api/profile");
          mongoProfile = profileRes.profile || {};
        } catch {}

        const localProfile = getProfile();

        const merged = {
          ...form,
          ...me,
          ...mongoProfile,
          ...localProfile,
          documents:
            localProfile.documents ||
            mongoProfile.documents ||
            me.documents ||
            form.documents ||
            [],
          uploadedDocuments:
            localProfile.uploadedDocuments ||
            mongoProfile.uploadedDocuments ||
            me.uploadedDocuments ||
            form.uploadedDocuments ||
            [],
        };

        setForm(merged);
        localStorage.setItem("sevasetu_profile", JSON.stringify(merged));
      } catch {}
    }

    loadMe();
  }, []);

  const completed = useMemo(() => {
    const required = [
      "name",
      "mobile",
      "age",
      "gender",
      "state",
      "district",
      "category",
      "incomeRange",
      "occupation",
      "beneficiaryType",
    ];

    const filled = required.filter((key) => String(form[key] || "").trim()).length;
    const docChecklistScore = form.documents.length > 0 ? 1 : 0;
    const uploadedScore = form.uploadedDocuments.length > 0 ? 1 : 0;

    return Math.round(((filled + docChecklistScore + uploadedScore) / (required.length + 2)) * 100);
  }, [form]);

  function setValue(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDoc(doc) {
    setForm((prev) => {
      const exists = prev.documents.includes(doc);
      const documents = exists
        ? prev.documents.filter((x) => x !== doc)
        : [...prev.documents, doc];

      return { ...prev, documents };
    });
  }

  function handleDocumentUpload(event, documentName) {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowed = ["application/pdf", "image/jpeg", "image/png"];

    if (!allowed.includes(file.type)) {
      alert("Only JPG, JPEG, PNG and PDF files are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be under 5MB.");
      event.target.value = "";
      return;
    }

    const uploadedDoc = {
      id: `${documentName}-${file.name}-${file.size}-${Date.now()}`,
      documentName,
      name: file.name,
      size: file.size,
      type: file.type,
      guessedType: documentName || guessDocumentType(file.name),
      uploadedAt: new Date().toISOString(),
      status: "Uploaded",
    };

    setForm((prev) => {
      const withoutOldSameDoc = (prev.uploadedDocuments || []).filter(
        (doc) => doc.documentName !== documentName
      );

      const documents = prev.documents.includes(documentName)
        ? prev.documents
        : [...prev.documents, documentName];

      return {
        ...prev,
        uploadedDocuments: [uploadedDoc, ...withoutOldSameDoc],
        documents,
      };
    });

    event.target.value = "";
  }

  function getUploadedForDoc(documentName) {
    return (form.uploadedDocuments || []).find(
      (doc) => doc.documentName === documentName || doc.guessedType === documentName
    );
  }

  function removeUploadedDoc(id) {
    setForm((prev) => ({
      ...prev,
      uploadedDocuments: prev.uploadedDocuments.filter((doc) => doc.id !== id),
    }));
  }

  async function saveProfile() {
    try {
      setSaving(true);

      const payload = {
        ...form,
        age: form.age ? Number(form.age) : undefined,
        familySize: form.familySize ? Number(form.familySize) : undefined,
      };

      const apiPayload = {
        name: payload.name,
        email: payload.email,
        mobile: payload.mobile,
        age: payload.age,
        gender: payload.gender,
        state: payload.state,
        district: payload.district,
        city: payload.city,
        category: payload.category,
        incomeRange: payload.incomeRange,
        occupation: payload.occupation,
        beneficiaryType: payload.beneficiaryType,
        documents: payload.documents,
        uploadedDocuments: payload.uploadedDocuments,
        familySize: payload.familySize,
        disability: payload.disability,
        student: payload.student,
        farmer: payload.farmer,
        woman: payload.woman,
        seniorCitizen: payload.seniorCitizen,
      };

      const res = await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify(apiPayload),
      });

      const updated = {
        ...payload,
        ...(res.profile || {}),
        ...(res.user || {}),
        uploadedDocuments: payload.uploadedDocuments,
      };

      localStorage.setItem("sevasetu_profile", JSON.stringify(updated));
      localStorage.setItem("sevasetu_user", JSON.stringify(updated));

      localStorage.setItem("sevasetu_profile", JSON.stringify(updated));
      localStorage.setItem("sevasetu_user", JSON.stringify(updated));
      localStorage.setItem("sevasetu_profile_last_saved", new Date().toISOString());

      alert("Profile saved successfully. Your profile and uploaded document details will remain until logout.");
    } catch {
      localStorage.setItem("sevasetu_profile", JSON.stringify(form));
      localStorage.setItem("sevasetu_profile", JSON.stringify(form));
      localStorage.setItem("sevasetu_profile_last_saved", new Date().toISOString());

      alert("Profile saved locally. Your profile and uploaded document details will remain until logout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="profileProPage">
      <section className="profileHeroPro compactProfileHero">
        <div>
          <span>
            <ShieldCheck size={15} />
            Citizen Profile
          </span>

          <h1>Complete Your Profile</h1>

          <p>
            Fill your details and upload documents to improve scheme Profile Match.
          </p>
        </div>

        <aside>
          <div className="profileLogoMark" />
          <b>{completed}%</b>
          <small>Profile completed</small>
        </aside>
      </section>

      <section className="profileGridPro">
        <div className="profileFormCard">
          <h2>
            <User size={22} />
            Personal Information
          </h2>

          <div className="profileFormGrid">
            <label>
              Full Name
              <input value={form.name} onChange={(e) => setValue("name", e.target.value)} />
            </label>

            <label>
              Email
              <input value={form.email} disabled />
            </label>

            <label>
              Mobile Number
              <input value={form.mobile} onChange={(e) => setValue("mobile", e.target.value)} />
            </label>

            <label>
              Age
              <input type="number" value={form.age} onChange={(e) => setValue("age", e.target.value)} />
            </label>

            <label>
              Gender
              <select value={form.gender} onChange={(e) => setValue("gender", e.target.value)}>
                <option value="">Select gender</option>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              Category
              <select value={form.category} onChange={(e) => setValue("category", e.target.value)}>
                <option value="">Select category</option>
                <option>General</option>
                <option>OBC</option>
                <option>SC</option>
                <option>ST</option>
                <option>EWS</option>
                <option>Minority</option>
              </select>
            </label>
          </div>
        </div>

        <div className="profileFormCard">
          <h2>
            <MapPin size={22} />
            Location & Eligibility
          </h2>

          <div className="profileFormGrid">
            <label>
              State
              <select value={form.state} onChange={(e) => setValue("state", e.target.value)}>
                <option value="">Select state</option>
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>

            <label>
              District
              <input value={form.district} onChange={(e) => setValue("district", e.target.value)} />
            </label>

            <label>
              City / Village
              <input value={form.city} onChange={(e) => setValue("city", e.target.value)} />
            </label>

            <label>
              Income Range
              <select value={form.incomeRange} onChange={(e) => setValue("incomeRange", e.target.value)}>
                <option value="">Select income range</option>
                <option>Below ₹1 Lakh</option>
                <option>₹1 Lakh - ₹2.5 Lakh</option>
                <option>₹2.5 Lakh - ₹5 Lakh</option>
                <option>Above ₹5 Lakh</option>
              </select>
            </label>

            <label>
              Occupation
              <select value={form.occupation} onChange={(e) => setValue("occupation", e.target.value)}>
                <option value="">Select occupation</option>
                <option>Student</option>
                <option>Farmer</option>
                <option>Worker</option>
                <option>Business Owner</option>
                <option>Homemaker</option>
                <option>Unemployed</option>
                <option>Senior Citizen</option>
              </select>
            </label>

            <label>
              Beneficiary Type
              <select value={form.beneficiaryType} onChange={(e) => setValue("beneficiaryType", e.target.value)}>
                <option value="">Select beneficiary type</option>
                <option>Student</option>
                <option>Farmer</option>
                <option>Women</option>
                <option>Child</option>
                <option>MSME Owner</option>
                <option>Worker</option>
                <option>Senior Citizen</option>
                <option>General Citizen</option>
              </select>
            </label>
          </div>

          <div className="profileFlags">
            <button className={form.student ? "active" : ""} onClick={() => setValue("student", !form.student)}>Student</button>
            <button className={form.farmer ? "active" : ""} onClick={() => setValue("farmer", !form.farmer)}>Farmer</button>
            <button className={form.woman ? "active" : ""} onClick={() => setValue("woman", !form.woman)}>Woman</button>
            <button className={form.seniorCitizen ? "active" : ""} onClick={() => setValue("seniorCitizen", !form.seniorCitizen)}>Senior Citizen</button>
          </div>
        </div>

        <div className="profileFormCard wide">
          <h2>
            <FileText size={22} />
            Available Documents
          </h2>

          <p className="docInstructionText">
            Aadhaar Card and Caste Certificate are mandatory. Other documents are optional and can improve Profile Match.
          </p>

          <div className="docUploadGrid">
            {DOCUMENTS.map((doc) => {
              const uploaded = getUploadedForDoc(doc.name);
              const selected = form.documents.includes(doc.name) || Boolean(uploaded);

              return (
                <article
                  key={doc.name}
                  className={`docUploadItem ${selected ? "active" : ""} ${doc.mandatory ? "mandatory" : ""}`}
                >
                  <div className="docUploadTop">
                    <span>
                      <FileText size={18} />
                    </span>

                    <div>
                      <b>{doc.name}</b>
                      <small>{doc.mandatory ? "Mandatory" : "Optional"}</small>
                    </div>
                  </div>

                  {uploaded ? (
                    <div className="uploadedMiniInfo">
                      <CheckCircle2 size={16} />
                      <div>
                        <b>{uploaded.name}</b>
                        <small>{formatSize(uploaded.size)} • {uploaded.type}</small>
                      </div>
                    </div>
                  ) : (
                    <p>No file uploaded yet</p>
                  )}

                  <div className="docUploadActions">
                    <button
                      type="button"
                      className={selected ? "selectedDocBtn" : ""}
                      onClick={() => toggleDoc(doc.name)}
                    >
                      <CheckCircle2 size={15} />
                      {selected ? "Selected" : "Mark Available"}
                    </button>

                    <label>
                      <UploadCloud size={15} />
                      Upload
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                        onChange={(e) => handleDocumentUpload(e, doc.name)}
                      />
                    </label>
                  </div>

                  {uploaded && (
                    <button
                      type="button"
                      className="removeDocUploadBtn"
                      onClick={() => removeUploadedDoc(uploaded.id)}
                    >
                      <Trash2 size={15} />
                      Remove file
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        <aside className="profileSummaryCard">
          <h2>
            <WalletCards size={22} />
            Match Score Basis
          </h2>

          <ul>
            <li>State / All India coverage</li>
            <li>Beneficiary type</li>
            <li>Category and occupation</li>
            <li>Age and gender information</li>
            <li>Mandatory Aadhaar + Caste Certificate and optional uploads</li>
          </ul>

          <p>
            This is only a guidance score. Final eligibility is always decided by
            the official government portal.
          </p>

          <button onClick={saveProfile}>
            <Save size={18} />
            {saving ? "Saving..." : "Save Profile"}
          </button>

          <div className="profileTrustNote">
            <BadgeCheck size={18} />
            <span>Uploaded document names are used for Profile Match guidance.</span>
          </div>
        </aside>
      </section>
    </main>
  );
}
