const INDIAN_STATES = [
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
];

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

export function getCitizenProfile() {
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

export function getSchemeStates(scheme) {
  const found = [];
  const rawList = [
    scheme?.state,
    scheme?.states,
    scheme?.applicableStates,
    scheme?.coverage,
    scheme?.location,
  ];

  rawList.forEach((raw) => {
    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        if (String(item || "").trim()) found.push(String(item).trim());
      });
    } else if (raw) {
      found.push(String(raw).trim());
    }
  });

  const title = clean(scheme?.title);
  const publicText = clean(
    `${scheme?.title || ""} ${scheme?.category || ""} ${scheme?.benefits || ""}`
  );

  INDIAN_STATES.forEach((state) => {
    if (state !== "All India") {
      if (title.includes(clean(state)) || publicText.includes(clean(state))) {
        found.push(state);
      }
    }
  });

  if (title.includes("all india") || publicText.includes("all india")) {
    found.push("All India");
  }

  if (!found.length) found.push("All India");

  return [...new Set(found)];
}

export function getSchemeTitleState(scheme) {
  const title = clean(scheme?.title);

  for (const state of INDIAN_STATES) {
    if (state !== "All India" && title.includes(clean(state))) {
      return state;
    }
  }

  if (title.includes("all india")) return "All India";

  return "";
}

export function getRequiredDocuments(scheme) {
  const docs = scheme?.requiredDocuments || scheme?.documents || [];

  if (Array.isArray(docs)) return docs.filter(Boolean);
  if (typeof docs === "string") return [docs];

  return [];
}

export function getUserDocuments(profile) {
  const docs = new Set(profile?.documents || []);

  (profile?.uploadedDocuments || []).forEach((item) => {
    if (!item || typeof item !== "object") return;

    if (item.documentName) docs.add(item.documentName);
    if (item.guessedType) docs.add(item.guessedType);
    if (item.name) {
      const name = clean(item.name);

      if (name.includes("aadhaar") || name.includes("aadhar")) docs.add("Aadhaar Card");
      if (name.includes("income")) docs.add("Income Certificate");
      if (name.includes("caste")) docs.add("Caste Certificate");
      if (name.includes("pan")) docs.add("PAN Card");
      if (name.includes("domicile")) docs.add("Domicile Certificate");
      if (name.includes("bank") || name.includes("passbook")) docs.add("Bank Passbook");
    }
  });

  return [...docs];
}

export function inferSchemePurpose(scheme) {
  const text = clean(
    `${scheme?.title || ""} ${scheme?.category || ""} ${scheme?.benefits || ""}`
  );

  if (
    text.includes("education") ||
    text.includes("student") ||
    text.includes("scholarship") ||
    text.includes("hostel") ||
    text.includes("merit")
  ) {
    return "Student / Education";
  }

  if (
    text.includes("farmer") ||
    text.includes("agriculture") ||
    text.includes("crop") ||
    text.includes("irrigation") ||
    text.includes("soil")
  ) {
    return "Farmer / Agriculture";
  }

  if (
    text.includes("women") ||
    text.includes("woman") ||
    text.includes("girl") ||
    text.includes("maternity") ||
    text.includes("widow") ||
    text.includes("child")
  ) {
    return "Women & Child";
  }

  if (
    text.includes("business") ||
    text.includes("startup") ||
    text.includes("msme") ||
    text.includes("loan") ||
    text.includes("credit")
  ) {
    return "Business / Finance";
  }

  if (
    text.includes("skill") ||
    text.includes("employment") ||
    text.includes("job") ||
    text.includes("apprenticeship")
  ) {
    return "Employment / Skills";
  }

  if (
    text.includes("health") ||
    text.includes("medical") ||
    text.includes("insurance") ||
    text.includes("nutrition")
  ) {
    return "Health & Wellness";
  }

  return "General Citizen";
}

function categorySupportedByScheme(scheme, userCategory, requiredDocs) {
  const cat = clean(userCategory);
  const text = ` ${clean(`${scheme?.title || ""} ${scheme?.category || ""} ${scheme?.benefits || ""}`)} `;

  if (!cat) return false;

  if (cat === "sc") {
    return text.includes(" scheduled caste ") || text.includes(" sc ") || requiredDocs.some((d) => clean(d).includes("caste"));
  }

  if (cat === "st") {
    return text.includes(" scheduled tribe ") || text.includes(" st ") || requiredDocs.some((d) => clean(d).includes("caste"));
  }

  if (cat === "obc") {
    return text.includes(" obc ") || text.includes(" other backward ") || requiredDocs.some((d) => clean(d).includes("caste"));
  }

  if (cat === "ews") {
    return text.includes(" ews ") || text.includes(" economically weaker ") || clean(scheme?.benefits).includes("income");
  }

  if (cat === "minority") {
    return text.includes(" minority ") || text.includes(" minorities ");
  }

  if (cat === "general") {
    return text.includes(" citizen ") || text.includes(" all citizens ") || getSchemeStates(scheme).includes("All India");
  }

  return false;
}

export function calculateExplainableMatch(scheme, profileInput) {
  const profile = profileInput || getCitizenProfile();

  let score = 0;
  const positive = [];
  const warnings = [];
  const missingDocuments = [];
  const availableDocuments = [];

  const states = getSchemeStates(scheme);
  const titleState = getSchemeTitleState(scheme);
  const selectedState = profile.state || "";
  const requiredDocs = getRequiredDocuments(scheme);
  const userDocs = getUserDocuments(profile);
  const purpose = inferSchemePurpose(scheme);

  if (!selectedState) {
    warnings.push("State is not selected, so state accuracy is limited.");
  } else if (titleState && titleState !== "All India") {
    if (clean(titleState) === clean(selectedState)) {
      score += 28;
      positive.push(`State matched from scheme title: ${titleState}`);
    } else {
      score -= 35;
      warnings.push(`State mismatch: scheme is for ${titleState}, but profile state is ${selectedState}.`);
    }
  } else if (states.includes("All India")) {
    score += 22;
    positive.push("Scheme is available for All India.");
  } else if (states.some((state) => clean(state) === clean(selectedState))) {
    score += 28;
    positive.push(`State matched: ${selectedState}`);
  } else {
    score -= 30;
    warnings.push(`State mismatch: scheme states are ${states.join(", ")}.`);
  }

  if (purpose !== "General Citizen") {
    score += 22;
    positive.push(`Scheme purpose detected: ${purpose}`);
  } else {
    score += 10;
    positive.push("General citizen scheme detected.");
  }

  if (profile.category) {
    if (categorySupportedByScheme(scheme, profile.category, requiredDocs)) {
      score += 14;
      positive.push(`Category/caste supported: ${profile.category}`);
    } else {
      score += 4;
      warnings.push(`Category/caste considered but not strongly mentioned: ${profile.category}`);
    }
  } else {
    warnings.push("Category/caste is not selected.");
  }

  if (profile.incomeRange) {
    score += 6;
    positive.push(`Income information considered: ${profile.incomeRange}`);
  } else {
    warnings.push("Income range is not filled.");
  }

  requiredDocs.forEach((doc) => {
    if (userDocs.some((d) => clean(d) === clean(doc))) {
      availableDocuments.push(doc);
    } else {
      missingDocuments.push(doc);
    }
  });

  if (requiredDocs.length > 0) {
    const docScore = Math.round((availableDocuments.length / requiredDocs.length) * 20);
    score += docScore;

    if (availableDocuments.length) {
      positive.push(`Available documents: ${availableDocuments.slice(0, 3).join(", ")}`);
    }

    if (missingDocuments.length) {
      warnings.push(`Missing documents: ${missingDocuments.slice(0, 3).join(", ")}`);
    }
  } else {
    score += 8;
    positive.push("No strict document list found in dataset.");
  }

  score = Math.max(5, Math.min(96, score));

  let level = "Low Match";
  if (score >= 80) level = "Strong Match";
  else if (score >= 60) level = "Good Match";
  else if (score >= 40) level = "Partial Match";

  return {
    score,
    level,
    purpose,
    states,
    selectedState,
    titleState,
    positive,
    warnings,
    missingDocuments,
    availableDocuments,
    requiredDocuments: requiredDocs,
  };
}
