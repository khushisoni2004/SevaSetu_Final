import React from "react";
import "./HomePage.css";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  GraduationCap,
  HandHeart,
  HeartPulse,
  HelpCircle,
  Home as HomeIcon,
  Languages,
  Leaf,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { go } from "../App.jsx";

const TEXT = {
  en: {
    home: "Home",
    schemes: "Schemes",
    services: "Services",
    about: "About Us",
    help: "Help Center",
    needHelp: "Need Help?",
    login: "Login",
    signup: "Sign Up",
    title1: "Empowering India,",
    title2: "Enriching Lives",
    subtitle:
      "Access Schemes and services easily, securely & from anywhere.",
    education: "Education",
    health: "Health",
    jobs: "Jobs",
    agriculture: "Agriculture",
    support: "Support",
    quoteTitle: "SevaSetu Citizen Promise",
    quote:
      "Every citizen deserves simple, clear and trusted access to government support.",
    quoteText:
      "Search schemes, prepare documents and continue safely through official portals.",
    start: "Create Account",
    explore: "Explore Schemes",
    schemeCount: "3,406+",
    schemesLabel: "Schemes",
    states: "36",
    statesLabel: "States & UTs",
    safe: "Safe",
    safeLabel: "Official Guidance",
  },
  hi: {
    home: "होम",
    schemes: "योजनाएँ",
    services: "सेवाएँ",
    about: "हमारे बारे में",
    help: "सहायता केंद्र",
    needHelp: "मदद चाहिए?",
    login: "लॉगिन",
    signup: "साइन अप",
    title1: "भारत को सशक्त बनाना,",
    title2: "जीवन को समृद्ध बनाना",
    subtitle:
      "सरकारी योजनाओं और सेवाओं तक आसान, सुरक्षित और कहीं से भी पहुँच पाएँ।",
    education: "शिक्षा",
    health: "स्वास्थ्य",
    jobs: "रोजगार",
    agriculture: "कृषि",
    support: "सहायता",
    quoteTitle: "SevaSetu नागरिक वादा",
    quote:
      "हर नागरिक को सरकारी सहायता तक सरल, स्पष्ट और भरोसेमंद पहुँच मिलनी चाहिए।",
    quoteText:
      "योजनाएँ खोजें, दस्तावेज़ तैयार करें और आधिकारिक पोर्टल पर सुरक्षित रूप से आगे बढ़ें।",
    start: "अकाउंट बनाएँ",
    explore: "योजनाएँ देखें",
    schemeCount: "3,406+",
    schemesLabel: "सरकारी योजनाएँ",
    states: "36",
    statesLabel: "राज्य व केंद्रशासित प्रदेश",
    safe: "सुरक्षित",
    safeLabel: "आधिकारिक मार्गदर्शन",
  },
};

function BrandLogo() {
  return (
    <div className="ssBrand">
      <div className="ssLogoMark">
        <span />
      </div>
      <div>
        <h2>
          <b>Seva</b>
          <strong>Setu</strong>
        </h2>
        <p>Schemes Portal</p>
      </div>
    </div>
  );
}

export default function HomePage({ language = "en", setLanguage }) {
  const text = TEXT[language] || TEXT.en;

  const cards = [
    [text.education, GraduationCap],
    [text.health, HeartPulse],
    [text.jobs, BriefcaseBusiness],
    [text.agriculture, Leaf],
    [text.support, HandHeart],
  ];

  return (
    <main className="ssLanding">
      <header className="ssNavbar">
        <button className="ssBrandBtn" type="button" onClick={() => go("/")}>
          <BrandLogo />
        </button>

        <nav className="ssNavMenu">
          <button type="button" className="active" onClick={() => go("/")}>
            {text.home}
          </button>
          <button type="button" onClick={() => go("/signup")}>
            {text.schemes}
          </button>
          <button type="button" onClick={() => go("/signup")}>
            {text.services}
          </button>
          <button type="button" onClick={() => go("/signup")}>
            {text.about}
          </button>
          <button type="button" onClick={() => go("/signup")}>
            {text.help}
          </button>
        </nav>

        <div className="ssNavActions">
          <label className="ssLang">
            <Languages size={16} />
            <select
              value={language}
              onChange={(e) => {
                setLanguage?.(e.target.value);
                localStorage.setItem("sevasetu_language", e.target.value);
              }}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
          </label>

          <button className="ssLoginBtn" type="button" onClick={() => go("/login")}>
            {text.login}
          </button>

          <button className="ssSignupBtn" type="button" onClick={() => go("/signup")}>
            {text.signup}
          </button>

          <button className="ssHelpBtn" type="button" onClick={() => go("/signup")}>
            <HelpCircle size={17} />
            {text.needHelp}
          </button>
        </div>
      </header>

      <section className="ssHero">
        <div className="ssHeroOverlay" />

        <div className="ssHeroLeft">
          <div className="ssHeroTextCard">
            <h1 className="ssFinalHeroTitle">
              <span className="ssTitleFirst">{text.title1}</span>
              <br />
              {language === "en" ? (
                <span className="ssTitleSecond">
                  <span className="ssEnriching">Enriching</span>{" "}
                  <span className="ssLives">Lives</span>
                </span>
              ) : (
                <span className="ssTitleSecond ssLives">{text.title2}</span>
              )}
            </h1>

            <p>{text.subtitle}</p>
          </div>
        </div>

        <aside className="ssQuoteCard">
          <div className="ssQuoteIcon">
            <ShieldCheck size={34} />
          </div>

          <span className="ssQuoteBadge">
            <Sparkles size={15} />
            Trusted Citizen Platform
          </span>

          <h2>{text.quoteTitle}</h2>

          <p className="ssQuoteBig">“{text.quote}”</p>

          <p className="ssQuoteSmall">{text.quoteText}</p>

          <div className="ssQuoteBtns">
            <button type="button" onClick={() => go("/signup")}>
              {text.start}
              <ArrowRight size={17} />
            </button>

            <button type="button" className="outline" onClick={() => go("/signup")}>
              <BookOpen size={17} />
              {text.explore}
            </button>
          </div>

          <div className="ssQuoteStats">
            <article>
              <b>{text.schemeCount}</b>
              <small>{text.schemesLabel}</small>
            </article>
            <article>
              <b>{text.states}</b>
              <small>{text.statesLabel}</small>
            </article>
            <article>
              <b>{text.safe}</b>
              <small>{text.safeLabel}</small>
            </article>
          </div>

          <div className="ssPromiseServices">
            {cards.map(([label, Icon]) => (
              <article key={label}>
                <Icon size={22} />
                <b>{label}</b>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <footer className="ssFooter">
        <button type="button">Privacy Policy</button>
        <span />
        <button type="button">Terms of Use</button>
        <span />
        <button type="button">Disclaimer</button>
        <span />
        <button type="button">Accessibility</button>

        <p>
          © 2025 <b>Seva</b>
          <strong>Setu</strong>. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
