import React, { useMemo } from "react";

const MANDATORY_DOCS = ["Aadhaar Card", "Caste Certificate"];

function getProfile() {
  try {
    return {
      ...(JSON.parse(localStorage.getItem("sevasetu_user") || "{}")),
      ...(JSON.parse(localStorage.getItem("sevasetu_profile") || "{}")),
    };
  } catch {
    return {};
  }
}

function arr(value) {
  if (Array.isArray(value)) return value;
  if (value) return [value];
  return [];
}

function text(value) {
  return String(value || "").toLowerCase();
}

function hasAny(source, words) {
  const s = text(source);
  return words.some((w) => s.includes(text(w)));
}

function uploadedNames(profile) {
  return arr(profile.uploadedDocuments).map((doc) =>
    `${doc.name || ""} ${doc.documentName || ""} ${doc.guessedType || ""}`
  );
}

function docMatched(requiredDoc, profile) {
  const selectedDocs = arr(profile.documents);
  const uploaded = uploadedNames(profile);

  const exactSelected = selectedDocs.some((doc) => text(doc) === text(requiredDoc));
  if (exactSelected) return true;

  return uploaded.some((name) => {
    const n = text(name);
    const r = text(requiredDoc);

    if (n.includes(r)) return true;
    if (r.includes("aadhaar") && (n.includes("aadhaar") || n.includes("aadhar"))) return true;
    if (r.includes("caste") && n.includes("caste")) return true;
    if (r.includes("pan") && n.includes("pan")) return true;
    if (r.includes("income") && n.includes("income")) return true;
    if (r.includes("domicile") && n.includes("domicile")) return true;
    if (r.includes("ration") && n.includes("ration")) return true;
    if (r.includes("bank") && (n.includes("bank") || n.includes("passbook"))) return true;
    if (r.includes("birth") && n.includes("birth")) return true;
    if (r.includes("education") && (n.includes("education") || n.includes("marksheet") || n.includes("certificate"))) return true;
    if (r.includes("photo") && (n.includes("photo") || n.includes("passport"))) return true;

    return false;
  });
}

function calcProfileMatch(scheme, profile) {
  const hasMandatoryAadhaar = docMatched("Aadhaar Card", profile);
  const hasMandatoryCaste = docMatched("Caste Certificate", profile);

  const hasBasicProfile =
    [profile.state, profile.beneficiaryType, profile.category, profile.incomeRange]
      .filter(Boolean).length >= 3;

  if (!hasBasicProfile && !hasMandatoryAadhaar && !hasMandatoryCaste) {
    return {
      enough: false,
      score: 0,
      label: "Not enough profile data",
      note: "Complete profile and add mandatory Aadhaar + Caste Certificate to calculate Profile Match.",
    };
  }

  let score = 0;
  let total = 0;

  const schemeStates = arr(scheme.state).map((x) => String(x));

  total += 20;
  if (schemeStates.includes("All India") || schemeStates.includes(profile.state)) {
    score += 20;
  }

  total += 15;
  const schemeText = [
    scheme.title,
    scheme.category,
    scheme.benefits,
    ...(scheme.requiredDocuments || []),
  ].join(" ");

  const beneficiary = text(profile.beneficiaryType);
  const occupation = text(profile.occupation);

  if (
    (beneficiary && hasAny(schemeText, [beneficiary])) ||
    (occupation && hasAny(schemeText, [occupation])) ||
    (profile.student && hasAny(schemeText, ["student", "scholarship", "education"])) ||
    (profile.farmer && hasAny(schemeText, ["farmer", "agriculture", "kisan", "crop"])) ||
    (profile.woman && hasAny(schemeText, ["women", "woman", "girl", "mother", "janani"])) ||
    (profile.seniorCitizen && hasAny(schemeText, ["senior", "pension", "elder"]))
  ) {
    score += 15;
  }

  total += 10;
  if (profile.category) score += 10;

  total += 10;
  if (profile.incomeRange) score += 10;

  total += 25;
  let mandatoryScore = 0;
  if (hasMandatoryAadhaar) mandatoryScore += 12.5;
  if (hasMandatoryCaste) mandatoryScore += 12.5;
  score += mandatoryScore;

  total += 20;
  const requiredDocs = arr(scheme.requiredDocuments).filter(
    (doc) => !MANDATORY_DOCS.some((m) => text(m) === text(doc))
  );

  if (requiredDocs.length === 0) {
    score += 10;
  } else {
    const matched = requiredDocs.filter((doc) => docMatched(doc, profile)).length;
    score += Math.round((matched / requiredDocs.length) * 20);
  }

  const percent = Math.max(10, Math.min(95, Math.round((score / total) * 100)));

  const missingMandatory = [];
  if (!hasMandatoryAadhaar) missingMandatory.push("Aadhaar Card");
  if (!hasMandatoryCaste) missingMandatory.push("Caste Certificate");

  return {
    enough: true,
    score: percent,
    label: "Profile Match",
    note:
      missingMandatory.length > 0
        ? `Mandatory missing: ${missingMandatory.join(", ")}. Score is guidance only; final eligibility is decided by official portal.`
        : "Based on profile, state, beneficiary type, category, income range, mandatory documents and optional uploads. Final eligibility is decided only by official portal.",
  };
}

export default function EligibilityMeter({ scheme }) {
  const profile = getProfile();
  const result = useMemo(() => calcProfileMatch(scheme || {}, profile), [scheme]);

  const color =
    result.score >= 75 ? "#15803d" : result.score >= 50 ? "#f97316" : "#e11d48";

  return (
    <div className="eligibilityMeter">
      <div className="meterTop">
        <strong>{result.enough ? `${result.score}%` : "—"}</strong>
        <span>{result.label}</span>
      </div>

      <p>{result.note}</p>

      <div className="meterTrack">
        <i
          style={{
            width: result.enough ? `${result.score}%` : "12%",
            background: result.enough
              ? `linear-gradient(90deg, #f97316, ${color})`
              : "#cbd5e1",
          }}
        />
      </div>
    </div>
  );
}
