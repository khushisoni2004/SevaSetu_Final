export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
];

const en = {
  home: "Home",
  schemes: "Schemes",
  eligibility: "Eligibility",
  documents: "Documents",
  login: "Login",
  signup: "Create Account",
  dashboard: "Dashboard",
  saved: "Saved Schemes",
  profile: "Profile",
  titleA: "Government support",
  titleB: "made simple",
  titleC: "for every citizen",
  subtitle:
    "Discover welfare schemes, check estimated eligibility, prepare required documents and continue safely on official government portals.",
  search: "Explore Schemes",
  promise:
    "Every citizen deserves simple, clear and trusted access to government support.",
};

const hi = {
  home: "होम",
  schemes: "योजनाएँ",
  eligibility: "पात्रता",
  documents: "दस्तावेज़",
  login: "लॉगिन",
  signup: "खाता बनाएँ",
  dashboard: "डैशबोर्ड",
  saved: "सेव योजनाएँ",
  profile: "प्रोफाइल",
  titleA: "सरकारी सहायता",
  titleB: "अब सरल",
  titleC: "हर नागरिक के लिए",
  subtitle:
    "योजनाएँ खोजें, अनुमानित पात्रता देखें, दस्तावेज़ तैयार करें और आधिकारिक पोर्टल पर सुरक्षित रूप से आगे बढ़ें।",
  search: "योजनाएँ देखें",
  promise:
    "हर नागरिक को सरकारी सहायता तक सरल, स्पष्ट और भरोसेमंद पहुँच मिलनी चाहिए।",
};

export function t(language = "en") {
  return language === "hi" ? hi : en;
}

export function getText(language = "en") {
  return t(language);
}

export function dir() {
  return "ltr";
}

export function isRTL() {
  return false;
}
