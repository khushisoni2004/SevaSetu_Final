import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Landmark,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import "./DocumentsPage.css";

const DOCUMENT_SERVICES = [
  {
    name: "Aadhaar Card",
    tag: "Mandatory",
    type: "Identity Proof",
    desc: "Used for identity verification, DBT, schemes and citizen services.",
    apply: "https://uidai.gov.in/en/my-aadhaar/get-aadhaar.html",
    verify: "https://myaadhaar.uidai.gov.in/verifyAadhaar",
    download: "https://myaadhaar.uidai.gov.in/genricDownloadAadhaar",
    keywords: ["aadhaar", "aadhar", "uidai"],
    mandatory: true,
  },
  {
    name: "Caste Certificate",
    tag: "Mandatory if category benefit",
    type: "Category Proof",
    desc: "Required for SC/ST/OBC/category-based schemes and reservations.",
    apply: "https://serviceonline.gov.in/",
    verify: "https://serviceonline.gov.in/",
    download: "https://serviceonline.gov.in/",
    keywords: ["caste", "jati", "obc", "sc", "st"],
    mandatory: true,
  },
  {
    name: "Income Certificate",
    tag: "Important",
    type: "Income Proof",
    desc: "Used for scholarships, subsidies, EWS and low-income benefits.",
    apply: "https://serviceonline.gov.in/",
    verify: "https://serviceonline.gov.in/",
    download: "https://serviceonline.gov.in/",
    keywords: ["income", "aay", "salary"],
    mandatory: false,
  },
  {
    name: "Domicile Certificate",
    tag: "State Schemes",
    type: "Residence Proof",
    desc: "Helps prove state residence for state-specific Schemes.",
    apply: "https://serviceonline.gov.in/",
    verify: "https://serviceonline.gov.in/",
    download: "https://serviceonline.gov.in/",
    keywords: ["domicile", "residence", "niwas"],
    mandatory: false,
  },
  {
    name: "PAN Card",
    tag: "Finance",
    type: "Tax Identity",
    desc: "Useful for banking, tax, income verification and financial schemes.",
    apply: "https://www.onlineservices.nsdl.com/paam/endUserRegisterContact.html",
    verify: "https://www.incometax.gov.in/iec/foportal/",
    download: "https://www.incometax.gov.in/iec/foportal/",
    keywords: ["pan"],
    mandatory: false,
  },
  {
    name: "Ration Card",
    tag: "Food Security",
    type: "Family Proof",
    desc: "Used for food security, family identity and welfare eligibility.",
    apply: "https://nfsa.gov.in/",
    verify: "https://nfsa.gov.in/",
    download: "https://nfsa.gov.in/",
    keywords: ["ration", "nfsa"],
    mandatory: false,
  },
  {
    name: "Bank Passbook",
    tag: "DBT",
    type: "Bank Proof",
    desc: "Needed for direct benefit transfer and scheme payment verification.",
    apply: "https://www.digilocker.gov.in/",
    verify: "https://www.digilocker.gov.in/",
    download: "https://www.digilocker.gov.in/",
    keywords: ["bank", "passbook"],
    mandatory: false,
  },
  {
    name: "Educational Certificate",
    tag: "Student",
    type: "Education Proof",
    desc: "Required for scholarships, student schemes and skill programs.",
    apply: "https://www.digilocker.gov.in/",
    verify: "https://www.digilocker.gov.in/",
    download: "https://www.digilocker.gov.in/",
    keywords: ["education", "marksheet", "certificate", "school", "college"],
    mandatory: false,
  },
  {
    name: "Birth Certificate",
    tag: "Age Proof",
    type: "Civil Certificate",
    desc: "Useful for age proof, child schemes and official identity records.",
    apply: "https://crsorgi.gov.in/",
    verify: "https://crsorgi.gov.in/",
    download: "https://crsorgi.gov.in/",
    keywords: ["birth"],
    mandatory: false,
  },
  {
    name: "DigiLocker",
    tag: "Digital Vault",
    type: "Verified Documents",
    desc: "Store and access verified digital documents from official issuers.",
    apply: "https://www.digilocker.gov.in/",
    verify: "https://www.digilocker.gov.in/",
    download: "https://www.digilocker.gov.in/",
    keywords: ["digilocker"],
    mandatory: false,
  },
  {
    name: "Voter ID",
    tag: "Identity",
    type: "Election ID",
    desc: "Useful as identity and address proof for public services.",
    apply: "https://voters.eci.gov.in/",
    verify: "https://voters.eci.gov.in/",
    download: "https://voters.eci.gov.in/",
    keywords: ["voter", "epic"],
    mandatory: false,
  },
  {
    name: "Driving Licence",
    tag: "Transport",
    type: "Identity Proof",
    desc: "Official driving identity and transport-related document.",
    apply: "https://parivahan.gov.in/",
    verify: "https://parivahan.gov.in/",
    download: "https://parivahan.gov.in/",
    keywords: ["driving", "licence", "license", "dl"],
    mandatory: false,
  },
];

function getProfile() {
  try {
    return JSON.parse(localStorage.getItem("sevasetu_profile") || "{}");
  } catch {
    return {};
  }
}

function saveProfile(profile) {
  localStorage.setItem("sevasetu_profile", JSON.stringify(profile));
  localStorage.setItem("sevasetu_profile_last_saved_auto", new Date().toISOString());
}

function formatSize(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function fileAllowed(file) {
  return ["application/pdf", "image/jpeg", "image/png"].includes(file.type);
}

function getUploadedForDoc(profile, docName) {
  return (profile.uploadedDocuments || []).find(
    (doc) => doc.documentName === docName || doc.guessedType === docName
  );
}

export default function DocumentsPage() {
  const [profile, setProfile] = useState(getProfile());
  const [selected, setSelected] = useState(DOCUMENT_SERVICES[0]);
  const [query, setQuery] = useState("");

  const uploadedCount = (profile.uploadedDocuments || []).length;
  const selectedCount = (profile.documents || []).length;

  const mandatoryDone = DOCUMENT_SERVICES.filter((d) => d.mandatory).filter((doc) =>
    Boolean(getUploadedForDoc(profile, doc.name)) || (profile.documents || []).includes(doc.name)
  ).length;

  const readiness = Math.min(
    96,
    Math.round(((mandatoryDone * 2 + uploadedCount + selectedCount) / 18) * 100)
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOCUMENT_SERVICES;
    return DOCUMENT_SERVICES.filter((doc) =>
      [doc.name, doc.tag, doc.type, doc.desc].join(" ").toLowerCase().includes(q)
    );
  }, [query]);

  function uploadDoc(event, doc) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!fileAllowed(file)) {
      alert("Only JPG, JPEG, PNG and PDF files are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be under 5MB.");
      event.target.value = "";
      return;
    }

    const uploaded = {
      id: `${doc.name}-${file.name}-${file.size}-${Date.now()}`,
      documentName: doc.name,
      guessedType: doc.name,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      status: "Uploaded",
    };

    const oldUploads = (profile.uploadedDocuments || []).filter(
      (x) => x.documentName !== doc.name
    );

    const documents = (profile.documents || []).includes(doc.name)
      ? profile.documents || []
      : [...(profile.documents || []), doc.name];

    const updated = {
      ...profile,
      documents,
      uploadedDocuments: [uploaded, ...oldUploads],
    };

    setProfile(updated);
    saveProfile(updated);
    event.target.value = "";
  }

  function markAvailable(doc) {
    const docs = profile.documents || [];
    const documents = docs.includes(doc.name)
      ? docs.filter((x) => x !== doc.name)
      : [...docs, doc.name];

    const updated = { ...profile, documents };
    setProfile(updated);
    saveProfile(updated);
  }

  function removeUpload(docName) {
    const updated = {
      ...profile,
      uploadedDocuments: (profile.uploadedDocuments || []).filter(
        (doc) => doc.documentName !== docName
      ),
    };

    setProfile(updated);
    saveProfile(updated);
  }

  return (
    <main className="docsProPage">
      <section className="docsHeroPro docsHeroSavedStyle">
        <div className="docsHeroMainText">
          <span>
            <Sparkles size={15} />
            Smart Document Vault
          </span>

          <h1>Documents Hub</h1>

          <p>
            Upload documents, check readiness, open official portals and keep
            scheme-required document details saved until logout.
          </p>
        </div>

        <aside className="docsHeroLogoCard">
          <img src="/images/sevasetu_official_logo.png" alt="SevaSetu" />
          <b>{readiness || 0}%</b>
          <small>Document readiness</small>
        </aside>
      </section>

      <section className="docsSmartPanel">
        <article>
          <BadgeCheck size={24} />
          <div>
            <b>Mandatory Check</b>
            <span>{mandatoryDone}/2 Aadhaar + Caste Certificate ready</span>
          </div>
        </article>

        <article>
          <UploadCloud size={24} />
          <div>
            <b>Uploaded Files</b>
            <span>{uploadedCount} document file details saved</span>
          </div>
        </article>

        <article>
          <FileCheck2 size={24} />
          <div>
            <b>Marked Available</b>
            <span>{selectedCount} documents selected for Profile Match</span>
          </div>
        </article>
      </section>

      <section className="docsFilterLine">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Aadhaar, caste, income, PAN, DigiLocker..."
        />
      </section>

      <section className="docsLayoutPro">
        <div className="docsCardsGrid">
          {filtered.map((doc) => {
            const uploaded = getUploadedForDoc(profile, doc.name);
            const available = (profile.documents || []).includes(doc.name) || Boolean(uploaded);

            return (
              <article
                key={doc.name}
                className={`docProCard ${available ? "ready" : ""} ${doc.mandatory ? "must" : ""}`}
                onClick={() => setSelected(doc)}
              >
                <div className="docCardTop">
                  <span>
                    <Landmark size={21} />
                  </span>

                  <em>{doc.tag}</em>
                </div>

                <h2>{doc.name}</h2>
                <p>{doc.desc}</p>

                <div className="docStatusLine">
                  {available ? (
                    <>
                      <CheckCircle2 size={17} />
                      Ready for matching
                    </>
                  ) : (
                    <>
                      <FileText size={17} />
                      Not added yet
                    </>
                  )}
                </div>

                {uploaded && (
                  <div className="docUploadedChip">
                    <FileText size={15} />
                    <span>{uploaded.name}</span>
                  </div>
                )}

                <div className="docCardActions">
                  <button type="button" onClick={(e) => { e.stopPropagation(); markAvailable(doc); }}>
                    <CheckCircle2 size={15} />
                    {available ? "Selected" : "Mark"}
                  </button>

                  <label onClick={(e) => e.stopPropagation()}>
                    <UploadCloud size={15} />
                    Upload
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      onChange={(e) => uploadDoc(e, doc)}
                    />
                  </label>
                </div>

                <div className="docLinkRow">
                  <a href={doc.apply} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    Apply
                    <ExternalLink size={13} />
                  </a>

                  <a href={doc.verify} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    Verify
                    <ShieldCheck size={13} />
                  </a>

                  <a href={doc.download} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    Download
                    <Download size={13} />
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="docsSidePro">
          <span>{selected.type}</span>
          <h2>{selected.name}</h2>
          <p>{selected.desc}</p>

          <div className="sideReadinessBox">
            <b>{getUploadedForDoc(profile, selected.name) ? "Uploaded" : "Pending"}</b>
            <small>{selected.mandatory ? "Mandatory document" : "Optional document"}</small>
          </div>

          {getUploadedForDoc(profile, selected.name) ? (
            <div className="selectedUploadInfo">
              <FileText size={20} />
              <div>
                <b>{getUploadedForDoc(profile, selected.name).name}</b>
                <small>
                  {formatSize(getUploadedForDoc(profile, selected.name).size)} •{" "}
                  {getUploadedForDoc(profile, selected.name).type}
                </small>
              </div>

              <button onClick={() => removeUpload(selected.name)}>
                <Trash2 size={15} />
              </button>
            </div>
          ) : (
            <label className="sideUploadDrop">
              <UploadCloud size={32} />
              <b>Upload {selected.name}</b>
              <small>JPG, PNG or PDF under 5MB</small>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={(e) => uploadDoc(e, selected)}
              />
            </label>
          )}

          <a className="mainOfficialBtn" href={selected.apply} target="_blank" rel="noreferrer">
            Continue to Official Portal
            <ArrowRight size={18} />
          </a>

          <div className="docsUniqueNote">
            <b>Unique SevaSetu Feature</b>
            <p>
              Uploaded document names are connected with Profile Match, so scheme
              cards can show a more honest readiness score instead of fake eligibility.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
