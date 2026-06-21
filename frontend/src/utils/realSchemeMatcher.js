function clean(value) {
  return String(value || "").trim().toLowerCase();
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

export function getRealProfile() {
  try {
    const user = JSON.parse(localStorage.getItem("sevasetu_user") || "{}");
    const profile = JSON.parse(localStorage.getItem("sevasetu_profile") || "{}");

    return {
      ...user,
      ...profile,
      state:
        localStorage.getItem("sevasetu_voice_state") ||
        profile.state ||
        user.state ||
        "",
      category:
        localStorage.getItem("sevasetu_voice_category") ||
        profile.category ||
        "",
    };
  } catch {
    return {};
  }
}

export function getRealUserDocuments(profile) {
  const docs = new Set(asArray(profile.documents));

  asArray(profile.uploadedDocuments).forEach((item) => {
    if (!item || typeof item !== "object") return;

    if (item.documentName) docs.add(item.documentName);
    if (item.guessedType) docs.add(item.guessedType);
  });

  return [...docs];
}

export function inferIntentFromQuery(query) {
  const q = clean(query);

  if (["student", "scholarship", "education", "college", "school", "hostel"].some((w) => q.includes(w))) {
    return "Student";
  }

  if (["farmer", "kisan", "agriculture", "crop", "irrigation"].some((w) => q.includes(w))) {
    return "Farmer";
  }

  if (["woman", "women", "mahila", "girl", "mother", "maternity", "widow"].some((w) => q.includes(w))) {
    return "Women";
  }

  if (["business", "startup", "msme", "loan", "vendor", "shop"].some((w) => q.includes(w))) {
    return "Business Owner";
  }

  if (["worker", "skill", "job", "employment", "artisan"].some((w) => q.includes(w))) {
    return "Worker";
  }

  if (["health", "medical", "insurance", "hospital"].some((w) => q.includes(w))) {
    return "Citizen";
  }

  return "";
}

export function calculateRealSchemeMatch(scheme, profile, query = "") {
  let score = 0;
  const reasons = [];
  const warnings = [];

  const states = asArray(scheme.state);
  const eligibleCategories = asArray(scheme.eligibleCategories);
  const beneficiaryTypes = asArray(scheme.beneficiaryTypes);
  const incomeGroups = asArray(scheme.incomeGroups);
  const requiredDocuments = asArray(scheme.requiredDocuments);

  const selectedState = profile.state || "";
  const selectedCategory = profile.category || "";
  const intent = inferIntentFromQuery(query) || profile.beneficiaryType || profile.occupation || "";

  const userDocs = getRealUserDocuments(profile);
  const availableDocuments = [];
  const missingDocuments = [];

  if (selectedState) {
    if (states.includes("All India") || states.some((s) => clean(s) === clean(selectedState))) {
      score += 25;
      reasons.push(`State matched: ${selectedState}`);
    } else {
      score -= 40;
      warnings.push(`State mismatch. This scheme is for ${states.join(", ")}.`);
    }
  } else {
    warnings.push("State not selected.");
  }

  if (selectedCategory) {
    if (
      eligibleCategories.includes("All") ||
      eligibleCategories.some((c) => clean(c) === clean(selectedCategory))
    ) {
      score += 20;
      reasons.push(`Category/caste matched: ${selectedCategory}`);
    } else {
      score -= 25;
      warnings.push(`Category/caste mismatch. Eligible categories: ${eligibleCategories.join(", ")}.`);
    }
  } else {
    warnings.push("Category/caste not selected.");
  }

  if (intent) {
    const beneficiaryMatch = beneficiaryTypes.some(
      (b) =>
        clean(b) === clean(intent) ||
        clean(intent).includes(clean(b)) ||
        clean(b).includes(clean(intent))
    );

    if (beneficiaryMatch) {
      score += 25;
      reasons.push(`Beneficiary matched: ${intent}`);
    } else {
      score -= 25;
      warnings.push(`Beneficiary mismatch. Scheme is for: ${beneficiaryTypes.join(", ")}.`);
    }
  }

  if (profile.incomeRange) {
    if (
      incomeGroups.length === 0 ||
      incomeGroups.some((group) => clean(profile.incomeRange).includes("low") && clean(group).includes("low")) ||
      incomeGroups.some((group) => clean(group) === clean(profile.incomeRange))
    ) {
      score += 10;
      reasons.push(`Income matched/considered: ${profile.incomeRange}`);
    } else {
      warnings.push(`Income group may not match: ${incomeGroups.join(", ")}.`);
    }
  }

  requiredDocuments.forEach((doc) => {
    if (userDocs.some((d) => clean(d) === clean(doc))) {
      availableDocuments.push(doc);
    } else {
      missingDocuments.push(doc);
    }
  });

  if (requiredDocuments.length > 0) {
    const docScore = Math.round((availableDocuments.length / requiredDocuments.length) * 20);
    score += docScore;

    if (availableDocuments.length) {
      reasons.push(`Available documents: ${availableDocuments.slice(0, 3).join(", ")}`);
    }

    if (missingDocuments.length) {
      warnings.push(`Missing documents: ${missingDocuments.slice(0, 3).join(", ")}`);
    }
  }

  score = Math.max(0, Math.min(100, score));

  let status = "Not Recommended";
  if (score >= 80) status = "Strong Match";
  else if (score >= 60) status = "Good Match";
  else if (score >= 40) status = "Partial Match";

  return {
    score,
    status,
    intent,
    reasons,
    warnings,
    availableDocuments,
    missingDocuments,
    requiredDocuments,
    eligibleCategories,
    beneficiaryTypes,
    states
  };
}

export function rankRealSchemes(schemes, profile, query = "") {
  return schemes
    .map((scheme) => ({
      ...scheme,
      match: calculateRealSchemeMatch(scheme, profile, query),
    }))
    .filter((scheme) => scheme.match.score >= 40)
    .sort((a, b) => b.match.score - a.match.score);
}
