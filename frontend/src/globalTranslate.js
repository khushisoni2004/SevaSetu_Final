import { getText } from "./i18n.js";

const mapKeys = [
  ["Home", "home"],
  ["Schemes", "schemes"],
  ["Eligibility", "eligibility"],
  ["Documents", "documents"],
  ["Login", "login"],
  ["Create Account", "createAccount"],
  ["Dashboard", "dashboard"],
  ["Browse Schemes", "browseSchemes"],
  ["Documents Hub", "documentsHub"],
  ["Saved Schemes", "savedSchemes"],
  ["Profile", "profile"],
  ["Logout", "logout"],
  ["Official Sites", "officialSites"],
  ["Quick Links", "quickLinks"],
];

export function applyGlobalTranslation(language) {
  const text = getText(language);

  document.querySelectorAll("button, a, span, b, h1, h2, h3, p, small, label").forEach((node) => {
    const raw = (node.childNodes.length === 1 ? node.textContent : "").trim();

    if (!raw) return;

    for (const [english, key] of mapKeys) {
      if (raw === english && text[key]) {
        node.textContent = text[key];
        return;
      }
    }
  });
}
