import React from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Home,
  Landmark,
  Languages,
  Search,
  ShieldCheck,
  Sparkles,
  Tractor,
  Users,
  WalletCards,
} from "lucide-react";

import {
  PREMIUM_LANGUAGES,
  isRtlLanguage,
  premiumText,
} from "./sevasetuPremiumText";

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("route-change"));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const categories = [
  ["Agriculture & Farmers", "Farming, crops and subsidies", Tractor],
  ["Education & Students", "Scholarships and training", GraduationCap],
  ["Health & Wellness", "Healthcare and insurance", HeartPulse],
  ["Women & Child", "Safety, welfare and support", HandHeart],
  ["Youth & Employment", "Jobs, skills and careers", BriefcaseBusiness],
  ["Business & Industry", "MSME, startup and finance", Building2],
  ["Housing & Shelter", "Housing and construction", Home],
  ["Finance & Banking", "Loans, credit and support", WalletCards],
];

export default function HomePagePro({ language = "en", setLanguage = () => {} }) {
  const text = premiumText(language);
  const dir = isRtlLanguage(language) ? "rtl" : "ltr";

  return (
    <main className="premiumHome" dir={dir}>
      <header className="premiumNav">
        <button className="premiumBrand" type="button" onClick={() => navigate("/")}>
          <span className="premiumLogo">
            <span className="logoSaffron" />
            <span className="logoWheel">☸</span>
            <span className="logoGreen" />
          </span>
          <div>
            <b>Seva<span>Setu</span></b>
            <small>{text.brandLine}</small>
          </div>
        </button>

        <nav className="premiumLinks">
          <button className="active" type="button">{text.navHome}</button>
          <button type="button" onClick={() => navigate("/app/schemes")}>{text.navSchemes}</button>
          <button type="button" onClick={() => navigate("/app/schemes")}>{text.navEligibility}</button>
          <button type="button" onClick={() => navigate("/app/documents")}>{text.navDocs}</button>
        </nav>

        <div className="premiumActions">
          <label className="premiumLang">
            <Languages />
            <select
              value={language}
              onChange={(event) => {
                setLanguage(event.target.value);
                localStorage.setItem("sevasetu_language", event.target.value);
              }}
            >
              {PREMIUM_LANGUAGES.map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </label>

          <button className="premiumLogin" type="button" onClick={() => navigate("/login")}>
            {text.navLogin}
          </button>

          <button className="premiumSignup" type="button" onClick={() => navigate("/signup")}>
            {text.navSignup}
            <ArrowRight />
          </button>
        </div>
      </header>

      <section className="premiumHero">
        <div className="premiumMonumentSketch">
          <div className="sunGlow" />
          <div className="indiaGateSketch">
            <span />
            <b />
            <em />
          </div>
          <div className="redFortSketch">
            <span />
            <span />
            <span />
            <b />
          </div>
          <div className="flagWave saffron" />
          <div className="flagWave white" />
          <div className="flagWave green" />
        </div>

        <div className="premiumHeroContent">
          <span className="premiumBadge">
            <ShieldCheck />
            {text.badge}
          </span>

          <h1>
            {text.title1}
            <br />
            <em>{text.title2}</em>
          </h1>

          <p>{text.subtitle}</p>

          <div className="premiumSearch">
            <Search />
            <input placeholder={text.search} />
            <button type="button" onClick={() => navigate("/app/schemes")}>
              {text.primary}
              <ArrowRight />
            </button>
          </div>

          <div className="premiumHeroButtons">
            <button type="button" onClick={() => navigate("/app/schemes")}>
              <Search />
              {text.primary}
            </button>
            <button type="button" className="secondary" onClick={() => navigate("/signup")}>
              {text.secondary}
              <ArrowRight />
            </button>
          </div>

          <div className="premiumTrust">
            <span><CheckCircle2 /> {text.trust1}</span>
            <span><CheckCircle2 /> {text.trust2}</span>
            <span><CheckCircle2 /> {text.trust3}</span>
          </div>
        </div>

        <aside className="premiumHeroCard">
          <div className="cardTop">
            <span><Sparkles /></span>
            <div>
              <small>Citizen Readiness</small>
              <b>Smart assistance dashboard</b>
            </div>
          </div>

          <div className="cardStats">
            <article><b>8,000+</b><small>{text.stat1}</small></article>
            <article><b>36</b><small>{text.stat2}</small></article>
            <article><b>20+</b><small>{text.stat3}</small></article>
            <article><b>Safe</b><small>{text.stat4}</small></article>
          </div>

          <div className="cardSteps">
            <span><BadgeCheck /> Search scheme</span>
            <span><FileCheck2 /> Prepare documents</span>
            <span><BookOpenCheck /> Save progress</span>
          </div>
        </aside>
      </section>

      <section className="premiumCategories">
        <div className="sectionTitle">
          <small>Structured support</small>
          <h2>{text.catTitle}</h2>
          <p>{text.catText}</p>
        </div>

        <div className="categoryGrid">
          {categories.map(([title, desc, Icon]) => (
            <article key={title}>
              <span><Icon /></span>
              <div>
                <b>{title}</b>
                <small>{desc}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="premiumOfficialStrip">
        <div>
          <Landmark />
          <h2>Official portal handoff</h2>
          <p>
            SevaSetu guides citizens. Final submission continues on official
            government portals only.
          </p>
        </div>
        <div className="officialLinks">
          <a href="https://www.myscheme.gov.in/" target="_blank" rel="noreferrer">myScheme</a>
          <a href="https://www.digilocker.gov.in/" target="_blank" rel="noreferrer">DigiLocker</a>
          <a href="https://web.umang.gov.in/" target="_blank" rel="noreferrer">UMANG</a>
        </div>
      </section>

      <footer className="premiumFooter">
        <div>
          <b>Seva<span>Setu</span></b>
          <p>Independent citizen-assistance platform for government service readiness.</p>
        </div>
        <div>
          <strong>Quick Links</strong>
          <button type="button" onClick={() => navigate("/app/schemes")}>Schemes</button>
          <button type="button" onClick={() => navigate("/app/documents")}>Documents</button>
        </div>
        <div>
          <strong>Citizen Promise</strong>
          <p>Simple, clear and trusted access to support.</p>
        </div>
      </footer>
    </main>
  );
}
